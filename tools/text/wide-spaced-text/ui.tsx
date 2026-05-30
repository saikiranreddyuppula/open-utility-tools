'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'expand' | 'collapse';

// U+3000 ideographic ("full-width") space used by the vaporwave aesthetic.
const IDEOGRAPHIC_SPACE = String.fromCharCode(0x3000);

export default function WideSpacedTextTool() {
  const [mode, setMode] = useState<Mode>('expand');
  const [letterSep, setLetterSep] = useState(' ');
  const [wordSep, setWordSep] = useState('  ');
  const [vaporwave, setVaporwave] = useState(false);

  const transform = useCallback(
    (input: string): string => {
      if (!input) return '';

      if (mode === 'collapse') {
        // Collapse spaced-out text back toward normal:
        // 1. ideographic spaces -> regular spaces
        // 2. runs of 2+ spaces (word gaps) -> a single placeholder token
        // 3. single spaces between two non-space chars (letter separators) -> removed
        // 4. placeholder -> a single regular space
        const PH = String.fromCharCode(0x0001);
        const ideoRe = new RegExp(IDEOGRAPHIC_SPACE, 'g');
        const phRe = new RegExp(PH, 'g');
        return input
          .split('\n')
          .map((line) =>
            line
              .replace(ideoRe, ' ')
              .replace(/ {2,}/g, PH)
              .replace(/(?<=\S) (?=\S)/g, '')
              .replace(phRe, ' ')
          )
          .join('\n');
      }

      const effLetterSep = vaporwave ? IDEOGRAPHIC_SPACE : letterSep;
      const effWordSep = vaporwave ? IDEOGRAPHIC_SPACE + IDEOGRAPHIC_SPACE : wordSep;

      const processLine = (line: string): string => {
        // Split into words and the whitespace gaps between them.
        const tokens = line.split(/(\s+)/);
        const pieces: string[] = [];
        for (const token of tokens) {
          if (token.length === 0) continue;
          if (/^\s+$/.test(token)) {
            // A run of whitespace between words -> word separator.
            pieces.push(effWordSep);
            continue;
          }
          // A word: insert the letter separator between each character.
          const chars = Array.from(token);
          pieces.push(chars.join(effLetterSep));
        }
        return pieces.join('');
      };

      return input.split('\n').map(processLine).join('\n');
    },
    [mode, letterSep, wordSep, vaporwave]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, letterSep, wordSep, vaporwave]}
      inputLabel="Text"
      outputLabel="Result"
      sample={'aesthetic vibes only'}
      downloadName="spaced.txt"
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="expand">Expand</TabsTrigger>
                <TabsTrigger value="collapse">Collapse</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>

          {mode === 'expand' && (
            <>
              <Field label="Vaporwave wide (U+3000)" hint="Overrides separators below">
                <div className="flex h-8 items-center">
                  <Switch checked={vaporwave} onCheckedChange={setVaporwave} />
                </div>
              </Field>
              <Field label="Between letters">
                <Input
                  value={letterSep}
                  onChange={(e) => setLetterSep(e.target.value)}
                  disabled={vaporwave}
                  className="h-8 w-28 font-mono"
                  placeholder="(space)"
                />
              </Field>
              <Field label="Between words">
                <Input
                  value={wordSep}
                  onChange={(e) => setWordSep(e.target.value)}
                  disabled={vaporwave}
                  className="h-8 w-28 font-mono"
                  placeholder="(2 spaces)"
                />
              </Field>
            </>
          )}
        </>
      }
    />
  );
}
