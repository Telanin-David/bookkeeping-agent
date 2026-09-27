import { inQuietHours } from './alertWorker';
import { esc } from './email';

// Lagos is UTC+1 all year (no daylight saving), so 21:30 UTC is 22:30 in Lagos.
const lagos = (hhmm: string) => new Date(`2026-09-27T${hhmm}:00+01:00`);

describe('quiet hours (shop time)', () => {
  it('wraps midnight: 22:00–07:00', () => {
    expect(inQuietHours(lagos('22:30'), '22:00', '07:00')).toBe(true);
    expect(inQuietHours(lagos('03:00'), '22:00', '07:00')).toBe(true);
    expect(inQuietHours(lagos('07:00'), '22:00', '07:00')).toBe(false);
    expect(inQuietHours(lagos('12:00'), '22:00', '07:00')).toBe(false);
  });

  it('works within one day: 13:00–15:00', () => {
    expect(inQuietHours(lagos('14:00'), '13:00', '15:00')).toBe(true);
    expect(inQuietHours(lagos('15:00'), '13:00', '15:00')).toBe(false);
  });

  it('same start and end means never quiet', () => {
    expect(inQuietHours(lagos('03:00'), '00:00', '00:00')).toBe(false);
  });

  it('uses shop time, not the server clock: 21:30 UTC is already 22:30 in Lagos', () => {
    expect(inQuietHours(new Date('2026-09-27T21:30:00Z'), '22:00', '07:00')).toBe(true);
  });
});

describe('email escaping', () => {
  it('neutralises HTML in names and messages', () => {
    expect(esc('<img src=x onerror=alert(1)> & "Mama" \'N\'')).toBe('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;Mama&quot; &#39;N&#39;');
  });
});
