//! Shared helpers: tolerant object access, page-tree walking with inherited
//! attributes, page geometry, reachability pruning and compact renumbering.
//!
//! All helpers are pure Rust (no wasm-bindgen types) so they can be unit-tested
//! natively; the `#[wasm_bindgen]` wrappers in `lib.rs` just convert errors.

use lopdf::{Dictionary, Document, Object, ObjectId};
use std::collections::{BTreeMap, HashSet};

pub type Res<T> = Result<T, String>;

pub const ENCRYPTED_MSG: &str =
    "This PDF is password-protected. Unlock it with its password first.";

/// Load a document for reading or editing.
///
/// lopdf transparently decrypts files whose *user* password is empty (owner-only
/// restrictions); for those the returned document is plain and saving it drops
/// the encryption. Files that still need a password are rejected with a clear
/// message instead of silently operating on ciphertext.
pub fn load_plain(bytes: &[u8]) -> Res<Document> {
    let doc = crate::crypt::open(bytes)?;
    if doc.trailer.has(b"Encrypt") {
        return Err(ENCRYPTED_MSG.to_string());
    }
    Ok(doc)
}

pub fn save_doc(doc: &mut Document) -> Res<Vec<u8>> {
    // Keep the trailer /Size honest after objects were removed.
    doc.max_id = doc.objects.keys().map(|k| k.0).max().unwrap_or(0);
    let mut out = Vec::new();
    doc.save_to(&mut out)
        .map_err(|e| format!("Could not write PDF: {e}"))?;
    Ok(out)
}

static NULL: Object = Object::Null;

/// Follow indirect references (bounded). Missing targets resolve to `Null`.
pub fn deref<'a>(doc: &'a Document, obj: &'a Object) -> &'a Object {
    let mut cur = obj;
    for _ in 0..32 {
        match cur {
            Object::Reference(id) => match doc.objects.get(id) {
                Some(o) => cur = o,
                None => return &NULL,
            },
            _ => return cur,
        }
    }
    &NULL
}

/// Dictionary entry with references resolved; `None` when absent or null.
pub fn get<'a>(doc: &'a Document, dict: &'a Dictionary, key: &[u8]) -> Option<&'a Object> {
    let v = deref(doc, dict.get(key).ok()?);
    if matches!(v, Object::Null) {
        None
    } else {
        Some(v)
    }
}

/// The dictionary of a dictionary-or-stream object.
pub fn dict_of(obj: &Object) -> Option<&Dictionary> {
    match obj {
        Object::Dictionary(d) => Some(d),
        Object::Stream(s) => Some(&s.dict),
        _ => None,
    }
}

pub fn num(obj: &Object) -> Option<f64> {
    match obj {
        Object::Integer(i) => Some(*i as f64),
        Object::Real(r) => Some(*r as f64),
        _ => None,
    }
}

pub fn get_num(doc: &Document, dict: &Dictionary, key: &[u8]) -> Option<f64> {
    num(get(doc, dict, key)?)
}

pub fn get_name<'a>(doc: &'a Document, dict: &'a Dictionary, key: &[u8]) -> Option<&'a [u8]> {
    match get(doc, dict, key)? {
        Object::Name(n) => Some(n.as_slice()),
        _ => None,
    }
}

/// Four numbers (indirect elements allowed) as a normalised `[llx, lly, urx, ury]`.
pub fn rect_of(doc: &Document, obj: &Object) -> Option<[f64; 4]> {
    let arr = deref(doc, obj).as_array().ok()?;
    if arr.len() < 4 {
        return None;
    }
    let mut v = [0.0f64; 4];
    for i in 0..4 {
        v[i] = num(deref(doc, &arr[i]))?;
    }
    Some([
        v[0].min(v[2]),
        v[1].min(v[3]),
        v[0].max(v[2]),
        v[1].max(v[3]),
    ])
}

/// Attributes a page inherits from its ancestors in the page tree. Values are
/// the raw objects (often references) from the nearest ancestor that sets them.
#[derive(Clone, Copy, Default)]
pub struct Inherited<'a> {
    pub resources: Option<&'a Object>,
    pub media_box: Option<&'a Object>,
    pub crop_box: Option<&'a Object>,
    pub rotate: Option<&'a Object>,
}

pub struct PageRef<'a> {
    pub id: ObjectId,
    pub inh: Inherited<'a>,
}

fn present<'a>(doc: &'a Document, dict: &'a Dictionary, key: &[u8]) -> Option<&'a Object> {
    let raw = dict.get(key).ok()?;
    if matches!(deref(doc, raw), Object::Null) {
        None
    } else {
        Some(raw)
    }
}

/// Walk the page tree from the catalog, returning pages in document order with
/// inheritable attributes resolved top-down (no reliance on `/Parent`).
pub fn collect_pages(doc: &Document) -> Vec<PageRef<'_>> {
    let mut out = Vec::new();
    let root = match doc
        .trailer
        .get(b"Root")
        .ok()
        .and_then(|r| deref(doc, r).as_dict().ok())
        .and_then(|cat| cat.get(b"Pages").ok())
        .and_then(|p| p.as_reference().ok())
    {
        Some(id) => id,
        None => return out,
    };
    let mut visited: HashSet<ObjectId> = HashSet::new();
    walk_node(doc, root, Inherited::default(), &mut visited, &mut out, 0);
    out
}

fn walk_node<'a>(
    doc: &'a Document,
    id: ObjectId,
    parent: Inherited<'a>,
    visited: &mut HashSet<ObjectId>,
    out: &mut Vec<PageRef<'a>>,
    depth: usize,
) {
    if depth > 128 || !visited.insert(id) {
        return;
    }
    let dict = match doc.objects.get(&id).and_then(|o| o.as_dict().ok()) {
        Some(d) => d,
        None => return,
    };
    let inh = Inherited {
        resources: present(doc, dict, b"Resources").or(parent.resources),
        media_box: present(doc, dict, b"MediaBox").or(parent.media_box),
        crop_box: present(doc, dict, b"CropBox").or(parent.crop_box),
        rotate: present(doc, dict, b"Rotate").or(parent.rotate),
    };
    let ty = dict.get(b"Type").ok().and_then(|t| t.as_name().ok());
    let is_node = match ty {
        Some(b"Pages") => true,
        Some(b"Page") => false,
        _ => dict.has(b"Kids"),
    };
    if !is_node {
        out.push(PageRef { id, inh });
        return;
    }
    let kids = match dict.get(b"Kids").ok().map(|k| deref(doc, k)) {
        Some(Object::Array(a)) => a,
        _ => return,
    };
    for kid in kids {
        if let Object::Reference(kid_id) = kid {
            walk_node(doc, *kid_id, inh, visited, out, depth + 1);
        }
    }
}

/// Visible page geometry in default user space.
#[derive(Clone, Copy, Debug)]
pub struct Geom {
    pub llx: f64,
    pub lly: f64,
    pub urx: f64,
    pub ury: f64,
    /// Normalised `/Rotate`: 0, 90, 180 or 270.
    pub rotate: i32,
}

impl Geom {
    pub fn width(&self) -> f64 {
        self.urx - self.llx
    }
    pub fn height(&self) -> f64 {
        self.ury - self.lly
    }
    /// Map a point in the visible (rotated, bottom-left origin) space back to
    /// default user space.
    pub fn to_user(self, vx: f64, vy: f64) -> (f64, f64) {
        let (w, h) = (self.width(), self.height());
        match self.rotate {
            90 => (self.llx + w - vy, self.lly + vx),
            180 => (self.llx + w - vx, self.lly + h - vy),
            270 => (self.llx + vy, self.lly + h - vx),
            _ => (self.llx + vx, self.lly + vy),
        }
    }
    pub fn visible_size(&self) -> (f64, f64) {
        if self.rotate == 90 || self.rotate == 270 {
            (self.height(), self.width())
        } else {
            (self.width(), self.height())
        }
    }
}

pub fn normalize_rotate(r: f64) -> i32 {
    let q = (r / 90.0).round() as i64;
    (((q % 4) + 4) % 4) as i32 * 90
}

pub fn page_geom(doc: &Document, inh: &Inherited) -> Geom {
    let media = inh
        .media_box
        .and_then(|o| rect_of(doc, o))
        .filter(|r| r[2] - r[0] > 0.0 && r[3] - r[1] > 0.0)
        .unwrap_or([0.0, 0.0, 612.0, 792.0]);
    let mut vis = media;
    if let Some(crop) = inh.crop_box.and_then(|o| rect_of(doc, o)) {
        let ix = [
            crop[0].max(media[0]),
            crop[1].max(media[1]),
            crop[2].min(media[2]),
            crop[3].min(media[3]),
        ];
        if ix[2] - ix[0] > 0.0 && ix[3] - ix[1] > 0.0 {
            vis = ix;
        } else if crop[2] - crop[0] > 0.0 && crop[3] - crop[1] > 0.0 {
            vis = crop;
        }
    }
    let rotate = inh
        .rotate
        .and_then(|o| num(deref(doc, o)))
        .map(normalize_rotate)
        .unwrap_or(0);
    Geom {
        llx: vis[0],
        lly: vis[1],
        urx: vis[2],
        ury: vis[3],
        rotate,
    }
}

// ---------------------------------------------------------------------------
// Reachability + renumbering
// ---------------------------------------------------------------------------

fn push_refs(obj: &Object, stack: &mut Vec<ObjectId>) {
    let mut work: Vec<&Object> = vec![obj];
    while let Some(o) = work.pop() {
        match o {
            Object::Reference(id) => stack.push(*id),
            Object::Array(a) => work.extend(a.iter()),
            Object::Dictionary(d) => work.extend(d.iter().map(|(_, v)| v)),
            Object::Stream(s) => work.extend(s.dict.iter().map(|(_, v)| v)),
            _ => {}
        }
    }
}

/// Remove every object not reachable from the trailer. Returns how many were dropped.
pub fn prune_unreferenced(doc: &mut Document) -> usize {
    let mut seen: HashSet<ObjectId> = HashSet::new();
    let mut stack: Vec<ObjectId> = Vec::new();
    for (_, v) in doc.trailer.iter() {
        push_refs(v, &mut stack);
    }
    while let Some(id) = stack.pop() {
        if !seen.insert(id) {
            continue;
        }
        if let Some(o) = doc.objects.get(&id) {
            push_refs(o, &mut stack);
        }
    }
    let before = doc.objects.len();
    doc.objects.retain(|id, _| seen.contains(id));
    before - doc.objects.len()
}

fn remap_refs(obj: &mut Object, map: &BTreeMap<ObjectId, ObjectId>) {
    let mut work: Vec<&mut Object> = vec![obj];
    while let Some(o) = work.pop() {
        match o {
            Object::Reference(id) => match map.get(id) {
                Some(n) => *id = *n,
                // A reference to a missing object is null by definition; make that
                // explicit so the id cannot be re-used by another object.
                None => *o = Object::Null,
            },
            Object::Array(a) => work.extend(a.iter_mut()),
            Object::Dictionary(d) => work.extend(d.iter_mut().map(|(_, v)| v)),
            Object::Stream(s) => work.extend(s.dict.iter_mut().map(|(_, v)| v)),
            _ => {}
        }
    }
}

/// Renumber objects to a dense 1..=n range in a single linear pass.
pub fn renumber_compact(doc: &mut Document) {
    let ids: Vec<ObjectId> = doc.objects.keys().copied().collect();
    let mut map: BTreeMap<ObjectId, ObjectId> = BTreeMap::new();
    for (i, id) in ids.iter().enumerate() {
        map.insert(*id, ((i + 1) as u32, id.1));
    }
    let old = std::mem::take(&mut doc.objects);
    for (id, mut obj) in old {
        remap_refs(&mut obj, &map);
        doc.objects.insert(map[&id], obj);
    }
    for (_, v) in doc.trailer.iter_mut() {
        remap_refs(v, &map);
    }
    doc.max_id = ids.len() as u32;
}

/// Parse a PDF version string like "1.7" into (major, minor).
pub fn parse_version(v: &str) -> (u32, u32) {
    let mut it = v.trim().split('.');
    let major = it.next().and_then(|s| s.parse().ok()).unwrap_or(1);
    let minor = it.next().and_then(|s| s.parse().ok()).unwrap_or(4);
    (major, minor)
}

/// Raise `doc.version` to at least `min` ("1.6" etc.).
pub fn ensure_min_version(doc: &mut Document, min: &str) {
    if parse_version(&doc.version) < parse_version(min) {
        doc.version = min.to_string();
    }
}

/// Format a number compactly for content streams (at most 4 decimals).
pub fn fmt_num(v: f64) -> String {
    if !v.is_finite() {
        return "0".to_string();
    }
    let mut s = format!("{:.4}", v);
    if s.contains('.') {
        while s.ends_with('0') {
            s.pop();
        }
        if s.ends_with('.') {
            s.pop();
        }
    }
    if s == "-0" {
        s = "0".to_string();
    }
    s
}

/// Round to 3 decimals (JSON output), hiding f32 representation noise.
pub fn round3(v: f64) -> f64 {
    (v * 1000.0).round() / 1000.0
}

/// Parse a 1-based page-selection string like "1,3,5-8" into page numbers,
/// clamped to `max`. Out-of-range or malformed parts are skipped.
pub fn parse_pages(spec: &str, max: usize) -> Vec<usize> {
    let mut out: Vec<usize> = Vec::new();
    for part in spec.split(',') {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }
        if let Some((a, b)) = part.split_once('-') {
            if let (Ok(a), Ok(b)) = (a.trim().parse::<usize>(), b.trim().parse::<usize>()) {
                let (lo, hi) = if a <= b { (a, b) } else { (b, a) };
                // (clamped first so absurd ranges like "1-99999999999" cannot spin)
                for p in lo.max(1)..=hi.min(max) {
                    out.push(p);
                }
            }
        } else if let Ok(p) = part.parse::<usize>() {
            if p >= 1 && p <= max {
                out.push(p);
            }
        }
    }
    out
}
