# Cómo se construyó Machu Picchu, explicado por Clawd

Video horizontal de **1920 × 1080 a 30 fps y 2:30**, al estilo de MrBeast. Tiene elementos 3D, fondos degradados, títulos extruidos en 3D y subtítulos palabra por palabra. Explica cómo los incas construyeron Machu Picchu y lo narra **Clawd**, la mascota de Claude Code, convertido en un personaje 3D de vóxeles con un chullo andino.

El ritmo lo marca la voz de Clawd: cada escena dura lo que duran sus frases, más unas pausas para respirar. Cada elemento aparece en la palabra que lo nombra: las capas de la terraza caen cuando dice "piedras", "grava", "arena" y "tierra", y los números cuentan mientras los pronuncia.

Todo está hecho con código en [Remotion](https://www.remotion.dev) y [Three.js](https://threejs.org). La única pieza externa es **la voz de Clawd**, generada con [Magnific](https://www.magnific.com) (ElevenLabs v3, voz "Nerea Escudero") a partir del guion.

- **Mundo 3D**:
  - Terreno procedural con Huayna Picchu, la montaña Machu Picchu, el río Urubamba y los Andes (`src/three/terrain.ts` y `World.tsx`).
  - Ciudadela con terrazas, casas con techo de paja e Intihuatana (`Citadel.tsx`).
  - Cielo en degradado y nubes low-poly.
- **Clawd**: modelo de vóxeles reconstruido a partir del pixel art de la terminal (`src/three/Clawd.tsx`).
  - **No tiene boca: habla con el cuerpo** (`src/talk.ts`). Con cada sílaba da un saltito y se aplasta, mueve los bracitos (alternando lados), se balancea, se inclina hacia delante y parpadea en las pausas. Todo sale de la energía real de su voz, frame a frame.
  - En los planos en que queda lejos o fuera de cuadro aparece en una "facecam" redonda, hablando (`src/overlay/ClawdPip.tsx`).
- **Títulos 3D**: las tipografías se convirtieron a geometría extruida con degradado y contorno (`scripts/font-to-typeface.mjs` y `src/three/Text3D.tsx`).
- **Piezas explicativas**:
  - Muro poligonal de sillares con cojín (`Masonry.tsx`), que también da el muro y la puerta trapezoidal antisísmicos.
  - Corte de una terraza por capas con drenaje (`Terrace.tsx`).
  - Obreros de vóxeles para la mit'a (`Worker.tsx`).
- **Música y efectos**: `scripts/generate-audio.mjs` sintetiza con matemática pura la música andina-pop (quena, charango, bombo) a 120 BPM y todos los efectos. La música se arma por secciones siguiendo la línea de tiempo de la voz.
- **Tipografías**: Luckiest Guy (Apache 2.0), Montserrat y Lilita One (SIL OFL), en `public/fonts/`.

## Estructura

| Tiempo | Escena | Contenido |
| --- | --- | --- |
| 0:00–0:10 | Gancho | Vuelo entre nubes hacia Machu Picchu: "Sin ruedas… sin hierro… ¡y sin cemento! ¿Cómo lo hicieron?" |
| 0:10–0:18 | Intro | Clawd cae sobre la ciudadela, se pone el chullo y saluda. |
| 0:18–0:30 | Datos | Ubicación en Cusco (Perú), 2.430 m de altura y rebobinado hasta el año 1450. |
| 0:30–0:36 | El emperador | Pachacútec con el Inti dorado. |
| 0:36–0:52 | El reto | Tormenta: casi 2.000 mm de lluvia al año y terremotos. "¡Parecía imposible!" |
| 0:52–1:18 | Secreto #1 | Granito sacado del mismo cerro, encaje sin cemento, la prueba del papel, piedras más duras y bronce. |
| 1:18–1:36 | Secreto #2 | Puertas trapezoidales, muros inclinados y piedras que "bailan" y vuelven a su lugar. |
| 1:36–2:02 | Secreto #3 | Terrazas por capas, filtración del agua, 60 % de la obra bajo tierra y 129 canales. |
| 2:02–2:16 | Mit'a | Miles de personas trabajando por turnos. |
| 2:16–2:30 | Final | Atardecer dorado: "¡Machu Picchu sigue en pie!" y Maravilla del Mundo. |

Las escenas duran compases enteros de la música (1 compás = 2 s = 60 frames), así que los cortes caen a tempo. Los drops están en 0:10 y 0:52, y el golpe final en 2:22, justo en la palabra "sigue".

## Cómo funciona la narración

Todo parte del guion, `src/narration.json`. Cada frase tiene:

- `tts`: el texto que se envía a la voz, con etiquetas de ElevenLabs v3 como `[excited]` o `[pause 0.3s]`. "Clawd" se escribe "Clod" para que se pronuncie bien.
- `captions`: los subtítulos, en trozos separados por ` / `.
  - `PALABRA^y` la pinta de un color (`y` amarillo, `o` naranja, `g` verde, `r` rojo, `c` cian).
  - `2.430{4}` indica que ese texto corresponde a 4 palabras habladas ("dos mil cuatrocientos treinta").
  - `~PALABRA` se dice pero no sale en el subtítulo, porque aparece como título 3D.
  - `_` es un espacio que no se corta.

Pasos:

1. **Generar la voz**: una pista por frase en Magnific (ElevenLabs v3, voz "Nerea Escudero", estabilidad 0.45, velocidad 0.95). Se guardan como `L01.mp3` … `L23.mp3` en una carpeta.
2. **Preparar la voz**: `python3 scripts/voice_timing.py <carpeta>` (requiere `pip install numpy scipy espeakng-loader`). Para cada frase:
   - Recorta el silencio, iguala el volumen de habla (−19 dB, picos bajo −3 dB) y acorta a 1,4 s las pausas internas demasiado largas.
   - Encuentra dónde empieza cada palabra. Compara la voz con una lectura del mismo texto en eSpeak NG (MFCC + DTW, la idea del alineador aeneas). Después hace coincidir las pausas del guion (puntuación y etiquetas) con las pausas reales y vuelve a alinear frase por frase.
   - Mide la energía de la voz en cada frame y sus acentos silábicos, que mueven el cuerpo de Clawd.
   - Escribe `public/voice/Lxx.wav` y `src/voice-timing.json`.
3. **Línea de tiempo**: `src/timeline.ts` calcula todo a partir de eso: la duración de cada escena, el frame de cada palabra (`wordAt`), los subtítulos, la energía de la voz y el plan de la música. Las escenas, los títulos y los efectos de sonido (`src/cues.ts`) se enganchan a palabras concretas, así que si cambia la voz todo se reacomoda solo.
4. **Música**: `npx tsx scripts/write-song.ts` escribe `scripts/song.json` con las secciones de la canción. Luego `node scripts/generate-audio.mjs --song scripts/song.json --music-only` la sintetiza en `public/audio/music.wav`. Sin `--music-only` también regenera los efectos.

Sin la voz real se puede trabajar con una voz provisional: `python3 scripts/voice_timing.py <carpeta> --standin` la sintetiza con eSpeak.

## Mezcla

La voz de Clawd manda: queda unos 9 dB por encima de todo lo demás mientras habla.

- La música baja unos 10 dB bajo la voz. Empieza a bajar un instante antes de cada frase y se mantiene abajo en las pausas cortas, para no "bombear", y vuelve a subir entre frases.
- Los efectos y los fondos (lluvia, temblor) bajan 5 dB mientras Clawd habla.
- La mezcla final se masteriza a −14 LUFS (la referencia de YouTube) con picos por debajo de −1 dBTP.

## Uso

```bash
npm i
npm run dev                      # Remotion Studio

# Render en dos pasos: video mudo y audio aparte; después se masteriza el audio y se unen
npx remotion render MachuPicchu out/video.mp4 --muted --props='{"withAudio":false}' --crf=19
npx remotion render MachuPicchuAudio out/audio.wav --codec=wav
python3 scripts/master_audio.py out/audio.wav out/audio-master.wav
npx remotion ffmpeg -i out/video.mp4 -i out/audio-master.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -movflags +faststart out/machu-picchu.mp4
```

El 3D se renderiza por software con ANGLE (`remotion.config.ts`), así que no hace falta GPU. Si Remotion no puede descargar su navegador, usa uno instalado con `REMOTION_BROWSER_EXECUTABLE=/ruta/a/chrome`.

`node scripts/stills.mjs <carpeta> <escala> <frame...>` renderiza frames sueltos para revisarlos. La carpeta "Dev" del Studio incluye pruebas del mundo 3D, de los títulos y de las poses de Clawd.

## Datos históricos usados

- Se construyó hacia 1450 d. C. por orden del emperador inca Pachacútec, a 2.430 m sobre el nivel del mar, en la región de Cusco (Perú).
- Los muros más finos son de granito labrado del mismo cerro, encajados sin mortero. Los incas tallaban con piedras más duras y herramientas de bronce, sin hierro ni rueda.
- Las puertas y ventanas son trapezoidales y los muros se inclinan hacia dentro. Con los sismos, las piedras se mueven y vuelven a asentarse.
- Según los estudios de ingeniería de Kenneth Wright, cerca del 60 % de la obra está bajo tierra (cimientos y drenaje) y hay 129 canales de drenaje. Las terrazas se rellenaban por capas de piedras, grava, arena y tierra, y la lluvia anual ronda los 2.000 mm.
- La mano de obra venía de la mit'a, un trabajo comunitario por turnos.

Clawd es la mascota de Claude Code (Anthropic). Revisa sus condiciones de uso antes de publicar el video con fines comerciales. La voz se generó con Magnific; revisa también sus condiciones para el uso que le vayas a dar.
