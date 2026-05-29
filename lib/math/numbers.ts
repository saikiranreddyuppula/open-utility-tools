/** Integer math helpers: gcd/lcm, primality, factorization, basic stats. */

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a / gcd(a, b) * b);
}

export function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  if (n % 2 === 0) return n === 2;
  if (n % 3 === 0) return n === 3;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

export function primeFactors(n: number): number[] {
  const factors: number[] = [];
  let x = Math.abs(Math.trunc(n));
  for (let d = 2; d * d <= x; d++) {
    while (x % d === 0) {
      factors.push(d);
      x /= d;
    }
  }
  if (x > 1) factors.push(x);
  return factors;
}

export interface Stats {
  count: number;
  sum: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  range: number;
  variance: number;
  stddev: number;
}

export function statistics(values: number[]): Stats | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const count = values.length;
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / count;
  const mid = Math.floor(count / 2);
  const median = count % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  const min = sorted[0]!;
  const max = sorted[count - 1]!;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / count;
  return {
    count,
    sum,
    mean,
    median,
    min,
    max,
    range: max - min,
    variance,
    stddev: Math.sqrt(variance),
  };
}
