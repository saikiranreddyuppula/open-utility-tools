'use client';

import { useCallback, useState } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';

const SAMPLE = JSON.stringify(
  {
    id: 1,
    name: 'Ada',
    score: 9.5,
    active: true,
    tags: ['a', 'b'],
    address: { city: 'London', zip: null },
  },
  null,
  2
);

const RESERVED = new Set([
  'False','None','True','and','as','assert','async','await','break','class','continue',
  'def','del','elif','else','except','finally','for','from','global','if','import','in',
  'is','lambda','nonlocal','not','or','pass','raise','return','try','while','with','yield',
]);

function isIdent(key: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && !RESERVED.has(key);
}

function sanitizeField(key: string): string {
  let s = key.replace(/[^A-Za-z0-9_]/g, '_');
  if (/^[0-9]/.test(s)) s = `_${s}`;
  if (!s) s = 'field_';
  if (RESERVED.has(s)) s = `${s}_`;
  return s;
}

function pascalCase(key: string): string {
  const parts = key.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const joined = parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
  const out = joined || 'Field';
  return /^[0-9]/.test(out) ? `M${out}` : out;
}

interface FieldInfo {
  type: string;
  optional: boolean;
  mutableDefault: 'list' | 'dict' | null;
  renamedFrom: string | null;
}

interface ClassDef {
  name: string;
  fields: Map<string, FieldInfo>;
}

function generate(
  data: unknown,
  optionalNullable: boolean,
  futureAnnotations: boolean,
  pep585: boolean
): string {
  const listT = (inner: string): string => (pep585 ? `list[${inner}]` : `List[${inner}]`);
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

  function elementType(value: unknown, keyHint: string): string {
    if (value === null) return 'Any';
    if (typeof value === 'string') return 'str';
    if (typeof value === 'boolean') return 'bool';
    if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float';
    if (Array.isArray(value)) {
      if (value.length === 0) return listT('Any');
      const allObjects = value.every(
        (e) => e !== null && typeof e === 'object' && !Array.isArray(e)
      );
      if (allObjects) {
        const merged = mergeObjects(value as Record<string, unknown>[]);
        return listT(buildClass(merged.fields, keyHint, merged.optionalKeys));
      }
      return listT(elementType(value[0], keyHint));
    }
    if (typeof value === 'object') {
      const fields = new Map<string, unknown>();
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        fields.set(k, v);
      }
      return buildClass(fields, keyHint, new Set<string>());
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
        if (!fields.has(k) || (fields.get(k) === null && v !== null)) fields.set(k, v);
      }
    }
    const optionalKeys = new Set<string>();
    for (const [k, count] of seen) if (count < items.length) optionalKeys.add(k);
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
      const t = elementType(value, key);
      const nullable = value === null || optionalKeys.has(key);
      let mutableDefault: 'list' | 'dict' | null = null;
      if (Array.isArray(value)) mutableDefault = 'list';
      else if (value !== null && typeof value === 'object') mutableDefault = null; // nested dataclass, no factory
      const ident = isIdent(key);
      const fieldName = ident ? key : sanitizeField(key);
      def.fields.set(fieldName, {
        type: t,
        optional: nullable,
        mutableDefault,
        renamedFrom: ident ? null : key,
      });
    }
    classes.push(def);
    return className;
  }

  if (Array.isArray(data)) {
    const allObjects =
      data.length > 0 &&
      data.every((e) => e !== null && typeof e === 'object' && !Array.isArray(e));
    if (allObjects) {
      const merged = mergeObjects(data as Record<string, unknown>[]);
      buildClass(merged.fields, 'Root', merged.optionalKeys);
    } else {
      buildClass(new Map<string, unknown>([['items', data]]), 'Root', new Set<string>());
    }
  } else if (data !== null && typeof data === 'object') {
    const fields = new Map<string, unknown>();
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) fields.set(k, v);
    buildClass(fields, 'Root', new Set<string>());
  } else {
    throw new Error('Top-level JSON must be an object or array of objects.');
  }

  const ordered = [...classes].reverse();
  const lines: string[] = [];
  if (futureAnnotations) lines.push('from __future__ import annotations');
  lines.push('from dataclasses import dataclass, field');
  if (pep585) {
    lines.push('from typing import Any, Optional');
  } else {
    lines.push('from typing import Any, List, Optional');
  }
  lines.push('');

  for (const def of ordered) {
    lines.push('@dataclass');
    lines.push(`class ${def.name}:`);
    if (def.fields.size === 0) {
      lines.push('    pass');
      lines.push('');
      continue;
    }
    // dataclass ordering: non-default fields first, then defaulted
    const noDefault: string[] = [];
    const withDefault: string[] = [];
    for (const [name, info] of def.fields) {
      const optional = optionalNullable && info.optional;
      const annotated = optional ? `Optional[${info.type}]` : info.type;
      const comment = info.renamedFrom ? `  # was '${info.renamedFrom}'` : '';
      if (info.mutableDefault === 'list') {
        withDefault.push(`    ${name}: ${annotated} = field(default_factory=list)${comment}`);
      } else if (optional) {
        withDefault.push(`    ${name}: ${annotated} = None${comment}`);
      } else {
        noDefault.push(`    ${name}: ${annotated}${comment}`);
      }
    }
    lines.push(...noDefault, ...withDefault);
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

export default function JsonToPythonDataclassTool() {
  const [optionalNullable, setOptionalNullable] = useState(true);
  const [futureAnnotations, setFutureAnnotations] = useState(false);
  const [pep585, setPep585] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let data: unknown;
      try {
        data = JSON.parse(input);
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : 'Invalid JSON');
      }
      return generate(data, optionalNullable, futureAnnotations, pep585);
    },
    [optionalNullable, futureAnnotations, pep585]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[optionalNullable, futureAnnotations, pep585]}
      inputLabel="JSON"
      outputLabel="Python Dataclass"
      sample={SAMPLE}
      downloadName="models.py"
      downloadMime="text/x-python"
      options={
        <>
          <Field label="Optional for nullable">
            <Switch checked={optionalNullable} onCheckedChange={setOptionalNullable} />
          </Field>
          <Field label="future annotations">
            <Switch checked={futureAnnotations} onCheckedChange={setFutureAnnotations} />
          </Field>
          <Field label="PEP 585 (list[T])">
            <Switch checked={pep585} onCheckedChange={setPep585} />
          </Field>
        </>
      }
    />
  );
}
