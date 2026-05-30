'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Op = 'both' | 'leading' | 'trailing' | 'chars' | 'prefix-suffix';

// Runs of whitespace (\s already covers NBSP, BOM, tab, etc. in JS regex).
const WS = /\s+/g;

function escapeForCharClass(chars: string): string {
  return chars.replace(/[\\\]^-]/g, (m) => `\\${m}`);
}

export default function TrimLinesTool() {
  const [op, setOp] = useState<Op>('both');
  const [customChars, setCustomChars] = useState('"\',');
  const [affix, setAffix] = useState('- ');
  const [collapse, setCollapse] = useState(false);
  const [dropEmpty, setDropEmpty] = useState(false);

  const transform = useCallback(
    (input: string): string => {
      if (!input) return '';

      const trimChars = (line: string): string => {
        if (op === 'both') return line.trim();
        if (op === 'leading') return line.replace(/^\s+/, '');
        if (op === 'trailing') return line.replace(/\s+$/, '');
        if (op === 'chars') {
          if (!customChars) return line;
          const cls = escapeForCharClass(customChars);
          const re = new RegExp(`^[${cls}]+|[${cls}]+$`, 'g');
          return line.replace(re, '');
        }
        // prefix-suffix
        if (!affix) return line;
        let out = line;
        if (out.startsWith(affix)) out = out.slice(affix.length);
        if (affix.length > 0 && out.endsWith(affix)) {
          out = out.slice(0, out.length - affix.length);
        }
        return out;
      };

      // Preserve original newline style by splitting on \n and tracking \r.
      const lines = input.split('\n');
      const result: string[] = [];
      for (const raw of lines) {
        const hadCR = raw.endsWith('\r');
        const body = hadCR ? raw.slice(0, -1) : raw;
        let processed = trimChars(body);
        if (collapse) {
          processed = processed.replace(WS, ' ');
          if (op === 'both') processed = processed.trim();
        }
        if (dropEmpty && processed.length === 0) continue;
        result.push(hadCR ? `${processed}\r` : processed);
      }
      return result.join('\n');
    },
    [op, customChars, affix, collapse, dropEmpty]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[op, customChars, affix, collapse, dropEmpty]}
      inputLabel="Text"
      outputLabel="Trimmed"
      sample={'   hello world   \n\ttabbed line\t\n"quoted value",\ntrailing spaces here   \n\n  multiple   internal   spaces  '}
      downloadName="trimmed.txt"
      options={
        <>
          <Field label="Operation">
            <Select value={op} onValueChange={(v) => setOp(v as Op)}>
              <SelectTrigger className="h-8 w-60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Trim both ends</SelectItem>
                <SelectItem value="leading">Trim leading only</SelectItem>
                <SelectItem value="trailing">Trim trailing only</SelectItem>
                <SelectItem value="chars">Strip custom characters from ends</SelectItem>
                <SelectItem value="prefix-suffix">Strip prefix/suffix string</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {op === 'chars' && (
            <Field label="Characters to strip" hint="Each char stripped from both ends">
              <Input
                value={customChars}
                onChange={(e) => setCustomChars(e.target.value)}
                className="h-8 w-40 font-mono"
                placeholder="&quot;',"
              />
            </Field>
          )}

          {op === 'prefix-suffix' && (
            <Field label="Prefix / suffix string" hint="Removed if present at each end">
              <Input
                value={affix}
                onChange={(e) => setAffix(e.target.value)}
                className="h-8 w-40 font-mono"
                placeholder="- "
              />
            </Field>
          )}

          <Field label="Collapse internal whitespace">
            <div className="flex h-8 items-center">
              <Switch checked={collapse} onCheckedChange={setCollapse} />
            </div>
          </Field>

          <Field label="Drop emptied lines">
            <div className="flex h-8 items-center">
              <Switch checked={dropEmpty} onCheckedChange={setDropEmpty} />
            </div>
          </Field>
        </>
      }
    />
  );
}
