'use client';

import { useMemo, useState } from 'react';
import {
  Panel,
  PanelHeader,
  OptionsBar,
  Field,
  StatBar,
} from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ChangeFreq =
  | ''
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never';

const FREQS: ChangeFreq[] = [
  'always',
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'never',
];

const SAMPLE = `https://example.com/
https://example.com/about | 2026-01-15 | monthly | 0.6
https://example.com/blog | 2026-05-20 | daily
https://example.com/contact`;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface Entry {
  loc: string;
  lastmod: string;
  changefreq: ChangeFreq;
  priority: string;
}

type Result =
  | { ok: true; xml: string; count: number }
  | { ok: false; error: string };

function clampPriority(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 1) return null;
  return n.toFixed(1);
}

export default function SitemapGeneratorTool() {
  const [input, setInput] = useState(SAMPLE);
  const [defLastmod, setDefLastmod] = useState('');
  const [defFreq, setDefFreq] = useState<ChangeFreq>('');
  const [defPriority, setDefPriority] = useState('');

  const result = useMemo<Result>(() => {
    const lines = input
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) {
      return { ok: false, error: 'Enter at least one URL (one per line).' };
    }
    if (lines.length > 50000) {
      return {
        ok: false,
        error: 'A sitemap may contain at most 50,000 URLs. Split into multiple files.',
      };
    }

    const defaultPriority = clampPriority(defPriority);
    if (defPriority.trim() && defaultPriority === null) {
      return { ok: false, error: 'Default priority must be a number from 0.0 to 1.0.' };
    }

    const entries: Entry[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const parts = line.split('|').map((p) => p.trim());
      const loc = parts[0] ?? '';
      if (!loc) continue;
      // Validate the URL with the WHATWG parser.
      try {
        // Will throw for relative/garbage input.
        new URL(loc);
      } catch {
        return {
          ok: false,
          error: `Line ${i + 1}: "${loc}" is not an absolute URL (include http:// or https://).`,
        };
      }

      const lastmod = (parts[1] ?? '').trim() || defLastmod.trim();

      const rawFreq = (parts[2] ?? '').trim().toLowerCase();
      let changefreq: ChangeFreq = defFreq;
      if (rawFreq) {
        if ((FREQS as string[]).includes(rawFreq)) {
          changefreq = rawFreq as ChangeFreq;
        } else {
          return {
            ok: false,
            error: `Line ${i + 1}: changefreq "${rawFreq}" is invalid (use ${FREQS.join('/')}).`,
          };
        }
      }

      const rawPriority = (parts[3] ?? '').trim();
      let priority = defaultPriority ?? '';
      if (rawPriority) {
        const p = clampPriority(rawPriority);
        if (p === null) {
          return {
            ok: false,
            error: `Line ${i + 1}: priority "${rawPriority}" must be 0.0-1.0.`,
          };
        }
        priority = p;
      }

      entries.push({ loc, lastmod, changefreq, priority });
    }

    const body = entries
      .map((e) => {
        const rows: string[] = [`    <loc>${escapeXml(e.loc)}</loc>`];
        if (e.lastmod) rows.push(`    <lastmod>${escapeXml(e.lastmod)}</lastmod>`);
        if (e.changefreq) rows.push(`    <changefreq>${e.changefreq}</changefreq>`);
        if (e.priority) rows.push(`    <priority>${e.priority}</priority>`);
        return `  <url>\n${rows.join('\n')}\n  </url>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
    return { ok: true, xml, count: entries.length };
  }, [input, defLastmod, defFreq, defPriority]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field
            label="Default lastmod"
            hint="ISO date e.g. 2026-05-30"
            className="min-w-[160px]"
          >
            <Input
              type="date"
              value={defLastmod}
              onChange={(e) => setDefLastmod(e.target.value)}
              placeholder={today}
              className="font-mono"
            />
          </Field>
          <Field label="Default changefreq" className="min-w-[160px]">
            <Select
              value={defFreq || 'none'}
              onValueChange={(v) => setDefFreq(v === 'none' ? '' : (v as ChangeFreq))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">(none)</SelectItem>
                {FREQS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Default priority" hint="0.0 - 1.0" className="min-w-[120px]">
            <Input
              value={defPriority}
              onChange={(e) => setDefPriority(e.target.value)}
              placeholder="0.5"
              inputMode="decimal"
              className="w-24 font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="URLs (one per line, optional `url | lastmod | changefreq | priority`)" />
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          rows={8}
          className="rounded-none border-0 font-mono text-sm focus-visible:ring-0"
        />
      </Panel>

      {result.ok ? (
        <Panel>
          <PanelHeader title="sitemap.xml">
            <CopyButton value={() => result.xml} />
            <DownloadButton data={() => result.xml} filename="sitemap.xml" />
          </PanelHeader>
          <pre className="max-h-[420px] overflow-auto p-3 font-mono text-xs leading-relaxed">
            {result.xml}
          </pre>
          <StatBar items={[`${result.count} URLs`, `${result.xml.length} chars`]} />
        </Panel>
      ) : (
        <ErrorBanner error={result.error} />
      )}
    </div>
  );
}
