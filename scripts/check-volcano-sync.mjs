import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';
import test from 'node:test';

const script = fileURLToPath(new URL('./sync-geodata.mjs', import.meta.url));
const initial = [
  { id: '1', name: 'Uno', lat: 10, lng: 20, weeklyActivity: 'new-eruption', weeklyReportUpdatedAt: '2026-08-01T00:00:00Z' },
  { id: '2', name: 'Dos', lat: 30, lng: 40, weeklyActivity: 'new-unrest', weeklyReportPeriod: 'anterior' },
];
const rss = '<rss><channel><item><guid>https://volcano.si.edu/reports_weekly.cfm#vn_1</guid><title>Uno - Report for 1-7 September 2026 - Continuing Eruptive Activity</title><pubDate>Mon, 07 Sep 2026 00:00:00 GMT</pubDate></item></channel></rss>';

function runScenario(response, status = 200, catalog = initial) {
  const dir = mkdtempSync(path.join(tmpdir(), 'episismic-volcanoes-'));
  try {
    mkdirSync(path.join(dir, 'public/data'), { recursive: true });
    const output = path.join(dir, 'public/data/volcanoes.json.gz');
    const before = gzipSync(JSON.stringify(catalog));
    writeFileSync(output, before);
    const mock = path.join(dir, 'fetch.mjs');
    writeFileSync(mock, `globalThis.fetch = async (url) => { if (!url.endsWith('/news/WeeklyVolcanoRSS.xml')) throw new Error('Consulta geográfica inesperada'); return new Response(${JSON.stringify(response)}, { status: ${status} }); };`);
    const env = { ...process.env };
    delete env.EPISISMIC_VOLCANO_ACTIVITY_FILE;
    env.GITHUB_ACTIONS = 'true';
    env.GITHUB_STEP_SUMMARY = path.join(dir, 'summary.md');
    const result = spawnSync(process.execPath, ['--import', mock, script, '--volcanoes-only', '--weekly-activity-only'], { cwd: dir, env, encoding: 'utf8' });
    const after = readFileSync(output);
    return { ...result, before, after, catalog: JSON.parse(gunzipSync(after)), summary: result.stderr.includes('::warning::') ? readFileSync(env.GITHUB_STEP_SUMMARY, 'utf8') : '' };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('un 403 conserva exactamente el snapshot y avisa sin simular actualización', () => {
  const result = runScenario('Forbidden', 403);
  assert.equal(result.status, 0);
  assert.deepEqual(result.after, result.before);
  assert.match(result.stderr, /::warning::.*403/);
  assert.match(result.summary, /no se ha actualizado/);
  assert.doesNotMatch(result.stdout, /Volcanes sincronizados/);
});

test('un RSS válido actualiza la actividad y retira las clasificaciones antiguas', () => {
  const result = runScenario(rss);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.catalog[0].weeklyActivity, 'continuing-eruption');
  assert.equal(result.catalog[0].name, 'Uno');
  assert.equal(result.catalog[1].weeklyActivity, undefined);
  assert.equal(result.catalog[1].weeklyReportPeriod, undefined);
});

test('HTML o RSS sin informes no sobrescribe los datos', () => {
  for (const response of ['<html>blocked</html>', '<rss><channel></channel></rss>']) {
    const result = runScenario(response);
    assert.notEqual(result.status, 0);
    assert.deepEqual(result.after, result.before);
  }
});

test('un catálogo local vacío falla incluso si el proveedor está bloqueado', () => {
  const result = runScenario('Forbidden', 403, []);
  assert.notEqual(result.status, 0);
  assert.deepEqual(result.after, result.before);
});
