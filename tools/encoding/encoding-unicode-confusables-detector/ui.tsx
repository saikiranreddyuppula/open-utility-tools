'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

type Mode = 'report' | 'skeleton' | 'highlight';

interface Confusable {
  ascii: string;
  script: string;
}

// Map of common confusable code points -> { canonical ASCII, source script }.
const CONFUSABLES: Record<string, Confusable> = {
  // Cyrillic lowercase lookalikes
  'а': { ascii: 'a', script: 'Cyrillic' },
  'е': { ascii: 'e', script: 'Cyrillic' },
  'о': { ascii: 'o', script: 'Cyrillic' },
  'р': { ascii: 'p', script: 'Cyrillic' },
  'с': { ascii: 'c', script: 'Cyrillic' },
  'у': { ascii: 'y', script: 'Cyrillic' },
  'х': { ascii: 'x', script: 'Cyrillic' },
  'ѕ': { ascii: 's', script: 'Cyrillic' },
  'і': { ascii: 'i', script: 'Cyrillic' },
  'ј': { ascii: 'j', script: 'Cyrillic' },
  'һ': { ascii: 'h', script: 'Cyrillic' },
  'ԛ': { ascii: 'q', script: 'Cyrillic' },
  'ԁ': { ascii: 'd', script: 'Cyrillic' },
  // Cyrillic uppercase lookalikes
  'А': { ascii: 'A', script: 'Cyrillic' },
  'В': { ascii: 'B', script: 'Cyrillic' },
  'Е': { ascii: 'E', script: 'Cyrillic' },
  'К': { ascii: 'K', script: 'Cyrillic' },
  'М': { ascii: 'M', script: 'Cyrillic' },
  'Н': { ascii: 'H', script: 'Cyrillic' },
  'О': { ascii: 'O', script: 'Cyrillic' },
  'Р': { ascii: 'P', script: 'Cyrillic' },
  'С': { ascii: 'C', script: 'Cyrillic' },
  'Т': { ascii: 'T', script: 'Cyrillic' },
  'Х': { ascii: 'X', script: 'Cyrillic' },
  'Ѕ': { ascii: 'S', script: 'Cyrillic' },
  'І': { ascii: 'I', script: 'Cyrillic' },
  'Ј': { ascii: 'J', script: 'Cyrillic' },
  // Greek lookalikes
  'α': { ascii: 'a', script: 'Greek' },
  'ο': { ascii: 'o', script: 'Greek' },
  'ρ': { ascii: 'p', script: 'Greek' },
  'ν': { ascii: 'v', script: 'Greek' },
  'Α': { ascii: 'A', script: 'Greek' },
  'Β': { ascii: 'B', script: 'Greek' },
  'Ε': { ascii: 'E', script: 'Greek' },
  'Η': { ascii: 'H', script: 'Greek' },
  'Ι': { ascii: 'I', script: 'Greek' },
  'Κ': { ascii: 'K', script: 'Greek' },
  'Μ': { ascii: 'M', script: 'Greek' },
  'Ν': { ascii: 'N', script: 'Greek' },
  'Ο': { ascii: 'O', script: 'Greek' },
  'Ρ': { ascii: 'P', script: 'Greek' },
  'Τ': { ascii: 'T', script: 'Greek' },
  'Χ': { ascii: 'X', script: 'Greek' },
  'Ζ': { ascii: 'Z', script: 'Greek' },
  'κ': { ascii: 'k', script: 'Greek' },
  'ι': { ascii: 'i', script: 'Greek' },
  'γ': { ascii: 'y', script: 'Greek' },
  // Latin extended / other
  'ı': { ascii: 'i', script: 'Latin (dotless)' },
  'ǀ': { ascii: 'l', script: 'Latin (letter)' },
  '‐': { ascii: '-', script: 'Punctuation (hyphen)' },
  '‘': { ascii: "'", script: 'Punctuation' },
  '’': { ascii: "'", script: 'Punctuation' },
  '“': { ascii: '"', script: 'Punctuation' },
  '”': { ascii: '"', script: 'Punctuation' },
};

const PUNCT_SCRIPTS = new Set<string>(['Punctuation', 'Punctuation (hyphen)']);

function classify(cp: number, ch: string): Confusable | null {
  const direct = CONFUSABLES[ch];
  if (direct) return direct;
  // Fullwidth ASCII forms (U+FF01 .. U+FF5E) -> subtract 0xFEE0
  if (cp >= 0xff01 && cp <= 0xff5e) {
    return { ascii: String.fromCharCode(cp - 0xfee0), script: 'Fullwidth' };
  }
  // Mathematical alphanumeric uppercase blocks mapping to A-Z / a-z (sampled common blocks)
  // Bold (U+1D400..), Italic (U+1D434..), etc. up to U+1D7FF. We map letter blocks generically.
  if (cp >= 0x1d400 && cp <= 0x1d6a3) {
    const offset = (cp - 0x1d400) % 52;
    const base = offset < 26 ? 0x41 + offset : 0x61 + (offset - 26);
    return { ascii: String.fromCharCode(base), script: 'Math alphanumeric' };
  }
  // Mathematical digits U+1D7CE..U+1D7FF map to 0-9 in cycles of 10
  if (cp >= 0x1d7ce && cp <= 0x1d7ff) {
    const d = (cp - 0x1d7ce) % 10;
    return { ascii: String.fromCharCode(0x30 + d), script: 'Math digit' };
  }
  return null;
}

function codePointHex(cp: number): string {
  return 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
}

export default function UnicodeConfusablesDetector() {
  const [mode, setMode] = useState<Mode>('report');
  const [includePunct, setIncludePunct] = useState(true);

  return (
    <TextToolLayout
      deps={[mode, includePunct]}
      transform={(input) => {
        if (!input) return '';

        const chars = Array.from(input);
        const findings: string[] = [];
        let skeleton = '';
        let highlighted = '';
        let count = 0;

        for (const ch of chars) {
          const cp = ch.codePointAt(0) ?? 0;
          const hit = classify(cp, ch);
          const isPunct = hit ? PUNCT_SCRIPTS.has(hit.script) : false;
          const counted = hit !== null && (includePunct || !isPunct);

          if (counted && hit) {
            count += 1;
            findings.push(
              `'${ch}'  ${codePointHex(cp)}  ${hit.script.padEnd(20)} imitates ASCII '${hit.ascii}'`,
            );
            skeleton += hit.ascii;
            highlighted += `[${ch}→${hit.ascii}]`;
          } else {
            skeleton += ch;
            highlighted += ch;
          }
        }

        if (mode === 'skeleton') {
          return skeleton;
        }
        if (mode === 'highlight') {
          return highlighted;
        }

        // report mode
        const header =
          count === 0
            ? 'No confusable characters detected. Text appears to be plain ASCII / safe.'
            : `Detected ${count} confusable character${count === 1 ? '' : 's'}:`;
        const body = findings.length ? '\n\n' + findings.join('\n') : '';
        const sk = count > 0 ? `\n\nASCII skeleton:\n${skeleton}` : '';
        return header + body + sk;
      }}
      inputLabel="Input text"
      outputLabel={
        mode === 'skeleton'
          ? 'ASCII skeleton'
          : mode === 'highlight'
            ? 'Highlighted'
            : 'Report'
      }
      sample={'pаypаl.com'}
      downloadName="confusables.txt"
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="report">Report</TabsTrigger>
                <TabsTrigger value="skeleton">Skeleton</TabsTrigger>
                <TabsTrigger value="highlight">Highlight</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Include punctuation">
            <Switch checked={includePunct} onCheckedChange={setIncludePunct} />
          </Field>
        </>
      }
    />
  );
}
