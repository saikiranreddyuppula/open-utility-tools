'use client';

import { useCallback, useState } from 'react';

import { Panel, PanelHeader } from '@/components/tools/panel';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { readMetadata } from '@/lib/wasm/pdf';

export default function PdfMetadataTool() {
  const [name, setName] = useState('');
  const [meta, setMeta] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onFiles = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setName(file.name);
    setError(null);
    setMeta('');
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      setMeta(await readMetadata(buf));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const rows = meta
    ? meta.split('\n').map((line) => {
        const idx = line.indexOf(':');
        return idx === -1 ? [line, ''] : [line.slice(0, idx), line.slice(idx + 1).trim()];
      })
    : [];

  return (
    <div className="flex flex-col gap-3">
      <FileDropzone
        onFiles={onFiles}
        accept="application/pdf,.pdf"
        label={name || 'Drop a PDF'}
        hint="inspect metadata locally"
        compact={!!meta}
      />

      {error && <ErrorBanner error={error} />}

      {meta && (
        <Panel>
          <PanelHeader title="Metadata">
            <CopyButton value={meta} size="icon-sm" />
          </PanelHeader>
          <div className="divide-y">
            {rows.map(([k, v], i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-2">
                <span className="w-32 shrink-0 font-mono text-2xs font-medium text-muted-foreground">{k}</span>
                <code className="min-w-0 flex-1 break-all font-mono text-xs">{v || '—'}</code>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
