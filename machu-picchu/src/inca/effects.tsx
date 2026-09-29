import React, { useMemo } from "react";
import * as THREE from "three";
import { EASE_OUT, ramp, rand } from "../anim";
import { FONT } from "../theme";

// Small cartoon effects for the Inca-phone short: the costume-change poof, sweat drops for
// the exhausted chasqui and floating Zzz for the nap.

const POOF_COLORS = ["#FFFFFF", "#E8FFF1", "#FFE9F5", "#FFF7D6", "#E6F4FF"];

/** A puff of cartoon smoke that bursts out around `position` at frame `at` (world units). */
export const Poof: React.FC<{ frame: number; at: number; position: [number, number, number]; radius?: number }> = ({
  frame,
  at,
  position,
  radius = 2.2,
}) => {
  const puffs = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2 + rand(i * 3) * 0.4;
        const up = rand(i * 7) * 1.2 - 0.2;
        return {
          dir: new THREE.Vector3(Math.cos(a), up, Math.sin(a) * 0.8 + 0.3).normalize(),
          size: 0.55 + rand(i * 11) * 0.5,
          color: POOF_COLORS[i % POOF_COLORS.length],
          delay: rand(i * 5) * 3,
        };
      }),
    [],
  );
  const mats = useMemo(
    () =>
      POOF_COLORS.map(
        (c) =>
          new THREE.MeshStandardMaterial({
            color: c,
            emissive: new THREE.Color(c),
            emissiveIntensity: 0.55,
            roughness: 0.9,
            transparent: true,
            depthWrite: false,
          }),
      ),
    [],
  );
  const d = frame - at;
  if (d < -2 || d > 24) return null;
  return (
    <group position={position}>
      {puffs.map((p, i) => {
        const t = Math.max(0, d - p.delay) / 20;
        if (t <= 0) return null;
        const r = radius * (0.25 + 0.9 * (1 - Math.pow(1 - Math.min(1, t), 3)));
        const s = p.size * radius * 0.45 * (t < 0.25 ? t / 0.25 : 1 - (t - 0.25) * 0.9);
        const m = mats[POOF_COLORS.indexOf(p.color)];
        m.opacity = Math.max(0, 1 - Math.pow(t, 1.6));
        if (s <= 0.01) return null;
        return (
          <mesh key={i} position={[p.dir.x * r, p.dir.y * r + radius * 0.35, p.dir.z * r]} scale={s} material={m}>
            <icosahedronGeometry args={[1, 1]} />
          </mesh>
        );
      })}
    </group>
  );
};

/** Drops of sweat flicking off a tired character's head (world units, around `position`). */
export const SweatDrops: React.FC<{ frame: number; from: number; to: number; position: [number, number, number]; spread?: number }> = ({
  frame,
  from,
  to,
  position,
  spread = 1.4,
}) => {
  if (frame < from || frame > to + 20) return null;
  const drops = [];
  for (let k = 0; k < 6; k++) {
    const born = from + k * 9;
    if (born > to) break;
    const t = (frame - born) / 18;
    if (t < 0 || t > 1) continue;
    const side = k % 2 ? 1 : -1;
    drops.push(
      <mesh
        key={k}
        position={[position[0] + side * spread * (0.5 + t * 0.6), position[1] + 0.6 * t - 1.6 * t * t, position[2] + 0.3]}
        rotation={[0, 0, side * (0.4 + t)]}
        scale={[0.16, 0.24, 0.16].map((v) => v * (1 - t * 0.3)) as [number, number, number]}
      >
        <sphereGeometry args={[1, 12, 10]} />
        <meshStandardMaterial color="#6FD3FF" emissive="#6FD3FF" emissiveIntensity={0.5} roughness={0.2} transparent opacity={1 - t} />
      </mesh>,
    );
  }
  return <group>{drops}</group>;
};

/** "Z z z" rising from a sleeping character (screen pixels). */
export const Zzz: React.FC<{ frame: number; from: number; x: number; y: number }> = ({ frame, from, x, y }) => {
  if (frame < from) return null;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
      {[0, 1, 2, 3, 4].map((k) => {
        const t = (frame - from - k * 12) / 40;
        if (t < 0 || t > 1) return null;
        const size = 84 + k * 18;
        return (
          <div
            key={k}
            style={{
              position: "absolute",
              left: x + 40 + t * 120 + Math.sin(t * 6 + k) * 18,
              top: y - t * 260,
              fontFamily: FONT.title,
              fontSize: size,
              color: "#FFFFFF",
              WebkitTextStroke: `${Math.round(size * 0.14)}px #2B1B5A`,
              paintOrder: "stroke fill",
              opacity: ramp(t, 0, 0.15) * (1 - ramp(t, 0.7, 1)),
              transform: `rotate(${-12 + k * 6}deg) scale(${0.6 + ramp(t, 0, 0.3, [0, 0.4], EASE_OUT)})`,
            }}
          >
            Z
          </div>
        );
      })}
    </div>
  );
};
