import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

// All fonts are open-source (SIL OFL) and bundled in public/fonts.
const fonts: {family: string; file: string; weight: string}[] = [
  {family: 'Anton', file: 'Anton-400.woff2', weight: '400'},
  {family: 'Permanent Marker', file: 'PermanentMarker-400.woff2', weight: '400'},
  {family: 'Archivo Black', file: 'ArchivoBlack-400.woff2', weight: '400'},
  {family: 'Bungee', file: 'Bungee-400.woff2', weight: '400'},
  {family: 'SourceSans', file: 'SourceSans3-400.woff2', weight: '400'},
  {family: 'SourceSans', file: 'SourceSans3-600.woff2', weight: '600'},
  {family: 'SourceSans', file: 'SourceSans3-700.woff2', weight: '700'},
  {family: 'SourceSans', file: 'SourceSans3-800.woff2', weight: '800'},
  {family: 'SourceSans', file: 'SourceSans3-900.woff2', weight: '900'},
];

export const fontsLoaded = Promise.all(
  fonts.map((f) =>
    loadFont({
      family: f.family,
      url: staticFile(`fonts/${f.file}`),
      weight: f.weight,
    }),
  ),
);
