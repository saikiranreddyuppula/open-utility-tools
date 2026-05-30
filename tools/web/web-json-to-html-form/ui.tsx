'use client';

import { useCallback, useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';

const SAMPLE = JSON.stringify(
  {
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    age: 36,
    website: 'https://example.com',
    birthDate: '1815-12-10',
    subscribed: true,
    role: ['admin', 'editor', 'viewer'],
    address: { city: 'London', zip: '00000' },
  },
  null,
  2,
);

interface Opts {
  useValues: boolean;
  required: boolean;
  wrapForm: boolean;
}

const IND = '  ';

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function slugify(key: string): string {
  return (
    key
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'field'
  );
}

function humanLabel(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function inferStringType(key: string, value: string): string {
  const k = key.toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || k.includes('email')) return 'email';
  if (/^https?:\/\//.test(value) || k.includes('url') || k.includes('website') || k.includes('link')) return 'url';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) || k.includes('date') || k.endsWith('at') || k.includes('birth')) return 'date';
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(value) || k.includes('time')) return 'time';
  if (k.includes('password') || k.includes('secret')) return 'password';
  if (k.includes('phone') || k.includes('tel')) return 'tel';
  if (k.includes('color') || k.includes('colour')) return 'color';
  return 'text';
}

function emitField(key: string, value: unknown, o: Opts, indent: string): string[] {
  const id = slugify(key);
  const label = humanLabel(key);
  const name = escapeAttr(key);
  const req = o.required ? ' required' : '';
  const lines: string[] = [];

  // Nested object → fieldset.
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    lines.push(`${indent}<fieldset>`);
    lines.push(`${indent}${IND}<legend>${escapeText(label)}</legend>`);
    const entries = Object.entries(value as Record<string, unknown>);
    for (const [k, v] of entries) {
      const sub = emitField(`${key}.${k}`, v, o, indent + IND);
      lines.push(...sub);
    }
    lines.push(`${indent}</fieldset>`);
    return lines;
  }

  // Array of primitives → select.
  if (Array.isArray(value)) {
    lines.push(`${indent}<label for="${id}">${escapeText(label)}</label>`);
    lines.push(`${indent}<select id="${id}" name="${name}"${req}>`);
    for (const item of value as unknown[]) {
      if (item === null || typeof item === 'object') continue;
      const text = escapeText(String(item));
      const optVal = escapeAttr(String(item));
      lines.push(`${indent}${IND}<option value="${optVal}">${text}</option>`);
    }
    lines.push(`${indent}</select>`);
    return lines;
  }

  // Boolean → checkbox.
  if (typeof value === 'boolean') {
    const checked = o.useValues && value ? ' checked' : '';
    lines.push(
      `${indent}<label for="${id}"><input type="checkbox" id="${id}" name="${name}" value="1"${checked}${req}> ${escapeText(label)}</label>`,
    );
    return lines;
  }

  // Number → number input.
  if (typeof value === 'number') {
    const val = o.useValues ? ` value="${escapeAttr(String(value))}"` : '';
    lines.push(`${indent}<label for="${id}">${escapeText(label)}</label>`);
    lines.push(`${indent}<input type="number" id="${id}" name="${name}"${val}${req}>`);
    return lines;
  }

  // String (and null fallback) → typed text input.
  const strVal = value === null ? '' : String(value);
  const type = inferStringType(key, strVal);
  const val = o.useValues && strVal !== '' ? ` value="${escapeAttr(strVal)}"` : '';
  lines.push(`${indent}<label for="${id}">${escapeText(label)}</label>`);
  lines.push(`${indent}<input type="${type}" id="${id}" name="${name}"${val}${req}>`);
  return lines;
}

function generate(input: string, o: Opts): string {
  if (!input.trim()) return '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : 'parse error'}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Top-level JSON must be an object.');
  }

  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length === 0) throw new Error('Object has no fields.');

  const baseIndent = o.wrapForm ? IND : '';
  const fieldLines: string[] = [];
  for (const [key, value] of entries) {
    const block = emitField(key, value, o, baseIndent);
    fieldLines.push(...block);
    fieldLines.push('');
  }
  // Drop trailing blank line.
  if (fieldLines[fieldLines.length - 1] === '') fieldLines.pop();

  if (!o.wrapForm) return fieldLines.join('\n');

  const out: string[] = [];
  out.push('<form method="POST" action="#">');
  out.push(...fieldLines);
  out.push(`${IND}<button type="submit">Submit</button>`);
  out.push('</form>');
  return out.join('\n');
}

export default function JsonToHtmlFormTool() {
  const [useValues, setUseValues] = useState(true);
  const [required, setRequired] = useState(false);
  const [wrapForm, setWrapForm] = useState(true);

  const transform = useCallback(
    (input: string) => generate(input, { useValues, required, wrapForm }),
    [useValues, required, wrapForm],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[useValues, required, wrapForm]}
      inputLabel="JSON object"
      outputLabel="HTML form"
      inputPlaceholder='{ "name": "Ada", "age": 36 }'
      sample={SAMPLE}
      downloadName="form.html"
      downloadMime="text/html"
      options={
        <>
          <Field label="Use values as defaults">
            <Switch checked={useValues} onCheckedChange={setUseValues} />
          </Field>
          <Field label="Add required">
            <Switch checked={required} onCheckedChange={setRequired} />
          </Field>
          <Field label="Wrap in <form>">
            <Switch checked={wrapForm} onCheckedChange={setWrapForm} />
          </Field>
        </>
      }
    />
  );
}
