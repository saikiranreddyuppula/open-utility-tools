//! Standard security handler: detect, apply (AES-128 / AES-256) and remove
//! password protection, built on lopdf's encryption support.

use crate::common::*;
use aes::cipher::{generic_array::GenericArray, BlockEncrypt, KeyInit};
use lopdf::encryption::crypt_filters::{Aes128CryptFilter, Aes256CryptFilter, CryptFilter};
use lopdf::encryption::DecryptionError;
use lopdf::{
    Dictionary, Document, EncryptionState, EncryptionVersion, Error, Object, Permissions,
    StringFormat,
};
use md5::{Digest, Md5};
use std::collections::BTreeMap;
use std::sync::Arc;

/// Permission bits accepted by `encrypt_pdf` (print, modify, copy, annotate,
/// fill forms, accessibility, assemble, high-quality print).
const PERMISSION_MASK: u32 = 4 | 8 | 16 | 32 | 256 | 512 | 1024 | 2048;

/// Raw scan used when the file cannot be parsed far enough to inspect the
/// trailer: any `/Encrypt` key counts.
fn raw_has_encrypt(bytes: &[u8]) -> bool {
    let needle = b"/Encrypt";
    bytes
        .windows(needle.len() + 1)
        .any(|w| &w[..needle.len()] == needle && !w[needle.len()].is_ascii_alphanumeric())
}

/// True when the file has an `/Encrypt` dictionary — including owner-only
/// protection that lopdf transparently opens with the empty password.
pub fn is_encrypted(bytes: &[u8]) -> bool {
    // (A plain load is enough: it never fails on encryption, only on damage.)
    match Document::load_mem(bytes) {
        Ok(doc) => doc.trailer.has(b"Encrypt") || doc.encryption_state.is_some(),
        Err(_) => raw_has_encrypt(bytes),
    }
}

fn random_bytes<const N: usize>() -> Res<[u8; N]> {
    let mut buf = [0u8; N];
    getrandom::fill(&mut buf).map_err(|e| format!("Could not gather random bytes: {e}"))?;
    Ok(buf)
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// Make sure the trailer carries a two-element `/ID` (the key derivation needs it).
fn ensure_file_id(doc: &mut Document) -> Res<()> {
    let ok = matches!(
        doc.trailer.get(b"ID"),
        Ok(Object::Array(a)) if a.len() >= 2
            && matches!(a[0], Object::String(ref s, _) if !s.is_empty())
            && matches!(a[1], Object::String(..))
    );
    if !ok {
        let id = random_bytes::<16>()?.to_vec();
        doc.trailer.set(
            "ID",
            Object::Array(vec![
                Object::String(id.clone(), StringFormat::Hexadecimal),
                Object::String(id, StringFormat::Hexadecimal),
            ]),
        );
    }
    Ok(())
}

fn map_lopdf_err(e: Error) -> String {
    match e {
        Error::Decryption(DecryptionError::IncorrectPassword)
        | Error::Decryption(DecryptionError::StringPrep(_)) => "Incorrect password".to_string(),
        Error::Decryption(
            DecryptionError::UnsupportedEncryption
            | DecryptionError::UnsupportedVersion
            | DecryptionError::UnsupportedRevision,
        )
        | Error::UnsupportedSecurityHandler(_) => {
            "This PDF uses an encryption scheme that is not supported".to_string()
        }
        other => format!("Could not decrypt PDF: {other}"),
    }
}

pub fn encrypt_pdf(
    bytes: &[u8],
    user_pw: &str,
    owner_pw: &str,
    permissions: u32,
    aes256: bool,
) -> Res<Vec<u8>> {
    let mut doc = open(bytes)?;
    if doc.trailer.has(b"Encrypt") {
        return Err("This PDF is already password-protected. Unlock it first.".to_string());
    }
    ensure_file_id(&mut doc)?;

    let owner = if owner_pw.is_empty() {
        hex(&random_bytes::<16>()?)
    } else {
        owner_pw.to_string()
    };
    let perms = Permissions::from_bits_truncate((permissions & PERMISSION_MASK) as u64);

    let mut file_key = [0u8; 32];
    let state = if aes256 {
        let key = random_bytes::<32>()?;
        file_key = key;
        let filter: Arc<dyn CryptFilter> = Arc::new(Aes256CryptFilter);
        EncryptionState::try_from(EncryptionVersion::V5 {
            encrypt_metadata: true,
            crypt_filters: BTreeMap::from([(b"StdCF".to_vec(), filter)]),
            file_encryption_key: &key,
            stream_filter: b"StdCF".to_vec(),
            string_filter: b"StdCF".to_vec(),
            owner_password: &owner,
            user_password: user_pw,
            permissions: perms,
        })
    } else {
        let filter: Arc<dyn CryptFilter> = Arc::new(Aes128CryptFilter);
        EncryptionState::try_from(EncryptionVersion::V4 {
            document: &doc,
            encrypt_metadata: true,
            crypt_filters: BTreeMap::from([(b"StdCF".to_vec(), filter)]),
            stream_filter: b"StdCF".to_vec(),
            string_filter: b"StdCF".to_vec(),
            owner_password: &owner,
            user_password: user_pw,
            permissions: perms,
        })
    }
    .map_err(|e| format!("Could not set up encryption: {e}"))?;

    doc.encrypt(&state)
        .map_err(|e| format!("Could not encrypt PDF: {e}"))?;

    // Align the /Encrypt dictionary and header with what other writers emit.
    if let Ok(Object::Reference(enc_id)) = doc.trailer.get(b"Encrypt").cloned() {
        if let Some(Object::Dictionary(enc)) = doc.objects.get_mut(&enc_id) {
            if aes256 {
                // lopdf 0.36 writes /Perms unencrypted (its AES-ECB call works on a
                // temporary copy); store the real, encrypted block instead.
                enc.set(
                    "Perms",
                    Object::String(compute_perms(&file_key, perms), StringFormat::Literal),
                );
                // Like Acrobat and qpdf. (It also keeps lopdf's reader from trying
                // to auto-open the file with its broken /Perms check.)
                enc.set("Length", Object::Integer(256));
            }
            if let Ok(Object::Dictionary(cf)) = enc.get_mut(b"CF") {
                if let Ok(Object::Dictionary(std_cf)) = cf.get_mut(b"StdCF") {
                    std_cf.set("AuthEvent", Object::Name(b"DocOpen".to_vec()));
                    std_cf.set("Length", Object::Integer(if aes256 { 32 } else { 16 }));
                }
            }
        }
    }
    ensure_min_version(&mut doc, if aes256 { "1.7" } else { "1.6" });
    if aes256 {
        add_adobe_extension(&mut doc);
    }
    save_doc(&mut doc)
}

/// Algorithm 10: the 16-byte /Perms block, AES-256-ECB encrypted with the file key.
fn compute_perms(file_key: &[u8; 32], perms: Permissions) -> Vec<u8> {
    let mut block = [0u8; 16];
    block[..8].copy_from_slice(&perms.p_value().to_le_bytes());
    block[8] = b'T'; // EncryptMetadata
    block[9..12].copy_from_slice(b"adb");
    block[12..].copy_from_slice(&random_bytes::<4>().unwrap_or([0; 4]));
    let cipher = aes::Aes256::new(GenericArray::from_slice(file_key));
    let mut ga = GenericArray::clone_from_slice(&block);
    cipher.encrypt_block(&mut ga);
    ga.to_vec()
}

/// R6 predates PDF 2.0; Adobe's convention is "1.7 + ADBE extension level 8".
fn add_adobe_extension(doc: &mut Document) {
    let Ok(root) = doc.trailer.get(b"Root").and_then(Object::as_reference) else {
        return;
    };
    if let Some(Object::Dictionary(cat)) = doc.objects.get_mut(&root) {
        let mut adbe = Dictionary::new();
        adbe.set("BaseVersion", Object::Name(b"1.7".to_vec()));
        adbe.set("ExtensionLevel", Object::Integer(8));
        match cat.get_mut(b"Extensions") {
            Ok(Object::Dictionary(ext)) => ext.set("ADBE", Object::Dictionary(adbe)),
            _ => {
                let mut ext = Dictionary::new();
                ext.set("ADBE", Object::Dictionary(adbe));
                cat.set("Extensions", Object::Dictionary(ext));
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Opening / decrypting
// ---------------------------------------------------------------------------

const PAD_BYTES: [u8; 32] = [
    0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41, 0x64, 0x00, 0x4E, 0x56, 0xFF, 0xFA, 0x01, 0x08,
    0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80, 0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A,
];

fn rc4(key: &[u8], data: &[u8]) -> Vec<u8> {
    let mut s: [u8; 256] = std::array::from_fn(|i| i as u8);
    let mut j = 0usize;
    for i in 0..256 {
        j = (j + s[i] as usize + key[i % key.len()] as usize) & 0xFF;
        s.swap(i, j);
    }
    let (mut i, mut j) = (0usize, 0usize);
    data.iter()
        .map(|&b| {
            i = (i + 1) & 0xFF;
            j = (j + s[i] as usize) & 0xFF;
            s.swap(i, j);
            b ^ s[(s[i] as usize + s[j] as usize) & 0xFF]
        })
        .collect()
}

/// Password as bytes for the revision <= 4 handlers (PDFDocEncoding ~ Latin-1).
fn password_bytes_r4(pw: &str) -> Vec<u8> {
    pw.chars()
        .map(|c| if (c as u32) < 256 { c as u8 } else { b'?' })
        .collect()
}

/// Algorithm 7 of ISO 32000: recover the (padded) user password from /O using
/// the owner password. lopdf authenticates the owner password for R<=4 but then
/// derives the file key from it as if it were the user password, which yields
/// garbage; going through the recovered user password avoids that.
fn recover_user_password_r4(doc: &Document, owner_pw: &str) -> Option<Vec<u8>> {
    let enc = doc.get_encrypted().ok()?;
    let r = enc.get(b"R").ok()?.as_i64().ok()?;
    let o = enc.get(b"O").ok()?.as_str().ok()?;
    if o.len() != 32 {
        return None;
    }
    let length_bits = enc
        .get(b"Length")
        .ok()
        .and_then(|l| l.as_i64().ok())
        .unwrap_or(40);
    let n = if r >= 3 {
        (length_bits as usize / 8).clamp(5, 16)
    } else {
        5
    };

    let pw = password_bytes_r4(owner_pw);
    let len = pw.len().min(32);
    let mut h = Md5::new();
    h.update(&pw[..len]);
    h.update(&PAD_BYTES[..32 - len]);
    let mut hash = h.finalize();
    if r >= 3 {
        for _ in 0..50 {
            hash = Md5::digest(hash);
        }
    }
    let key = &hash[..n];
    let mut result = o.to_vec();
    if r >= 3 {
        for i in (0..=19u8).rev() {
            let k: Vec<u8> = key.iter().map(|b| b ^ i).collect();
            result = rc4(&k, &result);
        }
    } else {
        result = rc4(key, &result);
    }
    Some(result)
}

/// lopdf's reader/decryptor only copes with an indirect /Encrypt and rejects the
/// `/Length 256` that Acrobat and qpdf write for AES-256; patch both up.
fn normalize_encrypt_dict(doc: &mut Document) {
    if let Some(Object::Dictionary(d)) = doc.trailer.get(b"Encrypt").ok().cloned() {
        let id = doc.add_object(Object::Dictionary(d));
        doc.trailer.set("Encrypt", Object::Reference(id));
    }
    if let Ok(Object::Reference(id)) = doc.trailer.get(b"Encrypt").cloned() {
        if let Some(Object::Dictionary(d)) = doc.objects.get_mut(&id) {
            let v = d.get(b"V").ok().and_then(|v| v.as_i64().ok()).unwrap_or(0);
            if v >= 5 {
                d.remove(b"Length");
            }
        }
    }
}

/// Replace /Perms by the plaintext block lopdf's (broken) validation expects.
fn neutralise_perms_check(doc: &mut Document) {
    let Ok(Object::Reference(id)) = doc.trailer.get(b"Encrypt").cloned() else {
        return;
    };
    let Some(Object::Dictionary(d)) = doc.objects.get_mut(&id) else {
        return;
    };
    let p = d.get(b"P").ok().and_then(|p| p.as_i64().ok()).unwrap_or(0) as u64;
    let encrypt_metadata = !matches!(d.get(b"EncryptMetadata"), Ok(Object::Boolean(false)));
    let mut block = [0u8; 16];
    block[..8].copy_from_slice(&Permissions::from_bits_truncate(p).p_value().to_le_bytes());
    block[8] = if encrypt_metadata { b'T' } else { b'F' };
    block[9..12].copy_from_slice(b"adb");
    d.set(
        "Perms",
        Object::String(block.to_vec(), StringFormat::Literal),
    );
}

/// Decrypt `doc` in place with the user or owner password.
fn decrypt_in_place(doc: &mut Document, password: &str) -> Result<(), Error> {
    let revision = doc
        .get_encrypted()
        .ok()
        .and_then(|d| d.get(b"R").ok())
        .and_then(|r| r.as_i64().ok())
        .unwrap_or(0);
    if revision > 4 {
        return match doc.decrypt(password) {
            // lopdf 0.36 "decrypts" /Perms on a temporary copy and then checks the
            // untouched ciphertext, so a genuine user-password open always fails
            // that check. Retry with a /Perms block it accepts (the output is
            // unencrypted, so the block is not needed afterwards).
            Err(Error::Decryption(DecryptionError::IncorrectPassword))
                if doc.authenticate_user_password(password).is_ok() =>
            {
                neutralise_perms_check(doc);
                doc.decrypt(password)
            }
            other => other,
        };
    }
    if doc.authenticate_user_password(password).is_ok() {
        return doc.decrypt(password);
    }
    if let Some(user_pw) = recover_user_password_r4(doc, password) {
        if doc.authenticate_raw_user_password(&user_pw).is_ok() {
            return doc.decrypt_raw(&user_pw);
        }
    }
    Err(Error::Decryption(DecryptionError::IncorrectPassword))
}

/// Same-length patch that turns `/V 5` into `/V 9` inside the encryption
/// dictionary, so lopdf's reader does not try to auto-open the file.
fn hide_v5(bytes: &[u8]) -> Option<Vec<u8>> {
    let mut i = 0;
    while i + 4 < bytes.len() {
        if bytes[i] == b'/' && bytes[i + 1] == b'V' && bytes[i + 2].is_ascii_whitespace() {
            let mut j = i + 2;
            while j < bytes.len() && bytes[j].is_ascii_whitespace() {
                j += 1;
            }
            if bytes.get(j) == Some(&b'5') && !bytes.get(j + 1).is_some_and(|c| c.is_ascii_digit())
            {
                let lo = i.saturating_sub(2048);
                let hi = (j + 2048).min(bytes.len());
                if bytes[lo..hi].windows(9).any(|w| w == b"/Standard") {
                    let mut out = bytes.to_vec();
                    out[j] = b'9';
                    return Some(out);
                }
            }
        }
        i += 1;
    }
    None
}

/// Load a document. Files that open with the empty password (no user
/// password, only owner restrictions) come back already decrypted; others stay
/// encrypted so callers can decide.
pub fn open(bytes: &[u8]) -> Res<Document> {
    let mut doc = match Document::load_mem(bytes) {
        Ok(d) => d,
        Err(Error::Decryption(_)) => {
            // lopdf auto-opens files whose user password is empty, but its AES-256
            // /Perms check rejects genuine files; load with /V hidden, then restore it.
            let patched =
                hide_v5(bytes).ok_or_else(|| "Could not open this encrypted PDF".to_string())?;
            let mut d =
                Document::load_mem(&patched).map_err(|e| format!("Could not read PDF: {e}"))?;
            if let Ok(Object::Reference(id)) = d.trailer.get(b"Encrypt").cloned() {
                if let Some(Object::Dictionary(enc)) = d.objects.get_mut(&id) {
                    enc.set("V", Object::Integer(5));
                }
            }
            d
        }
        Err(e) => return Err(format!("Could not read PDF: {e}")),
    };
    if doc.trailer.has(b"Encrypt") {
        normalize_encrypt_dict(&mut doc);
        if doc.is_encrypted() {
            // Failure just means a real password is needed.
            let _ = decrypt_in_place(&mut doc, "");
        }
    }
    Ok(doc)
}

pub fn decrypt_pdf(bytes: &[u8], password: &str) -> Res<Vec<u8>> {
    let mut doc = open(bytes)?;
    if doc.trailer.has(b"Encrypt") {
        decrypt_in_place(&mut doc, password).map_err(map_lopdf_err)?;
    } else if doc.encryption_state.is_none() {
        // Not encrypted at all: nothing to do, hand the file back unchanged.
        return Ok(bytes.to_vec());
    }
    // (Owner-only files were already opened by the empty password at load time.)
    save_doc(&mut doc)
}
