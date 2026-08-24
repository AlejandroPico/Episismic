import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const outputDir = path.resolve('public/data');

const stationProviders = [
  {
    source: 'EarthScope',
    baseUrl: 'https://service.earthscope.org/fdsnws/station/1/',
    url: 'https://service.earthscope.org/fdsnws/station/1/query?format=text&level=station&includerestricted=false',
  },
  {
    source: 'GEOFON',
    baseUrl: 'https://geofon.gfz-potsdam.de/fdsnws/station/1/',
    url: 'https://geofon.gfz-potsdam.de/fdsnws/station/1/query?format=text&level=station&includerestricted=false',
  },
  {
    source: 'NCEDC',
    baseUrl: 'https://service.ncedc.org/fdsnws/station/1/',
    url: 'https://service.ncedc.org/fdsnws/station/1/query?format=text&level=station&includerestricted=false',
  },
  {
    source: 'BMKG',
    baseUrl: 'https://geof.bmkg.go.id/fdsnws/station/1/',
    url: 'https://geof.bmkg.go.id/fdsnws/station/1/query?format=text&level=station&includerestricted=false',
  },
];

const plateSources = [
  ['plate-boundaries.json', 'https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json'],
  ['plate-orogens.json', 'https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_orogens.json'],
];

async function fetchText(url) {
  const response = await fetch(url, { headers: { Accept: 'text/plain, application/json', 'User-Agent': 'Episismic geodata sync' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

function countryFromSite(siteName) {
  const parts = siteName.split(',').map((value) => value.trim()).filter(Boolean);
  return parts.length > 1 ? parts.at(-1) : '—';
}

function parseStations(text, provider) {
  return text.split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split('|'))
    .filter((columns) => columns.length >= 8)
    .map(([network, code, latitude, longitude, elevation, siteName, startTime, endTime]) => ({
      id: `${network}.${code}`,
      network,
      code,
      name: siteName || `${network}.${code}`,
      country: countryFromSite(siteName || ''),
      lat: Number(latitude),
      lng: Number(longitude),
      elevationM: Number(elevation) || 0,
      status: 'unknown',
      dataUrl: `${provider.baseUrl}query?network=${encodeURIComponent(network)}&station=${encodeURIComponent(code)}&level=station&format=text`,
      source: provider.source,
      startTime: startTime || null,
      endTime: endTime || null,
    }))
    .filter((station) => Number.isFinite(station.lat) && Number.isFinite(station.lng));
}

async function syncStations() {
  const batches = await Promise.allSettled(stationProviders.map(async (provider) => ({
    provider,
    stations: parseStations(await fetchText(provider.url), provider),
  })));
  const deduplicated = new Map();
  for (const batch of batches) {
    if (batch.status === 'rejected') {
      console.warn(`Proveedor FDSN omitido: ${batch.reason instanceof Error ? batch.reason.message : batch.reason}`);
      continue;
    }
    console.log(`${batch.value.provider.source}: ${batch.value.stations.length} estaciones catalogadas.`);
    for (const station of batch.value.stations) {
    const current = deduplicated.get(station.id);
    if (!current || current.source !== 'EarthScope') deduplicated.set(station.id, station);
    }
  }
  const stations = [...deduplicated.values()].sort((a, b) => a.id.localeCompare(b.id));
  await writeFile(path.join(outputDir, 'stations.json.gz'), gzipSync(`${JSON.stringify(stations)}\n`, { level: 9 }));
  return stations.length;
}

async function syncVolcanoes() {
  const url = 'https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=GVP-VOTW%3ASmithsonian_VOTW_Holocene_Volcanoes&outputFormat=application%2Fjson&maxFeatures=2000';
  const collection = JSON.parse(await fetchText(url));
  const volcanoes = collection.features.map((feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    const properties = feature.properties;
    return {
      id: String(properties.Volcano_Number),
      name: properties.Volcano_Name,
      country: properties.Country || '—',
      lat,
      lng,
      elevationM: Number(properties.Elevation ?? properties.Elevation_m ?? 0),
      status: 'catalogued',
      region: properties.Region || '',
      volcanoType: properties.Primary_Volcano_Type || properties.Volcanic_Landform || '',
      lastEruptionYear: properties.Last_Eruption_Year ?? null,
      sourceUrl: `https://volcano.si.edu/volcano.cfm?vn=${properties.Volcano_Number}`,
    };
  }).filter((volcano) => Number.isFinite(volcano.lat) && Number.isFinite(volcano.lng));
  await writeFile(path.join(outputDir, 'volcanoes.json.gz'), gzipSync(`${JSON.stringify(volcanoes)}\n`, { level: 9 }));
  return volcanoes.length;
}

async function syncPlates() {
  for (const [filename, url] of plateSources) {
    const data = JSON.parse(await fetchText(url));
    await writeFile(path.join(outputDir, filename), `${JSON.stringify(data)}\n`);
  }
}

await mkdir(outputDir, { recursive: true });
const [stationCount, volcanoCount] = await Promise.all([syncStations(), syncVolcanoes(), syncPlates()]);
console.log(`Geodatos sincronizados: ${stationCount} estaciones, ${volcanoCount} volcanes y PB2002.`);
