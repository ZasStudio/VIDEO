import React from 'react';
import {Audio} from '@remotion/media';
import {Sequence, interpolate, staticFile} from 'remotion';
import {DURATION} from './theme';

// Every sound in this video was synthesized in code (scripts/generate-audio.mjs).
type Sfx =
  | 'whoosh'
  | 'whoosh-short'
  | 'pop'
  | 'click'
  | 'key'
  | 'typing'
  | 'cut'
  | 'impact'
  | 'scratch'
  | 'ding'
  | 'sparkle'
  | 'glitch'
  | 'riser';

// [global frame, sound, volume]
const CUES: [number, Sfx, number][] = [
  // Intro
  [2, 'whoosh-short', 0.45],
  [8, 'whoosh-short', 0.35],
  [26, 'pop', 0.45],
  [40, 'pop', 0.4],
  [70, 'pop', 0.55],
  [76, 'pop', 0.6],
  [82, 'sparkle', 0.4],
  [141, 'whoosh', 0.7],
  // Interface
  [152, 'whoosh', 0.5],
  [164, 'pop', 0.5],
  [174, 'pop', 0.45],
  [180, 'click', 0.6],
  [216, 'click', 0.6],
  [252, 'click', 0.6],
  [288, 'click', 0.6],
  [290, 'pop', 0.45],
  [324, 'click', 0.6],
  [366, 'whoosh-short', 0.55],
  // Editing
  [377, 'pop', 0.5],
  [385, 'click', 0.6],
  [399, 'pop', 0.45],
  [408, 'click', 0.6],
  [417, 'pop', 0.45],
  [424, 'click', 0.6],
  [431, 'pop', 0.45],
  [433, 'pop', 0.5],
  [439, 'key', 0.8],
  [455, 'cut', 0.8],
  [469, 'cut', 0.8],
  [485, 'pop', 0.5],
  [489, 'key', 0.8],
  [497, 'click', 0.6],
  [507, 'key', 0.8],
  [511, 'whoosh-short', 0.45],
  [523, 'key', 0.8],
  [537, 'pop', 0.5],
  [547, 'key', 0.8],
  [553, 'click', 0.6],
  [557, 'pop', 0.4],
  [588, 'ding', 0.6],
  // Break
  [600, 'glitch', 0.55],
  [606, 'whoosh-short', 0.5],
  [618, 'glitch', 0.45],
  [634, 'pop', 0.5],
  [656, 'glitch', 0.5],
  // AI features
  [675, 'impact', 0.55],
  [677, 'sparkle', 0.5],
  [681, 'typing', 0.5],
  [723, 'click', 0.6],
  [739, 'key', 0.8],
  [777, 'whoosh-short', 0.5],
  [782, 'sparkle', 0.45],
  [786, 'pop', 0.35],
  [790, 'pop', 0.35],
  [794, 'pop', 0.35],
  [798, 'pop', 0.35],
  [822, 'click', 0.6],
  [840, 'sparkle', 0.45],
  [882, 'whoosh-short', 0.5],
  [887, 'sparkle', 0.45],
  [912, 'click', 0.6],
  [947, 'ding', 0.5],
  [987, 'whoosh-short', 0.5],
  [992, 'sparkle', 0.45],
  [1034, 'whoosh-short', 0.45],
  [1054, 'ding', 0.5],
  [1092, 'whoosh-short', 0.5],
  [1097, 'sparkle', 0.45],
  [1106, 'click', 0.6],
  [1128, 'click', 0.6],
  [1119, 'riser', 0.3],
  [1179, 'sparkle', 0.55],
  [1181, 'ding', 0.5],
  // Outro
  [1190, 'whoosh', 0.65],
  [1204, 'pop', 0.45],
  [1212, 'pop', 0.45],
  [1222, 'pop', 0.5],
  [1234, 'pop', 0.5],
  [1275, 'impact', 0.6],
  [1281, 'sparkle', 0.5],
];

export const Soundtrack: React.FC = () => {
  return (
    <>
      <Sequence name="Música" layout="none">
        <Audio
          src={staticFile('audio/music.wav')}
          volume={(f) => interpolate(f, [0, 6, DURATION - 12, DURATION], [0, 0.9, 0.9, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
        />
      </Sequence>
      {CUES.map(([from, sfx, volume], i) => (
        <Sequence key={i} name={sfx} from={from} layout="none">
          <Audio src={staticFile(`audio/${sfx}.wav`)} volume={volume} />
        </Sequence>
      ))}
    </>
  );
};
