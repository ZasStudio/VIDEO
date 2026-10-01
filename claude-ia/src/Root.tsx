import React from 'react';
import {Composition, Folder} from 'remotion';
import {ClaudeVideo, SCENES} from './ClaudeVideo';
import {DURATIONS, TOTAL} from './timeline';
import {FPS, HEIGHT, WIDTH} from './theme';
import './fonts';

const NAMES = ['Chispa', 'Anillos', 'Pensar', 'Chat', 'Razona', 'Cinta', 'Juntos', 'Tablero', 'Artefactos', 'Claras', 'Lejos', 'Entiende', 'Cierre'];

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="ClaudeIA"
      component={ClaudeVideo}
      durationInFrames={TOTAL}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{withAudio: true}}
    />
    <Folder name="Escenas">
      {SCENES.map((Scene, i) => (
        <Composition
          key={i}
          id={`${String(i + 1).padStart(2, '0')}-${NAMES[i]}`}
          component={Scene}
          durationInFrames={DURATIONS[i]}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
      ))}
    </Folder>
  </>
);
