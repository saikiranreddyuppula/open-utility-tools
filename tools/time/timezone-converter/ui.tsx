'use client';

import { useMemo, useState } from 'react';
import { X, Plus } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';

const ZONES = [
  'UTC', 'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
  'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland',
];

function localInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TimezoneConverterTool() {
  const [dt, setDt] = useState(() => localInput(new Date()));
  const [sourceZone, setSourceZone] = useState('UTC');
  const [zones, setZones] = useState(['America/New_York', 'Europe/London', 'Asia/Tokyo']);

  // Interpret the entered wall-clock time as being in sourceZone, get the instant.
  const instant = useMemo(() => {
    if (!dt) return null;
    // Parse the local-style string as if in sourceZone by computing the offset.
    const naive = new Date(dt);
    if (isNaN(naive.getTime())) return null;
    // Find what UTC instant shows this wall time in sourceZone.
    const asUtc = new Date(naive.toLocaleString('en-US', { timeZone: 'UTC' }));
    const asZone = new Date(naive.toLocaleString('en-US', { timeZone: sourceZone }));
    const offset = asUtc.getTime() - asZone.getTime();
    return new Date(naive.getTime() + offset);
  }, [dt, sourceZone]);

  const fmt = (zone: string) => {
    if (!instant) return '—';
    try {
      return instant.toLocaleString('en-US', {
        timeZone: zone,
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return 'invalid zone';
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Date & time">
          <Input type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} className="font-mono" />
        </Field>
        <Field label="Source timezone">
          <Select value={sourceZone} onValueChange={setSourceZone}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ZONES.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Converted times">
          <Select value="" onValueChange={(z) => z && setZones((p) => (p.includes(z) ? p : [...p, z]))}>
            <SelectTrigger className="h-7 w-32"><span className="flex items-center gap-1 text-xs"><Plus className="size-3" /> Add zone</span></SelectTrigger>
            <SelectContent>
              {ZONES.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
            </SelectContent>
          </Select>
        </PanelHeader>
        <div className="divide-y">
          {zones.map((z) => (
            <div key={z} className="flex items-center gap-3 px-3 py-2">
              <span className="w-44 shrink-0 font-mono text-xs">{z}</span>
              <span className="min-w-0 flex-1 font-mono text-sm">{fmt(z)}</span>
              <Button size="icon-sm" variant="ghost" onClick={() => setZones((p) => p.filter((x) => x !== z))}>
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
