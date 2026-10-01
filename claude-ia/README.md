# Claude IA — motion graphics de 53 s

Video horizontal de **1920 × 1080 a 30 fps, 52,8 s**. Copia el estilo de edición del video de referencia (motion graphics de Pinterest): fondos oscuros con orbes desenfocados, una chispa luminosa que guía todo, tipografía cinética con una palabra destacada, tarjetas de interfaz de vidrio, cintas con texto y secciones claras. El contenido trata sobre Claude, la IA de Anthropic, con una paleta cálida (coral, ámbar y crema) en lugar del verde/lima de la referencia.

Todo está hecho con código en [Remotion](https://www.remotion.dev). No hay imágenes, videos ni audio externos:

- **Gráficos**: SVG/HTML/CSS en `src/mg/` (fondos, chispa, tipografía cinética, cintas, interfaces de ejemplo).
- **Música y efectos**: sintetizados desde cero con `scripts/generate-audio.mjs` (100 BPM, re mayor).
- **Tipografías**: Manrope e Instrument Serif (SIL OFL) en `public/fonts/`.

## Estructura del video

| Tiempo | Escena | Contenido |
| --- | --- | --- |
| 0:00–0:04.8 | 01 · Chispa | "Todo empieza con una **pregunta**". La pastilla se colapsa en la chispa, que dibuja un anillo. |
| 0:04.8–0:08.4 | 02 · Anillos | "Idea" → una mancha de luz la barre → "**Prompt**". |
| 0:08.4–0:12 | 03 · Pensar | "¿Y si esto pudiera **pensar** contigo?" con un cuadro de vidrio y un haz de luz. |
| 0:12–0:16.8 | 04 · Chat | "Convirtiendo **ideas** en **resultados**" sobre un chat desenfocado. |
| 0:16.8–0:24 | 05 · Razona | Sección clara: "RAZONA" con ecos, "CLARIDAD" gigante y una cinta en "S". |
| 0:24–0:28.8 | 06 · Cinta | Ventana de chat rodeada por una cinta con texto. |
| 0:28.8–0:33.6 | 07 · Tablero | Tarjetas de vidrio en 3D → "Claude **escribe**, analiza y **programa**". |
| 0:33.6–0:37.2 | 08 · Artefactos | Una tableta se llena con una mini app → "**Artefactos** al instante". |
| 0:37.2–0:40.8 | 09 · Claras | Bloques y una estela de luz → "Respuestas **claras**". |
| 0:40.8–0:44.4 | 10 · Lejos | "Todo **pensado** para llevarte **más lejos**". |
| 0:44.4–0:48 | 11 · Entiende | "Porque una gran IA no solo responde, **entiende**". |
| 0:48–0:52.8 | 12 · Cierre | "Es cómo **te ayuda**" → "¿Listo para crear con **Claude**?" |

Cada corte cae en un tiempo fuerte de la música (1 compás = 2,4 s = 72 frames).

## Uso

```bash
npm i
npm run dev                      # Remotion Studio (cada escena también está en la carpeta "Escenas")
npm run audio                    # regenera la música y los efectos
npx remotion render ClaudeIA out/claude-ia.mp4
```

Si Remotion no puede descargar su navegador, indícale uno instalado:

```bash
REMOTION_BROWSER_EXECUTABLE=/ruta/a/chrome npx remotion render ClaudeIA out/claude-ia.mp4
```

## Archivos principales

- `src/ClaudeVideo.tsx`: composición principal (escenas en serie + audio).
- `src/scenes/`: una escena por archivo, cada una exporta su duración.
- `src/cues.ts`: efectos de sonido con el frame exacto de cada uno.
- `src/mg/Text.tsx`: tipografía cinética (tecleo, decodificado, resaltado, caja de selección).
- `src/mg/Backdrop.tsx`, `Spark.tsx`, `Ribbon.tsx`, `UI.tsx`: fondos, chispa, cintas e interfaces.
- `src/theme.ts`: paleta, tipografías y tiempos musicales.
