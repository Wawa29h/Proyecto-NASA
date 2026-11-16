/* Traducción de presentación. No cambia archivos, valores ni claves científicas. */
(() => {
  "use strict";
  const pairs = [
    ["Información científica no disponible","Scientific information unavailable"],
    ["No hay una interpretación regional validada para las fechas seleccionadas.","No validated regional interpretation is available for the selected dates."],
    ["La comparación visual no demuestra una causa. Consulta la procedencia y la comparabilidad de las observaciones.","The visual comparison does not establish a cause. Check the provenance and comparability of the observations."],
    ["Cuantificación no disponible","Quantification unavailable"],
    ["Observación sin control de calidad suficiente.","Observation has insufficient quality control."],
    ["Metadatos de procedencia incompletos.","Provenance metadata are incomplete."],
    ["Hay rellenos temporales u orbitales sin una máscara completa que permita excluirlos.","Temporal or orbital fills cannot be excluded because a complete mask is unavailable."],
    ["Hay aportes de otras adquisiciones sin una máscara completa que permita excluirlos.","Contributions from other acquisitions cannot be excluded because a complete mask is unavailable."],
    ["No se puede verificar la cobertura observada de ambas fechas.","Observed coverage cannot be verified for both dates."],
    ["La comparación visual es orientativa; no confirma un cambio ambiental.","The visual comparison is indicative; it does not confirm environmental change."],
    ["No hay píxeles válidos comunes entre las dos observaciones.","The observations have no valid pixels in common."],
    ["No se pudieron verificar las imágenes y su soporte comparable.","The images and their comparable support could not be verified."],
    ["Calculando comparación…","Calculating comparison…"],
    ["del área válida común presenta variación HH","of the common valid area shows HH variation"],
    ["La comparación visual se conserva como orientación.","The visual comparison remains available for orientation."],
    ["Ver en la app →","View in the app →"],["← Volver al tutorial","← Back to the tutorial"],
    ["Región:","Region:"],["Modo:","Mode:"],["Vista general","General view"],["Modo científico","Scientific mode"],["MANGLO | Modo Científico","MANGLO | Scientific Mode"],
    ["▶ Tutorial","▶ Tutorial"],["← Inicio","← Home"],["Explora los cambios del agua y del manglar","Explore changes in water and mangroves"],
    ["Mapa interactivo con datos del sitio seleccionado, comparaciones en el tiempo y evidencia del monitoreo.","Interactive map with data for the selected site, comparisons over time and monitoring evidence."],
    ["▣ Fecha actual","▣ Current date"],["◇ Capa activa","◇ Active layer"],["¿Cómo está en esta fecha?","What is happening on this date?"],
    ["⚠ Cobertura y calidad","⚠ Coverage and quality"],["▣ Exploración temporal","▣ Explore over time"],["Una fecha","Single date"],["Antes / después","Before / after"],["Cambios","Changes"],["Radar vs foto","Radar vs photo"],
    ["Falso color","False color"],["Agua / manglar inundado","Water / flooded vegetation"],["IA: plantas","AI: plants"],["📷 Reconstrucción visual (IA)","📷 AI visual reconstruction"],["📷 Como foto (IA)","📷 AI photo-like view"],
    ["▶ Animar","▶ Play"],["❚❚ Pausa","❚❚ Pause"],["Reproducir","Play"],["Fecha","Date"],["Selección temporal","Time selection"],["Antes","Before"],["Después","After"],["Comparación temporal","Time comparison"],["Comparar dos fechas","Compare two dates"],
    ["Seca vs lluviosa","Dry vs rainy season"],["Umbral","Threshold"],["Opacidad","Opacity"],["Capa","Layer"],["Capas NISAR","NISAR layers"],["▥ Resultados","▥ Results"],["♧ Detecciones y avisos","♧ Detections and notices"],
    ["? ¿Por qué pudo ocurrir?","? Why might this have happened?"],["⚗ Información científica","⚗ Scientific information"],["Principales hallazgos del sitio y series temporales.","Main findings and time series for this site."],
    ["Disponibilidad, detecciones y advertencias de calidad.","Availability, detections and data quality warnings."],["Explicaciones posibles y evidencia para las fechas seleccionadas.","Possible explanations and evidence for the selected dates."],
    ["Métodos, fuentes, validación y acceso a datos o descargas.","Methods, sources, validation and access to data and downloads."],["Ver más detalle →","View more detail →"],["Ver más detalle","View more detail"],
    ["▥ Resultados · Ver más detalle","▥ Results · More detail"],["Cerrar detalle","Close detail"],["Agua / área inundada","Water / flooded area"],["Manglar","Mangroves"],["Otros resultados","Other results"],["Gráfica","Chart"],
    ["Agua, vegetación y lluvia","Water, vegetation and rainfall"],["Vegetación del embalse","Reservoir vegetation"],["Nivel y temperatura del agua","Water level and temperature"],
    ["Historia del manglar","Mangrove history"],["Comparación entre manglares","Mangrove comparison"],["HH / HV medios del área válida","Mean HH / HV over the valid area"],["HV por cobertura","HV by land cover"],
    ["HH del punto seleccionado","HH at the selected point"],["Validación del modelo de plantas","Plant model validation"],["Índices ópticos del agua","Optical water indices"],["Cosecha de caña por mes","Sugarcane harvest by month"],["Quemas por semana","Burned area by week"],
    ["▱ Interpretación","▱ Interpretation"],["▦ Datos de la gráfica","▦ Chart data"],["Fecha / período","Date / period"],["Variable","Variable"],["Valor","Value"],["Unidad","Unit"],["Sin dato","No data"],
    ["Mismas series visibles y valores fuente que la gráfica","The same visible series and source values as the chart"],["↓ Exportar","↓ Export"],["Incluir en CSV:","Include in CSV:"],["Datos de la gráfica y tabla","Chart and table data"],
    ["Metadatos ampliados de calidad","Additional quality metadata"],["Región, variable, unidad y fuente se conservan siempre.","Region, variable, unit and source are always included."],["SVG no disponible","SVG unavailable"],
    ["La gráfica actual se dibuja en canvas; SVG vectorial no disponible","This chart uses canvas; vector SVG export is unavailable"],["Gráfica activa descargada en PNG.","Active chart downloaded as PNG."],["No se pudo generar la imagen PNG.","The PNG image could not be generated."],
    ["No disponible para esta región o selección.","Unavailable for this region or selection."],["No hay una gráfica disponible para esta selección.","No chart is available for this selection."],["Cargando resultados…","Loading results…"],["Cargando observaciones del sitio…","Loading site observations…"],
    ["Cargando calidad…","Loading quality information…"],["Cargando disponibilidad de avisos…","Loading notice availability…"],["Calidad de la observación","Observation quality"],["Calidad no disponible.","Quality information unavailable."],
    ["No hay un producto de alertas zonales publicado para esta región. Las detecciones históricas disponibles se conservan en Resultados.","No zonal alert product has been published for this region. Available historical detections are retained under Results."],
    ["No hay datos suficientes para mostrar una evaluación zonal en esta fecha.","There is not enough data for a zonal assessment on this date."],["Los metadatos ausentes no se interpretan como cobertura completa.","Missing metadata does not imply full coverage."],
    ["El pulso del estero","The estuary's pulse"],["Indicadores del área de estudio","Study area indicators"],["La presión de al lado: la caña","Pressure nearby: sugarcane"],["30 años, el mismo manglar","30 years of mangrove history"],
    ["Carbono azul","Blue carbon"],["Estanques junto al manglar","Ponds near the mangroves"],["Dos manglares, mismo radar","Two mangroves, the same radar"],["IA: el radar aprende a ver el manglar","AI: radar learns to recognize mangroves"],
    ["Toca un punto del mapa","Select a point on the map"],["Análisis por punto","Point analysis"],["Ver datos en tabla accesible","View data in an accessible table"],["Análisis científico detallado","Detailed scientific analysis"],
    ["Explora indicadores, series temporales, clasificación, validación y resultados del monitoreo satelital.","Explore indicators, time series, classification, validation and satellite monitoring results."],
    ["Para elegir una gráfica aquí, abre también Resultados. Puedes descargar cada gráfica directamente desde Ver más detalle.","To choose a chart here, also expand Results. You can download individual charts directly from View more detail."],
    ["↓ Serie NISAR del sitio (CSV)","↓ Site NISAR series (CSV)"],["↓ Descargar datos CSV","↓ Download CSV data"],["↓ Descargar PNG","↓ Download PNG"],["⛰ Ver en 3D","⛰ View in 3D"],["🌍 Ver el planeta","🌍 View the planet"],
    ["¿Qué estoy viendo?","What am I looking at?"],["Metodología y fundamentos científicos","Methodology and scientific background"],["Leyenda · capa activa","Legend · active layer"],["Foto Sentinel-2","Sentinel-2 photo"],["Mapa ESA WorldCover","ESA WorldCover map"],
    ["Plantas (Sentinel-2)","Plants (Sentinel-2)"],["☁ Día nublado","☁ Cloudy day"],["Manglar 1996 → 2020 + presión de hoy","Mangroves 1996 → 2020 + present-day pressure"],["Altura del manglar","Mangrove height"],["Estanques","Ponds"],
    ["🤖 IA: mapa del radar","🤖 AI: radar-derived map"],["Caña: mes de cosecha","Sugarcane: harvest month"],["Caña: cosecha vista por radar","Sugarcane: radar-detected harvest"],["🔥 Quemas: cuándo","🔥 Burns: when"],["Quemada vs cortada en verde","Burned vs green-cut"],
    ["¿Qué cambió de verdad? Verlo pintado →","What changed? Show the change map →"],["¿Qué hay en realidad?","What is there on the ground?"],["Validación con imágenes de referencia","Validation with reference imagery"],
    ["Oscuro = agua lisa","Dark = smooth water"],["Verde-amarillo = árboles, manglar, plantas","Yellow-green = trees, mangroves, plants"],["Morado = suelo descubierto o cultivo cosechado","Purple = bare soil or harvested crops"],["Rosado claro = casas o manglar con agua debajo","Light pink = buildings or mangroves with water underneath"],
    ["Agua abierta","Open water"],["Vegetación inundada (doble rebote)","Flooded vegetation (double bounce)"],["Plantas sobre el agua (posible lirio)","Plants on water (possibly water hyacinth)"],["Mar","Sea"],
    ["R = HH (rugosidad, doble rebote)","R = HH (roughness, double bounce)"],["G = HV (volumen: hojas y ramas)","G = HV (volume: leaves and branches)"],["B = HH/HV (superficie lisa)","B = HH/HV (smooth surface)"],
    ["Reconstrucción por IA, no es una foto real.","AI reconstruction, not a real photograph."],["Una red neuronal convierte el radar de ese día en una imagen parecida a una foto satelital. Sirve para ver formas (agua, manglar, parcelas) aunque esté nublado, no para medir colores.","A neural network turns that day's radar into a satellite-photo-like image. It helps visualize shapes (water, mangroves, fields) even under clouds; it must not be used to measure colors."],
    ["Plantas sobre el agua según NISAR + IA (más intenso = más seguro)","Plants on water according to NISAR + AI (stronger color = higher model confidence)"],
    ["Comparado con el resto del año medido. Mueve la fecha y el semáforo cambia.","Compared with the rest of the observed year. Change the date to update the indicators."],
    ["menos agua libre que de costumbre","less open water than usual"],["normal para el año","typical for the observed year"],["más agua libre","more open water"],["mucho: típico de lluvias","high: typical of the rainy season"],
    ["poco: típico de la época seca","low: typical of the dry season"],["intermedio","intermediate"],["poca lluvia","low rainfall"],["lluvia moderada","moderate rainfall"],["mucha lluvia","high rainfall"],
    ["pocas, como en verano","low, as in the dry season"],["en un nivel medio del año","mid-range for the observed year"],["muchas: de lo más alto del año","high: near the upper end of the observed year"],["poca: más superficie tapada o más baja","low: more covered surface or lower water level"],["mucha agua libre","high open-water area"],
    ["bajo: posible época seca o mayor descarga; confirmar con registros de la presa","low: possible dry season or higher discharge; confirm with dam operation records"],["nivel medio","mid-range level"],["alto: embalse lleno","high: reservoir full"],["fresca para el año","cool for the observed year"],["normal","typical"],["caliente: favorece a las plantas","warm: favorable to plant growth"],
    ["Agua del estero km²","Estuary water km²"],["Agua de la bahía km²","Bay water km²"],["Manglar inundado km²","Flooded mangroves km²"],["Agua abierta del embalse km²","Reservoir open water km²"],["Superficie con plantas (NISAR) km²","Vegetated surface (NISAR) km²"],
    ["Agua del estero","Estuary water"],["Agua de la bahía","Bay water"],["Manglar con agua debajo","Mangroves with water underneath"],["Lluvia (12 días antes)","Rainfall (previous 12 days)"],["Plantas sobre el agua","Plants on water"],["Nivel del agua","Water level"],["Temperatura del agua","Water temperature"],
    ["pasadas NISAR","NISAR observations"],["km² de agua abierta","km² of open water"],["Época seca","Dry season"],["Época de lluvias","Rainy season"],["ÉPOCA SECA CONTRA ÉPOCA DE LLUVIAS","DRY SEASON VS RAINY SEASON"],
    ["seca","dry"],["lluviosa","rainy"],["foto","photo"],["Plantas","Plants"],["Cultivo","Cropland"],["Bosque","Forest"],["Pasto","Grassland"],["Agua","Water"],["Suelo desnudo","Bare soil"],
    ["Ver cuándo se cosecha →","View harvest timing →"],["Ver lo que detecta el radar →","View radar detections →"],["Ver dónde se perdió y ganó →","View losses and gains →"],["Ver la altura de los árboles →","View tree height →"],["Ver los estanques en el mapa →","View ponds on the map →"],
    ["Ver el mapa de la IA →","View the AI map →"],["Ver el radar como foto →","View AI visual reconstruction →"],["▶ Ver la zafra quemarse","▶ Animate harvest-season burns"],["Ver quemas en el mapa →","View burns on the map →"],["Quemada vs cortada en verde →","Burned vs green-cut →"],
    ["Comparado con el resto del año en la misma zona.","Compared with the rest of the year in the same zone."],["Avisos experimentales de vegetación sobre agua por zonas","Experimental floating vegetation notices by zone"],["Aviso de vegetación flotante por zonas","Floating vegetation notices by zone"],["Alerta de lirio por zonas","Floating vegetation notices by zone"],["📋 Copiar mensaje","📋 Copy message"],["Ese día llovía","It was raining that day"],["Verlo en el mapa →","View on the map →"],
    ["Mensaje corto para compartir con pescadores, cooperativas o la alcaldía. Zonas aproximadas; el nivel se compara con el resto del año en la misma zona. Dato experimental: confirmar en el lugar.","A short message to share with fishers, cooperatives or local authorities. Zones are approximate; levels are relative to the rest of the year in each zone. Experimental result: confirm on site."],
    ["El embalse visto por 5 misiones","The reservoir seen by five missions"],["Plantas sobre el agua: NISAR (radar, cada 12 días, con nubes o sin ellas) vs Sentinel-2 (foto, solo días despejados).","Plants on water: NISAR (radar, every 12 days, with or without clouds) vs Sentinel-2 (optical imagery on clear days only)."],
    ["Nivel del agua (SWOT) y temperatura de la superficie del agua de día (ECOSTRESS).","Water level (SWOT) and daytime water surface temperature (ECOSTRESS)."],
    ["El manglar está estable, pero tiene presión al lado: cañales que se cosechan y se queman en la zafra (noviembre–mayo). Así se vigila esa presión año con año.","The mangrove is stable, but faces pressure nearby: sugarcane fields are harvested and burned during the harvest season (November–May). This pressure can be monitored year by year."],
    ["Hectáreas quemadas por semana de la zafra. Cada quema se ubica entre dos fotos despejadas seguidas: la última donde la parcela estaba verde y la primera donde ya estaba quemada.","Hectares burned per harvest-season week. Each burn is dated between consecutive clear images: the last showing a green field and the first showing it burned."],
    ["Cultivos según el mapa ESA (en esta planicie son sobre todo caña). Cosecha: caída fuerte del verdor en las fotos Sentinel-2 y de la señal del radar NISAR.","Cropland according to the ESA map (mostly sugarcane on this plain). Harvest: a sharp drop in Sentinel-2 greenness and NISAR radar signal."],
    ["Antes de NISAR, satélites japoneses con radar en banda L (el mismo tipo) mapearon los manglares del mundo desde 1996. Unimos ese registro con NISAR.","Before NISAR, Japanese satellites using the same L-band radar type mapped the world's mangroves from 1996 onward. We combine that record with NISAR."],
    ["El radar encuentra agua quieta con forma","Radar detects still water with a"],["rectangular","rectangular shape"],["(la naturaleza no hace rectángulos): camaroneras y salineras. Es lo que el ser humano construye junto al manglar.","(a geometric indicator): shrimp and salt ponds built next to mangroves."],
    ["Mínimo detectado: estanques pegados entre sí, separados por bordos de menos de 20 m, el radar los ve como una sola mancha y no los cuenta.","Minimum detected: adjacent ponds separated by levees narrower than 20 m can appear as a single patch and are not counted separately."],
    ["Barra de Santiago y la Bahía de Jiquilisco vistos por NISAR en las mismas 13 fechas. La señal HV mide la estructura del bosque: si se tala, cae de golpe.","Barra de Santiago and Bahía de Jiquilisco observed by NISAR on the same 13 dates. HV relates to forest structure: clearing can cause an abrupt drop."],
    ["Los días despejados, Sentinel-2 marca dónde hay plantas sobre el agua. Con esas \"respuestas\" entrenamos un modelo (Random Forest) que aprende cómo se ven esas plantas en el radar NISAR. Así se detectan también en días nublados.","On clear days, Sentinel-2 identifies plants over water. We use those labels to train a Random Forest model to recognize their NISAR radar signature, including on cloudy days."],
    ["Entrenamos dos redes neuronales solo con el radar NISAR. Aprendieron en otros lugares y aquí las ponemos a prueba.","We trained two neural networks using NISAR radar alone. They learned in other locations and are tested here."],
    ["NDCI ≈ clorofila/algas · NDTI ≈ turbidez/sedimento. Mediana sobre el agua abierta sin nubes. Son índices relativos: sirven para comparar fechas, no son mg/L.","NDCI ≈ chlorophyll/algae · NDTI ≈ turbidity/sediment. Medians over cloud-free open water. These are relative indices for comparison across dates, not mg/L concentrations."],
    ["HV mediana (dB) de cada tipo de cobertura según el mapa ESA WorldCover 2021. El manglar debe mantenerse alto todo el año; el cultivo baja cuando se cosecha.","Median HV (dB) for each ESA WorldCover 2021 land-cover class. Mangrove signal is expected to remain high through the year; crop signal drops after harvest."],
    ["Toca el estero, el manglar o un cultivo y verás su señal de radar en cada fecha.","Select the estuary, mangroves or cropland to see its radar signal on each observation date."],
    ["Promedios de los píxeles válidos de cada observación. No son mediciones exclusivas del manglar ni del punto seleccionado.","Averages over the valid pixels of each observation. They are not exclusive to mangroves or to the selected point."],
    ["La gráfica muestra la evolución de las observaciones disponibles. Una variación no confirma por sí sola una causa; consulta las fuentes y la calidad.","The chart shows the available observations over time. A change alone does not establish a cause; consult the sources and data quality."],
    ["Los cambios observados no demuestran por sí solos una causa","Observed changes alone do not establish a cause"],["Las clasificaciones y los umbrales son aproximados. Los cambios observados no demuestran por sí solos una causa; consulta el README para conocer las limitaciones de los datos. Datos: productos NISAR L2 GCOV de ASF DAAC.","Classifications and thresholds are approximate. Observed changes alone do not establish a cause; consult the README for data limitations. Data: NISAR L2 GCOV products from ASF DAAC."],
    ["Selecciona","Select"],["o","or"],["para consultar la interpretación existente del par. Si no hay evidencia suficiente, la plataforma lo indicará.","to consult the existing interpretation for that pair. The platform will indicate when evidence is insufficient."],
    ["Información científica pendiente:","Scientific interpretation pending:"],["Resultado no comparable directamente:","Result not directly comparable:"],["No comparable:","Not comparable:"],["Datos simulados (prueba)","Simulated data (test)"],["Pendiente de reglas validadas.","Validated rules are still required."],
    ["Vigilando los manglares de El Salvador desde el espacio","Monitoring El Salvador's mangroves from space"],["Ese punto dorado es","That golden point is"],[", el radar de NASA e ISRO. Da una vuelta a la Tierra cada 99 minutos y ve a través de las nubes, de día y de noche.",", NASA and ISRO's radar satellite. It orbits Earth every 99 minutes and sees through clouds, day and night."],
    ["Comenzar","Start"],["Saltar","Skip"],["Explorar por mi cuenta","Explore on my own"],["▶ Ver el recorrido guiado","▶ Start the guided tour"],["El agua de El Salvador, vista por un radar que atraviesa las nubes","El Salvador's water, seen by radar that penetrates clouds"],
    ["NISAR, el nuevo satélite de NASA e ISRO, mira la Tierra cada 12 días aunque esté nublado o sea de noche. Lo juntamos con otras misiones para ver cómo cambian un embalse y un manglar durante un año, y qué parte es la naturaleza y qué parte somos nosotros.","NISAR, NASA and ISRO's new satellite, observes Earth every 12 days, even under clouds or at night. We combine it with other missions to explore a year of changes in a reservoir and mangroves, considering natural and human influences."],
    ["El problema:","The challenge:"],["Control:","Comparison:"],["lirio acuático que crece en lluvias, cuando las nubes no dejan verlo · alerta por zonas","water hyacinth growth during the rainy season, when clouds obscure optical imagery · zonal alerts"],["manglar estable, comprobado con el mapa oficial de la ESA","stable mangroves, compared with the ESA reference map"],["el manglar más grande del país, igual de estable","the country's largest mangrove area, also stable"],
    ["El radar revela lo invisible","Radar reveals the invisible"],["Mapas NISAR, comparación por fecha y datos de 5 misiones.","NISAR maps, date comparisons and data from five missions."],["Ver las gráficas","View charts"],
    ["El agua de El Salvador","El Salvador's water"],["Fuente:","Source:"],["Archivo:","File:"],["Selección del mapa:","Map selection:"],["Serie completa disponible","Full available series"],
    ["La tabla y el CSV incluyen las series visibles; los huecos no son ceros. Las misiones conservan sus fechas propias.","The table and CSV include the visible series; gaps are not zero values. Each mission retains its own observation dates."],
    ["Indicadores ópticos del agua","Optical water indicators"],["Validación: firma de radar por cobertura","Validation: radar signature by land cover"],["Firma de radar por cobertura","Radar signature by land cover"],["Clasificación mediante inteligencia artificial","Artificial intelligence classification"],
    ["MANGLO · Modo científico","MANGLO · Scientific mode"],["Cerrar recorrido","Close tour"],["Siguiente →","Next →"],["← Atrás","← Back"],["HH medio (dB)","Mean HH (dB)"],["HV medio (dB)","Mean HV (dB)"],
    ["Manglar (mapa ESA)","Mangroves (ESA map)"],["Pérdida en el año *","Annual signal loss *"],["Rango de HV observado en el año","Observed annual HV range"],["Manglar con agua debajo","Mangroves with water underneath"],
    ["Precisión","Precision"],["Exhaustividad","Recall"],["Clase","Class"],["Indicador","Indicator"],["Lectura:","Interpretation:"],["Hipótesis:","Hypothesis:"],["Agua abierta:","Open water:"],["Manglar inundado:","Flooded mangroves:"],
    ["banda L","L band"],["rugosidad","roughness"],["humedad","moisture"],["negra","black"],["doble rebote","double bounce"],["Bajo","Low"],["Medio","Medium"],["Alto","High"],
    ["Gráfica que deseas exportar","Chart to export"],["Gráfica del detalle","Detail chart"],["Capa activa","Active layer"],["Seleccionar región de estudio","Select study region"],["Línea temporal de observaciones radar NISAR","NISAR radar observation timeline"],
    ["Fecha inicial para comparación","First comparison date"],["Fecha posterior para comparación","Second comparison date"],["Umbral de cambio en decibelios","Change threshold in decibels"],["Opacidad de la capa radar","Radar layer opacity"],
    ["Gráfica de series temporales de agua y vegetación observadas por NISAR","NISAR water and vegetation time-series chart"],["Tabla de datos del resultado","Result data table"],["Grupo de resultados","Result group"],["Leyenda de la capa activa","Active layer legend"],
    ["Reconstrucción visual (IA)","AI visual reconstruction"],["No es una fotografía real.","This is not a real photograph."],
    ["sin dato cercano a esta fecha","no observation close to this date"],["Lluvia (mm)","Rainfall (mm)"],["Lluvia (Open-Meteo mm)","Rainfall (Open-Meteo mm)"],["Entrada del Lempa","Lempa inlet"],["Entrada del río Lempa","Lempa River inlet"],["Norte","North"],["Centro","Center"],["Brazo sur","Southern arm"],["Brazo sur y este (Suchitoto – Cabañas)","Southern and eastern arm (Suchitoto – Cabañas)"],
    ["Bajó la señal: agua nueva o pérdida de vegetación","Signal decreased: new water or vegetation loss"],["Subió la señal: inundación bajo el manglar, rebrote o cultivo","Signal increased: flooding beneath mangroves, regrowth or crops"],
    ["Barras: lluvia de 12 días antes de cada pasada (Open-Meteo). Líneas: áreas medidas por NISAR.","Bars: rainfall in the 12 days before each observation (see the source in the legend). Lines: NISAR-derived areas."],
    ["(NASA + ISRO) es un radar: manda su propia energía de microondas, así que ve de día, de noche y con nubes. Pasa por aquí cada 12 días.","(NASA + ISRO) is a radar satellite: it emits its own microwave energy, so it observes day and night and through clouds. It revisits this area every 12 days."],
    ["(24 cm) atraviesa las copas y llega a los troncos y al agua. Lo que regresa depende de la","(24 cm) penetrates the canopy and interacts with trunks and water. The returning signal depends on"],
    ["es como un espejo: el pulso rebota lejos y se ve","acts like a mirror: the pulse reflects away from the sensor and appears"],
    [": el pulso rebota agua → tronco → radar (",": the pulse bounces water → trunk → radar ("],
    [") y en HH brilla muchísimo.",") and appears very bright in HH."],
    ["mide la dispersión en volumen (ramas y hojas): sirve para la estructura y la biomasa del bosque.","measures volume scattering (branches and leaves), which relates to forest structure and biomass."],
    ["en la época lluviosa (mayo–octubre) los ríos Cara Sucia y Paz suben y el área de manglar con doble rebote debe crecer. En la seca (noviembre–abril) se reduce y el agua queda en el canal del estero. Los cambios bruscos fuera de ese ritmo pueden venir de tala, camaroneras, quemas de caña o azolve de la bocana.","during the rainy season (May–October), the Cara Sucia and Paz rivers rise and the mangrove area showing double bounce is expected to increase. In the dry season (November–April), it decreases and water remains in the estuary channel. Abrupt changes outside that pattern may relate to clearing, shrimp ponds, sugarcane burns or sedimentation at the inlet."],
    ["los dos manglares suben juntos 3–4 dB en lluvias (hojas y suelo mojados: es natural) y la pérdida es casi cero. Están estables este año: buena noticia para el ecosistema y una línea base para detectar talas futuras. Las amenazas al manglar son lentas y se verán con varios años de NISAR.","both mangroves show a 3–4 dB rise during rains (wet leaves and soil: a natural process) and the loss indicator is close to zero. They appear stable this year, providing a baseline for future monitoring. Slow threats require several years of NISAR observations."],
    ["Este es el embalse Cerrón Grande","This is Cerrón Grande Reservoir"],["Es el lago artificial más grande de El Salvador: guarda agua del río Lempa, genera electricidad y da de comer a muchas familias pescadoras. Así lo ve el radar NISAR:","It is El Salvador's largest artificial lake: it stores Lempa River water, generates electricity and supports many fishing families. This is how NISAR radar sees it:"],["lo oscuro es agua","dark areas are water"],[", lo verde es vegetación.",", green areas are vegetation."],
    ["Clasificación IA","AI classification"],["El embalse respira","The reservoir breathes"],["¿Naturaleza o ser humano?","Nature or human influence?"],["Una alerta por zonas","An alert by zone"],["Y funciona en otros lugares","And it works in other places"],["La computadora aprendió de las fotos","The model learned from photos"],["El lirio crece cuando más llueve… justo cuando las nubes no dejan verlo.","Water hyacinth grows during heavy rains… just when clouds obscure it."],
    ["Mapa de cobertura · ESA WorldCover 2021","Land cover · ESA WorldCover 2021"],["Más verde claro = árboles más altos. Altura media","Lighter green = taller trees. Mean height"],
    ["El radar aprende de la foto","Radar learns from optical imagery"],["Tabla comparativa de manglares","Mangrove comparison table"],["de los cultivos está a menos de 1 km del manglar","of cropland lies within 1 km of mangroves"],
    ["Tabla accesible de observaciones temporales","Accessible table of temporal observations"],["Calidad de la observación","Observation quality"],["Resultados y documentación del sitio","Site results and documentation"]
  ];
  const exact = new Map(pairs), reverse = new Map(pairs.filter(([a,b]) => a !== b).map(([a,b]) => [b,a]));
  const phrasePatterns = pairs.filter(([a,b]) => a.length >= 7 && a !== b).sort((a,b) => b[0].length-a[0].length).map(([a,b]) => [new RegExp('(?<![\\p{L}\\p{N}_])'+a.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![\\p{L}\\p{N}_])','gu'),b]);
  const fragments = [
    ["Manglar y estero","Mangroves and estuary"],["El manglar más grande de El Salvador","El Salvador's largest mangrove area"],["radar NISAR banda L","NISAR L-band radar"],["Embalse Cerrón Grande","Cerrón Grande Reservoir"],
    ["observaciones admitidas","accepted observations"],["Abre un resultado para conocer su evidencia.","Open a result to review its evidence."],["cobertura no registrada","coverage not recorded"],["aproximado con otra fecha","approximated using another date"],
    ["rellenado desde otra órbita","filled from another orbit"],["borde recortado:","trimmed edge:"],["cobertura","coverage"],["sin escaneo","no radar coverage"],["de otra órbita","from another orbit"],["con la pasada del","using the observation from"],
    ["zonas en nivel alto relativo al período evaluado. Resultado experimental; no es una alerta de emergencia.","zones at a high level relative to the assessed period. Experimental result; not an emergency alert."],
    ["CSV descargado:","CSV downloaded:"],["valores de las series visibles de esta gráfica.","values from the visible series in this chart."],["observaciones con control de calidad.","quality-controlled observations."],
    ["Las líneas muestran las áreas calculadas por NISAR; las barras, la lluvia acumulada en 12 días","Lines show NISAR-derived areas; bars show 12-day accumulated rainfall"],["Son observaciones disponibles, no una serie mensual continua.","These are available observations, not a continuous monthly series."],
    ["No hay evidencia suficiente para proponer una explicación causal automática entre el","There is insufficient evidence to automatically propose a causal explanation between"],
    ["Las variaciones de retrodispersión radar pueden obedecer a múltiples variables (humedad del dosel, nivel de marea, rugosidad superficial o fenología vegetal). Pendiente de reglas validadas.","Radar backscatter variations can have multiple explanations (canopy moisture, tidal level, surface roughness or vegetation phenology). Validated rules are still required."],
    ["Las observaciones del","The observations from"],["no comparten el mismo soporte espacial o temporal.","do not share the same spatial or temporal support."],["La cobertura del barrido difiere significativamente entre","Radar footprint coverage differs significantly between"],["Se requiere una máscara común aprobada por el equipo científico.","A common mask approved by the scientific team is required."],
    ["Diferencia de cobertura del barrido radar:","Radar footprint coverage difference:"],["Soporte espacial no homogéneo:","Non-uniform spatial support:"],["Una o ambas observaciones incorporan rellenos orbitales con desfase temporal (no simultáneos).","One or both observations include orbit fills from different dates (not simultaneous)."],
    ["Los cambios calculados en km² brutos no representan un cambio físico absoluto de toda la cuenca sin una máscara común.","Changes in raw km² do not represent an absolute physical change across the entire basin without a common mask."],
    ["Cambio observado:","Observed change:"],["Evidencia:","Evidence:"],["Confianza:","Confidence:"],["Lluvia 12 d (mm)","12-day rainfall (mm)"],["Nivel del agua SWOT (m)","SWOT water level (m)"],["Temp. agua ECOSTRESS día (°C)","Daytime ECOSTRESS water temperature (°C)"],
    ["NISAR regla fija","NISAR fixed rule"],["Sentinel-2 (foto)","Sentinel-2 (optical)"],["NISAR + IA","NISAR + AI"],["HV del manglar (dB)","Mangrove HV (dB)"],["Manglar (radar JAXA, km²)","Mangroves (JAXA radar, km²)"],["km² con plantas","km² with plants"],
    ["ha quemadas por semana","hectares burned per week"],["km² cosechados","harvested km²"],["a menos de 1 km del manglar","within 1 km of mangroves"],["Modelo","Model"],["Regla fija","Fixed rule"],["NDCI (clorofila)","NDCI (chlorophyll)"],["NDTI (turbidez)","NDTI (turbidity)"],["índice","index"],
    ["Aviso experimental de vegetación sobre agua ·","Experimental notice of vegetation on water ·"],
    ["La zona con mayor vegetación detectada es","The zone with the largest detected vegetation is"],
    ["Dato experimental (IA radar): niveles relativos al año en cada zona, no umbrales oficiales de emergencia. Especie no confirmada en campo.","Experimental data (radar AI): levels relative to the year in each zone, not official emergency thresholds. Species not confirmed in field."],
    ["Atención: nivel ALTO relativo en","Notice: HIGH relative level in"],
    ["km² con lirio","km² classified as water hyacinth"],["km² de vegetación detectada","km² of detected vegetation"],["nivel ${v.level} (relativo al año)","${v.level} level (relative to observed year)"],["% del agua","% of the reference water area"],["nivel alto","high level"],["nivel medio","medium level"],["nivel bajo","low level"],
    ["Dato experimental: confirmar en el lugar.","Experimental result: confirm on site."],["Lirio acuático ·","Water hyacinth ·"],["(satélite NISAR, ve aunque esté nublado)","(NISAR satellite, observes through clouds)"],
    ["La zona con más lirio es","The zone with the largest detected area is"],["Ninguna zona en nivel alto respecto al resto del año.","No zone is at a high level relative to the rest of the year."],["Atención: nivel ALTO en","Notice: HIGH relative level in"],["Precaución con lanchas y redes.","Exercise caution with boats and nets."],["Comparado con la pasada del","Compared with the observation from"],
    ["BAJO","LOW"],["MEDIO","MEDIUM"],["ALTO","HIGH"],["▲ sube","▲ increasing"],["▼ baja","▼ decreasing"],["= igual","= unchanged"],["bajó ≥","decreased ≥"],["subió ≥","increased ≥"],["del área cambió","of the valid area changed"],["entre pasadas","between observations"],
    ["LAS DOS FECHAS SON DE LA","BOTH DATES ARE IN THE"],["(casi igual)","(almost unchanged)"],["Agua del embalse:","Reservoir water:"],["(verde encima del agua, posible lirio)","(green above water, possibly water hyacinth)"],["En la misma época el embalse debería verse parecido: un cambio grande de lirio sí es para avisar.","Within the same season the reservoir is expected to look similar: a large change in detected aquatic vegetation warrants attention."],
    ["subió: posible aporte de lluvias o menor descarga","increased: possible rainfall input or reduced discharge"],["bajó: posible época seca o mayor descarga; confirmar con datos de operación de la presa","decreased: possible dry season or higher discharge; confirm with dam operation records"],
    ["La variación del nivel responde a la lluvia y al uso del agua; para conocer el peso exacto de cada factor hace falta comparar con los registros de operación de la represa.","The level variation responds to rainfall and water use; establishing the precise contribution of each factor requires comparing with dam operation records."],
    ["el indicador de variación de señal radar es de solo","the radar signal variation indicator is only"],["(umbral de caída radar; requiere verificación en campo para confirmar pérdida física)","(radar signal drop threshold; field verification required to confirm physical loss)"],
    ["Sin evaluación disponible para","No assessment available for"],["el radar no cubrió el mínimo del embalse para esta pasada. La ausencia de evaluación no implica ausencia de vegetación.","the radar did not cover the minimum reservoir area for this observation. Absence of assessment does not imply absence of vegetation."],
    ["Aparecen plantas sobre el agua","Aquatic vegetation appears"],["vegetación sobre el agua (posible macrofíta flotante; la especie requiere verificación en campo)","vegetation on water (possible floating macrophyte; species requires field verification)"],["Se concentra donde entra el río Lempa, que trae nutrientes.","It concentrates near the Lempa River inlet, which carries nutrients."],
    ["Un aviso por zonas","A notice by zone"],["cuánta vegetación flotante hay en cada una","how much floating vegetation is detected in each zone"],["no umbrales oficiales de emergencia","not official emergency thresholds"],
    ["un cambio grande en la vegetación detectada merece revisión en campo. Los niveles son relativos al período observado.","a large change in detected vegetation warrants field verification. Levels are relative to the observed period."],
    ["El radar + IA detectó","The radar + AI detected"],["km² de vegetación sobre el agua.","km² of vegetation on water."],
    ["máx. veg. inundada","max. flooded vegetation"],["mín. veg. inundada","min. flooded vegetation"],["plantas sobre el agua","plants on water"],["plantas","plants"],["suelo pelado","bare soil"],["km² de agua abierta","km² of open water"],
    ["Manglar y estero · Ahuachapán, El Salvador · radar NISAR banda L","Mangroves and estuary · Ahuachapán, El Salvador · NISAR L-band radar"],
    ["El manglar más grande de El Salvador · Usulután · radar NISAR banda L","El Salvador's largest mangrove · Usulután · NISAR L-band radar"],
    ["Cerrón Grande · Chalatenango/Cabañas, El Salvador · NISAR + SWOT + ECOSTRESS + GPM + Sentinel-2","Cerrón Grande · Chalatenango/Cabañas, El Salvador · NISAR + SWOT + ECOSTRESS + GPM + Sentinel-2"],
    ["cargando la Tierra…","loading the Earth…"],
    ["Aún no hay capas NISAR procesadas","No NISAR layers have been processed yet"],
    ["Corre en la terminal, dentro de la carpeta del proyecto:","Run in the terminal, inside the project folder:"],
    ["y recarga esta página.","and reload this page."],
    ["Ver más hallazgos","See more findings"],
    ["caña, carbono, IA, 30 años…","sugarcane, carbon, AI, 30 years…"],
    ["de vigilancia del manglar con radar en banda L (JAXA + NISAR)","of mangrove monitoring with L-band radar (JAXA + NISAR)"],
    ["de CO₂ guardadas solo en sus árboles (carbono azul)","of CO₂ stored in its trees alone (blue carbon)"],
    ["del agua del estero que marca el mapa oficial la detecta NISAR","of the estuary water on the official map is detected by NISAR"],
    ["estanques rectangulares junto al manglar, vistos por el radar","rectangular ponds next to the mangroves, seen by the radar"],
    ["En la época de lluvias,","In the rainy season,"],
    ["de las fotos satelitales del embalse Cerrón Grande salen tapadas por nubes, con rachas de hasta","of the satellite photos of the Cerrón Grande reservoir come out covered by clouds, with stretches of up to"],
    ["sin una sola foto despejada. El nuevo radar","without a single clear photo. The new"],
    ["(NASA e ISRO) ve a través de las nubes. Lo juntamos con inteligencia artificial para","radar (NASA and ISRO) sees through clouds. We combined it with artificial intelligence to"],
    ["vigilar el lirio acuático y avisar","monitor water hyacinth and alert"],
    ["de las fotos de época de lluvias salen con el embalse tapado por nubes (en verano:","of rainy-season photos show the reservoir covered by clouds (dry season:"],
    ["de las fotos de lluvias salen con el embalse tapado (en verano:","of rainy-season photos show the reservoir covered (dry season:"],
    ["seguidos sin una foto despejada en lluvias. El radar pasa igual, llueva o no","in a row without a clear photo in the rains. The radar passes anyway, rain or shine"],
    ["seguidos sin una foto despejada","in a row without a clear photo"],
    ["El radar no se detiene","The radar does not stop"],
    ["más lirio en lluvias que en verano (radar + inteligencia artificial)","more water hyacinth in the rains than in the dry season (radar + artificial intelligence)"],
    ["de cultivos (sobre todo caña) alrededor del manglar","of cropland (mostly sugarcane) around the mangroves"],
    ["de esos cultivos está","of that cropland is"],
    ["de los cultivos se cosechó en la zafra 2025–2026","of the cropland was harvested in the 2025–2026 season"],
    ["de lo que el radar vio cortado coincide con las fotos","of what the radar saw as cut matches the photos"],
    ["🔥 Quemas: cuándo y dónde","🔥 Burns: when and where"],
    ["de caña quemada en la zafra 2025–2026","of sugarcane burned in the 2025–2026 harvest"],
    ["Hectáreas quemadas por semana de la zafra. Cada quema se ubica entre dos fotos despejadas seguidas: la última donde la parcela estaba verde y la primera donde ya estaba quemada. La mitad de las quemas quedan fechadas con una ventana de","Hectares burned per harvest week. Each burn is placed between two consecutive clear photos: the last where the field was green and the first where it was already burned. Half of the burns are dated within a window of"],
    ["Quemas más cercanas al manglar (toca una para ir al lugar):","Burns closest to the mangroves (tap one to go there):"],
    ["pegada al manglar","right next to the mangroves"],
    ["🔥 Quemas (NASA FIRMS): el script está listo; falta la llave gratuita de FIRMS para bajar los puntos de fuego.","🔥 Fires (NASA FIRMS): the script is ready; the free FIRMS key is still needed to download the fire points."],
    ["🌡️ De día, el cañal está en promedio","🌡️ By day, the sugarcane field is on average"],
    ["Quemas de caña por semana","Sugarcane burns per week"],
    ["cambio del área 1996–2020: el manglar se ha sostenido","area change 1996–2020: the mangroves have held steady"],
    ["pérdida vista por NISAR en 2025–2026: sigue estable","loss seen by NISAR in 2025–2026: still stable"],
    ["carros circulando un año emiten lo mismo","cars driving for a year emit the same"],
    ["de CO₂ por hectárea, solo en los árboles","of CO₂ per hectare, in the trees alone"],
    ["más carbono guarda el suelo del manglar (no incluido aquí)","more carbon is stored in the mangrove soil (not included here)"],
    ["Fuente: mapa de biomasa y altura de manglares de NASA (Simard et al. 2019, ORNL DAAC). Cálculo: biomasa de árboles + raíces × 0,47 de carbono × 3,67. El suelo no se cuenta, así que el valor real es mayor.","Source: NASA mangrove biomass and height map (Simard et al. 2019, ORNL DAAC). Calculation: tree + root biomass × 0.47 carbon × 3.67. Soil is not counted, so the real value is higher."],
    ["de estanques en total","of ponds in total"],
    ["del manglar perdido desde 1996 está a menos de 300 m de un estanque","of the mangroves lost since 1996 are less than 300 m from a pond"],
    ["Barra de Santiago y la Bahía de Jiquilisco vistos por NISAR en las mismas 13 fechas. La señal HV mide la estructura del bosque: si se tala, cae de golpe.","Barra de Santiago and Jiquilisco Bay seen by NISAR on the same 13 dates. The HV signal measures forest structure: if it is cleared, it drops abruptly."],
    ["* Nota científica: La cifra reportada como 'pérdida' responde al umbral de caída radar (< -3 dB en media de 3 fechas); es un indicador de variación de retrodispersión, no una comprobación de tala física sin verificación en campo.","* Scientific note: the figure reported as 'loss' follows the radar drop threshold (< -3 dB averaged over 3 dates); it is an indicator of backscatter change, not proof of physical clearing without field verification."],
    ["IA: el radar aprende de la foto","AI: the radar learns from the photo"],
    ["acierto reconociendo el manglar en un lugar que la IA nunca vio","accuracy recognizing mangroves in a place the AI never saw"],
    ["acierto reconociendo el manglar (aquí aprendió; la prueba real es Barra)","accuracy recognizing mangroves (it learned here; the real test is Barra)"],
    ["de manglar según la IA (ESA:","of mangroves according to the AI (ESA:"],
    ["del mapa clasificado igual que la ESA","of the map classified the same as ESA"],
    ["error del radar→foto en la zona no usada para entrenar (pintar el color medio:","radar→photo error in the area not used for training (painting the mean color:"],
    ["dibuja el mapa de agua, manglar, árboles y caña usando solo radar: así se puede vigilar cada 12 días aunque esté nublado.","draws the map of water, mangroves, trees and sugarcane using radar only: so it can be monitored every 12 days even when cloudy."],
    ["convierte cada pasada en una imagen parecida a una foto satelital (aproximada, no real).","turns each pass into an image resembling a satellite photo (approximate, not real)."],
    ["Ambos modelos concuerdan en que la señal del manglar se mantiene estable durante el año observado; los mayores cambios de señal se detectan en los bordes (caña, suelos). Esto es consistente con estabilidad, pero no reemplaza verificación en campo.","Both models agree that the mangrove signal stays stable over the observed year; the largest signal changes are detected at the edges (sugarcane, soils). This is consistent with stability, but does not replace field verification."],
    ["U-Net con 10 canales temporales de NISAR (HH, HV). Etiquetas: ESA WorldCover 2021. Entrenada en jiquilisco + cerron (sin su franja este, que sirvió para elegir el modelo); barra solo se usó como prueba final. Mejor modelo tras 15 min en GPU.","U-Net with 10 temporal NISAR channels (HH, HV). Labels: ESA WorldCover 2021. Trained on Jiquilisco + Cerrón (without their eastern strip, used to choose the model); Barra was used only as the final test. Best model after 15 min on GPU."],
    ["Radar→foto: U-Net + PatchGAN (pix2pix), PSNR 22.7 dB en el 20 % este no usado para entrenar (también sirvió para elegir el modelo: algo optimista).","Radar→photo: U-Net + PatchGAN (pix2pix), PSNR 22.7 dB on the eastern 20 % not used for training (also used to choose the model: somewhat optimistic)."],
    ["Color del agua (Sentinel-2)","Water color (Sentinel-2)"],
    ["del agua que ve NISAR cae en agua/manglar del mapa ESA","of the water NISAR sees falls on water/mangroves in the ESA map"],
    ["del agua del estero del mapa la detecta NISAR","of the estuary water on the map is detected by NISAR"],
    ["¿Por qué pudo ocurrir este cambio?","Why might this change have happened?"],
    ["(constante dieléctrica).","(dielectric constant)."],
    ["en el recuadro.","in the box."],
    ["Aquí el radar no pasó este día.","The radar did not pass here on this day."],
    ["Esta parte queda fuera del barrido de la órbita 134. Otra órbita la cubre desde 5 jul 2026.","This part is outside the orbit 134 swath. Another orbit covers it since 5 Jul 2026."],
    ["época de lluvias","rainy season"],
    ["época seca","dry season"],
    ["🟪→🟩 Las parcelas que pasan de","🟪→🟩 Fields that go from"],
    ["(o al revés) son sobre todo","(or the other way) are mostly"],
    [": se corta en la zafra (noviembre a mayo) y vuelve a crecer con la lluvia.",": it is cut during the harvest (November to May) and grows back with the rain."],
    ["(junto al estero) se ve más brillante: con la lluvia las hojas y el suelo mojados rebotan más el radar.","(next to the estuary) look brighter: with rain, wet leaves and soil bounce the radar back more."],
    [", no es que creciera. En el año, el indicador de variación de señal radar es de solo",", not actual growth. Over the year, the radar signal change indicator is only"],
    [". En el año, el indicador de variación de señal radar es de solo",". Over the year, the radar signal change indicator is only"],
    ["El mar cambia de color por el","The sea changes color because of the"],
    ["viento y las olas","wind and waves"],
    [", no porque el agua sea distinta.",", not because the water is different."],
    ["Las dos fechas son de la","Both dates are in the"],
    ["🟪 El paisaje debería verse parecido. Si una mancha","🟪 The landscape should look similar. If a patch"],
    ["dentro del manglar","inside the mangroves"],
    ["pasa de verde a morado, eso sí sería para revisar (posible tala).","turns from green to purple, that would be worth checking (possible clearing)."],
    ["(junto al estero)","(next to the estuary)"],
    ["casi no cambió","barely changed"],
    ["Entre seca y lluvias es normal que el embalse cambie mucho de tamaño.","Between the dry and rainy seasons it is normal for the reservoir to change size a lot."],
    ["· muy oscuro: agua abierta y lisa","· very dark: open, smooth water"],
    ["· oscuro: suelo liso, playa o agua con viento","· dark: smooth soil, beach or wind-roughened water"],
    ["· medio: vegetación o cultivo","· medium: vegetation or crops"],
    ["· muy brillante: doble rebote (manglar inundado o edificio)","· very bright: double bounce (flooded mangroves or buildings)"],
    ["Foto óptica más cercana:","Closest optical photo:"],
    ["Plantas sobre el agua en la foto (NDVI > 0.3):","Plants on the water in the photo (NDVI > 0.3):"],
    ["máx. plantas en agua ·","max. plants on water ·"],
    ["mín. plantas en agua ·","min. plants on water ·"],
    ["máx. plantas (Sentinel-2)","max. plants (Sentinel-2)"],
    ["variación del nivel (SWOT)","level change (SWOT)"],
    ["agua de día (ECOSTRESS)","daytime water (ECOSTRESS)"],
    ["acierto cuando foto y radar están a ≤ 4 días (4 pruebas)","accuracy when photo and radar are ≤ 4 days apart (4 tests)"],
    ["acierto con 5–7 días: las plantas ya se movieron (3 pruebas)","accuracy at 5–7 days: the plants had already moved (3 tests)"],
    ["mejora sobre la regla fija (0.54 vs 0.44)","improvement over the fixed rule (0.54 vs 0.44)"],
    ["Validación honesta: en cada barra el modelo se probó en una fecha que","Honest validation: in each bar the model was tested on a date it"],
    ["al entrenar (7 parejas foto-radar con ≤ 8 días de diferencia). El acierto baja cuando pasan más días entre la foto y el radar: eso indica que las plantas son","while training (7 photo-radar pairs ≤ 8 days apart). Accuracy drops as more days pass between photo and radar: this shows the plants are"],
    ["flotantes y se mueven","floating and move"],
    ["con el viento y la corriente. Lo que más usa el modelo: HH rel. agua, HV rel. agua, HV. Prueba de concepto con un año de datos.","with wind and current. What the model uses most: HH rel. water, HV rel. water, HV. Proof of concept with one year of data."],
    ["(relativo al año)","(relative to the year)"],
    ["Entrada del río Lempa","Lempa River inlet"],
    ["nivel BAJO","level LOW"],
    ["nivel MEDIO","level MEDIUM"],
    ["nivel ALTO","level HIGH"],
    ["Entrada del Lempa","Lempa inlet"],
    ["Norte (Chalatenango)","North (Chalatenango)"],
    ["Centro del embalse","Reservoir center"],
    ["Brazo sur y este (Suchitoto – Cabañas)","South and east arm (Suchitoto – Cabañas)"],
    ["Brazo sur","South arm"],
    ["• Norte:","• North:"],
    ["• Centro:","• Center:"],
    ["Arrastra sobre la imagen: a la izquierda la","Drag over the image: on the left the"],
    ["de ese día (100 % del embalse tapado por nubes); a la derecha el","from that day (100 % of the reservoir covered by clouds); on the right the"],
    [", con las plantas que encontró la inteligencia artificial en amarillo.",", with the plants found by the artificial intelligence in yellow."],
    ["En la misma época el embalse debería verse parecido: un cambio grande en la vegetación detectada merece revisión en campo. Los niveles son relativos al período observado.","Within the same season the reservoir should look similar: a large change in detected vegetation warrants field checking. Levels are relative to the observed period."]
  ].sort((a,b) => b[0].length-a[0].length);
  // palabras sueltas: solo cuando el texto es exactamente eso (si no, "manglar" dañaría "manglares")
  [["Plantas sobre el agua en la foto (NDVI > 0.3):", "Plants on the water in the photo (NDVI > 0.3):"], ["Manglar y estero · Ahuachapán, El Salvador · radar NISAR banda L", "Mangroves and estuary · Ahuachapán, El Salvador · NISAR L-band radar"], ["de vigilancia del manglar con radar en banda L (JAXA + NISAR)", "of mangrove monitoring with L-band radar (JAXA + NISAR)"], ["🔥 Quemas: cuándo y dónde", "🔥 Burns: when and where"], ["Hectáreas quemadas por semana de la zafra. Cada quema se ubica entre dos fotos despejadas seguidas: la última donde la parcela estaba verde y la primera donde ya estaba quemada. La mitad de las quemas quedan fechadas con una ventana de", "Hectares burned per harvest week. Each burn is placed between two consecutive clear photos: the last where the field was green and the first where it was already burned. Half of the burns are dated within a window of"], ["y el", "and"], ["Fuente: mapa de biomasa y altura de manglares de NASA (Simard et al. 2019, ORNL DAAC). Cálculo: biomasa de árboles + raíces × 0,47 de carbono × 3,67. El suelo no se cuenta, así que el valor real es mayor.", "Source: NASA mangrove biomass and height map (Simard et al. 2019, ORNL DAAC). Calculation: tree + root biomass × 0.47 carbon × 3.67. Soil is not counted, so the real value is higher."], ["Barra de Santiago y la Bahía de Jiquilisco vistos por NISAR en las mismas 13 fechas. La señal HV mide la estructura del bosque: si se tala, cae de golpe.", "Barra de Santiago and Jiquilisco Bay seen by NISAR on the same 13 dates. The HV signal measures forest structure: if it is cleared, it drops abruptly."], ["El manglar más grande de El Salvador · Usulután · radar NISAR banda L", "El Salvador's largest mangrove · Usulután · NISAR L-band radar"], ["manglar", "mangroves"], ["árboles", "trees"], ["agua", "water"], ["entre el", "between"], ["y de la", "and of the"], ["o menos.", "or less."], ["Es normal.", "That is normal."], ["Es natural", "It is natural"], ["El manglar", "The mangroves"]].forEach(([es, en]) => { exact.set(es, en); reverse.set(en, es); });
  const numberPatterns = [
    [/Rango en el año: (-?[\d.]+) a (-?[\d.]+) dB/g, "Range over the year: $1 to $2 dB"],
    [/\((\d+) días de diferencia\)\. La foto solo sirve sin nubes; el radar ve siempre\./g, "($1 days apart). The photo only works without clouds; the radar always sees."],
    [/⚠ El (.+?) el radar solo vio el (\d+) % del recuadro: ese número sale más bajo de lo real\./g, "⚠ On $1 the radar only saw $2 % of the box: that number comes out lower than reality."],
    [/▨ ([\d.]+) % de la órbita (\d+) descendente \((\d+) días\)/g, "▨ $1 % from descending orbit $2 ($3 days)"],
    [/perdidas en algunos lugares \(y ([\d,.]+) ha ganadas en otros\)/g, "lost in some places (and $1 ha gained in others)"],
    [/guardadas en los árboles de ([\d,.]+) ha de manglar/g, "stored in the trees of $1 ha of mangroves"],
    [/de la cosecha fue con quema \(el resto, ([\d,.]+) ha, en verde\)/g, "of the harvest used fire (the rest, $1 ha, was green-cut)"],
    [/que el manglar \((\d+) pasadas de NASA ECOSTRESS\)\. El manglar refresca la zona\./g, "than the mangroves ($1 NASA ECOSTRESS passes). The mangroves cool the area."],
    [/altura media de los árboles \(máx\. ([\d.]+) m\)/g, "mean tree height (max. $1 m)"],
    [/(\d+) días entre pasadas/g, "$1 days between passes"],
    [/^(\d+) días$/g, "$1 days"],
    [/El (\d+) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre) la foto no vio nada\. El radar \+ IA detectó ([\d.]+) km² de vegetación sobre el agua\./g, (m, d, mes, km) => `On ${({enero:"January",febrero:"February",marzo:"March",abril:"April",mayo:"May",junio:"June",julio:"July",agosto:"August",septiembre:"September",octubre:"October",noviembre:"November",diciembre:"December"})[mes]} ${d} the photo saw nothing. The radar + AI detected ${km} km² of vegetation on the water.`],
    [/(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/g, (m, d, mes) => `${({enero:"January",febrero:"February",marzo:"March",abril:"April",mayo:"May",junio:"June",julio:"July",agosto:"August",septiembre:"September",octubre:"October",noviembre:"November",diciembre:"December"})[mes]} ${d}`],
  ];

  const trackedText = new WeakMap(), trackedAttrs = new WeakMap();
  let language = "en", scheduled = false;
  // idioma inicial: el que la persona eligió; si nunca eligió, el de su navegador (español si está en español, si no inglés)
  language = (() => { try { const s = localStorage.getItem("manglo-language"); if (s === "es" || s === "en") return s; } catch {} const l = ((navigator.languages && navigator.languages[0]) || navigator.language || "en").toLowerCase(); return l.startsWith("es") ? "es" : "en"; })();
  const canonical = (s) => reverse.get(s) || s;
  function translate(input) {
    const source = canonical(String(input));
    if (language !== "en") return source;
    if (exact.has(source)) return exact.get(source);
    let result = source;
    for (const [re,english] of numberPatterns) result = result.replace(re, english);
    for (const [pattern,english] of phrasePatterns) result=result.replace(pattern,() => english);
    for (const [spanish,english] of fragments) result = result.split(spanish).join(english);
    // Los meses cambian solo como tokens de fecha, nunca dentro de nombres propios.
    const months = {ene:"Jan",feb:"Feb",mar:"Mar",abr:"Apr",may:"May",jun:"Jun",jul:"Jul",ago:"Aug",sept:"Sep",sep:"Sep",oct:"Oct",nov:"Nov",dic:"Dec"};
    result = result.replace(/\b(ene|feb|mar|abr|may|jun|jul|ago|sept|sep|oct|nov|dic)\b(?=\s+\d{2,4})/g, (m) => months[m]);
    result = result.replace(/(\d{4}) a (?=\d)/g,'$1 to ').replace(/(\d{4}) y el (?=\d)/g,'$1 and ');
    return result;
  }
  function visit(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest('script,style,code,.wf-languages,[data-no-translate]')) continue;
      const value = node.nodeValue;
      if (!value.trim()) continue;
      let record = trackedText.get(node);
      if (!record || value !== record.output) record = { source:canonical(value.trim()), prefix:value.match(/^\s*/)[0], suffix:value.match(/\s*$/)[0] };
      const output = record.prefix + translate(record.source) + record.suffix;
      record.output = output; trackedText.set(node, record);
      if (node.nodeValue !== output) node.nodeValue = output;
    }
    root.querySelectorAll('[aria-label],[title],[alt]').forEach((element) => {
      if (element.closest('.wf-languages')) return;
      let records = trackedAttrs.get(element); if (!records) { records={}; trackedAttrs.set(element,records); }
      for (const name of ['aria-label','title','alt']) {
        if (!element.hasAttribute(name)) continue;
        const value = element.getAttribute(name); let record = records[name];
        if (!record || value !== record.output) record = { source:canonical(value) };
        record.output = translate(record.source); records[name] = record;
        if (record.output !== value) element.setAttribute(name,record.output);
      }
    });
    document.documentElement.lang = language;
  }
  function schedule() {
    if (scheduled) return; scheduled = true;
    requestAnimationFrame(() => { scheduled=false; visit(document.body); });
  }
  const controls = document.createElement('div'); controls.className='wf-languages'; controls.setAttribute('role','group');
  controls.innerHTML='<button type="button" data-language="es" lang="es">Español</button><button type="button" data-language="en" lang="en">English</button>';
  document.querySelector('.hdr-actions').appendChild(controls);
  function updateButtons() {
    controls.setAttribute('aria-label',language === 'en' ? 'Page language' : 'Idioma de la página');
    controls.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed',String(button.dataset.language===language)));
  }
  // Traduce leyendas, ejes y tooltips sin modificar las etiquetas fuente ni valores exportados.
  const chartSetup = new WeakSet(), axisTitles = new WeakMap();
  function prepareChart(chart) {
    if (!chartSetup.has(chart)) {
      chartSetup.add(chart);
      const legend = chart.options.plugins?.legend?.labels;
      if (legend) { const generate = legend.generateLabels || Chart.defaults.plugins.legend.labels.generateLabels; legend.generateLabels = (c) => generate(c).map((item) => ({...item,text:translate(item.text)})); }
      const tooltip = chart.options.plugins?.tooltip;
      if (tooltip) {
        const old = tooltip.callbacks.label || Chart.defaults.plugins.tooltip.callbacks.label;
        tooltip.callbacks.label = function (context) { const label=old.call(this,context); return Array.isArray(label) ? label.map(translate) : translate(label); };
      }
      for (const axis of Object.values(chart.options.scales || {})) {
        if (axis.ticks) { const old = axis.ticks.callback; axis.ticks.callback = function (...args) { const label = old ? old.apply(this,args) : this.getLabelForValue(args[0]); return Array.isArray(label) ? label.map(translate) : translate(label ?? ''); }; }
      }
    }
    for (const axis of Object.values(chart.options.scales || {})) {
      if (!axis.title?.text) continue;
      let record=axisTitles.get(axis.title);
      if (!record || axis.title.text !== record.output) record={source:canonical(axis.title.text)};
      record.output=translate(record.source); axis.title.text=record.output; axisTitles.set(axis.title,record);
    }
  }
  if (typeof Chart !== 'undefined') Chart.register({id:'mangloLanguage',beforeUpdate:prepareChart});
  function setLanguage(next) {
    language=next === 'en' ? 'en' : 'es';
    try { localStorage.setItem('manglo-language',language); } catch {}
    updateButtons();
    window.dispatchEvent(new Event('manglo:language'));
    visit(document.body);
    if (typeof Chart !== 'undefined') Object.values(Chart.instances).forEach((chart) => chart.update('none'));
  }
  controls.addEventListener('click',(event) => { const button=event.target.closest('[data-language]'); if (button) setLanguage(button.dataset.language); });
  window.MangloLanguage={translate,get:()=>language,locale:()=>language==='en'?'en-US':'es-SV',refresh:schedule};
  new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title','alt']});
  updateButtons(); schedule();
})();
