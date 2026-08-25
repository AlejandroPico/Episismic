import { describe, expect, it } from 'vitest';
import { nearestStationArrivals, travelTimeSeconds, waveRadiusKm } from './travelTimes';
import type { Earthquake, SeismicStation } from '../types';

describe('modelo simplificado de propagación sísmica', () => {
  it('ordena las llegadas P, S y superficiales', () => {
    const p = travelTimeSeconds('P', 500, 20);
    const s = travelTimeSeconds('S', 500, 20);
    const surface = travelTimeSeconds('SURFACE', 500, 20);
    expect(p).toBeLessThan(s);
    expect(s).toBeLessThan(surface);
  });

  it('no proyecta el frente corporal en superficie antes de recorrer la profundidad', () => {
    expect(waveRadiusKm('P', 1, 30)).toBe(0);
    expect(waveRadiusKm('P', 10, 30)).toBeGreaterThan(0);
  });

  it('selecciona las estaciones más próximas en orden', () => {
    const event = { id: 'e', lat: 0, lng: 0, depthKm: 10 } as Earthquake;
    const station = (id: string, lng: number) => ({ id, network: 'T', code: id, lat: 0, lng } as SeismicStation);
    const result = nearestStationArrivals(event, [station('lejos', 10), station('cerca', 1), station('media', 4)], 2);
    expect(result.map((item) => item.station.id)).toEqual(['cerca', 'media']);
  });
});
