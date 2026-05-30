'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type DelimKey = 'comma' | 'tab' | 'semicolon' | 'pipe';
type Position = 'first' | 'last';

const DELIMS: Record<DelimKey, string> = { comma: ',', tab: '\t', semicolon: ';', pipe: '|' };

const SAMPLE = `name,city
Ada,London
Grace,New York
Alan,Manchester`;

function parseCSV(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += char;
    } else if (char === '"') inQuotes = true;
    else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function serializeField(field: string, delimiter: string): string {
  if (
    field.includes(delimiter) ||
    field.includes('"') ||
    field.includes('\n') ||
    field.includes('\r')
  ) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export default function CsvAddRowNumbers() {
  const [colName, setColName] = useState('id');
  const [position, setPosition] = useState<Position>('first');
  const [start, setStart] = useState('1');
  const [step, setStep] = useState('1');
  const [padWidth, setPadWidth] = useState('0');
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [hasHeader, setHasHeader] = useState(true);
  const [delim, setDelim] = useState<DelimKey>('comma');

  return (
    <TextToolLayout
      deps={[colName, position, start, step, padWidth, prefix, suffix, hasHeader, delim]}
      sample={SAMPLE}
      inputLabel="CSV"
      outputLabel="Numbered CSV"
      downloadName="numbered.csv"
      downloadMime="text/csv"
      transform={(input) => {
        if (!input.trim()) return '';
        const d = DELIMS[delim];
        const rows = parseCSV(input, d);
        if (rows.length === 0) return '';

        const startN = Number(start);
        const stepN = Number(step);
        if (!Number.isFinite(startN)) throw new Error('Start value must be a number.');
        if (!Number.isFinite(stepN)) throw new Error('Step value must be a number.');
        const pad = Math.max(0, Math.min(Number(padWidth) || 0, 20));

        const format = (n: number): string => {
          let body = Math.trunc(n).toString();
          const neg = body.startsWith('-');
          if (neg) body = body.slice(1);
          if (pad > 0) body = body.padStart(pad, '0');
          return `${prefix}${neg ? '-' : ''}${body}${suffix}`;
        };

        const out: string[] = [];
        let dataIndex = 0;
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;
          let value: string;
          if (hasHeader && i === 0) {
            value = colName;
          } else {
            value = format(startN + dataIndex * stepN);
            dataIndex++;
          }
          const cells = position === 'first' ? [value, ...row] : [...row, value];
          out.push(cells.map((c) => serializeField(c, d)).join(d));
        }
        return out.join('\n');
      }}
      options={
        <>
          <Field label="New column name">
            <Input value={colName} onChange={(e) => setColName(e.target.value)} className="w-32" />
          </Field>
          <Field label="Position">
            <Select value={position} onValueChange={(v) => setPosition(v as Position)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="first">First column</SelectItem>
                <SelectItem value="last">Last column</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Start">
            <Input value={start} onChange={(e) => setStart(e.target.value)} inputMode="numeric" className="w-20 font-mono" />
          </Field>
          <Field label="Step">
            <Input value={step} onChange={(e) => setStep(e.target.value)} inputMode="numeric" className="w-20 font-mono" />
          </Field>
          <Field label="Zero-pad width" hint="0 = none">
            <Input value={padWidth} onChange={(e) => setPadWidth(e.target.value)} inputMode="numeric" className="w-20 font-mono" />
          </Field>
          <Field label="Prefix">
            <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="ROW-" className="w-24 font-mono" />
          </Field>
          <Field label="Suffix">
            <Input value={suffix} onChange={(e) => setSuffix(e.target.value)} className="w-20 font-mono" />
          </Field>
          <Field label="Delimiter">
            <Select value={delim} onValueChange={(v) => setDelim(v as DelimKey)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comma">Comma</SelectItem>
                <SelectItem value="tab">Tab</SelectItem>
                <SelectItem value="semicolon">Semicolon</SelectItem>
                <SelectItem value="pipe">Pipe</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="First row is header">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={hasHeader} onCheckedChange={setHasHeader} />
              <Label className="text-xs text-muted-foreground">header row</Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
