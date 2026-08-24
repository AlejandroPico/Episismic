export type DiagramKind =
  | 'earth' | 'faults' | 'waves' | 'seismogram' | 'location' | 'magnitude'
  | 'intensity' | 'station' | 'subduction' | 'tsunami' | 'focal' | 'catalogue'
  | 'plates' | 'alert';

export interface EncyclopediaReference {
  label: string;
  url: string;
  authority: string;
}

export interface EncyclopediaChapter {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  diagram?: DiagramKind;
  sections: Array<{ title: string; text: string }>;
  facts: string[];
  references: EncyclopediaReference[];
}

const USGS_BASICS: EncyclopediaReference = { label: 'Ciencia de los terremotos', url: 'https://www.usgs.gov/programs/earthquake-hazards/science-earthquakes', authority: 'USGS' };
const USGS_MAG: EncyclopediaReference = { label: 'Magnitud, energía e intensidad', url: 'https://www.usgs.gov/programs/earthquake-hazards/earthquake-magnitude-energy-release-and-shaking-intensity', authority: 'USGS' };
const USGS_MMI: EncyclopediaReference = { label: 'Escala de intensidad Mercalli modificada', url: 'https://www.usgs.gov/programs/earthquake-hazards/modified-mercalli-intensity-scale', authority: 'USGS' };
const COMCAT: EncyclopediaReference = { label: 'Documentación de ComCat', url: 'https://earthquake.usgs.gov/data/comcat/index.php', authority: 'USGS' };
const FDSN: EncyclopediaReference = { label: 'Estándares y servicios FDSN', url: 'https://www.fdsn.org/webservices/', authority: 'FDSN' };
const EARTHSCOPE: EncyclopediaReference = { label: 'Global Seismographic Network', url: 'https://www.earthscope.org/gsn/', authority: 'EarthScope' };
const EMSC: EncyclopediaReference = { label: 'Servicio FDSN Event', url: 'https://www.seismicportal.eu/fdsn-wsevent.html', authority: 'EMSC' };
const GEOFON: EncyclopediaReference = { label: 'Servicios sísmicos GEOFON', url: 'https://geofon.gfz-potsdam.de/data/', authority: 'GFZ' };
const IGN_ALBORAN: EncyclopediaReference = { label: 'Sismotectónica del golfo de Cádiz y Alborán', url: 'https://www.ign.es/web/resources/sismologia/tproximos/sismotectonica/pag_sismotectonicas/golfocadiz2.html', authority: 'IGN España' };
const IGN_BETICAS: EncyclopediaReference = { label: 'Sismotectónica Bético-Balear', url: 'https://www.ign.es/web/gl/sismotectonica-por-zonas/beticas-geo', authority: 'IGN España' };
const NOAA_TSUNAMI: EncyclopediaReference = { label: 'Tsunamis: formación y seguridad', url: 'https://oceanservice.noaa.gov/education/tutorial_tsunami/', authority: 'NOAA' };
const NATURAL_EARTH: EncyclopediaReference = { label: 'Cartografía Natural Earth', url: 'https://www.naturalearthdata.com/', authority: 'Natural Earth' };
const READY: EncyclopediaReference = { label: 'Preparación ante terremotos', url: 'https://www.ready.gov/es/terremotos', authority: 'Ready.gov' };

const chapter = (
  id: string, category: string, title: string, subtitle: string, diagram: DiagramKind | undefined,
  sections: Array<[string, string]>, facts: string[], references: EncyclopediaReference[],
): EncyclopediaChapter => ({ id, category, title, subtitle, diagram, sections: sections.map(([sectionTitle, text]) => ({ title: sectionTitle, text })), facts, references });

export const encyclopediaChapters: EncyclopediaChapter[] = [
  chapter('earth-interior', 'Fundamentos', 'El interior de la Tierra', 'Capas, discontinuidades y circulación térmica', 'earth', [
    ['Estructura', 'La corteza, el manto y el núcleo se distinguen por composición; litosfera, astenosfera y mesosfera describen su comportamiento mecánico. La mayor parte de los terremotos ocurre en la litosfera frágil, aunque las zonas de subducción producen focos mucho más profundos.'],
    ['Cómo lo sabemos', 'Las velocidades y trayectorias de las ondas P y S cambian al cruzar discontinuidades. La ausencia de ondas S directas a través del núcleo externo demuestra que esa envoltura es líquida, mientras que otras fases revelan un núcleo interno sólido.'],
  ], ['El radio medio terrestre es de unos 6.371 km.', 'El límite corteza–manto se denomina discontinuidad de Mohorovičić.', 'Las ondas sísmicas permiten una tomografía del planeta.'], [USGS_BASICS]),
  chapter('plate-tectonics', 'Fundamentos', 'Tectónica de placas', 'El marco global de la actividad sísmica', 'plates', [
    ['Placas móviles', 'La litosfera está dividida en placas que se desplazan milímetros o centímetros al año. La mayor actividad se concentra donde convergen, divergen o se deslizan lateralmente, pero también existen terremotos intraplaca.'],
    ['Límites y zonas', 'Un límite oceánico puede estar muy bien definido; una colisión continental suele distribuir la deformación por una franja ancha. Por eso una línea cartográfica es un modelo, no una grieta única y continua visible en superficie.'],
  ], ['Las placas incluyen corteza y manto litosférico.', 'El movimiento se mide con geodesia GNSS.', 'Las fronteras difusas requieren varias trazas y niveles de incertidumbre.'], [USGS_BASICS, NATURAL_EARTH]),
  chapter('elastic-rebound', 'Fundamentos', 'Rebote elástico', 'Cómo se acumula y libera la deformación', 'faults', [
    ['Acumulación', 'Mientras dos bloques permanecen trabados, el movimiento tectónico continúa deformando el entorno. La tensión crece hasta superar la resistencia de la falla; entonces se produce deslizamiento y parte de la energía almacenada se irradia como ondas.'],
    ['Después de la ruptura', 'La falla no vuelve necesariamente a un estado sin tensión. Quedan concentraciones de esfuerzo que favorecen réplicas, relajación lenta y transferencia de carga hacia segmentos vecinos.'],
  ], ['Un terremoto no abre siempre una nueva falla.', 'El deslizamiento puede durar segundos o minutos.', 'La ruptura se propaga por una superficie, no desde un punto matemático.'], [USGS_BASICS]),
  chapter('stress-strain', 'Fundamentos', 'Esfuerzo y deformación', 'Compresión, extensión y cizalla', 'faults', [
    ['Esfuerzo', 'El esfuerzo expresa fuerza por unidad de área. La compresión acorta, la extensión alarga y la cizalla cambia la forma. La orientación del campo de esfuerzos ayuda a interpretar qué mecanismo de falla es posible.'],
    ['Deformación', 'Antes de romper, una roca puede deformarse elásticamente y recuperar parte de su forma. A temperatura y presión elevadas puede fluir de forma dúctil; por ello la sismicidad disminuye bajo la transición frágil-dúctil.'],
  ], ['Esfuerzo y deformación no son sinónimos.', 'La presión de fluidos reduce el esfuerzo efectivo.', 'La temperatura controla la profundidad sismogénica.'], [USGS_BASICS]),
  chapter('hypocenter-epicenter', 'Fundamentos', 'Hipocentro y epicentro', 'Dos posiciones relacionadas, no equivalentes', 'location', [
    ['Definiciones', 'El hipocentro o foco es la localización estimada dentro de la Tierra donde empieza la ruptura. El epicentro es su proyección vertical sobre la superficie. En rupturas extensas, ambos puntos no describen por sí solos toda el área que se deslizó.'],
    ['En Episismic', 'El marcador se coloca en el epicentro y la ficha muestra la profundidad del hipocentro. El color codifica intervalos de profundidad; no debe confundirse con intensidad, alerta o calidad de revisión.'],
  ], ['Profundidad cero puede indicar una solución provisional.', 'La incertidumbre horizontal y vertical no suele ser igual.', 'Un epicentro costero no implica automáticamente tsunami.'], [COMCAT]),
  chapter('earthquake-cycle', 'Fundamentos', 'Ciclo sísmico', 'Interseísmo, cosismo y postseísmo', 'faults', [
    ['Fases', 'Durante el interseísmo se acumula deformación; la fase cosísmica corresponde al deslizamiento rápido; el postseísmo incluye réplicas, fluencia y reajuste viscoelástico. El ciclo no es perfectamente periódico.'],
    ['Pronóstico', 'Conocer tasas de deformación y paleoterremotos permite estimar peligro a largo plazo, pero no fija día y hora. Los intervalos de recurrencia son distribuciones con incertidumbre, no calendarios.'],
  ], ['Recurrencia no significa periodicidad exacta.', 'Una falla puede romper por segmentos.', 'El silencio sísmico no demuestra seguridad.'], [USGS_BASICS]),

  chapter('normal-faults', 'Fallas', 'Fallas normales', 'Extensión y descenso del bloque superior', 'faults', [
    ['Geometría', 'En una falla normal el bloque situado sobre el plano de falla desciende respecto al inferior. Son características de rifts continentales, dorsales y regiones sometidas a extensión.'],
    ['Firma sísmica', 'Los mecanismos focales muestran ejes de extensión y dos planos nodales posibles. Para identificar cuál es la falla real se necesita cartografía, réplicas u otra información geológica.'],
  ], ['Forman escarpes y cuencas.', 'Pueden producir terremotos destructivos.', 'La extensión también aparece tras arcos de subducción.'], [USGS_BASICS]),
  chapter('reverse-faults', 'Fallas', 'Fallas inversas y cabalgamientos', 'Acortamiento cortical y grandes rupturas', 'faults', [
    ['Geometría', 'El bloque superior asciende sobre el inferior. Cuando el plano tiene poca inclinación se habla de cabalgamiento. Estas estructuras absorben compresión y levantan cordilleras.'],
    ['Grandes terremotos', 'Las interfaces de subducción son fallas inversas gigantes. Su enorme superficie potencial de ruptura permite momentos sísmicos muy altos y, si desplazan el fondo marino, tsunamis.'],
  ], ['Compresión no equivale siempre a subducción.', 'Los cabalgamientos pueden permanecer ocultos.', 'La anchura de ruptura influye en el momento.'], [USGS_BASICS, NOAA_TSUNAMI]),
  chapter('strike-slip', 'Fallas', 'Fallas de desgarre', 'Desplazamiento lateral derecho o izquierdo', 'faults', [
    ['Movimiento', 'Los bloques se desplazan principalmente en horizontal. El sentido dextral o sinistral se define observando hacia dónde parece moverse el bloque opuesto.'],
    ['Complejidad', 'Curvas y saltos crean zonas locales de compresión o extensión. Una traza cartográfica puede dividirse en numerosos segmentos con comportamiento diferente.'],
  ], ['San Andrés es un sistema dextral.', 'El mar Muerto combina desgarre y extensión.', 'Los saltos de falla condicionan la propagación de rupturas.'], [USGS_BASICS]),
  chapter('oblique-faulting', 'Fallas', 'Fallas oblicuas', 'Movimiento combinado en tres dimensiones', 'focal', [
    ['Combinación', 'Muchas rupturas no son puramente normales, inversas o de desgarre. Un mecanismo oblicuo combina componentes verticales y laterales porque el esfuerzo regional no está perfectamente alineado con la falla.'],
    ['Lectura', 'Rumbo, buzamiento y rake describen la orientación y el vector de deslizamiento. Estos parámetros permiten reconstruir un mecanismo más preciso que una etiqueta simple.'],
  ], ['El rake próximo a 0° indica desgarre.', 'Cerca de ±90° domina la componente vertical.', 'La solución focal contiene dos planos nodales.'], [COMCAT]),
  chapter('fault-segmentation', 'Fallas', 'Segmentación de fallas', 'Barreras, enlaces y rupturas en cascada', 'faults', [
    ['Segmentos', 'Cambios de orientación, material o geometría pueden frenar una ruptura. Sin embargo, un terremoto grande puede atravesar barreras y enlazar segmentos que antes se estudiaban por separado.'],
    ['Consecuencia', 'La longitud total que llega a romper controla en parte el tamaño máximo posible. Los modelos de peligro consideran escenarios múltiples y no una única ruptura preferida.'],
  ], ['Una barrera histórica puede fallar en el futuro.', 'Las réplicas delinean solo parte de la geometría.', 'Las fallas ciegas no alcanzan la superficie.'], [USGS_BASICS]),
  chapter('induced-seismicity', 'Fallas', 'Sismicidad inducida', 'Cambios de esfuerzo provocados por actividad humana', 'faults', [
    ['Mecanismo', 'La inyección o extracción de fluidos, los embalses y algunas operaciones geotérmicas pueden alterar presión de poros y esfuerzos en fallas preexistentes. No significa que la actividad cree toda la estructura desde cero.'],
    ['Atribución', 'Relacionar un evento con una operación exige estudiar tiempo, distancia, profundidad, volúmenes, presión y tectónica regional. Una coincidencia espacial aislada no basta.'],
  ], ['La mayoría de las operaciones no produce terremotos sentidos.', 'El riesgo depende del contexto geológico.', 'Las redes densas detectan microseísmos tempranos.'], [USGS_BASICS]),

  chapter('p-waves', 'Ondas', 'Ondas P', 'La primera llegada compresional', 'waves', [
    ['Movimiento', 'Las ondas P alternan compresión y dilatación en dirección aproximadamente paralela a la propagación. Viajan por sólidos, líquidos y gases y suelen ser la primera fase registrada.'],
    ['Uso', 'La diferencia entre llegada P y S aporta distancia a la fuente. Sus polaridades iniciales también contribuyen a calcular mecanismos focales.'],
  ], ['P significa primaria.', 'Su velocidad depende de módulos elásticos y densidad.', 'Cruzan el núcleo externo líquido.'], [USGS_BASICS]),
  chapter('s-waves', 'Ondas', 'Ondas S', 'Cizalla que no atraviesa líquidos', 'waves', [
    ['Movimiento', 'Las ondas S desplazan el material perpendicularmente a la dirección de viaje. Suelen tener amplitudes fuertes y llegan después de las P.'],
    ['Interior terrestre', 'Como un líquido no sostiene cizalla estática, las S no cruzan el núcleo externo. Su zona de sombra fue una evidencia decisiva sobre la estructura interna.'],
  ], ['S significa secundaria.', 'Solo se propagan por sólidos.', 'Pueden dividirse en componentes radial y transversal.'], [USGS_BASICS]),
  chapter('surface-waves', 'Ondas', 'Ondas Love y Rayleigh', 'Ondas superficiales de gran amplitud', 'waves', [
    ['Love', 'Las ondas Love producen movimiento horizontal transversal sin componente vertical ideal. Su velocidad depende de la estructura estratificada cercana a la superficie.'],
    ['Rayleigh', 'Las Rayleigh generan movimiento elíptico vertical y longitudinal, parecido al rodamiento. En terremotos lejanos pueden dominar registros de periodo largo.'],
  ], ['Se dispersan según frecuencia.', 'Pueden causar daños a gran distancia.', 'Su análisis revela estructura cortical.'], [USGS_BASICS]),
  chapter('attenuation', 'Ondas', 'Atenuación y dispersión', 'Por qué la señal pierde amplitud y cambia', 'waves', [
    ['Atenuación', 'La amplitud disminuye por expansión geométrica, absorción anelástica y dispersión en heterogeneidades. Las frecuencias altas suelen perderse con mayor rapidez.'],
    ['Dispersión', 'En medios estratificados distintas frecuencias viajan a velocidades diferentes. Un paquete de ondas se ensancha y su forma cambia con la distancia.'],
  ], ['El factor Q describe pérdidas anelásticas.', 'La corteza no es homogénea.', 'Atenuación local altera la intensidad observada.'], [USGS_BASICS]),
  chapter('travel-times', 'Ondas', 'Tiempos de viaje', 'Fases, curvas y localización', 'location', [
    ['Curvas', 'Una curva tiempo-distancia predice cuándo debe llegar cada fase para un modelo terrestre. Las estaciones comparan esas predicciones con lecturas reales.'],
    ['Residuos', 'La diferencia entre tiempo observado y calculado se llama residuo. Ajustar origen, hipocentro y modelo de velocidades reduce el conjunto de residuos.'],
  ], ['Se usan tiempos UTC precisos.', 'Una sola estación no localiza un evento de forma única.', 'Modelos regionales mejoran terremotos locales.'], [FDSN, EARTHSCOPE]),
  chapter('seismogram-reading', 'Ondas', 'Cómo leer un sismograma', 'Tiempo, amplitud, canal y ruido', 'seismogram', [
    ['Ejes', 'El eje horizontal representa tiempo; el vertical, una magnitud registrada o corregida como cuentas, velocidad, aceleración o desplazamiento. Sin metadatos de respuesta instrumental la amplitud no es directamente comparable.'],
    ['Fases', 'Una llegada P puede ser pequeña y abrupta; la S suele aumentar la amplitud; las ondas superficiales aparecen después. Ruido cultural, viento o saturación pueden imitar o ocultar fases.'],
  ], ['Z, N y E son componentes habituales.', 'El canal codifica banda, instrumento y orientación.', 'Un gráfico demostrativo no sustituye la forma de onda real.'], [FDSN, EARTHSCOPE]),
  chapter('frequency-spectrum', 'Ondas', 'Frecuencia y espectro', 'De la forma de onda al contenido energético', 'seismogram', [
    ['Dominio frecuencial', 'La transformada de Fourier separa una señal en frecuencias. Microseísmos, ruido humano y terremotos ocupan bandas parcialmente distintas.'],
    ['Espectro de fuente', 'El nivel de baja frecuencia se relaciona con momento sísmico y la frecuencia de esquina con tamaño de fuente y caída de esfuerzo, bajo modelos simplificados.'],
  ], ['Frecuencia es inversa del periodo.', 'Filtrar puede mejorar señal o crear artefactos.', 'La tasa de muestreo limita la frecuencia máxima resoluble.'], [EARTHSCOPE]),
  chapter('site-effects', 'Ondas', 'Efectos de sitio', 'El terreno modifica la sacudida', 'waves', [
    ['Amplificación', 'Sedimentos blandos pueden amplificar determinadas frecuencias y prolongar la duración frente a roca competente. La geometría de una cuenca puede atrapar energía.'],
    ['Resonancia', 'El daño aumenta cuando los periodos dominantes del suelo coinciden con los de una estructura. Por eso edificios diferentes responden de modo distinto al mismo movimiento.'],
  ], ['La intensidad varía de un lugar a otro.', 'La distancia al epicentro no explica todo.', 'Microzonificación y VS30 ayudan a modelar el efecto local.'], [USGS_MAG]),

  chapter('magnitude', 'Medición', 'Qué es la magnitud', 'Un tamaño único para el terremoto', 'magnitude', [
    ['Escala logarítmica', 'La magnitud resume el tamaño de la fuente. Un incremento de una unidad representa aproximadamente diez veces la amplitud medida y unas 32 veces la energía radiada, según la relación utilizada.'],
    ['No es daño', 'Un terremoto posee una magnitud preferida, pero sus consecuencias dependen de profundidad, distancia, terreno, vulnerabilidad y exposición. Magnitud e intensidad no deben intercambiarse.'],
  ], ['Las magnitudes pueden revisarse.', 'Distintas escalas no son idénticas.', 'Una magnitud negativa es físicamente válida para eventos muy pequeños.'], [USGS_MAG]),
  chapter('local-magnitude', 'Medición', 'ML, Md y mbLg', 'Magnitudes locales y regionales', 'magnitude', [
    ['ML', 'La magnitud local de Richter se diseñó para amplitudes registradas en el sur de California con un instrumento y corrección de distancia concretos. Las redes modernas la adaptan regionalmente.'],
    ['Otras escalas', 'Md usa duración de la señal; mbLg se emplea para ondas regionales en algunos catálogos. Son útiles para sismos pequeños, pero pueden saturarse o diferir de Mw.'],
  ], ['“Richter” no es el nombre universal de toda magnitud.', 'El tipo aparece junto al valor en Episismic.', 'Comparar escalas exige conocer rango y calibración.'], [COMCAT, USGS_MAG]),
  chapter('moment-magnitude', 'Medición', 'Magnitud de momento Mw', 'La escala física para grandes terremotos', 'focal', [
    ['Momento sísmico', 'El momento escalar M0 combina rigidez, área de ruptura y deslizamiento medio. Mw transforma ese valor a una escala compatible con magnitudes tradicionales sin saturarse tan pronto.'],
    ['Interpretación', 'Dos eventos con Mw similar pueden tener duraciones, geometrías y frecuencias distintas. Mw mide tamaño global de la fuente, no un patrón único de sacudida.'],
  ], ['M0 se expresa normalmente en N·m.', 'Mw es preferida para eventos grandes.', 'Los primeros valores automáticos pueden ser otras magnitudes.'], [USGS_MAG, COMCAT]),
  chapter('body-surface-magnitude', 'Medición', 'mb y Ms', 'Ondas internas y superficiales', 'waves', [
    ['mb', 'La magnitud mb usa amplitudes de ondas de cuerpo, a menudo P de periodo corto. Es rápida y útil a distancia telesísmica, aunque satura para eventos grandes.'],
    ['Ms', 'La magnitud de ondas superficiales emplea ondas de periodo cercano a veinte segundos. Fue muy usada para grandes eventos someros, pero también presenta límites.'],
  ], ['El tipo de magnitud forma parte del dato.', 'Un mismo evento puede tener varias soluciones.', 'La solución preferida puede cambiar al llegar más fases.'], [COMCAT]),
  chapter('intensity', 'Medición', 'Intensidad macrosísmica', 'Efectos locales expresados con números romanos', 'intensity', [
    ['Escala local', 'La intensidad describe cómo se siente y qué efectos produce la sacudida en un lugar. Mercalli modificada usa grados romanos I–XII; Europa utiliza habitualmente EMS-98 con un propósito relacionado.'],
    ['En el historial', 'I, II, III o IV no son una categoría de profundidad. Indican intensidad observada o estimada: I apenas perceptible; II–III débil; IV ampliamente perceptible; grados altos implican daño creciente.'],
  ], ['Un terremoto tiene muchas intensidades geográficas.', 'Los números romanos no son magnitud.', 'MMI instrumental y reportada pueden diferir.'], [USGS_MMI, COMCAT]),
  chapter('significance', 'Medición', 'Significancia y PAGER', 'Indicadores operativos, no nuevas magnitudes', 'alert', [
    ['Significancia', 'ComCat calcula un valor de significancia combinando magnitud y, cuando existen, número de reportes sentidos, intensidad y otros productos. Sirve para ordenar, no es una escala física universal.'],
    ['PAGER', 'Las alertas verde, amarilla, naranja y roja estiman impacto probable en población y economía. Pueden tardar más que la primera localización porque requieren modelos adicionales.'],
  ], ['Una alerta nula no significa riesgo cero.', 'PAGER no se calcula para todos los microseísmos.', 'El color de profundidad de Episismic es independiente.'], [COMCAT]),
  chapter('uncertainty', 'Medición', 'Incertidumbre de la solución', 'Toda localización es una estimación', 'location', [
    ['Fuentes de error', 'Geometría de red, ruido, modelo de velocidades, identificación de fases y sincronización influyen en la solución. La profundidad suele ser menos precisa que la posición horizontal.'],
    ['Revisiones', 'Una solución automática prioriza rapidez. Más estaciones, fases y revisión humana pueden desplazar epicentro, cambiar profundidad y ajustar magnitud.'],
  ], ['Los decimales mostrados no equivalen a precisión absoluta.', 'A significa automático y R revisado en Episismic.', 'Catálogos diferentes pueden publicar soluciones cercanas.'], [COMCAT, FDSN]),
  chapter('focal-mechanism', 'Medición', 'Mecanismo focal', 'La “pelota de playa” y el tensor de momento', 'focal', [
    ['Solución', 'Las polaridades y formas de onda permiten estimar orientación de planos nodales y sentido de deslizamiento. El diagrama separa cuadrantes de compresión y dilatación.'],
    ['Limitación', 'El mecanismo ofrece dos planos compatibles; uno es la falla y otro auxiliar. Réplicas, geología o geodesia ayudan a resolver la ambigüedad.'],
  ], ['No representa el tamaño gráfico de la ruptura.', 'El tensor completo admite componentes no doble-par.', 'Rumbo, buzamiento y rake describen cada plano.'], [COMCAT]),

  chapter('seismometer', 'Instrumentación', 'Sismómetro y acelerómetro', 'Sensores para movimientos distintos', 'station', [
    ['Sismómetro', 'Un sismómetro de banda ancha mide movimientos muy pequeños durante un amplio rango de periodos. Requiere instalación estable, orientación, calibración y control ambiental.'],
    ['Acelerómetro', 'Un acelerómetro de movimiento fuerte evita saturarse cerca de terremotos dañinos. Es esencial para ingeniería y ShakeMap, aunque menos sensible a señales débiles lejanas.'],
  ], ['Una estación puede combinar ambos sensores.', 'La respuesta instrumental debe retirarse para unidades físicas.', 'Saturación y clipping invalidan amplitudes.'], [EARTHSCOPE, FDSN]),
  chapter('station-components', 'Instrumentación', 'Componentes Z, N y E', 'Movimiento tridimensional del terreno', 'station', [
    ['Orientación', 'Z registra vertical; N y E, horizontales. Algunas instalaciones usan orientaciones 1 y 2 que requieren metadatos de azimut para rotarlas.'],
    ['Análisis', 'Combinar componentes permite separar movimiento radial y transversal, identificar polarización y estudiar ondas de cizalla y superficie.'],
  ], ['La orientación incorrecta contamina el análisis.', 'Los canales incluyen código de localización.', 'Una estación puede tener varios instrumentos y épocas.'], [FDSN]),
  chapter('digitizer-sampling', 'Instrumentación', 'Digitalización y muestreo', 'De voltaje continuo a datos científicos', 'station', [
    ['Muestreo', 'El digitalizador convierte la señal analógica en números a intervalos regulares. Para evitar aliasing, la frecuencia útil debe quedar por debajo de la mitad de la tasa de muestreo y emplearse filtros adecuados.'],
    ['Rango dinámico', 'Los convertidores modernos registran señales muy débiles y fuertes, pero ningún sistema es ilimitado. Ganancia, ruido propio y resolución condicionan la calidad.'],
  ], ['100 muestras/s es común en canales de banda alta.', 'El tiempo se sincroniza con GNSS u otras referencias.', 'Huecos y solapes deben marcarse.'], [FDSN, EARTHSCOPE]),
  chapter('station-installation', 'Instrumentación', 'Instalación de una estación', 'Emplazamiento, energía y telemetría', 'station', [
    ['Sitio', 'Se busca roca estable, bajo ruido cultural, buen acoplamiento y protección térmica. Pozos y cuevas reducen algunas perturbaciones ambientales.'],
    ['Operación', 'La estación necesita alimentación, reloj, almacenamiento y telecomunicación. Una ubicación excelente sin telemetría fiable puede llegar tarde a los sistemas en tiempo real.'],
  ], ['Viento y presión afectan periodos largos.', 'Tráfico y maquinaria dominan ciertas bandas.', 'Los metadatos de época documentan cada cambio.'], [EARTHSCOPE]),
  chapter('station-codes', 'Instrumentación', 'Códigos FDSN', 'Red, estación, localización y canal', 'station', [
    ['SEED', 'Una corriente se identifica mediante red, estación, localización y canal. Por ejemplo, el canal BHZ describe banda, instrumento y componente vertical según la convención SEED.'],
    ['En Episismic', 'El mapa muestra primero agrupaciones; al acercar aparecen icono y código NET.STA. La ficha enlaza al servicio público que conserva metadatos de la estación.'],
  ], ['El código no siempre coincide con el nombre del lugar.', 'Una estación cerrada puede seguir en archivos históricos.', 'Los catálogos se deduplican por identidad de red y estación.'], [FDSN]),
  chapter('gsn', 'Instrumentación', 'Red Sísmica Global', 'Cobertura mundial de alta calidad', 'station', [
    ['Objetivo', 'La Global Seismographic Network reúne aproximadamente 150 estaciones digitales distribuidas mundialmente con datos abiertos y en tiempo real. Busca fidelidad desde movimiento fuerte local hasta oscilaciones globales.'],
    ['Cobertura', 'Una red global no elimina huecos regionales. Episismic combina miles de estaciones de muchas redes FDSN; que una estación figure en catálogo no garantiza una transmisión activa en ese instante.'],
  ], ['GSN es una parte del catálogo mundial.', 'IU, II, IC y CU son códigos destacados.', 'La densidad europea explica la gran cantidad de símbolos.'], [EARTHSCOPE]),
  chapter('fdsn-services', 'Instrumentación', 'Servicios web FDSN', 'Station, Event y DataSelect', 'catalogue', [
    ['Interoperabilidad', 'FDSN define interfaces comunes para consultar eventos, metadatos de estaciones y formas de onda. Las redes conservan autoridad sobre sus datos aunque compartan el protocolo.'],
    ['Servicios', 'Station entrega inventario y respuesta; Event, catálogos de terremotos; DataSelect, segmentos miniSEED. SeedLink se usa para flujo continuo de baja latencia.'],
  ], ['Una URL FDSN no implica acceso irrestricto.', 'Cada red puede imponer límites.', 'Metadatos y forma de onda deben corresponder a la misma época.'], [FDSN, EMSC, GEOFON]),
  chapter('seedlink', 'Instrumentación', 'SeedLink y flujo en tiempo real', 'De estaciones continuas a detecciones', 'catalogue', [
    ['Flujo', 'SeedLink distribuye paquetes de forma de onda de manera continua. Un detector analiza cada canal, identifica cambios, propone llegadas y asocia disparos de varias estaciones.'],
    ['Por qué requiere servidor', 'Un navegador alojado en GitHub Pages no mantiene de forma nativa miles de conexiones TCP SeedLink ni ejecuta una red de asociación robusta. Se necesita ingesta de servidor y una salida WebSocket agregada.'],
  ], ['Un disparo de estación no es todavía un terremoto.', 'La asociación reduce falsos positivos.', 'Latencia y cobertura dependen de cada red.'], [FDSN, EARTHSCOPE]),

  chapter('phase-picking', 'Detección', 'Picado de fases', 'Identificar llegadas P y S', 'seismogram', [
    ['Automático', 'Algoritmos clásicos comparan energía de ventanas cortas y largas; modelos modernos reconocen patrones aprendidos. Ambos generan candidatos con probabilidad e incertidumbre.'],
    ['Revisión', 'Ruido impulsivo, tormentas, explosiones o saturación pueden engañar al detector. La coherencia entre estaciones y velocidades físicamente posibles es esencial.'],
  ], ['STA/LTA es un detector clásico.', 'Una fase incluye tiempo, tipo, polaridad y peso.', 'La S suele ser más difícil de picar automáticamente.'], [FDSN]),
  chapter('association', 'Detección', 'Asociación de detecciones', 'De varios disparos a un evento', 'location', [
    ['Hipótesis', 'El asociador busca un origen capaz de explicar tiempos de llegada en varias estaciones. Debe distinguir terremotos simultáneos, fases mal identificadas y ruido correlacionado.'],
    ['Calidad', 'Más estaciones bien distribuidas mejoran la solución. Muchos disparos de una sola dirección pueden dar falsa confianza y una profundidad inestable.'],
  ], ['La letra de calidad depende de cada software.', 'Episismic no inventa categorías A–D ajenas al catálogo.', 'Las soluciones multifuente conservan sus autoridades.'], [FDSN, COMCAT]),
  chapter('automatic-reviewed', 'Detección', 'Automático, manual y revisado', 'Estados de un registro sísmico', 'alert', [
    ['A', 'A indica solución automática en Episismic. Está pensada para rapidez y puede cambiar al recibir datos o productos nuevos.'],
    ['R y M', 'R indica una solución marcada como revisada por la fuente. M queda reservado para intervención manual explícita cuando la fuente la distingue. No es una escala de peligro.'],
  ], ['Estado y magnitud son campos independientes.', 'Una revisión puede bajar o subir la magnitud.', 'La hora “actualizada” puede ser posterior al terremoto.'], [COMCAT]),
  chapter('false-triggers', 'Detección', 'Falsos disparos y anomalías', 'Ruido que parece señal sísmica', 'seismogram', [
    ['Causas', 'Rayos, explosiones, trenes, canteras, golpes, fallos de telemetría y tormentas oceánicas pueden activar una estación. Un visor de formas de onda puede mostrarlos aunque nunca formen un terremoto catalogado.'],
    ['Lectura correcta', 'Más sonidos en un detector no equivalen automáticamente a más terremotos. La aplicación debe separar “disparo”, “evento candidato” y “evento publicado”.'],
  ], ['Los catálogos filtran muchas anomalías.', 'Las estaciones cercanas comparten algunas fuentes de ruido.', 'Conservar el nivel de confianza evita falsas alarmas.'], [EARTHSCOPE, COMCAT]),
  chapter('early-warning', 'Detección', 'Alerta temprana sísmica', 'Avisar después de iniciar la ruptura, antes de la sacudida fuerte', 'alert', [
    ['Principio', 'Una alerta temprana detecta las primeras ondas P y estima rápidamente fuente e intensidad esperada. Las telecomunicaciones pueden adelantar a las ondas más lentas hacia lugares alejados.'],
    ['Límites', 'Cerca del epicentro existe una zona sin tiempo útil; grandes terremotos crecen durante la ruptura y pueden subestimarse al principio. No es predicción previa.'],
  ], ['Segundos pueden permitir acciones automáticas.', 'La latencia total incluye sensor, red, cálculo y distribución.', 'Una alerta debe proceder de autoridades competentes.'], [USGS_BASICS]),
  chapter('episismic-merge', 'Detección', 'Fusión multifuente de Episismic', 'USGS, EMSC y GEOFON sin multiplicar duplicados', 'catalogue', [
    ['Normalización', 'Cada catálogo usa identificadores, autoridades y ritmos distintos. Episismic convierte los campos a un modelo común y conserva catálogo, fuente preferida y enlace original.'],
    ['Deduplicación', 'Soluciones próximas en tiempo, distancia y magnitud se agrupan. Esta heurística mejora la lectura, pero no afirma identidad científica absoluta y puede ajustarse conforme haya más metadatos.'],
  ], ['La consulta se repite cada 30 segundos.', 'Una fuente no borra a otra.', 'SQLite conserva eventos y revisiones localmente.'], [COMCAT, EMSC, GEOFON]),
  chapter('latency', 'Detección', 'Latencia de catálogo', 'Por qué un evento puede tardar en aparecer', 'catalogue', [
    ['Cadena', 'La latencia suma transmisión de estaciones, detección, asociación, cálculo, publicación, consulta y renderizado. Un catálogo revisado será normalmente más lento que un disparo de forma de onda.'],
    ['Comparaciones', 'Comparar Episismic con GlobalQuake exige comparar el mismo nivel: detección interna frente a detección interna o evento publicado frente a evento publicado. La cantidad bruta de pitidos no basta.'],
  ], ['Las redes locales suelen publicar microseísmos antes.', 'Fuentes globales priorizan coherencia mundial.', 'Una revisión tardía puede reemplazar la solución inicial.'], [COMCAT, EMSC, GEOFON]),

  chapter('convergent-boundaries', 'Entornos tectónicos', 'Límites convergentes', 'Subducción y colisión', 'subduction', [
    ['Subducción', 'Una placa desciende bajo otra y crea fosa, arco volcánico y una zona inclinada de terremotos. Puede albergar sismicidad desde superficial hasta unos 700 km.'],
    ['Colisión', 'Cuando convergen continentes, la flotabilidad dificulta la subducción completa y reparte el acortamiento en cabalgamientos y deformación ancha.'],
  ], ['Las mayores magnitudes ocurren en megafallas de subducción.', 'No toda convergencia produce volcanes iguales.', 'La profundidad dibuja la placa descendente.'], [USGS_BASICS]),
  chapter('divergent-boundaries', 'Entornos tectónicos', 'Límites divergentes', 'Dorsales y rifts', 'plates', [
    ['Separación', 'Las placas se alejan, asciende material del manto y se crea nueva corteza. En océanos forman dorsales; en continentes, valles de rift.'],
    ['Sismicidad', 'Predominan terremotos someros, normalmente moderados, combinados con volcanismo. Segmentos de dorsal se conectan mediante fallas transformantes.'],
  ], ['La dorsal mesoatlántica emerge en Islandia.', 'La corteza oceánica rejuvenece hacia la dorsal.', 'La batimetría revela con claridad estos sistemas.'], [USGS_BASICS]),
  chapter('transform-boundaries', 'Entornos tectónicos', 'Límites transformantes', 'Placas que se deslizan lateralmente', 'plates', [
    ['Movimiento', 'Una transformante acomoda desplazamiento paralelo al límite sin crear ni destruir corteza de forma dominante. En océanos enlaza segmentos de dorsal; en continentes puede formar largos sistemas de desgarre.'],
    ['Sismicidad', 'Los focos son someros y pueden ser destructivos cerca de ciudades. La ruptura puede propagarse rápidamente a lo largo del rumbo.'],
  ], ['Transformante y zona de fractura no son exactamente lo mismo.', 'Los extremos conectan con otros límites.', 'La segmentación controla escenarios.'], [USGS_BASICS]),
  chapter('subduction-zones', 'Entornos tectónicos', 'Zonas de subducción', 'Megaterremotos, arcos y fosas', 'subduction', [
    ['Interfaz', 'La megafalla entre placas puede permanecer bloqueada durante décadas o siglos. La ruptura de un área enorme genera los mayores terremotos instrumentales.'],
    ['Placa interna', 'También ocurren terremotos dentro de la placa que desciende y en la placa superior. Sus mecanismos, profundidades y peligros son distintos.'],
  ], ['La zona Wadati–Benioff sigue la placa descendente.', 'Un gran desplazamiento vertical puede generar tsunami.', 'Réplicas cubren un área extensa.'], [USGS_BASICS, NOAA_TSUNAMI]),
  chapter('mediterranean', 'Entornos tectónicos', 'Mediterráneo', 'Un mosaico de subducción, colisión y microplacas', 'plates', [
    ['Complejidad', 'La convergencia África–Eurasia se reparte entre arcos, cuencas, fallas y bloques. Hellenic, Calabria, Anatolia, Adriático y Magreb no forman una frontera lineal única.'],
    ['Mapa', 'Episismic muestra límites PB2002 definidos con trazo sólido y orógenos o deformación difusa con trazo discontinuo. Esta distinción evita interpretar una franja compleja como una grieta exacta.'],
  ], ['Italia combina subducción, extensión y fallas activas.', 'El norte de África contiene sistemas compresivos.', 'Los modelos globales simplifican detalles locales.'], [IGN_ALBORAN, IGN_BETICAS]),
  chapter('gibraltar-alboran', 'Entornos tectónicos', 'Gibraltar, Cádiz y Alborán', 'La frontera difusa África–Eurasia', 'plates', [
    ['Golfo de Cádiz', 'Al oeste, la fractura Azores–Gibraltar está mejor definida hasta la cordillera de Gorringe. Hacia el estrecho la convergencia oblicua se distribuye y cambia de geometría.'],
    ['Arco de Gibraltar', 'Béticas y Rif rodean Alborán. El IGN describe convergencia aproximada de 5 mm/año, compresión con desgarre y múltiples estructuras; por eso la traza cartográfica realiza giros que pueden parecer inesperados.'],
  ], ['No hay una sola falla continua bajo el Estrecho.', 'La sismicidad incluye focos someros e intermedios.', 'Los catálogos regionales ofrecen más detalle que PB2002.'], [IGN_ALBORAN, IGN_BETICAS]),
  chapter('italy-maghreb', 'Entornos tectónicos', 'Italia, Túnez y Magreb', 'Arcos, orógenos y deformación distribuida', 'plates', [
    ['Italia', 'Apeninos, Adriático, Calabria y Sicilia combinan extensión, compresión y restos de subducción. Una única línea roja no puede representar por sí sola todo el sistema.'],
    ['Magreb', 'Las cadenas del Atlas y el margen norteafricano absorben parte de la convergencia. En PB2002 varias trazas son orógenos o límites difusos, no fronteras cinemáticas precisas.'],
  ], ['Los trazos discontinuos de Episismic indican deformación difusa.', 'Los límites definidos siguen en rojo intenso sólido.', 'La escala global exige generalización cartográfica.'], [IGN_ALBORAN, IGN_BETICAS]),
  chapter('intraplate', 'Entornos tectónicos', 'Terremotos intraplaca', 'Actividad lejos de límites principales', 'faults', [
    ['Origen', 'Antiguas estructuras pueden reactivarse bajo el campo de esfuerzos actual. La sismicidad suele ser menos frecuente que en bordes, pero puede afectar regiones con poca preparación.'],
    ['Localización', 'Al haber menos estaciones o modelos regionales, algunos eventos pequeños tardan más en localizarse. Las fallas responsables pueden no ser visibles en superficie.'],
  ], ['Lejos de un límite no significa sin riesgo.', 'Las zonas estables transmiten ondas eficientemente.', 'La recurrencia suele estar peor caracterizada.'], [USGS_BASICS]),
  chapter('volcanic-seismicity', 'Entornos tectónicos', 'Sismicidad volcánica', 'Fractura, fluidos y tremor', 'seismogram', [
    ['Tipos', 'Eventos volcano-tectónicos reflejan fractura frágil; señales de periodo largo y tremor pueden relacionarse con fluidos y resonancias. La clasificación depende del volcán y la red.'],
    ['Interpretación', 'Un enjambre no implica erupción inevitable. Se combina con deformación, gases, temperatura y observación geológica para evaluar cambios.'],
  ], ['Cada volcán tiene un nivel base diferente.', 'El tremor puede ser continuo.', 'La capa GVP de Episismic es un catálogo, no un estado de alerta en vivo.'], [USGS_BASICS]),

  chapter('aftershocks', 'Secuencias', 'Réplicas', 'Reajuste tras la ruptura principal', 'alert', [
    ['Distribución', 'Las réplicas se concentran alrededor de la zona que cambió de esfuerzo. Su tasa suele decrecer con el tiempo, aunque pueden producirse eventos grandes y dañinos.'],
    ['Terminología', '“Principal” se asigna por comparación: si ocurre después un evento mayor, la secuencia puede reclasificarse. Las etiquetas no cambian la física de cada terremoto.'],
  ], ['Una réplica puede derribar estructuras debilitadas.', 'La zona se extiende con la longitud de ruptura.', 'La probabilidad disminuye, no cae instantáneamente a cero.'], [USGS_BASICS]),
  chapter('foreshocks', 'Secuencias', 'Precursores y sismos premonitorios', 'Una etiqueta que solo se conoce después', 'alert', [
    ['Definición', 'Un sismo se llama premonitorio si posteriormente ocurre otro mayor relacionado. Antes del principal es indistinguible con certeza de innumerables eventos que no preceden a uno grande.'],
    ['Prudencia', 'Enjambres, cambios de velocidad o emisiones se investigan científicamente, pero no constituyen por sí solos una predicción determinista.'],
  ], ['“Foreshock” es una clasificación retrospectiva.', 'La mayoría de pequeños sismos no precede a uno grande.', 'La comunicación debe expresar probabilidades.'], [USGS_BASICS]),
  chapter('swarms', 'Secuencias', 'Enjambres sísmicos', 'Muchos eventos sin principal dominante', 'seismogram', [
    ['Patrón', 'Un enjambre contiene numerosos terremotos de tamaño parecido durante horas, días o meses. Puede relacionarse con fluidos, volcanismo, geotermia o transferencia tectónica.'],
    ['Visualización', 'En ventanas largas conviene agrupar espacialmente y filtrar temporalmente. Mostrar miles de símbolos individuales al mismo nivel de zoom ralentiza y oculta el patrón.'],
  ], ['No todo enjambre es volcánico.', 'La migración espacial puede ser informativa.', 'Clustering no elimina los registros subyacentes.'], [USGS_BASICS]),
  chapter('omori-law', 'Secuencias', 'Ley de Omori-Utsu', 'Decaimiento temporal de réplicas', 'magnitude', [
    ['Relación', 'La tasa de réplicas se aproxima mediante n(t)=K/(c+t)^p. Los parámetros varían por secuencia y el modelo no predice exactamente la hora de cada evento.'],
    ['Uso', 'Ayuda a estimar evolución estadística y planificar vigilancia. Debe combinarse con incertidumbre, completitud del catálogo y posible actividad secundaria.'],
  ], ['p suele estar cerca de 1.', 'El catálogo temprano pierde eventos pequeños solapados.', 'Una réplica grande puede iniciar su propia subsecuencia.'], [USGS_BASICS]),
  chapter('gutenberg-richter', 'Secuencias', 'Gutenberg–Richter', 'Muchos pequeños, pocos grandes', 'magnitude', [
    ['Relación', 'La frecuencia acumulada suele seguir log10 N = a − bM. El parámetro b describe la proporción relativa entre terremotos pequeños y grandes.'],
    ['Completitud', 'Solo debe ajustarse por encima de la magnitud a partir de la cual el catálogo detecta de manera fiable. Cambios de red alteran ese umbral.'],
  ], ['b cercano a 1 es común, no universal.', 'Más microseísmos no implican automáticamente un gran evento.', 'La ventana de observación afecta la estimación.'], [USGS_MAG]),

  chapter('ground-shaking', 'Peligros', 'Sacudida del terreno', 'El peligro primario más extendido', 'waves', [
    ['Parámetros', 'PGA, PGV, duración y espectro de respuesta describen aspectos diferentes. La magnitud controla el potencial de fuente, pero distancia, directividad y terreno controlan la demanda local.'],
    ['Mapas', 'ShakeMap combina registros, modelos e intensidades para estimar distribución. Un epicentro puntual no es un mapa de daño.'],
  ], ['PGA es aceleración máxima.', 'PGV correlaciona con ciertos daños.', 'La duración aumenta en grandes rupturas.'], [USGS_MAG, COMCAT]),
  chapter('liquefaction', 'Peligros', 'Licuefacción', 'Pérdida de resistencia en suelos saturados', 'waves', [
    ['Proceso', 'La carga cíclica eleva presión de poros y reduce esfuerzo efectivo. Arenas sueltas saturadas pueden deformarse, expulsar agua o dejar de sostener cimentaciones.'],
    ['Condiciones', 'Requiere combinación de sacudida, material susceptible y nivel freático. No se deduce solo de la magnitud.'],
  ], ['Puede causar flotación de tuberías.', 'La mejora del terreno reduce susceptibilidad.', 'Mapas geotécnicos complementan ShakeMap.'], [USGS_BASICS]),
  chapter('landslides', 'Peligros', 'Deslizamientos inducidos', 'Inestabilidad de laderas durante la sacudida', 'subduction', [
    ['Desencadenamiento', 'Pendiente, roca alterada, saturación y aceleración determinan la respuesta. Terremotos grandes pueden movilizar miles de laderas y bloquear valles.'],
    ['Efectos secundarios', 'Los deslizamientos cortan carreteras, represan ríos y dificultan rescates. Algunos generan olas locales al entrar en lagos o fiordos.'],
  ], ['La lluvia previa modifica susceptibilidad.', 'Las réplicas pueden reactivar laderas.', 'El inventario de deslizamientos ayuda a calibrar modelos.'], [USGS_BASICS]),
  chapter('tsunamis', 'Peligros', 'Tsunamis', 'Desplazamiento de toda la columna de agua', 'tsunami', [
    ['Generación', 'Un desplazamiento rápido y amplio del fondo marino puede mover la columna de agua. También pueden generarlos deslizamientos, volcanes o impactos. No todo terremoto submarino produce tsunami.'],
    ['Propagación', 'En océano profundo la amplitud puede ser pequeña y la velocidad alta. Al disminuir la profundidad, la onda se ralentiza, se acorta y crece; llega como una serie, no una sola ola.'],
  ], ['Retirada anómala del mar es una señal natural.', 'No se debe ir a observar la costa.', 'La primera ola puede no ser la mayor.'], [NOAA_TSUNAMI]),
  chapter('building-response', 'Peligros', 'Respuesta de edificios', 'Periodo, ductilidad y diseño', 'waves', [
    ['Dinámica', 'Cada estructura posee modos naturales. La demanda aumenta si el contenido frecuencial del movimiento coincide con esos periodos y si la estructura carece de ductilidad o detalle sismorresistente.'],
    ['Vulnerabilidad', 'Edificios de mampostería no reforzada, plantas blandas y elementos no estructurales pueden fallar de maneras distintas. El año y código constructivo importan tanto como la altura.'],
  ], ['Altura no equivale directamente a peligro.', 'Ductilidad permite disipar energía.', 'Inspección profesional es imprescindible tras daño.'], [READY]),
  chapter('preparedness', 'Peligros', 'Preparación y respuesta', 'Antes, durante y después', 'alert', [
    ['Durante', 'Agáchate, cúbrete y agárrate; aléjate de cristales y no uses ascensores. En costa con sacudida fuerte o prolongada, evacúa hacia zona alta siguiendo indicaciones locales.'],
    ['Después', 'Espera réplicas, revisa lesiones y riesgos evidentes, usa mensajes para no saturar redes y sigue únicamente información oficial. No difundas capturas sin hora y fuente.'],
  ], ['Fija muebles altos.', 'Prepara agua, luz, radio y medicación.', 'Conoce rutas y puntos de encuentro.'], [READY, NOAA_TSUNAMI]),

  chapter('map-symbols', 'Episismic', 'Símbolos del mapa', 'Cómo leer epicentros, estaciones y agrupaciones', 'catalogue', [
    ['Epicentros', 'El núcleo coloreado representa profundidad y el halo garantiza contraste sobre satélite, relieve y batimetría. El radio aumenta suavemente con magnitud, sin extrusiones verticales costosas.'],
    ['Estaciones', 'Los símbolos turquesa representan estaciones FDSN; en vista global se agrupan con un contador. Al acercar aparecen iconos individuales y códigos NET.STA.'],
  ], ['Los grupos se separan al hacer zoom.', 'Ocultar una capa no borra datos.', 'Los volcanes usan otra familia cromática.'], [FDSN, COMCAT]),
  chapter('depth-colors', 'Episismic', 'Color de profundidad', 'Cuatro intervalos coherentes', 'earth', [
    ['Intervalos', 'Rojo coral: 0–35 km; ámbar: 35–70 km; azul: 70–300 km; violeta: más de 300 km. Son clases visuales amplias, no fronteras geológicas universales.'],
    ['Lectura', 'Un punto violeta no significa mayor peligro que uno rojo. La profundidad influye en la sacudida, pero debe interpretarse junto con magnitud, distancia y mecanismo.'],
  ], ['La mayoría de eventos son someros.', 'Subducciones concentran focos intermedios y profundos.', 'La leyenda permanece visible en escritorio.'], [COMCAT]),
  chapter('map-layers', 'Episismic', 'Cartografías y rótulos', 'Político, satélite, relieve y batimetría', 'earth', [
    ['Bases', 'Político usa polígonos Natural Earth alojados localmente; satélite usa imagen sin rótulos; batimetría resalta el fondo oceánico. Relieve OpenTopoMap lleva nombres integrados en la propia tesela.'],
    ['Nombres', 'En político, satélite y batimetría, la capa de nombres se activa o desactiva. En relieve el control queda bloqueado porque los textos están impresos en las imágenes del proveedor y no pueden retirarse por separado.'],
  ], ['Los datos políticos ya no dependen de GitHub Raw.', 'Natural Earth generaliza según escala.', 'Zoom alto no inventa detalle ausente de la fuente.'], [NATURAL_EARTH]),
  chapter('plate-layer', 'Episismic', 'Capa tectónica PB2002', 'Límites definidos frente a deformación difusa', 'plates', [
    ['Sólido', 'La línea roja intensa y continua representa límites de placa del modelo global PB2002: dorsales, transformantes y segmentos convergentes.'],
    ['Discontinuo', 'La línea roja oscura y discontinua representa orógenos o zonas de deformación ancha. En Mediterráneo, Magreb y Asia central evita fingir una precisión que el modelo no posee.'],
  ], ['PB2002 es un modelo global generalizado.', 'No incluye todas las fallas activas locales.', 'Gibraltar requiere cartografía regional del IGN para más detalle.'], [IGN_ALBORAN, IGN_BETICAS]),
  chapter('history-codes', 'Episismic', 'Códigos del historial', 'A/R, tipo de magnitud e intensidad romana', 'intensity', [
    ['Estado', 'A significa automático y R revisado. La abreviatura ML, mb, mbLg, Ms o Mw identifica el método de magnitud, no una categoría de peligro.'],
    ['Intensidad', 'Cuando la fuente proporciona MMI o intensidad observada, se muestra I–XII. Si no existe, aparece un guion; Episismic no deriva un número romano inventado a partir de magnitud.'],
  ], ['Profundidad siempre se expresa aparte en kilómetros.', 'La fuente y sus catálogos figuran en la misma fila.', 'Las fichas ofrecen más contexto que el símbolo.'], [COMCAT, USGS_MMI]),
  chapter('sqlite-archive', 'Episismic', 'Archivo SQLite local', 'Persistencia científica dentro del navegador', 'catalogue', [
    ['Modelo', 'Eventos, revisiones, fuentes y estaciones se guardan en SQLite WebAssembly y se persisten mediante almacenamiento del navegador. Esto permite consultas y continuidad sin un servidor de cuenta.'],
    ['Privacidad', 'La base pertenece al navegador y dispositivo actual. Borrar datos del sitio elimina esa copia; no constituye un respaldo compartido ni un archivo oficial.'],
  ], ['La fuente original sigue siendo la autoridad.', 'Las consultas históricas se limitan para proteger rendimiento.', 'Una versión descargable podrá reutilizar el mismo esquema.'], [COMCAT, FDSN]),
  chapter('performance', 'Episismic', 'Rendimiento y niveles de detalle', 'Miles de datos sin bloquear la interfaz', 'catalogue', [
    ['Clustering', 'MapLibre agrupa terremotos, estaciones y volcanes en Web Workers. Los códigos individuales aparecen solo cuando el zoom ofrece espacio suficiente.'],
    ['Historial', 'El mapa conserva todo el conjunto de la ventana, mientras la lista representa los registros más recientes para evitar miles de nodos DOM. Filtros y búsquedas no destruyen la base.'],
  ], ['7 y 30 días usan agrupación espacial.', 'Los iconos son símbolos WebGL, no miles de elementos HTML.', 'Las teselas evitan ampliar una textura mundial fija.'], [COMCAT, NATURAL_EARTH]),
  chapter('data-ethics', 'Episismic', 'Autoridad, licencia y prudencia', 'Mostrar datos sin convertirlos en falsa alarma', 'alert', [
    ['Atribución', 'Cada evento enlaza su registro original y conserva catálogos participantes. Estaciones, volcanes, tectónica y cartografía mantienen atribución de sus proveedores.'],
    ['Uso', 'Episismic es una herramienta informativa y educativa. Para decisiones de protección civil se deben seguir organismos oficiales; una animación de ondas no es un pronóstico de llegada certificado.'],
  ], ['No se fabrican detecciones para igualar un contador externo.', 'Los datos automáticos pueden cambiar.', 'La ausencia de un punto no demuestra ausencia de movimiento.'], [COMCAT, EMSC, GEOFON, READY]),
];

export const encyclopediaCategories = [...new Set(encyclopediaChapters.map((item) => item.category))];
