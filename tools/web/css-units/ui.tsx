'use client';

import { useState } from 'react';

import { Input } from '@/components/ui/input';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';

export default function PxRemConverterTool() {
  const [root, setRoot] = useState(16);
  const [px, setPx] = useState('24');

  const pxNum = Number(px);
  const valid = !isNaN(pxNum);
  const rem = valid ? pxNum / root : 0;

  const rows = valid
    ? [
        ['px', `${pxNum}px`],
        ['rem', `${+rem.toFixed(4)}rem`],
        ['em', `${+rem.toFixed(4)}em`],
        ['%', `${+(rem * 100).toFixed(2)}%`],
        ['pt', `${+(pxNum * 0.75).toFixed(2)}pt`],
      ]
    : [];

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Root font size (px)">
          <Input type="number" value={root} onChange={(e) => setRoot(Number(e.target.value) || 16)} className="w-24 font-mono" />
        </Field>
        <Field label="Value (px)">
          <Input value={px} onChange={(e) => setPx(e.target.value)} type="number" className="w-28 font-mono" />
        </Field>
      </OptionsBar>

      {valid && (
        <Panel>
          <PanelHeader title="Equivalents" />
          <div className="divide-y">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-center gap-3 px-3 py-2">
                <span className="w-12 shrink-0 font-mono text-2xs text-muted-foreground">{label}</span>
                <code className="min-w-0 flex-1 font-mono text-sm">{value}</code>
                <CopyButton value={value!} size="icon-sm" />
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
