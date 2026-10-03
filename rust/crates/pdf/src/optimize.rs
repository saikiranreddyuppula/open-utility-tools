//! `optimize_pdf`: lossless structural clean-up.
//!
//! * drops objects nothing references any more,
//! * drops empty page-content streams,
//! * Flate-compresses streams that are stored raw (never touches DCT / JPX /
//!   CCITT / JBIG2 or already-filtered data),
//! * re-deflates plain Flate streams at the best level when that is smaller,
//! * optionally strips XMP metadata, thumbnails, `/PieceInfo` and the Info dictionary,
//! * renumbers objects densely.

use crate::common::*;
use flate2::read::ZlibDecoder;
use flate2::write::ZlibEncoder;
use flate2::Compression;
use lopdf::{Dictionary, Document, Object, ObjectId};
use std::collections::HashSet;
use std::io::{Read, Write};

/// Streams larger than this are not re-deflated (keeps wasm run time bounded).
const RECOMPRESS_MAX: usize = 3 * 1024 * 1024;
/// Total bytes we are willing to re-deflate in one run.
const RECOMPRESS_BUDGET: usize = 48 * 1024 * 1024;

fn is_type(obj: &Object, ty: &[u8]) -> bool {
    match obj {
        Object::Dictionary(d) => d.get(b"Type").and_then(Object::as_name).ok() == Some(ty),
        Object::Stream(s) => s.dict.get(b"Type").and_then(Object::as_name).ok() == Some(ty),
        _ => false,
    }
}

fn strip_metadata(doc: &mut Document) {
    // Catalog.
    if let Ok(root) = doc.trailer.get(b"Root").and_then(Object::as_reference) {
        if let Some(Object::Dictionary(cat)) = doc.objects.get_mut(&root) {
            cat.remove(b"Metadata");
            cat.remove(b"PieceInfo");
        }
    }
    // Pages, forms, images: XMP packets, thumbnails and private application data.
    for obj in doc.objects.values_mut() {
        let is_page = is_type(obj, b"Page");
        let dict: Option<&mut Dictionary> = match obj {
            Object::Dictionary(d) => Some(d),
            Object::Stream(s) => Some(&mut s.dict),
            _ => None,
        };
        let Some(d) = dict else { continue };
        if is_page {
            d.remove(b"Thumb");
            d.remove(b"PieceInfo");
            d.remove(b"Metadata");
        } else if d.has(b"Metadata")
            && matches!(
                d.get(b"Subtype").and_then(Object::as_name),
                Ok(b"Form" | b"Image")
            )
        {
            d.remove(b"Metadata");
        }
    }
    // Info dictionary: replace with a minimal one.
    let mut info = Dictionary::new();
    info.set("Producer", Object::string_literal("Open Utility Tools"));
    let had_info = doc.trailer.has(b"Info");
    if had_info {
        let id = doc.add_object(Object::Dictionary(info));
        doc.trailer.set("Info", Object::Reference(id));
    }
}

/// Drop empty content streams from page `/Contents`.
fn drop_empty_contents(doc: &mut Document) {
    let empty: HashSet<ObjectId> = doc
        .objects
        .iter()
        .filter(|(_, o)| matches!(o, Object::Stream(s) if s.content.is_empty() && s.dict.get(b"Type").is_err()))
        .map(|(id, _)| *id)
        .collect();
    if empty.is_empty() {
        return;
    }
    let page_ids: Vec<ObjectId> = doc
        .objects
        .iter()
        .filter(|(_, o)| is_type(o, b"Page"))
        .map(|(id, _)| *id)
        .collect();
    for pid in page_ids {
        let Some(Object::Dictionary(page)) = doc.objects.get_mut(&pid) else {
            continue;
        };
        match page.get(b"Contents") {
            Ok(Object::Reference(id)) if empty.contains(id) => {
                page.remove(b"Contents");
            }
            Ok(Object::Array(a)) => {
                let kept: Vec<Object> = a
                    .iter()
                    .filter(|o| !matches!(o, Object::Reference(id) if empty.contains(id)))
                    .cloned()
                    .collect();
                if kept.len() != a.len() {
                    if kept.is_empty() {
                        page.remove(b"Contents");
                    } else {
                        page.set("Contents", Object::Array(kept));
                    }
                }
            }
            _ => {}
        }
    }
}

fn single_flate_without_params(s: &lopdf::Stream) -> bool {
    match s.dict.get(b"Filter") {
        Ok(Object::Name(n)) => n == b"FlateDecode" && !s.dict.has(b"DecodeParms"),
        Ok(Object::Array(a)) => {
            a.len() == 1
                && matches!(&a[0], Object::Name(n) if n == b"FlateDecode")
                && !s.dict.has(b"DecodeParms")
        }
        _ => false,
    }
}

/// Zlib-compress; the best level for ordinary streams, a faster one for huge ones.
fn deflate(data: &[u8]) -> Option<Vec<u8>> {
    let level = if data.len() > 2 * 1024 * 1024 {
        Compression::new(6)
    } else {
        Compression::best()
    };
    let mut enc = ZlibEncoder::new(Vec::with_capacity(data.len() / 2), level);
    enc.write_all(data).ok()?;
    enc.finish().ok()
}

fn compress_streams(doc: &mut Document) {
    let mut budget = RECOMPRESS_BUDGET;
    for obj in doc.objects.values_mut() {
        let Object::Stream(s) = obj else { continue };
        let ty = s.dict.get(b"Type").and_then(Object::as_name).ok();
        if matches!(ty, Some(b"XRef" | b"ObjStm" | b"Metadata")) || !s.allows_compression {
            continue;
        }
        if !s.dict.has(b"Filter") {
            // Raw stream: keep the compressed form only when it is clearly smaller.
            if let Some(packed) = deflate(&s.content) {
                if packed.len() + 19 < s.content.len() {
                    s.dict.set("Filter", Object::Name(b"FlateDecode".to_vec()));
                    s.set_content(packed);
                }
            }
        } else if single_flate_without_params(s)
            && s.content.len() >= 256
            && s.content.len() <= RECOMPRESS_MAX
            && budget >= s.content.len()
        {
            budget -= s.content.len();
            let mut raw = Vec::new();
            if ZlibDecoder::new(s.content.as_slice())
                .read_to_end(&mut raw)
                .is_err()
            {
                continue;
            }
            if let Some(better) = deflate(&raw) {
                // Only swap when it clearly pays off.
                if better.len() + 16 < s.content.len() {
                    s.set_content(better);
                }
            }
        }
    }
}

pub fn optimize_pdf(bytes: &[u8], strip: bool) -> Res<Vec<u8>> {
    let mut doc = load_plain(bytes)?;
    let was_encrypted = doc.encryption_state.is_some();
    if doc.get_pages().is_empty() {
        return Err("This PDF has no pages".to_string());
    }
    if strip {
        strip_metadata(&mut doc);
    }
    drop_empty_contents(&mut doc);
    prune_unreferenced(&mut doc);
    compress_streams(&mut doc);
    renumber_compact(&mut doc);
    let out = save_doc(&mut doc)?;
    // lopdf writes a classic cross-reference table and no object streams, so a
    // file that came in with compressed object streams can grow. Never hand
    // back something bigger unless the caller asked for metadata removal.
    if !strip && !was_encrypted && out.len() >= bytes.len() {
        return Ok(bytes.to_vec());
    }
    Ok(out)
}
