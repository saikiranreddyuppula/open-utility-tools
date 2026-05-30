'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SAMPLE = `apple
banana
cherry
42
true

apple`;

type SplitMode = 'lines' | 'comma' | 'custom';

type JsonItem = string | number | boolean;
type JsonVal = JsonItem | { [k: string]: JsonItem };

function coerce(raw: string, on: boolean): JsonItem {
  if (!on) return raw;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw !== '' && /^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(raw)) {
    const num = Number(raw);
    if (Number.isFinite(num)) return num;
  }
  return raw;
}

export default function ListToJsonArrayTool() {
  const [splitMode, setSplitMode] = useState<SplitMode>('lines');
  const [customDelim, setCustomDelim] = useState(',');
  const [trim, setTrim] = useState(true);
  const [dropEmpty, setDropEmpty] = useState(true);
  const [dedupe, setDedupe] = useState(false);
  const [doCoerce, setDoCoerce] = useState(false);
  const [wrapField, setWrapField] = useState('');
  const [pretty, setPretty] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      let parts: string[];
      if (splitMode === 'lines') {
        parts = input.split(/\r?\n/);
      } else if (splitMode === 'comma') {
        parts = input.split(',');
      } else {
        const delim = customDelim === '' ? ',' : customDelim;
        parts = input.split(delim);
      }
      let items = parts.map((p) => (trim ? p.trim() : p));
      if (dropEmpty) items = items.filter((p) => p.length > 0);
      if (dedupe) {
        const seen = new Set<string>();
        items = items.filter((p) => {
          if (seen.has(p)) return false;
          seen.add(p);
          return true;
        });
      }
      const values: JsonItem[] = items.map((p) => coerce(p, doCoerce));
      const field = wrapField.trim();
      const result: JsonVal[] = field
        ? values.map((v) => ({ [field]: v }))
        : values;
      return JSON.stringify(result, null, pretty ? 2 : undefined);
    },
    [splitMode, customDelim, trim, dropEmpty, dedupe, doCoerce, wrapField, pretty]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[splitMode, customDelim, trim, dropEmpty, dedupe, doCoerce, wrapField, pretty]}
      inputLabel="List"
      outputLabel="JSON array"
      inputPlaceholder="one item per line"
      sample={SAMPLE}
      downloadName="list.json"
      downloadMime="application/json"
      options={
        <>
          <Field label="Split by">
            <Select value={splitMode} onValueChange={(v) => setSplitMode(v as SplitMode)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lines">Lines</SelectItem>
                <SelectItem value="comma">Comma</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {splitMode === 'custom' && (
            <Field label="Delimiter">
              <Input
                value={customDelim}
                onChange={(e) => setCustomDelim(e.target.value)}
                className="w-20"
                placeholder=","
              />
            </Field>
          )}
          <Field label="Trim">
            <div className="flex h-8 items-center gap-2">
              <Switch id="trim" checked={trim} onCheckedChange={setTrim} />
              <Label htmlFor="trim" className="text-xs text-muted-foreground">
                whitespace
              </Label>
            </div>
          </Field>
          <Field label="Drop empty">
            <div className="flex h-8 items-center gap-2">
              <Switch id="empty" checked={dropEmpty} onCheckedChange={setDropEmpty} />
              <Label htmlFor="empty" className="text-xs text-muted-foreground">
                blank items
              </Label>
            </div>
          </Field>
          <Field label="Dedupe">
            <div className="flex h-8 items-center gap-2">
              <Switch id="dedupe" checked={dedupe} onCheckedChange={setDedupe} />
              <Label htmlFor="dedupe" className="text-xs text-muted-foreground">
                unique only
              </Label>
            </div>
          </Field>
          <Field label="Coerce types">
            <div className="flex h-8 items-center gap-2">
              <Switch id="coerce" checked={doCoerce} onCheckedChange={setDoCoerce} />
              <Label htmlFor="coerce" className="text-xs text-muted-foreground">
                numbers/bool
              </Label>
            </div>
          </Field>
          <Field label="Wrap as object">
            <Input
              value={wrapField}
              onChange={(e) => setWrapField(e.target.value)}
              className="w-28"
              placeholder="field name"
            />
          </Field>
          <Field label="Format">
            <div className="flex h-8 items-center gap-2">
              <Switch id="pretty" checked={pretty} onCheckedChange={setPretty} />
              <Label htmlFor="pretty" className="text-xs text-muted-foreground">
                pretty
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
