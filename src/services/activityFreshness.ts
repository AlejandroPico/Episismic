import type { Earthquake } from '../types';

export const ALERT_MAX_ORIGIN_AGE_MS = 15 * 60_000;

export function isRecentForAlert(event: Pick<Earthquake, 'time'>, now = Date.now()) {
  const age = now - event.time;
  return age >= -60_000 && age <= ALERT_MAX_ORIGIN_AGE_MS;
}
