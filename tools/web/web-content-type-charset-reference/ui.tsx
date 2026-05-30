'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type Category = 'text' | 'application' | 'image' | 'audio' | 'video' | 'font' | 'multipart';

interface MediaType {
  type: string;
  ext: string;
  category: Category;
  charset: boolean;
  notes: string;
}

const MEDIA: MediaType[] = [
  { type: 'text/plain', ext: '.txt', category: 'text', charset: true, notes: 'Default text type; charset matters for non-ASCII.' },
  { type: 'text/html', ext: '.html, .htm', category: 'text', charset: true, notes: 'HTML documents. Prefer UTF-8.' },
  { type: 'text/css', ext: '.css', category: 'text', charset: true, notes: 'Stylesheets.' },
  { type: 'text/csv', ext: '.csv', category: 'text', charset: true, notes: 'Comma-separated values (RFC 4180).' },
  { type: 'text/markdown', ext: '.md', category: 'text', charset: true, notes: 'Markdown source (RFC 7763).' },
  { type: 'text/xml', ext: '.xml', category: 'text', charset: true, notes: 'XML as text; application/xml is usually preferred.' },
  { type: 'text/javascript', ext: '.js, .mjs', category: 'text', charset: true, notes: 'Now the standard JS type (supersedes application/javascript).' },
  { type: 'text/event-stream', ext: '—', category: 'text', charset: true, notes: 'Server-Sent Events stream.' },
  { type: 'text/calendar', ext: '.ics', category: 'text', charset: true, notes: 'iCalendar data.' },
  { type: 'text/vcard', ext: '.vcf', category: 'text', charset: true, notes: 'vCard contact data.' },
  { type: 'text/tab-separated-values', ext: '.tsv', category: 'text', charset: true, notes: 'Tab-separated values.' },

  { type: 'application/json', ext: '.json', category: 'application', charset: false, notes: 'JSON. Always UTF-8 by spec; no charset parameter needed.' },
  { type: 'application/ld+json', ext: '.jsonld', category: 'application', charset: false, notes: 'JSON-LD linked data.' },
  { type: 'application/xml', ext: '.xml', category: 'application', charset: true, notes: 'XML documents.' },
  { type: 'application/xhtml+xml', ext: '.xhtml', category: 'application', charset: true, notes: 'XHTML served as XML.' },
  { type: 'application/javascript', ext: '.js', category: 'application', charset: true, notes: 'Legacy JS type; use text/javascript.' },
  { type: 'application/x-www-form-urlencoded', ext: '—', category: 'application', charset: false, notes: 'Default HTML form POST encoding.' },
  { type: 'application/octet-stream', ext: '.bin', category: 'application', charset: false, notes: 'Arbitrary binary data; triggers download.' },
  { type: 'application/pdf', ext: '.pdf', category: 'application', charset: false, notes: 'Portable Document Format.' },
  { type: 'application/zip', ext: '.zip', category: 'application', charset: false, notes: 'ZIP archive.' },
  { type: 'application/gzip', ext: '.gz', category: 'application', charset: false, notes: 'gzip-compressed data.' },
  { type: 'application/x-tar', ext: '.tar', category: 'application', charset: false, notes: 'tar archive.' },
  { type: 'application/x-7z-compressed', ext: '.7z', category: 'application', charset: false, notes: '7-Zip archive.' },
  { type: 'application/wasm', ext: '.wasm', category: 'application', charset: false, notes: 'WebAssembly binary module.' },
  { type: 'application/manifest+json', ext: '.webmanifest', category: 'application', charset: false, notes: 'Web app manifest.' },
  { type: 'application/graphql', ext: '—', category: 'application', charset: false, notes: 'GraphQL query payload.' },
  { type: 'application/vnd.api+json', ext: '—', category: 'application', charset: false, notes: 'JSON:API media type.' },
  { type: 'application/problem+json', ext: '—', category: 'application', charset: false, notes: 'Problem Details for HTTP APIs (RFC 9457).' },
  { type: 'application/yaml', ext: '.yaml, .yml', category: 'application', charset: true, notes: 'YAML documents (RFC 9512).' },
  { type: 'application/sql', ext: '.sql', category: 'application', charset: true, notes: 'SQL scripts.' },
  { type: 'application/rtf', ext: '.rtf', category: 'application', charset: false, notes: 'Rich Text Format.' },
  { type: 'application/rss+xml', ext: '.rss', category: 'application', charset: true, notes: 'RSS feed.' },
  { type: 'application/atom+xml', ext: '.atom', category: 'application', charset: true, notes: 'Atom feed.' },
  { type: 'application/x-ndjson', ext: '.ndjson', category: 'application', charset: false, notes: 'Newline-delimited JSON.' },
  { type: 'application/msword', ext: '.doc', category: 'application', charset: false, notes: 'Legacy MS Word.' },
  { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: '.docx', category: 'application', charset: false, notes: 'MS Word (OOXML).' },
  { type: 'application/vnd.ms-excel', ext: '.xls', category: 'application', charset: false, notes: 'Legacy MS Excel.' },
  { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: '.xlsx', category: 'application', charset: false, notes: 'MS Excel (OOXML).' },
  { type: 'application/vnd.ms-powerpoint', ext: '.ppt', category: 'application', charset: false, notes: 'Legacy MS PowerPoint.' },
  { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: '.pptx', category: 'application', charset: false, notes: 'MS PowerPoint (OOXML).' },
  { type: 'application/epub+zip', ext: '.epub', category: 'application', charset: false, notes: 'EPUB e-book.' },
  { type: 'application/dns-message', ext: '—', category: 'application', charset: false, notes: 'DNS-over-HTTPS payload.' },

  { type: 'image/png', ext: '.png', category: 'image', charset: false, notes: 'Lossless raster image.' },
  { type: 'image/jpeg', ext: '.jpg, .jpeg', category: 'image', charset: false, notes: 'Lossy photographic image.' },
  { type: 'image/gif', ext: '.gif', category: 'image', charset: false, notes: 'Animated/indexed raster image.' },
  { type: 'image/webp', ext: '.webp', category: 'image', charset: false, notes: 'Modern lossy/lossless image.' },
  { type: 'image/avif', ext: '.avif', category: 'image', charset: false, notes: 'AV1-based image format.' },
  { type: 'image/svg+xml', ext: '.svg', category: 'image', charset: true, notes: 'Vector image; XML-based, so charset applies.' },
  { type: 'image/x-icon', ext: '.ico', category: 'image', charset: false, notes: 'Favicon icon.' },
  { type: 'image/bmp', ext: '.bmp', category: 'image', charset: false, notes: 'Bitmap image.' },
  { type: 'image/tiff', ext: '.tif, .tiff', category: 'image', charset: false, notes: 'Tagged Image File Format.' },
  { type: 'image/heic', ext: '.heic', category: 'image', charset: false, notes: 'HEIF/HEIC image (Apple).' },

  { type: 'audio/mpeg', ext: '.mp3', category: 'audio', charset: false, notes: 'MP3 audio.' },
  { type: 'audio/ogg', ext: '.ogg, .oga', category: 'audio', charset: false, notes: 'Ogg-container audio.' },
  { type: 'audio/wav', ext: '.wav', category: 'audio', charset: false, notes: 'Uncompressed WAV audio.' },
  { type: 'audio/webm', ext: '.weba', category: 'audio', charset: false, notes: 'WebM audio.' },
  { type: 'audio/aac', ext: '.aac', category: 'audio', charset: false, notes: 'AAC audio.' },
  { type: 'audio/flac', ext: '.flac', category: 'audio', charset: false, notes: 'Lossless FLAC audio.' },

  { type: 'video/mp4', ext: '.mp4', category: 'video', charset: false, notes: 'MPEG-4 video.' },
  { type: 'video/webm', ext: '.webm', category: 'video', charset: false, notes: 'WebM video.' },
  { type: 'video/ogg', ext: '.ogv', category: 'video', charset: false, notes: 'Ogg video.' },
  { type: 'video/quicktime', ext: '.mov', category: 'video', charset: false, notes: 'QuickTime video.' },
  { type: 'video/mp2t', ext: '.ts', category: 'video', charset: false, notes: 'MPEG transport stream (HLS segments).' },
  { type: 'application/vnd.apple.mpegurl', ext: '.m3u8', category: 'video', charset: false, notes: 'HLS playlist.' },

  { type: 'font/woff', ext: '.woff', category: 'font', charset: false, notes: 'Web Open Font Format.' },
  { type: 'font/woff2', ext: '.woff2', category: 'font', charset: false, notes: 'WOFF2 (preferred web font).' },
  { type: 'font/ttf', ext: '.ttf', category: 'font', charset: false, notes: 'TrueType font.' },
  { type: 'font/otf', ext: '.otf', category: 'font', charset: false, notes: 'OpenType font.' },

  { type: 'multipart/form-data', ext: '—', category: 'multipart', charset: false, notes: 'File-upload form encoding; requires a boundary parameter.' },
  { type: 'multipart/byteranges', ext: '—', category: 'multipart', charset: false, notes: 'Multiple byte ranges (206 response).' },
  { type: 'multipart/mixed', ext: '—', category: 'multipart', charset: false, notes: 'Composite of independent parts.' },
  { type: 'multipart/alternative', ext: '—', category: 'multipart', charset: false, notes: 'Same content in alternative formats (email).' },
];

interface Charset {
  name: string;
  notes: string;
}

const CHARSETS: Charset[] = [
  { name: 'utf-8', notes: 'Universal Unicode encoding; the modern default for text.' },
  { name: 'utf-16', notes: '16-bit Unicode; uses a BOM or explicit endianness.' },
  { name: 'us-ascii', notes: '7-bit ASCII; subset of UTF-8.' },
  { name: 'iso-8859-1', notes: 'Latin-1; legacy Western European. Often mislabeled as windows-1252.' },
  { name: 'windows-1252', notes: 'Superset of Latin-1 with extra punctuation; common legacy Windows charset.' },
  { name: 'shift_jis', notes: 'Legacy Japanese encoding.' },
];

type Tab = 'media' | 'charset';
type CatFilter = Category | 'all';

export default function ContentTypeCharsetReferenceTool() {
  const [tab, setTab] = useState<Tab>('media');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<CatFilter>('all');

  // snippet builder
  const [baseType, setBaseType] = useState('text/html');
  const [withCharset, setWithCharset] = useState('utf-8');
  const [boundary, setBoundary] = useState('----WebKitFormBoundary7MA4YWxkTrZu0gW');

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return MEDIA.filter((m) => {
      if (cat !== 'all' && m.category !== cat) return false;
      if (!s) return true;
      return `${m.type} ${m.ext} ${m.category} ${m.notes}`.toLowerCase().includes(s);
    });
  }, [q, cat]);

  const charsetRows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return CHARSETS;
    return CHARSETS.filter((c) => `${c.name} ${c.notes}`.toLowerCase().includes(s));
  }, [q]);

  const isMultipart = baseType.trim().toLowerCase().startsWith('multipart/');
  const snippet = isMultipart
    ? `Content-Type: ${baseType.trim()}; boundary=${boundary.trim()}`
    : `Content-Type: ${baseType.trim()}; charset=${withCharset.trim()}`;

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="View">
            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
              <TabsList>
                <TabsTrigger value="media">Media types</TabsTrigger>
                <TabsTrigger value="charset">Charsets</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Filter" className="flex-1" hint="type, extension, or keyword">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="json, image, charset…" />
          </Field>
          {tab === 'media' && (
            <Field label="Category">
              <Select value={cat} onValueChange={(v) => setCat(v as CatFilter)}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="text">text</SelectItem>
                  <SelectItem value="application">application</SelectItem>
                  <SelectItem value="image">image</SelectItem>
                  <SelectItem value="audio">audio</SelectItem>
                  <SelectItem value="video">video</SelectItem>
                  <SelectItem value="font">font</SelectItem>
                  <SelectItem value="multipart">multipart</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Header snippet builder">
          <CopyButton value={() => snippet} />
        </PanelHeader>
        <div className="space-y-3 p-3">
          <OptionsBar>
            <Field label="Media type" className="min-w-[220px] flex-1">
              <Input value={baseType} onChange={(e) => setBaseType(e.target.value)} className="font-mono" spellCheck={false} />
            </Field>
            {isMultipart ? (
              <Field label="boundary" className="min-w-[260px] flex-1">
                <Input value={boundary} onChange={(e) => setBoundary(e.target.value)} className="font-mono" spellCheck={false} />
              </Field>
            ) : (
              <Field label="charset" className="min-w-[140px]">
                <Select value={withCharset} onValueChange={(v) => setWithCharset(v)}>
                  <SelectTrigger className="w-[150px] font-mono"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHARSETS.map((c) => (
                      <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </OptionsBar>
          <code className="block break-all rounded bg-muted px-2 py-1.5 font-mono text-xs">{snippet}</code>
        </div>
      </Panel>

      {tab === 'media' ? (
        <Panel>
          <PanelHeader title="Media types" />
          <div className="max-h-[520px] divide-y overflow-auto">
            {rows.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground">No media types match “{q}”.</div>
            ) : rows.map((m) => (
              <div key={m.type} className="flex items-center gap-3 px-3 py-2">
                <code className="w-72 shrink-0 break-all font-mono text-xs">{m.type}</code>
                <span className="w-28 shrink-0 font-mono text-xs text-muted-foreground">{m.ext}</span>
                <span className="w-16 shrink-0 text-2xs uppercase tracking-wide text-muted-foreground">{m.category}</span>
                {m.charset ? (
                  <span className="shrink-0 rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400">charset</span>
                ) : (
                  <span className="shrink-0 rounded border border-muted-foreground/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">no charset</span>
                )}
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={m.notes}>{m.notes}</span>
                <CopyButton value={m.type} size="icon-sm" />
              </div>
            ))}
          </div>
          <StatBar items={[`${rows.length} of ${MEDIA.length} media types`]} />
        </Panel>
      ) : (
        <Panel>
          <PanelHeader title="Charsets" />
          <div className="divide-y">
            {charsetRows.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground">No charsets match “{q}”.</div>
            ) : charsetRows.map((c) => (
              <div key={c.name} className="flex items-center gap-3 px-3 py-2">
                <code className="w-40 shrink-0 font-mono text-sm">{c.name}</code>
                <span className="min-w-0 flex-1 text-xs text-muted-foreground">{c.notes}</span>
                <CopyButton value={`charset=${c.name}`} size="icon-sm" />
              </div>
            ))}
          </div>
          <StatBar items={[`${charsetRows.length} of ${CHARSETS.length} charsets`]} />
        </Panel>
      )}
    </div>
  );
}
