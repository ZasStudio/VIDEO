# Cómo se construyó Machu Picchu: video de 60 s explicado por Clawd

Video horizontal de **1920 × 1080 a 30 fps y 60 s**, al estilo de MrBeast. Tiene elementos 3D, fondos degradados, títulos extruidos en 3D, subtítulos palabra por palabra y cortes rápidos. Explica cómo los incas construyeron Machu Picchu y lo narra **Clawd**, la mascota de Claude Code, convertido en un personaje 3D de vóxeles con un chullo andino.

Todo está hecho con código en [Remotion](https://www.remotion.dev) y [Three.js](https://threejs.org). No hay imágenes, videos, música, voces ni efectos de sonido externos, y tampoco se usaron herramientas de IA generativa:

- **Mundo 3D**:
  - Terreno procedural con Huayna Picchu, la montaña Machu Picchu, el río Urubamba y los Andes (`src/three/terrain.ts` y `World.tsx`).
  - Ciudadela con terrazas, casas con techo de paja e Intihuatana (`Citadel.tsx`).
  - Cielo en degradado y nubes low-poly.
- **Clawd**: modelo de vóxeles reconstruido a partir del pixel art de la terminal (`src/three/Clawd.tsx`). Puede saltar, saludar, señalar, parpadear y "hablar".
- **Títulos 3D**: las tipografías se convirtieron a geometría extruida con degradado y contorno (`scripts/font-to-typeface.mjs` y `src/three/Text3D.tsx`).
- **Piezas explicativas**:
  - Muro poligonal de sillares con cojín (`Masonry.tsx`), que también da el muro y la puerta trapezoidal antisísmicos.
  - Corte de una terraza por capas con drenaje (`Terrace.tsx`).
  - Obreros de vóxeles para la mit'a (`Worker.tsx`).
- **Audio**: `scripts/generate-audio.mjs` sintetiza con matemática pura la música andina-pop (quena, charango, bombo) a 120 BPM, los efectos y las "voces" de Clawd.
- **Tipografías**: Luckiest Guy (Apache 2.0), Montserrat y Lilita One (SIL OFL), en `public/fonts/`.

## Estructura

| Tiempo | Escena | Contenido |
| --- | --- | --- |
| 0:00–0:06 | Gancho | Vuelo entre nubes hacia Machu Picchu: "Sin ruedas, sin hierro, sin cemento… ¿Cómo lo hicieron?" |
| 0:06–0:10 | Intro | Clawd cae sobre la ciudadela, se pone el chullo y saluda. |
| 0:10–0:15 | Datos | Ubicación en Cusco (Perú), 2.430 m de altura y rebobinado hasta el año 1450. |
| 0:15–0:18 | El emperador | Pachacútec con el Inti dorado. |
| 0:18–0:24 | El reto | Tormenta: casi 2.000 mm de lluvia al año y terremotos. |
| 0:24–0:34 | Secreto #1 | Granito sacado del mismo cerro, encaje sin cemento, la prueba del papel, piedras más duras y bronce. |
| 0:34–0:42 | Secreto #2 | Puertas trapezoidales, muros inclinados y piedras que "bailan" y vuelven a su lugar. |
| 0:42–0:52 | Secreto #3 | Terrazas por capas, filtración del agua, 60 % de la obra bajo tierra y 129 canales. |
| 0:52–0:56 | Mit'a | Miles de personas trabajando por turnos. |
| 0:56–1:00 | Final | Atardecer dorado: "¡Sigue en pie!" y Maravilla del Mundo. |

Los cortes caen en los compases de la música: 1 compás son 2 s (60 frames). Los drops están en 0:06 y 0:24 y el golpe final en 0:58.

## Uso

```bash
npm i
npm run dev                      # Remotion Studio
node scripts/generate-audio.mjs  # regenera música y efectos (public/audio)

# Render en dos pasos: video mudo y audio aparte, luego se unen
npx remotion render MachuPicchu out/video.mp4 --muted --props='{"withAudio":false}'
npx remotion render MachuPicchuAudio out/audio.wav --codec=wav
npx remotion ffmpeg -i out/video.mp4 -i out/audio.wav -c:v copy -c:a aac -b:a 256k -movflags +faststart out/machu-picchu.mp4
```

El 3D se renderiza por software con ANGLE (`remotion.config.ts`), así que no hace falta GPU. Si Remotion no puede descargar su navegador, usa uno instalado con `REMOTION_BROWSER_EXECUTABLE=/ruta/a/chrome`.

`node scripts/stills.mjs <carpeta> <escala> <frame...>` renderiza frames sueltos para revisarlos. La carpeta "Dev" del Studio incluye pruebas del mundo 3D, de los títulos y de las poses de Clawd.

## Datos históricos usados

- Se construyó hacia 1450 d. C. por orden del emperador inca Pachacútec, a 2.430 m sobre el nivel del mar, en la región de Cusco (Perú).
- Los muros más finos son de granito labrado del mismo cerro, encajados sin mortero. Los incas tallaban con piedras más duras y herramientas de bronce, sin hierro ni rueda.
- Las puertas y ventanas son trapezoidales y los muros se inclinan hacia dentro. Con los sismos, las piedras se mueven y vuelven a asentarse.
- Según los estudios de ingeniería de Kenneth Wright, cerca del 60 % de la obra está bajo tierra (cimientos y drenaje) y hay 129 canales de drenaje. Las terrazas se rellenaban por capas de piedras, grava, arena y tierra, y la lluvia anual ronda los 2.000 mm.
- La mano de obra venía de la mit'a, un trabajo comunitario por turnos.

Clawd es la mascota de Claude Code (Anthropic). Revisa sus condiciones de uso antes de publicar el video con fines comerciales.
