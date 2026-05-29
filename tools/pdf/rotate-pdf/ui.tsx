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
import { pageCount, rotatePages } from '@/lib/wasm/pdf';
import { formatBytes } from '@/lib/download';

export default function RotatePdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [spec, setSpec] = useState('');
  const [deg, setDeg] = useState('90');
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    setResult(null);
    setError(null);
    (async () => {
      try {
        setPages(await pageCount(new Uint8Array(await file.arrayBuffer())));
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
      setResult(await rotatePages(buf, spec, Number(deg)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [file, spec, deg]);

  return (
    <div className="flex flex-col gap-3">
      <FileDropzone
        onFiles={(f) => setFile(f[0] ?? null)}
        accept="application/pdf,.pdf"
        label={file ? file.name : 'Drop a PDF'}
        hint={pages != null ? `${pages} pages` : 'click to browse'}
        compact={!!file}
      />

      {error && <ErrorBanner error={error} />}

      {file && (
        <>
          <OptionsBar>
            <Field label="Rotate by">
              <Tabs value={deg} onValueChange={setDeg}>
                <TabsList>
                  <TabsTrigger value="90">90°</TabsTrigger>
                  <TabsTrigger value="180">180°</TabsTrigger>
                  <TabsTrigger value="270">270°</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
            <Field label="Pages" hint="blank = all" className="flex-1">
              <Input value={spec} onChange={(e) => setSpec(e.target.value)} className="font-mono" placeholder="all pages" />
            </Field>
            <div className="flex items-end">
              <Button size="sm" onClick={run} disabled={busy}>
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Rotate
              </Button>
            </div>
          </OptionsBar>

          {result && (
            <Panel>
              <PanelHeader title="Result">
                <DownloadButton data={() => result} filename="rotated.pdf" mime="application/pdf" label="Download PDF" variant="secondary" />
              </PanelHeader>
              <StatBar items={[`output: ${formatBytes(result.length)}`]} />
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
