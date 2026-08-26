# Arquitectura de Episismic

## Objetivo

Episismic se divide en cuatro sistemas para evitar que el volumen de estaciones, formas de onda o capas bloquee el globo:

1. **Adquisición:** adaptadores FDSN y GeoJSON convierten fuentes externas al dominio común; el navegador consulta inventarios y ventanas instrumentales sin generar señales.
2. **Persistencia:** SQLite conserva el catálogo, todas las revisiones y metadatos; el navegador lo ejecuta en WebAssembly.
3. **Dominio:** terremotos, estaciones, alertas y futuros riesgos no dependen de React ni de MapLibre.
4. **Presentación:** React administra paneles y filtros; MapLibre renderiza teselas y GeoJSON en WebGL.

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

## Telemetría instrumental en tiempo real

La edición 1.2.2 mantiene la ruta instrumental real completamente ejecutable desde el navegador:

1. FDSN Station consulta en paralelo EarthScope, ORFEUS, GEOFON, NCEDC y BMKG, localiza el canal activo y conserva el centro que realmente lo publicó.
2. Para canales EarthScope, el cliente abre `wss://rtserve.earthscope.org/seedlink` y se suscribe al identificador NSLC exacto.
3. Para estaciones servidas por ORFEUS, utiliza `wss://www.orfeus-eu.org/websocket/`, se suscribe a la estación y filtra el canal exacto recibido.
4. `seisplotjs` negocia SeedLink y decodifica MiniSEED; el adaptador ORFEUS normaliza sus muestras JSON al mismo bloque instrumental.
5. Episismic conserva los bloques en una ventana temporal, elimina duplicados y descarta datos ya fuera de pantalla.
6. El canvas aplica un pasa-banda Butterworth, agrupa mínimos y máximos por píxel y dibuja la señal sin convertirla en una imagen estática.
7. Si un directo no entrega su primera muestra en 12 segundos, se cierra y FDSN Dataselect recupera el mismo canal desde el mismo centro.

El navegador no puede abrir los SeedLink TCP tradicionales en el puerto 18000. El directo inmediato cubre los canales federados por los WebSocket públicos de EarthScope y ORFEUS; GEOFON, NCEDC, BMKG u otras redes continúan mediante FDSN cuando no están presentes allí. Extender el directo a todos sus servidores TCP requerirá un puente SeedLink→WebSocket propio.

La web seguirá funcionando con los catálogos sísmicos aunque la telemetría instrumental no esté disponible.

## Rendimiento

- Cartografía por teselas y globo vectorial: no se amplía una textura global fija.
- Natural Earth de países y ciudades se distribuye con la aplicación para que el modo político no dependa de un host externo.
- GeoJSON procesado en los Web Workers de MapLibre.
- Las estaciones operativas comienzan visibles y utilizan un catálogo compacto generado con los flujos que EarthScope y ORFEUS anuncian en ese momento.
- El catálogo ampliado de estaciones históricas o sin directo confirmado se distribuye en fragmentos comprimidos independientes. No se descargan, descomprimen ni transforman a GeoJSON hasta que el usuario activa expresamente su interruptor.
- Al desactivar cualquiera de las dos capas, sus elementos dejan de formar parte del GeoJSON enviado al globo.
- Capas WebGL separadas para terremotos, estaciones y volcanes, conservando cada símbolo individual.
- Actualización multifuente desacoplada a 30 segundos.
- Persistencia SQLite diferida para agrupar escrituras.
- Listado histórico limitado a los 900 registros más recientes; el mapa conserva el conjunto completo con marcadores individuales.
- Tamaño y contraste de los símbolos ajustados sin ocultar eventos por niveles de detalle.
- Símbolos WebGL y halos separados para conservar contraste sin extrusiones ni elementos DOM por estación.

Próximos pasos técnicos: Web Worker dedicado para SQLite y puente SeedLink TCP→WebSocket para los centros que solo publican el puerto 18000.

## Multirriesgo

`phenomena.kind` admite `earthquake`, `volcano`, `storm` y `fire`. Cada módulo especializado amplía el fenómeno sin modificar el contrato común de posición, tiempo, estado, significancia y fuente. Las capas del globo consumen selectores por tipo y no consultas SQL directas.
