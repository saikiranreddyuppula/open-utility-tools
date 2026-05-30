'use client';

import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const WORKER_BITS = 10n;
const SEQ_BITS = 12n;
const MAX_WORKER = (1n << WORKER_BITS) - 1n; // 1023
const MAX_SEQ = (1n << SEQ_BITS) - 1n; // 4095
const TWITTER_EPOCH_MS = 1288834974657; // 2010-11-04T01:42:54.657Z

/** datetime-local string in local time -> default value. */
function defaultEpochLocal(): string {
  const d = new Date(TWITTER_EPOCH_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SnowflakeIdGenerator() {
  const [epochStr, setEpochStr] = useState(defaultEpochLocal());
  const [worker, setWorker] = useState('1');
  const [startSeq, setStartSeq] = useState('0');
  const [count, setCount] = useState('10');
  const [seed, setSeed] = useState(0);
  const [decodeInput, setDecodeInput] = useState('');

  const epochMs = useMemo(() => {
    const ms = Date.parse(epochStr);
    return Number.isFinite(ms) ? ms : TWITTER_EPOCH_MS;
  }, [epochStr]);

  const generated = useMemo(() => {
    void seed;
    const w = Math.round(Number(worker) || 0);
    if (!Number.isFinite(w) || w < 0 || w > 1023) {
      return { error: 'Worker ID must be 0–1023.' };
    }
    const s0n = BigInt(Math.max(0, Math.round(Number(startSeq) || 0)));
    if (s0n > MAX_SEQ) return { error: 'Starting sequence must be 0–4095.' };
    const n = Math.min(500, Math.max(1, Math.round(Number(count) || 1)));

    const workerN = BigInt(w);
    const epochN = BigInt(Math.round(epochMs));
    const baseTime = Date.now();

    const ids: string[] = [];
    let lastTs = -1n;
    let seq = s0n;
    for (let i = 0; i < n; i += 1) {
      // Emulate sequential generation: advance the timestamp once per 4096 IDs
      // so large counts that overflow the 12-bit sequence still produce
      // monotonically increasing, unique IDs.
      let nowN = BigInt(baseTime) + BigInt(Math.floor(i / 4096));
      if (nowN === lastTs) {
        seq = (seq + 1n) & MAX_SEQ;
        if (seq === 0n) {
          nowN += 1n;
        }
      } else if (nowN > lastTs) {
        // first id at a new ms keeps the chosen starting sequence
        seq = i === 0 ? s0n : 0n;
      }
      lastTs = nowN;

      const tsPart = (nowN - epochN) << (WORKER_BITS + SEQ_BITS);
      const workerPart = workerN << SEQ_BITS;
      const id = tsPart | workerPart | seq;
      ids.push(id.toString());
    }
    return { ids };
  }, [worker, startSeq, count, epochMs, seed]);

  const decoded = useMemo(() => {
    const raw = decodeInput.trim();
    if (!raw) return null;
    if (!/^\d+$/.test(raw)) return { error: 'Enter a decimal Snowflake ID.' };
    let id: bigint;
    try {
      id = BigInt(raw);
    } catch {
      return { error: 'Invalid number.' };
    }
    const seq = id & MAX_SEQ;
    const workerId = (id >> SEQ_BITS) & MAX_WORKER;
    const tsOffset = id >> (WORKER_BITS + SEQ_BITS);
    const absMs = tsOffset + BigInt(Math.round(epochMs));
    const msNum = Number(absMs);
    let iso = '(out of range)';
    if (Number.isFinite(msNum) && Math.abs(msNum) < 8.64e15) {
      const d = new Date(msNum);
      if (!Number.isNaN(d.getTime())) iso = d.toISOString();
    }
    return {
      timestamp: `${absMs.toString()} ms (+${tsOffset.toString()} from epoch)`,
      iso,
      workerId: workerId.toString(),
      sequence: seq.toString(),
    };
  }, [decodeInput, epochMs]);

  const allText = 'ids' in generated && generated.ids ? generated.ids.join('\n') : '';

  return (
    <div className="flex flex-col gap-4">
      <OptionsBar>
        <Field label="Custom epoch">
          <Input
            type="datetime-local"
            value={epochStr}
            onChange={(e) => setEpochStr(e.target.value)}
            className="font-mono"
          />
        </Field>
        <Field label="Worker ID (0–1023)" className="w-32">
          <Input
            type="number"
            min={0}
            max={1023}
            value={worker}
            onChange={(e) => setWorker(e.target.value)}
            className="font-mono"
          />
        </Field>
        <Field label="Start seq (0–4095)" className="w-32">
          <Input
            type="number"
            min={0}
            max={4095}
            value={startSeq}
            onChange={(e) => setStartSeq(e.target.value)}
            className="font-mono"
          />
        </Field>
        <Field label="Count" className="w-24">
          <Input
            type="number"
            min={1}
            max={500}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="font-mono"
          />
        </Field>
        <div className="ml-auto flex items-end">
          <Button variant="secondary" size="sm" onClick={() => setSeed((s) => s + 1)}>
            <RefreshCw className="size-3.5" />
            Regenerate
          </Button>
        </div>
      </OptionsBar>

      {'error' in generated ? (
        <ErrorBanner error={generated.error} />
      ) : (
        <Panel>
          <PanelHeader title="Snowflake IDs">
            <CopyButton value={() => allText} label="Copy all" disabled={!allText} />
            <DownloadButton data={() => allText} filename="snowflake-ids.txt" disabled={!allText} />
          </PanelHeader>
          <div className="max-h-[360px] divide-y overflow-auto">
            {generated.ids.map((id, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-1.5">
                <span className="w-8 shrink-0 text-right font-mono text-2xs text-muted-foreground tabular">
                  {i + 1}
                </span>
                <code className="min-w-0 flex-1 truncate font-mono text-xs">{id}</code>
                <CopyButton value={id} size="icon-sm" />
              </div>
            ))}
          </div>
          <StatBar
            items={[
              `${generated.ids.length} generated`,
              `epoch: ${new Date(epochMs).toISOString()}`,
              '41-bit ts · 10-bit worker · 12-bit seq',
            ]}
          />
        </Panel>
      )}

      <Panel>
        <PanelHeader title="Decode an ID" />
        <div className="p-3">
          <Field label="Snowflake ID (decimal)">
            <Input
              value={decodeInput}
              onChange={(e) => setDecodeInput(e.target.value)}
              placeholder="Paste an ID to split into parts"
              className="font-mono"
            />
          </Field>
        </div>
        {decoded && 'error' in decoded && <ErrorBanner error={decoded.error} />}
        {decoded && !('error' in decoded) && (
          <div className="grid grid-cols-1 gap-3 p-3 pt-0 sm:grid-cols-2">
            {[
              { label: 'Timestamp', value: decoded.timestamp },
              { label: 'UTC time', value: decoded.iso },
              { label: 'Worker ID', value: decoded.workerId },
              { label: 'Sequence', value: decoded.sequence },
            ].map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="text-xs text-muted-foreground">{r.label}</span>
                <span className="flex items-center gap-2 font-mono text-xs">
                  <span className="truncate">{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
        )}
        <StatBar items={['Decode uses the custom epoch above']} />
      </Panel>
    </div>
  );
}
