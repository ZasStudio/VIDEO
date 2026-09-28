import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {buildProject} from './scenes';

// Generates ../after-effects/PremiereIA_AE.jsx
//   npx tsx ae/build-ae.ts

const OUT = join(__dirname, '..', '..', 'after-effects', 'PremiereIA_AE.jsx');
const runtime = readFileSync(join(__dirname, 'runtime.jsx'), 'utf8');
const project = buildProject();

const header = `// Premiere Pro + IA — proyecto editable para Adobe After Effects
// Generado automáticamente desde el proyecto de Remotion (premiere-ia/ae/build-ae.ts).
//
// Uso: After Effects > Archivo > Scripts > Ejecutar archivo de script… y elige este archivo.
// Mantén este .jsx junto a las carpetas "footage" y "audio". Antes, instala las fuentes de "fuentes".
#target aftereffects
`;

const js = `${header}
(function () {
${runtime}
var PROJECT = ${JSON.stringify(project)};
build(PROJECT);
})();
`;
writeFileSync(OUT, js);
const layers = project.comps.reduce((a, c) => a + c.layers.length, 0);
console.log(`Wrote ${OUT}: ${(js.length / 1024).toFixed(0)} KB, ${project.comps.length} comps, ${layers} layers`);
