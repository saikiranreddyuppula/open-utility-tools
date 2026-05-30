'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Textarea } from '@/components/ui/textarea';

const SAMPLE = `<head>
  <title>The Page Title</title>
  <meta name="description" content="A normal meta description.">
  <meta property="og:title" content="An Amazing Article About Cats">
  <meta property="og:description" content="Everything you ever wanted to know about cats, in one delightful read.">
  <meta property="og:image" content="https://example.com/cats.jpg">
  <meta property="og:url" content="https://example.com/cats">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Example Blog">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="An Amazing Article About Cats">
</head>`;

// Parse <meta> tags, returning a map of property/name -> content.
function parseMeta(html: string): Map<string, string> {
  const map = new Map<string, string>();
  const metaRe = /<meta\b[^>]*>/gi;
  const matches = html.match(metaRe) ?? [];
  for (const tag of matches) {
    const keyMatch =
      tag.match(/\b(?:property|name)\s*=\s*"([^"]*)"/i) ??
      tag.match(/\b(?:property|name)\s*=\s*'([^']*)'/i);
    const contentMatch =
      tag.match(/\bcontent\s*=\s*"([^"]*)"/i) ??
      tag.match(/\bcontent\s*=\s*'([^']*)'/i);
    if (!keyMatch) continue;
    const key = (keyMatch[1] ?? '').trim().toLowerCase();
    const content = (contentMatch?.[1] ?? '').trim();
    if (key && !map.has(key)) map.set(key, content);
  }
  // <title> as a fallback source
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1] != null) {
    map.set('__title__', titleMatch[1].trim());
  }
  return map;
}

interface Field {
  label: string;
  value: string;
  source: string;
}

interface Parsed {
  fields: Field[];
  warnings: string[];
  card: { title: string; description: string; image: string; url: string };
}

function resolve(meta: Map<string, string>): Parsed {
  const get = (k: string) => meta.get(k) ?? '';
  const docTitle = get('__title__');

  // Twitter fields fall back to OG values.
  const ogTitle = get('og:title');
  const ogDesc = get('og:description');
  const ogImage = get('og:image');
  const ogUrl = get('og:url');

  const twTitle = get('twitter:title') || ogTitle;
  const twDesc = get('twitter:description') || ogDesc;
  const twImage = get('twitter:image') || ogImage;

  const fields: Field[] = [
    { label: 'og:title', value: ogTitle, source: 'og' },
    { label: 'og:description', value: ogDesc, source: 'og' },
    { label: 'og:image', value: ogImage, source: 'og' },
    { label: 'og:url', value: ogUrl, source: 'og' },
    { label: 'og:type', value: get('og:type'), source: 'og' },
    { label: 'og:site_name', value: get('og:site_name'), source: 'og' },
    { label: 'twitter:card', value: get('twitter:card'), source: 'twitter' },
    { label: 'twitter:title', value: twTitle, source: get('twitter:title') ? 'twitter' : 'og (fallback)' },
    { label: 'twitter:description', value: twDesc, source: get('twitter:description') ? 'twitter' : 'og (fallback)' },
    { label: 'twitter:image', value: twImage, source: get('twitter:image') ? 'twitter' : 'og (fallback)' },
  ];

  const warnings: string[] = [];
  if (!ogTitle) warnings.push('Missing og:title (recommended for rich link previews).');
  if (!ogDesc) warnings.push('Missing og:description.');
  if (!ogImage) warnings.push('Missing og:image — most platforms show a blank or generic card without it.');
  if (!ogUrl) warnings.push('Missing og:url (canonical URL for the shared object).');
  if (!get('twitter:card')) warnings.push('Missing twitter:card — defaults to "summary" with a small image.');
  if (ogTitle.length > 60) warnings.push(`og:title is ${ogTitle.length} chars; titles over ~60 may be truncated.`);
  if (ogDesc.length > 200) warnings.push(`og:description is ${ogDesc.length} chars; keep under ~200 for full display.`);

  const card = {
    title: twTitle || ogTitle || docTitle || '(no title)',
    description: twDesc || ogDesc || '',
    image: twImage || ogImage || '',
    url: ogUrl || '',
  };

  return { fields, warnings, card };
}

export default function OpenGraphPreviewTool() {
  const [html, setHtml] = useState(SAMPLE);

  const parsed = useMemo<Parsed | null>(() => {
    if (!html.trim()) return null;
    return resolve(parseMeta(html));
  }, [html]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="HTML (head or full document)">
          <button
            className="rounded px-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setHtml(SAMPLE)}
          >
            Sample
          </button>
          <button
            className="rounded px-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setHtml('')}
          >
            Clear
          </button>
        </PanelHeader>
        <Textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          placeholder="Paste HTML containing <meta property='og:…'> tags"
          spellCheck={false}
          className="min-h-40 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      {parsed && (
        <>
          <Panel>
            <PanelHeader title="Resolved share card" />
            <div className="p-3">
              <div className="overflow-hidden rounded-md border bg-muted/20">
                <div className="flex h-40 items-center justify-center border-b bg-muted text-xs text-muted-foreground">
                  {parsed.card.image ? (
                    <span className="break-all px-3 font-mono">{parsed.card.image}</span>
                  ) : (
                    'no image'
                  )}
                </div>
                <div className="space-y-1 p-3">
                  {parsed.card.url && (
                    <p className="truncate text-2xs uppercase tracking-wide text-muted-foreground">
                      {parsed.card.url}
                    </p>
                  )}
                  <p className="font-semibold leading-snug">{parsed.card.title}</p>
                  {parsed.card.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{parsed.card.description}</p>
                  )}
                </div>
              </div>
            </div>
          </Panel>

          {parsed.warnings.length > 0 && (
            <Panel>
              <PanelHeader title="Warnings" />
              <ul className="space-y-1 p-3">
                {parsed.warnings.map((w, i) => (
                  <li key={i} className="text-xs text-amber-600 dark:text-amber-400">
                    • {w}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel>
            <PanelHeader title="Meta fields">
              <CopyButton
                value={() => parsed.fields.map((f) => `${f.label}: ${f.value}`).join('\n')}
                size="icon-sm"
              />
            </PanelHeader>
            <div className="divide-y">
              {parsed.fields.map((f) => (
                <div key={f.label} className="flex items-center gap-3 px-3 py-2">
                  <code className="w-44 shrink-0 font-mono text-xs">{f.label}</code>
                  <span className="min-w-0 flex-1 truncate text-xs">
                    {f.value || <span className="text-muted-foreground">(empty)</span>}
                  </span>
                  <span className="shrink-0 text-2xs text-muted-foreground">{f.source}</span>
                </div>
              ))}
            </div>
            <StatBar
              items={[
                `${parsed.fields.filter((f) => f.value).length} of ${parsed.fields.length} set`,
                `${parsed.warnings.length} warning(s)`,
              ]}
            />
          </Panel>

          <p className="px-1 text-2xs text-muted-foreground">
            Parsing only — no remote images are fetched and nothing is sent anywhere.
          </p>
        </>
      )}
    </div>
  );
}
