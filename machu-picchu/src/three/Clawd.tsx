import React, { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { C } from "../theme";
import { BlobShadow } from "./BlobShadow";

// Clawd, the Claude Code mascot, rebuilt from its terminal pixel art as voxels.
// Terminal pixels are twice as tall as they are wide, so one pixel = 1 x 2 units:
//   body 12 x 8, eyes 1 x 2 on the second row, arms 2 x 2 on the third row,
//   four 1 x 2 legs under the body (2nd and 4th pixel from each side).
// The model is 10 units tall; `size` scales it to world units.

export type ClawdPose = {
  /** Vertical hop offset in model units. */
  hop?: number;
  /** 1 = rest, < 1 squashed, > 1 stretched (volume preserved). */
  squash?: number;
  yaw?: number;
  pitch?: number;
  roll?: number;
  /** Arm raise on screen-left / screen-right: 0 = rest, 1 = level with the top, 1.5 = above the head. */
  armL?: number;
  armR?: number;
  /** Push the arm outwards (model units), for pointing. */
  reachL?: number;
  reachR?: number;
  /** Walk cycle phase (radians) and amplitude 0..1. */
  walkPhase?: number;
  walk?: number;
  /** 0 = open, 1 = closed. */
  blink?: number;
  /** 1 = normal; > 1 surprised, < 1 squinting. */
  eyeScale?: number;
  /** Eye offset on the face, -1..1. */
  lookX?: number;
  lookY?: number;
  /** Chullo hat: 0 = none, 1 = on head. `hatDrop` lifts it (model units). */
  hat?: number;
  hatDrop?: number;
};

const EYE = "#16120F";

// Andean chullo palette.
const HAT = {
  red: "#E0322B",
  yellow: "#FFC21A",
  green: "#1FA35B",
  blue: "#1E6BFF",
  pink: "#FF4F9A",
  white: "#FFF6E8",
};

const useRounded = (w: number, h: number, d: number, r: number) =>
  useMemo(() => new RoundedBoxGeometry(w, h, d, 3, r), [w, h, d, r]);

const Leg: React.FC<{
  x: number;
  lift: number;
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
}> = ({ x, lift, geo, mat }) => (
  <mesh geometry={geo} material={mat} position={[x, 1 + lift, 0]} castShadow />
);

export const Clawd: React.FC<{
  pose?: ClawdPose;
  size?: number;
  position?: [number, number, number];
  rotationY?: number;
  shadow?: boolean;
  shadowOpacity?: number;
  /** Extra objects in model units, attached to the body (e.g. an umbrella). */
  children?: React.ReactNode;
}> = ({
  pose = {},
  size = 2,
  position = [0, 0, 0],
  rotationY = 0,
  shadow = true,
  shadowOpacity = 0.35,
  children,
}) => {
  const {
    hop = 0,
    squash = 1,
    yaw = 0,
    pitch = 0,
    roll = 0,
    armL = 0,
    armR = 0,
    reachL = 0,
    reachR = 0,
    walkPhase = 0,
    walk = 0,
    blink = 0,
    eyeScale = 1,
    lookX = 0,
    lookY = 0,
    hat = 0,
    hatDrop = 0,
  } = pose;

  const bodyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: C.clawd,
        roughness: 0.5,
        metalness: 0,
        emissive: new THREE.Color(C.clawd),
        emissiveIntensity: 0.24,
      }),
    [],
  );
  const eyeMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: EYE, roughness: 0.3 }),
    [],
  );
  const bodyGeo = useRounded(12, 8, 7, 0.45);
  const armGeo = useRounded(2, 2, 2.2, 0.3);
  const legGeo = useRounded(1, 2.2, 2, 0.25);
  const eyeGeo = useRounded(1, 2, 0.5, 0.18);

  const s = size / 10;
  const sq = Math.max(0.3, squash);
  const sx = 1 / Math.sqrt(sq);

  // Walk: legs alternate in pairs (outer-left + inner-right, inner-left + outer-right).
  const liftA = walk * Math.max(0, Math.sin(walkPhase)) * 0.9;
  const liftB = walk * Math.max(0, Math.sin(walkPhase + Math.PI)) * 0.9;

  const eyeH = Math.max(0.12, (1 - blink) * eyeScale);
  const eyeW = Math.min(1.35, Math.max(0.8, eyeScale));
  const ex = lookX * 0.45;
  const ey = lookY * 0.35;

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={s}>
      {shadow ? (
        <BlobShadow
          radius={8.5 - Math.min(3, hop * 0.25)}
          opacity={shadowOpacity * Math.max(0.35, 1 - hop * 0.06)}
        />
      ) : null}
      <group position={[0, hop, 0]} rotation={[pitch, yaw, roll]}>
        {/* Squash and stretch pivots at the feet. */}
        <group scale={[sx, sq, sx]}>
          <Leg x={-4.5} lift={liftA} geo={legGeo} mat={bodyMat} />
          <Leg x={-2.5} lift={liftB} geo={legGeo} mat={bodyMat} />
          <Leg x={2.5} lift={liftA} geo={legGeo} mat={bodyMat} />
          <Leg x={4.5} lift={liftB} geo={legGeo} mat={bodyMat} />
          <mesh
            geometry={bodyGeo}
            material={bodyMat}
            position={[0, 6, 0]}
            castShadow
          />
          {/* Eyes on the front face. */}
          <mesh
            geometry={eyeGeo}
            material={eyeMat}
            position={[-3.5 + ex, 7 + ey, 3.42]}
            scale={[eyeW, eyeH, 1]}
          />
          <mesh
            geometry={eyeGeo}
            material={eyeMat}
            position={[3.5 + ex, 7 + ey, 3.42]}
            scale={[eyeW, eyeH, 1]}
          />
          {/* Arms are side nubs: raising slides them up the body (like the pixel art) and tilts them out. */}
          <mesh
            geometry={armGeo}
            material={bodyMat}
            position={[-7 - reachL - armL * 0.55, 5 + armL * 3.7, 0]}
            rotation={[0, 0, armL * 0.45]}
            castShadow
          />
          <mesh
            geometry={armGeo}
            material={bodyMat}
            position={[7 + reachR + armR * 0.55, 5 + armR * 3.7, 0]}
            rotation={[0, 0, -armR * 0.45]}
            castShadow
          />
          {hat > 0 ? <Chullo y={10 + hatDrop} scale={hat} /> : null}
          {children}
        </group>
      </group>
    </group>
  );
};

// Knitted Andean hat with ear flaps, tassels and a pompom, in voxels.
const Chullo: React.FC<{ y: number; scale: number }> = ({ y, scale }) => {
  const mats = useMemo(() => {
    const m: Record<string, THREE.MeshStandardMaterial> = {};
    for (const [k, v] of Object.entries(HAT))
      m[k] = new THREE.MeshStandardMaterial({ color: v, roughness: 0.85 });
    return m;
  }, []);
  const band = useRounded(12.8, 1.3, 7.8, 0.3);
  const crown = useRounded(12.2, 1.5, 7.3, 0.4);
  const mid = useRounded(10.2, 1.2, 6.2, 0.45);
  const top = useRounded(6.8, 1.0, 4.4, 0.4);
  const pom = useRounded(2.2, 2.0, 2.2, 0.75);
  const flap = useRounded(1.2, 3.2, 3.4, 0.3);
  const dot = useRounded(0.9, 0.7, 0.3, 0.1);
  const tassel = useRounded(0.5, 1.8, 0.5, 0.15);

  const dots = [-5, -3, -1, 1, 3, 5];
  return (
    <group position={[0, y, 0]} scale={scale}>
      <mesh
        geometry={band}
        material={mats.red}
        position={[0, 0.25, 0]}
        castShadow
      />
      {dots.map((x, i) => (
        <mesh
          key={i}
          geometry={dot}
          material={i % 2 ? mats.yellow : mats.white}
          position={[x, 0.25, 3.95]}
        />
      ))}
      <mesh
        geometry={crown}
        material={mats.yellow}
        position={[0, 1.6, 0]}
        castShadow
      />
      {[-4.5, -1.5, 1.5, 4.5].map((x, i) => (
        <mesh
          key={`g${i}`}
          geometry={dot}
          material={i % 2 ? mats.red : mats.green}
          position={[x, 1.6, 3.7]}
        />
      ))}
      <mesh
        geometry={mid}
        material={mats.red}
        position={[0, 2.9, 0]}
        castShadow
      />
      <mesh
        geometry={top}
        material={mats.blue}
        position={[0, 3.95, 0]}
        castShadow
      />
      <mesh
        geometry={pom}
        material={mats.yellow}
        position={[0, 5.3, 0]}
        castShadow
      />
      {/* Ear flaps with tassels. */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 6.75, -1.1, 0]}>
          <mesh geometry={flap} material={mats.red} />
          <mesh
            geometry={dot}
            material={mats.yellow}
            position={[side * 0.62, 0.4, 0]}
            rotation={[0, (side * Math.PI) / 2, 0]}
          />
          <mesh
            geometry={tassel}
            material={mats.yellow}
            position={[0, -2.4, 0]}
          />
        </group>
      ))}
    </group>
  );
};
