'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';

interface Row {
  label: string;
  hint: string;
  value: () => string;
}

function pad(n: number, width: number): string {
  return Math.floor(n).toString().padStart(width, '0');
}

export default function UnixTimeNowTool() {
  const [now, setNow] = useState<number>(() => Date.now());
  const [paused, setPaused] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (paused) return;
    let active = true;
    const tick = () => {
      if (!active) return;
      setNow(Date.now());
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      active = false;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [paused]);

  const ms = now;
  const seconds = Math.floor(ms / 1000);
  // performance.now() gives sub-ms resolution; combine with epoch ms for an
  // approximate microsecond reading (the fractional ms is derived from perf time).
  const fractionalMs = (performance.now() % 1 + 1) % 1;
  const micros = seconds * 1_000_000 + (ms % 1000) * 1000 + Math.floor(fractionalMs * 1000);

  const rows: Row[] = [
    {
      label: 'Seconds',
      hint: 'Unix epoch (s)',
      value: () => seconds.toString(),
    },
    {
      label: 'Milliseconds',
      hint: 'Unix epoch (ms)',
      value: () => ms.toString(),
    },
    {
      label: 'Microseconds',
      hint: 'Unix epoch (µs, approx.)',
      value: () => micros.toString(),
    },
  ];

  const isoUtc = new Date(ms).toISOString();
  const local = new Date(ms).toLocaleString();

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <PanelHeader title="Current Unix timestamp">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPaused((p) => !p)}
            title={paused ? 'Resume live updates' : 'Freeze the clock'}
          >
            {paused ? (
              <>
                <Play className="size-3.5" /> Resume
              </>
            ) : (
              <>
                <Pause className="size-3.5" /> Pause
              </>
            )}
          </Button>
        </PanelHeader>
        <div className="divide-y">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center gap-3 px-3 py-3"
            >
              <div className="w-32 shrink-0">
                <div className="text-sm font-medium">{row.label}</div>
                <div className="text-2xs text-muted-foreground">{row.hint}</div>
              </div>
              <div className="flex-1 font-mono text-xl font-semibold tabular text-primary">
                {row.value()}
              </div>
              <CopyButton value={row.value} />
            </div>
          ))}
        </div>
        <StatBar
          items={[
            paused ? 'Paused' : 'Live',
            `UTC ${isoUtc}`,
            `Local ${local}`,
            `${pad(new Date(ms).getMilliseconds(), 3)} ms`,
          ]}
        />
      </Panel>
    </div>
  );
}
