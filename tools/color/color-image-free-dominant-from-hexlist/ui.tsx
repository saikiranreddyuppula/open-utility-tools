'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

type RGB = { r: number; g: number; b: number };

function parseColor(token: string): RGB | null {
  let s = token.trim().toLowerCase();
  if (!s) return null;
  const rgbMatch = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(token.trim());
  if (rgbMatch) {
    const r = Number(rgbMatch[1]);
    const g = Number(rgbMatch[2]);
    const b = Number(rgbMatch[3]);
    if ([r, g, b].every((v) => Number.isFinite(v) && v >= 0 && v <= 255)) {
      return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
    }
    return null;
  }
  if (s.startsWith('#')) s = s.slice(1);
  if (s.length === 3) {
    const r = s[0]; const g = s[1]; const b = s[2];
    if (r === undefined || g === undefined || b === undefined) return null;
    s = `${r}${r}${g}${g}${b}${b}`;
  }
  if (s.length !== 6 || !/^[0-9a-f]{6}$/.test(s)) return null;
  return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
}

function toHex({ r, g, b }: RGB): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

const SAMPLE = `#ff6b6b
#ff6b6b
#4ecdc4
#1a535c
#ffe66d
#ff6b6b`;

const toLinear = (c: number) => { const cs = c / 255; return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4); };
const fromLinear = (c: number) => { const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.round(Math.max(0, Math.min(1, v)) * 255); };

export default function DominantFromListTool() {
  const [text, setText] = useState(SAMPLE);
  const [linear, setLinear] = useState(true);
  const [ignoreDupes, setIgnoreDupes] = useState(false);

  const result = useMemo(() => {
    const tokens = text.split(/[\n,;]+/).map((t) => t.trim()).filter(Boolean);
    if (tokens.length === 0) return { error: 'Enter at least one color.' };
    const parsed: RGB[] = [];
    const bad: string[] = [];
    for (const t of tokens) {
      const c = parseColor(t);
      if (c) parsed.push(c); else bad.push(t);
    }
    if (parsed.length === 0) return { error: `No valid colors found. First bad token: "${bad[0] ?? ''}".` };

    // Frequency histogram (by normalized hex)
    const freq = new Map<string, number>();
    for (const c of parsed) {
      const key = toHex(c);
      freq.set(key, (freq.get(key) ?? 0) + 1);
    }
    const histogram = Array.from(freq.entries())
      .map(([hex, count]) => ({ hex, count }))
      .sort((a, b) => b.count - a.count);
    const top = histogram[0];
    const dominant = top ? top.hex : toHex(parsed[0] as RGB);

    // Averaging set
    const avgSet: RGB[] = ignoreDupes
      ? Array.from(freq.keys()).map((hex) => parseColor(hex) as RGB)
      : parsed;

    let sumR = 0, sumG = 0, sumB = 0;
    const n = avgSet.length;
    let avg: RGB;
    if (linear) {
      for (const c of avgSet) { sumR += toLinear(c.r); sumG += toLinear(c.g); sumB += toLinear(c.b); }
      avg = { r: fromLinear(sumR / n), g: fromLinear(sumG / n), b: fromLinear(sumB / n) };
    } else {
      for (const c of avgSet) { sumR += c.r; sumG += c.g; sumB += c.b; }
      avg = { r: Math.round(sumR / n), g: Math.round(sumG / n), b: Math.round(sumB / n) };
    }

    return {
      avg,
      dominant,
      dominantCount: top ? top.count : 0,
      total: parsed.length,
      unique: freq.size,
      bad: bad.length,
      histogram: histogram.slice(0, 12),
    };
  }, [text, linear, ignoreDupes]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Colors (one per line or comma-separated)" className="min-w-[280px] flex-1">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              className="min-h-[140px] font-mono"
            />
          </Field>
          <Field label="Averaging">
            <div className="flex items-center gap-2 text-sm">
              <Switch checked={linear} onCheckedChange={setLinear} />
              <span>{linear ? 'Linear-light' : 'sRGB'}</span>
            </div>
          </Field>
          <Field label="Duplicates">
            <div className="flex items-center gap-2 text-sm">
              <Switch checked={ignoreDupes} onCheckedChange={setIgnoreDupes} />
              <span>{ignoreDupes ? 'Ignore' : 'Keep'}</span>
            </div>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-md border p-3">
              <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Average color</span>
              <div className="h-16 w-full rounded border" style={{ backgroundColor: toHex(result.avg) }} />
              <span className="flex items-center justify-between font-mono text-sm">
                {toHex(result.avg)}
                <CopyButton value={toHex(result.avg)} size="icon-sm" />
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {`rgb(${result.avg.r}, ${result.avg.g}, ${result.avg.b})`}
              </span>
            </div>
            <div className="flex flex-col gap-2 rounded-md border p-3">
              <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Most frequent</span>
              <div className="h-16 w-full rounded border" style={{ backgroundColor: result.dominant }} />
              <span className="flex items-center justify-between font-mono text-sm">
                {result.dominant}
                <CopyButton value={result.dominant} size="icon-sm" />
              </span>
              <span className="font-mono text-xs text-muted-foreground">{result.dominantCount}× of {result.total}</span>
            </div>
          </div>

          <Panel>
            <PanelHeader title="Frequency histogram" />
            <div className="divide-y">
              {result.histogram.map((h) => (
                <div key={h.hex} className="flex items-center gap-3 px-3 py-2">
                  <div className="size-5 shrink-0 rounded border" style={{ backgroundColor: h.hex }} />
                  <code className="w-24 shrink-0 font-mono text-xs">{h.hex}</code>
                  <div className="h-2 flex-1 rounded bg-muted">
                    <div className="h-full rounded bg-primary" style={{ width: `${(h.count / result.total) * 100}%` }} />
                  </div>
                  <span className="w-12 shrink-0 text-right font-mono text-xs tabular">{h.count}×</span>
                </div>
              ))}
            </div>
            <StatBar items={[`${result.total} colors`, `${result.unique} unique`, result.bad ? `${result.bad} ignored` : false]} />
          </Panel>
        </>
      )}
    </div>
  );
}
