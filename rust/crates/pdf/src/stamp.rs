//! `stamp_text`: draw text (page numbers, headers/footers, watermarks) onto pages.
//!
//! Coordinates arrive in the page's *visible* space (after `/Rotate`, origin at
//! the bottom-left of the visible box). They are mapped back to default user
//! space and the text is rotated by `/Rotate` so it reads upright on screen.

use crate::common::*;
use crate::content::open_q_depth;
use crate::json::{self, Json};
use crate::stdfonts::{encode_winansi, text_width, StdFont};
use lopdf::{Dictionary, Document, Object, ObjectId, Stream};
use std::collections::{BTreeMap, HashMap};

struct Item {
    page: usize,
    text: String,
    x: f64,
    y: f64,
    anchor: Option<String>,
    font: Option<String>,
    size: f64,
    color: Option<[f64; 3]>,
    opacity: Option<f64>,
    rotation: Option<f64>,
    layer: Option<String>,
}

fn parse_item(j: &Json) -> Res<Item> {
    let bad = |what: &str| format!("Invalid stamp specification: {what}");
    let num = |k: &str| -> Res<f64> {
        j.get(k)
            .and_then(Json::as_f64)
            .ok_or_else(|| bad(&format!("missing number \"{k}\"")))
    };
    let opt_num = |k: &str| j.get(k).and_then(Json::as_f64);
    let opt_str = |k: &str| j.get(k).and_then(Json::as_str).map(str::to_string);
    let page = num("page")?;
    if page < 1.0 || page.fract() != 0.0 {
        return Err(bad("\"page\" must be a positive integer"));
    }
    let color = match j.get("color").and_then(Json::as_array) {
        Some(c) if c.len() >= 3 => {
            let mut rgb = [0.0; 3];
            for i in 0..3 {
                rgb[i] = c[i]
                    .as_f64()
                    .ok_or_else(|| bad("\"color\" must be numbers"))?;
            }
            Some(rgb)
        }
        Some(_) => return Err(bad("\"color\" needs three numbers")),
        None => None,
    };
    Ok(Item {
        page: page as usize,
        text: j
            .get("text")
            .and_then(Json::as_str)
            .ok_or_else(|| bad("missing string \"text\""))?
            .to_string(),
        x: num("x")?,
        y: num("y")?,
        anchor: opt_str("anchor"),
        font: opt_str("font"),
        size: num("size")?,
        color,
        opacity: opt_num("opacity"),
        rotation: opt_num("rotation"),
        layer: opt_str("layer"),
    })
}

fn parse_spec(spec_json: &str) -> Res<Vec<Item>> {
    let root = json::parse(spec_json).map_err(|e| format!("Invalid stamp specification: {e}"))?;
    let items = root
        .get("items")
        .and_then(Json::as_array)
        .ok_or_else(|| "Invalid stamp specification: missing \"items\" array".to_string())?;
    items.iter().map(parse_item).collect()
}

/// Escape and write a WinAnsi byte string as a PDF literal string.
fn pdf_string(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() + 2);
    s.push('(');
    for &b in bytes {
        match b {
            b'(' | b')' | b'\\' => {
                s.push('\\');
                s.push(b as char);
            }
            0x20..=0x7E => s.push(b as char),
            _ => s.push_str(&format!("\\{:03o}", b)),
        }
    }
    s.push(')');
    s
}

/// Everything needed to stamp one page, resolved while the document is borrowed.
struct PageCtx {
    id: ObjectId,
    geom: Geom,
    /// Effective (possibly inherited / indirect) resources, as an owned dictionary.
    resources: Dictionary,
}

pub fn stamp_text(bytes: &[u8], spec_json: &str) -> Res<Vec<u8>> {
    let items = parse_spec(spec_json)?;
    if items.is_empty() {
        return Err("Nothing to stamp".to_string());
    }
    let mut doc = load_plain(bytes)?;
    let page_total = collect_pages(&doc).len();
    if page_total == 0 {
        return Err("This PDF has no pages".to_string());
    }

    // Validate items and group them by page.
    let mut by_page: BTreeMap<usize, Vec<&Item>> = BTreeMap::new();
    for it in &items {
        if it.page < 1 || it.page > page_total {
            return Err(format!(
                "Page {} is out of range (document has {} pages)",
                it.page, page_total
            ));
        }
        if !(it.size.is_finite() && it.size > 0.0) || !it.x.is_finite() || !it.y.is_finite() {
            return Err("Stamp has an invalid position or size".to_string());
        }
        by_page.entry(it.page).or_default().push(it);
    }

    // Resolve geometry + resources for the pages we touch.
    let ctxs: BTreeMap<usize, PageCtx> = {
        let pages = collect_pages(&doc);
        by_page
            .keys()
            .map(|&n| {
                let p = &pages[n - 1];
                let resources = p
                    .inh
                    .resources
                    .map(|o| deref(&doc, o))
                    .and_then(|o| o.as_dict().ok())
                    .cloned()
                    .unwrap_or_default();
                (
                    n,
                    PageCtx {
                        id: p.id,
                        geom: page_geom(&doc, &p.inh),
                        resources,
                    },
                )
            })
            .collect()
    };

    let mut font_objs: HashMap<StdFont, ObjectId> = HashMap::new();
    let mut gs_objs: HashMap<i64, ObjectId> = HashMap::new();

    for (page_no, items) in by_page {
        let ctx = &ctxs[&page_no];
        let geom = ctx.geom;
        let mut res = ctx.resources.clone();
        let mut font_dict = sub_dict(&doc, &res, b"Font");
        let mut gs_dict = sub_dict(&doc, &res, b"ExtGState");
        let mut fonts_used: Vec<(StdFont, String)> = Vec::new();
        let mut gs_used: Vec<(i64, String)> = Vec::new();
        let (mut under, mut over) = (String::new(), String::new());

        for it in items {
            let font = match it.font.as_deref() {
                None | Some("") => StdFont::Helvetica,
                Some(name) => StdFont::parse(name)
                    .ok_or_else(|| format!("Unsupported stamp font \"{name}\""))?,
            };
            let encoded = encode_winansi(&it.text);
            if encoded.is_empty() {
                continue;
            }
            let width = text_width(font, &encoded, it.size);
            let ax = match it.anchor.as_deref() {
                Some("center") => width / 2.0,
                Some("right") => width,
                _ => 0.0,
            };
            // Start of the text run in visible space, then in user space.
            let theta = it.rotation.unwrap_or(0.0).to_radians();
            let (sx, sy) = (it.x - ax * theta.cos(), it.y - ax * theta.sin());
            let (ux, uy) = geom.to_user(sx, sy);
            let phi = theta + (geom.rotate as f64).to_radians();
            let (c, s) = (phi.cos(), phi.sin());

            let font_name = match fonts_used.iter().find(|(f, _)| *f == font) {
                Some((_, n)) => n.clone(),
                None => {
                    let id = *font_objs.entry(font).or_insert_with(|| {
                        let mut d = Dictionary::new();
                        d.set("Type", Object::Name(b"Font".to_vec()));
                        d.set("Subtype", Object::Name(b"Type1".to_vec()));
                        d.set(
                            "BaseFont",
                            Object::Name(font.base_font().as_bytes().to_vec()),
                        );
                        d.set("Encoding", Object::Name(b"WinAnsiEncoding".to_vec()));
                        doc.add_object(Object::Dictionary(d))
                    });
                    let n = unique_name(&font_dict, "OUTF");
                    font_dict.set(n.as_bytes().to_vec(), Object::Reference(id));
                    fonts_used.push((font, n.clone()));
                    n
                }
            };

            let opacity = it.opacity.unwrap_or(1.0).clamp(0.0, 1.0);
            let mut out = String::from("q\n");
            if opacity < 0.999 {
                let key = (opacity * 1000.0).round() as i64;
                let gs_name = match gs_used.iter().find(|(k, _)| *k == key) {
                    Some((_, n)) => n.clone(),
                    None => {
                        let id = *gs_objs.entry(key).or_insert_with(|| {
                            let a = key as f32 / 1000.0;
                            let mut d = Dictionary::new();
                            d.set("Type", Object::Name(b"ExtGState".to_vec()));
                            d.set("ca", Object::Real(a));
                            d.set("CA", Object::Real(a));
                            doc.add_object(Object::Dictionary(d))
                        });
                        let n = unique_name(&gs_dict, "OUTG");
                        gs_dict.set(n.as_bytes().to_vec(), Object::Reference(id));
                        gs_used.push((key, n.clone()));
                        n
                    }
                };
                out.push_str(&format!("/{gs_name} gs\n"));
            }
            let [r, g, b] = it.color.unwrap_or([0.0, 0.0, 0.0]);
            out.push_str(&format!(
                "{} {} {} rg\nBT\n/{} {} Tf\n{} {} {} {} {} {} Tm\n{} Tj\nET\nQ\n",
                fmt_num(r.clamp(0.0, 1.0)),
                fmt_num(g.clamp(0.0, 1.0)),
                fmt_num(b.clamp(0.0, 1.0)),
                font_name,
                fmt_num(it.size),
                fmt_num(c),
                fmt_num(s),
                fmt_num(-s),
                fmt_num(c),
                fmt_num(ux),
                fmt_num(uy),
                pdf_string(&encoded),
            ));
            if it.layer.as_deref() == Some("under") {
                under.push_str(&out);
            } else {
                over.push_str(&out);
            }
        }

        if under.is_empty() && over.is_empty() {
            continue;
        }

        // The page now owns a direct /Resources with the stamp fonts registered.
        res.set("Font", Object::Dictionary(font_dict));
        if !gs_used.is_empty() {
            res.set("ExtGState", Object::Dictionary(gs_dict));
        }
        if let Some(Object::Dictionary(page)) = doc.objects.get_mut(&ctx.id) {
            page.set("Resources", Object::Dictionary(res));
        }
        install_contents(&mut doc, ctx.id, under, over);
    }

    save_doc(&mut doc)
}

fn sub_dict(doc: &Document, res: &Dictionary, key: &[u8]) -> Dictionary {
    res.get(key)
        .ok()
        .map(|o| deref(doc, o))
        .and_then(|o| o.as_dict().ok())
        .cloned()
        .unwrap_or_default()
}

fn unique_name(dict: &Dictionary, base: &str) -> String {
    let mut i = 1;
    loop {
        let candidate = format!("{base}{i}");
        if !dict.has(candidate.as_bytes()) {
            return candidate;
        }
        i += 1;
    }
}

/// Rewrite `/Contents` so the stamps land under or over the existing content.
fn install_contents(doc: &mut Document, page_id: ObjectId, under: String, over: String) {
    let existing: Vec<Object> = {
        let page = doc.objects.get(&page_id).and_then(|o| o.as_dict().ok());
        match page.and_then(|p| p.get(b"Contents").ok()) {
            Some(Object::Array(a)) => a.clone(),
            Some(Object::Reference(id)) => match doc.objects.get(id) {
                Some(Object::Array(a)) => a.clone(),
                _ => vec![Object::Reference(*id)],
            },
            _ => Vec::new(),
        }
    };

    let mut contents: Vec<Object> = Vec::new();
    if !under.is_empty() {
        let id = new_stream(doc, under.into_bytes());
        contents.push(Object::Reference(id));
    }
    if over.is_empty() {
        contents.extend(existing);
    } else {
        // Wrap the page's own content in q … Q so our stamp starts from a clean
        // graphics state, and close any q the original left unbalanced.
        let depth = open_q_depth(&doc.get_page_content(page_id).unwrap_or_default());
        let head = new_stream(doc, b"q\n".to_vec());
        let mut tail = "Q\n".repeat(depth + 1);
        tail.push_str(&over);
        let tail = new_stream(doc, tail.into_bytes());
        contents.push(Object::Reference(head));
        contents.extend(existing);
        contents.push(Object::Reference(tail));
    }

    if let Some(Object::Dictionary(page)) = doc.objects.get_mut(&page_id) {
        page.set("Contents", Object::Array(contents));
    }
}

fn new_stream(doc: &mut Document, data: Vec<u8>) -> ObjectId {
    doc.add_object(Object::Stream(Stream::new(Dictionary::new(), data)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn escapes_strings() {
        assert_eq!(pdf_string(b"a(b)c\\"), "(a\\(b\\)c\\\\)");
        assert_eq!(pdf_string(&[0xE9]), "(\\351)");
    }
}
