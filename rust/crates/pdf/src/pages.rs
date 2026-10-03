//! Page geometry (`page_info`) and page re-ordering (`reorder_pages`).

use crate::common::*;
use lopdf::{Dictionary, Document, Object, ObjectId};
use std::collections::{BTreeMap, HashSet};

/// JSON array of `{page, width, height, rotate}` with `/Rotate` already applied.
pub fn page_info(bytes: &[u8]) -> Res<String> {
    let doc = load_plain(bytes)?;
    let pages = collect_pages(&doc);
    let items: Vec<String> = pages
        .iter()
        .enumerate()
        .map(|(i, p)| {
            let g = page_geom(&doc, &p.inh);
            let (w, h) = g.visible_size();
            format!(
                "{{\"page\":{},\"width\":{},\"height\":{},\"rotate\":{}}}",
                i + 1,
                round3(w),
                round3(h),
                g.rotate
            )
        })
        .collect();
    Ok(format!("[{}]", items.join(",")))
}

/// Parse "3,1,2,2" (ranges like "2-4" are accepted too) into 0-based indices.
pub fn parse_order(order: &str, n: usize) -> Res<Vec<usize>> {
    let mut out = Vec::new();
    for raw in order.split(|c: char| c == ',' || c.is_whitespace() || c == ';') {
        let tok = raw.trim();
        if tok.is_empty() {
            continue;
        }
        let parse = |s: &str| -> Res<usize> {
            s.trim()
                .parse::<usize>()
                .map_err(|_| format!("Invalid page number \"{}\"", s.trim()))
        };
        let check = |p: usize| -> Res<usize> {
            if p < 1 || p > n {
                Err(format!("Page {p} is out of range (document has {n} pages)"))
            } else {
                Ok(p - 1)
            }
        };
        if let Some((a, b)) = tok.split_once('-') {
            let (a, b) = (check(parse(a)?)?, check(parse(b)?)?);
            if a <= b {
                out.extend(a..=b);
            } else {
                out.extend((b..=a).rev());
            }
        } else {
            out.push(check(parse(tok)?)?);
        }
    }
    if out.is_empty() {
        return Err("The page order is empty".to_string());
    }
    Ok(out)
}

/// A page dictionary with every inheritable attribute copied in. A *direct*
/// inherited `/Resources` dictionary is reported through `hoist` (keyed by its
/// address) so the caller can store it once as an indirect object rather than
/// cloning it into every page.
struct Flat {
    id: ObjectId,
    dict: Dictionary,
    hoist: Option<usize>,
}

fn flattened_page(
    doc: &Document,
    p: &PageRef,
    shared: &mut BTreeMap<usize, Object>,
) -> Option<Flat> {
    let mut d = doc.objects.get(&p.id)?.as_dict().ok()?.clone();
    let mut hoist = None;
    for (key, val) in [
        (&b"Resources"[..], p.inh.resources),
        (b"MediaBox", p.inh.media_box),
        (b"CropBox", p.inh.crop_box),
        (b"Rotate", p.inh.rotate),
    ] {
        if d.has(key) {
            continue;
        }
        if let Some(v) = val {
            if key == b"Resources" && matches!(v, Object::Dictionary(_)) {
                let ptr = v as *const Object as usize;
                shared.entry(ptr).or_insert_with(|| v.clone());
                hoist = Some(ptr);
            } else {
                d.set(key.to_vec(), v.clone());
            }
        }
    }
    d.set("Type", Object::Name(b"Page".to_vec()));
    Some(Flat {
        id: p.id,
        dict: d,
        hoist,
    })
}

pub fn reorder_pages(bytes: &[u8], order: &str) -> Res<Vec<u8>> {
    let mut doc = load_plain(bytes)?;

    let mut shared: BTreeMap<usize, Object> = BTreeMap::new();
    let mut flat: Vec<Flat> = {
        let pages = collect_pages(&doc);
        pages
            .iter()
            .filter_map(|p| flattened_page(&doc, p, &mut shared))
            .collect()
    };
    if flat.is_empty() {
        return Err("This PDF has no pages".to_string());
    }
    let seq = parse_order(order, flat.len())?;

    // Store shared direct /Resources once, then point the pages at it.
    let mut hoisted: BTreeMap<usize, ObjectId> = BTreeMap::new();
    for (ptr, obj) in shared {
        hoisted.insert(ptr, doc.add_object(obj));
    }
    for f in flat.iter_mut() {
        if let Some(id) = f.hoist.and_then(|ptr| hoisted.get(&ptr)) {
            f.dict.set("Resources", Object::Reference(*id));
        }
    }

    let catalog_id = doc
        .trailer
        .get(b"Root")
        .and_then(Object::as_reference)
        .map_err(|_| "PDF has no catalog".to_string())?;
    let root_id = doc
        .objects
        .get(&catalog_id)
        .and_then(|c| c.as_dict().ok())
        .and_then(|c| c.get(b"Pages").ok())
        .and_then(|p| p.as_reference().ok())
        .ok_or_else(|| "PDF has no page tree".to_string())?;

    let kept: HashSet<usize> = seq.iter().copied().collect();
    let has_duplicates = kept.len() != seq.len();
    let dropped_any = kept.len() != flat.len();

    // Pages that are not listed go away entirely (so their content can be pruned).
    for (i, f) in flat.iter().enumerate() {
        if !kept.contains(&i) {
            doc.objects.remove(&f.id);
        }
    }

    let mut used: HashSet<usize> = HashSet::new();
    let mut kids: Vec<Object> = Vec::with_capacity(seq.len());
    for &i in &seq {
        let mut dict = flat[i].dict.clone();
        dict.set("Parent", Object::Reference(root_id));
        let id = if used.insert(i) {
            flat[i].id
        } else {
            // Duplicate: a brand-new page object so /Kids never repeats a reference.
            doc.add_object(Object::Dictionary(Dictionary::new()))
        };
        doc.objects.insert(id, Object::Dictionary(dict));
        kids.push(Object::Reference(id));
    }

    let mut root = Dictionary::new();
    root.set("Type", Object::Name(b"Pages".to_vec()));
    root.set("Count", Object::Integer(kids.len() as i64));
    root.set("Kids", Object::Array(kids));
    doc.objects.insert(root_id, Object::Dictionary(root));

    if let Some(Object::Dictionary(cat)) = doc.objects.get_mut(&catalog_id) {
        // Bookmarks and page labels are keyed by the old page order/identity.
        cat.remove(b"Outlines");
        cat.remove(b"PageLabels");
        if has_duplicates || dropped_any {
            cat.remove(b"StructTreeRoot");
            cat.remove(b"MarkInfo");
        }
        if matches!(cat.get(b"OpenAction"), Ok(Object::Array(_))) {
            cat.remove(b"OpenAction");
        }
    }

    prune_unreferenced(&mut doc);
    renumber_compact(&mut doc);
    save_doc(&mut doc)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn order_parsing() {
        assert_eq!(parse_order("3,1,2,2", 3).unwrap(), vec![2, 0, 1, 1]);
        assert_eq!(parse_order(" 1 , 3-1 ", 3).unwrap(), vec![0, 2, 1, 0]);
        assert!(parse_order("", 3).is_err());
        assert!(parse_order("4", 3).is_err());
        assert!(parse_order("0", 3).is_err());
        assert!(parse_order("a", 3).is_err());
    }
}
