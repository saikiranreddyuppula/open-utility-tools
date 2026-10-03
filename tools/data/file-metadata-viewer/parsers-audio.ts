/** Audio parsers: MP3 (ID3v1/v2, APE, MPEG headers), FLAC, Ogg (Vorbis / Opus), WAV, AIFF, AAC. */
import { emitXmp, extractXmpPacket } from './embedded';
import {
  type Collector,
  type Ctx,
  type Reader,
  MemReader,
  concat,
  fmtBytes,
  fmtDuration,
  fmtNum,
  fourcc,
  fromBase64,
  imageMime,
  inflateLimited,
  latin1,
  readExact,
  textSmart,
  toHex,
  u16,
  u24,
  u32,
  u64,
  u8,
  utf16,
  utf16Bom,
  utf8,
  utf8Strict,
} from './util';

// ---------------------------------------------------------------------------
// ID3
// ---------------------------------------------------------------------------

const GENRES = [
  'Blues', 'Classic Rock', 'Country', 'Dance', 'Disco', 'Funk', 'Grunge', 'Hip-Hop', 'Jazz', 'Metal', 'New Age', 'Oldies', 'Other', 'Pop', 'R&B', 'Rap',
  'Reggae', 'Rock', 'Techno', 'Industrial', 'Alternative', 'Ska', 'Death Metal', 'Pranks', 'Soundtrack', 'Euro-Techno', 'Ambient', 'Trip-Hop', 'Vocal',
  'Jazz+Funk', 'Fusion', 'Trance', 'Classical', 'Instrumental', 'Acid', 'House', 'Game', 'Sound Clip', 'Gospel', 'Noise', 'Alternative Rock', 'Bass', 'Soul',
  'Punk', 'Space', 'Meditative', 'Instrumental Pop', 'Instrumental Rock', 'Ethnic', 'Gothic', 'Darkwave', 'Techno-Industrial', 'Electronic', 'Pop-Folk',
  'Eurodance', 'Dream', 'Southern Rock', 'Comedy', 'Cult', 'Gangsta', 'Top 40', 'Christian Rap', 'Pop/Funk', 'Jungle', 'Native US', 'Cabaret', 'New Wave',
  'Psychadelic', 'Rave', 'Showtunes', 'Trailer', 'Lo-Fi', 'Tribal', 'Acid Punk', 'Acid Jazz', 'Polka', 'Retro', 'Musical', 'Rock & Roll', 'Hard Rock', 'Folk',
  'Folk-Rock', 'National Folk', 'Swing', 'Fast Fusion', 'Bebob', 'Latin', 'Revival', 'Celtic', 'Bluegrass', 'Avantgarde', 'Gothic Rock', 'Progressive Rock',
  'Psychedelic Rock', 'Symphonic Rock', 'Slow Rock', 'Big Band', 'Chorus', 'Easy Listening', 'Acoustic', 'Humour', 'Speech', 'Chanson', 'Opera', 'Chamber Music',
  'Sonata', 'Symphony', 'Booty Bass', 'Primus', 'Porn Groove', 'Satire', 'Slow Jam', 'Club', 'Tango', 'Samba', 'Folklore', 'Ballad', 'Power Ballad',
  'Rhythmic Soul', 'Freestyle', 'Duet', 'Punk Rock', 'Drum Solo', 'A capella', 'Euro-House', 'Dance Hall', 'Goa', 'Drum & Bass', 'Club-House', 'Hardcore',
  'Terror', 'Indie', 'BritPop', 'Negerpunk', 'Polsk Punk', 'Beat', 'Christian Gangsta Rap', 'Heavy Metal', 'Black Metal', 'Crossover',
  'Contemporary Christian', 'Christian Rock', 'Merengue', 'Salsa', 'Thrash Metal', 'Anime', 'JPop', 'Synthpop',
];

export function genreName(n: number): string {
  return GENRES[n] ?? `Genre ${n}`;
}

function parseGenre(text: string): string {
  const parts: string[] = [];
  let rest = text.trim();
  const re = /^\((\d+|RX|CR)\)/;
  let m = re.exec(rest);
  while (m) {
    const t = m[1] ?? '';
    parts.push(t === 'RX' ? 'Remix' : t === 'CR' ? 'Cover' : genreName(parseInt(t, 10)));
    rest = rest.slice(m[0].length);
    m = re.exec(rest);
  }
  if (rest) parts.push(/^\d+$/.test(rest) ? genreName(parseInt(rest, 10)) : rest.replace(/^\(\(/, '('));
  return parts.join(' / ');
}

const ID3_NAMES: Record<string, string> = {
  TIT1: 'Content group', TIT2: 'Title', TIT3: 'Subtitle', TPE1: 'Artist', TPE2: 'Album artist', TPE3: 'Conductor', TPE4: 'Remixed by',
  TALB: 'Album', TYER: 'Year', TDAT: 'Date (DDMM)', TIME: 'Time (HHMM)', TORY: 'Original release year', TRDA: 'Recording dates',
  TDRC: 'Recording time', TDRL: 'Release time', TDOR: 'Original release time', TDEN: 'Encoding time', TDTG: 'Tagging time',
  TRCK: 'Track', TPOS: 'Disc', TCON: 'Genre', TCOM: 'Composer', TEXT: 'Lyricist', TCOP: 'Copyright', TPUB: 'Publisher', TENC: 'Encoded by',
  TSSE: 'Encoding software / settings', TLAN: 'Language', TBPM: 'BPM', TKEY: 'Initial key', TLEN: 'Length (ms)', TMED: 'Media type',
  TOAL: 'Original album', TOPE: 'Original artist', TOLY: 'Original lyricist', TOWN: 'File owner', TRSN: 'Internet radio station',
  TRSO: 'Internet radio owner', TSRC: 'ISRC', TSO2: 'Album artist sort', TSOA: 'Album sort', TSOP: 'Artist sort', TSOT: 'Title sort',
  TSOC: 'Composer sort', TCMP: 'Compilation', TFLT: 'File type', TOFN: 'Original file name', TSST: 'Set subtitle', TMOO: 'Mood',
  TPRO: 'Produced notice', TSIZ: 'Size', TDLY: 'Playlist delay', TIPL: 'Involved people', TMCL: 'Musician credits',
  WCOM: 'Commercial info URL', WCOP: 'Copyright URL', WOAF: 'Audio file URL', WOAR: 'Artist URL', WOAS: 'Audio source URL', WORS: 'Radio station URL',
  WPAY: 'Payment URL', WPUB: 'Publisher URL', PCNT: 'Play counter', MCDI: 'Music CD identifier', USER: 'Terms of use', OWNE: 'Ownership', COMR: 'Commercial frame',
};

const ID3V22_MAP: Record<string, string> = {
  TT1: 'TIT1', TT2: 'TIT2', TT3: 'TIT3', TP1: 'TPE1', TP2: 'TPE2', TP3: 'TPE3', TP4: 'TPE4', TAL: 'TALB', TYE: 'TYER', TDA: 'TDAT', TIM: 'TIME',
  TRK: 'TRCK', TPA: 'TPOS', TCO: 'TCON', TCM: 'TCOM', TXT: 'TEXT', TCR: 'TCOP', TPB: 'TPUB', TEN: 'TENC', TSS: 'TSSE', TLA: 'TLAN', TBP: 'TBPM',
  TKE: 'TKEY', TLE: 'TLEN', TMT: 'TMED', TOT: 'TOAL', TOA: 'TOPE', TOL: 'TOLY', TRC: 'TSRC', TOR: 'TORY', TRD: 'TRDA', TFT: 'TFLT', TOF: 'TOFN',
  TXX: 'TXXX', COM: 'COMM', ULT: 'USLT', PIC: 'APIC', WAF: 'WOAF', WAR: 'WOAR', WAS: 'WOAS', WCM: 'WCOM', WCP: 'WCOP', WPB: 'WPUB', WXX: 'WXXX',
  UFI: 'UFID', POP: 'POPM', CNT: 'PCNT', GEO: 'GEOB', MCI: 'MCDI', IPL: 'TIPL', CRM: 'CRM', SLT: 'SYLT',
};

const PIC_TYPES = [
  'Other', 'File icon', 'Other file icon', 'Front cover', 'Back cover', 'Leaflet page', 'Media', 'Lead artist', 'Artist', 'Conductor', 'Band',
  'Composer', 'Lyricist', 'Recording location', 'During recording', 'During performance', 'Video capture', 'A bright coloured fish', 'Illustration',
  'Band logo', 'Publisher logo',
];

export function pictureTypeName(n: number): string {
  return PIC_TYPES[n] ?? `Type ${n}`;
}

interface Id3Frame {
  id: string;
  data: Uint8Array;
  note?: string;
}

interface Id3Tag {
  version: string;
  major: number;
  flags: number;
  totalSize: number;
  frames: Id3Frame[];
  padding: number;
  unsync: boolean;
  hasExt: boolean;
  footer: boolean;
}

function syncsafe(b: Uint8Array, o: number): number {
  return ((u8(b, o) & 0x7f) << 21) | ((u8(b, o + 1) & 0x7f) << 14) | ((u8(b, o + 2) & 0x7f) << 7) | (u8(b, o + 3) & 0x7f);
}

function deunsync(b: Uint8Array): Uint8Array {
  const out = new Uint8Array(b.length);
  let o = 0;
  for (let i = 0; i < b.length; i++) {
    const c = b[i] ?? 0;
    out[o++] = c;
    if (c === 0xff && b[i + 1] === 0x00) i++;
  }
  return out.subarray(0, o);
}

function validFrameId(b: Uint8Array, o: number, len: number): boolean {
  for (let i = 0; i < len; i++) {
    const c = b[o + i] ?? 0;
    if (!((c >= 65 && c <= 90) || (c >= 48 && c <= 57))) return false;
  }
  return true;
}

export async function readId3v2(rd: Reader, offset = 0): Promise<Id3Tag | null> {
  const h = await rd.read(offset, 10);
  if (h.length < 10 || latin1(h, 0, 3) !== 'ID3') return null;
  const major = u8(h, 3);
  if (major < 2 || major > 4 || (u8(h, 6) | u8(h, 7) | u8(h, 8) | u8(h, 9)) & 0x80) return null;
  const flags = u8(h, 5);
  const size = syncsafe(h, 6);
  const footer = major === 4 && (flags & 0x10) !== 0;
  const total = 10 + size + (footer ? 10 : 0);
  const cap = Math.min(size, 64 * 1024 * 1024);
  let body: Uint8Array = (await rd.read(offset + 10, cap)).slice();
  const tagUnsync = (flags & 0x80) !== 0;
  if (tagUnsync && major <= 3) body = deunsync(body).slice();
  let pos = 0;
  let hasExt = false;
  if ((flags & 0x40) !== 0 && major >= 3) {
    hasExt = true;
    pos = major === 3 ? 4 + u32(body, 0) : syncsafe(body, 0);
  }
  const frames: Id3Frame[] = [];
  const idLen = major === 2 ? 3 : 4;
  const hdrLen = major === 2 ? 6 : 10;
  let padding = 0;
  while (pos + hdrLen <= body.length && frames.length < 4000) {
    if (u8(body, pos) === 0) {
      padding = body.length - pos;
      break;
    }
    if (!validFrameId(body, pos, idLen)) break;
    let id = latin1(body, pos, pos + idLen);
    let fsize: number;
    let fflags = 0;
    if (major === 2) fsize = u24(body, pos + 3);
    else if (major === 3) {
      fsize = u32(body, pos + 4);
      fflags = u16(body, pos + 8);
    } else {
      const ss = syncsafe(body, pos + 4);
      const plain = u32(body, pos + 4);
      fsize = ss;
      if (ss !== plain) {
        const nextOk = (n: number) => {
          const p = pos + 10 + n;
          return p >= body.length || u8(body, p) === 0 || validFrameId(body, p, 4);
        };
        if (!nextOk(ss) && nextOk(plain)) fsize = plain;
      }
      fflags = u16(body, pos + 8);
    }
    const start = pos + hdrLen;
    if (start + fsize > body.length) {
      if (fsize > 0 && start < body.length) frames.push({ id, data: body.subarray(start), note: 'truncated frame' });
      break;
    }
    let data: Uint8Array = body.subarray(start, start + fsize);
    let note: string | undefined;
    if (major === 2) id = ID3V22_MAP[id] ?? id;
    else if (major === 3) {
      let p = 0;
      if (fflags & 0x0080) {
        try {
          data = inflateLimited(data.subarray(4), 'zlib', 32 * 1024 * 1024).out;
        } catch {
          note = 'compressed frame could not be inflated';
        }
        p = 0;
      } else {
        if (fflags & 0x0040) note = 'encrypted frame';
        if (fflags & 0x0020) p = 1;
        data = data.subarray(p);
      }
    } else {
      let p = 0;
      if (fflags & 0x0040) p += 1;
      if (fflags & 0x0001) p += 4;
      let d: Uint8Array = data.subarray(p);
      if (fflags & 0x0004) note = 'encrypted frame';
      if (fflags & 0x0002 || tagUnsync) d = deunsync(d);
      if (fflags & 0x0008) {
        try {
          d = inflateLimited(d, 'zlib', 32 * 1024 * 1024).out;
        } catch {
          note = 'compressed frame could not be inflated';
        }
      }
      data = d;
    }
    frames.push({ id, data, note });
    pos = start + fsize;
  }
  return { version: `2.${major}.${u8(h, 4)}`, major, flags, totalSize: total, frames, padding, unsync: tagUnsync, hasExt, footer };
}

/** Find the end of a text field. Returns [textEnd, nextStart]. */
function termIndex(b: Uint8Array, start: number, enc: number): [number, number] {
  if (enc === 1 || enc === 2) {
    for (let i = start; i + 1 < b.length; i += 2) if (b[i] === 0 && b[i + 1] === 0) return [i, i + 2];
    return [b.length, b.length];
  }
  for (let i = start; i < b.length; i++) if (b[i] === 0) return [i, i + 1];
  return [b.length, b.length];
}

function decodeId3Text(enc: number, b: Uint8Array): string {
  switch (enc) {
    case 0:
      return latin1(b);
    case 1:
      return utf16Bom(b, true);
    case 2:
      return utf16(b, false);
    default:
      return utf8(b);
  }
}

function splitStrings(enc: number, b: Uint8Array): string[] {
  const out: string[] = [];
  let pos = 0;
  while (pos <= b.length) {
    const [e, n] = termIndex(b, pos, enc);
    const s = decodeId3Text(enc, b.subarray(pos, e)).replace(/\u0000/g, '');
    if (s !== '' || out.length === 0) out.push(s);
    if (n >= b.length) break;
    pos = n;
  }
  return out.filter((s) => s !== '');
}

export interface Id3Summary {
  title?: string;
  artist?: string;
}

/** Emit an "ID3 tag" section from a parsed v2 tag. */
export function emitId3v2(c: Collector, tag: Id3Tag, sectionId = 'id3v2'): void {
  const sec = c.section(sectionId, `ID3v2.${tag.major} tag`);
  c.row(sec, 'Tag version', `ID3v${tag.version}`);
  c.row(sec, 'Tag size', `${tag.totalSize.toLocaleString('en-US')} bytes${tag.padding ? ` (${tag.padding.toLocaleString('en-US')} bytes padding)` : ''}`);
  const flagNames: string[] = [];
  if (tag.unsync) flagNames.push('unsynchronisation');
  if (tag.hasExt) flagNames.push('extended header');
  if (tag.footer) flagNames.push('footer');
  if (flagNames.length) c.row(sec, 'Tag flags', flagNames.join(', '));
  let covers = 0;
  const unknown: string[] = [];
  for (const f of tag.frames) {
    const id = f.id;
    const d = f.data;
    if (f.note) {
      c.row(sec, `${ID3_NAMES[id] ?? id} (${id})`, `(${f.note})`);
      continue;
    }
    try {
      if (id === 'TXXX') {
        const enc = u8(d, 0);
        const [e, n] = termIndex(d, 1, enc);
        const desc = decodeId3Text(enc, d.subarray(1, e)).trim() || '(no description)';
        const val = splitStrings(enc, d.subarray(n)).join(' / ');
        c.row(sec, `Custom text: ${desc}`, val);
        if (/^(replaygain_.*|iTunNORM|iTunSMPB|MusicBrainz.*|ALBUMARTISTSORT|ASIN|BARCODE)$/i.test(desc)) continue;
        if (/owner|purchaser|account|email|e-mail|user/i.test(desc)) c.find('person', `ID3 custom text "${desc}"`, val);
      } else if (id[0] === 'T') {
        const enc = u8(d, 0);
        let vals = splitStrings(enc, d.subarray(1));
        if (id === 'TCON') vals = vals.map(parseGenre);
        const text = vals.join(id === 'TCON' || ID3_NAMES[id] === undefined ? ' / ' : ' / ');
        c.row(sec, ID3_NAMES[id] ?? id, text);
        if (id === 'TENC' || id === 'TSSE') c.find('software', `ID3 ${ID3_NAMES[id]}`, text);
        else if (id === 'TOWN') c.find('person', 'File owner (ID3 TOWN)', text);
        else if (id === 'TOFN') c.find('filename', 'Original file name (ID3 TOFN)', text);
      } else if (id === 'WXXX') {
        const enc = u8(d, 0);
        const [e, n] = termIndex(d, 1, enc);
        c.row(sec, `Custom URL: ${decodeId3Text(enc, d.subarray(1, e)) || '(no description)'}`, latin1(d, n).replace(/\u0000+$/, ''));
      } else if (id[0] === 'W') {
        c.row(sec, ID3_NAMES[id] ?? id, latin1(d).replace(/\u0000+$/, ''));
      } else if (id === 'COMM' || id === 'USLT') {
        const enc = u8(d, 0);
        const lang = latin1(d, 1, 4);
        const [e, n] = termIndex(d, 4, enc);
        const desc = decodeId3Text(enc, d.subarray(4, e)).trim();
        const text = decodeId3Text(enc, d.subarray(n)).replace(/\u0000+$/, '').trim();
        const label = id === 'COMM' ? 'Comment' : 'Lyrics (unsynchronised)';
        const tag2 = [desc, lang && lang !== '\u0000\u0000\u0000' ? lang : ''].filter(Boolean).join(', ');
        c.row(sec, tag2 ? `${label} (${tag2})` : label, text.length > 3000 ? `${text.slice(0, 3000)}… (${text.length} chars)` : text);
        if (id === 'COMM' && text && !/^(0|\s*)$/.test(text) && !/^[0-9A-F]{8}( [0-9A-F]{8}){9}$/i.test(text) && !/^iTun/.test(desc)) c.find('comments', 'ID3 comment', text.length > 200 ? `${text.slice(0, 200)}…` : text);
      } else if (id === 'APIC') {
        covers++;
        const enc = u8(d, 0);
        let mime: string;
        let p: number;
        if (tag.major === 2) {
          mime = `image/${latin1(d, 1, 4).toLowerCase().replace('jpg', 'jpeg')}`;
          p = 4;
        } else {
          const [e, n] = termIndex(d, 1, 0);
          mime = latin1(d, 1, e).toLowerCase();
          p = n;
        }
        const ptype = u8(d, p);
        const [de, dn] = termIndex(d, p + 1, enc);
        const desc = decodeId3Text(enc, d.subarray(p + 1, de)).trim();
        const img = d.subarray(dn);
        const realMime = imageMime(img) ?? (mime.startsWith('image/') ? mime : 'image/jpeg');
        c.row(sec, `Picture ${covers}: ${pictureTypeName(ptype)}`, `${realMime} · ${img.length.toLocaleString('en-US')} bytes${desc ? ` · "${desc}"` : ''}`);
        if (covers <= 4) c.preview(`Embedded picture: ${pictureTypeName(ptype)}`, realMime, img.slice());
      } else if (id === 'PRIV') {
        const [e, n] = termIndex(d, 0, 0);
        const owner = latin1(d, 0, e);
        c.row(sec, `Private data: ${owner}`, `${(d.length - n).toLocaleString('en-US')} bytes`);
        if (owner) c.find('other', 'ID3 private frame (PRIV)', owner);
      } else if (id === 'UFID') {
        const [e, n] = termIndex(d, 0, 0);
        c.row(sec, `Unique file ID: ${latin1(d, 0, e)}`, d.length - n <= 64 ? textSmart(d.subarray(n)) : `${d.length - n} bytes`);
      } else if (id === 'POPM') {
        const [e, n] = termIndex(d, 0, 0);
        const email = latin1(d, 0, e);
        c.row(sec, 'Popularimeter', `${email ? `${email} · ` : ''}rating ${u8(d, n)}/255`);
        if (email) c.find('person', 'Rating e-mail (ID3 POPM)', email);
      } else if (id === 'PCNT') {
        c.row(sec, 'Play counter', String(d.length >= 4 ? u32(d, 0) : 0));
      } else if (id === 'GEOB') {
        const enc = u8(d, 0);
        const [me, mn] = termIndex(d, 1, 0);
        const [fe, fn] = termIndex(d, mn, enc);
        const fname = decodeId3Text(enc, d.subarray(mn, fe)).trim();
        c.row(sec, 'Encapsulated object', `${latin1(d, 1, me)}${fname ? ` · ${fname}` : ''} · ${(d.length - fn).toLocaleString('en-US')} bytes`);
        if (fname) c.find('filename', 'Embedded object file name (ID3 GEOB)', fname);
      } else if (id === 'CHAP') {
        const [e] = termIndex(d, 0, 0);
        c.row(sec, 'Chapter', latin1(d, 0, e));
      } else if (id === 'MCDI') {
        c.row(sec, 'CD table of contents', `${d.length} bytes`);
      } else if (id === 'OWNE' || id === 'USER') {
        c.row(sec, ID3_NAMES[id] ?? id, textSmart(d.subarray(1)).replace(/\u0000/g, ' ').trim());
        c.find('person', 'Purchase / ownership info (ID3)', textSmart(d.subarray(1)).replace(/\u0000/g, ' ').trim());
      } else {
        unknown.push(`${id} (${d.length} B)`);
      }
    } catch (e) {
      c.errors.push(`could not parse ID3 frame ${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (unknown.length) c.row(sec, 'Other frames', unknown.join(', '));
}

export interface Id3v1 {
  title: string;
  artist: string;
  album: string;
  year: string;
  comment: string;
  track: number | null;
  genre: number;
}

export function parseId3v1(b: Uint8Array): Id3v1 | null {
  if (b.length < 128 || latin1(b, 0, 3) !== 'TAG') return null;
  const s = (a: number, z: number) => latin1(b, a, z).replace(/\u0000[\s\S]*$/, '').trim();
  const hasTrack = u8(b, 125) === 0 && u8(b, 126) !== 0;
  return {
    title: s(3, 33),
    artist: s(33, 63),
    album: s(63, 93),
    year: s(93, 97),
    comment: s(97, hasTrack ? 125 : 127),
    track: hasTrack ? u8(b, 126) : null,
    genre: u8(b, 127),
  };
}

function emitId3v1(c: Collector, t: Id3v1): void {
  const sec = c.section('id3v1', 'ID3v1 tag (end of file)');
  c.row(sec, 'Title', t.title);
  c.row(sec, 'Artist', t.artist);
  c.row(sec, 'Album', t.album);
  c.row(sec, 'Year', t.year);
  c.row(sec, 'Comment', t.comment);
  if (t.track !== null) c.row(sec, 'Track', String(t.track));
  c.row(sec, 'Genre', t.genre === 255 ? undefined : genreName(t.genre));
  c.row(sec, 'Version', t.track !== null ? 'ID3v1.1' : 'ID3v1.0');
  if (t.comment) c.find('comments', 'ID3v1 comment', t.comment);
}

// ---------------------------------------------------------------------------
// APEv2 (footer)
// ---------------------------------------------------------------------------

async function readApeTag(rd: Reader, endOffset: number): Promise<Array<[string, string]> | null> {
  if (endOffset < 32) return null;
  const foot = await rd.read(endOffset - 32, 32);
  if (latin1(foot, 0, 8) !== 'APETAGEX') return null;
  const tagSize = u32(foot, 12, true);
  const count = u32(foot, 16, true);
  const flags = u32(foot, 20, true);
  if (tagSize < 32 || tagSize > 8 * 1024 * 1024) return null;
  const hasHeader = (flags & 0x80000000) !== 0;
  const itemsStart = endOffset - tagSize;
  const body = await rd.read(itemsStart, tagSize - 32);
  void hasHeader;
  const items: Array<[string, string]> = [];
  let p = 0;
  for (let i = 0; i < count && p + 8 < body.length; i++) {
    const vsize = u32(body, p, true);
    const iflags = u32(body, p + 4, true);
    let e = p + 8;
    while (e < body.length && body[e] !== 0) e++;
    const key = latin1(body, p + 8, e);
    const val = body.subarray(e + 1, e + 1 + vsize);
    if (((iflags >> 1) & 3) === 0) items.push([key, utf8(val).replace(/\u0000/g, ' / ')]);
    else items.push([key, `(binary, ${vsize.toLocaleString('en-US')} bytes)`]);
    p = e + 1 + vsize;
  }
  return items;
}

// ---------------------------------------------------------------------------
// MP3
// ---------------------------------------------------------------------------

const MPEG_VERSIONS: Record<number, string> = { 0: 'MPEG 2.5', 2: 'MPEG 2', 3: 'MPEG 1' };
const BITRATES: Record<string, number[]> = {
  '3-1': [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  '3-2': [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  '3-3': [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  '2-1': [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  '2-2': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  '2-3': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const SAMPLE_RATES: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
const CHANNEL_MODES = ['Stereo', 'Joint stereo', 'Dual channel', 'Mono (single channel)'];

interface MpegHeader {
  versionId: number;
  layer: number;
  protection: boolean;
  bitrate: number;
  sampleRate: number;
  padding: boolean;
  channelMode: number;
  frameLength: number;
  samplesPerFrame: number;
  headerLen: number;
}

function parseMpegHeader(b: Uint8Array, o: number): MpegHeader | null {
  if (u8(b, o) !== 0xff || (u8(b, o + 1) & 0xe0) !== 0xe0) return null;
  const versionId = (u8(b, o + 1) >> 3) & 3;
  const layerBits = (u8(b, o + 1) >> 1) & 3;
  if (versionId === 1 || layerBits === 0) return null;
  const layer = 4 - layerBits;
  const brIdx = u8(b, o + 2) >> 4;
  const srIdx = (u8(b, o + 2) >> 2) & 3;
  if (brIdx === 0 || brIdx === 15 || srIdx === 3) return null;
  const key = `${versionId === 3 ? 3 : 2}-${layer}`;
  const bitrate = (BITRATES[key]?.[brIdx] ?? 0) * 1000;
  const sampleRate = SAMPLE_RATES[versionId]?.[srIdx] ?? 0;
  if (!bitrate || !sampleRate) return null;
  const padding = ((u8(b, o + 2) >> 1) & 1) === 1;
  let frameLength: number;
  let samplesPerFrame: number;
  if (layer === 1) {
    frameLength = (Math.floor((12 * bitrate) / sampleRate) + (padding ? 1 : 0)) * 4;
    samplesPerFrame = 384;
  } else if (layer === 2 || versionId === 3) {
    frameLength = Math.floor((144 * bitrate) / sampleRate) + (padding ? 1 : 0);
    samplesPerFrame = 1152;
  } else {
    frameLength = Math.floor((72 * bitrate) / sampleRate) + (padding ? 1 : 0);
    samplesPerFrame = 576;
  }
  return {
    versionId,
    layer,
    protection: ((u8(b, o + 1) & 1) === 0),
    bitrate,
    sampleRate,
    padding,
    channelMode: u8(b, o + 3) >> 6,
    frameLength,
    samplesPerFrame,
    headerLen: 4,
  };
}

export async function parseMp3(c: Ctx): Promise<void> {
  const { rd, size, out } = c;
  const audio = out.section('audio', 'Audio stream');
  let start = 0;
  let id3Total = 0;
  const tag = await readId3v2(rd, 0);
  if (tag) {
    id3Total = tag.totalSize;
    start = tag.totalSize;
    await out.attempt('ID3v2 tag', () => emitId3v2(out, tag));
  }
  // trailing tags
  let end = size;
  const tail = await rd.read(Math.max(0, size - 128), 128);
  const v1 = size >= 128 ? parseId3v1(tail) : null;
  if (v1) {
    end -= 128;
    emitId3v1(out, v1);
  }
  const ape = await readApeTag(rd, end).catch(() => null);
  if (ape && ape.length) {
    const sec = out.section('ape', 'APEv2 tag (end of file)');
    for (const [k, v] of ape) out.row(sec, k, v);
  }
  // first MPEG frame
  const win = await rd.read(start, 256 * 1024);
  let found = -1;
  let hdr: MpegHeader | null = null;
  for (let i = 0; i + 4 < win.length; i++) {
    if (win[i] !== 0xff) continue;
    const h = parseMpegHeader(win, i);
    if (!h) continue;
    const next = i + h.frameLength;
    if (next + 4 <= win.length) {
      const h2 = parseMpegHeader(win, next);
      if (!h2 || h2.versionId !== h.versionId || h2.layer !== h.layer || h2.sampleRate !== h.sampleRate) continue;
    }
    found = i;
    hdr = h;
    break;
  }
  if (!hdr || found < 0) {
    out.errors.push('could not parse MPEG audio: no valid frame header found near the start of the audio data');
    return;
  }
  const audioStart = start + found;
  out.row(audio, 'Format', `${MPEG_VERSIONS[hdr.versionId]} Layer ${'I'.repeat(Math.min(hdr.layer, 3)).replace('III', 'III')}`.replace('Layer IIII', 'Layer III'));
  out.row(audio, 'Sample rate', `${hdr.sampleRate.toLocaleString('en-US')} Hz`);
  out.row(audio, 'Channel mode', CHANNEL_MODES[hdr.channelMode]);
  out.row(audio, 'CRC protection', hdr.protection ? 'yes' : 'no');
  const hasCrc = hdr.protection ? 2 : 0;
  const side = hdr.versionId === 3 ? (hdr.channelMode === 3 ? 17 : 32) : hdr.channelMode === 3 ? 9 : 17;
  const xo = found + 4 + hasCrc + side;
  const tagId = latin1(win, xo, xo + 4);
  let frames: number | null = null;
  let bytes: number | null = null;
  let vbr = false;
  if (tagId === 'Xing' || tagId === 'Info') {
    vbr = tagId === 'Xing';
    const fl = u32(win, xo + 4);
    let p = xo + 8;
    if (fl & 1) { frames = u32(win, p); p += 4; }
    if (fl & 2) { bytes = u32(win, p); p += 4; }
    if (fl & 4) p += 100;
    if (fl & 8) p += 4;
    const enc = latin1(win, p, p + 9);
    if (/^(LAME|Lavf|Lavc|GOGO|L3.99|ENC|Xing)/.test(enc)) {
      out.row(audio, 'Encoder', enc.replace(/[^\x20-\x7e]/g, '').trim());
      out.find('software', 'Audio encoder', enc.replace(/[^\x20-\x7e]/g, '').trim());
      const method = u8(win, p + 9) & 15;
      const names: Record<number, string> = { 1: 'CBR', 2: 'ABR', 3: 'VBR (old)', 4: 'VBR (mtrh)', 5: 'VBR (mt)', 6: 'VBR (new)', 8: 'CBR (2-pass)', 9: 'ABR (2-pass)' };
      if (names[method]) out.row(audio, 'Encoding method (LAME)', names[method]);
      const lowpass = u8(win, p + 10);
      if (lowpass) out.row(audio, 'Low-pass filter', `${lowpass * 100} Hz`);
    }
    out.row(audio, 'Xing/Info header', tagId === 'Xing' ? 'Xing (VBR)' : 'Info (CBR)');
  } else if (latin1(win, found + 4 + 32, found + 4 + 36) === 'VBRI') {
    vbr = true;
    const o = found + 4 + 32;
    bytes = u32(win, o + 10);
    frames = u32(win, o + 14);
    out.row(audio, 'VBRI header', 'Fraunhofer VBR');
  }
  const audioBytes = Math.max(0, end - audioStart);
  let duration: number | null = null;
  if (frames !== null && frames > 0) duration = (frames * hdr.samplesPerFrame) / hdr.sampleRate;
  else if (!vbr) duration = (audioBytes * 8) / hdr.bitrate;
  if (vbr) {
    out.row(audio, 'Bitrate mode', 'Variable (VBR)');
    if (duration) out.row(audio, 'Average bitrate', `${Math.round(((bytes ?? audioBytes) * 8) / duration / 1000)} kbps`);
  } else {
    out.row(audio, 'Bitrate', `${hdr.bitrate / 1000} kbps (constant)`);
  }
  if (frames !== null) out.row(audio, 'Frames', frames.toLocaleString('en-US'));
  if (duration !== null) out.row(audio, 'Duration', `${fmtDuration(duration)}${frames === null ? ' · estimated from file size' : ''}`);
  out.row(audio, 'Audio data starts at', `byte ${audioStart.toLocaleString('en-US')}`);
  if (id3Total === 0 && !v1 && !ape?.length) out.note('No ID3 or APE tags found in this MP3.');
}

// ---------------------------------------------------------------------------
// Vorbis comments + FLAC
// ---------------------------------------------------------------------------

export interface VorbisComments {
  vendor: string;
  entries: Array<[string, string]>;
}

export function parseVorbisComments(b: Uint8Array, offset = 0): VorbisComments {
  let p = offset;
  const vlen = u32(b, p, true);
  p += 4;
  const vendor = utf8(b.subarray(p, p + vlen));
  p += vlen;
  const n = u32(b, p, true);
  p += 4;
  const entries: Array<[string, string]> = [];
  for (let i = 0; i < n && p + 4 <= b.length; i++) {
    const len = u32(b, p, true);
    p += 4;
    if (p + len > b.length) break;
    const s = utf8(b.subarray(p, p + len));
    p += len;
    const eq = s.indexOf('=');
    if (eq > 0) entries.push([s.slice(0, eq).toUpperCase(), s.slice(eq + 1)]);
  }
  return { vendor, entries };
}

function parsePictureBlock(b: Uint8Array): { type: number; mime: string; desc: string; width: number; height: number; depth: number; data: Uint8Array } | null {
  if (b.length < 32) return null;
  let p = 0;
  const type = u32(b, p);
  p += 4;
  const ml = u32(b, p);
  p += 4;
  const mime = latin1(b, p, p + ml);
  p += ml;
  const dl = u32(b, p);
  p += 4;
  const desc = utf8(b.subarray(p, p + dl));
  p += dl;
  const width = u32(b, p);
  const height = u32(b, p + 4);
  const depth = u32(b, p + 8);
  p += 20;
  const dlen = u32(b, p);
  p += 4;
  return { type, mime, desc, width, height, depth, data: b.subarray(p, p + dlen) };
}

const VORBIS_LABELS: Record<string, string> = {
  TITLE: 'Title', ARTIST: 'Artist', ALBUM: 'Album', ALBUMARTIST: 'Album artist', DATE: 'Date', YEAR: 'Year', TRACKNUMBER: 'Track', TRACKTOTAL: 'Track total',
  DISCNUMBER: 'Disc', GENRE: 'Genre', COMMENT: 'Comment', DESCRIPTION: 'Description', COMPOSER: 'Composer', PERFORMER: 'Performer', ENCODER: 'Encoder',
  COPYRIGHT: 'Copyright', LICENSE: 'License', ORGANIZATION: 'Organization', ISRC: 'ISRC', LYRICS: 'Lyrics', CONTACT: 'Contact', LOCATION: 'Location', VERSION: 'Version',
};

function emitVorbis(c: Collector, vc: VorbisComments, id = 'vorbis', title = 'Vorbis comments'): void {
  const sec = c.section(id, title);
  c.row(sec, 'Vendor', vc.vendor);
  if (vc.vendor) c.find('software', 'Encoder vendor', vc.vendor);
  let pics = 0;
  for (const [k, v] of vc.entries) {
    if (k === 'METADATA_BLOCK_PICTURE') {
      try {
        const pic = parsePictureBlock(fromBase64(v));
        if (pic) {
          pics++;
          const mime = imageMime(pic.data) ?? pic.mime;
          c.row(sec, `Picture ${pics}: ${pictureTypeName(pic.type)}`, `${mime} · ${pic.width}×${pic.height} · ${pic.data.length.toLocaleString('en-US')} bytes`);
          if (pics <= 4) c.preview(`Embedded picture: ${pictureTypeName(pic.type)}`, mime, pic.data.slice());
        }
      } catch {
        c.row(sec, k, '(unreadable picture block)');
      }
      continue;
    }
    c.row(sec, VORBIS_LABELS[k] ?? k, v.length > 3000 ? `${v.slice(0, 3000)}… (${v.length} chars)` : v);
    if (k === 'ENCODER') c.find('software', 'Encoder', v);
    else if (k === 'ENCODED-BY' || k === 'ENCODED_BY') c.find('software', 'Encoded by', v);
    else if (k === 'COMMENT' || k === 'DESCRIPTION') c.find('comments', `Vorbis ${k.toLowerCase()}`, v.length > 200 ? `${v.slice(0, 200)}…` : v);
    else if (k === 'CONTACT' || k === 'LOCATION') c.find(k === 'LOCATION' ? 'gps' : 'person', `Vorbis ${k.toLowerCase()}`, v);
  }
}

export async function parseFlac(c: Ctx): Promise<void> {
  const { rd, size, out } = c;
  let off = 0;
  const id3 = await readId3v2(rd, 0);
  if (id3) {
    off = id3.totalSize;
    emitId3v2(out, id3);
  }
  const marker = await readExact(rd, off, 4);
  if (latin1(marker, 0, 4) !== 'fLaC') throw new Error('"fLaC" marker not found');
  off += 4;
  const audio = out.section('audio', 'Audio stream');
  const blocks: string[] = [];
  let pics = 0;
  const NAMES = ['STREAMINFO', 'PADDING', 'APPLICATION', 'SEEKTABLE', 'VORBIS_COMMENT', 'CUESHEET', 'PICTURE'];
  let last = false;
  let sampleRate = 0;
  let totalSamples = 0;
  for (let guard = 0; !last && guard < 200; guard++) {
    const h = await rd.read(off, 4);
    if (h.length < 4) break;
    last = (h[0] ?? 0) >= 0x80;
    const type = (h[0] ?? 0) & 0x7f;
    const len = u24(h, 1);
    const body = len <= 64 * 1024 * 1024 ? await rd.read(off + 4, len) : new Uint8Array(0);
    blocks.push(`${NAMES[type] ?? `type ${type}`} (${fmtBytes(len)})`);
    if (type === 0 && body.length >= 34) {
      sampleRate = (u8(body, 10) << 12) | (u8(body, 11) << 4) | (u8(body, 12) >> 4);
      const channels = ((u8(body, 12) >> 1) & 7) + 1;
      const bps = (((u8(body, 12) & 1) << 4) | (u8(body, 13) >> 4)) + 1;
      totalSamples = (u8(body, 13) & 15) * 4294967296 + u32(body, 14);
      out.row(audio, 'Format', 'FLAC (lossless)');
      out.row(audio, 'Sample rate', `${sampleRate.toLocaleString('en-US')} Hz`);
      out.row(audio, 'Channels', String(channels));
      out.row(audio, 'Bits per sample', String(bps));
      out.row(audio, 'Total samples', totalSamples ? totalSamples.toLocaleString('en-US') : 'unknown');
      out.row(audio, 'Block size', `${u16(body, 0)}–${u16(body, 2)} samples`);
      const md5 = body.subarray(18, 34);
      out.row(audio, 'Audio MD5 signature', md5.some((x) => x !== 0) ? toHex(md5) : '(not set)');
    } else if (type === 4) {
      await out.attempt('Vorbis comments', () => emitVorbis(out, parseVorbisComments(body)));
    } else if (type === 6) {
      await out.attempt('FLAC picture', () => {
        const pic = parsePictureBlock(body);
        if (!pic) return;
        pics++;
        const mime = imageMime(pic.data) ?? pic.mime;
        const sec = out.section('flac-pictures', 'Embedded pictures');
        out.row(sec, `Picture ${pics}: ${pictureTypeName(pic.type)}`, `${mime} · ${pic.width}×${pic.height} · ${pic.depth}-bit · ${pic.data.length.toLocaleString('en-US')} bytes${pic.desc ? ` · "${pic.desc}"` : ''}`);
        if (pics <= 4) out.preview(`Embedded picture: ${pictureTypeName(pic.type)}`, mime, pic.data.slice());
      });
    } else if (type === 2 && body.length >= 4) {
      out.row(audio, 'Application block', `${latin1(body, 0, 4)} (${len} bytes)`);
    } else if (type === 5) {
      out.row(audio, 'Cue sheet', 'present');
    }
    off += 4 + len;
  }
  out.row(audio, 'Metadata blocks', blocks.join(', '));
  if (sampleRate && totalSamples) {
    const dur = totalSamples / sampleRate;
    out.row(audio, 'Duration', fmtDuration(dur));
    out.row(audio, 'Average bitrate', `${Math.round(((size - off) * 8) / dur / 1000)} kbps`);
  }
}

// ---------------------------------------------------------------------------
// Ogg
// ---------------------------------------------------------------------------

interface OggStream {
  serial: number;
  packets: Uint8Array[];
  partial: Uint8Array[];
  codec: string;
}

export async function parseOgg(c: Ctx): Promise<void> {
  const { rd, size, out } = c;
  const audio = out.section('audio', 'Audio stream');
  const streams = new Map<number, OggStream>();
  let off = 0;
  const limit = Math.min(size, 24 * 1024 * 1024);
  let pages = 0;
  let needMore = true;
  while (off + 27 <= limit && needMore && pages < 20000) {
    const h = await rd.read(off, 27);
    if (h.length < 27 || latin1(h, 0, 4) !== 'OggS') break;
    pages++;
    const nseg = u8(h, 26);
    const segs = await rd.read(off + 27, nseg);
    let dataLen = 0;
    for (let i = 0; i < nseg; i++) dataLen += segs[i] ?? 0;
    const data = await rd.read(off + 27 + nseg, dataLen);
    const serial = u32(h, 14, true);
    let st = streams.get(serial);
    if (!st) {
      st = { serial, packets: [], partial: [], codec: '' };
      streams.set(serial, st);
    }
    const flags = u8(h, 5);
    if (!(flags & 1) && st.partial.length) st.partial = [];
    let pos = 0;
    for (let i = 0; i < nseg; i++) {
      const l = segs[i] ?? 0;
      st.partial.push(data.subarray(pos, pos + l));
      pos += l;
      if (l < 255) {
        st.packets.push(concat(st.partial));
        st.partial = [];
      }
    }
    if (st.packets.length === 1 && !st.codec) {
      const p0 = st.packets[0] ?? new Uint8Array(0);
      if (u8(p0, 0) === 1 && latin1(p0, 1, 7) === 'vorbis') st.codec = 'vorbis';
      else if (latin1(p0, 0, 8) === 'OpusHead') st.codec = 'opus';
      else if (u8(p0, 0) === 0x7f && latin1(p0, 1, 5) === 'FLAC') st.codec = 'flac';
      else if (latin1(p0, 0, 8) === 'Speex   ') st.codec = 'speex';
      else if (u8(p0, 0) === 0x80 && latin1(p0, 1, 7) === 'theora') st.codec = 'theora';
      else if (latin1(p0, 0, 8) === 'fishead\0') st.codec = 'skeleton';
      else st.codec = 'unknown';
    }
    off += 27 + nseg + dataLen;
    needMore = Array.from(streams.values()).some((s) => s.codec !== 'skeleton' && (s.codec === '' || (s.codec === 'vorbis' && s.packets.length < 2) || (s.codec === 'opus' && s.packets.length < 2) || (s.codec === 'flac' && s.packets.length < 2) || (s.codec === 'speex' && s.packets.length < 2) || (s.codec === 'theora' && s.packets.length < 2)));
    if (pages > 200 && !needMore) break;
  }
  if (streams.size === 0) throw new Error('no Ogg pages found');
  // duration: last page granule position
  const tail = await rd.read(Math.max(0, size - 128 * 1024), 128 * 1024);
  const lastGranule = new Map<number, number>();
  for (let i = tail.length - 27; i >= 0; i--) {
    if (tail[i] === 0x4f && tail[i + 1] === 0x67 && tail[i + 2] === 0x67 && tail[i + 3] === 0x53) {
      const serial = u32(tail, i + 14, true);
      if (!lastGranule.has(serial)) {
        const g = u64(tail, i + 6, true);
        const hi = u32(tail, i + 10, true);
        if (hi !== 0xffffffff) lastGranule.set(serial, g);
      }
      if (lastGranule.size >= streams.size) break;
    }
  }
  let idx = 0;
  for (const st of streams.values()) {
    idx++;
    const p0 = st.packets[0] ?? new Uint8Array(0);
    const granule = lastGranule.get(st.serial);
    const prefix = streams.size > 1 ? `Stream ${idx}: ` : '';
    if (st.codec === 'vorbis') {
      const rate = u32(p0, 12, true);
      out.row(audio, `${prefix}Codec`, 'Vorbis');
      out.row(audio, `${prefix}Channels`, String(u8(p0, 11)));
      out.row(audio, `${prefix}Sample rate`, `${rate.toLocaleString('en-US')} Hz`);
      const nominal = u32(p0, 20, true);
      const maxb = u32(p0, 16, true) | 0;
      const minb = u32(p0, 24, true) | 0;
      if (nominal) out.row(audio, `${prefix}Nominal bitrate`, `${Math.round(nominal / 1000)} kbps${maxb > 0 ? ` (max ${Math.round(maxb / 1000)})` : ''}${minb > 0 ? ` (min ${Math.round(minb / 1000)})` : ''}`);
      if (granule !== undefined && rate) out.row(audio, `${prefix}Duration`, fmtDuration(granule / rate));
      const cp = st.packets[1];
      if (cp && u8(cp, 0) === 3) await out.attempt('Vorbis comments', () => emitVorbis(out, parseVorbisComments(cp, 7)));
    } else if (st.codec === 'opus') {
      const pre = u16(p0, 10, true);
      out.row(audio, `${prefix}Codec`, 'Opus');
      out.row(audio, `${prefix}Channels`, String(u8(p0, 9)));
      const inRate = u32(p0, 12, true);
      if (inRate) out.row(audio, `${prefix}Original input sample rate`, `${inRate.toLocaleString('en-US')} Hz`);
      out.row(audio, `${prefix}Pre-skip`, `${pre} samples`);
      if (granule !== undefined) out.row(audio, `${prefix}Duration`, fmtDuration(Math.max(0, granule - pre) / 48000));
      const cp = st.packets[1];
      if (cp && latin1(cp, 0, 8) === 'OpusTags') await out.attempt('Opus tags', () => emitVorbis(out, parseVorbisComments(cp, 8), 'vorbis', 'Opus tags'));
    } else if (st.codec === 'flac') {
      out.row(audio, `${prefix}Codec`, 'FLAC in Ogg');
      const si = p0.subarray(13);
      const rate = (u8(si, 14) << 12) | (u8(si, 15) << 4) | (u8(si, 16) >> 4);
      out.row(audio, `${prefix}Sample rate`, `${rate.toLocaleString('en-US')} Hz`);
      out.row(audio, `${prefix}Channels`, String(((u8(si, 16) >> 1) & 7) + 1));
      if (granule !== undefined && rate) out.row(audio, `${prefix}Duration`, fmtDuration(granule / rate));
      const cp = st.packets[1];
      if (cp && (u8(cp, 0) & 0x7f) === 4) await out.attempt('Vorbis comments', () => emitVorbis(out, parseVorbisComments(cp, 4)));
    } else if (st.codec === 'speex') {
      out.row(audio, `${prefix}Codec`, 'Speex');
      out.row(audio, `${prefix}Sample rate`, `${u32(p0, 36, true)} Hz`);
      out.row(audio, `${prefix}Channels`, String(u32(p0, 48, true)));
      const cp = st.packets[1];
      if (cp) await out.attempt('Speex comments', () => emitVorbis(out, parseVorbisComments(cp, 0)));
    } else if (st.codec === 'theora') {
      out.row(audio, `${prefix}Codec`, 'Theora video');
      out.row(audio, `${prefix}Frame size`, `${u24(p0, 14)} × ${u24(p0, 17)} px`);
      const fn = u32(p0, 22);
      const fd = u32(p0, 26);
      if (fn && fd) out.row(audio, `${prefix}Frame rate`, `${fmtNum(fn / fd, 3)} fps`);
      const cp = st.packets[1];
      if (cp && u8(cp, 0) === 0x81) await out.attempt('Theora comments', () => emitVorbis(out, parseVorbisComments(cp, 7)));
    } else if (st.codec === 'skeleton') {
      out.row(audio, `${prefix}Codec`, 'Ogg Skeleton (metadata track)');
    } else {
      out.row(audio, `${prefix}Codec`, 'unrecognised');
    }
  }
  if (pages >= 20000) out.note('Only the first part of the file was scanned for headers.');
}

// ---------------------------------------------------------------------------
// WAV (RIFF) + AIFF
// ---------------------------------------------------------------------------

const WAV_FORMATS: Record<number, string> = {
  1: 'PCM (uncompressed)', 2: 'Microsoft ADPCM', 3: 'IEEE float', 6: 'A-law', 7: 'µ-law', 0x11: 'IMA ADPCM', 0x31: 'GSM 6.10', 0x50: 'MPEG',
  0x55: 'MPEG Layer 3 (MP3)', 0x160: 'WMA v1', 0x161: 'WMA v2', 0x162: 'WMA Pro', 0x2000: 'Dolby AC-3', 0x2001: 'DTS', 0xfffe: 'Extensible', 0x674f: 'Ogg Vorbis',
  0x706d: 'AAC', 0xf1ac: 'FLAC',
};

const INFO_NAMES: Record<string, string> = {
  IARL: 'Archival location', IART: 'Artist', ICMS: 'Commissioned by', ICMT: 'Comments', ICOP: 'Copyright', ICRD: 'Creation date', IENG: 'Engineer',
  IGNR: 'Genre', IKEY: 'Keywords', IMED: 'Medium', INAM: 'Title', IPRD: 'Product (album)', ISBJ: 'Subject', ISFT: 'Software', ISRC: 'Source',
  ISRF: 'Source form', ITCH: 'Technician', ITRK: 'Track', IPRT: 'Part', ICNT: 'Country', ILNG: 'Language', ISMP: 'SMPTE time code', IDIT: 'Digitization time',
  IAS1: 'First language', IMUS: 'Musician', IPRO: 'Producer', IWRI: 'Writer', ICNM: 'Cinematographer', IEDT: 'Editor', IDST: 'Distributor', ITIT: 'Title (alt)', ICAS: 'Default audio stream',
};

export async function parseWav(c: Ctx): Promise<void> {
  const { rd, size, out } = c;
  const audio = out.section('audio', 'Audio stream');
  const h = await readExact(rd, 0, 12);
  const riff = latin1(h, 0, 4);
  let off = 12;
  let dataSize: number | null = null;
  let byteRate = 0;
  let sampleRate = 0;
  let channels = 0;
  let bits = 0;
  let fmtTag = 0;
  let factSamples: number | null = null;
  const chunks: string[] = [];
  let guard = 0;
  const infoSec = () => out.section('wav-info', 'RIFF INFO tags');
  while (off + 8 <= size && guard++ < 5000) {
    const ch = await rd.read(off, 8);
    if (ch.length < 8) break;
    const id = fourcc(ch, 0);
    let len = u32(ch, 4, true);
    if (len === 0xffffffff && id === 'data') len = size - off - 8;
    chunks.push(`${id.trim()} (${fmtBytes(len)})`);
    const body = off + 8;
    if (id === 'fmt ') {
      const f = await rd.read(body, Math.min(len, 64));
      fmtTag = u16(f, 0, true);
      channels = u16(f, 2, true);
      sampleRate = u32(f, 4, true);
      byteRate = u32(f, 8, true);
      bits = u16(f, 14, true);
      let name = WAV_FORMATS[fmtTag] ?? `0x${fmtTag.toString(16)}`;
      if (fmtTag === 0xfffe && f.length >= 26) {
        const sub = u16(f, 24, true);
        name = `Extensible → ${WAV_FORMATS[sub] ?? `0x${sub.toString(16)}`}`;
        out.row(audio, 'Channel mask', `0x${u32(f, 20, true).toString(16)}`);
      }
      out.row(audio, 'Format', `${riff === 'RIFF' ? 'WAV' : riff} · ${name}`);
      out.row(audio, 'Channels', String(channels));
      out.row(audio, 'Sample rate', `${sampleRate.toLocaleString('en-US')} Hz`);
      out.row(audio, 'Bits per sample', bits ? String(bits) : undefined);
      out.row(audio, 'Byte rate', `${byteRate.toLocaleString('en-US')} B/s (${Math.round((byteRate * 8) / 1000)} kbps)`);
      out.row(audio, 'Block align', String(u16(f, 12, true)));
    } else if (id === 'data') {
      dataSize = len;
    } else if (id === 'fact' && len >= 4) {
      factSamples = u32(await rd.read(body, 4), 0, true);
    } else if (id === 'LIST' && len >= 4 && len < 4 * 1024 * 1024) {
      const b = await rd.read(body, len);
      const type = fourcc(b, 0);
      if (type === 'INFO') {
        const sec = infoSec();
        let p = 4;
        while (p + 8 <= b.length) {
          const sid = fourcc(b, p);
          const sl = u32(b, p + 4, true);
          const text = (utf8Strict(b.subarray(p + 8, p + 8 + sl)) ?? latin1(b, p + 8, p + 8 + sl)).replace(/\u0000+$/, '').trim();
          out.row(sec, `${INFO_NAMES[sid] ?? sid} (${sid})`, text);
          if (sid === 'ISFT') out.find('software', 'Software (RIFF INFO)', text);
          else if (sid === 'IENG' || sid === 'ITCH' || sid === 'IMUS' || sid === 'IWRI') out.find('person', `${INFO_NAMES[sid]} (RIFF INFO)`, text);
          else if (sid === 'ICMT') out.find('comments', 'Comment (RIFF INFO)', text);
          p += 8 + sl + (sl % 2);
        }
      }
    } else if (id === 'bext' && len >= 602 && len < 4 * 1024 * 1024) {
      const b = await rd.read(body, len);
      const sec = out.section('wav-bext', 'Broadcast Wave (bext)');
      const t = (a: number, z: number) => latin1(b, a, z).replace(/\u0000[\s\S]*$/, '').trim();
      out.row(sec, 'Description', t(0, 256));
      out.row(sec, 'Originator', t(256, 288));
      out.row(sec, 'Originator reference', t(288, 320));
      out.row(sec, 'Origination date', t(320, 330));
      out.row(sec, 'Origination time', t(330, 338));
      const tr = u64(b, 338, true);
      out.row(sec, 'Time reference', tr ? `${tr.toLocaleString('en-US')} samples since midnight` : undefined);
      out.row(sec, 'BWF version', String(u16(b, 346, true)));
      out.row(sec, 'Coding history', latin1(b, 602).replace(/\u0000[\s\S]*$/, '').trim());
      if (t(256, 288)) out.find('company', 'Originator (BWF bext)', t(256, 288));
      if (t(0, 256)) out.find('comments', 'Description (BWF bext)', t(0, 256));
    } else if (id === 'iXML' && len < 4 * 1024 * 1024) {
      const text = utf8(await rd.read(body, len)).replace(/\u0000+$/, '');
      const sec = out.section('wav-ixml', 'iXML production metadata', { collapsed: true });
      for (const tag of ['PROJECT', 'SCENE', 'TAKE', 'TAPE', 'NOTE', 'USER_NOTE']) {
        const m = new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(text);
        if (m && m[1]) out.row(sec, tag, m[1]);
      }
      sec.raw = { label: 'iXML', text: text.slice(0, 100000) };
    } else if ((id === 'id3 ' || id === 'ID3 ') && len < 64 * 1024 * 1024) {
      const t = await readId3v2(new MemReader((await rd.read(body, len)).slice()), 0);
      if (t) emitId3v2(out, t);
    } else if (id === '_PMX' && len < 8 * 1024 * 1024) {
      const pk = extractXmpPacket(await rd.read(body, len));
      if (pk) emitXmp(out, pk);
    } else if (id === 'cue ' && len >= 4) {
      out.row(audio, 'Cue points', String(u32(await rd.read(body, 4), 0, true)));
    } else if (id === 'smpl' && len >= 36) {
      const b = await rd.read(body, 36);
      out.row(audio, 'Sampler chunk', `MIDI unity note ${u32(b, 12, true)}, ${u32(b, 28, true)} loop(s)`);
    }
    off = body + len + (len % 2);
  }
  out.row(audio, 'Chunks', chunks.slice(0, 30).join(', '));
  if (dataSize !== null && byteRate > 0) {
    out.row(audio, 'Duration', fmtDuration(dataSize / byteRate));
  } else if (factSamples && sampleRate) {
    out.row(audio, 'Duration', fmtDuration(factSamples / sampleRate));
  }
  if (dataSize !== null && channels && bits && fmtTag === 1) out.row(audio, 'Sample frames', Math.floor(dataSize / (channels * (bits / 8))).toLocaleString('en-US'));
}

function ext80(b: Uint8Array, o: number): number {
  const sign = u8(b, o) & 0x80 ? -1 : 1;
  const exp = ((u8(b, o) & 0x7f) << 8) | u8(b, o + 1);
  const mant = u32(b, o + 2) * 4294967296 + u32(b, o + 6);
  if (exp === 0 && mant === 0) return 0;
  return sign * mant * Math.pow(2, exp - 16383 - 63);
}

export async function parseAiff(c: Ctx): Promise<void> {
  const { rd, size, out } = c;
  const audio = out.section('audio', 'Audio stream');
  const h = await readExact(rd, 0, 12);
  const form = latin1(h, 8, 12);
  let off = 12;
  let frames = 0;
  let rate = 0;
  const chunks: string[] = [];
  let guard = 0;
  const textChunks: Record<string, string> = { NAME: 'Title', AUTH: 'Author', '(c) ': 'Copyright', ANNO: 'Annotation' };
  while (off + 8 <= size && guard++ < 2000) {
    const ch = await rd.read(off, 8);
    if (ch.length < 8) break;
    const id = fourcc(ch, 0);
    const len = u32(ch, 4);
    const body = off + 8;
    chunks.push(`${id.trim()} (${fmtBytes(len)})`);
    if (id === 'COMM') {
      const b = await rd.read(body, Math.min(len, 64));
      const channels = u16(b, 0);
      frames = u32(b, 2);
      const bits = u16(b, 6);
      rate = ext80(b, 8);
      out.row(audio, 'Format', form === 'AIFC' ? 'AIFF-C (compressed)' : 'AIFF');
      out.row(audio, 'Channels', String(channels));
      out.row(audio, 'Sample rate', `${Math.round(rate).toLocaleString('en-US')} Hz`);
      out.row(audio, 'Bits per sample', String(bits));
      out.row(audio, 'Sample frames', frames.toLocaleString('en-US'));
      if (form === 'AIFC') out.row(audio, 'Compression', `${latin1(b, 18, 22)} · ${latin1(b, 23, 23 + u8(b, 22))}`);
    } else if (textChunks[id] !== undefined && len < 1024 * 1024) {
      const sec = out.section('aiff-text', 'AIFF text chunks');
      const t = latin1(await rd.read(body, len)).replace(/\u0000+$/, '').trim();
      out.row(sec, textChunks[id] ?? id, t);
      if (id === 'AUTH') out.find('person', 'Author (AIFF AUTH)', t);
      if (id === 'ANNO') out.find('comments', 'Annotation (AIFF ANNO)', t);
    } else if ((id === 'ID3 ' || id === 'id3 ') && len < 64 * 1024 * 1024) {
      const t = await readId3v2(new MemReader((await rd.read(body, len)).slice()), 0);
      if (t) emitId3v2(out, t);
    } else if (id === 'COMT' && len >= 2 && len < 1024 * 1024) {
      const b = await rd.read(body, len);
      out.row(audio, 'Comment records', String(u16(b, 0)));
    } else if (id === 'APPL' && len >= 4) {
      out.row(audio, 'Application-specific data', latin1(await rd.read(body, 4), 0, 4));
    }
    off = body + len + (len % 2);
  }
  out.row(audio, 'Chunks', chunks.slice(0, 30).join(', '));
  if (frames && rate) out.row(audio, 'Duration', fmtDuration(frames / rate));
}

// ---------------------------------------------------------------------------
// AAC (ADTS)
// ---------------------------------------------------------------------------

const AAC_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];

export async function parseAac(c: Ctx): Promise<void> {
  const { rd, size, out } = c;
  const audio = out.section('audio', 'Audio stream');
  const id3 = await readId3v2(rd, 0);
  const start = id3 ? id3.totalSize : 0;
  if (id3) emitId3v2(out, id3);
  const b = await rd.read(start, 16);
  if (u8(b, 0) !== 0xff || (u8(b, 1) & 0xf6) !== 0xf0) throw new Error('no ADTS frame header at the start of the audio data');
  const profile = (u8(b, 2) >> 6) & 3;
  const sr = AAC_RATES[(u8(b, 2) >> 2) & 15];
  const ch = ((u8(b, 2) & 1) << 2) | (u8(b, 3) >> 6);
  out.row(audio, 'Format', `AAC (ADTS), MPEG-${u8(b, 1) & 8 ? '2' : '4'}`);
  out.row(audio, 'Profile', ['Main', 'LC (low complexity)', 'SSR', 'LTP'][profile]);
  out.row(audio, 'Sample rate', sr ? `${sr.toLocaleString('en-US')} Hz` : undefined);
  out.row(audio, 'Channels', ch ? String(ch) : 'defined in stream');
  out.row(audio, 'Audio data', `${fmtBytes(size - start)}`);
}

