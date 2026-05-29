'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Direction = 'env2json' | 'json2env';

const SAMPLE_ENV = `# App configuration
export NODE_ENV=production
PORT=3000
APP_NAME="My Cool App"
DATABASE_URL='postgres://user:pass@localhost:5432/db'
EMPTY=
FEATURE_FLAG=true # inline comment`;

const SAMPLE_JSON = `{
  "NODE_ENV": "production",
  "PORT": "3000",
  "APP_NAME": "My Cool App",
  "DATABASE_URL": "postgres://user:pass@localhost:5432/db",
  "EMPTY": "",
  "FEATURE_FLAG": "true"
}`;

/** Parse a single .env value, handling quotes and inline comments. */
function parseEnvValue(raw: string): string {
  let value = raw.trim();
  if (value.length === 0) return '';

  const first = value[0];
  if (first === '"' || first === "'") {
    // Find the matching closing quote.
    let i = 1;
    let out = '';
    while (i < value.length) {
      const ch = value[i];
      if (ch === undefined) break;
      if (ch === '\\' && first === '"') {
        const next = value[i + 1];
        if (next === 'n') out += '\n';
        else if (next === 't') out += '\t';
        else if (next === 'r') out += '\r';
        else if (next !== undefined) out += next;
        i += 2;
        continue;
      }
      if (ch === first) {
        return out;
      }
      out += ch;
      i += 1;
    }
    // No closing quote found; treat literally without the leading quote.
    return out;
  }

  // Unquoted: strip trailing inline comment (preceded by whitespace).
  const hashIdx = value.indexOf(' #');
  if (hashIdx !== -1) {
    value = value.slice(0, hashIdx).trim();
  }
  return value;
}

function envToJson(input: string): string {
  const obj: Record<string, string> = {};
  const lines = input.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;

    let body = trimmed;
    if (body.startsWith('export ')) {
      body = body.slice('export '.length).trim();
    }

    const eq = body.indexOf('=');
    if (eq === -1) continue;

    const key = body.slice(0, eq).trim();
    if (key.length === 0) continue;

    const rawValue = body.slice(eq + 1);
    obj[key] = parseEnvValue(rawValue);
  }
  return JSON.stringify(obj, null, 2);
}

/** Decide whether a value needs quoting in .env output. */
function needsQuotes(value: string): boolean {
  return (
    value.length === 0 ||
    /\s/.test(value) ||
    value.includes('#') ||
    value.includes('"') ||
    value.includes("'") ||
    value.includes('=')
  );
}

function jsonToEnv(input: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error('Input is not valid JSON.');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('JSON must be a top-level object of key/value pairs.');
  }

  const entries = Object.entries(parsed as Record<string, unknown>);
  const out: string[] = [];
  for (const [key, value] of entries) {
    let str: string;
    if (value === null || value === undefined) {
      str = '';
    } else if (typeof value === 'object') {
      str = JSON.stringify(value);
    } else {
      str = String(value);
    }

    if (needsQuotes(str)) {
      const escaped = str
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
      out.push(`${key}="${escaped}"`);
    } else {
      out.push(`${key}=${str}`);
    }
  }
  return out.join('\n');
}

export default function DotenvToJsonTool() {
  const [direction, setDirection] = useState<Direction>('env2json');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      return direction === 'env2json' ? envToJson(input) : jsonToEnv(input);
    },
    [direction],
  );

  const isEnv2Json = direction === 'env2json';

  return (
    <TextToolLayout
      transform={transform}
      deps={[direction]}
      inputLabel={isEnv2Json ? '.env' : 'JSON'}
      outputLabel={isEnv2Json ? 'JSON' : '.env'}
      inputPlaceholder={
        isEnv2Json ? 'KEY=value\nANOTHER="quoted value"' : '{\n  "KEY": "value"\n}'
      }
      sample={isEnv2Json ? SAMPLE_ENV : SAMPLE_JSON}
      downloadName={isEnv2Json ? 'env.json' : '.env'}
      downloadMime={isEnv2Json ? 'application/json' : 'text/plain'}
      options={
        <Field label="Direction">
          <Tabs
            value={direction}
            onValueChange={(v) => setDirection(v as Direction)}
          >
            <TabsList>
              <TabsTrigger value="env2json">.env → JSON</TabsTrigger>
              <TabsTrigger value="json2env">JSON → .env</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
