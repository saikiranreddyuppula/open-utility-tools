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

type Style =
  | 'camel'
  | 'pascal'
  | 'snake'
  | 'screaming'
  | 'kebab'
  | 'cobol'
  | 'dot'
  | 'path'
  | 'train'
  | 'capital';

const SAMPLE = `getUserID
HTMLParser
my_variable_name
SCREAMING_SNAKE_CASE
some-kebab-name`;

// Split an identifier into lowercase-normalised tokens, keeping acronym runs.
function tokenize(id: string): string[] {
  // First split on explicit separators.
  const rough = id.split(/[\s_.\-/]+/).filter(Boolean);
  const tokens: string[] = [];
  for (const part of rough) {
    // Split camelCase boundaries and acronym runs like HTMLParser -> HTML, Parser.
    const matches = part.match(
      /[A-Z]+(?=[A-Z][a-z])|[A-Z]?[a-z0-9]+|[A-Z]+|[0-9]+/g,
    );
    if (matches) {
      for (const t of matches) tokens.push(t);
    } else if (part) {
      tokens.push(part);
    }
  }
  return tokens;
}

function cap(word: string): string {
  const first = word[0];
  if (first === undefined) return '';
  return first.toUpperCase() + word.slice(1).toLowerCase();
}

function leadingChar(id: string, ch: string): number {
  let n = 0;
  while (id[n] === ch) n++;
  return n;
}

function convert(id: string, style: Style, preserveLeadUnderscore: boolean, keepAcronymCase: boolean): string {
  const trimmed = id;
  if (trimmed.trim() === '') return '';

  const leadUnderscores = preserveLeadUnderscore ? '_'.repeat(leadingChar(trimmed, '_')) : '';
  const tokens = tokenize(trimmed);
  if (tokens.length === 0) return leadUnderscores;

  // Token normaliser respecting acronym preference.
  const normLower = tokens.map((t) => t.toLowerCase());
  const normForCamel = tokens.map((t) => {
    if (keepAcronymCase && /^[A-Z0-9]{2,}$/.test(t)) return t; // keep e.g. HTML
    return t.toLowerCase();
  });

  let body: string;
  switch (style) {
    case 'camel': {
      body = normForCamel
        .map((t, i) => (i === 0 ? t.toLowerCase() : keepAcronymCase && /^[A-Z0-9]{2,}$/.test(tokens[i] ?? '') ? t : cap(t)))
        .join('');
      break;
    }
    case 'pascal': {
      body = tokens
        .map((t) => (keepAcronymCase && /^[A-Z0-9]{2,}$/.test(t) ? t : cap(t)))
        .join('');
      break;
    }
    case 'snake': {
      body = normLower.join('_');
      break;
    }
    case 'screaming': {
      body = tokens.map((t) => t.toUpperCase()).join('_');
      break;
    }
    case 'kebab': {
      body = normLower.join('-');
      break;
    }
    case 'cobol': {
      body = tokens.map((t) => t.toUpperCase()).join('-');
      break;
    }
    case 'dot': {
      body = normLower.join('.');
      break;
    }
    case 'path': {
      body = normLower.join('/');
      break;
    }
    case 'train': {
      body = tokens.map((t) => cap(t)).join('-');
      break;
    }
    case 'capital': {
      body = tokens.map((t) => cap(t)).join(' ');
      break;
    }
    default: {
      body = normLower.join('_');
      break;
    }
  }
  return leadUnderscores + body;
}

export default function IdentifierCaseTool() {
  const [style, setStyle] = useState<Style>('snake');
  const [preserveLeadUnderscore, setPreserveLeadUnderscore] = useState(true);
  const [keepAcronymCase, setKeepAcronymCase] = useState(false);

  return (
    <TextToolLayout
      deps={[style, preserveLeadUnderscore, keepAcronymCase]}
      transform={(input) => {
        if (!input) return '';
        return input
          .split('\n')
          .map((line) =>
            line.trim() === ''
              ? line
              : convert(line, style, preserveLeadUnderscore, keepAcronymCase),
          )
          .join('\n');
      }}
      inputLabel="Identifiers (one per line)"
      outputLabel="Converted"
      sample={SAMPLE}
      downloadName="identifiers.txt"
      options={
        <>
          <Field label="Target style">
            <Select value={style} onValueChange={(v) => setStyle(v as Style)}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="camel">camelCase</SelectItem>
                <SelectItem value="pascal">PascalCase</SelectItem>
                <SelectItem value="snake">snake_case</SelectItem>
                <SelectItem value="screaming">SCREAMING_SNAKE_CASE</SelectItem>
                <SelectItem value="kebab">kebab-case</SelectItem>
                <SelectItem value="cobol">COBOL-CASE</SelectItem>
                <SelectItem value="dot">dot.case</SelectItem>
                <SelectItem value="path">path/case</SelectItem>
                <SelectItem value="train">Train-Case</SelectItem>
                <SelectItem value="capital">Capital Case</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Preserve leading underscores">
            <Switch
              checked={preserveLeadUnderscore}
              onCheckedChange={setPreserveLeadUnderscore}
            />
          </Field>
          <Field label="Keep acronym case (HTML, ID)">
            <Switch checked={keepAcronymCase} onCheckedChange={setKeepAcronymCase} />
          </Field>
        </>
      }
    />
  );
}
