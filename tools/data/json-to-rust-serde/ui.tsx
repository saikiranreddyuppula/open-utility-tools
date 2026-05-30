'use client';

import { useCallback, useState } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

const SAMPLE = JSON.stringify(
  {
    id: 1,
    userName: 'ada',
    score: 9.5,
    isActive: true,
    tags: ['a', 'b'],
    profile: { city: 'London', followerCount: 12 },
    'created-at': '2024-01-01',
  },
  null,
  2
);

const RESERVED = new Set([
  'as','break','const','continue','crate','dyn','else','enum','extern','false','fn','for',
  'if','impl','in','let','loop','match','mod','move','mut','pub','ref','return','self',
  'Self','static','struct','super','trait','true','type','unsafe','use','where','while',
  'async','await','dyn','abstract','become','box','do','final','macro','override','priv',
  'typeof','unsized','virtual','yield','try',
]);

function isRustIdent(key: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && !RESERVED.has(key);
}

function snakeCase(key: string): string {
  let s = key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  if (!s) s = 'field';
  if (/^[0-9]/.test(s)) s = `f_${s}`;
  if (RESERVED.has(s)) s = `r#${s}`;
  return s;
}

function pascalCase(key: string): string {
  const parts = key.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const joined = parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
  const out = joined || 'Field';
  return /^[0-9]/.test(out) ? `S${out}` : out;
}

interface FieldInfo {
  type: string;
  fieldName: string;
  rename: string | null; // original key if differs
  optional: boolean;
}

interface StructDef {
  name: string;
  fields: FieldInfo[];
}

function generate(
  data: unknown,
  deriveLine: string,
  allOptional: boolean,
  renameAll: boolean
): string {
  const structs: StructDef[] = [];
  const usedNames = new Set<string>();

  function uniqueName(base: string): string {
    let name = base;
    let n = 2;
    while (usedNames.has(name)) {
      name = `${base}${n}`;
      n += 1;
    }
    usedNames.add(name);
    return name;
  }

  function rustType(value: unknown, keyHint: string): string {
    if (value === null) return 'serde_json::Value';
    if (typeof value === 'string') return 'String';
    if (typeof value === 'boolean') return 'bool';
    if (typeof value === 'number') return Number.isInteger(value) ? 'i64' : 'f64';
    if (Array.isArray(value)) {
      if (value.length === 0) return 'Vec<serde_json::Value>';
      const allObjects = value.every(
        (e) => e !== null && typeof e === 'object' && !Array.isArray(e)
      );
      if (allObjects) {
        const merged = mergeObjects(value as Record<string, unknown>[]);
        return `Vec<${buildStruct(merged.fields, keyHint, merged.optionalKeys)}>`;
      }
      return `Vec<${rustType(value[0], keyHint)}>`;
    }
    if (typeof value === 'object') {
      const fields = new Map<string, unknown>();
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) fields.set(k, v);
      return buildStruct(fields, keyHint, new Set<string>());
    }
    return 'serde_json::Value';
  }

  function mergeObjects(items: Record<string, unknown>[]): {
    fields: Map<string, unknown>;
    optionalKeys: Set<string>;
  } {
    const fields = new Map<string, unknown>();
    const seen: Map<string, number> = new Map();
    for (const item of items) {
      for (const [k, v] of Object.entries(item)) {
        seen.set(k, (seen.get(k) ?? 0) + 1);
        if (!fields.has(k) || (fields.get(k) === null && v !== null)) fields.set(k, v);
      }
    }
    const optionalKeys = new Set<string>();
    for (const [k, count] of seen) if (count < items.length) optionalKeys.add(k);
    return { fields, optionalKeys };
  }

  function buildStruct(
    fields: Map<string, unknown>,
    keyHint: string,
    optionalKeys: Set<string>
  ): string {
    const structName = uniqueName(pascalCase(keyHint));
    const def: StructDef = { name: structName, fields: [] };
    for (const [key, value] of fields) {
      const t = rustType(value, key);
      const fieldName = isRustIdent(key) ? key : snakeCase(key);
      // expected serde name if renameAll = snake_case is applied to the field name
      const expected = renameAll ? fieldName.replace(/^r#/, '') : fieldName;
      const rename = expected !== key ? key : null;
      def.fields.push({
        type: t,
        fieldName,
        rename,
        optional: optionalKeys.has(key) || value === null,
      });
    }
    structs.push(def);
    return structName;
  }

  if (Array.isArray(data)) {
    const allObjects =
      data.length > 0 &&
      data.every((e) => e !== null && typeof e === 'object' && !Array.isArray(e));
    if (allObjects) {
      const merged = mergeObjects(data as Record<string, unknown>[]);
      buildStruct(merged.fields, 'Root', merged.optionalKeys);
    } else {
      buildStruct(new Map<string, unknown>([['items', data]]), 'Root', new Set<string>());
    }
  } else if (data !== null && typeof data === 'object') {
    const fields = new Map<string, unknown>();
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) fields.set(k, v);
    buildStruct(fields, 'Root', new Set<string>());
  } else {
    throw new Error('Top-level JSON must be an object or array of objects.');
  }

  const ordered = [...structs].reverse();
  const lines: string[] = [];
  lines.push('use serde::{Deserialize, Serialize};');
  lines.push('');

  for (const def of ordered) {
    lines.push(deriveLine);
    if (renameAll) lines.push('#[serde(rename_all = "snake_case")]');
    lines.push(`pub struct ${def.name} {`);
    for (const f of def.fields) {
      if (f.rename) {
        lines.push(`    #[serde(rename = "${f.rename.replace(/"/g, '\\"')}")]`);
      }
      const ty = allOptional || f.optional ? `Option<${f.type}>` : f.type;
      lines.push(`    pub ${f.fieldName}: ${ty},`);
    }
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

export default function JsonToRustSerdeTool() {
  const [deriveLine, setDeriveLine] = useState(
    '#[derive(Serialize, Deserialize, Debug, Clone)]'
  );
  const [allOptional, setAllOptional] = useState(false);
  const [renameAll, setRenameAll] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let data: unknown;
      try {
        data = JSON.parse(input);
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : 'Invalid JSON');
      }
      const line = deriveLine.trim() || '#[derive(Serialize, Deserialize, Debug, Clone)]';
      return generate(data, line, allOptional, renameAll);
    },
    [deriveLine, allOptional, renameAll]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[deriveLine, allOptional, renameAll]}
      inputLabel="JSON"
      outputLabel="Rust Structs"
      sample={SAMPLE}
      downloadName="models.rs"
      downloadMime="text/x-rust"
      options={
        <>
          <Field label="Derive attribute" className="min-w-[320px] flex-1">
            <Input
              value={deriveLine}
              onChange={(e) => setDeriveLine(e.target.value)}
              spellCheck={false}
              className="font-mono text-xs"
            />
          </Field>
          <Field label="All fields Option<T>">
            <Switch checked={allOptional} onCheckedChange={setAllOptional} />
          </Field>
          <Field label="rename_all snake_case">
            <Switch checked={renameAll} onCheckedChange={setRenameAll} />
          </Field>
        </>
      }
    />
  );
}
