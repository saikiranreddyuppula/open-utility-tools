'use client';

import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import { FileUp, Trash2, Wand2 } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  DEFAULT_FORMAT_OPTIONS,
  FORMAT_LABELS,
  PRESETS,
  aggregate,
  blocksToCidrs,
  cidrToBlock,
  countAddresses,
  dedupeSort,
  entriesToBlocks,
  findOverlaps,
  formatCidr,
  intersectBlocks,
  mergeBlocks,
  parseList,
  prettyCount,
  renderFormat,
  splitCidrs,
  subtractBlocks,
  withCommas,
  type Block,
  type FormatOptions,
  type OutFormat,
  type OverlapPair,
  type ParseResult,
} from './logic';

type Op = 'aggregate' | 'range-to-cidr' | 'cidr-to-range' | 'subtract' | 'intersect' | 'dedupe' | 'overlaps' | 'split';

const OPS: { id: Op; label: string; hint: string }[] = [
  { id: 'aggregate', label: 'Aggregate / merge', hint: 'Merge overlapping and adjacent entries into the minimal set of CIDR blocks.' },
  { id: 'range-to-cidr', label: 'Range → CIDRs', hint: 'Convert each entry (range, IP, netmask form) to its minimal CIDR cover, one by one, without merging across entries.' },
  { id: 'cidr-to-range', label: 'CIDRs → ranges', hint: 'Merge the list and print contiguous first - last address ranges.' },
  { id: 'subtract', label: 'Subtract', hint: 'Remove the exclude list from the input list (e.g. take private ranges out of 0.0.0.0/0).' },
  { id: 'intersect', label: 'Intersect', hint: 'Keep only the address space present in both lists.' },
  { id: 'dedupe', label: 'Dedupe & sort', hint: 'Remove exact duplicates and sort by address. Does not merge nested or adjacent blocks.' },
  { id: 'overlaps', label: 'Detect overlaps', hint: 'Find which input entries duplicate, contain or partially overlap each other.' },
  { id: 'split', label: 'Split into /N', hint: 'Break the (aggregated) blocks into equal subnets of a longer prefix.' },
];

const SAMPLE = `# Mixed list: CIDRs, single IPs, ranges, netmask forms
10.0.0.0/24
10.0.1.0/24
10.0.2.0/23
10.0.0.77            # already covered
192.168.10.0 - 192.168.11.255
172.16.5.130/25      # host bits set -> normalized
203.0.113.0 255.255.255.0
198.51.100.9-198.51.100.200
2001:db8::/33
2001:db8:8000::/33
::ffff:192.0.2.0/120
bogus-entry`;

const OUTPUT_LINE_CAP = 3000;
const MAX_INPUT_CHARS = 8_000_000;

const FORMAT_ORDER: OutFormat[] = ['cidr', 'ranges', 'nginx', 'apache', 'iptables', 'nftables', 'ipset', 'aws', 'csv'];

interface Computed {
  blocks: Block[];
  cidrCount: number;
  overlaps?: { pairs: OverlapPair[]; truncated: boolean };
  notes: string[];
}

function compute(
  op: Op,
  a: ParseResult,
  b: ParseResult | null,
  split: { p4: number; p6: number; limit: number }
): Computed {
  const notes: string[] = [];
  const aBlocks = entriesToBlocks(a.entries);
  switch (op) {
    case 'aggregate': {
      const blocks = mergeBlocks(aBlocks);
      return { blocks, cidrCount: blocksToCidrs(blocks).length, notes };
    }
    case 'range-to-cidr': {
      return { blocks: aBlocks, cidrCount: blocksToCidrs(aBlocks).length, notes };
    }
    case 'cidr-to-range': {
      const blocks = mergeBlocks(aBlocks);
      return { blocks, cidrCount: blocks.length, notes };
    }
    case 'subtract': {
      const blocks = subtractBlocks(aBlocks, b ? entriesToBlocks(b.entries) : []);
      return { blocks, cidrCount: blocksToCidrs(blocks).length, notes };
    }
    case 'intersect': {
      const blocks = intersectBlocks(aBlocks, b ? entriesToBlocks(b.entries) : []);
      return { blocks, cidrCount: blocksToCidrs(blocks).length, notes };
    }
    case 'dedupe': {
      const d = dedupeSort(a.entries);
      if (d.duplicates > 0) notes.push(`${d.duplicates} duplicate${d.duplicates === 1 ? '' : 's'} removed`);
      const blocks = d.cidrs.map(cidrToBlock);
      return { blocks, cidrCount: blocks.length, notes };
    }
    case 'overlaps': {
      const o = findOverlaps(a.entries);
      return { blocks: mergeBlocks(aBlocks), cidrCount: 0, overlaps: o, notes };
    }
    case 'split': {
      const base = aggregate(aBlocks);
      const r = splitCidrs(base, split.p4, split.p6, split.limit);
      notes.push(`${withCommas(r.total)} subnet${r.total === 1n ? '' : 's'} in total`);
      if (r.truncated) notes.push(`showing the first ${withCommas(BigInt(r.cidrs.length))} (raise the limit to see more)`);
      if (r.skipped.length > 0) {
        notes.push(
          `${r.skipped.length} block${r.skipped.length === 1 ? '' : 's'} already smaller than the target prefix (kept out): ${r.skipped
            .slice(0, 3)
            .map((c) => formatCidr(c))
            .join(', ')}${r.skipped.length > 3 ? ', …' : ''}`
        );
      }
      const blocks = r.cidrs.map(cidrToBlock);
      return { blocks, cidrCount: blocks.length, notes };
    }
  }
}

function clampInt(s: string, lo: number, hi: number, fallback: number): number {
  const n = Number(s);
  if (!Number.isFinite(n) || s.trim() === '') return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

function SectionToggle({ summary, children, tone }: { summary: string; children: React.ReactNode; tone?: 'warn' | 'info' }) {
  return (
    <details className={cn('rounded-md border text-xs', tone === 'warn' ? 'border-warning/40 bg-warning/5' : 'bg-muted/30')}>
      <summary className="cursor-pointer select-none px-3 py-1.5 font-medium">{summary}</summary>
      <div className="max-h-56 overflow-auto border-t px-3 py-2 font-mono text-2xs leading-relaxed">{children}</div>
    </details>
  );
}

function ListInput({
  label, value, onChange, placeholder, rows, children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows: number;
  children?: React.ReactNode;
}) {
  return (
    <Panel>
      <PanelHeader title={label}>{children}</PanelHeader>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        placeholder={placeholder}
        rows={rows}
        className="min-h-48 resize-y rounded-none border-0 font-mono text-xs shadow-none focus-visible:ring-0"
      />
    </Panel>
  );
}

export default function CidrAggregatorTool() {
  const [text, setText] = useState(SAMPLE);
  const [textB, setTextB] = useState('');
  const [op, setOp] = useState<Op>('aggregate');
  const [fmt, setFmt] = useState<OutFormat>('cidr');
  const [fo, setFo] = useState<FormatOptions>(DEFAULT_FORMAT_OPTIONS);
  const [mapped, setMapped] = useState<'ipv4' | 'keep'>('ipv4');
  const [p4, setP4] = useState('24');
  const [p6, setP6] = useState('64');
  const [limit, setLimit] = useState('1024');
  const fileRef = useRef<HTMLInputElement>(null);
  const fileRefB = useRef<HTMLInputElement>(null);

  const dText = useDeferredValue(text);
  const dTextB = useDeferredValue(textB);

  const needsB = op === 'subtract' || op === 'intersect';
  const tooBig = dText.length > MAX_INPUT_CHARS || dTextB.length > MAX_INPUT_CHARS;

  const parsedA = useMemo(() => (tooBig ? null : parseList(dText, { mapped })), [dText, mapped, tooBig]);
  const parsedB = useMemo(
    () => (needsB && !tooBig ? parseList(dTextB, { mapped }) : null),
    [dTextB, mapped, needsB, tooBig]
  );

  const splitOpts = useMemo(
    () => ({ p4: clampInt(p4, 0, 32, 24), p6: clampInt(p6, 0, 128, 64), limit: clampInt(limit, 1, 100000, 1024) }),
    [p4, p6, limit]
  );

  const computed = useMemo(
    () => (parsedA ? compute(op, parsedA, parsedB, splitOpts) : null),
    [op, parsedA, parsedB, splitOpts]
  );

  const effectiveFmt = op === 'cidr-to-range' && fmt === 'cidr' ? 'ranges' : fmt;

  const output = useMemo(() => {
    if (!computed || op === 'overlaps') return '';
    return renderFormat(effectiveFmt, computed.blocks, { ...fo, mapped });
  }, [computed, op, effectiveFmt, fo, mapped]);

  const shown = useMemo(() => {
    const lines = output.split('\n');
    if (lines.length <= OUTPUT_LINE_CAP) return { text: output, hidden: 0 };
    return { text: lines.slice(0, OUTPUT_LINE_CAP).join('\n'), hidden: lines.length - OUTPUT_LINE_CAP };
  }, [output]);

  const inCounts = useMemo(() => (parsedA ? countAddresses(entriesToBlocks(parsedA.entries)) : null), [parsedA]);
  const outCounts = useMemo(
    () => (computed && op !== 'overlaps' && op !== 'split' ? countAddresses(computed.blocks) : null),
    [computed, op]
  );

  const normalized = useMemo(() => parsedA?.entries.filter((e) => e.normalized) ?? [], [parsedA]);
  const mappedNotes = useMemo(
    () => parsedA?.entries.filter((e) => e.note?.includes('IPv4-mapped')) ?? [],
    [parsedA]
  );

  const setOpt = <K extends keyof FormatOptions>(k: K, v: FormatOptions[K]) => setFo((f) => ({ ...f, [k]: v }));

  const readFile = useCallback((file: File, target: 'a' | 'b') => {
    const reader = new FileReader();
    reader.onload = () => {
      const t = typeof reader.result === 'string' ? reader.result : '';
      if (target === 'a') setText(t);
      else setTextB(t);
    };
    reader.readAsText(file);
  }, []);

  const addPreset = (cidrs: string[]) => {
    setTextB((cur) => {
      const have = new Set(cur.split(/[\s,;]+/).filter(Boolean));
      const add = cidrs.filter((c) => !have.has(c));
      if (add.length === 0) return cur;
      return (cur.trim() ? cur.replace(/\s*$/, '\n') : '') + add.join('\n') + '\n';
    });
  };

  const showFmtOptions = {
    action: effectiveFmt === 'nginx' || effectiveFmt === 'apache' || effectiveFmt === 'iptables',
    name: effectiveFmt === 'nftables' || effectiveFmt === 'ipset',
    port: effectiveFmt === 'iptables' || effectiveFmt === 'aws',
  };

  const opInfo = OPS.find((o) => o.id === op);
  const ext = effectiveFmt === 'aws' ? 'json' : effectiveFmt === 'csv' ? 'csv' : effectiveFmt === 'cidr' || effectiveFmt === 'ranges' ? 'txt' : 'conf';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Operation">
        {OPS.map((o) => (
          <Button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={op === o.id}
            size="sm"
            variant={op === o.id ? 'default' : 'secondary'}
            onClick={() => setOp(o.id)}
          >
            {o.label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{opInfo?.hint}</p>

      <div className={cn('grid grid-cols-1 gap-4', needsB && 'lg:grid-cols-2')}>
        <ListInput
          label={needsB ? (op === 'subtract' ? 'List A (keep from)' : 'List A') : 'Input list'}
          value={text}
          onChange={setText}
          rows={12}
          placeholder={'10.0.0.0/8\n192.168.1.1\n172.16.0.1 - 172.16.0.99\n10.1.0.0 255.255.0.0\n2001:db8::/32'}
        >
          <Button variant="ghost" size="sm" onClick={() => setText(SAMPLE)}>
            <Wand2 /> Sample
          </Button>
          <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
            <FileUp /> Open file
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.csv,.list,.lst,.conf,text/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) readFile(f, 'a');
              e.target.value = '';
            }}
          />
          <Button variant="ghost" size="sm" onClick={() => setText('')}>
            <Trash2 /> Clear
          </Button>
        </ListInput>

        {needsB && (
          <ListInput
            label={op === 'subtract' ? 'Exclude list (B)' : 'List B'}
            value={textB}
            onChange={setTextB}
            rows={12}
            placeholder={op === 'subtract' ? 'Ranges to remove, same formats as the input…' : 'Second list…'}
          >
            <Button variant="ghost" size="sm" onClick={() => fileRefB.current?.click()}>
              <FileUp /> Open file
            </Button>
            <input
              ref={fileRefB}
              type="file"
              accept=".txt,.csv,.list,.lst,.conf,text/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) readFile(f, 'b');
                e.target.value = '';
              }}
            />
            <Button variant="ghost" size="sm" onClick={() => setTextB('')}>
              <Trash2 /> Clear
            </Button>
          </ListInput>
        )}
      </div>

      {op === 'subtract' && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Quick add to exclude list</span>
          {PRESETS.map((p) => (
            <Button key={p.id} type="button" variant="outline" size="sm" onClick={() => addPreset(p.cidrs)} title={p.cidrs.join(', ')}>
              + {p.label}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addPreset(PRESETS.flatMap((p) => p.cidrs))}
          >
            + All of the above
          </Button>
        </div>
      )}

      <OptionsBar>
        {op === 'split' && (
          <>
            <Field label="IPv4 prefix">
              <Input value={p4} onChange={(e) => setP4(e.target.value)} inputMode="numeric" className="h-8 w-20 font-mono" />
            </Field>
            <Field label="IPv6 prefix">
              <Input value={p6} onChange={(e) => setP6(e.target.value)} inputMode="numeric" className="h-8 w-20 font-mono" />
            </Field>
            <Field label="Max subnets shown">
              <Input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="numeric" className="h-8 w-28 font-mono" />
            </Field>
          </>
        )}
        {op !== 'overlaps' && (
          <Field label="Output format">
            <Select value={effectiveFmt} onValueChange={(v) => setFmt(v as OutFormat)}>
              <SelectTrigger className="h-8 w-60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAT_ORDER.map((f) => (
                  <SelectItem key={f} value={f}>
                    {FORMAT_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        {op !== 'overlaps' && showFmtOptions.action && (
          <Field label="Rule type">
            <Select value={fo.action} onValueChange={(v) => setOpt('action', v as FormatOptions['action'])}>
              <SelectTrigger className="h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="allow">Allowlist</SelectItem>
                <SelectItem value="deny">Denylist</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}
        {op !== 'overlaps' && showFmtOptions.name && (
          <Field label="Set name">
            <Input value={fo.name} onChange={(e) => setOpt('name', e.target.value)} className="h-8 w-36 font-mono" />
          </Field>
        )}
        {op !== 'overlaps' && showFmtOptions.port && (
          <>
            <Field label="Port (optional)">
              <Input value={fo.port} onChange={(e) => setOpt('port', e.target.value)} inputMode="numeric" placeholder="any" className="h-8 w-24 font-mono" />
            </Field>
            <Field label="Protocol">
              <Select value={fo.proto} onValueChange={(v) => setOpt('proto', v as FormatOptions['proto'])}>
                <SelectTrigger className="h-8 w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tcp">tcp</SelectItem>
                  <SelectItem value="udp">udp</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </>
        )}
        <Field label="IPv4-mapped IPv6">
          <Select value={mapped} onValueChange={(v) => setMapped(v as 'ipv4' | 'keep')}>
            <SelectTrigger className="h-8 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ipv4">Convert to IPv4</SelectItem>
              <SelectItem value="keep">Keep as ::ffff:a.b.c.d</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </OptionsBar>

      <ErrorBanner error={tooBig ? 'Input is too large (limit ≈ 8 MB of text per list). Split it into smaller lists.' : null} />

      {parsedA && parsedA.invalid.length > 0 && (
        <SectionToggle tone="warn" summary={`${parsedA.invalid.length} invalid ${op === 'subtract' || op === 'intersect' ? 'List A ' : ''}entr${parsedA.invalid.length === 1 ? 'y' : 'ies'} ignored`}>
          <ul className="space-y-0.5">
            {parsedA.invalid.slice(0, 200).map((i, idx) => (
              <li key={idx}>
                <span className="text-muted-foreground">line {i.line}:</span> {i.text} <span className="text-destructive">- {i.reason}</span>
              </li>
            ))}
            {parsedA.invalid.length > 200 && <li className="text-muted-foreground">… and {parsedA.invalid.length - 200} more</li>}
          </ul>
        </SectionToggle>
      )}
      {parsedB && parsedB.invalid.length > 0 && (
        <SectionToggle tone="warn" summary={`${parsedB.invalid.length} invalid List B entr${parsedB.invalid.length === 1 ? 'y' : 'ies'} ignored`}>
          <ul className="space-y-0.5">
            {parsedB.invalid.slice(0, 200).map((i, idx) => (
              <li key={idx}>
                <span className="text-muted-foreground">line {i.line}:</span> {i.text} <span className="text-destructive">- {i.reason}</span>
              </li>
            ))}
          </ul>
        </SectionToggle>
      )}
      {normalized.length > 0 && (
        <SectionToggle summary={`${normalized.length} non-canonical CIDR${normalized.length === 1 ? '' : 's'} normalized (host bits set)`}>
          <ul className="space-y-0.5">
            {normalized.slice(0, 200).map((e, idx) => (
              <li key={idx}>
                <span className="text-muted-foreground">line {e.line}:</span> {e.raw} → {e.text}
              </li>
            ))}
          </ul>
        </SectionToggle>
      )}
      {mappedNotes.length > 0 && (
        <p className="text-2xs text-muted-foreground">
          {mappedNotes.length} IPv4-mapped IPv6 entr{mappedNotes.length === 1 ? 'y was' : 'ies were'} converted to IPv4. Switch the option above to keep them as IPv6.
        </p>
      )}

      {computed && op === 'overlaps' ? (
        <Panel>
          <PanelHeader title={`Overlaps (${computed.overlaps?.pairs.length ?? 0}${computed.overlaps?.truncated ? '+' : ''})`}>
            <CopyButton
              value={() =>
                (computed.overlaps?.pairs ?? [])
                  .map((p) => `line ${p.a.line}: ${p.a.text} ${p.relation} line ${p.b.line}: ${p.b.text}`)
                  .join('\n')
              }
            />
          </PanelHeader>
          {computed.overlaps && computed.overlaps.pairs.length > 0 ? (
            <div className="max-h-[420px] divide-y overflow-auto">
              {computed.overlaps.pairs.map((p, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 px-3 py-1.5 font-mono text-xs">
                  <span className="text-muted-foreground">L{p.a.line}</span>
                  <span>{p.a.text}</span>
                  <Badge variant={p.relation === 'duplicate' ? 'destructive' : p.relation === 'partial' ? 'outline' : 'muted'}>
                    {p.relation === 'duplicate' ? 'duplicate of' : p.relation === 'contains' ? 'contains' : p.relation === 'partial' ? 'partially overlaps' : 'inside'}
                  </Badge>
                  <span className="text-muted-foreground">L{p.b.line}</span>
                  <span>{p.b.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">No overlaps: every entry is disjoint from the others.</p>
          )}
          <StatBar
            items={[
              `${parsedA?.entries.length ?? 0} entries checked`,
              computed.overlaps?.truncated && 'list truncated at 2000 pairs',
            ]}
          />
        </Panel>
      ) : computed ? (
        <Panel>
          <PanelHeader title={`${opInfo?.label ?? 'Result'} · ${FORMAT_LABELS[effectiveFmt]}`}>
            <CopyButton value={() => output} disabled={!output} />
            <DownloadButton data={() => output} filename={`ip-list-${op}.${ext}`} disabled={!output} />
          </PanelHeader>
          <Textarea
            readOnly
            value={shown.text}
            placeholder="Result appears here…"
            rows={14}
            spellCheck={false}
            className="min-h-72 resize-y rounded-none border-0 font-mono text-xs shadow-none focus-visible:ring-0"
          />
          {shown.hidden > 0 && (
            <p className="border-t bg-warning/10 px-3 py-1 text-2xs text-muted-foreground">
              Showing the first {withCommas(BigInt(OUTPUT_LINE_CAP))} lines; {withCommas(BigInt(shown.hidden))} more are included when you copy or download.
            </p>
          )}
          {computed.notes.length > 0 && (
            <p className="border-t px-3 py-1 text-2xs text-muted-foreground">{computed.notes.join(' · ')}</p>
          )}
          <StatBar
            items={[
              `${withCommas(BigInt(parsedA?.entries.length ?? 0))} input entr${parsedA?.entries.length === 1 ? 'y' : 'ies'}`,
              `${withCommas(BigInt(computed.cidrCount))} ${effectiveFmt === 'ranges' || op === 'cidr-to-range' ? 'range' : 'CIDR'}${computed.cidrCount === 1 ? '' : 's'} out`,
              outCounts && outCounts.v4Blocks + outCounts.v6Blocks > 0 && outCounts.v4 > 0n ? `IPv4: ${prettyCount(outCounts.v4)} addresses` : null,
              outCounts && outCounts.v6 > 0n ? `IPv6: ${prettyCount(outCounts.v6)} addresses` : null,
              outCounts && inCounts && op !== 'dedupe' && outCounts.v4 + outCounts.v6 === 0n ? 'empty result' : null,
            ]}
          />
        </Panel>
      ) : null}

      {inCounts && outCounts && (op === 'subtract' || op === 'intersect' || op === 'aggregate') && (
        <p className="font-mono text-2xs text-muted-foreground">
          Input union: IPv4 {prettyCount(inCounts.v4)}
          {inCounts.v6 > 0n ? ` · IPv6 ${prettyCount(inCounts.v6)}` : ''}
          {' → '}output: IPv4 {prettyCount(outCounts.v4)}
          {inCounts.v6 > 0n || outCounts.v6 > 0n ? ` · IPv6 ${prettyCount(outCounts.v6)}` : ''}
          {outCounts.v6 > 0n && outCounts.v6 > 1000000000000n ? ` (${withCommas(outCounts.v6)})` : ''}
        </p>
      )}

      <p className="text-2xs text-muted-foreground">
        Everything runs locally in your browser. Accepted: <code>10.0.0.0/8</code>, single IPs, <code>a - b</code> ranges, <code>10.0.0.0/255.0.0.0</code> or <code>10.0.0.0 255.0.0.0</code> netmasks
        (wildcard masks too), IPv6 in any notation, <code># comments</code>. Separate entries with new lines, commas or spaces
        (a space before a valid netmask pairs the two). Leading zeros in IPv4 octets are rejected as ambiguous; IPv6 zone IDs are not supported.
      </p>
    </div>
  );
}
