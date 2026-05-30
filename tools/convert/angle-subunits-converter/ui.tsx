'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'dms2dec' | 'dec2dms';

interface Row {
  label: string;
  value: string;
}

function fmt(n: number, precision: number): string {
  if (!Number.isFinite(n)) return '—';
  const factor = 10 ** precision;
  const rounded = Math.round(n * factor) / factor;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  const fixed = normalized.toFixed(precision);
  if (precision === 0) return fixed;
  return fixed.replace(/\.?0+$/, '');
}

/**
 * Parse a DMS string into signed decimal degrees.
 * Accepts forms like: 40° 26' 46" N, -73 14 18, 40d26m46s, 40:26:46.
 */
function parseDms(input: string): { value: number; hemisphere: string | null } {
  let s = input.trim();
  if (s === '') throw new Error('Enter a DMS angle.');

  // Detect hemisphere letter at start or end.
  let hemisphere: string | null = null;
  const hemMatch = s.match(/([NSEWnsew])\s*$/) ?? s.match(/^\s*([NSEWnsew])/);
  if (hemMatch && hemMatch[1]) {
    hemisphere = hemMatch[1].toUpperCase();
    s = s.replace(/[NSEWnsew]/g, '').trim();
  }

  // Detect explicit leading sign.
  let sign = 1;
  if (s.startsWith('-')) {
    sign = -1;
    s = s.slice(1).trim();
  } else if (s.startsWith('+')) {
    s = s.slice(1).trim();
  }

  // Extract numeric components (degrees, minutes, seconds) in order.
  const nums = s.match(/\d+(?:\.\d+)?/g);
  if (!nums || nums.length === 0) throw new Error('Could not find any numbers in the DMS input.');

  const deg = Number(nums[0] ?? '0');
  const min = Number(nums[1] ?? '0');
  const sec = Number(nums[2] ?? '0');
  if (!Number.isFinite(deg) || !Number.isFinite(min) || !Number.isFinite(sec)) {
    throw new Error('Invalid number in DMS input.');
  }
  if (min >= 60) throw new Error('Minutes must be less than 60.');
  if (sec >= 60) throw new Error('Seconds must be less than 60.');

  let decimal = deg + min / 60 + sec / 3600;
  decimal *= sign;
  if (hemisphere === 'S' || hemisphere === 'W') decimal = -Math.abs(decimal);
  return { value: decimal, hemisphere };
}

/** Convert signed decimal degrees to a D M S breakdown. */
function toDms(decimal: number, secPrecision: number): { d: number; m: number; s: number; sign: number } {
  const sign = decimal < 0 ? -1 : 1;
  const abs = Math.abs(decimal);
  let d = Math.floor(abs);
  const minFloat = (abs - d) * 60;
  let m = Math.floor(minFloat);
  let sec = (minFloat - m) * 60;
  // Round seconds and carry overflow into minutes/degrees.
  const factor = 10 ** secPrecision;
  sec = Math.round(sec * factor) / factor;
  if (sec >= 60) {
    sec -= 60;
    m += 1;
  }
  if (m >= 60) {
    m -= 60;
    d += 1;
  }
  return { d, m, s: sec, sign };
}

export default function AngleSubunitsConverterTool() {
  const [mode, setMode] = useState<Mode>('dms2dec');
  const [dmsInput, setDmsInput] = useState('40° 26\' 46" N');
  const [decInput, setDecInput] = useState('40.446111');
  const [secPrecision, setSecPrecision] = useState(3);
  const [showHemisphere, setShowHemisphere] = useState(false);

  const result = useMemo((): { rows: Row[] } | { error: string } => {
    try {
      let decimal: number;
      let hemisphere: string | null = null;

      if (mode === 'dms2dec') {
        const parsed = parseDms(dmsInput);
        decimal = parsed.value;
        hemisphere = parsed.hemisphere;
      } else {
        const trimmed = decInput.trim();
        if (trimmed === '') throw new Error('Enter a decimal angle in degrees.');
        const v = Number(trimmed);
        if (!Number.isFinite(v)) throw new Error('Enter a valid decimal number.');
        decimal = v;
      }

      const dms = toDms(decimal, secPrecision);
      const radians = (decimal * Math.PI) / 180;
      const gradians = decimal * (200 / 180);
      const turns = decimal / 360;

      const secStr = fmt(dms.s, secPrecision);
      const signStr = dms.sign < 0 ? '-' : '';
      const dmsStr = `${signStr}${dms.d}° ${dms.m}' ${secStr}"`;

      const rows: Row[] = [];
      rows.push({ label: 'Decimal degrees', value: `${fmt(decimal, 8)}°` });
      rows.push({ label: 'DMS', value: dmsStr });
      if (showHemisphere || hemisphere) {
        rows.push({ label: 'DMS (hemisphere)', value: `${Math.abs(dms.d)}° ${dms.m}' ${secStr}" ${decimal < 0 ? 'S/W' : 'N/E'}` });
      }
      rows.push({ label: 'Radians', value: fmt(radians, 8) });
      rows.push({ label: 'Gradians', value: `${fmt(gradians, 6)} gon` });
      rows.push({ label: 'Turns', value: fmt(turns, 8) });
      return { rows };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [mode, dmsInput, decInput, secPrecision, showHemisphere]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Direction">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="dms2dec">DMS → Decimal</TabsTrigger>
                <TabsTrigger value="dec2dms">Decimal → DMS</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'dms2dec' ? (
            <Field label="DMS angle" className="min-w-[16rem] flex-1">
              <Input
                value={dmsInput}
                onChange={(e) => setDmsInput(e.target.value)}
                placeholder={'e.g. 40° 26\' 46" N'}
              />
            </Field>
          ) : (
            <Field label="Decimal degrees" className="min-w-[12rem] flex-1">
              <Input
                type="text"
                inputMode="decimal"
                value={decInput}
                onChange={(e) => setDecInput(e.target.value)}
                placeholder="e.g. 40.446111"
              />
            </Field>
          )}
          <Field
            label={`Seconds precision: ${secPrecision}`}
            hint="Decimal places"
            className="min-w-[10rem]"
          >
            <Slider
              min={0}
              max={6}
              step={1}
              value={[secPrecision]}
              onValueChange={(v) => setSecPrecision(v[0] ?? 3)}
            />
          </Field>
          <Field label="Hemisphere row" hint="N/S/E/W display">
            <Tabs
              value={showHemisphere ? 'on' : 'off'}
              onValueChange={(v) => setShowHemisphere(v === 'on')}
            >
              <TabsList>
                <TabsTrigger value="off">Off</TabsTrigger>
                <TabsTrigger value="on">On</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Results">
            <CopyButton value={() => result.rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {result.rows.map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span>{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar items={['Input degrees use D + M/60 + S/3600']} />
        </Panel>
      )}
    </div>
  );
}
