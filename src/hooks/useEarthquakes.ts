import { useCallback, useEffect, useRef, useState } from 'react';
import { fallbackEarthquakes } from '../data/fallbackEarthquakes';
import { getStoredEarthquakes, upsertEarthquakes } from '../services/database';
import { fetchCombinedEarthquakes } from '../services/catalog';
import { isRecentForAlert } from '../services/activityFreshness';
import type { DataStatus, Earthquake, SeismicActivity, TimeWindow } from '../types';
import { windowStart } from '../utils/format';

export function useEarthquakes(timeWindow: TimeWindow) {
  const [events, setEvents] = useState<Earthquake[]>([]);
  const [status, setStatus] = useState<DataStatus>({ state: 'loading', lastUpdated: null });
  const [newEvent, setNewEvent] = useState<Earthquake | null>(null);
  const [newEvents, setNewEvents] = useState<Earthquake[]>([]);
  const [activities, setActivities] = useState<SeismicActivity[]>([]);
  const initialized = useRef(false);
  const knownEvents = useRef(new Map<string, Earthquake>());

  const refresh = useCallback(async (background = false) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 14_000);
    if (!background) setStatus((current) => ({ ...current, state: 'loading' }));
    try {
      const { events: live, sources } = await fetchCombinedEarthquakes(timeWindow, controller.signal);
      const changes: SeismicActivity[] = [];
      if (initialized.current) {
        for (const event of live) {
          if (!isRecentForAlert(event)) continue;
          const previous = knownEvents.current.get(event.id);
          if (!previous) {
            changes.push({ event, previous: null, kind: 'new' });
            continue;
          }
          if (event.updated <= previous.updated) continue;
          if (event.magnitude > previous.magnitude + .049) {
            changes.push({ event, previous, kind: 'magnitude' });
          } else if (event.catalogs.length > previous.catalogs.length) {
            changes.push({ event, previous, kind: 'corroborated' });
          } else {
            changes.push({ event, previous, kind: 'revision' });
          }
        }
      }
      changes.sort((a, b) => {
        const priority = { magnitude: 4, new: 3, corroborated: 2, revision: 1 };
        return priority[b.kind] - priority[a.kind] || b.event.magnitude - a.event.magnitude || b.event.updated - a.event.updated;
      });
      knownEvents.current = new Map(live.map((event) => [event.id, event]));
      initialized.current = true;
      setEvents(live);
      setActivities(changes.slice(0, 16));
      setNewEvents(changes.slice(0, 16).map((change) => change.event));
      setNewEvent(changes[0]?.event ?? null);
      setStatus({ state: 'live', lastUpdated: Date.now(), sources });
      void upsertEarthquakes(live);
    } catch (error) {
      const cached = await getStoredEarthquakes(windowStart(timeWindow)).catch(() => []);
      setEvents(cached.length ? cached : fallbackEarthquakes.filter((event) => event.time >= windowStart(timeWindow)));
      setStatus({ state: cached.length ? 'cached' : 'error', lastUpdated: null, message: error instanceof Error ? error.message : 'No se pudo actualizar el catálogo' });
    } finally {
      window.clearTimeout(timeout);
    }
  }, [timeWindow]);

  useEffect(() => {
    initialized.current = false;
    knownEvents.current.clear();
    void refresh();
    const interval = window.setInterval(() => void refresh(true), 30_000);
    const catchUp = () => { if (!document.hidden) void refresh(true); };
    document.addEventListener('visibilitychange', catchUp);
    window.addEventListener('online', catchUp);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', catchUp);
      window.removeEventListener('online', catchUp);
    };
  }, [refresh]);

  return { events, status, newEvent, newEvents, activities, refresh };
}
