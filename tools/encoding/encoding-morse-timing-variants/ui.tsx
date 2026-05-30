'use client';

import { useCallback, useMemo, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'encode' | 'decode';

// International Morse code map. Dots/dashes stored canonically as . and -.
const MORSE: Record<string, string> = {
  A: '.-',
  B: '-...',
  C: '-.-.',
  D: '-..',
  E: '.',
  F: '..-.',
  G: '--.',
  H: '....',
  I: '..',
  J: '.---',
  K: '-.-',
  L: '.-..',
  M: '--',
  N: '-.',
  O: '---',
  P: '.--.',
  Q: '--.-',
  R: '.-.',
  S: '...',
  T: '-',
  U: '..-',
  V: '...-',
  W: '.--',
  X: '-..-',
  Y: '-.--',
  Z: '--..',
  '0': '-----',
  '1': '.----',
  '2': '..---',
  '3': '...--',
  '4': '....-',
  '5': '.....',
  '6': '-....',
  '7': '--...',
  '8': '---..',
  '9': '----.',
  '.': '.-.-.-',
  ',': '--..--',
  '?': '..--..',
  "'": '.----.',
  '!': '-.-.--',
  '/': '-..-.',
  '(': '-.--.',
  ')': '-.--.-',
  '&': '.-...',
  ':': '---...',
  ';': '-.-.-.',
  '=': '-...-',
  '+': '.-.-.',
  '-': '-....-',
  _: '..--.-',
  '"': '.-..-.',
  $: '...-..-',
  '@': '.--.-.',
};

const REVERSE: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [k, v] of Object.entries(MORSE)) m[v] = k;
  return m;
})();

export default function MorseTimingVariantsTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [dotGlyph, setDotGlyph] = useState('.');
  const [dashGlyph, setDashGlyph] = useState('-');
  const [wordGap, setWordGap] = useState('/');
  const [wpm, setWpm] = useState('20');
  const [farnsworth, setFarnsworth] = useState('');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const dot = dotGlyph || '.';
      const dash = dashGlyph || '-';
      const ws = (wordGap || '/').trim() || '/';

      if (mode === 'encode') {
        const words = input.toUpperCase().trim().split(/\s+/);
        const encWords: string[] = [];
        for (const word of words) {
          const codes: string[] = [];
          for (const ch of word) {
            const code = MORSE[ch];
            if (code === undefined) continue;
            codes.push(code.replace(/\./g, dot).replace(/-/g, dash));
          }
          if (codes.length > 0) encWords.push(codes.join(' '));
        }
        return encWords.join(` ${ws} `);
      }

      // decode: tolerate multiple glyph styles by normalizing to ./-
      // Treat the chosen/known word-gap glyph and common ones as word breaks.
      const normalized = input
        .replace(/[·•‧∙]/g, '.')
        .replace(/[−–—_]/g, '-')
        .replace(new RegExp(escapeRe(dot), 'g'), '.')
        .replace(new RegExp(escapeRe(dash), 'g'), '-');

      const words = normalized
        .split(new RegExp(`\\s*(?:${escapeRe(ws)}|\\|)\\s*`))
        .map((w) => w.trim())
        .filter((w) => w.length > 0);

      const out: string[] = [];
      for (const w of words) {
        const letters = w.split(/\s+/).filter((s) => s.length > 0);
        let decoded = '';
        for (const code of letters) {
          const ch = REVERSE[code];
          decoded += ch ?? '?';
        }
        out.push(decoded);
      }
      return out.join(' ');
    },
    [mode, dotGlyph, dashGlyph, wordGap],
  );

  // Timing breakdown using the PARIS standard. dot length = 1200 / WPM ms.
  const timing = useMemo(() => {
    const w = Number(wpm);
    if (!Number.isFinite(w) || w <= 0) {
      return { error: 'Enter a WPM greater than 0 for the timing breakdown.' as const };
    }
    const dotMs = 1200 / w;

    // Farnsworth: if set and lower than WPM, character speed stays at WPM but
    // inter-character/word gaps are stretched to the Farnsworth (overall) speed.
    const fw = Number(farnsworth);
    const useFw =
      farnsworth.trim() !== '' && Number.isFinite(fw) && fw > 0 && fw < w;
    let charGapUnits = 3;
    let wordGapUnits = 7;
    let fwNote = '';
    if (useFw) {
      // Farnsworth keeps individual symbols at the character speed (WPM) but
      // stretches the gaps so the overall word rate matches the lower speed.
      const ratio = w / fw;
      charGapUnits = 3 * ratio;
      wordGapUnits = 7 * ratio;
      fwNote = `Farnsworth at ${fw} WPM stretches gaps by ${ratio.toFixed(2)}× (character speed stays ${w} WPM).`;
    }

    const rows: { label: string; units: number; ms: number }[] = [
      { label: 'Dot (dit)', units: 1, ms: dotMs * 1 },
      { label: 'Dash (dah)', units: 3, ms: dotMs * 3 },
      { label: 'Intra-character gap', units: 1, ms: dotMs * 1 },
      { label: 'Inter-character gap', units: charGapUnits, ms: dotMs * charGapUnits },
      { label: 'Inter-word gap', units: wordGapUnits, ms: dotMs * wordGapUnits },
    ];
    return { dotMs, rows, fwNote };
  }, [wpm, farnsworth]);

  return (
    <div className="space-y-4">
      <TextToolLayout
        transform={transform}
        deps={[mode, dotGlyph, dashGlyph, wordGap]}
        inputLabel={mode === 'encode' ? 'Text' : 'Morse code'}
        outputLabel={mode === 'encode' ? 'Morse code' : 'Text'}
        sample={mode === 'encode' ? 'SOS HELP' : '... --- ... / .... . .-.. .--.'}
        downloadName="morse.txt"
        options={
          <>
            <Field label="Mode">
              <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <TabsList>
                  <TabsTrigger value="encode">Text→Morse</TabsTrigger>
                  <TabsTrigger value="decode">Morse→Text</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
            <Field label="Dot glyph">
              <Input
                value={dotGlyph}
                onChange={(e) => setDotGlyph(e.target.value)}
                className="w-16"
                maxLength={2}
              />
            </Field>
            <Field label="Dash glyph">
              <Input
                value={dashGlyph}
                onChange={(e) => setDashGlyph(e.target.value)}
                className="w-16"
                maxLength={2}
              />
            </Field>
            <Field label="Word gap glyph">
              <Input
                value={wordGap}
                onChange={(e) => setWordGap(e.target.value)}
                className="w-16"
                maxLength={3}
              />
            </Field>
            <Field label="WPM">
              <Input
                value={wpm}
                onChange={(e) => setWpm(e.target.value)}
                inputMode="numeric"
                className="w-20"
              />
            </Field>
            <Field label="Farnsworth WPM (optional)">
              <Input
                value={farnsworth}
                onChange={(e) => setFarnsworth(e.target.value)}
                inputMode="numeric"
                className="w-24"
                placeholder="none"
              />
            </Field>
          </>
        }
      />

      <div className="rounded-md border bg-muted/20 p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          PARIS timing breakdown
        </div>
        {'error' in timing ? (
          <div className="text-xs text-destructive">{timing.error}</div>
        ) : (
          <>
            <div className="mb-2 font-mono text-xs text-muted-foreground">
              1 unit = {timing.dotMs.toFixed(1)} ms (= 1200 / WPM)
            </div>
            <div className="divide-y">
              {timing.rows.map((r) => (
                <div
                  key={r.label}
                  className="flex items-center justify-between py-1 text-sm"
                >
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-mono">
                    {r.units % 1 === 0 ? r.units : r.units.toFixed(2)} units ·{' '}
                    {r.ms.toFixed(1)} ms
                  </span>
                </div>
              ))}
            </div>
            {timing.fwNote && (
              <div className="mt-2 text-xs text-muted-foreground">
                {timing.fwNote}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
