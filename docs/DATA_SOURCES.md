# Fuentes de datos

## Integradas

### USGS / ComCat

- GeoJSON reciente para 1 hora, 24 horas, 7 días y 30 días.
- FDSN Event para consultas históricas personalizadas.
- Los enlaces originales se conservan por evento.

### EarthScope

- FDSN Station para descubrir redes, estaciones, ubicaciones y canales.
- El servicio `dataselect` y las conexiones SeedLink se incorporarán desde el ingestor, no desde el hilo principal del navegador.

## Preparadas

- GEOFON / GFZ.
- Instituto Geográfico Nacional de España.
- Redes nacionales FDSN federadas.
- Productos de impacto y mecanismos focales expuestos por ComCat.

## Política de fusión

Una fuente no debe borrar a otra. Los eventos potencialmente equivalentes se agruparán mediante tiempo, distancia, incertidumbre y autoridad de la red. El identificador externo de cada organismo se conserva. La interfaz mostrará una solución preferida y permitirá inspeccionar alternativas.
