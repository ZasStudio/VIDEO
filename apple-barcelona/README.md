# Apple Store Barcelona — vlog editado (72 s, vertical)

Edición profesional en [Remotion](https://www.remotion.dev) de un vlog vertical: un chico que emigró a España cumple el sueño de comprarse un MacBook Pro en la Apple Store de Plaça de Catalunya (Barcelona) y cierra con un mensaje motivador ("todo comienzo da miedo… si yo pude, tú también puedes").

- **Video**: el original (`public/source.mp4`, 576×1024, 25 fps), estabilizado con vid.stab y escalado a 1080×1920.
- **Voz**: el audio limpio (`public/voice.mp3`), que está sincronizado con el video (desfase 0, verificado por correlación).
- **Salida**: 1080×1920, 25 fps, 72,44 s, audio normalizado a -14 LUFS.

## Qué se hizo

1. **Transcripción** con whisper.cpp (modelo `medium`, español) → `public/captions.json`. Se corrigieron dos errores evidentes ("anhelaba", "MacBook").
2. **Cortes** (`src/edit.ts`): se quitaron 7,7 s sin tocar el mensaje:
   - la frase trabada "A mí va a ser un pequeño esfuerzo, ¿eh?";
   - las pausas largas (> 0,4 s), dejando ~0,25 s de respiro.
   Todos los cortes caen dentro de silencios detectados en la voz (ffmpeg `silencedetect`), así que nunca se corta una palabra. Video y voz se cortan con la misma lista, por lo que la sincronía de labios se mantiene. El original terminaba con un fundido a negro; se corta antes y el cierre es propio (cuadro casi congelado + frase final + fundido).
3. **Estabilización** (`scripts/stabilize.sh`): vid.stab en dos pasadas, suavizado de ~1 s, recorte automático mínimo. No produce deformaciones ("bailes"); se revisó cuadro a cuadro en los planos caminando.
4. **Imagen** (`src/Footage.tsx`): corrección de color suave (contraste, saturación, calidez en luces y frío en sombras), viñeta, "punch-in" alterno (1,00 / 1,07) en cada corte para que los saltos dentro de un mismo plano se vean intencionales, y un push-in lento dentro de cada tramo.
5. **Subtítulos** (`src/Captions.tsx`): estilo karaoke de 2–3 palabras, palabra activa en amarillo y palabras clave del mensaje en rosa (a juego con su polo).
6. **Gráficos** (`src/Overlays.tsx`): gancho inicial ("Apple Store · Barcelona" + "Cumpliendo un sueño"), etiqueta "MacBook Pro 16”" cuando aparece en pantalla, capítulo "Mi historia", cita sincronizada con la voz ("El que busca, encuentra. Y el que no se rinde, lo logra."), frase final grande ("Porque si yo pude, tú también puedes lograrlo.") y cierre "Cada esfuerzo es un logro.", más una barra de progreso.
7. **Audio** (`src/Mix.tsx`): voz limpia, música de fondo emotiva generada por código (`scripts/generate-music.mjs`) con ducking automático según la envolvente de la voz (`scripts/voice-envelope.mjs`), efectos sutiles en los títulos, y normalización final a -14 LUFS / -1,5 dBTP (`scripts/render.sh`).

## Uso

```bash
npm i
./scripts/stabilize.sh            # genera public/stabilized.mp4 (no se versiona, ~100 MB)
node scripts/generate-music.mjs   # genera public/music.wav
node scripts/voice-envelope.mjs   # genera src/voice-envelope.json
npm run dev                       # Remotion Studio
./scripts/render.sh               # render final normalizado en ../renders/
```

Para volver a transcribir: `WHISPER_DIR=/ruta/fuera/del/repo node scripts/transcribe.mjs` (descarga whisper.cpp y el modelo, ~1,5 GB).

Si Remotion no puede descargar su navegador: `REMOTION_BROWSER_EXECUTABLE=/ruta/a/chrome ./scripts/render.sh`.
