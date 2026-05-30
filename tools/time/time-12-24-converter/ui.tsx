'use client';

import { useMemo, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';

const SAMPLE = '2:30 PM\n14:30\n12:00 AM\n12:00 PM\n09:05:45\n11:59 pm';

interface Parsed {
  h: number; // 0-23
  m: number;
  s: number;
}

// Parse a single time line in either 12h or 24h format.
function parseTime(line: string): Parsed | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const ampmMatch = trimmed.match(/\b([AaPp])\.?[Mm]\.?\b/);
  const meridiem = ampmMatch && ampmMatch[1] ? ampmMatch[1].toUpperCase() : null;
  const timePart = trimmed.replace(/\b[AaPp]\.?[Mm]\.?\b/, '').trim();
  const segs = timePart.split(':');
  if (segs.length < 1 || segs.length > 3) return null;
  const hRaw = Number(segs[0]);
  const mRaw = segs[1] === undefined ? 0 : Number(segs[1]);
  const sRaw = segs[2] === undefined ? 0 : Number(segs[2]);
  if (!Number.isInteger(hRaw) || !Number.isInteger(mRaw) || !Number.isInteger(sRaw)) {
    return null;
  }
  if (mRaw < 0 || mRaw > 59 || sRaw < 0 || sRaw > 59) return null;

  let h = hRaw;
  if (meridiem) {
    if (hRaw < 1 || hRaw > 12) return null;
    if (meridiem === 'A') {
      h = hRaw === 12 ? 0 : hRaw;
    } else {
      h = hRaw === 12 ? 12 : hRaw + 12;
    }
  } else {
    if (hRaw < 0 || hRaw > 23) return null;
  }
  return { h, m: mRaw, s: sRaw };
}

function pad(n: number, width: number, on: boolean): string {
  return on ? n.toString().padStart(width, '0') : n.toString();
}

function to24(p: Parsed, padHour: boolean, showSec: boolean): string {
  const base = `${pad(p.h, 2, padHour)}:${p.m.toString().padStart(2, '0')}`;
  return showSec ? `${base}:${p.s.toString().padStart(2, '0')}` : base;
}

function to12(p: Parsed, showSec: boolean): string {
  const meridiem = p.h < 12 ? 'AM' : 'PM';
  let h12 = p.h % 12;
  if (h12 === 0) h12 = 12;
  const base = `${h12}:${p.m.toString().padStart(2, '0')}`;
  const full = showSec ? `${base}:${p.s.toString().padStart(2, '0')}` : base;
  return `${full} ${meridiem}`;
}

interface OutRow {
  input: string;
  ok: boolean;
  h24: string;
  h12: string;
}

export default function Time1224Converter() {
  const [input, setInput] = useState<string>(SAMPLE);
  const [padHour, setPadHour] = useState<boolean>(true);
  const [showSec, setShowSec] = useState<boolean>(false);

  const rows = useMemo<OutRow[]>(() => {
    return input
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((line) => {
        const parsed = parseTime(line);
        if (!parsed) {
          return { input: line.trim(), ok: false, h24: '—', h12: 'invalid' };
        }
        return {
          input: line.trim(),
          ok: true,
          h24: to24(parsed, padHour, showSec),
          h12: to12(parsed, showSec),
        };
      });
  }, [input, padHour, showSec]);

  const validCount = rows.filter((r) => r.ok).length;
  const copyAll = () =>
    rows.map((r) => `${r.input}\t${r.h24}\t${r.h12}`).join('\n');

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Times (one per line)" />
        <div className="p-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            className="min-h-[140px] font-mono"
            placeholder="2:30 PM&#10;14:30"
          />
        </div>
        <OptionsBar>
          <Field label="Pad hours">
            <Switch checked={padHour} onCheckedChange={setPadHour} />
          </Field>
          <Field label="Show seconds">
            <Switch checked={showSec} onCheckedChange={setShowSec} />
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Conversion">
          <CopyButton value={copyAll} />
        </PanelHeader>
        <div className="grid grid-cols-[1fr_1fr_1fr] gap-x-3 border-b bg-muted/40 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Input</span>
          <span>24-hour</span>
          <span>12-hour</span>
        </div>
        <div className="max-h-[380px] divide-y overflow-auto">
          {rows.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">
              Enter one or more times above.
            </div>
          ) : (
            rows.map((r, i) => (
              <div
                key={`${r.input}-${i}`}
                className="grid grid-cols-[1fr_1fr_1fr] items-center gap-x-3 px-3 py-2 font-mono text-sm"
              >
                <span className="truncate text-muted-foreground">{r.input}</span>
                <span className={r.ok ? '' : 'text-destructive'}>{r.h24}</span>
                <span className={r.ok ? '' : 'text-destructive'}>{r.h12}</span>
              </div>
            ))
          )}
        </div>
        <StatBar
          items={[
            `${rows.length} lines`,
            `${validCount} valid`,
            rows.length - validCount > 0 && `${rows.length - validCount} invalid`,
          ]}
        />
      </Panel>
    </div>
  );
}
