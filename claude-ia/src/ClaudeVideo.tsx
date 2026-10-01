import React from 'react';
import {AbsoluteFill, Series} from 'remotion';
import {S1Spark} from './scenes/S1Spark';
import {S2Rings} from './scenes/S2Rings';
import {S3Think} from './scenes/S3Think';
import {S4Chat} from './scenes/S4Chat';
import {S5Reason} from './scenes/S5Reason';
import {S6Frame} from './scenes/S6Frame';
import {S7Dashboard} from './scenes/S7Dashboard';
import {S8Artifact} from './scenes/S8Artifact';
import {S9Clear} from './scenes/S9Clear';
import {S10Forward} from './scenes/S10Forward';
import {S11Understand} from './scenes/S11Understand';
import {S12Outro} from './scenes/S12Outro';
import {Soundtrack} from './Soundtrack';
import {DURATIONS} from './timeline';
import {C} from './theme';

export const SCENES: React.FC[] = [
  S1Spark,
  S2Rings,
  S3Think,
  S4Chat,
  S5Reason,
  S6Frame,
  S7Dashboard,
  S8Artifact,
  S9Clear,
  S10Forward,
  S11Understand,
  S12Outro,
];

export const ClaudeVideo: React.FC<{withAudio: boolean}> = ({withAudio}) => (
  <AbsoluteFill style={{background: C.ink}}>
    <Series>
      {SCENES.map((Scene, i) => (
        <Series.Sequence key={i} durationInFrames={DURATIONS[i]}>
          <Scene />
        </Series.Sequence>
      ))}
    </Series>
    {withAudio ? <Soundtrack /> : null}
  </AbsoluteFill>
);
