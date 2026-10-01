import React from 'react';
import {AbsoluteFill, Sequence, interpolate, useCurrentFrame} from 'remotion';
import {Captions} from './Captions';
import {motionBlur} from './mg/Blur';
import {MGEffort} from './mg/MGEffort';
import {MGFear} from './mg/MGFear';
import {MGSpain} from './mg/MGSpain';
import {MGTool} from './mg/MGTool';
import {FPS, EDIT_FRAMES, TOTAL_FRAMES} from './edit';
import {Footage} from './Footage';
import {Mix, type Sfx} from './Mix';
import {EndCard, Hook, ProductChip, SpokenQuote} from './Overlays';
import {findPhrase} from './words';

const fr = (ms: number) => Math.round((ms / 1000) * FPS);

// Momentos del guion (calculados desde las palabras transcritas, no a mano).
const QUOTE_START = fr(findPhrase('el que busca')[0].startMs) - 4;
const QUOTE_END = fr(findPhrase('cuando uno llega')[0].startMs) - 2;
const FINAL_START = fr(findPhrase('porque si yo pude')[0].startMs) - 4;
const END_CARD = Math.max(fr(findPhrase('lograrlo')[0].endMs) + 4, EDIT_FRAMES - 12);
const PRODUCT = {from: fr(17250), to: fr(18350)}; // página del MacBook Pro 16" en pantalla

// Interludios de motion graphics sobre negro (la voz sigue; el video vuelve después).
// Empiezan y terminan en palabras concretas del guion.
type Interlude = {from: number; to: number; Scene: React.FC};
const INTERLUDES: Interlude[] = [
  // tras la página del MacBook (también evita el destello blanco del original)
  {from: PRODUCT.to + 1, to: fr(findPhrase('no ha sido fácil')[0].startMs) - 3, Scene: MGTool},
  {from: fr(findPhrase('no ha sido fácil')[0].startMs) - 3, to: fr(findPhrase('pero como siempre')[0].startMs) - 2, Scene: MGEffort},
  {from: fr(findPhrase('cuando uno llega')[0].startMs) - 3, to: fr(findPhrase('con ganas de salir')[0].startMs) - 2, Scene: MGSpain},
  {from: fr(findPhrase('todo comienzo')[0].startMs) - 3, to: fr(findPhrase('sé constante')[0].startMs) - 2, Scene: MGFear},
];
const MG_IN = 8; // frames de entrada del interludio
const MG_OUT = 6; // frames de salida
const VIDEO_OUT = 5; // el video se "lanza" hacia el interludio
const VIDEO_IN = 12; // el video vuelve y se asienta

/** Transición del video alrededor de los interludios: zoom + desenfoque al irse, frenado al volver. */
const videoCam = (f: number) => {
  for (const it of INTERLUDES) {
    if (f >= it.from - VIDEO_OUT && f < it.from) {
      const k = (f - (it.from - VIDEO_OUT)) / VIDEO_OUT; // 0 -> 1 acelerando
      const e = k * k;
      return {scale: 1 + 0.22 * e, blur: e, dim: 0.5 * e};
    }
    if (f >= it.to && f < it.to + VIDEO_IN) {
      const k = (f - it.to) / VIDEO_IN;
      const e = 1 - Math.pow(2, -10 * k); // expo-out
      return {scale: 1.18 - 0.18 * e, blur: 1 - e, dim: 0.4 * (1 - e)};
    }
  }
  return {scale: 1, blur: 0, dim: 0};
};

const InterludeLayer: React.FC = () => {
  const f = useCurrentFrame();
  const it = INTERLUDES.find((x) => f >= x.from && f < x.to);
  if (!it) return null;
  const kin = Math.min(1, (f - it.from) / MG_IN);
  const ein = 1 - Math.pow(2, -10 * kin);
  const kout = Math.max(0, (f - (it.to - MG_OUT)) / MG_OUT);
  const eout = kout * kout;
  // Los dos primeros interludios van seguidos: entre ellos, corte con "empuje" en vez de zoom.
  const chained = INTERLUDES.some((x) => x.to === it.from);
  const chainedOut = INTERLUDES.some((x) => x.from === it.to);
  const scale = (chained ? 1 : 0.9 + 0.1 * ein) * (chainedOut ? 1 : 1 + 0.14 * eout);
  const blur = Math.max(chained ? 0 : 1 - ein, chainedOut ? 0 : eout);
  const y = chained ? (1 - ein) * 160 : 0;
  const yOut = chainedOut ? -eout * 160 : 0;
  // Fondo negro fijo detrás: al escalar el interludio nunca se ve el video por los bordes.
  const bgOpacity = Math.min(chained ? 1 : ein * 1.6, chainedOut ? 1 : 1 - eout * 0.6);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{background: '#050506', opacity: bgOpacity}} />
      <AbsoluteFill style={{scale: String(scale), translate: `0px ${y + yOut}px`, filter: motionBlur(blur * 0.9, chained || chainedOut ? 'y' : 'x')}}>
        <it.Scene />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const VideoWithCam: React.FC = () => {
  const f = useCurrentFrame();
  const cam = videoCam(f);
  return (
    <AbsoluteFill style={{scale: String(cam.scale), filter: cam.blur > 0.01 ? `blur(${cam.blur * 14}px) brightness(${1 - cam.dim})` : undefined}}>
      <Footage />
    </AbsoluteFill>
  );
};

const SFX: Sfx[] = [
  {at: 2, file: 'whoosh-soft', volume: 0.35},
  {at: 10, file: 'sparkle', volume: 0.18},
  {at: PRODUCT.from, file: 'pop', volume: 0.35},
  {at: QUOTE_START, file: 'whoosh-soft', volume: 0.3},
  ...INTERLUDES.flatMap((it): Sfx[] => [
    {at: Math.max(0, it.from - 4), file: 'whoosh', volume: 0.32},
    {at: it.to - 3, file: 'whoosh-soft', volume: 0.28},
  ]),
  {at: fr(findPhrase('esfuerzo')[0].startMs), file: 'pop', volume: 0.3},
  {at: fr(findPhrase('sacrificio')[0].startMs), file: 'pop', volume: 0.3},
  {at: fr(findPhrase('constancia')[0].startMs), file: 'pop', volume: 0.3},
  {at: fr(findPhrase('sueños')[0].startMs), file: 'sparkle', volume: 0.35},
  {at: fr(findPhrase('de trabajo')[0].startMs), file: 'sparkle', volume: 0.25},
  {at: fr(findPhrase('te detenga')[0].startMs), file: 'whoosh', volume: 0.3},
  {at: FINAL_START, file: 'impact', volume: 0.3},
  {at: END_CARD, file: 'chime', volume: 0.32},
];

/** Fundido a negro final. */
const FadeOut: React.FC = () => {
  const f = useCurrentFrame();
  const o = interpolate(f, [TOTAL_FRAMES - 12, TOTAL_FRAMES - 1], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{background: '#000', opacity: o}} />;
};

export const VlogEdit: React.FC<{withAudio: boolean}> = ({withAudio}) => {
  const holes: [number, number][] = [
    ...INTERLUDES.map((it): [number, number] => [(it.from / FPS) * 1000, (it.to / FPS) * 1000]),
    [(QUOTE_START / FPS) * 1000, (QUOTE_END / FPS) * 1000],
    [(FINAL_START / FPS) * 1000, 999999],
  ];
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <VideoWithCam />
      <InterludeLayer />
      <Captions holes={holes} />
      <Sequence durationInFrames={fr(3900)} layout="absolute-fill">
        <Hook />
      </Sequence>
      <ProductChip from={PRODUCT.from} to={PRODUCT.to} />
      <SpokenQuote
        lines={[['El', 'que', 'busca,'], ['encuentra.'], ['Y', 'el', 'que', 'no', 'se', 'rinde,'], ['lo', 'logra.']]}
        from={QUOTE_START}
        to={QUOTE_END}
        size={98}
        accent={['encuentra.', 'logra.']}
      />
      <SpokenQuote
        lines={[['Porque', 'si', 'yo', 'pude,'], ['tú', 'también'], ['puedes', 'lograrlo.']]}
        from={FINAL_START}
        to={END_CARD + 2}
        serif={false}
        size={112}
        accent={['tú', 'también', 'puedes', 'lograrlo.']}
      />
      <EndCard from={END_CARD} />
      <FadeOut />
      {withAudio ? <Mix sfx={SFX} /> : null}
    </AbsoluteFill>
  );
};
