import React from 'react';
import {AbsoluteFill} from 'remotion';
import {UrbanBackground} from '../mg/Urban';
import {C} from '../theme';

// Static assets rendered for the After Effects project (see ae/build-ae.ts).

export const AEBackground: React.FC<{variant: 'rojo' | 'oscuro' | 'poster'}> = ({variant}) => (
  <AbsoluteFill>
    <UrbanBackground frame={0} dark={variant === 'oscuro'} dots={variant !== 'poster'} />
  </AbsoluteFill>
);

export const AEGlowIA: React.FC = () => (
  <AbsoluteFill style={{boxShadow: `inset 0 0 140px ${C.ai}55`}} />
);
