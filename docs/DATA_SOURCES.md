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
- FDSN Station para completar metadatos de estaciones públicas.

### EarthScope

- FDSN Station para descubrir redes y estaciones activas con canales BH, HH, EH o SH.
- El servicio `dataselect` y las conexiones SeedLink se incorporarán desde el ingestor, no desde el hilo principal del navegador.

### Smithsonian GVP

- WFS oficial de los 1.214 volcanes con actividad holocena catalogada.

### PB2002

- Límites de placas y orógenos vectoriales; se conserva placa A/B y fuente de cada tramo.

## Preparadas

- Instituto Geográfico Nacional de España.
- Redes nacionales FDSN federadas.
- Productos de impacto y mecanismos focales expuestos por ComCat.

## Política de fusión

Una fuente no borra a otra. Los eventos potencialmente equivalentes se agrupan actualmente con una ventana de 90 segundos, 65 km y tolerancia de magnitud. Se conservan los catálogos participantes y un enlace a la solución preferida.
