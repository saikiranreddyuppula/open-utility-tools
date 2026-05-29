//! Binary <-> text encodings: base64 (std/url), base32, base58-ish via
//! data-encoding, and hex. Operate on bytes so they work for text and files.

use base64::{engine::general_purpose, Engine as _};
use wasm_bindgen::prelude::*;

/// Base64 encode. `url_safe` selects the URL/filename alphabet; `pad` toggles `=`.
#[wasm_bindgen]
pub fn base64_encode(data: &[u8], url_safe: bool, pad: bool) -> String {
    match (url_safe, pad) {
        (false, true) => general_purpose::STANDARD.encode(data),
        (false, false) => general_purpose::STANDARD_NO_PAD.encode(data),
        (true, true) => general_purpose::URL_SAFE.encode(data),
        (true, false) => general_purpose::URL_SAFE_NO_PAD.encode(data),
    }
}

/// Base64 decode. Accepts both standard and URL alphabets, padded or not.
#[wasm_bindgen]
pub fn base64_decode(text: &str) -> Result<Vec<u8>, JsValue> {
    let cleaned: String = text.split_whitespace().collect();
    // Try the most permissive engines in turn.
    general_purpose::STANDARD
        .decode(&cleaned)
        .or_else(|_| general_purpose::STANDARD_NO_PAD.decode(&cleaned))
        .or_else(|_| general_purpose::URL_SAFE.decode(&cleaned))
        .or_else(|_| general_purpose::URL_SAFE_NO_PAD.decode(&cleaned))
        .map_err(|e| JsValue::from_str(&format!("invalid base64: {e}")))
}

/// Base32 (RFC 4648) encode.
#[wasm_bindgen]
pub fn base32_encode(data: &[u8], pad: bool) -> String {
    if pad {
        data_encoding::BASE32.encode(data)
    } else {
        data_encoding::BASE32_NOPAD.encode(data)
    }
}

/// Base32 (RFC 4648) decode (case-insensitive, padding optional).
#[wasm_bindgen]
pub fn base32_decode(text: &str) -> Result<Vec<u8>, JsValue> {
    let cleaned: String = text.split_whitespace().collect::<String>().to_uppercase();
    data_encoding::BASE32
        .decode(cleaned.as_bytes())
        .or_else(|_| data_encoding::BASE32_NOPAD.decode(cleaned.trim_end_matches('=').as_bytes()))
        .map_err(|e| JsValue::from_str(&format!("invalid base32: {e}")))
}

/// Hex encode. `upper` selects uppercase output.
#[wasm_bindgen]
pub fn hex_encode(data: &[u8], upper: bool) -> String {
    if upper {
        hex::encode_upper(data)
    } else {
        hex::encode(data)
    }
}

/// Hex decode, tolerating whitespace and an optional `0x` prefix.
#[wasm_bindgen]
pub fn hex_decode(text: &str) -> Result<Vec<u8>, JsValue> {
    let cleaned: String = text
        .split_whitespace()
        .collect::<String>()
        .trim_start_matches("0x")
        .trim_start_matches("0X")
        .to_string();
    hex::decode(&cleaned).map_err(|e| JsValue::from_str(&format!("invalid hex: {e}")))
}
