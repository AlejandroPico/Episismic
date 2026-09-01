import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const outputDir = path.resolve('public/data');
const secondaryStationShardCount = 16;

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

async function fetchText(url, encoding = 'utf-8') {
  const response = await fetch(url, { headers: { Accept: 'text/plain, application/json, application/rss+xml', 'User-Agent': 'Episismic geodata sync' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return new TextDecoder(encoding).decode(await response.arrayBuffer());
}

function decodeXmlText(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .trim();
}

function rssTag(item, tag) {
  return decodeXmlText(item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1] || '');
}

function weeklyActivityCode(label) {
  const normalized = label.toLowerCase();
  if (normalized.includes('new') && normalized.includes('eruptive')) return 'new-eruption';
  if (normalized.includes('continuing') && normalized.includes('eruptive')) return 'continuing-eruption';
  if (normalized.includes('new') && normalized.includes('unrest')) return 'new-unrest';
  if (normalized.includes('continuing') && normalized.includes('unrest')) return 'continuing-unrest';
  return 'other';
}

function parseWeeklyVolcanicActivity(xml) {
  const reports = new Map();
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const item = match[1];
    const guid = rssTag(item, 'guid');
    const volcanoId = guid.match(/#vn_(\d+)/)?.[1];
    const title = rssTag(item, 'title');
    const titleParts = title.match(/ - Report for (.+?) - (.+)$/i);
    if (!volcanoId || !titleParts) continue;
    const published = new Date(rssTag(item, 'pubDate'));
    reports.set(volcanoId, {
      weeklyActivity: weeklyActivityCode(titleParts[2]),
      weeklyActivityLabel: titleParts[2],
      weeklyReportPeriod: titleParts[1],
      weeklyReportUpdatedAt: Number.isNaN(published.getTime()) ? undefined : published.toISOString(),
      weeklyReportUrl: `https://volcano.si.edu/reports_weekly.cfm#vn_${volcanoId}`,
    });
  }
  return reports;
}

function countryFromSite(siteName) {
  const parts = siteName.split(',').map((value) => value.trim()).filter(Boolean);
  return parts.length > 1 ? parts.at(-1) : '—';
}

function parseStations(text, provider, currentOnly = true) {
  const now = Date.now();
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
    .filter((station) => {
      const start = station.startTime ? Date.parse(station.startTime) : Number.NEGATIVE_INFINITY;
      const end = station.endTime ? Date.parse(station.endTime) : Number.POSITIVE_INFINITY;
      return Number.isFinite(station.lat) && Number.isFinite(station.lng)
        && (!currentOnly || (start <= now && end >= now));
    });
}

function preferStation(catalogue, station) {
  const current = catalogue.get(station.id);
  if (!current || current.source !== 'EarthScope') catalogue.set(station.id, station);
}

function parseEarthScopeStationIds(text) {
  const ids = new Set();
  for (const line of text.split(/\r?\n/)) {
    const sourceId = line.split(/\s+/, 1)[0];
    if (!sourceId?.startsWith('FDSN:')) continue;
    const parts = sourceId.slice(5).split('/', 1)[0].split('_');
    if (parts.length >= 2 && parts[0] && parts[1]) ids.add(`${parts[0]}.${parts[1]}`);
  }
  return ids;
}

async function fetchEarthScopeLiveStations() {
  return parseEarthScopeStationIds(await fetchText('https://rtserve.earthscope.org/streams'));
}

async function fetchOrfeusLiveStations() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket('wss://www.orfeus-eu.org/websocket/');
    const timeout = setTimeout(() => { socket.close(); reject(new Error('ORFEUS WebSocket agotó el tiempo de espera')); }, 12_000);
    socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(String(event.data));
        if (!Array.isArray(data.stations)) return;
        clearTimeout(timeout);
        socket.close();
        resolve(new Set(data.stations.filter((id) => typeof id === 'string')));
      } catch (error) {
        clearTimeout(timeout);
        socket.close();
        reject(error);
      }
    });
    socket.addEventListener('error', () => {
      clearTimeout(timeout);
      reject(new Error('ORFEUS WebSocket no respondió'));
    });
  });
}

async function syncStations() {
  const [batches, liveSources] = await Promise.all([
    Promise.allSettled(stationProviders.map(async (provider) => {
      const text = await fetchText(provider.url);
      return {
        provider,
        currentStations: parseStations(text, provider),
        allStations: parseStations(text, provider, false),
      };
    })),
    Promise.allSettled([fetchEarthScopeLiveStations(), fetchOrfeusLiveStations()]),
  ]);
  const liveStationIds = new Set();
  for (const source of liveSources) {
    if (source.status === 'fulfilled') source.value.forEach((id) => liveStationIds.add(id));
    else console.warn(`Inventario SeedLink omitido: ${source.reason instanceof Error ? source.reason.message : source.reason}`);
  }
  const operational = new Map();
  const expanded = new Map();
  for (const batch of batches) {
    if (batch.status === 'rejected') {
      console.warn(`Proveedor FDSN omitido: ${batch.reason instanceof Error ? batch.reason.message : batch.reason}`);
      continue;
    }
    console.log(`${batch.value.provider.source}: ${batch.value.currentStations.length} vigentes de ${batch.value.allStations.length} estaciones catalogadas.`);
    for (const station of batch.value.allStations) preferStation(expanded, station);
    for (const station of batch.value.currentStations) {
      if (liveStationIds.size && !liveStationIds.has(station.id)) continue;
      preferStation(operational, { ...station, status: 'online' });
    }
  }
  const stations = [...operational.values()].sort((a, b) => a.id.localeCompare(b.id));
  const secondaryStations = [...expanded.values()]
    .filter((station) => !operational.has(station.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  await writeFile(path.join(outputDir, 'stations.json.gz'), gzipSync(`${JSON.stringify(stations)}\n`, { level: 9 }));
  const secondaryShardSize = Math.ceil(secondaryStations.length / secondaryStationShardCount);
  await Promise.all(Array.from({ length: secondaryStationShardCount }, (_, index) => {
    const shard = secondaryStations.slice(index * secondaryShardSize, (index + 1) * secondaryShardSize);
    const filename = `stations-secondary-${String(index).padStart(2, '0')}.json.gz`;
    return writeFile(path.join(outputDir, filename), gzipSync(`${JSON.stringify(shard)}\n`, { level: 9 }));
  }));
  console.log(`${liveStationIds.size} estaciones anunciadas por SeedLink; ${stations.length} operativas y ${secondaryStations.length} secundarias publicables.`);
  return { operational: stations.length, secondary: secondaryStations.length };
}

async function syncVolcanoes() {
  const url = 'https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=GVP-VOTW%3ASmithsonian_VOTW_Holocene_Volcanoes&outputFormat=application%2Fjson&maxFeatures=2000';
  const activityUrl = 'https://volcano.si.edu/news/WeeklyVolcanoRSS.xml';
  const [collectionText, activityText] = await Promise.all([
    process.env.EPISISMIC_VOLCANO_CATALOG_FILE
      ? readFile(process.env.EPISISMIC_VOLCANO_CATALOG_FILE, 'utf8')
      : fetchText(url),
    process.env.EPISISMIC_VOLCANO_ACTIVITY_FILE
      ? readFile(process.env.EPISISMIC_VOLCANO_ACTIVITY_FILE).then((buffer) => new TextDecoder('windows-1252').decode(buffer))
      : fetchText(activityUrl, 'windows-1252'),
  ]);
  const collection = JSON.parse(collectionText);
  const weeklyActivity = parseWeeklyVolcanicActivity(activityText);
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
      ...weeklyActivity.get(String(properties.Volcano_Number)),
    };
  }).filter((volcano) => Number.isFinite(volcano.lat) && Number.isFinite(volcano.lng));
  await writeFile(path.join(outputDir, 'volcanoes.json.gz'), gzipSync(`${JSON.stringify(volcanoes)}\n`, { level: 9 }));
  return { catalogued: volcanoes.length, weekly: weeklyActivity.size };
}

async function syncPlates() {
  for (const [filename, url] of plateSources) {
    const data = JSON.parse(await fetchText(url));
    await writeFile(path.join(outputDir, filename), `${JSON.stringify(data)}\n`);
  }
}

await mkdir(outputDir, { recursive: true });
if (process.argv.includes('--volcanoes-only')) {
  const volcanoCount = await syncVolcanoes();
  console.log(`Volcanes sincronizados: ${volcanoCount.catalogued} holocenos y ${volcanoCount.weekly} con actividad semanal Smithsonian/USGS.`);
} else {
  const [stationCount, volcanoCount] = await Promise.all([syncStations(), syncVolcanoes(), syncPlates()]);
  console.log(`Geodatos sincronizados: ${stationCount.operational} estaciones operativas, ${stationCount.secondary} secundarias, ${volcanoCount.catalogued} volcanes (${volcanoCount.weekly} con actividad semanal) y PB2002.`);
}
