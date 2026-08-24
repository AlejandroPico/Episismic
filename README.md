# Episismic

Observatorio sísmico mundial en un globo 3D interactivo. Combina catálogos sísmicos multifuente, más de 80.000 estaciones FDSN catalogadas, 1.214 volcanes holocenos, límites tectónicos PB2002, archivo histórico y una base SQLite local.

**Versión actual:** `0.9.0` (previa a 1.0)

**Aplicación:** <https://alejandropico.github.io/Episismic/>

**Descargas nativas:** <https://github.com/AlejandroPico/Episismic/releases/latest>

## Funcionalidades disponibles

- Globo WebGL con zoom, giro, enfoque de epicentros y detalle progresivo.
- Terremotos recientes unificados desde USGS/ComCat, EMSC y GEOFON, consultados cada 30 segundos.
- Historial lateral de 1 hora, 24 horas, 7 días y 30 días.
- Consulta histórica parametrizada y persistencia en SQLite dentro del navegador.
- Marcadores de doble escala: relleno y diámetro por magnitud, borde por profundidad y valor numérico al acercarse.
- Leyenda científica conmutable desde Capas, apagada por defecto.
- Frentes P y S geográficos para eventos seleccionados o recién detectados; su extensión se mide sobre la superficie y respeta el zoom.
- Enfoque automático configurable por umbral de magnitud.
- Político plano vectorial por defecto y modos Satélite, Relieve y Batimetría por teselas con detalle progresivo.
- Etiquetas geográficas conmutables mediante capas de referencia para Político, Satélite y Batimetría; Relieve conserva sus nombres integrados.
- Capas de estaciones sísmicas, límites de placas, volcanes, atmósfera y retícula.
- Filtros por magnitud, profundidad y significancia.
- Fichas de evento con revisión, profundidad, significancia, reportes sentidos, tsunami, alerta y enlace al registro original.
- Catálogo deduplicado de 80.524 estaciones procedentes de EarthScope, GEOFON, NCEDC y BMKG, con buscador e inspector.
- Catálogo Smithsonian GVP de volcanes holocenos con nombre y metadatos.
- Símbolos WebGL persistentes a cualquier zoom; estaciones, volcanes y epicentros no se sustituyen por clústeres.
- Epicentros con núcleo por profundidad, halo y anillo por antigüedad; estaciones triangulares con identificación al pasar el puntero.
- Monitor de estación con sismograma sintético, ejes de tiempo y amplitud, ventana temporal, ganancia y filtro de frecuencia regulable.
- Alertas sonoras diferenciadas para eventos nuevos, revisiones al alza, corroboraciones multifuente y actualizaciones de solución; también incluyen microseísmos de magnitud negativa publicados.
- Avisos visuales ampliados con profundidad, catálogos participantes, evolución de magnitud y acceso directo a la ficha.
- Reproducción real de los 24 eventos recientes desde la cronología: enfoque de cámara, selección y ondas P/S en secuencia.
- Recuperación inmediata del catálogo al volver a una pestaña o reconectar la red, y notificación del sistema cuando el navegador ya tiene permiso.
- Control directo de norte en escritorio; la interfaz móvil prescinde de controles cartográficos superfluos.
- Enciclopedia sísmica de 71 capítulos con buscador, categorías, esquemas vectoriales y referencias oficiales.
- Temas Mañana, Tarde, Noche y Automático; preferencias persistentes.
- Diseño responsive para escritorio, 1080p, 4K, móvil vertical y móvil horizontal.
- Navegación flotante continua en la esquina superior derecha, con Historial integrado y paneles mutuamente excluyentes alineados a la derecha.
- Estado de las tres fuentes integrado en Estaciones e índice enciclopédico móvil como desplegable superpuesto.
- Monitor de estación a pantalla completa en móvil, con el sismograma anclado durante el desplazamiento.
- Aplicación nativa Tauri para Windows, macOS (Intel y Apple Silicon) y Linux, ejecutada en una ventana propia.
- Detección de sistema operativo, descarga recomendada y comprobación interna de nuevas versiones mediante GitHub Releases.

## Arquitectura

```text
src/
  components/       Interfaz, globo, paneles e inspectores
  data/             Catálogos iniciales y capas de respaldo
  hooks/            Sincronización de estado y datos vivos
  services/         USGS, EMSC, GEOFON, FDSN y repositorio SQLite
public/data/        Catálogos geográficos compactos generados
scripts/            Sincronización reproducible de estaciones, volcanes y placas
  utils/            Cálculos y formato científico
database/
  schema.sql        Modelo relacional completo y extensible
src-tauri/          Ventana nativa, empaquetado e iconos de escritorio
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
npm run sync:geodata
npm run dev
npm test
npm run build
npm run desktop:dev
npm run desktop:build
```

El despliegue de `main` se realiza con GitHub Actions. Vite utiliza `/Episismic/` como ruta base.

Los instaladores se compilan de forma reproducible en GitHub Actions y se publican como versión previa en GitHub Releases. La edición 0.9 avisa de una versión superior y dirige al instalador correcto; las actualizaciones automáticas silenciosas no se habilitan hasta disponer de una clave privada de firma custodiada fuera del repositorio. Los binarios actuales tampoco incluyen firma comercial de Windows/macOS.

## Versionado

Episismic sigue [versionado semántico](https://semver.org/lang/es/). `0.9.x` representa la fase de estabilización previa a 1.0: se mantiene compatibilidad de datos, pero todavía pueden ajustarse contratos internos y el proceso de instalación. La versión se conserva sincronizada en `package.json`, `src/services/releases.ts`, `src-tauri/Cargo.toml` y `src-tauri/tauri.conf.json`.

## Fuentes y atribución

- Terremotos: [USGS](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php), [EMSC SeismicPortal](https://www.seismicportal.eu/fdsn-wsevent.html) y [GEOFON](https://geofon.gfz-potsdam.de/fdsnws/event/1/).
- Estaciones: [EarthScope](https://service.earthscope.org/fdsnws/station/1/), [GEOFON FDSN Station](https://geofon.gfz-potsdam.de/fdsnws/station/1/), [NCEDC](https://service.ncedc.org/fdsnws/station/1/) y [BMKG](https://geof.bmkg.go.id/fdsnws/station/1/).
- Volcanes: [Smithsonian Global Volcanism Program](https://volcano.si.edu/database/webservices.cfm).
- Tectónica: [PB2002](https://github.com/fraxen/tectonicplates), basado en el modelo de Peter Bird.
- Cartografía: MapLibre GL JS, Natural Earth, Esri, OpenTopoMap, GEBCO/NOAA y OpenStreetMap según la capa activa.

Cada red y producto puede imponer atribuciones adicionales. El modelo `data_sources` conserva licencia, prioridad y URL de atribución por fuente.

## Aviso

Episismic es un proyecto informativo, científico y experimental. No constituye un sistema oficial de alerta temprana y no debe utilizarse para decisiones de seguridad. Las formas de onda que aparecen como “vista previa sintética” no son telemetría real. Las alertas operativas futuras se identificarán por fuente, certeza y estado de revisión.
