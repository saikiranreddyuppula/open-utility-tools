'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Eraser, FileText, Plus, RotateCcw, Undo2, Wand2, X } from 'lucide-react';

import { Panel, PanelHeader, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

import {
  DEFAULT_PLATFORMS,
  LIMITS_AS_OF,
  METHOD_LABELS,
  analyzeSms,
  basicCounts,
  formatLeft,
  gsmCost,
  hasSegmenter,
  measure,
  replaceSmartPunctuation,
  type CountMethod,
  type Measurement,
  type Platform,
  type Replacement,
} from './logic';

const SAMPLE =
  'Don’t miss our spring sale – 20% off everything… Use code SPRING20 at https://example.com/sale before Sunday! Reply STOP to opt out.';

const STORAGE_KEY = 'ouc:character-limit-checker:v1';
const CUSTOM_METHODS: CountMethod[] = ['graphemes', 'codepoints', 'utf16', 'bytes'];
const APPROX: Set<CountMethod> = new Set(['twitter', 'mastodon']);

interface Saved {
  custom: Platform[];
  overrides: Record<string, number>;
  hidden: string[];
}

const EMPTY_SAVED: Saved = { custom: [], overrides: {}, hidden: [] };

function loadSaved(): Saved {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_SAVED;
    const p = JSON.parse(raw) as Partial<Saved>;
    const custom = Array.isArray(p.custom)
      ? p.custom.filter(
          (c): c is Platform =>
            !!c && typeof c.id === 'string' && typeof c.name === 'string' && typeof c.limit === 'number' && c.limit > 0 && CUSTOM_METHODS.includes(c.method)
        )
      : [];
    const overrides: Record<string, number> = {};
    if (p.overrides && typeof p.overrides === 'object') {
      for (const [k, v] of Object.entries(p.overrides)) if (typeof v === 'number' && v > 0) overrides[k] = v;
    }
    const hidden = Array.isArray(p.hidden) ? p.hidden.filter((h): h is string => typeof h === 'string') : [];
    return { custom, overrides, hidden };
  } catch {
    return EMPTY_SAVED;
  }
}

const nf = (n: number): string => n.toLocaleString('en-US');
const fmtUsed = (n: number): string => (Number.isInteger(n) ? nf(n) : n.toFixed(1));

function CountTile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2" title={hint}>
      <div className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-lg tabular-nums" data-testid={`count-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
        {nf(value)}
      </div>
    </div>
  );
}

function LimitBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const level = formatLeft(used, limit).level;
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={limit}
      aria-valuenow={Math.min(used, limit)}
    >
      <div
        className={cn('h-full rounded-full transition-[width]', level === 'over' ? 'bg-destructive' : level === 'warn' ? 'bg-warning' : 'bg-success')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function CharacterLimitChecker() {
  const [text, setText] = useState(SAMPLE);
  const [undoText, setUndoText] = useState<string | null>(null);
  const [replaced, setReplaced] = useState<{ before: { segments: number; encoding: string }; after: { segments: number; encoding: string }; list: Replacement[] } | null>(null);
  const [saved, setSaved] = useState<Saved>(EMPTY_SAVED);
  const [loaded, setLoaded] = useState(false);
  const [segmenter, setSegmenter] = useState(true);
  const [newName, setNewName] = useState('');
  const [newLimit, setNewLimit] = useState('100');
  const [newMethod, setNewMethod] = useState<CountMethod>('graphemes');
  const idSeq = useRef(0);

  useEffect(() => {
    setSaved(loadSaved());
    setSegmenter(hasSegmenter());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      /* storage unavailable (private mode / blocked) - settings just won't persist */
    }
  }, [saved, loaded]);

  const deferred = useDeferredValue(text);
  const counts = useMemo(() => basicCounts(deferred), [deferred]);
  const sms = useMemo(() => analyzeSms(deferred), [deferred]);
  const smartPreview = useMemo(() => {
    const r = replaceSmartPunctuation(deferred);
    return { ...r, analysis: analyzeSms(r.text) };
  }, [deferred]);

  const platforms = useMemo(() => {
    const base = DEFAULT_PLATFORMS.filter((p) => !saved.hidden.includes(p.id)).map((p) => ({ ...p, limit: saved.overrides[p.id] ?? p.limit }));
    return [...base, ...saved.custom.map((c) => ({ ...c, custom: true }))];
  }, [saved]);

  // Measure once per counting method (many rows share "graphemes").
  const measured = useMemo(() => {
    const out = new Map<CountMethod, Measurement>();
    for (const p of platforms) if (!out.has(p.method)) out.set(p.method, measure(deferred, { limit: 0, method: p.method }));
    return out;
  }, [deferred, platforms]);

  const overCount = platforms.filter((p) => {
    const m = measured.get(p.method);
    return m && m.used > (p.method === 'sms' ? m.limit : p.limit);
  }).length;

  const savingsText = (() => {
    if (smartPreview.replacements.length === 0) return null;
    const a = sms;
    const b = smartPreview.analysis;
    if (a.encoding === 'UCS-2' && b.encoding === 'GSM-7') return `Switches to GSM-7: ${a.segments} → ${b.segments} segment${b.segments === 1 ? '' : 's'}`;
    if (b.segments < a.segments) return `Saves ${a.segments - b.segments} segment${a.segments - b.segments === 1 ? '' : 's'} (${a.segments} → ${b.segments})`;
    return b.encoding === 'UCS-2' ? 'Other non-GSM characters would still force UCS-2' : 'Tidies punctuation; segment count unchanged';
  })();

  const applyReplace = (): void => {
    const r = replaceSmartPunctuation(text);
    if (r.text === text) return;
    const before = analyzeSms(text);
    const after = analyzeSms(r.text);
    setUndoText(text);
    setReplaced({ before: { segments: before.segments, encoding: before.encoding }, after: { segments: after.segments, encoding: after.encoding }, list: r.replacements });
    setText(r.text);
  };

  const addCustom = (): void => {
    const limit = Math.trunc(Number(newLimit));
    if (!Number.isFinite(limit) || limit < 1) return;
    idSeq.current += 1;
    const id = `custom-${Date.now().toString(36)}-${idSeq.current}`;
    setSaved((s) => ({ ...s, custom: [...s.custom, { id, name: newName.trim() || `Custom limit ${s.custom.length + 1}`, limit, method: newMethod, custom: true }] }));
    setNewName('');
  };

  const removePlatform = (p: Platform): void =>
    setSaved((s) => (p.custom ? { ...s, custom: s.custom.filter((c) => c.id !== p.id) } : { ...s, hidden: [...s.hidden, p.id] }));
  const setLimit = (p: Platform, raw: string): void => {
    const n = Math.trunc(Number(raw));
    if (!Number.isFinite(n) || n < 1) return;
    setSaved((s) =>
      p.custom
        ? { ...s, custom: s.custom.map((c) => (c.id === p.id ? { ...c, limit: n } : c)) }
        : { ...s, overrides: { ...s.overrides, [p.id]: n } }
    );
  };
  const resetLimit = (p: Platform): void =>
    setSaved((s) => {
      const o = { ...s.overrides };
      delete o[p.id];
      return { ...s, overrides: o };
    });

  const hasHighlight = sms.encoding === 'UCS-2' && deferred.length <= 4000;
  const highlighted = useMemo(() => {
    if (!hasHighlight) return null;
    return Array.from(deferred).map((ch, i) => ({ ch, bad: gsmCost(ch) === 0, i }));
  }, [deferred, hasHighlight]);

  const grouped = useMemo(() => {
    const m = new Map<string, { char: string; codePoint: number; positions: number[] }>();
    for (const n of sms.nonGsm) {
      const g = m.get(n.char);
      if (g) g.positions.push(n.position);
      else m.set(n.char, { char: n.char, codePoint: n.codePoint, positions: [n.position] });
    }
    return [...m.values()];
  }, [sms]);

  const visible = (ch: string): string => (ch === '\t' ? '⇥ tab' : ch === ' ' ? '· nbsp' : /\s/.test(ch) ? `U+${ch.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}` : ch);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Text">
          <Button type="button" variant="ghost" size="sm" onClick={() => { setText(SAMPLE); setReplaced(null); setUndoText(null); }}>
            <FileText className="size-3.5" /> Sample
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => { setText(''); setReplaced(null); setUndoText(null); }} disabled={!text}>
            <Eraser className="size-3.5" /> Clear
          </Button>
          <CopyButton value={() => text} disabled={!text} />
        </PanelHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or paste your text…"
          spellCheck={false}
          aria-label="Text to measure"
          className="field-sizing-fixed h-48 resize-y rounded-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="grid grid-cols-2 gap-2 border-t bg-muted/20 p-3 sm:grid-cols-3 lg:grid-cols-6">
          <CountTile label="Characters" value={counts.graphemes} hint="Grapheme clusters - what a person sees as one character (an emoji or accented letter = 1)" />
          <CountTile label="Code points" value={counts.codePoints} hint="Unicode scalar values" />
          <CountTile label="UTF-16 units" value={counts.utf16} hint="JavaScript string length / SMS UCS-2 units" />
          <CountTile label="UTF-8 bytes" value={counts.bytes} />
          <CountTile label="Words" value={counts.words} hint="Whitespace-separated" />
          <CountTile label="Lines" value={counts.lines} />
        </div>
        {!segmenter && (
          <div className="border-t bg-muted/30 px-3 py-1.5 text-2xs text-muted-foreground">
            Your browser has no Intl.Segmenter - character counts use an approximate emoji/combining-mark splitter.
          </div>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="SMS segments">
          <Badge variant={sms.encoding === 'GSM-7' ? 'success' : 'destructive'} data-testid="sms-encoding">
            {sms.encoding}
          </Badge>
        </PanelHeader>
        <div className="space-y-4 p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <CountTile label="Segments" value={sms.segments} />
            <CountTile label={sms.encoding === 'GSM-7' ? 'Septets used' : 'UTF-16 units used'} value={sms.units} />
            <CountTile label="Per segment" value={sms.perSegment} hint={sms.segments > 1 ? 'Concatenated messages lose 7 septets / 3 units per segment to the UDH header' : 'Single-segment capacity'} />
            <CountTile label="Left in segment" value={sms.remaining} />
          </div>

          {sms.segmentList.length > 0 && (
            <div className="space-y-1.5" data-testid="segment-bars">
              {sms.segmentList.slice(0, 12).map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-2xs text-muted-foreground">Segment {i + 1}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.min(100, (s.units / sms.perSegment) * 100)}%` }} />
                  </div>
                  <span className="w-16 shrink-0 text-right font-mono text-2xs tabular-nums text-muted-foreground">
                    {s.units}/{sms.perSegment}
                  </span>
                </div>
              ))}
              {sms.segmentList.length > 12 && <div className="text-2xs text-muted-foreground">…and {sms.segmentList.length - 12} more segments</div>}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {sms.encoding === 'GSM-7'
              ? `GSM-7: 160 characters in one message, 153 per segment when split.${sms.extensionChars > 0 ? ` ${sms.extensionChars} extension character${sms.extensionChars === 1 ? '' : 's'} (^ { } \\ [ ~ ] | € and form feed) count as 2.` : ''}`
              : 'UCS-2: 70 characters in one message, 67 per segment when split. A single non-GSM character switches the whole message to UCS-2, and emoji cost 2 units each.'}{' '}
            Escape pairs and surrogate pairs are never split across segments.
          </p>

          {grouped.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Characters forcing UCS-2 ({sms.nonGsm.length})</div>
              <ul className="flex flex-wrap gap-1.5" data-testid="non-gsm-list">
                {grouped.slice(0, 40).map((g) => (
                  <li key={g.char} className="flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1 text-xs">
                    <span className="font-mono text-sm">{visible(g.char)}</span>
                    <span className="font-mono text-2xs text-muted-foreground">U+{g.codePoint.toString(16).toUpperCase().padStart(4, '0')}</span>
                    <span className="text-2xs text-muted-foreground">
                      at {g.positions.slice(0, 6).join(', ')}
                      {g.positions.length > 6 ? ` +${g.positions.length - 6}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
              {grouped.length > 40 && <div className="text-2xs text-muted-foreground">…and {grouped.length - 40} more distinct characters</div>}
            </div>
          )}

          {highlighted && (
            <div className="rounded-md border bg-muted/20 p-2 text-xs leading-relaxed">
              <div className="mb-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground">Highlighted</div>
              <div className="whitespace-pre-wrap break-words font-mono" data-testid="highlighted">
                {highlighted.map(({ ch, bad, i }) =>
                  bad ? (
                    <mark key={i} className="rounded-sm bg-destructive/25 px-px text-foreground">
                      {ch}
                    </mark>
                  ) : (
                    <span key={i}>{ch}</span>
                  )
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 p-2">
            <Button type="button" size="sm" onClick={applyReplace} disabled={smartPreview.replacements.length === 0} data-testid="replace-smart" className="h-auto whitespace-normal py-1.5 text-left">
              <Wand2 className="size-3.5" /> Replace smart punctuation with GSM-safe equivalents
            </Button>
            {undoText !== null && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setText(undoText);
                  setUndoText(null);
                  setReplaced(null);
                }}
              >
                <Undo2 className="size-3.5" /> Undo
              </Button>
            )}
            <span className="text-xs text-muted-foreground" data-testid="savings">
              {savingsText ?? (replaced ? '' : 'No curly quotes, dashes, ellipses or special spaces found.')}
            </span>
          </div>
          {replaced && (
            <div className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs" data-testid="replaced-note">
              Replaced {replaced.list.reduce((n, r) => n + r.count, 0)} character{replaced.list.reduce((n, r) => n + r.count, 0) === 1 ? '' : 's'} (
              {replaced.list.map((r) => `${r.label} ×${r.count}`).join(', ')}). {replaced.before.encoding} · {replaced.before.segments} segment
              {replaced.before.segments === 1 ? '' : 's'} → {replaced.after.encoding} · {replaced.after.segments} segment{replaced.after.segments === 1 ? '' : 's'}.
            </div>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title={`Platform limits - as of ${LIMITS_AS_OF}`}>
          {overCount > 0 && <Badge variant="destructive">{overCount} over</Badge>}
          <Button type="button" variant="ghost" size="sm" onClick={() => setSaved(EMPTY_SAVED)} title="Restore default limits and remove custom ones">
            <RotateCcw className="size-3.5" /> Reset
          </Button>
        </PanelHeader>
        <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2" data-testid="platforms">
          {platforms.map((p) => {
            const m = measured.get(p.method) ?? { used: 0, limit: p.limit };
            const isSms = p.method === 'sms';
            const limit = isSms ? sms.singleLimit : p.limit;
            const used = m.used;
            const left = formatLeft(used, limit);
            const overridden = !p.custom && saved.overrides[p.id] !== undefined;
            const extra = isSms ? `${sms.encoding} · ${sms.segments} segment${sms.segments === 1 ? '' : 's'}` : m.extra;
            return (
              <div key={p.id} className="space-y-1.5 rounded-md border bg-card p-2.5" data-testid={`platform-${p.id}`}>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 text-sm font-medium leading-tight" title={p.note ?? METHOD_LABELS[p.method]}>
                    {p.name}
                  </span>
                  {APPROX.has(p.method) && (
                    <Badge variant="muted" title="Counting rules are approximated from the public documentation">
                      approximate
                    </Badge>
                  )}
                  {p.custom && <Badge variant="outline">custom</Badge>}
                  {isSms ? (
                    <span className="w-20 text-right font-mono text-xs text-muted-foreground">{limit}</span>
                  ) : (
                    <Input
                      type="number"
                      min={1}
                      value={p.limit}
                      onChange={(e) => setLimit(p, e.target.value)}
                      className="h-7 w-20 px-1.5 text-right font-mono text-xs"
                      aria-label={`${p.name} limit`}
                    />
                  )}
                  {overridden && (
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => resetLimit(p)} aria-label={`Reset ${p.name} limit`} title="Reset to default">
                      <RotateCcw className="size-3" />
                    </Button>
                  )}
                  {!isSms && (
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => removePlatform(p)} aria-label={`Remove ${p.name}`} title="Remove from list">
                      <X className="size-3.5" />
                    </Button>
                  )}
                </div>
                <LimitBar used={used} limit={limit} />
                <div className="flex flex-wrap items-center justify-between gap-x-3 font-mono text-2xs tabular-nums">
                  <span data-testid={`used-${p.id}`}>
                    {fmtUsed(used)} / {nf(limit)}
                    {extra ? <span className="ml-2 text-muted-foreground">{extra}</span> : null}
                  </span>
                  <span className={cn(left.level === 'over' ? 'text-destructive' : left.level === 'warn' ? 'text-warning' : 'text-muted-foreground')}>{left.text}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-end gap-3 border-t bg-muted/20 p-3">
          <Field label="Add a custom limit" className="min-w-40 flex-1">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name (e.g. Push notification)" aria-label="Custom limit name" />
          </Field>
          <Field label="Limit" className="w-24">
            <Input type="number" min={1} value={newLimit} onChange={(e) => setNewLimit(e.target.value)} aria-label="Custom limit value" />
          </Field>
          <Field label="Count" className="w-48">
            <Select value={newMethod} onValueChange={(v) => setNewMethod(v as CountMethod)}>
              <SelectTrigger className="w-full" aria-label="Counting method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOM_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {METHOD_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button type="button" size="sm" onClick={addCustom}>
            <Plus className="size-3.5" /> Add
          </Button>
        </div>
        <div className="border-t bg-muted/30 px-3 py-1.5 text-2xs leading-relaxed text-muted-foreground">
          Limits as of {LIMITS_AS_OF} - platforms change them, so verify before publishing · X and Mastodon counts are approximations of the official algorithms · Saved in this browser only
        </div>
      </Panel>
    </div>
  );
}
