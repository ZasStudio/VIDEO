import React from 'react';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Vidrio físico (transmisión real con refracción) para objetos 3D flotantes.
export const GlassMaterial: React.FC<{tint?: string; rough?: number; thickness?: number}> = ({
  tint = '#ffffff',
  rough = 0.1,
  thickness = 0.45,
}) => (
  <meshPhysicalMaterial
    color={tint}
    transmission={1}
    thickness={thickness}
    roughness={rough}
    ior={1.4}
    clearcoat={1}
    clearcoatRoughness={0.04}
    iridescence={0.6}
    iridescenceIOR={1.35}
    attenuationColor={tint}
    attenuationDistance={6}
    envMapIntensity={2.6}
    specularIntensity={1}
    sheen={0.4}
    sheenColor="#ffffff"
    sheenRoughness={0.3}
  />
);

const rounded = new RoundedBoxGeometry(1, 1, 1, 6, 0.22);

export type GlassShape = 'torus' | 'cube' | 'sphere' | 'capsule' | 'ring';

export const GlassObject: React.FC<{
  shape: GlassShape;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  tint?: string;
}> = ({shape, position, rotation = [0, 0, 0], scale = 1, tint}) => (
  <mesh position={position} rotation={rotation} scale={scale} geometry={shape === 'cube' ? rounded : undefined}>
    {shape === 'torus' ? <torusGeometry args={[0.6, 0.24, 48, 96]} /> : null}
    {shape === 'ring' ? <torusGeometry args={[0.7, 0.08, 32, 128]} /> : null}
    {shape === 'sphere' ? <sphereGeometry args={[0.55, 64, 64]} /> : null}
    {shape === 'capsule' ? <capsuleGeometry args={[0.28, 0.7, 16, 48]} /> : null}
    <GlassMaterial tint={tint} />
  </mesh>
);

export const roundedBox = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 6, r);
export {THREE};
