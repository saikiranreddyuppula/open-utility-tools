'use client';

import { useCallback, useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const SAMPLE = `{
  "id": 1,
  "name": "Ada Lovelace",
  "active": true,
  "score": 9.5,
  "nickname": null,
  "tags": ["dev", "math"],
  "address": { "city": "London", "zip": "EC1" }
}`;

function isPlainObject(v: Json): v is { [key: string]: Json } {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pascalCase(key: string): string {
  const parts = key.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (parts.length === 0) return 'Item';
  const out = parts
    .map((p) => {
      const first = p.charAt(0).toUpperCase();
      return first + p.slice(1);
    })
    .join('');
  return /^[0-9]/.test(out) ? `N${out}` : out;
}

function isDartIdentifier(key: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);
}

interface Options {
  nullSafety: boolean;
  finalFields: boolean;
  constCtor: boolean;
}

interface ClassDef {
  name: string;
  fields: FieldDef[];
}

interface FieldDef {
  jsonKey: string;
  dartName: string;
  type: string; // dart type WITHOUT trailing '?'
  nullable: boolean;
  isList: boolean;
  elementClass: string | null; // class name when list/object of a nested class
  isClass: boolean;
}

// Infer a scalar Dart type for a non-object, non-array value.
function scalarType(v: Json): string {
  switch (typeof v) {
    case 'string':
      return 'String';
    case 'boolean':
      return 'bool';
    case 'number':
      return Number.isInteger(v) ? 'int' : 'double';
    default:
      return 'dynamic';
  }
}

function build(
  obj: { [key: string]: Json },
  className: string,
  classes: ClassDef[],
  seen: Set<string>
): void {
  if (seen.has(className)) return;
  seen.add(className);
  const fields: FieldDef[] = [];

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value === undefined) continue;
    const dartName = isDartIdentifier(key) ? key : pascalCase(key).charAt(0).toLowerCase() + pascalCase(key).slice(1);

    if (value === null) {
      fields.push({
        jsonKey: key,
        dartName: dartName || 'value',
        type: 'dynamic',
        nullable: true,
        isList: false,
        elementClass: null,
        isClass: false,
      });
      continue;
    }

    if (isPlainObject(value)) {
      const nested = pascalCase(key);
      build(value, nested, classes, seen);
      fields.push({
        jsonKey: key,
        dartName: dartName || 'value',
        type: nested,
        nullable: false,
        isList: false,
        elementClass: nested,
        isClass: true,
      });
      continue;
    }

    if (Array.isArray(value)) {
      const first = value[0];
      if (first !== undefined && isPlainObject(first)) {
        const nested = pascalCase(key.replace(/s$/, '') || key);
        build(first, nested, classes, seen);
        fields.push({
          jsonKey: key,
          dartName: dartName || 'value',
          type: `List<${nested}>`,
          nullable: false,
          isList: true,
          elementClass: nested,
          isClass: false,
        });
      } else {
        const elemType = first === undefined ? 'dynamic' : scalarType(first);
        fields.push({
          jsonKey: key,
          dartName: dartName || 'value',
          type: `List<${elemType}>`,
          nullable: false,
          isList: true,
          elementClass: null,
          isClass: false,
        });
      }
      continue;
    }

    fields.push({
      jsonKey: key,
      dartName: dartName || 'value',
      type: scalarType(value),
      nullable: false,
      isList: false,
      elementClass: null,
      isClass: false,
    });
  }

  classes.push({ name: className, fields });
}

function fromJsonExpr(f: FieldDef, opt: Options): string {
  const access = `json['${f.jsonKey}']`;
  const q = opt.nullSafety && f.nullable ? '?' : '';
  if (f.isClass && f.elementClass) {
    return `${f.elementClass}.fromJson(${access} as Map<String, dynamic>)`;
  }
  if (f.isList) {
    if (f.elementClass) {
      return `(${access} as List<dynamic>)
          .map((e) => ${f.elementClass}.fromJson(e as Map<String, dynamic>))
          .toList()`;
    }
    return `${q ? `${access} == null
          ? null
          : ` : ''}(${access} as List<dynamic>).cast<${f.type.slice(5, -1)}>()`;
  }
  return `${access} as ${f.type}${opt.nullSafety && f.nullable ? '?' : ''}`;
}

function toJsonExpr(f: FieldDef): string {
  if (f.isClass) return `${f.dartName}.toJson()`;
  if (f.isList && f.elementClass) return `${f.dartName}.map((e) => e.toJson()).toList()`;
  return f.dartName;
}

function emitClass(c: ClassDef, opt: Options): string {
  const lines: string[] = [];
  lines.push(`class ${c.name} {`);

  // field declarations
  for (const f of c.fields) {
    const q = opt.nullSafety && f.nullable ? '?' : '';
    const mod = opt.finalFields ? 'final ' : '';
    lines.push(`  ${mod}${f.type}${q} ${f.dartName};`);
  }
  lines.push('');

  // constructor
  const ctorKw = opt.constCtor ? 'const ' : '';
  if (c.fields.length === 0) {
    lines.push(`  ${ctorKw}${c.name}();`);
  } else {
    lines.push(`  ${ctorKw}${c.name}({`);
    for (const f of c.fields) {
      const req = opt.nullSafety && !f.nullable ? 'required ' : '';
      lines.push(`    ${req}this.${f.dartName},`);
    }
    lines.push('  });');
  }
  lines.push('');

  // fromJson
  lines.push(`  factory ${c.name}.fromJson(Map<String, dynamic> json) {`);
  lines.push(`    return ${c.name}(`);
  for (const f of c.fields) {
    lines.push(`      ${f.dartName}: ${fromJsonExpr(f, opt)},`);
  }
  lines.push('    );');
  lines.push('  }');
  lines.push('');

  // toJson
  lines.push('  Map<String, dynamic> toJson() {');
  lines.push('    return {');
  for (const f of c.fields) {
    lines.push(`      '${f.jsonKey}': ${toJsonExpr(f)},`);
  }
  lines.push('    };');
  lines.push('  }');
  lines.push('}');

  return lines.join('\n');
}

function generate(data: Json, opt: Options): string {
  if (!isPlainObject(data)) {
    if (Array.isArray(data)) {
      const first = data[0];
      if (first !== undefined && isPlainObject(first)) {
        const classes: ClassDef[] = [];
        build(first, 'Item', classes, new Set<string>());
        return classes.map((c) => emitClass(c, opt)).join('\n\n') + '\n';
      }
    }
    throw new Error('Top-level JSON must be an object (or an array of objects) to generate Dart classes.');
  }
  const classes: ClassDef[] = [];
  build(data, 'Root', classes, new Set<string>());
  return classes.map((c) => emitClass(c, opt)).join('\n\n') + '\n';
}

export default function JsonToDartTool() {
  const [nullSafety, setNullSafety] = useState(true);
  const [finalFields, setFinalFields] = useState(true);
  const [constCtor, setConstCtor] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let parsed: Json;
      try {
        parsed = JSON.parse(input) as Json;
      } catch (e) {
        throw new Error(`Invalid JSON: ${(e as Error).message}`);
      }
      return generate(parsed, { nullSafety, finalFields, constCtor });
    },
    [nullSafety, finalFields, constCtor]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[nullSafety, finalFields, constCtor]}
      inputLabel="JSON"
      outputLabel="Dart"
      inputPlaceholder="Paste a JSON object..."
      sample={SAMPLE}
      downloadName="models.dart"
      downloadMime="text/x-dart"
      options={
        <>
          <Field label="Null safety">
            <Switch checked={nullSafety} onCheckedChange={setNullSafety} />
          </Field>
          <Field label="Final fields">
            <Switch checked={finalFields} onCheckedChange={setFinalFields} />
          </Field>
          <Field label="const constructor">
            <Switch checked={constCtor} onCheckedChange={setConstCtor} />
          </Field>
        </>
      }
    />
  );
}
