/** Raster image parsers: JPEG, PNG/APNG, GIF, WebP, TIFF, BMP, ICO, PSD. */
import { emitExif, findEntry, readTiff, type ExifData } from './exif';
import {
  emitIcc,
  emitIptc,
  emitPhotoshop,
  emitXmp,
  extractXmpPacket,
  parseIptc,
  parsePhotoshopResources,
} from './embedded';
import {
  type Ctx,
  MemReader,
  asciiBytes,
  bytesEq,
  concat,
  fmtNum,
  fourcc,
  indexOfBytes,
  inflateLimited,
  isoFromMs,
  latin1,
  readExact,
  textSmart,
  u16,
  u24,
  u32,
  u8,
  utf8,
} from './util';

// ---------------------------------------------------------------------------
// shared helpers
// ---------------------------------------------------------------------------

export function megapixels(w: number, h: number): string {
  return w * h < 10000 ? '' : `${fmtNum((w * h) / 1e6, 2)} MP`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function aspectRatio(w: number, h: number): string {
  if (!w || !h) return '';
  const g = gcd(w, h);
  const a = w / g;
  const b = h / g;
  return a <= 50 && b <= 50 ? `${a}:${b}` : fmtNum(w / h, 3);
}

/** Parse an embedded EXIF block and emit its sections; tolerant of failures. */
export async function handleExif(c: Ctx, tiff: Uint8Array, label = 'EXIF'): Promise<ExifData | null> {
  let data: ExifData | null = null;
  await c.out.attempt(label, async () => {
    data = await readTiff(new MemReader(tiff));
    emitExif(c.out, data);
    await handleExifEmbedded(c, data);
  });
  return data;
}

async function handleExifEmbedded(c: Ctx, d: ExifData): Promise<void> {
  if (d.embedded.xmp) {
    const pk = extractXmpPacket(d.embedded.xmp);
    if (pk) emitXmp(c.out, pk);
  }
  if (d.embedded.iptc) emitIptc(c.out, parseIptc(d.embedded.iptc));
  if (d.embedded.icc) emitIcc(c.out, d.embedded.icc);
  if (d.embedded.photoshop) {
    const ps = parsePhotoshopResources(d.embedded.photoshop);
    emitPhotoshop(c.out, ps);
    if (ps.iptc && !d.embedded.iptc) emitIptc(c.out, parseIptc(ps.iptc));
  }
}

// ---------------------------------------------------------------------------
// JPEG
// ---------------------------------------------------------------------------

const SOF_NAMES: Record<number, string> = {
  0xc0: 'baseline DCT', 0xc1: 'extended sequential DCT', 0xc2: 'progressive DCT', 0xc3: 'lossless',
  0xc5: 'differential sequential DCT', 0xc6: 'differential progressive DCT', 0xc7: 'differential lossless',
  0xc9: 'arithmetic-coded sequential', 0xca: 'arithmetic-coded progressive', 0xcb: 'arithmetic-coded lossless',
  0xcd: 'arithmetic-coded differential sequential', 0xce: 'arithmetic-coded differential progressive',
  0xcf: 'arithmetic-coded differential lossless',
};

function chromaSubsampling(comps: Array<{ h: number; v: number }>): string {
  if (comps.length < 3) return '';
  const y = comps[0];
  const cb = comps[1];
  if (!y || !cb) return '';
  const hr = y.h / cb.h;
  const vr = y.v / cb.v;
  if (hr === 1 && vr === 1) return '4:4:4';
  if (hr === 2 && vr === 1) return '4:2:2';
  if (hr === 2 && vr === 2) return '4:2:0';
  if (hr === 1 && vr === 2) return '4:4:0';
  if (hr === 4 && vr === 1) return '4:1:1';
  if (hr === 4 && vr === 2) return '4:1:0';
  return `${y.h}x${y.v} / ${cb.h}x${cb.v}`;
}

export async function parseJpeg(c: Ctx): Promise<void> {
  const { rd, out } = c;
  const img = out.section('image', 'Image');
  const segs: string[] = [];
  const comments: string[] = [];
  const iccParts: Array<{ seq: number; data: Uint8Array }> = [];
  let off = 2;
  let sof: { marker: number; precision: number; w: number; h: number; comps: Array<{ id: number; h: number; v: number }> } | null = null;
  let jfif: Uint8Array | null = null;
  let adobeTransform: number | null = null;
  let exifDone = false;
  let psData: Uint8Array | null = null;
  let guard = 0;
  let xmpPackets = 0;
  while (guard++ < 600) {
    const h = await rd.read(off, 4);
    if (h.length < 2) break;
    if (h[0] !== 0xff) {
      segs.push(`(unexpected byte 0x${u8(h, 0).toString(16)} at ${off})`);
      break;
    }
    const m = u8(h, 1);
    if (m === 0xff) {
      off += 1;
      continue;
    }
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7) || m === 0x00) {
      off += 2;
      continue;
    }
    if (m === 0xd9) {
      segs.push('EOI');
      break;
    }
    const len = u16(h, 2);
    if (len < 2) break;
    if (m === 0xda) {
      segs.push(`SOS (image data starts at byte ${off + 2 + len})`);
      break;
    }
    const plen = len - 2;
    const payload = await rd.read(off + 4, plen);
    const name = m >= 0xe0 && m <= 0xef ? `APP${m - 0xe0}` : m === 0xfe ? 'COM' : m === 0xdb ? 'DQT' : m === 0xc4 ? 'DHT' : m === 0xdd ? 'DRI' : m >= 0xc0 && m <= 0xcf ? `SOF${m - 0xc0}` : `0x${m.toString(16).toUpperCase()}`;
    let tag = '';
    if (m === 0xe0 && bytesEq(payload, 0, asciiBytes('JFIF\0'))) {
      tag = ' JFIF';
      jfif = payload.slice();
    } else if (m === 0xe0 && bytesEq(payload, 0, asciiBytes('JFXX\0'))) {
      tag = ' JFXX (thumbnail extension)';
    } else if (m === 0xe1 && bytesEq(payload, 0, asciiBytes('Exif\0'))) {
      tag = ' Exif';
      if (!exifDone) {
        exifDone = true;
        await handleExif(c, payload.slice(6));
      }
    } else if (m === 0xe1 && bytesEq(payload, 0, asciiBytes('http://ns.adobe.com/xap/1.0/\0'))) {
      tag = ' XMP';
      xmpPackets++;
      const pk = extractXmpPacket(payload.subarray(29));
      if (pk && xmpPackets === 1) await out.attempt('XMP', () => void emitXmp(out, pk));
    } else if (m === 0xe1 && bytesEq(payload, 0, asciiBytes('http://ns.adobe.com/xmp/extension/\0'))) {
      tag = ' Extended XMP';
      out.note('Extended XMP (additional XMP chunks) is present and was not merged.');
    } else if (m === 0xe2 && bytesEq(payload, 0, asciiBytes('ICC_PROFILE\0'))) {
      tag = ' ICC_PROFILE';
      iccParts.push({ seq: u8(payload, 12), data: payload.slice(14) });
    } else if (m === 0xe2 && bytesEq(payload, 0, asciiBytes('MPF\0'))) {
      tag = ' MPF (multi-picture)';
      out.note('Multi-Picture Format (MPF) data found: the file may contain additional embedded images (e.g. gain maps or previews).');
    } else if (m === 0xed && bytesEq(payload, 0, asciiBytes('Photoshop 3.0\0'))) {
      tag = ' Photoshop 3.0';
      psData = payload.slice(14);
    } else if (m === 0xee && bytesEq(payload, 0, asciiBytes('Adobe'))) {
      tag = ' Adobe';
      adobeTransform = u8(payload, 11);
    } else if (m === 0xeb && indexOfBytes(payload, asciiBytes('c2pa')) >= 0) {
      tag = ' JUMBF / C2PA';
      out.find('other', 'Content Credentials (C2PA)', 'A C2PA manifest is embedded (provenance / signing information).');
    } else if (m === 0xfe) {
      tag = ' comment';
      comments.push(textSmart(payload).replace(/\u0000+$/g, ''));
    } else if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      tag = ` SOF (${SOF_NAMES[m] ?? 'frame'})`;
      if (!sof && payload.length >= 6) {
        const n = u8(payload, 5);
        const comps: Array<{ id: number; h: number; v: number }> = [];
        for (let i = 0; i < n && 6 + i * 3 + 2 < payload.length + 1; i++) {
          const s = u8(payload, 7 + i * 3);
          comps.push({ id: u8(payload, 6 + i * 3), h: Math.max(1, s >> 4), v: Math.max(1, s & 15) });
        }
        sof = { marker: m, precision: u8(payload, 0), h: u16(payload, 1), w: u16(payload, 3), comps };
      }
    }
    segs.push(`${name}${tag} · ${len} B`);
    off += 2 + len;
  }

  if (sof) {
    const kind = SOF_NAMES[sof.marker] ?? 'JPEG';
    out.row(img, 'Format', `JPEG (${kind})`);
    out.row(img, 'Dimensions', `${sof.w} × ${sof.h} px`);
    out.row(img, 'Megapixels', megapixels(sof.w, sof.h));
    out.row(img, 'Aspect ratio', aspectRatio(sof.w, sof.h));
    const n = sof.comps.length;
    out.row(img, 'Bits per sample', String(sof.precision));
    out.row(img, 'Colour components', n === 1 ? '1 (grayscale)' : n === 3 ? '3 (YCbCr / RGB)' : n === 4 ? `4 (${adobeTransform === 2 ? 'YCCK' : 'CMYK'})` : String(n));
    const cs = chromaSubsampling(sof.comps);
    if (cs) out.row(img, 'Chroma subsampling', cs);
    out.row(img, 'Progressive', sof.marker === 0xc2 || sof.marker === 0xc6 || sof.marker === 0xca ? 'yes' : 'no');
  } else {
    out.errors.push('could not parse JPEG frame header: no SOF marker found before image data');
  }
  if (jfif && jfif.length >= 14) {
    const units = u8(jfif, 7);
    const xd = u16(jfif, 8);
    const yd = u16(jfif, 10);
    out.row(img, 'JFIF version', `${u8(jfif, 5)}.${String(u8(jfif, 6)).padStart(2, '0')}`);
    out.row(img, 'JFIF density', units === 1 ? `${xd} × ${yd} dpi` : units === 2 ? `${xd} × ${yd} dots/cm` : `${xd}:${yd} (aspect ratio only)`);
    const tw = u8(jfif, 12);
    const th = u8(jfif, 13);
    if (tw && th) out.row(img, 'JFIF thumbnail', `${tw} × ${th} px`);
  }
  if (comments.length > 0) {
    const sec = out.section('comments', 'JPEG comments');
    comments.forEach((t, i) => out.row(sec, comments.length > 1 ? `Comment ${i + 1}` : 'Comment', t));
    out.find('comments', 'JPEG comment', comments.join(' / '));
  }
  if (iccParts.length > 0) {
    iccParts.sort((a, b) => a.seq - b.seq);
    emitIcc(out, concat(iccParts.map((p) => p.data)));
  }
  if (psData) {
    const ps = parsePhotoshopResources(psData);
    emitPhotoshop(out, ps);
    if (ps.iptc) await out.attempt('IPTC', () => emitIptc(out, parseIptc(ps.iptc as Uint8Array)));
    if (ps.xmp && xmpPackets === 0) {
      const pk = extractXmpPacket(ps.xmp);
      if (pk) emitXmp(out, pk);
    }
  }
  const e = out.sections.find((s) => s.id === 'exif-ifd0');
  const orient = e?.rows.find((r) => r.k === 'Orientation');
  if (orient) out.row(img, 'Orientation (EXIF)', orient.v);
  if (!exifDone) out.note('No EXIF block found in this JPEG (it may have been stripped).');
  const sec = out.section('segments', 'JPEG segments', { collapsed: true });
  segs.slice(0, 60).forEach((s, i) => out.row(sec, String(i + 1), s));
  if (segs.length > 60) sec.note = `Showing 60 of ${segs.length} segments.`;
}

// ---------------------------------------------------------------------------
// PNG / APNG
// ---------------------------------------------------------------------------

const PNG_COLOR: Record<number, string> = {
  0: 'Grayscale', 2: 'Truecolour (RGB)', 3: 'Indexed (palette)', 4: 'Grayscale + alpha', 6: 'Truecolour + alpha (RGBA)',
};
const PNG_CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const PNG_INTENT = ['Perceptual', 'Relative colorimetric', 'Saturation', 'Absolute colorimetric'];

function nulIndex(b: Uint8Array, from = 0): number {
  for (let i = from; i < b.length; i++) if (b[i] === 0) return i;
  return -1;
}

async function pngInflate(data: Uint8Array): Promise<Uint8Array> {
  return inflateLimited(data, 'zlib', 4 * 1024 * 1024).out;
}

export async function parsePng(c: Ctx): Promise<void> {
  const { rd, out, size } = c;
  const img = out.section('image', 'Image');
  const text = out.section('png-text', 'PNG text chunks');
  const chunks: string[] = [];
  const other = new Map<string, number>();
  let off = 8;
  let idat = 0;
  let idatBytes = 0;
  let frames = 0;
  let fcTL = 0;
  let acTL: { frames: number; plays: number } | null = null;
  let guard = 0;
  let exifDone = false;
  let w = 0;
  let h = 0;
  let animDuration = 0;
  let ihdrColor = -1;
  while (off + 12 <= size && guard++ < 30000) {
    const hd = await rd.peek(off, 8);
    if (hd.length < 8) break;
    const len = u32(hd, 0);
    const type = fourcc(hd, 4);
    const next = off + 12 + len;
    if (type === 'IDAT') {
      idat++;
      idatBytes += len;
      off = next;
      continue;
    }
    if (type === 'fdAT') {
      off = next;
      continue;
    }
    const interesting = ['IHDR', 'PLTE', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT', 'bKGD', 'pHYs', 'tIME', 'tEXt', 'zTXt', 'iTXt', 'eXIf', 'acTL', 'fcTL', 'cICP', 'oFFs', 'caBX', 'orNT', 'mDCV', 'cLLI', 'IEND'];
    if (!interesting.includes(type)) {
      other.set(type, (other.get(type) ?? 0) + 1);
      chunks.push(`${type} · ${len} B`);
      off = next;
      continue;
    }
    chunks.push(`${type} · ${len} B`);
    if (len > 16 * 1024 * 1024 && type !== 'IEND') {
      off = next;
      continue;
    }
    const d = type === 'IEND' ? new Uint8Array(0) : await rd.read(off + 8, len);
    switch (type) {
      case 'IHDR': {
        w = u32(d, 0);
        h = u32(d, 4);
        const depth = u8(d, 8);
        const ct = u8(d, 9);
        ihdrColor = ct;
        out.row(img, 'Format', 'PNG');
        out.row(img, 'Dimensions', `${w} × ${h} px`);
        out.row(img, 'Megapixels', megapixels(w, h));
        out.row(img, 'Aspect ratio', aspectRatio(w, h));
        out.row(img, 'Colour type', `${PNG_COLOR[ct] ?? ct} (type ${ct})`);
        out.row(img, 'Bit depth', `${depth} bits per channel`);
        out.row(img, 'Bits per pixel', String(depth * (PNG_CHANNELS[ct] ?? 1)));
        out.row(img, 'Interlace', u8(d, 12) === 1 ? 'Adam7' : 'none');
        break;
      }
      case 'PLTE':
        out.row(img, 'Palette entries', String(Math.floor(len / 3)));
        break;
      case 'tRNS':
        out.row(img, 'Transparency chunk (tRNS)', ihdrColor === 3 ? 'palette alpha present' : 'present');
        break;
      case 'gAMA':
        out.row(img, 'Gamma', fmtNum(u32(d, 0) / 100000, 5));
        break;
      case 'cHRM':
        out.row(img, 'Chromaticities', `white ${fmtNum(u32(d, 0) / 100000, 4)},${fmtNum(u32(d, 4) / 100000, 4)}; R ${fmtNum(u32(d, 8) / 100000, 4)},${fmtNum(u32(d, 12) / 100000, 4)}; G ${fmtNum(u32(d, 16) / 100000, 4)},${fmtNum(u32(d, 20) / 100000, 4)}; B ${fmtNum(u32(d, 24) / 100000, 4)},${fmtNum(u32(d, 28) / 100000, 4)}`);
        break;
      case 'sRGB':
        out.row(img, 'sRGB rendering intent', PNG_INTENT[u8(d, 0)] ?? String(u8(d, 0)));
        break;
      case 'cICP':
        out.row(img, 'Colour coding (cICP)', `primaries ${u8(d, 0)}, transfer ${u8(d, 1)}, matrix ${u8(d, 2)}, ${u8(d, 3) ? 'full' : 'limited'} range`);
        break;
      case 'bKGD':
        out.row(img, 'Background colour chunk', 'present');
        break;
      case 'sBIT':
        out.row(img, 'Significant bits (sBIT)', Array.from(d).join(', '));
        break;
      case 'pHYs': {
        const px = u32(d, 0);
        const py = u32(d, 4);
        if (u8(d, 8) === 1) {
          out.row(img, 'Pixel density', `${px} × ${py} px/m (${fmtNum(px * 0.0254, 1)} × ${fmtNum(py * 0.0254, 1)} dpi)`);
        } else {
          out.row(img, 'Pixel aspect ratio', `${px}:${py}`);
        }
        break;
      }
      case 'oFFs':
        out.row(img, 'Image offset', `${u32(d, 0)}, ${u32(d, 4)} (${u8(d, 8) === 1 ? 'µm' : 'pixels'})`);
        break;
      case 'tIME': {
        const iso = isoFromMs(Date.UTC(u16(d, 0), u8(d, 2) - 1, u8(d, 3), u8(d, 4), u8(d, 5), u8(d, 6)));
        out.row(img, 'Last modified (tIME)', iso ?? 'invalid');
        break;
      }
      case 'acTL':
        acTL = { frames: u32(d, 0), plays: u32(d, 4) };
        break;
      case 'fcTL': {
        fcTL++;
        const num = u16(d, 20);
        const den = u16(d, 22) || 100;
        animDuration += num / den;
        break;
      }
      case 'caBX':
        out.find('other', 'Content Credentials (C2PA)', 'A C2PA manifest chunk (caBX) is embedded.');
        break;
      case 'iCCP': {
        const z = nulIndex(d);
        if (z >= 0) {
          const pname = latin1(d, 0, z);
          await out.attempt('ICC profile (iCCP)', async () => {
            const icc = await pngInflate(d.subarray(z + 2));
            out.row(img, 'ICC profile name', pname);
            emitIcc(out, icc);
          });
        }
        break;
      }
      case 'eXIf':
        if (!exifDone) {
          exifDone = true;
          await handleExif(c, d.slice(bytesEq(d, 0, asciiBytes('Exif\0\0')) ? 6 : 0));
        }
        break;
      case 'tEXt':
      case 'zTXt':
      case 'iTXt': {
        const z = nulIndex(d);
        if (z < 0) break;
        const key = latin1(d, 0, z);
        let value = '';
        await out.attempt(`PNG ${type} chunk "${key}"`, async () => {
          if (type === 'tEXt') {
            value = textSmart(d.subarray(z + 1));
          } else if (type === 'zTXt') {
            value = textSmart(await pngInflate(d.subarray(z + 2)));
          } else {
            const comp = u8(d, z + 1);
            const lz = nulIndex(d, z + 3);
            const tz = lz >= 0 ? nulIndex(d, lz + 1) : -1;
            if (lz < 0 || tz < 0) throw new Error('malformed iTXt');
            const body = d.subarray(tz + 1);
            value = utf8(comp ? await pngInflate(body) : body);
          }
        });
        value = value.replace(/\u0000+$/g, '');
        await handlePngText(c, text, key, value, type);
        break;
      }
      default:
        break;
    }
    off = next;
    if (type === 'IEND') break;
  }
  if (idat > 0) out.row(img, 'Image data', `${idat} IDAT chunk${idat === 1 ? '' : 's'} · ${idatBytes.toLocaleString('en-US')} bytes compressed`);
  if (acTL) {
    out.row(img, 'Animation (APNG)', `${acTL.frames} frames, ${acTL.plays === 0 ? 'loops forever' : `${acTL.plays} play${acTL.plays === 1 ? '' : 's'}`}`);
    if (fcTL > 0 && animDuration > 0) out.row(img, 'Animation duration', `${fmtNum(animDuration, 3)} s`);
    frames = acTL.frames;
  } else {
    out.row(img, 'Animation (APNG)', 'no');
  }
  void frames;
  if (!exifDone) out.note('No EXIF chunk (eXIf) found in this PNG.');
  if (other.size > 0) {
    const sec = out.section('png-other', 'Other PNG chunks', { collapsed: true });
    for (const [k, n] of other) out.row(sec, k, n > 1 ? `${n} chunks` : '1 chunk');
  }
  const cs = out.section('png-chunks', 'PNG chunk list', { collapsed: true });
  chunks.slice(0, 80).forEach((s, i) => out.row(cs, String(i + 1), s));
  if (chunks.length > 80) cs.note = `Showing 80 of ${chunks.length} chunks (IDAT chunks are summarised above).`;
}

async function handlePngText(c: Ctx, sec: import('./types').Section, key: string, value: string, type: string): Promise<void> {
  const out = c.out;
  const shown = value.length > 4000 ? `${value.slice(0, 4000)}… (${value.length} chars)` : value;
  if (/^XML:com\.adobe\.xmp$/i.test(key)) {
    const pk = extractXmpPacket(new TextEncoder().encode(value));
    if (pk) await out.attempt('XMP', () => void emitXmp(out, pk));
    out.row(sec, `${key} (${type})`, `${value.length.toLocaleString('en-US')} characters, see the XMP section`);
    return;
  }
  const raw = /^Raw profile type (.+)$/i.exec(key);
  if (raw) {
    const kind = (raw[1] ?? '').toLowerCase();
    out.row(sec, `${key} (${type})`, `ImageMagick-embedded ${kind} profile`);
    await out.attempt(`embedded ${kind} profile`, async () => {
      const m = /^\s*\S+\s+(\d+)\s+([0-9a-fA-F\s]+)$/.exec(value);
      if (!m) throw new Error('unrecognised profile layout');
      const hex = (m[2] ?? '').replace(/\s+/g, '');
      const bytes = new Uint8Array(Math.floor(hex.length / 2));
      for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      if (kind === 'exif' || kind === 'app1') {
        const body = bytesEq(bytes, 0, asciiBytes('Exif\0\0')) ? bytes.slice(6) : bytes;
        await handleExif(c, body);
      } else if (kind === 'iptc') {
        const ps = parsePhotoshopResources(bytes);
        emitIptc(out, parseIptc(ps.iptc ?? bytes));
      } else if (kind === 'xmp') {
        const pk = extractXmpPacket(bytes);
        if (pk) emitXmp(out, pk);
      } else if (kind === 'icc' || kind === 'icm') {
        emitIcc(out, bytes);
      }
    });
    return;
  }
  out.row(sec, `${key} (${type})`, shown);
  const k = key.toLowerCase();
  if (k === 'author' || k === 'artist' || k === 'creator') out.find('person', `PNG text "${key}"`, value);
  else if (k === 'software' || k === 'generator') out.find('software', `PNG text "${key}"`, value);
  else if (k === 'comment' || k === 'description' || k === 'disclaimer' || k === 'warning') out.find('comments', `PNG text "${key}"`, value.length > 200 ? `${value.slice(0, 200)}…` : value);
  else if (k === 'source') out.find('device', 'PNG text "Source"', value);
  else if (k === 'copyright') out.find('person', 'PNG text "Copyright"', value);
  const aiKey = k === 'parameters' || k === 'prompt' || k === 'workflow' || k === 'sd-metadata' || k === 'dream' || k === 'invokeai_metadata';
  if (aiKey || /\b(Steps|Sampler|CFG scale|Seed)\b:/.test(value)) {
    out.find('other', 'AI image-generation settings', `PNG text "${key}" holds generation parameters (prompt, seed, sampler, model…)`);
  }
}

// ---------------------------------------------------------------------------
// GIF
// ---------------------------------------------------------------------------

export async function parseGif(c: Ctx): Promise<void> {
  const { rd, out, size } = c;
  const img = out.section('image', 'Image');
  const hd = await readExact(rd, 0, 13);
  const version = latin1(hd, 0, 6);
  const w = u16(hd, 6, true);
  const h = u16(hd, 8, true);
  const flags = u8(hd, 10);
  const hasGct = (flags & 0x80) !== 0;
  const gctSize = hasGct ? 3 * (1 << ((flags & 7) + 1)) : 0;
  out.row(img, 'Format', `GIF (${version})`);
  out.row(img, 'Canvas size', `${w} × ${h} px`);
  out.row(img, 'Megapixels', megapixels(w, h));
  out.row(img, 'Global colour table', hasGct ? `${gctSize / 3} colours` : 'none');
  out.row(img, 'Colour resolution', `${((flags >> 4) & 7) + 1} bits`);
  const bgIndex = u8(hd, 11);
  if (hasGct) out.row(img, 'Background colour index', String(bgIndex));
  const par = u8(hd, 12);
  if (par) out.row(img, 'Pixel aspect ratio', fmtNum((par + 15) / 64, 3));

  const comments: string[] = [];
  const apps: string[] = [];
  let frames = 0;
  let delayCs = 0;
  let loops: number | null = null;
  let transparency = false;
  let interlaced = false;
  let localTables = 0;
  let off = 13 + gctSize;
  let bytesScanned = 0;
  const limit = Math.min(size, 128 * 1024 * 1024);
  const WIN = 1 << 20;
  let win: Uint8Array = new Uint8Array(0);
  let winStart = 0;
  const byteAt = async (o: number): Promise<number> => {
    if (o < winStart || o >= winStart + win.length) {
      win = await rd.read(o, WIN);
      winStart = o;
    }
    return win[o - winStart] ?? -1;
  };
  const readN = async (o: number, n: number): Promise<Uint8Array> => {
    if (o >= winStart && o + n <= winStart + win.length) return win.subarray(o - winStart, o - winStart + n);
    return rd.read(o, n);
  };
  // skip data sub-blocks, returning the position after the terminator and the concatenated data
  const subBlocks = async (o: number, keep: boolean): Promise<{ end: number; data: Uint8Array }> => {
    const parts: Uint8Array[] = [];
    let p = o;
    for (let i = 0; i < 1000000; i++) {
      const n = await byteAt(p);
      if (n < 0) return { end: limit + 1, data: concat(parts) };
      p++;
      if (n === 0) break;
      if (keep) parts.push((await readN(p, n)).slice());
      p += n;
    }
    return { end: p, data: concat(parts) };
  };
  let truncated = false;
  while (off < limit) {
    const b = await byteAt(off);
    if (b < 0) break;
    if (b === 0x3b) break;
    if (b === 0x21) {
      const label = await byteAt(off + 1);
      if (label === 0xf9) {
        const gc = await readN(off + 2, 6);
        const pf = u8(gc, 1);
        if (pf & 1) transparency = true;
        delayCs += u16(gc, 2, true);
        off += 8;
        const r = await subBlocks(off - 1, false);
        off = r.end;
      } else if (label === 0xfe) {
        const r = await subBlocks(off + 2, true);
        comments.push(textSmart(r.data));
        off = r.end;
      } else if (label === 0xff) {
        const idLen = await byteAt(off + 2);
        const id = await readN(off + 3, idLen);
        const appId = latin1(id, 0, 8);
        const auth = latin1(id, 8, 11);
        const r = await subBlocks(off + 3 + idLen, true);
        apps.push(`${appId}${auth}`.trim());
        if (appId === 'NETSCAPE' && u8(r.data, 0) === 1) loops = u16(r.data, 1, true);
        if (appId === 'XMP Data') {
          const pk = extractXmpPacket(r.data);
          if (pk) await out.attempt('XMP', () => void emitXmp(out, pk));
        }
        if (appId === 'ICCRGBG1') emitIcc(out, r.data);
        off = r.end;
      } else {
        const r = await subBlocks(off + 2, false);
        off = r.end;
      }
    } else if (b === 0x2c) {
      frames++;
      const idh = await readN(off + 1, 9);
      const lf = u8(idh, 8);
      if (lf & 0x40) interlaced = true;
      let p = off + 10;
      if (lf & 0x80) {
        p += 3 * (1 << ((lf & 7) + 1));
        localTables++;
      }
      p += 1; // LZW minimum code size
      const r = await subBlocks(p, false);
      off = r.end;
    } else {
      out.errors.push(`could not parse GIF block at byte ${off}: unexpected byte 0x${b.toString(16)}`);
      break;
    }
    bytesScanned = off;
    if (frames > 100000) {
      truncated = true;
      break;
    }
  }
  if (bytesScanned >= limit) truncated = true;
  out.row(img, 'Frames', `${frames}${truncated ? '+' : ''}`);
  out.row(img, 'Animated', frames > 1 ? 'yes' : 'no');
  if (frames > 1) {
    out.row(img, 'Total duration', `${fmtNum(delayCs / 100, 2)} s`);
    out.row(img, 'Loop count', loops === null ? 'plays once (no NETSCAPE extension)' : loops === 0 ? 'forever' : String(loops));
  }
  out.row(img, 'Transparency', transparency ? 'yes' : 'no');
  if (localTables > 0) out.row(img, 'Local colour tables', String(localTables));
  if (interlaced) out.row(img, 'Interlaced frames', 'yes');
  if (apps.length > 0) out.row(img, 'Application extensions', Array.from(new Set(apps)).join(', '));
  if (comments.length > 0) {
    const sec = out.section('gif-comments', 'GIF comments');
    comments.forEach((t, i) => out.row(sec, comments.length > 1 ? `Comment ${i + 1}` : 'Comment', t));
    out.find('comments', 'GIF comment', comments.join(' / '));
  }
}

// ---------------------------------------------------------------------------
// WebP
// ---------------------------------------------------------------------------

export async function parseWebp(c: Ctx): Promise<void> {
  const { rd, out, size } = c;
  const img = out.section('image', 'Image');
  out.row(img, 'Format', 'WebP');
  let off = 12;
  let guard = 0;
  let frames = 0;
  let duration = 0;
  let lossless: boolean | null = null;
  let width = 0;
  let height = 0;
  let canvasW = 0;
  let canvasH = 0;
  let alpha = false;
  let animated = false;
  let exifDone = false;
  let xmpDone = false;
  const present: string[] = [];
  while (off + 8 <= size && guard++ < 100000) {
    const hd = await rd.peek(off, 8);
    if (hd.length < 8) break;
    const tag = fourcc(hd, 0);
    const len = u32(hd, 4, true);
    const next = off + 8 + len + (len % 2);
    switch (tag) {
      case 'VP8X': {
        const d = await rd.read(off + 8, 10);
        const f = u8(d, 0);
        alpha = (f & 0x10) !== 0;
        animated = (f & 0x02) !== 0;
        canvasW = u24(d, 4, true) + 1;
        canvasH = u24(d, 7, true) + 1;
        present.push('VP8X');
        break;
      }
      case 'VP8 ': {
        const d = await rd.read(off + 8, 12);
        lossless = false;
        if (u8(d, 3) === 0x9d && u8(d, 4) === 0x01 && u8(d, 5) === 0x2a) {
          width = u16(d, 6, true) & 0x3fff;
          height = u16(d, 8, true) & 0x3fff;
        }
        break;
      }
      case 'VP8L': {
        const d = await rd.read(off + 8, 5);
        lossless = true;
        const v = u32(d, 1, true);
        width = (v & 0x3fff) + 1;
        height = ((v >> 14) & 0x3fff) + 1;
        if ((v >> 28) & 1) alpha = true;
        break;
      }
      case 'ALPH':
        alpha = true;
        break;
      case 'ANIM': {
        const d = await rd.read(off + 8, 6);
        const loop = u16(d, 4, true);
        out.row(img, 'Loop count', loop === 0 ? 'forever' : String(loop));
        const bg = `rgba(${u8(d, 2)}, ${u8(d, 1)}, ${u8(d, 0)}, ${fmtNum(u8(d, 3) / 255, 2)})`;
        out.row(img, 'Background colour', bg);
        break;
      }
      case 'ANMF': {
        frames++;
        const d = await rd.read(off + 8, 16);
        duration += u24(d, 12, true);
        break;
      }
      case 'ICCP':
        if (len < 8 * 1024 * 1024) emitIcc(out, (await rd.read(off + 8, len)).slice());
        break;
      case 'EXIF':
        if (!exifDone && len < 8 * 1024 * 1024) {
          exifDone = true;
          let d = (await rd.read(off + 8, len)).slice();
          if (bytesEq(d, 0, asciiBytes('Exif\0\0'))) d = d.slice(6);
          await handleExif(c, d);
        }
        break;
      case 'XMP ':
        if (!xmpDone && len < 8 * 1024 * 1024) {
          xmpDone = true;
          const d = await rd.read(off + 8, len);
          const pk = extractXmpPacket(d);
          if (pk) await out.attempt('XMP', () => void emitXmp(out, pk));
        }
        break;
      default:
        break;
    }
    if (tag !== 'ANMF' && tag !== 'VP8 ' && tag !== 'VP8L' && tag !== 'ALPH') present.push(tag.trim());
    off = next;
  }
  const w = canvasW || width;
  const h = canvasH || height;
  out.row(img, 'Dimensions', `${w} × ${h} px`);
  if (w && h) out.row(img, 'Megapixels', megapixels(w, h));
  out.row(img, 'Compression', lossless === null ? (animated ? 'per-frame' : 'unknown') : lossless ? 'lossless (VP8L)' : 'lossy (VP8)');
  out.row(img, 'Alpha channel', alpha ? 'yes' : 'no');
  out.row(img, 'Animated', animated ? `yes · ${frames} frame${frames === 1 ? '' : 's'}` : 'no');
  if (animated) out.row(img, 'Total duration', `${fmtNum(duration / 1000, 3)} s`);
  out.row(img, 'Chunks', Array.from(new Set(present)).join(', '));
  if (!exifDone) out.note('No EXIF chunk found in this WebP.');
}

// ---------------------------------------------------------------------------
// TIFF (also DNG and TIFF-based raw formats)
// ---------------------------------------------------------------------------

export async function parseTiffFile(c: Ctx): Promise<void> {
  const { rd, out, head } = c;
  const img = out.section('image', 'Image');
  const little = u8(head, 0) === 0x49;
  out.row(img, 'Byte order', little ? 'little-endian (II)' : 'big-endian (MM)');
  let data: ExifData | null = null;
  await out.attempt('TIFF structure', async () => {
    data = await readTiff(rd, { pages: true });
  });
  const d = data as ExifData | null;
  if (!d) return;
  const get = (tag: number) => findEntry(d, 'ifd0', tag);
  const wv = get(0x0100)?.raw.nums[0] ?? get(0xa002)?.raw.nums[0];
  const hv = get(0x0101)?.raw.nums[0] ?? get(0xa003)?.raw.nums[0];
  if (get(0xc612)) out.row(img, 'Format', `DNG (Digital Negative) — TIFF-based raw, version ${get(0xc612)?.raw.nums.join('.')}`);
  else out.row(img, 'Format', 'TIFF');
  if (wv && hv) {
    out.row(img, 'Dimensions (first page)', `${wv} × ${hv} px`);
    out.row(img, 'Megapixels', megapixels(wv, hv));
  }
  out.row(img, 'Pages / IFDs', String(d.pages));
  const bits = get(0x0102);
  if (bits) out.row(img, 'Bits per sample', bits.value);
  const comp = get(0x0103);
  if (comp) out.row(img, 'Compression', comp.value);
  const pi = get(0x0106);
  if (pi) out.row(img, 'Photometric', pi.value);
  const spp = get(0x0115);
  if (spp) out.row(img, 'Samples per pixel', spp.value);
  const xr = get(0x011a)?.raw.nums[0];
  const yr = get(0x011b)?.raw.nums[0];
  const ru = get(0x0128)?.value;
  if (xr && yr) out.row(img, 'Resolution', `${fmtNum(xr, 2)} × ${fmtNum(yr, 2)} ${ru === 'cm' ? 'px/cm' : ru === 'inches' ? 'dpi' : ''}`.trim());
  if (get(0x830e) || get(0x87af)) out.row(img, 'GeoTIFF', 'georeferencing tags present');
  emitExif(out, d, { prefix: 'TIFF' });
  await out.attempt('embedded metadata blocks', () => handleExifEmbedded(c, d));
  if (c.ext === 'dng' || get(0xc612)) c.refine({ id: 'tiff', name: 'DNG raw image (TIFF-based)', mime: 'image/x-adobe-dng', exts: ['dng', 'tif', 'tiff'], kind: 'image' });
}

// ---------------------------------------------------------------------------
// BMP / ICO / PSD
// ---------------------------------------------------------------------------

const BMP_COMP: Record<number, string> = {
  0: 'BI_RGB (none)', 1: 'BI_RLE8', 2: 'BI_RLE4', 3: 'BI_BITFIELDS', 4: 'BI_JPEG', 5: 'BI_PNG', 6: 'BI_ALPHABITFIELDS',
};

export async function parseBmp(c: Ctx): Promise<void> {
  const { rd, out } = c;
  const img = out.section('image', 'Image');
  const hd = await readExact(rd, 0, 54);
  const dib = u32(hd, 14, true);
  out.row(img, 'Format', 'BMP');
  out.row(img, 'Declared file size', `${u32(hd, 2, true).toLocaleString('en-US')} bytes`);
  out.row(img, 'Pixel data offset', String(u32(hd, 10, true)));
  out.row(img, 'DIB header', `${dib} bytes (${dib === 12 ? 'BITMAPCOREHEADER' : dib === 40 ? 'BITMAPINFOHEADER' : dib === 108 ? 'BITMAPV4HEADER' : dib === 124 ? 'BITMAPV5HEADER' : 'variant'})`);
  if (dib === 12) {
    out.row(img, 'Dimensions', `${u16(hd, 18, true)} × ${u16(hd, 20, true)} px`);
    out.row(img, 'Bits per pixel', String(u16(hd, 24, true)));
    return;
  }
  const w = u32(hd, 18, true) | 0;
  const h = u32(hd, 22, true) | 0;
  out.row(img, 'Dimensions', `${Math.abs(w)} × ${Math.abs(h)} px`);
  out.row(img, 'Row order', h < 0 ? 'top-down' : 'bottom-up');
  out.row(img, 'Megapixels', megapixels(Math.abs(w), Math.abs(h)));
  out.row(img, 'Bits per pixel', String(u16(hd, 28, true)));
  const comp = u32(hd, 30, true);
  out.row(img, 'Compression', BMP_COMP[comp] ?? String(comp));
  const xp = u32(hd, 38, true) | 0;
  const yp = u32(hd, 42, true) | 0;
  if (xp > 0 && yp > 0) out.row(img, 'Resolution', `${xp} × ${yp} px/m (${fmtNum(xp * 0.0254, 1)} × ${fmtNum(yp * 0.0254, 1)} dpi)`);
  const colours = u32(hd, 46, true);
  if (colours) out.row(img, 'Palette colours', String(colours));
}

export async function parseIco(c: Ctx): Promise<void> {
  const { rd, out } = c;
  const img = out.section('image', 'Icon');
  const hd = await readExact(rd, 0, 6);
  const type = u16(hd, 2, true);
  const n = Math.min(u16(hd, 4, true), 256);
  out.row(img, 'Format', type === 2 ? 'Windows cursor (CUR)' : 'Windows icon (ICO)');
  out.row(img, 'Images', String(n));
  const dir = await rd.read(6, n * 16);
  const sec = out.section('ico-images', 'Icon images');
  for (let i = 0; i < n; i++) {
    const e = i * 16;
    const w = u8(dir, e) || 256;
    const h = u8(dir, e + 1) || 256;
    const bpp = u16(dir, e + 6, true);
    const bytes = u32(dir, e + 8, true);
    const o = u32(dir, e + 12, true);
    const sig = await rd.read(o, 4);
    const isPng = bytesEq(sig, 0, [0x89, 0x50, 0x4e, 0x47]);
    out.row(sec, `Image ${i + 1}`, `${w} × ${h} px · ${bpp || '?'} bpp · ${bytes.toLocaleString('en-US')} bytes · ${isPng ? 'PNG' : 'BMP/DIB'}`);
  }
}

const PSD_MODES = ['Bitmap', 'Grayscale', 'Indexed', 'RGB', 'CMYK', '', '', 'Multichannel', 'Duotone', 'Lab'];

export async function parsePsd(c: Ctx): Promise<void> {
  const { rd, out, size } = c;
  const img = out.section('image', 'Image');
  const hd = await readExact(rd, 0, 26);
  const ver = u16(hd, 4);
  out.row(img, 'Format', ver === 2 ? 'PSB (Photoshop large document)' : 'PSD (Photoshop document)');
  out.row(img, 'Dimensions', `${u32(hd, 18)} × ${u32(hd, 14)} px`);
  out.row(img, 'Channels', String(u16(hd, 12)));
  out.row(img, 'Bit depth', `${u16(hd, 22)} bits per channel`);
  out.row(img, 'Colour mode', PSD_MODES[u16(hd, 24)] || String(u16(hd, 24)));
  const cm = u32(await readExact(rd, 26, 4), 0);
  const resOff = 30 + cm;
  const resLen = u32(await readExact(rd, resOff, 4), 0);
  if (resLen > 0 && resLen < 64 * 1024 * 1024 && resOff + 4 + resLen <= size) {
    const res = await rd.read(resOff + 4, resLen);
    const ps = parsePhotoshopResources(res);
    emitPhotoshop(out, ps);
    if (ps.iptc) await out.attempt('IPTC', () => emitIptc(out, parseIptc(ps.iptc as Uint8Array)));
    if (ps.xmp) {
      const pk = extractXmpPacket(ps.xmp);
      if (pk) await out.attempt('XMP', () => void emitXmp(out, pk));
    }
    if (ps.exif) await handleExif(c, ps.exif.slice(bytesEq(ps.exif, 0, asciiBytes('Exif\0\0')) ? 6 : 0));
  }
}

