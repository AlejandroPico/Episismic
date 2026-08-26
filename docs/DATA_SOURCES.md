# Fuentes de datos

## Integradas

### USGS / ComCat

- GeoJSON reciente para 1 hora, 24 horas, 7 días y 30 días.
- FDSN Event para consultas históricas personalizadas.
- Los enlaces originales se conservan por evento.

### EMSC / SeismicPortal

- FDSN Event JSON para soluciones rápidas de redes europeas, mediterráneas y contribuyentes internacionales.
- Licencia CC BY 4.0 y autoridad de origen conservada.

### GEOFON / GFZ

- FDSN Event en formato texto para el catálogo automático y revisado de GEOFON.
- FDSN Station y Dataselect para inventario de canales y descarga instrumental pública.

### EarthScope

- FDSN Station para descubrir redes, estaciones, ubicaciones y canales instrumentales.
- SeedLink WebSocket público para telemetría de baja latencia y FDSN Dataselect para recuperar miniSEED real cuando el flujo no está disponible.

### ORFEUS

- El WebSocket público del ORFEUS Data Center anuncia las estaciones que está sirviendo en este momento y entrega sus muestras instrumentales en tiempo real.
- La sincronización combina ese inventario con `/streams` de EarthScope para excluir estaciones históricas que ya no emiten.

### NCEDC y BMKG

- FDSN Station y Dataselect se resuelven contra el centro que encontró el canal, no contra una asignación posterior inferida por la ficha.
- Una respuesta vacía o 404 se interpreta como ausencia de datos públicos para la selección; nunca se sustituye por muestras generadas.

### Smithsonian GVP

- WFS oficial de los 1.214 volcanes con actividad holocena catalogada.

### PB2002

- Límites de placas y orógenos vectoriales; se conserva placa A/B y fuente de cada tramo.

## Implementación instrumental

- El cliente utiliza `seisplotjs` 3.2.7 para negociar SeedLink y decodificar MiniSEED.
- Los canales se solicitan por red, estación, ubicación y componente exactos.
- Las búsquedas de inventario se ejecutan en paralelo con un máximo de ocho segundos por proveedor; una conexión en directo sin muestras se abandona a los doce segundos.
- Los datos se etiquetan como **SeedLink en directo**, **FDSN reciente** o **sin muestras**, sin estados ambiguos ni generación sintética.

## Preparadas

- Instituto Geográfico Nacional de España.
- Redes nacionales FDSN federadas.
- Productos de impacto y mecanismos focales expuestos por ComCat.

## Política de fusión

Una fuente no borra a otra. Los eventos potencialmente equivalentes se agrupan actualmente con una ventana de 90 segundos, 65 km y tolerancia de magnitud. Se conservan los catálogos participantes y un enlace a la solución preferida.
