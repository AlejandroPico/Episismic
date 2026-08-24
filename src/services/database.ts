import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import schema from '../../database/schema.sql?raw';
import type { Earthquake } from '../types';

const DB_NAME = 'episismic-sqlite';
const DB_STORE = 'database';
const DB_KEY = 'episismic-v1';

let sqlPromise: Promise<SqlJsStatic> | null = null;
let databasePromise: Promise<Database> | null = null;
let persistTimer: number | null = null;

function getSql(): Promise<SqlJsStatic> {
  sqlPromise ??= initSqlJs({ locateFile: () => wasmUrl });
  return sqlPromise;
}

function openStorage(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readPersistedDatabase(): Promise<Uint8Array | null> {
  try {
    const storage = await openStorage();
    return await new Promise((resolve, reject) => {
      const transaction = storage.transaction(DB_STORE, 'readonly');
      const request = transaction.objectStore(DB_STORE).get(DB_KEY);
      request.onsuccess = () => resolve(request.result ? new Uint8Array(request.result) : null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

async function writePersistedDatabase(bytes: Uint8Array): Promise<void> {
  try {
    const storage = await openStorage();
    await new Promise<void>((resolve, reject) => {
      const transaction = storage.transaction(DB_STORE, 'readwrite');
      transaction.objectStore(DB_STORE).put(bytes, DB_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    // La aplicación sigue funcionando en memoria si IndexedDB no está disponible.
  }
}

export async function getDatabase(): Promise<Database> {
  databasePromise ??= (async () => {
    const [SQL, persisted] = await Promise.all([getSql(), readPersistedDatabase()]);
    const db = persisted?.byteLength ? new SQL.Database(persisted) : new SQL.Database();
    db.exec(schema);
    return db;
  })();
  return databasePromise;
}

function schedulePersist(db: Database) {
  if (persistTimer) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    void writePersistedDatabase(db.export());
    persistTimer = null;
  }, 750);
}

export async function upsertEarthquakes(events: Earthquake[]): Promise<void> {
  if (!events.length) return;
  const db = await getDatabase();
  const source = db.exec("SELECT id FROM data_sources WHERE code = 'usgs-comcat' LIMIT 1");
  const sourceId = Number(source[0]?.values[0]?.[0] ?? 1);

  const insertPhenomenon = db.prepare(`
    INSERT INTO phenomena(id, kind, source_id, external_id, occurred_at, updated_at, latitude, longitude, headline, status, significance, raw_json)
    VALUES (?, 'earthquake', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      updated_at=excluded.updated_at, latitude=excluded.latitude, longitude=excluded.longitude,
      headline=excluded.headline, status=excluded.status, significance=excluded.significance, raw_json=excluded.raw_json
  `);
  const insertEvent = db.prepare(`
    INSERT INTO earthquake_events(phenomenon_id, depth_km, magnitude, magnitude_type, felt_reports, alert_level, tsunami, review_status, source_url, detail_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(phenomenon_id) DO UPDATE SET
      depth_km=excluded.depth_km, magnitude=excluded.magnitude, magnitude_type=excluded.magnitude_type,
      felt_reports=excluded.felt_reports, alert_level=excluded.alert_level, tsunami=excluded.tsunami,
      review_status=excluded.review_status, source_url=excluded.source_url, detail_url=excluded.detail_url
  `);
  const insertUpdate = db.prepare(`
    INSERT OR IGNORE INTO event_updates(phenomenon_id, source_id, received_at, source_updated_at, change_kind, new_magnitude, new_depth_km, payload_json)
    VALUES (?, ?, ?, ?, 'catalogue', ?, ?, ?)
  `);

  db.run('BEGIN TRANSACTION');
  try {
    for (const event of events) {
      insertPhenomenon.run([
        event.id, sourceId, event.id, event.time, event.updated, event.lat, event.lng,
        event.place, event.status, event.significance, JSON.stringify(event),
      ]);
      insertEvent.run([
        event.id, event.depthKm, event.magnitude, event.magnitudeType, event.felt,
        event.alert, event.tsunami ? 1 : 0, event.status, event.sourceUrl, event.detailUrl ?? null,
      ]);
      insertUpdate.run([
        event.id, sourceId, Date.now(), event.updated, event.magnitude, event.depthKm,
        JSON.stringify(event),
      ]);
    }
    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  } finally {
    insertPhenomenon.free();
    insertEvent.free();
    insertUpdate.free();
  }
  schedulePersist(db);
}

export async function getStoredEarthquakes(since: number): Promise<Earthquake[]> {
  const db = await getDatabase();
  const statement = db.prepare(`
    SELECT p.raw_json
    FROM phenomena p
    WHERE p.kind = 'earthquake' AND p.occurred_at >= ?
    ORDER BY p.occurred_at DESC
    LIMIT 20000
  `);
  statement.bind([since]);
  const events: Earthquake[] = [];
  while (statement.step()) {
    const row = statement.getAsObject();
    if (typeof row.raw_json === 'string') events.push(JSON.parse(row.raw_json) as Earthquake);
  }
  statement.free();
  return events;
}

export async function getDatabaseStats(): Promise<{ events: number; updates: number; sizeBytes: number }> {
  const db = await getDatabase();
  const scalar = (query: string) => Number(db.exec(query)[0]?.values[0]?.[0] ?? 0);
  return {
    events: scalar("SELECT COUNT(*) FROM phenomena WHERE kind='earthquake'"),
    updates: scalar('SELECT COUNT(*) FROM event_updates'),
    sizeBytes: db.export().byteLength,
  };
}
