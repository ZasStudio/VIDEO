import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

// Manrope e Instrument Serif (SIL OFL), incluidas en public/fonts.
const fonts = [
  {family: 'Manrope', file: 'Manrope-300.woff2', weight: '300', style: 'normal'},
  {family: 'Manrope', file: 'Manrope-500.woff2', weight: '500', style: 'normal'},
  {family: 'Instrument Serif', file: 'InstrumentSerif-400.woff2', weight: '400', style: 'normal'},
  {family: 'Manrope', file: 'Manrope-700.woff2', weight: '700', style: 'normal'},
  {family: 'Manrope', file: 'Manrope-800.woff2', weight: '800', style: 'normal'},
  {family: 'Instrument Serif', file: 'InstrumentSerif-Italic.woff2', weight: '400', style: 'italic'},
];

export const fontsLoaded = Promise.all(
  fonts.map((f) => loadFont({family: f.family, url: staticFile(`fonts/${f.file}`), weight: f.weight, style: f.style})),
);
