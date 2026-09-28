// Writes scripts/song.json, the music plan for generate-audio.mjs, from the narrated
// timeline (one section per group of scenes, in 2 s bars; the final hit on "¡sigue en pie!").
//   npx tsx scripts/write-song.ts
import fs from 'node:fs';
import path from 'node:path';
import {songSections} from '../src/timeline';

const out = path.join(__dirname, 'song.json');
const lines = songSections().map((s) => `    ${JSON.stringify(s).replace(/,"/g, ', "').replace(/":/g, '": ').replace(/^\{/, '{ ').replace(/\}$/, ' }')}`);
fs.writeFileSync(out, `{\n  "voiceMix": true,\n  "sections": [\n${lines.join(',\n')}\n  ]\n}\n`);
console.log(`wrote ${out}`);
