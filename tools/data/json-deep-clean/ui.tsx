'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Switch } from '@/components/ui/switch';

interface Rules {
  removeNull: boolean;
  removeEmptyString: boolean;
  removeEmptyArray: boolean;
  removeEmptyObject: boolean;
  removeFalsy: boolean; // false and 0
  cascade: boolean;
  trimWhitespace: boolean;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Sentinel returned when a value should be removed by its parent.
const DROP = Symbol('drop');

export default function JsonDeepCleanTool() {
  const [rules, setRules] = useState<Rules>({
    removeNull: true,
    removeEmptyString: true,
    removeEmptyArray: true,
    removeEmptyObject: true,
    removeFalsy: false,
    cascade: true,
    trimWhitespace: true,
  });

  const setRule = useCallback(<K extends keyof Rules>(key: K, value: Rules[K]) => {
    setRules((r) => ({ ...r, [key]: value }));
  }, []);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let doc: unknown;
      try {
        doc = JSON.parse(input);
      } catch (e) {
        throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
      }

      let removed = 0;

      const shouldDrop = (v: unknown): boolean => {
        if (rules.removeNull && v === null) return true;
        if (typeof v === 'string') {
          const s = rules.trimWhitespace ? v.trim() : v;
          if (rules.removeEmptyString && s === '') return true;
        }
        if (rules.removeFalsy && (v === false || v === 0)) return true;
        if (Array.isArray(v) && rules.removeEmptyArray && v.length === 0) return true;
        if (isObject(v) && rules.removeEmptyObject && Object.keys(v).length === 0) return true;
        return false;
      };

      const clean = (node: unknown): unknown | typeof DROP => {
        if (Array.isArray(node)) {
          const out: unknown[] = [];
          for (const el of node) {
            const cleaned = rules.cascade ? clean(el) : el;
            if (cleaned === DROP) {
              removed += 1;
              continue;
            }
            if (shouldDrop(cleaned)) {
              removed += 1;
              continue;
            }
            out.push(cleaned);
          }
          if (rules.removeEmptyArray && out.length === 0) return DROP;
          return out;
        }
        if (isObject(node)) {
          const out: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(node)) {
            const cleaned = rules.cascade ? clean(v) : v;
            if (cleaned === DROP) {
              removed += 1;
              continue;
            }
            if (shouldDrop(cleaned)) {
              removed += 1;
              continue;
            }
            out[k] = cleaned;
          }
          if (rules.removeEmptyObject && Object.keys(out).length === 0) return DROP;
          return out;
        }
        return node;
      };

      const cleanedRoot = clean(doc);
      const finalValue = cleanedRoot === DROP ? (Array.isArray(doc) ? [] : {}) : cleanedRoot;
      const body = JSON.stringify(finalValue, null, 2);
      return `// removed ${removed} key${removed === 1 ? '' : 's'}/element${removed === 1 ? '' : 's'}\n${body}`;
    },
    [rules],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[rules]}
      inputLabel="JSON document"
      outputLabel="Cleaned JSON"
      inputPlaceholder='{"a": null, "b": "", "c": [], "d": 1}'
      sample={
        '{\n' +
        '  "name": "Ada",\n' +
        '  "nick": "",\n' +
        '  "middle": null,\n' +
        '  "tags": [],\n' +
        '  "meta": {"verified": false, "notes": "  "},\n' +
        '  "score": 0,\n' +
        '  "active": true\n' +
        '}'
      }
      downloadName="cleaned.json"
      downloadMime="application/json"
      options={
        <>
          <Field label="Remove null">
            <Switch checked={rules.removeNull} onCheckedChange={(c) => setRule('removeNull', c)} />
          </Field>
          <Field label="Remove empty strings">
            <Switch
              checked={rules.removeEmptyString}
              onCheckedChange={(c) => setRule('removeEmptyString', c)}
            />
          </Field>
          <Field label="Remove empty arrays">
            <Switch
              checked={rules.removeEmptyArray}
              onCheckedChange={(c) => setRule('removeEmptyArray', c)}
            />
          </Field>
          <Field label="Remove empty objects">
            <Switch
              checked={rules.removeEmptyObject}
              onCheckedChange={(c) => setRule('removeEmptyObject', c)}
            />
          </Field>
          <Field label="Remove false / 0">
            <Switch checked={rules.removeFalsy} onCheckedChange={(c) => setRule('removeFalsy', c)} />
          </Field>
          <Field label="Cascade" hint="Re-check parents that become empty">
            <Switch checked={rules.cascade} onCheckedChange={(c) => setRule('cascade', c)} />
          </Field>
          <Field label="Trim whitespace strings">
            <Switch
              checked={rules.trimWhitespace}
              onCheckedChange={(c) => setRule('trimWhitespace', c)}
            />
          </Field>
        </>
      }
    />
  );
}
