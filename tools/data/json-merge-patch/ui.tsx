'use client';

import { useCallback, useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

type Mode = 'apply' | 'generate';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** RFC 7386 merge-patch application. */
function mergePatch(target: unknown, patch: unknown): unknown {
  if (!isPlainObject(patch)) {
    // Non-object patch (including arrays, primitives, null) replaces wholesale.
    return patch;
  }
  const base: Record<string, unknown> = isPlainObject(target) ? { ...target } : {};
  for (const key of Object.keys(patch)) {
    const value = patch[key];
    if (value === null) {
      delete base[key];
    } else {
      base[key] = mergePatch(base[key], value);
    }
  }
  return base;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) {
      if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
      if (!deepEqual(a[k], b[k])) return false;
    }
    return true;
  }
  return false;
}

/** Build the minimal RFC 7386 merge-patch that turns `from` into `to`. */
function generateMergePatch(from: unknown, to: unknown): unknown {
  if (!isPlainObject(from) || !isPlainObject(to)) {
    // Replace wholesale if either side is not an object.
    return to;
  }
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(to)) {
    if (!Object.prototype.hasOwnProperty.call(from, key)) {
      patch[key] = to[key];
    } else if (!deepEqual(from[key], to[key])) {
      const fromVal = from[key];
      const toVal = to[key];
      if (isPlainObject(fromVal) && isPlainObject(toVal)) {
        patch[key] = generateMergePatch(fromVal, toVal);
      } else {
        patch[key] = toVal;
      }
    }
  }
  for (const key of Object.keys(from)) {
    if (!Object.prototype.hasOwnProperty.call(to, key)) {
      patch[key] = null;
    }
  }
  return patch;
}

const APPLY_SAMPLE = JSON.stringify(
  {
    target: { title: 'Hello', author: { name: 'Ada', email: 'ada@x.com' }, tags: ['a', 'b'] },
    patch: { title: 'Goodbye', author: { email: null }, tags: ['c'] },
  },
  null,
  2,
);

const GENERATE_SAMPLE = JSON.stringify(
  {
    source: { title: 'Hello', author: { name: 'Ada', email: 'ada@x.com' } },
    target: { title: 'Goodbye', author: { name: 'Ada' }, published: true },
  },
  null,
  2,
);

export default function JsonMergePatchTool() {
  const [mode, setMode] = useState<Mode>('apply');
  const [pretty, setPretty] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let parsed: unknown;
      try {
        parsed = JSON.parse(input);
      } catch (e) {
        throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
      }
      if (!isPlainObject(parsed)) {
        throw new Error(
          mode === 'apply'
            ? 'Provide an object with "target" and "patch" keys.'
            : 'Provide an object with "source" and "target" keys.',
        );
      }

      let result: unknown;
      if (mode === 'apply') {
        if (!('target' in parsed) || !('patch' in parsed)) {
          throw new Error('Input must contain both "target" and "patch" properties.');
        }
        result = mergePatch(parsed.target, parsed.patch);
      } else {
        if (!('source' in parsed) || !('target' in parsed)) {
          throw new Error('Input must contain both "source" and "target" properties.');
        }
        result = generateMergePatch(parsed.source, parsed.target);
      }
      return JSON.stringify(result, null, pretty ? 2 : 0);
    },
    [mode, pretty],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, pretty]}
      inputLabel={mode === 'apply' ? '{ target, patch }' : '{ source, target }'}
      outputLabel={mode === 'apply' ? 'Patched document' : 'Merge patch'}
      sample={mode === 'apply' ? APPLY_SAMPLE : GENERATE_SAMPLE}
      downloadName="merge-patch.json"
      downloadMime="application/json"
      options={
        <>
          <Field label="Mode" hint="Apply a patch, or diff two objects into a patch.">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="apply">Apply patch</TabsTrigger>
                <TabsTrigger value="generate">Generate patch</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Pretty print">
            <Switch checked={pretty} onCheckedChange={setPretty} />
          </Field>
        </>
      }
    />
  );
}
