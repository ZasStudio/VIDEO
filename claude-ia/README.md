# Claude IA — motion graphics vertical de 58 s

Video **vertical de 1080 × 1920 a 30 fps, 57,6 s** (Reels, Shorts, TikTok). Copia el estilo de edición del video de referencia (motion graphics de Pinterest): fondos oscuros con orbes desenfocados, una chispa luminosa que guía todo, tipografía cinética con una palabra destacada, tarjetas de interfaz de vidrio, cintas con texto y secciones claras. El contenido trata sobre Claude, la IA de Anthropic, con una paleta cálida (coral, ámbar y crema). Incluye una escena colaborativa ("Crea juntos") inspirada en la referencia "Design together".

La primera versión horizontal (1920 × 1080, 52,8 s) sigue en `renders/claude-ia-53s-1920x1080.mp4` y en el historial de git.

Todo está hecho con código en [Remotion](https://www.remotion.dev). No hay imágenes, videos ni audio externos:

- **Gráficos**: SVG/HTML/CSS en `src/mg/` (fondos, chispa, tipografía cinética, cintas, interfaces de ejemplo, cursores colaborativos).
- **Música y efectos**: sintetizados desde cero con `scripts/generate-audio.mjs` (100 BPM, re mayor, 24 compases).
- **Tipografías**: Manrope e Instrument Serif (SIL OFL) en `public/fonts/`.

## Recursos de movimiento

- **Curvas fuertes** (`src/anim.ts`): ease-out `cubic-bezier(0.23, 1, 0.32, 1)` para entradas y salidas, ease-in-out `cubic-bezier(0.77, 0, 0.175, 1)` para movimientos en pantalla; las entradas con resorte nunca parten de `scale(0)` (`appear()`).
- **Motion blur direccional** (`src/mg/Blur.tsx`): filtros SVG que desenfocan solo en el eje del movimiento; se usan en el texto, la chispa, los cursores y la pastilla.
- **Motion blur real** con `CameraMotionBlur` (`@remotion/motion-blur`) en el disparo de la chispa (escena 3) y en el vuelo de las tarjetas (tablero).
- **Destellos de luz** (`lightLeak()` de `@remotion/effects`) sobre cuatro cortes clave, en modo *screen* (requiere WebGL: `Config.setChromiumOpenGlRenderer("angle")`, ya configurado).

## Estructura del video

| Tiempo | Escena | Contenido |
| --- | --- | --- |
| 0:00–0:04.8 | 01 · Chispa | "Todo empieza con una **pregunta**". La pastilla se colapsa en la chispa, que dibuja un anillo. |
| 0:04.8–0:08.4 | 02 · Anillos | "Idea" → una mancha de luz la barre → "**Prompt**". |
| 0:08.4–0:12 | 03 · Pensar | "¿Y si esto pudiera **pensar** contigo?" con un cuadro de vidrio y un haz de luz. |
| 0:12–0:16.8 | 04 · Chat | "Convirtiendo **ideas** en **resultados**" sobre un chat desenfocado. |
| 0:16.8–0:24 | 05 · Razona | Sección clara: "RAZONA" con ecos, "CLARIDAD" gigante y una cinta en "S". |
| 0:24–0:28.8 | 06 · Cinta | Ventana de chat rodeada por una cinta con texto. |
| 0:28.8–0:33.6 | 07 · Juntos | "Crea **juntos**": selección tipo Figma, cursores "Tú" y "Claude", letras con motion blur. |
| 0:33.6–0:38.4 | 08 · Tablero | Tarjetas de vidrio en 3D → "Claude **escribe**, analiza y **programa**". |
| 0:38.4–0:42 | 09 · Artefactos | Una pantalla se llena con una mini app → "**Artefactos** al instante". |
| 0:42–0:45.6 | 10 · Claras | Bloques y una estela de luz → "Respuestas **claras**". |
| 0:45.6–0:49.2 | 11 · Lejos | "Todo **pensado** para llevarte **más lejos**". |
| 0:49.2–0:52.8 | 12 · Entiende | "Porque una gran IA no solo responde, **entiende**". |
| 0:52.8–0:57.6 | 13 · Cierre | "Es cómo **te ayuda**" → "¿Listo para crear con **Claude**?" |

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
- `src/mg/Backdrop.tsx`, `Spark.tsx`, `Ribbon.tsx`, `UI.tsx`, `CollabCursor.tsx`: fondos, chispa, cintas, interfaces y cursores.
- `src/mg/Blur.tsx`, `LeakOverlay.tsx`: motion blur direccional y destellos de luz.
- `src/theme.ts`: paleta, tipografías y tiempos musicales.
