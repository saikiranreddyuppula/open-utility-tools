'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

type Form = 'NFC' | 'NFD' | 'NFKC' | 'NFKD';

const FORMS: Form[] = ['NFC', 'NFD', 'NFKC', 'NFKD'];

function hex(cp: number): string {
  return 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
}

function cpCount(s: string): number {
  return Array.from(s).length;
}

function describe(s: string): string {
  return Array.from(s)
    .map((ch) => `${ch === ' ' ? '␠' : ch}(${hex(ch.codePointAt(0) ?? 0)})`)
    .join(' ');
}

export default function UnicodeNormalization() {
  const [form, setForm] = useState<Form>('NFC');
  const [showDiff, setShowDiff] = useState(false);

  return (
    <TextToolLayout
      deps={[form, showDiff]}
      transform={(input) => {
        if (!input) return '';

        const normalized = input.normalize(form);
        if (!showDiff) return normalized;

        const lines: string[] = [];
        lines.push(`Normalized (${form}):`);
        lines.push(normalized);
        lines.push('');
        lines.push(`Original code points:  ${cpCount(input)}`);
        lines.push(`${form} code points:      ${cpCount(normalized)}`);
        lines.push('');

        lines.push('Comparison across all forms:');
        for (const f of FORMS) {
          const n = input.normalize(f);
          const changed = n !== input;
          lines.push(
            `  ${f.padEnd(5)} ${changed ? 'CHANGES' : 'same   '}  ${cpCount(n)} code points`,
          );
        }

        // Per-character differences between original and selected form.
        const origChars = Array.from(input);
        const diffs: string[] = [];
        // Walk original characters and show how each one normalizes.
        for (const oc of origChars) {
          const on = oc.normalize(form);
          if (on !== oc) {
            diffs.push(`  ${describe(oc)}  →  ${describe(on)}`);
          }
        }
        if (diffs.length) {
          lines.push('');
          lines.push('Characters changed by this form:');
          for (const d of diffs) lines.push(d);
        } else if (origChars.length > 0) {
          lines.push('');
          lines.push('No per-character changes under this form.');
        }

        return lines.join('\n');
      }}
      inputLabel="Input text"
      outputLabel={showDiff ? 'Analysis' : `Normalized (${form})`}
      sample={'Café  ﬁle  ２０２４'}
      downloadName="normalized.txt"
      options={
        <>
          <Field label="Form">
            <Tabs value={form} onValueChange={(v) => setForm(v as Form)}>
              <TabsList>
                <TabsTrigger value="NFC">NFC</TabsTrigger>
                <TabsTrigger value="NFD">NFD</TabsTrigger>
                <TabsTrigger value="NFKC">NFKC</TabsTrigger>
                <TabsTrigger value="NFKD">NFKD</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Show differences">
            <Switch checked={showDiff} onCheckedChange={setShowDiff} />
          </Field>
        </>
      }
    />
  );
}
