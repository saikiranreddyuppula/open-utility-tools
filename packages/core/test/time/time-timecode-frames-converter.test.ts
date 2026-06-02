import { describe, it, expect } from 'vitest';

import {
  timecodeToFrames,
  framesToTimecode,
} from '../../src/time/time-timecode-frames-converter';

describe('timecodeToFrames', () => {
  it('converts one hour of 29.97 drop-frame timecode to frames', () => {
    expect(timecodeToFrames('01:00:00;00', '29.97', true)).toEqual({
      frames: 107892,
      seconds: 3599.9963999999995,
      timecode: '01:00:00;00',
      dropFrame: true,
      gridFps: 30,
    });
  });

  it('converts non-drop 24 fps timecode to frames', () => {
    expect(timecodeToFrames('00:00:10:00', '24', false)).toEqual({
      frames: 240,
      seconds: 10,
      timecode: '00:00:10:00',
      dropFrame: false,
      gridFps: 24,
    });
  });

  it('handles the first valid drop-frame minute boundary (;02)', () => {
    expect(timecodeToFrames('00:01:00;02', '29.97', true)).toEqual({
      frames: 1800,
      seconds: 60.059999999999995,
      timecode: '00:01:00;02',
      dropFrame: true,
      gridFps: 30,
    });
  });

  it('throws RangeError for a dropped frame number at a minute boundary', () => {
    expect(() => timecodeToFrames('00:01:00;00', '29.97', true)).toThrow(
      RangeError,
    );
    expect(() => timecodeToFrames('00:01:00;00', '29.97', true)).toThrow(
      'Frames 00-01 are dropped at minute boundaries in drop-frame (got 00).',
    );
  });

  it('throws RangeError for a malformed timecode string', () => {
    expect(() => timecodeToFrames('not-a-tc', '24')).toThrow(RangeError);
  });

  it('throws RangeError when the frame field exceeds the rate', () => {
    expect(() => timecodeToFrames('00:00:00:30', '24')).toThrow(
      'Frame field must be 0-23 at this rate.',
    );
  });
});

describe('framesToTimecode', () => {
  it('converts a frame count to non-drop 60 fps timecode', () => {
    expect(framesToTimecode(3661, '60')).toEqual({
      timecode: '00:01:01:01',
      frames: 3661,
      seconds: 61.016666666666666,
      dropFrame: false,
      gridFps: 60,
    });
  });

  it('renders the every-10th-minute drop-frame boundary without dropping', () => {
    expect(framesToTimecode(17982, '29.97', true)).toEqual({
      timecode: '00:10:00;00',
      frames: 17982,
      seconds: 599.9993999999999,
      dropFrame: true,
      gridFps: 30,
    });
  });

  it('round-trips one hour of 29.97 drop-frame', () => {
    expect(framesToTimecode(107892, '29.97', true).timecode).toBe('01:00:00;00');
  });

  it('throws RangeError for a negative frame count', () => {
    expect(() => framesToTimecode(-5, '24')).toThrow(RangeError);
  });

  it('throws RangeError for a fractional frame count', () => {
    expect(() => framesToTimecode(1.5, '24')).toThrow(
      'frames must be a non-negative whole number.',
    );
  });

  it('throws RangeError for an unknown frame rate', () => {
    expect(() =>
      framesToTimecode(0, '48' as unknown as '24'),
    ).toThrow(RangeError);
  });
});
