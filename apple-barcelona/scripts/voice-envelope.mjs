// Calcula la envolvente de la voz limpia (1 valor por frame a 25 fps, 0..1) para
// bajar la música automáticamente mientras habla (ducking con ataque rápido y
// liberación lenta). Escribe src/voice-envelope.json.
import {execSync} from 'node:child_process';
import fs from 'node:fs';

const FPS = 25;
const SR = 8000;
const raw = execSync('ffmpeg -v error -i public/voice.mp3 -ac 1 -ar 8000 -f f32le -', {maxBuffer: 1 << 28});
const x = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
const hop = SR / FPS;
const frames = Math.floor(x.length / hop);
const env = [];
let state = 0;
for (let i = 0; i < frames; i++) {
  let s = 0;
  for (let k = 0; k < hop; k++) s += x[i * hop + k] ** 2;
  const db = 10 * Math.log10(s / hop + 1e-12);
  const speech = Math.min(1, Math.max(0, (db + 45) / 15)); // -45 dB -> 0, -30 dB -> 1
  // ataque ~2 frames, liberación ~10 frames
  state += (speech - state) * (speech > state ? 0.6 : 0.1);
  env.push(Math.round(state * 1000) / 1000);
}
fs.writeFileSync('src/voice-envelope.json', JSON.stringify(env));
console.log(`frames: ${frames}, mean: ${(env.reduce((a, b) => a + b, 0) / frames).toFixed(2)}`);
