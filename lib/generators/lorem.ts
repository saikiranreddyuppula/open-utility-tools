/** Classic lorem ipsum generator (deterministic word pool, varied sentences). */

const WORDS =
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum'.split(
    ' '
  );

function rand(max: number): number {
  return Math.floor(Math.random() * max);
}

function sentence(): string {
  const len = 6 + rand(10);
  const parts: string[] = [];
  for (let i = 0; i < len; i++) parts.push(WORDS[rand(WORDS.length)]!);
  let s = parts.join(' ');
  // occasional comma
  if (len > 8) {
    const at = 3 + rand(len - 5);
    parts[at] = parts[at] + ',';
    s = parts.join(' ');
  }
  return s.charAt(0).toUpperCase() + s.slice(1) + '.';
}

function paragraph(): string {
  const n = 3 + rand(4);
  return Array.from({ length: n }, sentence).join(' ');
}

export interface LoremOptions {
  unit: 'paragraphs' | 'sentences' | 'words';
  count: number;
  startWithLorem: boolean;
}

export function generateLorem(opts: LoremOptions): string {
  if (opts.unit === 'words') {
    const out: string[] = [];
    for (let i = 0; i < opts.count; i++) out.push(WORDS[rand(WORDS.length)]!);
    if (opts.startWithLorem) out.splice(0, Math.min(2, out.length), 'lorem', 'ipsum');
    const s = out.join(' ');
    return s.charAt(0).toUpperCase() + s.slice(1) + '.';
  }
  if (opts.unit === 'sentences') {
    const arr = Array.from({ length: opts.count }, sentence);
    if (opts.startWithLorem && arr.length)
      arr[0] = 'Lorem ipsum dolor sit amet, ' + arr[0]!.charAt(0).toLowerCase() + arr[0]!.slice(1);
    return arr.join(' ');
  }
  const arr = Array.from({ length: opts.count }, paragraph);
  if (opts.startWithLorem && arr.length)
    arr[0] = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' + arr[0];
  return arr.join('\n\n');
}
