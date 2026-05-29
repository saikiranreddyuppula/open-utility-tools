//! Password hashing: bcrypt hash + verify (pure-Rust `bcrypt`, wasm-friendly).

use wasm_bindgen::prelude::*;

/// Hash a password with bcrypt at the given cost (4..=31, typical 10-12).
#[wasm_bindgen]
pub fn bcrypt_hash(password: &str, cost: u32) -> Result<String, JsValue> {
    let cost = cost.clamp(4, 31);
    bcrypt::hash(password, cost).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Verify a password against a bcrypt hash.
#[wasm_bindgen]
pub fn bcrypt_verify(password: &str, hash: &str) -> Result<bool, JsValue> {
    bcrypt::verify(password, hash).map_err(|e| JsValue::from_str(&e.to_string()))
}
