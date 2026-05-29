/** Line-oriented text operations shared by several text tools. */

export type SortMode = 'asc' | 'desc' | 'length' | 'numeric' | 'shuffle' | 'reverse';

export interface LineOptions {
  trim: boolean;
  removeEmpty: boolean;
  caseInsensitive: boolean;
}

export function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

export function applyLineOptions(lines: string[], opts: LineOptions): string[] {
  let out = lines;
  if (opts.trim) out = out.map((l) => l.trim());
  if (opts.removeEmpty) out = out.filter((l) => l.length > 0);
  return out;
}

export function sortLines(lines: string[], mode: SortMode, caseInsensitive: boolean): string[] {
  const arr = [...lines];
  const cmp = (a: string, b: string) =>
    caseInsensitive
      ? a.toLowerCase().localeCompare(b.toLowerCase())
      : a.localeCompare(b);
  switch (mode) {
    case 'asc':
      return arr.sort(cmp);
    case 'desc':
      return arr.sort((a, b) => cmp(b, a));
    case 'length':
      return arr.sort((a, b) => a.length - b.length || cmp(a, b));
    case 'numeric':
      return arr.sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0));
    case 'reverse':
      return arr.reverse();
    case 'shuffle': {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j]!, arr[i]!];
      }
      return arr;
    }
    default:
      return arr;
  }
}

export function dedupeLines(lines: string[], caseInsensitive: boolean): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of lines) {
    const key = caseInsensitive ? l.toLowerCase() : l;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(l);
    }
  }
  return out;
}
