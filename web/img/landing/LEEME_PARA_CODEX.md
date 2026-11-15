# Assets de MANGLO — extraídos de la referencia aprobada

**Este paquete NO contiene imágenes nuevas imaginadas.** Los PNG son recortes de la captura de la landing aprobada; los tres SVG son recreaciones técnicas del patrón halftone que sí aparece en la captura. Incluye la captura original para comparar.

## Imágenes presentes en la landing

- `imagenes/hero_manglares_recorte.png`: recorte de paisaje del hero (lado derecho).
- `imagenes/barra_de_santiago_tarjeta.png`: fotografía de la tarjeta Barra.
- `imagenes/bahia_de_jiquilisco_tarjeta.png`: fotografía de la tarjeta Bahía.
- `imagenes/cerron_grande_tarjeta.png`: fotografía de la tarjeta Cerrón.
- `imagenes/comparacion_2018.png` y `comparacion_2024.png`: dos imágenes que aparecen en la comparación ilustrativa del mockup.
- `imagenes/datos_abiertos_miniatura.png`, `metodologia_miniatura.png`, `humedales_miniatura.png`: las tres miniaturas de Ciencia abierta.
- `imagenes/cierre_paisaje_recorte.png`: franja paisajística para la sección final.

## Decoración fiel a la referencia

- `decoracion/halftone_azul_circulo.svg`: puntos azules circulares sobre fondo crema.
- `decoracion/halftone_azul_esquina.svg`: puntos azules para fondo oscuro, como el hero y Del dato a la acción.
- `decoracion/halftone_blanco_esquina.svg`: puntos blancos en zona de cierre.

## Importante para Codex

1. Replicar **la composición de `referencia_LANDING_COMPLETA.png`** y los títulos tal como aparecen.
2. Los logos, textos, botones, flechas, bordes, iconos básicos, secciones y separadores se deben implementar en HTML/CSS/SVG o iconos del proyecto: no son imágenes externas necesarias.
3. Las fotografías incluidas son **recortes del mockup generado**, no fotografías auténticas verificadas del territorio. Se reemplazarán posteriormente. No atribuirlas a NASA/MARN/Ramsar.
4. Los recortes del hero y el cierre **no permiten reconstruir el fondo original completo**, porque el mockup es una única imagen aplanada. Integrar ahora como placeholders, con `background-size: cover` y degradado azul según la referencia.
5. La comparación 2018/2024 es **ilustrativa**. No presentarla como resultado científico real ni como escenas NISAR; los datos NISAR comienzan después de su lanzamiento en 2025.
6. Mantener la composición exacta, usar los recortes solo donde corresponden y no añadir elementos gráficos que no aparezcan en la referencia.
7. Para los SVG halftone se puede ajustar opacidad/posición por CSS sin introducir diseños nuevos.
