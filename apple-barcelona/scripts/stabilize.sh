#!/usr/bin/env bash
# Estabiliza public/source.mp4 con vid.stab (2 pasadas) y lo escala a 1080x1920.
# Resultado: public/stabilized.mp4 (sin audio; la voz limpia va aparte).
set -euo pipefail
cd "$(dirname "$0")/.."
TRF="$(mktemp -d)/transforms.trf"

# Pasada 1: analiza el movimiento de la cámara.
ffmpeg -v error -y -i public/source.mp4 \
  -vf "vidstabdetect=shakiness=6:accuracy=15:stepsize=6:result=${TRF}" -f null -

# Pasada 2: suaviza la trayectoria (~1 s), recorta un poco para ocultar bordes,
# escala con lanczos y aplica un enfoque leve.
ffmpeg -v error -y -i public/source.mp4 \
  -vf "vidstabtransform=input=${TRF}:smoothing=25:optalgo=gauss:optzoom=1:zoomspeed=0.2:interpol=bicubic:crop=keep,scale=1080:1920:flags=lanczos,unsharp=5:5:0.6:5:5:0.0,format=yuv420p" \
  -an -c:v libx264 -preset slow -crf 16 -r 25 public/stabilized.mp4
echo "OK -> public/stabilized.mp4"
