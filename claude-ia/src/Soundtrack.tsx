import {Audio} from '@remotion/media';
import React from 'react';
import {Sequence, staticFile} from 'remotion';
import {CUES} from './cues';

export const Soundtrack: React.FC = () => (
  <>
    <Audio src={staticFile('audio/music.wav')} volume={0.72} />
    {CUES.map((c, i) => (
      <Sequence key={i} from={c.frame} durationInFrames={90} layout="none">
        <Audio src={staticFile(`audio/${c.file}.wav`)} volume={() => c.volume} />
      </Sequence>
    ))}
  </>
);
