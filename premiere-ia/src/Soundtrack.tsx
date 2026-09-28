import React from 'react';
import {Audio} from '@remotion/media';
import {Sequence, interpolate, staticFile} from 'remotion';
import {DURATION} from './theme';
import {CUES} from './cues';


export const Soundtrack: React.FC = () => {
  return (
    <>
      <Sequence name="Música" layout="none">
        <Audio
          src={staticFile('audio/music.wav')}
          volume={(f) => interpolate(f, [0, 6, DURATION - 12, DURATION], [0, 0.8, 0.8, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
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
