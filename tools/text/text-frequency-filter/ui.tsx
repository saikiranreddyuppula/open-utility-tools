'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type CondKind =
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'regex'
  | 'lenGt'
  | 'lenLt'
  | 'lenEq'
  | 'blank'
  | 'duplicate';
type Action = 'keep' | 'delete';
type Combine = 'none' | 'and' | 'or';

const SAMPLE = `apple
Banana
cherry

apple
DRAGON fruit 42
elderberry
fig
grape 7`;

const NEEDS_VALUE: ReadonlySet<CondKind> = new Set<CondKind>([
  'contains',
  'startsWith',
  'endsWith',
  'regex',
]);
const NEEDS_NUMBER: ReadonlySet<CondKind> = new Set<CondKind>([
  'lenGt',
  'lenLt',
  'lenEq',
]);

export default function FilterLinesByRule() {
  const [kind, setKind] = useState<CondKind>('contains');
  const [value, setValue] = useState('apple');
  const [action, setAction] = useState<Action>('keep');
  const [caseInsensitive, setCaseInsensitive] = useState(true);
  const [invert, setInvert] = useState(false);

  const [combine, setCombine] = useState<Combine>('none');
  const [kind2, setKind2] = useState<CondKind>('blank');
  const [value2, setValue2] = useState('');

  const transform = useCallback(
    (input: string): string => {
      if (!input) return '';
      const lines = input.split(/\r\n?|\n/u);

      const makeMatcher = (
        k: CondKind,
        v: string
      ): ((line: string, seen: Set<string>) => boolean) => {
        if (k === 'blank') {
          return (line) => line.trim() === '';
        }
        if (k === 'duplicate') {
          return (line, seen) => {
            const key = caseInsensitive ? line.toLowerCase() : line;
            if (seen.has(key)) return true;
            seen.add(key);
            return false;
          };
        }
        if (NEEDS_NUMBER.has(k)) {
          const n = Number(v);
          if (!Number.isFinite(n)) {
            throw new Error('Enter a valid number for the length condition.');
          }
          return (line) => {
            const len = [...line].length;
            if (k === 'lenGt') return len > n;
            if (k === 'lenLt') return len < n;
            return len === n;
          };
        }
        if (k === 'regex') {
          let re: RegExp;
          try {
            re = new RegExp(v, caseInsensitive ? 'iu' : 'u');
          } catch {
            throw new Error('Invalid regular expression.');
          }
          return (line) => re.test(line);
        }
        // contains / startsWith / endsWith
        const hay = (s: string): string => (caseInsensitive ? s.toLowerCase() : s);
        const needle = caseInsensitive ? v.toLowerCase() : v;
        if (k === 'startsWith') return (line) => hay(line).startsWith(needle);
        if (k === 'endsWith') return (line) => hay(line).endsWith(needle);
        return (line) => hay(line).includes(needle);
      };

      const m1 = makeMatcher(kind, value);
      const seen1 = new Set<string>();

      const useSecond = combine !== 'none';
      const m2 = useSecond ? makeMatcher(kind2, value2) : null;
      const seen2 = new Set<string>();

      const out: string[] = [];
      let kept = 0;
      let removed = 0;

      for (const line of lines) {
        let matched = m1(line, seen1);
        if (m2) {
          const r2 = m2(line, seen2);
          matched = combine === 'and' ? matched && r2 : matched || r2;
        }
        if (invert) matched = !matched;

        const keepThis = action === 'keep' ? matched : !matched;
        if (keepThis) {
          out.push(line);
          kept += 1;
        } else {
          removed += 1;
        }
      }

      const summary = `# kept ${kept} line(s), removed ${removed} line(s)`;
      return out.length > 0 ? `${out.join('\n')}\n\n${summary}` : summary;
    },
    [kind, value, action, caseInsensitive, invert, combine, kind2, value2]
  );

  const kindLabel = (k: CondKind): string => {
    switch (k) {
      case 'contains':
        return 'Contains text';
      case 'startsWith':
        return 'Starts with';
      case 'endsWith':
        return 'Ends with';
      case 'regex':
        return 'Matches regex';
      case 'lenGt':
        return 'Length >';
      case 'lenLt':
        return 'Length <';
      case 'lenEq':
        return 'Length =';
      case 'blank':
        return 'Is blank';
      case 'duplicate':
        return 'Is duplicate';
      default:
        return k;
    }
  };

  const kindOptions: CondKind[] = [
    'contains',
    'startsWith',
    'endsWith',
    'regex',
    'lenGt',
    'lenLt',
    'lenEq',
    'blank',
    'duplicate',
  ];

  return (
    <TextToolLayout
      transform={transform}
      deps={[kind, value, action, caseInsensitive, invert, combine, kind2, value2]}
      inputLabel="Lines"
      outputLabel="Filtered lines"
      sample={SAMPLE}
      downloadName="filtered.txt"
      options={
        <>
          <Field label="Action">
            <Select value={action} onValueChange={(v) => setAction(v as Action)}>
              <SelectTrigger className="h-8 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keep">Keep matching</SelectItem>
                <SelectItem value="delete">Delete matching</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Condition">
            <Select value={kind} onValueChange={(v) => setKind(v as CondKind)}>
              <SelectTrigger className="h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {kindOptions.map((k) => (
                  <SelectItem key={k} value={k}>
                    {kindLabel(k)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {(NEEDS_VALUE.has(kind) || NEEDS_NUMBER.has(kind)) && (
            <Field label={NEEDS_NUMBER.has(kind) ? 'N' : 'Value'} className="flex-1">
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="font-mono"
                spellCheck={false}
                inputMode={NEEDS_NUMBER.has(kind) ? 'numeric' : 'text'}
              />
            </Field>
          )}
          <Field label="Combine with">
            <Select value={combine} onValueChange={(v) => setCombine(v as Combine)}>
              <SelectTrigger className="h-8 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No 2nd rule</SelectItem>
                <SelectItem value="and">AND</SelectItem>
                <SelectItem value="or">OR</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {combine !== 'none' && (
            <>
              <Field label="2nd condition">
                <Select
                  value={kind2}
                  onValueChange={(v) => setKind2(v as CondKind)}
                >
                  <SelectTrigger className="h-8 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {kindOptions.map((k) => (
                      <SelectItem key={k} value={k}>
                        {kindLabel(k)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {(NEEDS_VALUE.has(kind2) || NEEDS_NUMBER.has(kind2)) && (
                <Field
                  label={NEEDS_NUMBER.has(kind2) ? 'N (2nd)' : 'Value (2nd)'}
                  className="flex-1"
                >
                  <Input
                    value={value2}
                    onChange={(e) => setValue2(e.target.value)}
                    className="font-mono"
                    spellCheck={false}
                    inputMode={NEEDS_NUMBER.has(kind2) ? 'numeric' : 'text'}
                  />
                </Field>
              )}
            </>
          )}
          <Field label="Options">
            <div className="flex h-8 items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox
                  checked={caseInsensitive}
                  onCheckedChange={(v) => setCaseInsensitive(v === true)}
                />
                Case-insensitive
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox
                  checked={invert}
                  onCheckedChange={(v) => setInvert(v === true)}
                />
                Invert match
              </label>
            </div>
          </Field>
        </>
      }
    />
  );
}
