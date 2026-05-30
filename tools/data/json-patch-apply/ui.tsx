'use client';

import { useCallback, useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

type ModeKind = 'atomic' | 'best-effort';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
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

/** Decode a JSON Pointer string into reference tokens (RFC 6901). */
function parsePointer(pointer: string): string[] {
  if (pointer === '') return [];
  if (!pointer.startsWith('/')) {
    throw new Error(`Invalid JSON Pointer "${pointer}" (must be empty or start with "/").`);
  }
  return pointer
    .slice(1)
    .split('/')
    .map((tok) => tok.replace(/~1/g, '/').replace(/~0/g, '~'));
}

/** Navigate to the parent container of the final token; returns container + last token. */
function locate(
  root: unknown,
  tokens: string[],
): { parent: Record<string, unknown> | unknown[]; key: string } {
  if (tokens.length === 0) {
    throw new Error('Cannot operate on the document root with this op.');
  }
  let node: unknown = root;
  for (let i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i] ?? '';
    if (Array.isArray(node)) {
      const idx = Number(token);
      if (!Number.isInteger(idx) || idx < 0 || idx >= node.length) {
        throw new Error(`Path token "${token}" is not a valid array index.`);
      }
      node = node[idx];
    } else if (isPlainObject(node)) {
      if (!Object.prototype.hasOwnProperty.call(node, token)) {
        throw new Error(`Path token "${token}" does not exist.`);
      }
      node = node[token];
    } else {
      throw new Error(`Cannot descend into a non-container at token "${token}".`);
    }
  }
  const key = tokens[tokens.length - 1] ?? '';
  if (!Array.isArray(node) && !isPlainObject(node)) {
    throw new Error('Target parent is not an object or array.');
  }
  return { parent: node, key };
}

function getValue(root: unknown, tokens: string[]): unknown {
  let node: unknown = root;
  for (const token of tokens) {
    if (Array.isArray(node)) {
      const idx = Number(token);
      if (!Number.isInteger(idx) || idx < 0 || idx >= node.length) {
        throw new Error(`Array index "${token}" out of range.`);
      }
      node = node[idx];
    } else if (isPlainObject(node)) {
      if (!Object.prototype.hasOwnProperty.call(node, token)) {
        throw new Error(`Key "${token}" not found.`);
      }
      node = node[token];
    } else {
      throw new Error(`Cannot resolve token "${token}" against a non-container.`);
    }
  }
  return node;
}

function setValue(root: unknown, tokens: string[], value: unknown): void {
  const { parent, key } = locate(root, tokens);
  if (Array.isArray(parent)) {
    if (key === '-') {
      parent.push(value);
      return;
    }
    const idx = Number(key);
    if (!Number.isInteger(idx) || idx < 0 || idx > parent.length) {
      throw new Error(`Array index "${key}" out of range for add.`);
    }
    parent.splice(idx, 0, value);
  } else {
    parent[key] = value;
  }
}

function replaceValue(root: unknown, tokens: string[], value: unknown): void {
  const { parent, key } = locate(root, tokens);
  if (Array.isArray(parent)) {
    const idx = Number(key);
    if (!Number.isInteger(idx) || idx < 0 || idx >= parent.length) {
      throw new Error(`Array index "${key}" out of range for replace.`);
    }
    parent[idx] = value;
  } else {
    if (!Object.prototype.hasOwnProperty.call(parent, key)) {
      throw new Error(`Key "${key}" does not exist for replace.`);
    }
    parent[key] = value;
  }
}

function removeValue(root: unknown, tokens: string[]): unknown {
  const { parent, key } = locate(root, tokens);
  if (Array.isArray(parent)) {
    const idx = Number(key);
    if (!Number.isInteger(idx) || idx < 0 || idx >= parent.length) {
      throw new Error(`Array index "${key}" out of range for remove.`);
    }
    const [removed] = parent.splice(idx, 1);
    return removed;
  }
  if (!Object.prototype.hasOwnProperty.call(parent, key)) {
    throw new Error(`Key "${key}" does not exist for remove.`);
  }
  const removed = parent[key];
  delete parent[key];
  return removed;
}

interface PatchOp {
  op?: unknown;
  path?: unknown;
  from?: unknown;
  value?: unknown;
}

function applyOp(doc: unknown, op: PatchOp, index: number): unknown {
  const kind = op.op;
  if (typeof kind !== 'string') {
    throw new Error(`op #${index}: missing or non-string "op".`);
  }
  if (typeof op.path !== 'string') {
    throw new Error(`op #${index} (${kind}): missing or non-string "path".`);
  }
  const path = parsePointer(op.path);

  switch (kind) {
    case 'add': {
      if (path.length === 0) return op.value;
      setValue(doc, path, op.value);
      return doc;
    }
    case 'remove': {
      if (path.length === 0) {
        throw new Error(`op #${index} (remove): cannot remove the root.`);
      }
      removeValue(doc, path);
      return doc;
    }
    case 'replace': {
      if (path.length === 0) return op.value;
      replaceValue(doc, path, op.value);
      return doc;
    }
    case 'move': {
      if (typeof op.from !== 'string') {
        throw new Error(`op #${index} (move): missing "from".`);
      }
      const fromTokens = parsePointer(op.from);
      const moved = removeValue(doc, fromTokens);
      if (path.length === 0) return moved;
      setValue(doc, path, moved);
      return doc;
    }
    case 'copy': {
      if (typeof op.from !== 'string') {
        throw new Error(`op #${index} (copy): missing "from".`);
      }
      const fromTokens = parsePointer(op.from);
      const copied = structuredClone(getValue(doc, fromTokens));
      if (path.length === 0) return copied;
      setValue(doc, path, copied);
      return doc;
    }
    case 'test': {
      const actual = path.length === 0 ? doc : getValue(doc, path);
      if (!deepEqual(actual, op.value)) {
        throw new Error(`op #${index} (test): value at "${op.path}" did not match.`);
      }
      return doc;
    }
    default:
      throw new Error(`op #${index}: unknown op "${kind}".`);
  }
}

const SAMPLE = JSON.stringify(
  {
    document: { name: 'widget', price: 10, tags: ['a', 'b'], meta: { stock: 5 } },
    patch: [
      { op: 'replace', path: '/price', value: 12 },
      { op: 'add', path: '/tags/-', value: 'c' },
      { op: 'remove', path: '/meta/stock' },
      { op: 'move', from: '/name', path: '/title' },
    ],
  },
  null,
  2,
);

export default function JsonPatchApplyTool() {
  const [mode, setMode] = useState<ModeKind>('atomic');
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
      if (!isPlainObject(parsed) || !('document' in parsed) || !('patch' in parsed)) {
        throw new Error('Provide an object with "document" and "patch" (array) properties.');
      }
      const patch = parsed.patch;
      if (!Array.isArray(patch)) {
        throw new Error('"patch" must be a JSON array of operations.');
      }

      let doc = structuredClone(parsed.document);
      const skipped: string[] = [];

      for (let i = 0; i < patch.length; i++) {
        const op = patch[i];
        if (!isPlainObject(op)) {
          if (mode === 'atomic') {
            throw new Error(`op #${i}: each operation must be an object.`);
          }
          skipped.push(`op #${i}: not an object`);
          continue;
        }
        if (mode === 'atomic') {
          try {
            doc = applyOp(doc, op as PatchOp, i);
          } catch (e) {
            const reason = e instanceof Error ? e.message : String(e);
            throw new Error(`${reason}\n(atomic mode: document restored to original)`);
          }
        } else {
          // Best-effort: apply against a clone so a partial failure leaves doc intact.
          const candidate = structuredClone(doc);
          try {
            doc = applyOp(candidate, op as PatchOp, i);
          } catch (e) {
            skipped.push(e instanceof Error ? e.message : String(e));
          }
        }
      }

      const out = JSON.stringify(doc, null, pretty ? 2 : 0);
      if (mode === 'best-effort' && skipped.length > 0) {
        return `${out}\n\n/* skipped ${skipped.length} op(s):\n${skipped.map((s) => ` - ${s}`).join('\n')}\n*/`;
      }
      return out;
    },
    [mode, pretty],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, pretty]}
      inputLabel="{ document, patch }"
      outputLabel="Patched document"
      sample={SAMPLE}
      downloadName="patched.json"
      downloadMime="application/json"
      options={
        <>
          <Field label="Failure mode" hint="Atomic stops and restores on any failing op.">
            <Tabs value={mode} onValueChange={(v) => setMode(v as ModeKind)}>
              <TabsList>
                <TabsTrigger value="atomic">Atomic</TabsTrigger>
                <TabsTrigger value="best-effort">Best-effort</TabsTrigger>
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
