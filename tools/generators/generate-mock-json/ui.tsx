'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, RefreshCw, Download } from 'lucide-react';

const webcrypto = (globalThis as unknown as {
  crypto: { getRandomValues<T extends ArrayBufferView>(a: T): T; randomUUID(): string };
}).crypto;

type FieldType =
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'email'
  | 'uuid'
  | 'integer'
  | 'float'
  | 'date'
  | 'boolean'
  | 'word'
  | 'sentence';

interface SchemaField {
  key: string;
  type: FieldType;
}

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'firstName', label: 'First name' },
  { value: 'lastName', label: 'Last name' },
  { value: 'fullName', label: 'Full name' },
  { value: 'email', label: 'Email' },
  { value: 'uuid', label: 'UUID' },
  { value: 'integer', label: 'Integer' },
  { value: 'float', label: 'Float' },
  { value: 'date', label: 'Date (ISO)' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'word', label: 'Word' },
  { value: 'sentence', label: 'Sentence' },
];

const FIRST = ['Ada', 'Grace', 'Alan', 'Linus', 'Margaret', 'Dennis', 'Barbara', 'Ken', 'Joan', 'Edsger', 'Donald', 'Radia', 'Tim', 'Katherine', 'Brian', 'Hedy'];
const LAST = ['Lovelace', 'Hopper', 'Turing', 'Torvalds', 'Hamilton', 'Ritchie', 'Liskov', 'Thompson', 'Clarke', 'Dijkstra', 'Knuth', 'Perlman', 'Berners-Lee', 'Johnson', 'Kernighan', 'Lamarr'];
const WORDS = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'vivamus', 'integer', 'fusce', 'tellus', 'morbi', 'mauris', 'cursus', 'lacus', 'pellentesque', 'aliquam', 'tempus', 'nibh'];
const DOMAINS = ['example.com', 'mail.test', 'sample.org', 'demo.io', 'inbox.dev'];

function rand(): number {
  const buf = new Uint32Array(1);
  webcrypto.getRandomValues(buf);
  return (buf[0] ?? 0) / 4294967296;
}

function pick<T>(arr: readonly T[]): T {
  const i = Math.floor(rand() * arr.length);
  return arr[i] ?? (arr[0] as T);
}

function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function genValue(type: FieldType): string | number | boolean {
  switch (type) {
    case 'firstName':
      return pick(FIRST);
    case 'lastName':
      return pick(LAST);
    case 'fullName':
      return `${pick(FIRST)} ${pick(LAST)}`;
    case 'email': {
      const f = pick(FIRST).toLowerCase();
      const l = pick(LAST).toLowerCase().replace(/[^a-z]/g, '');
      return `${f}.${l}${randInt(1, 99)}@${pick(DOMAINS)}`;
    }
    case 'uuid':
      return webcrypto.randomUUID();
    case 'integer':
      return randInt(1, 10000);
    case 'float':
      return Math.round(rand() * 100000) / 100;
    case 'date': {
      const now = Date.now();
      const past = now - randInt(0, 1000) * 86400000;
      return new Date(past).toISOString();
    }
    case 'boolean':
      return rand() < 0.5;
    case 'word':
      return pick(WORDS);
    case 'sentence': {
      const n = randInt(4, 9);
      const words = Array.from({ length: n }, () => pick(WORDS));
      const first = (words[0] ?? 'lorem');
      words[0] = first.charAt(0).toUpperCase() + first.slice(1);
      return `${words.join(' ')}.`;
    }
    default:
      return '';
  }
}

export default function MockJsonTool() {
  const [fields, setFields] = useState<SchemaField[]>([
    { key: 'id', type: 'uuid' },
    { key: 'name', type: 'fullName' },
    { key: 'email', type: 'email' },
    { key: 'age', type: 'integer' },
    { key: 'active', type: 'boolean' },
  ]);
  const [count, setCount] = useState(10);
  const [pretty, setPretty] = useState(true);
  const [seedNonce, setSeedNonce] = useState(0);

  const result = useMemo<{ json: string } | { error: string }>(() => {
    void seedNonce; // re-run on regenerate
    if (fields.length === 0) return { error: 'Add at least one field to the schema.' };
    const keys = fields.map((f) => f.key.trim());
    if (keys.some((k) => k === '')) return { error: 'Every field needs a non-empty key.' };
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (dupes.length > 0) return { error: `Duplicate field key: "${dupes[0]}".` };

    const rows: Record<string, string | number | boolean>[] = [];
    for (let i = 0; i < count; i++) {
      const obj: Record<string, string | number | boolean> = {};
      for (const f of fields) {
        obj[f.key.trim()] = genValue(f.type);
      }
      rows.push(obj);
    }
    return { json: JSON.stringify(rows, null, pretty ? 2 : undefined) };
  }, [fields, count, pretty, seedNonce]);

  const error = 'error' in result ? result.error : null;
  const json = 'json' in result ? result.json : '';

  const downloadJson = () => {
    if (!json) return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mock-data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateField = (idx: number, patch: Partial<SchemaField>) => {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };
  const removeField = (idx: number) => setFields((prev) => prev.filter((_, i) => i !== idx));
  const addField = () => setFields((prev) => [...prev, { key: `field${prev.length + 1}`, type: 'word' }]);

  return (
    <Panel>
      <PanelHeader title="JSON Mock Data Generator">
        <Button type="button" variant="outline" size="sm" onClick={() => setSeedNonce((n) => n + 1)}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Regenerate
        </Button>
        <CopyButton value={() => json} />
        <Button type="button" variant="outline" size="sm" onClick={downloadJson} disabled={!json}>
          <Download className="mr-1.5 h-4 w-4" />
          Download
        </Button>
      </PanelHeader>

      <OptionsBar>
        <Field label={`Rows: ${count}`}>
          <Slider min={1} max={500} step={1} value={[count]} onValueChange={(v) => setCount(v[0] ?? 10)} />
        </Field>
        <Field label="Output">
          <Button type="button" variant="outline" size="sm" onClick={() => setPretty((p) => !p)}>
            {pretty ? 'Pretty' : 'Minified'}
          </Button>
        </Field>
      </OptionsBar>

      <Field label="Schema" hint="Define the field name and the kind of value to generate.">
        <div className="space-y-2">
          {fields.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                className="flex-1"
                value={f.key}
                onChange={(e) => updateField(i, { key: e.target.value })}
                placeholder="key"
              />
              <Select value={f.type} onValueChange={(v) => updateField(i, { type: v as FieldType })}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeField(i)}
                aria-label="Remove field"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addField}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add field
          </Button>
        </div>
      </Field>

      <ErrorBanner error={error} />

      {json && !error ? (
        <Field label="Output JSON">
          <pre className="max-h-96 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
            <code>{json}</code>
          </pre>
        </Field>
      ) : null}

      <StatBar items={[`Fields: ${fields.length}`, `Rows: ${count}`, json && `${json.length.toLocaleString()} chars`]} />
    </Panel>
  );
}
