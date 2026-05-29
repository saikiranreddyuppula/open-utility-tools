'use client';

import { useCallback, useState } from 'react';
import { ArrowUp, ArrowDown, X, Loader2, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { mergePdfs } from '@/lib/wasm/pdf';
import { formatBytes } from '@/lib/download';

interface Item {
  file: File;
  id: string;
}

export default function MergePdfTool() {
  const [items, setItems] = useState<Item[]>([]);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = useCallback((files: File[]) => {
    setResult(null);
    setItems((prev) => [
      ...prev,
      ...files
        .filter((f) => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf')
        .map((file, i) => ({ file, id: `${Date.now()}-${i}-${file.name}` })),
    ]);
  }, []);

  const move = (i: number, dir: -1 | 1) =>
    setItems((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const remove = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id));

  const merge = useCallback(async () => {
    if (items.length < 2) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const bufs = await Promise.all(items.map(async (it) => new Uint8Array(await it.file.arrayBuffer())));
      setResult(await mergePdfs(bufs));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [items]);

  return (
    <div className="flex flex-col gap-3">
      <FileDropzone
        onFiles={addFiles}
        accept="application/pdf,.pdf"
        multiple
        label="Drop PDF files"
        hint="add two or more · reorder below"
        compact={items.length > 0}
      />

      {error && <ErrorBanner error={error} />}

      {items.length > 0 && (
        <Panel>
          <PanelHeader title={`${items.length} PDF${items.length === 1 ? '' : 's'}`}>
            <Button size="sm" onClick={merge} disabled={busy || items.length < 2}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Merge
            </Button>
            {result && (
              <DownloadButton data={() => result} filename="merged.pdf" mime="application/pdf" label="Download" variant="secondary" />
            )}
          </PanelHeader>
          <div className="divide-y">
            {items.map((it, i) => (
              <div key={it.id} className="flex items-center gap-2 px-3 py-2">
                <span className="w-6 text-right font-mono text-2xs text-muted-foreground tabular">{i + 1}</span>
                <FileText className="size-4 shrink-0 text-cat-pdf" />
                <span className="min-w-0 flex-1 truncate text-xs">{it.file.name}</span>
                <span className="font-mono text-2xs text-muted-foreground">{formatBytes(it.file.size)}</span>
                <Button size="icon-sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === items.length - 1}>
                  <ArrowDown className="size-3.5" />
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={() => remove(it.id)}>
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <StatBar items={[result ? `merged: ${formatBytes(result.length)}` : `${items.length} files queued`]} />
        </Panel>
      )}
    </div>
  );
}
