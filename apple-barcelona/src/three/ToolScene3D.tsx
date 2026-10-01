import {useThree} from '@react-three/fiber';
import {ThreeCanvas} from '@remotion/three';
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {EASE_IN_OUT, EASE_OUT, clamp01} from '../anim';
import {GlassObject, type GlassShape} from './Glass';
import {MacBook3D} from './MacBook3D';
import {GlowBackground, Studio} from './Studio';

// Escena 3D del interludio "una herramienta de trabajo": la MacBook de aluminio se abre
// mientras la cámara la rodea, rodeada de objetos de vidrio que flotan y refractan la luz.

const Rig: React.FC<{orbit: number; height: number; dist: number}> = ({orbit, height, dist}) => {
  const camera = useThree((s) => s.camera);
  camera.position.set(Math.sin(orbit) * dist, height, Math.cos(orbit) * dist);
  // mirar por debajo del portátil para que quede en la mitad superior del cuadro vertical
  camera.lookAt(0, -0.2, 0);
  return null;
};

const FLOATERS: {shape: GlassShape; p: [number, number, number]; s: number; tint: string; spin: number}[] = [
  {shape: 'torus', p: [-2.0, 3.6, -0.8], s: 0.85, tint: '#ffd0da', spin: 1},
  {shape: 'sphere', p: [2.1, 3.2, 0.2], s: 0.75, tint: '#fff3c4', spin: -1},
  {shape: 'cube', p: [-2.2, 0.9, 1.6], s: 0.5, tint: '#ffffff', spin: 1.3},
  {shape: 'capsule', p: [2.2, 0.8, 1.4], s: 0.7, tint: '#ffd0da', spin: -0.8},
  {shape: 'ring', p: [0.3, 4.4, -2.4], s: 1.2, tint: '#ffffff', spin: 0.6},
];

export const ToolScene3D: React.FC<{open: number; glow: number; enterFrame: number}> = ({open, glow, enterFrame}) => {
  const f = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const t = f - enterFrame;
  const orbit = -0.75 + 0.85 * EASE_IN_OUT(clamp01(t / 110));
  const camH = 5.2 - 1.6 * EASE_OUT(clamp01(t / 90));
  const enter = EASE_OUT(clamp01(t / 18));

  return (
    <ThreeCanvas width={width} height={height} camera={{fov: 38, position: [0, 4, 14]}} gl={{antialias: true}}>
      <Studio />
      <Rig orbit={orbit} height={camH} dist={15.5 - 2 * enter} />
      <GlowBackground />
      <group position={[0, 0.6, 0]} rotation={[0, 0, 0]} scale={0.85 + 0.15 * enter}>
        <MacBook3D open={open} glow={glow} />
      </group>
      {FLOATERS.map((g, i) => {
        const pin = EASE_OUT(clamp01((t - 4 - i * 3) / 20));
        const bob = Math.sin((f + i * 23) / 22) * 0.12;
        return (
          <GlassObject
            key={i}
            shape={g.shape}
            position={[g.p[0], g.p[1] + bob - (1 - pin) * 0.8, g.p[2]]}
            rotation={[0.4 + f * 0.012 * g.spin, f * 0.018 * g.spin, 0.3]}
            scale={g.s * (0.6 + 0.4 * pin)}
            tint={g.tint}
          />
        );
      })}
    </ThreeCanvas>
  );
};
