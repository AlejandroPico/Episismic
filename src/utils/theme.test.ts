import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveTheme, startThemeUpdates } from './theme';
import locations from './themeTimezones.json';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('automatic solar theme', () => {
  it.each([2024, 2026])('uses night at 04:00 in Madrid throughout %i', (year) => {
    for (let month = 1; month <= 12; month++) {
      const offset = month >= 4 && month <= 10 ? '+02:00' : '+01:00';
      const date = new Date(`${year}-${String(month).padStart(2, '0')}-15T04:00:00${offset}`);
      expect(resolveTheme('automatic', date, 'Europe/Madrid')).toBe('night');
    }
  });

  it.each([
    ['2026-01-15T07:00:00+01:00', 'night'],
    ['2026-01-15T09:00:00+01:00', 'morning'],
    ['2026-01-15T15:00:00+01:00', 'afternoon'],
    ['2026-01-15T18:30:00+01:00', 'night'],
    ['2026-06-21T06:20:00+02:00', 'night'],
    ['2026-06-21T07:00:00+02:00', 'morning'],
    ['2026-06-21T13:00:00+02:00', 'morning'],
    ['2026-06-21T15:00:00+02:00', 'afternoon'],
    ['2026-06-21T21:00:00+02:00', 'afternoon'],
    ['2026-06-21T22:00:00+02:00', 'night'],
  ])('estimates seasonal daylight in Madrid at %s', (timestamp, expected) => {
    expect(resolveTheme('automatic', new Date(timestamp), 'Europe/Madrid')).toBe(expected);
  });

  it.each([
    '2026-03-29T01:59:00+01:00', '2026-03-29T03:00:00+02:00',
    '2026-10-25T02:30:00+02:00', '2026-10-25T02:30:00+01:00',
  ])('keeps night across the skipped/repeated DST hour at %s', (timestamp) => {
    expect(resolveTheme('automatic', new Date(timestamp), 'Europe/Madrid')).toBe('night');
  });

  it('uses the device timezone by default', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ timeZone: 'Europe/Madrid' } as Intl.ResolvedDateTimeFormatOptions);
    expect(resolveTheme('automatic', new Date('2026-10-11T04:00:00+02:00'))).toBe('night');
  });

  it('handles the southern hemisphere and half-hour timezones', () => {
    expect(resolveTheme('automatic', new Date('2026-01-15T20:00:00+11:00'), 'Australia/Sydney')).toBe('afternoon');
    expect(resolveTheme('automatic', new Date('2026-07-15T20:00:00+10:00'), 'Australia/Sydney')).toBe('night');
    expect(resolveTheme('automatic', new Date('2026-10-11T04:00:00+05:30'), 'Asia/Kolkata')).toBe('night');
    expect(resolveTheme('automatic', new Date('2026-10-11T10:00:00+05:30'), 'Asia/Calcutta')).toBe('morning');
  });

  it('handles polar day and polar night without invalid sunrise times', () => {
    expect(resolveTheme('automatic', new Date('2026-06-21T04:00:00+02:00'), 'Arctic/Longyearbyen')).toBe('morning');
    expect(resolveTheme('automatic', new Date('2026-12-21T12:00:00+01:00'), 'Arctic/Longyearbyen')).toBe('night');
  });

  it('uses local hours for unknown and fixed-offset zones, including before dawn', () => {
    for (const timezone of ['Unknown/Zone', 'UTC', 'Etc/GMT+4', 'toString']) {
      for (const [hour, expected] of [[0, 'night'], [4, 'night'], [7, 'morning'], [16, 'morning'], [17, 'afternoon'], [21, 'night']] as const) {
        expect(resolveTheme('automatic', new Date(2026, 9, 11, hour), timezone)).toBe(expected);
      }
    }
  });

  it.each(['morning', 'afternoon', 'night'] as const)('preserves the manual %s theme at 04:00', (mode) => {
    expect(resolveTheme(mode, new Date('2026-10-11T04:00:00+02:00'), 'Europe/Madrid')).toBe(mode);
  });

  it('bundles valid reference coordinates and legacy timezone aliases', () => {
    for (const [latitude, longitude] of Object.values(locations)) {
      expect(Math.abs(latitude)).toBeLessThanOrEqual(90);
      expect(Math.abs(longitude)).toBeLessThanOrEqual(180);
    }
    expect(locations['Europe/Kiev']).toEqual(locations['Europe/Kyiv']);
    expect(locations['US/Pacific']).toEqual(locations['America/Los_Angeles']);
    expect(locations['Europe/Brussels']).not.toEqual(locations['Europe/Paris']);
  });
});

describe('theme refresh lifecycle', () => {
  function setup() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T16:00:00+02:00'));
    // Fake timers wrap DateTimeFormat differently across Node versions. Mock
    // its factory so the returned object's timezone is independent of the host.
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => ({
      resolvedOptions: () => ({ timeZone: 'Europe/Madrid' }),
    }) as Intl.DateTimeFormat);
    const root = { dataset: { theme: '' } };
    const doc = Object.assign(new EventTarget(), { documentElement: root });
    const win = Object.assign(new EventTarget(), { setInterval, clearInterval });
    vi.stubGlobal('document', doc);
    vi.stubGlobal('window', win);
    return { root, doc, win };
  }

  it('applies immediately and recalculates with the current date each minute', () => {
    const { root } = setup();
    const stop = startThemeUpdates('automatic');
    expect(root.dataset.theme).toBe('afternoon');
    vi.setSystemTime(new Date('2026-10-12T04:00:00+02:00'));
    vi.advanceTimersByTime(60_000);
    expect(root.dataset.theme).toBe('night');
    stop();
  });

  it.each(['focus', 'pageshow', 'visibilitychange'])('refreshes after resuming through %s and removes listeners on cleanup', (event) => {
    const { root, doc, win } = setup();
    const stop = startThemeUpdates('automatic');
    vi.setSystemTime(new Date('2026-10-12T04:00:00+02:00'));
    const target = event === 'visibilitychange' ? doc : win;
    target.dispatchEvent(new Event(event));
    expect(root.dataset.theme).toBe('night');
    stop();
    root.dataset.theme = 'sentinel';
    target.dispatchEvent(new Event(event));
    vi.advanceTimersByTime(60_000);
    expect(root.dataset.theme).toBe('sentinel');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps manual selection when the clock or visibility changes', () => {
    const { root, doc, win } = setup();
    const stop = startThemeUpdates('morning');
    vi.setSystemTime(new Date('2026-10-12T04:00:00+02:00'));
    doc.dispatchEvent(new Event('visibilitychange'));
    win.dispatchEvent(new Event('focus'));
    expect(root.dataset.theme).toBe('morning');
    expect(vi.getTimerCount()).toBe(0);
    stop();
  });
});
