'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TextToolLayout } from '@/components/tools/text-tool';

type Style = 'bracket' | 'angle' | 'hash';

interface Category {
  key: string;
  label: string;
  token: string;
  regex: RegExp;
}

// Order matters: match URLs/emails before bare phone/number patterns so we
// don't misclassify digits that live inside a URL or email.
const CATEGORIES: Category[] = [
  {
    key: 'email',
    label: 'Emails',
    token: 'EMAIL',
    regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  },
  {
    key: 'url',
    label: 'URLs',
    token: 'URL',
    regex: /\bhttps?:\/\/[^\s<>"')]+/gi,
  },
  {
    key: 'card',
    label: 'Credit-card numbers',
    token: 'CARD',
    regex: /\b(?:\d[ -]?){13,16}\b/g,
  },
  {
    key: 'ip',
    label: 'IPv4 addresses',
    token: 'IP',
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
  },
  {
    key: 'phone',
    label: 'Phone numbers',
    token: 'PHONE',
    regex: /(?:\+?\d{1,3}[ .-]?)?(?:\(\d{2,4}\)[ .-]?)?\d{3}[ .-]?\d{3,4}(?:[ .-]?\d{2,4})?/g,
  },
];

function tokenText(style: Style, token: string, n: number): string {
  if (style === 'angle') return `<${token}_${n}>`;
  if (style === 'hash') return `#${token}_${n}#`;
  return `[${token}_${n}]`;
}

export default function TextAnonymizerTool() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    email: true,
    url: true,
    card: true,
    ip: true,
    phone: true,
  });
  const [style, setStyle] = useState<Style>('bracket');
  const [showMap, setShowMap] = useState(true);

  const toggle = (key: string, on: boolean) =>
    setEnabled((prev) => ({ ...prev, [key]: on }));

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      let text = input;
      // Stable numbering per category: identical values reuse the same token.
      const assigned = new Map<string, string>(); // original value -> token
      const counters = new Map<string, number>(); // category key -> count

      for (const cat of CATEGORIES) {
        if (enabled[cat.key] !== true) continue;
        const re = new RegExp(cat.regex.source, cat.regex.flags);
        text = text.replace(re, (match) => {
          // Skip very short "phone" matches that are likely plain numbers.
          if (cat.key === 'phone') {
            const digits = match.replace(/\D/g, '');
            if (digits.length < 7) return match;
          }
          if (cat.key === 'card') {
            const digits = match.replace(/\D/g, '');
            if (digits.length < 13 || digits.length > 16) return match;
          }
          const mapKey = `${cat.key}::${match}`;
          const existing = assigned.get(mapKey);
          if (existing !== undefined) return existing;
          const next = (counters.get(cat.key) ?? 0) + 1;
          counters.set(cat.key, next);
          const tok = tokenText(style, cat.token, next);
          assigned.set(mapKey, tok);
          return tok;
        });
      }

      if (showMap && assigned.size > 0) {
        const lines: string[] = ['', '--- Mapping (kept local) ---'];
        for (const [mapKey, tok] of assigned) {
          const original = mapKey.slice(mapKey.indexOf('::') + 2);
          lines.push(`${tok} = ${original}`);
        }
        text += `\n${lines.join('\n')}`;
      }

      return text;
    },
    [enabled, style, showMap],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[enabled, style, showMap]}
      inputLabel="Text"
      outputLabel="Redacted"
      inputPlaceholder="Paste text containing PII…"
      sample={
        'Contact Jane at jane.doe@example.com or call +1 (415) 555-0132. Server 192.168.1.50 logged card 4111 1111 1111 1111. See https://example.com/account for details.'
      }
      downloadName="anonymized.txt"
      options={
        <>
          <Field label="Categories">
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {CATEGORIES.map((c) => (
                <label
                  key={c.key}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={enabled[c.key] === true}
                    onCheckedChange={(v) => toggle(c.key, v === true)}
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="Token style" hint={tokenText(style, 'EMAIL', 1)}>
            <Select value={style} onValueChange={(v) => setStyle(v as Style)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bracket">[TOKEN_1]</SelectItem>
                <SelectItem value="angle">&lt;TOKEN_1&gt;</SelectItem>
                <SelectItem value="hash">#TOKEN_1#</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Show mapping" hint="Append token → value table">
            <Switch checked={showMap} onCheckedChange={setShowMap} />
          </Field>
        </>
      }
    />
  );
}
