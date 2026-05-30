'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

const A_UP = 65;
const A_LO = 97;
const ZERO = 48;

/** Rotate letters by n (and optionally digits by digitN). */
function rotate(input: string, n: number, rotDigits: boolean, digitN: number): string {
  let out = '';
  for (const ch of input) {
    const code = ch.charCodeAt(0);
    if (code >= A_UP && code <= A_UP + 25) {
      out += String.fromCharCode(A_UP + ((((code - A_UP + n) % 26) + 26) % 26));
    } else if (code >= A_LO && code <= A_LO + 25) {
      out += String.fromCharCode(A_LO + ((((code - A_LO + n) % 26) + 26) % 26));
    } else if (rotDigits && code >= ZERO && code <= ZERO + 9) {
      out += String.fromCharCode(ZERO + ((((code - ZERO + digitN) % 10) + 10) % 10));
    } else {
      out += ch;
    }
  }
  return out;
}

const SAMPLE = 'The quick brown fox jumps over 13 lazy dogs.';
const DIGIT_SHIFT = 5; // ROT5 on digits

export default function RotNCipherTool() {
  const [input, setInput] = useState(SAMPLE);
  const [shift, setShift] = useState(13);
  const [rot18, setRot18] = useState(false);
  const [rotDigits, setRotDigits] = useState(false);

  const effectiveDigits = rot18 || rotDigits;

  const output = useMemo(
    () => rotate(input, shift, effectiveDigits, DIGIT_SHIFT),
    [input, shift, effectiveDigits],
  );

  // Brute-force all 26 letter shifts on the current input (capped).
  const bruteRows = useMemo(() => {
    const src = input.slice(0, 200);
    const rows: { n: number; text: string }[] = [];
    for (let n = 0; n < 26; n++) {
      rows.push({ n, text: rotate(src, n, false, 0) });
    }
    return rows;
  }, [input]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label={`Shift: ${shift}`} className="min-w-[240px] flex-1">
            <Slider
              value={[shift]}
              min={0}
              max={25}
              step={1}
              onValueChange={(v) => setShift(v[0] ?? 13)}
            />
          </Field>
          <Field label="ROT18 (ROT13 + ROT5 digits)">
            <Switch
              checked={rot18}
              onCheckedChange={(c) => {
                setRot18(c);
                if (c) setShift(13);
              }}
            />
          </Field>
          <Field label="Also rotate digits (ROT5)">
            <Switch checked={rotDigits} onCheckedChange={setRotDigits} disabled={rot18} />
          </Field>
        </OptionsBar>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Input">
            <button
              type="button"
              className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
              onClick={() => setInput(SAMPLE)}
            >
              Sample
            </button>
          </PanelHeader>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            placeholder="Type or paste text…"
            className="min-h-[180px] resize-y rounded-none border-0 bg-transparent font-mono shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <StatBar items={[`${input.length} chars`]} />
        </Panel>

        <Panel>
          <PanelHeader title={`ROT-${rot18 ? '18' : shift} output`}>
            <CopyButton value={() => output} disabled={!output} />
            <DownloadButton data={() => output} filename="rot-output.txt" disabled={!output} />
          </PanelHeader>
          <Textarea
            value={output}
            readOnly
            spellCheck={false}
            placeholder="Result appears here…"
            className="min-h-[180px] resize-y rounded-none border-0 bg-transparent font-mono shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <StatBar items={[`${output.length} chars`]} />
        </Panel>
      </div>

      <div className="rounded-md border bg-muted/20 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Brute-force: all 26 letter rotations of the input (capped at 200 chars)
          </span>
          <CopyButton
            value={() => bruteRows.map((r) => `ROT${r.n}: ${r.text}`).join('\n')}
            size="icon-sm"
          />
        </div>
        <div className="max-h-[360px] divide-y overflow-auto">
          {bruteRows.map((r) => (
            <div
              key={r.n}
              className={`flex items-center gap-3 px-1 py-1.5 ${
                r.n === shift && !rot18 ? 'bg-primary/5' : ''
              }`}
            >
              <code className="w-14 shrink-0 font-mono text-2xs text-muted-foreground">
                ROT{r.n}
              </code>
              <span className="min-w-0 flex-1 truncate font-mono text-xs">
                {r.text || ' '}
              </span>
              <CopyButton value={r.text} size="icon-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
