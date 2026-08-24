# Modelo de datos

El esquema principal está en [`database/schema.sql`](../database/schema.sql).

## Núcleo

| Tabla | Responsabilidad |
|---|---|
| `data_sources` | Organismo, endpoint, licencia, prioridad y salud de cada fuente |
| `ingestion_runs` | Auditoría de consultas y procesos de ingesta |
| `phenomena` | Identidad, posición, tiempo y significancia comunes a todos los riesgos |
| `earthquake_events` | Resumen preferido del terremoto |
| `event_updates` | Historial inmutable de revisiones |
| `origins` | Hipocentros y tiempos de origen alternativos |
| `magnitude_solutions` | Valores Mb, Ml, Mw, Mww y sus incertidumbres |
| `event_products` | ShakeMap, PAGER, tensor momento, DYFI y demás productos |
| `impact_estimates` | Intensidad, población expuesta, pérdidas y movimiento del suelo |

## Instrumentación

| Tabla | Responsabilidad |
|---|---|
| `seismic_networks` | Redes y operadores FDSN/SeedLink |
| `seismic_stations` | Sitios físicos y estado operativo |
| `station_channels` | Canal, orientación, frecuencia, sensor y respuesta instrumental |
| `waveform_segments` | Índice de segmentos miniSEED u otro almacenamiento de muestras |
| `station_detections` | Picks, fases, amplitud, PGA y confianza algorítmica |

Las muestras masivas no deben insertarse como una fila por valor. `waveform_segments.storage_key` apunta al bloque binario comprimido; SQLite conserva el índice científico y las estadísticas de consulta.

## Alertas

`alerts` preserva severidad, certeza, urgencia, caducidad, geometría afectada, intensidad estimada y tiempos P/S. Una alerta debe mostrar siempre su fuente y su carácter experimental u oficial.

## Evolución

Las migraciones se registran en `schema_migrations`. Toda modificación estructural deberá añadir una versión y conservar compatibilidad con bases locales ya creadas.
