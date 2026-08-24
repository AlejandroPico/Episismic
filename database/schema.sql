PRAGMA foreign_keys = ON;
PRAGMA journal_mode = MEMORY;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS data_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  organisation TEXT,
  service_kind TEXT NOT NULL,
  base_url TEXT,
  attribution_url TEXT,
  licence TEXT,
  priority INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_success_at INTEGER,
  last_error_at INTEGER,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER REFERENCES data_sources(id),
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  requested_window TEXT,
  received_count INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  error TEXT
);

CREATE TABLE IF NOT EXISTS phenomena (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('earthquake','volcano','storm','fire')),
  source_id INTEGER REFERENCES data_sources(id),
  external_id TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  altitude_m REAL,
  headline TEXT NOT NULL,
  status TEXT,
  significance INTEGER NOT NULL DEFAULT 0,
  raw_json TEXT,
  UNIQUE(source_id, external_id)
);

CREATE TABLE IF NOT EXISTS earthquake_events (
  phenomenon_id TEXT PRIMARY KEY REFERENCES phenomena(id) ON DELETE CASCADE,
  preferred_origin_id INTEGER,
  preferred_magnitude_id INTEGER,
  depth_km REAL,
  magnitude REAL,
  magnitude_type TEXT,
  felt_reports INTEGER,
  cdi REAL,
  mmi REAL,
  alert_level TEXT CHECK(alert_level IS NULL OR alert_level IN ('green','yellow','orange','red')),
  tsunami INTEGER NOT NULL DEFAULT 0,
  event_type TEXT NOT NULL DEFAULT 'earthquake',
  review_status TEXT,
  azimuthal_gap REAL,
  minimum_distance_deg REAL,
  rms REAL,
  horizontal_error_km REAL,
  depth_error_km REAL,
  magnitude_error REAL,
  station_count INTEGER,
  source_url TEXT,
  detail_url TEXT
);

CREATE TABLE IF NOT EXISTS origins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phenomenon_id TEXT NOT NULL REFERENCES phenomena(id) ON DELETE CASCADE,
  source_id INTEGER REFERENCES data_sources(id),
  external_id TEXT,
  origin_time INTEGER NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  depth_km REAL,
  method TEXT,
  earth_model TEXT,
  evaluation_mode TEXT,
  evaluation_status TEXT,
  used_phase_count INTEGER,
  used_station_count INTEGER,
  azimuthal_gap REAL,
  minimum_distance_deg REAL,
  rms REAL,
  horizontal_uncertainty_km REAL,
  depth_uncertainty_km REAL,
  created_at INTEGER NOT NULL,
  UNIQUE(source_id, external_id)
);

CREATE TABLE IF NOT EXISTS magnitude_solutions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phenomenon_id TEXT NOT NULL REFERENCES phenomena(id) ON DELETE CASCADE,
  origin_id INTEGER REFERENCES origins(id),
  source_id INTEGER REFERENCES data_sources(id),
  external_id TEXT,
  value REAL NOT NULL,
  type TEXT,
  method TEXT,
  station_count INTEGER,
  uncertainty REAL,
  evaluation_status TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(source_id, external_id)
);

CREATE TABLE IF NOT EXISTS event_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phenomenon_id TEXT NOT NULL REFERENCES phenomena(id) ON DELETE CASCADE,
  source_id INTEGER REFERENCES data_sources(id),
  received_at INTEGER NOT NULL,
  source_updated_at INTEGER,
  change_kind TEXT NOT NULL,
  previous_magnitude REAL,
  new_magnitude REAL,
  previous_depth_km REAL,
  new_depth_km REAL,
  payload_json TEXT,
  UNIQUE(phenomenon_id, source_updated_at)
);

CREATE TABLE IF NOT EXISTS event_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phenomenon_id TEXT NOT NULL REFERENCES phenomena(id) ON DELETE CASCADE,
  source_id INTEGER REFERENCES data_sources(id),
  product_type TEXT NOT NULL,
  product_code TEXT,
  preferred_weight INTEGER,
  status TEXT,
  update_time INTEGER,
  url TEXT,
  properties_json TEXT,
  contents_json TEXT,
  UNIQUE(phenomenon_id, product_type, product_code, update_time)
);

CREATE TABLE IF NOT EXISTS impact_estimates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phenomenon_id TEXT NOT NULL REFERENCES phenomena(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES event_products(id),
  scale TEXT NOT NULL,
  maximum_intensity REAL,
  exposed_population INTEGER,
  estimated_fatalities_min INTEGER,
  estimated_fatalities_max INTEGER,
  estimated_loss_usd_min REAL,
  estimated_loss_usd_max REAL,
  pga REAL,
  pgv REAL,
  model TEXT,
  generated_at INTEGER
);

CREATE TABLE IF NOT EXISTS seismic_networks (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT,
  operator TEXT,
  country TEXT,
  description TEXT,
  fdsn_station_url TEXT,
  seedlink_url TEXT,
  start_time INTEGER,
  end_time INTEGER,
  restricted_status TEXT,
  last_catalogued_at INTEGER
);

CREATE TABLE IF NOT EXISTS seismic_stations (
  id TEXT PRIMARY KEY,
  network_id TEXT REFERENCES seismic_networks(id),
  code TEXT NOT NULL,
  name TEXT,
  country TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  elevation_m REAL,
  site_name TEXT,
  vault_type TEXT,
  geology TEXT,
  start_time INTEGER,
  end_time INTEGER,
  restricted_status TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  last_data_at INTEGER,
  metadata_json TEXT,
  UNIQUE(network_id, code)
);

CREATE TABLE IF NOT EXISTS station_channels (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES seismic_stations(id) ON DELETE CASCADE,
  location_code TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  elevation_m REAL,
  depth_m REAL,
  azimuth REAL,
  dip REAL,
  sample_rate_hz REAL,
  sensor_description TEXT,
  scale REAL,
  scale_frequency REAL,
  scale_units TEXT,
  start_time INTEGER,
  end_time INTEGER,
  response_json TEXT
);

CREATE TABLE IF NOT EXISTS waveform_segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL REFERENCES station_channels(id) ON DELETE CASCADE,
  source_id INTEGER REFERENCES data_sources(id),
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  sample_rate_hz REAL NOT NULL,
  sample_count INTEGER NOT NULL,
  encoding TEXT,
  quality TEXT,
  min_value REAL,
  max_value REAL,
  rms REAL,
  storage_key TEXT,
  checksum TEXT,
  UNIQUE(channel_id, start_time, end_time)
);

CREATE TABLE IF NOT EXISTS station_detections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id TEXT NOT NULL REFERENCES seismic_stations(id),
  phenomenon_id TEXT REFERENCES phenomena(id),
  detected_at INTEGER NOT NULL,
  phase TEXT,
  amplitude REAL,
  period_s REAL,
  signal_to_noise REAL,
  pga REAL,
  confidence REAL,
  algorithm TEXT,
  reviewed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  phenomenon_id TEXT REFERENCES phenomena(id),
  source_id INTEGER REFERENCES data_sources(id),
  issued_at INTEGER NOT NULL,
  updated_at INTEGER,
  expires_at INTEGER,
  severity TEXT NOT NULL,
  certainty TEXT,
  urgency TEXT,
  headline TEXT NOT NULL,
  description TEXT,
  instruction TEXT,
  estimated_intensity REAL,
  intensity_scale TEXT,
  p_wave_eta_s REAL,
  s_wave_eta_s REAL,
  target_geometry_json TEXT,
  acknowledged_at INTEGER
);

CREATE TABLE IF NOT EXISTS volcanoes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  elevation_m REAL,
  status TEXT,
  last_eruption TEXT,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS plate_boundaries (
  id TEXT PRIMARY KEY,
  name TEXT,
  plate_left TEXT,
  plate_right TEXT,
  boundary_type TEXT,
  slip_rate_mm_year REAL,
  geometry_json TEXT NOT NULL,
  source TEXT
);

CREATE TABLE IF NOT EXISTS user_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_phenomena_kind_time ON phenomena(kind, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_phenomena_location ON phenomena(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_phenomena_significance ON phenomena(significance DESC);
CREATE INDEX IF NOT EXISTS idx_event_magnitude ON earthquake_events(magnitude DESC);
CREATE INDEX IF NOT EXISTS idx_event_depth ON earthquake_events(depth_km);
CREATE INDEX IF NOT EXISTS idx_updates_event ON event_updates(phenomenon_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_origins_event ON origins(phenomenon_id, origin_time DESC);
CREATE INDEX IF NOT EXISTS idx_magnitudes_event ON magnitude_solutions(phenomenon_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_event ON event_products(phenomenon_id, product_type);
CREATE INDEX IF NOT EXISTS idx_stations_location ON seismic_stations(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_channels_station ON station_channels(station_id);
CREATE INDEX IF NOT EXISTS idx_waveforms_channel_time ON waveform_segments(channel_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_detections_time ON station_detections(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_issued ON alerts(issued_at DESC);

INSERT OR IGNORE INTO schema_migrations(version, applied_at, description)
VALUES (1, unixepoch() * 1000, 'Modelo inicial multifuente y multirriesgo');

INSERT OR IGNORE INTO data_sources(code, name, organisation, service_kind, base_url, attribution_url, licence, priority)
VALUES
  ('usgs-comcat', 'USGS ComCat', 'U.S. Geological Survey', 'FDSN_EVENT', 'https://earthquake.usgs.gov/fdsnws/event/1/', 'https://earthquake.usgs.gov/', 'Dominio público de EE. UU.; comprobar productos de terceros', 10),
  ('earthscope', 'EarthScope Data Services', 'EarthScope Consortium', 'FDSN_STATION', 'https://service.earthscope.org/fdsnws/station/1/', 'https://www.earthscope.org/', 'Consultar atribución de cada red', 20),
  ('geofon', 'GEOFON', 'GFZ Potsdam', 'FDSN', 'https://geofon.gfz-potsdam.de/fdsnws/', 'https://geofon.gfz-potsdam.de/', 'CC BY 4.0 para datos GEOFON; otras redes pueden variar', 30),
  ('ign-es', 'Red Sísmica Nacional', 'Instituto Geográfico Nacional de España', 'FDSN', 'https://www.ign.es/', 'https://www.ign.es/', 'Consultar aviso legal del IGN', 30),
  ('emsc', 'EMSC SeismicPortal', 'European-Mediterranean Seismological Centre', 'FDSN_EVENT', 'https://www.seismicportal.eu/fdsnws/event/1/', 'https://www.seismicportal.eu/', 'CC BY 4.0', 15),
  ('smithsonian-gvp', 'Volcanoes of the World', 'Smithsonian Global Volcanism Program', 'WFS', 'https://webservices.volcano.si.edu/geoserver/GVP-VOTW/', 'https://volcano.si.edu/', 'Consultar términos GVP', 30),
  ('pb2002', 'PB2002 plate boundaries', 'Peter Bird / Nordpil', 'GEOJSON', NULL, 'https://github.com/fraxen/tectonicplates', 'ODC Attribution', 30);
