// Writes the music plan for generate-audio.mjs from a narrated timeline (sections in 2 s
// bars; the final hit on "¡sigue en pie!").
//   npx tsx scripts/write-song.ts         -> scripts/song.json      (Machu Picchu video)
//   npx tsx scripts/write-song.ts nubi    -> scripts/nubi-song.json (Nubi's short)
import fs from 'node:fs';
import path from 'node:path';
import {songSections} from '../src/timeline';
import {nubiSong} from '../src/nubi/timeline';

const nubi = process.argv[2] === 'nubi';
const sections: object[] = nubi ? nubiSong().sections : songSections();
const out = path.join(__dirname, nubi ? 'nubi-song.json' : 'song.json');
const lines = sections.map((s) => `    ${JSON.stringify(s).replace(/,"/g, ', "').replace(/":/g, '": ').replace(/^\{/, '{ ').replace(/\}$/, ' }')}`);
fs.writeFileSync(out, `{\n  "voiceMix": true,\n  "sections": [\n${lines.join(',\n')}\n  ]\n}\n`);
console.log(`wrote ${out}`);
