/**
 * SMPTE Timecode / Frames Converter.
 *
 * Converts between SMPTE timecode (`HH:MM:SS:FF`) and total frame counts at a
 * chosen frame rate. Supports 29.97 fps NTSC drop-frame timecode, where two
 * frame numbers are dropped each minute except minutes divisible by ten.
 *
 * @module time/time-timecode-frames-converter
 */

/** Supported frame-rate presets. */
export type TimecodeRatePreset = '24' | '25' | '30' | '60' | '29.97';

interface RateInfo {
  /** Nominal frames per second used for the integer frame grid. */
  readonly fps: number;
  /** Whether drop-frame counting is meaningful at this rate (only 29.97). */
  readonly dropCapable: boolean;
}

const RATES: Record<TimecodeRatePreset, RateInfo> = {
  '24': { fps: 24, dropCapable: false },
  '25': { fps: 25, dropCapable: false },
  '30': { fps: 30, dropCapable: false },
  '60': { fps: 60, dropCapable: false },
  '29.97': { fps: 30, dropCapable: true },
};

function isRatePreset(value: string): value is TimecodeRatePreset {
  return Object.prototype.hasOwnProperty.call(RATES, value);
}

function resolveRate(
  rate: TimecodeRatePreset,
  dropFrame: boolean,
): { info: RateInfo; dropActive: boolean; effFps: number } {
  if (typeof rate !== 'string' || !isRatePreset(rate)) {
    throw new RangeError(
      `Unknown frame rate "${String(rate)}". Expected one of: 24, 25, 30, 60, 29.97.`,
    );
  }
  const info = RATES[rate];
  // Drop-frame only applies to the drop-capable (29.97) preset.
  const dropActive = info.dropCapable && dropFrame;
  // True playback fps used for real-time seconds (30/1.001 for NTSC drop-frame).
  const effFps = dropActive ? 30 / 1.001 : info.fps;
  return { info, dropActive, effFps };
}

/**
 * Render an integer frame count to an `HH:MM:SS:FF` timecode string.
 *
 * For drop-frame (`drop = true`), 2 frame numbers are dropped each minute
 * except every 10th minute, and the seconds/frames are joined with `sep`.
 */
function framesToTimecodeString(
  frames: number,
  fps: number,
  drop: boolean,
  sep: string,
): string {
  let f = frames;
  if (drop) {
    // 29.97: drop 2 frame numbers each minute except minutes divisible by 10.
    const dropFrames = 2;
    const framesPer10Min = 17982; // 10 * 60 * 30 - 9 * 2
    const framesPerMin = 1798; // 60 * 30 - 2
    const d = Math.floor(f / framesPer10Min);
    const m = f % framesPer10Min;
    if (m < dropFrames) {
      f += dropFrames * 9 * d;
    } else {
      f += dropFrames * 9 * d + dropFrames * Math.floor((m - dropFrames) / framesPerMin);
    }
  }
  const ff = f % fps;
  const totalSeconds = Math.floor(f / fps);
  const ss = totalSeconds % 60;
  const mm = Math.floor(totalSeconds / 60) % 60;
  const hh = Math.floor(totalSeconds / 3600) % 24;
  const frameSep = drop ? sep : ':';
  return (
    `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:` +
    `${String(ss).padStart(2, '0')}${frameSep}${String(ff).padStart(2, '0')}`
  );
}

/**
 * Parse an `HH:MM:SS:FF` (or `HH:MM:SS;FF`) timecode string to an integer
 * frame count. Throws {@link RangeError} on malformed or out-of-range input.
 */
function timecodeStringToFrames(tc: string, fps: number, drop: boolean): number {
  const m = tc.trim().match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})[:;.](\d{1,2})$/);
  if (!m) {
    throw new RangeError(
      'Timecode must look like HH:MM:SS:FF (or HH:MM:SS;FF for drop-frame).',
    );
  }
  const hh = Number(m[1] ?? '');
  const mm = Number(m[2] ?? '');
  const ss = Number(m[3] ?? '');
  const ff = Number(m[4] ?? '');
  if (![hh, mm, ss, ff].every((n) => Number.isFinite(n))) {
    throw new RangeError('Timecode contains a non-numeric field.');
  }
  if (mm > 59 || ss > 59) {
    throw new RangeError('Minutes and seconds must be 0-59.');
  }
  if (ff >= fps) {
    throw new RangeError(`Frame field must be 0-${fps - 1} at this rate.`);
  }

  const totalMinutes = hh * 60 + mm;
  if (drop && ss === 0 && mm % 10 !== 0 && ff < 2) {
    throw new RangeError(
      `Frames 00-01 are dropped at minute boundaries in drop-frame (got ${String(ff).padStart(2, '0')}).`,
    );
  }
  let frames = (hh * 3600 + mm * 60 + ss) * fps + ff;
  if (drop) {
    const dropFrames = 2;
    frames -= dropFrames * (totalMinutes - Math.floor(totalMinutes / 10));
  }
  return frames;
}

/** Result of converting a timecode string to frames. */
export interface TimecodeToFramesResult {
  /** Total integer frame count. */
  frames: number;
  /** Real-time playback length in seconds (uses 30/1.001 for NTSC drop-frame). */
  seconds: number;
  /** Round-trip timecode rendered back from {@link frames}. */
  timecode: string;
  /** Whether drop-frame counting was applied. */
  dropFrame: boolean;
  /** Integer frame-grid fps used for the conversion (30 for 29.97). */
  gridFps: number;
}

/** Result of converting a frame count to a timecode string. */
export interface FramesToTimecodeResult {
  /** SMPTE timecode string (`HH:MM:SS:FF`, or `HH:MM:SS;FF` for drop-frame). */
  timecode: string;
  /** The input frame count, echoed back. */
  frames: number;
  /** Real-time playback length in seconds (uses 30/1.001 for NTSC drop-frame). */
  seconds: number;
  /** Whether drop-frame counting was applied. */
  dropFrame: boolean;
  /** Integer frame-grid fps used for the conversion (30 for 29.97). */
  gridFps: number;
}

/**
 * Convert an SMPTE timecode string to a total frame count at the given rate.
 *
 * @param timecode - Timecode in `HH:MM:SS:FF` form. A `;` or `.` is also
 *   accepted as the seconds/frames separator (used for drop-frame).
 * @param rate - Frame-rate preset: `'24'`, `'25'`, `'30'`, `'60'`, or `'29.97'`.
 * @param dropFrame - Apply 29.97 drop-frame counting. Ignored unless `rate`
 *   is `'29.97'` (the only drop-capable preset). Defaults to `false`.
 * @returns The frame count plus real-time seconds and the round-trip timecode.
 * @throws {TypeError} If `timecode` is not a string.
 * @throws {RangeError} If `rate` is unknown, the timecode is malformed, a field
 *   is out of range, or a dropped frame number is supplied in drop-frame mode.
 * @example
 * ```ts
 * timecodeToFrames('01:00:00;00', '29.97', true);
 * // => { frames: 107892, seconds: 3599.9963999999995,
 * //      timecode: '01:00:00;00', dropFrame: true, gridFps: 30 }
 * ```
 */
export function timecodeToFrames(
  timecode: string,
  rate: TimecodeRatePreset,
  dropFrame = false,
): TimecodeToFramesResult {
  if (typeof timecode !== 'string') {
    throw new TypeError('timecode must be a string.');
  }
  const { info, dropActive, effFps } = resolveRate(rate, dropFrame);
  const frames = timecodeStringToFrames(timecode, info.fps, dropActive);
  return {
    frames,
    seconds: frames / effFps,
    timecode: framesToTimecodeString(frames, info.fps, dropActive, ';'),
    dropFrame: dropActive,
    gridFps: info.fps,
  };
}

/**
 * Convert a total frame count to an SMPTE timecode string at the given rate.
 *
 * @param frames - Non-negative whole frame count.
 * @param rate - Frame-rate preset: `'24'`, `'25'`, `'30'`, `'60'`, or `'29.97'`.
 * @param dropFrame - Apply 29.97 drop-frame counting. Ignored unless `rate`
 *   is `'29.97'` (the only drop-capable preset). Defaults to `false`.
 * @returns The rendered timecode plus the echoed frame count and real-time seconds.
 * @throws {TypeError} If `frames` is not a finite number.
 * @throws {RangeError} If `rate` is unknown, or `frames` is negative or fractional.
 * @example
 * ```ts
 * framesToTimecode(3661, '60');
 * // => { timecode: '00:01:01:01', frames: 3661,
 * //      seconds: 61.016666666666666, dropFrame: false, gridFps: 60 }
 * ```
 */
export function framesToTimecode(
  frames: number,
  rate: TimecodeRatePreset,
  dropFrame = false,
): FramesToTimecodeResult {
  if (typeof frames !== 'number' || !Number.isFinite(frames)) {
    throw new TypeError('frames must be a finite number.');
  }
  if (!Number.isInteger(frames) || frames < 0) {
    throw new RangeError('frames must be a non-negative whole number.');
  }
  const { info, dropActive, effFps } = resolveRate(rate, dropFrame);
  const timecode = framesToTimecodeString(frames, info.fps, dropActive, ';');
  return {
    timecode,
    frames,
    seconds: frames / effFps,
    dropFrame: dropActive,
    gridFps: info.fps,
  };
}
