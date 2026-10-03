//! `extract_text`: a position-aware content-stream walker.
//!
//! Unlike lopdf's built-in extractor this tracks the text matrix, so it can
//! start a new line when the baseline moves, insert a space when a kerning gap
//! or a positioning jump is wide enough to be a word break, and decode strings
//! through the font's `/ToUnicode` CMap (or its `/Encoding` + `/Differences`).

use crate::common::*;
use crate::content::{ContentParser, Operand};
use crate::enc_data;
use crate::json;
use crate::stdfonts::{winansi_byte, StdFont};
use lopdf::{Dictionary, Document, Object, ObjectId, Stream};
use std::collections::{HashMap, HashSet};
use std::rc::Rc;
use std::sync::OnceLock;

/// A gap wider than this many ems between two pieces of text is a word break.
const GAP_EM: f64 = 0.15;
/// Baseline moves larger than this fraction of the font size start a new line.
const LINE_FRACTION: f64 = 0.6;

struct PageText {
    page: usize,
    text: String,
}

// ---------------------------------------------------------------------------
// Stream decoding
// ---------------------------------------------------------------------------

fn filter_names(doc: &Document, dict: &Dictionary) -> Vec<Vec<u8>> {
    match get(doc, dict, b"Filter") {
        Some(Object::Name(n)) => vec![n.clone()],
        Some(Object::Array(a)) => a
            .iter()
            .filter_map(|o| match deref(doc, o) {
                Object::Name(n) => Some(n.clone()),
                _ => None,
            })
            .collect(),
        _ => Vec::new(),
    }
}

fn decode_ascii_hex(data: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    let mut hi: Option<u8> = None;
    for &b in data {
        if b == b'>' {
            break;
        }
        let v = match b {
            b'0'..=b'9' => b - b'0',
            b'a'..=b'f' => b - b'a' + 10,
            b'A'..=b'F' => b - b'A' + 10,
            _ => continue,
        };
        match hi.take() {
            Some(h) => out.push(h * 16 + v),
            None => hi = Some(v),
        }
    }
    if let Some(h) = hi {
        out.push(h * 16);
    }
    out
}

fn decode_run_length(data: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    let mut i = 0;
    while i < data.len() {
        let n = data[i] as usize;
        i += 1;
        if n == 128 {
            break;
        } else if n < 128 {
            let end = (i + n + 1).min(data.len());
            out.extend_from_slice(&data[i..end]);
            i = end;
        } else if i < data.len() {
            out.resize(out.len() + (257 - n), data[i]);
            i += 1;
        }
    }
    out
}

/// Fully decode a stream's filter chain. `None` for filters we cannot undo
/// (DCT, JPX, CCITT, JBIG2, Crypt).
pub fn decode_stream(doc: &Document, stream: &Stream) -> Option<Vec<u8>> {
    let filters = filter_names(doc, &stream.dict);
    if filters.is_empty() {
        return Some(stream.content.clone());
    }
    let mut data = stream.content.clone();
    let mut rest: Vec<Vec<u8>> = Vec::new();
    // ASCIIHex / RunLength are not handled by lopdf; undo them when they lead.
    let mut leading = true;
    for f in &filters {
        if leading && (f == b"ASCIIHexDecode" || f == b"AHx") {
            data = decode_ascii_hex(&data);
        } else if leading && (f == b"RunLengthDecode" || f == b"RL") {
            data = decode_run_length(&data);
        } else {
            leading = false;
            rest.push(f.clone());
        }
    }
    if rest.is_empty() {
        return Some(data);
    }
    for f in &rest {
        if !matches!(
            f.as_slice(),
            b"FlateDecode" | b"Fl" | b"LZWDecode" | b"LZW" | b"ASCII85Decode" | b"A85"
        ) {
            return None;
        }
    }
    let mut tmp = Stream::new(Dictionary::new(), data);
    let names: Vec<Object> = rest
        .iter()
        .map(|f| {
            Object::Name(match f.as_slice() {
                b"Fl" => b"FlateDecode".to_vec(),
                b"LZW" => b"LZWDecode".to_vec(),
                b"A85" => b"ASCII85Decode".to_vec(),
                other => other.to_vec(),
            })
        })
        .collect();
    tmp.dict.set(
        "Filter",
        if names.len() == 1 {
            names[0].clone()
        } else {
            Object::Array(names)
        },
    );
    // Carry the (first) decode-parameter dictionary over for predictors.
    if let Some(p) = stream.dict.get(b"DecodeParms").ok().map(|p| deref(doc, p)) {
        match p {
            Object::Dictionary(d) => tmp.dict.set("DecodeParms", Object::Dictionary(d.clone())),
            Object::Array(a) => {
                if let Some(Object::Dictionary(d)) = a.first().map(|o| deref(doc, o)) {
                    tmp.dict.set("DecodeParms", Object::Dictionary(d.clone()));
                }
            }
            _ => {}
        }
    }
    tmp.decompressed_content().ok()
}

// ---------------------------------------------------------------------------
// Glyph names and ToUnicode CMaps
// ---------------------------------------------------------------------------

fn agl() -> &'static HashMap<&'static str, u32> {
    static MAP: OnceLock<HashMap<&'static str, u32>> = OnceLock::new();
    MAP.get_or_init(|| {
        let mut m = HashMap::new();
        for entry in enc_data::GLYPH_NAMES.split(';') {
            if let Some((name, hex)) = entry.split_once('=') {
                if let Ok(v) = u32::from_str_radix(hex, 16) {
                    m.insert(name, v);
                }
            }
        }
        m
    })
}

fn glyph_to_string(name: &str) -> Option<String> {
    if name == ".notdef" || name.is_empty() {
        return None;
    }
    let base = name.split('.').next().unwrap_or(name);
    if base.contains('_') {
        let mut s = String::new();
        for part in base.split('_') {
            s.push_str(&glyph_to_string(part)?);
        }
        return Some(s);
    }
    if let Some(rest) = base.strip_prefix("uni") {
        if rest.len() >= 4 && rest.len() % 4 == 0 && rest.bytes().all(|b| b.is_ascii_hexdigit()) {
            let mut s = String::new();
            for chunk in rest.as_bytes().chunks(4) {
                let v = u32::from_str_radix(std::str::from_utf8(chunk).ok()?, 16).ok()?;
                s.push(char::from_u32(v)?);
            }
            return Some(s);
        }
    }
    if let Some(rest) = base.strip_prefix('u') {
        if (4..=6).contains(&rest.len()) && rest.bytes().all(|b| b.is_ascii_hexdigit()) {
            let v = u32::from_str_radix(rest, 16).ok()?;
            return char::from_u32(v).map(|c| c.to_string());
        }
    }
    let v = *agl().get(base)?;
    char::from_u32(v).map(|c| c.to_string())
}

fn utf16_to_string(units: &[u16]) -> String {
    char::decode_utf16(units.iter().copied())
        .map(|r| r.unwrap_or('\u{FFFD}'))
        .collect()
}

fn dst_units(bytes: &[u8]) -> Vec<u16> {
    if bytes.len() == 1 {
        return vec![bytes[0] as u16];
    }
    bytes
        .chunks(2)
        .map(|c| {
            if c.len() == 2 {
                u16::from_be_bytes([c[0], c[1]])
            } else {
                c[0] as u16
            }
        })
        .collect()
}

fn be_value(bytes: &[u8]) -> u32 {
    bytes
        .iter()
        .take(4)
        .fold(0u32, |acc, &b| (acc << 8) | b as u32)
}

#[derive(Default)]
struct ToUni {
    single: HashMap<u32, String>,
    ranges: Vec<(u32, u32, Vec<u16>)>,
}

impl ToUni {
    fn lookup(&self, code: u32) -> Option<String> {
        if let Some(s) = self.single.get(&code) {
            return Some(s.clone());
        }
        // Ranges are sorted by start; scan back a few candidates that may overlap.
        let idx = self.ranges.partition_point(|r| r.0 <= code);
        for r in self.ranges[..idx].iter().rev().take(16) {
            if code <= r.1 {
                let mut units = r.2.clone();
                if let Some(last) = units.last_mut() {
                    *last = last.wrapping_add((code - r.0) as u16);
                }
                return Some(utf16_to_string(&units));
            }
        }
        None
    }
}

/// Parse a CMap stream: codespace ranges, bfchar and bfrange sections.
fn parse_cmap(data: &[u8]) -> (ToUni, Vec<(u32, u32, usize)>) {
    let mut to = ToUni::default();
    let mut codespace = Vec::new();
    let mut p = ContentParser::new(data);
    while let Some((op, args)) = p.next_op() {
        match op {
            b"endcodespacerange" => {
                for pair in args.chunks(2) {
                    if let [Operand::Str(lo), Operand::Str(hi)] = pair {
                        let len = lo.len().clamp(1, 4);
                        codespace.push((be_value(lo), be_value(hi), len));
                    }
                }
            }
            b"endbfchar" => {
                for pair in args.chunks(2) {
                    if let [Operand::Str(src), dst] = pair {
                        let s = match dst {
                            Operand::Str(d) => utf16_to_string(&dst_units(d)),
                            Operand::Name(n) => {
                                glyph_to_string(&String::from_utf8_lossy(n)).unwrap_or_default()
                            }
                            _ => continue,
                        };
                        to.single.insert(be_value(src), s);
                    }
                }
            }
            b"endbfrange" => {
                for triple in args.chunks(3) {
                    if let [Operand::Str(lo), Operand::Str(hi), dst] = triple {
                        let (lo, hi) = (be_value(lo), be_value(hi));
                        if hi < lo {
                            continue;
                        }
                        match dst {
                            Operand::Str(d) => {
                                to.ranges.push((lo, hi, dst_units(d)));
                            }
                            Operand::Arr(items) => {
                                for (i, item) in items.iter().enumerate() {
                                    if lo.saturating_add(i as u32) > hi {
                                        break;
                                    }
                                    if let Operand::Str(d) = item {
                                        to.single
                                            .insert(lo + i as u32, utf16_to_string(&dst_units(d)));
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                }
            }
            _ => {}
        }
    }
    to.ranges.sort_by_key(|r| r.0);
    (to, codespace)
}

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

enum Widths {
    /// No metrics at all: assume half an em.
    Default,
    Simple {
        first: i64,
        widths: Vec<f64>,
        missing: f64,
        scale: f64,
    },
    Std(StdFont),
    Cid {
        dw: f64,
        ranges: Vec<(u32, u32, f64)>,
    },
}

struct FontInfo {
    composite: bool,
    to_uni: Option<ToUni>,
    codespace: Vec<(u32, u32, usize)>,
    /// Simple fonts: per-code replacement text ("" = unknown).
    enc: Vec<String>,
    /// Composite font whose codes are UTF-16 (predefined Uni*-UCS2/UTF16 CMaps).
    ucs2: bool,
    widths: Widths,
}

impl FontInfo {
    fn next_code(&self, bytes: &[u8], pos: usize) -> (u32, usize) {
        let remaining = bytes.len() - pos;
        if !self.composite {
            return (bytes[pos] as u32, 1);
        }
        if self.codespace.is_empty() {
            let len = remaining.min(2);
            return (be_value(&bytes[pos..pos + len]), len);
        }
        for len in 1..=remaining.min(4) {
            let code = be_value(&bytes[pos..pos + len]);
            let hit = self.codespace.iter().any(|&(lo, hi, l)| {
                l == len
                    && (0..len).all(|i| {
                        let shift = 8 * (len - 1 - i) as u32;
                        let b = (code >> shift) & 0xFF;
                        b >= (lo >> shift) & 0xFF && b <= (hi >> shift) & 0xFF
                    })
            });
            if hit {
                return (code, len);
            }
        }
        let min_len = self
            .codespace
            .iter()
            .map(|c| c.2)
            .min()
            .unwrap_or(1)
            .min(remaining);
        (be_value(&bytes[pos..pos + min_len]), min_len)
    }

    fn decode(&self, code: u32) -> String {
        if let Some(t) = &self.to_uni {
            if let Some(s) = t.lookup(code) {
                return s;
            }
        }
        if self.composite {
            if self.ucs2 {
                return char::from_u32(code)
                    .map(|c| c.to_string())
                    .unwrap_or_default();
            }
            return String::new();
        }
        self.enc.get(code as usize).cloned().unwrap_or_default()
    }

    /// Advance width in thousandths of an em.
    fn width(&self, code: u32) -> f64 {
        match &self.widths {
            Widths::Default => 500.0,
            Widths::Simple {
                first,
                widths,
                missing,
                scale,
            } => {
                let idx = code as i64 - first;
                let w = if idx >= 0 {
                    widths.get(idx as usize).copied().unwrap_or(*missing)
                } else {
                    *missing
                };
                w * scale
            }
            Widths::Std(f) => {
                let ch = self
                    .enc
                    .get(code as usize)
                    .and_then(|s| s.chars().next())
                    .and_then(winansi_byte);
                match ch {
                    Some(b) => {
                        let w = f.width(b);
                        if w == 0 {
                            500.0
                        } else {
                            w as f64
                        }
                    }
                    None => 500.0,
                }
            }
            Widths::Cid { dw, ranges } => {
                let idx = ranges.partition_point(|r| r.0 <= code);
                for r in ranges[..idx].iter().rev().take(8) {
                    if code <= r.1 {
                        return r.2;
                    }
                }
                *dw
            }
        }
    }
}

fn table_to_strings(table: &[u16; 256]) -> Vec<String> {
    table
        .iter()
        .map(|&u| {
            if u == 0 {
                String::new()
            } else {
                char::from_u32(u as u32)
                    .map(|c| c.to_string())
                    .unwrap_or_default()
            }
        })
        .collect()
}

fn base_encoding(name: &[u8]) -> Option<Vec<String>> {
    match name {
        b"WinAnsiEncoding" => Some(table_to_strings(&enc_data::WINANSI)),
        b"MacRomanEncoding" => Some(table_to_strings(&enc_data::MACROMAN)),
        b"StandardEncoding" | b"MacExpertEncoding" => Some(table_to_strings(&enc_data::STANDARD)),
        _ => None,
    }
}

fn parse_cid_widths(doc: &Document, w: &Object) -> Vec<(u32, u32, f64)> {
    let mut out = Vec::new();
    let Some(arr) = deref(doc, w).as_array().ok() else {
        return out;
    };
    let mut i = 0;
    while i < arr.len() {
        let Some(first) = num(deref(doc, &arr[i])) else {
            i += 1;
            continue;
        };
        match arr.get(i + 1).map(|o| deref(doc, o)) {
            Some(Object::Array(list)) => {
                for (k, v) in list.iter().enumerate() {
                    if let Some(wv) = num(deref(doc, v)) {
                        let cid = (first as u32).saturating_add(k as u32);
                        out.push((cid, cid, wv));
                    }
                }
                i += 2;
            }
            Some(o) => {
                if let (Some(last), Some(wv)) =
                    (num(o), arr.get(i + 2).and_then(|x| num(deref(doc, x))))
                {
                    out.push((first as u32, last as u32, wv));
                }
                i += 3;
            }
            None => break,
        }
    }
    out.sort_by_key(|r| r.0);
    out
}

fn load_font(doc: &Document, fd: &Dictionary) -> FontInfo {
    let subtype = get_name(doc, fd, b"Subtype").unwrap_or(b"");
    let base_font = get_name(doc, fd, b"BaseFont")
        .map(|n| String::from_utf8_lossy(n).to_string())
        .unwrap_or_default();

    let mut to_uni = None;
    let mut codespace = Vec::new();
    if let Some(Object::Stream(s)) = get(doc, fd, b"ToUnicode") {
        if let Some(data) = decode_stream(doc, s) {
            let (t, cs) = parse_cmap(&data);
            if !t.single.is_empty() || !t.ranges.is_empty() {
                to_uni = Some(t);
            }
            codespace = cs;
        }
    }

    if subtype == b"Type0" {
        let mut ucs2 = false;
        match get(doc, fd, b"Encoding") {
            Some(Object::Name(n)) => {
                let n = String::from_utf8_lossy(n).to_string();
                ucs2 = n.contains("UCS2") || n.contains("UTF16");
            }
            Some(Object::Stream(s)) if codespace.is_empty() => {
                if let Some(data) = decode_stream(doc, s) {
                    codespace = parse_cmap(&data).1;
                }
            }
            _ => {}
        }
        let desc = get(doc, fd, b"DescendantFonts")
            .and_then(|o| o.as_array().ok())
            .and_then(|a| a.first())
            .map(|o| deref(doc, o))
            .and_then(|o| o.as_dict().ok());
        let (dw, ranges) = match desc {
            Some(d) => (
                get_num(doc, d, b"DW").unwrap_or(1000.0),
                get(doc, d, b"W")
                    .map(|w| parse_cid_widths(doc, w))
                    .unwrap_or_default(),
            ),
            None => (1000.0, Vec::new()),
        };
        return FontInfo {
            composite: true,
            to_uni,
            codespace,
            enc: Vec::new(),
            ucs2,
            widths: Widths::Cid { dw, ranges },
        };
    }

    // Simple fonts (Type1, MMType1, TrueType, Type3).
    let is_symbol = base_font.contains("Symbol");
    let mut enc: Vec<String> = match get(doc, fd, b"Encoding") {
        Some(Object::Name(n)) => {
            base_encoding(n).unwrap_or_else(|| default_encoding(subtype, is_symbol))
        }
        Some(Object::Dictionary(d)) => {
            let base = get_name(doc, d, b"BaseEncoding").and_then(base_encoding);
            base.unwrap_or_else(|| default_encoding(subtype, is_symbol))
        }
        _ => default_encoding(subtype, is_symbol),
    };
    if let Some(Object::Dictionary(d)) = get(doc, fd, b"Encoding") {
        if let Some(Object::Array(diffs)) = get(doc, d, b"Differences") {
            let mut code = 0usize;
            for item in diffs {
                match deref(doc, item) {
                    Object::Integer(i) => code = (*i).max(0) as usize,
                    Object::Name(n) => {
                        if code < 256 {
                            enc[code] =
                                glyph_to_string(&String::from_utf8_lossy(n)).unwrap_or_default();
                        }
                        code += 1;
                    }
                    _ => {}
                }
            }
        }
    }

    let descriptor = get(doc, fd, b"FontDescriptor").and_then(|o| o.as_dict().ok());
    let missing = descriptor
        .and_then(|d| get_num(doc, d, b"MissingWidth"))
        .unwrap_or(0.0);
    let widths = match get(doc, fd, b"Widths").and_then(|o| o.as_array().ok()) {
        Some(arr) => {
            let scale = if subtype == b"Type3" {
                get(doc, fd, b"FontMatrix")
                    .and_then(|o| o.as_array().ok())
                    .and_then(|a| a.first())
                    .and_then(|o| num(deref(doc, o)))
                    .map(|a| a * 1000.0)
                    .unwrap_or(1.0)
            } else {
                1.0
            };
            Widths::Simple {
                first: get_num(doc, fd, b"FirstChar").unwrap_or(0.0) as i64,
                widths: arr
                    .iter()
                    .map(|o| num(deref(doc, o)).unwrap_or(0.0))
                    .collect(),
                missing,
                scale,
            }
        }
        None if subtype == b"Type3" => Widths::Default,
        None if is_symbol || base_font.contains("Dingbats") => Widths::Default,
        None => Widths::Std(StdFont::guess(&base_font)),
    };

    FontInfo {
        composite: false,
        to_uni,
        codespace: Vec::new(),
        enc,
        ucs2: false,
        widths,
    }
}

fn default_encoding(subtype: &[u8], is_symbol: bool) -> Vec<String> {
    if is_symbol {
        table_to_strings(&enc_data::SYMBOL)
    } else if subtype == b"TrueType" {
        table_to_strings(&enc_data::WINANSI)
    } else {
        table_to_strings(&enc_data::STANDARD)
    }
}

// ---------------------------------------------------------------------------
// Output assembly
// ---------------------------------------------------------------------------

struct End {
    x: f64,
    y: f64,
    ux: f64,
    uy: f64,
    size: f64,
}

#[derive(Default)]
struct Out {
    lines: Vec<String>,
    cur: String,
    last: Option<End>,
    prev_gap: Option<f64>,
    /// The last character in `cur` is a space we inferred from a gap.
    auto_space: bool,
    /// Start position and text of the previous show operator (duplicate detection).
    last_run: Option<(f64, f64, String)>,
}

impl Out {
    fn flush_line(&mut self) {
        if !self.cur.trim().is_empty() {
            let line = self.cur.trim_end().to_string();
            self.lines.push(line);
        }
        self.cur.clear();
        self.auto_space = false;
    }

    fn newline(&mut self, gap: Option<f64>, size: f64) {
        let had_text = !self.cur.trim().is_empty();
        self.flush_line();
        if had_text {
            if let (Some(g), Some(prev)) = (gap, self.prev_gap) {
                if g > 1.5 * prev && g > 1.3 * size {
                    if self.lines.last().map(|l| !l.is_empty()).unwrap_or(false) {
                        self.lines.push(String::new());
                    }
                    return;
                }
            }
            if gap.is_some() {
                self.prev_gap = gap;
            }
        }
    }

    fn space(&mut self) {
        if !self.cur.is_empty() && !self.cur.ends_with(' ') {
            self.cur.push(' ');
            self.auto_space = true;
        }
    }

    /// Append decoded text, merging it with a space we inferred just before it.
    fn push(&mut self, s: &str) {
        let s = if self.auto_space && s.starts_with(' ') {
            &s[1..]
        } else {
            s
        };
        if !s.is_empty() {
            self.auto_space = false;
            self.cur.push_str(s);
        }
    }

    /// Called at the start of every text-showing operator.
    fn begin(&mut self, x: f64, y: f64, ux: f64, uy: f64, size: f64) {
        if let Some(l) = &self.last {
            let (dx, dy) = (x - l.x, y - l.y);
            let dot = ux * l.ux + uy * l.uy;
            let big = size.max(l.size);
            if dot < 0.7 {
                self.newline(None, big);
            } else {
                let along = dx * l.ux + dy * l.uy;
                let perp = (-dx * l.uy + dy * l.ux).abs();
                if perp > LINE_FRACTION * big {
                    self.newline(Some(perp), big);
                } else if along > GAP_EM * big {
                    self.space();
                } else if along < -big {
                    self.newline(None, big);
                }
            }
        }
    }

    fn finish(mut self) -> String {
        self.flush_line();
        while self.lines.last().map(|l| l.is_empty()).unwrap_or(false) {
            self.lines.pop();
        }
        normalize(&self.lines.join("\n"))
    }
}

fn normalize(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '\u{FB00}' => out.push_str("ff"),
            '\u{FB01}' => out.push_str("fi"),
            '\u{FB02}' => out.push_str("fl"),
            '\u{FB03}' => out.push_str("ffi"),
            '\u{FB04}' => out.push_str("ffl"),
            '\u{FB05}' | '\u{FB06}' => out.push_str("st"),
            '\u{00A0}' | '\u{2007}' | '\u{202F}' => out.push(' '),
            '\t' => out.push(' '),
            '\n' => out.push('\n'),
            c if (c as u32) < 0x20 || c as u32 == 0x7F || c == '\u{FFFD}' => {}
            c => out.push(c),
        }
    }
    out
}

// ---------------------------------------------------------------------------
// Interpreter
// ---------------------------------------------------------------------------

type Mat = [f64; 6];
const IDENT: Mat = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];

/// `a` applied first, then `b`.
fn mul(a: &Mat, b: &Mat) -> Mat {
    [
        a[0] * b[0] + a[1] * b[2],
        a[0] * b[1] + a[1] * b[3],
        a[2] * b[0] + a[3] * b[2],
        a[2] * b[1] + a[3] * b[3],
        a[4] * b[0] + a[5] * b[2] + b[4],
        a[4] * b[1] + a[5] * b[3] + b[5],
    ]
}

#[derive(Clone)]
struct GState {
    ctm: Mat,
    font: Option<Rc<FontInfo>>,
    size: f64,
    tc: f64,
    tw: f64,
    th: f64,
    tl: f64,
}

struct Interp<'a> {
    doc: &'a Document,
    fonts: HashMap<ObjectId, Rc<FontInfo>>,
    out: Out,
    gs: GState,
    stack: Vec<GState>,
    tm: Mat,
    tlm: Mat,
    form_stack: Vec<ObjectId>,
    budget: usize,
}

enum ShowItem<'b> {
    Text(&'b [u8]),
    Adjust(f64),
}

impl<'a> Interp<'a> {
    fn new(doc: &'a Document) -> Self {
        Interp {
            doc,
            fonts: HashMap::new(),
            out: Out::default(),
            gs: GState {
                ctm: IDENT,
                font: None,
                size: 0.0,
                tc: 0.0,
                tw: 0.0,
                th: 1.0,
                tl: 0.0,
            },
            stack: Vec::new(),
            tm: IDENT,
            tlm: IDENT,
            form_stack: Vec::new(),
            budget: 5_000_000,
        }
    }

    fn find_font(&mut self, res: Option<&Dictionary>, name: &[u8]) -> Option<Rc<FontInfo>> {
        let res = res?;
        let fonts = get(self.doc, res, b"Font")?.as_dict().ok()?;
        let entry = fonts.get(name).ok()?;
        if let Object::Reference(id) = entry {
            if let Some(f) = self.fonts.get(id) {
                return Some(f.clone());
            }
            let fd = deref(self.doc, entry).as_dict().ok()?;
            let info = Rc::new(load_font(self.doc, fd));
            self.fonts.insert(*id, info.clone());
            return Some(info);
        }
        let fd = entry.as_dict().ok()?;
        Some(Rc::new(load_font(self.doc, fd)))
    }

    fn run(&mut self, data: &[u8], res: Option<&Dictionary>) {
        let mut parser = ContentParser::new(data);
        let base_depth = self.stack.len();
        while let Some((op, args)) = parser.next_op() {
            if self.budget == 0 {
                break;
            }
            self.budget -= 1;
            let n = |i: usize| args.get(i).and_then(|a| a.as_num()).unwrap_or(0.0);
            match op {
                b"q" => self.stack.push(self.gs.clone()),
                b"Q" => {
                    if self.stack.len() > base_depth {
                        if let Some(g) = self.stack.pop() {
                            self.gs = g;
                        }
                    }
                }
                b"cm" if args.len() >= 6 => {
                    let m = [n(0), n(1), n(2), n(3), n(4), n(5)];
                    self.gs.ctm = mul(&m, &self.gs.ctm);
                }
                b"BT" => {
                    self.tm = IDENT;
                    self.tlm = IDENT;
                }
                b"Tf" => {
                    if let Some(name) = args.first().and_then(|a| a.as_name()) {
                        self.gs.font = self.find_font(res, name);
                    }
                    self.gs.size = n(1);
                }
                b"Tc" => self.gs.tc = n(0),
                b"Tw" => self.gs.tw = n(0),
                b"Tz" => self.gs.th = n(0) / 100.0,
                b"TL" => self.gs.tl = n(0),
                b"Td" => self.td(n(0), n(1)),
                b"TD" => {
                    self.gs.tl = -n(1);
                    self.td(n(0), n(1));
                }
                b"Tm" if args.len() >= 6 => {
                    self.tm = [n(0), n(1), n(2), n(3), n(4), n(5)];
                    self.tlm = self.tm;
                }
                b"T*" => self.td(0.0, -self.gs.tl),
                b"Tj" => {
                    if let Some(s) = args.first().and_then(|a| a.as_str()) {
                        self.show(&[ShowItem::Text(s)]);
                    }
                }
                b"'" => {
                    self.td(0.0, -self.gs.tl);
                    if let Some(s) = args.first().and_then(|a| a.as_str()) {
                        self.show(&[ShowItem::Text(s)]);
                    }
                }
                b"\"" => {
                    self.gs.tw = n(0);
                    self.gs.tc = n(1);
                    self.td(0.0, -self.gs.tl);
                    if let Some(s) = args.get(2).and_then(|a| a.as_str()) {
                        self.show(&[ShowItem::Text(s)]);
                    }
                }
                b"TJ" => {
                    if let Some(Operand::Arr(items)) = args.first() {
                        let list: Vec<ShowItem> = items
                            .iter()
                            .filter_map(|o| match o {
                                Operand::Str(s) => Some(ShowItem::Text(s)),
                                Operand::Num(v) => Some(ShowItem::Adjust(*v)),
                                _ => None,
                            })
                            .collect();
                        self.show(&list);
                    }
                }
                b"Do" => {
                    if let Some(name) = args.first().and_then(|a| a.as_name()) {
                        self.do_xobject(res, name);
                    }
                }
                _ => {}
            }
        }
        // Unbalanced q inside this stream must not leak into the caller.
        while self.stack.len() > base_depth {
            if let Some(g) = self.stack.pop() {
                self.gs = g;
            }
        }
    }

    fn td(&mut self, tx: f64, ty: f64) {
        self.tlm = mul(&[1.0, 0.0, 0.0, 1.0, tx, ty], &self.tlm);
        self.tm = self.tlm;
    }

    fn show(&mut self, items: &[ShowItem]) {
        let Some(font) = self.gs.font.clone() else {
            return;
        };
        let fs = self.gs.size;
        let th = self.gs.th;

        // Geometry of the start of this run in page space.
        let m = mul(&self.tm, &self.gs.ctm);
        let (px, py) = (m[4], m[5]);
        let (mut ux, mut uy) = (m[0], m[1]);
        let ulen = (ux * ux + uy * uy).sqrt();
        if ulen > 1e-9 {
            ux /= ulen;
            uy /= ulen;
        } else {
            ux = 1.0;
            uy = 0.0;
        }
        let vscale = (m[2] * m[2] + m[3] * m[3]).sqrt();
        let mut size = fs.abs() * if vscale > 1e-9 { vscale } else { ulen };
        if size < 1e-6 {
            size = 1.0;
        }

        // Decode the whole operator into one run, advancing the text matrix.
        let mut run = String::new();
        // A wide kerning gap only becomes a space if the next glyph is not one already.
        let mut pending_space = false;
        for item in items {
            match item {
                ShowItem::Adjust(v) => {
                    let em = -v / 1000.0;
                    if em > GAP_EM && !run.is_empty() {
                        pending_space = true;
                    }
                    let tx = em * fs * th;
                    self.tm[4] += tx * self.tm[0];
                    self.tm[5] += tx * self.tm[1];
                }
                ShowItem::Text(bytes) => {
                    let mut pos = 0;
                    while pos < bytes.len() {
                        let (code, len) = font.next_code(bytes, pos);
                        pos += len.max(1);
                        let decoded = font.decode(code);
                        if pending_space && !decoded.is_empty() {
                            if !decoded.starts_with(' ') && !run.ends_with(' ') {
                                run.push(' ');
                            }
                            pending_space = false;
                        }
                        run.push_str(&decoded);
                        let mut tx = font.width(code) / 1000.0 * fs + self.gs.tc;
                        if len == 1 && code == 32 {
                            tx += self.gs.tw;
                        }
                        tx *= th;
                        self.tm[4] += tx * self.tm[0];
                        self.tm[5] += tx * self.tm[1];
                    }
                }
            }
        }

        if run.is_empty() {
            return;
        }
        // Fake-bold / drop-shadow: the same text drawn again on top of itself.
        let duplicate = self.out.last_run.as_ref().is_some_and(|(x, y, t)| {
            *t == run && (px - x).abs() < 0.25 * size && (py - y).abs() < 0.25 * size
        });
        if !duplicate {
            self.out.begin(px, py, ux, uy, size);
            self.out.push(&run);
        }
        self.out.last_run = Some((px, py, run));

        let m = mul(&self.tm, &self.gs.ctm);
        self.out.last = Some(End {
            x: m[4],
            y: m[5],
            ux,
            uy,
            size,
        });
    }

    fn do_xobject(&mut self, res: Option<&Dictionary>, name: &[u8]) {
        if self.form_stack.len() >= 8 {
            return;
        }
        let Some(res) = res else { return };
        let Some(xobjs) = get(self.doc, res, b"XObject").and_then(|o| o.as_dict().ok()) else {
            return;
        };
        let Ok(Object::Reference(id)) = xobjs.get(name) else {
            return;
        };
        if self.form_stack.contains(id) {
            return;
        }
        let Some(Object::Stream(stream)) = self.doc.objects.get(id) else {
            return;
        };
        if get_name(self.doc, &stream.dict, b"Subtype") != Some(b"Form") {
            return;
        }
        let Some(data) = decode_stream(self.doc, stream) else {
            return;
        };
        let matrix = get(self.doc, &stream.dict, b"Matrix")
            .and_then(|o| o.as_array().ok())
            .filter(|a| a.len() >= 6)
            .map(|a| {
                let mut m = IDENT;
                for i in 0..6 {
                    m[i] = num(deref(self.doc, &a[i])).unwrap_or(m[i]);
                }
                m
            })
            .unwrap_or(IDENT);
        let form_res = get(self.doc, &stream.dict, b"Resources")
            .and_then(|o| o.as_dict().ok())
            .or(Some(res));

        let saved_gs = self.gs.clone();
        let (saved_tm, saved_tlm) = (self.tm, self.tlm);
        self.gs.ctm = mul(&matrix, &self.gs.ctm);
        self.form_stack.push(*id);
        self.run(&data, form_res);
        self.form_stack.pop();
        self.gs = saved_gs;
        self.tm = saved_tm;
        self.tlm = saved_tlm;
    }
}

fn page_text(
    doc: &Document,
    page: &PageRef,
    cache: &mut HashMap<ObjectId, Rc<FontInfo>>,
) -> String {
    let mut data = Vec::new();
    for sid in doc.get_page_contents(page.id) {
        if let Some(Object::Stream(s)) = doc.objects.get(&sid) {
            if let Some(d) = decode_stream(doc, s) {
                data.extend_from_slice(&d);
                data.push(b'\n');
            }
        }
    }
    let res = page
        .inh
        .resources
        .map(|o| deref(doc, o))
        .and_then(|o| o.as_dict().ok());
    let mut interp = Interp::new(doc);
    interp.fonts = std::mem::take(cache);
    interp.run(&data, res);
    let Interp { fonts, out, .. } = interp;
    *cache = fonts;
    out.finish()
}

pub fn extract_text(bytes: &[u8], spec: &str) -> Res<String> {
    let doc = load_plain(bytes)?;
    let pages = collect_pages(&doc);
    let total = pages.len();
    let mut selected: Vec<usize> = if spec.trim().is_empty() {
        (1..=total).collect()
    } else {
        let mut v = parse_pages(spec, total);
        v.sort_unstable();
        v.dedup();
        if v.is_empty() {
            return Err("No valid pages selected".to_string());
        }
        v
    };
    selected.retain(|&p| p >= 1 && p <= total);

    let mut cache: HashMap<ObjectId, Rc<FontInfo>> = HashMap::new();
    let mut results = Vec::with_capacity(selected.len());
    let mut seen: HashSet<usize> = HashSet::new();
    for p in selected {
        if !seen.insert(p) {
            continue;
        }
        let text = page_text(&doc, &pages[p - 1], &mut cache);
        results.push(PageText { page: p, text });
    }
    let items: Vec<String> = results
        .iter()
        .map(|r| format!("{{\"page\":{},\"text\":{}}}", r.page, json::quote(&r.text)))
        .collect();
    Ok(format!("[{}]", items.join(",")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn glyph_names() {
        assert_eq!(glyph_to_string("fi").as_deref(), Some("\u{FB01}"));
        assert_eq!(glyph_to_string("uni00E9").as_deref(), Some("é"));
        assert_eq!(glyph_to_string("u1F600").as_deref(), Some("\u{1F600}"));
        assert_eq!(glyph_to_string("f_i").as_deref(), Some("fi"));
        assert_eq!(glyph_to_string("a.sc").as_deref(), Some("a"));
        assert_eq!(glyph_to_string("endash").as_deref(), Some("–"));
        assert_eq!(glyph_to_string(".notdef"), None);
    }

    #[test]
    fn cmap_parsing() {
        let cmap = b"/CIDInit /ProcSet findresource begin 12 dict begin begincmap
1 begincodespacerange <0000> <FFFF> endcodespacerange
2 beginbfchar <0003> <0020> <0004> <00660069> endbfchar
2 beginbfrange <0010> <0012> <0041> <0020> <0021> [<0061> <0062>] endbfrange
endcmap";
        let (t, cs) = parse_cmap(cmap);
        assert_eq!(cs, vec![(0, 0xFFFF, 2)]);
        assert_eq!(t.lookup(3).unwrap(), " ");
        assert_eq!(t.lookup(4).unwrap(), "fi");
        assert_eq!(t.lookup(0x11).unwrap(), "B");
        assert_eq!(t.lookup(0x21).unwrap(), "b");
    }

    #[test]
    fn ligature_and_control_normalisation() {
        assert_eq!(normalize("\u{FB01}nd\u{00A0}x\u{0001}"), "find x");
    }
}
