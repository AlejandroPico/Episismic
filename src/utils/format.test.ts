import { describe, expect, it } from 'vitest';
import { eventRadius, formatMagnitude, haversineKm, windowStart } from './format';

describe('format utilities', () => {
  it('formats magnitudes consistently', () => expect(formatMagnitude(5.34)).toBe('M5.3'));
  it('grows the marker radius with magnitude', () => expect(eventRadius({ magnitude: 7 } as never)).toBeGreaterThan(eventRadius({ magnitude: 3 } as never)));
  it('computes plausible great-circle distances', () => expect(haversineKm({ lat: 40.4168, lng: -3.7038 }, { lat: 41.3874, lng: 2.1686 })).toBeCloseTo(505, -1));
  it('maps a day to 24 hours', () => expect(windowStart('day', 100_000_000)).toBe(13_600_000));
  it('maps the extended window to exactly 90 days', () => {
    const now = Date.parse('2026-10-11T04:00:00+02:00');
    expect(now - windowStart('quarter', now)).toBe(90 * 86_400_000);
    expect(now - windowStart('month', now)).toBe(30 * 86_400_000);
  });
});
