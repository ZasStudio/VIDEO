import {lightLeak} from '@remotion/effects/light-leak';
import React from 'react';
import {AbsoluteFill, Solid, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

// Destello de luz (light leak) sobre un corte: se revela en la primera mitad y se retira en la segunda.
// Se mezcla en modo "screen" para que solo sume luz cálida.
export const LeakOverlay: React.FC<{seed?: number; hueShift?: number; strength?: number}> = ({
  seed = 0,
  hueShift = 16,
  strength = 0.5,
}) => {
  const frame = useCurrentFrame();
  const {durationInFrames, width, height} = useVideoConfig();
  return (
    <AbsoluteFill style={{mixBlendMode: 'screen', opacity: strength, pointerEvents: 'none'}}>
      <Solid
        width={width}
        height={height}
        effects={[
          lightLeak({
            seed,
            hueShift,
            progress: interpolate(frame, [0, durationInFrames - 1], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }),
        ]}
      />
    </AbsoluteFill>
  );
};
