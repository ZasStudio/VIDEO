# Premiere Pro + IA — proyecto editable para After Effects

Este script de After Effects reconstruye el video de 45 s (1920 × 1080, 30 fps) como un proyecto de AE con capas nativas editables.

## Cómo abrirlo

1. **Instala las fuentes** de la carpeta `fuentes/` (doble clic > Instalar). Son Anton, Archivo Black, Bungee, Permanent Marker y Source Sans 3, todas con licencia SIL OFL. Si After Effects estaba abierto, reinícialo.
2. Abre After Effects con un proyecto vacío.
3. Ve a **Archivo > Scripts > Ejecutar archivo de script…** y elige `PremiereIA_AE.jsx`.
4. Cuando termine verás un aviso y se abrirá la composición **`PremiereIA · PRINCIPAL`**.

Deja el `.jsx` en esta carpeta, junto a `footage/` y `audio/`, porque el script importa esos archivos por ruta relativa.

## Qué es editable

| Elemento | Cómo está hecho |
| --- | --- |
| **Oveja** (intro, "¿Y la IA?", cierre y facecam) | Shape layers vectoriales con rig por parenting: controles `CTRL Giro`, `CTRL Cuerpo`, `CTRL Inclinación` y `CTRL Cabeza`, más hombro, codo, mano, muslo, rodilla y tenis. La animación está en keyframes. Las manos (puño, señalar, abierta, pulgar) y las bocas son grupos que se muestran o se ocultan con la opacidad. |
| **Títulos cinéticos** | Capas de texto con un animador "Entrada letra a letra" (selector de rango). |
| **Stickers, cintas, etiquetas de escena, globos de diálogo, teclas, rótulos de paneles** | Texto nativo más shape layers, agrupados bajo un nulo `· control` que lleva la posición, la escala (pop) y la rotación. |
| **Resaltes de la interfaz** | Shape layers con Merge Paths (el oscurecido) y Trim Paths (el marco que se dibuja). |
| **Transiciones** (barras diagonales y destellos) | Shape layers y sólidos en la composición principal. |
| **Audio** | Música y 13 efectos colocados en su frame exacto, con volumen ajustado. |

La **interfaz de Premiere Pro** con sus movimientos de cámara va como video (`footage/plate_*.mp4`). Los fondos van como imágenes PNG. Todo lo que está encima de ellos es editable.

## Estructura del proyecto

- `00 Principal`: la composición final con las 6 escenas, transiciones, grano y audio.
- `01 Escenas`: una composición por escena (Intro, La interfaz, Edita en 4 pasos, ¿Y la IA?, Funciones con IA, Cierre).
- `02 Oveja (rig)`: los rigs de la oveja, uno por aparición.
- `03 Piezas`: la facecam "EN VIVO".
- `04 Footage` y `05 Audio`: los archivos importados.

## Notas

- Al cambiar un texto, su caja o sticker no se redimensiona sola. Ajusta el tamaño del rectángulo en la capa `· caja` correspondiente.
- La oveja de la facecam es una sola composición de 45 s que se reutiliza en cada escena desplazada en el tiempo. Si la editas, cambia en todas.
- Las partículas moradas de la sección de IA usan una expresión sencilla de posición.
- El script lo genera `premiere-ia/ae/build-ae.ts` a partir del proyecto de Remotion. Si cambias la animación en Remotion, ejecuta `npx tsx ae/build-ae.ts` dentro de `premiere-ia/` para regenerarlo.
