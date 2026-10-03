//! Image inventory (`list_images`), raw stream access (`get_image_stream`) and
//! JPEG replacement (`replace_images`).

use crate::common::*;
use crate::json::{self, Json};
use lopdf::{Dictionary, Document, Object, ObjectId};
use std::collections::{HashMap, HashSet};

struct ImageInfo {
    id: u32,
    page: usize,
    width: i64,
    height: i64,
    filter: String,
    color_space: String,
    components: u32,
    bits_per_component: i64,
    length: usize,
    has_s_mask: bool,
    is_mask: bool,
    has_predictor: bool,
}

impl ImageInfo {
    fn to_json(&self) -> String {
        format!(
            "{{\"id\":{},\"page\":{},\"width\":{},\"height\":{},\"filter\":{},\"colorSpace\":{},\"components\":{},\"bitsPerComponent\":{},\"length\":{},\"hasSMask\":{},\"isMask\":{},\"hasPredictor\":{}}}",
            self.id,
            self.page,
            self.width,
            self.height,
            json::quote(&self.filter),
            json::quote(&self.color_space),
            self.components,
            self.bits_per_component,
            self.length,
            self.has_s_mask,
            self.is_mask,
            self.has_predictor
        )
    }
}

fn is_image(obj: &Object) -> bool {
    match obj {
        Object::Stream(s) => {
            s.dict.get(b"Subtype").and_then(Object::as_name).ok() == Some(b"Image")
        }
        _ => false,
    }
}

/// Colour-space name and component count for an image dictionary.
fn colour_space(doc: &Document, dict: &Dictionary) -> (String, u32) {
    let Some(cs) = get(doc, dict, b"ColorSpace") else {
        return (String::new(), 0);
    };
    match cs {
        Object::Name(n) => {
            let name = String::from_utf8_lossy(n).to_string();
            let comps = match name.as_str() {
                "DeviceGray" | "G" | "CalGray" => 1,
                "DeviceRGB" | "RGB" | "CalRGB" => 3,
                "DeviceCMYK" | "CMYK" => 4,
                _ => 0,
            };
            let name = match name.as_str() {
                "G" => "DeviceGray".to_string(),
                "RGB" => "DeviceRGB".to_string(),
                "CMYK" => "DeviceCMYK".to_string(),
                _ => name,
            };
            (name, comps)
        }
        Object::Array(a) => {
            let family = a
                .first()
                .map(|o| deref(doc, o))
                .and_then(|o| o.as_name().ok())
                .map(|n| String::from_utf8_lossy(n).to_string())
                .unwrap_or_default();
            let comps = match family.as_str() {
                "ICCBased" => a
                    .get(1)
                    .map(|o| deref(doc, o))
                    .and_then(dict_of)
                    .and_then(|d| get_num(doc, d, b"N"))
                    .map(|n| n as u32)
                    .unwrap_or(0),
                "Indexed" | "I" | "Separation" | "CalGray" => 1,
                "CalRGB" | "Lab" => 3,
                "DeviceN" => a
                    .get(1)
                    .map(|o| deref(doc, o))
                    .and_then(|o| o.as_array().ok())
                    .map(|n| n.len() as u32)
                    .unwrap_or(0),
                "DeviceGray" => 1,
                "DeviceRGB" => 3,
                "DeviceCMYK" => 4,
                _ => 0,
            };
            let family = if family == "I" {
                "Indexed".to_string()
            } else {
                family
            };
            (family, comps)
        }
        _ => (String::new(), 0),
    }
}

fn last_filter(doc: &Document, dict: &Dictionary) -> String {
    let name = match get(doc, dict, b"Filter") {
        Some(Object::Name(n)) => Some(n.clone()),
        Some(Object::Array(a)) => a.last().and_then(|o| match deref(doc, o) {
            Object::Name(n) => Some(n.clone()),
            _ => None,
        }),
        _ => None,
    };
    let name = name
        .map(|n| String::from_utf8_lossy(&n).to_string())
        .unwrap_or_default();
    match name.as_str() {
        "DCT" => "DCTDecode".to_string(),
        "Fl" => "FlateDecode".to_string(),
        "LZW" => "LZWDecode".to_string(),
        "A85" => "ASCII85Decode".to_string(),
        "AHx" => "ASCIIHexDecode".to_string(),
        "RL" => "RunLengthDecode".to_string(),
        "CCF" => "CCITTFaxDecode".to_string(),
        _ => name,
    }
}

fn has_predictor(doc: &Document, dict: &Dictionary) -> bool {
    let check = |o: &Object| -> bool {
        dict_of(deref(doc, o))
            .and_then(|d| get_num(doc, d, b"Predictor"))
            .map(|p| p > 1.0)
            .unwrap_or(false)
    };
    let key = if dict.has(b"DecodeParms") {
        b"DecodeParms" as &[u8]
    } else {
        b"DP"
    };
    match dict.get(key).ok().map(|o| deref(doc, o)) {
        Some(Object::Array(a)) => a.iter().any(check),
        Some(o) => check(o),
        None => false,
    }
}

/// First page (1-based) that reaches each image through page resources, form
/// XObjects (nested) or annotation appearance streams.
fn image_pages(doc: &Document) -> HashMap<ObjectId, usize> {
    let mut found: HashMap<ObjectId, usize> = HashMap::new();
    let mut seen_forms: HashSet<ObjectId> = HashSet::new();
    let pages = collect_pages(doc);
    for (i, page) in pages.iter().enumerate() {
        let page_no = i + 1;
        if let Some(res) = page
            .inh
            .resources
            .map(|o| deref(doc, o))
            .and_then(|o| o.as_dict().ok())
        {
            scan_resources(doc, res, page_no, &mut found, &mut seen_forms, 0);
        }
        // Annotation appearance streams.
        let page_dict = doc.objects.get(&page.id).and_then(|o| o.as_dict().ok());
        let annots = page_dict
            .and_then(|d| get(doc, d, b"Annots"))
            .and_then(|o| o.as_array().ok());
        for a in annots.into_iter().flatten() {
            let Some(ad) = deref(doc, a).as_dict().ok() else {
                continue;
            };
            let Some(ap) = get(doc, ad, b"AP").and_then(|o| o.as_dict().ok()) else {
                continue;
            };
            let Some(n) = ap.get(b"N").ok() else { continue };
            let mut candidates: Vec<&Object> = Vec::new();
            match deref(doc, n) {
                Object::Dictionary(states) => candidates.extend(states.iter().map(|(_, v)| v)),
                _ => candidates.push(n),
            }
            for c in candidates {
                scan_xobject(doc, c, page_no, &mut found, &mut seen_forms, 0);
            }
        }
    }
    found
}

fn scan_resources(
    doc: &Document,
    res: &Dictionary,
    page_no: usize,
    found: &mut HashMap<ObjectId, usize>,
    seen_forms: &mut HashSet<ObjectId>,
    depth: usize,
) {
    if depth > 12 {
        return;
    }
    if let Some(xobjs) = get(doc, res, b"XObject").and_then(|o| o.as_dict().ok()) {
        for (_, v) in xobjs.iter() {
            scan_xobject(doc, v, page_no, found, seen_forms, depth);
        }
    }
    // Tiling patterns can paint images too.
    if let Some(pats) = get(doc, res, b"Pattern").and_then(|o| o.as_dict().ok()) {
        for (_, v) in pats.iter() {
            scan_xobject(doc, v, page_no, found, seen_forms, depth);
        }
    }
}

fn scan_xobject(
    doc: &Document,
    obj: &Object,
    page_no: usize,
    found: &mut HashMap<ObjectId, usize>,
    seen_forms: &mut HashSet<ObjectId>,
    depth: usize,
) {
    let Object::Reference(id) = obj else { return };
    let Some(target) = doc.objects.get(id) else {
        return;
    };
    if is_image(target) {
        found.entry(*id).or_insert(page_no);
        return;
    }
    if let Object::Stream(s) = target {
        if !seen_forms.insert(*id) {
            return;
        }
        if let Some(res) = get(doc, &s.dict, b"Resources").and_then(|o| o.as_dict().ok()) {
            scan_resources(doc, res, page_no, found, seen_forms, depth + 1);
        }
    }
}

pub fn list_images(bytes: &[u8]) -> Res<String> {
    let doc = load_plain(bytes)?;
    let pages = image_pages(&doc);
    let mut out: Vec<ImageInfo> = Vec::new();
    for (&id, obj) in doc.objects.iter() {
        if id.1 != 0 || !is_image(obj) {
            continue;
        }
        let Object::Stream(s) = obj else { continue };
        let d = &s.dict;
        let is_mask = matches!(get(&doc, d, b"ImageMask"), Some(Object::Boolean(true)));
        let (mut cs, mut comps) = colour_space(&doc, d);
        let filter = last_filter(&doc, d);
        let mut bpc = get_num(&doc, d, b"BitsPerComponent").unwrap_or(0.0) as i64;
        if is_mask {
            bpc = 1;
            comps = 1;
            cs = String::new();
        } else if bpc == 0 && filter == "DCTDecode" {
            bpc = 8;
        }
        let smask = get(&doc, d, b"SMask").is_some();
        out.push(ImageInfo {
            id: id.0,
            page: pages.get(&id).copied().unwrap_or(0),
            width: get_num(&doc, d, b"Width").unwrap_or(0.0) as i64,
            height: get_num(&doc, d, b"Height").unwrap_or(0.0) as i64,
            filter,
            color_space: cs,
            components: comps,
            bits_per_component: bpc,
            length: s.content.len(),
            has_s_mask: smask,
            is_mask,
            has_predictor: has_predictor(&doc, d),
        });
    }
    out.sort_by_key(|i| (if i.page == 0 { usize::MAX } else { i.page }, i.id));
    let items: Vec<String> = out.iter().map(ImageInfo::to_json).collect();
    Ok(format!("[{}]", items.join(",")))
}

pub fn get_image_stream(bytes: &[u8], id: u32) -> Res<Vec<u8>> {
    let doc = load_plain(bytes)?;
    match doc.objects.get(&(id, 0)) {
        Some(Object::Stream(s)) => Ok(s.content.clone()),
        _ => Err(format!("Object {id} is not a stream")),
    }
}

struct Replacement {
    id: u32,
    width: i64,
    height: i64,
    gray: bool,
}

fn parse_replacements(meta_json: &str) -> Res<Vec<Replacement>> {
    let bad = |m: &str| format!("Invalid image replacement list: {m}");
    let root = json::parse(meta_json).map_err(|e| bad(&e))?;
    let list = root.as_array().ok_or_else(|| bad("expected an array"))?;
    list.iter()
        .map(|j| {
            let n = |k: &str| {
                j.get(k)
                    .and_then(Json::as_f64)
                    .filter(|v| *v >= 0.0 && v.fract() == 0.0)
                    .ok_or_else(|| bad(&format!("missing integer \"{k}\"")))
            };
            Ok(Replacement {
                id: n("id")? as u32,
                width: n("width")? as i64,
                height: n("height")? as i64,
                gray: j.get("gray").and_then(Json::as_bool).unwrap_or(false),
            })
        })
        .collect()
}

/// (width, height, components) from the first SOFn marker of a JPEG.
pub fn jpeg_info(data: &[u8]) -> Option<(i64, i64, u8)> {
    if data.len() < 4 || data[0] != 0xFF || data[1] != 0xD8 {
        return None;
    }
    let mut i = 2;
    while i + 4 <= data.len() {
        if data[i] != 0xFF {
            i += 1;
            continue;
        }
        let marker = data[i + 1];
        if marker == 0xFF {
            i += 1;
            continue;
        }
        if marker == 0xD8 || marker == 0x01 || (0xD0..=0xD7).contains(&marker) {
            i += 2;
            continue;
        }
        let len = u16::from_be_bytes([data[i + 2], data[i + 3]]) as usize;
        if matches!(marker, 0xC0..=0xCF) && !matches!(marker, 0xC4 | 0xC8 | 0xCC) {
            if i + 9 < data.len() {
                let h = u16::from_be_bytes([data[i + 5], data[i + 6]]) as i64;
                let w = u16::from_be_bytes([data[i + 7], data[i + 8]]) as i64;
                return Some((w, h, data[i + 9]));
            }
            return None;
        }
        i += 2 + len;
    }
    None
}

pub fn replace_images(bytes: &[u8], meta_json: &str, jpegs: Vec<Vec<u8>>) -> Res<Vec<u8>> {
    let meta = parse_replacements(meta_json)?;
    if meta.len() != jpegs.len() {
        return Err(format!(
            "{} replacements described but {} JPEG files supplied",
            meta.len(),
            jpegs.len()
        ));
    }
    let mut doc = load_plain(bytes)?;
    for (m, jpeg) in meta.iter().zip(jpegs) {
        let Some((w, h, comps)) = jpeg_info(&jpeg) else {
            return Err(format!(
                "Replacement for image {} is not a valid JPEG",
                m.id
            ));
        };
        if w != m.width || h != m.height {
            return Err(format!(
                "Replacement for image {} is {w}x{h} but {}x{} was declared",
                m.id, m.width, m.height
            ));
        }
        if (comps == 1) != m.gray || (comps != 1 && comps != 3) {
            return Err(format!(
                "Replacement for image {} has {comps} colour components, expected {}",
                m.id,
                if m.gray { 1 } else { 3 }
            ));
        }
        let Some(Object::Stream(stream)) = doc.objects.get_mut(&(m.id, 0)) else {
            return Err(format!("Image {} not found", m.id));
        };
        if !matches!(stream.dict.get(b"Subtype"), Ok(Object::Name(n)) if n == b"Image") {
            return Err(format!("Object {} is not an image", m.id));
        }
        if matches!(stream.dict.get(b"ImageMask"), Ok(Object::Boolean(true))) {
            return Err(format!(
                "Image {} is a stencil mask and cannot become a JPEG",
                m.id
            ));
        }
        stream.set_content(jpeg);
        stream.allows_compression = false;
        let d = &mut stream.dict;
        d.set("Filter", Object::Name(b"DCTDecode".to_vec()));
        d.set("Width", Object::Integer(w));
        d.set("Height", Object::Integer(h));
        d.set(
            "ColorSpace",
            Object::Name(if m.gray {
                b"DeviceGray".to_vec()
            } else {
                b"DeviceRGB".to_vec()
            }),
        );
        d.set("BitsPerComponent", Object::Integer(8));
        d.remove(b"DecodeParms");
        d.remove(b"DP");
        d.remove(b"Decode");
        // A colour-key mask would not survive lossy re-encoding.
        if matches!(d.get(b"Mask"), Ok(Object::Array(_))) {
            d.remove(b"Mask");
        }
    }
    save_doc(&mut doc)
}
