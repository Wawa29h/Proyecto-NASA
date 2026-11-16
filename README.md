# MANGLO — NASA Space Apps 2026 · Reto NISAR

**Demo / Live app:** https://manglo-nisar.earth/ (también https://wawa29h.github.io/Proyecto-NASA/)  ·  directo a un sitio: `?site=barra`, `?site=jiquilisco`, `?site=cerron`  ·  interfaz en **español e inglés**.

> ### English summary
> **MANGLO** is an open-source interactive web app that uses the NASA-ISRO **NISAR** L-band radar (L2 GCOV, HH/HV
> polarizations) as its backbone to monitor the **mangroves of El Salvador** — Barra de Santiago (a Ramsar site),
> Bahía de Jiquilisco (the country's largest mangrove) and, as an annex, the Cerrón Grande reservoir — across one
> year (Dec 2025 → Nov 2026), every 12 days, through clouds, day or night.
>
> It separates the **natural rhythm** from **human pressure**. Natural: the mangrove's HV signal rises ~2.5 dB from the
> dry to the rainy season at both sites (wet leaves and soil, not forest change). Human: sugarcane harvested and
> burned right next to the mangrove (902 ha burned in the 2025–26 harvest, 92 % of the harvest by burning, 417 ha
> within 1 km of the mangrove, detected with Sentinel-2 NBR and confirmed by the HV drop in NISAR); rectangular
> shrimp/salt ponds found by radar (42 ponds, 148 ha in Jiquilisco); and the blue carbon at stake (~375,000 t CO₂ in
> Barra, ~3 million t in Jiquilisco, trees only, from NASA's mangrove biomass map).
>
> **Main message:** the mangrove is **stable** (−0.2 % area since 1996 per Global Mangrove Watch, built from JAXA
> L-band radar; 0.02 % loss seen by NISAR in 2025–26). The pressure is around it, and NISAR can watch it every 12 days
> even in the rainy season, when **45 %** of optical images over the site are cloud-covered (longest gap: 15 days).
>
> **Method (validated, honest):** remote block reads of ~7 GB GCOV granules; frame and orbit mosaicking with
> per-pixel provenance shown in the app; a per-date water threshold calibrated against ESA WorldCover; quality control
> (bad dates discarded); validation (NISAR detects 85–91 % of the estuary water in the ESA map). Three AI models with
> held-out validation: **MangroveNet** (U-Net, radar-only land cover; mangrove F1 0.82 on a site never used in
> training), radar → approximate image (pix2pix) for cloudy days, and a Random Forest that detects floating plants
> from radar. A **simple mode** for the public and a **scientific mode** with HH/HV values, validation and CSV/PNG export.
>
> **Data:** NISAR (ASF DAAC), SWOT, ECOSTRESS, GPM IMERG / NASA POWER, NASA mangrove biomass and height (ORNL DAAC),
> Global Mangrove Watch (JAXA), ESA Sentinel-2 and WorldCover. The whole pipeline is parameterized by a bounding box:
> the same scripts run on any mangrove or wetland on Earth. See **Future applications of NISAR** below. MIT license.

App web interactiva que usa el radar **NISAR** (NASA-ISRO, banda L) como eje, junto con otras misiones de
NASA y ESA, para vigilar los **manglares de El Salvador** a lo largo de un año (dic-2025 → nov-2026):
separa el ritmo natural (lluvias) de la presión humana (caña, quemas, estanques). Tiene un modo sencillo
para cualquier persona y un **modo científico** con métricas, validación y exportación CSV/PNG.

**Mensaje principal:** el manglar está estable (30 años de radar banda L lo confirman), la presión está
alrededor, y NISAR lo puede vigilar cada 12 días aunque esté nublado.

| Sitio | Qué se estudia | Misiones |
|---|---|---|
| **Barra de Santiago** (Ahuachapán, sitio Ramsar) · sitio principal | Estero, manglar, caña y quemas alrededor | NISAR, Sentinel-2, ESA WorldCover, Global Mangrove Watch (JAXA), biomasa NASA, ECOSTRESS, lluvia NASA |
| **Bahía de Jiquilisco** (Usulután) · comparación | El manglar más grande del país, estanques de camarón y sal | NISAR (2 órbitas), Sentinel-2, WorldCover, Global Mangrove Watch, biomasa NASA |
| **Embalse Cerrón Grande** (Chalatenango/Cabañas) · anexo | Agua abierta vs lirio, nivel, temperatura, color del agua | NISAR, **SWOT**, **ECOSTRESS**, lluvia NASA (GPM/POWER), Sentinel-2, WorldCover |

## Fuentes de datos

| Fuente | Producto | Para qué |
|---|---|---|
| NASA-ISRO **NISAR** | L2 GCOV (HH, HV), track 134 ascendente, frames 8+9 unidos | Agua, manglar inundado, plantas sobre el agua, cambios cada 12 días |
| NASA/CNES **SWOT** | L2 HR LakeSP vía PO.DAAC Hydrocron | Nivel del agua del embalse (lago PLD 7710076303) |
| NASA **ECOSTRESS** | L2T LSTE v002 (70 m) | Temperatura de la superficie del agua |
| NASA **GPM IMERG** | Late diario v07 (si la cuenta tiene autorizado GES DISC) | Lluvia en la cuenca |
| NASA **POWER** | PRECTOTCORR (respaldo sin login) | Lluvia en la cuenca |
| ESA **Sentinel-2** | L2A (Earth Search, AWS) | Foto real, NDVI (plantas), NDCI (clorofila), NDTI (turbidez) |
| ESA **WorldCover 2021** | Mapa de cobertura 10 m | "Maestro" para calibrar umbrales y validar NISAR |

## Cómo correrlo

```bash
python -m pip install -r requirements.txt               # ver nota de torch dentro del archivo
python scripts/search_granules.py                       # lista de granulos NISAR (sin login)

# Barra de Santiago
python scripts/fetch_reference.py                       # WorldCover + Sentinel-2 (va primero: da la mascara del mar)
python scripts/fetch_gcov.py                            # NISAR (une frames 8+9)
python scripts/fetch_gcov.py --reclassify               # reclasificar sin volver a descargar
python scripts/validate.py                              # comparar NISAR vs WorldCover
python scripts/fetch_rain.py --site barra

# Cerron Grande
python scripts/fetch_reference.py --bbox -89.27 13.93 -88.93 14.13 --out web/data-cerron --lake
python scripts/fetch_gcov.py --bbox -89.27 13.93 -88.93 14.13 --out web/data-cerron --ocean-r 0
python scripts/fetch_gcov.py --bbox -89.27 13.93 -88.93 14.13 --out web/data-cerron --ocean-r 0 --reclassify
python scripts/fetch_swot.py --site cerron
python scripts/fetch_ecostress.py --site cerron
python scripts/fetch_rain.py --site cerron
python scripts/train_radar_from_photo.py --site cerron  # IA: el radar aprende de la foto (~1 min)
python scripts/lirio_alert.py                          # alerta de lirio por 4 zonas + mensaje para compartir
python scripts/cloud_stats.py                          # el problema de las nubes, medido SOBRE el embalse

# Bahia de Jiquilisco (manglar de comparacion; borde con ruido + relleno con otras orbitas)
python scripts/search_granules.py --point "POINT(-88.50 13.25)" --out data/granules_jiquilisco.json
python scripts/fetch_reference.py --bbox -88.70 13.17 -88.30 13.33 --out web/data-jiquilisco --months
python scripts/fetch_gcov.py --granules data/granules_jiquilisco.json --frames 8 --bbox -88.70 13.17 -88.30 13.33 --out web/data-jiquilisco --edge-trim --fill-tracks
python scripts/compare_mangroves.py

# Manglar: historia, carbono, estanques y caña
python scripts/fetch_mangrove_history.py   # Global Mangrove Watch 1996-2020 (radar banda L de JAXA), solo los cuadros necesarios
python scripts/fetch_blue_carbon.py        # carbono azul con el mapa de biomasa y altura de manglares de NASA (ORNL DAAC)
python scripts/detect_ponds.py             # estanques rectangulares (camaroneras/salineras) con NISAR
python scripts/cane.py                     # caña: donde, a que distancia del manglar y en que mes se cosecha (Sentinel-2 + NISAR)
python scripts/fetch_ecostress.py --site barra   # temperatura manglar vs cañal
python scripts/fetch_firms.py              # quemas NASA FIRMS (necesita llave gratuita en FIRMS_MAP_KEY o ~/.firms_key)

# Huecos sin escaneo + redes neuronales (GPU recomendada)
python scripts/fill_gaps.py --site jiquilisco          # rellena huecos con la fecha valida mas cercana (luego --reclassify)
python scripts/train_mangrovenet.py --minutes 15       # MangroveNet: mapa de cobertura solo con radar
python scripts/train_mangrovenet.py --predict-only     # rehacer los mapas con el modelo guardado
python scripts/train_radar2photo.py --minutes 90       # radar -> imagen aproximada tipo Sentinel-2

python -m http.server 5560 --directory web             # abrir http://localhost:5560  (?site=cerron)
```

Login: los scripts leen tu usuario de NASA Earthdata desde `~/.netrc`
(`machine urs.earthdata.nasa.gov login USUARIO password CONTRASEÑA`). La contraseña nunca se imprime.
Para GPM IMERG, autoriza una vez la app **"NASA GESDISC DATA ARCHIVE"** en tu perfil de Earthdata;
sin eso, `fetch_rain.py` usa NASA POWER y lo indica en la app.

## Método (lo importante para jueces)

1. **Lectura remota**: de cada GCOV (~7 GB) solo se leen los bloques del recuadro; se remuestrea a una malla
   lat/lon de ~20 m, igual para todas las misiones.
2. **Frames unidos**: si una pasada corta el recuadro, se rellena con el frame vecino de la misma pasada.
   - **Borde con ruido** (`--edge-trim`): se usa la máscara oficial de NISAR (255 = fuera del escaneo; 0 =
     parcialmente enfocado, que solo se descarta si su señal es de verdad ruido, porque algunas versiones del
     producto marcan todo el frame con 0). Además se mide la señal HV sobre tierra según la distancia al borde
     de la franja y se recorta la zona donde está bajo el piso de ruido (~−24 dB).
   - **Otra órbita** (`--fill-tracks`): lo que siga faltando se rellena con la pasada más cercana (≤ 7 días)
     de otro track (p. ej. descendente 26 o ascendente 33). Antes se iguala el brillo con la diferencia
     mediana en la zona que ven las dos órbitas. Cada píxel rellenado queda marcado (`<fecha>_src.png`:
     rayas celestes = otra órbita, rayas grises = sin escaneo) y la app lo indica bajo la fecha.
3. **Umbral calibrado por fecha**: en cada fecha se mide la señal de agua y de vegetación *conocidas*
   (WorldCover) y el corte se pone al 35 % entre ambas. Así la regla se adapta a la época
   (agua rugosa en lluvias, suelo mojado).
4. **Mar fijo**: el mar se define una vez con WorldCover, para que el oleaje no se confunda con el estero.
5. **Control de calidad**: fechas sin contraste agua/vegetación se descartan (p. ej. 23-jun-2026).
6. **Validación** (Barra): NISAR detecta ~85–91 % del agua del estero del mapa ESA, y 60–93 % de lo que
   NISAR llama agua cae en agua/manglar del mapa, en época seca y lluviosa.

## Huecos sin escaneo

`scripts/fill_gaps.py`: en fechas con al menos 50 % escaneado de verdad, cada píxel sin dato se rellena con la
fecha válida más cercana (máx. 120 días), corrigiendo la diferencia de brillo **por tipo de cobertura**
(WorldCover). Esos píxeles quedan marcados con rayas moradas y la app dice "X % aproximado con la pasada del…".
`coverage_pct` sigue siendo la cobertura escaneada real. En Jiquilisco (dic–ene) casi no se puede rellenar: esa
parte nunca la escanea la órbita principal.

## IA 1: MangroveNet — mapa de cobertura solo con radar

- **Objetivo**: que NISAR dibuje el mapa de agua, manglar, árboles, cultivo, pasto y suelo sin depender de fotos.
- **Modelo**: U-Net (PyTorch) con 10 canales por píxel calculados de todas las pasadas: media, desviación,
  percentiles 10/90 de HH y HV, media de HH−HV y fracción de pasadas con dato.
- **Etiquetas**: ESA WorldCover 2021 agrupado en 6 clases.
- **Validación honesta**: entrena en Jiquilisco + Cerrón **sin su franja este (20 %)**; el mejor modelo se elige
  con esa franja apartada. **Barra de Santiago no se usa durante el entrenamiento** y se mide una sola vez al
  final. (Una versión anterior elegía el modelo con Barra y reportaba Barra: el número salía inflado.)
- **Resultado en Barra (prueba, medida una sola vez)**: manglar con **F1 0,82** (precisión y exhaustividad
  parecidas), **81 %** del mapa igual que WorldCover, y **23,1 km²** de manglar contra 24,4 km² del mapa ESA.
  Por clase: agua 0,99 · manglar 0,82 · pasto/arbusto 0,74 · árboles 0,71 · cultivo 0,49 · suelo/urbano 0,36.
  Coincide con el resto del análisis: el manglar se reconoce bien y lo más difícil es lo que cambia a su alrededor.
- Archivos: `web/<sitio>/ref/mangrovenet.png|json`, `models/mangrovenet.pt`, `models/mangrovenet_log.csv`.
- **Límites**: las etiquetas son de 2021 y a 10 m; un solo año de NISAR. Las clases caña y suelo/urbano son las
  más débiles (cambian mucho o son pequeñas).

## IA 2: radar → imagen aproximada

- **Objetivo**: mostrar cómo se vería el paisaje en días nublados, cuando la foto óptica no sirve.
- **Modelo**: U-Net + PatchGAN (estilo pix2pix). Pares: cada pasada NISAR con la foto Sentinel-2 más cercana
  (≤ 15 días): 10 en Barra y 11 en Cerrón.
- **Resultado**: error medio 11,5/255 en la franja este (20 %) que no se usó para entrenar, contra 16,9 de
  "pintar el color medio". Esa franja también se usó para elegir el modelo, así que el número es algo optimista.
- **Es una reconstrucción, no una foto**: acierta la forma (costa, estero, manchas de manglar, parcelas) pero no
  el color fino. La app la marca siempre como "aproximada". Solo se muestra en Barra y Cerrón: en Jiquilisco la
  mitad que viene de otra órbita sale mal.

## IA 3: "el radar aprende de la foto" (Cerrón Grande)

- **Objetivo**: detectar plantas sobre el agua (lirio, vegetación flotante) con NISAR también en días nublados.
- **Respuestas (etiquetas)**: Sentinel-2 en días despejados, NDVI > 0.3 dentro del agua permanente (WorldCover).
- **Parejas**: 7 fechas foto-radar con ≤ 8 días de diferencia (dic-2025 a nov-2026).
- **Datos de entrada por píxel**: HH, HV, HH−HV, HH y HV relativos a la señal del agua de esa fecha, medias y
  texturas 5×5, distancia a la orilla.
- **Modelo**: Random Forest (scikit-learn, 120 árboles), muestras con la proporción real y corte de decisión
  elegido con predicciones fuera de bolsa (sin mirar la fecha de prueba).
- **Validación**: dejar una fecha fuera. F1 medio **0,54** contra **0,44** de la regla fija; el modelo gana en
  las 7 fechas. Archivo: `web/data-cerron/ml.json`; modelo en `models/radar_from_photo_cerron.joblib`.
- **Límites**: un solo año de datos; las plantas se mueven con el viento entre la foto y el radar (hasta 8 días),
  lo que pone un techo al acierto. Es una prueba de concepto.

## Física

- **Agua abierta**: reflexión especular → muy oscura en HH y HV.
- **Manglar inundado**: doble rebote agua → tronco → radar → muy brillante en HH.
- **Plantas flotantes / vegetación**: dispersión de volumen → HV alta.
- La banda L (24 cm) atraviesa el dosel y ve con nubes, de día y de noche.

## El problema que resuelve: las nubes

Medido píxel a píxel sobre el agua del embalse (capa de nubes SCL de Sentinel-2), dic-2025 a oct-2026:

| Época | Fotos con el embalse tapado (< 50 % visible) | Racha más larga sin foto despejada |
|---|---|---|
| Lluvias (may–oct) | **45 %** | **15 días** (7–22 jul; NISAR pasó el 17 jul) |
| Seca (dic–abr) | 6 % | 6 días |

El 15-sep-2026 la foto salió 100 % tapada sobre el embalse; NISAR + IA vieron 14,7 km² de plantas ese día.
Nota: el "% de nubes" que trae cada escena es de todo el recuadro de 100 km y exagera el problema; aquí se usa
solo el embalse.

## Alerta de lirio por zonas

`scripts/lirio_alert.py` divide el embalse en 4 zonas (entrada del Lempa, norte, centro, brazo sur) y para cada
pasada calcula km² con lirio, % del agua, cambio contra la pasada anterior y nivel (bajo/medio/alto respecto al
año en esa zona), más un mensaje corto para compartir. La entrada del Lempa pasa de ~2,3 km² en verano a ~6,5 km²
en lluvias (hasta ~50 % de su agua).

## Hallazgos (preliminares)

- Barra de Santiago: el estero mantiene ~2,7–3,7 km² de agua abierta; el manglar inundado crece en lluvias.
- Cerrón Grande: SWOT muestra que el nivel baja ~6,5 m en la época seca (239 m en feb → 233 m en mayo) y se
  recupera en septiembre. La superficie "con plantas" (Sentinel-2) es máxima en mayo, cuando el nivel es más
  bajo: incluye lirio **y** fondo expuesto con hierba. Separar ambos requiere validación de campo.

## Aplicaciones futuras de NISAR · Future applications of NISAR

**Español**
- **Alerta de manglar cada 12 días**: con la cadencia de NISAR, un aviso automático cuando aparece una quema a menos
  de 500 m del manglar, un estanque nuevo o una caída persistente de la señal HV (tala), con un mensaje listo para
  compartir con guardarrecursos y cooperativas. El molde ya existe en `scripts/lirio_alert.py`.
- **Cualquier manglar del mundo**: los scripts solo necesitan un recuadro (`--bbox`); Global Mangrove Watch da la
  referencia histórica en todos los países con manglar, y WorldCover el "maestro" para calibrar.
- **Humedad del suelo y agricultura**: la banda L es sensible a la humedad del suelo bajo la caña; sirve para seguir
  riego, sequía y el momento de cosecha sin depender de fotos.
- **Deformación de la costa (InSAR)**: con los productos interferométricos de NISAR se podrá medir hundimiento de la
  planicie costera y de la bocana, y así separar pérdida de manglar por tala de pérdida por cambio del terreno.
- **Marea y estación**: calcular la marea de cada pasada (modelo de marea) para separar la inundación por marea de la
  inundación por lluvias en el manglar.
- **Más años, mejor estadística**: con 3–5 años de NISAR, el cambio "real" se distingue del ruido estacional y los
  modelos de IA dejan de ser prueba de concepto.

**English**
- **A 12-day mangrove alert**: an automatic notice when a burn appears within 500 m of the mangrove, a new pond is
  built, or the HV signal drops persistently (clearing), with a message ready to share with rangers and
  cooperatives. The template already exists in `scripts/lirio_alert.py`.
- **Any mangrove on Earth**: the scripts only need a bounding box; Global Mangrove Watch provides the historical
  reference in every mangrove country and WorldCover the calibration reference.
- **Soil moisture and agriculture**: L-band is sensitive to soil moisture under the cane; it can follow irrigation,
  drought and harvest timing without optical images.
- **Coastal deformation (InSAR)**: NISAR interferometric products will allow measuring subsidence of the coastal plain
  and the estuary mouth, separating mangrove loss by clearing from loss by ground change.
- **Tide vs. season**: compute the tide at each pass to separate tidal flooding from rainy-season flooding.
- **More years, better statistics**: with 3–5 years of NISAR, real change can be told apart from seasonal noise and the
  AI models move beyond proof of concept.

## Supuestos y límites

- Los índices de Sentinel-2 (NDCI, NDTI) son relativos, no concentraciones en mg/L.
- WorldCover es de 2021: si el estero o el embalse cambiaron de forma desde entonces, la calibración se afecta.
- Las causas (aguas residuales, fertilizantes, manejo de la represa) son hipótesis, no las demuestra el satélite.

Datos: NASA/JPL-Caltech, ISRO, CNES, ASF DAAC, PO.DAAC, LP DAAC, GES DISC, ESA/Copernicus. Código abierto bajo licencia MIT (ver `LICENSE`).
