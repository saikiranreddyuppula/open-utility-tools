'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Switch } from '@/components/ui/switch';

interface InvisibleDef {
  code: number;
  name: string;
}

// Code points to remove entirely.
const TARGETS: InvisibleDef[] = [
  { code: 0x200b, name: 'ZERO WIDTH SPACE' },
  { code: 0x200c, name: 'ZERO WIDTH NON-JOINER' },
  { code: 0x200d, name: 'ZERO WIDTH JOINER' },
  { code: 0x2060, name: 'WORD JOINER' },
  { code: 0xfeff, name: 'ZERO WIDTH NO-BREAK SPACE (BOM)' },
  { code: 0x00ad, name: 'SOFT HYPHEN' },
  { code: 0x200e, name: 'LEFT-TO-RIGHT MARK' },
  { code: 0x200f, name: 'RIGHT-TO-LEFT MARK' },
];

const NBSP = 0x00a0;

function hex(code: number): string {
  return `U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
}

export default function ZeroWidthCharStripperTool() {
  const [stripNbsp, setStripNbsp] = useState(false);
  const [reportOnly, setReportOnly] = useState(false);

  const transform = useCallback(
    (input: string): string => {
      if (!input) return '';

      const targetCodes = new Set<number>(TARGETS.map((t) => t.code));
      const nameByCode = new Map<number, string>(TARGETS.map((t) => [t.code, t.name]));
      if (stripNbsp) nameByCode.set(NBSP, 'NO-BREAK SPACE (-> regular space)');

      const counts = new Map<number, number>();
      let cleaned = '';

      for (const ch of input) {
        const code = ch.codePointAt(0) ?? 0;
        if (targetCodes.has(code)) {
          counts.set(code, (counts.get(code) ?? 0) + 1);
          continue; // removed
        }
        if (stripNbsp && code === NBSP) {
          counts.set(code, (counts.get(code) ?? 0) + 1);
          cleaned += ' ';
          continue;
        }
        cleaned += ch;
      }

      // Build report.
      const reportLines: string[] = [];
      let total = 0;
      for (const [code, count] of counts) {
        total += count;
        const name = nameByCode.get(code) ?? 'UNKNOWN';
        reportLines.push(`${hex(code)}  ${name}  x${count}`);
      }

      if (reportOnly) {
        if (total === 0) return 'No invisible characters found.';
        reportLines.sort();
        return [`Found ${total} invisible character(s):`, '', ...reportLines].join('\n');
      }

      if (total === 0) return cleaned;

      reportLines.sort();
      const report = ['', '--- Removed ---', `Total: ${total}`, ...reportLines].join('\n');
      return cleaned + report;
    },
    [stripNbsp, reportOnly]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[stripNbsp, reportOnly]}
      inputLabel="Text (may contain invisibles)"
      outputLabel={reportOnly ? 'Report' : 'Cleaned'}
      sample={
        'Paste​suspicious‌text‍here⁠.­Soft﻿hyphen and BOM hide in plain sight.'
      }
      downloadName="cleaned.txt"
      options={
        <>
          <Field label="Strip non-breaking spaces" hint="U+00A0 -> regular space">
            <div className="flex h-8 items-center">
              <Switch checked={stripNbsp} onCheckedChange={setStripNbsp} />
            </div>
          </Field>
          <Field label="Report only" hint="List without altering text">
            <div className="flex h-8 items-center">
              <Switch checked={reportOnly} onCheckedChange={setReportOnly} />
            </div>
          </Field>
        </>
      }
    />
  );
}
