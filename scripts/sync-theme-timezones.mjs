import { writeFile } from 'node:fs/promises';

// zone.tab retains country-specific reference locations; zone1970.tab merges
// countries sharing clock rules, which is less suitable for estimating daylight.
const source = 'https://data.iana.org/time-zones/tzdb/';
const [zones, backward] = await Promise.all(['zone.tab', 'backward'].map(async (file) => {
  const response = await fetch(source + file);
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
  return response.text();
}));

function degrees(value, width) {
  const sign = value[0] === '-' ? -1 : 1;
  const digits = value.slice(1);
  return Number((sign * (Number(digits.slice(0, width))
    + Number(digits.slice(width, width + 2)) / 60
    + Number(digits.slice(width + 2) || 0) / 3600)).toFixed(4));
}

const locations = {};
for (const row of zones.split('\n')) {
  if (!row || row.startsWith('#')) continue;
  const [, coordinate, zone] = row.split('\t');
  const match = coordinate.match(/^([+-]\d{4}(?:\d{2})?)([+-]\d{5}(?:\d{2})?)$/);
  if (!match) throw new Error(`Invalid coordinates for ${zone}`);
  locations[zone] = [degrees(match[1], 2), degrees(match[2], 3)];
}
const links = backward.split('\n').flatMap((row) => {
  const match = row.match(/^Link\s+(\S+)\s+(\S+)/);
  return match ? [[match[1], match[2]]] : [];
});
// Some aliases point at another alias. Preserve each zone.tab location.
for (let pass = 0; pass < links.length; pass++) {
  let changed = false;
  for (const [target, alias] of links) {
    if (!locations[alias] && locations[target]) {
      locations[alias] = locations[target];
      changed = true;
    }
  }
  if (!changed) break;
}
const entries = Object.entries(locations).sort(([a], [b]) => a.localeCompare(b));
await writeFile(new URL('../src/utils/themeTimezones.json', import.meta.url),
  `{\n${entries.map(([zone, coordinates]) => `  ${JSON.stringify(zone)}: ${JSON.stringify(coordinates)}`).join(',\n')}\n}\n`);
console.log(`Saved ${entries.length} timezone reference locations (IANA public-domain data).`);
