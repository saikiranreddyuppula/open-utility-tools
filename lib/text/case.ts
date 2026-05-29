/** Pure text-case transforms shared by case-converter & slugify. */

/** Split arbitrary text into normalized words (handles camelCase, kebab, snake, spaces). */
export function toWords(input: string): string[] {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_\-./\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

export const cases = {
  lower: (s: string) => s.toLowerCase(),
  upper: (s: string) => s.toUpperCase(),
  title: (s: string) => toWords(s).map(cap).join(' '),
  sentence: (s: string) => {
    const t = s.toLowerCase().trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
  },
  camel: (s: string) =>
    toWords(s)
      .map((w, i) => (i === 0 ? w.toLowerCase() : cap(w)))
      .join(''),
  pascal: (s: string) => toWords(s).map(cap).join(''),
  snake: (s: string) => toWords(s).map((w) => w.toLowerCase()).join('_'),
  constant: (s: string) => toWords(s).map((w) => w.toUpperCase()).join('_'),
  kebab: (s: string) => toWords(s).map((w) => w.toLowerCase()).join('-'),
  train: (s: string) => toWords(s).map(cap).join('-'),
  dot: (s: string) => toWords(s).map((w) => w.toLowerCase()).join('.'),
  path: (s: string) => toWords(s).map((w) => w.toLowerCase()).join('/'),
} as const;

export type CaseName = keyof typeof cases;

export const CASE_LABELS: Record<CaseName, string> = {
  lower: 'lowercase',
  upper: 'UPPERCASE',
  title: 'Title Case',
  sentence: 'Sentence case',
  camel: 'camelCase',
  pascal: 'PascalCase',
  snake: 'snake_case',
  constant: 'CONSTANT_CASE',
  kebab: 'kebab-case',
  train: 'Train-Case',
  dot: 'dot.case',
  path: 'path/case',
};
