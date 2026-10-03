'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, FileSpreadsheet, KeyRound, Loader2, Upload, X } from 'lucide-react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatBytes } from '@/lib/download';
import { cn } from '@/lib/utils';

import {
  DELIMITERS,
  DEFAULT_DIFF_OPTIONS,
  DiffSetupError,
  detectDelimiter,
  diffTablesAsync,
  diffToCsv,
  parseTableAsync,
  rowCells,
  suggestKeyColumns,
  summaryText,
  type CsvTable,
  type Delimiter,
  type DiffOptions,
  type DiffResult,
  type RowStatus,
} from './logic';

const MAX_RENDER = 2000;
const MAX_PASTE = 4_000_000;

const SAMPLE_A = `id,name,department,salary,start_date
1,Ada Lovelace,Engineering,125000,2019-03-01
2,Alan Turing,Research,118000,2018-07-15
3,Grace Hopper,Engineering,131000,2017-01-09
4,Linus Torvalds,Platform,99000,2020-11-30
5,Margaret Hamilton,Research,122000,2016-05-23
`;

const SAMPLE_B = `id,name,department,level,salary,start_date
1,Ada Lovelace,Engineering,L5,125000,2019-03-01
3,Grace Hopper,Engineering,L6,138000,2017-01-09
4,Linus Torvalds,Platform ,L4,99000.00,2020-11-30
5,margaret hamilton,Research,L5,122000,2016-05-23
6,Dennis Ritchie,Platform,L5,110000,2021-02-14
`;

interface Source {
  text: string;
  /** set when the text came from a file */
  file: { name: string; size: number } | null;
}

type DelimChoice = 'auto' | Delimiter;

const ROW_STYLE: Record<RowStatus, string> = {
  added: 'bg-success/10',
  removed: 'bg-destructive/10',
  changed: 'bg-warning/10',
  unchanged: '',
};
const SIGN: Record<RowStatus, string> = { added: '+', removed: '−', changed: '~', unchanged: '' };
const SIGN_STYLE: Record<RowStatus, string> = {
  added: 'text-success',
  removed: 'text-destructive',
  changed: 'text-warning',
  unchanged: 'text-muted-foreground',
};

function delimName(d: Delimiter): string {
  return DELIMITERS.find((x) => x.value === d)?.label.toLowerCase() ?? d;
}

/** Make leading/trailing whitespace visible inside changed cells. */
function visible(s: string): string {
  if (s === '') return '∅';
  return s.replace(/^ +| +$/g, (m) => '·'.repeat(m.length)).replace(/\t/g, '→').replace(/\n/g, '↵');
}

function Chip({ active, onClick, children, title, tone }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string; tone?: 'key' | 'ignore' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={cn(
        'inline-flex h-6 max-w-[14rem] items-center gap-1 truncate rounded-md border px-2 font-mono text-2xs transition-colors',
        active
          ? tone === 'ignore'
            ? 'border-muted-foreground/40 bg-muted text-foreground line-through'
            : 'border-primary bg-primary text-primary-foreground'
          : 'bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      {children}
    </button>
  );
}

function useParsed(
  source: Source,
  delim: DelimChoice,
  hasHeader: boolean
): { table: CsvTable | null; busy: boolean; progress: number; detected: Delimiter; error: string | null } {
  const [state, setState] = useState<{ table: CsvTable | null; busy: boolean; progress: number; error: string | null }>({
    table: null,
    busy: false,
    progress: 0,
    error: null,
  });
  const detected = useMemo(() => detectDelimiter(source.text), [source.text]);
  const effective: Delimiter = delim === 'auto' ? detected : delim;
  const run = useRef(0);

  useEffect(() => {
    const id = ++run.current;
    if (source.text.trim() === '') {
      setState({ table: null, busy: false, progress: 0, error: null });
      return;
    }
    setState((s) => ({ ...s, busy: true, progress: 0, error: null }));
    const delay = source.file ? 0 : 250;
    const timer = setTimeout(() => {
      parseTableAsync(
        source.text,
        effective,
        hasHeader,
        (f) => {
          if (id === run.current) setState((s) => ({ ...s, progress: f }));
        },
        () => id !== run.current
      )
        .then((table) => {
          if (id === run.current && table) setState({ table, busy: false, progress: 1, error: null });
        })
        .catch((e: unknown) => {
          if (id === run.current) setState({ table: null, busy: false, progress: 0, error: e instanceof Error ? e.message : String(e) });
        });
    }, delay);
    return () => clearTimeout(timer);
  }, [source, effective, hasHeader]);

  return { ...state, detected };
}

export default function CsvDiffCompareTool() {
  const [srcA, setSrcA] = useState<Source>({ text: SAMPLE_A, file: null });
  const [srcB, setSrcB] = useState<Source>({ text: SAMPLE_B, file: null });
  const [delimA, setDelimA] = useState<DelimChoice>('auto');
  const [delimB, setDelimB] = useState<DelimChoice>('auto');
  const [hasHeader, setHasHeader] = useState(true);
  const [mode, setMode] = useState<DiffOptions['mode']>('key');
  const [keys, setKeys] = useState<string[]>([]);
  const [keysTouched, setKeysTouched] = useState(false);
  const [modeTouched, setModeTouched] = useState(false);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [trimWhitespace, setTrimWhitespace] = useState(false);
  const [numeric, setNumeric] = useState(false);
  const [byName, setByName] = useState(true);
  const [ignoreCols, setIgnoreCols] = useState<string[]>([]);
  const [filter, setFilter] = useState<'diff' | 'all' | RowStatus>('diff');
  const [onlyChangedCols, setOnlyChangedCols] = useState(false);
  const [exportChanged, setExportChanged] = useState<'new' | 'arrow'>('arrow');
  const [exportMeta, setExportMeta] = useState(true);

  const pa = useParsed(srcA, delimA, hasHeader);
  const pb = useParsed(srcB, delimB, hasHeader);
  const tableA = pa.table;
  const tableB = pb.table;

  const [result, setResult] = useState<DiffResult | null>(null);
  const [diffBusy, setDiffBusy] = useState(false);
  const [diffProgress, setDiffProgress] = useState(0);
  const [diffError, setDiffError] = useState<string | null>(null);
  const diffRun = useRef(0);

  const commonHeaders = useMemo(() => {
    if (!tableA || !tableB) return [];
    const bs = new Set(tableB.headers);
    return tableA.headers.filter((h) => bs.has(h));
  }, [tableA, tableB]);
  const allHeaders = useMemo(() => {
    if (!tableA || !tableB) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const h of [...tableB.headers, ...tableA.headers]) {
      if (!seen.has(h)) {
        seen.add(h);
        out.push(h);
      }
    }
    return out;
  }, [tableA, tableB]);

  // suggest a key whenever the data changes (until the user picks one)
  const [suggestion, setSuggestion] = useState<string[] | null>(null);
  useEffect(() => {
    if (!tableA || !tableB) {
      setSuggestion(null);
      return;
    }
    const t = setTimeout(() => setSuggestion(suggestKeyColumns(tableA, tableB)), 0);
    return () => clearTimeout(t);
  }, [tableA, tableB]);
  useEffect(() => {
    if (suggestion === null) return;
    if (!keysTouched) setKeys(suggestion);
    if (!modeTouched) setMode(suggestion.length > 0 ? 'key' : 'position');
  }, [suggestion, keysTouched, modeTouched]);

  // keep key / ignore selections valid when the headers change
  const validKeys = useMemo(() => keys.filter((k) => commonHeaders.includes(k)), [keys, commonHeaders]);
  const validIgnore = useMemo(() => ignoreCols.filter((k) => allHeaders.includes(k)), [ignoreCols, allHeaders]);

  const options: DiffOptions = useMemo(
    () => ({
      ...DEFAULT_DIFF_OPTIONS,
      mode,
      keyColumns: validKeys,
      ignoreCase,
      trimWhitespace,
      numeric,
      ignoreColumns: validIgnore,
      matchColumnsByName: byName,
    }),
    [mode, validKeys, ignoreCase, trimWhitespace, numeric, validIgnore, byName]
  );

  const keysReady = mode === 'position' || validKeys.length > 0;
  const suggestionPending = tableA !== null && tableB !== null && suggestion === null && !keysTouched;

  useEffect(() => {
    const id = ++diffRun.current;
    if (!tableA || !tableB) {
      setResult(null);
      setDiffError(null);
      setDiffBusy(false);
      return;
    }
    if (!keysReady) {
      setResult(null);
      setDiffError(suggestionPending ? null : 'Choose at least one key column (or switch to matching by row position).');
      setDiffBusy(false);
      return;
    }
    setDiffBusy(true);
    setDiffError(null);
    const t = setTimeout(() => {
      diffTablesAsync(
        tableA,
        tableB,
        options,
        (f) => {
          if (id === diffRun.current) setDiffProgress(f);
        },
        () => id !== diffRun.current
      )
        .then((r) => {
          if (id !== diffRun.current || !r) return;
          setResult(r);
          setDiffBusy(false);
        })
        .catch((e: unknown) => {
          if (id !== diffRun.current) return;
          setResult(null);
          setDiffBusy(false);
          setDiffError(e instanceof DiffSetupError ? e.message : e instanceof Error ? e.message : String(e));
        });
    }, 30);
    return () => clearTimeout(t);
  }, [tableA, tableB, options, keysReady, suggestionPending]);

  const loadFile = useCallback(async (file: File, which: 'A' | 'B') => {
    try {
      const gz = /\.gz$/i.test(file.name);
      if (gz) throw new Error('Compressed files (.gz) are not supported: unzip the file first.');
      const text = await file.text();
      const src: Source = { text, file: { name: file.name, size: file.size } };
      if (which === 'A') {
        setSrcA(src);
        setDelimA('auto');
      } else {
        setSrcB(src);
        setDelimB('auto');
      }
      setKeysTouched(false);
      setModeTouched(false);
      setFileError(null);
    } catch (e) {
      setFileError(e instanceof Error ? e.message : `Could not read "${file.name}".`);
    }
  }, []);
  const [fileError, setFileError] = useState<string | null>(null);

  const visibleRows = useMemo(() => {
    if (!result) return [];
    if (filter === 'all') return result.rows;
    if (filter === 'diff') return result.rows.filter((r) => r.status !== 'unchanged');
    return result.rows.filter((r) => r.status === filter);
  }, [result, filter]);
  const shown = visibleRows.length > MAX_RENDER ? visibleRows.slice(0, MAX_RENDER) : visibleRows;

  const shownColumns = useMemo(() => {
    if (!result) return [];
    const cols = result.columns.map((c, ui) => ({ c, ui }));
    if (!onlyChangedCols) return cols;
    return cols.filter(({ c, ui }) => c.isKey || c.status === 'added' || c.status === 'removed' || (result.changedPerColumn[ui] ?? 0) > 0);
  }, [result, onlyChangedCols]);

  const exportCsv = useCallback(
    (include: RowStatus[], meta: boolean, changed: 'new' | 'arrow') => () => {
      if (!result || !tableA || !tableB) return '';
      return diffToCsv(result, tableA, tableB, { include: new Set(include), meta, changed, delimiter: ',' });
    },
    [result, tableA, tableB]
  );
  const nameA = srcA.file?.name ?? 'A';
  const nameB = srcB.file?.name ?? 'B';

  const toggle = (list: string[], v: string): string[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const renderPane = (which: 'A' | 'B') => {
    const src = which === 'A' ? srcA : srcB;
    const setSrc = which === 'A' ? setSrcA : setSrcB;
    const p = which === 'A' ? pa : pb;
    const delim = which === 'A' ? delimA : delimB;
    const setDelim = which === 'A' ? setDelimA : setDelimB;
    const fileRef = which === 'A' ? fileRefA : fileRefB;
    return (
      <Panel
        className="min-w-0"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const f = e.dataTransfer.files[0];
          if (f) {
            e.preventDefault();
            void loadFile(f, which);
          }
        }}
      >
        <PanelHeader title={which === 'A' ? 'A · original' : 'B · changed'}>
          <Select value={delim} onValueChange={(v) => setDelim(v as DelimChoice)}>
            <SelectTrigger className="h-7 w-[9.5rem] text-xs" aria-label={`Delimiter for ${which}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto ({delimName(p.detected)})</SelectItem>
              {DELIMITERS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" /> Open
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void loadFile(f, which);
              e.target.value = '';
            }}
          />
        </PanelHeader>
        {src.file ? (
          <div className="flex flex-col gap-2 p-3">
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
              <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{src.file.name}</div>
                <div className="font-mono text-2xs text-muted-foreground">{formatBytes(src.file.size)}</div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove file ${src.file.name}`}
                onClick={() => {
                  setSrc({ text: '', file: null });
                  setKeysTouched(false);
                }}
              >
                <X className="size-3.5" />
              </Button>
            </div>
            <pre className="max-h-28 overflow-auto rounded-md border bg-muted/20 p-2 font-mono text-2xs leading-4 text-muted-foreground">
              {src.text.slice(0, 1200)}
              {src.text.length > 1200 ? '\n…' : ''}
            </pre>
          </div>
        ) : (
          <Textarea
            value={src.text}
            onChange={(e) => {
              setSrc({ text: e.target.value.slice(0, MAX_PASTE), file: null });
              setKeysTouched(false);
            }}
            spellCheck={false}
            wrap="off"
            placeholder="Paste CSV here, or drop a .csv / .tsv file anywhere on this box"
            aria-label={`CSV ${which}`}
            className="field-sizing-fixed h-44 resize-y rounded-none border-0 bg-transparent px-3 py-2 font-mono text-xs leading-5 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        )}
        {p.busy && p.progress > 0 && p.progress < 1 && (
          <div className="h-1 bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(p.progress * 100)}%` }} />
          </div>
        )}
        <StatBar
          items={[
            p.table ? `${p.table.rows.length.toLocaleString()} rows` : p.busy ? 'reading…' : '0 rows',
            p.table ? `${p.table.headers.length} columns` : null,
            p.table ? `delimiter: ${delimName(p.table.delimiter)}` : null,
            p.table && p.table.blankLines > 0 ? `${p.table.blankLines} blank line${p.table.blankLines === 1 ? '' : 's'} skipped` : null,
          ]}
        />
        {p.error && <ErrorBanner error={p.error} className="m-2" />}
      </Panel>
    );
  };

  const fileRefA = useRef<HTMLInputElement | null>(null);
  const fileRefB = useRef<HTMLInputElement | null>(null);

  const counts = result?.counts;
  const statCard = (status: RowStatus, label: string) => {
    const n = counts?.[status] ?? 0;
    const active = filter === status;
    return (
      <button
        type="button"
        onClick={() => setFilter(active ? 'diff' : status)}
        aria-pressed={active}
        className={cn(
          'flex min-w-[6.5rem] flex-1 flex-col rounded-md border px-3 py-2 text-left transition-colors hover:bg-accent/40',
          active && 'ring-2 ring-ring/50',
          status === 'added' && n > 0 && 'bg-success/10',
          status === 'removed' && n > 0 && 'bg-destructive/10',
          status === 'changed' && n > 0 && 'bg-warning/10'
        )}
      >
        <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className={cn('font-mono text-xl font-semibold tabular', SIGN_STYLE[status])}>{n.toLocaleString()}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {renderPane('A')}
        {renderPane('B')}
      </div>
      <ErrorBanner error={fileError} />

      <OptionsBar>
        <Field label="First row is header">
          <Switch checked={hasHeader} onCheckedChange={(c) => { setHasHeader(c); setKeysTouched(false); }} aria-label="First row is a header" />
        </Field>
        <Field label="Match rows by">
          <Tabs
            value={mode}
            onValueChange={(v) => {
              setMode(v as DiffOptions['mode']);
              setModeTouched(true);
            }}
          >
            <TabsList>
              <TabsTrigger value="key">Key columns</TabsTrigger>
              <TabsTrigger value="position">Row position</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label="Ignore case">
          <Switch checked={ignoreCase} onCheckedChange={setIgnoreCase} aria-label="Ignore case" />
        </Field>
        <Field label="Trim whitespace">
          <Switch checked={trimWhitespace} onCheckedChange={setTrimWhitespace} aria-label="Trim whitespace" />
        </Field>
        <Field label="Numbers as numbers">
          <Switch checked={numeric} onCheckedChange={setNumeric} aria-label="Compare numeric strings as numbers" />
        </Field>
        <Field label="Ignore column order">
          <Switch checked={byName} onCheckedChange={setByName} aria-label="Match columns by header name" />
        </Field>
      </OptionsBar>

      {tableA && tableB && (
        <Panel>
          <div className="flex flex-col gap-3 p-3">
            {mode === 'key' && (
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <KeyRound className="size-3.5 text-muted-foreground" />
                  <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Key column(s)</span>
                  {suggestion && suggestion.length > 0 && !keysTouched && <Badge variant="muted">suggested</Badge>}
                  {suggestion !== null && suggestion.length === 0 && !keysTouched && (
                    <span className="text-2xs text-warning">No column is unique in both files: pick columns that identify a row, or match by row position.</span>
                  )}
                  {suggestion && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-6"
                      onClick={() => {
                        setKeys(suggestion);
                        setKeysTouched(false);
                      }}
                    >
                      Auto-pick
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {commonHeaders.length === 0 && <span className="text-xs text-muted-foreground">The files share no header names.</span>}
                  {commonHeaders.map((h) => (
                    <Chip
                      key={h}
                      active={validKeys.includes(h)}
                      onClick={() => {
                        setKeys(toggle(validKeys, h));
                        setKeysTouched(true);
                      }}
                      title="Use as part of the row key"
                    >
                      {h}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Ignore columns (not compared)</span>
              <div className="flex flex-wrap gap-1.5">
                {allHeaders.map((h) => (
                  <Chip key={h} tone="ignore" active={validIgnore.includes(h)} onClick={() => setIgnoreCols(toggle(validIgnore, h))} title="Exclude from comparison">
                    {h}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      )}

      <Panel>
        <PanelHeader title="Differences">
          {result && (
            <>
              <CopyButton value={() => summaryText(result, nameA, nameB)} label="Copy summary" />
            </>
          )}
        </PanelHeader>

        {diffBusy && (
          <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Comparing… {Math.round(diffProgress * 100)}%
            <div className="ml-2 h-1 flex-1 overflow-hidden rounded bg-muted">
              <div className="h-full bg-primary" style={{ width: `${Math.round(diffProgress * 100)}%` }} />
            </div>
          </div>
        )}
        {diffError && <ErrorBanner error={diffError} className="m-3" />}

        {!result && !diffError && !diffBusy && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Paste or drop two CSV files to compare them.</p>
        )}

        {result && counts && (
          <>
            <div className="flex flex-wrap gap-2 p-3">
              {statCard('added', 'Added rows')}
              {statCard('removed', 'Removed rows')}
              {statCard('changed', 'Changed rows')}
              {statCard('unchanged', 'Unchanged')}
              <div className="flex min-w-[10rem] flex-[2] flex-col justify-center gap-1 rounded-md border px-3 py-2 text-xs">
                <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Columns</span>
                {result.columnsAdded.length + result.columnsRemoved.length + result.columnsRenamed.length === 0 ? (
                  <span className="text-muted-foreground">same columns in both files</span>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    {result.columnsAdded.length > 0 && (
                      <span>
                        <span className="font-semibold text-success">+{result.columnsAdded.length} added:</span> <span className="font-mono">{result.columnsAdded.join(', ')}</span>
                      </span>
                    )}
                    {result.columnsRemoved.length > 0 && (
                      <span>
                        <span className="font-semibold text-destructive">−{result.columnsRemoved.length} removed:</span> <span className="font-mono">{result.columnsRemoved.join(', ')}</span>
                      </span>
                    )}
                    {result.columnsRenamed.length > 0 && (
                      <span>
                        <span className="font-semibold text-warning">{result.columnsRenamed.length} renamed by position:</span>{' '}
                        <span className="font-mono">{result.columnsRenamed.map((r) => `${r.from}→${r.to}`).join(', ')}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {(result.warnings.length > 0 || result.duplicatesA.length > 0 || result.duplicatesB.length > 0) && (
              <div className="mx-3 mb-3 flex flex-col gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
                {result.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                    <span>{w}</span>
                  </div>
                ))}
                {(result.duplicatesA.length > 0 || result.duplicatesB.length > 0) && (
                  <details>
                    <summary className="cursor-pointer text-2xs font-medium text-muted-foreground hover:text-foreground">
                      Duplicate keys: {result.duplicateRowsA.toLocaleString()} extra row{result.duplicateRowsA === 1 ? '' : 's'} in A, {result.duplicateRowsB.toLocaleString()} in B
                    </summary>
                    <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
                      {([['A', result.duplicatesA], ['B', result.duplicatesB]] as const).map(([label, list]) => (
                        <div key={label}>
                          <div className="mb-0.5 text-2xs font-semibold text-muted-foreground">File {label}</div>
                          {list.length === 0 ? (
                            <div className="text-2xs text-muted-foreground">none</div>
                          ) : (
                            <ul className="font-mono text-2xs">
                              {list.slice(0, 8).map((d) => (
                                <li key={d.key} className="truncate">
                                  {d.key === '' ? '(empty)' : d.key} ×{d.count} <span className="text-muted-foreground">first at row {d.firstRow}</span>
                                </li>
                              ))}
                              {list.length > 8 && <li className="text-muted-foreground">… and {list.length - 8} more keys</li>}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y bg-muted/30 px-3 py-2">
              <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                <TabsList>
                  <TabsTrigger value="diff">Differences</TabsTrigger>
                  <TabsTrigger value="all">All rows</TabsTrigger>
                  <TabsTrigger value="added">Added</TabsTrigger>
                  <TabsTrigger value="removed">Removed</TabsTrigger>
                  <TabsTrigger value="changed">Changed</TabsTrigger>
                  <TabsTrigger value="unchanged">Unchanged</TabsTrigger>
                </TabsList>
              </Tabs>
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={onlyChangedCols} onCheckedChange={setOnlyChangedCols} aria-label="Only show columns with differences" />
                Only columns with differences
              </label>
            </div>

            {visibleRows.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                {counts.added + counts.removed + counts.changed === 0 ? 'The files are identical under the current comparison options.' : 'No rows with this status.'}
              </p>
            ) : (
              <div className="max-h-[36rem] overflow-auto">
                <table className="w-full border-separate border-spacing-0 text-xs">
                  <thead className="sticky top-0 z-10 bg-muted text-2xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="w-8 border-b px-2 py-1.5 text-center font-medium">±</th>
                      {shownColumns.map(({ c }, i) => (
                        <th
                          key={i}
                          className={cn(
                            'whitespace-nowrap border-b px-3 py-1.5 text-left font-medium',
                            c.status === 'added' && 'text-success',
                            c.status === 'removed' && 'text-destructive',
                            c.status === 'renamed' && 'text-warning',
                            c.ignored && 'opacity-60'
                          )}
                          title={c.ignored ? 'ignored column' : c.status === 'added' ? 'only in B' : c.status === 'removed' ? 'only in A' : c.status === 'renamed' ? `named "${c.renamedFrom}" in A` : undefined}
                        >
                          <span className="inline-flex items-center gap-1">
                            {c.isKey && <KeyRound className="size-3" />}
                            {c.renamedFrom ? (
                              <>
                                <span className="line-through opacity-70">{c.renamedFrom}</span> <ArrowRight className="size-3" /> {c.name}
                              </>
                            ) : (
                              c.name
                            )}
                            {c.status === 'added' && <span className="text-[0.6rem] normal-case">(new)</span>}
                            {c.status === 'removed' && <span className="text-[0.6rem] normal-case">(gone)</span>}
                            {c.ignored && <span className="text-[0.6rem] normal-case">(ignored)</span>}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {shown.map((row, ri) => {
                      const cells = tableA && tableB ? rowCells(result, tableA, tableB, row) : [];
                      return (
                        <tr key={ri} className={cn('hover:bg-accent/30', ROW_STYLE[row.status])}>
                          <td className={cn('border-b px-2 py-1 text-center font-bold', SIGN_STYLE[row.status])} title={row.status}>
                            {SIGN[row.status]}
                          </td>
                          {shownColumns.map(({ c, ui }) => {
                            const cell = cells[ui];
                            const isChanged = cell?.old !== undefined;
                            const dim = row.status === 'removed' ? c.a < 0 : row.status === 'added' ? c.b < 0 : false;
                            return (
                              <td
                                key={ui}
                                className={cn('max-w-[22rem] truncate border-b px-3 py-1', isChanged && 'bg-warning/20', c.ignored && 'text-muted-foreground', dim && 'text-muted-foreground/40')}
                                title={isChanged ? `${cell?.old ?? ''} → ${cell?.value ?? ''}` : cell?.value}
                              >
                                {isChanged ? (
                                  <>
                                    <span className="text-destructive line-through decoration-destructive/60">{visible(cell?.old ?? '')}</span>
                                    <span className="mx-1 text-muted-foreground">→</span>
                                    <span className="font-semibold text-success">{visible(cell?.value ?? '')}</span>
                                  </>
                                ) : (
                                  cell?.value
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {visibleRows.length > MAX_RENDER && (
              <p className="border-t bg-muted/30 px-3 py-1.5 text-2xs text-muted-foreground">
                Showing the first {MAX_RENDER.toLocaleString()} of {visibleRows.length.toLocaleString()} rows. All rows are compared, and the exports below contain every row.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-3 py-2.5">
              <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Export</span>
              <Select value={exportChanged} onValueChange={(v) => setExportChanged(v as 'new' | 'arrow')}>
                <SelectTrigger className="h-7 w-44 text-xs" aria-label="Changed cell format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="arrow">Changed cells: old → new</SelectItem>
                  <SelectItem value="new">Changed cells: new value</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={exportMeta} onCheckedChange={setExportMeta} aria-label="Include status columns" />
                Status columns
              </label>
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    ['Diff CSV', ['added', 'removed', 'changed', 'unchanged'], 'diff.csv'],
                    ['Differences only', ['added', 'removed', 'changed'], 'differences.csv'],
                    ['Added', ['added'], 'added-rows.csv'],
                    ['Removed', ['removed'], 'removed-rows.csv'],
                    ['Changed', ['changed'], 'changed-rows.csv'],
                  ] as [string, RowStatus[], string][]
                ).map(([label, include, file]) => (
                  <span key={file} className="inline-flex items-center rounded-md border">
                    <DownloadButton
                      data={exportCsv(include, exportMeta, exportChanged)}
                      filename={file}
                      mime="text/csv"
                      label={label}
                      variant="ghost"
                      disabled={include.every((s) => (counts[s] ?? 0) === 0)}
                    />
                    <CopyButton value={exportCsv(include, exportMeta, exportChanged)} label={`Copy ${label}`} size="icon-sm" disabled={include.every((s) => (counts[s] ?? 0) === 0)} />
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
        <StatBar
          items={[
            result ? `${result.rows.length.toLocaleString()} rows in the diff` : null,
            result ? (result.mode === 'key' ? `key: ${result.keyNames.join(' + ')}` : 'matched by row position') : null,
            result ? `${result.columns.length} columns` : null,
          ]}
        />
      </Panel>

      <p className="text-2xs text-muted-foreground">
        Rows are compared cell by cell. With key columns, rows are matched by key whatever their order; rows that share a key are paired in order of appearance. Row moves are not reported, and
        positional matching treats an inserted row as shifting everything below it. Everything stays in your browser.
      </p>
    </div>
  );
}
