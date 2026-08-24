# Arquitectura de Episismic

## Objetivo

Episismic se divide en cuatro sistemas para evitar que el volumen de estaciones, formas de onda o capas bloquee el globo:

1. **Adquisición:** adaptadores FDSN/GeoJSON/SeedLink convierten fuentes externas al dominio común.
2. **Persistencia:** SQLite conserva el catálogo, todas las revisiones y metadatos; el navegador lo ejecuta en WebAssembly.
3. **Dominio:** terremotos, estaciones, alertas y futuros riesgos no dependen de React ni de MapLibre.
4. **Presentación:** React administra paneles y filtros; MapLibre renderiza teselas, GeoJSON y clustering en WebGL.

## Flujo actual

```mermaid
flowchart TD
  A[USGS] --> B[Fusión espacial-temporal]
  E[EMSC] --> B
  H[GEOFON] --> B
  B --> C[SQLite WASM]
  B --> D[Estado React]
  C --> E[Archivo local]
  D --> F[Globo WebGL]
  D --> G[Historial e inspectores]
```

La actualización de un evento no reemplaza silenciosamente su historia. El resumen se actualiza y `event_updates` conserva cada `source_updated_at` distinto.

## Ingesta en directo futura

Los navegadores no hablan SeedLink de forma fiable y GitHub Pages no ejecuta procesos persistentes. La segunda fase añadirá un servicio de ingesta independiente, compatible con Python o Java, que:

- descubre redes mediante FDSN Station;
- mantiene conexiones SeedLink;
- decodifica miniSEED;
- calcula métricas y detecciones sin enviar todas las muestras al cliente;
- expone WebSocket para telemetría y alertas;
- archiva segmentos de onda fuera del repositorio Git.

La web seguirá funcionando con USGS aunque ese servicio no esté disponible.

## Rendimiento

- Cartografía por teselas y globo vectorial: no se amplía una textura global fija.
- GeoJSON procesado en los Web Workers de MapLibre.
- Clustering separado para terremotos, estaciones y volcanes.
- Actualización multifuente desacoplada a 30 segundos.
- Persistencia SQLite diferida para agrupar escrituras.
- Listado histórico limitado a los 900 registros más recientes; el mapa conserva el conjunto completo agrupado.
- Rótulos y radios interpolados por nivel de zoom.

Próximos pasos técnicos: Web Worker dedicado para SQLite y servicio SeedLink/WebSocket para detecciones de forma de onda previas a los catálogos.

## Multirriesgo

`phenomena.kind` admite `earthquake`, `volcano`, `storm` y `fire`. Cada módulo especializado amplía el fenómeno sin modificar el contrato común de posición, tiempo, estado, significancia y fuente. Las capas del globo consumen selectores por tipo y no consultas SQL directas.
