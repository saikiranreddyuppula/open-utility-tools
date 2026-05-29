/** Minimal LCS-based line diff (no deps). Produces unified-ish hunks. */

export type DiffOp = 'eq' | 'add' | 'del';

export interface DiffLine {
  op: DiffOp;
  text: string;
  aLine?: number;
  bLine?: number;
}

export function diffLines(a: string, b: string): DiffLine[] {
  const aLines = a.split('\n');
  const bLines = b.split('\n');
  const n = aLines.length;
  const m = bLines.length;

  // LCS table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = aLines[i] === bLines[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (aLines[i] === bLines[j]) {
      out.push({ op: 'eq', text: aLines[i]!, aLine: i + 1, bLine: j + 1 });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push({ op: 'del', text: aLines[i]!, aLine: i + 1 });
      i++;
    } else {
      out.push({ op: 'add', text: bLines[j]!, bLine: j + 1 });
      j++;
    }
  }
  while (i < n) out.push({ op: 'del', text: aLines[i]!, aLine: ++i });
  while (j < m) out.push({ op: 'add', text: bLines[j]!, bLine: ++j });
  return out;
}

export function diffStats(lines: DiffLine[]): { added: number; removed: number; unchanged: number } {
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  for (const l of lines) {
    if (l.op === 'add') added++;
    else if (l.op === 'del') removed++;
    else unchanged++;
  }
  return { added, removed, unchanged };
}
