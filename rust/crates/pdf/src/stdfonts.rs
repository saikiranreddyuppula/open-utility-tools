//! Standard-14 font metrics (Helvetica, Times, Courier families) and WinAnsi
//! text encoding, used for stamping and for width estimates in text extraction.

use crate::afm_data as afm;

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub enum StdFont {
    Helvetica,
    HelveticaBold,
    TimesRoman,
    TimesBold,
    Courier,
    CourierBold,
}

impl StdFont {
    pub fn parse(name: &str) -> Option<StdFont> {
        Some(match name {
            "Helvetica" => StdFont::Helvetica,
            "Helvetica-Bold" => StdFont::HelveticaBold,
            "Times-Roman" => StdFont::TimesRoman,
            "Times-Bold" => StdFont::TimesBold,
            "Courier" => StdFont::Courier,
            "Courier-Bold" => StdFont::CourierBold,
            _ => return None,
        })
    }

    pub fn base_font(self) -> &'static str {
        match self {
            StdFont::Helvetica => "Helvetica",
            StdFont::HelveticaBold => "Helvetica-Bold",
            StdFont::TimesRoman => "Times-Roman",
            StdFont::TimesBold => "Times-Bold",
            StdFont::Courier => "Courier",
            StdFont::CourierBold => "Courier-Bold",
        }
    }

    fn table(self) -> &'static [u16; 224] {
        match self {
            StdFont::Helvetica => &afm::HELVETICA,
            StdFont::HelveticaBold => &afm::HELVETICA_BOLD,
            StdFont::TimesRoman => &afm::TIMES_ROMAN,
            StdFont::TimesBold => &afm::TIMES_BOLD,
            StdFont::Courier => &afm::COURIER,
            StdFont::CourierBold => &afm::COURIER_BOLD,
        }
    }

    /// Advance width of a WinAnsi code in 1/1000 em (0 for codes outside 32..=255).
    pub fn width(self, code: u8) -> u16 {
        if code < 32 {
            0
        } else {
            self.table()[(code - 32) as usize]
        }
    }

    /// Best-effort match for an arbitrary BaseFont name (subset prefix allowed).
    pub fn guess(base_font: &str) -> StdFont {
        let name = base_font
            .rsplit('+')
            .next()
            .unwrap_or(base_font)
            .to_ascii_lowercase();
        let bold = name.contains("bold") || name.contains("black") || name.contains("heavy");
        if name.contains("courier") || name.contains("mono") || name.contains("consolas") {
            if bold {
                StdFont::CourierBold
            } else {
                StdFont::Courier
            }
        } else if name.contains("times")
            || name.contains("serif") && !name.contains("sans")
            || name.contains("georgia")
            || name.contains("garamond")
            || name.contains("palatino")
            || name.contains("minion")
            || name.contains("cmr")
        {
            if bold {
                StdFont::TimesBold
            } else {
                StdFont::TimesRoman
            }
        } else if bold {
            StdFont::HelveticaBold
        } else {
            StdFont::Helvetica
        }
    }
}

/// Unicode scalar -> WinAnsi byte, or `None` when unsupported.
pub fn winansi_byte(c: char) -> Option<u8> {
    let u = c as u32;
    Some(match u {
        0x20..=0x7E => u as u8,
        0xA0..=0xFF => u as u8,
        0x20AC => 0x80,
        0x201A => 0x82,
        0x0192 => 0x83,
        0x201E => 0x84,
        0x2026 => 0x85,
        0x2020 => 0x86,
        0x2021 => 0x87,
        0x02C6 => 0x88,
        0x2030 => 0x89,
        0x0160 => 0x8A,
        0x2039 => 0x8B,
        0x0152 => 0x8C,
        0x017D => 0x8E,
        0x2018 => 0x91,
        0x2019 => 0x92,
        0x201C => 0x93,
        0x201D => 0x94,
        0x2022 => 0x95,
        0x2013 => 0x96,
        0x2014 => 0x97,
        0x02DC => 0x98,
        0x2122 => 0x99,
        0x0161 => 0x9A,
        0x203A => 0x9B,
        0x0153 => 0x9C,
        0x017E => 0x9E,
        0x0178 => 0x9F,
        // Common look-alikes that have no WinAnsi code of their own.
        0x2010 | 0x2011 | 0x2212 => b'-',
        0x2002..=0x200A | 0x202F | 0x205F | 0x3000 => b' ',
        0x09 | 0x0A | 0x0D => b' ',
        _ => return None,
    })
}

/// Encode text for a WinAnsi-encoded standard font; unsupported chars become `?`.
/// Zero-width characters are dropped.
pub fn encode_winansi(text: &str) -> Vec<u8> {
    let mut out = Vec::with_capacity(text.len());
    for c in text.chars() {
        match c as u32 {
            0x200B | 0x200C | 0x200D | 0xFEFF | 0xAD => continue,
            _ => {}
        }
        out.push(winansi_byte(c).unwrap_or(b'?'));
    }
    out
}

/// Width of already-encoded text in points.
pub fn text_width(font: StdFont, encoded: &[u8], size: f64) -> f64 {
    let mut units = 0u64;
    for &b in encoded {
        let w = font.width(b);
        // Codes without a glyph (width 0) are drawn as notdef; approximate with '?'.
        units += if w == 0 {
            font.width(b'?') as u64
        } else {
            w as u64
        };
    }
    units as f64 * size / 1000.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn helvetica_hello() {
        // H=722 e=556 l=222 l=222 o=556
        let enc = encode_winansi("Hello");
        let w = text_width(StdFont::Helvetica, &enc, 10.0);
        assert!((w - 22.78).abs() < 1e-9, "{w}");
    }

    #[test]
    fn courier_is_monospace() {
        let enc = encode_winansi("iii WWW");
        assert!((text_width(StdFont::Courier, &enc, 10.0) - 42.0).abs() < 1e-9);
    }

    #[test]
    fn unsupported_becomes_question_mark() {
        assert_eq!(encode_winansi("a\u{4E2D}b"), b"a?b");
        assert_eq!(encode_winansi("\u{20AC}5"), vec![0x80, b'5']);
        assert_eq!(encode_winansi("caf\u{e9}"), vec![b'c', b'a', b'f', 0xE9]);
    }
}
