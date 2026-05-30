'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Notation = 'colon' | 'hyphen' | 'cisco' | 'bare';
type Casing = 'upper' | 'lower';

const SAMPLE = ['AA:BB:CC:DD:EE:FF', '00-1A-2B-3C-4D-5E', '0011.2233.4455', '02aabbccddee'].join('\n');

function extractHex(line: string): string | null {
  const hex = line.replace(/[^0-9a-fA-F]/g, '');
  if (hex.length !== 12) return null;
  return hex.toLowerCase();
}

function formatHex(hex: string, notation: Notation, casing: Casing): string {
  const cased = casing === 'upper' ? hex.toUpperCase() : hex.toLowerCase();
  const bytes: string[] = [];
  for (let i = 0; i < 12; i += 2) bytes.push(cased.slice(i, i + 2));
  switch (notation) {
    case 'colon':
      return bytes.join(':');
    case 'hyphen':
      return bytes.join('-');
    case 'cisco': {
      const groups: string[] = [];
      for (let i = 0; i < cased.length; i += 4) groups.push(cased.slice(i, i + 4));
      return groups.join('.');
    }
    case 'bare':
      return cased;
    default:
      return cased;
  }
}

interface Decoded {
  input: string;
  formatted: string;
  oui: string;
  byte0: number;
  localAdmin: boolean;
  multicast: boolean;
}

interface ResultRow {
  input: string;
  ok: boolean;
  decoded?: Decoded;
}

const NOTATIONS: Array<{ value: Notation; label: string }> = [
  { value: 'colon', label: 'Colon  AA:BB:CC:DD:EE:FF' },
  { value: 'hyphen', label: 'Hyphen  AA-BB-CC-DD-EE-FF' },
  { value: 'cisco', label: 'Cisco dotted  aabb.ccdd.eeff' },
  { value: 'bare', label: 'Bare  AABBCCDDEEFF' },
];

export default function MacAddressFormatterTool() {
  const [input, setInput] = useState(SAMPLE);
  const [notation, setNotation] = useState<Notation>('colon');
  const [casing, setCasing] = useState<Casing>('upper');

  const rows = useMemo<ResultRow[]>(() => {
    const lines = input.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    return lines.map((line) => {
      const hex = extractHex(line);
      if (!hex) return { input: line, ok: false };
      const formatted = formatHex(hex, notation, casing);
      // OUI = first 3 bytes (vendor prefix), formatted in the chosen notation.
      const ouiBytes = hex.slice(0, 6);
      let ouiDisplay: string;
      if (notation === 'cisco') {
        ouiDisplay = (casing === 'upper' ? ouiBytes.toUpperCase() : ouiBytes);
      } else {
        const sep = notation === 'hyphen' ? '-' : notation === 'colon' ? ':' : '';
        const b = [ouiBytes.slice(0, 2), ouiBytes.slice(2, 4), ouiBytes.slice(4, 6)];
        ouiDisplay = (casing === 'upper' ? b.map((x) => x.toUpperCase()) : b).join(sep);
      }
      const byte0 = parseInt(hex.slice(0, 2), 16);
      return {
        input: line,
        ok: true,
        decoded: {
          input: line,
          formatted,
          oui: ouiDisplay,
          byte0,
          localAdmin: (byte0 & 0x02) !== 0,
          multicast: (byte0 & 0x01) !== 0,
        },
      };
    });
  }, [input, notation, casing]);

  const okRows = rows.filter((r) => r.ok && r.decoded);
  const allOut = okRows.map((r) => r.decoded?.formatted ?? '').join('\n');

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Output notation" className="min-w-[240px]">
            <Select value={notation} onValueChange={(v) => setNotation(v as Notation)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTATIONS.map((n) => (
                  <SelectItem key={n.value} value={n.value}>
                    {n.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Case">
            <Tabs value={casing} onValueChange={(v) => setCasing(v as Casing)}>
              <TabsList>
                <TabsTrigger value="upper">UPPER</TabsTrigger>
                <TabsTrigger value="lower">lower</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="MAC addresses (one per line)">
          <button
            className="rounded px-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setInput(SAMPLE)}
          >
            Sample
          </button>
        </PanelHeader>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="AA:BB:CC:DD:EE:FF"
          spellCheck={false}
          className="min-h-28 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      <Panel>
        <PanelHeader title="Result">
          <CopyButton value={() => allOut} size="icon-sm" />
        </PanelHeader>
        <div className="divide-y">
          {rows.length === 0 && (
            <p className="px-3 py-3 text-sm text-muted-foreground">Enter one MAC address per line.</p>
          )}
          {rows.map((r, i) =>
            r.ok && r.decoded ? (
              <div key={i} className="flex flex-col gap-1.5 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <code className="font-mono text-sm font-semibold">{r.decoded.formatted}</code>
                  <CopyButton value={r.decoded.formatted} size="icon-sm" />
                </div>
                <div className="flex flex-wrap gap-1.5 text-2xs">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono">OUI {r.decoded.oui}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
                    byte0 0x{r.decoded.byte0.toString(16).padStart(2, '0')}
                  </span>
                  <span
                    className={
                      'rounded px-1.5 py-0.5 ' +
                      (r.decoded.localAdmin ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-muted')
                    }
                  >
                    {r.decoded.localAdmin ? 'locally administered' : 'globally unique (UAA)'}
                  </span>
                  <span
                    className={
                      'rounded px-1.5 py-0.5 ' +
                      (r.decoded.multicast ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' : 'bg-muted')
                    }
                  >
                    {r.decoded.multicast ? 'multicast' : 'unicast'}
                  </span>
                </div>
              </div>
            ) : (
              <div key={i} className="flex items-center gap-2 px-3 py-2.5">
                <code className="font-mono text-xs text-muted-foreground line-through">{r.input}</code>
                <span className="text-2xs text-destructive">invalid — need 48 bits (12 hex digits)</span>
              </div>
            )
          )}
        </div>
        <StatBar items={[`${okRows.length} valid`, `${rows.length - okRows.length} invalid`]} />
      </Panel>
    </div>
  );
}
