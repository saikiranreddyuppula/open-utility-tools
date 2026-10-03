#!/usr/bin/env python3
"""Regenerate src/afm_data.rs and src/enc_data.rs.

    pip install fonttools matplotlib      # matplotlib only ships the Adobe Core-14 AFM files
    python3 tools/gen_tables.py [AFM_DIR]

* afm_data.rs  - advance widths (1/1000 em) of codes 32..=255 in WinAnsi for Helvetica,
                 Helvetica-Bold, Times-Roman, Times-Bold, Courier, Courier-Bold.
* enc_data.rs  - code -> Unicode tables for Standard / Symbol / WinAnsi / MacRoman encodings and
                 a subset of the Adobe Glyph List ("name=HEX;" pairs) for /Differences decoding.
"""
import os
import re
import sys

from fontTools import agl

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "src")
if len(sys.argv) > 1:
    AFM = sys.argv[1]
else:
    import matplotlib

    AFM = os.path.join(os.path.dirname(matplotlib.__file__), "mpl-data", "fonts", "afm")

FONTS = [
    ("HELVETICA", "phvr8a.afm"),
    ("HELVETICA_BOLD", "phvb8a.afm"),
    ("TIMES_ROMAN", "ptmr8a.afm"),
    ("TIMES_BOLD", "ptmb8a.afm"),
    ("COURIER", "pcrr8a.afm"),
    ("COURIER_BOLD", "pcrb8a.afm"),
]
EURO = {"HELVETICA": 556, "HELVETICA_BOLD": 556, "TIMES_ROMAN": 500, "TIMES_BOLD": 500, "COURIER": 600, "COURIER_BOLD": 600}


def afm_widths(fn):
    out = {}
    for line in open(os.path.join(AFM, fn), encoding="latin-1"):
        m = re.match(r"C\s+(-?\d+)\s*;\s*WX\s+(\d+)\s*;\s*N\s+(\S+)", line)
        if m:
            out[m.group(3)] = int(m.group(2))
    return out


def afm_codes(fn):
    out = {}
    for line in open(os.path.join(AFM, fn), encoding="latin-1"):
        m = re.match(r"C\s+(-?\d+)\s*;\s*WX\s+(\d+)\s*;\s*N\s+(\S+)", line)
        if m and int(m.group(1)) >= 0:
            out[int(m.group(1))] = m.group(3)
    return out


def gen_afm():
    out = [
        "// Generated from the Adobe standard-14 AFM metrics (WinAnsi codes 32..=255).",
        "// Width of 0 marks a code that has no glyph in WinAnsi (rendered as '?').",
        "// Do not edit by hand; see tools/gen_tables.py.",
        "",
    ]
    for name, fn in FONTS:
        w = afm_widths(fn)
        arr = []
        for code in range(32, 256):
            if code == 127:
                arr.append(0)
                continue
            if code == 128:  # Euro is missing from the old AFMs
                arr.append(EURO[name])
                continue
            try:
                ch = bytes([code]).decode("cp1252")
            except UnicodeDecodeError:
                arr.append(0)
                continue
            if code == 0xA0:
                gn = "space"
            elif code == 0xAD:
                gn = "hyphen"
            else:
                gn = agl.UV2AGL.get(ord(ch))
                if gn not in w:
                    alts = [n for n in w if agl.toUnicode(n) == ch]
                    gn = alts[0] if alts else None
            arr.append(w.get(gn, 0))
        out.append(f"pub const {name}: [u16; 224] = [")
        for i in range(0, 224, 16):
            out.append("    " + ", ".join(str(x) for x in arr[i : i + 16]) + ",")
        out.append("];")
        out.append("")
    open(os.path.join(SRC, "afm_data.rs"), "w").write("\n".join(out))


def uni(name):
    try:
        s = agl.toUnicode(name)
    except Exception:
        return 0
    return ord(s[0]) if len(s) == 1 else 0


def decode(codec, c):
    try:
        return ord(bytes([c]).decode(codec)[0])
    except Exception:
        return 0


def gen_enc():
    std = afm_codes("phvr8a.afm")
    standard = [uni(std[c]) if c in std else 0 for c in range(256)]
    sym = afm_codes("psyr.afm")
    symbol = [uni(sym[c]) if c in sym else 0 for c in range(256)]
    extra_sym = {"universal": 0x2200, "existential": 0x2203, "suchthat": 0x220B, "asteriskmath": 0x2217, "congruent": 0x2245, "Alpha": 0x391}
    for c, n in sym.items():
        if symbol[c] == 0 and n in extra_sym:
            symbol[c] = extra_sym[n]
    symbol[0xB7] = 0x2022
    win = [decode("cp1252", c) if c >= 32 else 0 for c in range(256)]
    win[0xA0] = 0x20
    win[0xAD] = 0x2D
    win[0x7F] = 0
    mac = [decode("mac_roman", c) if c >= 32 else 0 for c in range(256)]
    mac[0xCA] = 0x20
    mac[0x7F] = 0

    ranges = [(0x20, 0x7E), (0xA0, 0x24F), (0x2B0, 0x2FF), (0x370, 0x3FF), (0x400, 0x4FF), (0x2000, 0x206F), (0x20A0, 0x20CF),
              (0x2100, 0x214F), (0x2150, 0x218F), (0x2190, 0x21FF), (0x2200, 0x22FF), (0x25A0, 0x25FF), (0x2660, 0x266F),
              (0xFB00, 0xFB06), (0x1E00, 0x1EFF)]
    names = {}
    for n, ul in sorted(agl.LEGACY_AGL2UV.items()):
        if len(ul) != 1:
            continue
        u = ul[0]
        if any(a <= u <= b for a, b in ranges) and not re.match(r"^(a\d+|[A-Za-z]+\.\w+)$", n):
            names[n] = u
    for src in (std, sym):
        for n in src.values():
            u = uni(n)
            if u and n not in names:
                names[n] = u

    def arr(name, a):
        lines = [f"pub const {name}: [u16; 256] = ["]
        for i in range(0, 256, 16):
            lines.append("    " + ", ".join(f"0x{x:04X}" for x in a[i : i + 16]) + ",")
        lines.append("];")
        return "\n".join(lines)

    out = [
        "// Generated encoding tables (code -> Unicode scalar, 0 = undefined) and an",
        "// Adobe Glyph List subset (name=HEX;). Do not edit by hand; see tools/gen_tables.py.",
        "",
        arr("STANDARD", standard), "", arr("SYMBOL", symbol), "", arr("WINANSI", win), "", arr("MACROMAN", mac), "",
        'pub const GLYPH_NAMES: &str = "' + "".join(f"{n}={u:X};" for n, u in sorted(names.items())) + '";',
    ]
    open(os.path.join(SRC, "enc_data.rs"), "w").write("\n".join(out) + "\n")


if __name__ == "__main__":
    gen_afm()
    gen_enc()
