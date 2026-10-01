#!/usr/bin/env bash
# Render final + normalización de sonoridad para redes (-14 LUFS, pico real -1,5 dBTP).
#   ./scripts/render.sh [salida.mp4]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-../renders/apple-barcelona-72s-1080x1920.mp4}"
TMP="$(mktemp -d)"
npx remotion render AppleBarcelona "$TMP/raw.mp4" --crf=17 --audio-codec=aac --audio-bitrate=320k

# Pasada 1: medir.
STATS=$(ffmpeg -hide_banner -i "$TMP/raw.mp4" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$STATS" | grep "\"$1\"" | sed -E 's/.*: "([^"]+)".*/\1/'; }

# Pasada 2: normalizar con los valores medidos (lineal, sin bombeo).
ffmpeg -v error -y -i "$TMP/raw.mp4" -c:v copy \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true,aresample=48000" \
  -c:a aac -b:a 320k -movflags +faststart "$OUT"
echo "OK -> $OUT"
