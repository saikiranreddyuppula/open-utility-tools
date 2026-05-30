'use client';

import { useCallback, useState } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SAMPLE = JSON.stringify(
  {
    id: 1,
    name: 'Ada',
    score: 9.5,
    active: true,
    tags: ['a', 'b'],
    profile: { city: 'London', verified: true },
    nickname: null,
  },
  null,
  2
);

type ObjMode = 'strict' | 'passthrough' | 'default';
type NullMode = 'nullable' | 'optional';

function isIdent(key: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);
}

function keyToken(key: string): string {
  return isIdent(key) ? key : JSON.stringify(key);
}

function generate(
  data: unknown,
  objMode: ObjMode,
  coerce: boolean,
  nullMode: NullMode
): string {
  function objSuffix(): string {
    if (objMode === 'strict') return '.strict()';
    if (objMode === 'passthrough') return '.passthrough()';
    return '';
  }

  function prim(base: string): string {
    if (!coerce) return base;
    // z.coerce only applies to string/number/boolean/date
    if (base === 'z.string()') return 'z.coerce.string()';
    if (base === 'z.number()') return 'z.coerce.number()';
    if (base === 'z.number().int()') return 'z.coerce.number().int()';
    if (base === 'z.boolean()') return 'z.coerce.boolean()';
    return base;
  }

  function schemaOf(value: unknown, indent: number): string {
    if (value === null) return 'z.null()';
    if (typeof value === 'string') return prim('z.string()');
    if (typeof value === 'boolean') return prim('z.boolean()');
    if (typeof value === 'number') {
      return prim(Number.isInteger(value) ? 'z.number().int()' : 'z.number()');
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return 'z.array(z.unknown())';
      const allObjects = value.every(
        (e) => e !== null && typeof e === 'object' && !Array.isArray(e)
      );
      if (allObjects) {
        const merged = mergeObjects(value as Record<string, unknown>[]);
        return `z.array(${objectSchema(merged.fields, merged.optionalKeys, indent)})`;
      }
      const first = value[0];
      return `z.array(${schemaOf(first, indent)})`;
    }
    if (typeof value === 'object') {
      const fields = new Map<string, unknown>();
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) fields.set(k, v);
      return objectSchema(fields, new Set<string>(), indent);
    }
    return 'z.unknown()';
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

  function objectSchema(
    fields: Map<string, unknown>,
    optionalKeys: Set<string>,
    indent: number
  ): string {
    if (fields.size === 0) return `z.object({})${objSuffix()}`;
    const pad = '  '.repeat(indent + 1);
    const closePad = '  '.repeat(indent);
    const lines: string[] = [];
    for (const [key, value] of fields) {
      let s = schemaOf(value, indent + 1);
      if (value === null) {
        // already z.null(); leave as-is
      } else if (optionalKeys.has(key)) {
        s = nullMode === 'optional' ? `${s}.optional()` : `${s}.nullable()`;
      }
      lines.push(`${pad}${keyToken(key)}: ${s},`);
    }
    return `z.object({\n${lines.join('\n')}\n${closePad}})${objSuffix()}`;
  }

  let rootSchema: string;
  if (Array.isArray(data)) {
    const allObjects =
      data.length > 0 &&
      data.every((e) => e !== null && typeof e === 'object' && !Array.isArray(e));
    if (allObjects) {
      const merged = mergeObjects(data as Record<string, unknown>[]);
      rootSchema = `z.array(${objectSchema(merged.fields, merged.optionalKeys, 0)})`;
    } else {
      rootSchema = schemaOf(data, 0);
    }
  } else if (data !== null && typeof data === 'object') {
    const fields = new Map<string, unknown>();
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) fields.set(k, v);
    rootSchema = objectSchema(fields, new Set<string>(), 0);
  } else {
    rootSchema = schemaOf(data, 0);
  }

  const lines: string[] = [];
  lines.push("import { z } from 'zod';");
  lines.push('');
  lines.push(`export const Root = ${rootSchema};`);
  lines.push('');
  lines.push('export type Root = z.infer<typeof Root>;');
  return lines.join('\n') + '\n';
}

export default function JsonToZodTool() {
  const [objMode, setObjMode] = useState<ObjMode>('default');
  const [coerce, setCoerce] = useState(false);
  const [nullMode, setNullMode] = useState<NullMode>('optional');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let data: unknown;
      try {
        data = JSON.parse(input);
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : 'Invalid JSON');
      }
      return generate(data, objMode, coerce, nullMode);
    },
    [objMode, coerce, nullMode]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[objMode, coerce, nullMode]}
      inputLabel="JSON"
      outputLabel="Zod Schema"
      sample={SAMPLE}
      downloadName="schema.ts"
      downloadMime="text/typescript"
      options={
        <>
          <Field label="Objects">
            <Tabs value={objMode} onValueChange={(v) => setObjMode(v as ObjMode)}>
              <TabsList>
                <TabsTrigger value="default">Default</TabsTrigger>
                <TabsTrigger value="strict">Strict</TabsTrigger>
                <TabsTrigger value="passthrough">Passthrough</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Missing keys">
            <Tabs value={nullMode} onValueChange={(v) => setNullMode(v as NullMode)}>
              <TabsList>
                <TabsTrigger value="optional">.optional()</TabsTrigger>
                <TabsTrigger value="nullable">.nullable()</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Coerce primitives">
            <Switch checked={coerce} onCheckedChange={setCoerce} />
          </Field>
        </>
      }
    />
  );
}
