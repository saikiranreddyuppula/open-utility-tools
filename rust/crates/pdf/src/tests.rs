//! Native end-to-end tests of the pure inner functions on generated fixtures.

use crate::common::*;
use crate::{crypt, images, optimize, pages, stamp, text};
use lopdf::{dictionary, Dictionary, Document, Object, ObjectId, Stream, StringFormat};
use serde_json::Value;

struct PageDef {
    content: String,
    rotate: Option<i64>,
    crop: Option<[i64; 4]>,
    /// Put `/Resources` on the page itself instead of inheriting from /Pages.
    own_resources: bool,
}

fn page(content: &str) -> PageDef {
    PageDef {
        content: content.to_string(),
        rotate: None,
        crop: None,
        own_resources: false,
    }
}

fn simple_text(n: usize) -> String {
    format!(
        "BT /F1 12 Tf 72 720 Td (Page {n} first line) Tj 0 -14 Td (second line of page {n}) Tj ET"
    )
}

/// Build a PDF: Resources inherited from the root /Pages node (unless a page
/// has its own), two fonts, optional /Rotate and /CropBox per page.
fn build(defs: &[PageDef]) -> Vec<u8> {
    let mut doc = Document::with_version("1.5");
    let pages_id = doc.new_object_id();
    let f1 = doc.add_object(dictionary! {
        "Type" => "Font", "Subtype" => "Type1", "BaseFont" => "Helvetica",
        "Encoding" => "WinAnsiEncoding",
    });
    let f2 = doc.add_object(dictionary! {
        "Type" => "Font", "Subtype" => "Type1", "BaseFont" => "Times-Roman",
    });
    let resources = dictionary! { "Font" => dictionary! { "F1" => f1, "F2" => f2 } };
    let mut kids = Vec::new();
    for d in defs {
        let content_id = doc.add_object(Stream::new(
            Dictionary::new(),
            d.content.clone().into_bytes(),
        ));
        let mut p = dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "Contents" => content_id,
        };
        if d.own_resources {
            p.set("Resources", Object::Dictionary(resources.clone()));
        }
        if let Some(r) = d.rotate {
            p.set("Rotate", r);
        }
        if let Some(c) = d.crop {
            p.set(
                "CropBox",
                c.iter().map(|&v| Object::Integer(v)).collect::<Vec<_>>(),
            );
        }
        kids.push(Object::Reference(doc.add_object(p)));
    }
    let count = kids.len() as i64;
    doc.objects.insert(
        pages_id,
        Object::Dictionary(dictionary! {
            "Type" => "Pages", "Kids" => kids, "Count" => count,
            "Resources" => resources,
            "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
        }),
    );
    let outlines = doc.add_object(dictionary! { "Type" => "Outlines", "Count" => 0 });
    let catalog = doc.add_object(dictionary! {
        "Type" => "Catalog", "Pages" => pages_id, "Outlines" => outlines,
    });
    doc.trailer.set("Root", catalog);
    let info = doc.add_object(dictionary! {
        "Title" => Object::string_literal("Secret title"),
        "Producer" => Object::string_literal("tests"),
    });
    doc.trailer.set("Info", info);
    let mut out = Vec::new();
    doc.save_to(&mut out).unwrap();
    out
}

fn n_pages(n: usize) -> Vec<u8> {
    let defs: Vec<PageDef> = (1..=n).map(|i| page(&simple_text(i))).collect();
    build(&defs)
}

fn texts(bytes: &[u8]) -> Vec<String> {
    let json = text::extract_text(bytes, "").unwrap();
    let v: Value = serde_json::from_str(&json).unwrap();
    v.as_array()
        .unwrap()
        .iter()
        .map(|p| p["text"].as_str().unwrap().to_string())
        .collect()
}

// ---------------------------------------------------------------------------

#[test]
fn page_info_applies_rotation_and_cropbox() {
    let bytes = build(&[
        page("0 0 m"),
        PageDef {
            rotate: Some(90),
            ..page("0 0 m")
        },
        PageDef {
            rotate: Some(-90),
            ..page("")
        },
        PageDef {
            crop: Some([10, 20, 310, 420]),
            ..page("")
        },
        PageDef {
            rotate: Some(450),
            crop: Some([0, 0, 100, 200]),
            ..page("")
        },
    ]);
    let v: Value = serde_json::from_str(&pages::page_info(&bytes).unwrap()).unwrap();
    let a = v.as_array().unwrap();
    assert_eq!(a.len(), 5);
    assert_eq!(
        (
            a[0]["width"].as_f64(),
            a[0]["height"].as_f64(),
            a[0]["rotate"].as_i64()
        ),
        (Some(612.0), Some(792.0), Some(0))
    );
    assert_eq!(
        (
            a[1]["width"].as_f64(),
            a[1]["height"].as_f64(),
            a[1]["rotate"].as_i64()
        ),
        (Some(792.0), Some(612.0), Some(90))
    );
    assert_eq!(a[2]["rotate"].as_i64(), Some(270));
    assert_eq!(
        (a[3]["width"].as_f64(), a[3]["height"].as_f64()),
        (Some(300.0), Some(400.0))
    );
    assert_eq!(
        (
            a[4]["width"].as_f64(),
            a[4]["height"].as_f64(),
            a[4]["rotate"].as_i64()
        ),
        (Some(200.0), Some(100.0), Some(90))
    );
    assert_eq!(a[4]["page"].as_i64(), Some(5));
}

#[test]
fn reorder_with_duplicates_and_drops() {
    let bytes = n_pages(4);
    let out = pages::reorder_pages(&bytes, "3,1,2,2").unwrap();
    let t = texts(&out);
    assert_eq!(t.len(), 4);
    assert!(t[0].contains("Page 3 first line"), "{:?}", t);
    assert!(t[1].contains("Page 1 first line"));
    assert!(t[2].contains("Page 2 first line"));
    assert!(t[3].contains("Page 2 first line"));

    let doc = Document::load_mem(&out).unwrap();
    let kids: Vec<ObjectId> = collect_pages(&doc).iter().map(|p| p.id).collect();
    let uniq: std::collections::HashSet<_> = kids.iter().collect();
    assert_eq!(uniq.len(), 4, "/Kids must not repeat a reference");
    // Outlines dropped, page 4 pruned, everything still has its inherited attributes.
    assert!(doc.catalog().unwrap().get(b"Outlines").is_err());
    let infos: Value = serde_json::from_str(&pages::page_info(&out).unwrap()).unwrap();
    assert_eq!(infos[0]["width"].as_f64(), Some(612.0));
    let all_text = t.join("\n");
    assert!(!all_text.contains("Page 4"));
    assert!(out.len() < bytes.len() + 400);

    assert!(pages::reorder_pages(&bytes, "").is_err());
    assert!(pages::reorder_pages(&bytes, "5").is_err());
    assert!(pages::reorder_pages(&bytes, "0").is_err());
}

#[test]
fn stamp_maps_visible_coordinates_for_rotated_pages() {
    for rotate in [0i64, 90, 180, 270] {
        let bytes = build(&[PageDef {
            rotate: Some(rotate),
            ..page(&simple_text(1))
        }]);
        let spec = r#"{"items":[{"page":1,"text":"STAMP (x)","x":100,"y":50,"anchor":"left",
            "font":"Helvetica-Bold","size":20,"color":[1,0,0],"opacity":0.5,"rotation":0,"layer":"over"}]}"#;
        let out = stamp::stamp_text(&bytes, spec).unwrap();
        let doc = Document::load_mem(&out).unwrap();
        let pid = doc.get_pages()[&1];
        let content = String::from_utf8(doc.get_page_content(pid).unwrap()).unwrap();
        assert!(content.contains("(STAMP \\(x\\)) Tj"), "{content}");
        assert!(content.contains("/OUTG1 gs"));
        assert!(content.contains("1 0 0 rg"));
        // Tm: rotation by /Rotate, position mapped from visible (100,50).
        let tm_line = content.lines().find(|l| l.ends_with(" Tm")).unwrap();
        let nums: Vec<f64> = tm_line
            .split_whitespace()
            .take(6)
            .map(|s| s.parse().unwrap())
            .collect();
        let (ex, ey) = match rotate {
            0 => (100.0, 50.0),
            90 => (612.0 - 50.0, 100.0),
            180 => (612.0 - 100.0, 792.0 - 50.0),
            _ => (50.0, 792.0 - 100.0),
        };
        assert!(
            (nums[4] - ex).abs() < 1e-3 && (nums[5] - ey).abs() < 1e-3,
            "rotate {rotate}: {tm_line}"
        );
        let phi = (rotate as f64).to_radians();
        assert!((nums[0] - phi.cos()).abs() < 1e-3 && (nums[1] - phi.sin()).abs() < 1e-3);
        // Original content survives and the stamp comes after it.
        assert!(content.find("Page 1 first line").unwrap() < content.find("STAMP").unwrap());
    }
}

#[test]
fn stamp_anchor_under_layer_and_missing_contents() {
    let bytes = build(&[page(&simple_text(1)), page("")]);
    // Remove page 2's /Contents entirely.
    let mut doc = Document::load_mem(&bytes).unwrap();
    let pid2 = doc.get_pages()[&2];
    doc.get_dictionary_mut(pid2).unwrap().remove(b"Contents");
    let mut b2 = Vec::new();
    doc.save_to(&mut b2).unwrap();

    let spec = r#"{"items":[
        {"page":1,"text":"Hello","x":306,"y":30,"anchor":"center","font":"Courier","size":10,"layer":"under"},
        {"page":2,"text":"Right","x":600,"y":30,"anchor":"right","font":"Times-Bold","size":10,"layer":"over"}]}"#;
    let out = stamp::stamp_text(&b2, spec).unwrap();
    let doc = Document::load_mem(&out).unwrap();
    let c1 = String::from_utf8(doc.get_page_content(doc.get_pages()[&1]).unwrap()).unwrap();
    // Courier "Hello" = 5 * 6pt = 30pt wide, centred on x=306 -> starts at 291.
    assert!(c1.contains("291 30 Tm"), "{c1}");
    assert!(
        c1.find("Hello").unwrap() < c1.find("Page 1 first line").unwrap(),
        "under layer first"
    );
    let c2 = String::from_utf8(doc.get_page_content(doc.get_pages()[&2]).unwrap()).unwrap();
    // Times-Bold "Right": R=722 i=278 g=500 h=556 t=333 -> 2.389*10 = 23.89 -> start 576.11
    assert!(c2.contains("576.11 30 Tm"), "{c2}");
    // Pages keep working with text extraction, fonts registered once.
    let t = texts(&out);
    assert!(t[0].contains("Hello") && t[0].contains("Page 1 first line"));
    assert!(t[1].contains("Right"));
}

#[test]
fn stamp_does_not_clobber_existing_resource_names() {
    // A page that already has fonts called OUTF1 and indirect Resources.
    let mut doc = Document::with_version("1.5");
    let pages_id = doc.new_object_id();
    let font = doc.add_object(
        dictionary! { "Type" => "Font", "Subtype" => "Type1", "BaseFont" => "Courier" },
    );
    let res = doc.add_object(dictionary! { "Font" => dictionary! { "OUTF1" => font } });
    let content = doc.add_object(Stream::new(
        Dictionary::new(),
        b"q BT /OUTF1 12 Tf 50 700 Td (existing) Tj ET".to_vec(), // unbalanced q on purpose
    ));
    let pg = doc.add_object(dictionary! {
        "Type" => "Page", "Parent" => pages_id, "Contents" => vec![Object::Reference(content)],
        "Resources" => res, "MediaBox" => vec![0.into(), 0.into(), 300.into(), 400.into()],
    });
    doc.objects.insert(
        pages_id,
        Object::Dictionary(dictionary! {
            "Type" => "Pages", "Kids" => vec![Object::Reference(pg)], "Count" => 1,
        }),
    );
    let cat = doc.add_object(dictionary! { "Type" => "Catalog", "Pages" => pages_id });
    doc.trailer.set("Root", cat);
    let mut bytes = Vec::new();
    doc.save_to(&mut bytes).unwrap();

    let spec = r#"{"items":[{"page":1,"text":"new","x":10,"y":10,"size":12,"layer":"over"}]}"#;
    let out = stamp::stamp_text(&bytes, spec).unwrap();
    let doc = Document::load_mem(&out).unwrap();
    let pid = doc.get_pages()[&1];
    let content = String::from_utf8(doc.get_page_content(pid).unwrap()).unwrap();
    assert!(content.contains("/OUTF2 12 Tf"), "{content}");
    // Closing Q for our wrapper plus the original's unbalanced q.
    assert!(content.contains("Q\nQ\nq"), "{content}");
    let fonts = doc.get_page_fonts(pid).unwrap();
    assert!(fonts.contains_key(&b"OUTF1"[..]) && fonts.contains_key(&b"OUTF2"[..]));
    let t = texts(&out);
    assert!(t[0].contains("existing") && t[0].contains("new"), "{:?}", t);
}

#[test]
fn text_extraction_lines_and_spaces() {
    let content = "BT /F1 12 Tf 72 700 Td [(Hel) 20 (lo) -300 (wor) -10 (ld)] TJ \
                   0 -14 Td (next line) Tj 100 0 Td (far away) Tj ET \
                   BT /F2 10 Tf 72 600 Td 12 TL (A) Tj T* (B) Tj (C) ' ET";
    let bytes = build(&[page(content)]);
    let t = &texts(&bytes)[0];
    let lines: Vec<&str> = t.lines().collect();
    assert_eq!(lines[0], "Hello world", "{t:?}");
    assert!(lines[1].starts_with("next line far away"), "{t:?}");
    let rest: Vec<&str> = lines[2..]
        .iter()
        .copied()
        .filter(|l| !l.is_empty())
        .collect();
    assert_eq!(rest, ["A", "B", "C"], "{t:?}");
}

#[test]
fn text_extraction_ignores_overprinted_duplicates() {
    // Fake bold: the same word drawn twice, 0.3pt apart.
    let content = "BT /F1 12 Tf 72 700 Td (Bold) Tj ET BT /F1 12 Tf 72.3 700 Td (Bold) Tj ET \
                   BT /F1 12 Tf 110 700 Td (word) Tj ET";
    let t = &texts(&build(&[page(content)]))[0];
    assert_eq!(t, "Bold word", "{t:?}");
}

#[test]
fn text_extraction_tounicode_and_cid_fonts() {
    let mut doc = Document::with_version("1.5");
    let pages_id = doc.new_object_id();
    let cmap = b"/CIDInit /ProcSet findresource begin 12 dict begin begincmap
1 begincodespacerange <0000> <FFFF> endcodespacerange
3 beginbfchar <0001> <0048> <0002> <0069> <0003> <0020> endbfchar
1 beginbfrange <0004> <0006> <0061> endbfrange
endcmap end end";
    let tounicode = doc.add_object(Stream::new(Dictionary::new(), cmap.to_vec()));
    let cid = doc.add_object(dictionary! {
        "Type" => "Font", "Subtype" => "CIDFontType2", "BaseFont" => "Test",
        "DW" => 500,
        "W" => vec![1.into(), vec![Object::Integer(700), 300.into(), 250.into()].into()],
    });
    let font = doc.add_object(dictionary! {
        "Type" => "Font", "Subtype" => "Type0", "BaseFont" => "Test", "Encoding" => "Identity-H",
        "DescendantFonts" => vec![Object::Reference(cid)], "ToUnicode" => tounicode,
    });
    // (differences) simple font
    let simple = doc.add_object(dictionary! {
        "Type" => "Font", "Subtype" => "Type1", "BaseFont" => "Helvetica",
        "Encoding" => dictionary! {
            "Type" => "Encoding", "BaseEncoding" => "WinAnsiEncoding",
            "Differences" => vec![65.into(), Object::Name(b"eacute".to_vec()), Object::Name(b"fi".to_vec())],
        },
    });
    let content = doc.add_object(Stream::new(
        Dictionary::new(),
        b"BT /C1 12 Tf 50 700 Td <0001000200030004000500060003> Tj ET BT /S1 12 Tf 50 680 Td (AB C) Tj ET".to_vec(),
    ));
    let pg = doc.add_object(dictionary! {
        "Type" => "Page", "Parent" => pages_id, "Contents" => content,
        "Resources" => dictionary! { "Font" => dictionary! { "C1" => font, "S1" => simple } },
        "MediaBox" => vec![0.into(), 0.into(), 300.into(), 400.into()],
    });
    doc.objects.insert(
        pages_id,
        Object::Dictionary(dictionary! {
            "Type" => "Pages", "Kids" => vec![Object::Reference(pg)], "Count" => 1,
        }),
    );
    let cat = doc.add_object(dictionary! { "Type" => "Catalog", "Pages" => pages_id });
    doc.trailer.set("Root", cat);
    let mut bytes = Vec::new();
    doc.save_to(&mut bytes).unwrap();
    let t = &texts(&bytes)[0];
    assert_eq!(
        t,
        "Hi abc\n\u{e9}fi C".replace("fi", "fi").as_str(),
        "{t:?}"
    );
}

#[test]
fn text_extraction_spec_and_page_errors() {
    let bytes = n_pages(5);
    let json = text::extract_text(&bytes, "2,4-5").unwrap();
    let v: Value = serde_json::from_str(&json).unwrap();
    let pages: Vec<i64> = v
        .as_array()
        .unwrap()
        .iter()
        .map(|p| p["page"].as_i64().unwrap())
        .collect();
    assert_eq!(pages, vec![2, 4, 5]);
    assert!(text::extract_text(&bytes, "9").is_err());
}

#[test]
fn encryption_roundtrip_aes128_and_aes256() {
    let plain = n_pages(2);
    assert!(!crypt::is_encrypted(&plain));
    for aes256 in [false, true] {
        let enc = crypt::encrypt_pdf(&plain, "secret", "owner", 4 | 16, aes256).unwrap();
        assert!(crypt::is_encrypted(&enc), "aes256={aes256}");
        // Not readable without the password.
        assert!(text::extract_text(&enc, "").is_err());
        assert!(!String::from_utf8_lossy(&enc).contains("Secret title"));
        // Wrong password / right passwords.
        assert_eq!(
            crypt::decrypt_pdf(&enc, "nope").unwrap_err(),
            "Incorrect password"
        );
        assert_eq!(
            crypt::decrypt_pdf(&enc, "").unwrap_err(),
            "Incorrect password"
        );
        for pw in ["secret", "owner"] {
            let dec = crypt::decrypt_pdf(&enc, pw).unwrap();
            assert!(!crypt::is_encrypted(&dec));
            let t = texts(&dec);
            assert_eq!(t.len(), 2);
            assert!(t[1].contains("Page 2 first line"), "{:?}", t);
            let d = Document::load_mem(&dec).unwrap();
            assert!(d.trailer.get(b"Encrypt").is_err());
        }
        // Encrypting twice is refused.
        assert!(crypt::encrypt_pdf(&enc, "a", "b", 0, aes256).is_err());
    }
}

#[test]
fn owner_only_encryption_opens_with_empty_password() {
    let plain = n_pages(1);
    for aes256 in [false, true] {
        // Empty owner password -> random one; empty user password -> opens freely.
        let enc = crypt::encrypt_pdf(&plain, "", "", 0, aes256).unwrap();
        assert!(
            crypt::is_encrypted(&enc),
            "owner-only files still count as encrypted"
        );
        let t = texts(&enc);
        assert!(t[0].contains("Page 1 first line"));
        let dec = crypt::decrypt_pdf(&enc, "").unwrap();
        assert!(!crypt::is_encrypted(&dec));
        assert!(texts(&dec)[0].contains("Page 1 first line"));
    }
}

#[test]
fn permission_bits_are_encoded_as_signed_p() {
    let plain = n_pages(1);
    let enc = crypt::encrypt_pdf(&plain, "pw", "ow", 4 | 2048, false).unwrap();
    let doc = Document::load_mem(&enc).unwrap();
    let p = doc
        .get_encrypted()
        .unwrap()
        .get(b"P")
        .unwrap()
        .as_i64()
        .unwrap();
    assert!(p < 0);
    let p32 = p as i32 as u32;
    assert_eq!(p32 & 4, 4);
    assert_eq!(p32 & 2048, 2048);
    assert_eq!(p32 & (8 | 16 | 32 | 256 | 512 | 1024), 0);
    // Bits 7-8 and 13-32 must be set.
    assert_eq!(p32 & 0xC0, 0xC0);
    assert_eq!(p32 >> 12, 0xFFFFF);
}

fn fake_jpeg(w: u16, h: u16, comps: u8) -> Vec<u8> {
    let mut v = vec![0xFF, 0xD8, 0xFF, 0xC0, 0x00, 8 + 3 * comps, 8];
    v.extend(h.to_be_bytes());
    v.extend(w.to_be_bytes());
    v.push(comps);
    for i in 0..comps {
        v.extend([i + 1, 0x11, 0]);
    }
    v.extend([0xFF, 0xD9]);
    v
}

fn doc_with_images() -> Vec<u8> {
    let mut doc = Document::with_version("1.5");
    let pages_id = doc.new_object_id();
    let raw: Vec<u8> = (0..4 * 4 * 3).map(|i| (i * 7) as u8).collect();
    let flate = {
        let mut s = Stream::new(
            dictionary! { "Type" => "XObject", "Subtype" => "Image", "Width" => 4, "Height" => 4,
            "ColorSpace" => "DeviceRGB", "BitsPerComponent" => 8,
            "DecodeParms" => dictionary! { "Predictor" => 15, "Columns" => 4, "Colors" => 3 } },
            raw.clone(),
        );
        s.dict.set("Filter", "FlateDecode");
        doc.add_object(s)
    };
    let smask = doc.add_object(Stream::new(
        dictionary! { "Type" => "XObject", "Subtype" => "Image", "Width" => 4, "Height" => 4,
        "ColorSpace" => "DeviceGray", "BitsPerComponent" => 8 },
        vec![255; 16],
    ));
    let icc = doc.add_object(Stream::new(dictionary! { "N" => 1 }, vec![0; 8]));
    let jpeg = doc.add_object(Stream::new(
        dictionary! { "Type" => "XObject", "Subtype" => "Image", "Width" => 8, "Height" => 6,
        "ColorSpace" => vec![Object::Name(b"ICCBased".to_vec()), Object::Reference(icc)],
        "BitsPerComponent" => 8, "Filter" => "DCTDecode", "SMask" => smask },
        fake_jpeg(8, 6, 1),
    ));
    let mask = doc.add_object(Stream::new(
        dictionary! { "Type" => "XObject", "Subtype" => "Image", "Width" => 8, "Height" => 8,
        "ImageMask" => true, "BitsPerComponent" => 1 },
        vec![0xAA; 8],
    ));
    let orphan = doc.add_object(Stream::new(
        dictionary! { "Type" => "XObject", "Subtype" => "Image", "Width" => 2, "Height" => 2,
        "ColorSpace" => "DeviceGray", "BitsPerComponent" => 8 },
        vec![1, 2, 3, 4],
    ));
    // The mask image lives inside a form XObject on page 2.
    let form = doc.add_object(Stream::new(
        dictionary! { "Type" => "XObject", "Subtype" => "Form", "BBox" => vec![0.into(), 0.into(), 10.into(), 10.into()],
            "Resources" => dictionary! { "XObject" => dictionary! { "M" => mask } } },
        b"/M Do".to_vec(),
    ));
    let c1 = doc.add_object(Stream::new(Dictionary::new(), b"/I1 Do /I2 Do".to_vec()));
    let c2 = doc.add_object(Stream::new(Dictionary::new(), b"/Fm Do /I1 Do".to_vec()));
    let p1 = doc.add_object(
        dictionary! { "Type" => "Page", "Parent" => pages_id, "Contents" => c1,
        "Resources" => dictionary! { "XObject" => dictionary! { "I1" => flate, "I2" => jpeg } } },
    );
    let p2 = doc.add_object(
        dictionary! { "Type" => "Page", "Parent" => pages_id, "Contents" => c2,
        "Resources" => dictionary! { "XObject" => dictionary! { "Fm" => form, "I1" => flate } } },
    );
    doc.objects.insert(pages_id, Object::Dictionary(dictionary! {
        "Type" => "Pages", "Kids" => vec![Object::Reference(p1), Object::Reference(p2)], "Count" => 2,
        "MediaBox" => vec![0.into(), 0.into(), 100.into(), 100.into()],
    }));
    let cat = doc.add_object(dictionary! { "Type" => "Catalog", "Pages" => pages_id });
    doc.trailer.set("Root", cat);
    doc.trailer.set(
        "ID",
        vec![
            Object::String(vec![1; 16], StringFormat::Hexadecimal),
            Object::String(vec![1; 16], StringFormat::Hexadecimal),
        ],
    );
    let _ = orphan;
    let mut out = Vec::new();
    doc.save_to(&mut out).unwrap();
    out
}

#[test]
fn list_get_and_replace_images() {
    let bytes = doc_with_images();
    let v: Value = serde_json::from_str(&images::list_images(&bytes).unwrap()).unwrap();
    let list = v.as_array().unwrap();
    assert_eq!(list.len(), 5, "{v}");
    let by_filter = |f: &str| list.iter().find(|i| i["filter"] == f).unwrap();
    let jpeg = by_filter("DCTDecode");
    assert_eq!(jpeg["page"], 1);
    assert_eq!(jpeg["colorSpace"], "ICCBased");
    assert_eq!(jpeg["components"], 1);
    assert_eq!(jpeg["hasSMask"], true);
    assert_eq!(
        (jpeg["width"].as_i64(), jpeg["height"].as_i64()),
        (Some(8), Some(6))
    );
    let flate = by_filter("FlateDecode");
    assert_eq!(flate["page"], 1);
    assert_eq!(flate["components"], 3);
    assert_eq!(flate["hasPredictor"], true);
    assert_eq!(flate["colorSpace"], "DeviceRGB");
    let mask = list.iter().find(|i| i["isMask"] == true).unwrap();
    assert_eq!(mask["page"], 2, "image inside a form XObject");
    assert_eq!(mask["bitsPerComponent"], 1);
    // The soft-mask image and the unreferenced one are unreachable from page resources.
    assert_eq!(list.iter().filter(|i| i["page"] == 0).count(), 2);

    let jpeg_id = jpeg["id"].as_u64().unwrap() as u32;
    let raw = images::get_image_stream(&bytes, jpeg_id).unwrap();
    assert_eq!(raw, fake_jpeg(8, 6, 1));

    // Replace the Flate RGB image by a JPEG and drop its predictor.
    let flate_id = flate["id"].as_u64().unwrap();
    let meta = format!(r#"[{{"id":{flate_id},"width":4,"height":4,"gray":false}}]"#);
    let out = images::replace_images(&bytes, &meta, vec![fake_jpeg(4, 4, 3)]).unwrap();
    let v2: Value = serde_json::from_str(&images::list_images(&out).unwrap()).unwrap();
    let replaced = v2
        .as_array()
        .unwrap()
        .iter()
        .find(|i| i["id"] == flate_id)
        .unwrap();
    assert_eq!(replaced["filter"], "DCTDecode");
    assert_eq!(replaced["hasPredictor"], false);
    assert_eq!(replaced["colorSpace"], "DeviceRGB");
    assert_eq!(
        images::get_image_stream(&out, flate_id as u32).unwrap(),
        fake_jpeg(4, 4, 3)
    );

    // Validation.
    assert!(images::replace_images(&bytes, &meta, vec![fake_jpeg(5, 4, 3)]).is_err());
    assert!(images::replace_images(&bytes, &meta, vec![fake_jpeg(4, 4, 1)]).is_err());
    assert!(images::replace_images(&bytes, &meta, vec![b"not a jpeg".to_vec()]).is_err());
    assert!(images::replace_images(&bytes, &meta, vec![]).is_err());
    let mask_id = mask["id"].as_u64().unwrap();
    let meta_mask = format!(r#"[{{"id":{mask_id},"width":8,"height":8,"gray":true}}]"#);
    assert!(images::replace_images(&bytes, &meta_mask, vec![fake_jpeg(8, 8, 1)]).is_err());
}

#[test]
fn optimize_prunes_compresses_and_strips() {
    // Many repeated lines compress well; add an unreferenced object.
    let long =
        "BT /F1 12 Tf 72 720 Td (the quick brown fox jumps over the lazy dog) Tj ET\n".repeat(200);
    let mut doc = Document::load_mem(&build(&[page(&long), page(&long)])).unwrap();
    doc.add_object(Stream::new(Dictionary::new(), vec![7u8; 5000]));
    let meta = doc.add_object(Stream::new(
        dictionary! { "Type" => "Metadata", "Subtype" => "XML" },
        b"<x:xmpmeta>secret</x:xmpmeta>".to_vec(),
    ));
    let root = doc.trailer.get(b"Root").unwrap().as_reference().unwrap();
    doc.get_dictionary_mut(root).unwrap().set("Metadata", meta);
    let mut input = Vec::new();
    doc.save_to(&mut input).unwrap();

    let out = optimize::optimize_pdf(&input, false).unwrap();
    assert!(
        out.len() < input.len() / 2,
        "{} vs {}",
        out.len(),
        input.len()
    );
    assert!(
        String::from_utf8_lossy(&out).contains("Secret title"),
        "Info kept without strip"
    );
    assert_eq!(texts(&out), texts(&input));

    let stripped = optimize::optimize_pdf(&input, true).unwrap();
    let s = String::from_utf8_lossy(&stripped);
    assert!(!s.contains("Secret title") && !s.contains("xmpmeta"));
    assert!(s.contains("Open Utility Tools"));
    let d = Document::load_mem(&stripped).unwrap();
    assert!(d.catalog().unwrap().get(b"Metadata").is_err());
    assert_eq!(texts(&stripped), texts(&input));

    // An already-optimised file is never made bigger.
    let again = optimize::optimize_pdf(&out, false).unwrap();
    assert!(again.len() <= out.len());
}

#[test]
fn existing_functions_still_work_on_encrypted_free_files() {
    let bytes = n_pages(3);
    assert_eq!(Document::load_mem(&bytes).unwrap().get_pages().len(), 3);
}

#[test]
fn aes256_output_has_real_perms_and_opens_without_length_hint() {
    let plain = n_pages(2);
    let enc = crypt::encrypt_pdf(&plain, "", "owner", 4, true).unwrap();
    let doc = Document::load_mem(&enc).unwrap();
    let dict = doc.get_encrypted().unwrap();
    let perms = dict.get(b"Perms").unwrap().as_str().unwrap().to_vec();
    assert_eq!(perms.len(), 16);
    assert_ne!(
        &perms[9..12],
        b"adb",
        "/Perms must be encrypted, not the plain block"
    );
    assert_eq!(dict.get(b"Length").unwrap().as_i64().unwrap(), 256);

    // A third-party writer may omit /Length; lopdf then tries (and fails) to
    // auto-open the file at load time. `crypt::open` has to cope.
    let needle = b"/Length 256";
    let at = enc
        .windows(needle.len())
        .position(|w| w == needle)
        .expect("Length present");
    let mut no_length = enc.clone();
    no_length[at..at + needle.len()].fill(b' ');
    assert!(
        Document::load_mem(&no_length).is_err(),
        "lopdf alone cannot load this"
    );
    assert!(crypt::is_encrypted(&no_length));
    assert!(texts(&no_length)[1].contains("Page 2 first line"));
    let dec = crypt::decrypt_pdf(&no_length, "").unwrap();
    assert!(!crypt::is_encrypted(&dec));
    assert_eq!(texts(&dec).len(), 2);
}

#[test]
fn optimize_compresses_raw_streams_but_not_jpegs() {
    let mut doc = Document::load_mem(&doc_with_images()).unwrap();
    // The orphan gray image is raw and tiny; make one big raw RGB image referenced from page 1.
    let raw = vec![7u8; 100 * 100 * 3];
    let img = doc.add_object(Stream::new(
        dictionary! { "Type" => "XObject", "Subtype" => "Image", "Width" => 100, "Height" => 100,
        "ColorSpace" => "DeviceRGB", "BitsPerComponent" => 8 },
        raw,
    ));
    let pid = doc.get_pages()[&1];
    let page = doc.get_dictionary_mut(pid).unwrap();
    if let Ok(Object::Dictionary(res)) = page.get_mut(b"Resources") {
        if let Ok(Object::Dictionary(x)) = res.get_mut(b"XObject") {
            x.set("Big", img);
        }
    }
    let mut input = Vec::new();
    doc.save_to(&mut input).unwrap();
    let out = optimize::optimize_pdf(&input, false).unwrap();
    assert!(
        out.len() + 20_000 < input.len(),
        "{} vs {}",
        out.len(),
        input.len()
    );
    let v: Value = serde_json::from_str(&images::list_images(&out).unwrap()).unwrap();
    let big = v
        .as_array()
        .unwrap()
        .iter()
        .find(|i| i["width"] == 100)
        .unwrap();
    assert_eq!(big["filter"], "FlateDecode");
    let jpeg = v
        .as_array()
        .unwrap()
        .iter()
        .find(|i| i["filter"] == "DCTDecode")
        .unwrap();
    let id = jpeg["id"].as_u64().unwrap() as u32;
    // The JPEG bytes survive untouched (ids are renumbered, so compare by content).
    let in_ids: Value = serde_json::from_str(&images::list_images(&input).unwrap()).unwrap();
    let in_id = in_ids
        .as_array()
        .unwrap()
        .iter()
        .find(|i| i["filter"] == "DCTDecode")
        .unwrap()["id"]
        .as_u64()
        .unwrap() as u32;
    assert_eq!(
        images::get_image_stream(&out, id).unwrap(),
        images::get_image_stream(&input, in_id).unwrap()
    );
}

#[test]
fn page_geometry_edge_cases() {
    // No MediaBox anywhere -> US Letter; CropBox larger than MediaBox is clipped to it.
    let mut doc = Document::with_version("1.5");
    let pages_id = doc.new_object_id();
    let p1 = doc.add_object(dictionary! { "Type" => "Page", "Parent" => pages_id });
    let p2 = doc.add_object(dictionary! { "Type" => "Page", "Parent" => pages_id,
    "MediaBox" => vec![100.into(), 100.into(), 300.into(), 400.into()],
    "CropBox" => vec![0.into(), 0.into(), 1000.into(), 1000.into()] });
    doc.objects.insert(pages_id, Object::Dictionary(dictionary! {
        "Type" => "Pages", "Kids" => vec![Object::Reference(p1), Object::Reference(p2)], "Count" => 2,
    }));
    let cat = doc.add_object(dictionary! { "Type" => "Catalog", "Pages" => pages_id });
    doc.trailer.set("Root", cat);
    let mut bytes = Vec::new();
    doc.save_to(&mut bytes).unwrap();
    let v: Value = serde_json::from_str(&pages::page_info(&bytes).unwrap()).unwrap();
    assert_eq!(
        (v[0]["width"].as_f64(), v[0]["height"].as_f64()),
        (Some(612.0), Some(792.0))
    );
    assert_eq!(
        (v[1]["width"].as_f64(), v[1]["height"].as_f64()),
        (Some(200.0), Some(300.0))
    );
}

/// Mutation fuzzing of every inner function (run manually:
/// `PDF_FUZZ_DIR=/path/with/pdfs cargo test -p pdf fuzz -- --ignored --nocapture`).
#[test]
#[ignore]
fn fuzz_mutated_inputs_never_panic() {
    let Ok(dir) = std::env::var("PDF_FUZZ_DIR") else {
        return;
    };
    let mut seeds: Vec<(String, Vec<u8>)> = Vec::new();
    for entry in std::fs::read_dir(dir).unwrap() {
        let path = entry.unwrap().path();
        if path.extension().map(|e| e == "pdf").unwrap_or(false) {
            let data = std::fs::read(&path).unwrap();
            if data.len() < 400_000 {
                seeds.push((
                    path.file_name().unwrap().to_string_lossy().to_string(),
                    data,
                ));
            }
        }
    }
    let rounds: usize = std::env::var("PDF_FUZZ_ROUNDS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(40);
    let mut state: u64 = 0x9E3779B97F4A7C15;
    let mut rnd = move || {
        state ^= state << 13;
        state ^= state >> 7;
        state ^= state << 17;
        state
    };
    let spec = r#"{"items":[{"page":1,"text":"Hi","x":50,"y":50,"size":12,"layer":"over"},{"page":2,"text":"Yo","x":5,"y":5,"size":9,"layer":"under","rotation":33}]}"#;
    let mut runs = 0;
    for (name, seed) in &seeds {
        for round in 0..rounds {
            let mut data = seed.clone();
            match round % 4 {
                0 => {
                    let cut = (rnd() as usize) % data.len().max(1);
                    data.truncate(cut);
                }
                1 => {
                    for _ in 0..(1 + rnd() % 8) {
                        let at = (rnd() as usize) % data.len().max(1);
                        data[at] = rnd() as u8;
                    }
                }
                2 => {
                    // damage only the structure region near the end
                    let n = data.len();
                    for _ in 0..(1 + rnd() % 6) {
                        let at = n.saturating_sub(1 + (rnd() as usize) % 400.min(n));
                        data[at] = rnd() as u8;
                    }
                }
                _ => {
                    let at = (rnd() as usize) % data.len().max(1);
                    let len = ((rnd() as usize) % 64).min(data.len() - at);
                    data.drain(at..at + len);
                }
            }
            let d = data.clone();
            let result = std::panic::catch_unwind(move || {
                let _ = pages::page_info(&d);
                let _ = text::extract_text(&d, "");
                let _ = stamp::stamp_text(&d, spec);
                let _ = pages::reorder_pages(&d, "2,1,1");
                let _ = crypt::is_encrypted(&d);
                let _ = crypt::decrypt_pdf(&d, "x");
                let _ = images::list_images(&d);
                let _ = images::get_image_stream(&d, 3);
                let _ = optimize::optimize_pdf(&d, true);
                let _ = optimize::optimize_pdf(&d, false);
            });
            runs += 1;
            if result.is_err() {
                let out = std::env::var("PDF_FUZZ_DIR").unwrap();
                let path = format!("{out}/../fuzz-crash-{name}-{round}.bin");
                std::fs::write(&path, &data).unwrap();
                panic!("panic on mutation {round} of {name}; input saved to {path}");
            }
        }
    }
    eprintln!("fuzzed {runs} inputs without a panic");
}
