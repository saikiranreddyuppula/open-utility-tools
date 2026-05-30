'use client';

import { useCallback, useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

type ArrayMode = 'index' | 'replace';

interface Op {
  op: 'add' | 'remove' | 'replace' | 'move';
  path: string;
  from?: string;
  value?: unknown;
}

/** Internal op that also retains the removed value, for move detection. */
interface RawOp {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: unknown;
  removedValue?: unknown;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function escapeToken(token: string): string {
  return token.replace(/~/g, '~0').replace(/\//g, '~1');
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

function diff(
  source: unknown,
  target: unknown,
  path: string,
  arrayMode: ArrayMode,
  ops: RawOp[],
): void {
  if (deepEqual(source, target)) return;

  if (isPlainObject(source) && isPlainObject(target)) {
    for (const key of Object.keys(source)) {
      const childPath = `${path}/${escapeToken(key)}`;
      if (!Object.prototype.hasOwnProperty.call(target, key)) {
        ops.push({ op: 'remove', path: childPath, removedValue: source[key] });
      } else {
        diff(source[key], target[key], childPath, arrayMode, ops);
      }
    }
    for (const key of Object.keys(target)) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) {
        ops.push({ op: 'add', path: `${path}/${escapeToken(key)}`, value: target[key] });
      }
    }
    return;
  }

  if (Array.isArray(source) && Array.isArray(target) && arrayMode === 'index') {
    const min = Math.min(source.length, target.length);
    for (let i = 0; i < min; i++) {
      diff(source[i], target[i], `${path}/${i}`, arrayMode, ops);
    }
    // Removals: emit from the tail forward so earlier indices stay valid.
    for (let i = source.length - 1; i >= target.length; i--) {
      ops.push({ op: 'remove', path: `${path}/${i}`, removedValue: source[i] });
    }
    // Additions appended at the end.
    for (let i = source.length; i < target.length; i++) {
      ops.push({ op: 'add', path: `${path}/-`, value: target[i] });
    }
    return;
  }

  // Differing types, primitives, or naive array replace.
  ops.push({ op: 'replace', path, value: target });
}

/** Pair an `add` with a `remove` of a deep-equal value into a single `move`. */
function applyMoveDetection(raw: RawOp[]): Op[] {
  const result: Op[] = [];
  const consumed = new Set<number>();
  for (let i = 0; i < raw.length; i++) {
    if (consumed.has(i)) continue;
    const op = raw[i];
    if (!op) continue;
    if (op.op === 'add') {
      let from: string | null = null;
      for (let j = 0; j < raw.length; j++) {
        if (j === i || consumed.has(j)) continue;
        const other = raw[j];
        if (other && other.op === 'remove' && deepEqual(other.removedValue, op.value)) {
          from = other.path;
          consumed.add(j);
          break;
        }
      }
      if (from !== null) {
        result.push({ op: 'move', from, path: op.path });
      } else {
        result.push({ op: 'add', path: op.path, value: op.value });
      }
    } else if (op.op === 'remove') {
      result.push({ op: 'remove', path: op.path });
    } else {
      result.push({ op: 'replace', path: op.path, value: op.value });
    }
  }
  return result;
}

/** Strip internal removedValue fields, producing clean RFC 6902 ops. */
function toCleanOps(raw: RawOp[]): Op[] {
  return raw.map((op): Op => {
    if (op.op === 'add' || op.op === 'replace') {
      return { op: op.op, path: op.path, value: op.value };
    }
    return { op: 'remove', path: op.path };
  });
}

const SAMPLE = JSON.stringify(
  {
    source: { name: 'widget', price: 10, tags: ['a', 'b'], meta: { stock: 5 } },
    target: { name: 'widget', price: 12, tags: ['a', 'b', 'c'], color: 'red' },
  },
  null,
  2,
);

export default function JsonPatchDiffTool() {
  const [arrayMode, setArrayMode] = useState<ArrayMode>('index');
  const [detectMove, setDetectMove] = useState(false);
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
      if (!isPlainObject(parsed) || !('source' in parsed) || !('target' in parsed)) {
        throw new Error('Provide an object with "source" and "target" properties.');
      }

      const raw: RawOp[] = [];
      diff(parsed.source, parsed.target, '', arrayMode, raw);
      const finalOps = detectMove ? applyMoveDetection(raw) : toCleanOps(raw);
      return JSON.stringify(finalOps, null, pretty ? 2 : 0);
    },
    [arrayMode, detectMove, pretty],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[arrayMode, detectMove, pretty]}
      inputLabel="{ source, target }"
      outputLabel="RFC 6902 patch"
      sample={SAMPLE}
      downloadName="patch.json"
      downloadMime="application/json"
      options={
        <>
          <Field label="Array diff" hint="Index walks element-by-element; replace swaps whole arrays.">
            <Tabs value={arrayMode} onValueChange={(v) => setArrayMode(v as ArrayMode)}>
              <TabsList>
                <TabsTrigger value="index">By index</TabsTrigger>
                <TabsTrigger value="replace">Replace</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Detect moves">
            <Switch checked={detectMove} onCheckedChange={setDetectMove} />
          </Field>
          <Field label="Pretty print">
            <Switch checked={pretty} onCheckedChange={setPretty} />
          </Field>
        </>
      }
    />
  );
}
