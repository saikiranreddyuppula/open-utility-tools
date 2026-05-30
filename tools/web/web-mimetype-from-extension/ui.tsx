'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'toMime' | 'toExt';

const FALLBACK = 'application/octet-stream';

// Extension (no dot) -> canonical MIME type. Curated from the IANA / Apache
// mime.types list, covering common web, image, audio, video, document,
// archive, font and source-code types.
const MIME: Record<string, string> = {
  // Text & web
  txt: 'text/plain',
  text: 'text/plain',
  log: 'text/plain',
  ini: 'text/plain',
  conf: 'text/plain',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  html: 'text/html',
  htm: 'text/html',
  xhtml: 'application/xhtml+xml',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  cjs: 'text/javascript',
  jsx: 'text/jsx',
  ts: 'text/typescript',
  tsx: 'text/tsx',
  json: 'application/json',
  jsonld: 'application/ld+json',
  map: 'application/json',
  webmanifest: 'application/manifest+json',
  xml: 'application/xml',
  rss: 'application/rss+xml',
  atom: 'application/atom+xml',
  rdf: 'application/rdf+xml',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  toml: 'application/toml',
  md: 'text/markdown',
  markdown: 'text/markdown',
  ics: 'text/calendar',
  vcf: 'text/vcard',
  // Source code
  c: 'text/x-c',
  h: 'text/x-c',
  cpp: 'text/x-c++',
  cc: 'text/x-c++',
  py: 'text/x-python',
  rb: 'text/x-ruby',
  go: 'text/x-go',
  rs: 'text/x-rust',
  java: 'text/x-java-source',
  php: 'application/x-httpd-php',
  sh: 'application/x-sh',
  pl: 'application/x-perl',
  sql: 'application/sql',
  // Images
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpe: 'image/jpeg',
  jfif: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  ico: 'image/vnd.microsoft.icon',
  cur: 'image/vnd.microsoft.icon',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  svg: 'image/svg+xml',
  svgz: 'image/svg+xml',
  heic: 'image/heic',
  heif: 'image/heif',
  psd: 'image/vnd.adobe.photoshop',
  jxl: 'image/jxl',
  // Audio
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  oga: 'audio/ogg',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  wav: 'audio/wav',
  weba: 'audio/webm',
  flac: 'audio/flac',
  mid: 'audio/midi',
  midi: 'audio/midi',
  // Video
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  mpeg: 'video/mpeg',
  mpg: 'video/mpeg',
  m2ts: 'video/mp2t',
  '3gp': 'video/3gpp',
  flv: 'video/x-flv',
  // Fonts
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
  // Documents
  pdf: 'application/pdf',
  rtf: 'application/rtf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  epub: 'application/epub+zip',
  // Archives & binary
  zip: 'application/zip',
  gz: 'application/gzip',
  tar: 'application/x-tar',
  tgz: 'application/gzip',
  bz2: 'application/x-bzip2',
  '7z': 'application/x-7z-compressed',
  rar: 'application/vnd.rar',
  xz: 'application/x-xz',
  br: 'application/x-brotli',
  zst: 'application/zstd',
  bin: 'application/octet-stream',
  exe: 'application/x-msdownload',
  dmg: 'application/x-apple-diskimage',
  iso: 'application/x-iso9660-image',
  deb: 'application/vnd.debian.binary-package',
  rpm: 'application/x-rpm',
  apk: 'application/vnd.android.package-archive',
  wasm: 'application/wasm',
  // Misc
  swf: 'application/x-shockwave-flash',
  ai: 'application/postscript',
  eps: 'application/postscript',
  ps: 'application/postscript',
};

function lookupExt(token: string): { ext: string; mime: string; fallback: boolean } {
  let raw = token.trim().toLowerCase();
  if (!raw) return { ext: '', mime: '', fallback: false };
  // If it looks like a filename, take the last extension.
  if (raw.includes('.')) {
    const segs = raw.split('.');
    raw = segs[segs.length - 1] ?? '';
  }
  const ext = raw.replace(/^\.+/, '');
  const mime = MIME[ext];
  if (mime) return { ext, mime, fallback: false };
  return { ext, mime: FALLBACK, fallback: true };
}

export default function MimeFromExtensionTool() {
  const [mode, setMode] = useState<Mode>('toMime');
  const [input, setInput] = useState('photo.heic\n.wasm\napp.js\narchive.tar.gz\nunknown.qqq');
  const [mimeQuery, setMimeQuery] = useState('image/jpeg');

  const forward = useMemo(() => {
    const lines = input.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    return lines.map((line) => {
      const r = lookupExt(line);
      return { input: line, ...r };
    });
  }, [input]);

  const reverse = useMemo(() => {
    const q = mimeQuery.trim().toLowerCase();
    if (!q) return [];
    const exts: string[] = [];
    for (const [ext, mime] of Object.entries(MIME)) {
      if (mime.toLowerCase() === q) exts.push(ext);
    }
    return exts.sort();
  }, [mimeQuery]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Direction">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="toMime">Extension → MIME</TabsTrigger>
                <TabsTrigger value="toExt">MIME → Extensions</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>
      </Panel>

      {mode === 'toMime' ? (
        <>
          <Panel>
            <PanelHeader title="Filenames or extensions (one per line)">
              <button
                className="rounded px-1.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setInput('photo.heic\n.wasm\napp.js\narchive.tar.gz\nunknown.qqq')}
              >
                Sample
              </button>
            </PanelHeader>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="photo.heic"
              spellCheck={false}
              className="min-h-28 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          </Panel>

          <Panel>
            <PanelHeader title="MIME types">
              <CopyButton
                value={() => forward.map((r) => `${r.input}\t${r.mime}`).join('\n')}
                size="icon-sm"
              />
            </PanelHeader>
            <div className="divide-y">
              {forward.length === 0 && (
                <p className="px-3 py-3 text-sm text-muted-foreground">Enter one filename or extension per line.</p>
              )}
              {forward.map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2">
                  <code className="w-32 shrink-0 truncate font-mono text-xs">{r.input}</code>
                  <code className="min-w-0 flex-1 truncate font-mono text-xs">{r.mime}</code>
                  {r.fallback && (
                    <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-2xs text-amber-600 dark:text-amber-400">
                      fallback
                    </span>
                  )}
                  <CopyButton value={r.mime} size="icon-sm" />
                </div>
              ))}
            </div>
            <StatBar
              items={[
                `${forward.length} input(s)`,
                `${forward.filter((r) => !r.fallback).length} matched`,
              ]}
            />
          </Panel>
        </>
      ) : (
        <>
          <Panel>
            <PanelHeader title="MIME type" />
            <div className="p-3">
              <Input
                value={mimeQuery}
                onChange={(e) => setMimeQuery(e.target.value)}
                placeholder="e.g. image/jpeg"
                className="font-mono text-sm"
              />
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Known extensions">
              <CopyButton value={() => reverse.map((e) => '.' + e).join('\n')} size="icon-sm" />
            </PanelHeader>
            <div className="p-3">
              {reverse.length === 0 ? (
                <p className="text-sm text-muted-foreground">No extensions found for this MIME type.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {reverse.map((e) => (
                    <span key={e} className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                      .{e}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <StatBar items={[`${reverse.length} extension(s)`]} />
          </Panel>
        </>
      )}
    </div>
  );
}
