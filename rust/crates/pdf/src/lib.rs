//! PDF wasm crate: merge, split, rotate, delete pages, read/edit metadata, page
//! geometry, text stamping, page re-ordering, text extraction, encryption,
//! image inventory/replacement and optimisation, built on the pure-Rust `lopdf`
//! (no system deps, compiles to wasm).
//!
//! Inputs/outputs cross the boundary as `Uint8Array` (PDF bytes). Page selections
//! are 1-based and passed as comma/range strings (e.g. "1,3,5-8").
//!
//! Every new export is a thin `#[wasm_bindgen]` wrapper over a pure inner
//! function returning `Result<_, String>` (see the modules below), which keeps
//! the logic natively testable.

mod afm_data;
mod common;
mod content;
mod crypt;
mod enc_data;
mod images;
mod json;
mod optimize;
mod pages;
mod stamp;
mod stdfonts;
mod text;

#[cfg(test)]
mod tests;

use common::parse_pages;
use lopdf::{Document, Object, ObjectId};
use std::collections::BTreeMap;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn version() -> String {
    format!("pdf@{}", env!("CARGO_PKG_VERSION"))
}

fn map_err<E: std::fmt::Display>(e: E) -> JsValue {
    JsValue::from_str(&e.to_string())
}

fn load(bytes: &[u8]) -> Result<Document, JsValue> {
    Document::load_mem(bytes).map_err(map_err)
}

/// Number of pages in a PDF.
#[wasm_bindgen]
pub fn page_count(bytes: &[u8]) -> Result<u32, JsValue> {
    let doc = load(bytes)?;
    Ok(doc.get_pages().len() as u32)
}

/// Merge an array of PDFs (each a Uint8Array) into one, preserving page order.
/// Uses the canonical lopdf recipe: renumber every doc into one object space,
/// collect all Page objects, then build a fresh Pages tree + Catalog. Correct for
/// any N (the previous incremental-append approach lost pages for N > 2).
#[wasm_bindgen]
pub fn merge_all(docs: js_sys::Array) -> Result<Vec<u8>, JsValue> {
    let mut documents: Vec<Document> = Vec::new();
    for v in docs.iter() {
        let arr = js_sys::Uint8Array::new(&v);
        let bytes = arr.to_vec();
        documents.push(load(&bytes)?);
    }
    if documents.is_empty() {
        return Err(JsValue::from_str("no PDFs to merge"));
    }

    let mut max_id = 1;
    let mut documents_pages: BTreeMap<ObjectId, Object> = BTreeMap::new();
    let mut documents_objects: BTreeMap<ObjectId, Object> = BTreeMap::new();
    let mut document = Document::with_version("1.5");

    for mut doc in documents {
        doc.renumber_objects_with(max_id);
        max_id = doc.max_id + 1;
        documents_pages.extend(
            doc.get_pages()
                .into_values()
                .map(|object_id| (object_id, doc.get_object(object_id).unwrap().to_owned()))
                .collect::<BTreeMap<ObjectId, Object>>(),
        );
        documents_objects.extend(doc.objects);
    }

    let mut catalog_object: Option<(ObjectId, Object)> = None;
    let mut pages_object: Option<(ObjectId, Object)> = None;

    // Find a Catalog and reuse the first Pages dict (for inheritable attributes).
    for (object_id, object) in &documents_objects {
        match object.type_name().unwrap_or(b"") {
            b"Catalog" => {
                catalog_object = Some((
                    catalog_object
                        .as_ref()
                        .map(|(id, _)| *id)
                        .unwrap_or(*object_id),
                    object.clone(),
                ));
            }
            b"Pages" => {
                // Reuse the first Pages dict we encounter as the merged root.
                if pages_object.is_none() {
                    if let Ok(dict) = object.as_dict() {
                        pages_object = Some((*object_id, Object::Dictionary(dict.clone())));
                    }
                }
            }
            b"Page" | b"Outlines" | b"Outline" => {}
            _ => {
                document.objects.insert(*object_id, object.clone());
            }
        }
    }

    let pages_id = match pages_object {
        Some((id, obj)) => {
            document.objects.insert(id, obj);
            id
        }
        None => return Err(JsValue::from_str("no Pages root found")),
    };

    // Re-parent every collected page to the new Pages root and insert it.
    for (object_id, object) in documents_pages {
        if let Ok(dict) = object.as_dict() {
            let mut dict = dict.clone();
            dict.set("Parent", pages_id);
            document.objects.insert(object_id, Object::Dictionary(dict));
        }
    }

    let catalog_id = match catalog_object {
        Some((id, obj)) => {
            document.objects.insert(id, obj);
            id
        }
        None => return Err(JsValue::from_str("no Catalog found")),
    };

    // Build the Pages node's Kids list and Count from the final page set.
    let page_ids: Vec<ObjectId> = document
        .objects
        .iter()
        .filter(|(_, o)| o.type_name().unwrap_or(b"") == b"Page")
        .map(|(id, _)| *id)
        .collect();

    if let Some(Object::Dictionary(dict)) = document.objects.get_mut(&pages_id) {
        dict.set(
            "Kids",
            page_ids
                .iter()
                .map(|id| Object::Reference(*id))
                .collect::<Vec<_>>(),
        );
        dict.set("Count", page_ids.len() as i64);
        dict.set("Type", "Pages");
    }

    if let Some(Object::Dictionary(dict)) = document.objects.get_mut(&catalog_id) {
        dict.set("Pages", pages_id);
        dict.set("Type", "Catalog");
        dict.remove(b"Outlines");
    }

    document.trailer.set("Root", catalog_id);
    document.max_id = document.objects.len() as u32;
    document.renumber_objects();
    document.compress();

    let mut out = Vec::new();
    document.save_to(&mut out).map_err(map_err)?;
    Ok(out)
}

/// Keep only the pages selected by `spec` (1-based "1,3,5-8"); return new PDF.
#[wasm_bindgen]
pub fn extract_pages(bytes: &[u8], spec: &str) -> Result<Vec<u8>, JsValue> {
    let mut doc = load(bytes)?;
    let total = doc.get_pages().len();
    let keep = parse_pages(spec, total);
    if keep.is_empty() {
        return Err(JsValue::from_str("no valid pages selected"));
    }
    let keep_set: std::collections::BTreeSet<u32> = keep.iter().map(|&p| p as u32).collect();
    let all: Vec<u32> = (1..=total as u32).collect();
    let delete: Vec<u32> = all.into_iter().filter(|p| !keep_set.contains(p)).collect();
    doc.delete_pages(&delete);
    let mut out = Vec::new();
    doc.save_to(&mut out).map_err(map_err)?;
    Ok(out)
}

/// Delete the pages selected by `spec`; return new PDF.
#[wasm_bindgen]
pub fn delete_pages(bytes: &[u8], spec: &str) -> Result<Vec<u8>, JsValue> {
    let mut doc = load(bytes)?;
    let total = doc.get_pages().len();
    let del = parse_pages(spec, total);
    if del.is_empty() {
        return Err(JsValue::from_str("no valid pages selected"));
    }
    let del_u32: Vec<u32> = del.iter().map(|&p| p as u32).collect();
    doc.delete_pages(&del_u32);
    let mut out = Vec::new();
    doc.save_to(&mut out).map_err(map_err)?;
    Ok(out)
}

/// Rotate selected pages by `degrees` (90/180/270, multiples of 90). spec "" = all.
#[wasm_bindgen]
pub fn rotate_pages(bytes: &[u8], spec: &str, degrees: i32) -> Result<Vec<u8>, JsValue> {
    let mut doc = load(bytes)?;
    let pages: BTreeMap<u32, ObjectId> = doc.get_pages();
    let total = pages.len();
    let targets = if spec.trim().is_empty() {
        (1..=total).collect::<Vec<_>>()
    } else {
        parse_pages(spec, total)
    };
    let norm = ((degrees % 360) + 360) % 360;

    for p in targets {
        if let Some(&pid) = pages.get(&(p as u32)) {
            if let Ok(obj) = doc.get_object_mut(pid) {
                if let Ok(dict) = obj.as_dict_mut() {
                    let current = dict.get(b"Rotate").and_then(|r| r.as_i64()).unwrap_or(0);
                    let next = (((current + norm as i64) % 360) + 360) % 360;
                    dict.set("Rotate", next);
                }
            }
        }
    }
    let mut out = Vec::new();
    doc.save_to(&mut out).map_err(map_err)?;
    Ok(out)
}

/// Read document info dictionary as "Key: Value" lines.
#[wasm_bindgen]
pub fn read_metadata(bytes: &[u8]) -> Result<String, JsValue> {
    let doc = load(bytes)?;
    let mut lines = vec![format!("Pages: {}", doc.get_pages().len())];
    lines.push(format!("PDF version: {}", doc.version));
    if let Ok(info_ref) = doc.trailer.get(b"Info") {
        if let Ok(id) = info_ref.as_reference() {
            if let Ok(obj) = doc.get_object(id) {
                if let Ok(dict) = obj.as_dict() {
                    for (k, v) in dict.iter() {
                        let key = String::from_utf8_lossy(k).to_string();
                        let val = match v {
                            Object::String(bytes, _) => String::from_utf8_lossy(bytes).to_string(),
                            other => format!("{:?}", other),
                        };
                        lines.push(format!("{key}: {val}"));
                    }
                }
            }
        }
    }
    Ok(lines.join("\n"))
}

// ---------------------------------------------------------------------------
// Page geometry, stamping, reordering, text, encryption & image optimisation.
// ---------------------------------------------------------------------------

fn js_err(e: String) -> JsValue {
    JsValue::from_str(&e)
}

/// JSON `[{page, width, height, rotate}]` — visible size with `/Rotate` applied.
#[wasm_bindgen]
pub fn page_info(bytes: &[u8]) -> Result<String, JsValue> {
    pages::page_info(bytes).map_err(js_err)
}

/// Draw text stamps; `spec_json` is `{"items":[PdfTextStamp…]}`.
#[wasm_bindgen]
pub fn stamp_text(bytes: &[u8], spec_json: &str) -> Result<Vec<u8>, JsValue> {
    stamp::stamp_text(bytes, spec_json).map_err(js_err)
}

/// Rebuild the page list in `order` ("3,1,2,2": 1-based, duplicates allowed).
#[wasm_bindgen]
pub fn reorder_pages(bytes: &[u8], order: &str) -> Result<Vec<u8>, JsValue> {
    pages::reorder_pages(bytes, order).map_err(js_err)
}

/// JSON `[{page, text}]` for the selected pages (empty spec = all).
#[wasm_bindgen]
pub fn extract_text(bytes: &[u8], spec: &str) -> Result<String, JsValue> {
    text::extract_text(bytes, spec).map_err(js_err)
}

/// True when the file has an /Encrypt dictionary (even if it opens without a password).
#[wasm_bindgen]
pub fn is_encrypted(bytes: &[u8]) -> Result<bool, JsValue> {
    Ok(crypt::is_encrypted(bytes))
}

/// Encrypt with the standard security handler (AES-128 R4, or AES-256 R6).
#[wasm_bindgen]
pub fn encrypt_pdf(
    bytes: &[u8],
    user_pw: &str,
    owner_pw: &str,
    permissions: u32,
    aes256: bool,
) -> Result<Vec<u8>, JsValue> {
    crypt::encrypt_pdf(bytes, user_pw, owner_pw, permissions, aes256).map_err(js_err)
}

/// Remove encryption using the user or owner password.
#[wasm_bindgen]
pub fn decrypt_pdf(bytes: &[u8], password: &str) -> Result<Vec<u8>, JsValue> {
    crypt::decrypt_pdf(bytes, password).map_err(js_err)
}

/// JSON array describing every image XObject.
#[wasm_bindgen]
pub fn list_images(bytes: &[u8]) -> Result<String, JsValue> {
    images::list_images(bytes).map_err(js_err)
}

/// Raw (still encoded) stream bytes of object `(id, 0)`.
#[wasm_bindgen]
pub fn get_image_stream(bytes: &[u8], id: u32) -> Result<Vec<u8>, JsValue> {
    images::get_image_stream(bytes, id).map_err(js_err)
}

/// Replace image streams with JPEGs. `meta_json` = `[{id,width,height,gray}]`,
/// `jpegs` = one Uint8Array per entry, same order.
#[wasm_bindgen]
pub fn replace_images(
    bytes: &[u8],
    meta_json: &str,
    jpegs: js_sys::Array,
) -> Result<Vec<u8>, JsValue> {
    let list: Vec<Vec<u8>> = jpegs
        .iter()
        .map(|v| js_sys::Uint8Array::new(&v).to_vec())
        .collect();
    images::replace_images(bytes, meta_json, list).map_err(js_err)
}

/// Lossless clean-up; optionally strip metadata, thumbnails and the Info dictionary.
#[wasm_bindgen]
pub fn optimize_pdf(bytes: &[u8], strip_metadata: bool) -> Result<Vec<u8>, JsValue> {
    optimize::optimize_pdf(bytes, strip_metadata).map_err(js_err)
}
