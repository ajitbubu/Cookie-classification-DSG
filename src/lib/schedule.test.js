import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { nextRunTime, resumedNextRun, startsLater, utcTimeToLocal, scheduleFromStartDate } from './schedule';

// Local-time helpers so the tests hold in any timezone.
const at = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min, 0, 0);

describe('nextRunTime (moved from App.getNextRunTime)', () => {
  const now = at(2026, 10, 12, 10, 0); // Monday 12 Oct 2026, 10:00

  it('runs daily jobs at the set time, today if still ahead', () => {
    expect(nextRunTime({ unit: 'daily', scheduleTime: '11:00' }, now)).toEqual(at(2026, 10, 12, 11, 0));
    expect(nextRunTime({ unit: 'daily', scheduleTime: '09:00' }, now)).toEqual(at(2026, 10, 13, 9, 0));
  });

  it('runs weekly jobs on their weekday and monthly jobs on their date', () => {
    expect(nextRunTime({ unit: 'weekly', scheduleDay: 'friday', scheduleTime: '07:30' }, now)).toEqual(at(2026, 10, 16, 7, 30));
    expect(nextRunTime({ unit: 'monthly', scheduleDate: 1, scheduleTime: '02:00' }, now)).toEqual(at(2026, 11, 1, 2, 0));
  });

  it('waits for a future start date (Figma "Start Date")', () => {
    const job = { unit: 'weekly', scheduleDay: 'friday', scheduleTime: '07:30', startDate: '2026-11-20' };
    expect(nextRunTime(job, now)).toEqual(at(2026, 11, 20, 7, 30));
    expect(nextRunTime({ unit: 'daily', scheduleTime: '02:00', startDate: '2026-10-20' }, now)).toEqual(at(2026, 10, 20, 2, 0));
  });

  it('ignores a start date in the past', () => {
    expect(nextRunTime({ unit: 'daily', scheduleTime: '11:00', startDate: '2026-01-01' }, now)).toEqual(at(2026, 10, 12, 11, 0));
  });

  it('is always in the future', () => {
    fc.assert(fc.property(
      fc.constantFrom('minutes', 'hourly', 'daily', 'weekly', 'monthly'),
      fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }), fc.integer({ min: 1, max: 28 }),
      fc.constantFrom('sunday', 'monday', 'friday'),
      (unit, h, m, date, day) => {
        const job = { unit, interval: 30, scheduleTime: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, scheduleDate: date, scheduleDay: day };
        expect(nextRunTime(job, now).getTime()).toBeGreaterThan(now.getTime());
      }
    ));
  });
});

describe('startsLater', () => {
  it('is true only when the start date and time are still ahead', () => {
    const now = at(2026, 10, 12, 10, 0);
    expect(startsLater({ startDate: '2026-10-13', scheduleTime: '02:00' }, now)).toBe(true);
    expect(startsLater({ startDate: '2026-10-12', scheduleTime: '09:00' }, now)).toBe(false);
    expect(startsLater({}, now)).toBe(false);
  });
});

describe('scheduleFromStartDate', () => {
  it('takes the weekday and day of month from the start date', () => {
    expect(scheduleFromStartDate('2026-10-16')).toEqual({ day: 'friday', date: 16 });
    expect(scheduleFromStartDate('')).toEqual({ day: null, date: null });
  });
});

describe('utcTimeToLocal', () => {
  it('converts a UTC run time to the same instant in local time', () => {
    const local = utcTimeToLocal('02:00', '2026-10-12');
    const instant = new Date(Date.UTC(2026, 9, 12, 2, 0));
    expect(local).toBe(`${String(instant.getHours()).padStart(2, '0')}:${String(instant.getMinutes()).padStart(2, '0')}`);
  });
});

describe('resumedNextRun (stored jobs restarted on page load)', () => {
  const now = at(2026, 11, 21, 19, 0);
  const iso = (d) => d.toISOString();

  it('keeps a stored time that is still ahead', () => {
    const job = { unit: 'minutes', interval: 30, nextRun: iso(at(2026, 11, 21, 19, 20)) };
    expect(resumedNextRun(job, now)).toBe(job.nextRun);
  });

  it('restarts a past minutes/hourly time from now, when the timer will fire', () => {
    expect(resumedNextRun({ unit: 'minutes', interval: 30, nextRun: iso(at(2026, 11, 21, 13, 8)) }, now))
      .toBe(iso(at(2026, 11, 21, 19, 30)));
    expect(resumedNextRun({ unit: 'hourly', interval: 2, nextRun: iso(at(2026, 11, 20, 9, 0)) }, now))
      .toBe(iso(at(2026, 11, 21, 21, 0)));
  });

  it('keeps a missed daily/weekly/monthly time so the due check runs it once', () => {
    const job = { unit: 'daily', scheduleTime: '02:00', nextRun: iso(at(2026, 11, 21, 2, 0)) };
    expect(resumedNextRun(job, now)).toBe(job.nextRun);
  });

  it('computes a time when none (or garbage) was stored', () => {
    expect(resumedNextRun({ unit: 'daily', scheduleTime: '02:00' }, now)).toBe(iso(at(2026, 11, 22, 2, 0)));
    expect(resumedNextRun({ unit: 'weekly', scheduleDay: 'monday', scheduleTime: '07:30', nextRun: 'not a date' }, now))
      .toBe(iso(at(2026, 11, 23, 7, 30)));
  });

  it('never leaves a minutes/hourly job showing a past time', () => {
    fc.assert(fc.property(
      fc.constantFrom('minutes', 'hourly'), fc.integer({ min: 1, max: 48 }), fc.integer({ min: -100000, max: 100000 }),
      (unit, interval, offsetMin) => {
        const job = { unit, interval, nextRun: iso(new Date(now.getTime() + offsetMin * 60000)) };
        return new Date(resumedNextRun(job, now)) > now;
      },
    ));
  });
});
