// Pin the time zone before importing the module so local-calendar outputs
// (iso / weekday / daysFromToday) are deterministic regardless of the host TZ.
process.env.TZ = 'UTC';

import { describe, it, expect } from 'vitest';
import { findBirthdayMilestones } from '../../src/time/birthday-milestone-finder';

// Fixed reference "now": 2026-06-02 12:00 UTC (epoch ms). All golden values below
// were produced by executing the implementation under TZ=UTC with this exact now.
const NOW = 1780401600000;

describe('findBirthdayMilestones', () => {
  it('computes milestones for a mid-life birthday with default time', () => {
    const r = findBirthdayMilestones('1995-06-15', { now: NOW });

    expect(r.bornIso).toBe('1995-06-15');
    expect(r.milestones).toHaveLength(34);
    expect(r.upcomingCount).toBe(16);

    const first = r.milestones[0];
    expect(first).toBeDefined();
    expect(first?.iso).toBe('1996-05-27');
    expect(first?.weekday).toBe('Mon');
    expect(first?.label).toBe('500,000 minutes old');
    expect(first?.daysFromToday).toBe(-10963);

    const last = r.milestones[r.milestones.length - 1];
    expect(last).toBeDefined();
    expect(last?.iso).toBe('2095-06-15');
    expect(last?.weekday).toBe('Wed');
    expect(last?.label).toBe('100th birthday');
    expect(last?.daysFromToday).toBe(25215);

    const tenK = r.milestones.find((m) => m.label === '10,000 days old');
    expect(tenK?.iso).toBe('2022-10-31');
    const oneK = r.milestones.find((m) => m.label === '1,000 days old');
    expect(oneK?.iso).toBe('1998-03-11');
  });

  it('honors an explicit birth time and clamps the horizon for a young person', () => {
    const r = findBirthdayMilestones('2000-01-01', { birthTime: '06:30', now: NOW });

    expect(r.bornIso).toBe('2000-01-01');
    expect(r.milestones).toHaveLength(32);
    expect(r.upcomingCount).toBe(17);

    const billion = r.milestones.find((m) => m.label === '1 billion seconds old');
    expect(billion?.iso).toBe('2031-09-09');

    const last = r.milestones[r.milestones.length - 1];
    expect(last?.iso).toBe('2100-01-01');
    expect(last?.weekday).toBe('Fri');
    expect(last?.daysFromToday).toBe(26876);
  });

  it('emits more day-markers (up to the 40,000-day cap) for an older birthday', () => {
    const r = findBirthdayMilestones('1950-12-31', { now: NOW });

    expect(r.bornIso).toBe('1950-12-31');
    expect(r.milestones).toHaveLength(50);
    expect(r.upcomingCount).toBe(9);

    const last = r.milestones[r.milestones.length - 1];
    expect(last?.label).toBe('100th birthday');
    expect(last?.iso).toBe('2050-12-31');
    expect(last?.weekday).toBe('Sat');
    expect(last?.daysFromToday).toBe(8978);
  });

  it('returns milestones sorted ascending by date', () => {
    const r = findBirthdayMilestones('1995-06-15', { now: NOW });
    for (let i = 1; i < r.milestones.length; i++) {
      const prev = r.milestones[i - 1];
      const cur = r.milestones[i];
      expect(prev).toBeDefined();
      expect(cur).toBeDefined();
      expect(cur!.date.getTime()).toBeGreaterThanOrEqual(prev!.date.getTime());
    }
  });

  it('throws RangeError on an invalid calendar date (Feb 30)', () => {
    expect(() => findBirthdayMilestones('2026-02-30', { now: NOW })).toThrow(RangeError);
  });

  it('throws RangeError when the birth moment is in the future', () => {
    expect(() => findBirthdayMilestones('2099-01-01', { now: NOW })).toThrow(
      /in the future/,
    );
  });

  it('throws TypeError when birthDate is not a string', () => {
    // @ts-expect-error intentional misuse for the error path
    expect(() => findBirthdayMilestones(19950615, { now: NOW })).toThrow(TypeError);
  });
});
