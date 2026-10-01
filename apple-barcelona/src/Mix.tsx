import {Audio} from '@remotion/media';
import React from 'react';
import {Sequence, interpolate, staticFile} from 'remotion';
import env from './voice-envelope.json';
import {SEGMENTS, TOTAL_FRAMES} from './edit';

// Mezcla: voz limpia cortada con la misma EDL que el video, música de fondo con
// "ducking" automático (baja mientras él habla) y efectos sutiles en los títulos.

const MUSIC_BED = 0.23; // nivel de la música cuando no hay voz
const DUCK = 0.6; // cuánto baja con voz (60 %)

/** Frame del original que corresponde a un frame de la edición. */
const sourceFrame = (f: number) => {
  for (const s of SEGMENTS) if (f >= s.at && f < s.at + (s.to - s.from)) return s.from + (f - s.at);
  return -1;
};

export type Sfx = {at: number; file: string; volume: number};

export const Mix: React.FC<{sfx: Sfx[]}> = ({sfx}) => (
  <>
    {SEGMENTS.map((s, i) => (
      <Sequence key={i} from={s.at} durationInFrames={s.to - s.from} layout="none">
        <Audio src={staticFile('voice.mp3')} trimBefore={s.from} trimAfter={s.to} volume={() => 1} />
      </Sequence>
    ))}
    <Audio
      src={staticFile('music.wav')}
      volume={(f) => {
        const src = sourceFrame(f);
        const speech = src >= 0 ? (env as number[])[Math.min(src, env.length - 1)] : 0;
        const fadeIn = interpolate(f, [0, 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        const fadeOut = interpolate(f, [TOTAL_FRAMES - 20, TOTAL_FRAMES - 1], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        return MUSIC_BED * (1 - DUCK * speech) * fadeIn * fadeOut;
      }}
    />
    {sfx.map((c, i) => (
      <Sequence key={i} from={c.at} durationInFrames={60} layout="none">
        <Audio src={staticFile(`sfx/${c.file}.wav`)} volume={() => c.volume} />
      </Sequence>
    ))}
  </>
);
