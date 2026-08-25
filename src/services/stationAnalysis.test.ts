import { describe, expect, it } from 'vitest';
import type { SeismicStation } from '../types';
import { elevationContext, fdsnStationLinks, geographicContext, nearestStation, networkMembership, operationalSpan, stationAzimuthCoverage, stationDensity, stationGeoJson } from './stationAnalysis';

const station = (id: string, lat: number, lng: number, elevationM = 100, network = 'XX') => ({ id, network, code: id, name: id, country: 'España', lat, lng, elevationM, status: 'online', source: 'EarthScope', dataUrl: '' } as SeismicStation);

describe('inteligencia de red sísmica', () => {
  const main = station('A', 0, 0, 500);
  const stations = [main, station('B', 0, 1, 100), station('C', 1, 0, 900), station('D', 0, -1, 50, 'YY'), station('E', -1, 0, 200, 'YY')];

  it('resume red, proximidad y densidad', () => {
    expect(networkMembership(main, stations).memberCount).toBe(3);
    expect(nearestStation(main, stations)?.distanceKm).toBeCloseTo(111, 0);
    expect(stationDensity(main, stations).within500Km).toBe(4);
  });

  it('calcula cobertura azimutal y contexto de elevación', () => {
    expect(stationAzimuthCoverage(main, stations).coverage).toBe(.5);
    expect(elevationContext(main, stations).percentile).toBe(80);
  });

  it('interpreta periodo operativo y geografía', () => {
    const dated = { ...main, startTime: '2000-01-01T00:00:00Z' };
    expect(operationalSpan(dated, new Date('2020-01-01T00:00:00Z')).years).toBeCloseTo(20, 0);
    expect(geographicContext(station('S', -30, -10)).zone).toBe('Templada');
  });

  it('genera enlaces FDSN y GeoJSON', () => {
    expect(fdsnStationLinks(main, new Date('2026-01-01T00:00:00Z')).stationXml).toContain('net=XX');
    expect(JSON.parse(stationGeoJson(main)).geometry.coordinates).toEqual([0, 0, 500]);
  });
});
