# Episismic

Observatorio sísmico mundial en un globo 3D interactivo. La primera versión combina datos reales de terremotos, una red inicial de estaciones, límites tectónicos, volcanes, archivo histórico y una base SQLite local preparada para análisis más profundos.

**Aplicación:** <https://alejandropico.github.io/Episismic/>

## Funcionalidades disponibles

- Globo WebGL con zoom, giro, enfoque de epicentros y detalle progresivo.
- Terremotos recientes de USGS/ComCat, actualizados cada minuto.
- Historial lateral de 1 hora, 24 horas, 7 días y 30 días.
- Consulta histórica parametrizada y persistencia en SQLite dentro del navegador.
- Marcadores dimensionados por magnitud y coloreados por profundidad.
- Frentes P y S diferenciados para eventos seleccionados o recién detectados.
- Enfoque automático configurable por umbral de magnitud.
- Modos Político, Satélite, Relieve, Batimetría, Sísmico oscuro y Nocturno.
- Capas de estaciones sísmicas, límites de placas, volcanes, etiquetas, atmósfera y retícula.
- Filtros por magnitud, profundidad, significancia y texto.
- Fichas de evento con revisión, profundidad, significancia, reportes sentidos, tsunami, alerta y enlace al registro original.
- Catálogo inicial de estaciones con inspector y forma de onda demostrativa claramente identificada.
- Temas Mañana, Tarde, Noche y Automático; preferencias persistentes.
- Diseño responsive para escritorio, 1080p, 4K, móvil vertical y móvil horizontal.

## Arquitectura

```text
src/
  components/       Interfaz, globo, paneles e inspectores
  data/             Catálogos iniciales y capas de respaldo
  hooks/            Sincronización de estado y datos vivos
  services/         USGS, EarthScope y repositorio SQLite
  utils/            Cálculos y formato científico
database/
  schema.sql        Modelo relacional completo y extensible
.github/workflows/  Pruebas, compilación y despliegue en Pages
```

El núcleo del dominio usa `phenomena` como entidad común. `earthquake_events` amplía esa entidad hoy; volcanes, tormentas e incendios pueden incorporarse sin acoplar el renderizador a un único tipo de riesgo. Consulta [Arquitectura](docs/ARCHITECTURE.md) y [Modelo de datos](docs/DATABASE.md).

## Base de datos

La web crea una base SQLite real mediante WebAssembly y la persiste en IndexedDB. El esquema conserva:

- fuentes e ingestas;
- fenómeno y resumen del terremoto;
- orígenes e hipocentros alternativos;
- soluciones de magnitud;
- revisiones de cada registro;
- productos ShakeMap, PAGER, mecanismos focales y otros;
- estimaciones de impacto;
- redes, estaciones y canales;
- segmentos de forma de onda y detecciones;
- alertas, volcanes y límites tectónicos.

La futura versión descargable podrá abrir el mismo esquema con SQLite nativo. En GitHub Pages no existe un servidor escribible: cada navegador conserva su propio archivo local y consulta las fuentes públicas directamente.

## Desarrollo

Requiere Node.js 22 o posterior.

```bash
npm install
npm run dev
npm test
npm run build
```

El despliegue de `main` se realiza con GitHub Actions. Vite utiliza `/Episismic/` como ruta base.

## Fuentes y atribución

- Terremotos recientes y archivo: [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) y [ComCat FDSN Event](https://earthquake.usgs.gov/fdsnws/event/1/).
- Metadatos de estaciones: [EarthScope FDSN Station](https://service.earthscope.org/fdsnws/station/1/).
- Visualización del globo: [react-globe.gl](https://github.com/vasturiano/react-globe.gl) y Three.js.

Cada red y producto puede imponer atribuciones adicionales. El modelo `data_sources` conserva licencia, prioridad y URL de atribución por fuente.

## Aviso

Episismic es un proyecto informativo, científico y experimental. No constituye un sistema oficial de alerta temprana y no debe utilizarse para decisiones de seguridad. Las formas de onda que aparecen como “vista previa sintética” no son telemetría real. Las alertas operativas futuras se identificarán por fuente, certeza y estado de revisión.
