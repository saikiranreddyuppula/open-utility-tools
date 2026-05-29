'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { TextToolLayout } from '@/components/tools/text-tool';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type DelimKey = 'comma' | 'tab' | 'pipe' | 'semicolon' | 'newline' | 'space' | 'custom';

const DELIMS: Record<Exclude<DelimKey, 'custom'>, string> = {
  comma: ',',
  tab: '\t',
  pipe: '|',
  semicolon: ';',
  newline: '\n',
  space: ' ',
};

function resolve(key: DelimKey, custom: string): string {
  if (key === 'custom') {
    return custom.replace(/\\t/g, '\t').replace(/\\n/g, '\n').replace(/\\r/g, '\r');
  }
  return DELIMS[key];
}

export default function DelimiterConverter() {
  const [from, setFrom] = useState<DelimKey>('comma');
  const [to, setTo] = useState<DelimKey>('newline');
  const [fromCustom, setFromCustom] = useState('');
  const [toCustom, setToCustom] = useState('');
  const [trim, setTrim] = useState(true);
  const [dropEmpty, setDropEmpty] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const src = resolve(from, fromCustom);
      const dst = resolve(to, toCustom);
      if (!src) throw new Error('Source delimiter cannot be empty.');
      let parts = input.split(src);
      if (trim) parts = parts.map((p) => p.trim());
      if (dropEmpty) parts = parts.filter((p) => p.length > 0);
      return parts.join(dst);
    },
    [from, to, fromCustom, toCustom, trim, dropEmpty],
  );

  const renderSelect = (
    value: DelimKey,
    onChange: (v: DelimKey) => void,
    custom: string,
    onCustom: (v: string) => void,
    label: string,
  ) => (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <Select value={value} onValueChange={(v) => onChange(v as DelimKey)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="comma">Comma ,</SelectItem>
            <SelectItem value="tab">Tab</SelectItem>
            <SelectItem value="pipe">Pipe |</SelectItem>
            <SelectItem value="semicolon">Semicolon ;</SelectItem>
            <SelectItem value="newline">Newline</SelectItem>
            <SelectItem value="space">Space</SelectItem>
            <SelectItem value="custom">Custom…</SelectItem>
          </SelectContent>
        </Select>
        {value === 'custom' ? (
          <Input
            value={custom}
            onChange={(e) => onCustom(e.target.value)}
            placeholder="\t, |, etc."
            className="w-28"
          />
        ) : null}
      </div>
    </Field>
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[from, to, fromCustom, toCustom, trim, dropEmpty]}
      inputLabel="Input"
      outputLabel="Converted"
      inputPlaceholder="a, b, c, d"
      sample="apple, banana, cherry, date"
      downloadName="converted.txt"
      options={
        <>
          {renderSelect(from, setFrom, fromCustom, setFromCustom, 'From delimiter')}
          {renderSelect(to, setTo, toCustom, setToCustom, 'To delimiter')}
          <div className="flex items-center gap-2">
            <Checkbox id="trim" checked={trim} onCheckedChange={(v) => setTrim(Boolean(v))} />
            <Label htmlFor="trim">Trim items</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="drop" checked={dropEmpty} onCheckedChange={(v) => setDropEmpty(Boolean(v))} />
            <Label htmlFor="drop">Drop empty</Label>
          </div>
        </>
      }
    />
  );
}
