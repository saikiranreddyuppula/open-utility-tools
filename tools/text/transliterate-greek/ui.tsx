'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TextToolLayout } from '@/components/tools/text-tool';

type Scheme = 'iso843' | 'elot743' | 'classical' | 'reverse';

// Strip Greek accents/diacritics so base letters map cleanly.
function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
}

// Base single-letter Greek -> Latin per scheme (lowercase keys).
const BASE: Record<Scheme, Record<string, string>> = {
  iso843: {
    α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k',
    λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't',
    υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o',
  },
  elot743: {
    α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k',
    λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't',
    υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o',
  },
  classical: {
    α: 'a', β: 'b', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'e', θ: 'th', ι: 'i', κ: 'k',
    λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't',
    υ: 'u', φ: 'ph', χ: 'ch', ψ: 'ps', ω: 'o',
  },
  reverse: {},
};

// Contextual digraphs (lowercase). ELOT 743 transcribes vowel pairs and mp/nt phonetically.
const DIGRAPHS: Record<Scheme, [string, string][]> = {
  iso843: [
    ['γγ', 'ng'], ['γκ', 'gk'], ['γξ', 'nx'], ['γχ', 'nch'],
  ],
  elot743: [
    ['αυ', 'av'], ['ευ', 'ev'], ['ηυ', 'iv'], ['ου', 'ou'],
    ['μπ', 'b'], ['ντ', 'nt'], ['γγ', 'ng'], ['γκ', 'gk'], ['γξ', 'nx'], ['γχ', 'nch'],
  ],
  classical: [
    ['ου', 'ou'], ['ευ', 'eu'], ['αυ', 'au'], ['γγ', 'ng'], ['γκ', 'nk'], ['γξ', 'nx'], ['γχ', 'nch'],
  ],
  reverse: [],
};

// Reverse Latin -> Greek (best-effort). Digraphs first.
const REVERSE: [string, string][] = [
  ['th', 'θ'], ['ch', 'χ'], ['ps', 'ψ'], ['ph', 'φ'], ['ou', 'ου'], ['ng', 'γγ'],
  ['a', 'α'], ['v', 'β'], ['b', 'β'], ['g', 'γ'], ['d', 'δ'], ['e', 'ε'], ['z', 'ζ'],
  ['i', 'ι'], ['k', 'κ'], ['l', 'λ'], ['m', 'μ'], ['n', 'ν'], ['x', 'ξ'], ['o', 'ο'],
  ['p', 'π'], ['r', 'ρ'], ['s', 'σ'], ['t', 'τ'], ['y', 'υ'], ['u', 'υ'], ['f', 'φ'],
];

function isUpper(ch: string): boolean {
  return ch !== ch.toLowerCase() && ch === ch.toUpperCase();
}

function applyCase(srcFirst: string, mapped: string): string {
  if (!isUpper(srcFirst)) return mapped;
  if (mapped.length <= 1) return mapped.toUpperCase();
  return (mapped[0] ?? '').toUpperCase() + mapped.slice(1);
}

function forward(text: string, scheme: Scheme): string {
  const cleaned = stripDiacritics(text);
  const base = BASE[scheme];
  const digraphs = DIGRAPHS[scheme];
  const out: string[] = [];
  let i = 0;
  while (i < cleaned.length) {
    const slice2 = cleaned.slice(i, i + 2).toLowerCase();
    const dg = digraphs.find((d) => d[0] === slice2);
    if (dg) {
      const srcFirst = cleaned[i] ?? '';
      out.push(applyCase(srcFirst, dg[1]));
      i += 2;
      continue;
    }
    const ch = cleaned[i] ?? '';
    const lower = ch.toLowerCase();
    const mapped = base[lower];
    if (mapped === undefined) {
      out.push(ch);
    } else {
      out.push(applyCase(ch, mapped));
    }
    i += 1;
  }
  return out.join('');
}

function reverse(text: string): string {
  let i = 0;
  const out: string[] = [];
  while (i < text.length) {
    const rest = text.slice(i).toLowerCase();
    let matched: [string, string] | null = null;
    for (const pair of REVERSE) {
      if (rest.startsWith(pair[0])) {
        matched = pair;
        break;
      }
    }
    if (matched) {
      const src = text.slice(i, i + matched[0].length);
      const gr = matched[1];
      out.push(isUpper(src[0] ?? '') ? gr.toUpperCase() : gr);
      i += matched[0].length;
    } else {
      out.push(text[i] ?? '');
      i += 1;
    }
  }
  return out.join('');
}

export default function GreekTranslitTool() {
  const [scheme, setScheme] = useState<Scheme>('iso843');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      let result: string;
      switch (scheme) {
        case 'iso843':
          result = forward(input, 'iso843');
          break;
        case 'elot743':
          result = forward(input, 'elot743');
          break;
        case 'classical':
          result = forward(input, 'classical');
          break;
        case 'reverse':
          result = '# Note: reverse (Latin → Greek) is best-effort and lossy.\n' + reverse(input);
          break;
        default:
          result = input;
          break;
      }
      return result;
    },
    [scheme]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[scheme]}
      inputLabel="Greek text"
      outputLabel="Romanized"
      sample={'Καλημέρα κόσμε! Αθήνα και Θεσσαλονίκη.'}
      downloadName="greek-romanized.txt"
      options={
        <Field label="Scheme">
          <Select value={scheme} onValueChange={(v) => setScheme(v as Scheme)}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="iso843">ISO 843 (transliteration)</SelectItem>
              <SelectItem value="elot743">ELOT 743 (transcription)</SelectItem>
              <SelectItem value="classical">Classical / academic</SelectItem>
              <SelectItem value="reverse">Reverse: Latin → Greek</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      }
    />
  );
}
