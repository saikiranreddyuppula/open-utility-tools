/**
 * File Metadata Viewer: orchestrates magic-byte detection and the per-format parsers.
 * Pure TypeScript (no DOM) so it can be unit-tested with bun.
 */
import { extensionWarning, extOf, detectBinaryType } from './magic';
import type { DetectedType, FileFacts, Hashes, Report, Row, Section, TextStats } from './types';
import {
  BlobReader,
  Collector,
  type Ctx,
  entropy,
  fmtSize,
  isoFromMs,
  latin1,
  toHex,
  textSmart,
  utf8Strict,
} from './util';
import { parseOle2, parseZip } from './parsers-docs';
import { parsePdf } from './parsers-pdf';
import { parseIso, parseMatroska } from './parsers-video';
import { parseCsv, parseHtml, parseJson, parseSvg, parseXmlDoc } from './parsers-text';
import { parse7z, parseElf, parseFont, parseGzip, parseJavaClass, parseMachO, parsePe, parseRar, parseSqlite, parseTar, parseWasm } from './parsers-misc';
import { parseAac, parseAiff, parseFlac, parseMp3, parseOgg, parseWav } from './parsers-audio';
import { parseBmp, parseGif, parseIco, parseJpeg, parsePng, parsePsd, parseTiffFile, parseWebp } from './parsers-image';

export { HASH_AUTO_LIMIT, hashBlob, sha1Hex, sha256Hex } from './hash';
export { SIGNATURE_COUNT } from './magic';
export type { Report, Section, Row, Finding, Cat, Preview, Hashes, DetectedType, TextStats } from './types';
import type { Cat } from './types';

export interface AnalyzeOptions {
  pdfFallback?: Ctx['pdfFallback'];
}

type Parser = (c: Ctx) => Promise<void>;

const PARSERS: Record<string, { label: string; run: Parser }> = {
  jpeg: { label: 'JPEG', run: parseJpeg },
  png: { label: 'PNG', run: parsePng },
  gif: { label: 'GIF', run: parseGif },
  webp: { label: 'WebP', run: parseWebp },
  tiff: { label: 'TIFF', run: parseTiffFile },
  cr2: { label: 'TIFF/CR2', run: parseTiffFile },
  bmp: { label: 'BMP', run: parseBmp },
  ico: { label: 'ICO', run: parseIco },
  cur: { label: 'CUR', run: parseIco },
  psd: { label: 'PSD', run: parsePsd },
  zip: { label: 'ZIP', run: parseZip },
  pdf: { label: 'PDF', run: parsePdf },
  mp3: { label: 'MP3', run: parseMp3 },
  flac: { label: 'FLAC', run: parseFlac },
  ogg: { label: 'Ogg', run: parseOgg },
  wav: { label: 'WAV', run: parseWav },
  aiff: { label: 'AIFF', run: parseAiff },
  aac: { label: 'AAC', run: parseAac },
  mp4: { label: 'MP4/MOV', run: parseIso },
  heic: { label: 'HEIF', run: parseIso },
  avif: { label: 'AVIF', run: parseIso },
  cr3: { label: 'CR3', run: parseIso },
  mkv: { label: 'Matroska', run: parseMatroska },
  ttf: { label: 'font', run: parseFont },
  otf: { label: 'font', run: parseFont },
  ttc: { label: 'font', run: parseFont },
  woff: { label: 'font', run: parseFont },
  woff2: { label: 'font', run: parseFont },
  gzip: { label: 'GZIP', run: parseGzip },
  tar: { label: 'TAR', run: parseTar },
  '7z': { label: '7z', run: parse7z },
  rar: { label: 'RAR', run: parseRar },
  elf: { label: 'ELF', run: parseElf },
  pe: { label: 'PE', run: parsePe },
  macho: { label: 'Mach-O', run: parseMachO },
  'macho-fat': { label: 'Mach-O', run: parseMachO },
  'java-class': { label: 'Java class', run: parseJavaClass },
  wasm: { label: 'WebAssembly', run: parseWasm },
  sqlite: { label: 'SQLite', run: parseSqlite },
  svg: { label: 'SVG', run: parseSvg },
  html: { label: 'HTML', run: parseHtml },
  xml: { label: 'XML', run: parseXmlDoc },
  json: { label: 'JSON', run: parseJson },
  csv: { label: 'CSV', run: parseCsv },
  ole2: { label: 'OLE2', run: parseOle2 },
};

// ---------------------------------------------------------------------------
// Text detection and statistics
// ---------------------------------------------------------------------------

interface TextProbe {
  isText: boolean;
  encoding: string;
  bom?: string;
  kind: 'utf8' | 'utf16le' | 'utf16be' | 'latin1' | 'ascii';
}

function probeText(b: Uint8Array): TextProbe | null {
  if (b.length === 0) return null;
  if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return { isText: true, encoding: 'UTF-8 with BOM', bom: 'EF BB BF', kind: 'utf8' };
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xfe && b[2] === 0 && b[3] === 0) return null; // UTF-32 LE: not handled
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) return { isText: true, encoding: 'UTF-16 LE (BOM)', bom: 'FF FE', kind: 'utf16le' };
  if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) return { isText: true, encoding: 'UTF-16 BE (BOM)', bom: 'FE FF', kind: 'utf16be' };
  let ctrl = 0;
  let high = 0;
  for (let i = 0; i < b.length; i++) {
    const c = b[i] ?? 0;
    if (c === 0) return null;
    if (c < 9 || (c > 13 && c < 32 && c !== 27)) ctrl++;
    else if (c >= 0x80) high++;
  }
  if (ctrl / b.length > 0.02) return null;
  // strict UTF-8 on the sample, tolerating a cut multi-byte sequence at the end
  let valid = utf8Strict(b) !== null;
  for (let cut = 1; !valid && cut <= 3 && cut < b.length; cut++) valid = utf8Strict(b.subarray(0, b.length - cut)) !== null;
  if (valid) return { isText: true, encoding: high === 0 ? 'ASCII (valid UTF-8)' : 'UTF-8 (valid, no BOM)', kind: high === 0 ? 'ascii' : 'utf8' };
  return { isText: true, encoding: 'likely Latin-1 / Windows-1252 (not valid UTF-8)', kind: 'latin1' };
}

function decodeText(b: Uint8Array, kind: TextProbe['kind']): string {
  switch (kind) {
    case 'utf16le':
      return new TextDecoder('utf-16le').decode(b);
    case 'utf16be':
      return new TextDecoder('utf-16be').decode(b);
    case 'latin1':
      return latin1(b);
    default:
      return new TextDecoder('utf-8').decode(b);
  }
}

async function textStats(c: Ctx, probe: TextProbe): Promise<TextStats> {
  const { rd, size } = c;
  const stats: TextStats = { encoding: probe.encoding, lineEndings: 'none (single line)', lines: 0 };
  if (probe.bom) stats.bom = probe.bom;
  if (size === 0) return stats;
  const FULL = 8 * 1024 * 1024;
  let crlf = 0;
  let lf = 0;
  let cr = 0;
  if (size <= FULL) {
    const bytes = (await rd.read(0, size)).slice();
    const s = decodeText(bytes, probe.kind);
    for (let i = 0; i < s.length; i++) {
      const ch = s.charCodeAt(i);
      if (ch === 13) {
        if (s.charCodeAt(i + 1) === 10) {
          crlf++;
          i++;
        } else cr++;
      } else if (ch === 10) lf++;
    }
    const terminated = s.length > 0 && (s.endsWith('\n') || s.endsWith('\r'));
    stats.lines = crlf + lf + cr + (s.length > 0 && !terminated ? 1 : 0);
    stats.chars = s.length;
    const words = s.match(/\S+/g);
    stats.words = words ? words.length : 0;
  } else if (probe.kind !== 'utf16le' && probe.kind !== 'utf16be') {
    const CHUNK = 4 * 1024 * 1024;
    const CAP = 256 * 1024 * 1024;
    let prev = 0;
    let lastByte = 0;
    let scanned = 0;
    for (let off = 0; off < Math.min(size, CAP); off += CHUNK) {
      const buf = await rd.read(off, CHUNK);
      for (let i = 0; i < buf.length; i++) {
        const ch = buf[i] ?? 0;
        if (ch === 10) {
          if (prev === 13) crlf++;
          else lf++;
        } else if (prev === 13) cr++;
        prev = ch;
      }
      lastByte = prev;
      scanned += buf.length;
      await new Promise((r) => setTimeout(r, 0));
    }
    if (prev === 13) cr++;
    stats.lines = crlf + lf + cr + (lastByte !== 10 && lastByte !== 13 && scanned > 0 ? 1 : 0);
    if (scanned < size) stats.linesApprox = true;
  } else {
    stats.lines = 0;
    stats.linesApprox = true;
  }
  const kinds: string[] = [];
  if (crlf) kinds.push(`CRLF ×${crlf}`);
  if (lf) kinds.push(`LF ×${lf}`);
  if (cr) kinds.push(`CR ×${cr}`);
  if (kinds.length === 0) stats.lineEndings = 'none (single line)';
  else if (kinds.length === 1) stats.lineEndings = crlf ? 'CRLF (Windows)' : lf ? 'LF (Unix / macOS)' : 'CR (classic Mac)';
  else stats.lineEndings = `mixed (${kinds.join(', ')})`;
  return stats;
}

const TEXT_TYPE = (id: string, name: string, mime: string, exts: string[], kind: 'text' | 'image' = 'text'): DetectedType => ({ id, name, mime, exts, kind });

const TEXT_EXTS = ['txt', 'text', 'md', 'markdown', 'log', 'ini', 'cfg', 'conf', 'yaml', 'yml', 'toml', 'sh', 'bash', 'zsh', 'bat', 'cmd', 'ps1', 'py', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'css', 'scss', 'less', 'java', 'c', 'h', 'cpp', 'hpp', 'cs', 'go', 'rs', 'rb', 'php', 'pl', 'sql', 'lua', 'swift', 'kt', 'r', 'tex', 'srt', 'vtt', 'diff', 'patch', 'env', 'gitignore', 'lock', 'properties', 'tsv', 'csv', 'json', 'xml', 'html', 'htm', 'svg', 'rtf', 'asc', 'pem', 'key', 'pub', 'crt', 'cer', 'ics', 'vcf', 'eml', 'nfo', 'rst', 'org', 'adoc', 'vue', 'svelte', 'dockerfile', 'makefile', 'cmake', 'gradle', 'tf', 'proto', 'graphql', 'gql', 'ipynb', 'geojson', 'jsonl', 'ndjson', 'har', 'map', 'webmanifest', 'plist', 'ps'];

function sniffTextType(head: Uint8Array, probe: TextProbe, ext: string): DetectedType {
  const bytes = head.subarray(0, 4096);
  const s = decodeText(bytes, probe.kind).replace(/^﻿/, '');
  const t = s.trimStart();
  const lower = t.slice(0, 600).toLowerCase();
  if (/^(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!doctype svg[^>]*>\s*)?<svg[\s>]/i.test(t) || (lower.includes('<svg') && lower.indexOf('<svg') < 400 && !lower.startsWith('<!doctype html'))) {
    return TEXT_TYPE('svg', 'SVG image', 'image/svg+xml', ['svg'], 'image');
  }
  if (lower.startsWith('<!doctype html') || /^<html[\s>]/.test(lower) || (ext === 'html' || ext === 'htm' || ext === 'xhtml') && lower.startsWith('<')) {
    return TEXT_TYPE('html', 'HTML document', 'text/html', ['html', 'htm', 'xhtml', 'shtml']);
  }
  if (lower.startsWith('<?xml') || (lower.startsWith('<') && /^<[a-z_][\w.:-]*[\s>/]/i.test(lower) && ['xml', 'xsd', 'xsl', 'xslt', 'rss', 'atom', 'kml', 'gpx', 'plist', 'opf', 'ncx', 'xaml', 'csproj', 'config', 'resx', 'wsdl', 'xliff', 'tmx', 'dae'].includes(ext))) {
    const root = /<([A-Za-z_][\w.:-]*)[\s>/]/.exec(t.replace(/<\?xml[\s\S]*?\?>/, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<!DOCTYPE[\s\S]*?>/i, ''));
    const rn = root?.[1]?.toLowerCase() ?? '';
    if (rn === 'gpx') return TEXT_TYPE('xml', 'GPX track (XML)', 'application/gpx+xml', ['gpx', 'xml']);
    if (rn === 'kml') return TEXT_TYPE('xml', 'KML placemarks (XML)', 'application/vnd.google-earth.kml+xml', ['kml', 'xml']);
    if (rn === 'html' || rn === 'xhtml') return TEXT_TYPE('html', 'XHTML document', 'application/xhtml+xml', ['xhtml', 'html', 'xml']);
    return TEXT_TYPE('xml', 'XML document', 'application/xml', ['xml', 'xsd', 'xsl', 'xslt', 'rss', 'atom', 'kml', 'gpx', 'plist', 'opf', 'ncx', 'xaml', 'config', 'resx', 'wsdl', 'xliff', 'tmx', 'dae', 'csproj']);
  }
  if ((t.startsWith('{') || t.startsWith('[')) && (ext === 'json' || ext === 'geojson' || ext === 'har' || ext === 'map' || ext === 'webmanifest' || ext === 'ipynb' || ext === 'jsonld' || ext === '' || ext === 'txt' || ext === 'jsonl' || ext === 'ndjson')) {
    return TEXT_TYPE('json', ext === 'jsonl' || ext === 'ndjson' ? 'JSON Lines' : 'JSON document', 'application/json', ['json', 'geojson', 'jsonld', 'har', 'map', 'webmanifest', 'ipynb', 'jsonl', 'ndjson']);
  }
  if (ext === 'csv' || ext === 'tsv' || ext === 'tab') return TEXT_TYPE('csv', ext === 'csv' ? 'CSV table' : 'Delimited table', ext === 'csv' ? 'text/csv' : 'text/tab-separated-values', ['csv', 'tsv', 'tab', 'txt']);
  if (t.startsWith('#!')) return TEXT_TYPE('script', 'Script (shebang)', 'text/x-shellscript', TEXT_EXTS);
  return TEXT_TYPE('text', 'Plain text', 'text/plain', TEXT_EXTS);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export interface FileLike extends Blob {
  readonly name: string;
  readonly lastModified?: number;
}

export async function analyzeFile(file: FileLike, opts: AnalyzeOptions = {}): Promise<Report> {
  const rd = new BlobReader(file);
  const size = file.size;
  const head = (await rd.read(0, 65536)).slice();
  const out = new Collector();
  const ext = extOf(file.name);
  let det: DetectedType | null = size === 0 ? null : detectBinaryType(head);
  const probe = det || size === 0 ? null : probeText(head);
  if (!det && probe) det = sniffTextType(head, probe, ext);
  const ctx: Ctx = {
    rd,
    size,
    head,
    out,
    name: file.name,
    ext,
    det,
    refine: (t) => {
      det = t;
      ctx.det = t;
    },
    pdfFallback: opts.pdfFallback,
  };

  let text: TextStats | null = null;
  if (probe) {
    try {
      text = await textStats(ctx, probe);
    } catch (e) {
      out.errors.push(`could not read text statistics: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const parser = det ? PARSERS[det.id] : undefined;
  if (parser) {
    await out.attempt(parser.label, () => parser.run(ctx));
  }
  out.dropEmpty();
  if (det && (det as DetectedType).kind === 'audio') {
    // tags first, technical stream details after them
    const audioSec = out.sections.find((s) => s.id === 'audio');
    if (audioSec) {
      const rest = out.sections.filter((s) => s !== audioSec);
      const idx = rest.reduce((acc, s, i) => (/^(id3|vorbis|ape|wav-|aiff-|flac-)/.test(s.id) ? i + 1 : acc), 0);
      rest.splice(idx, 0, audioSec);
      out.sections = rest;
    }
  }

  let ent: Report['entropy'] = null;
  try {
    if (size > 0) {
      const sample = await rd.read(0, 4 * 1024 * 1024);
      ent = { value: entropy(sample), bytes: sample.length };
    }
  } catch {
    ent = null;
  }

  const finalDet: DetectedType | null = det;
  const facts: FileFacts = {
    name: file.name,
    ext,
    size,
    mime: file.type || '',
    lastModified: typeof file.lastModified === 'number' ? file.lastModified : null,
  };
  return {
    file: facts,
    detected: finalDet,
    extensionWarning: size === 0 ? null : extensionWarning(finalDet, ext, probe !== null),
    text,
    entropy: ent,
    head64: toHex(head.subarray(0, 64)),
    sections: out.sections,
    findings: out.findings,
    errors: out.errors,
    notes: out.notes,
    previews: out.previews,
    hashes: null,
  };
}

// ---------------------------------------------------------------------------
// Presentation helpers (File section, JSON export)
// ---------------------------------------------------------------------------

export function describeEntropy(e: number): string {
  if (e > 7.9) return 'very high: compressed or encrypted data';
  if (e > 7.2) return 'high: compressed media or packed data';
  if (e > 5.5) return 'medium: typical of binary/executable data';
  if (e > 3.0) return 'low-medium: typical of text or structured data';
  return 'low: highly repetitive data';
}

export function fileRows(r: Report): Row[] {
  const rows: Row[] = [];
  const add = (k: string, v: string | null | undefined) => {
    if (v) rows.push({ k, v });
  };
  const f = r.file;
  add('Name', f.name);
  add('Extension', f.ext ? `.${f.ext}` : '(none)');
  add('Size', f.size === 0 ? '0 bytes (empty file)' : fmtSize(f.size));
  add('Browser-reported MIME', f.mime || '(none)');
  if (f.lastModified !== null) {
    const iso = isoFromMs(f.lastModified);
    add('Last modified', iso ? `${iso}  ·  ${new Date(f.lastModified).toLocaleString()}` : String(f.lastModified));
  }
  if (r.detected) add('Detected type (magic bytes)', `${r.detected.name} · ${r.detected.mime}`);
  else add('Detected type (magic bytes)', f.size === 0 ? 'none (empty file)' : 'unknown / no known signature');
  if (r.extensionWarning) add('Extension check', `MISMATCH: ${r.extensionWarning}`);
  else if (r.detected && f.ext) add('Extension check', 'extension matches the content');
  else if (r.detected && !f.ext) add('Extension check', `no extension; content looks like ${r.detected.name}`);
  if (r.text) {
    add('Text encoding', r.text.encoding);
    add('Line endings', r.text.lineEndings);
    add('Lines', `${r.text.lines.toLocaleString('en-US')}${r.text.linesApprox ? '+' : ''}`);
    if (r.text.words !== undefined) add('Words', r.text.words.toLocaleString('en-US'));
    if (r.text.chars !== undefined) add('Characters', r.text.chars.toLocaleString('en-US'));
  }
  if (r.entropy) add(`Entropy (first ${r.entropy.bytes.toLocaleString('en-US')} bytes)`, `${r.entropy.value.toFixed(3)} bits/byte · ${describeEntropy(r.entropy.value)}`);
  if (r.hashes) {
    add('SHA-256', r.hashes.sha256);
    add('SHA-1', r.hashes.sha1);
  }
  return rows;
}

export function withHashes(r: Report, h: Hashes): Report {
  return { ...r, hashes: h };
}

function rowsToObject(rows: Row[]): Record<string, string | string[]> {
  const o: Record<string, string | string[]> = {};
  for (const { k, v } of rows) {
    const cur = o[k];
    if (cur === undefined) o[k] = v;
    else if (Array.isArray(cur)) cur.push(v);
    else o[k] = [cur, v];
  }
  return o;
}

export function sectionToText(s: { title: string; rows: Row[] }): string {
  return `${s.title}\n${s.rows.map((r) => `${r.k}: ${r.v}`).join('\n')}`;
}

export function reportToJson(r: Report): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  for (const s of r.sections) {
    const o: Record<string, unknown> = rowsToObject(s.rows);
    if (s.raw) o[`(${s.raw.label})`] = s.raw.text;
    metadata[s.title] = o;
  }
  return {
    file: rowsToObject(fileRows(r)),
    detectedType: r.detected ? { name: r.detected.name, mime: r.detected.mime, kind: r.detected.kind } : null,
    extensionWarning: r.extensionWarning,
    sensitiveMetadata: r.findings.map((f) => ({ category: f.cat, label: f.label, value: f.value })),
    metadata,
    notes: r.notes,
    errors: r.errors,
    first64BytesHex: r.head64.replace(/(..)/g, '$1 ').trim(),
  };
}

export function allSectionsText(r: Report): string {
  const parts = [sectionToText({ title: 'File', rows: fileRows(r) })];
  for (const s of r.sections) parts.push(sectionToText(s));
  return parts.join('\n\n');
}

export function sectionTitleText(s: Section): string {
  return sectionToText(s);
}

export { textSmart };

/** Classic hex dump lines for the 64-byte peek: "00000000  ff d8 …  |..|". */
export function hexLines(hex: string): string[] {
  const bytes: number[] = [];
  for (let i = 0; i + 1 < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i + 2), 16));
  const lines: string[] = [];
  for (let o = 0; o < bytes.length; o += 16) {
    const chunk = bytes.slice(o, o + 16);
    const h = chunk.map((b) => b.toString(16).padStart(2, '0'));
    const left = h.slice(0, 8).join(' ');
    const right = h.slice(8).join(' ');
    const ascii = chunk.map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');
    lines.push(`${o.toString(16).padStart(8, '0')}  ${left.padEnd(23, ' ')}  ${right.padEnd(23, ' ')}  |${ascii}|`);
  }
  return lines;
}

export const CATEGORY_ORDER: Cat[] = ['gps', 'person', 'company', 'device', 'software', 'editing', 'comments', 'thumbnail', 'filename', 'other'];

export const CATEGORY_LABEL: Record<Cat, string> = {
  gps: 'Location',
  person: 'People & names',
  company: 'Organisation',
  device: 'Device & serials',
  software: 'Software',
  editing: 'Editing history',
  comments: 'Comments & revisions',
  thumbnail: 'Embedded previews',
  filename: 'File names & paths',
  other: 'Other',
};
