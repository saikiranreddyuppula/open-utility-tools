'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Direction = 'toDate' | 'toTimestamp';
type Unit = 'auto' | 's' | 'ms';
type DateZone = 'utc' | 'local';

const SAMPLE = `1700000000
1700000000000
1609459200
not-a-number
946684800`;

function pad(n: number, w = 2): string {
  return Math.abs(n).toString().padStart(w, '0');
}

function isoUTC(d: Date): string {
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`
  );
}

function isoLocal(d: Date): string {
  const offMin = -d.getTimezoneOffset();
  const sign = offMin >= 0 ? '+' : '-';
  const offH = pad(Math.floor(Math.abs(offMin) / 60));
  const offM = pad(Math.abs(offMin) % 60);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${offH}:${offM}`
  );
}

export default function TimestampBatchConverter() {
  const [direction, setDirection] = useState<Direction>('toDate');
  const [unit, setUnit] = useState<Unit>('auto');
  const [zone, setZone] = useState<DateZone>('utc');

  return (
    <TextToolLayout
      deps={[direction, unit, zone]}
      transform={(input) => {
        if (!input.trim()) return '';
        const lines = input.split('\n');
        const out: string[] = [];

        for (const raw of lines) {
          const line = raw.trim();
          if (line === '') {
            out.push('');
            continue;
          }

          if (direction === 'toDate') {
            const num = Number(line);
            if (!Number.isFinite(num)) {
              out.push(`${line}  ->  [unparseable]`);
              continue;
            }
            // Decide unit: auto treats >= 1e12 magnitude as milliseconds.
            let ms: number;
            if (unit === 's') ms = num * 1000;
            else if (unit === 'ms') ms = num;
            else ms = Math.abs(num) >= 1e12 ? num : num * 1000;

            const d = new Date(ms);
            if (Number.isNaN(d.getTime())) {
              out.push(`${line}  ->  [out of range]`);
              continue;
            }
            const rendered = zone === 'utc' ? isoUTC(d) : isoLocal(d);
            out.push(`${line}  ->  ${rendered}`);
          } else {
            // toTimestamp: parse a date string into epoch seconds + ms.
            const ms = Date.parse(line);
            if (Number.isNaN(ms)) {
              out.push(`${line}  ->  [unparseable date]`);
              continue;
            }
            const secs = Math.floor(ms / 1000);
            out.push(`${line}  ->  ${secs} s  |  ${ms} ms`);
          }
        }

        return out.join('\n');
      }}
      inputLabel={direction === 'toDate' ? 'Timestamps (one per line)' : 'Dates (one per line)'}
      outputLabel="Converted"
      sample={SAMPLE}
      downloadName="timestamps-converted.txt"
      options={
        <>
          <Field label="Direction">
            <Tabs
              value={direction}
              onValueChange={(v) => setDirection(v as Direction)}
            >
              <TabsList>
                <TabsTrigger value="toDate">Timestamp to date</TabsTrigger>
                <TabsTrigger value="toTimestamp">Date to timestamp</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {direction === 'toDate' ? (
            <Field label="Input unit">
              <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-detect</SelectItem>
                  <SelectItem value="s">Seconds</SelectItem>
                  <SelectItem value="ms">Milliseconds</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          {direction === 'toDate' ? (
            <Field label="Output zone">
              <Tabs value={zone} onValueChange={(v) => setZone(v as DateZone)}>
                <TabsList>
                  <TabsTrigger value="utc">UTC</TabsTrigger>
                  <TabsTrigger value="local">Local</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
          ) : null}
        </>
      }
    />
  );
}
