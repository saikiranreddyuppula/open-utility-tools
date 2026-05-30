'use client';

import { useCallback, useState } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SAMPLE = JSON.stringify(
  {
    id: 1,
    user_name: 'ada',
    score: 9.5,
    isActive: true,
    tags: ['a', 'b'],
    profile: { city: 'London', follower_count: 12 },
  },
  null,
  2
);

const RESERVED = new Set([
  'associatedtype','class','deinit','enum','extension','fileprivate','func','import','init',
  'inout','internal','let','open','operator','private','protocol','public','rethrows','static',
  'struct','subscript','typealias','var','break','case','continue','default','defer','do',
  'else','fallthrough','for','guard','if','in','repeat','return','switch','where','while',
  'as','catch','dynamicType','false','is','nil','self','Self','super','throw','throws','true',
  'try','Type','Any','Protocol',
]);

function camelCase(key: string): string {
  const parts = key.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (parts.length === 0) return 'field';
  const out = parts
    .map((p, i) => {
      if (i === 0) {
        // keep existing camel; lowercase first char if it is all-caps acronym start
        return p.charAt(0).toLowerCase() + p.slice(1);
      }
      return p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join('');
  let name = out || 'field';
  if (/^[0-9]/.test(name)) name = `_${name}`;
  if (RESERVED.has(name)) name = `\`${name}\``;
  return name;
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
  property: string; // swift property name (may be backticked)
  rawProperty: string; // without backticks, for CodingKeys lhs
  jsonKey: string;
  optional: boolean;
}

interface StructDef {
  name: string;
  fields: FieldInfo[];
}

function generate(
  data: unknown,
  useLet: boolean,
  optionalNullable: boolean,
  alwaysCodingKeys: boolean
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

  function swiftType(value: unknown, keyHint: string): string {
    if (value === null) return 'String';
    if (typeof value === 'string') return 'String';
    if (typeof value === 'boolean') return 'Bool';
    if (typeof value === 'number') return Number.isInteger(value) ? 'Int' : 'Double';
    if (Array.isArray(value)) {
      if (value.length === 0) return '[String]';
      const allObjects = value.every(
        (e) => e !== null && typeof e === 'object' && !Array.isArray(e)
      );
      if (allObjects) {
        const merged = mergeObjects(value as Record<string, unknown>[]);
        return `[${buildStruct(merged.fields, keyHint, merged.optionalKeys)}]`;
      }
      return `[${swiftType(value[0], keyHint)}]`;
    }
    if (typeof value === 'object') {
      const fields = new Map<string, unknown>();
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) fields.set(k, v);
      return buildStruct(fields, keyHint, new Set<string>());
    }
    return 'String';
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
      const t = swiftType(value, key);
      const property = camelCase(key);
      const rawProperty = property.replace(/`/g, '');
      def.fields.push({
        type: t,
        property,
        rawProperty,
        jsonKey: key,
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
  const keyword = useLet ? 'let' : 'var';

  for (const def of ordered) {
    lines.push(`struct ${def.name}: Codable {`);
    for (const f of def.fields) {
      const ty = optionalNullable && f.optional ? `${f.type}?` : f.type;
      lines.push(`    ${keyword} ${f.property}: ${ty}`);
    }
    const needsKeys = def.fields.some((f) => f.rawProperty !== f.jsonKey);
    if (needsKeys || alwaysCodingKeys) {
      lines.push('');
      lines.push('    enum CodingKeys: String, CodingKey {');
      for (const f of def.fields) {
        if (f.rawProperty === f.jsonKey) {
          lines.push(`        case ${f.property}`);
        } else {
          lines.push(`        case ${f.property} = "${f.jsonKey.replace(/"/g, '\\"')}"`);
        }
      }
      lines.push('    }');
    }
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

type CodingKeysMode = 'auto' | 'always';

export default function JsonToSwiftCodableTool() {
  const [useLet, setUseLet] = useState(true);
  const [optionalNullable, setOptionalNullable] = useState(true);
  const [keysMode, setKeysMode] = useState<CodingKeysMode>('auto');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let data: unknown;
      try {
        data = JSON.parse(input);
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : 'Invalid JSON');
      }
      return generate(data, useLet, optionalNullable, keysMode === 'always');
    },
    [useLet, optionalNullable, keysMode]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[useLet, optionalNullable, keysMode]}
      inputLabel="JSON"
      outputLabel="Swift Codable"
      sample={SAMPLE}
      downloadName="Models.swift"
      downloadMime="text/x-swift"
      options={
        <>
          <Field label="Use let (immutable)">
            <Switch checked={useLet} onCheckedChange={setUseLet} />
          </Field>
          <Field label="Optional for nullable">
            <Switch checked={optionalNullable} onCheckedChange={setOptionalNullable} />
          </Field>
          <Field label="CodingKeys">
            <Tabs value={keysMode} onValueChange={(v) => setKeysMode(v as CodingKeysMode)}>
              <TabsList>
                <TabsTrigger value="auto">When needed</TabsTrigger>
                <TabsTrigger value="always">Always</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </>
      }
    />
  );
}
