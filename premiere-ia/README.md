# Premiere Pro + IA — video de 45 s

Video horizontal de **1920 × 1080 a 30 fps, 45 s**. Explica cómo se edita en Adobe Premiere Pro (con su interfaz) y cómo se usa la IA en la edición. Lo presenta una oveja urbana animada con estética de motion graphics.

Todo está hecho con código en [Remotion](https://www.remotion.dev) (React). No hay imágenes, videos, música ni efectos de sonido externos:

- **Avatar**: dibujado en SVG por piezas y animado con un rig (caminar, bailar, saludar, señalar, hablar, parpadear) en `src/character/`.
- **Interfaz de Premiere Pro**: recreada en HTML/CSS (paneles, monitores, línea de tiempo, herramientas, paneles de IA) en `src/ui/`.
- **Música y efectos**: sintetizados desde cero con `scripts/generate-audio.mjs` (beat urbano a 96 BPM + efectos).
- **Tipografías**: Anton, Archivo Black, Bungee, Permanent Marker y Source Sans 3, todas con licencia SIL OFL, en `public/fonts/`.

## Estructura del video

| Tiempo | Escena | Contenido |
| --- | --- | --- |
| 0:00–0:05 | Intro | La oveja entra caminando y saluda. Título "Cómo editar en Premiere Pro + IA". |
| 0:05–0:12.5 | 01 · La interfaz | Proyecto, monitor de origen, monitor de programa, línea de tiempo y herramientas. |
| 0:12.5–0:20 | 02 · Edita en 4 pasos | Importar, cortar con la Cuchilla (C), cerrar huecos (Shift+Supr) y añadir transición (Ctrl+D), exportar (Ctrl+M). |
| 0:20–0:22.5 | ¿Y la IA? | Pausa que anuncia la sección de IA. |
| 0:22.5–0:40 | Funciones con IA | Transcripción y edición por texto, subtítulos automáticos con traducción, Mejorar voz, Reencuadre automático, Extensión generativa. |
| 0:40–0:45 | Cierre | Mensaje final y un póster que rinde homenaje a la ilustración original. |

Los cortes de escena coinciden con los compases de la música (1 compás = 2,5 s = 75 frames).

## Uso

```bash
npm i
npm run dev                      # abre Remotion Studio para previsualizar
node scripts/generate-audio.mjs  # regenera la música y los efectos
npx remotion render PremiereIA out/premiere-ia.mp4
```

Si Remotion no puede descargar su navegador, indícale uno instalado:

```bash
REMOTION_BROWSER_EXECUTABLE=/ruta/a/chrome npx remotion render PremiereIA out/premiere-ia.mp4
```

Cada escena está registrada también como composición independiente (carpeta "Escenas" en el Studio), así que puedes previsualizarla y editarla por separado.

## Archivos principales

- `src/PremiereIAVideo.tsx`: composición principal (escenas, transiciones y audio).
- `src/scenes/`: una escena por archivo.
- `src/Soundtrack.tsx`: música y efectos, con el frame exacto de cada sonido.
- `src/mg/`: piezas de motion graphics (stickers, cintas, títulos cinéticos, facecam, globos de diálogo, cursor, teclas).
- `src/theme.ts`: paleta, tipografías y tiempos musicales.
