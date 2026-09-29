import React, { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { getStoneTexture } from "../Citadel";
import { mulberry } from "../noise";
import { IntiSun } from "../Props";
import { V3, canvasTexture, gold, goldDark, loopNoise, noise3, paintGeo, shadeHex, toy, useRounded, vertexMat, wrap } from "./kit";

// Scene sets for the Inca-phone short. Each is self-contained, centred at the origin with the
// ground at y = 0, in world units sized for Nubi at size ≈ 2 (2 wide, 2 tall).

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Merges geometries after making them non-indexed with the same attributes. */
const mergeAll = (geos: THREE.BufferGeometry[]) => {
  const clean = geos.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    if (ng.attributes.uv) ng.deleteAttribute("uv");
    return ng;
  });
  const m = mergeGeometries(clean, false);
  if (!m) throw new Error("mergeGeometries failed");
  return m;
};

/** Rounded stone block with a flat vertex colour, placed and turned. */
const stone = (w: number, h: number, d: number, r: number, color: string, pos: V3, rotY = 0, rotX = 0, rotZ = 0) => {
  const g = new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 2, h / 2, d / 2));
  paintGeo(g, color);
  g.applyMatrix4(
    new THREE.Matrix4().compose(
      new THREE.Vector3(...pos),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, rotZ)),
      new THREE.Vector3(1, 1, 1),
    ),
  );
  return g;
};

/** Splits [phase, phase + length] into pieces of random size (for courses of stones). */
const pieces = (rnd: () => number, length: number, min: number, max: number) => {
  const lens: number[] = [];
  let sum = 0;
  while (sum < length - (min + max) / 2) {
    const l = min + rnd() * (max - min);
    lens.push(l);
    sum += l;
  }
  lens.push(Math.max(min * 0.6, length - sum));
  const k = length / lens.reduce((a, b) => a + b, 0);
  return lens.map((l) => l * k);
};

/** Annular sector (between radii) extruded from y0 to y1; the arc is centred on +z. */
const arcSlab = (rIn: number, rOut: number, span: number, y0: number, y1: number, segments = 64) => {
  const s = new THREE.Shape();
  // Shape (x, y) maps to world (x, -z) after the rotation below; the arc faces +z.
  s.absarc(0, 0, rOut, -Math.PI / 2 - span, -Math.PI / 2 + span, false);
  s.absarc(0, 0, rIn, -Math.PI / 2 + span, -Math.PI / 2 - span, true);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false, curveSegments: segments });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  return g;
};

// =======================================================================================
// Throne room

/** Where Nubi stands on the tiana (seat top), for <Nubi position>. */
export const THRONE_SEAT: V3 = [0, 0.62, 0.35];

const WALL = { w: 13, h: 7.6, z: -2.3, t: 0.45 };
const NICHES: [number, number][] = [
  [-2.25, 1.0],
  [2.25, 1.0],
  [-4.2, 1.0],
  [4.2, 1.0],
];
const NICHE = { bw: 1.0, tw: 0.72, h: 1.65 };

const goldPlates = () =>
  canvasTexture(
    "inca-gold-plates",
    512,
    256,
    (ctx, W, H) => {
      // Two by one world units: four courses of gold plates with dark joints.
      ctx.fillStyle = "#6E3F0A";
      ctx.fillRect(0, 0, W, H);
      const rnd = mulberry(8);
      const rh = H / 4;
      for (let r = 0; r < 4; r++) {
        let x = rnd() * W;
        for (const w of pieces(rnd, W, 80, 150)) {
          const l = 50 + rnd() * 12;
          for (const dx of [0, -W]) {
            ctx.fillStyle = `hsl(${40 + rnd() * 5}, ${80 + rnd() * 12}%, ${l}%)`;
            ctx.beginPath();
            ctx.roundRect(x + dx + 3, r * rh + 3, w - 6, rh - 6, 7);
            ctx.fill();
            ctx.fillStyle = "rgba(255,244,190,0.35)";
            ctx.fillRect(x + dx + 8, r * rh + 7, w - 16, 5);
            ctx.fillStyle = "rgba(120,60,0,0.25)";
            ctx.fillRect(x + dx + 8, r * rh + rh - 12, w - 16, 4);
          }
          x += w;
        }
      }
    },
    { wrapS: true, wrapT: true },
  );

const floorSlabs = () =>
  canvasTexture(
    "inca-floor-slabs",
    256,
    256,
    (ctx, W, H) => {
      ctx.fillStyle = "#9A7E58";
      ctx.fillRect(0, 0, W, H);
      const rnd = mulberry(21);
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
          const x = i * 128 + (j % 2) * 64;
          ctx.fillStyle = `hsl(36, ${30 + rnd() * 10}%, ${66 + rnd() * 8}%)`;
          for (const dx of [0, -W]) {
            ctx.beginPath();
            ctx.roundRect(x + dx + 3, j * 128 + 3, 122, 122, 10);
            ctx.fill();
          }
        }
      }
    },
    { wrapS: true, wrapT: true },
  );

const carpetTexture = () =>
  canvasTexture("inca-carpet", 256, 512, (ctx, W, H) => {
    ctx.fillStyle = "#C8102E";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#F2B705";
    ctx.fillRect(0, 0, 26, H);
    ctx.fillRect(W - 26, 0, 26, H);
    ctx.fillStyle = "#141414";
    ctx.fillRect(26, 0, 8, H);
    ctx.fillRect(W - 34, 0, 8, H);
    for (let i = 0; i < 6; i++) {
      const cy = 45 + i * 85;
      ctx.fillStyle = i % 2 ? "#F2B705" : "#FFFFFF";
      ctx.beginPath();
      ctx.moveTo(W / 2, cy - 34);
      ctx.lineTo(W / 2 + 44, cy);
      ctx.lineTo(W / 2, cy + 34);
      ctx.lineTo(W / 2 - 44, cy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#141414";
      ctx.fillRect(W / 2 - 10, cy - 10, 20, 20);
    }
  });

const tianaTexture = () =>
  canvasTexture("inca-tiana-band", 256, 64, (ctx, W, H) => {
    ctx.fillStyle = "#B3122E";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#F2B705";
    ctx.fillRect(0, 0, W, 7);
    ctx.fillRect(0, H - 7, W, 7);
    for (let i = 0; i < 8; i++) {
      const x = i * 32 + 16;
      ctx.fillRect(x - 11, 38, 22, 10);
      ctx.fillRect(x - 6, 27, 12, 11);
      ctx.fillRect(x - 2, 17, 4, 10);
    }
  });

const texturedMat = (tex: THREE.Texture, rough = 0.6, metal = 0, glow = 0.14) =>
  new THREE.MeshStandardMaterial({
    map: tex,
    roughness: rough,
    metalness: metal,
    emissive: new THREE.Color("#ffffff"),
    emissiveMap: tex,
    emissiveIntensity: glow,
  });

/** Inca jar (aríbalo) standing in a niche. */
const Aribalo: React.FC<{ position: V3; scale?: number }> = ({ position, scale = 1 }) => {
  const geo = useMemo(() => {
    const pts = [
      [0.0, 0.0],
      [0.08, 0.04],
      [0.2, 0.14],
      [0.26, 0.3],
      [0.24, 0.46],
      [0.12, 0.58],
      [0.08, 0.7],
      [0.13, 0.78],
      [0.0, 0.78],
    ].map(([r, h]) => new THREE.Vector2(r, h));
    return new THREE.LatheGeometry(pts, 24);
  }, []);
  return <mesh geometry={geo} material={toy("#FFC21A", { metal: 0.6, rough: 0.28, glow: 0.26, side: THREE.DoubleSide })} position={position} scale={scale} />;
};

/** Golden brazier with a flame; `flicker` animates it (pass the frame). */
const Brazier: React.FC<{ position: V3; flicker: number; seed: number }> = ({ position, flicker, seed }) => {
  const geos = useMemo(
    () => ({
      foot: new THREE.CylinderGeometry(0.28, 0.34, 0.1, 20),
      stem: new THREE.CylinderGeometry(0.07, 0.09, 0.9, 12),
      bowl: new THREE.CylinderGeometry(0.4, 0.22, 0.26, 24),
      flame: new THREE.ConeGeometry(1, 1, 10),
    }),
    [],
  );
  const f = (k: number) => 1 + 0.12 * Math.sin(flicker * 0.9 + seed + k * 2.1) + 0.06 * Math.sin(flicker * 2.3 + k);
  const flame = useMemo(
    () => ["#FF6A1A", "#FFB21A", "#FFF1A8"].map((c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false })),
    [],
  );
  return (
    <group position={position}>
      <mesh geometry={geos.foot} material={goldDark()} position={[0, 0.05, 0]} />
      <mesh geometry={geos.stem} material={gold()} position={[0, 0.55, 0]} />
      <mesh geometry={geos.bowl} material={gold()} position={[0, 1.1, 0]} />
      <mesh geometry={geos.flame} material={flame[0]} position={[0, 1.2 + 0.42 * f(0), 0]} scale={[0.34, 0.84 * f(0), 0.34]} />
      <mesh geometry={geos.flame} material={flame[1]} position={[0.03, 1.2 + 0.3 * f(1), 0.1]} scale={[0.23, 0.6 * f(1), 0.23]} />
      <mesh geometry={geos.flame} material={flame[2]} position={[-0.02, 1.2 + 0.18 * f(2), 0.16]} scale={[0.12, 0.36 * f(2), 0.12]} />
    </group>
  );
};

/**
 * Throne room: stone floor with a red carpet, a golden wall with trapezoidal niches (gold jars
 * inside), a big Inti sun on the wall behind the tiana (low gold-and-red royal stool) and two
 * golden braziers. Nubi stands on the tiana at THRONE_SEAT (size ≈ 2). `flicker` = frame for
 * the flames.
 */
export const ThroneRoom: React.FC<{ flicker?: number }> = ({ flicker = 0 }) => {
  const geos = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-WALL.w / 2, 0);
    s.lineTo(WALL.w / 2, 0);
    s.lineTo(WALL.w / 2, WALL.h);
    s.lineTo(-WALL.w / 2, WALL.h);
    s.closePath();
    for (const [x, y] of NICHES) {
      const hole = new THREE.Path();
      hole.moveTo(x - NICHE.bw / 2, y);
      hole.lineTo(x + NICHE.bw / 2, y);
      hole.lineTo(x + NICHE.tw / 2, y + NICHE.h);
      hole.lineTo(x - NICHE.tw / 2, y + NICHE.h);
      hole.closePath();
      s.holes.push(hole);
    }
    const wall = new THREE.ExtrudeGeometry(s, { depth: WALL.t, bevelEnabled: false });
    wall.translate(0, 0, -WALL.t);
    return { wall };
  }, []);
  const mats = useMemo(() => {
    const plates = goldPlates();
    plates.repeat.set(0.5, 1);
    const slabs = floorSlabs();
    slabs.repeat.set(7.5, 5);
    return {
      wall: [texturedMat(plates, 0.34, 0.45, 0.2), toy("#7A3A0E", { rough: 0.6, glow: 0.1 })],
      floor: texturedMat(slabs, 0.85, 0, 0.1),
      carpet: texturedMat(carpetTexture(), 0.9, 0, 0.16),
      band: texturedMat(tianaTexture(), 0.5, 0.15, 0.18),
    };
  }, []);
  const floorGeo = useRounded(15, 0.4, 10, 0.1, 2);
  const cornice = useRounded(WALL.w + 0.3, 0.32, WALL.t + 0.3, 0.1, 2);
  const plinth = useRounded(WALL.w + 0.1, 0.34, WALL.t + 0.16, 0.08, 2);
  const nicheBack = useRounded(WALL.w - 0.2, WALL.h - 0.4, 0.12, 0.04, 2);
  const carpet = useRounded(1.7, 0.03, 4.9, 0.012, 1);
  const tBase = useRounded(2.5, 0.16, 2.2, 0.06, 2);
  const tBody = useRounded(2.2, 0.26, 1.92, 0.06, 2);
  const tRim = useRounded(2.56, 0.07, 2.26, 0.03, 2);
  const tSeat = useRounded(2.4, 0.13, 2.1, 0.06, 2);
  const stud = useRounded(0.2, 0.2, 0.08, 0.04, 2);
  const redSeat = toy("#D0142E", { rough: 0.8, glow: 0.18 });
  return (
    <group>
      <mesh geometry={floorGeo} material={mats.floor} position={[0, -0.2, 2.2]} receiveShadow />
      <mesh geometry={carpet} material={mats.carpet} position={[0, 0.016, 3.95]} receiveShadow />
      {/* Wall with niches. */}
      <group position={[0, 0, WALL.z]}>
        <mesh geometry={geos.wall} material={mats.wall} receiveShadow />
        <mesh geometry={nicheBack} material={toy("#4A1A08", { rough: 0.8, glow: 0.05 })} position={[0, WALL.h / 2, -WALL.t - 0.06]} />
        <mesh geometry={cornice} material={gold()} position={[0, WALL.h - 0.05, -WALL.t / 2]} />
        <mesh geometry={plinth} material={toy("#8C7254", { rough: 0.9, glow: 0.06 })} position={[0, 0.17, -WALL.t / 2]} />
        {NICHES.map(([x, y]) => (
          <Aribalo key={x} position={[x, y, -WALL.t / 2 - 0.04]} scale={0.95} />
        ))}
        <group position={[0, 4.35, 0.22]} scale={0.88}>
          <IntiSun />
        </group>
      </group>
      <Brazier position={[-1.95, 0, -1.25]} flicker={flicker} seed={0} />
      <Brazier position={[1.95, 0, -1.25]} flicker={flicker} seed={2.4} />
      {/* The tiana: a low carved stool, seat top at y = 0.62. */}
      <group position={[THRONE_SEAT[0], 0, THRONE_SEAT[2]]}>
        <mesh geometry={tBase} material={goldDark()} position={[0, 0.08, 0]} castShadow receiveShadow />
        <mesh geometry={tBody} material={mats.band} position={[0, 0.29, 0]} castShadow />
        {[-0.7, 0, 0.7].map((x) => (
          <mesh key={x} geometry={stud} material={gold()} position={[x, 0.29, 0.98]} />
        ))}
        <mesh geometry={tRim} material={gold()} position={[0, 0.455, 0]} />
        <mesh geometry={tSeat} material={redSeat} position={[0, 0.555, 0]} receiveShadow />
      </group>
    </group>
  );
};

// =======================================================================================
// Terraces

const TERR = {
  levels: [
    { top: 0, front: 3.6 },
    { top: 1.05, front: 0.25 },
    { top: 2.1, front: -2.35 },
    { top: 3.15, front: -4.95 },
  ],
  back: -7.6,
  base: -2.05,
  cz: -12,
  span: 0.62,
};
const rOf = (z: number) => z - TERR.cz;
/** World point on the arc of radius r at angle a (0 = straight towards +z). */
const arcPt = (r: number, a: number, y = 0): V3 => [Math.sin(a) * r, y, TERR.cz + Math.cos(a) * r];

const grassTexture = () =>
  canvasTexture(
    "inca-grass-top",
    256,
    256,
    (ctx, W, H) => {
      ctx.fillStyle = "#5DBE4C";
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? "rgba(40,120,40,0.12)" : "rgba(170,230,110,0.12)";
        ctx.fillRect(0, i * 64, W, 64);
      }
      const rnd = mulberry(5);
      for (let i = 0; i < 500; i++) {
        ctx.fillStyle = rnd() < 0.5 ? "rgba(30,110,40,0.35)" : "rgba(190,240,130,0.35)";
        ctx.fillRect(rnd() * W, rnd() * H, 2, 5);
      }
    },
    { wrapS: true, wrapT: true },
  );

const soilTexture = () =>
  canvasTexture(
    "inca-soil-furrows",
    256,
    256,
    (ctx, W, H) => {
      // One world unit: two furrows (ridge and trench) running along x.
      for (let i = 0; i < 2; i++) {
        const g = ctx.createLinearGradient(0, i * 128, 0, i * 128 + 128);
        g.addColorStop(0, "#5C3A1E");
        g.addColorStop(0.3, "#8A5A30");
        g.addColorStop(0.55, "#9C6A3A");
        g.addColorStop(1, "#5C3A1E");
        ctx.fillStyle = g;
        ctx.fillRect(0, i * 128, W, 128);
      }
      const rnd = mulberry(9);
      for (let i = 0; i < 600; i++) {
        ctx.fillStyle = rnd() < 0.5 ? "rgba(40,22,10,0.35)" : "rgba(190,140,90,0.3)";
        ctx.beginPath();
        ctx.arc(rnd() * W, rnd() * H, 1 + rnd() * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    { wrapS: true, wrapT: true },
  );

const M4 = () => new THREE.Matrix4();
const T = (x: number, y: number, z: number) => M4().makeTranslation(x, y, z);
const S = (x: number, y = x, z = x) => M4().makeScale(x, y, z);
const RX = (a: number) => M4().makeRotationX(a);
const RY = (a: number) => M4().makeRotationY(a);
const chain = (...ms: THREE.Matrix4[]) => ms.reduce((acc, m) => acc.multiply(m), M4());
const placed = (base: THREE.BufferGeometry, color: string, m: THREE.Matrix4) => paintGeo(base.clone(), color).applyMatrix4(m);

const plantCache = new Map<string, { base: THREE.BufferGeometry; leaves: THREE.BufferGeometry }>();
/** The plant merged into two vertex-coloured meshes (soil + potatoes, foliage + flowers). */
const plantGeometry = (seed: number, flowers: boolean, potatoes: boolean) => {
  const key = `${seed}|${flowers}|${potatoes}`;
  const hit = plantCache.get(key);
  if (hit) return hit;
  const rnd = mulberry(seed * 97 + 13);
  const leaf = new THREE.SphereGeometry(1, 10, 8);
  const stem = new THREE.CylinderGeometry(0.025, 0.035, 1, 6);
  const mound = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const petal = new THREE.SphereGeometry(1, 8, 6);
  const potato = new THREE.DodecahedronGeometry(1, 1);
  const base = [placed(mound, "#7A4E2A", S(0.34, 0.12, 0.3))];
  if (potatoes) {
    base.push(placed(potato, "#C98E4E", chain(T(0.2, 0.04, 0.14), M4().makeRotationFromEuler(new THREE.Euler(0.3, 0.5, 0)), S(0.1, 0.075, 0.085))));
    base.push(placed(potato, "#B97E42", chain(T(-0.17, 0.03, 0.17), M4().makeRotationFromEuler(new THREE.Euler(0.1, 1.3, 0.2)), S(0.085, 0.065, 0.075))));
  }
  const fol = [placed(stem, "#2F9A40", chain(T(0, 0.28, 0), S(1, 0.56, 1)))];
  for (let i = 0; i < 9; i++) {
    const tier = i < 6 ? 0 : 1;
    const a = tier ? (i / 3) * Math.PI * 2 + rnd() : (i / 6) * Math.PI * 2 + rnd() * 0.4;
    const tilt = tier ? 1.0 + rnd() * 0.3 : 0.45 + rnd() * 0.3;
    const len = tier ? 0.2 + rnd() * 0.05 : 0.27 + rnd() * 0.07;
    const y = tier ? 0.34 + rnd() * 0.06 : 0.12 + rnd() * 0.08;
    const color = rnd() < 0.5 ? "#2F9A40" : "#48B84E";
    fol.push(placed(leaf, color, chain(RY(a), T(0, y, 0), RX(-tilt), T(0, 0, len * 0.85), S(0.18, 0.05, len * 0.9))));
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + rnd();
    const r = 0.08 + rnd() * 0.06;
    const y = 0.56 + rnd() * 0.08;
    if (!flowers) continue;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    fol.push(placed(stem, "#2F9A40", chain(T(x / 2, y / 2 + 0.2, z / 2), S(0.6, y - 0.35, 0.6))));
    for (let k = 0; k < 5; k++) {
      const pa = (k / 5) * Math.PI * 2;
      fol.push(placed(petal, i % 2 ? "#C9A2FF" : "#FFFFFF", chain(T(x + Math.cos(pa) * 0.055, y, z + Math.sin(pa) * 0.055), S(0.05, 0.02, 0.05))));
    }
    fol.push(placed(petal, "#FFC21A", chain(T(x, y + 0.014, z), S(0.03))));
  }
  const out = { base: mergeAll(base), leaves: mergeAll(fol) };
  plantCache.set(key, out);
  return out;
};

/**
 * A cute potato plant (≈0.7 tall at scale 1): leafy clump on a soil mound, white and lilac
 * flowers, two little potatoes peeking out. `sway` (-1..1) bends it in the wind. Two meshes.
 */
export const PotatoPlant: React.FC<{ seed?: number; flowers?: boolean; potatoes?: boolean; sway?: number }> = ({
  seed = 1,
  flowers = true,
  potatoes = true,
  sway = 0,
}) => {
  const geo = useMemo(() => plantGeometry(seed, flowers, potatoes), [seed, flowers, potatoes]);
  return (
    <group>
      <mesh geometry={geo.base} material={vertexMat(0.9, false, 0.1)} receiveShadow />
      <mesh geometry={geo.leaves} material={vertexMat(0.7, true, 0.14)} rotation={[sway * 0.08, 0, sway * 0.16]} castShadow />
    </group>
  );
};

/**
 * Four stepped green andenes with stone retaining walls, curving round a hillside. The front
 * terrace (ground, y = 0, z ≈ 0.3..3.6) is freshly furrowed soil for sowing; the upper ones
 * (tops at y = 1.05, 2.1, 3.15) are grass with rows of potato plants, flying stone steps and an
 * irrigation channel along the first step. `backdrop` adds Huayna Picchu and the low-poly
 * Andes behind.
 */
export const Terraces: React.FC<{ backdrop?: boolean; flow?: number }> = ({ backdrop = true, flow = 0 }) => {
  const geos = useMemo(() => {
    const L = TERR.levels;
    const slabs = L.map((l) => arcSlab(rOf(TERR.back), rOf(l.front), TERR.span, TERR.base, l.top).translate(0, 0, TERR.cz));
    const r1 = rOf(L[1].front) - 0.42;
    const water = new THREE.RingGeometry(r1 - 0.13, r1 + 0.13, 72, 1, -Math.PI / 2 - TERR.span, TERR.span * 2);
    water.rotateX(-Math.PI / 2);
    water.translate(0, L[1].top + 0.035, TERR.cz);
    const lipIn = arcSlab(r1 - 0.24, r1 - 0.14, TERR.span, L[1].top - 0.02, L[1].top + 0.09).translate(0, 0, TERR.cz);
    const lipOut = arcSlab(r1 + 0.14, r1 + 0.24, TERR.span, L[1].top - 0.02, L[1].top + 0.09).translate(0, 0, TERR.cz);
    // Flying steps (sarunas): stones sticking out of each wall in a diagonal.
    const stepGeos: THREE.BufferGeometry[] = [];
    for (let k = 1; k < L.length; k++) {
      const r = rOf(L[k].front);
      for (let i = 0; i < 3; i++) {
        const a = 0.27 + i * 0.045 - k * 0.012;
        const [x, , z] = arcPt(r + 0.2, a);
        stepGeos.push(stone(0.62, 0.13, 0.42, 0.04, shadeHex("#B9B2A6", (i - 1) * 0.03), [x, L[k - 1].top + 0.28 + i * 0.3, z], a));
      }
    }
    return { slabs, water, lipIn, lipOut, steps: mergeAll(stepGeos) };
  }, []);
  const mats = useMemo(() => {
    const st = getStoneTexture().clone();
    st.needsUpdate = true;
    st.repeat.set(0.238, 0.952);
    const stoneMat = new THREE.MeshStandardMaterial({ color: "#ffffff", map: st, roughness: 0.9, emissive: new THREE.Color("#ffffff"), emissiveMap: st, emissiveIntensity: 0.08 });
    const grass = grassTexture();
    grass.repeat.set(0.5, 0.5);
    const soil = soilTexture();
    soil.repeat.set(1, 1.1);
    return {
      stone: stoneMat,
      grass: texturedMat(grass, 0.95, 0, 0.1),
      soil: texturedMat(soil, 1, 0, 0.08),
      water: new THREE.MeshStandardMaterial({ color: "#39B8FF", roughness: 0.15, emissive: new THREE.Color("#39B8FF"), emissiveIntensity: 0.55 }),
    };
  }, []);
  const plants = useMemo(() => {
    const list: { p: V3; seed: number }[] = [];
    const L = TERR.levels;
    for (let k = 1; k <= 2; k++) {
      const r = rOf(L[k].front) - 1.2;
      const n = k === 1 ? 9 : 7;
      for (let i = 0; i < n; i++) {
        const a = -TERR.span * 0.85 + ((i + 0.5) / n) * TERR.span * 1.7;
        list.push({ p: arcPt(r, a, L[k].top), seed: k * 10 + i });
      }
    }
    // A few on the front terrace, clear of the middle where the action happens.
    for (const [x, z] of [
      [-3.4, 1.5],
      [-4.4, 2.2],
      [3.8, 1.3],
      [4.8, 2.0],
    ]) list.push({ p: [x, 0, z], seed: Math.round(x * 7) });
    return list;
  }, []);
  return (
    <group>
      {geos.slabs.map((g, k) => (
        <mesh key={k} geometry={g} material={[k === 0 ? mats.soil : mats.grass, mats.stone]} castShadow receiveShadow />
      ))}
      <mesh geometry={geos.water} material={mats.water} />
      <mesh geometry={geos.lipIn} material={toy("#B9B2A6", { rough: 0.9, glow: 0.06 })} />
      <mesh geometry={geos.lipOut} material={toy("#B9B2A6", { rough: 0.9, glow: 0.06 })} />
      <mesh geometry={geos.steps} material={vertexMat(0.9, false, 0.06)} castShadow />
      {plants.map((pl, i) => (
        <group key={i} position={pl.p} scale={0.9}>
          <PotatoPlant seed={pl.seed} sway={flow * Math.sin(i * 1.3)} />
        </group>
      ))}
      {backdrop ? (
        <>
          <HuaynaPicchu position={[3.5, -6, -32]} />
          <Andes height={0.85} />
        </>
      ) : null}
    </group>
  );
};

// =======================================================================================
// Huayna Picchu

const huaynaGeometry = () => {
  const prof: [number, number][] = [
    [9.5, 0],
    [8.4, 3],
    [6.6, 7],
    [5.0, 11],
    [3.7, 14.5],
    [2.6, 17.5],
    [1.6, 19.6],
    [0.7, 20.8],
    [0, 21.2],
  ];
  const g = new THREE.LatheGeometry(
    prof.map(([r, h]) => new THREE.Vector2(r, h)),
    14,
  ).toNonIndexed();
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const forest = new THREE.Color("#2F6B35");
  const green = new THREE.Color("#4A9E45");
  const rock = new THREE.Color("#7C776C");
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + 0.13 * noise3(v.x * 0.35, v.y * 0.25, v.z * 0.35);
    // Lean a little and flatten front to back, like the real sugarloaf.
    p.setXYZ(i, v.x * k + v.y * 0.1, v.y, v.z * k * 0.8);
    const n = noise3(v.x * 0.5 + 4, v.y * 0.4, v.z * 0.5);
    c.copy(forest).lerp(green, clamp01(0.45 + n));
    c.lerp(rock, clamp01((v.y - 11 + 5 * n) / 5) * 0.7);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
};

/** Low-poly Huayna Picchu (the sugarloaf peak behind Machu Picchu), 21 tall, base at y = 0. */
export const HuaynaPicchu: React.FC<{ position?: V3; scale?: number }> = ({ position = [0, 0, 0], scale = 1 }) => {
  const geo = useMemo(huaynaGeometry, []);
  return <mesh geometry={geo} material={vertexMat(1, true, 0.14)} position={position} scale={scale} />;
};

// =======================================================================================
// Andes backdrop

const ANDES = { period: 120, x0: -100, width: 320, z0: -46, depth: 70 };

const andesGeometry = (height: number) => {
  const nx = 200;
  const nz = 30;
  const g = new THREE.PlaneGeometry(ANDES.width, ANDES.depth, nx, nz);
  g.rotateX(-Math.PI / 2);
  g.translate(ANDES.x0 + ANDES.width / 2, 0, ANDES.z0 - ANDES.depth / 2);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const foot = new THREE.Color("#4E8A5C");
  const rock = new THREE.Color("#6F7C96");
  const snow = new THREE.Color("#F4F7FB");
  const haze = new THREE.Color("#B7D3EE");
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const t = clamp01((ANDES.z0 - z) / 26);
    const ridge = 1 - Math.abs(loopNoise(x, z, ANDES.period, 0.03, 1));
    const peaks = Math.pow(ridge, 2.4);
    const y = -12 + (t * (6 + 26 * peaks) + 3 * loopNoise(x, z, ANDES.period, 0.1, 2) * (0.4 + t)) * height;
    p.setY(i, y);
    c.copy(foot).lerp(rock, clamp01((y + 1) / 10));
    c.lerp(snow, clamp01((y - 12 - 16 * height + 12 - 3 * loopNoise(x, z, ANDES.period, 0.2, 3)) / 2.5));
    c.lerp(haze, 0.1 + 0.28 * clamp01((ANDES.z0 - z - 15) / 55));
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
};

/**
 * Low-poly snowy Andes far behind a set (z ≈ -46..-116, peaks up to y ≈ 22). Seamless when
 * scrolled: pass the scene's `scroll` and it moves by scroll x `parallax`. `height` scales the
 * peaks (1 = up to y ≈ 22).
 */
export const Andes: React.FC<{ scroll?: number; parallax?: number; height?: number }> = ({ scroll = 0, parallax = 0.06, height = 1 }) => {
  const geo = useMemo(() => andesGeometry(height), [height]);
  return <mesh geometry={geo} material={vertexMat(1, true, 0.18)} position={[-wrap(scroll * parallax, ANDES.period), 0, 0]} />;
};

// =======================================================================================
// Qhapaq Ñan

const ROAD = { z0: -1.4, z1: 2.0, tile: 4.8 };
const SLOPE_P = ROAD.tile * 3;
const MARK_P = SLOPE_P * 2;
const COVER = 44;

/** Height of the uphill slope behind the road (periodic in x with SLOPE_P). */
const slopeY = (x: number, z: number) => {
  const d = Math.max(0, -z - 1.8);
  const amp = 0.15 + 0.09 * d;
  return 0.46 + 0.62 * d - 0.013 * d * d + amp * loopNoise(x, z, SLOPE_P, 0.22, 4) + 0.12 * d * loopNoise(x, z, SLOPE_P, 0.6, 5) * 0.3;
};
/** Height of the downhill verge in front of the road. */
const vergeY = (x: number, z: number) => {
  const e = Math.max(0, z - 2.45);
  return -0.03 - 0.07 * e - 0.085 * e * e + (0.05 + 0.06 * e) * loopNoise(x, z, SLOPE_P, 0.3, 6);
};

const roadTile = () => {
  const rnd = mulberry(4242);
  const geos: THREE.BufferGeometry[] = [];
  const T = ROAD.tile;
  const rows = 4;
  const rowW = (ROAD.z1 - ROAD.z0) / rows;
  const tones = ["#BDB6A8", "#ADA698", "#C8C1B3", "#A39C8F", "#B6AE9F"];
  for (let r = 0; r < rows; r++) {
    const z = ROAD.z0 + rowW * (r + 0.5);
    let x = rnd() * T;
    for (const l of pieces(rnd, T, 0.55, 1.15)) {
      const h = 0.14 + rnd() * 0.05;
      const tone = shadeHex(tones[Math.floor(rnd() * tones.length)], (rnd() - 0.5) * 0.06);
      geos.push(stone(l - 0.08, h, rowW - 0.08, 0.06, tone, [x + l / 2, h / 2 - 0.1 + rnd() * 0.015, z + (rnd() - 0.5) * 0.04], (rnd() - 0.5) * 0.08, (rnd() - 0.5) * 0.04));
      x += l;
    }
  }
  // Uphill retaining wall (big stones) and the downhill curb.
  const walls: [number, number, number, number, number][] = [
    // z, height, depth, min, max
    [ROAD.z0 - 0.24, 0.58, 0.4, 0.8, 1.3],
    [ROAD.z1 + 0.2, 0.26, 0.36, 0.9, 1.4],
  ];
  for (const [z, hh, dd, mn, mx] of walls) {
    let x = rnd() * T;
    for (const l of pieces(rnd, T, mn, mx)) {
      const h = hh * (0.9 + rnd() * 0.2);
      const tone = shadeHex("#9C9589", (rnd() - 0.5) * 0.08);
      geos.push(stone(l - 0.07, h, dd, 0.08, tone, [x + l / 2, h / 2 - 0.08, z], (rnd() - 0.5) * 0.05));
      x += l;
    }
  }
  return mergeAll(geos);
};

const slopeGeometry = (fn: (x: number, z: number) => number, zFrom: number, zTo: number, nz: number, palette: "up" | "down") => {
  const width = COVER + SLOPE_P;
  const nx = Math.round(width / 0.5);
  const depth = zTo - zFrom;
  const g = new THREE.PlaneGeometry(width, depth, nx, nz);
  g.rotateX(-Math.PI / 2);
  g.translate(-COVER / 2 + width / 2, 0, zFrom + depth / 2);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const grassA = new THREE.Color("#6CC957");
  const grassB = new THREE.Color("#2F8A3A");
  const rock = new THREE.Color("#8E8A80");
  const dry = new THREE.Color("#C2B65A");
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    p.setY(i, fn(x, z));
    const n = loopNoise(x, z, SLOPE_P, 0.35, 7);
    c.copy(grassA).lerp(grassB, clamp01(0.5 + n * 1.3));
    // Dry puna grass in patches, more of it higher up the slope.
    const high = palette === "up" ? 0.35 + 0.65 * clamp01((-z - 5) / 6) : 0.3;
    c.lerp(dry, clamp01(0.15 + loopNoise(x, z, SLOPE_P, 0.14, 8) * 1.6) * 0.6 * high);
    const rocky = clamp01((loopNoise(x, z, SLOPE_P, 0.5, 9) - 0.25) * 3) * (palette === "up" ? clamp01((-z - 3) / 4) : 0.6);
    c.lerp(rock, rocky * 0.8);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
};

/** Grass clumps and rocks on the slopes for one slope period (x in [0, SLOPE_P)). */
const scatterGeometry = () => {
  const rnd = mulberry(77);
  const geos: THREE.BufferGeometry[] = [];
  const cone = new THREE.ConeGeometry(0.12, 0.42, 5);
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const put = (base: THREE.BufferGeometry, color: string, pos: V3, scale: V3, rot: V3) => {
    const g = base.clone();
    paintGeo(g, color);
    g.applyMatrix4(
      new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale)),
    );
    geos.push(g);
  };
  for (let i = 0; i < 46; i++) {
    const x = rnd() * SLOPE_P;
    const up = rnd() < 0.72;
    const z = up ? -2.1 - rnd() * 9 : 2.6 + rnd() * 3.5;
    const y = up ? slopeY(x, z) : vergeY(x, z);
    const k = 0.8 + rnd() * 0.7;
    for (let j = 0; j < 3; j++) {
      put(cone, j % 2 ? "#2F8A3A" : "#4DAA45", [x + (j - 1) * 0.1 * k, y + 0.16 * k, z + (rnd() - 0.5) * 0.12], [k, k * (0.8 + rnd() * 0.5), k], [(rnd() - 0.5) * 0.4, 0, (j - 1) * 0.35]);
    }
  }
  const bush = new THREE.IcosahedronGeometry(1, 0);
  for (let i = 0; i < 14; i++) {
    const x = rnd() * SLOPE_P;
    const up = rnd() < 0.75;
    const z = up ? -2.3 - rnd() * 8 : 2.7 + rnd() * 3;
    const y = up ? slopeY(x, z) : vergeY(x, z);
    const s = 0.16 + rnd() * 0.18;
    put(bush, rnd() < 0.5 ? "#2E7D3A" : "#3F9A45", [x, y + s * 0.5, z], [s * 1.2, s, s * 1.1], [rnd() * 3, rnd() * 3, 0]);
    if (rnd() < 0.6) put(bush, rnd() < 0.5 ? "#FFD23F" : "#FF6B8A", [x + s * 0.4, y + s * 1.1, z + s * 0.3], [0.07, 0.07, 0.07], [0, 0, 0]);
  }
  for (let i = 0; i < 16; i++) {
    const x = rnd() * SLOPE_P;
    const up = rnd() < 0.7;
    const z = up ? -2.4 - rnd() * 8 : 2.8 + rnd() * 3;
    const y = up ? slopeY(x, z) : vergeY(x, z);
    const s = 0.18 + rnd() * 0.35;
    put(rockGeo, shadeHex("#A8A195", (rnd() - 0.5) * 0.1), [x, y + s * 0.3, z], [s * 1.3, s * 0.8, s], [rnd() * 3, rnd() * 3, rnd() * 3]);
  }
  return mergeAll(geos);
};

/** A flight of stone steps up the slope and a cairn (apacheta), one set per MARK_P. */
const markersGeometry = () => {
  const rnd = mulberry(909);
  const geos: THREE.BufferGeometry[] = [];
  const sx = 3.0;
  for (let i = 0; i < 5; i++) {
    const z = -1.95 - i * 0.55;
    const y = slopeY(sx, z - 0.28) + 0.02;
    geos.push(stone(1.35, 0.4, 0.62, 0.07, shadeHex("#B3AC9F", (rnd() - 0.5) * 0.06), [sx, y - 0.2, z - 0.1], (rnd() - 0.5) * 0.06));
  }
  // Cairn on the downhill verge, half a slope period further.
  const cx = sx + SLOPE_P * 0.5 + 1.7;
  const cz = 2.85;
  let y = vergeY(cx, cz);
  const sizes = [0.42, 0.36, 0.3, 0.24, 0.19, 0.14];
  for (let i = 0; i < sizes.length; i++) {
    const s = sizes[i];
    const g = new THREE.DodecahedronGeometry(1, 0);
    paintGeo(g, shadeHex("#9E978B", (rnd() - 0.5) * 0.12));
    g.applyMatrix4(
      new THREE.Matrix4().compose(
        new THREE.Vector3(cx + (rnd() - 0.5) * 0.06, y + s * 0.7, cz + (rnd() - 0.5) * 0.06),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3)),
        new THREE.Vector3(s * 1.2, s * 0.8, s),
      ),
    );
    geos.push(g);
    y += s * 1.15;
  }
  // A standing marker stone (saywa) beside the steps.
  geos.push(stone(0.34, 1.1, 0.3, 0.08, "#8F887C", [sx + 1.1, slopeY(sx + 1.1, -2.2) + 0.45, -2.2], 0.2, 0, 0.05));
  return mergeAll(geos);
};

/**
 * Qhapaq Ñan: a paved Inca road running along x (z ≈ -1.4..2.0, stone tops at y ≈ 0.05) cut
 * into a grassy mountain slope (uphill retaining wall behind, curb and verge in front), with
 * stone steps, a cairn and a marker stone, and the low-poly Andes far behind.
 * `scroll` (world units) is how far Nubi has run towards +x: the road, slopes and markers slide
 * towards -x and wrap seamlessly (tiles of 4.8 / 14.4 / 28.8), the Andes move with parallax.
 */
export const QhapaqNan: React.FC<{ scroll?: number; backdrop?: boolean }> = ({ scroll = 0, backdrop = true }) => {
  const geos = useMemo(
    () => ({
      tile: roadTile(),
      up: slopeGeometry(slopeY, -15.8, -1.75, 36, "up"),
      down: slopeGeometry(vergeY, 2.4, 9.5, 16, "down"),
      scatter: scatterGeometry(),
      markers: markersGeometry(),
    }),
    [],
  );
  const bed = useRounded(COVER + ROAD.tile * 2, 0.3, ROAD.z1 - ROAD.z0 + 0.9, 0.05, 1);
  const stoneMat = vertexMat(0.85, false, 0.1);
  const tiles = Math.ceil((COVER + ROAD.tile) / ROAD.tile) + 1;
  // Scatter and markers sit on the periodic slopes, so their copies go at multiples of the period.
  const p0 = Math.floor(-COVER / 2 / SLOPE_P) - 1;
  const periods = Math.ceil((COVER + SLOPE_P) / SLOPE_P) + 2;
  const m0 = Math.floor(-COVER / 2 / MARK_P) - 1;
  const marks = Math.ceil((COVER + MARK_P) / MARK_P) + 2;
  return (
    <group>
      <mesh geometry={bed} material={toy("#5E4B3A", { rough: 1, glow: 0.05 })} position={[0, -0.17, (ROAD.z0 + ROAD.z1) / 2]} receiveShadow />
      <group position={[-wrap(scroll, ROAD.tile), 0, 0]}>
        {Array.from({ length: tiles }).map((_, k) => (
          <mesh key={k} geometry={geos.tile} material={stoneMat} position={[-COVER / 2 + (k - 1) * ROAD.tile, 0, 0]} castShadow receiveShadow />
        ))}
      </group>
      <group position={[-wrap(scroll, SLOPE_P), 0, 0]}>
        <mesh geometry={geos.up} material={vertexMat(0.95, true, 0.1)} receiveShadow />
        <mesh geometry={geos.down} material={vertexMat(0.95, true, 0.1)} receiveShadow />
        {Array.from({ length: periods }).map((_, k) => (
          <mesh key={k} geometry={geos.scatter} material={vertexMat(0.9, true, 0.1)} position={[(p0 + k) * SLOPE_P, 0, 0]} />
        ))}
      </group>
      <group position={[-wrap(scroll, MARK_P), 0, 0]}>
        {Array.from({ length: marks }).map((_, k) => (
          <mesh key={k} geometry={geos.markers} material={vertexMat(0.9, false, 0.08)} position={[(m0 + k) * MARK_P, 0, 0]} castShadow />
        ))}
      </group>
      {backdrop ? <Andes scroll={scroll} /> : null}
    </group>
  );
};
