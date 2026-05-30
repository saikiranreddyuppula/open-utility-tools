'use client';

import { useCallback, useState } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SAMPLE = JSON.stringify(
  {
    id: 1,
    userName: 'ada',
    score: 9.5,
    active: true,
    tags: ['a', 'b'],
    profile: { city: 'London', verified: true },
    'meta-data': null,
  },
  null,
  2
);

type Version = 'v2' | 'v1';

const RESERVED = new Set([
  'False','None','True','and','as','assert','async','await','break','class','continue',
  'def','del','elif','else','except','finally','for','from','global','if','import','in',
  'is','lambda','nonlocal','not','or','pass','raise','return','try','while','with','yield',
]);

function isIdent(key: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && !RESERVED.has(key);
}

function pascalCase(key: string): string {
  const parts = key.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const joined = parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
  const out = joined || 'Field';
  return /^[0-9]/.test(out) ? `M${out}` : out;
}

function pyLiteral(v: unknown): string {
  if (v === null) return 'None';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'None';
  if (typeof v === 'string') return JSON.stringify(v).replace(/^"|"$/g, "'");
  if (Array.isArray(v)) return `[${v.map(pyLiteral).join(', ')}]`;
  return 'None';
}

interface FieldInfo {
  type: string;
  optional: boolean;
  sample: unknown;
}

interface ClassDef {
  name: string;
  fields: Map<string, FieldInfo>;
}

function generate(
  data: unknown,
  version: Version,
  allOptional: boolean,
  includeDefaults: boolean
): string {
  const classes: ClassDef[] = [];
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

  // returns the python type string for a value at the given key context
  function typeOf(value: unknown, keyHint: string): string {
    if (value === null) return 'Any';
    if (typeof value === 'string') return 'str';
    if (typeof value === 'boolean') return 'bool';
    if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float';
    if (Array.isArray(value)) {
      if (value.length === 0) return 'List[Any]';
      // merge object elements; else use first element's type
      const allObjects = value.every(
        (e) => e !== null && typeof e === 'object' && !Array.isArray(e)
      );
      if (allObjects) {
        const merged = mergeObjects(value as Record<string, unknown>[]);
        const cls = buildClass(merged.fields, keyHint, merged.optionalKeys);
        return `List[${cls}]`;
      }
      const first = value[0];
      return `List[${typeOf(first, keyHint)}]`;
    }
    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const fields = new Map<string, unknown>();
      for (const [k, v] of Object.entries(obj)) fields.set(k, v);
      const cls = buildClass(fields, keyHint, new Set<string>());
      return cls;
    }
    return 'Any';
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
        if (!fields.has(k) || (fields.get(k) === null && v !== null)) {
          fields.set(k, v);
        }
      }
    }
    const optionalKeys = new Set<string>();
    for (const [k, count] of seen) {
      if (count < items.length) optionalKeys.add(k);
    }
    return { fields, optionalKeys };
  }

  function buildClass(
    fields: Map<string, unknown>,
    keyHint: string,
    optionalKeys: Set<string>
  ): string {
    const className = uniqueName(pascalCase(keyHint));
    const def: ClassDef = { name: className, fields: new Map() };
    for (const [key, value] of fields) {
      const t = typeOf(value, key);
      const optional = optionalKeys.has(key) || value === null;
      def.fields.set(key, { type: t, optional, sample: value });
    }
    classes.push(def);
    return className;
  }

  // top-level: if array, treat element type; if object, build Root
  let rootType = 'Root';
  if (Array.isArray(data)) {
    const allObjects =
      data.length > 0 &&
      data.every((e) => e !== null && typeof e === 'object' && !Array.isArray(e));
    if (allObjects) {
      const merged = mergeObjects(data as Record<string, unknown>[]);
      rootType = buildClass(merged.fields, 'Root', merged.optionalKeys);
    } else {
      // not an object array; wrap into a model with an `items` field
      const fields = new Map<string, unknown>([['items', data]]);
      rootType = buildClass(fields, 'Root', new Set<string>());
    }
  } else if (data !== null && typeof data === 'object') {
    const fields = new Map<string, unknown>();
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      fields.set(k, v);
    }
    rootType = buildClass(fields, 'Root', new Set<string>());
  } else {
    throw new Error('Top-level JSON must be an object or array of objects.');
  }

  // emit classes in reverse so child classes appear before parents
  const ordered = [...classes].reverse();
  const lines: string[] = [];
  if (version === 'v2') {
    lines.push('from typing import Any, List, Optional');
    lines.push('from pydantic import BaseModel, ConfigDict, Field');
  } else {
    lines.push('from typing import Any, List, Optional');
    lines.push('from pydantic import BaseModel, Field');
  }
  lines.push('');

  for (const def of ordered) {
    lines.push(`class ${def.name}(BaseModel):`);
    let needsConfig = false;
    const body: string[] = [];
    if (def.fields.size === 0) {
      body.push('    pass');
    }
    for (const [key, info] of def.fields) {
      const ident = isIdent(key);
      const fieldName = ident ? key : pascalCase(key).replace(/^([A-Z])/, (m) => m.toLowerCase());
      const optional = allOptional || info.optional;
      const baseType = info.type;
      const annotated = optional ? `Optional[${baseType}]` : baseType;
      const fieldArgs: string[] = [];
      if (!ident) {
        needsConfig = true;
        fieldArgs.push(`alias='${key.replace(/'/g, "\\'")}'`);
      }
      let defaultExpr = '';
      if (includeDefaults && info.sample !== null && typeof info.sample !== 'object') {
        if (!ident) {
          fieldArgs.push(`default=${pyLiteral(info.sample)}`);
        } else {
          defaultExpr = ` = ${pyLiteral(info.sample)}`;
        }
      } else if (optional) {
        if (!ident) {
          fieldArgs.push('default=None');
        } else {
          defaultExpr = ' = None';
        }
      }
      if (fieldArgs.length > 0) {
        body.push(`    ${fieldName}: ${annotated} = Field(${fieldArgs.join(', ')})`);
      } else {
        body.push(`    ${fieldName}: ${annotated}${defaultExpr}`);
      }
    }
    if (needsConfig) {
      if (version === 'v2') {
        lines.push('    model_config = ConfigDict(populate_by_name=True)');
      } else {
        lines.push('    class Config:');
        lines.push('        allow_population_by_field_name = True');
      }
      lines.push('');
    }
    lines.push(...body);
    lines.push('');
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

export default function JsonToPydanticTool() {
  const [version, setVersion] = useState<Version>('v2');
  const [allOptional, setAllOptional] = useState(false);
  const [includeDefaults, setIncludeDefaults] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let data: unknown;
      try {
        data = JSON.parse(input);
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : 'Invalid JSON');
      }
      return generate(data, version, allOptional, includeDefaults);
    },
    [version, allOptional, includeDefaults]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[version, allOptional, includeDefaults]}
      inputLabel="JSON"
      outputLabel="Pydantic Model"
      sample={SAMPLE}
      downloadName="models.py"
      downloadMime="text/x-python"
      options={
        <>
          <Field label="Syntax">
            <Tabs value={version} onValueChange={(v) => setVersion(v as Version)}>
              <TabsList>
                <TabsTrigger value="v2">Pydantic v2</TabsTrigger>
                <TabsTrigger value="v1">Pydantic v1</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="All optional">
            <Switch checked={allOptional} onCheckedChange={setAllOptional} />
          </Field>
          <Field label="Values as defaults">
            <Switch checked={includeDefaults} onCheckedChange={setIncludeDefaults} />
          </Field>
        </>
      }
    />
  );
}
