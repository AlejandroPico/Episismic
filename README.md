# Episismic

Observatorio sísmico mundial con globo 3D interactivo, catálogos multifuente, archivo histórico SQLite, estaciones FDSN, análisis científico, propagación de ondas y evaluación de impacto.

**Versión actual:** `1.2.4` — edición estable y publicable

- **Aplicación web:** <https://alejandropico.github.io/Episismic/>
- **Código:** <https://github.com/AlejandroPico/Episismic>
- **Descargas nativas:** <https://github.com/AlejandroPico/Episismic/releases>

## Novedades de 1.2.4

- Político plano sustituye el brillo atmosférico direccional por una línea geométrica fina y uniforme que recorre el horizonte completo del globo.
- Los 1.214 volcanes holocenos del Smithsonian GVP conservan su punto minimalista; los incluidos en el informe semanal Smithsonian/USGS reciben uno o dos anillos concéntricos, sin pictogramas.
- La ficha volcánica diferencia expresamente catálogo holoceno, actividad eruptiva continuada y nueva actividad, indica el periodo del informe y enlaza a la fuente oficial.
- La sincronización actual identifica 26 volcanes con actividad eruptiva reportada durante la semana del 20 al 26 de agosto de 2026: 6 con actividad nueva y 20 continuada.
- Un proceso semanal actualiza automáticamente esa clasificación desde el RSS oficial sin modificar el resto del catálogo ni reconstruir las aplicaciones nativas.
- Verificada la capa tectónica PB2002: ya contiene las 52 placas del modelo —14 grandes y 38 menores— y las 13 zonas de deformación difusa; no faltaba una segunda colección de microplacas.

## Novedades de 1.2.3

- Las fichas de volcanes adoptan automáticamente la paleta Mañana, Tarde o Noche y presentan sus datos en una tarjeta más estrecha y compacta.
- Los símbolos volcánicos cambian su contraste y borde con el tema activo.
- Telemetría real muestra siempre la ventana temporal exacta, mantiene accesos directos de 2, 5, 10, 20 y 30 minutos y refleja inmediatamente los cambios realizados con la rueda.
- El estado de SeedLink/FDSN aparece antes del selector temporal y se elimina el botón de ayuda sin acción propia.
- Político plano añade un halo de borde muy sutil para separar el contorno del planeta del fondo sin cubrir la cartografía.
- Acerca del proyecto elimina la referencia a huracanes, tormentas e incendios y mantiene el alcance en sismicidad y volcanismo.

## Novedades de 1.2.2

- La ficha de las estaciones sísmicas reserva en móvil el espacio ocupado por la navegación superior.
- La cabecera de la estación y su botón de cierre permanecen siempre accesibles.
- El panel **Acerca del proyecto** mantiene fijos y visibles los enlaces al Portfolio y al código fuente.
- Las descargas de escritorio y su aviso asociado se ocultan en pantallas móviles, donde no corresponden al formato de instalación.
- La corrección responsive se mantiene aislada de la composición de escritorio.

## Novedades de 1.2.1

- Las 4.266 estaciones operativas vuelven a mostrarse por defecto al abrir la aplicación.
- El panel **Estaciones** separa **Estaciones operativas** de **Catálogo ampliado**.
- El catálogo ampliado reúne 76.266 estaciones históricas o sin directo confirmado y permanece desactivado, sin descarga ni procesamiento, hasta que el usuario lo activa.
- Las estaciones ampliadas se representan con menor intensidad para distinguirlas de las operativas.
- Telemetría real adopta las paletas Mañana, Tarde y Noche tanto en el marco como dentro del canvas.
- Canal, NSLC, proveedor/estado, frecuencia de muestreo, latencia, recuento y ventana temporal quedan reunidos en una sola cabecera.
- Se eliminan el pie explicativo y las indicaciones duplicadas de directo; la ayuda de interacción queda disponible en un botón discreto.
- La gráfica gana altura y superficie útil en escritorio y móvil sin aumentar la ficha.

## Novedades de 1.2.0

- Las estaciones están ocultas por defecto y su catálogo no se descarga, descomprime, persiste ni envía a MapLibre durante el arranque.
- El catálogo se carga bajo demanda al activar la capa, abrir el buscador de estaciones o consultar una ficha que lo necesita.
- El inventario se genera a partir de los flujos anunciados actualmente por EarthScope y ORFEUS: 4.276 estaciones operativas con metadatos FDSN en la sincronización de esta versión, frente a más de 80.000 épocas históricas mezcladas anteriormente.
- El descubrimiento de canales consulta EarthScope, ORFEUS, GEOFON, NCEDC y BMKG en paralelo, conserva el proveedor exacto de cada resultado y aplica un tiempo máximo por centro.
- Directo multirred mediante SeedLink WebSocket de EarthScope y el WebSocket público de ORFEUS; los canales sin flujo web pasan automáticamente a FDSN después de 12 segundos.
- Telemetría real rediseñada: componentes, estado, proveedor, latencia, muestras y ventana temporal quedan agrupados en una sola cabecera compacta.
- La escala logarítmica derecha funciona como selector de banda: sus dos extremos ajustan directamente las frecuencias mínima y máxima.
- La rueda del ratón modifica la ventana temporal y los accesos 2, 5, 10, 20 y 30 minutos sustituyen los controles redundantes.

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
- Más de 4.000 estaciones operativas anunciadas actualmente por EarthScope y ORFEUS, más un catálogo ampliado opcional de más de 76.000 estaciones históricas o sin directo confirmado.
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

- monitor multirred mediante los WebSocket de EarthScope y ORFEUS, con respaldo FDSN miniSEED y selección de componentes instrumentales;
- filtro pasa-banda integrado en la escala lateral, latencia y ventana temporal configurables desde la cabecera o el ratón;
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

El dominio utiliza `phenomena` como entidad común para terremotos y volcanismo. `earthquake_events` especializa el catálogo sísmico sin acoplar el renderizador ni la persistencia a la interfaz.

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
- Estaciones: [EarthScope](https://service.earthscope.org/fdsnws/station/1/), [EarthScope SeedLink](https://rtserve.earthscope.org/), [ORFEUS](https://www.orfeus-eu.org/data/odc/realtime/), GEOFON, NCEDC y BMKG.
- Volcanes: [Smithsonian Global Volcanism Program](https://volcano.si.edu/).
- Tectónica: [PB2002](https://github.com/fraxen/tectonicplates), basado en Peter Bird.
- Cartografía: MapLibre GL JS, Natural Earth, Esri, OpenTopoMap, GEBCO/NOAA y OpenStreetMap según la capa activa.

Cada fuente conserva su atribución, prioridad, licencia y enlace original cuando están disponibles. Las referencias de software reutilizado o estudiado se recogen en [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Aviso

Episismic 1.2.4 es una edición estable y publicable del proyecto abierto desarrollado por Alejandro Pico. Sus estimaciones científicas conservan carácter informativo y no deben utilizarse para decisiones de seguridad ni como sustituto de los organismos oficiales.
