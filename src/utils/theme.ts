import type { ThemeMode } from '../types';
import timezoneLocations from './themeTimezones.json';

export type ResolvedTheme = Exclude<ThemeMode, 'automatic'>;
const locations: Readonly<Record<string, readonly number[]>> = timezoneLocations;
const radians = Math.PI / 180;

function systemTimezone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
  catch { return ''; }
}

/** Approximate daylight at the IANA reference city for the device timezone.
 * Uses the device clock, including date and DST, without location permissions
 * or network requests. NOAA equations: https://gml.noaa.gov/grad/solcalc/solareqns.PDF
 */
export function resolveTheme(mode: ThemeMode, date = new Date(), timezone = systemTimezone()): ResolvedTheme {
  if (mode !== 'automatic') return mode;
  const location = Object.hasOwn(locations, timezone) ? locations[timezone] : undefined;
  if (!location) {
    // A fixed-offset / unknown timezone has no reliable geographic position.
    const hour = date.getHours();
    return hour < 7 || hour >= 21 ? 'night' : hour < 17 ? 'morning' : 'afternoon';
  }

  const [latitude, longitude] = location;
  const year = date.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const daysInYear = (Date.UTC(year + 1, 0, 1) - yearStart) / 86_400_000;
  // UTC avoids both skipped/repeated civil hours and a separate DST correction.
  const gamma = 2 * Math.PI / daysInYear * ((date.getTime() - yearStart) / 86_400_000 - 0.5);
  const equationOfTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma)
    - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
    - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const solarMinutes = ((utcMinutes + equationOfTime + 4 * longitude) % 1440 + 1440) % 1440;
  const hourAngle = (solarMinutes / 4 - 180) * radians;
  const sinAltitude = Math.sin(latitude * radians) * Math.sin(declination)
    + Math.cos(latitude * radians) * Math.cos(declination) * Math.cos(hourAngle);
  // Apparent sunrise/sunset accounts approximately for refraction and solar disk.
  if (sinAltitude < Math.sin(-0.833 * radians)) return 'night';
  return solarMinutes < 720 ? 'morning' : 'afternoon';
}

/** Refresh immediately after a sleeping/backgrounded window becomes active. */
export function startThemeUpdates(mode: ThemeMode): () => void {
  const apply = () => { document.documentElement.dataset.theme = resolveTheme(mode); };
  apply();
  if (mode !== 'automatic') return () => {};
  const interval = window.setInterval(apply, 60_000);
  window.addEventListener('focus', apply);
  window.addEventListener('pageshow', apply);
  document.addEventListener('visibilitychange', apply);
  return () => {
    window.clearInterval(interval);
    window.removeEventListener('focus', apply);
    window.removeEventListener('pageshow', apply);
    document.removeEventListener('visibilitychange', apply);
  };
}
