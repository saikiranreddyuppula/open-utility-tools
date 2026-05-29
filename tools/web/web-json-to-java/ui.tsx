'use client';

import { useCallback, useMemo, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const SAMPLE = JSON.stringify(
  {
    id: 42,
    name: 'Ada',
    active: true,
    score: 9.5,
    tags: ['admin', 'editor'],
    address: { city: 'London', zipCode: 'EC1' },
    roles: [{ name: 'owner', level: 3 }],
  },
  null,
  2,
);

function capitalize(s: string): string {
  if (s.length === 0) return s;
  return (s[0] ?? '').toUpperCase() + s.slice(1);
}

/** Turn an arbitrary key into a PascalCase class-name fragment. */
function toPascalCase(key: string): string {
  const parts = key
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+|(?<=[a-z0-9])(?=[A-Z])/);
  const joined = parts.map((p) => capitalize(p.toLowerCase())).join('');
  if (joined.length === 0) return 'Field';
  return /^[0-9]/.test(joined) ? `_${joined}` : joined;
}

/** Make a key safe + camelCase for use as a Java field identifier. */
function toFieldName(key: string): string {
  const pascal = toPascalCase(key);
  const camel = (pascal[0] ?? '').toLowerCase() + pascal.slice(1);
  return /^[0-9]/.test(camel) ? `_${camel}` : camel;
}

interface ClassDef {
  name: string;
  fields: { name: string; type: string }[];
}

export default function JsonToJavaTool() {
  const [rootName, setRootName] = useState('Root');
  const [withAccessors, setWithAccessors] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';

      let parsed: JsonValue;
      try {
        parsed = JSON.parse(input) as JsonValue;
      } catch (err) {
        throw new Error(
          `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      const rootClassName = toPascalCase(rootName || 'Root');
      const classes: ClassDef[] = [];
      const usedNames = new Set<string>();

      const uniqueName = (base: string): string => {
        let name = base;
        let i = 2;
        while (usedNames.has(name)) {
          name = `${base}${i}`;
          i += 1;
        }
        usedNames.add(name);
        return name;
      };

      // Returns the Java type for a value, registering nested classes as needed.
      // Declared as a hoisted function so it can mutually recurse with buildClass.
      function javaType(value: JsonValue, nameHint: string): string {
        if (value === null) return 'Object';
        if (Array.isArray(value)) {
          if (value.length === 0) return 'List<Object>';
          // Element type from the first element (singularize the hint).
          const singular = nameHint.replace(/s$/i, '') || nameHint;
          const first = value[0];
          const elemType =
            first === undefined ? 'Object' : javaType(first, singular);
          return `List<${elemType}>`;
        }
        if (typeof value === 'object') {
          return buildClass(value as { [key: string]: JsonValue }, nameHint);
        }
        if (typeof value === 'boolean') return 'Boolean';
        if (typeof value === 'number') {
          return Number.isInteger(value) ? 'Long' : 'Double';
        }
        return 'String';
      }

      function buildClass(
        obj: { [key: string]: JsonValue },
        nameHint: string,
      ): string {
        const className = uniqueName(toPascalCase(nameHint));
        const fields: { name: string; type: string }[] = [];
        for (const key of Object.keys(obj)) {
          const value = obj[key] as JsonValue;
          const type = javaType(value, capitalize(toFieldName(key)));
          fields.push({ name: toFieldName(key), type });
        }
        classes.push({ name: className, fields });
        return className;
      }

      if (
        parsed === null ||
        typeof parsed !== 'object' ||
        Array.isArray(parsed)
      ) {
        throw new Error('Top-level JSON must be an object to build a class.');
      }

      buildClass(parsed as { [key: string]: JsonValue }, rootClassName);

      const renderClass = (def: ClassDef): string => {
        const lines: string[] = [];
        lines.push(`public class ${def.name} {`);
        for (const f of def.fields) {
          lines.push(`    private ${f.type} ${f.name};`);
        }
        if (withAccessors && def.fields.length > 0) {
          lines.push('');
          for (const f of def.fields) {
            const cap = capitalize(f.name);
            lines.push(`    public ${f.type} get${cap}() {`);
            lines.push(`        return ${f.name};`);
            lines.push('    }');
            lines.push('');
            lines.push(`    public void set${cap}(${f.type} ${f.name}) {`);
            lines.push(`        this.${f.name} = ${f.name};`);
            lines.push('    }');
            lines.push('');
          }
          // Drop the trailing blank line before the closing brace.
          if (lines[lines.length - 1] === '') lines.pop();
        }
        lines.push('}');
        return lines.join('\n');
      };

      // Root first, then nested classes in discovery order.
      const ordered = [...classes].reverse();
      const header = 'import java.util.List;\n';
      return header + '\n' + ordered.map(renderClass).join('\n\n') + '\n';
    },
    [rootName, withAccessors],
  );

  const options = useMemo(
    () => (
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Root class name">
          <Input
            value={rootName}
            onChange={(e) => setRootName(e.target.value)}
            placeholder="Root"
            className="w-40"
          />
        </Field>
        <Field label="Getters & setters">
          <Switch checked={withAccessors} onCheckedChange={setWithAccessors} />
        </Field>
      </div>
    ),
    [rootName, withAccessors],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[rootName, withAccessors]}
      inputLabel="JSON"
      outputLabel="Java classes"
      inputPlaceholder="Paste a JSON object…"
      sample={SAMPLE}
      downloadName="Root.java"
      downloadMime="text/x-java-source"
      options={options}
    />
  );
}
