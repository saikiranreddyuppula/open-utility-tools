//! Cryptographic and non-cryptographic hash digests + HMAC.

use digest::Digest;
use hmac::{Hmac, Mac};
use wasm_bindgen::prelude::*;

/// Compute a digest over `data` and return lowercase hex.
/// Supported: md5, sha1, sha224, sha256, sha384, sha512,
/// sha3-224/256/384/512, blake3, crc32.
#[wasm_bindgen]
pub fn hash_hex(algo: &str, data: &[u8]) -> Result<String, JsValue> {
    let bytes = hash_bytes(algo, data)?;
    Ok(hex::encode(bytes))
}

/// Compute a digest and return raw bytes (e.g. for further encoding).
#[wasm_bindgen]
pub fn hash_raw(algo: &str, data: &[u8]) -> Result<Vec<u8>, JsValue> {
    hash_bytes(algo, data)
}

fn hash_bytes(algo: &str, data: &[u8]) -> Result<Vec<u8>, JsValue> {
    let a = algo.to_ascii_lowercase().replace(['-', '_'], "");
    let out = match a.as_str() {
        "md5" => md5::Md5::digest(data).to_vec(),
        "sha1" => sha1::Sha1::digest(data).to_vec(),
        "sha224" => sha2::Sha224::digest(data).to_vec(),
        "sha256" => sha2::Sha256::digest(data).to_vec(),
        "sha384" => sha2::Sha384::digest(data).to_vec(),
        "sha512" => sha2::Sha512::digest(data).to_vec(),
        "sha3224" => sha3::Sha3_224::digest(data).to_vec(),
        "sha3256" => sha3::Sha3_256::digest(data).to_vec(),
        "sha3384" => sha3::Sha3_384::digest(data).to_vec(),
        "sha3512" => sha3::Sha3_512::digest(data).to_vec(),
        "blake3" => blake3::hash(data).as_bytes().to_vec(),
        "crc32" => crc32fast::hash(data).to_be_bytes().to_vec(),
        other => return Err(JsValue::from_str(&format!("unknown hash algorithm: {other}"))),
    };
    Ok(out)
}

type HmacSha256 = Hmac<sha2::Sha256>;
type HmacSha512 = Hmac<sha2::Sha512>;
type HmacSha1 = Hmac<sha1::Sha1>;
type HmacSha384 = Hmac<sha2::Sha384>;

/// HMAC of `data` with `key`, returned as lowercase hex.
/// Supported algos: sha1, sha256, sha384, sha512.
#[wasm_bindgen]
pub fn hmac_hex(algo: &str, key: &[u8], data: &[u8]) -> Result<String, JsValue> {
    let a = algo.to_ascii_lowercase().replace(['-', '_'], "");
    let out: Vec<u8> = match a.as_str() {
        "sha1" => {
            let mut m = HmacSha1::new_from_slice(key).map_err(map_err)?;
            m.update(data);
            m.finalize().into_bytes().to_vec()
        }
        "sha256" => {
            let mut m = HmacSha256::new_from_slice(key).map_err(map_err)?;
            m.update(data);
            m.finalize().into_bytes().to_vec()
        }
        "sha384" => {
            let mut m = HmacSha384::new_from_slice(key).map_err(map_err)?;
            m.update(data);
            m.finalize().into_bytes().to_vec()
        }
        "sha512" => {
            let mut m = HmacSha512::new_from_slice(key).map_err(map_err)?;
            m.update(data);
            m.finalize().into_bytes().to_vec()
        }
        other => return Err(JsValue::from_str(&format!("unknown hmac algorithm: {other}"))),
    };
    Ok(hex::encode(out))
}

fn map_err<E: std::fmt::Display>(e: E) -> JsValue {
    JsValue::from_str(&e.to_string())
}
