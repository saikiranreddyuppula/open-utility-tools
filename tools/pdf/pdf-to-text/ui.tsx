'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Loader2, Lock, ScanLine, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { decryptPdf, extractText, isEncrypted } from '@/lib/wasm/pdf';
import { formatBytes } from '@/lib/download';
import { cn } from '@/lib/utils';
import {
  assemblePages,
  compressPageList,
  countWords,
  matchesPerPage,
  processPageText,
  searchText,
  type PageText,
} from './logic';

const MAX_FILE_BYTES = 300 * 1024 * 1024;
const MAX_HIGHLIGHTS = 3000;

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const baseName = (name: string): string => name.replace(/\.pdf$/i, '') || 'document';

function passwordError(e: unknown): string {
  const detail = errMsg(e).trim();
  const tail = detail && detail.length < 160 ? ` (${detail})` : '';
  return `That password didn't work — check it and try again; passwords are case-sensitive.${tail}`;
}

interface Loaded {
  name: string;
  size: number;
}

export default function PdfToTextTool() {
  const [file, setFile] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [rawBytes, setRawBytes] = useState<Uint8Array | null>(null);
  const [workBytes, setWorkBytes] = useState<Uint8Array | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const [spec, setSpec] = useState('');
  const [pages, setPages] = useState<PageText[] | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [separators, setSeparators] = useState(false);
  const [reflow, setReflow] = useState(false);
  const [trim, setTrim] = useState(false);
  const [view, setView] = useState<'all' | number>('all');
  const [query, setQuery] = useState('');
  const [matchIdx, setMatchIdx] = useState(0);

  const loadSeq = useRef(0);
  const extractSeq = useRef(0);
  const specTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workRef = useRef<Uint8Array | null>(null);
  const viewerRef = useRef<HTMLPreElement>(null);

  useEffect(
    () => () => {
      if (specTimer.current) clearTimeout(specTimer.current);
    },
    []
  );

  const runExtract = useCallback(async (bytes: Uint8Array, pageSpec: string) => {
    const seq = ++extractSeq.current;
    setExtracting(true);
    setError(null);
    try {
      const res = await extractText(bytes.slice(), pageSpec.trim());
      if (seq !== extractSeq.current) return;
      const sorted = res.slice().sort((a, b) => a.page - b.page);
      setPages(sorted);
      setView((v) => (v === 'all' || sorted.some((p) => p.page === v) ? v : 'all'));
    } catch (e) {
      if (seq !== extractSeq.current) return;
      setPages(null);
      setError(errMsg(e));
    } finally {
      if (seq === extractSeq.current) setExtracting(false);
    }
  }, []);

  const onFiles = useCallback(
    async (files: File[]) => {
      const f = files[0];
      if (!f) return;
      const seq = ++loadSeq.current;
      extractSeq.current++;
      if (specTimer.current) clearTimeout(specTimer.current);
      setLoading(true);
      setError(null);
      setPages(null);
      setNote(null);
      setNeedsPassword(false);
      setPassword('');
      setPwError(null);
      setWorkBytes(null);
      setRawBytes(null);
      workRef.current = null;
      setFile({ name: f.name, size: f.size });
      setSpec('');
      setQuery('');
      try {
        if (!(f.type === 'application/pdf' || /\.pdf$/i.test(f.name))) throw new Error('Please choose a PDF file.');
        if (f.size > MAX_FILE_BYTES) {
          throw new Error(`File is too large (${formatBytes(f.size)}). Limit is ${formatBytes(MAX_FILE_BYTES)}.`);
        }
        const bytes = new Uint8Array(await f.arrayBuffer());
        if (seq !== loadSeq.current) return;
        let enc = false;
        try {
          enc = await isEncrypted(bytes.slice());
        } catch {
          enc = false;
        }
        if (seq !== loadSeq.current) return;
        let work: Uint8Array = bytes;
        if (enc) {
          try {
            // Files that only carry owner restrictions open with an empty user password.
            work = await decryptPdf(bytes.slice(), '');
            setNote('This PDF has usage restrictions but no open password, so its text can be read directly.');
          } catch {
            if (seq !== loadSeq.current) return;
            setRawBytes(bytes);
            setNeedsPassword(true);
            return;
          }
        }
        if (seq !== loadSeq.current) return;
        setWorkBytes(work);
        workRef.current = work;
        await runExtract(work, '');
      } catch (e) {
        if (seq === loadSeq.current) setError(errMsg(e));
      } finally {
        if (seq === loadSeq.current) setLoading(false);
      }
    },
    [runExtract]
  );

  const unlock = useCallback(async () => {
    if (!rawBytes) return;
    setUnlocking(true);
    setPwError(null);
    try {
      const dec = await decryptPdf(rawBytes.slice(), password);
      setPassword('');
      setNeedsPassword(false);
      setRawBytes(null);
      setWorkBytes(dec);
      workRef.current = dec;
      setNote('Unlocked with your password. The password is only used in this tab and is never stored.');
      await runExtract(dec, spec);
    } catch (e) {
      setPwError(passwordError(e));
    } finally {
      setUnlocking(false);
    }
  }, [rawBytes, password, runExtract, spec]);

  const onSpecChange = (v: string) => {
    setSpec(v);
    if (specTimer.current) clearTimeout(specTimer.current);
    specTimer.current = setTimeout(() => {
      if (workRef.current) void runExtract(workRef.current, v);
    }, 450);
  };

  const processed = useMemo<PageText[]>(
    () => (pages ?? []).map((p) => ({ page: p.page, text: processPageText(p.text, { reflow, trim }) })),
    [pages, reflow, trim]
  );
  const emptyPages = useMemo(() => processed.filter((p) => !p.text.trim()).map((p) => p.page), [processed]);
  const allEmpty = processed.length > 0 && emptyPages.length === processed.length;

  const viewPages = useMemo(
    () => (view === 'all' ? processed : processed.filter((p) => p.page === view)),
    [processed, view]
  );
  const displayText = useMemo(
    () => assemblePages(viewPages, view === 'all' && separators),
    [viewPages, view, separators]
  );
  const stats = useMemo(() => {
    let words = 0;
    let chars = 0;
    for (const p of viewPages) {
      words += countWords(p.text);
      chars += p.text.length;
    }
    return { words, chars };
  }, [viewPages]);

  const search = useMemo(
    () => (query ? searchText(displayText, query, MAX_HIGHLIGHTS) : null),
    [displayText, query]
  );
  const perPage = useMemo(() => (query ? matchesPerPage(viewPages, query) : new Map<number, number>()), [viewPages, query]);
  const curMatch = search && search.highlighted > 0 ? Math.min(matchIdx, search.highlighted - 1) : 0;

  const highlighted = useMemo(() => {
    if (!search) return null;
    let k = -1;
    return search.segments.map((seg, i) => {
      if (!seg.match) return <span key={i}>{seg.text}</span>;
      k++;
      return (
        <mark
          key={i}
          data-m={k}
          className={cn(
            'rounded-[2px] px-px text-foreground',
            k === curMatch ? 'bg-primary/60 ring-1 ring-primary' : 'bg-primary/25'
          )}
        >
          {seg.text}
        </mark>
      );
    });
  }, [search, curMatch]);

  useEffect(() => {
    const box = viewerRef.current;
    if (!box || !search || search.highlighted === 0) return;
    const el = box.querySelector<HTMLElement>(`[data-m="${curMatch}"]`);
    if (!el) return;
    box.scrollTop = Math.max(0, el.offsetTop - box.clientHeight / 2);
  }, [curMatch, search]);

  const stepMatch = (dir: 1 | -1) => {
    if (!search || search.highlighted === 0) return;
    setMatchIdx((curMatch + dir + search.highlighted) % search.highlighted);
  };

  const pageNumbers = processed.map((p) => p.page);
  const viewIdx = view === 'all' ? -1 : pageNumbers.indexOf(view);
  const stepPage = (dir: 1 | -1) => {
    if (pageNumbers.length === 0) return;
    if (view === 'all') {
      setView(pageNumbers[dir === 1 ? 0 : pageNumbers.length - 1] ?? 'all');
      return;
    }
    const n = pageNumbers[viewIdx + dir];
    setView(n ?? 'all');
  };

  const dlName = view === 'all' ? `${baseName(file?.name ?? 'document')}.txt` : `${baseName(file?.name ?? 'document')}-page-${view}.txt`;
  const matchPages = [...perPage.keys()];

  return (
    <div className="flex flex-col gap-3">
      <FileDropzone
        onFiles={(f) => void onFiles(f)}
        accept="application/pdf,.pdf"
        label={file ? file.name : 'Drop a PDF'}
        hint={
          loading
            ? 'reading…'
            : file
              ? `${formatBytes(file.size)}${pages ? ` · ${pages.length} page${pages.length === 1 ? '' : 's'} extracted` : ''} · drop another to replace`
              : 'click to browse · nothing leaves your browser'
        }
        compact={!!file}
        disabled={loading}
      />

      <ErrorBanner error={error} />

      {needsPassword && (
        <Panel>
          <PanelHeader title="Password required" />
          <form
            className="flex flex-wrap items-end gap-3 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void unlock();
            }}
          >
            <Lock className="mb-2 size-4 text-muted-foreground" />
            <Field
              label="Password"
              hint="This PDF is encrypted. The password stays in this tab — it is never stored or sent anywhere."
              className="min-w-[240px] flex-1"
            >
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                autoFocus
                aria-label="PDF password"
              />
            </Field>
            <Button type="submit" size="sm" disabled={unlocking || password.length === 0}>
              {unlocking && <Loader2 className="size-3.5 animate-spin" />}
              Unlock &amp; extract
            </Button>
          </form>
          {pwError && <div className="border-t px-3 py-2 text-xs text-destructive">{pwError}</div>}
        </Panel>
      )}

      {note && <p className="text-2xs text-muted-foreground">{note}</p>}

      {workBytes && (
        <>
          <OptionsBar>
            <Field label="Pages" hint="blank = all · e.g. 1,3-5" className="w-44">
              <Input
                value={spec}
                onChange={(e) => onSpecChange(e.target.value)}
                className="font-mono"
                placeholder="all pages"
                spellCheck={false}
                aria-label="Page range"
              />
            </Field>
            <Field label="Page separators">
              <div className="flex h-8 items-center gap-2">
                <Switch checked={separators} onCheckedChange={setSeparators} aria-label="Page separators" />
                <span className="font-mono text-2xs text-muted-foreground">--- Page N ---</span>
              </div>
            </Field>
            <Field label="Reflow paragraphs">
              <div className="flex h-8 items-center gap-2">
                <Switch checked={reflow} onCheckedChange={setReflow} aria-label="Reflow paragraphs" />
                <span className="text-2xs text-muted-foreground">join wrapped lines, fix exam-ple</span>
              </div>
            </Field>
            <Field label="Trim extra whitespace">
              <div className="flex h-8 items-center gap-2">
                <Switch checked={trim} onCheckedChange={setTrim} aria-label="Trim extra whitespace" />
              </div>
            </Field>
            {extracting && <Loader2 className="mb-2 size-4 animate-spin text-muted-foreground" />}
          </OptionsBar>

          {pages && allEmpty && (
            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
              <ScanLine className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div className="space-y-1 text-sm">
                <p className="font-medium">No text layer found — this looks like a scanned PDF. OCR isn&apos;t supported.</p>
                <p className="text-2xs text-muted-foreground">
                  {pages.length === 1 ? 'The page has' : `None of the ${pages.length} pages has`} extractable text —
                  it is probably an image or scan. Run the file through an OCR tool first, then extract its text here.
                </p>
              </div>
            </div>
          )}

          {pages && !allEmpty && (
            <Panel>
              <PanelHeader title="Extracted text">
                <CopyButton value={() => displayText} disabled={!displayText} />
                <DownloadButton
                  data={() => displayText}
                  filename={dlName}
                  mime="text/plain;charset=utf-8"
                  label="Download .txt"
                  variant="secondary"
                  disabled={!displayText}
                />
              </PanelHeader>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-2 py-2">
                <div className="flex items-center gap-1">
                  <Button size="icon-sm" variant="ghost" aria-label="Previous page" onClick={() => stepPage(-1)} disabled={view !== 'all' && viewIdx <= 0}>
                    <ChevronLeft className="size-3.5" />
                  </Button>
                  <Select value={String(view)} onValueChange={(v) => setView(v === 'all' ? 'all' : Number(v))}>
                    <SelectTrigger size="sm" className="w-[9.5rem]" aria-label="Page filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="all">All pages ({processed.length})</SelectItem>
                      {processed.map((p) => (
                        <SelectItem key={p.page} value={String(p.page)}>
                          Page {p.page}
                          {p.text.trim() ? '' : ' (no text)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Next page"
                    onClick={() => stepPage(1)}
                    disabled={view !== 'all' && viewIdx >= pageNumbers.length - 1}
                  >
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>

                <div className="flex min-w-[220px] flex-1 items-center gap-1.5">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setMatchIdx(0);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          stepMatch(e.shiftKey ? -1 : 1);
                        }
                      }}
                      placeholder="Search in text…"
                      className="h-7 pl-7 text-xs"
                      aria-label="Search in text"
                      spellCheck={false}
                    />
                  </div>
                  {search && (
                    <>
                      <span className="whitespace-nowrap font-mono text-2xs text-muted-foreground tabular" aria-live="polite">
                        {search.total === 0 ? 'no matches' : `${curMatch + 1} / ${search.total}`}
                      </span>
                      <Button size="icon-sm" variant="ghost" aria-label="Previous match" onClick={() => stepMatch(-1)} disabled={search.total === 0}>
                        <ChevronUp className="size-3.5" />
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label="Next match" onClick={() => stepMatch(1)} disabled={search.total === 0}>
                        <ChevronDown className="size-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {search && search.total > 0 && (
                <div className="border-b px-3 py-1 text-2xs text-muted-foreground">
                  {search.total} match{search.total === 1 ? '' : 'es'}
                  {matchPages.length > 0 && view === 'all' && ` on page${matchPages.length === 1 ? '' : 's'} ${compressPageList(matchPages)}`}
                  {search.total > search.highlighted && ` · highlighting the first ${search.highlighted}`}
                </div>
              )}

              {highlighted ? (
                <pre
                  ref={viewerRef}
                  data-testid="text-highlight"
                  className="relative m-0 h-[28rem] overflow-auto whitespace-pre-wrap break-words bg-background p-3 font-mono text-xs leading-relaxed"
                >
                  {highlighted}
                </pre>
              ) : (
                <Textarea
                  readOnly
                  value={displayText}
                  placeholder={view === 'all' ? '' : 'No text on this page.'}
                  spellCheck={false}
                  aria-label="Extracted text"
                  className="field-sizing-fixed h-[28rem] resize-y rounded-none border-0 font-mono text-xs leading-relaxed shadow-none focus-visible:ring-0"
                />
              )}

              <StatBar
                className="h-auto min-h-7 py-1"
                items={[
                  view === 'all'
                    ? `${processed.length} page${processed.length === 1 ? '' : 's'}${emptyPages.length ? ` (${processed.length - emptyPages.length} with text)` : ''}`
                    : `page ${view}`,
                  `${stats.words.toLocaleString('en-US')} words`,
                  `${stats.chars.toLocaleString('en-US')} characters`,
                ]}
              />
            </Panel>
          )}

          {pages && !allEmpty && emptyPages.length > 0 && (
            <p className="text-2xs text-muted-foreground">
              No text on page{emptyPages.length === 1 ? '' : 's'} {compressPageList(emptyPages)} — probably images or
              scans.
            </p>
          )}
        </>
      )}

      <p className="text-2xs text-muted-foreground">
        Reads the PDF&apos;s embedded text layer, in the order it is stored in the file, so multi-column layouts and
        tables can come out interleaved. Scanned pages have no text layer and OCR isn&apos;t supported. Reflow uses
        line-length heuristics; lists, headings and tabular lines keep their line breaks.
      </p>
    </div>
  );
}
