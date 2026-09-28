import React from 'react';
import {Composition, Folder} from 'remotion';
import {PremiereIAVideo} from './PremiereIAVideo';
import {CharacterSheet} from './dev/CharacterSheet';
import {UISheet} from './dev/UISheet';
import {AEBackground, AEGlowIA} from './dev/AEAssets';
import {AICardScene} from './scenes/AICardScene';
import {AIScene} from './scenes/AIScene';
import {EditingScene} from './scenes/EditingScene';
import {InterfaceScene} from './scenes/InterfaceScene';
import {IntroScene} from './scenes/IntroScene';
import {OutroScene} from './scenes/OutroScene';
import './fonts';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="PremiereIA" component={PremiereIAVideo} durationInFrames={1350} fps={30} width={1920} height={1080} defaultProps={{withAudio: true}} />
      <Folder name="Escenas">
        <Composition id="Intro" component={IntroScene} durationInFrames={150} fps={30} width={1920} height={1080} />
        <Composition id="Interfaz" component={InterfaceScene} durationInFrames={225} fps={30} width={1920} height={1080} />
        <Composition id="Edicion" component={EditingScene} durationInFrames={225} fps={30} width={1920} height={1080} />
        <Composition id="IACard" component={AICardScene} durationInFrames={75} fps={30} width={1920} height={1080} />
        <Composition id="IA" component={AIScene} durationInFrames={525} fps={30} width={1920} height={1080} />
        <Composition id="Cierre" component={OutroScene} durationInFrames={150} fps={30} width={1920} height={1080} />
      </Folder>
      <Folder name="AfterEffects">
        <Composition id="AE-Plate-Interfaz" component={InterfaceScene} durationInFrames={225} fps={30} width={1920} height={1080} defaultProps={{plate: true}} />
        <Composition id="AE-Plate-Edicion" component={EditingScene} durationInFrames={225} fps={30} width={1920} height={1080} defaultProps={{plate: true}} />
        <Composition id="AE-Plate-IA" component={AIScene} durationInFrames={525} fps={30} width={1920} height={1080} defaultProps={{plate: true}} />
        <Composition id="AE-Fondo-Rojo" component={AEBackground} durationInFrames={1} fps={30} width={1920} height={1080} defaultProps={{variant: 'rojo' as const}} />
        <Composition id="AE-Fondo-Oscuro" component={AEBackground} durationInFrames={1} fps={30} width={1920} height={1080} defaultProps={{variant: 'oscuro' as const}} />
        <Composition id="AE-Fondo-Poster" component={AEBackground} durationInFrames={1} fps={30} width={1920} height={1080} defaultProps={{variant: 'poster' as const}} />
        <Composition id="AE-Brillo-IA" component={AEGlowIA} durationInFrames={1} fps={30} width={1920} height={1080} />
      </Folder>
      <Folder name="Dev">
        <Composition id="CharacterSheet" component={CharacterSheet} durationInFrames={120} fps={30} width={1920} height={1080} />
        <Composition id="UISheet" component={UISheet} durationInFrames={120} fps={30} width={1920} height={1080} />
      </Folder>
    </>
  );
};
