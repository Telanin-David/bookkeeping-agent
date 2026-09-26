import { todayIso, addDays, daysBetween } from './dates';

describe('dates (business time zone: Africa/Lagos)', () => {
  it('counts "today" in Lagos, which is ahead of UTC after 11pm UTC', () => {
    expect(todayIso(new Date('2026-09-25T23:30:00Z'))).toBe('2026-09-26');
    expect(todayIso(new Date('2026-09-25T22:30:00Z'))).toBe('2026-09-25');
  });

  it('adds days across month and leap-year boundaries', () => {
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('counts whole days between calendar dates', () => {
    expect(daysBetween('2026-09-01', '2026-09-25')).toBe(24);
    expect(daysBetween('2026-09-25', '2026-09-20')).toBe(-5);
  });
});
