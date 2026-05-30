'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Delim = 'comma' | 'semicolon' | 'tab' | 'pipe';

const DELIM_CHAR: Record<Delim, string> = {
  comma: ',',
  semicolon: ';',
  tab: '\t',
  pipe: '|',
};

const SAMPLE = `id,name,active,joined,note
1,"Ada Lovelace",true,1843-01-01,"first, programmer"
2,Linus,false,1991-08-25,"kernel
hacker"
3,Grace,true,1959-03-01,compiler`;

type Cell = string | number | boolean | null;

/** RFC-4180 style CSV parser: handles quoted fields, embedded delimiters/newlines, escaped quotes. */
function parseCsv(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < n) {
    const ch = text[i] ?? '';
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delim) {
      pushField();
      i++;
      continue;
    }
    if (ch === '\r') {
      // Treat \r\n and lone \r as a row break.
      if (text[i + 1] === '\n') i++;
      pushRow();
      i++;
      continue;
    }
    if (ch === '\n') {
      pushRow();
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // Flush trailing field/row if any content remains.
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }
  return rows;
}

function coerce(raw: string, emptyAsNull: boolean): Cell {
  if (raw === '') return emptyAsNull ? null : '';
  const low = raw.toLowerCase();
  if (low === 'true') return true;
  if (low === 'false') return false;
  if (low === 'null') return null;
  if (/^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(raw)) {
    const num = Number(raw);
    if (Number.isFinite(num)) return num;
  }
  return raw;
}

export default function CsvToJsonObjects() {
  const [delim, setDelim] = useState<Delim>('comma');
  const [coerceTypes, setCoerceTypes] = useState(true);
  const [trimVals, setTrimVals] = useState(true);
  const [emptyAsNull, setEmptyAsNull] = useState(false);

  return (
    <TextToolLayout
      deps={[delim, coerceTypes, trimVals, emptyAsNull]}
      sample={SAMPLE}
      inputLabel="CSV"
      outputLabel="JSON"
      downloadName="data.json"
      transform={(input) => {
        if (!input.trim()) return '';
        const rows = parseCsv(input, DELIM_CHAR[delim]).filter(
          (r) => !(r.length === 1 && (r[0] ?? '') === '')
        );
        if (rows.length === 0) throw new Error('No rows found.');
        const headerRow = rows[0];
        if (!headerRow) throw new Error('Missing header row.');
        const headers = headerRow.map((h, idx) => {
          const name = (trimVals ? h.trim() : h);
          return name || `column_${idx + 1}`;
        });

        const objects: Array<Record<string, Cell>> = [];
        for (let r = 1; r < rows.length; r++) {
          const cells = rows[r] ?? [];
          const obj: Record<string, Cell> = {};
          headers.forEach((key, ci) => {
            let val = cells[ci] ?? '';
            if (trimVals) val = val.trim();
            obj[key] = coerceTypes ? coerce(val, emptyAsNull) : (emptyAsNull && val === '' ? null : val);
          });
          objects.push(obj);
        }
        return JSON.stringify(objects, null, 2);
      }}
      options={
        <>
          <Field label="Delimiter">
            <Select value={delim} onValueChange={(v) => setDelim(v as Delim)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comma">Comma ,</SelectItem>
                <SelectItem value="semicolon">Semicolon ;</SelectItem>
                <SelectItem value="tab">Tab</SelectItem>
                <SelectItem value="pipe">Pipe |</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Coerce types">
            <div className="flex h-9 items-center">
              <Switch checked={coerceTypes} onCheckedChange={setCoerceTypes} />
            </div>
          </Field>
          <Field label="Trim values">
            <div className="flex h-9 items-center">
              <Switch checked={trimVals} onCheckedChange={setTrimVals} />
            </div>
          </Field>
          <Field label="Empty as null">
            <div className="flex h-9 items-center">
              <Switch checked={emptyAsNull} onCheckedChange={setEmptyAsNull} />
            </div>
          </Field>
        </>
      }
    />
  );
}
