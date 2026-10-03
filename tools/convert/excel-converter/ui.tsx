'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { FilePlus2, FileSpreadsheet, Loader2, Plus, Trash2 } from 'lucide-react';
import { strToU8 } from 'fflate';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/download';
import { zipFiles } from '@/lib/zip';
import {
  buildXlsx,
  colLetters,
  exportExtension,
  exportMatrix,
  exportMime,
  fileSafe,
  formatDateSerial,
  openWorkbook,
  parseTabularInput,
  sanitizeSheetName,
  sheetToMatrix,
  tableToCells,
  validateSheetNames,
  valToString,
  type Delimiter,
  type ExportConfig,
  type ExportFormat,
  type InputFormat,
  type Matrix,
  type OutVal,
  type ParsedInput,
  type ReadOptions,
  type Sheet,
  type WCell,
  type WorkbookReader,
  type WSheet,
} from './logic';

const MAX_FILE_BYTES = 250 * 1024 * 1024;
const PREVIEW_ROWS = 200;
const tick = () => new Promise<void>((r) => setTimeout(r, 0));
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2 text-xs', disabled && 'cursor-not-allowed opacity-50')}>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
      <span>{label}</span>
    </label>
  );
}

function SegTabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string }[];
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as T)}>
      <TabsList>
        {items.map((i) => (
          <TabsTrigger key={i.value} value={i.value}>
            {i.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* ------------------------------------------------------------------ */
/* Preview table                                                       */
/* ------------------------------------------------------------------ */

function cellClass(v: OutVal): string {
  if (v === null) return '';
  if (typeof v === 'number') return 'text-right text-sky-700 dark:text-sky-300';
  if (typeof v === 'boolean') return 'text-violet-700 dark:text-violet-300';
  if (/^#(DIV\/0!|N\/A|NAME\?|NULL!|NUM!|REF!|VALUE!)/.test(v)) return 'text-destructive';
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$|^\d{1,}:\d{2}:\d{2}$/.test(v)) return 'text-emerald-700 dark:text-emerald-300';
  return '';
}

function PreviewTable({ header, rows, letters, total }: { header: string[] | null; rows: OutVal[][]; letters: string[]; total: number }) {
  const shown = rows.slice(0, PREVIEW_ROWS);
  const cols = letters.length;
  return (
    <div className="max-h-[22rem] overflow-auto" data-testid="preview-scroll">
      <table className="w-max min-w-full border-separate border-spacing-0 font-mono text-xs" data-testid="preview-table">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-20 w-px border-b border-r bg-muted px-2 py-1 text-right font-medium text-muted-foreground">#</th>
            {letters.map((l, i) => (
              <th
                key={i}
                className="sticky top-0 z-10 max-w-[16rem] truncate border-b border-r bg-muted px-2 py-1 text-left font-semibold"
                title={header ? `${l}: ${header[i] ?? ''}` : l}
              >
                {header ? (header[i] === '' || header[i] === undefined ? <span className="text-muted-foreground">{l}</span> : header[i]) : l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, ri) => (
            <tr key={ri} className="hover:bg-accent/40">
              <td className="sticky left-0 z-[1] w-px border-b border-r bg-muted/70 px-2 py-0.5 text-right text-muted-foreground tabular">{ri + 1}</td>
              {Array.from({ length: cols }, (_, ci) => {
                const v = r[ci] ?? null;
                const s = valToString(v);
                return (
                  <td key={ci} className={cn('max-w-[24rem] truncate whitespace-pre border-b border-r px-2 py-0.5', cellClass(v))} title={s.length > 24 || s.includes('\n') ? s : undefined}>
                    {s.replace(/\r?\n/g, '↵')}
                  </td>
                );
              })}
            </tr>
          ))}
          {shown.length === 0 && (
            <tr>
              <td colSpan={cols + 1} className="px-3 py-6 text-center text-muted-foreground">
                This sheet has no data rows.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {total > PREVIEW_ROWS && (
        <div className="sticky left-0 border-t bg-muted/30 px-3 py-1.5 text-2xs text-muted-foreground">
          Showing the first {PREVIEW_ROWS} of {total.toLocaleString('en-US')} rows. Exports include every row.
        </div>
      )}
    </div>
  );
}

function sliceMatrix(m: Matrix, n: number): Matrix {
  return { ...m, rows: m.rows.slice(0, n) };
}

/* ------------------------------------------------------------------ */
/* Tab 1: Excel -> CSV / JSON                                          */
/* ------------------------------------------------------------------ */

const SAMPLE_CSV = `id,name,email,joined,last_login,score,active,zip
1,Alice Johnson,alice@example.com,2024-01-15,2024-03-02 09:30:00,92.5,true,00123
2,Bob Smith,bob@example.com,2023-11-02,2024-03-01 18:05:12,78,false,02134
3,"Carol ""CJ"" Jones",carol@example.com,2022-07-30,,85.25,true,94105
4,Dmitri Ivanov,dmitri@example.com,2024-02-29,2024-02-29 23:59:59,61.75,true,10001`;

const SAMPLE_JSON = `[
  {"region": "North", "q1": 12500, "q2": 14300.5, "closed": "2024-03-31"},
  {"region": "South", "q1": 9800, "q2": 10120, "closed": "2024-03-31"},
  {"region": "West", "q1": 15200.75, "q2": 16800, "closed": "2024-04-02"}
]`;

function makeSampleWorkbook(): Uint8Array {
  const sheets: WSheet[] = [
    { name: 'Customers', rows: tableToCells(parseTabularInput(SAMPLE_CSV, 'auto', true), { infer: true, keepText: true }, true) },
    { name: 'Regional sales', rows: tableToCells(parseTabularInput(SAMPLE_JSON, 'auto', true), { infer: true, keepText: true }, true) },
  ];
  return buildXlsx(sheets, { header: true, bold: true, freeze: true, autoFilter: true, autoWidth: true }).bytes;
}

const FORMAT_ITEMS: { value: ExportFormat; label: string }[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'tsv', label: 'TSV' },
  { value: 'json', label: 'JSON objects' },
  { value: 'json-arrays', label: 'JSON arrays' },
  { value: 'markdown', label: 'Markdown' },
];

function ExcelToText() {
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null);
  const [reader, setReader] = useState<WorkbookReader | null>(null);
  const cache = useRef<Map<number, Sheet>>(new Map());
  const [sheetIdx, setSheetIdx] = useState(0);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [header, setHeader] = useState(true);
  const [skipRows, setSkipRows] = useState(false);
  const [skipCols, setSkipCols] = useState(false);
  const [trim, setTrim] = useState(false);
  const [dates, setDates] = useState<'iso' | 'serial'>('iso');
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [delimiter, setDelimiter] = useState<Delimiter>(',');
  const [bom, setBom] = useState(false);

  const ropts: ReadOptions = useMemo(
    () => ({ header, skipEmptyRows: skipRows, skipEmptyCols: skipCols, trim, dates }),
    [header, skipRows, skipCols, trim, dates]
  );
  const cfg: ExportConfig = useMemo(() => ({ format, delimiter }), [format, delimiter]);

  const showSheet = useCallback(
    async (r: WorkbookReader, i: number) => {
      const cached = cache.current.get(i);
      if (cached) {
        setSheet(cached);
        setSheetIdx(i);
        return;
      }
      setBusy(`Parsing sheet "${r.sheets[i]?.name ?? i + 1}"…`);
      await tick();
      try {
        const sh = r.readSheet(i);
        cache.current.set(i, sh);
        setSheet(sh);
        setSheetIdx(i);
      } catch (e) {
        setError(errMsg(e));
      } finally {
        setBusy(null);
      }
    },
    []
  );

  const loadSeq = useRef(0);
  const loadBytes = useCallback(
    async (name: string, data: Uint8Array) => {
      const seq = ++loadSeq.current;
      setError(null);
      setBusy('Opening workbook…');
      await tick();
      if (seq !== loadSeq.current) return;
      try {
        const r = openWorkbook(data);
        cache.current = new Map();
        const first = r.sheets.findIndex((s) => !s.hidden);
        const idx = first === -1 ? 0 : first;
        const sh = r.readSheet(idx);
        cache.current.set(idx, sh);
        setReader(r);
        setFileInfo({ name, size: data.length });
        setSheet(sh);
        setSheetIdx(idx);
      } catch (e) {
        setReader(null);
        setSheet(null);
        setFileInfo(null);
        setError(errMsg(e));
      } finally {
        if (seq === loadSeq.current) setBusy(null);
      }
    },
    []
  );

  const onFiles = useCallback(
    async (files: File[]) => {
      const f = files[0];
      if (!f) return;
      if (f.size > MAX_FILE_BYTES) {
        setError(`File is ${formatBytes(f.size)} - the limit is ${formatBytes(MAX_FILE_BYTES)} in the browser.`);
        return;
      }
      setBusy('Reading file…');
      try {
        const buf = new Uint8Array(await f.arrayBuffer());
        await loadBytes(f.name, buf);
      } catch (e) {
        setBusy(null);
        setError(errMsg(e));
      }
    },
    [loadBytes]
  );

  const loadSample = useCallback(() => {
    void loadBytes('sample-workbook.xlsx', makeSampleWorkbook());
  }, [loadBytes]);

  useEffect(() => {
    loadSample();
  }, [loadSample]);

  const matrix = useMemo<Matrix | null>(() => {
    if (!sheet || !reader) return null;
    return sheetToMatrix(sheet, ropts, reader.date1904);
  }, [sheet, reader, ropts]);

  const previewText = useMemo(() => (matrix ? exportMatrix(sliceMatrix(matrix, PREVIEW_ROWS), cfg) : ''), [matrix, cfg]);

  const baseName = useMemo(() => {
    const n = (fileInfo?.name ?? 'workbook').replace(/\.[^.]+$/, '');
    return fileSafe(n, 'workbook');
  }, [fileInfo]);
  const sheetName = reader?.sheets[sheetIdx]?.name ?? 'sheet';
  const ext = exportExtension(cfg);
  const outName = `${baseName}-${fileSafe(sheetName)}.${ext}`;

  const fullText = useCallback((): string => {
    if (!matrix) return '';
    return exportMatrix(matrix, cfg);
  }, [matrix, cfg]);

  const downloadAll = useCallback(async (): Promise<Blob> => {
    if (!reader) throw new Error('No workbook');
    const entries: { name: string; data: Uint8Array }[] = [];
    for (let i = 0; i < reader.sheets.length; i++) {
      let sh = cache.current.get(i);
      if (!sh) {
        await tick();
        sh = reader.readSheet(i);
        cache.current.set(i, sh);
      }
      const m = sheetToMatrix(sh, ropts, reader.date1904);
      const text = (bom && (format === 'csv' || format === 'tsv') ? '﻿' : '') + exportMatrix(m, cfg);
      entries.push({ name: `${fileSafe(sh.name, `sheet${i + 1}`)}.${ext}`, data: strToU8(text) });
    }
    return zipFiles(entries);
  }, [reader, ropts, cfg, bom, format, ext]);

  const withBom = bom && (format === 'csv' || format === 'tsv');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-stretch gap-3">
        <FileDropzone
          onFiles={onFiles}
          accept=".xlsx,.xlsm,.xltx,.xltm,.ods,.xls"
          label={fileInfo ? fileInfo.name : 'Drop an Excel or ODS workbook'}
          hint={fileInfo ? `${formatBytes(fileInfo.size)} · click or drop to replace` : '.xlsx, .xlsm, .ods · stays on your device'}
          compact={!!fileInfo}
          className="min-w-[16rem] flex-1"
        />
        <Button variant="secondary" size="sm" className="self-center" onClick={loadSample} disabled={!!busy}>
          <FileSpreadsheet className="size-3.5" /> Load sample workbook
        </Button>
      </div>

      {busy && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <Loader2 className="size-3.5 animate-spin" /> {busy}
        </div>
      )}
      <ErrorBanner error={error} />

      {reader && sheet && matrix && (
        <>
          <div className="flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Sheets" data-testid="sheet-tabs">
            {reader.sheets.map((s, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === sheetIdx}
                onClick={() => void showSheet(reader, i)}
                className={cn(
                  'shrink-0 rounded-md border px-3 py-1 text-xs font-medium transition-colors',
                  i === sheetIdx ? 'border-primary bg-primary text-primary-foreground' : 'bg-muted/50 hover:bg-accent',
                  s.hidden && i !== sheetIdx && 'italic text-muted-foreground'
                )}
              >
                {s.name}
                {s.hidden && ' (hidden)'}
              </button>
            ))}
          </div>

          <OptionsBar>
            <Toggle label="First row is header" checked={header} onChange={setHeader} />
            <Toggle label="Skip empty rows" checked={skipRows} onChange={setSkipRows} />
            <Toggle label="Skip empty columns" checked={skipCols} onChange={setSkipCols} />
            <Toggle label="Trim cells" checked={trim} onChange={setTrim} />
            <Field label="Dates">
              <SegTabs
                value={dates}
                onChange={setDates}
                items={[
                  { value: 'iso', label: 'ISO 8601' },
                  { value: 'serial', label: 'Excel serial' },
                ]}
              />
            </Field>
          </OptionsBar>

          <Panel>
            <PanelHeader title={`Preview · ${sheet.name}`} />
            <PreviewTable header={matrix.header} rows={matrix.rows} letters={matrix.letters} total={matrix.rows.length} />
            <StatBar
              items={[
                `${matrix.rows.length.toLocaleString('en-US')} data rows`,
                `${matrix.width.toLocaleString('en-US')} columns (A–${colLetters(Math.max(0, sheet.cols - 1))})`,
                reader.format.toUpperCase(),
                reader.date1904 && '1904 date system',
                sheet.truncated && 'truncated at sheet limit',
              ]}
            />
          </Panel>

          <Panel>
            <PanelHeader title="Export">
              <CopyButton value={fullText} disabled={!matrix} />
              <DownloadButton
                data={() => (withBom ? '﻿' : '') + fullText()}
                filename={outName}
                mime={exportMime(cfg)}
                label="Download"
                variant="secondary"
              />
              <DownloadButton data={downloadAll} filename={`${baseName}-sheets-${ext}.zip`} mime="application/zip" label={`All sheets (ZIP)`} />
            </PanelHeader>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2 border-b bg-muted/20 p-3">
              <Field label="Format">
                <SegTabs value={format} onChange={setFormat} items={FORMAT_ITEMS} />
              </Field>
              {format === 'csv' && (
                <Field label="Delimiter">
                  <Select value={delimiter} onValueChange={(v) => setDelimiter(v as Delimiter)}>
                    <SelectTrigger className="w-32" aria-label="Delimiter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=",">Comma ,</SelectItem>
                      <SelectItem value=";">Semicolon ;</SelectItem>
                      <SelectItem value={'\t'}>Tab</SelectItem>
                      <SelectItem value="|">Pipe |</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
              {(format === 'csv' || format === 'tsv') && <Toggle label="UTF-8 BOM (for Excel)" checked={bom} onChange={setBom} />}
            </div>
            <pre
              className="max-h-80 min-h-24 overflow-auto whitespace-pre p-3 font-mono text-xs leading-relaxed"
              data-testid="export-output"
            >
              {previewText || ' '}
            </pre>
            <StatBar
              items={[
                `file: ${outName}`,
                matrix.rows.length > PREVIEW_ROWS && `preview of first ${PREVIEW_ROWS} rows - Copy and Download include all ${matrix.rows.length.toLocaleString('en-US')}`,
              ]}
            />
          </Panel>
        </>
      )}

      <p className="text-2xs text-muted-foreground">
        Reads .xlsx / .xlsm / .ods and uses the saved (cached) result of every formula. Numbers are exported as stored, not as formatted in Excel (25% is exported as 0.25). Legacy .xls and password-protected
        workbooks are not supported; only the first {PREVIEW_ROWS} rows are previewed but exports include everything.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab 2: CSV / JSON -> Excel                                          */
/* ------------------------------------------------------------------ */

interface InSheet {
  id: number;
  name: string;
  text: string;
  format: InputFormat;
}

const KIND_LABEL: Record<ParsedInput['kind'], string> = {
  csv: 'CSV',
  tsv: 'TSV',
  'json-objects': 'JSON array of objects',
  'json-arrays': 'JSON array of arrays',
  'json-values': 'JSON array of values',
};

const DELIM_NAME: Record<string, string> = { ',': 'comma', ';': 'semicolon', '\t': 'tab', '|': 'pipe' };

function CellPreview({ rows }: { rows: WCell[][] }) {
  const shown = rows.slice(0, 12);
  const cols = Math.min(30, shown.reduce((m, r) => Math.max(m, r.length), 0));
  return (
    <div className="max-h-64 overflow-auto" data-testid="write-preview">
      <table className="w-max min-w-full border-separate border-spacing-0 font-mono text-xs">
        <tbody>
          {shown.map((r, ri) => (
            <tr key={ri}>
              <td className="sticky left-0 w-px border-b border-r bg-muted/70 px-2 py-0.5 text-right text-muted-foreground tabular">{ri + 1}</td>
              {Array.from({ length: cols }, (_, ci) => {
                const c = r[ci] ?? null;
                let text = '';
                let cls = '';
                if (c) {
                  switch (c.t) {
                    case 's':
                      text = c.v;
                      break;
                    case 'n':
                      text = String(c.v);
                      cls = 'text-right text-sky-700 dark:text-sky-300';
                      break;
                    case 'b':
                      text = c.v ? 'TRUE' : 'FALSE';
                      cls = 'text-violet-700 dark:text-violet-300';
                      break;
                    case 'd':
                      text = formatDateSerial(c.v, c.k) ?? String(c.v);
                      cls = 'text-emerald-700 dark:text-emerald-300';
                      break;
                  }
                }
                return (
                  <td key={ci} className={cn('max-w-[16rem] truncate whitespace-pre border-b border-r px-2 py-0.5', cls)} title={text.length > 16 || text.includes('\n') ? text : undefined}>
                    {text.replace(/\r?\n/g, '↵')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TextToExcel() {
  const idRef = useRef(2);
  const [sheets, setSheets] = useState<InSheet[]>([{ id: 1, name: 'Customers', text: SAMPLE_CSV, format: 'auto' }]);
  const [active, setActive] = useState(1);
  const [hasHeader, setHasHeader] = useState(true);
  const [bold, setBold] = useState(true);
  const [freeze, setFreeze] = useState(true);
  const [autoFilter, setAutoFilter] = useState(true);
  const [autoWidth, setAutoWidth] = useState(true);
  const [infer, setInfer] = useState(true);
  const [keepText, setKeepText] = useState(true);
  const [flatten, setFlatten] = useState(true);
  const [fileName, setFileName] = useState('converted.xlsx');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const deferred = useDeferredValue(sheets);

  const parsed = useMemo(() => {
    return deferred.map((s) => {
      try {
        const p = parseTabularInput(s.text, s.format, flatten);
        const cells = tableToCells(p, { infer, keepText }, hasHeader);
        return { id: s.id, p, cells, err: null as string | null };
      } catch (e) {
        return { id: s.id, p: null, cells: [] as WCell[][], err: errMsg(e) };
      }
    });
  }, [deferred, flatten, infer, keepText, hasHeader]);

  const nameErrs = useMemo(() => validateSheetNames(sheets.map((s) => s.name)), [sheets]);
  const cur = sheets.find((s) => s.id === active) ?? sheets[0];
  const curIdx = cur ? sheets.findIndex((s) => s.id === cur.id) : -1;
  const curParsed = parsed.find((p) => p.id === cur?.id);

  const update = useCallback((id: number, patch: Partial<InSheet>) => {
    setSheets((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setInfo(null);
  }, []);

  const addSheet = useCallback(
    (name?: string, text = '', format: InputFormat = 'auto') => {
      const id = idRef.current++;
      setSheets((prev) => {
        const taken = new Set(prev.map((s) => s.name.toLowerCase()));
        let base = sanitizeSheetName(name ?? `Sheet${prev.length + 1}`, `Sheet${prev.length + 1}`);
        let n = base;
        let k = 2;
        while (taken.has(n.toLowerCase())) {
          const suffix = ` (${k++})`;
          n = base.slice(0, 31 - suffix.length) + suffix;
        }
        base = n;
        return [...prev, { id, name: base, text, format }];
      });
      setActive(id);
      setInfo(null);
    },
    []
  );

  const removeSheet = useCallback(
    (id: number) => {
      setSheets((prev) => {
        if (prev.length <= 1) return prev;
        const idx = prev.findIndex((s) => s.id === id);
        const next = prev.filter((s) => s.id !== id);
        if (id === active) setActive((next[Math.min(idx, next.length - 1)] ?? next[0])?.id ?? 0);
        return next;
      });
    },
    [active]
  );

  const onFiles = useCallback(
    async (files: File[]) => {
      setError(null);
      for (const f of files) {
        if (f.size > 50 * 1024 * 1024) {
          setError(`"${f.name}" is ${formatBytes(f.size)} - the limit is 50 MB per input file.`);
          continue;
        }
        const text = await f.text();
        const fmt: InputFormat = /\.(json|jsonl|ndjson)$/i.test(f.name) ? 'json' : /\.tsv$/i.test(f.name) ? 'tsv' : 'auto';
        const stem = f.name.replace(/\.[^.]+$/, '');
        // replace the untouched starter sheet with the first dropped file
        if (sheets.length === 1 && sheets[0] && sheets[0].text === SAMPLE_CSV && f === files[0]) {
          update(sheets[0].id, { name: sanitizeSheetName(stem, 'Sheet1'), text, format: fmt === 'json' ? 'auto' : fmt });
        } else {
          addSheet(stem, text, fmt === 'json' ? 'auto' : fmt);
        }
      }
    },
    [addSheet, sheets, update]
  );

  const totalStats = useMemo(() => {
    let rows = 0;
    let cells = 0;
    let cols = 0;
    for (const p of parsed) {
      rows += p.cells.length;
      for (const r of p.cells) {
        if (r.length > cols) cols = r.length;
        for (const c of r) if (c) cells++;
      }
    }
    return { rows, cells, cols };
  }, [parsed]);

  const anyNameErr = nameErrs.some((e) => e !== null);
  const anyParseErr = parsed.some((p) => p.err !== null);
  const empty = totalStats.cells === 0;
  const safeFile = (/\.xlsx$/i.test(fileName.trim()) ? fileName.trim() : `${fileName.trim() || 'converted'}.xlsx`).replace(/[\\/:*?"<>|]/g, '_');

  const build = useCallback(async () => {
    setError(null);
    setInfo(null);
    setBusy(true);
    await tick();
    try {
      const ws: WSheet[] = sheets.map((s) => {
        const p = parsed.find((x) => x.id === s.id);
        return { name: s.name, rows: p?.cells ?? [] };
      });
      const res = buildXlsx(ws, { header: hasHeader, bold, freeze, autoFilter, autoWidth });
      triggerDownload(new Blob([res.bytes as unknown as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), safeFile);
      setInfo(`Created ${safeFile} (${formatBytes(res.bytes.length)})${res.warnings.length ? ' - ' + res.warnings.join(' ') : ''}`);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }, [sheets, parsed, hasHeader, bold, freeze, autoFilter, autoWidth, safeFile]);

  useEffect(() => {
    if (!sheets.some((s) => s.id === active) && sheets[0]) setActive(sheets[0].id);
  }, [sheets, active]);

  return (
    <div className="flex flex-col gap-3">
      <FileDropzone
        onFiles={onFiles}
        multiple
        accept=".csv,.tsv,.txt,.json,.jsonl,.ndjson,text/csv,application/json,text/plain"
        label="Drop CSV, TSV or JSON files (one sheet per file)"
        hint="or paste below · each file becomes its own sheet"
        compact
      />

      <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Input sheets" data-testid="input-tabs">
        {sheets.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === cur?.id}
            onClick={() => setActive(s.id)}
            className={cn(
              'max-w-[12rem] truncate rounded-md border px-3 py-1 text-xs font-medium transition-colors',
              s.id === cur?.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-muted/50 hover:bg-accent',
              nameErrs[i] && s.id !== cur?.id && 'border-destructive/50 text-destructive'
            )}
          >
            {s.name || '(unnamed)'}
          </button>
        ))}
        <Button variant="outline" size="sm" onClick={() => addSheet()} aria-label="Add sheet">
          <Plus className="size-3.5" /> Add sheet
        </Button>
      </div>

      {cur && (
        <Panel>
          <PanelHeader title="Input data">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => update(cur.id, { text: SAMPLE_CSV, format: 'auto' })}
            >
              <FilePlus2 className="size-3.5" /> CSV sample
            </Button>
            <Button variant="ghost" size="sm" onClick={() => update(cur.id, { text: SAMPLE_JSON, format: 'auto' })}>
              <FilePlus2 className="size-3.5" /> JSON sample
            </Button>
            {sheets.length > 1 && (
              <Button variant="ghost" size="sm" onClick={() => removeSheet(cur.id)}>
                <Trash2 className="size-3.5" /> Remove sheet
              </Button>
            )}
          </PanelHeader>
          <div className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b bg-muted/20 p-3">
            <Field label="Sheet name" className="min-w-[14rem] flex-1" hint={nameErrs[curIdx] ? undefined : `${cur.name.length}/31`}>
              <Input
                value={cur.name}
                onChange={(e) => update(cur.id, { name: e.target.value })}
                aria-invalid={!!nameErrs[curIdx]}
                aria-label="Sheet name"
              />
              {nameErrs[curIdx] && <span className="text-2xs text-destructive">{nameErrs[curIdx]}</span>}
            </Field>
            <Field label="Input format">
              <Select value={cur.format} onValueChange={(v) => update(cur.id, { format: v as InputFormat })}>
                <SelectTrigger className="w-40" aria-label="Input format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-detect</SelectItem>
                  <SelectItem value="csv">CSV (comma)</SelectItem>
                  <SelectItem value="tsv">TSV (tab)</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="flex flex-col gap-1">
              <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Detected</span>
              <div className="flex h-8 items-center">
                {curParsed?.p ? (
                  <Badge variant="secondary" data-testid="detected-kind">
                    {KIND_LABEL[curParsed.p.kind]}
                    {curParsed.p.kind === 'csv' && curParsed.p.delimiter ? ` · ${DELIM_NAME[curParsed.p.delimiter] ?? curParsed.p.delimiter}` : ''}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </div>
            </div>
          </div>
          <Textarea
            value={cur.text}
            onChange={(e) => update(cur.id, { text: e.target.value })}
            spellCheck={false}
            placeholder="Paste CSV, TSV, or JSON (array of objects / array of arrays) here…"
            className="max-h-72 min-h-40 rounded-none border-0 font-mono text-xs shadow-none focus-visible:ring-0"
            aria-label="Input data"
          />
          {curParsed?.err && <ErrorBanner error={curParsed.err} className="m-2" />}
          {curParsed && !curParsed.err && curParsed.cells.length > 0 && (
            <>
              <div className="border-t">
                <CellPreview rows={curParsed.cells} />
              </div>
              <StatBar
                items={[
                  `${curParsed.cells.length.toLocaleString('en-US')} rows`,
                  `${curParsed.cells.reduce((m, r) => Math.max(m, r.length), 0)} columns`,
                  'preview shows detected cell types (blue number, violet boolean, green date)',
                ]}
              />
            </>
          )}
        </Panel>
      )}

      <OptionsBar>
        <Toggle label="First row is header" checked={hasHeader} onChange={setHasHeader} />
        <Toggle label="Bold header" checked={bold} onChange={setBold} disabled={!hasHeader} />
        <Toggle label="Freeze header" checked={freeze} onChange={setFreeze} disabled={!hasHeader} />
        <Toggle label="Autofilter" checked={autoFilter} onChange={setAutoFilter} disabled={!hasHeader} />
        <Toggle label="Auto column widths" checked={autoWidth} onChange={setAutoWidth} />
        <Toggle label="Detect numbers, booleans & dates" checked={infer} onChange={setInfer} />
        <Toggle label="Keep 00123 / long digits as text" checked={keepText} onChange={setKeepText} disabled={!infer} />
        <Toggle label="Flatten nested JSON (a.b)" checked={flatten} onChange={setFlatten} />
      </OptionsBar>

      <Panel>
        <PanelHeader title="Create workbook" />
        <div className="flex flex-wrap items-end gap-3 p-3">
          <Field label="File name" className="min-w-[14rem] flex-1">
            <Input value={fileName} onChange={(e) => setFileName(e.target.value)} className="font-mono" aria-label="File name" />
          </Field>
          <Button onClick={() => void build()} disabled={busy || anyNameErr || anyParseErr || empty} data-testid="build-xlsx">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <FileSpreadsheet className="size-3.5" />}
            Download .xlsx
          </Button>
        </div>
        {info && <div className="border-t px-3 py-2 text-xs text-success" data-testid="build-info">{info}</div>}
        <StatBar
          items={[
            `${sheets.length} sheet${sheets.length === 1 ? '' : 's'}`,
            `${totalStats.rows.toLocaleString('en-US')} rows`,
            `${totalStats.cells.toLocaleString('en-US')} cells`,
            anyNameErr && 'fix sheet names (red)',
            anyParseErr && 'fix input errors',
            empty && 'nothing to write yet',
          ]}
        />
      </Panel>
      <ErrorBanner error={error} />

      <p className="text-2xs text-muted-foreground">
        Dates written as real Excel dates use <code className="font-mono">yyyy-mm-dd</code> / <code className="font-mono">yyyy-mm-dd hh:mm:ss</code>; ISO timestamps with a time zone are converted to UTC.
        Values starting with = are stored as text, never as formulas. Sheet names: max 31 characters, none of <code className="font-mono">[ ] : * ? / \</code>.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function ExcelConverterTool() {
  const [tab, setTab] = useState<'read' | 'write'>('read');
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as 'read' | 'write')} className="gap-3">
      <TabsList className="w-full sm:w-fit">
        <TabsTrigger value="read">Excel → CSV / JSON</TabsTrigger>
        <TabsTrigger value="write">CSV / JSON → Excel</TabsTrigger>
      </TabsList>
      <TabsContent value="read" forceMount className="data-[state=inactive]:hidden">
        <ExcelToText />
      </TabsContent>
      <TabsContent value="write" forceMount className="data-[state=inactive]:hidden">
        <TextToExcel />
      </TabsContent>
    </Tabs>
  );
}
