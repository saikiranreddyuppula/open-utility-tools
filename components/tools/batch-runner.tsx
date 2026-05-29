'use client';

import { useCallback, useRef, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, Download, Package, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { downloadFile, formatBytes } from '@/lib/download';
import { zipFiles } from '@/lib/zip';
import { cn } from '@/lib/utils';

export interface BatchOutput {
  blob: Blob;
  name: string;
}

export interface BatchItemState {
  file: File;
  status: 'queued' | 'running' | 'done' | 'error';
  ratio: number;
  output?: BatchOutput;
  error?: string;
}

export interface BatchRunnerProps {
  files: File[];
  /** Process one file → output. Report progress via onProgress (0..1). */
  process: (file: File, onProgress: (ratio: number | null) => void) => Promise<BatchOutput>;
  concurrency?: number;
  zipName?: string;
  onClear?: () => void;
}

/** Orchestrates processing many files with bounded concurrency, per-item progress,
 * individual + zip-all downloads. Pure client-side. */
export function BatchRunner({
  files,
  process,
  concurrency = 4,
  zipName = 'output.zip',
  onClear,
}: BatchRunnerProps) {
  const [items, setItems] = useState<BatchItemState[]>([]);
  const [running, setRunning] = useState(false);
  const [zipping, setZipping] = useState(false);
  const idRef = useRef(0);

  const run = useCallback(async () => {
    if (!files.length) return;
    setRunning(true);
    setItems(files.map((file) => ({ file, status: 'queued', ratio: 0 })));
    const myRun = ++idRef.current;

    const update = (i: number, patch: Partial<BatchItemState>) =>
      setItems((prev) => {
        if (idRef.current !== myRun) return prev;
        const next = [...prev];
        next[i] = { ...next[i]!, ...patch };
        return next;
      });

    let cursor = 0;
    const worker = async () => {
      while (cursor < files.length) {
        const i = cursor++;
        const file = files[i]!;
        update(i, { status: 'running', ratio: 0 });
        try {
          const output = await process(file, (r) => update(i, { ratio: r ?? 0 }));
          update(i, { status: 'done', ratio: 1, output });
        } catch (e) {
          update(i, { status: 'error', error: e instanceof Error ? e.message : String(e) });
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(concurrency, files.length) }, () => worker())
    );
    if (idRef.current === myRun) setRunning(false);
  }, [files, process, concurrency]);

  const zipAll = useCallback(async () => {
    const done = items.filter((it) => it.status === 'done' && it.output);
    if (!done.length) return;
    setZipping(true);
    try {
      const entries = await Promise.all(
        done.map(async (it) => ({
          name: it.output!.name,
          data: new Uint8Array(await it.output!.blob.arrayBuffer()),
        }))
      );
      const blob = await zipFiles(entries);
      await downloadFile(blob, zipName, 'application/zip');
    } finally {
      setZipping(false);
    }
  }, [items, zipName]);

  const doneCount = items.filter((it) => it.status === 'done').length;
  const errCount = items.filter((it) => it.status === 'error').length;
  const display: BatchItemState[] = items.length
    ? items
    : files.map((file) => ({ file, status: 'queued' as const, ratio: 0 }));

  return (
    <Panel>
      <PanelHeader title={`Batch · ${files.length} file${files.length === 1 ? '' : 's'}`}>
        <Button size="sm" onClick={run} disabled={running || !files.length}>
          {running ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {running ? 'Processing…' : 'Process all'}
        </Button>
        <Button size="sm" variant="secondary" onClick={zipAll} disabled={zipping || doneCount === 0}>
          {zipping ? <Loader2 className="size-3.5 animate-spin" /> : <Package className="size-3.5" />}
          Download .zip
        </Button>
        {onClear && (
          <Button size="icon-sm" variant="ghost" onClick={onClear} title="Clear">
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </PanelHeader>

      <div className="max-h-[420px] divide-y overflow-auto">
        {display.map((it, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2">
            <StatusIcon status={it.status} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs">{it.file.name}</p>
              <p className="font-mono text-2xs text-muted-foreground">
                {formatBytes(it.file.size)}
                {it.output ? ` → ${formatBytes(it.output.blob.size)}` : ''}
                {it.error ? ` · ${it.error}` : ''}
              </p>
              {it.status === 'running' && <Progress value={it.ratio * 100} className="mt-1 h-1" />}
            </div>
            {it.output && (
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => downloadFile(it.output!.blob, it.output!.name)}
                title="Download"
              >
                <Download className="size-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <StatBar
        items={[
          `${files.length} queued`,
          doneCount > 0 && `${doneCount} done`,
          errCount > 0 && `${errCount} error`,
        ]}
      />
    </Panel>
  );
}

function StatusIcon({ status }: { status: BatchItemState['status'] }) {
  return (
    <span className="shrink-0">
      {status === 'done' && <CheckCircle2 className="size-4 text-success" />}
      {status === 'error' && <XCircle className="size-4 text-destructive" />}
      {status === 'running' && <Loader2 className="size-4 animate-spin text-primary" />}
      {status === 'queued' && (
        <span className={cn('block size-2 rounded-full bg-muted-foreground/40')} />
      )}
    </span>
  );
}
