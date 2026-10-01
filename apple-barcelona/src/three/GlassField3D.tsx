import {useThree} from '@react-three/fiber';
import {ThreeCanvas} from '@remotion/three';
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {EASE_OUT, clamp01} from '../anim';
import {GlassObject, type GlassShape} from './Glass';
import {GlowBackground, Studio} from './Studio';

// Fondo 3D con objetos de vidrio flotando (cámara fija y una deriva lenta).
// A z=0 el cuadro abarca aprox. x ±2.7, y ±4.8.

export type Floater = {shape: GlassShape; p: [number, number, number]; s: number; tint?: string; spin?: number};

const Cam: React.FC<{drift: number}> = ({drift}) => {
  const camera = useThree((s) => s.camera);
  camera.position.set(Math.sin(drift) * 0.6, Math.cos(drift * 0.7) * 0.3, 14);
  camera.lookAt(0, 0, 0);
  return null;
};

export const GlassField3D: React.FC<{items: Floater[]; startFrame: number; shake?: number}> = ({items, startFrame, shake = 0}) => {
  const f = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const t = f - startFrame;
  return (
    <ThreeCanvas width={width} height={height} camera={{fov: 38, position: [0, 0, 14]}} gl={{antialias: true}}>
      <Studio />
      <GlowBackground />
      <Cam drift={f / 90} />
      {items.map((g, i) => {
        const pin = EASE_OUT(clamp01((t - i * 3) / 22));
        const bob = Math.sin((f + i * 19) / 24) * 0.14;
        const jx = shake ? Math.sin(f * 2.3 + i) * 0.05 * shake : 0;
        const spin = g.spin ?? 1;
        return (
          <GlassObject
            key={i}
            shape={g.shape}
            position={[g.p[0] + jx, g.p[1] + bob - (1 - pin) * 1.2, g.p[2]]}
            rotation={[0.5 + f * 0.011 * spin, f * 0.016 * spin, 0.2 * i]}
            scale={g.s * (0.5 + 0.5 * pin)}
            tint={g.tint ?? '#ffffff'}
          />
        );
      })}
    </ThreeCanvas>
  );
};
