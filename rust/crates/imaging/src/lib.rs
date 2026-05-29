//! Imaging wasm crate: decode any common raster format, resize, transform, and
//! re-encode to a chosen format — all from a single `convert` entry point plus a
//! few helpers. Bytes cross the boundary as `Uint8Array`.

use image::{
    codecs::ico::{IcoEncoder, IcoFrame},
    imageops::FilterType,
    DynamicImage, GenericImageView, ImageEncoder, ImageFormat, RgbaImage,
};
use std::io::Cursor;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn version() -> String {
    format!("imaging@{}", env!("CARGO_PKG_VERSION"))
}

/// Probe an image's dimensions + detected format without fully decoding pixels.
/// Returns "WIDTHxHEIGHT FORMAT" or throws.
#[wasm_bindgen]
pub fn probe(bytes: &[u8]) -> Result<String, JsValue> {
    let reader = image::ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(map_err)?;
    let format = reader
        .format()
        .map(format_name)
        .unwrap_or("unknown")
        .to_string();
    let (w, h) = reader.into_dimensions().map_err(map_err)?;
    Ok(format!("{w}x{h} {format}"))
}

fn format_name(f: ImageFormat) -> &'static str {
    match f {
        ImageFormat::Png => "PNG",
        ImageFormat::Jpeg => "JPEG",
        ImageFormat::Gif => "GIF",
        ImageFormat::WebP => "WebP",
        ImageFormat::Tiff => "TIFF",
        ImageFormat::Bmp => "BMP",
        ImageFormat::Ico => "ICO",
        ImageFormat::Tga => "TGA",
        ImageFormat::Pnm => "PNM",
        _ => "image",
    }
}

fn map_err<E: std::fmt::Display>(e: E) -> JsValue {
    JsValue::from_str(&e.to_string())
}

fn parse_filter(name: &str) -> FilterType {
    match name {
        "nearest" => FilterType::Nearest,
        "triangle" => FilterType::Triangle,
        "catmullrom" => FilterType::CatmullRom,
        "gaussian" => FilterType::Gaussian,
        _ => FilterType::Lanczos3,
    }
}

/// Composite an image onto a solid background — used when encoding a
/// transparency-capable image to a format without alpha (JPEG).
fn flatten(img: &DynamicImage, hex_bg: &str) -> RgbaImage {
    let (r, g, b) = parse_hex(hex_bg).unwrap_or((255, 255, 255));
    let rgba = img.to_rgba8();
    let (w, h) = (rgba.width(), rgba.height());
    let mut out = RgbaImage::from_pixel(w, h, image::Rgba([r, g, b, 255]));
    for (x, y, px) in rgba.enumerate_pixels() {
        let a = px[3] as f32 / 255.0;
        let bg = out.get_pixel(x, y);
        let blend = |fg: u8, bg: u8| ((fg as f32 * a) + (bg as f32 * (1.0 - a))) as u8;
        out.put_pixel(
            x,
            y,
            image::Rgba([blend(px[0], bg[0]), blend(px[1], bg[1]), blend(px[2], bg[2]), 255]),
        );
    }
    out
}

fn parse_hex(s: &str) -> Option<(u8, u8, u8)> {
    let s = s.trim_start_matches('#');
    if s.len() == 6 {
        let r = u8::from_str_radix(&s[0..2], 16).ok()?;
        let g = u8::from_str_radix(&s[2..4], 16).ok()?;
        let b = u8::from_str_radix(&s[4..6], 16).ok()?;
        Some((r, g, b))
    } else {
        None
    }
}

/// Options struct passed from JS as plain args (kept primitive for a stable ABI).
#[allow(clippy::too_many_arguments)]
#[wasm_bindgen]
pub fn convert(
    bytes: &[u8],
    target_format: &str, // png|jpeg|webp|gif|bmp|tiff|ico
    quality: u8,         // 1..=100 (jpeg/webp lossy)
    max_width: u32,      // 0 = keep
    max_height: u32,     // 0 = keep
    filter: &str,        // resampling filter
    background: &str,    // hex bg for alpha→opaque
    on_progress: &js_sys::Function,
) -> Result<Vec<u8>, JsValue> {
    let report = |r: f64, stage: &str| {
        let _ = on_progress.call2(&JsValue::NULL, &JsValue::from(r), &JsValue::from_str(stage));
    };

    report(0.05, "decoding");
    let mut img = image::load_from_memory(bytes).map_err(map_err)?;

    // Resize (fit within max box, preserve aspect) if requested.
    if max_width > 0 || max_height > 0 {
        report(0.35, "resizing");
        let (w, h) = img.dimensions();
        let tw = if max_width > 0 { max_width } else { w };
        let th = if max_height > 0 { max_height } else { h };
        img = img.resize(tw, th, parse_filter(filter));
    }

    report(0.6, "encoding");
    let fmt = target_format.to_ascii_lowercase();
    let mut out = Cursor::new(Vec::new());

    match fmt.as_str() {
        "jpeg" | "jpg" => {
            let flat = flatten(&img, background);
            let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(
                &mut out,
                quality.clamp(1, 100),
            );
            encoder
                .write_image(flat.as_raw(), flat.width(), flat.height(), image::ExtendedColorType::Rgba8)
                .map_err(map_err)?;
        }
        "png" => {
            img.write_to(&mut out, ImageFormat::Png).map_err(map_err)?;
        }
        "webp" => {
            // image's webp encoder is lossless; quality is ignored here.
            let rgba = img.to_rgba8();
            let encoder = image::codecs::webp::WebPEncoder::new_lossless(&mut out);
            encoder
                .write_image(rgba.as_raw(), rgba.width(), rgba.height(), image::ExtendedColorType::Rgba8)
                .map_err(map_err)?;
        }
        "gif" => {
            img.write_to(&mut out, ImageFormat::Gif).map_err(map_err)?;
        }
        "bmp" => {
            img.write_to(&mut out, ImageFormat::Bmp).map_err(map_err)?;
        }
        "tiff" => {
            img.write_to(&mut out, ImageFormat::Tiff).map_err(map_err)?;
        }
        "ico" => {
            // ICO maxes at 256x256 — downscale if needed.
            let (w, h) = (img.width(), img.height());
            let icon = if w > 256 || h > 256 {
                img.resize(256, 256, FilterType::Lanczos3)
            } else {
                img.clone()
            };
            let rgba = icon.to_rgba8();
            let encoder = IcoEncoder::new(&mut out);
            encoder
                .write_image(rgba.as_raw(), rgba.width(), rgba.height(), image::ExtendedColorType::Rgba8)
                .map_err(map_err)?;
        }
        other => return Err(JsValue::from_str(&format!("unsupported target format: {other}"))),
    }

    report(1.0, "done");
    Ok(out.into_inner())
}

/// Build a multi-resolution .ico (16/32/48/256) from one source image — the
/// favicon use case. Returns ICO bytes.
#[wasm_bindgen]
pub fn make_multi_ico(bytes: &[u8], sizes_csv: &str) -> Result<Vec<u8>, JsValue> {
    let img = image::load_from_memory(bytes).map_err(map_err)?;
    let sizes: Vec<u32> = sizes_csv
        .split(',')
        .filter_map(|s| s.trim().parse::<u32>().ok())
        .filter(|&s| s > 0 && s <= 256)
        .collect();
    let sizes = if sizes.is_empty() { vec![16, 32, 48, 256] } else { sizes };

    let mut out = Cursor::new(Vec::new());
    let encoder = IcoEncoder::new(&mut out);
    let mut frames = Vec::new();
    for s in sizes {
        let resized = img.resize_exact(s, s, FilterType::Lanczos3).to_rgba8();
        frames.push(
            IcoFrame::as_png(resized.as_raw(), s, s, image::ExtendedColorType::Rgba8)
                .map_err(map_err)?,
        );
    }
    encoder.encode_images(&frames).map_err(map_err)?;
    Ok(out.into_inner())
}
