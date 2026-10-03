//! A small, forgiving tokenizer for PDF content streams (and the PostScript-ish
//! syntax of CMaps). It never fails: malformed input just yields odd tokens.
//!
//! Operands are collected on a stack and returned together with the operator
//! that consumes them, which is all the text walker and the q/Q depth counter
//! need.

#[derive(Debug, Clone)]
pub enum Operand {
    Num(f64),
    Name(Vec<u8>),
    Str(Vec<u8>),
    Arr(Vec<Operand>),
    Other,
}

impl Operand {
    pub fn as_num(&self) -> Option<f64> {
        match self {
            Operand::Num(n) => Some(*n),
            _ => None,
        }
    }
    pub fn as_name(&self) -> Option<&[u8]> {
        match self {
            Operand::Name(n) => Some(n),
            _ => None,
        }
    }
    pub fn as_str(&self) -> Option<&[u8]> {
        match self {
            Operand::Str(s) => Some(s),
            _ => None,
        }
    }
}

pub struct ContentParser<'a> {
    data: &'a [u8],
    pos: usize,
    stack: Vec<Operand>,
    /// Current array nesting (bounded so hostile input cannot exhaust the stack).
    depth: usize,
}

#[inline]
pub fn is_ws(b: u8) -> bool {
    matches!(b, 0 | 9 | 10 | 12 | 13 | 32)
}

#[inline]
fn is_delim(b: u8) -> bool {
    matches!(
        b,
        b'(' | b')' | b'<' | b'>' | b'[' | b']' | b'{' | b'}' | b'/' | b'%'
    )
}

#[inline]
fn is_regular(b: u8) -> bool {
    !is_ws(b) && !is_delim(b)
}

fn hex_val(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

enum Tok<'a> {
    Operand(Operand),
    ArrClose,
    Op(&'a [u8]),
    Eof,
}

impl<'a> ContentParser<'a> {
    pub fn new(data: &'a [u8]) -> Self {
        ContentParser {
            data,
            pos: 0,
            stack: Vec::new(),
            depth: 0,
        }
    }

    fn skip_ws_and_comments(&mut self) {
        while self.pos < self.data.len() {
            let b = self.data[self.pos];
            if is_ws(b) {
                self.pos += 1;
            } else if b == b'%' {
                while self.pos < self.data.len() && !matches!(self.data[self.pos], 10 | 13) {
                    self.pos += 1;
                }
            } else {
                break;
            }
        }
    }

    fn read_literal_string(&mut self) -> Vec<u8> {
        // self.pos is just past the opening '('
        let mut out = Vec::new();
        let mut depth = 1usize;
        while self.pos < self.data.len() {
            let b = self.data[self.pos];
            self.pos += 1;
            match b {
                b'(' => {
                    depth += 1;
                    out.push(b);
                }
                b')' => {
                    depth -= 1;
                    if depth == 0 {
                        break;
                    }
                    out.push(b);
                }
                b'\\' => {
                    let Some(&e) = self.data.get(self.pos) else {
                        break;
                    };
                    self.pos += 1;
                    match e {
                        b'n' => out.push(b'\n'),
                        b'r' => out.push(b'\r'),
                        b't' => out.push(b'\t'),
                        b'b' => out.push(8),
                        b'f' => out.push(12),
                        b'0'..=b'7' => {
                            let mut v = (e - b'0') as u32;
                            for _ in 0..2 {
                                match self.data.get(self.pos) {
                                    Some(&d @ b'0'..=b'7') => {
                                        v = v * 8 + (d - b'0') as u32;
                                        self.pos += 1;
                                    }
                                    _ => break,
                                }
                            }
                            out.push((v & 0xFF) as u8);
                        }
                        b'\r' => {
                            if self.data.get(self.pos) == Some(&b'\n') {
                                self.pos += 1;
                            }
                        }
                        b'\n' => {}
                        other => out.push(other),
                    }
                }
                _ => out.push(b),
            }
        }
        out
    }

    fn read_hex_string(&mut self) -> Vec<u8> {
        // self.pos is just past the opening '<'
        let mut out = Vec::new();
        let mut hi: Option<u8> = None;
        while self.pos < self.data.len() {
            let b = self.data[self.pos];
            self.pos += 1;
            if b == b'>' {
                break;
            }
            if let Some(v) = hex_val(b) {
                match hi.take() {
                    Some(h) => out.push(h * 16 + v),
                    None => hi = Some(v),
                }
            }
        }
        if let Some(h) = hi {
            out.push(h * 16);
        }
        out
    }

    fn skip_dict(&mut self) {
        // self.pos is just past the opening "<<"; skip to the matching ">>".
        let mut depth = 1usize;
        while self.pos < self.data.len() && depth > 0 {
            let b = self.data[self.pos];
            match b {
                b'(' => {
                    self.pos += 1;
                    let _ = self.read_literal_string();
                }
                b'<' => {
                    if self.data.get(self.pos + 1) == Some(&b'<') {
                        depth += 1;
                        self.pos += 2;
                    } else {
                        self.pos += 1;
                        let _ = self.read_hex_string();
                    }
                }
                b'>' => {
                    if self.data.get(self.pos + 1) == Some(&b'>') {
                        depth -= 1;
                        self.pos += 2;
                    } else {
                        self.pos += 1;
                    }
                }
                _ => self.pos += 1,
            }
        }
    }

    fn read_name(&mut self) -> Vec<u8> {
        let mut out = Vec::new();
        while self.pos < self.data.len() && is_regular(self.data[self.pos]) {
            let b = self.data[self.pos];
            if b == b'#' {
                if let (Some(h), Some(l)) = (
                    self.data.get(self.pos + 1).and_then(|&c| hex_val(c)),
                    self.data.get(self.pos + 2).and_then(|&c| hex_val(c)),
                ) {
                    out.push(h * 16 + l);
                    self.pos += 3;
                    continue;
                }
            }
            out.push(b);
            self.pos += 1;
        }
        out
    }

    fn next_token(&mut self, in_array: bool) -> Tok<'a> {
        loop {
            self.skip_ws_and_comments();
            let Some(&b) = self.data.get(self.pos) else {
                return Tok::Eof;
            };
            return match b {
                b'(' => {
                    self.pos += 1;
                    Tok::Operand(Operand::Str(self.read_literal_string()))
                }
                b'<' => {
                    if self.data.get(self.pos + 1) == Some(&b'<') {
                        self.pos += 2;
                        self.skip_dict();
                        Tok::Operand(Operand::Other)
                    } else {
                        self.pos += 1;
                        Tok::Operand(Operand::Str(self.read_hex_string()))
                    }
                }
                b'[' => {
                    self.pos += 1;
                    if self.depth >= 32 {
                        return Tok::Operand(Operand::Other);
                    }
                    self.depth += 1;
                    let mut items = Vec::new();
                    loop {
                        match self.next_token(true) {
                            Tok::Operand(o) => items.push(o),
                            Tok::ArrClose | Tok::Eof => break,
                            Tok::Op(_) => {}
                        }
                    }
                    self.depth -= 1;
                    Tok::Operand(Operand::Arr(items))
                }
                b']' => {
                    self.pos += 1;
                    if in_array {
                        Tok::ArrClose
                    } else {
                        continue;
                    }
                }
                b'/' => {
                    self.pos += 1;
                    Tok::Operand(Operand::Name(self.read_name()))
                }
                b')' | b'>' | b'{' | b'}' => {
                    self.pos += 1;
                    continue;
                }
                _ => {
                    let start = self.pos;
                    while self.pos < self.data.len() && is_regular(self.data[self.pos]) {
                        self.pos += 1;
                    }
                    let tok = &self.data[start..self.pos];
                    if matches!(tok[0], b'0'..=b'9' | b'+' | b'-' | b'.') {
                        if let Some(n) = parse_number(tok) {
                            return Tok::Operand(Operand::Num(n));
                        }
                    }
                    match tok {
                        b"true" | b"false" | b"null" => Tok::Operand(Operand::Other),
                        _ => Tok::Op(tok),
                    }
                }
            };
        }
    }

    /// Next operator with the operands collected since the previous one.
    /// Inline images (`BI … ID … EI`) are skipped and reported as a bare `BI`.
    pub fn next_op(&mut self) -> Option<(&'a [u8], Vec<Operand>)> {
        loop {
            match self.next_token(false) {
                Tok::Operand(o) => {
                    if self.stack.len() < 4096 {
                        self.stack.push(o);
                    }
                }
                Tok::ArrClose => {}
                Tok::Eof => return None,
                Tok::Op(op) => {
                    if op == b"BI" {
                        self.skip_inline_image();
                        self.stack.clear();
                        return Some((op, Vec::new()));
                    }
                    return Some((op, std::mem::take(&mut self.stack)));
                }
            }
        }
    }

    fn skip_inline_image(&mut self) {
        // Skip the key/value dictionary up to the ID operator.
        loop {
            match self.next_token(false) {
                Tok::Op(op) if op == b"ID" => break,
                Tok::Eof => return,
                _ => {}
            }
        }
        // One whitespace byte follows ID, then raw data up to "EI".
        if self.pos < self.data.len() && is_ws(self.data[self.pos]) {
            self.pos += 1;
        }
        let d = self.data;
        let mut i = self.pos;
        while i + 1 < d.len() {
            if d[i] == b'E'
                && d[i + 1] == b'I'
                && (i == self.pos || is_ws(d[i - 1]))
                && (i + 2 >= d.len() || is_ws(d[i + 2]))
            {
                // The bytes right after EI must look like content-stream text.
                let tail = &d[(i + 2).min(d.len())..(i + 12).min(d.len())];
                if tail.iter().all(|&c| c < 128 && (c >= 32 || is_ws(c))) {
                    self.pos = i + 2;
                    return;
                }
            }
            i += 1;
        }
        self.pos = d.len();
    }
}

fn parse_number(tok: &[u8]) -> Option<f64> {
    let s = std::str::from_utf8(tok).ok()?;
    if let Ok(v) = s.parse::<f64>() {
        return v.is_finite().then_some(v);
    }
    // Tolerate junk like "--5" or "5-3" the way viewers do: keep the leading number.
    let t = s.trim_start_matches(['+', '-']);
    let neg = s.starts_with('-');
    let mut end = 0;
    let mut seen_dot = false;
    for (i, c) in t.char_indices() {
        if c.is_ascii_digit() {
            end = i + 1;
        } else if c == '.' && !seen_dot {
            seen_dot = true;
            end = i + 1;
        } else {
            break;
        }
    }
    let v: f64 = t[..end].parse().ok()?;
    Some(if neg { -v } else { v })
}

/// Net `q`/`Q` nesting left open by a content stream (never negative).
pub fn open_q_depth(data: &[u8]) -> usize {
    let mut p = ContentParser::new(data);
    let mut depth: i64 = 0;
    while let Some((op, _)) = p.next_op() {
        match op {
            b"q" => depth += 1,
            b"Q" => depth = (depth - 1).max(0),
            _ => {}
        }
    }
    depth.max(0) as usize
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokenizes_text_ops() {
        let mut p = ContentParser::new(b"BT /F1 12 Tf 10 20 Td [(He) -250 (llo\\) w)] TJ ET");
        let ops: Vec<_> = std::iter::from_fn(|| p.next_op()).collect();
        let names: Vec<&[u8]> = ops.iter().map(|(o, _)| *o).collect();
        assert_eq!(names, vec![&b"BT"[..], b"Tf", b"Td", b"TJ", b"ET"]);
        let tj = &ops[3].1;
        match &tj[0] {
            Operand::Arr(a) => {
                assert_eq!(a.len(), 3);
                assert_eq!(a[2].as_str().unwrap(), b"llo) w");
                assert_eq!(a[1].as_num().unwrap(), -250.0);
            }
            _ => panic!("expected array"),
        }
    }

    #[test]
    fn skips_inline_images_and_counts_depth() {
        let data = b"q BI /W 2 /H 2 /BPC 8 /CS /G ID \x01Q\x02EI \x03 EI Q q q 1 0 0 1 0 0 cm";
        assert_eq!(open_q_depth(data), 2);
    }

    #[test]
    fn hostile_nesting_does_not_overflow_the_stack() {
        let mut data = vec![b')'; 300_000];
        data.extend(std::iter::repeat(b'[').take(300_000));
        data.extend(b" (x) Tj");
        let mut p = ContentParser::new(&data);
        let mut n = 0;
        while p.next_op().is_some() {
            n += 1;
        }
        assert!(n <= 2);
        let nested = vec![b'<'; 200_000];
        let mut p = ContentParser::new(&nested);
        while p.next_op().is_some() {}
    }

    #[test]
    fn hex_strings_and_dicts() {
        let mut p = ContentParser::new(b"/Span <</ActualText (x)>> BDC <48656C6C6F> Tj");
        let (op, args) = p.next_op().unwrap();
        assert_eq!(op, b"BDC");
        assert_eq!(args.len(), 2);
        let (op, args) = p.next_op().unwrap();
        assert_eq!(op, b"Tj");
        assert_eq!(args[0].as_str().unwrap(), b"Hello");
    }
}
