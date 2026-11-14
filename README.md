# Latido del Manglar / Pulso del Embalse — NASA Space Apps 2026

App web interactiva que usa radar **NISAR** (NASA-ISRO, banda L) como eje, junto con otras misiones de
NASA y ESA, para ver cómo cambian dos ecosistemas de agua de **El Salvador** a lo largo de un año
(dic-2025 → nov-2026), separando el ritmo natural de la presión humana.

| Sitio | Qué se estudia | Misiones |
|---|---|---|
| **Barra de Santiago** (Ahuachapán, sitio Ramsar) | Estero, manglar inundado, cultivos de caña alrededor | NISAR, Sentinel-2, ESA WorldCover, lluvia NASA |
| **Embalse Cerrón Grande** (Chalatenango/Cabañas) | Agua abierta vs plantas (lirio y orilla expuesta), nivel, temperatura, color del agua | NISAR, **SWOT**, **ECOSTRESS**, lluvia NASA (GPM/POWER), Sentinel-2, WorldCover |

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
python -m pip install h5py earthaccess pyproj numpy pillow scipy rasterio pyshp
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
3. **Umbral calibrado por fecha**: en cada fecha se mide la señal de agua y de vegetación *conocidas*
   (WorldCover) y el corte se pone al 35 % entre ambas. Así la regla se adapta a la época
   (agua rugosa en lluvias, suelo mojado).
4. **Mar fijo**: el mar se define una vez con WorldCover, para que el oleaje no se confunda con el estero.
5. **Control de calidad**: fechas sin contraste agua/vegetación se descartan (p. ej. 23-jun-2026).
6. **Validación** (Barra): NISAR detecta ~85–91 % del agua del estero del mapa ESA, y 60–93 % de lo que
   NISAR llama agua cae en agua/manglar del mapa, en época seca y lluviosa.

## IA: "el radar aprende de la foto" (Cerrón Grande)

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

## Hallazgos (preliminares)

- Barra de Santiago: el estero mantiene ~2,7–3,7 km² de agua abierta; el manglar inundado crece en lluvias.
- Cerrón Grande: SWOT muestra que el nivel baja ~6,5 m en la época seca (239 m en feb → 233 m en mayo) y se
  recupera en septiembre. La superficie "con plantas" (Sentinel-2) es máxima en mayo, cuando el nivel es más
  bajo: incluye lirio **y** fondo expuesto con hierba. Separar ambos requiere validación de campo.

## Supuestos y límites

- Los índices de Sentinel-2 (NDCI, NDTI) son relativos, no concentraciones en mg/L.
- WorldCover es de 2021: si el estero o el embalse cambiaron de forma desde entonces, la calibración se afecta.
- Las causas (aguas residuales, fertilizantes, manejo de la represa) son hipótesis, no las demuestra el satélite.

Datos: NASA/JPL-Caltech, ISRO, CNES, ASF DAAC, PO.DAAC, LP DAAC, GES DISC, ESA/Copernicus. Código abierto (MIT).
