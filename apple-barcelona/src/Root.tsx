import React from 'react';
import {Composition} from 'remotion';
import {FPS, TOTAL_FRAMES} from './edit';
import {HEIGHT, WIDTH} from './theme';
import {VlogEdit} from './VlogEdit';
import './fonts';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="AppleBarcelona"
    component={VlogEdit}
    durationInFrames={TOTAL_FRAMES}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
    defaultProps={{withAudio: true}}
  />
);
