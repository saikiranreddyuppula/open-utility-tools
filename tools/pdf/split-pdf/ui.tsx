'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { pageCount, extractPages, deletePages } from '@/lib/wasm/pdf';
import { formatBytes } from '@/lib/download';

export default function SplitPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [spec, setSpec] = useState('1');
  const [mode, setMode] = useState<'extract' | 'delete'>('extract');
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    setResult(null);
    setError(null);
    (async () => {
      try {
        const buf = new Uint8Array(await file.arrayBuffer());
        setPages(await pageCount(buf));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [file]);

  const run = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const out = mode === 'extract' ? await extractPages(buf, spec) : await deletePages(buf, spec);
      setResult(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [file, spec, mode]);

  return (
    <div className="flex flex-col gap-3">
      <FileDropzone
        onFiles={(f) => setFile(f[0] ?? null)}
        accept="application/pdf,.pdf"
        label={file ? file.name : 'Drop a PDF'}
        hint={pages != null ? `${pages} pages · ${formatBytes(file?.size ?? 0)}` : 'click to browse'}
        compact={!!file}
      />

      {error && <ErrorBanner error={error} />}

      {file && (
        <>
          <OptionsBar>
            <Field label="Action">
              <Tabs value={mode} onValueChange={(v) => setMode(v as 'extract' | 'delete')}>
                <TabsList>
                  <TabsTrigger value="extract">Keep pages</TabsTrigger>
                  <TabsTrigger value="delete">Delete pages</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
            <Field label="Pages" hint="e.g. 1,3,5-8" className="flex-1">
              <Input value={spec} onChange={(e) => setSpec(e.target.value)} className="font-mono" placeholder="1,3,5-8" />
            </Field>
            <div className="flex items-end">
              <Button size="sm" onClick={run} disabled={busy}>
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Apply
              </Button>
            </div>
          </OptionsBar>

          {result && (
            <Panel>
              <PanelHeader title="Result">
                <DownloadButton
                  data={() => result}
                  filename={mode === 'extract' ? 'extracted.pdf' : 'trimmed.pdf'}
                  mime="application/pdf"
                  label="Download PDF"
                  variant="secondary"
                />
              </PanelHeader>
              <StatBar items={[`output: ${formatBytes(result.length)}`]} />
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
