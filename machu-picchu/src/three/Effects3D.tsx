import React, { useMemo } from "react";
import * as THREE from "three";
import { rand } from "../anim";

// Small 3D particle effects driven by frame numbers.

/** Dust ring puffing out along the ground at `at`. */
export const DustPuff: React.FC<{
  frame: number;
  at: number;
  position: [number, number, number];
  radius?: number;
  color?: string;
  count?: number;
}> = ({ frame, at, position, radius = 1.6, color = "#EFE6D6", count = 10 }) => {
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 1,
        flatShading: true,
        transparent: true,
        emissive: color,
        emissiveIntensity: 0.3,
      }),
    [color],
  );
  const d = frame - at;
  if (d < 0 || d > 20) return null;
  const t = d / 20;
  mat.opacity = 1 - t * t;
  return (
    <group position={position}>
      {Array.from({ length: count }).map((_, i) => {
        const a = (i / count) * Math.PI * 2 + rand(i) * 0.4;
        const r =
          radius *
          (0.35 + (1 - Math.pow(1 - t, 3)) * (0.9 + rand(i + 2) * 0.4));
        const s = radius * 0.22 * (1 - t * 0.7) * (0.7 + rand(i + 5) * 0.6);
        return (
          <mesh
            key={i}
            geometry={geo}
            material={mat}
            position={[
              Math.cos(a) * r,
              s * 0.8 + t * radius * 0.25,
              Math.sin(a) * r,
            ]}
            scale={s}
          />
        );
      })}
    </group>
  );
};

/** Sparks bursting out of a point (e.g. stone hitting stone). */
export const Sparks: React.FC<{
  frame: number;
  at: number;
  position: [number, number, number];
  color?: string;
  count?: number;
  spread?: number;
}> = ({ frame, at, position, color = "#FFD24A", count = 16, spread = 2.2 }) => {
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color, transparent: true }),
    [color],
  );
  const d = frame - at;
  if (d < 0 || d > 14) return null;
  const t = d / 14;
  mat.opacity = 1 - t;
  return (
    <group position={position}>
      {Array.from({ length: count }).map((_, i) => {
        const a = rand(i * 3 + at) * Math.PI * 2;
        const e = (rand(i * 7 + at) - 0.2) * 1.4;
        const v = spread * (0.6 + rand(i + at) * 0.8);
        const x = Math.cos(a) * Math.cos(e) * v * t;
        const y = Math.sin(e) * v * t - 2.5 * t * t;
        const z = Math.sin(a) * Math.cos(e) * v * t;
        const s = 0.09 * (1 - t);
        return (
          <mesh
            key={i}
            geometry={geo}
            material={mat}
            position={[x, y, z]}
            scale={[s, s, s * 3]}
            rotation={[a, e, 0]}
          />
        );
      })}
    </group>
  );
};

/** Floating sparkles (stars) that twinkle around a point. */
export const Twinkles: React.FC<{
  frame: number;
  at: number;
  position: [number, number, number];
  radius?: number;
  count?: number;
  color?: string;
}> = ({ frame, at, position, radius = 2, count = 10, color = "#FFF3A0" }) => {
  const geo = useMemo(() => new THREE.OctahedronGeometry(1, 0), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color }), [color]);
  const d = frame - at;
  if (d < 0 || d > 24) return null;
  return (
    <group position={position}>
      {Array.from({ length: count }).map((_, i) => {
        const local = d - rand(i + 1) * 8;
        if (local < 0) return null;
        const k = Math.sin(Math.min(1, local / 12) * Math.PI);
        const a = rand(i * 5) * Math.PI * 2;
        const r = radius * (0.4 + rand(i * 9) * 0.6);
        return (
          <mesh
            key={i}
            geometry={geo}
            material={mat}
            position={[
              Math.cos(a) * r,
              (rand(i * 13) - 0.3) * radius + local * 0.03,
              Math.sin(a) * r * 0.5 + 0.5,
            ]}
            scale={[0.08 * k, 0.22 * k, 0.08 * k]}
            rotation={[0, 0, local * 0.2]}
          />
        );
      })}
    </group>
  );
};
