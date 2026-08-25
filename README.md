# Episismic

Observatorio sísmico mundial con globo 3D interactivo, catálogos multifuente, archivo histórico SQLite, estaciones FDSN, análisis científico, propagación de ondas y evaluación de impacto.

**Versión actual:** `1.1.0` — edición estable y publicable

- **Aplicación web:** <https://alejandropico.github.io/Episismic/>
- **Código:** <https://github.com/AlejandroPico/Episismic>
- **Descargas nativas:** <https://github.com/AlejandroPico/Episismic/releases>

## Novedades de 1.1.0

- El espacio exterior y la cartografía política vuelven a adoptar colores propios de los temas Mañana, Tarde y Noche; se eliminan los fondos WebGL fijados a negro durante la estabilización del renderizador.
- Nuevo monitor instrumental en tiempo real inspirado en la experiencia de GlobalQuake y construido de forma independiente para la web.
- Suscripción al canal NSLC exacto mediante SeedLink WebSocket público de EarthScope.
- Decodificación MiniSEED en el navegador, búfer temporal, escala robusta y representación canvas de alta densidad.
- Selector de componentes Z/N/E o Z/1/2, latencia, frecuencia de muestreo y contador de muestras reales.
- Filtro pasa-banda Butterworth ajustable y escala logarítmica de frecuencia equivalente al monitor de referencia.
- Si SeedLink no ofrece el canal, se consultan muestras miniSEED reales mediante FDSN Dataselect; si tampoco existen, se declara la ausencia sin generar una señal.
- Diseño adaptado a móvil y escritorio, con actualización continua sin reconstruir el globo.

## Novedades de 1.0.2

- Eliminadas por completo las trazas sísmicas sintéticas del monitor de estación.
- El monitor descubre los canales publicados por cada centro FDSN y representa datos instrumentales reales mediante el servicio gráfico oficial de EarthScope.
- Los accesos StationXML, inventario de canales y miniSEED se enrutan a EarthScope, GEOFON, NCEDC o BMKG según la procedencia de cada estación.
- Cuando una estación o una ventana no tiene datos públicos, la aplicación lo indica y no genera una señal sustitutiva.
- **Eventos detectables** pasa a llamarse **Eventos relacionados**: muestra candidatos filtrados por distancia o compatibilidad teórica y no los presenta como detecciones confirmadas.
- La ficha de estación crece hasta 980 × 720 px en escritorio y mantiene adaptación específica para móvil.
- Las alertas visuales, sonoras y del sistema solo se emiten para terremotos cuyo origen tenga como máximo 15 minutos; las revisiones antiguas actualizan los datos sin reactivar alarmas.

## Novedades de 1.0.1

- El archivo histórico diferencia el límite técnico de 5.000 del número realmente recuperado.
- La consulta conserva y muestra su recuento al volver a abrir el panel.
- Nuevo acceso **Volver a tiempo real**, que restaura el catálogo de las últimas 24 horas.
- La leyenda sísmica utiliza ahora los colores del tema Mañana, Tarde o Noche.
- Se retira el botón de orientación norte para despejar la cartografía.
- En escritorio, un doble clic con el botón derecho devuelve el norte arriba.
- En dispositivos móviles, el globo recupera el norte tras 10 segundos sin interacción.
- Las alertas sonoras disponen de perfiles leve, moderado, fuerte y crítico según la magnitud.

## Episismic 1.0

La versión 1.0.0 consolida la primera edición estable de Episismic y completa los objetivos funcionales 11–98, 115 y 121:

- ficha compacta del terremoto organizada por pestañas;
- ondas P, S y superficiales reproducidas continuamente mientras el evento permanece seleccionado;
- análisis de secuencias, Gutenberg–Richter, Omori, energía, momento, migración y profundidad;
- diagnóstico avanzado de intervalos, correlaciones, difusión, anomalías y consenso de catálogos;
- telemetría instrumental de estación, contexto de red, cobertura azimutal y acceso FDSN;
- asociación entre estaciones y terremotos con llegadas previstas, azimut, intensidad y detectabilidad;
- evaluación de impacto con PGA, PGV, radios MMI, ruptura y riesgos secundarios;
- informes descargables CSV, JSON, GeoJSON y Markdown, además de impresión/PDF mediante el navegador.

El antiguo objetivo 9 de niveles de detalle y agrupación se mantiene retirado. Los terremotos, estaciones y volcanes se representan mediante símbolos individuales a cualquier escala.

## Cartografía y datos vivos

- Globo WebGL con zoom, giro, enfoque de epicentros y navegación móvil/escritorio.
- Cartografía Política, Satélite, Relieve y Batimetría.
- Capas de terremotos, estaciones, placas tectónicas, volcanes, etiquetas, atmósfera, retícula, leyenda y ShakeMap estimado.
- Catálogo deduplicado de USGS/ComCat, EMSC y GEOFON, actualizado cada 30 segundos.
- Historial de una hora, 24 horas, siete días y 30 días.
- Consulta histórica de hasta 5.000 eventos y persistencia SQLite en el navegador.
- Más de 80.000 estaciones procedentes de EarthScope, GEOFON, NCEDC y BMKG.
- Catálogo Smithsonian GVP de volcanes holocenos y límites tectónicos PB2002.
- Símbolos individuales persistentes: no se sustituyen por clústeres al alejar o acercar la cámara.

## Ficha científica del terremoto

La ficha mantiene el mapa visible y distribuye la información en pestañas:

- **Resumen:** origen, profundidad, intensidad, estado, energía, ruptura y duración.
- **Datos:** soluciones por agencia, errores, fases, brecha azimutal y distancia mínima.
- **Focal:** beachball, planos nodales y tensor de momento cuando la fuente los publica.
- **Secuencia:** precursores, réplicas, enjambres y reproducción cinematográfica.
- **Análisis:** magnitud/tiempo, valor b, Omori, profundidad, energía, migración, ritmo, momento, huella, calidad y exportación.
- **Diagnóstico:** acumulación, intervalos, valor b móvil, correlaciones, difusión, anomalías, consenso y clasificación automática.
- **Impacto:** intensidad, PGA, PGV, radios MMI, geometría de ruptura, riesgos secundarios y prioridad operativa estimada.
- **Ondas:** simulador interior y llegadas P, S y superficiales.
- **Revisiones y comparación:** evolución de soluciones y comparación de hasta cuatro terremotos.

Cuando un terremoto queda seleccionado, los frentes de onda se reproducen, se difuminan y vuelven a comenzar automáticamente. La velocidad configurada —1×, 10×, 30×, 60× o 120×— se respeta en todo momento.

## Estaciones sísmicas

La ficha de estación incluye:

- monitor SeedLink WebSocket en tiempo real con respaldo FDSN miniSEED y selección de componentes instrumentales;
- filtro pasa-banda, escala de frecuencia, latencia y ventana temporal configurables;
- número de estaciones de la red, densidad local y estación más próxima;
- cobertura azimutal en ocho sectores;
- percentil de elevación, hemisferios, zona geográfica y periodo operativo;
- enlaces StationXML y miniSEED preparados mediante servicios FDSN;
- catálogo de terremotos potencialmente detectables;
- distancia, azimut, back-azimut, llegadas P/S/superficiales y desfase P–S;
- fase temporal de la propagación, intensidad estimada y puntuación de detectabilidad;
- exportaciones GeoJSON, JSON y CSV.

Episismic no genera formas de onda sintéticas. Los paquetes SeedLink y las respuestas FDSN se decodifican como miniSEED real; cuando no existe telemetría pública para una estación o ventana, se informa de la ausencia sin fabricar una señal.

## Alertas y reproducción

- Enfoque automático configurable por magnitud.
- Alertas sonoras diferenciadas para eventos nuevos, revisiones al alza, corroboraciones y cambios de solución.
- Notificaciones del sistema cuando el navegador dispone de permiso.
- Avisos visuales con profundidad, fuentes participantes y evolución de magnitud.
- Reproducción cronológica y recorrido cinematográfico por eventos históricos.
- Recuperación del catálogo al volver a la pestaña o recuperar la conexión.
- Recuperación automática ante pérdida del contexto WebGL.

Episismic 1.0 es una aplicación estable, abierta e informativa. No sustituye alertas tempranas, ShakeMap, PAGER, protección civil ni el análisis de una agencia sismológica.

## Arquitectura

```text
src/
  components/       Globo, paneles, inspectores y visualizaciones
  data/             Datos iniciales y capas de respaldo
  hooks/            Sincronización de catálogos y geodatos
  services/         FDSN, catálogos, SQLite y modelos científicos
  utils/            Geodesia, formato y cálculos comunes
public/data/        Catálogos geográficos generados
scripts/            Sincronización reproducible de geodatos
database/
  schema.sql        Modelo SQLite extensible
src-tauri/          Aplicación nativa y empaquetado
.github/workflows/  Pruebas, compilación, Pages y escritorio
```

El dominio utiliza `phenomena` como entidad común. `earthquake_events` especializa el terremoto actual; volcanes, tormentas, huracanes e incendios pueden incorporarse posteriormente sin acoplar el renderizador a un único riesgo.

Consulta [Arquitectura](docs/ARCHITECTURE.md) y [Modelo de datos](docs/DATABASE.md).

## Base de datos

SQLite se ejecuta mediante WebAssembly y se conserva en IndexedDB. El esquema contempla:

- fuentes, ingestas y revisiones;
- fenómenos, orígenes e hipocentros alternativos;
- soluciones de magnitud y mecanismos focales;
- productos ShakeMap, PAGER e impacto;
- redes, estaciones, canales y segmentos de onda;
- detecciones, alertas, volcanes y límites tectónicos.

GitHub Pages no dispone de un servidor escribible: cada navegador conserva su archivo local y consulta las fuentes públicas directamente.

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

Cada actualización de `main` ejecuta pruebas, TypeScript, Vite y el despliegue de GitHub Pages mediante Actions.

## Versionado

Episismic utiliza versionado semántico. La versión se mantiene sincronizada en:

- `package.json` y `package-lock.json`;
- `src/services/releases.ts`;
- `src-tauri/Cargo.toml`;
- `src-tauri/tauri.conf.json`.

La serie `1.x` constituye la edición estable y publicable. A partir de 1.0, las versiones menores incorporarán funcionalidad compatible y las revisiones corregirán errores sin romper los formatos públicos. Los instaladores actuales no incluyen firma comercial de Windows/macOS y las actualizaciones silenciosas no se activarán sin una clave privada de firma custodiada fuera del repositorio.

## Fuentes

- Terremotos: [USGS](https://earthquake.usgs.gov/), [EMSC](https://www.seismicportal.eu/) y [GEOFON](https://geofon.gfz-potsdam.de/).
- Estaciones: [EarthScope](https://service.earthscope.org/fdsnws/station/1/), [EarthScope SeedLink](https://rtserve.earthscope.org/), GEOFON, NCEDC y BMKG.
- Volcanes: [Smithsonian Global Volcanism Program](https://volcano.si.edu/).
- Tectónica: [PB2002](https://github.com/fraxen/tectonicplates), basado en Peter Bird.
- Cartografía: MapLibre GL JS, Natural Earth, Esri, OpenTopoMap, GEBCO/NOAA y OpenStreetMap según la capa activa.

Cada fuente conserva su atribución, prioridad, licencia y enlace original cuando están disponibles. Las referencias de software reutilizado o estudiado se recogen en [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Aviso

Episismic 1.1 es una edición estable y publicable del proyecto abierto desarrollado por Alejandro Pico. Sus estimaciones científicas conservan carácter informativo y no deben utilizarse para decisiones de seguridad ni como sustituto de los organismos oficiales.
