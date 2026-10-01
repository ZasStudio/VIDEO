import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

// Manrope e Instrument Serif (SIL OFL), incluidas en public/fonts.
const fonts: {family: string; file: string; weight: string; style?: string}[] = [
  {family: 'Manrope', file: 'Manrope-400.woff2', weight: '400'},
  {family: 'Manrope', file: 'Manrope-500.woff2', weight: '500'},
  {family: 'Manrope', file: 'Manrope-700.woff2', weight: '700'},
  {family: 'Manrope', file: 'Manrope-800.woff2', weight: '800'},
  {family: 'Instrument Serif', file: 'InstrumentSerif-400.woff2', weight: '400'},
  {family: 'Instrument Serif', file: 'InstrumentSerif-Italic.woff2', weight: '400', style: 'italic'},
];

export const fontsLoaded = Promise.all(
  fonts.map((f) =>
    loadFont({
      family: f.family,
      url: staticFile(`fonts/${f.file}`),
      weight: f.weight,
      style: f.style ?? 'normal',
    }),
  ),
);
