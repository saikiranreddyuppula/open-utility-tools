'use client';

import { useCallback, useState } from 'react';

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

const SAMPLE = `id,name,active,score,notes
1,Ada,true,88.5,
2,Linus,false,54,kernel
3,Grace,true,,compiler`;

const DELIMS: Record<string, string> = {
  auto: 'Auto-detect',
  ',': 'Comma',
  ';': 'Semicolon',
  '\t': 'Tab',
  '|': 'Pipe',
};

type EmptyMode = 'null' | 'empty' | 'omit';

function parseLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] ?? '';
    if (inQuotes) {
      if (ch === '"') {
        const next = line[i + 1] ?? '';
        if (next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

// RFC4180-aware splitter that respects quoted newlines across the whole text
function parseCsvRecords(text: string, delim: string): string[][] {
  const norm = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const records: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < norm.length; i++) {
    const ch = norm[i] ?? '';
    if (inQuotes) {
      if (ch === '"') {
        const next = norm[i + 1] ?? '';
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      records.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  // flush last field/row unless trailing newline already flushed
  if (field !== '' || row.length > 0) {
    row.push(field);
    records.push(row);
  }
  return records;
}

function detectDelim(text: string): string {
  const firstLine = (text.replace(/\r\n/g, '\n').split('\n')[0] ?? '');
  const candidates: string[] = [',', ';', '\t', '|'];
  let best = ',';
  let bestCount = -1;
  for (const c of candidates) {
    const count = parseLine(firstLine, c).length;
    if (count > bestCount) {
      bestCount = count;
      best = c;
    }
  }
  return best;
}

function inferValue(raw: string): unknown {
  const t = raw.trim();
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  // integer
  if (/^-?\d+$/.test(t)) {
    const n = Number(t);
    if (Number.isSafeInteger(n)) return n;
    return raw; // too large; keep as string to avoid precision loss
  }
  // float
  if (/^-?\d*\.\d+$/.test(t) || /^-?\d+(\.\d+)?[eE][+-]?\d+$/.test(t)) {
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  return raw;
}

export default function CsvToNdjsonTool() {
  const [delimSel, setDelimSel] = useState('auto');
  const [infer, setInfer] = useState(true);
  const [emptyMode, setEmptyMode] = useState<EmptyMode>('null');
  const [trimKeys, setTrimKeys] = useState(true);

  const transform = useCallback(
    (text: string) => {
      if (!text.trim()) return '';
      const delim = delimSel === 'auto' ? detectDelim(text) : delimSel;
      const records = parseCsvRecords(text, delim);
      if (records.length === 0) return '';
      const headerRaw = records[0];
      if (!headerRaw || headerRaw.length === 0) throw new Error('CSV has no header row.');
      const keys = headerRaw.map((k, i) => {
        const key = trimKeys ? k.trim() : k;
        return key === '' ? `column_${i + 1}` : key;
      });

      const lines: string[] = [];
      for (let r = 1; r < records.length; r++) {
        const row = records[r];
        if (!row) continue;
        // skip fully-empty trailing rows
        if (row.length === 1 && (row[0] ?? '') === '') continue;
        const obj: Record<string, unknown> = {};
        for (let c = 0; c < keys.length; c++) {
          const key = keys[c] ?? `column_${c + 1}`;
          const raw = row[c] ?? '';
          if (raw === '') {
            if (emptyMode === 'omit') continue;
            obj[key] = emptyMode === 'null' ? null : '';
            continue;
          }
          obj[key] = infer ? inferValue(raw) : raw;
        }
        lines.push(JSON.stringify(obj));
      }
      return lines.join('\n');
    },
    [delimSel, infer, emptyMode, trimKeys]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[delimSel, infer, emptyMode, trimKeys]}
      inputLabel="CSV"
      outputLabel="NDJSON (one object per line)"
      inputPlaceholder={'a,b\n1,2'}
      sample={SAMPLE}
      downloadName="data.ndjson"
      downloadMime="application/x-ndjson"
      options={
        <>
          <Field label="Delimiter">
            <Select value={delimSel} onValueChange={setDelimSel}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DELIMS).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Empty cells">
            <Select value={emptyMode} onValueChange={(v) => setEmptyMode(v as EmptyMode)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">as null</SelectItem>
                <SelectItem value="empty">as empty string</SelectItem>
                <SelectItem value="omit">omit key</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Options">
            <div className="flex h-8 items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={infer} onCheckedChange={setInfer} /> infer types
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={trimKeys} onCheckedChange={setTrimKeys} /> trim keys
              </label>
            </div>
          </Field>
        </>
      }
    />
  );
}
