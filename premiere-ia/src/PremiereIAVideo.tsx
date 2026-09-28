import React from 'react';
import {AbsoluteFill, Series, useCurrentFrame} from 'remotion';
import {Flash, SlashWipe} from './mg/Urban';
import {Soundtrack} from './Soundtrack';
import {AICardScene} from './scenes/AICardScene';
import {AIScene} from './scenes/AIScene';
import {EditingScene} from './scenes/EditingScene';
import {InterfaceScene} from './scenes/InterfaceScene';
import {IntroScene} from './scenes/IntroScene';
import {OutroScene} from './scenes/OutroScene';
import {C} from './theme';

const Transitions: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <SlashWipe frame={frame} at={150} />
      <SlashWipe frame={frame} at={375} colors={[C.yellow, C.ink]} dur={9} />
      <Flash frame={frame} at={600} color={C.white} dur={6} />
      <Flash frame={frame} at={675} color={C.ai} dur={10} />
      <SlashWipe frame={frame} at={1200} />
    </AbsoluteFill>
  );
};

export const PremiereIAVideo: React.FC<{withAudio: boolean}> = ({withAudio}) => {
  return (
    <AbsoluteFill style={{backgroundColor: C.red}}>
      <Series>
        <Series.Sequence name="Intro" durationInFrames={150}>
          <IntroScene />
        </Series.Sequence>
        <Series.Sequence name="La interfaz" durationInFrames={225}>
          <InterfaceScene />
        </Series.Sequence>
        <Series.Sequence name="Edita en 4 pasos" durationInFrames={225}>
          <EditingScene />
        </Series.Sequence>
        <Series.Sequence name="¿Y la IA?" durationInFrames={75}>
          <AICardScene />
        </Series.Sequence>
        <Series.Sequence name="Funciones con IA" durationInFrames={525}>
          <AIScene />
        </Series.Sequence>
        <Series.Sequence name="Cierre" durationInFrames={150}>
          <OutroScene />
        </Series.Sequence>
      </Series>
      <Transitions />
      {withAudio ? <Soundtrack /> : null}
    </AbsoluteFill>
  );
};
