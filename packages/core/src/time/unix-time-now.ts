// Extracted from tools/time/unix-time-now. Pure, isomorphic formatting of a
// Unix instant into seconds / milliseconds / microseconds readouts plus UTC,
// local, and a zero-padded milliseconds-of-second field. No DOM, no React —
// runs in the browser, Node 20, and Bun. The live UI feeds `Date.now()` and a
// `performance.now()`-derived sub-millisecond fraction into this transform; here
// both are explicit arguments so the result is deterministic and testable.

/** Left-pads the integer part of `n` to `width` digits with leading zeros. */
function pad(n: number, width: number): string {
  return Math.floor(n).toString().padStart(width, '0');
}

/** Options for {@link formatUnixInstant}. */
export interface UnixInstantOptions {
  /**
   * Sub-millisecond fraction in the half-open range `[0, 1)`, used only to add
   * an approximate microsecond tail to {@link UnixInstant.microseconds}. The UI
   * derives this from `performance.now()`; any real number is accepted and
   * normalized into `[0, 1)` via `((x % 1) + 1) % 1`, so negatives and values
   * `>= 1` wrap rather than throw. Defaults to `0` (microseconds end in `000`).
   */
  fractionalMs?: number;
}

/** Formatted readouts of a single Unix instant. */
export interface UnixInstant {
  /** Whole Unix seconds, truncated toward zero (`Math.floor(ms / 1000)`). */
  seconds: string;
  /** The instant in whole Unix milliseconds (the input `ms`). */
  milliseconds: string;
  /**
   * The instant in Unix microseconds (approximate). Built from the whole
   * seconds, the millisecond-of-second component, and `fractionalMs` scaled to
   * microseconds; the sub-millisecond tail is approximate, matching the UI.
   */
  microseconds: string;
  /** ISO-8601 UTC string, e.g. `2023-11-14T22:13:20.123Z`. Not env-dependent. */
  utc: string;
  /**
   * The instant rendered with `Date#toLocaleString()` in the host's time zone
   * and locale. This value is environment-dependent and intended for display.
   */
  local: string;
  /**
   * The millisecond-of-second component (`0`–`999`) zero-padded to 3 digits,
   * e.g. `007`. Mirrors the StatBar reading in the UI.
   */
  millisField: string;
}

/**
 * Formats a Unix instant given in epoch milliseconds into the seconds,
 * milliseconds, and (approximate) microseconds readouts shown by the
 * "Unix Timestamp Now" tool, along with UTC, local, and a zero-padded
 * milliseconds-of-second field.
 *
 * The microsecond value is intentionally approximate: it is the whole seconds in
 * microseconds, plus the millisecond-of-second component, plus an optional
 * sub-millisecond tail derived from {@link UnixInstantOptions.fractionalMs}
 * (`Math.floor(fractionalMs * 1000)` microseconds). `fractionalMs` is normalized
 * into `[0, 1)` with `((x % 1) + 1) % 1` before scaling, exactly as the UI does
 * with its `performance.now()` reading.
 *
 * The `local` field is rendered in the host's time zone and locale and is
 * therefore environment-dependent; every other field is deterministic for a
 * given `ms`.
 *
 * @param ms - The instant as Unix epoch milliseconds (e.g. from `Date.now()`).
 * @param options - Optional sub-millisecond fraction for the microsecond tail.
 * @returns The instant formatted as decimal strings plus UTC and local dates.
 * @throws {TypeError} If `ms` is not a finite number.
 * @throws {RangeError} If `ms` is finite but outside the range a JavaScript
 *   `Date` can represent (`|ms| > 8.64e15`).
 *
 * @example
 * ```ts
 * import { formatUnixInstant } from '@open-utility-tools/core/time/unix-time-now';
 *
 * formatUnixInstant(1_700_000_000_123);
 * // → {
 * //   seconds: '1700000000',
 * //   milliseconds: '1700000000123',
 * //   microseconds: '1700000000123000',
 * //   utc: '2023-11-14T22:13:20.123Z',
 * //   local: '<host-local string>',
 * //   millisField: '123',
 * // }
 *
 * // Add a sub-millisecond tail (e.g. 0.5 ms → +500 µs):
 * formatUnixInstant(1_700_000_000_123, { fractionalMs: 0.5 }).microseconds;
 * // → '1700000000123500'
 * ```
 */
export function formatUnixInstant(
  ms: number,
  options: UnixInstantOptions = {},
): UnixInstant {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) {
    throw new TypeError('ms must be a finite number of Unix milliseconds.');
  }

  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('ms is outside the range a Date can represent.');
  }

  const fractionalMsRaw = options.fractionalMs ?? 0;
  if (typeof fractionalMsRaw !== 'number' || !Number.isFinite(fractionalMsRaw)) {
    throw new TypeError('fractionalMs must be a finite number.');
  }

  const seconds = Math.floor(ms / 1000);
  // Normalize the sub-millisecond fraction into [0, 1), mirroring the UI's
  // `(performance.now() % 1 + 1) % 1`, then scale to microseconds.
  const fractionalMs = ((fractionalMsRaw % 1) + 1) % 1;
  const micros =
    seconds * 1_000_000 + (ms % 1000) * 1000 + Math.floor(fractionalMs * 1000);

  return {
    seconds: seconds.toString(),
    milliseconds: ms.toString(),
    microseconds: micros.toString(),
    utc: date.toISOString(),
    local: date.toLocaleString(),
    millisField: pad(date.getMilliseconds(), 3),
  };
}
