import { describe, it, expect } from 'vitest';
import {
  buildCronExpression,
  DEFAULT_CRON_SCHEDULE,
  type CronSchedule,
} from '../../src/time/cron-builder';

describe('buildCronExpression', () => {
  it('renders all-every defaults as "* * * * *"', () => {
    expect(buildCronExpression()).toEqual({
      expression: '* * * * *',
      description:
        'Runs every minute, every hour, every day of month, every month, every day of week.',
    });
    // Passing the default explicitly is equivalent to the no-arg call.
    expect(buildCronExpression(DEFAULT_CRON_SCHEDULE)).toEqual(buildCronExpression());
  });

  it('renders a step on the minute field as "*/15 * * * *"', () => {
    const schedule: CronSchedule = {
      minute: { mode: 'step', value: 0, step: 15 },
      hour: { mode: 'every', value: 0, step: 1 },
      dom: { mode: 'every', value: 1, step: 1 },
      month: { mode: 'every', value: 1, step: 1 },
      dow: { mode: 'every', value: 0, step: 1 },
    };
    expect(buildCronExpression(schedule)).toEqual({
      expression: '*/15 * * * *',
      description:
        'Runs every 15 minutes, every hour, every day of month, every month, every day of week.',
    });
  });

  it('renders fixed values and names day-of-week ("0 9 * * 1")', () => {
    const schedule: CronSchedule = {
      minute: { mode: 'value', value: 0, step: 5 },
      hour: { mode: 'value', value: 9, step: 1 },
      dom: { mode: 'every', value: 1, step: 1 },
      month: { mode: 'every', value: 1, step: 1 },
      dow: { mode: 'value', value: 1, step: 1 },
    };
    expect(buildCronExpression(schedule)).toEqual({
      expression: '0 9 * * 1',
      description:
        'Runs at minute 0, at hour 9, every day of month, every month, at day of week Monday.',
    });
  });

  it('uses month names and handles step singular/plural correctly', () => {
    const named: CronSchedule = {
      minute: { mode: 'value', value: 30, step: 5 },
      hour: { mode: 'value', value: 23, step: 1 },
      dom: { mode: 'value', value: 15, step: 1 },
      month: { mode: 'value', value: 6, step: 1 },
      dow: { mode: 'every', value: 0, step: 1 },
    };
    expect(buildCronExpression(named)).toEqual({
      expression: '30 23 15 6 *',
      description:
        'Runs at minute 30, at hour 23, at day of month 15, at month June, every day of week.',
    });

    const singularPlural: CronSchedule = {
      minute: { mode: 'step', value: 0, step: 1 },
      hour: { mode: 'step', value: 0, step: 2 },
      dom: { mode: 'every', value: 1, step: 1 },
      month: { mode: 'every', value: 1, step: 1 },
      dow: { mode: 'every', value: 0, step: 1 },
    };
    expect(buildCronExpression(singularPlural)).toEqual({
      expression: '*/1 */2 * * *',
      description:
        'Runs every 1 minute, every 2 hours, every day of month, every month, every day of week.',
    });
  });

  it('throws RangeError when a value is out of range', () => {
    expect(() =>
      buildCronExpression({
        ...DEFAULT_CRON_SCHEDULE,
        minute: { mode: 'value', value: 60, step: 5 },
      }),
    ).toThrow(RangeError);
    expect(() =>
      buildCronExpression({
        ...DEFAULT_CRON_SCHEDULE,
        month: { mode: 'step', value: 1, step: 0 },
      }),
    ).toThrow(/step must be an integer in \[1, 12\]/);
  });

  it('throws TypeError on an invalid mode', () => {
    expect(() =>
      buildCronExpression({
        ...DEFAULT_CRON_SCHEDULE,
        hour: { mode: 'bogus' as never, value: 0, step: 1 },
      }),
    ).toThrow(TypeError);
  });
});
