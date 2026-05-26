import { addDays } from 'date-fns';
import { describe, expect, it } from 'vitest';

import { generateSipDates } from './sipScheduler.js';

describe('generateSipDates', () => {
  it('returns empty when endDate < startDate', () => {
    expect(
      generateSipDates({
        startDate: new Date('2025-06-10'),
        endDate: new Date('2025-06-01'),
        dayOfMonth: 5,
      }),
    ).toEqual([]);
  });

  it('throws when dayOfMonth is out of range', () => {
    expect(() =>
      generateSipDates({
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
        dayOfMonth: 0,
      }),
    ).toThrow();
    expect(() =>
      generateSipDates({
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
        dayOfMonth: 29,
      }),
    ).toThrow();
  });

  it('generates one date per month between start and end', () => {
    const dates = generateSipDates({
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-06-30'),
      dayOfMonth: 10,
    });
    expect(dates).toHaveLength(6);
    for (const d of dates) {
      expect(d.getDate()).toBe(10);
    }
  });

  it('skips first month when its SIP day has already passed at startDate', () => {
    const dates = generateSipDates({
      startDate: new Date('2025-01-15'),
      endDate: new Date('2025-03-31'),
      dayOfMonth: 10,
    });
    // Jan 10 < Jan 15 → skip Jan; expect Feb 10, Mar 10
    expect(dates).toHaveLength(2);
    expect(dates[0]!.getMonth()).toBe(1); // Feb (0-indexed)
    expect(dates[1]!.getMonth()).toBe(2); // Mar
  });

  it('applies adjustDate callback (e.g. business-day shift)', () => {
    const dates = generateSipDates({
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-03-31'),
      dayOfMonth: 10,
      adjustDate: (d) => addDays(d, 1), // dummy: shift by 1 day
    });
    expect(dates).toHaveLength(3);
    expect(dates[0]!.getDate()).toBe(11);
  });
});
