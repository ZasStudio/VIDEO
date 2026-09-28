// Renders a list of frames of a composition as JPEG stills (dev helper for reviewing scenes).
// Usage: node scripts/stills.mjs <outDir> <scale> <frame> [frame...]
import path from 'node:path';
import fs from 'node:fs';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition, openBrowser} from '@remotion/renderer';

const [outDir, scaleArg, ...frames] = process.argv.slice(2);
const scale = Number(scaleArg);
fs.mkdirSync(outDir, {recursive: true});
const serveUrl = await bundle({
  entryPoint: path.resolve('src/index.ts'),
  webpackOverride: (c) => c,
  rspack: true,
});
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE ?? null;
const browser = await openBrowser('chrome', {browserExecutable, chromiumOptions: {gl: 'angle'}});
const composition = await selectComposition({serveUrl, id: process.env.COMP ?? 'MachuPicchu', puppeteerInstance: browser, browserExecutable, chromiumOptions: {gl: 'angle'}});
for (const f of frames.map(Number)) {
  const output = path.join(outDir, `element-${String(f).padStart(4, '0')}.jpeg`);
  const t = Date.now();
  await renderStill({
    composition,
    serveUrl,
    frame: f,
    output,
    imageFormat: 'jpeg',
    jpegQuality: 85,
    scale,
    puppeteerInstance: browser,
    browserExecutable,
    chromiumOptions: {gl: 'angle'},
    overwrite: true,
  });
  console.log(`frame ${f} ${Date.now() - t}ms`);
}
await browser.close({silent: true});
