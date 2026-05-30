'use client';

import { useCallback, useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

type Kind = 'class' | 'record';
type Attr = 'stj' | 'newtonsoft';

interface Opts {
  kind: Kind;
  attr: Attr;
  nullableRefs: boolean;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pascalCase(name: string): string {
  const parts = name.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (parts.length === 0) return 'Field';
  const out = parts
    .map((p) => {
      const first = p.charAt(0).toUpperCase();
      return first + p.slice(1);
    })
    .join('');
  // C# identifiers cannot start with a digit.
  return /^[0-9]/.test(out) ? `_${out}` : out;
}

function singularize(name: string): string {
  if (/ies$/i.test(name)) return name.replace(/ies$/i, 'y');
  if (/ses$/i.test(name)) return name.replace(/es$/i, '');
  if (/s$/i.test(name) && !/ss$/i.test(name)) return name.replace(/s$/i, '');
  return name;
}

function numberType(values: number[]): string {
  const allInts = values.every((n) => Number.isInteger(n));
  if (!allInts) return 'double';
  const fitsInt = values.every((n) => n >= -2147483648 && n <= 2147483647);
  return fitsInt ? 'int' : 'long';
}

interface ClassDef {
  name: string;
  fields: Array<{ jsonKey: string; propName: string; type: string }>;
}

export default function JsonToCSharpTool() {
  const [kind, setKind] = useState<Kind>('class');
  const [attr, setAttr] = useState<Attr>('stj');
  const [nullableRefs, setNullableRefs] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let parsed: unknown;
      try {
        parsed = JSON.parse(input);
      } catch (e) {
        throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
      }

      const opts: Opts = { kind, attr, nullableRefs };
      const classes: ClassDef[] = [];
      const usedNames = new Set<string>();

      const uniqueName = (base: string): string => {
        let name = pascalCase(base) || 'Item';
        let n = 2;
        while (usedNames.has(name)) {
          name = `${pascalCase(base)}${n}`;
          n += 1;
        }
        usedNames.add(name);
        return name;
      };

      // Determine the C# type for a sample value, registering nested classes as needed.
      const typeForValue = (value: unknown, nameHint: string): string => {
        if (value === null) return opts.nullableRefs ? 'object?' : 'object';
        if (Array.isArray(value)) {
          if (value.length === 0) return 'List<object>';
          // Merge object elements; otherwise infer the element scalar type.
          const objects = value.filter(isPlainObject);
          if (objects.length === value.length) {
            const itemType = buildClassFromObjects(objects, singularize(nameHint));
            return `List<${itemType}>`;
          }
          const numbers = value.filter((v): v is number => typeof v === 'number');
          if (numbers.length === value.length) return `List<${numberType(numbers)}>`;
          if (value.every((v) => typeof v === 'string')) return 'List<string>';
          if (value.every((v) => typeof v === 'boolean')) return 'List<bool>';
          return 'List<object>';
        }
        if (isPlainObject(value)) {
          return buildClassFromObjects([value], nameHint);
        }
        switch (typeof value) {
          case 'string':
            return 'string';
          case 'boolean':
            return 'bool';
          case 'number':
            return numberType([value]);
          default:
            return 'object';
        }
      };

      // Build (or reuse) a class merging the keys of one or more sample objects.
      const buildClassFromObjects = (objects: Record<string, unknown>[], nameHint: string): string => {
        const className = uniqueName(nameHint);
        const keys: string[] = [];
        const seen = new Set<string>();
        for (const obj of objects) {
          for (const k of Object.keys(obj)) {
            if (!seen.has(k)) {
              seen.add(k);
              keys.push(k);
            }
          }
        }
        const usedProps = new Set<string>();
        const fields = keys.map((key) => {
          // Pick the first non-null sample for this key to infer the type.
          let sample: unknown = null;
          for (const obj of objects) {
            if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== null) {
              sample = obj[key];
              break;
            }
          }
          let propName = pascalCase(key);
          let pn = propName;
          let n = 2;
          while (usedProps.has(pn)) {
            pn = `${propName}${n}`;
            n += 1;
          }
          propName = pn;
          usedProps.add(propName);
          const type = sample === null ? (opts.nullableRefs ? 'object?' : 'object') : typeForValue(sample, key);
          return { jsonKey: key, propName, type };
        });
        classes.push({ name: className, fields });
        return className;
      };

      let rootType: string;
      if (Array.isArray(parsed)) {
        const objs = parsed.filter(isPlainObject);
        if (objs.length === parsed.length && objs.length > 0) {
          rootType = `List<${buildClassFromObjects(objs, 'Root')}>`;
        } else {
          rootType = typeForValue(parsed, 'Root');
        }
      } else if (isPlainObject(parsed)) {
        rootType = buildClassFromObjects([parsed], 'Root');
      } else {
        throw new Error('Provide a JSON object or array of objects.');
      }

      const propAttr = (jsonKey: string, propName: string): string | null => {
        if (jsonKey === propName) return null;
        return opts.attr === 'stj'
          ? `    [JsonPropertyName("${jsonKey}")]`
          : `    [JsonProperty("${jsonKey}")]`;
      };

      const usings =
        opts.attr === 'stj'
          ? 'using System.Collections.Generic;\nusing System.Text.Json.Serialization;'
          : 'using System.Collections.Generic;\nusing Newtonsoft.Json;';

      const blocks: string[] = [];
      // Emit in declaration order; root is the first class added (when object root).
      for (const def of classes) {
        const lines: string[] = [];
        if (opts.kind === 'record') {
          lines.push(`public record ${def.name}`);
          lines.push('{');
        } else {
          lines.push(`public class ${def.name}`);
          lines.push('{');
        }
        for (const f of def.fields) {
          const a = propAttr(f.jsonKey, f.propName);
          if (a) lines.push(a);
          lines.push(`    public ${f.type} ${f.propName} { get; set; }`);
        }
        lines.push('}');
        blocks.push(lines.join('\n'));
      }

      const header = `// Root type: ${rootType}`;
      return `${usings}\n\n${header}\n\n${blocks.join('\n\n')}\n`;
    },
    [kind, attr, nullableRefs],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[kind, attr, nullableRefs]}
      inputLabel="JSON sample"
      outputLabel="C# source"
      sample={JSON.stringify(
        {
          id: 42,
          full_name: 'Ada Lovelace',
          score: 9.5,
          active: true,
          tags: ['math', 'computing'],
          address: { city: 'London', zip: 'EC1' },
        },
        null,
        2,
      )}
      downloadName="Models.cs"
      downloadMime="text/plain"
      options={
        <>
          <Field label="Type">
            <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
              <TabsList>
                <TabsTrigger value="class">Class</TabsTrigger>
                <TabsTrigger value="record">Record</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Attributes">
            <Tabs value={attr} onValueChange={(v) => setAttr(v as Attr)}>
              <TabsList>
                <TabsTrigger value="stj">System.Text.Json</TabsTrigger>
                <TabsTrigger value="newtonsoft">Newtonsoft</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Nullable refs">
            <Switch checked={nullableRefs} onCheckedChange={setNullableRefs} />
          </Field>
        </>
      }
    />
  );
}
