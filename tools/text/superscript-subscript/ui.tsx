'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'super' | 'sub';

// Superscript map (Unicode superscripts; letters where Unicode provides them).
const SUPER: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  '=': '⁼',
  '(': '⁽',
  ')': '⁾',
  a: 'ᵃ',
  b: 'ᵇ',
  c: 'ᶜ',
  d: 'ᵈ',
  e: 'ᵉ',
  f: 'ᶠ',
  g: 'ᵍ',
  h: 'ʰ',
  i: 'ⁱ',
  j: 'ʲ',
  k: 'ᵏ',
  l: 'ˡ',
  m: 'ᵐ',
  n: 'ⁿ',
  o: 'ᵒ',
  p: 'ᵖ',
  r: 'ʳ',
  s: 'ˢ',
  t: 'ᵗ',
  u: 'ᵘ',
  v: 'ᵛ',
  w: 'ʷ',
  x: 'ˣ',
  y: 'ʸ',
  z: 'ᶻ',
};

// Subscript map (Unicode subscripts; fewer letters exist in Unicode).
const SUB: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
  '=': '₌',
  '(': '₍',
  ')': '₎',
  a: 'ₐ',
  e: 'ₑ',
  h: 'ₕ',
  i: 'ᵢ',
  j: 'ⱼ',
  k: 'ₖ',
  l: 'ₗ',
  m: 'ₘ',
  n: 'ₙ',
  o: 'ₒ',
  p: 'ₚ',
  r: 'ᵣ',
  s: 'ₛ',
  t: 'ₜ',
  u: 'ᵤ',
  v: 'ᵥ',
  x: 'ₓ',
};

export default function SuperSubscriptTool() {
  const [mode, setMode] = useState<Mode>('super');
  const [showWarnings, setShowWarnings] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const map = mode === 'super' ? SUPER : SUB;
      let out = '';
      const unsupported = new Set<string>();
      for (const ch of input) {
        if (ch === '\n' || ch === ' ' || ch === '\t') {
          out += ch;
          continue;
        }
        const lower = ch.toLowerCase();
        const mapped = map[lower];
        if (mapped !== undefined) {
          out += mapped;
        } else {
          out += ch;
          unsupported.add(ch);
        }
      }
      if (showWarnings && unsupported.size > 0) {
        const list = Array.from(unsupported).join(' ');
        out += `\n\n— No ${mode === 'super' ? 'superscript' : 'subscript'} form for: ${list}`;
      }
      return out;
    },
    [mode, showWarnings],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, showWarnings]}
      inputLabel="Text"
      outputLabel={mode === 'super' ? 'Superscript' : 'Subscript'}
      inputPlaceholder={mode === 'super' ? 'x2 + y2 = r2' : 'H2O CO2'}
      sample={mode === 'super' ? 'E = mc2 and x2 + 1' : 'H2O + CO2 -> H2CO3'}
      downloadName={mode === 'super' ? 'superscript.txt' : 'subscript.txt'}
      mono={false}
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="super">Superscript</TabsTrigger>
                <TabsTrigger value="sub">Subscript</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="List unsupported" hint="Append characters with no form">
            <Switch checked={showWarnings} onCheckedChange={setShowWarnings} />
          </Field>
        </>
      }
    />
  );
}
