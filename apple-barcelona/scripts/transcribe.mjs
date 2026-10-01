// Transcribe el audio limpio (public/voice.mp3) con whisper.cpp y guarda
// public/captions.json en formato Caption de @remotion/captions.
//
//   WHISPER_DIR=/ruta/whisper node scripts/transcribe.mjs
//
// WHISPER_DIR es la carpeta donde se instala whisper.cpp y el modelo (≈1,5 GB),
// fuera del repositorio.
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  downloadWhisperModel,
  installWhisperCpp,
  toCaptions,
  transcribe,
} from '@remotion/install-whisper-cpp';

const to = process.env.WHISPER_DIR ?? path.join(process.cwd(), 'whisper.cpp');
const model = 'medium'; // multilingüe (el video está en español)
const wav = `${to}-voice16k.wav`; // fuera de la carpeta de whisper.cpp (debe crearse vacía)

await installWhisperCpp({to, version: '1.5.5'});
await downloadWhisperModel({model, folder: to});
execSync(`ffmpeg -v error -y -i public/voice.mp3 -ar 16000 -ac 1 "${wav}"`);

const whisperCppOutput = await transcribe({
  model,
  whisperPath: to,
  whisperCppVersion: '1.5.5',
  inputPath: wav,
  tokenLevelTimestamps: true,
  language: 'es',
});

const {captions} = toCaptions({whisperCppOutput});
fs.writeFileSync('public/captions.json', JSON.stringify(captions, null, 2));
console.log(captions.map((c) => c.text).join(''));
