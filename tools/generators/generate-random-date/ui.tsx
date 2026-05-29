'use client';

import { useCallback, useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCw } from 'lucide-react';

type Format = 'iso' | 'iso-date' | 'locale' | 'unix-s' | 'unix-ms';

const webcrypto = (
  globalThis as unknown as {
    crypto: {
      getRandomValues<T extends ArrayBufferView>(a: T): T;
      randomUUID(): string;
    };
  }
).crypto;

function randomFloat(): number {
  const buf = new Uint32Array(1);
  webcrypto.getRandomValues(buf);
  // value in [0, 1)
  return (buf[0] ?? 0) / 0x100000000;
}

function randomEpoch(minMs: number, maxMs: number): number {
  const span = maxMs - minMs;
  return Math.floor(minMs + randomFloat() * (span + 1));
}

function formatDate(ms: number, fmt: Format): string {
  const d = new Date(ms);
  switch (fmt) {
    case 'iso':
      return d.toISOString();
    case 'iso-date':
      return d.toISOString().slice(0, 10);
    case 'locale':
      return d.toLocaleString();
    case 'unix-s':
      return String(Math.floor(ms / 1000));
    case 'unix-ms':
      return String(ms);
    default:
      return d.toISOString();
  }
}

export default function RandomDateGenerator() {
  const [start, setStart] = useState('2000-01-01');
  const [end, setEnd] = useState('2030-12-31');
  const [format, setFormat] = useState<Format>('iso');
  const [countRaw, setCountRaw] = useState('10');
  const [seed, setSeed] = useState(0);

  const { results, error } = useMemo(() => {
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    if (!Number.isFinite(startMs)) {
      return { results: [] as string[], error: 'Start date is not valid.' };
    }
    if (!Number.isFinite(endMs)) {
      return { results: [] as string[], error: 'End date is not valid.' };
    }
    if (startMs > endMs) {
      return { results: [] as string[], error: 'Start date must be before end date.' };
    }
    const count = Number(countRaw);
    if (!Number.isFinite(count) || count < 1) {
      return { results: [] as string[], error: 'Count must be at least 1.' };
    }
    const n = Math.min(Math.trunc(count), 1000);
    // include seed so regenerate produces fresh values
    void seed;
    const out: string[] = [];
    for (let i = 0; i < n; i += 1) {
      out.push(formatDate(randomEpoch(startMs, endMs), format));
    }
    return { results: out, error: null as string | null };
  }, [start, end, format, countRaw, seed]);

  const regenerate = useCallback(() => setSeed((s) => s + 1), []);

  const joined = useMemo(() => results.join('\n'), [results]);

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="Options" />
        <OptionsBar>
          <Field label="Start date">
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="End date">
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
          <Field label="Format">
            <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="iso">ISO 8601 (date + time)</SelectItem>
                <SelectItem value="iso-date">ISO date only</SelectItem>
                <SelectItem value="locale">Locale string</SelectItem>
                <SelectItem value="unix-s">Unix (seconds)</SelectItem>
                <SelectItem value="unix-ms">Unix (milliseconds)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="How many" hint="1-1000">
            <Input
              type="number"
              min={1}
              max={1000}
              value={countRaw}
              onChange={(e) => setCountRaw(e.target.value)}
            />
          </Field>
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      <Panel>
        <PanelHeader title="Random dates">
          <Button type="button" variant="outline" size="sm" onClick={regenerate}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Regenerate
          </Button>
          <CopyButton value={() => joined} />
          <DownloadButton data={joined} filename="random-dates.txt" />
        </PanelHeader>
        <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-sm">
          {results.length > 0 ? joined : 'No results.'}
        </pre>
        <StatBar items={[`${results.length} dates`, error ? false : `format: ${format}`]} />
      </Panel>
    </div>
  );
}
