/** ISO base media (MP4 / MOV / M4A / 3GP / HEIC / AVIF) and Matroska / WebM parsers. */
import { emitXmp, extractXmpPacket, emitIcc } from './embedded';
import { handleExif, megapixels } from './parsers-image';
import {
  type Collector,
  type Ctx,
  type Reader,
  clean,
  fmtBytes,
  fmtDuration,
  fmtNum,
  fourcc,
  f32,
  f64,
  i32,
  imageMime,
  isoFromMac,
  isoFromMs,
  latin1,
  toHex,
  u16,
  u32,
  u64,
  u8,
  utf16,
  utf8,
} from './util';

// ---------------------------------------------------------------------------
// Box walking
// ---------------------------------------------------------------------------

interface Box {
  type: string;
  start: number;
  hdr: number;
  size: number;
  /** Offset of the payload. */
  data: number;
  end: number;
}

async function readBoxAt(rd: Reader, off: number, limit: number): Promise<Box | null> {
  if (off + 8 > limit) return null;
  const h = await rd.peek(off, 32);
  if (h.length < 8) return null;
  let size = u32(h, 0);
  const type = fourcc(h, 4);
  let hdr = 8;
  if (size === 1) {
    size = u64(h, 8);
    hdr = 16;
  } else if (size === 0) {
    size = limit - off;
  }
  if (type === 'uuid') hdr += 16;
  if (size < hdr) return null;
  const end = Math.min(off + size, limit);
  return { type, start: off, hdr, size, data: off + hdr, end };
}

async function listBoxes(rd: Reader, start: number, end: number, max = 5000): Promise<Box[]> {
  const out: Box[] = [];
  let off = start;
  while (off + 8 <= end && out.length < max) {
    const b = await readBoxAt(rd, off, end);
    if (!b) break;
    out.push(b);
    if (b.end <= off) break;
    off = b.end;
  }
  return out;
}

async function boxBody(rd: Reader, b: Box, max = 64 * 1024 * 1024): Promise<Uint8Array> {
  return (await rd.read(b.data, Math.min(b.end - b.data, max))).slice();
}

/** Sync child listing from an in-memory body (offsets are relative to `body`). */
function memBoxes(body: Uint8Array, start = 0, end = body.length): Array<{ type: string; hdr: number; data: number; end: number }> {
  const out: Array<{ type: string; hdr: number; data: number; end: number }> = [];
  let off = start;
  while (off + 8 <= end && out.length < 5000) {
    let size = u32(body, off);
    const type = fourcc(body, off + 4);
    let hdr = 8;
    if (size === 1) {
      size = u64(body, off + 8);
      hdr = 16;
    } else if (size === 0) size = end - off;
    if (type === 'uuid') hdr += 16;
    if (size < hdr) break;
    const e = Math.min(off + size, end);
    out.push({ type, hdr, data: off + hdr, end: e });
    if (e <= off) break;
    off = e;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

const CODECS: Record<string, string> = {
  avc1: 'H.264 / AVC', avc3: 'H.264 / AVC', hvc1: 'H.265 / HEVC', hev1: 'H.265 / HEVC', dvh1: 'Dolby Vision (HEVC)', dvhe: 'Dolby Vision (HEVC)',
  av01: 'AV1', vp08: 'VP8', vp09: 'VP9', vvc1: 'H.266 / VVC', mp4v: 'MPEG-4 Visual', mjp2: 'Motion JPEG 2000', jpeg: 'Motion JPEG', 'jpg ': 'JPEG',
  apch: 'ProRes 422 HQ', apcn: 'ProRes 422', apcs: 'ProRes 422 LT', apco: 'ProRes 422 Proxy', ap4h: 'ProRes 4444', ap4x: 'ProRes 4444 XQ',
  mp4a: 'AAC / MPEG-4 audio', 'ac-3': 'Dolby Digital (AC-3)', 'ec-3': 'Dolby Digital Plus (E-AC-3)', alac: 'Apple Lossless (ALAC)', Opus: 'Opus', fLaC: 'FLAC',
  '.mp3': 'MP3', samr: 'AMR-NB', sawb: 'AMR-WB', twos: 'PCM (big-endian)', sowt: 'PCM (little-endian)', in24: 'PCM 24-bit', lpcm: 'Linear PCM', ipcm: 'Linear PCM',
  ulaw: 'µ-law', alaw: 'A-law', tx3g: '3GPP timed text', text: 'QuickTime text', c608: 'CEA-608 captions', c708: 'CEA-708 captions', tmcd: 'Timecode',
  mett: 'Timed metadata (text)', gpmd: 'GoPro telemetry (GPMF)', wvtt: 'WebVTT', stpp: 'TTML subtitles', rtmd: 'Sony real-time metadata', camm: 'Camera motion metadata',
};

const HANDLERS: Record<string, string> = {
  vide: 'video', soun: 'audio', text: 'text', sbtl: 'subtitle', subt: 'subtitle', clcp: 'closed captions', meta: 'metadata', tmcd: 'timecode', hint: 'hint', pict: 'picture', mdir: 'iTunes metadata', mdta: 'QuickTime metadata', gpmd: 'GoPro metadata', camm: 'camera metadata',
};

const AAC_AOT: Record<number, string> = {
  1: 'AAC Main', 2: 'AAC-LC', 3: 'AAC SSR', 4: 'AAC LTP', 5: 'HE-AAC (SBR)', 29: 'HE-AAC v2 (PS)', 23: 'ER AAC LD', 39: 'ER AAC ELD', 42: 'USAC (xHE-AAC)',
};
const AAC_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
const AVC_PROFILES: Record<number, string> = { 66: 'Baseline', 77: 'Main', 88: 'Extended', 100: 'High', 110: 'High 10', 122: 'High 4:2:2', 244: 'High 4:4:4 Predictive', 44: 'CAVLC 4:4:4', 118: 'Multiview High', 128: 'Stereo High' };
const HEVC_PROFILES: Record<number, string> = { 1: 'Main', 2: 'Main 10', 3: 'Main Still Picture', 4: 'Range Extensions', 9: 'Screen Content' };
const BRANDS: Record<string, string> = {
  isom: 'ISO base media v1', iso2: 'ISO base media v2', iso4: 'ISO base media v4', iso5: 'ISO base media v5', iso6: 'ISO base media v6', mp41: 'MP4 v1', mp42: 'MP4 v2',
  avc1: 'AVC', 'qt  ': 'QuickTime', 'M4A ': 'iTunes M4A audio', 'M4V ': 'iTunes M4V video', 'M4B ': 'iTunes audiobook', 'M4P ': 'iTunes protected audio',
  heic: 'HEIF (HEVC still)', heix: 'HEIF (HEVC extended)', mif1: 'HEIF image', msf1: 'HEIF sequence', avif: 'AVIF image', avis: 'AVIF sequence',
  '3gp4': '3GPP rel. 4', '3gp5': '3GPP rel. 5', '3gp6': '3GPP rel. 6', '3g2a': '3GPP2', 'dash': 'MPEG-DASH', 'cmfc': 'CMAF', 'crx ': 'Canon CR3', 'f4v ': 'Flash video',
  iso8: 'ISO base media v8', iso9: 'ISO base media v9', hevc: 'HEIF (HEVC sequence)', 'MSNV': 'Sony PSP/MP4', 'XAVC': 'Sony XAVC', '3g2b': '3GPP2',
};

function quicktimeLang(code: number): string {
  if (code === 0x7fff || code === 0) return 'und';
  const a = String.fromCharCode(((code >> 10) & 31) + 0x60, ((code >> 5) & 31) + 0x60, (code & 31) + 0x60);
  return /^[a-z]{3}$/.test(a) ? a : String(code);
}

function fixed1616(b: Uint8Array, o: number): number {
  return u32(b, o) / 65536;
}

/** ISO 6709 location string -> [lat, lon, alt?] */
export function parseIso6709(s: string): { lat: number; lon: number; alt: number | null } | null {
  const m = /^\s*([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)?/.exec(s);
  if (!m) return null;
  let lat = parseFloat(m[1] ?? '');
  let lon = parseFloat(m[2] ?? '');
  const alt = m[3] ? parseFloat(m[3]) : null;
  // ±DDMM.MMM / ±DDDMM.MMM forms
  if (Math.abs(lat) > 90 && /^[+-]\d{4}/.test(m[1] ?? '')) {
    const sign = lat < 0 ? -1 : 1;
    const a = Math.abs(lat);
    lat = sign * (Math.floor(a / 100) + (a % 100) / 60);
  }
  if (Math.abs(lon) > 180 && /^[+-]\d{5}/.test(m[2] ?? '')) {
    const sign = lon < 0 ? -1 : 1;
    const a = Math.abs(lon);
    lon = sign * (Math.floor(a / 100) + (a % 100) / 60);
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon, alt };
}

function osm(lat: number, lon: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lon.toFixed(6)}#map=16/${lat.toFixed(6)}/${lon.toFixed(6)}`;
}

function emitLocation(c: Collector, sec: import('./types').Section, label: string, raw: string): void {
  const loc = parseIso6709(raw);
  c.row(sec, label, raw);
  if (loc) {
    c.row(sec, `${label} (decimal)`, `${loc.lat.toFixed(6)}, ${loc.lon.toFixed(6)}${loc.alt !== null ? `, altitude ${fmtNum(loc.alt, 1)} m` : ''}`);
    c.row(sec, 'Map link (OpenStreetMap)', osm(loc.lat, loc.lon));
    c.find('gps', 'GPS location', `${loc.lat.toFixed(6)}, ${loc.lon.toFixed(6)}`);
  }
}

// ---------------------------------------------------------------------------
// Metadata atoms (udta / meta / ilst)
// ---------------------------------------------------------------------------

const ILST_NAMES: Record<string, string> = {
  '\xa9nam': 'Title', '\xa9ART': 'Artist', '\xa9alb': 'Album', '\xa9day': 'Year / date', '\xa9gen': 'Genre', '\xa9wrt': 'Composer', '\xa9too': 'Encoding tool',
  '\xa9cmt': 'Comment', '\xa9grp': 'Grouping', '\xa9lyr': 'Lyrics', '\xa9nrt': 'Narrator', '\xa9pub': 'Publisher', '\xa9con': 'Conductor', '\xa9dir': 'Director',
  '\xa9mak': 'Make', '\xa9mod': 'Model', '\xa9swr': 'Software', '\xa9xyz': 'GPS location', '\xa9cpy': 'Copyright', '\xa9enc': 'Encoded by', '\xa9des': 'Description',
  '\xa9prd': 'Producer', '\xa9prf': 'Performers', '\xa9src': 'Source', '\xa9st3': 'Subtitle', '\xa9aut': 'Author', '\xa9inf': 'Information', '\xa9req': 'Requirements',
  '\xa9fmt': 'Format', '\xa9ope': 'Original artist', '\xa9wrn': 'Warning', '\xa9sne': 'Sound engineer', '\xa9mvn': 'Movement name', '\xa9mvi': 'Movement number',
  aART: 'Album artist', cprt: 'Copyright', desc: 'Description', ldes: 'Long description', trkn: 'Track', disk: 'Disc', tmpo: 'BPM', cpil: 'Compilation', gnre: 'Genre (ID3v1 index)',
  covr: 'Cover art', pgap: 'Gapless playback', stik: 'Media kind', rtng: 'Content rating', sonm: 'Sort title', soar: 'Sort artist', soaa: 'Sort album artist', soal: 'Sort album',
  soco: 'Sort composer', tvsh: 'TV show', tvnn: 'TV network', tven: 'TV episode ID', tvsn: 'TV season', tves: 'TV episode', purd: 'Purchase date', ownr: 'Owner', apID: 'Apple ID (account)',
  atID: 'Artist ID', cnID: 'Catalog ID', plID: 'Playlist ID', geID: 'Genre ID', sfID: 'Store front ID', cmID: 'Composer ID', xid: 'Vendor ID', purl: 'Podcast URL', egid: 'Podcast episode GUID',
  catg: 'Podcast category', keyw: 'Keywords', hdvd: 'HD video', shwm: 'Show work/movement', '\xa9wrk': 'Work name',
};

const STIK: Record<number, string> = { 0: 'Movie', 1: 'Music', 2: 'Audiobook', 6: 'Music video', 9: 'Movie', 10: 'TV show', 11: 'Booklet', 14: 'Ringtone', 21: 'Podcast' };

function decodeDataBox(body: Uint8Array, start: number, end: number): { kind: 'text' | 'image' | 'int' | 'float' | 'bytes'; text: string; bytes: Uint8Array; mime?: string } {
  const type = u32(body, start) & 0xffffff;
  const v = body.subarray(start + 8, end);
  switch (type) {
    case 1:
      return { kind: 'text', text: utf8(v).replace(/\u0000+$/, ''), bytes: v };
    case 2:
      return { kind: 'text', text: utf16(v, false), bytes: v };
    case 13:
      return { kind: 'image', text: '', bytes: v, mime: 'image/jpeg' };
    case 14:
      return { kind: 'image', text: '', bytes: v, mime: 'image/png' };
    case 21:
    case 22: {
      let n = 0;
      let isSigned = type === 21;
      for (let i = 0; i < v.length && i < 8; i++) n = n * 256 + (v[i] ?? 0);
      if (isSigned && v.length > 0 && v.length <= 4 && (v[0] ?? 0) >= 0x80) n -= Math.pow(2, 8 * v.length);
      isSigned = false;
      return { kind: 'int', text: String(n), bytes: v };
    }
    case 23:
      return { kind: 'float', text: String(fmtNum(f32(v, 0), 4)), bytes: v };
    case 24:
      return { kind: 'float', text: String(fmtNum(f64(v, 0), 6)), bytes: v };
    default: {
      const printable = v.length > 0 && v.every((x) => x === 0 || (x >= 9 && x < 127) || x >= 0xc2);
      return { kind: printable ? 'text' : 'bytes', text: printable ? utf8(v).replace(/\u0000+$/, '') : toHex(v.subarray(0, 24)), bytes: v };
    }
  }
}

function ilstItem(c: Collector, sec: import('./types').Section, name: string, label: string, d: ReturnType<typeof decodeDataBox>, coverCount: { n: number }): void {
  if (d.kind === 'image') {
    coverCount.n++;
    const mime = imageMime(d.bytes) ?? d.mime ?? 'image/jpeg';
    c.row(sec, `${label} ${coverCount.n}`, `${mime} · ${d.bytes.length.toLocaleString('en-US')} bytes`);
    if (coverCount.n <= 4) c.preview('Embedded cover art', mime, d.bytes.slice());
    return;
  }
  let text = d.text;
  if (name === 'trkn' && d.bytes.length >= 6) text = `${u16(d.bytes, 2)}${u16(d.bytes, 4) ? ` of ${u16(d.bytes, 4)}` : ''}`;
  else if (name === 'disk' && d.bytes.length >= 6) text = `${u16(d.bytes, 2)}${u16(d.bytes, 4) ? ` of ${u16(d.bytes, 4)}` : ''}`;
  else if (name === 'gnre' && d.bytes.length >= 2) text = `${u16(d.bytes, 0)}`;
  else if (name === 'stik') text = STIK[parseInt(d.text, 10)] ?? d.text;
  else if (name === 'cpil' || name === 'pgap' || name === 'hdvd') text = d.text === '0' ? 'no' : 'yes';
  if (name === '\xa9xyz' || /location\.ISO6709$/.test(label)) emitLocation(c, sec, label, text);
  else c.row(sec, label, text.length > 3000 ? `${text.slice(0, 3000)}… (${text.length} chars)` : text);
  if (name === 'apID' && text) c.find('person', 'Apple ID of the purchaser (apID)', text);
  else if (name === 'ownr' && text) c.find('person', 'Owner / purchaser name (ownr)', text);
  else if (name === 'purd' && text) c.find('other', 'Purchase date (purd)', text);
  else if (name === '\xa9too' || name === '\xa9swr' || name === '\xa9enc') c.find('software', label, text);
  else if (name === '\xa9mak' || name === '\xa9mod') c.find('device', label, text);
  else if (name === '\xa9aut' || name === '\xa9wrt' || name === '\xa9prd') c.find('person', label, text);
  else if (name === '\xa9cmt' || name === '\xa9des') c.find('comments', label, text.length > 200 ? `${text.slice(0, 200)}…` : text);
}

const QT_KEY_LABELS: Record<string, string> = {
  'com.apple.quicktime.make': 'Make', 'com.apple.quicktime.model': 'Model', 'com.apple.quicktime.software': 'Software',
  'com.apple.quicktime.location.ISO6709': 'GPS location (ISO 6709)', 'com.apple.quicktime.creationdate': 'Creation date (local)',
  'com.apple.quicktime.author': 'Author', 'com.apple.quicktime.displayname': 'Display name', 'com.apple.quicktime.description': 'Description',
  'com.apple.quicktime.comment': 'Comment', 'com.apple.quicktime.title': 'Title', 'com.apple.quicktime.artist': 'Artist', 'com.apple.quicktime.album': 'Album',
  'com.apple.quicktime.copyright': 'Copyright', 'com.apple.quicktime.location.name': 'Location name', 'com.apple.quicktime.location.body': 'Location body',
  'com.apple.quicktime.location.note': 'Location note', 'com.apple.quicktime.location.role': 'Location role', 'com.apple.quicktime.location.date': 'Location date',
  'com.apple.quicktime.direction.facing': 'Direction facing', 'com.apple.quicktime.direction.motion': 'Direction of motion',
  'com.apple.quicktime.content.identifier': 'Content identifier (Live Photo pair)', 'com.apple.quicktime.live-photo.auto': 'Live Photo auto',
  'com.apple.quicktime.live-photo.vitality-score': 'Live Photo vitality score', 'com.android.version': 'Android version', 'com.android.capture.fps': 'Capture frame rate',
  'com.apple.quicktime.full-frame-rate-playback-intent': 'Full frame rate playback intent', 'com.apple.quicktime.camera.identifier': 'Camera identifier',
  'com.apple.quicktime.camera.lensmodel': 'Lens model', 'com.apple.quicktime.camera.framereadouttimeinmicroseconds': 'Frame readout time (µs)',
};

async function parseMetaBox(c: Ctx, meta: { data: number; end: number }, body: Uint8Array, base: number, sec: import('./types').Section, hdlrOut: { value: string }): Promise<void> {
  // body[base..] is the payload of a 'meta' box (full box, but QuickTime may omit the version/flags word)
  let p = base;
  const maybeFull = u32(body, p) === 0;
  if (maybeFull) p += 4;
  const kids = memBoxes(body, p, base + (meta.end - meta.data));
  let keys: string[] = [];
  const covers = { n: 0 };
  for (const k of kids) {
    if (k.type === 'hdlr') hdlrOut.value = fourcc(body, k.data + 8);
    else if (k.type === 'keys') {
      const n = u32(body, k.data + 4);
      let q = k.data + 8;
      keys = [];
      for (let i = 0; i < n && q + 8 <= k.end; i++) {
        const ks = u32(body, q);
        keys.push(utf8(body.subarray(q + 8, q + ks)));
        q += ks;
      }
    }
  }
  for (const k of kids) {
    if (k.type !== 'ilst') continue;
    for (const item of memBoxes(body, k.data, k.end)) {
      const kids2 = memBoxes(body, item.data, item.end);
      const dataBox = kids2.find((x) => x.type === 'data');
      if (!dataBox) {
        // plain QuickTime key item without data wrapper, or malformed
        continue;
      }
      const d = decodeDataBox(body, dataBox.data, dataBox.end);
      let name = item.type;
      let label: string;
      if (keys.length > 0 && hdlrOut.value === 'mdta') {
        const idx = u32(body, item.data - item.hdr + 4);
        const key = keys[idx - 1] ?? `key ${idx}`;
        name = key;
        label = QT_KEY_LABELS[key] ?? key;
        if (key === 'com.apple.quicktime.location.ISO6709' || (/location/i.test(key) && parseIso6709(d.text))) {
          emitLocation(c.out, sec, key === 'com.apple.quicktime.location.ISO6709' ? 'GPS location (ISO 6709)' : `GPS location (${key})`, d.text);
          continue;
        }
        if (/make$|model$|software$/.test(key)) c.out.find(/software/.test(key) ? 'software' : 'device', `Apple QuickTime ${label.toLowerCase()}`, d.text);
        else if (/author$/.test(key)) c.out.find('person', 'QuickTime author', d.text);
        else if (/comment$|description$/.test(key)) c.out.find('comments', label, d.text);
        ilstItem(c.out, sec, name, label, d, covers);
        // (ilstItem also adds findings by type name; keys never match those names)
        continue;
      }
      if (item.type === '----') {
        const mean = kids2.find((x) => x.type === 'mean');
        const nm = kids2.find((x) => x.type === 'name');
        const meanS = mean ? utf8(body.subarray(mean.data + 4, mean.end)) : '';
        const nameS = nm ? utf8(body.subarray(nm.data + 4, nm.end)) : '';
        label = `Custom: ${nameS || '?'}${meanS ? ` (${meanS})` : ''}`;
        ilstItem(c.out, sec, '----', label, d, covers);
        continue;
      }
      label = ILST_NAMES[name] ?? name.replace(/\xa9/g, '©');
      ilstItem(c.out, sec, name, label, d, covers);
    }
  }
}

function textAtom(b: Uint8Array, s: number, e: number): string {
  // QuickTime user-data text: u16 length, u16 language, text
  const len = u16(b, s);
  if (len > 0 && s + 4 + len <= e + 1) return clean(utf8(b.subarray(s + 4, s + 4 + len)).replace(/\u0000+$/, ''));
  return clean(utf8(b.subarray(s + 4, e)).replace(/\u0000+$/, ''));
}

async function parseUdta(c: Ctx, body: Uint8Array, start: number, end: number, sec: import('./types').Section): Promise<void> {
  const out = c.out;
  for (const k of memBoxes(body, start, end)) {
    const t = k.type;
    if (t === 'meta') {
      const hd = { value: '' };
      await out.attempt('iTunes / QuickTime metadata (meta)', () => parseMetaBox(c, { data: k.data, end: k.end }, body, k.data, sec, hd));
    } else if (t === '\xa9xyz') {
      const text = textAtom(body, k.data, k.end);
      emitLocation(out, sec, 'GPS location (©xyz)', text);
    } else if (t.charCodeAt(0) === 0xa9) {
      const label = ILST_NAMES[t] ?? t.replace('\xa9', '©');
      const text = textAtom(body, k.data, k.end);
      if (text) {
        out.row(sec, label, text);
        if (t === '\xa9mak' || t === '\xa9mod') out.find('device', label, text);
        else if (t === '\xa9swr' || t === '\xa9too') out.find('software', label, text);
        else if (t === '\xa9aut' || t === '\xa9prd' || t === '\xa9wrt') out.find('person', label, text);
        else if (t === '\xa9cmt' || t === '\xa9inf' || t === '\xa9des') out.find('comments', label, text);
      }
    } else if (['titl', 'auth', 'perf', 'dscp', 'cprt', 'albm', 'kywd', 'gnre', 'clsf'].includes(t)) {
      const names: Record<string, string> = { titl: 'Title', auth: 'Author', perf: 'Performer', dscp: 'Description', cprt: 'Copyright', albm: 'Album', kywd: 'Keywords', gnre: 'Genre', clsf: 'Classification' };
      const raw = body.subarray(k.data + 6, k.end);
      const text = (raw[0] === 0xfe && raw[1] === 0xff ? utf16(raw, false, 2) : utf8(raw)).replace(/\u0000+$/, '');
      if (text) {
        out.row(sec, `${names[t]} (3GPP)`, text);
        if (t === 'auth') out.find('person', 'Author (3GPP)', text);
      }
    } else if (t === 'FIRM' || t === 'LENS' || t === 'CAME' || t === 'MUID') {
      const text = t === 'CAME' || t === 'MUID' ? toHex(body.subarray(k.data, k.end)) : utf8(body.subarray(k.data, k.end)).replace(/\u0000+$/, '');
      const names: Record<string, string> = { FIRM: 'GoPro firmware', LENS: 'GoPro lens', CAME: 'GoPro camera serial hash', MUID: 'GoPro media unique ID' };
      out.row(sec, names[t] ?? t, text);
      if (t === 'CAME') out.find('device', 'GoPro camera identifier', text);
      if (t === 'FIRM') out.find('device', 'GoPro firmware', text);
    } else if (t === 'loci') {
      // 3GPP location information box
      let p = k.data + 6;
      let nameEnd = p;
      const utf16Name = u8(body, p) === 0xfe && u8(body, p + 1) === 0xff;
      if (utf16Name) while (nameEnd + 1 < k.end && !(body[nameEnd] === 0 && body[nameEnd + 1] === 0)) nameEnd += 2;
      else while (nameEnd < k.end && body[nameEnd] !== 0) nameEnd++;
      const name = utf16Name ? utf16(body, false, p + 2, nameEnd) : utf8(body.subarray(p, nameEnd));
      p = nameEnd + (utf16Name ? 2 : 1);
      const role = u8(body, p);
      const lon = i32(body, p + 1) / 65536;
      const lat = i32(body, p + 5) / 65536;
      const alt = i32(body, p + 9) / 65536;
      if (name) out.row(sec, 'Location name (3GPP loci)', name);
      out.row(sec, 'Location role', ['shooting location', 'real location', 'fictional location'][role] ?? String(role));
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0)) {
        out.row(sec, 'GPS location (3GPP loci)', `${lat.toFixed(5)}, ${lon.toFixed(5)}${alt ? `, altitude ${fmtNum(alt, 1)} m` : ''}`);
        out.row(sec, 'Map link (OpenStreetMap)', osm(lat, lon));
        out.find('gps', 'GPS location', `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Track + sample description parsing
// ---------------------------------------------------------------------------

interface TrackInfo {
  id: number;
  handler: string;
  handlerName: string;
  codec: string;
  codecDesc: string;
  width: number;
  height: number;
  displayW: number;
  displayH: number;
  rotation: number;
  duration: number | null;
  timescale: number;
  language: string;
  created: string | null;
  modified: string | null;
  sampleRate: number;
  channels: number;
  bits: number;
  frames: number | null;
  fps: number | null;
  bitrate: number | null;
  extra: string[];
  enabled: boolean;
}

function esdsInfo(b: Uint8Array, start: number, end: number): { desc: string; bitrate: number | null } | null {
  let p = start + 4; // version/flags
  const readLen = (): number => {
    let len = 0;
    for (let i = 0; i < 4; i++) {
      const x = u8(b, p++);
      len = (len << 7) | (x & 0x7f);
      if (!(x & 0x80)) break;
    }
    return len;
  };
  if (u8(b, p) !== 0x03) return null;
  p++;
  readLen();
  p += 2;
  const fl = u8(b, p++);
  if (fl & 0x80) p += 2;
  if (fl & 0x40) p += 1 + u8(b, p);
  if (fl & 0x20) p += 2;
  if (u8(b, p) !== 0x04) return null;
  p++;
  readLen();
  const oti = u8(b, p);
  const avg = u32(b, p + 9);
  const max = u32(b, p + 5);
  p += 13;
  const parts: string[] = [];
  const otiNames: Record<number, string> = { 0x40: 'MPEG-4 AAC', 0x66: 'MPEG-2 AAC Main', 0x67: 'MPEG-2 AAC LC', 0x69: 'MPEG-2 audio', 0x6b: 'MP3', 0x20: 'MPEG-4 Visual', 0x21: 'AVC', 0x6c: 'JPEG', 0xdd: 'Vorbis' };
  if (otiNames[oti]) parts.push(otiNames[oti] as string);
  if (u8(b, p) === 0x05 && p < end) {
    p++;
    readLen();
    let aot = u8(b, p) >> 3;
    let bitPos = 5;
    const bits = (n: number): number => {
      let v = 0;
      for (let i = 0; i < n; i++) {
        const byte = u8(b, p + ((bitPos + i) >> 3));
        v = (v << 1) | ((byte >> (7 - ((bitPos + i) & 7))) & 1);
      }
      bitPos += n;
      return v;
    };
    if (aot === 31) aot = 32 + bits(6);
    const sfi = bits(4);
    const rate = sfi === 15 ? bits(24) : (AAC_RATES[sfi] ?? 0);
    const ch = bits(4);
    parts.push(AAC_AOT[aot] ?? `AOT ${aot}`);
    if (rate) parts.push(`${rate} Hz`);
    if (ch) parts.push(`${ch} ch`);
  }
  return { desc: parts.join(', '), bitrate: avg || max || null };
}

function parseSampleEntry(body: Uint8Array, entryStart: number, entryEnd: number, tr: TrackInfo): void {
  const codec = fourcc(body, entryStart + 4);
  tr.codec = codec;
  tr.codecDesc = CODECS[codec] ?? '';
  const d = entryStart + 16; // after size, type, 6 reserved, data ref index
  let childStart: number;
  if (tr.handler === 'vide' || tr.handler === 'pict' || tr.handler === 'auxv') {
    tr.width = u16(body, d + 16);
    tr.height = u16(body, d + 18);
    const nameLen = u8(body, d + 34);
    const name = utf8(body.subarray(d + 35, d + 35 + Math.min(nameLen, 31)));
    if (name) tr.extra.push(`Encoder name: ${name}`);
    tr.bits = u16(body, d + 66);
    childStart = d + 70;
  } else if (tr.handler === 'soun') {
    const ver = u16(body, d);
    tr.channels = u16(body, d + 8);
    tr.bits = u16(body, d + 10);
    tr.sampleRate = fixed1616(body, d + 16);
    childStart = d + 20 + (ver === 1 ? 16 : ver === 2 ? 36 : 0);
    if (ver === 2) {
      tr.sampleRate = f64(body, d + 32);
      tr.channels = u32(body, d + 40);
    }
  } else {
    return;
  }
  for (const k of memBoxes(body, childStart, entryEnd)) {
    if (k.type === 'avcC') {
      const prof = u8(body, k.data + 1);
      const level = u8(body, k.data + 3);
      tr.extra.push(`Profile: ${AVC_PROFILES[prof] ?? prof} @ L${(level / 10).toFixed(1)}`);
    } else if (k.type === 'hvcC') {
      const prof = u8(body, k.data + 1) & 31;
      const tier = (u8(body, k.data + 1) >> 5) & 1;
      const level = u8(body, k.data + 12);
      tr.extra.push(`Profile: ${HEVC_PROFILES[prof] ?? prof}${tier ? ' High tier' : ''} @ L${fmtNum(level / 30, 1)}`);
    } else if (k.type === 'av1C') {
      const prof = u8(body, k.data + 1) >> 5;
      const level = u8(body, k.data + 1) & 31;
      tr.extra.push(`Profile: ${['Main', 'High', 'Professional'][prof] ?? prof}, level ${2 + (level >> 2)}.${level & 3}`);
    } else if (k.type === 'colr' && fourcc(body, k.data) === 'nclx') {
      tr.extra.push(`Colour: primaries ${u16(body, k.data + 4)}, transfer ${u16(body, k.data + 6)}, matrix ${u16(body, k.data + 8)}, ${u8(body, k.data + 10) & 0x80 ? 'full' : 'limited'} range`);
    } else if (k.type === 'pasp') {
      const h = u32(body, k.data);
      const v = u32(body, k.data + 4);
      if (h && v && h !== v) tr.extra.push(`Pixel aspect ratio: ${h}:${v}`);
    } else if (k.type === 'btrt') {
      const avg = u32(body, k.data + 8);
      if (avg) tr.bitrate = avg;
    } else if (k.type === 'esds') {
      const info = esdsInfo(body, k.data, k.end);
      if (info) {
        if (info.desc) tr.extra.push(`Audio config: ${info.desc}`);
        if (info.bitrate) tr.bitrate = info.bitrate;
      }
    } else if (k.type === 'dOps') {
      tr.extra.push(`Opus: ${u8(body, k.data + 1)} channel(s), input rate ${u32(body, k.data + 4)} Hz`);
    } else if (k.type === 'dac3') {
      tr.extra.push('Dolby Digital config box present');
    } else if (k.type === 'fiel') {
      tr.extra.push(`Field order: ${u8(body, k.data) === 1 ? 'progressive' : 'interlaced'}`);
    } else if (k.type === 'dvcC' || k.type === 'dvvC') {
      tr.extra.push(`Dolby Vision profile ${u8(body, k.data + 2) >> 1}, level ${((u8(body, k.data + 2) & 1) << 5) | (u8(body, k.data + 3) >> 3)}`);
    }
  }
}

async function parseTrak(rd: Reader, trak: Box, mvTimescale: number): Promise<TrackInfo> {
  const body = await boxBody(rd, trak, 48 * 1024 * 1024).catch(() => new Uint8Array(0));
  const tr: TrackInfo = {
    id: 0, handler: '', handlerName: '', codec: '', codecDesc: '', width: 0, height: 0, displayW: 0, displayH: 0, rotation: 0,
    duration: null, timescale: 0, language: '', created: null, modified: null, sampleRate: 0, channels: 0, bits: 0, frames: null, fps: null, bitrate: null, extra: [], enabled: true,
  };
  // The sample table can be huge; trak bodies over the cap were truncated, which is fine for stsd/stts at the front.
  const find = (parent: { data: number; end: number }, type: string) => memBoxes(body, parent.data, parent.end).find((b) => b.type === type);
  const root = { data: 0, end: body.length };
  const tkhd = find(root, 'tkhd');
  if (tkhd) {
    const v = u8(body, tkhd.data);
    const o = tkhd.data;
    tr.enabled = (u32(body, o) & 1) !== 0;
    const base = v === 1 ? 20 : 12;
    tr.id = u32(body, o + (v === 1 ? 20 : 12));
    const dur = v === 1 ? u64(body, o + 28) : u32(body, o + 20);
    tr.duration = mvTimescale ? dur / mvTimescale : null;
    const mo = o + (v === 1 ? 52 : 40);
    const a = i32(body, mo) / 65536;
    const b = i32(body, mo + 4) / 65536;
    const deg = Math.round((Math.atan2(b, a) * 180) / Math.PI);
    tr.rotation = ((deg % 360) + 360) % 360;
    tr.displayW = fixed1616(body, o + (v === 1 ? 88 : 76));
    tr.displayH = fixed1616(body, o + (v === 1 ? 92 : 80));
    void base;
    tr.created = isoFromMac(v === 1 ? u64(body, o + 4) : u32(body, o + 4));
    tr.modified = isoFromMac(v === 1 ? u64(body, o + 12) : u32(body, o + 8));
  }
  const mdia = find(root, 'mdia');
  if (mdia) {
    const mdhd = find(mdia, 'mdhd');
    if (mdhd) {
      const v = u8(body, mdhd.data);
      const o = mdhd.data;
      tr.timescale = u32(body, o + (v === 1 ? 20 : 12));
      const dur = v === 1 ? u64(body, o + 24) : u32(body, o + 16);
      if (tr.timescale) tr.duration = dur / tr.timescale;
      tr.language = quicktimeLang(u16(body, o + (v === 1 ? 32 : 20)));
      tr.created = isoFromMac(v === 1 ? u64(body, o + 4) : u32(body, o + 4)) ?? tr.created;
      tr.modified = isoFromMac(v === 1 ? u64(body, o + 12) : u32(body, o + 8)) ?? tr.modified;
    }
    const hdlr = find(mdia, 'hdlr');
    if (hdlr) {
      tr.handler = fourcc(body, hdlr.data + 8);
      const nameBytes = body.subarray(hdlr.data + 24, hdlr.end);
      const pascal = nameBytes.length > 0 && (nameBytes[0] ?? 0) === nameBytes.length - 1;
      tr.handlerName = clean(utf8(pascal ? nameBytes.subarray(1) : nameBytes).replace(/\u0000+$/, ''));
    }
    const minf = find(mdia, 'minf');
    const stbl = minf ? find(minf, 'stbl') : undefined;
    if (stbl) {
      const stsd = find(stbl, 'stsd');
      if (stsd) {
        const es = stsd.data + 8;
        const entrySize = u32(body, es);
        if (entrySize >= 16) parseSampleEntry(body, es, Math.min(es + entrySize, stsd.end), tr);
      }
      const stts = find(stbl, 'stts');
      let samples = 0;
      if (stts) {
        const n = u32(body, stts.data + 4);
        for (let i = 0; i < n && stts.data + 8 + i * 8 + 8 <= stts.end; i++) samples += u32(body, stts.data + 8 + i * 8);
      }
      const stsz = find(stbl, 'stsz');
      const count = stsz ? u32(body, stsz.data + 8) : 0;
      tr.frames = samples || count || null;
      if (tr.frames && tr.duration && tr.handler === 'vide') tr.fps = tr.frames / tr.duration;
    }
  }
  if (tr.handler === 'vide' && tr.displayW && tr.displayH && (tr.displayW !== tr.width || tr.displayH !== tr.height) && tr.width) {
    tr.extra.push(`Display size: ${Math.round(tr.displayW)} × ${Math.round(tr.displayH)}`);
  }
  return tr;
}

// ---------------------------------------------------------------------------
// HEIF / AVIF
// ---------------------------------------------------------------------------

interface HeifItem {
  id: number;
  type: string;
  name: string;
  contentType: string;
}

async function parseHeifMeta(c: Ctx, metaBox: Box, sec: import('./types').Section): Promise<void> {
  const { rd } = c;
  const body = await boxBody(rd, metaBox, 64 * 1024 * 1024);
  const kids = memBoxes(body, 4, body.length);
  const items: HeifItem[] = [];
  let primary = 0;
  const props: Array<{ type: string; data: number; end: number }> = [];
  const assoc = new Map<number, number[]>();
  const locs = new Map<number, { offset: number; length: number; method: number }>();
  const thumbs = new Set<number>();
  for (const k of kids) {
    if (k.type === 'pitm') primary = u8(body, k.data) === 0 ? u16(body, k.data + 4) : u32(body, k.data + 4);
    else if (k.type === 'iinf') {
      const ver = u8(body, k.data);
      let p = k.data + 4 + (ver === 0 ? 2 : 4);
      for (const inf of memBoxes(body, p, k.end)) {
        const iv = u8(body, inf.data);
        let q = inf.data + 4;
        let id: number;
        if (iv >= 3) {
          id = u32(body, q);
          q += 4;
        } else {
          id = u16(body, q);
          q += 2;
        }
        q += 2; // protection index
        let type = '';
        if (iv >= 2) {
          type = fourcc(body, q);
          q += 4;
        }
        let e = q;
        while (e < inf.end && body[e] !== 0) e++;
        const name = utf8(body.subarray(q, e));
        let ct = '';
        if (type === 'mime') {
          let e2 = e + 1;
          while (e2 < inf.end && body[e2] !== 0) e2++;
          ct = utf8(body.subarray(e + 1, e2));
        }
        items.push({ id, type, name, contentType: ct });
      }
      void p;
      p = 0;
    } else if (k.type === 'iref') {
      const ver = u8(body, k.data);
      for (const r of memBoxes(body, k.data + 4, k.end)) {
        if (r.type !== 'thmb') continue;
        const from = ver === 0 ? u16(body, r.data) : u32(body, r.data);
        thumbs.add(from);
      }
    } else if (k.type === 'iprp') {
      for (const x of memBoxes(body, k.data, k.end)) {
        if (x.type === 'ipco') for (const pb of memBoxes(body, x.data, x.end)) props.push({ type: pb.type, data: pb.data, end: pb.end });
        else if (x.type === 'ipma') {
          const ver = u8(body, x.data);
          const flags = u32(body, x.data) & 0xffffff;
          const n = u32(body, x.data + 4);
          let q = x.data + 8;
          for (let i = 0; i < n && q < x.end; i++) {
            const id = ver < 1 ? u16(body, q) : u32(body, q);
            q += ver < 1 ? 2 : 4;
            const cnt = u8(body, q++);
            const list: number[] = [];
            for (let j = 0; j < cnt; j++) {
              if (flags & 1) {
                list.push(u16(body, q) & 0x7fff);
                q += 2;
              } else list.push(u8(body, q++) & 0x7f);
            }
            assoc.set(id, list);
          }
        }
      }
    } else if (k.type === 'iloc') {
      const ver = u8(body, k.data);
      const sizes = u16(body, k.data + 4);
      const offSize = sizes >> 12;
      const lenSize = (sizes >> 8) & 15;
      const baseSize = (sizes >> 4) & 15;
      const idxSize = ver >= 1 ? sizes & 15 : 0;
      let q = k.data + 6;
      const n = ver < 2 ? u16(body, q) : u32(body, q);
      q += ver < 2 ? 2 : 4;
      const rdN = (len: number): number => {
        let v = 0;
        for (let i = 0; i < len; i++) v = v * 256 + u8(body, q + i);
        q += len;
        return v;
      };
      for (let i = 0; i < n && q < k.end; i++) {
        const id = ver < 2 ? rdN(2) : rdN(4);
        let method = 0;
        if (ver >= 1) method = rdN(2) & 15;
        rdN(2);
        const base = rdN(baseSize);
        const ec = rdN(2);
        let first: { offset: number; length: number } | null = null;
        for (let j = 0; j < ec; j++) {
          if (ver >= 1 && idxSize > 0) rdN(idxSize);
          const o = rdN(offSize);
          const l = rdN(lenSize);
          if (!first) first = { offset: base + o, length: l };
        }
        if (first) locs.set(id, { ...first, method });
      }
    }
  }
  const imageTypes = new Set(['hvc1', 'av01', 'jpeg', 'avc1', 'grid', 'iovl', 'unci', 'vvc1']);
  const images = items.filter((i) => imageTypes.has(i.type));
  const thumbCount = images.filter((i) => thumbs.has(i.id)).length;
  c.out.row(sec, 'Image items', `${images.length}${thumbCount ? ` (${thumbCount} thumbnail${thumbCount === 1 ? '' : 's'})` : ''}`);
  const prim = items.find((i) => i.id === primary);
  if (prim) c.out.row(sec, 'Primary item type', `${prim.type}${CODECS[prim.type] ? ` (${CODECS[prim.type]})` : prim.type === 'grid' ? ' (tiled image grid)' : ''}`);
  const pa = assoc.get(primary) ?? [];
  for (const idx of pa) {
    const pr = props[idx - 1];
    if (!pr) continue;
    if (pr.type === 'ispe') {
      const w = u32(body, pr.data + 4);
      const h = u32(body, pr.data + 8);
      c.out.row(sec, 'Dimensions', `${w} × ${h} px`);
      c.out.row(sec, 'Megapixels', megapixels(w, h));
    } else if (pr.type === 'pixi') {
      const n = u8(body, pr.data + 4);
      c.out.row(sec, 'Bits per channel', Array.from({ length: n }, (_, i) => u8(body, pr.data + 5 + i)).join(', '));
    } else if (pr.type === 'irot') {
      c.out.row(sec, 'Rotation', `${(u8(body, pr.data) & 3) * 90}° counter-clockwise`);
    } else if (pr.type === 'imir') {
      c.out.row(sec, 'Mirroring', (u8(body, pr.data) & 1) ? 'horizontal' : 'vertical');
    } else if (pr.type === 'colr') {
      const t = fourcc(body, pr.data);
      if (t === 'nclx') c.out.row(sec, 'Colour (nclx)', `primaries ${u16(body, pr.data + 4)}, transfer ${u16(body, pr.data + 6)}, matrix ${u16(body, pr.data + 8)}, ${u8(body, pr.data + 10) & 0x80 ? 'full' : 'limited'} range`);
      else if (t === 'prof' || t === 'rICC') await c.out.attempt('ICC profile', () => emitIcc(c.out, body.slice(pr.data + 4, pr.end)));
    } else if (pr.type === 'hvcC') {
      c.out.row(sec, 'Codec profile', `HEVC ${HEVC_PROFILES[u8(body, pr.data + 1) & 31] ?? u8(body, pr.data + 1) & 31}`);
    } else if (pr.type === 'av1C') {
      c.out.row(sec, 'Codec profile', `AV1 ${['Main', 'High', 'Professional'][u8(body, pr.data + 1) >> 5] ?? ''}`);
    } else if (pr.type === 'auxC') {
      c.out.row(sec, 'Auxiliary type', latin1(body, pr.data + 4, pr.end).replace(/\u0000+$/, ''));
    }
  }
  const aux = items.filter((i) => !imageTypes.has(i.type) && i.type !== 'Exif' && i.type !== 'mime');
  if (aux.length) c.out.row(sec, 'Other items', Array.from(new Set(aux.map((i) => i.type))).join(', '));
  // Exif / XMP items
  const readItem = async (it: HeifItem): Promise<Uint8Array | null> => {
    const loc = locs.get(it.id);
    if (!loc || loc.method !== 0 || loc.length <= 0 || loc.length > 16 * 1024 * 1024) return null;
    return (await rd.read(loc.offset, loc.length)).slice();
  };
  for (const it of items) {
    if (it.type === 'Exif') {
      await c.out.attempt('EXIF item', async () => {
        const data = await readItem(it);
        if (!data) return;
        const off = u32(data, 0);
        await handleExif(c, data.slice(4 + off));
      });
    } else if (it.type === 'mime' && /xmp|rdf/i.test(it.contentType)) {
      await c.out.attempt('XMP item', async () => {
        const data = await readItem(it);
        const pk = data ? extractXmpPacket(data) : null;
        if (pk) emitXmp(c.out, pk);
      });
    }
  }
}

// ---------------------------------------------------------------------------
// ISO BMFF entry point
// ---------------------------------------------------------------------------

export async function parseIso(c: Ctx): Promise<void> {
  const { rd, size, out } = c;
  const top = await listBoxes(rd, 0, size, 20000);
  const ftyp = top.find((b) => b.type === 'ftyp');
  const container = out.section('container', 'Container');
  let major = '';
  const compat: string[] = [];
  if (ftyp) {
    const body = await rd.read(ftyp.data, Math.min(ftyp.end - ftyp.data, 256));
    major = fourcc(body, 0);
    for (let i = 8; i + 4 <= body.length; i += 4) compat.push(fourcc(body, i));
    out.row(container, 'Major brand', `${major}${BRANDS[major] ? ` (${BRANDS[major]})` : ''}`);
    out.row(container, 'Minor version', String(u32(body, 4)));
    out.row(container, 'Compatible brands', compat.map((b) => `${b}${BRANDS[b] ? ` (${BRANDS[b]})` : ''}`).join(', '));
  }
  const isHeif = /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1|avif|avis|jxl |crx )$/.test(major) || compat.some((b) => /^(heic|mif1|avif)$/.test(b));
  const moovs = top.filter((b) => b.type === 'moov');
  const moofCount = top.filter((b) => b.type === 'moof').length;
  const mdat = top.filter((b) => b.type === 'mdat');
  out.row(container, 'Top-level boxes', top.slice(0, 24).map((b) => b.type).join(', ') + (top.length > 24 ? ` … (${top.length} total)` : ''));
  if (mdat.length) out.row(container, 'Media data (mdat)', fmtBytes(mdat.reduce((s, b) => s + (b.end - b.data), 0)));
  if (moofCount > 0) out.row(container, 'Fragmented MP4', `yes (${moofCount} fragment${moofCount === 1 ? '' : 's'})`);
  const moovIndex = top.findIndex((b) => b.type === 'moov');
  const mdatIndex = top.findIndex((b) => b.type === 'mdat');
  if (moovIndex >= 0 && mdatIndex >= 0) out.row(container, 'Fast start (moov before mdat)', moovIndex < mdatIndex ? 'yes' : 'no');

  // --- XMP uuid boxes at top level
  for (const b of top) {
    if (b.type === 'uuid' && b.end - b.data < 8 * 1024 * 1024) {
      const uuid = toHex(await rd.read(b.data - 16, 16));
      if (uuid === 'be7acfcb97a942e89c71999491e3afac') {
        await out.attempt('XMP (uuid box)', async () => {
          const pk = extractXmpPacket(await rd.read(b.data, b.end - b.data));
          if (pk) emitXmp(out, pk);
        });
      }
    }
  }

  const info = out.section('movie', isHeif ? 'Image' : 'Media');
  if (isHeif) {
    const meta = top.find((b) => b.type === 'meta');
    if (meta) await out.attempt('HEIF metadata', () => parseHeifMeta(c, meta, info));
    else out.errors.push('could not parse HEIF metadata: no meta box found');
  }

  for (const moov of moovs.slice(0, 1)) {
    // children walk with ranged reads: moov can be tens of MB, mostly sample tables
    const kids = await listBoxes(rd, moov.data, moov.end, 3000);
    let mvTimescale = 0;
    let mvDuration = 0;
    for (const k of kids) {
      if (k.type !== 'mvhd') continue;
      const b = await rd.read(k.data, 120);
      const v = u8(b, 0);
      const created = isoFromMac(v === 1 ? u64(b, 4) : u32(b, 4));
      const modified = isoFromMac(v === 1 ? u64(b, 12) : u32(b, 8));
      mvTimescale = u32(b, v === 1 ? 20 : 12);
      mvDuration = v === 1 ? u64(b, 24) : u32(b, 16);
      out.row(info, 'Created (mvhd)', created ?? 'not set');
      out.row(info, 'Modified (mvhd)', modified ?? 'not set');
      out.row(info, 'Timescale', String(mvTimescale));
      if (mvTimescale && mvDuration) out.row(info, 'Duration', fmtDuration(mvDuration / mvTimescale));
      }
    if (moofCount > 0 && mvDuration === 0) {
      const mvex = kids.find((k) => k.type === 'mvex');
      if (mvex) {
        for (const m of await listBoxes(rd, mvex.data, mvex.end)) {
          if (m.type !== 'mehd') continue;
          const b = await rd.read(m.data, 12);
          const fd = u8(b, 0) === 1 ? u64(b, 4) : u32(b, 4);
          if (mvTimescale && fd) out.row(info, 'Duration (fragments)', fmtDuration(fd / mvTimescale));
        }
      }
    }
    const tracks: TrackInfo[] = [];
    for (const k of kids.filter((x) => x.type === 'trak').slice(0, 24)) {
      await out.attempt('track', async () => {
        tracks.push(await parseTrak(rd, k, mvTimescale));
      });
    }
    const totalSec = mvDuration && mvTimescale ? mvDuration / mvTimescale : (tracks.map((t) => t.duration ?? 0).sort((a, b) => b - a)[0] ?? 0);
    if (totalSec > 0 && !isHeif) out.row(info, 'Overall bitrate', `${Math.round((size * 8) / totalSec / 1000).toLocaleString('en-US')} kbps (file size ÷ duration)`);
    if (!isHeif || tracks.length > 0) {
      tracks.forEach((t, i) => {
        const kind = HANDLERS[t.handler] ?? (t.handler || 'unknown');
        const sec = out.section(`track${i + 1}`, `Track ${i + 1} · ${kind}${t.codec ? ` · ${t.codec.trim()}` : ''}`);
        out.row(sec, 'Track ID', String(t.id));
        out.row(sec, 'Type', `${kind}${t.handlerName ? ` (handler "${t.handlerName}")` : ''}`);
        out.row(sec, 'Codec', t.codec ? `${t.codec.trim()}${t.codecDesc ? ` — ${t.codecDesc}` : ''}` : undefined);
        if (t.width && t.height) {
          out.row(sec, 'Dimensions', `${t.width} × ${t.height} px`);
        }
        if (t.rotation) out.row(sec, 'Rotation (display matrix)', `${t.rotation}°`);
        if (t.fps) out.row(sec, 'Frame rate', `${fmtNum(t.fps, 3)} fps`);
        if (t.frames && t.handler === 'vide') out.row(sec, 'Frames', t.frames.toLocaleString('en-US'));
        if (t.sampleRate) out.row(sec, 'Sample rate', `${fmtNum(t.sampleRate, 0)} Hz`);
        if (t.channels) out.row(sec, 'Channels', String(t.channels));
        if (t.handler === 'soun' && t.bits) out.row(sec, 'Bits per sample', String(t.bits));
        if (t.bitrate) out.row(sec, 'Bitrate (declared)', `${Math.round(t.bitrate / 1000).toLocaleString('en-US')} kbps`);
        if (t.duration) out.row(sec, 'Duration', fmtDuration(t.duration));
        out.row(sec, 'Language', t.language && t.language !== 'und' ? t.language : undefined);
        out.row(sec, 'Created', t.created ?? undefined);
        out.row(sec, 'Modified', t.modified ?? undefined);
        if (!t.enabled) out.row(sec, 'Enabled', 'no');
        for (const e of t.extra) {
          const i2 = e.indexOf(': ');
          out.row(sec, i2 > 0 ? e.slice(0, i2) : 'Info', i2 > 0 ? e.slice(i2 + 2) : e);
        }
        if (t.handler === 'gpmd' || t.codec === 'gpmd' || t.codec === 'camm') out.find('gps', 'GPS / sensor telemetry track', `${t.codec} timed-metadata track may hold position data`);
      });
    }

    // --- user data
    const tags = out.section('tags', 'Metadata tags (udta / meta)');
    for (const k of kids) {
      if (k.type === 'udta' && k.end - k.data < 32 * 1024 * 1024) {
        const body = await boxBody(rd, k, 32 * 1024 * 1024);
        await out.attempt('user data (udta)', () => parseUdta(c, body, 0, body.length, tags));
      } else if (k.type === 'meta' && k.end - k.data < 48 * 1024 * 1024) {
        const body = await boxBody(rd, k, 48 * 1024 * 1024);
        const hd = { value: '' };
        await out.attempt('moov metadata (meta)', () => parseMetaBox(c, { data: 0, end: body.length }, body, 0, tags, hd));
      }
    }
    // udta nested inside trak (some cameras write location per track)
    for (const k of kids.filter((x) => x.type === 'trak').slice(0, 8)) {
      const sub = await listBoxes(rd, k.data, k.end, 200);
      const u = sub.find((x) => x.type === 'udta');
      if (u && u.end - u.data < 8 * 1024 * 1024) {
        const body = await boxBody(rd, u, 8 * 1024 * 1024);
        await out.attempt('track user data', () => parseUdta(c, body, 0, body.length, tags));
      }
    }
    if (!isHeif) {
      const m = HANDLERS[major] ?? '';
      void m;
    }
  }
  if (!isHeif && moovs.length === 0) out.errors.push('could not parse movie header: no moov box found (truncated or non-faststart file cut short)');
  // top-level meta (iTunes style on some files)
  if (!isHeif) {
    const tm = top.find((b) => b.type === 'meta');
    if (tm && tm.end - tm.data < 32 * 1024 * 1024) {
      const tags = out.section('tags', 'Metadata tags (udta / meta)');
      const body = await boxBody(rd, tm, 32 * 1024 * 1024);
      const hd = { value: '' };
      await out.attempt('top-level metadata (meta)', () => parseMetaBox(c, { data: 0, end: body.length }, body, 0, tags, hd));
    }
  }
}

// ---------------------------------------------------------------------------
// Matroska / WebM
// ---------------------------------------------------------------------------

interface Elem {
  id: number;
  size: number; // -1 = unknown
  data: number;
  hdr: number;
}

function parseElem(b: Uint8Array, o: number): Elem | null {
  const b0 = u8(b, o);
  if (b0 === 0) return null;
  const idLen = b0 >= 0x80 ? 1 : b0 >= 0x40 ? 2 : b0 >= 0x20 ? 3 : b0 >= 0x10 ? 4 : 0;
  if (!idLen || o + idLen >= b.length) return null;
  let id = 0;
  for (let i = 0; i < idLen; i++) id = id * 256 + u8(b, o + i);
  const s0 = u8(b, o + idLen);
  let sLen = 1;
  while (sLen <= 8 && !(s0 & (0x80 >> (sLen - 1)))) sLen++;
  if (sLen > 8) return null;
  let size = s0 & (0xff >> sLen);
  let allOnes = size === (0xff >> sLen);
  for (let i = 1; i < sLen; i++) {
    const x = u8(b, o + idLen + i);
    size = size * 256 + x;
    if (x !== 0xff) allOnes = false;
  }
  return { id, size: allOnes ? -1 : size, data: o + idLen + sLen, hdr: idLen + sLen };
}

function mkUint(b: Uint8Array, s: number, e: number): number {
  let v = 0;
  for (let i = s; i < e; i++) v = v * 256 + u8(b, i);
  return v;
}

function mkChildren(b: Uint8Array, s: number, e: number): Array<Elem & { end: number }> {
  const out: Array<Elem & { end: number }> = [];
  let p = s;
  while (p < e && out.length < 20000) {
    const el = parseElem(b, p);
    if (!el) break;
    const end = el.size < 0 ? e : Math.min(e, el.data + el.size);
    out.push({ ...el, end });
    if (end <= p) break;
    p = end;
  }
  return out;
}

const MK_TRACK_TYPES: Record<number, string> = { 1: 'video', 2: 'audio', 3: 'complex', 16: 'logo', 17: 'subtitle', 18: 'buttons', 32: 'control', 33: 'metadata' };

const ID = {
  EBML: 0x1a45dfa3, DocType: 0x4282, DocTypeVersion: 0x4287, Segment: 0x18538067, SeekHead: 0x114d9b74, Seek: 0x4dbb, SeekID: 0x53ab, SeekPosition: 0x53ac,
  Info: 0x1549a966, Tracks: 0x1654ae6b, Tags: 0x1254c367, Cluster: 0x1f43b675, Cues: 0x1c53bb6b, Attachments: 0x1941a469, Chapters: 0x1043a770,
  TimecodeScale: 0x2ad7b1, Duration: 0x4489, MuxingApp: 0x4d80, WritingApp: 0x5741, DateUTC: 0x4461, Title: 0x7ba9, SegmentFilename: 0x7384, SegmentUID: 0x73a4,
  TrackEntry: 0xae, TrackNumber: 0xd7, TrackUID: 0x73c5, TrackType: 0x83, CodecID: 0x86, CodecName: 0x258688, TrackName: 0x536e, Language: 0x22b59c, LanguageBCP47: 0x22b59d,
  DefaultDuration: 0x23e383, Video: 0xe0, PixelWidth: 0xb0, PixelHeight: 0xba, DisplayWidth: 0x54b0, DisplayHeight: 0x54ba, FlagInterlaced: 0x9a, Audio: 0xe1,
  SamplingFrequency: 0xb5, Channels: 0x9f, BitDepth: 0x6264, FlagDefault: 0x88, FlagForced: 0x55aa, Tag: 0x7373, SimpleTag: 0x67c8, TagName: 0x45a3, TagString: 0x4487,
  Targets: 0x63c0, TargetType: 0x63ca, AttachedFile: 0x61a7, FileName: 0x466e, FileDescription: 0x467e, FileMimeType: 0x4660, FileData: 0x465c, ChapterAtom: 0xb6, EditionEntry: 0x45b9,
  Colour: 0x55b0, Range: 0x55b9, MatrixCoefficients: 0x55b1, TransferCharacteristics: 0x55ba, Primaries: 0x55bb, ProjectionType: 0x7671,
};

export async function parseMatroska(c: Ctx): Promise<void> {
  const { rd, size, out } = c;
  const head = await rd.read(0, 1024);
  const ebml = parseElem(head, 0);
  if (!ebml || ebml.id !== ID.EBML) throw new Error('EBML header not found');
  const hdrBody = await rd.read(ebml.data, Math.max(0, ebml.size));
  let docType = 'matroska';
  let docVer = 0;
  for (const el of mkChildren(hdrBody, 0, hdrBody.length)) {
    if (el.id === ID.DocType) docType = latin1(hdrBody, el.data, el.end);
    else if (el.id === ID.DocTypeVersion) docVer = mkUint(hdrBody, el.data, el.end);
  }
  const container = out.section('container', 'Container');
  out.row(container, 'Format', docType === 'webm' ? 'WebM' : 'Matroska');
  out.row(container, 'DocType', `${docType} (version ${docVer})`);
  c.refine({ id: 'mkv', name: docType === 'webm' ? 'WebM video' : 'Matroska video', mime: docType === 'webm' ? 'video/webm' : 'video/x-matroska', exts: docType === 'webm' ? ['webm'] : ['mkv', 'mka', 'mks', 'mk3d'], kind: 'video' });

  let off = ebml.data + Math.max(0, ebml.size);
  let seg: (Elem & { end: number }) | null = null;
  for (let i = 0; i < 20; i++) {
    const b = await rd.peek(off, 16);
    const el = parseElem(b, 0);
    if (!el) break;
    const e = { ...el, data: off + el.hdr, end: el.size < 0 ? size : Math.min(size, off + el.hdr + el.size) };
    if (el.id === ID.Segment) {
      seg = e;
      break;
    }
    off = e.end;
  }
  if (!seg) throw new Error('Segment element not found');
  const segStart = seg.data;
  const info = out.section('movie', 'Segment information');
  const tags = out.section('tags', 'Tags');
  const positions = new Map<number, number>();
  const found = { info: false, tracks: false, tags: false, attach: false, chapters: false };

  const handleInfo = (b: Uint8Array) => {
    let scale = 1000000;
    let dur: number | null = null;
    for (const el of mkChildren(b, 0, b.length)) {
      if (el.id === ID.TimecodeScale) scale = mkUint(b, el.data, el.end);
      else if (el.id === ID.Duration) dur = el.end - el.data === 4 ? f32(b, el.data) : f64(b, el.data);
    }
    for (const el of mkChildren(b, 0, b.length)) {
      const txt = () => clean(utf8(b.subarray(el.data, el.end)).replace(/\u0000+$/, ''));
      if (el.id === ID.Title) {
        out.row(info, 'Title', txt());
      } else if (el.id === ID.MuxingApp) {
        out.row(info, 'Muxing application', txt());
        out.find('software', 'Muxing application', txt());
      } else if (el.id === ID.WritingApp) {
        out.row(info, 'Writing application', txt());
        out.find('software', 'Writing application', txt());
      } else if (el.id === ID.DateUTC) {
        const ns = mkUint(b, el.data, el.end);
        const signed = ns > 2 ** 62 ? ns - 2 ** 64 : ns;
        out.row(info, 'Date (UTC)', isoFromMs(Date.UTC(2001, 0, 1) + signed / 1e6) ?? undefined);
      } else if (el.id === ID.SegmentFilename) {
        out.row(info, 'Segment file name', txt());
        out.find('filename', 'Original segment file name', txt());
      } else if (el.id === ID.SegmentUID) {
        out.row(info, 'Segment UID', toHex(b.subarray(el.data, el.end)));
      }
    }
    out.row(info, 'Timecode scale', `${scale} ns`);
    if (dur !== null) out.row(info, 'Duration', fmtDuration((dur * scale) / 1e9));
    if (dur !== null && dur > 0) out.row(info, 'Overall bitrate', `${Math.round((size * 8) / ((dur * scale) / 1e9) / 1000).toLocaleString('en-US')} kbps (file size ÷ duration)`);
  };

  const handleTracks = (b: Uint8Array) => {
    let n = 0;
    for (const te of mkChildren(b, 0, b.length)) {
      if (te.id !== ID.TrackEntry) continue;
      n++;
      const row: Record<string, string> = {};
      let type = 0;
      let pw = 0, ph = 0, dw = 0, dh = 0;
      let rate = 0, ch = 0, bd = 0;
      let defDur = 0;
      let colour = '';
      for (const el of mkChildren(b, te.data, te.end)) {
        const txt = () => clean(utf8(b.subarray(el.data, el.end)).replace(/\u0000+$/, ''));
        switch (el.id) {
          case ID.TrackNumber: row['num'] = String(mkUint(b, el.data, el.end)); break;
          case ID.TrackType: type = mkUint(b, el.data, el.end); break;
          case ID.CodecID: row['codec'] = txt(); break;
          case ID.CodecName: row['codecName'] = txt(); break;
          case ID.TrackName: row['name'] = txt(); break;
          case ID.Language: row['lang'] = txt(); break;
          case ID.LanguageBCP47: row['bcp47'] = txt(); break;
          case ID.DefaultDuration: defDur = mkUint(b, el.data, el.end); break;
          case ID.FlagDefault: row['default'] = mkUint(b, el.data, el.end) ? 'default' : ''; break;
          case ID.FlagForced: row['forced'] = mkUint(b, el.data, el.end) ? 'forced' : ''; break;
          case ID.Video:
            for (const v of mkChildren(b, el.data, el.end)) {
              if (v.id === ID.PixelWidth) pw = mkUint(b, v.data, v.end);
              else if (v.id === ID.PixelHeight) ph = mkUint(b, v.data, v.end);
              else if (v.id === ID.DisplayWidth) dw = mkUint(b, v.data, v.end);
              else if (v.id === ID.DisplayHeight) dh = mkUint(b, v.data, v.end);
              else if (v.id === ID.Colour) {
                const cs: string[] = [];
                for (const x of mkChildren(b, v.data, v.end)) {
                  if (x.id === ID.Primaries) cs.push(`primaries ${mkUint(b, x.data, x.end)}`);
                  else if (x.id === ID.TransferCharacteristics) cs.push(`transfer ${mkUint(b, x.data, x.end)}`);
                  else if (x.id === ID.MatrixCoefficients) cs.push(`matrix ${mkUint(b, x.data, x.end)}`);
                }
                colour = cs.join(', ');
              }
            }
            break;
          case ID.Audio:
            for (const a of mkChildren(b, el.data, el.end)) {
              if (a.id === ID.SamplingFrequency) rate = a.end - a.data === 4 ? f32(b, a.data) : f64(b, a.data);
              else if (a.id === ID.Channels) ch = mkUint(b, a.data, a.end);
              else if (a.id === ID.BitDepth) bd = mkUint(b, a.data, a.end);
            }
            break;
          default:
            break;
        }
      }
      const kind = MK_TRACK_TYPES[type] ?? `type ${type}`;
      const sec = out.section(`track${n}`, `Track ${row['num'] ?? n} · ${kind}${row['codec'] ? ` · ${row['codec']}` : ''}`);
      out.row(sec, 'Type', kind);
      out.row(sec, 'Codec ID', row['codec']);
      out.row(sec, 'Codec name', row['codecName']);
      out.row(sec, 'Track name', row['name']);
      if (pw && ph) out.row(sec, 'Dimensions', `${pw} × ${ph} px`);
      if (dw && dh && (dw !== pw || dh !== ph)) out.row(sec, 'Display size', `${dw} × ${dh}`);
      if (defDur && type === 1) out.row(sec, 'Frame rate', `${fmtNum(1e9 / defDur, 3)} fps`);
      if (rate) out.row(sec, 'Sample rate', `${fmtNum(rate, 0)} Hz`);
      if (ch) out.row(sec, 'Channels', String(ch));
      if (bd) out.row(sec, 'Bit depth', String(bd));
      if (colour) out.row(sec, 'Colour', colour);
      out.row(sec, 'Language', row['bcp47'] ?? (row['lang'] && row['lang'] !== 'und' ? row['lang'] : undefined));
      out.row(sec, 'Flags', [row['default'], row['forced']].filter(Boolean).join(', ') || undefined);
    }
  };

  const handleTags = (b: Uint8Array) => {
    const walk = (s: number, e: number, prefix: string) => {
      for (const el of mkChildren(b, s, e)) {
        if (el.id === ID.Tag) walk(el.data, el.end, prefix);
        else if (el.id === ID.SimpleTag) {
          let name = '';
          let value = '';
          const nested: Array<typeof el> = [];
          for (const x of mkChildren(b, el.data, el.end)) {
            if (x.id === ID.TagName) name = utf8(b.subarray(x.data, x.end));
            else if (x.id === ID.TagString) value = utf8(b.subarray(x.data, x.end)).replace(/\u0000+$/, '');
            else if (x.id === ID.SimpleTag) nested.push(x);
          }
          if (name && value && !/^(DURATION|NUMBER_OF_FRAMES|NUMBER_OF_BYTES|BPS|_STATISTICS_.*)$/i.test(name)) {
            out.row(tags, `${prefix}${name}`, value);
            if (/^(ENCODER|WRITING_APP)$/i.test(name)) out.find('software', `Tag ${name}`, value);
            else if (/^(AUTHOR|ARTIST|DIRECTOR|ACTOR|PRODUCER)$/i.test(name)) out.find('person', `Tag ${name}`, value);
            else if (/^(COMMENT|DESCRIPTION|SYNOPSIS)$/i.test(name)) out.find('comments', `Tag ${name}`, value.length > 200 ? `${value.slice(0, 200)}…` : value);
            else if (/LOCATION|GPS|RECORDING_LOCATION/i.test(name)) out.find('gps', `Tag ${name}`, value);
          }
          for (const n2 of nested) walk(n2.data - n2.hdr, n2.end, `${prefix}${name}/`);
        }
      }
    };
    walk(0, b.length, '');
  };

  const handleAttachments = async (start: number, end: number) => {
    const sec = out.section('attachments', 'Attachments');
    let p = start;
    let count = 0;
    while (p < end && count < 500) {
      const hd = await rd.peek(p, 16);
      const af = parseElem(hd, 0);
      if (!af) break;
      const afData = p + af.hdr;
      const afEnd = af.size < 0 ? end : Math.min(end, afData + af.size);
      if (af.id === ID.AttachedFile) {
        count++;
        let name = '';
        let mime = '';
        let desc = '';
        let dataOff = 0;
        let dataLen = 0;
        let q = afData;
        while (q < afEnd) {
          const h2 = await rd.peek(q, 16);
          const el = parseElem(h2, 0);
          if (!el) break;
          const dOff = q + el.hdr;
          const len = el.size < 0 ? afEnd - dOff : el.size;
          if (el.id === ID.FileData) {
            dataOff = dOff;
            dataLen = len;
          } else if (len < 65536) {
            const txt = utf8(await rd.read(dOff, len)).replace(/\u0000+$/, '');
            if (el.id === ID.FileName) name = txt;
            else if (el.id === ID.FileMimeType) mime = txt;
            else if (el.id === ID.FileDescription) desc = txt;
          }
          q = dOff + len;
        }
        out.row(sec, name || `Attachment ${count}`, `${mime || 'unknown type'} · ${dataLen.toLocaleString('en-US')} bytes${desc ? ` · ${desc}` : ''}`);
        if (name) out.find('filename', 'Attached file name', name);
        if (/^image\//.test(mime) && dataLen > 0 && dataLen <= 4 * 1024 * 1024 && count <= 4) {
          const data = (await rd.read(dataOff, dataLen)).slice();
          out.preview(`Attachment: ${name || 'image'}`, imageMime(data) ?? mime, data);
        }
      }
      p = afEnd;
    }
  };

  const readMaster = async (e: Elem & { end: number }, max = 32 * 1024 * 1024): Promise<Uint8Array> => (await rd.read(e.data, Math.min(max, Math.max(0, e.end - e.data)))).slice();

  const process = async (el: Elem & { end: number }) => {
    if (el.id === ID.Info && !found.info) {
      found.info = true;
      await out.attempt('Matroska segment info', async () => handleInfo(await readMaster(el)));
    } else if (el.id === ID.Tracks && !found.tracks) {
      found.tracks = true;
      await out.attempt('Matroska tracks', async () => handleTracks(await readMaster(el)));
    } else if (el.id === ID.Tags && !found.tags) {
      found.tags = true;
      await out.attempt('Matroska tags', async () => handleTags(await readMaster(el)));
    } else if (el.id === ID.Attachments && !found.attach) {
      found.attach = true;
      await out.attempt('Matroska attachments', () => handleAttachments(el.data, el.end));
    } else if (el.id === ID.Chapters && !found.chapters) {
      found.chapters = true;
      await out.attempt('Matroska chapters', async () => {
        const b = await readMaster(el, 8 * 1024 * 1024);
        let atoms = 0;
        const count = (s: number, e: number) => {
          for (const x of mkChildren(b, s, e)) {
            if (x.id === ID.EditionEntry) count(x.data, x.end);
            else if (x.id === ID.ChapterAtom) {
              atoms++;
              count(x.data, x.end);
            }
          }
        };
        count(0, b.length);
        out.row(info, 'Chapters', String(atoms));
      });
    }
  };

  // Walk top-level elements; clusters are skipped by size so even huge files stay cheap.
  off = segStart;
  let guard = 0;
  let seenCluster = false;
  while (off < seg.end && guard++ < 20000) {
    const b = await rd.peek(off, 16);
    const el = parseElem(b, 0);
    if (!el) break;
    const data = off + el.hdr;
    const end = el.size < 0 ? seg.end : Math.min(seg.end, data + el.size);
    const full = { ...el, data, end };
    if (el.id === ID.SeekHead) {
      const body = await rd.read(data, Math.min(65536, end - data));
      for (const s of mkChildren(body, 0, body.length)) {
        if (s.id !== ID.Seek) continue;
        let sid = 0;
        let pos = -1;
        for (const x of mkChildren(body, s.data, s.end)) {
          if (x.id === ID.SeekID) sid = mkUint(body, x.data, x.end);
          else if (x.id === ID.SeekPosition) pos = mkUint(body, x.data, x.end);
        }
        if (sid && pos >= 0) positions.set(sid, segStart + pos);
      }
      // jump straight to the elements we need
      for (const id of [ID.Info, ID.Tracks, ID.Tags, ID.Attachments, ID.Chapters]) {
        const at = positions.get(id);
        if (at === undefined || at >= size) continue;
        const h = await rd.peek(at, 16);
        const t = parseElem(h, 0);
        if (t && t.id === id) await process({ ...t, data: at + t.hdr, end: t.size < 0 ? seg.end : Math.min(seg.end, at + t.hdr + t.size) });
      }
    } else if (el.id === ID.Cluster) {
      seenCluster = true;
      if (positions.size > 0 || (found.info && found.tracks && found.tags)) break;
      if (el.size < 0) break;
    } else {
      await process(full);
    }
    if (found.info && found.tracks && found.tags && found.attach && found.chapters) break;
    off = end;
    if (seenCluster && positions.size === 0 && guard > 6000) break;
  }
  if (!found.tracks) out.errors.push('could not parse Matroska tracks: Tracks element not found');
  out.sections = [...out.sections.filter((x) => x !== tags), tags];
}

