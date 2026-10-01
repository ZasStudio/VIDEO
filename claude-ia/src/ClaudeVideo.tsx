import React from 'react';
import {AbsoluteFill, Sequence, Series} from 'remotion';
import {S1Spark} from './scenes/S1Spark';
import {S2Rings} from './scenes/S2Rings';
import {S3Think} from './scenes/S3Think';
import {S4Chat} from './scenes/S4Chat';
import {S5Reason} from './scenes/S5Reason';
import {S6Frame} from './scenes/S6Frame';
import {SJTogether} from './scenes/SJTogether';
import {S7Dashboard} from './scenes/S7Dashboard';
import {S8Artifact} from './scenes/S8Artifact';
import {S9Clear} from './scenes/S9Clear';
import {S10Forward} from './scenes/S10Forward';
import {S11Understand} from './scenes/S11Understand';
import {S12Outro} from './scenes/S12Outro';
import {Soundtrack} from './Soundtrack';
import {MotionBlurDirector, SceneCamera} from './camera';
import {LeakOverlay} from './mg/LeakOverlay';
import {BlurDefs} from './mg/Blur';
import {DURATIONS, STARTS} from './timeline';
import {C} from './theme';

export const SCENES: React.FC[] = [
  S1Spark,
  S2Rings,
  S3Think,
  S4Chat,
  S5Reason,
  S6Frame,
  SJTogether,
  S7Dashboard,
  S8Artifact,
  S9Clear,
  S10Forward,
  S11Understand,
  S12Outro,
];

// Índice de la escena que empieza en el corte, semilla y tono del destello.
const LEAKS = [
  {scene: 3, seed: 2, hue: 16},
  {scene: 6, seed: 5, hue: 22},
  {scene: 7, seed: 8, hue: 14},
  {scene: 12, seed: 3, hue: 10},
];

export const ClaudeVideo: React.FC<{withAudio: boolean}> = ({withAudio}) => (
  <AbsoluteFill style={{background: C.ink}}>
    <BlurDefs />
    <MotionBlurDirector>
      <Series>
        {SCENES.map((Scene, i) => (
          <Series.Sequence key={i} durationInFrames={DURATIONS[i]}>
            <SceneCamera index={i}>
              <Scene />
            </SceneCamera>
          </Series.Sequence>
        ))}
      </Series>
    </MotionBlurDirector>
    {/* Destellos de luz sobre los cortes clave (no acortan la línea de tiempo) */}
    {LEAKS.map((l) => (
      <Sequence key={l.scene} from={STARTS[l.scene] - 14} durationInFrames={30} layout="absolute-fill">
        <LeakOverlay seed={l.seed} hueShift={l.hue} />
      </Sequence>
    ))}
    {withAudio ? <Soundtrack /> : null}
  </AbsoluteFill>
);
