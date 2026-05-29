'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ClipboardPaste, Eraser, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Panel, PanelHeader, OptionsBar, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { cn } from '@/lib/utils';

/** Result of a transform: a string output, or throw for an error. */
export type TransformFn = (input: string) => string | Promise<string>;

export interface TextToolLayoutProps {
  /** Pure transform from input → output. Throw to surface an error banner. */
  transform: TransformFn;
  /** Extra reactive dependencies (e.g. options) that should re-run transform. */
  deps?: unknown[];
  options?: ReactNode;
  inputLabel?: string;
  outputLabel?: string;
  inputPlaceholder?: string;
  /** A one-click sample input. */
  sample?: string;
  /** File types to accept for "Upload" (read as UTF-8 text). */
  accept?: string;
  /** Download filename for the output. */
  downloadName?: string;
  downloadMime?: string;
  /** Monospace output (default true). */
  mono?: boolean;
  /** Read-only single-column variant (no input) for generators handled elsewhere. */
  minRows?: number;
  className?: string;
}

const enc = new TextEncoder();

function stats(text: string): string {
  const chars = text.length;
  const bytes = enc.encode(text).length;
  const lines = text ? text.split('\n').length : 0;
  return `${chars.toLocaleString()} chars · ${bytes.toLocaleString()} bytes · ${lines.toLocaleString()} lines`;
}

export function TextToolLayout({
  transform,
  deps = [],
  options,
  inputLabel = 'Input',
  outputLabel = 'Output',
  inputPlaceholder = 'Paste or type here…',
  sample,
  accept = 'text/*',
  downloadName = 'output.txt',
  downloadMime = 'text/plain',
  mono = true,
  minRows = 12,
  className,
}: TextToolLayoutProps) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const runId = useRef(0);

  const run = useCallback(
    async (value: string) => {
      const id = ++runId.current;
      const t0 = performance.now();
      try {
        const result = await transform(value);
        if (id !== runId.current) return; // stale
        setOutput(result);
        setError(null);
      } catch (e) {
        if (id !== runId.current) return;
        setOutput('');
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (id === runId.current) setElapsed(performance.now() - t0);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transform, ...deps]
  );

  useEffect(() => {
    void run(input);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, run]);

  const onUpload = useCallback(async (file: File) => {
    const text = await file.text();
    setInput(text);
  }, []);

  const uploadRef = useRef<HTMLInputElement>(null);

  const minHeight = useMemo(() => ({ minHeight: `${minRows * 1.25}rem` }), [minRows]);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {options && <OptionsBar>{options}</OptionsBar>}

      <div className="grid gap-3 lg:grid-cols-2">
        {/* INPUT */}
        <Panel>
          <PanelHeader title={inputLabel}>
            {sample && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInput(sample)}
                title="Load sample input"
              >
                Sample
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  setInput(await navigator.clipboard.readText());
                } catch {
                  /* clipboard blocked */
                }
              }}
              title="Paste from clipboard"
            >
              <ClipboardPaste className="size-3.5" />
              Paste
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => uploadRef.current?.click()}
              title="Upload a text file"
            >
              <Upload className="size-3.5" />
              Upload
            </Button>
            <input
              ref={uploadRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUpload(f);
                e.target.value = '';
              }}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setInput('')}
              disabled={!input}
              title="Clear input"
            >
              <Eraser className="size-3.5" />
            </Button>
          </PanelHeader>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={inputPlaceholder}
            spellCheck={false}
            style={minHeight}
            className={cn(
              'resize-y rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent',
              mono && 'font-mono'
            )}
          />
          <StatBar items={[stats(input)]} />
        </Panel>

        {/* OUTPUT */}
        <Panel>
          <PanelHeader title={outputLabel}>
            <CopyButton value={() => output} disabled={!output} />
            <DownloadButton
              data={() => output}
              filename={downloadName}
              mime={downloadMime}
              disabled={!output}
              label="Download"
            />
          </PanelHeader>
          <div className="relative flex-1">
            {error ? (
              <div className="p-3">
                <ErrorBanner error={error} />
              </div>
            ) : (
              <Textarea
                value={output}
                readOnly
                placeholder="Result appears here…"
                spellCheck={false}
                style={minHeight}
                className={cn(
                  'resize-y rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent',
                  mono && 'font-mono'
                )}
              />
            )}
          </div>
          <StatBar
            items={[
              stats(output),
              elapsed != null && `${elapsed < 1 ? '<1' : Math.round(elapsed)}ms`,
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}
