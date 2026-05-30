'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Which = 'nil' | 'max' | 'both';
type Wrap = 'plain' | 'braces' | 'urn';

interface Sentinel {
  key: 'nil' | 'max';
  label: string;
  hexByte: string;
  hex16: string;
  desc: string;
}

const SENTINELS: Sentinel[] = [
  {
    key: 'nil',
    label: 'Nil UUID',
    hexByte: '00',
    hex16: '00000000000000000000000000000000',
    desc: 'All-zero UUID used as a null/empty placeholder when no real UUID is available.',
  },
  {
    key: 'max',
    label: 'Max UUID',
    hexByte: 'ff',
    hex16: 'ffffffffffffffffffffffffffffffff',
    desc: 'All-one UUID (RFC 9562) used as the largest possible value, e.g. an exclusive upper bound in range queries.',
  },
];

function canonical(byte: string, hyphens: boolean): string {
  const full = byte.repeat(16);
  if (!hyphens) return full;
  return `${full.slice(0, 8)}-${full.slice(8, 12)}-${full.slice(12, 16)}-${full.slice(16, 20)}-${full.slice(20, 32)}`;
}

function format(byte: string, upper: boolean, hyphens: boolean, wrap: Wrap): string {
  let value = canonical(byte, hyphens);
  if (upper) value = value.toUpperCase();
  if (wrap === 'braces') return `{${value}}`;
  if (wrap === 'urn') return `urn:uuid:${value}`;
  return value;
}

export default function UuidNilMaxGenerator() {
  const [which, setWhich] = useState<Which>('both');
  const [upper, setUpper] = useState(false);
  const [hyphens, setHyphens] = useState(true);
  const [wrap, setWrap] = useState<Wrap>('plain');

  const shown = useMemo(
    () => SENTINELS.filter((s) => which === 'both' || s.key === which),
    [which],
  );

  const copyAll = useMemo(
    () => shown.map((s) => format(s.hexByte, upper, hyphens, wrap)).join('\n'),
    [shown, upper, hyphens, wrap],
  );

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Options" />
        <OptionsBar>
          <Field label="Which">
            <Tabs value={which} onValueChange={(v) => setWhich(v as Which)}>
              <TabsList>
                <TabsTrigger value="nil">Nil</TabsTrigger>
                <TabsTrigger value="max">Max</TabsTrigger>
                <TabsTrigger value="both">Both</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Format">
            <Select value={wrap} onValueChange={(v) => setWrap(v as Wrap)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="plain">Plain</SelectItem>
                <SelectItem value="braces">{'{ braced }'}</SelectItem>
                <SelectItem value="urn">urn:uuid:</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Uppercase">
            <Switch checked={upper} onCheckedChange={setUpper} />
          </Field>
          <Field label="Hyphens">
            <Switch checked={hyphens} onCheckedChange={setHyphens} />
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Sentinel UUIDs">
          <CopyButton value={() => copyAll} label="Copy all" />
        </PanelHeader>
        <div className="space-y-3 p-3">
          {shown.map((s) => {
            const value = format(s.hexByte, upper, hyphens, wrap);
            return (
              <div key={s.key} className="rounded-md border bg-muted/30 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium">{s.label}</span>
                  <CopyButton value={value} size="icon-sm" />
                </div>
                <code className="block break-all font-mono text-sm">{value}</code>
                <div className="mt-2 text-xs text-muted-foreground">
                  Raw 16 bytes: <code className="font-mono">{s.hex16}</code>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{s.desc}</p>
              </div>
            );
          })}
        </div>
        <StatBar items={[`${shown.length} value${shown.length === 1 ? '' : 's'}`, 'constant, no randomness']} />
      </Panel>
    </div>
  );
}
