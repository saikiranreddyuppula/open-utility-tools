'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { AlertTriangle, ClipboardPaste, Eraser, Loader2, ShieldCheck } from 'lucide-react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/download';
import {
  DEFAULT_WRITE,
  IN_FORMAT_LABELS,
  OUT_FORMATS,
  buildPreview,
  computeStats,
  convertDoc,
  countVertices,
  csvHeadersOf,
  decodeInput,
  formatDuration,
  outFormatInfo,
  parseGeo,
  writeKmz,
  type CsvInfo,
  type GeoDoc,
  type GeoStats,
  type InFormatId,
  type OutFormatId,
  type ParsedGeo,
  type PreviewModel,
  type TransformOptions,
  type WriteOptions,
} from './logic';

/* ------------------------------------------------------------------ */
/* Sample data                                                        */
/* ------------------------------------------------------------------ */

function makeSampleGpx(): string {
  const n = 72;
  const t0 = Date.UTC(2024, 4, 18, 8, 30, 0);
  const pts: { lat: number; lon: number; ele: number; t: number }[] = [];
  let t = t0;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const lat = 47.352 + 0.0072 * Math.sin(2 * Math.PI * u) + 0.0011 * Math.sin(6 * Math.PI * u);
    const lon = 8.492 + 0.0125 * (1 - Math.cos(2 * Math.PI * u)) * 0.5 + 0.0008 * Math.sin(5 * Math.PI * u);
    const ele = 470 + 395 * (0.5 - 0.5 * Math.cos(2 * Math.PI * u)) + 7 * Math.sin(14 * Math.PI * u);
    pts.push({ lat, lon, ele, t });
    t += (66 + Math.round(9 * Math.sin(u * 31))) * 1000;
    if (i === n / 2) {
      // a rest at the summit: same spot, six minutes later
      pts.push({ lat, lon, ele, t: t + 360000 });
      t += 360000 + 30000;
    }
  }
  const iso = (ms: number): string => new Date(ms).toISOString().replace('.000Z', 'Z');
  const trkpts = pts
    .map(
      (p) =>
        `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"><ele>${p.ele.toFixed(1)}</ele><time>${iso(p.t)}</time></trkpt>`
    )
    .join('\n');
  const mid = pts[Math.floor(pts.length / 2)] ?? pts[0]!;
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Sample" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Uetliberg loop</name></metadata>
  <wpt lat="${mid.lat.toFixed(6)}" lon="${mid.lon.toFixed(6)}"><ele>${mid.ele.toFixed(1)}</ele><name>Summit viewpoint</name><desc>Lunch stop with a view over the lake</desc><sym>Summit</sym></wpt>
  <wpt lat="47.352000" lon="8.492000"><ele>470.0</ele><name>Trailhead</name><sym>Trail Head</sym></wpt>
  <trk>
    <name>Uetliberg loop</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}

const SAMPLE_GPX = makeSampleGpx();

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const LARGE_TEXT = 300_000;
const OUTPUT_PREVIEW_CHARS = 400_000;
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const ACCEPT = '.gpx,.kml,.kmz,.geojson,.json,.topojson,.csv,.tsv,.txt,.wkt,.tcx,.xml,.zip';

const KM_PER_MI = 1.609344;
const FT_PER_M = 3.280839895;

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function fmtDist(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km · ${(m / 1000 / KM_PER_MI).toFixed(2)} mi`;
  return `${m.toFixed(m < 10 ? 1 : 0)} m · ${(m * FT_PER_M).toFixed(0)} ft`;
}

function fmtEle(m: number): string {
  return `${Math.round(m).toLocaleString('en-US')} m · ${Math.round(m * FT_PER_M).toLocaleString('en-US')} ft`;
}

function fmtSpeed(ms: number): string {
  return `${(ms * 3.6).toFixed(1)} km/h · ${(ms * 2.236936).toFixed(1)} mph`;
}

function fmtWhen(iso: string): string {
  return iso.replace('T', ' ').replace(/Z$/, ' UTC');
}

function fmtBbox(b: [number, number, number, number]): string {
  const f = (n: number): string => n.toFixed(5).replace(/\.?0+$/, '');
  return `lat ${f(b[1])} to ${f(b[3])}, lon ${f(b[0])} to ${f(b[2])}`;
}

const PRECISION_ITEMS: { value: string; label: string }[] = [
  { value: 'full', label: 'Full (no rounding)' },
  { value: '8', label: '8 decimals (~1 mm)' },
  { value: '7', label: '7 decimals (~1 cm)' },
  { value: '6', label: '6 decimals (~10 cm)' },
  { value: '5', label: '5 decimals (~1 m)' },
  { value: '4', label: '4 decimals (~10 m)' },
  { value: '3', label: '3 decimals (~100 m)' },
  { value: '2', label: '2 decimals (~1 km)' },
  { value: '1', label: '1 decimal (~10 km)' },
  { value: '0', label: '0 decimals (~100 km)' },
];

function toNumber(s: string): number {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/* ------------------------------------------------------------------ */
/* Mini-map                                                           */
/* ------------------------------------------------------------------ */

function GeoMap({ model }: { model: PreviewModel }) {
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => setHover(null), [model]);
  const { width, height } = model;
  const active = hover !== null ? model.shapes[hover] : undefined;
  const handlers = (i: number) => ({
    onMouseEnter: () => setHover(i),
    onMouseLeave: () => setHover((h) => (h === i ? null : h)),
    onClick: () => setHover(i),
  });
  return (
    <div className="overflow-hidden rounded-md border bg-muted/30">
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="block h-auto w-full"
          role="img"
          aria-label={`Map preview of ${model.drawnFeatures} features`}
        >
          <defs>
            <pattern id={`${uid}-grid`} width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M50 0H0V50" fill="none" className="stroke-border" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width={width} height={height} fill={`url(#${uid}-grid)`} opacity="0.7" />
          {model.shapes.map((s, i) => {
            const on = hover === i;
            if (s.kind === 'polygon') {
              return (
                <path
                  key={i}
                  d={s.d}
                  fillRule="evenodd"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  strokeWidth={on ? 2.5 : 1.5}
                  className={cn('stroke-primary', on ? 'fill-primary/35' : 'fill-primary/15')}
                  {...handlers(i)}
                >
                  <title>{s.label}</title>
                </path>
              );
            }
            if (s.kind === 'line') {
              return (
                <g key={i}>
                  <path
                    d={s.d}
                    fill="none"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    strokeWidth={on ? 4 : 2.25}
                    className={cn('pointer-events-none', on ? 'stroke-foreground' : 'stroke-primary')}
                  />
                  <path
                    d={s.d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={14}
                    vectorEffect="non-scaling-stroke"
                    {...handlers(i)}
                  >
                    <title>{s.label}</title>
                  </path>
                </g>
              );
            }
            const [cx, cy] = s.d.split(' ');
            return (
              <g key={i}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={on ? 6 : 4}
                  vectorEffect="non-scaling-stroke"
                  strokeWidth={1.5}
                  className={cn('pointer-events-none stroke-background', on ? 'fill-foreground' : 'fill-destructive')}
                />
                <circle cx={cx} cy={cy} r={10} fill="transparent" {...handlers(i)}>
                  <title>{s.label}</title>
                </circle>
              </g>
            );
          })}
          {model.start && (
            <circle
              cx={model.start.x}
              cy={model.start.y}
              r={5.5}
              strokeWidth={2}
              className="pointer-events-none fill-success stroke-background"
            >
              <title>Start</title>
            </circle>
          )}
          {model.end && (
            <circle
              cx={model.end.x}
              cy={model.end.y}
              r={5.5}
              strokeWidth={2}
              className="pointer-events-none fill-foreground stroke-background"
            >
              <title>End</title>
            </circle>
          )}
        </svg>
        <div
          className="pointer-events-none absolute bottom-2 left-2"
          style={{ width: `${Math.min(60, (model.scale.px / width) * 100)}%` }}
        >
          <div className="whitespace-nowrap rounded bg-background/85 px-1 font-mono text-2xs text-foreground">
            {model.scale.label}
          </div>
          <div className="h-1.5 border-x border-b border-foreground/70" />
        </div>
        <div className="pointer-events-none absolute right-2 top-2 rounded bg-background/85 px-1.5 py-0.5 text-2xs text-muted-foreground">
          Web Mercator · no tiles
        </div>
      </div>
      <div
        className="min-h-7 truncate border-t bg-background/60 px-2 py-1 font-mono text-2xs"
        aria-live="polite"
        data-testid="map-hover"
      >
        {active ? active.label : <span className="text-muted-foreground">Hover a feature to see its name</span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Summary                                                            */
/* ------------------------------------------------------------------ */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border bg-muted/30 px-3 py-2">
      <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="break-words font-mono text-xs tabular-nums">{children}</span>
    </div>
  );
}

function SummaryPanel({ stats, parsed }: { stats: GeoStats; parsed: ParsedGeo | null }) {
  const types = Object.entries(stats.byType);
  return (
    <Panel>
      <PanelHeader title="Summary">
        {parsed && <Badge variant="muted">source: {IN_FORMAT_LABELS[parsed.format]}</Badge>}
      </PanelHeader>
      <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
        <Row label="Features">
          <span className="flex flex-wrap gap-1">
            {types.length === 0 && <span>none</span>}
            {types.map(([t, c]) => (
              <Badge key={t} variant="outline" className="font-mono">
                {t} × {c}
              </Badge>
            ))}
            {stats.noGeometry > 0 && (
              <Badge variant="muted" className="font-mono">
                no geometry × {stats.noGeometry}
              </Badge>
            )}
          </span>
        </Row>
        <Row label="Vertices">{stats.vertexCount.toLocaleString('en-US')}</Row>
        {stats.bbox && <Row label="Bounding box">{fmtBbox(stats.bbox)}</Row>}
        {stats.lineCount > 0 && (
          <Row label={stats.lineCount > 1 ? `Length (${stats.lineCount} lines)` : 'Length'}>
            {fmtDist(stats.lengthM)}
          </Row>
        )}
        {stats.hasElevation && stats.eleMin !== null && stats.eleMax !== null && (
          <Row label="Elevation min / max">
            {fmtEle(stats.eleMin)} / {fmtEle(stats.eleMax)}
          </Row>
        )}
        {stats.hasElevation && stats.lineCount > 0 && (
          <Row label="Elevation gain / loss">
            +{fmtEle(stats.gainM)} / -{fmtEle(stats.lossM)}
          </Row>
        )}
        {stats.hasTime && stats.startTime && <Row label="Start">{fmtWhen(stats.startTime)}</Row>}
        {stats.hasTime && stats.endTime && <Row label="End">{fmtWhen(stats.endTime)}</Row>}
        {stats.durationSec > 0 && <Row label="Duration">{formatDuration(stats.durationSec)}</Row>}
        {stats.durationSec > 0 && (
          <Row label="Moving time">
            {formatDuration(stats.movingSec)}
            {stats.stoppedSec > 0 ? ` (stopped ${formatDuration(stats.stoppedSec)})` : ''}
          </Row>
        )}
        {stats.avgSpeedMs !== null && <Row label="Average speed">{fmtSpeed(stats.avgSpeedMs)}</Row>}
        {stats.avgMovingSpeedMs !== null && <Row label="Average moving speed">{fmtSpeed(stats.avgMovingSpeedMs)}</Row>}
        {stats.maxSpeedMs !== null && <Row label="Max speed (between points)">{fmtSpeed(stats.maxSpeedMs)}</Row>}
      </div>
      <p className="border-t px-3 py-2 text-2xs text-muted-foreground">
        Distances use the haversine formula (mean Earth radius 6371.0088 km). Moving means faster than 1 km/h between
        two timed points. GPS elevation noise inflates gain, so raise the smoothing threshold for noisy tracks.
      </p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */

interface Source {
  text: string;
  fileName: string | null;
  size: number | null;
  note: string | null;
}

interface Converted {
  doc: GeoDoc;
  text: string;
  warnings: string[];
  stats: GeoStats;
  preview: PreviewModel | null;
  outVertices: number;
}

export default function GeoDataConverterTool() {
  const [source, setSource] = useState<Source>({ text: SAMPLE_GPX, fileName: null, size: null, note: null });
  const [inFmt, setInFmt] = useState<InFormatId | 'auto'>('auto');
  const [outFmt, setOutFmt] = useState<OutFormatId>('geojson');
  const [csvLat, setCsvLat] = useState('auto');
  const [csvLon, setCsvLon] = useState('auto');
  const [csvAs, setCsvAs] = useState<'auto' | 'points' | 'line'>('auto');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [polyPrec, setPolyPrec] = useState<'5' | '6'>('5');

  const [lines, setLines] = useState<TransformOptions['lines']>('keep');
  const [simplifyStr, setSimplifyStr] = useState('');
  const [precision, setPrecision] = useState('full');
  const [reverse, setReverse] = useState(false);
  const [stripTime, setStripTime] = useState(false);
  const [stripEle, setStripEle] = useState(false);
  const [eleThrStr, setEleThrStr] = useState('3');

  const [gpxLines, setGpxLines] = useState<WriteOptions['gpxLines']>('auto');
  const [pretty, setPretty] = useState(true);
  const [docName, setDocName] = useState('');
  const [kmlGx, setKmlGx] = useState(true);
  const [csvDelim, setCsvDelim] = useState(',');

  const [parsed, setParsed] = useState<ParsedGeo | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [converted, setConverted] = useState<Converted | null>(null);
  const [convError, setConvError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const big = source.text.length > LARGE_TEXT;
  const fileBase = source.fileName ? source.fileName.replace(/\.[^.]+$/, '') : '';

  const loadText = useCallback((next: Source) => {
    setSource(next);
    setCsvLat('auto');
    setCsvLon('auto');
    setCsvAs('auto');
    setFileError(null);
  }, []);

  const onFiles = useCallback(
    async (files: File[]) => {
      const f = files[0];
      if (!f) return;
      if (f.size > MAX_FILE_BYTES) {
        setFileError(
          `${f.name} is ${formatBytes(f.size)}; files over ${formatBytes(MAX_FILE_BYTES)} are too large to process in the browser.`
        );
        return;
      }
      try {
        const buf = new Uint8Array(await f.arrayBuffer());
        const d = decodeInput(buf);
        loadText({ text: d.text, fileName: f.name, size: f.size, note: d.note ?? null });
      } catch (e) {
        setFileError(errMsg(e));
      }
    },
    [loadText]
  );

  /* ---- stage 1: parse ---- */
  useEffect(() => {
    let cancelled = false;
    if (source.text.length > LARGE_TEXT) setBusy(true);
    const timer = setTimeout(
      () => {
        try {
          const p = parseGeo(source.text, inFmt, {
            csvLat: csvLat === 'auto' ? undefined : csvLat,
            csvLon: csvLon === 'auto' ? undefined : csvLon,
            csvAs,
            polylinePrecision: polyPrec === '6' ? 6 : 5,
          });
          if (cancelled) return;
          setParsed(p);
          setParseError(null);
          setCsvHeaders(p.csv ? p.csv.headers : []);
        } catch (e) {
          if (cancelled) return;
          setParsed(null);
          setConverted(null);
          const msg = errMsg(e);
          setParseError(msg);
          if (inFmt === 'csv' || /latitude\/longitude columns/.test(msg)) {
            try {
              setCsvHeaders(csvHeadersOf(source.text));
            } catch {
              setCsvHeaders([]);
            }
          } else {
            setCsvHeaders([]);
          }
        } finally {
          if (!cancelled) setBusy(false);
        }
      },
      source.text.length > LARGE_TEXT ? 30 : 150
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [source.text, inFmt, csvLat, csvLon, csvAs, polyPrec]);

  /* ---- stage 2: transform + write + stats + preview ---- */
  const transformOpts = useMemo<TransformOptions>(
    () => ({
      lines,
      simplifyMeters: toNumber(simplifyStr),
      precision: precision === 'full' ? null : Number(precision),
      reverse,
      stripTime,
      stripElevation: stripEle,
    }),
    [lines, simplifyStr, precision, reverse, stripTime, stripEle]
  );
  const writeOpts = useMemo<WriteOptions>(
    () => ({
      ...DEFAULT_WRITE,
      gpxLines,
      pretty,
      docName,
      kmlGxTrack: kmlGx,
      csvDelimiter: csvDelim,
      polylinePrecision: polyPrec === '6' ? 6 : 5,
    }),
    [gpxLines, pretty, docName, kmlGx, csvDelim, polyPrec]
  );
  const eleThr = toNumber(eleThrStr);

  useEffect(() => {
    if (!parsed) return;
    let cancelled = false;
    const heavy = source.text.length > LARGE_TEXT;
    if (heavy) setBusy(true);
    const timer = setTimeout(
      () => {
        try {
          const doc: GeoDoc = parsed.doc.name || !fileBase ? parsed.doc : { ...parsed.doc, name: fileBase };
          const r = convertDoc(doc, outFmt, transformOpts, writeOpts);
          const stats = computeStats(r.doc, { eleThresholdM: eleThr });
          const preview = buildPreview(r.doc);
          if (cancelled) return;
          setConverted({
            doc: r.doc,
            text: r.text,
            warnings: r.warnings,
            stats,
            preview,
            outVertices: r.doc.features.reduce((n, f) => n + countVertices(f.geometry), 0),
          });
          setConvError(null);
        } catch (e) {
          if (cancelled) return;
          setConverted(null);
          setConvError(errMsg(e));
        } finally {
          if (!cancelled) setBusy(false);
        }
      },
      heavy ? 20 : 0
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [parsed, outFmt, transformOpts, writeOpts, eleThr, fileBase, source.text.length]);

  /* ---- derived UI values ---- */
  const info = outFormatInfo(outFmt);
  const csvInfo: CsvInfo | undefined = parsed?.csv;
  const showCsv = parsed?.format === 'csv' || inFmt === 'csv' || csvHeaders.length > 0;
  const showPoly = parsed?.format === 'polyline' || inFmt === 'polyline' || outFmt === 'polyline';
  const outText = converted?.text ?? '';
  const outTruncated = outText.length > OUTPUT_PREVIEW_CHARS;
  const shownOut = outTruncated ? outText.slice(0, OUTPUT_PREVIEW_CHARS) : outText;
  const downloadBase = fileBase
    ? source.fileName && source.fileName.toLowerCase().endsWith(`.${info.ext}`)
      ? `${fileBase}-converted`
      : fileBase
    : 'converted';
  const downloadName = `${downloadBase}.${info.ext}`;
  const srcVertices = useMemo(
    () => (parsed ? parsed.doc.features.reduce((n, f) => n + countVertices(f.geometry), 0) : 0),
    [parsed]
  );
  const outMeta = useMemo(
    () => ({ bytes: new Blob([outText]).size, lines: outText ? outText.split('\n').length : 0 }),
    [outText]
  );

  const getDownload = useCallback(() => {
    if (outFmt === 'kmz') {
      return new Blob([writeKmz(outText) as unknown as BlobPart], { type: info.mime });
    }
    return new Blob([outText], { type: `${info.mime};charset=utf-8` });
  }, [outFmt, outText, info.mime]);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const t = await navigator.clipboard.readText();
      loadText({ text: t, fileName: null, size: null, note: null });
    } catch {
      setFileError('Clipboard access was blocked by the browser. Paste with Ctrl/Cmd+V into the box instead.');
    }
  }, [loadText]);

  const Checks = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <label className="flex cursor-pointer items-center gap-2 text-xs">
        <Checkbox
          checked={reverse}
          onCheckedChange={(c) => setReverse(c === true)}
          aria-label="Reverse line direction"
        />
        Reverse direction
      </label>
      <label
        className="flex cursor-pointer items-center gap-2 text-xs"
        title="Removes per-point timestamps and time properties"
      >
        <Checkbox
          checked={stripTime}
          onCheckedChange={(c) => setStripTime(c === true)}
          aria-label="Remove timestamps"
        />
        Remove timestamps
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-xs">
        <Checkbox checked={stripEle} onCheckedChange={(c) => setStripEle(c === true)} aria-label="Remove elevation" />
        Remove elevation
      </label>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
        <span>
          Everything is converted locally in your browser. Your location history is never uploaded, and no map tiles are
          requested.
        </span>
      </div>

      {/* ---------------- input ---------------- */}
      <Panel>
        <PanelHeader title="Input">
          {parsed && <Badge variant="success">{IN_FORMAT_LABELS[parsed.format]} detected</Badge>}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadText({ text: SAMPLE_GPX, fileName: null, size: null, note: null })}
            title="Load a sample hike (GPX)"
          >
            Sample
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void pasteFromClipboard()} title="Paste from clipboard">
            <ClipboardPaste className="size-3.5" />
            Paste
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => loadText({ text: '', fileName: null, size: null, note: null })}
            disabled={!source.text}
            title="Clear input"
            aria-label="Clear input"
          >
            <Eraser className="size-3.5" />
          </Button>
        </PanelHeader>
        <div className="flex flex-col gap-3 p-3">
          <FileDropzone
            onFiles={(f) => void onFiles(f)}
            accept={ACCEPT}
            compact
            label={source.fileName ? source.fileName : 'Drop a GPX, KML, KMZ, GeoJSON, CSV, WKT or TCX file'}
            hint={
              source.fileName
                ? `${formatBytes(source.size ?? 0)} · drop another file to replace it`
                : 'or click to browse · or paste text below'
            }
          />
          {big ? (
            <div className="rounded-md border bg-muted/30 px-3 py-4 text-sm">
              <p className="font-medium">
                {source.fileName ?? 'Large input'} loaded ({source.text.length.toLocaleString('en-US')} characters)
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                The text is too large to show in an editor. Conversion still works: use Clear to paste something else.
              </p>
            </div>
          ) : (
            <Textarea
              value={source.text}
              onChange={(e) => loadText({ text: e.target.value, fileName: null, size: null, note: null })}
              placeholder="Paste GPX, KML, GeoJSON, TopoJSON, CSV (lat,lon), WKT, TCX or an encoded polyline here…"
              spellCheck={false}
              aria-label="Input data"
              className="max-h-64 min-h-32 resize-y font-mono text-xs"
            />
          )}
          <ErrorBanner error={fileError} />
        </div>
        <StatBar
          items={[
            `${source.text.length.toLocaleString('en-US')} chars`,
            parsed && `${parsed.doc.features.length.toLocaleString('en-US')} features`,
            parsed && `${srcVertices.toLocaleString('en-US')} vertices`,
            source.note,
          ]}
        />
      </Panel>

      {/* ---------------- options ---------------- */}
      <OptionsBar>
        <Field label="Input format">
          <Select value={inFmt} onValueChange={(v) => setInFmt(v as InFormatId | 'auto')}>
            <SelectTrigger className="w-44" aria-label="Input format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-detect</SelectItem>
              {(Object.keys(IN_FORMAT_LABELS) as InFormatId[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {IN_FORMAT_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {showCsv && (
          <>
            <Field label="Latitude column">
              <Select value={csvLat} onValueChange={setCsvLat}>
                <SelectTrigger className="w-36" aria-label="Latitude column">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto{csvInfo?.latColumn ? ` (${csvInfo.latColumn})` : ''}</SelectItem>
                  {csvHeaders
                    .filter((h) => h !== '')
                    .map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Longitude column">
              <Select value={csvLon} onValueChange={setCsvLon}>
                <SelectTrigger className="w-36" aria-label="Longitude column">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto{csvInfo?.lonColumn ? ` (${csvInfo.lonColumn})` : ''}</SelectItem>
                  {csvHeaders
                    .filter((h) => h !== '')
                    .map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="CSV rows as"
              hint={
                csvInfo
                  ? `read as: ${csvInfo.mode === 'line' ? 'track' : csvInfo.mode === 'wkt' ? 'WKT column' : 'points'}`
                  : undefined
              }
            >
              <Select value={csvAs} onValueChange={(v) => setCsvAs(v as 'auto' | 'points' | 'line')}>
                <SelectTrigger className="w-40" aria-label="CSV rows as">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="points">Points (waypoints)</SelectItem>
                  <SelectItem value="line">One line (track)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </>
        )}
        {showPoly && (
          <Field label="Polyline precision">
            <Select value={polyPrec} onValueChange={(v) => setPolyPrec(v === '6' ? '6' : '5')}>
              <SelectTrigger className="w-32" aria-label="Polyline precision">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 (Google)</SelectItem>
                <SelectItem value="6">6 (OSRM / Valhalla)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field label="Convert to" className="min-w-0">
          <Tabs value={outFmt} onValueChange={(v) => setOutFmt(v as OutFormatId)}>
            <TabsList className="h-auto flex-wrap justify-start" aria-label="Output format">
              {OUT_FORMATS.map((f) => (
                <TabsTrigger key={f.id} value={f.id} className="flex-none">
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </Field>
      </OptionsBar>

      <OptionsBar>
        <Field label="Lines">
          <Select value={lines} onValueChange={(v) => setLines(v as TransformOptions['lines'])}>
            <SelectTrigger className="w-52" aria-label="Line handling">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="keep">Keep as they are</SelectItem>
              <SelectItem value="merge">Merge all into one track</SelectItem>
              <SelectItem value="split">Split multi-segment tracks</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Simplify (metres)" hint="Ramer-Douglas-Peucker, 0 = off">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={simplifyStr}
            onChange={(e) => setSimplifyStr(e.target.value)}
            placeholder="off"
            aria-label="Simplify tolerance in metres"
            className="w-28 font-mono"
          />
        </Field>
        <Field label="Coordinate precision">
          <Select value={precision} onValueChange={setPrecision}>
            <SelectTrigger className="w-48" aria-label="Coordinate precision">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRECISION_ITEMS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Elevation smoothing (m)" hint="ignore ups/downs below this">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={eleThrStr}
            onChange={(e) => setEleThrStr(e.target.value)}
            aria-label="Elevation smoothing threshold in metres"
            className="w-24 font-mono"
          />
        </Field>
        <Field label="Privacy / direction">{Checks}</Field>
      </OptionsBar>

      {(outFmt === 'gpx' || outFmt === 'kml' || outFmt === 'kmz' || outFmt === 'csv' || outFmt === 'geojson') && (
        <OptionsBar>
          {outFmt === 'gpx' && (
            <Field label="GPX lines as">
              <Select value={gpxLines} onValueChange={(v) => setGpxLines(v as WriteOptions['gpxLines'])}>
                <SelectTrigger className="w-48" aria-label="GPX lines as">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Keep original (tracks)</SelectItem>
                  <SelectItem value="tracks">Tracks (trk)</SelectItem>
                  <SelectItem value="routes">Routes (rte)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          {(outFmt === 'gpx' || outFmt === 'kml' || outFmt === 'kmz') && (
            <Field label={outFmt === 'gpx' ? 'Metadata name' : 'Document name'}>
              <Input
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder={fileBase || 'optional'}
                aria-label="Document name"
                className="w-52"
              />
            </Field>
          )}
          {(outFmt === 'kml' || outFmt === 'kmz') && (
            <Field label="Timed lines">
              <label
                className="flex cursor-pointer items-center gap-2 text-xs"
                title="Keeps per-point timestamps; Google Earth reads gx:Track, some other tools do not"
              >
                <Checkbox
                  checked={kmlGx}
                  onCheckedChange={(c) => setKmlGx(c === true)}
                  aria-label="Write timed lines as gx:Track"
                />
                Write as gx:Track (keeps times)
              </label>
            </Field>
          )}
          {outFmt === 'csv' && (
            <Field label="Delimiter">
              <Select value={csvDelim} onValueChange={setCsvDelim}>
                <SelectTrigger className="w-36" aria-label="CSV delimiter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=",">Comma ( , )</SelectItem>
                  <SelectItem value=";">Semicolon ( ; )</SelectItem>
                  <SelectItem value={'\t'}>Tab</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          {outFmt !== 'csv' && (
            <Field label="Formatting">
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <Checkbox
                  checked={pretty}
                  onCheckedChange={(c) => setPretty(c === true)}
                  aria-label="Pretty-print output"
                />
                Pretty-print (indent)
              </label>
            </Field>
          )}
        </OptionsBar>
      )}

      <ErrorBanner error={parseError ?? convError} />
      {converted && converted.warnings.length > 0 && (
        <div
          className="flex flex-col gap-1 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs"
          role="status"
        >
          {converted.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
      {parsed && parsed.warnings.length > 0 && (
        <div
          className="flex flex-col gap-1 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs"
          role="status"
        >
          {parsed.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- output + insights ---------------- */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title={`Output · ${info.label}`}>
            {busy && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="Working" />}
            <CopyButton value={() => outText} disabled={!outText} />
            <DownloadButton
              data={getDownload}
              filename={downloadName}
              mime={info.mime}
              disabled={!outText}
              label={`Download .${info.ext}`}
            />
          </PanelHeader>
          <Textarea
            value={shownOut}
            readOnly
            placeholder={parseError ? 'Fix the input to see the converted result.' : 'Converted result appears here…'}
            spellCheck={false}
            aria-label="Converted output"
            className="max-h-[520px] min-h-72 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          {outTruncated && (
            <p className="border-t bg-warning/10 px-3 py-1.5 text-2xs">
              Showing the first {OUTPUT_PREVIEW_CHARS.toLocaleString('en-US')} of{' '}
              {outText.length.toLocaleString('en-US')} characters. Copy and Download use the full output.
            </p>
          )}
          {outFmt === 'kmz' && outText && (
            <p className="border-t px-3 py-1.5 text-2xs text-muted-foreground">
              KMZ is a zip file holding <code>doc.kml</code>. The text above is that KML; Download saves the zipped
              .kmz, Copy copies the KML.
            </p>
          )}
          <StatBar
            items={[
              `${outText.length.toLocaleString('en-US')} chars`,
              `${formatBytes(outMeta.bytes)}${outFmt === 'kmz' ? ' (unzipped)' : ''}`,
              `${outMeta.lines.toLocaleString('en-US')} lines`,
              converted &&
                parsed &&
                `${srcVertices.toLocaleString('en-US')} → ${converted.outVertices.toLocaleString('en-US')} vertices`,
            ]}
          />
        </Panel>

        <div className="flex min-w-0 flex-col gap-4">
          {converted?.preview ? (
            <Panel>
              <PanelHeader title="Map preview">
                {converted.preview.truncated && (
                  <Badge variant="muted">
                    first {converted.preview.drawnFeatures.toLocaleString('en-US')} features
                  </Badge>
                )}
              </PanelHeader>
              <div className="p-3">
                <GeoMap model={converted.preview} />
              </div>
            </Panel>
          ) : (
            converted && (
              <Panel>
                <PanelHeader title="Map preview" />
                <p className="p-4 text-sm text-muted-foreground">There is no geometry to draw.</p>
              </Panel>
            )
          )}
          {converted && <SummaryPanel stats={converted.stats} parsed={parsed} />}
        </div>
      </div>

      <p className="text-2xs text-muted-foreground">
        Limitations: WGS84 longitude/latitude only. GPX extensions (heart rate, cadence), KML styles, icons, overlays
        and network links are not carried over. WKT, polylines and CSV hold geometry (and CSV a flat table of
        properties), not styles. TopoJSON and TCX are read-only. Polygons become closed tracks in GPX.
      </p>
    </div>
  );
}
