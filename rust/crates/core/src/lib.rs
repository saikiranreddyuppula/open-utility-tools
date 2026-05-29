//! Core wasm crate: cryptographic hashes, HMAC, binary encodings, and bcrypt.
//!
//! The TS boundary passes/returns `Uint8Array` (mapped to `&[u8]` / `Vec<u8>`),
//! primitives, and `String`. Expected errors are returned as `Result<_, JsValue>`
//! so the worker surfaces them as rejected promises rather than panics.

use wasm_bindgen::prelude::*;

mod encoding;
mod hashing;
mod password;

/// Installs a panic hook that logs Rust panics to the browser console.
#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

/// Trivial end-to-end smoke-test export — proves the worker → wasm pipeline.
#[wasm_bindgen]
pub fn version() -> String {
    format!("core@{}", env!("CARGO_PKG_VERSION"))
}

/// Sum bytes mod 2^32 — a deterministic, dependency-free pipeline check.
#[wasm_bindgen]
pub fn checksum(data: &[u8]) -> u32 {
    data.iter().fold(0u32, |acc, &b| acc.wrapping_add(b as u32))
}

pub use encoding::*;
pub use hashing::*;
pub use password::*;
