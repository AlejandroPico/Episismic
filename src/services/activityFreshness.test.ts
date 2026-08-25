import { describe, expect, it } from 'vitest';
import { ALERT_MAX_ORIGIN_AGE_MS, isRecentForAlert } from './activityFreshness';

describe('vigencia de avisos sísmicos', () => {
  it('acepta orígenes recientes y descarta revisiones antiguas', () => {
    const now = 2_000_000_000;
    expect(isRecentForAlert({ time: now - 2 * 60_000 }, now)).toBe(true);
    expect(isRecentForAlert({ time: now - ALERT_MAX_ORIGIN_AGE_MS - 1 }, now)).toBe(false);
    expect(isRecentForAlert({ time: now - 23 * 60 * 60_000 }, now)).toBe(false);
  });
});
