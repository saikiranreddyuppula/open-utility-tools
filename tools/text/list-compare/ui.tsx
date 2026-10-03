'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { ArrowLeftRight, Eraser, FileText, Loader2 } from 'lucide-react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import {
  DEFAULT_OPTIONS,
  compareLists,
  delimiterLabel,
  joinEntries,
  vennGeometry,
  type CompareOptions,
  type CompareResult,
  type CsvDelimiter,
  type Delimiter,
  type Entry,
  type ListInfo,
  type OutputSeparator,
  type SortMode,
} from './logic';

const SAMPLE_A = [
  'ana@example.com',
  'Bob@Example.com',
  'carol@example.com',
  '  dave@example.com ',
  'eve@example.com',
  'frank@example.com',
  'carol@example.com',
  'grace@example.com',
].join('\n');

const SAMPLE_B = [
  'bob@example.com',
  'carol@example.com',
  'heidi@example.com',
  'FRANK@EXAMPLE.COM',
  'ivan@example.com',
  'dave@example.com',
  'heidi@example.com',
  'judy@example.com',
].join('\n');

type TabId = 'onlyA' | 'onlyB' | 'both' | 'union' | 'symmetric' | 'dupA' | 'dupB';

const TABS: { id: TabId; label: string; file: string }[] = [
  { id: 'onlyA', label: 'Only in A', file: 'only-in-a' },
  { id: 'onlyB', label: 'Only in B', file: 'only-in-b' },
  { id: 'both', label: 'In both', file: 'in-both' },
  { id: 'union', label: 'Union', file: 'union' },
  { id: 'symmetric', label: 'Symmetric difference', file: 'symmetric-difference' },
  { id: 'dupA', label: 'Duplicates in A', file: 'duplicates-in-a' },
  { id: 'dupB', label: 'Duplicates in B', file: 'duplicates-in-b' },
];

const MAX_ROWS = 1000;
const fmt = (n: number): string => n.toLocaleString('en-US');
const fmtPct = (n: number | null): string => (n === null ? '–' : `${n >= 99.995 || n === 0 ? Math.round(n) : n.toFixed(n < 10 ? 2 : 1)}%`);

function Toggle({ id, label, checked, onChange, hint }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <div className="flex items-center gap-2" title={hint}>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
    </div>
  );
}

function infoLine(i: ListInfo, csv: boolean): string[] {
  return [
    `${fmt(i.total)} item${i.total === 1 ? '' : 's'}`,
    `${fmt(i.unique)} unique`,
    i.total > i.unique ? `${fmt(i.total - i.unique)} duplicate${i.total - i.unique === 1 ? '' : 's'}` : '',
    i.delimiter ? `${csv ? 'CSV' : 'split'}: ${delimiterLabel(i.delimiter)}` : '',
    i.column ? `column: ${i.column}` : '',
  ].filter(Boolean);
}

function Venn({ r }: { r: CompareResult }) {
  const nA = r.infoA.unique;
  const nB = r.infoB.unique;
  const nBoth = r.both.length;
  if (nA === 0 && nB === 0) {
    return <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">Add items to see the overlap.</div>;
  }
  const g = vennGeometry(nA, nB, nBoth);
  const W = 360;
  const H = 180;
  const span = g.rA + g.d + g.rB;
  const k = Math.min(300 / (span || 1), 150 / (2 * Math.max(g.rA, g.rB, 1e-9)));
  const rA = g.rA * k;
  const rB = g.rB * k;
  const d = g.d * k;
  const left = (W - (rA + d + rB)) / 2;
  const cxA = left + rA;
  const cxB = cxA + d;
  const cy = H / 2;
  const lensL = cxB - rB;
  const lensR = cxA + rA;
  const aMid = (cxA - rA + Math.min(lensL, lensR)) / 2;
  const bMid = (Math.max(lensL, lensR) + cxB + rB) / 2;
  const bothMid = (lensL + lensR) / 2;
  const showA = Math.min(lensL, lensR) - (cxA - rA) > 26;
  const showB = cxB + rB - Math.max(lensL, lensR) > 26;
  const showBoth = nBoth > 0 && lensR - lensL > 26;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full max-w-md" role="img" aria-label={`Venn diagram: ${nA - nBoth} only in A, ${nBoth} in both, ${nB - nBoth} only in B`} data-testid="venn">
      {rA > 0 && <circle cx={cxA} cy={cy} r={rA} fill="var(--primary)" fillOpacity={0.28} stroke="var(--primary)" strokeWidth={1.5} />}
      {rB > 0 && <circle cx={cxB} cy={cy} r={rB} fill="var(--cat-text)" fillOpacity={0.28} stroke="var(--cat-text)" strokeWidth={1.5} />}
      <g className="fill-foreground font-mono" textAnchor="middle" fontSize={13}>
        {showA && <text x={aMid} y={cy + 4}>{fmt(nA - nBoth)}</text>}
        {showBoth && <text x={bothMid} y={cy + 4}>{fmt(nBoth)}</text>}
        {showB && <text x={bMid} y={cy + 4}>{fmt(nB - nBoth)}</text>}
      </g>
      <g className="fill-muted-foreground" textAnchor="middle" fontSize={11} fontWeight={600}>
        <text x={cxA} y={Math.max(12, cy - rA - 5)}>A</text>
        <text x={cxB} y={Math.max(12, cy - rB - 5)}>B</text>
      </g>
    </svg>
  );
}

function ResultList({ entries, side, sep, withCounts, filename }: { entries: Entry[]; side: 'A' | 'B' | 'both'; sep: OutputSeparator; withCounts: boolean; filename: string }) {
  const shown = entries.slice(0, MAX_ROWS);
  const countSide: 'A' | 'B' = side === 'B' ? 'B' : 'A';
  const text = () => joinEntries(entries, sep, withCounts, countSide);
  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <div className="flex h-9 items-center gap-1 border-b bg-muted/40 px-2">
        <span className="px-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{fmt(entries.length)} item{entries.length === 1 ? '' : 's'}</span>
        <div className="ml-auto flex items-center gap-0.5">
          <CopyButton value={text} disabled={entries.length === 0} />
          <DownloadButton data={text} filename={`${filename}.txt`} disabled={entries.length === 0} />
        </div>
      </div>
      {entries.length === 0 ? (
        <div className="px-3 py-6 text-center text-sm text-muted-foreground">Nothing here.</div>
      ) : (
        <ol className="max-h-80 divide-y overflow-auto" data-testid="result-list">
          {shown.map((e, i) => (
            <li key={i} className="flex items-center gap-2 px-3 py-1 text-sm">
              <span className="w-10 shrink-0 text-right font-mono text-2xs tabular-nums text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-xs" title={e.text}>
                {e.text === '' ? <span className="text-muted-foreground">(empty)</span> : e.text}
              </span>
              {side !== 'B' && e.countA > 1 && <span className="shrink-0 rounded bg-muted px-1.5 font-mono text-2xs text-muted-foreground">A ×{e.countA}</span>}
              {side !== 'A' && e.countB > 1 && <span className="shrink-0 rounded bg-muted px-1.5 font-mono text-2xs text-muted-foreground">B ×{e.countB}</span>}
            </li>
          ))}
        </ol>
      )}
      {entries.length > MAX_ROWS && (
        <div className="border-t bg-muted/30 px-3 py-1.5 text-2xs text-muted-foreground">
          Showing the first {fmt(MAX_ROWS)} of {fmt(entries.length)}. Copy and Download include all items.
        </div>
      )}
    </div>
  );
}

export default function ListCompare() {
  const [textA, setTextA] = useState(SAMPLE_A);
  const [textB, setTextB] = useState(SAMPLE_B);
  const [opts, setOpts] = useState<CompareOptions>({ ...DEFAULT_OPTIONS, caseInsensitive: true });
  const [sep, setSep] = useState<OutputSeparator>('newline');
  const [tab, setTab] = useState<TabId>('onlyA');
  const [counts, setCounts] = useState(false);

  const dA = useDeferredValue(textA);
  const dB = useDeferredValue(textB);
  const dOpts = useDeferredValue(opts);
  const busy = dA !== textA || dB !== textB || dOpts !== opts;

  const result = useMemo(() => compareLists(dA, dB, dOpts), [dA, dB, dOpts]);

  const set = <K extends keyof CompareOptions>(k: K, v: CompareOptions[K]): void => setOpts((o) => ({ ...o, [k]: v }));
  const setCsv = (patch: Partial<CompareOptions['csv']>): void => setOpts((o) => ({ ...o, csv: { ...o.csv, ...patch } }));

  const swap = (): void => {
    setTextA(textB);
    setTextB(textA);
    setCsv({ columnA: opts.csv.columnB, columnB: opts.csv.columnA });
  };

  const sizes = [
    ['List A', result.infoA.total, result.infoA.unique],
    ['List B', result.infoB.total, result.infoB.unique],
  ] as const;

  const tabData: Record<TabId, { entries: Entry[]; side: 'A' | 'B' | 'both' }> = {
    onlyA: { entries: result.onlyA, side: 'A' },
    onlyB: { entries: result.onlyB, side: 'B' },
    both: { entries: result.both, side: 'both' },
    union: { entries: result.union, side: 'both' },
    symmetric: { entries: result.symmetric, side: 'both' },
    dupA: { entries: result.dupA, side: 'A' },
    dupB: { entries: result.dupB, side: 'B' },
  };
  const isDupTab = tab === 'dupA' || tab === 'dupB';

  return (
    <div className="space-y-4">
      <OptionsBar>
        <Field label="Item delimiter" className="w-44">
          <Select value={opts.delimiter} onValueChange={(v) => set('delimiter', v as Delimiter)} disabled={opts.csv.enabled}>
            <SelectTrigger className="w-full" aria-label="Item delimiter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newline">Newline</SelectItem>
              <SelectItem value="comma">Comma</SelectItem>
              <SelectItem value="semicolon">Semicolon</SelectItem>
              <SelectItem value="tab">Tab</SelectItem>
              <SelectItem value="space">Space</SelectItem>
              <SelectItem value="auto">Auto-detect</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Sort results" className="w-40">
          <Select value={opts.sort} onValueChange={(v) => set('sort', v as SortMode)}>
            <SelectTrigger className="w-full" aria-label="Sort results">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="original">First-seen order</SelectItem>
              <SelectItem value="az">A → Z</SelectItem>
              <SelectItem value="za">Z → A</SelectItem>
              <SelectItem value="natural">Natural (2 &lt; 10)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Copy / download as" className="w-40">
          <Select value={sep} onValueChange={(v) => setSep(v as OutputSeparator)}>
            <SelectTrigger className="w-full" aria-label="Output separator">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newline">One per line</SelectItem>
              <SelectItem value="comma">Comma</SelectItem>
              <SelectItem value="comma-space">Comma + space</SelectItem>
              <SelectItem value="semicolon">Semicolon</SelectItem>
              <SelectItem value="tab">Tab</SelectItem>
              <SelectItem value="space">Space</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={swap}>
            <ArrowLeftRight className="size-3.5" /> Swap A/B
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setTextA(SAMPLE_A);
              setTextB(SAMPLE_B);
              setOpts((o) => ({ ...o, csv: { ...o.csv, enabled: false } }));
            }}
          >
            <FileText className="size-3.5" /> Sample
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setTextA('');
              setTextB('');
            }}
          >
            <Eraser className="size-3.5" /> Clear
          </Button>
        </div>
      </OptionsBar>

      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Toggle id="lc-trim" label="Trim" checked={opts.trim} onChange={(v) => set('trim', v)} hint="Remove leading/trailing whitespace from each item" />
          <Toggle id="lc-empty" label="Ignore empty" checked={opts.ignoreEmpty} onChange={(v) => set('ignoreEmpty', v)} hint="Skip blank items" />
          <Toggle id="lc-case" label="Case-insensitive" checked={opts.caseInsensitive} onChange={(v) => set('caseInsensitive', v)} />
          <Toggle id="lc-ws" label="Collapse whitespace" checked={opts.collapseWhitespace} onChange={(v) => set('collapseWhitespace', v)} hint="Runs of spaces/tabs inside an item become one space" />
          <Toggle id="lc-diac" label="Ignore accents" checked={opts.removeDiacritics} onChange={(v) => set('removeDiacritics', v)} hint="é = e (Unicode NFD, combining marks removed)" />
          <Toggle id="lc-num" label="Numeric-aware" checked={opts.numeric} onChange={(v) => set('numeric', v)} hint="007 = 7 and 1.50 = 1.5" />
          <Toggle id="lc-csv" label="CSV column mode" checked={opts.csv.enabled} onChange={(v) => setCsv({ enabled: v })} hint="Compare one column from each pasted CSV" />
        </div>
        {opts.csv.enabled && (
          <div className="flex flex-wrap items-end gap-3 border-t pt-3">
            <Field label="CSV delimiter" className="w-36">
              <Select value={opts.csv.delimiter} onValueChange={(v) => setCsv({ delimiter: v as CsvDelimiter })}>
                <SelectTrigger className="w-full" aria-label="CSV delimiter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-detect</SelectItem>
                  <SelectItem value=",">Comma</SelectItem>
                  <SelectItem value=";">Semicolon</SelectItem>
                  <SelectItem value={'\t'}>Tab</SelectItem>
                  <SelectItem value="|">Pipe</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Toggle id="lc-header" label="First row is a header" checked={opts.csv.header} onChange={(v) => setCsv({ header: v })} />
            <Field label="List A column" className="w-40" hint={opts.csv.header ? 'Header name or number (1 = first)' : 'Number (1 = first)'}>
              <Input value={opts.csv.columnA} onChange={(e) => setCsv({ columnA: e.target.value })} placeholder="email or 2" aria-label="List A column" />
            </Field>
            <Field label="List B column" className="w-40">
              <Input value={opts.csv.columnB} onChange={(e) => setCsv({ columnB: e.target.value })} placeholder="email or 1" aria-label="List B column" />
            </Field>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {([
          ['List A', textA, setTextA, result.infoA],
          ['List B', textB, setTextB, result.infoB],
        ] as const).map(([title, value, setValue, info]) => (
          <Panel key={title}>
            <PanelHeader title={title}>
              {busy && <Loader2 className="mr-1 size-3.5 animate-spin text-muted-foreground" aria-label="Updating" />}
            </PanelHeader>
            <Textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={opts.csv.enabled ? 'Paste CSV (with header row)…' : 'Paste items…'}
              spellCheck={false}
              wrap="off"
              aria-label={title}
              className="field-sizing-fixed h-56 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
            <StatBar className="h-auto py-1.5" items={infoLine(info, opts.csv.enabled)} />
          </Panel>
        ))}
      </div>

      <ErrorBanner error={result.error} className="whitespace-pre-line" />

      {!result.error && (
        <>
          <Panel>
            <PanelHeader title="Summary" />
            <div className="grid grid-cols-1 items-center gap-4 p-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { label: 'Unique in A', value: fmt(sizes[0][2]) },
                  { label: 'Unique in B', value: fmt(sizes[1][2]) },
                  { label: 'In both', value: fmt(result.both.length) },
                  { label: 'Only in A', value: fmt(result.onlyA.length) },
                  { label: 'Only in B', value: fmt(result.onlyB.length) },
                  { label: 'Union', value: fmt(result.union.length) },
                  { label: 'Jaccard similarity', value: fmtPct(result.jaccard) },
                  { label: 'Overlap of A', value: fmtPct(result.overlapA) },
                  { label: 'Overlap of B', value: fmtPct(result.overlapB) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-md border bg-muted/30 px-3 py-2">
                    <div className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</div>
                    <div className="font-mono text-base tabular-nums" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-center">
                <Venn r={result} />
              </div>
            </div>
            <div className="border-t bg-muted/30 px-3 py-1.5 font-mono text-2xs leading-relaxed text-muted-foreground">
              Jaccard = |A∩B| / |A∪B| · Overlap of A = |A∩B| / |A| · All figures count unique items after normalisation
            </div>
          </Panel>

          <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
            <div className="overflow-x-auto">
              <TabsList className="h-9 min-w-max">
                {TABS.map((t) => (
                  <TabsTrigger key={t.id} value={t.id} className="flex-none px-3">
                    {t.label}
                    <span className="rounded bg-background/60 px-1 font-mono text-2xs tabular-nums text-muted-foreground">{fmt(tabData[t.id].entries.length)}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {TABS.map((t) => (
              <TabsContent key={t.id} value={t.id}>
                {isDupTab && (
                  <div className="mb-2">
                    <Toggle id="lc-counts" label="Include counts when copying / downloading" checked={counts} onChange={setCounts} />
                  </div>
                )}
                <ResultList entries={tabData[t.id].entries} side={tabData[t.id].side} sep={sep} withCounts={isDupTab && counts} filename={t.file} />
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}
      <p className="text-2xs text-muted-foreground">
        Items are compared after the selected normalisation; each result shows the first-seen spelling. Non-newline delimiters also split on line breaks. Everything runs in your browser.
      </p>
    </div>
  );
}
