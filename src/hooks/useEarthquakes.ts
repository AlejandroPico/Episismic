import { useCallback, useEffect, useRef, useState } from 'react';
import { fallbackEarthquakes } from '../data/fallbackEarthquakes';
import { getStoredEarthquakes, upsertEarthquakes } from '../services/database';
import { fetchCombinedEarthquakes } from '../services/catalog';
import type { DataStatus, Earthquake, TimeWindow } from '../types';
import { windowStart } from '../utils/format';

export function useEarthquakes(timeWindow: TimeWindow) {
  const [events, setEvents] = useState<Earthquake[]>([]);
  const [status, setStatus] = useState<DataStatus>({ state: 'loading', lastUpdated: null });
  const [newEvent, setNewEvent] = useState<Earthquake | null>(null);
  const initialized = useRef(false);
  const knownUpdates = useRef(new Map<string, number>());

  const refresh = useCallback(async (background = false) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 14_000);
    if (!background) setStatus((current) => ({ ...current, state: 'loading' }));
    try {
      const { events: live, sources } = await fetchCombinedEarthquakes(timeWindow, controller.signal);
      const unseen = initialized.current
        ? live.find((event) => !knownUpdates.current.has(event.id) && Date.now() - event.time < 8 * 60_000)
        : null;
      const revised = initialized.current
        ? live.find((event) => (knownUpdates.current.get(event.id) ?? event.updated) < event.updated && event.magnitude >= 5)
        : null;
      knownUpdates.current = new Map(live.map((event) => [event.id, event.updated]));
      initialized.current = true;
      setEvents(live);
      setNewEvent(unseen ?? revised ?? null);
      setStatus({ state: 'live', lastUpdated: Date.now(), sources });
      void upsertEarthquakes(live);
    } catch (error) {
      const cached = await getStoredEarthquakes(windowStart(timeWindow)).catch(() => []);
      setEvents(cached.length ? cached : fallbackEarthquakes.filter((event) => event.time >= windowStart(timeWindow)));
      setStatus({
        state: cached.length ? 'cached' : 'error',
        lastUpdated: null,
        message: error instanceof Error ? error.message : 'No se pudo actualizar el catálogo',
      });
    } finally {
      window.clearTimeout(timeout);
    }
  }, [timeWindow]);

  useEffect(() => {
    initialized.current = false;
    void refresh();
    const interval = window.setInterval(() => void refresh(true), 30_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return { events, status, newEvent, refresh };
}
