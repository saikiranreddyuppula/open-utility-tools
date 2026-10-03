'use client';

import { useCallback, useMemo, useState } from 'react';
import { Eraser, Wand2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Panel, PanelHeader, Field, StatBar } from '@/components/tools/panel';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { cn } from '@/lib/utils';
import {
  ENCODINGS,
  FORMAT_EXT,
  FORMAT_LABELS,
  FORMAT_MIME,
  FPS_PRESETS,
  WARNING_LABELS,
  analyzeCues,
  applyLinear,
  cleanCues,
  decodeSubtitleBytes,
  formatDisplayTime,
  fpsFactor,
  parseOffsetInput,
  parseSubtitles,
  parseTimeInput,
  postProcess,
  serialize,
  shiftCues,
  shiftToFirstStart,
  solveTwoPoint,
  sortCues,
  type CleanOptions,
  type Cue,
  type CueRange,
  type OutFormat,
  type SubFormat,
  type TxtLayout,
  type WarningKind,
} from './logic';

const SAMPLE = `1
00:00:01,000 --> 00:00:03,500
[phone buzzing]

2
00:00:04,000 --> 00:00:07,200
<i>Hey, are you coming tonight?</i>
I saved you a seat near the front.

3
00:00:07,000 --> 00:00:09,000
- Of course!
- (laughs) Wouldn't miss it.

4
00:00:12,300 --> 00:00:12,900
Okay.

5
00:00:15,000 --> 00:00:19,800
JOHN: This line is much too long to read comfortably, so it will trigger the line length and reading speed warnings.

6
00:00:21,000 --> 00:00:24,000
♪ And the band played on ♪
`;

const MAX_BYTES = 8 * 1024 * 1024;
const PREVIEW_ROWS = 400;

const SOURCE_FORMATS: { id: SubFormat | 'auto'; label: string }[] = [
  { id: 'auto', label: 'Auto-detect' },
  { id: 'srt', label: 'SRT' },
  { id: 'vtt', label: 'WebVTT' },
  { id: 'sbv', label: 'SBV' },
  { id: 'ass', label: 'ASS / SSA' },
  { id: 'lrc', label: 'LRC' },
  { id: 'ttml', label: 'TTML / DFXP' },
];

const OUT_FORMATS: OutFormat[] = ['srt', 'vtt', 'sbv', 'ass', 'lrc', 'ttml', 'txt', 'csv'];

type TimingTab = 'off' | 'shift' | 'sync' | 'fps';
type ShiftMode = 'by' | 'first';

function Check({
  checked,
  onChange,
  children,
  title,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs" title={title}>
      <Checkbox checked={checked} onCheckedChange={(c) => onChange(c === true)} />
      <span>{children}</span>
    </label>
  );
}

function NumInput({
  value,
  onChange,
  min = 0,
  className,
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      min={min}
      aria-label={ariaLabel}
      value={String(value)}
      onChange={(e) => {
        const n = Math.floor(Number(e.target.value));
        onChange(Number.isFinite(n) ? Math.max(min, n) : min);
      }}
      className={cn('h-7 w-20 font-mono text-xs', className)}
    />
  );
}

function baseName(name: string | null): string {
  if (!name) return 'subtitles';
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  return base || 'subtitles';
}

interface TimingResult {
  cues: Cue[];
  error: string | null;
  info: string | null;
}

export default function SubtitleConverterTool() {
  const [input, setInput] = useState(SAMPLE);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawBytes, setRawBytes] = useState<Uint8Array | null>(null);
  const [encoding, setEncoding] = useState('auto');
  const [usedEncoding, setUsedEncoding] = useState<string | null>(null);
  const [srcFormat, setSrcFormat] = useState<SubFormat | 'auto'>('auto');
  const [outFormat, setOutFormat] = useState<OutFormat>('vtt');
  const [readError, setReadError] = useState<string | null>(null);

  // clean-up
  const [stripTagsOpt, setStripTagsOpt] = useState(false);
  const [removeSdh, setRemoveSdh] = useState(false);
  const [removeSpeakers, setRemoveSpeakers] = useState(false);
  const [mergeLines, setMergeLines] = useState(false);
  const [maxLineChars, setMaxLineChars] = useState(0);
  const [dropEmpty, setDropEmpty] = useState(true);
  const [sortOpt, setSortOpt] = useState(true);
  const [fixOverlaps, setFixOverlaps] = useState(false);
  const [overlapGap, setOverlapGap] = useState(0);
  const [minDuration, setMinDuration] = useState(0);
  const [maxDuration, setMaxDuration] = useState(0);

  // timing
  const [timingTab, setTimingTab] = useState<TimingTab>('off');
  const [shiftMode, setShiftMode] = useState<ShiftMode>('by');
  const [shiftBy, setShiftBy] = useState('0');
  const [firstAt, setFirstAt] = useState('00:00:00,000');
  const [syncA, setSyncA] = useState(1);
  const [syncAAt, setSyncAAt] = useState('');
  const [syncB, setSyncB] = useState(0);
  const [syncBAt, setSyncBAt] = useState('');
  const [fpsFrom, setFpsFrom] = useState('23.976');
  const [fpsTo, setFpsTo] = useState('25');
  const [rangeOn, setRangeOn] = useState(false);
  const [rangeFrom, setRangeFrom] = useState(1);
  const [rangeTo, setRangeTo] = useState(9999);

  // output options
  const [lrcMarkers, setLrcMarkers] = useState(true);
  const [txtLayout, setTxtLayout] = useState<TxtLayout>('lines');
  const [vttNumbered, setVttNumbered] = useState(false);
  const [bom, setBom] = useState(false);
  const [crlf, setCrlf] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const loadFile = useCallback(async (file: File, enc: string) => {
    setReadError(null);
    if (file.size > MAX_BYTES) {
      setReadError(`File is ${(file.size / 1048576).toFixed(1)} MB; the limit is ${MAX_BYTES / 1048576} MB.`);
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { text, used } = decodeSubtitleBytes(bytes, enc);
      setRawBytes(bytes);
      setUsedEncoding(used);
      setFileName(file.name);
      setInput(text);
    } catch (e) {
      setReadError(e instanceof Error ? e.message : 'Could not read that file.');
    }
  }, []);

  const changeEncoding = useCallback(
    (enc: string) => {
      setEncoding(enc);
      if (!rawBytes) return;
      try {
        const { text, used } = decodeSubtitleBytes(rawBytes, enc);
        setInput(text);
        setUsedEncoding(used);
      } catch {
        setReadError('That encoding is not supported by this browser.');
      }
    },
    [rawBytes]
  );

  const parsed = useMemo(() => (input.trim() ? parseSubtitles(input, srcFormat) : null), [input, srcFormat]);

  const cleanOpts: CleanOptions = useMemo(
    () => ({
      stripTags: stripTagsOpt,
      removeSdh,
      removeSpeakers,
      mergeLines,
      maxLineChars,
      dropEmpty,
    }),
    [stripTagsOpt, removeSdh, removeSpeakers, mergeLines, maxLineChars, dropEmpty]
  );

  const base: Cue[] = useMemo(() => {
    if (!parsed) return [];
    const cleaned = cleanCues(parsed.cues, cleanOpts);
    return sortOpt ? sortCues(cleaned) : cleaned;
  }, [parsed, cleanOpts, sortOpt]);

  const range: CueRange = useMemo(() => {
    if (!rangeOn) return null;
    const from = Math.max(1, Math.min(rangeFrom, rangeTo));
    const to = Math.max(from, rangeTo);
    return { from, to };
  }, [rangeOn, rangeFrom, rangeTo]);

  const timing: TimingResult = useMemo(() => {
    const none: TimingResult = { cues: base, error: null, info: null };
    if (base.length === 0 || timingTab === 'off') return none;
    if (timingTab === 'shift') {
      if (shiftMode === 'by') {
        const ms = parseOffsetInput(shiftBy);
        if (ms === null) return { ...none, error: 'Enter an offset like -1500, 2.5s, -300ms or -00:00:01,500.' };
        return { cues: shiftCues(base, ms, range), error: null, info: ms === 0 ? null : `Shifted by ${ms > 0 ? '+' : ''}${ms} ms` };
      }
      const t = parseTimeInput(firstAt);
      if (t === null || t < 0) return { ...none, error: 'Enter a start time like 00:01:02,500 or 62.5.' };
      return { cues: shiftToFirstStart(base, t, range), error: null, info: `First cue starts at ${formatDisplayTime(t)}` };
    }
    if (timingTab === 'sync') {
      const a = base[syncA - 1];
      const bIdx = syncB > 0 ? syncB : base.length;
      const b = base[bIdx - 1];
      if (!a || !b) return { ...none, error: `Cue numbers must be between 1 and ${base.length}.` };
      if (syncA === bIdx) return { ...none, error: 'Pick two different cues.' };
      const aNew = syncAAt.trim() ? parseTimeInput(syncAAt) : a.start;
      const bNew = syncBAt.trim() ? parseTimeInput(syncBAt) : b.start;
      if (aNew === null || bNew === null) return { ...none, error: 'Enter new start times like 00:01:02,500 (leave empty to keep the current time).' };
      const p = solveTwoPoint(a.start, aNew, b.start, bNew);
      if (!p) return { ...none, error: 'The two cues need different start times, and their new times must keep the same order.' };
      return {
        cues: applyLinear(base, p.m, p.c, range),
        error: null,
        info: `Scale ×${p.m.toFixed(6)}, then ${p.c >= 0 ? '+' : ''}${Math.round(p.c)} ms`,
      };
    }
    const from = FPS_PRESETS.find((p) => p.id === fpsFrom)?.value ?? 25;
    const to = FPS_PRESETS.find((p) => p.id === fpsTo)?.value ?? 25;
    const f = fpsFactor(from, to);
    return { cues: applyLinear(base, f, 0, range), error: null, info: `Time scale ×${f.toFixed(6)}` };
  }, [base, timingTab, shiftMode, shiftBy, firstAt, syncA, syncAAt, syncB, syncBAt, fpsFrom, fpsTo, range]);

  const finalCues = useMemo(
    () => postProcess(timing.cues, { sort: false, fixOverlaps, overlapGap, minDuration, maxDuration }),
    [timing.cues, fixOverlaps, overlapGap, minDuration, maxDuration]
  );

  const warnings = useMemo(() => analyzeCues(finalCues), [finalCues]);
  const warnTotals = useMemo(() => {
    const t: Partial<Record<WarningKind, number>> = {};
    for (const w of warnings) for (const k of w.kinds) t[k] = (t[k] ?? 0) + 1;
    return t;
  }, [warnings]);

  const output = useMemo(
    () => (finalCues.length ? serialize(finalCues, outFormat, { lrcEndMarkers: lrcMarkers, txtLayout, vttNumbered }) : ''),
    [finalCues, outFormat, lrcMarkers, txtLayout, vttNumbered]
  );
  const exportText = useMemo(() => {
    const t = crlf ? output.replace(/\n/g, '\r\n') : output;
    return bom ? `﻿${t}` : t;
  }, [output, crlf, bom]);

  const inputError = useMemo(() => {
    if (!input.trim()) return null;
    if (!parsed) return 'Could not recognise the format. Paste SRT, WebVTT, SBV, ASS/SSA, LRC or TTML, or pick the format manually.';
    if (parsed.cues.length === 0) return `No cues found when reading as ${FORMAT_LABELS[parsed.format]}. Check the format selection.`;
    return null;
  }, [input, parsed]);

  const sameExt = parsed && FORMAT_EXT[outFormat] === FORMAT_EXT[parsed.format];
  const downloadName = `${baseName(fileName)}${sameExt ? '-edited' : ''}.${FORMAT_EXT[outFormat]}`;

  const first = finalCues[0];
  const last = finalCues[finalCues.length - 1];
  const spanMs = first && last ? Math.max(...finalCues.map((c) => c.end)) - first.start : 0;
  const shownRows = showAll ? finalCues : finalCues.slice(0, PREVIEW_ROWS);

  const cleanActive = stripTagsOpt || removeSdh || removeSpeakers || mergeLines || maxLineChars > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* INPUT */}
      <Panel>
        <PanelHeader title="Input">
          {parsed && <Badge variant="secondary">{FORMAT_LABELS[parsed.format]}</Badge>}
          <Button variant="ghost" size="sm" onClick={() => { setInput(SAMPLE); setFileName(null); setRawBytes(null); setUsedEncoding(null); }}>
            Sample
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Clear input"
            aria-label="Clear input"
            disabled={!input}
            onClick={() => { setInput(''); setFileName(null); setRawBytes(null); setUsedEncoding(null); setReadError(null); }}
          >
            <Eraser className="size-3.5" />
          </Button>
        </PanelHeader>
        <div className="grid gap-3 p-3 lg:grid-cols-[1fr_16rem]">
          <Textarea
            value={input}
            onChange={(e) => { setInput(e.target.value); setRawBytes(null); }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const f = e.dataTransfer.files[0];
              if (f) {
                e.preventDefault();
                void loadFile(f, encoding);
              }
            }}
            spellCheck={false}
            placeholder="Paste subtitles here (SRT, WebVTT, SBV, ASS/SSA, LRC, TTML) or drop a file…"
            aria-label="Subtitle input"
            className="field-sizing-fixed h-60 resize-y font-mono text-xs"
          />
          <div className="flex flex-col gap-3">
            <FileDropzone
              compact
              onFiles={(f) => { const file = f[0]; if (file) void loadFile(file, encoding); }}
              accept=".srt,.vtt,.sbv,.ass,.ssa,.lrc,.ttml,.dfxp,.xml,.txt,text/*"
              label={fileName ?? 'Drop a subtitle file'}
              hint={fileName ? (usedEncoding ? `decoded as ${usedEncoding}` : 'click to replace') : 'or click to browse'}
            />
            <Field label="Input format">
              <Select value={srcFormat} onValueChange={(v) => setSrcFormat(v as SubFormat | 'auto')}>
                <SelectTrigger className="w-full" aria-label="Input format"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCE_FORMATS.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {rawBytes && (
              <Field label="File encoding" hint="Pick another one if accents look garbled.">
                <Select value={encoding} onValueChange={changeEncoding}>
                  <SelectTrigger className="w-full" aria-label="File encoding"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENCODINGS.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>
        </div>
        <StatBar items={[parsed ? `${parsed.cues.length} cues read` : 'no cues', `${input.length.toLocaleString()} chars`]} />
      </Panel>

      <ErrorBanner error={readError ?? inputError} />

      {/* SETTINGS */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Panel>
          <PanelHeader title="Output" />
          <div className="space-y-3 p-3">
            <Field label="Convert to">
              <Select value={outFormat} onValueChange={(v) => setOutFormat(v as OutFormat)}>
                <SelectTrigger className="w-full" aria-label="Output format"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OUT_FORMATS.map((f) => (
                    <SelectItem key={f} value={f}>{FORMAT_LABELS[f]} (.{FORMAT_EXT[f]})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="space-y-2">
              {outFormat === 'lrc' && (
                <Check checked={lrcMarkers} onChange={setLrcMarkers} title="Adds an empty [mm:ss.xx] line where a cue ends and the next does not follow immediately">
                  Empty timestamp where a cue ends
                </Check>
              )}
              {outFormat === 'vtt' && <Check checked={vttNumbered} onChange={setVttNumbered}>Number the cues</Check>}
              {outFormat === 'txt' && (
                <Field label="Text layout">
                  <Select value={txtLayout} onValueChange={(v) => setTxtLayout(v as TxtLayout)}>
                    <SelectTrigger className="w-full" aria-label="Text layout"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lines">One line per cue</SelectItem>
                      <SelectItem value="blocks">Keep line breaks, blank line between cues</SelectItem>
                      <SelectItem value="paragraph">Single paragraph</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Check checked={bom} onChange={setBom} title="Helps some Windows players detect UTF-8">UTF-8 byte-order mark (BOM)</Check>
              <Check checked={crlf} onChange={setCrlf}>Windows line endings (CRLF)</Check>
            </div>
            <p className="text-2xs text-muted-foreground">
              Cues are renumbered 1…N on export. SRT uses comma milliseconds, WebVTT a dot and the WEBVTT header. Everything stays in your browser.
            </p>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Timing">
            <Tabs value={timingTab} onValueChange={(v) => setTimingTab(v as TimingTab)}>
              <TabsList className="h-7">
                <TabsTrigger value="off" className="h-6 px-2">Off</TabsTrigger>
                <TabsTrigger value="shift" className="h-6 px-2">Shift</TabsTrigger>
                <TabsTrigger value="sync" className="h-6 px-2">Sync</TabsTrigger>
                <TabsTrigger value="fps" className="h-6 px-2">FPS</TabsTrigger>
              </TabsList>
            </Tabs>
          </PanelHeader>
          <div className="space-y-3 p-3">
            {timingTab === 'off' && (
              <p className="text-xs text-muted-foreground">
                Choose <b>Shift</b> to delay or advance everything, <b>Sync</b> to fix drift using two reference cues, or <b>FPS</b> to retime for a different frame rate.
              </p>
            )}
            {timingTab === 'shift' && (
              <div className="space-y-2">
                <Tabs value={shiftMode} onValueChange={(v) => setShiftMode(v as ShiftMode)}>
                  <TabsList className="w-full">
                    <TabsTrigger value="by">Shift by</TabsTrigger>
                    <TabsTrigger value="first">First cue starts at</TabsTrigger>
                  </TabsList>
                </Tabs>
                {shiftMode === 'by' ? (
                  <Field label="Offset" hint="Milliseconds by default. Negative = earlier. Also accepts 2.5s or -00:00:01,500.">
                    <div className="flex flex-wrap items-center gap-1">
                      <Input value={shiftBy} onChange={(e) => setShiftBy(e.target.value)} aria-label="Shift offset" className="h-7 w-28 font-mono text-xs" />
                      {[-1000, -100, 100, 1000].map((d) => (
                        <Button
                          key={d}
                          variant="outline"
                          size="sm"
                          onClick={() => setShiftBy(String((parseOffsetInput(shiftBy) ?? 0) + d))}
                        >
                          {d > 0 ? '+' : '−'}{Math.abs(d) >= 1000 ? `${Math.abs(d) / 1000}s` : `${Math.abs(d)}ms`}
                        </Button>
                      ))}
                    </div>
                  </Field>
                ) : (
                  <Field label="New start of the first cue" hint="hh:mm:ss,ms (or seconds).">
                    <Input value={firstAt} onChange={(e) => setFirstAt(e.target.value)} aria-label="First cue start" className="h-7 w-40 font-mono text-xs" />
                  </Field>
                )}
              </div>
            )}
            {timingTab === 'sync' && (
              <div className="space-y-2">
                <p className="text-2xs text-muted-foreground">
                  Tell the tool where two cues should really start; everything in between is stretched linearly.
                </p>
                <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-2 text-xs">
                  <span className="flex items-center gap-1">Cue <NumInput ariaLabel="Sync cue A" value={syncA} min={1} onChange={setSyncA} className="w-16" /></span>
                  <Input
                    value={syncAAt}
                    onChange={(e) => setSyncAAt(e.target.value)}
                    aria-label="Cue A new start"
                    placeholder={base[syncA - 1] ? `now ${formatDisplayTime(base[syncA - 1]?.start ?? 0)}` : 'new start'}
                    className="h-7 font-mono text-xs"
                  />
                  <span className="flex items-center gap-1">Cue <NumInput ariaLabel="Sync cue B" value={syncB > 0 ? syncB : Math.max(1, base.length)} min={1} onChange={setSyncB} className="w-16" /></span>
                  <Input
                    value={syncBAt}
                    onChange={(e) => setSyncBAt(e.target.value)}
                    aria-label="Cue B new start"
                    placeholder={base[(syncB > 0 ? syncB : base.length) - 1] ? `now ${formatDisplayTime(base[(syncB > 0 ? syncB : base.length) - 1]?.start ?? 0)}` : 'new start'}
                    className="h-7 font-mono text-xs"
                  />
                </div>
              </div>
            )}
            {timingTab === 'fps' && (
              <div className="space-y-2">
                <p className="text-2xs text-muted-foreground">
                  Subtitles timed for one frame rate drift when the video is a different one (e.g. 23.976 → 25 fps).
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <Field label="From fps">
                    <Select value={fpsFrom} onValueChange={setFpsFrom}>
                      <SelectTrigger size="sm" className="w-24" aria-label="From fps"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FPS_PRESETS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="To fps">
                    <Select value={fpsTo} onValueChange={setFpsTo}>
                      <SelectTrigger size="sm" className="w-24" aria-label="To fps"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FPS_PRESETS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </div>
            )}
            {timingTab !== 'off' && (
              <div className="space-y-1.5 border-t pt-2">
                <Check checked={rangeOn} onChange={setRangeOn}>Only apply to a range of cues</Check>
                {rangeOn && (
                  <div className="flex items-center gap-2 text-xs">
                    from # <NumInput ariaLabel="Range from" min={1} value={rangeFrom} onChange={setRangeFrom} />
                    to # <NumInput ariaLabel="Range to" min={1} value={rangeTo} onChange={setRangeTo} />
                  </div>
                )}
              </div>
            )}
            <ErrorBanner error={timing.error} />
            {timing.info && !timing.error && <p className="font-mono text-2xs text-muted-foreground">{timing.info}</p>}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Clean-up">
            <Wand2 className="size-3.5 text-muted-foreground" />
          </PanelHeader>
          <div className="space-y-2 p-3">
            <Check checked={stripTagsOpt} onChange={setStripTagsOpt}>Remove formatting tags (&lt;i&gt;, &lt;font&gt;, {'{\\an8}'})</Check>
            <Check checked={removeSdh} onChange={setRemoveSdh} title="Removes [..], (..), {..} and lines with ♪. Ordinary parentheses go too.">
              Remove [music] (laughs) ♪ annotations
            </Check>
            <Check checked={removeSpeakers} onChange={setRemoveSpeakers}>Remove speaker labels (JOHN:)</Check>
            <Check checked={mergeLines} onChange={setMergeLines}>Merge lines of each cue</Check>
            <div className="flex items-center gap-2 text-xs">
              <NumInput ariaLabel="Max characters per line" value={maxLineChars} onChange={setMaxLineChars} />
              <span>max chars per line <span className="text-muted-foreground">(0 = off, re-wraps)</span></span>
            </div>
            <Check checked={dropEmpty} onChange={setDropEmpty}>Drop empty cues</Check>
            <Check checked={sortOpt} onChange={setSortOpt}>Sort cues by start time</Check>
            <div className="flex flex-wrap items-center gap-2">
              <Check checked={fixOverlaps} onChange={setFixOverlaps}>Fix overlaps (trim end), gap</Check>
              <NumInput ariaLabel="Overlap gap in ms" value={overlapGap} onChange={setOverlapGap} className="w-16" />
              <span className="text-xs text-muted-foreground">ms</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <NumInput ariaLabel="Minimum duration in ms" value={minDuration} onChange={setMinDuration} className="w-20" />
              <span>min duration ms <span className="text-muted-foreground">(0 = off)</span></span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <NumInput ariaLabel="Maximum duration in ms" value={maxDuration} onChange={setMaxDuration} className="w-20" />
              <span>max duration ms <span className="text-muted-foreground">(0 = off)</span></span>
            </div>
            {cleanActive && <p className="text-2xs text-muted-foreground">Clean-up changes cue text before conversion.</p>}
          </div>
        </Panel>
      </div>

      {/* PREVIEW */}
      <Panel>
        <PanelHeader title="Preview">
          {Object.entries(warnTotals).map(([k, n]) => (
            <Badge key={k} variant="outline" className="border-warning/50 text-warning" title={WARNING_LABELS[k as WarningKind]}>
              {n} {WARNING_LABELS[k as WarningKind].toLowerCase()}
            </Badge>
          ))}
        </PanelHeader>
        {finalCues.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No cues to show yet.</p>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full min-w-[640px] border-collapse text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr className="text-left text-2xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="w-12 px-2 py-1.5 font-medium">#</th>
                  <th scope="col" className="w-28 px-2 py-1.5 font-medium">Start</th>
                  <th scope="col" className="w-28 px-2 py-1.5 font-medium">End</th>
                  <th scope="col" className="w-16 px-2 py-1.5 font-medium">Dur</th>
                  <th scope="col" className="px-2 py-1.5 font-medium">Text</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shownRows.map((c, i) => {
                  const w = warnings[i];
                  const bad = (w?.kinds.length ?? 0) > 0;
                  return (
                    <tr key={i} className={cn('align-top', bad && 'bg-warning/10')}>
                      <td className="px-2 py-1.5 font-mono text-muted-foreground tabular">{i + 1}</td>
                      <td className={cn('px-2 py-1.5 font-mono tabular', w?.kinds.includes('overlap') && 'text-destructive')}>{formatDisplayTime(c.start)}</td>
                      <td className={cn('px-2 py-1.5 font-mono tabular', (w?.kinds.includes('overlap') || w?.kinds.includes('negative')) && 'text-destructive')}>{formatDisplayTime(c.end)}</td>
                      <td className={cn('px-2 py-1.5 font-mono tabular', (w?.kinds.includes('zero') || w?.kinds.includes('negative')) && 'text-destructive')}>
                        {((c.end - c.start) / 1000).toFixed(2)}s
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="whitespace-pre-line break-words">{c.text || <span className="text-muted-foreground">(empty)</span>}</div>
                        {bad && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {w?.kinds.map((k) => (
                              <span key={k} className="rounded bg-warning/20 px-1 text-2xs text-warning">
                                {WARNING_LABELS[k]}
                                {k === 'fast' && w ? ` (${w.cps.toFixed(0)} cps)` : ''}
                                {k === 'long-line' && w ? ` (${w.longestLine})` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <StatBar
          className="h-auto min-h-7 py-1"
          items={[
            `${finalCues.length} cues`,
            spanMs > 0 && `span ${formatDisplayTime(spanMs)}`,
            'warnings: > 42 chars/line, > 20 chars/s, overlaps, bad durations',
            finalCues.length > PREVIEW_ROWS && !showAll && `showing first ${PREVIEW_ROWS}`,
          ]}
        />
        {finalCues.length > PREVIEW_ROWS && (
          <div className="border-t p-2 text-center">
            <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
              {showAll ? `Show only the first ${PREVIEW_ROWS}` : `Show all ${finalCues.length} cues`}
            </Button>
          </div>
        )}
      </Panel>

      {/* OUTPUT */}
      <Panel>
        <PanelHeader title={`Result · ${FORMAT_LABELS[outFormat]}`}>
          <CopyButton value={() => (crlf ? output.replace(/\n/g, '\r\n') : output)} disabled={!output} />
          <DownloadButton data={() => exportText} filename={downloadName} mime={FORMAT_MIME[outFormat]} disabled={!output} label={`Download .${FORMAT_EXT[outFormat]}`} variant="secondary" />
        </PanelHeader>
        <Textarea
          readOnly
          value={output}
          aria-label="Converted subtitles"
          spellCheck={false}
          placeholder="The converted subtitles appear here."
          className="field-sizing-fixed h-64 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <StatBar items={[output && `${new TextEncoder().encode(exportText).length.toLocaleString()} bytes (UTF-8)`, output && downloadName]} />
      </Panel>
    </div>
  );
}
