import React, { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { BlobShadow } from "./BlobShadow";

// Nubi: a soft mint-green vinyl toy. A rounded cube body with two black eyes, a tapered
// fin on each side and a ring of eight short block legs (six of them show from the front,
// like a little octopus). No mouth: it talks with its body.
// Model units: the body is 10 wide; `size` is the body width in world units.

export type NubiPose = {
  /** Vertical hop offset in model units. */
  hop?: number;
  /** 1 = rest, < 1 squashed, > 1 stretched (volume preserved). */
  squash?: number;
  yaw?: number;
  pitch?: number;
  roll?: number;
  /** Fin raise on screen-left / screen-right: 0 = rest, 1 = tip up, -0.5 = tip down. */
  finL?: number;
  finR?: number;
  /** Legs paddle in a wave: amplitude 0..1 and phase (radians). */
  wiggle?: number;
  wigglePhase?: number;
  /** 0 = open, 1 = closed. */
  blink?: number;
  /** 1 = normal; > 1 surprised, < 1 squinting. */
  eyeScale?: number;
  /** Eye offset on the face, -1..1. */
  lookX?: number;
  lookY?: number;
};

export const NUBI_GREEN = "#8EDCA2";
const EYE = "#151515";

const BODY = { w: 10, h: 7.4, d: 8.8, y: 6.2 };
const LEG = { w: 1.95, h: 2.6, l: 3.9 };
// Front is +z. Eight legs as on the toy: a parallel pair at the front, then pairs angled
// out at the front corners, at the sides and at the back. From the front six show.
// [x, z] of the leg's inner end and its heading (radians, 0 = forward).
const LEGS: [number, number, number][] = [
  [-1.3, 1.6, 0],
  [1.3, 1.6, 0],
  [-2.4, 1.2, -0.72],
  [2.4, 1.2, 0.72],
  [-2.6, -0.9, -1.72],
  [2.6, -0.9, 1.72],
  [-1.5, -2.2, -2.75],
  [1.5, -2.2, 2.75],
];

const useRounded = (w: number, h: number, d: number, r: number) =>
  useMemo(() => new RoundedBoxGeometry(w, h, d, 4, r), [w, h, d, r]);

/** Rounded block that narrows towards +x (the fin tip). */
const useFinGeometry = () =>
  useMemo(() => {
    const len = 2.6;
    const g = new RoundedBoxGeometry(len, 2.7, 3.0, 4, 0.4);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const t = (p.getX(i) + len / 2) / len; // 0 at the base, 1 at the tip
      const k = 1 - 0.62 * t;
      // Wedge: narrows to a blunt tip that dips a touch and points slightly forward.
      p.setY(i, p.getY(i) * k - 0.2 * t);
      p.setZ(i, p.getZ(i) * (1 - 0.5 * t) + 0.3 * t);
      p.setX(i, p.getX(i) + len / 2);
    }
    g.computeVertexNormals();
    return g;
  }, []);

/** Where a held object sits on a fin (fin space, model units): just inside the tip. */
export const NUBI_FIN_TIP: [number, number, number] = [2.2, -0.35, 0.55];

const Fin: React.FC<{
  raise: number;
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
  children?: React.ReactNode;
}> = ({ raise, geo, mat, children }) => (
  <group position={[BODY.w / 2 - 0.2, 5.0, 0.3]} rotation={[0, -0.12, raise * 0.55]}>
    <mesh geometry={geo} material={mat} castShadow />
    {children ? <group position={NUBI_FIN_TIP}>{children}</group> : null}
  </group>
);

export const Nubi: React.FC<{
  pose?: NubiPose;
  size?: number;
  position?: [number, number, number];
  rotationY?: number;
  shadow?: boolean;
  shadowOpacity?: number;
  /** Objects held at the tip of the screen-right / screen-left fin (they follow its raise). */
  holdR?: React.ReactNode;
  holdL?: React.ReactNode;
  /** Extra objects in model units attached to the body (costumes, hats...). */
  children?: React.ReactNode;
}> = ({
  pose = {},
  size = 2,
  position = [0, 0, 0],
  rotationY = 0,
  shadow = true,
  shadowOpacity = 0.35,
  holdR,
  holdL,
  children,
}) => {
  const {
    hop = 0,
    squash = 1,
    yaw = 0,
    pitch = 0,
    roll = 0,
    finL = 0,
    finR = 0,
    wiggle = 0,
    wigglePhase = 0,
    blink = 0,
    eyeScale = 1,
    lookX = 0,
    lookY = 0,
  } = pose;

  const bodyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: NUBI_GREEN,
        roughness: 0.42,
        metalness: 0,
        emissive: new THREE.Color(NUBI_GREEN),
        emissiveIntensity: 0.14,
      }),
    [],
  );
  const eyeMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: EYE, roughness: 0.32 }),
    [],
  );
  const bodyGeo = useRounded(BODY.w, BODY.h, BODY.d, 0.6);
  const legGeo = useRounded(LEG.w, LEG.h, LEG.l, 0.42);
  const eyeGeo = useRounded(1.05, 1.75, 0.5, 0.2);
  const finGeo = useFinGeometry();

  const s = size / 10;
  const sq = Math.max(0.3, squash);
  const sx = 1 / Math.sqrt(sq);
  const eyeH = Math.max(0.1, (1 - blink) * eyeScale);
  const eyeW = Math.min(1.35, Math.max(0.8, eyeScale));
  const ex = lookX * 0.5;
  const ey = lookY * 0.4;
  const front = BODY.d / 2;

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={s}>
      {shadow ? (
        <BlobShadow
          radius={7.5 - Math.min(3, hop * 0.25)}
          opacity={shadowOpacity * Math.max(0.35, 1 - hop * 0.06)}
        />
      ) : null}
      <group position={[0, hop, 0]} rotation={[pitch, yaw, roll]}>
        {/* Squash and stretch pivots at the feet. */}
        <group scale={[sx, sq, sx]}>
          {LEGS.map(([x, z, a], k) => {
            // Each leg lifts its tip in turn, like a tentacle wave (pivot at its inner end).
            const lift = wiggle * Math.max(0, Math.sin(wigglePhase - k * 0.9)) * 0.45;
            return (
              <group key={k} position={[x, 0, z]} rotation={[0, a, 0]}>
                <group rotation={[-lift, 0, 0]}>
                  <mesh geometry={legGeo} material={bodyMat} position={[0, LEG.h / 2, LEG.l / 2]} castShadow />
                </group>
              </group>
            );
          })}
          <mesh geometry={bodyGeo} material={bodyMat} position={[0, BODY.y, 0]} castShadow />
          {/* Eyes sit a little below the middle of the face. */}
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              geometry={eyeGeo}
              material={eyeMat}
              position={[side * 2.3 + ex, 5.5 + ey, front + 0.05]}
              scale={[eyeW, eyeH, 1]}
            />
          ))}
          {/* Fins pivot where they meet the body; the left one is a mirror of the right. */}
          <Fin raise={finR} geo={finGeo} mat={bodyMat}>
            {holdR}
          </Fin>
          <group scale={[-1, 1, 1]}>
            <Fin raise={finL} geo={finGeo} mat={bodyMat}>
              {/* Undo the mirror so held objects (a phone screen, text) read the right way. */}
              {holdL ? <group scale={[-1, 1, 1]}>{holdL}</group> : null}
            </Fin>
          </group>
          {children}
        </group>
      </group>
    </group>
  );
};
