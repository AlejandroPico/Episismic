import { describe, expect, it } from 'vitest';
import type { SeismicStation } from '../types';
import { fdsnServiceRoot, fdsnStationLinks, parseFdsnChannels, selectThreeComponentChannels } from './fdsnWaveforms';

const inventory = `#Network|Station|Location|Channel|Latitude|Longitude|Elevation|Depth|Azimuth|Dip|SensorDescription|Scale|ScaleFreq|ScaleUnits|SampleRate|StartTime|EndTime\nXX|AAA|00|BHZ|0|0|0|0|0|-90|sensor|1|1|counts|20|2020-01-01T00:00:00|\nXX|AAA|00|BH1|0|0|0|0|0|0|sensor|1|1|counts|20|2020-01-01T00:00:00|\nXX|AAA|00|BH2|0|0|0|0|90|0|sensor|1|1|counts|20|2020-01-01T00:00:00|`;

describe('acceso instrumental FDSN', () => {
  it('interpreta y selecciona una terna ZNE real', () => {
    const selected = selectThreeComponentChannels(parseFdsnChannels(inventory), new Date('2026-01-01').getTime());
    expect(selected.map((item) => item.channel)).toEqual(['BHZ', 'BH1', 'BH2']);
  });

  it('enruta cada estación a su centro de datos', () => {
    const station = { network: 'GE', code: 'MORC', source: 'GEOFON' } as SeismicStation;
    expect(fdsnServiceRoot(station)).toBe('https://geofon.gfz.de');
    expect(fdsnStationLinks(station).miniSeed).toContain('geofon.gfz.de/fdsnws/dataselect');
  });
});
