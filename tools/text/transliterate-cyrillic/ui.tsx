'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TextToolLayout } from '@/components/tools/text-tool';

type Scheme = 'iso9' | 'gost' | 'bgn' | 'reverse';

// Lowercase Cyrillic -> Latin mappings per scheme. Uppercase handled by case detection.
const ISO9: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'ë', ж: 'ž', з: 'z', и: 'i',
  й: 'j', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'č', ш: 'š', щ: 'ŝ', ъ: 'ʺ', ы: 'y', ь: 'ʹ',
  э: 'è', ю: 'û', я: 'â',
};

const GOST: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i',
  й: 'j', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'x', ц: 'cz', ч: 'ch', ш: 'sh', щ: 'shh', ъ: "'", ы: 'y', ь: "`",
  э: 'e`', ю: 'yu', я: 'ya',
};

const BGN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '”', ы: 'y', ь: '’',
  э: 'e', ю: 'yu', я: 'ya',
};

// Reverse: Latin digraphs first, then single letters. Order matters for greedy matching.
const REVERSE: [string, string][] = [
  ['shch', 'щ'], ['sh', 'ш'], ['ch', 'ч'], ['zh', 'ж'], ['kh', 'х'], ['ts', 'ц'],
  ['yo', 'ё'], ['yu', 'ю'], ['ya', 'я'], ['je', 'е'], ['y', 'й'],
  ['a', 'а'], ['b', 'б'], ['v', 'в'], ['g', 'г'], ['d', 'д'], ['e', 'е'],
  ['z', 'з'], ['i', 'и'], ['k', 'к'], ['l', 'л'], ['m', 'м'], ['n', 'н'],
  ['o', 'о'], ['p', 'п'], ['r', 'р'], ['s', 'с'], ['t', 'т'], ['u', 'у'],
  ['f', 'ф'], ['h', 'х'], ['c', 'ц'],
];

function isUpper(ch: string): boolean {
  return ch !== ch.toLowerCase() && ch === ch.toUpperCase();
}

// Apply title-case to a multi-char romanization based on the source char's case.
function matchCase(src: string, mapped: string): string {
  if (!isUpper(src)) return mapped;
  if (mapped.length <= 1) return mapped.toUpperCase();
  // Title-case for digraphs (e.g. "Shch" rather than "SHCH").
  return (mapped[0] ?? '').toUpperCase() + mapped.slice(1);
}

function forward(text: string, table: Record<string, string>): string {
  const out: string[] = [];
  for (const ch of text) {
    const lower = ch.toLowerCase();
    const mapped = table[lower];
    if (mapped === undefined) {
      out.push(ch);
    } else {
      out.push(matchCase(ch, mapped));
    }
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
      const cyr = matched[1];
      out.push(isUpper(src[0] ?? '') ? cyr.toUpperCase() : cyr);
      i += matched[0].length;
    } else {
      out.push(text[i] ?? '');
      i += 1;
    }
  }
  return out.join('');
}

export default function CyrillicTranslitTool() {
  const [scheme, setScheme] = useState<Scheme>('iso9');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      let result: string;
      switch (scheme) {
        case 'iso9':
          result = forward(input, ISO9);
          break;
        case 'gost':
          result = forward(input, GOST);
          break;
        case 'bgn':
          result = forward(input, BGN);
          break;
        case 'reverse':
          result = '# Note: reverse (Latin → Cyrillic) is best-effort and lossy.\n' + reverse(input);
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
      inputLabel="Text"
      outputLabel="Transliterated"
      sample={'Привет, мир! Москва и Щукино.'}
      downloadName="transliterated.txt"
      options={
        <Field label="Scheme">
          <Select value={scheme} onValueChange={(v) => setScheme(v as Scheme)}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="iso9">ISO 9 (scientific, 1:1)</SelectItem>
              <SelectItem value="gost">GOST 7.79 System B</SelectItem>
              <SelectItem value="bgn">BGN/PCGN (English phonetic)</SelectItem>
              <SelectItem value="reverse">Reverse: Latin → Cyrillic</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      }
    />
  );
}
