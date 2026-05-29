/** Roman numeral <-> integer conversion (1..3999). */

const NUMERALS: [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) {
    throw new Error('Enter an integer between 1 and 3999.');
  }
  let out = '';
  let rem = n;
  for (const [value, sym] of NUMERALS) {
    while (rem >= value) {
      out += sym;
      rem -= value;
    }
  }
  return out;
}

export function fromRoman(s: string): number {
  const str = s.trim().toUpperCase();
  if (!/^[MDCLXVI]+$/.test(str)) throw new Error('Not a valid Roman numeral.');
  const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < str.length; i++) {
    const cur = map[str[i]!]!;
    const next = i + 1 < str.length ? map[str[i + 1]!]! : 0;
    if (cur < next) total -= cur;
    else total += cur;
  }
  if (toRoman(total) !== str) throw new Error('Not a canonical Roman numeral.');
  return total;
}
