import React, { useMemo } from "react";
import * as THREE from "three";
import { V3, canvasTexture, toy, useFontsReady } from "../inca/kit";
import { Glow, additive } from "../thanos/FX";

// The last bottle of water in the world (the water short): a ridged plastic bottle with a blue
// cap and a blue label, water inside. At scale 1 it is 1.0 world units tall and 0.34 wide, with
// its origin at the centre of its bottom and the label facing +z.
//   <WaterBottle fill={1} glow={0.6} t={t} />
//   fill  0..1  water level (0 = empty)
//   glow  0..1  holy glow: a warm halo, light rays and sparkles round it (the safe, the hug)
//   cap   0..1  0 = screwed on; up to 0.6 it unscrews (spins up a little), then lifts off aside
//   hole        a small hole in the bottom (turn the bottle over to show it: BOTTLE_HOLE)
//   drip  0..1  one drop at the hole: it swells (0..0.55) then falls ≈ 0.6 (0.55..1)
//   t           seconds (glow shimmer)

type Hold = { position: V3; rotation: V3; scale: number };

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Radius of the body. */
export const BOTTLE_R = 0.17;
/** Height of the bottle with its cap on. */
export const BOTTLE_H = 0.985;
/** Where the hole is (bottle units): on the bottom face, a little off-centre towards the front. */
export const BOTTLE_HOLE: V3 = [0.05, 0, 0.06];
/** Top of the cap (bottle units). */
export const BOTTLE_TOP: V3 = [0, BOTTLE_H, 0];

/**
 * In a fin (Nubi at size 2): a child of <Upright raise={finR}> in holdR (or side "L" in holdL),
 * standing upright beside the fin tip with the label to the camera. ≈ 0.8 world units tall.
 *   holdR={<Upright raise={finR}><group {...BOTTLE_HOLD}><WaterBottle /></group></Upright>}
 */
export const BOTTLE_HOLD: Hold = { position: [0.45, -1.7, 0.75], rotation: [0, 0, 0], scale: 4 };

/**
 * Hugged against Nubi's front (a child of <Nubi>, model units): it stands on the legs in front
 * of the body, centred, below and between the eyes (both eyes stay visible), tilted a little.
 * ≈ 0.84 world units tall at size 2. Raise the fins a little (finL/finR ≈ 0.25) for the hug.
 */
export const BOTTLE_HUG: Hold = { position: [0, 2.0, 5.0], rotation: [0.06, 0, 0.12], scale: 4.2 };

// Outer profile of the body, [radius, y] from the bottom centre up to the neck.
const PROFILE: [number, number][] = [
  [0, 0],
  [0.11, 0],
  [0.15, 0.008],
  [0.166, 0.03],
  [BOTTLE_R, 0.065],
  [BOTTLE_R, 0.18],
  [0.161, 0.2],
  [BOTTLE_R, 0.22],
  [BOTTLE_R, 0.53],
  [0.161, 0.55],
  [BOTTLE_R, 0.57],
  [BOTTLE_R, 0.605],
  [0.163, 0.655],
  [0.14, 0.71],
  [0.112, 0.76],
  [0.088, 0.805],
  [0.077, 0.835],
  [0.088, 0.846],
  [0.088, 0.862],
  [0.077, 0.87],
  [0.077, 0.885],
];
const CAP = { r: 0.083, h: 0.1, y: 0.885 };
const WATER_TOP = 0.6;

const geoCache: { [k: string]: THREE.BufferGeometry } = {};
const once = <G extends THREE.BufferGeometry>(key: string, make: () => G) => (geoCache[key] ??= make()) as G;

const bodyGeo = () =>
  once("body", () => {
    const g = new THREE.LatheGeometry(
      PROFILE.map(([r, y]) => new THREE.Vector2(r, y)),
      44,
    );
    g.computeVertexNormals();
    return g;
  });

/** The water: a slightly smaller copy of the body up to the shoulder (scaled in y for the level). */
const waterGeo = () =>
  once("water", () => {
    const pts = [
      [0, 0.012],
      [0.13, 0.012],
      [0.155, 0.04],
      [0.159, 0.07],
      [0.159, WATER_TOP],
      [0, WATER_TOP],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    return new THREE.LatheGeometry(pts, 36);
  });

/** Water filling the shoulder and the neck (only when the bottle is full). */
const shoulderWaterGeo = () =>
  once("shoulder", () => {
    const pts = [
      [0, WATER_TOP],
      [0.159, WATER_TOP],
      [0.153, 0.655],
      [0.13, 0.71],
      [0.104, 0.76],
      [0.08, 0.8],
      [0, 0.8],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    return new THREE.LatheGeometry(pts, 36);
  });

/** Ridged cap: a cylinder whose side alternates in and out (grip grooves). */
const capGeo = () =>
  once("cap", () => {
    const g = new THREE.CylinderGeometry(CAP.r, CAP.r, CAP.h, 56, 1, false);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const r = Math.hypot(x, z);
      if (r < CAP.r * 0.99) continue;
      const a = Math.atan2(z, x);
      const k = Math.round((a / (Math.PI * 2)) * 56) % 2 === 0 ? 1 : 0.93;
      p.setX(i, x * k);
      p.setZ(i, z * k);
    }
    g.computeVertexNormals();
    g.translate(0, CAP.h / 2, 0);
    return g;
  });

const labelGeo = () => once("label", () => new THREE.CylinderGeometry(BOTTLE_R + 0.003, BOTTLE_R + 0.003, 0.25, 44, 1, true, Math.PI, Math.PI * 2));

const LABEL_FONT = "'Luckiest Guy', 'Lilita One', sans-serif";

const labelTexture = () =>
  canvasTexture("agua-bottle-label", 1024, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#1A7BFF");
    g.addColorStop(1, "#0E4FC4");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // White wave bands.
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    for (const [y0, amp] of [
      [h * 0.8, 10],
      [h * 0.9, 8],
    ]) {
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y0 + Math.sin((x / w) * Math.PI * 8) * amp);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 8, w, 6);
    ctx.fillRect(0, h - 14, w, 6);
    // Front (canvas centre = +z): a drop and "AGUA".
    const cx = w / 2;
    ctx.save();
    ctx.translate(cx - 120, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(0, -62);
    ctx.bezierCurveTo(30, -20, 44, 6, 44, 24);
    ctx.arc(0, 24, 44, 0, Math.PI, false);
    ctx.bezierCurveTo(-44, 6, -30, -20, 0, -62);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-14, 24, 9, 16, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = "#7CC8FF";
    ctx.fill();
    ctx.restore();
    ctx.font = `110px ${LABEL_FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 10;
    ctx.strokeStyle = "#073A8F";
    ctx.strokeText("AGUA", cx - 60, h * 0.54);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("AGUA", cx - 60, h * 0.54);
    ctx.font = `34px ${LABEL_FONT}`;
    ctx.fillStyle = "#BFE6FF";
    ctx.fillText("ÚLTIMA EDICIÓN", cx - 58, h * 0.82);
  });

/** Soft light rays for the holy glow (camera-facing sprite). */
const raysTexture = () =>
  canvasTexture("agua-bottle-rays", 256, 256, (ctx, w) => {
    const c = w / 2;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const spread = i % 2 ? 0.06 : 0.1;
      const g = ctx.createRadialGradient(c, c, 0, c, c, c);
      g.addColorStop(0, "rgba(255,255,255,0.9)");
      g.addColorStop(0.5, "rgba(255,255,255,0.25)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, c, a - spread, a + spread);
      ctx.closePath();
      ctx.fill();
    }
  });

const useMats = () =>
  useMemo(
    () => ({
      plastic: new THREE.MeshPhysicalMaterial({
        color: "#E6F7FF",
        transparent: true,
        opacity: 0.34,
        roughness: 0.06,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        emissive: new THREE.Color("#BFEFFF"),
        emissiveIntensity: 0.08,
        depthWrite: false,
      }),
      water: new THREE.MeshStandardMaterial({
        color: "#35AEFF",
        transparent: true,
        opacity: 0.85,
        roughness: 0.12,
        emissive: new THREE.Color("#1E8CFF"),
        emissiveIntensity: 0.3,
      }),
      shine: additive(new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.55, toneMapped: false })),
      cap: toy("#1E6FE8", { rough: 0.35, glow: 0.18 }),
      hole: new THREE.MeshBasicMaterial({ color: "#0B1A2A" }),
      rays: additive(new THREE.SpriteMaterial({ map: raysTexture(), color: "#FFF1B8", toneMapped: false, fog: false })),
    }),
    [],
  );

export const WaterBottle: React.FC<{ fill?: number; glow?: number; cap?: number; hole?: boolean; drip?: number; t?: number }> = ({
  fill = 1,
  glow = 0,
  cap = 0,
  hole = false,
  drip = 0,
  t = 0,
}) => {
  const ready = useFontsReady();
  const m = useMats();
  const labelMat = useMemo(
    () => (ready ? new THREE.MeshStandardMaterial({ map: labelTexture(), roughness: 0.4, emissive: new THREE.Color("#FFFFFF"), emissiveMap: labelTexture(), emissiveIntensity: 0.2 }) : null),
    [ready],
  );
  const f = clamp01(fill);
  const level = Math.min(1, f / 0.9);
  // The cap: unscrews (spins and rises), then lifts off to the side.
  const k1 = clamp01(cap / 0.6);
  const k2 = clamp01((cap - 0.6) / 0.4);
  const capPos: V3 = [k2 * 0.17, CAP.y + k1 * 0.045 + k2 * 0.16 - k2 * k2 * 0.05, 0];
  const capRot: V3 = [0, k1 * Math.PI * 6, -k2 * 0.9];
  // The drip: swells at the hole, then falls.
  const d = clamp01(drip);
  const swell = clamp01(d / 0.55);
  const fall = clamp01((d - 0.55) / 0.45);
  const dropR = 0.018 + 0.016 * swell;
  const g = clamp01(glow);
  m.rays.rotation = t * 0.25;
  m.rays.opacity = 0.8 * g;
  return (
    <group>
      {f > 0.003 ? (
        <mesh geometry={waterGeo()} material={m.water} scale={[1, Math.max(0.02, level), 1]} renderOrder={1} />
      ) : null}
      {f > 0.95 ? <mesh geometry={shoulderWaterGeo()} material={m.water} renderOrder={1} /> : null}
      <mesh geometry={bodyGeo()} material={m.plastic} renderOrder={2} />
      {labelMat ? <mesh geometry={labelGeo()} material={labelMat} position={[0, 0.375, 0]} /> : null}
      {/* Specular streaks so the clear plastic reads. */}
      <mesh material={m.shine} position={[-0.105, 0.38, 0.13]} rotation={[0, -0.68, 0]} renderOrder={3}>
        <planeGeometry args={[0.018, 0.5]} />
      </mesh>
      <mesh material={m.shine} position={[-0.075, 0.72, 0.095]} rotation={[0, -0.68, -0.45]} renderOrder={3}>
        <planeGeometry args={[0.012, 0.1]} />
      </mesh>
      <mesh geometry={capGeo()} material={m.cap} position={capPos} rotation={capRot} castShadow />
      {hole ? (
        <mesh material={m.hole} position={[BOTTLE_HOLE[0], -0.002, BOTTLE_HOLE[2]]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.024, 16]} />
        </mesh>
      ) : null}
      {d > 0 && d < 1 ? (
        <mesh
          material={m.water}
          position={[BOTTLE_HOLE[0], -dropR * 0.9 - fall * fall * 0.6, BOTTLE_HOLE[2]]}
          scale={[dropR, dropR * (1.15 + 0.5 * swell * (1 - fall) + fall * 0.3), dropR]}
          renderOrder={1}
        >
          <sphereGeometry args={[1, 14, 10]} />
        </mesh>
      ) : null}
      {g > 0.01 ? (
        <group position={[0, 0.5, 0]}>
          <Glow color="#FFF3C4" size={2.2 * g * (1 + 0.05 * Math.sin(t * 5))} opacity={0.75 * g} />
          <Glow color="#8FE3FF" size={1.1 * g} opacity={0.6 * g} />
          <sprite material={m.rays} scale={[3.2 * g, 3.2 * g, 1]} renderOrder={4} />
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = t * (1.1 + i * 0.13) + i * 1.05;
            const r = 0.36 + 0.08 * Math.sin(t * 2.3 + i);
            return <Glow key={i} color="#FFFFFF" size={0.09 * g * (0.7 + 0.3 * Math.sin(t * 7 + i * 2))} opacity={g} position={[Math.cos(a) * r, Math.sin(a * 1.4) * 0.42, Math.sin(a) * r * 0.6]} />;
          })}
        </group>
      ) : null}
    </group>
  );
};
