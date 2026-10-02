import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Upright } from "../../inca/outfit";
import { Nubi, NubiPalette, NubiPose } from "../Nubi";
import { CityStreet, STREET } from "../dino/Sets";
import { V3, canvasTexture, glowTexture, paintGeo, shadeHex, toy, vertexMat } from "../inca/kit";
import { mulberry } from "../noise";
import { Glow, additive } from "../thanos/FX";

// The hot, dry street of the water short ("¿Y si toda el agua desapareciera?") and everything
// that lives in it: thirsty Nubi-shaped civilians, a crowd builder and pose helpers, the
// comically thin lamp post, the dumpster hiding spot, the trail of leaked drops and the last
// big drop for the slow-motion close-up.
// World units sized for Nubi at size 2 (2 wide, ≈ 2 tall); ground y = 0 on the road, the
// sidewalks, alleys and the square are STREET.curb (0.16) high. `t` is time in seconds.
// Everything is deterministic (seeded) and builds its geometry once.

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth = (e0: number, e1: number, x: number) => {
  const k = clamp01((x - e0) / (e1 - e0));
  return k * k * (3 - 2 * k);
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** Lazily built value shared by every instance (static geometry). */
const once = <T,>(make: () => T) => {
  let v: T | undefined;
  return () => (v ??= make());
};
const rbox = (w: number, h: number, d: number, r: number, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) * 0.49));

/** Merges geometries after making them non-indexed without uvs (vertex-coloured meshes). */
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

const place = (g: THREE.BufferGeometry, color: string, pos: V3, rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]) => {
  paintGeo(g, color);
  g.applyMatrix4(
    new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale)),
  );
  return g;
};

// =======================================================================================
// Layout

const WALK_Y = STREET.curb;

/**
 * The water street: CityStreet (no giant wall) plus two short blocks at its near end (z > 13.4)
 * that open two dead-end alleys facing each other across the road (z 9.9..13.4, from the
 * sidewalk edge |x| = 6.4 to a wall at |x| = 12.6), a small square with a dry fountain beyond
 * them (z > 21.5) and dusty ground to the horizon.
 *   Alley B (x > 0): Nubi steps out of it onto the sidewalk.
 *   Alley A (x < 0): the hiding spot, a dumpster and boxes in its far corner.
 *   The thin pole stands on sidewalk A, between the two alleys' mouths and the zebra crossing.
 */
export const AGUA_STREET = {
  walkY: WALK_Y,
  alleyZ0: 9.9,
  alleyZ1: 13.4,
  alleyZ: 11.65,
  /** |x| of the alleys' dead-end walls. */
  back: 12.6,
  /** The extra blocks run from alleyZ1 to blockZ1. */
  blockZ1: 21.5,
  fountain: [0, 0, 29] as V3,
};

/** Mouth of alley B (x > 0) on the sidewalk. */
export const ALLEY_B: V3 = [6.4, WALK_Y, AGUA_STREET.alleyZ];
/** Mouth of alley A (x < 0) on the sidewalk. */
export const ALLEY_A: V3 = [-6.4, WALK_Y, AGUA_STREET.alleyZ];
/** The comically thin lamp post (base centre), on sidewalk B by the curb, 5 units from alley B. */
export const POLE_SPOT: V3 = [3.85, WALK_Y, 6.6];
/** Where Nubi "hides" behind the pole (the pole between it and a crowd coming from +z). */
export const POLE_HIDE: V3 = [3.85, WALK_Y, 5.75];
/** Dumpster in alley A: base centre, turned across the alley (long side along z, front +x). */
export const DUMPSTER_SPOT: V3 = [-9.6, WALK_Y, 11.65];
/** Nubi's hiding spot behind the dumpster, in alley A's dead end. */
export const HIDE_SPOT: V3 = [-11.5, WALK_Y, 11.4];

/** Ground height at (x, z): the road is at 0, sidewalks and alleys at the curb height. */
export const streetGroundY = (x: number, z: number) => (Math.abs(x) > STREET.road && z < AGUA_STREET.blockZ1 ? WALK_Y : 0);

/** Hot hazy sky for the CSS background behind the canvas. */
export const HOT_SKY = "linear-gradient(180deg, #FF8A47 0%, #FFAE5C 28%, #FFD08A 58%, #FFEBC2 100%)";

/** Warm, dusty midday light (use instead of the usual daylight rig). `k` scales it. */
export const HotLights: React.FC<{ k?: number }> = ({ k = 1 }) => (
  <>
    <hemisphereLight args={["#FFE4BC", "#9A6440", 1.3 * k]} />
    <directionalLight position={[-7, 14, 10]} intensity={2.5 * k} color="#FFD49A" />
    <directionalLight position={[9, 5, -10]} intensity={1.0 * k} color="#FF9A62" />
  </>
);

// =======================================================================================
// Street textures (the same tiles as CityStreet so the extension is seamless)

const asphaltTexture = () =>
  canvasTexture(
    "agua-asphalt",
    512,
    512,
    (ctx, W, H) => {
      ctx.fillStyle = "#4A505E";
      ctx.fillRect(0, 0, W, H);
      const rnd = mulberry(12);
      for (let i = 0; i < 900; i++) {
        ctx.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)";
        ctx.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 3, 2 + rnd() * 3);
      }
      ctx.fillStyle = "#FFD23F";
      for (const y of [0.1, 0.6]) ctx.fillRect(W / 2 - 7, y * H, 14, 0.28 * H);
      ctx.fillStyle = "#EEF1F5";
      ctx.fillRect(18, 0, 9, H);
      ctx.fillRect(W - 27, 0, 9, H);
    },
    { wrapS: true, wrapT: true },
  );

const pavementTexture = () =>
  canvasTexture(
    "agua-pavement",
    256,
    256,
    (ctx, W, H) => {
      ctx.fillStyle = "#AEB4C0";
      ctx.fillRect(0, 0, W, H);
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
          ctx.fillStyle = (i + j) % 2 ? "#D6DAE2" : "#CBD0DA";
          ctx.beginPath();
          ctx.roundRect(i * 128 + 4, j * 128 + 4, 120, 120, 12);
          ctx.fill();
        }
      }
    },
    { wrapS: true, wrapT: true },
  );

/** Warm sandstone square tiles for the little square. */
const squareTexture = () =>
  canvasTexture(
    "agua-square",
    256,
    256,
    (ctx, W, H) => {
      ctx.fillStyle = "#C9A37A";
      ctx.fillRect(0, 0, W, H);
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
          ctx.fillStyle = (i + j) % 2 ? "#E8CDA6" : "#DFC097";
          ctx.beginPath();
          ctx.roundRect(i * 128 + 5, j * 128 + 5, 118, 118, 14);
          ctx.fill();
        }
      }
    },
    { wrapS: true, wrapT: true },
  );

/** Dry cracked mud (the fountain's bottom, empty planters). */
const crackedTexture = () =>
  canvasTexture("agua-cracked", 256, 256, (ctx, W, H) => {
    ctx.fillStyle = "#C79A62";
    ctx.fillRect(0, 0, W, H);
    const rnd = mulberry(5);
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = rnd() < 0.5 ? "rgba(255,240,210,0.12)" : "rgba(90,50,20,0.1)";
      ctx.fillRect(rnd() * W, rnd() * H, 3 + rnd() * 5, 3 + rnd() * 5);
    }
    // A web of cracks: random walks from a few seeds.
    ctx.strokeStyle = "#6E4424";
    ctx.lineCap = "round";
    for (let k = 0; k < 16; k++) {
      let x = rnd() * W;
      let y = rnd() * H;
      let a = rnd() * Math.PI * 2;
      ctx.lineWidth = 2 + rnd() * 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 9; s++) {
        a += (rnd() - 0.5) * 1.2;
        x += Math.cos(a) * 16;
        y += Math.sin(a) * 16;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });

const texMats = new Map<string, THREE.MeshStandardMaterial>();
/** Material for a canvas texture with its own repeat, cached per key. */
const tiled = (key: string, tex: THREE.Texture, rx: number, ry: number, rough = 0.8, glow = 0.12) => {
  const k = `${key}|${rx}|${ry}`;
  let m = texMats.get(k);
  if (!m) {
    const c = tex.clone();
    c.repeat.set(rx, ry);
    c.needsUpdate = true;
    m = new THREE.MeshStandardMaterial({ map: c, roughness: rough, emissive: new THREE.Color("#ffffff"), emissiveMap: c, emissiveIntensity: glow });
    texMats.set(k, m);
  }
  return m;
};

// =======================================================================================
// Buildings that close the near end (they open the two alleys)

const facadeWindows = (W: number, H: number, fromY: number, seed: number) => {
  const rnd = mulberry(seed);
  const geos: THREE.BufferGeometry[] = [];
  const bays = Math.max(2, Math.round(W / 1.75));
  for (let y = fromY; y + 0.75 < H - 0.7; y += 2.15) {
    for (let b = 0; b < bays; b++) {
      const x = -W / 2 + (W / bays) * (b + 0.5);
      geos.push(place(rbox(1.04, 1.32, 0.14, 0.06), "#FFFFFF", [x, y, 0.05]));
      geos.push(place(rbox(0.8, 1.08, 0.1, 0.04), rnd() < 0.5 ? "#A6E0FF" : "#86CBF5", [x, y, 0.1]));
      geos.push(place(rbox(1.22, 0.14, 0.28, 0.05), "#FFFFFF", [x, y - 0.73, 0.1]));
      // Blinds pulled down against the heat.
      const blind = rnd();
      if (blind < 0.55) geos.push(place(rbox(0.8, 0.2 + blind * 1.4, 0.05, 0.02), blind < 0.25 ? "#FFB04A" : "#F4E1B8", [x, y + 0.54 - (0.2 + blind * 1.4) / 2, 0.17]));
    }
  }
  return mergeAll(geos);
};

type BlockSpec = { side: 1 | -1; h: number; color: string; seed: number };
const EXTRA_BLOCKS: BlockSpec[] = [
  { side: 1, h: 10.5, color: "#FFC93C", seed: 3 },
  { side: -1, h: 12.6, color: "#FF7EB6", seed: 5 },
];

const Block: React.FC<{ spec: BlockSpec }> = ({ spec }) => {
  const z0 = AGUA_STREET.alleyZ1;
  const z1 = AGUA_STREET.blockZ1;
  const W = z1 - z0;
  const D = STREET.depth;
  const H = spec.h;
  const geos = useMemo(
    () => ({
      body: rbox(W, H, D, 0.22),
      cornice: rbox(W + 0.3, 0.42, D + 0.3, 0.12),
      plinth: rbox(W + 0.14, 0.55, D + 0.14, 0.08),
      door: rbox(1.0, 2.1, 0.12, 0.08),
      front: facadeWindows(W, H, 2.3, spec.seed),
      sideWin: facadeWindows(D, H, 2.3, spec.seed + 11),
      pipe: new THREE.CylinderGeometry(0.09, 0.09, H - 0.6, 10),
      ac: rbox(1.0, 0.7, 0.6, 0.1),
    }),
    [W, H, D, spec.seed],
  );
  const s = spec.side;
  return (
    <group position={[s * STREET.front, WALK_Y, (z0 + z1) / 2]} rotation={[0, (-s * Math.PI) / 2, 0]}>
      <mesh geometry={geos.body} material={toy(spec.color, { rough: 0.55, glow: 0.15 })} position={[0, H / 2, -D / 2]} castShadow receiveShadow />
      <mesh geometry={geos.plinth} material={toy(shadeHex(spec.color, -0.16), { rough: 0.6 })} position={[0, 0.27, -D / 2]} />
      <mesh geometry={geos.cornice} material={toy("#FFF6E6", { rough: 0.5, glow: 0.14 })} position={[0, H - 0.1, -D / 2]} castShadow />
      <mesh geometry={geos.front} material={vertexMat(0.4, false, 0.2)} />
      <mesh geometry={geos.door} material={toy(shadeHex(spec.color, -0.3), { rough: 0.5 })} position={[W * 0.28, 1.05, 0.06]} />
      {/* The face towards the alley: windows, a drainpipe and an air conditioner (dry). */}
      <group position={[-s * (W / 2), 0, -D / 2]} rotation={[0, (-s * Math.PI) / 2, 0]}>
        <mesh geometry={geos.sideWin} material={vertexMat(0.4, false, 0.2)} />
        <mesh geometry={geos.pipe} material={toy("#9AA3AD", { rough: 0.4, metal: 0.3 })} position={[D / 2 - 0.5, (H - 0.6) / 2, 0.15]} />
        <mesh geometry={geos.ac} material={toy("#D7DCE4", { rough: 0.5 })} position={[-D / 2 + 1.2, 3.6, 0.35]} />
      </group>
    </group>
  );
};

/** Alley floor and its dead-end wall (one side). */
const AlleyFloor: React.FC<{ side: 1 | -1 }> = ({ side }) => {
  const { alleyZ0, alleyZ1, back } = AGUA_STREET;
  const len = back - STREET.walk + 0.4;
  const wid = alleyZ1 - alleyZ0 + 0.3;
  const geos = useMemo(
    () => ({
      floor: rbox(len, WALK_Y, wid, 0.03, 1),
      wall: rbox(0.45, 5.6, wid + 0.4, 0.1),
      cap: rbox(0.6, 0.25, wid + 0.6, 0.08),
      pipe: new THREE.CylinderGeometry(0.09, 0.09, 8.5, 10),
    }),
    [len, wid],
  );
  return (
    <group>
      <mesh
        geometry={geos.floor}
        material={tiled("alley", pavementTexture(), len / 1.4, wid / 1.4, 0.85, 0.08)}
        position={[side * (STREET.walk + len / 2 - 0.2), WALK_Y / 2, (alleyZ0 + alleyZ1) / 2]}
        receiveShadow
      />
      <mesh geometry={geos.wall} material={toy("#D9875F", { rough: 0.8, glow: 0.12 })} position={[side * (back + 0.2), WALK_Y + 2.8, (alleyZ0 + alleyZ1) / 2]} castShadow />
      <mesh geometry={geos.cap} material={toy("#F0D2B4", { rough: 0.7 })} position={[side * (back + 0.2), WALK_Y + 5.65, (alleyZ0 + alleyZ1) / 2]} />
      {/* A drainpipe down the corner of the first CityStreet building. */}
      <mesh geometry={geos.pipe} material={toy("#9AA3AD", { rough: 0.4, metal: 0.3 })} position={[side * 7.0, WALK_Y + 4.25, alleyZ0 + 0.12]} />
    </group>
  );
};

// =======================================================================================
// Dry street furniture

/**
 * Dry fountain (≈ 5.6 wide, 2.9 tall): a sandstone basin with a cracked, bone-dry bottom, a
 * column with an empty upper bowl and a few dead leaves. Origin at the centre of its base.
 */
export const DryFountain: React.FC = () => {
  const geos = useMemo(() => {
    const basin = new THREE.LatheGeometry(
      [
        [0, 0.14],
        [2.32, 0.14],
        [2.36, 0.7],
        [2.52, 0.8],
        [2.74, 0.76],
        [2.82, 0.08],
        [2.92, 0],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      48,
    );
    const bowl = new THREE.LatheGeometry(
      [
        [0, 0],
        [0.3, 0],
        [0.95, 0.22],
        [1.1, 0.36],
        [1.02, 0.4],
        [0.85, 0.3],
        [0, 0.26],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      36,
    );
    basin.computeVertexNormals();
    bowl.computeVertexNormals();
    return {
      basin,
      bowl,
      floor: new THREE.CircleGeometry(2.34, 40).rotateX(-Math.PI / 2),
      column: new THREE.CylinderGeometry(0.3, 0.42, 1.9, 20),
      ball: new THREE.SphereGeometry(0.28, 18, 12),
      spout: new THREE.CylinderGeometry(0.06, 0.08, 0.4, 10),
      leaf: new THREE.SphereGeometry(0.16, 8, 6).scale(1, 0.25, 0.6),
    };
  }, []);
  const stone = toy("#EBD6B5", { rough: 0.75, glow: 0.15 });
  return (
    <group>
      <mesh geometry={geos.basin} material={stone} castShadow receiveShadow />
      <mesh geometry={geos.floor} material={tiled("fountain", crackedTexture(), 2, 2, 0.95, 0.1)} position={[0, 0.16, 0]} />
      <mesh geometry={geos.column} material={stone} position={[0, 1.1, 0]} castShadow />
      <mesh geometry={geos.bowl} material={stone} position={[0, 2.05, 0]} castShadow />
      <mesh geometry={geos.ball} material={stone} position={[0, 2.62, 0]} />
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} geometry={geos.spout} material={toy("#B9A07E", { rough: 0.6 })} position={[Math.cos(i * 1.57) * 0.3, 2.62, Math.sin(i * 1.57) * 0.3]} rotation={[Math.sin(i * 1.57) * 1.2, 0, -Math.cos(i * 1.57) * 1.2]} />
      ))}
      {[
        [1.2, 0.2, 0.8, 0.4],
        [-0.9, 0.2, -1.4, 2.1],
        [0.4, 0.2, -1.1, 4.0],
      ].map(([x, y, z, a], i) => (
        <mesh key={i} geometry={geos.leaf} material={toy(i % 2 ? "#A86F35" : "#C58B43", { rough: 0.8 })} position={[x, y, z]} rotation={[0, a, 0.2]} />
      ))}
    </group>
  );
};

/** Planter box with cracked dry soil, a dead twig and a drooping brown flower (≈ 1.4 wide). */
export const EmptyPlanter: React.FC<{ seed?: number }> = ({ seed = 0 }) => {
  const geos = useMemo(
    () => ({
      box: rbox(1.4, 0.62, 0.72, 0.1),
      soil: rbox(1.22, 0.06, 0.56, 0.03, 1),
      stem: new THREE.CylinderGeometry(0.025, 0.035, 0.7, 6),
      twig: new THREE.CylinderGeometry(0.018, 0.024, 0.35, 5),
      head: new THREE.SphereGeometry(0.11, 10, 8),
      petal: new THREE.SphereGeometry(0.07, 8, 6).scale(1, 0.35, 1.6),
    }),
    [],
  );
  const brown = toy("#8A6237", { rough: 0.8 });
  const flip = seed % 2 ? -1 : 1;
  return (
    <group>
      <mesh geometry={geos.box} material={toy("#D2774A", { rough: 0.6, glow: 0.15 })} position={[0, 0.31, 0]} castShadow />
      <mesh geometry={geos.soil} material={tiled("planter", crackedTexture(), 1.2, 0.55, 0.95, 0.1)} position={[0, 0.6, 0]} />
      {/* Drooping dead flower. */}
      <group position={[0.3 * flip, 0.62, 0]} rotation={[0, 0, -0.35 * flip]}>
        <mesh geometry={geos.stem} material={brown} position={[0, 0.35, 0]} />
        <group position={[0, 0.7, 0]} rotation={[0, 0, -1.9 * flip]}>
          <mesh geometry={geos.head} material={toy("#7A4E2A", { rough: 0.8 })} />
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} geometry={geos.petal} material={toy("#B98A4A", { rough: 0.8 })} position={[Math.cos(i * 1.26) * 0.14, -0.04, Math.sin(i * 1.26) * 0.14]} rotation={[0, -i * 1.26, 0.5]} />
          ))}
        </group>
      </group>
      {/* Dead twig. */}
      <group position={[-0.35 * flip, 0.62, 0.05]} rotation={[0.1, 0, 0.2 * flip]}>
        <mesh geometry={geos.stem} material={brown} position={[0, 0.3, 0]} scale={[1, 0.85, 1]} />
        <mesh geometry={geos.twig} material={brown} position={[0.08, 0.5, 0]} rotation={[0, 0, -0.8]} />
        <mesh geometry={geos.twig} material={brown} position={[-0.07, 0.38, 0]} rotation={[0, 0, 0.9]} />
      </group>
    </group>
  );
};

/** A dry tumbleweed (≈ 0.9 across) rolling along +x at `speed` units/s; place it with a group. */
export const Tumbleweed: React.FC<{ t: number; speed?: number; radius?: number }> = ({ t, speed = 2.2, radius = 0.45 }) => {
  const geo = useMemo(() => {
    const rnd = mulberry(31);
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) {
      const g = new THREE.TorusGeometry(radius * (0.65 + rnd() * 0.35), 0.022, 4, 20);
      g.rotateX(rnd() * Math.PI);
      g.rotateY(rnd() * Math.PI);
      parts.push(paintGeo(g, i % 2 ? "#B88A4E" : "#9C7240"));
    }
    return mergeAll(parts);
  }, [radius]);
  const x = t * speed;
  const hop = Math.abs(Math.sin(t * 5.5)) * radius * 0.5;
  return (
    <group position={[x, radius + hop, 0]} rotation={[0, 0, -x / radius]}>
      <mesh geometry={geo} material={vertexMat(0.8, false, 0.14)} castShadow />
    </group>
  );
};

// Dry trees: CityStreet's round green tree crowns are swapped for dry ochre ones.
const DRY_SWAP = once(() => {
  const m = new Map<THREE.Material, THREE.Material>();
  const greens = ["#3FBF55", "#2FA84A", "#56CF62"];
  const dry = ["#D9A64E", "#C08A3E", "#E3BC6A"];
  greens.forEach((g, i) => m.set(toy(g, { rough: 0.8, flat: true, glow: 0.16 }), toy(dry[i], { rough: 0.85, flat: true, glow: 0.18 })));
  return m;
});

const PLANTERS: [number, number][] = [
  [-1, 7.6],
  [1, 7.9],
  [1, 15.2],
  [-1, 16.0],
  [1, 19.4],
  [-1, 19.8],
];

const HAZE_BLOCKS: [number, number, number, number, number][] = [
  // x, z, w, h, d
  [-16, 40, 7, 9, 6],
  [-7, 46, 6, 13, 6],
  [3, 44, 8, 8, 6],
  [13, 41, 6, 11, 6],
  [22, 47, 8, 7, 6],
  [-26, 48, 9, 12, 6],
  [-2, 58, 10, 16, 8],
  [17, 60, 9, 13, 8],
];

/**
 * The hot, dry street: CityStreet without the giant wall (dry ochre tree crowns), the two
 * alleys at its near end with the extra blocks, a sandstone square with a DryFountain, empty
 * planters, a dry hydrant, and hazy city blocks and dusty ground beyond. Pair with HotLights
 * and HOT_SKY. `props` false leaves out the dumpster corner and the thin pole (scenes that place
 * their own).
 */
export const DryStreet: React.FC<{ t?: number; props?: boolean; far?: boolean }> = ({ t = 0, props = true, far = true }) => {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    const swap = DRY_SWAP();
    ref.current?.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const r = swap.get(mesh.material);
      if (r) mesh.material = r;
    });
  });
  const ext = { z0: 12, z1: AGUA_STREET.blockZ1 };
  const L = ext.z1 - ext.z0;
  const walkW = STREET.walk - STREET.road;
  const geos = useMemo(
    () => ({
      road: new THREE.PlaneGeometry(STREET.road * 2, L).rotateX(-Math.PI / 2),
      walk: rbox(walkW, STREET.curb, L, 0.03, 1),
      curb: rbox(0.28, STREET.curb + 0.02, L, 0.05, 1),
      endCurb: rbox(STREET.walk * 2, STREET.curb + 0.02, 0.3, 0.05, 1),
      square: new THREE.PlaneGeometry(40, 26).rotateX(-Math.PI / 2),
      ground: new THREE.PlaneGeometry(320, 260).rotateX(-Math.PI / 2),
      haze: rbox(1, 1, 1, 0.08, 1),
    }),
    [L, walkW],
  );
  return (
    <group>
      <group ref={ref}>
        <CityStreet t={t} wall={false} />
      </group>
      {/* The street continues past the alleys to the square. */}
      <mesh geometry={geos.road} material={tiled("road", asphaltTexture(), 1, L / 8, 0.85, 0.1)} position={[0, -0.04, (ext.z0 + ext.z1) / 2]} receiveShadow />
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={geos.walk} material={tiled("walk", pavementTexture(), walkW / 1.2, L / 1.2, 0.8, 0.12)} position={[s * (STREET.road + walkW / 2), STREET.curb / 2, (ext.z0 + ext.z1) / 2]} receiveShadow />
          <mesh geometry={geos.curb} material={toy("#E3E6EC", { rough: 0.7 })} position={[s * (STREET.road + 0.1), STREET.curb / 2 + 0.01, (ext.z0 + ext.z1) / 2]} />
          <Block spec={EXTRA_BLOCKS[s > 0 ? 0 : 1]} />
          <AlleyFloor side={s as 1 | -1} />
        </group>
      ))}
      <mesh geometry={geos.square} material={tiled("square", squareTexture(), 16, 10.4, 0.85, 0.12)} position={[0, -0.02, ext.z1 + 13]} receiveShadow />
      <group position={AGUA_STREET.fountain}>
        <DryFountain />
      </group>
      {PLANTERS.map(([s, z], i) => (
        <group key={i} position={[s * 5.75, WALK_Y, z]} rotation={[0, (s * Math.PI) / 2, 0]}>
          <EmptyPlanter seed={i} />
        </group>
      ))}
      {props ? (
        <>
          <group position={POLE_SPOT}>
            <ThinPole />
          </group>
          <DumpsterCorner />
        </>
      ) : null}
      {far ? (
        <>
          <mesh geometry={geos.ground} material={toy("#D8B386", { rough: 1, glow: 0.2 })} position={[0, -0.06, 150]} receiveShadow />
          {HAZE_BLOCKS.map(([x, z, w, h, d], i) => (
            <mesh
              key={i}
              geometry={geos.haze}
              material={toy(["#F2B98A", "#EDB596", "#F5C79A", "#E9AE8E"][i % 4], { rough: 0.9, glow: 0.55 })}
              position={[x, h / 2, z]}
              scale={[w, h, d]}
            />
          ))}
        </>
      ) : null}
    </group>
  );
};

// =======================================================================================
// The thin pole, the dumpster corner

/**
 * A street lamp post far too thin for Nubi to hide behind: a 0.07-thick pole, 5.4 tall, with a
 * little lamp on a curved arm reaching towards +x and a tiny round sign at Nubi's eye height.
 * Origin at the centre of its base.
 */
export const ThinPole: React.FC = () => {
  const geos = useMemo(
    () => ({
      base: new THREE.CylinderGeometry(0.09, 0.13, 0.22, 14),
      pole: new THREE.CylinderGeometry(0.035, 0.04, 5.4, 10),
      arm: new THREE.TorusGeometry(0.35, 0.03, 6, 14, Math.PI / 2),
      hood: new THREE.SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      bulb: new THREE.SphereGeometry(0.11, 12, 8),
      sign: new THREE.CylinderGeometry(0.2, 0.2, 0.03, 24).rotateX(Math.PI / 2),
      bar: rbox(0.26, 0.07, 0.04, 0.02, 1),
    }),
    [],
  );
  const metal = toy("#2F4858", { rough: 0.45, metal: 0.3, glow: 0.12 });
  return (
    <group>
      <mesh geometry={geos.base} material={metal} position={[0, 0.11, 0]} />
      <mesh geometry={geos.pole} material={metal} position={[0, 2.7, 0]} castShadow />
      <mesh geometry={geos.arm} material={metal} position={[0.35, 5.38, 0]} rotation={[0, 0, Math.PI / 2]} />
      <group position={[0.7, 5.72, 0]}>
        <mesh geometry={geos.hood} material={metal} scale={[1, 0.6, 1]} />
        <mesh geometry={geos.bulb} material={toy("#FFF3C0", { glow: 0.5 })} position={[0, -0.03, 0]} />
      </group>
      {/* "No entry" sign: red disc with a white bar, barely wider than the pole. */}
      <group position={[0, 2.25, 0.05]}>
        <mesh geometry={geos.sign} material={toy("#E8383D", { rough: 0.4, glow: 0.2 })} />
        <mesh geometry={geos.bar} material={toy("#FFFFFF", { glow: 0.2 })} position={[0, 0, 0.025]} />
      </group>
    </group>
  );
};

/** Dumpster size (world units): long side along x, front at +z. */
export const DUMPSTER = { w: 2.6, h: 1.62, d: 1.35 };

/**
 * Green toy dumpster on four little wheels (2.6 × 1.6 × 1.35), long side along x, front +z.
 * `lid` 0..1 lifts its two lids (hinged at the back). Origin at the centre of its base.
 */
export const Dumpster: React.FC<{ lid?: number }> = ({ lid = 0 }) => {
  const { w, d } = DUMPSTER;
  const geos = useMemo(
    () => ({
      body: rbox(w, 1.28, d, 0.14),
      rim: rbox(w + 0.14, 0.14, d + 0.14, 0.06),
      lid: rbox(w / 2 - 0.04, 0.1, d + 0.12, 0.05),
      wheel: new THREE.CylinderGeometry(0.15, 0.15, 0.12, 16).rotateZ(Math.PI / 2),
      pocket: rbox(0.2, 0.2, 0.9, 0.06),
      stripe: rbox(w - 0.3, 0.16, 0.04, 0.03, 1),
    }),
    [w, d],
  );
  const green = toy("#2FA36B", { rough: 0.45, glow: 0.16 });
  const dark = toy("#22804F", { rough: 0.5, glow: 0.14 });
  return (
    <group>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => <mesh key={`${sx}${sz}`} geometry={geos.wheel} material={toy("#2B2F38", { rough: 0.6 })} position={[sx * (w / 2 - 0.25), 0.15, sz * (d / 2 - 0.2)]} />),
      )}
      <mesh geometry={geos.body} material={green} position={[0, 0.94, 0]} castShadow receiveShadow />
      <mesh geometry={geos.rim} material={dark} position={[0, 1.55, 0]} />
      <mesh geometry={geos.stripe} material={toy("#FFD23F", { rough: 0.5, glow: 0.2 })} position={[0, 0.72, d / 2 + 0.01]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geos.pocket} material={dark} position={[s * (w / 2 + 0.06), 1.25, 0]} />
      ))}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (w / 4), 1.62, -d / 2 - 0.04]} rotation={[-lid * 1.1 * (s > 0 ? 1 : 0.8), 0, 0]}>
          <mesh geometry={geos.lid} material={dark} position={[0, 0, (d + 0.12) / 2]} castShadow />
        </group>
      ))}
    </group>
  );
};

/** Cardboard box (`size` world units) with a tape strip over the top. Origin at the base centre. */
export const CardboardBox: React.FC<{ size?: V3; color?: string }> = ({ size = [0.9, 0.7, 0.8], color = "#C9965E" }) => {
  const [w, h, d] = size;
  const geos = useMemo(() => ({ body: rbox(w, h, d, 0.05), tape: rbox(0.22, 0.02, d + 0.02, 0.01, 1), seam: rbox(w + 0.005, 0.02, 0.02, 0.005, 1) }), [w, h, d]);
  return (
    <group>
      <mesh geometry={geos.body} material={toy(color, { rough: 0.85, glow: 0.14 })} position={[0, h / 2, 0]} castShadow receiveShadow />
      <mesh geometry={geos.tape} material={toy("#EED29C", { rough: 0.5, glow: 0.18 })} position={[0, h + 0.005, 0]} />
      <mesh geometry={geos.seam} material={toy(shadeHex(color, -0.15), { rough: 0.9 })} position={[0, h - 0.004, 0]} />
    </group>
  );
};

/** Black rubbish bag (≈ 1 across). */
export const TrashBag: React.FC = () => {
  const geos = useMemo(() => ({ bag: new THREE.IcosahedronGeometry(0.5, 2), knot: new THREE.ConeGeometry(0.14, 0.28, 8) }), []);
  const mat = toy("#353B48", { rough: 0.25, glow: 0.12 });
  return (
    <group>
      <mesh geometry={geos.bag} material={mat} position={[0, 0.42, 0]} scale={[1, 0.85, 0.95]} castShadow />
      <mesh geometry={geos.knot} material={mat} position={[0, 0.9, 0]} />
    </group>
  );
};

/**
 * Alley A's dead end: the dumpster turned across the alley (DUMPSTER_SPOT, front towards the
 * street) with Nubi's hiding spot behind it (HIDE_SPOT), boxes stacked in the far corner and by
 * the dumpster, a rubbish bag at the front. World space.
 */
export const DumpsterCorner: React.FC<{ lid?: number }> = ({ lid = 0 }) => (
  <group>
    <group position={DUMPSTER_SPOT} rotation={[0, Math.PI / 2, 0]}>
      <Dumpster lid={lid} />
    </group>
    <group position={[-12.05, WALK_Y, 12.95]} rotation={[0, 0.15, 0]}>
      <CardboardBox size={[0.95, 0.8, 0.8]} />
      <group position={[0.05, 0.8, 0.02]} rotation={[0, -0.35, 0]}>
        <CardboardBox size={[0.75, 0.6, 0.65]} color="#D4A56C" />
      </group>
    </group>
    <group position={[-7.85, WALK_Y, 13.1]} rotation={[0, -0.4, 0]}>
      <CardboardBox size={[0.7, 0.5, 0.6]} color="#BE8A55" />
    </group>
    <group position={[-6.9, WALK_Y, 13.0]}>
      <TrashBag />
    </group>
  </group>
);

// =======================================================================================
// Civilians

export type CivilianHat = "none" | "cap" | "sunhat" | "headband";
export type CivilianHeld = "none" | "bucket" | "straw";

/** How one civilian looks: a Nubi-shaped toy in its own colours with a few accessories. */
export type CivilianLook = {
  palette: NubiPalette;
  /** Body width (world units), 1.7–2.4. */
  size: number;
  hat: CivilianHat;
  hatColor: string;
  /** Round glasses over the eyes, or sunglasses pushed up on top of the head. */
  glasses: "none" | "round" | "shades";
  scarf: string | null;
  backpack: string | null;
  /** Something held up in the right fin: an empty bucket or a long straw. */
  held: CivilianHeld;
  /** 0..1 heavy, droopy eyelids (thirsty). */
  droop: number;
  seed: number;
};

/** Body colours of the civilians (never Nubi's mint green). */
export const CIVILIAN_COLORS = [
  "#FF8FB8",
  "#5EC2FF",
  "#FFD54A",
  "#FF9A3D",
  "#A887FF",
  "#AAB2BE",
  "#FF5A5F",
  "#E0A8FF",
  "#FF7F6B",
  "#4E7BEA",
  "#F4E2C4",
  "#C08A5B",
  "#FF5FD2",
  "#7FD3E8",
];
const ACCENTS = ["#FFFFFF", "#FF4F7B", "#2F6BFF", "#FFD23F", "#1FB35A", "#FF8A1F", "#7B2FF7", "#E8383D", "#2B2F38"];

/**
 * Deterministic look for civilian `seed` (seeds 0, 1, 2... cycle through CIVILIAN_COLORS, so a
 * crowd built from consecutive seeds never repeats a colour next to itself). `o` overrides.
 */
export const civilianLook = (seed: number, o: Partial<CivilianLook> = {}): CivilianLook => {
  const rnd = mulberry(seed * 7919 + 101);
  const n = CIVILIAN_COLORS.length;
  const body = CIVILIAN_COLORS[((seed % n) + n) % n];
  const accent = () => {
    let c = ACCENTS[Math.floor(rnd() * ACCENTS.length)];
    if (c === body) c = ACCENTS[(ACCENTS.indexOf(c) + 3) % ACCENTS.length];
    return c;
  };
  const size = 1.7 + rnd() * 0.7;
  const h = rnd();
  const hat: CivilianHat = h < 0.3 ? "cap" : h < 0.5 ? "sunhat" : h < 0.68 ? "headband" : "none";
  const hatColor = hat === "sunhat" ? (rnd() < 0.6 ? "#F2D27A" : "#FFF3D6") : accent();
  const gl = rnd();
  const glasses = gl < 0.2 ? "round" : gl < 0.34 && hat !== "sunhat" && hat !== "cap" ? "shades" : "none";
  const scarf = rnd() < 0.25 ? accent() : null;
  const backpack = rnd() < 0.3 ? accent() : null;
  const hd = rnd();
  const held: CivilianHeld = hd < 0.14 ? "bucket" : hd < 0.26 ? "straw" : "none";
  const droop = 0.35 + rnd() * 0.35;
  const fins = rnd() < 0.3 ? shadeHex(body, 0.06) : body;
  return {
    palette: { body, fins, legs: shadeHex(body, -0.1) },
    size,
    hat,
    hatColor,
    glasses,
    scarf,
    backpack,
    held,
    droop,
    seed,
    ...o,
  };
};

const gearGeos = once(() => {
  const strawTex = canvasTexture("agua-straw", 64, 256, (ctx, W, H) => {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#FF4F7B";
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * 32);
      ctx.lineTo(W, i * 32 + 14);
      ctx.lineTo(W, i * 32 + 30);
      ctx.lineTo(0, i * 32 + 16);
      ctx.closePath();
      ctx.fill();
    }
  });
  return {
    capCrown: new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    capBill: rbox(5.4, 0.32, 3.1, 0.15),
    button: new THREE.SphereGeometry(0.5, 12, 8),
    brim: new THREE.CylinderGeometry(6.6, 6.6, 0.3, 36),
    hatCrown: new THREE.CylinderGeometry(3.4, 3.8, 2.3, 28),
    hatBand: new THREE.CylinderGeometry(3.86, 3.86, 0.62, 28),
    headband: rbox(10.5, 1.05, 9.3, 0.5),
    ring: new THREE.TorusGeometry(1.3, 0.17, 8, 28),
    bridge: new THREE.CylinderGeometry(0.13, 0.13, 2.1, 8).rotateZ(Math.PI / 2),
    lens: rbox(2.5, 1.55, 0.32, 0.55),
    scarf: rbox(10.6, 1.2, 9.4, 0.55),
    knot: new THREE.ConeGeometry(1.0, 1.9, 4).rotateX(Math.PI).rotateY(Math.PI / 4),
    pack: rbox(6.4, 5.4, 2.6, 1.0),
    pocket: rbox(4.4, 2.2, 0.9, 0.45),
    strap: rbox(1.0, 0.45, 9.7, 0.2),
    lid: rbox(1, 1, 0.2, 0.08),
    sweat: (() => {
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI;
        pts.push(new THREE.Vector2(Math.sin(a) * Math.pow(Math.sin(a / 2), 0.9), Math.cos(a)));
      }
      return new THREE.LatheGeometry(pts, 14);
    })(),
    bucket: new THREE.CylinderGeometry(1.5, 1.1, 2.3, 22, 1, true),
    bucketIn: new THREE.CylinderGeometry(1.42, 1.04, 2.26, 22, 1, true),
    bucketBottom: new THREE.CircleGeometry(1.1, 22).rotateX(-Math.PI / 2),
    bucketRim: new THREE.TorusGeometry(1.5, 0.12, 6, 24).rotateX(Math.PI / 2),
    handle: new THREE.TorusGeometry(1.45, 0.08, 6, 20, Math.PI),
    straw: new THREE.CylinderGeometry(0.22, 0.22, 7.5, 12),
    strawTip: new THREE.CylinderGeometry(0.22, 0.22, 1.6, 12),
    strawTex,
  };
});

const gearMats = once(() => ({
  sweat: new THREE.MeshStandardMaterial({ color: "#8FE0FF", roughness: 0.08, metalness: 0.1, emissive: new THREE.Color("#4FC0FF"), emissiveIntensity: 0.45 }),
  lens: toy("#1E2230", { rough: 0.12, metal: 0.4, glow: 0.05 }),
  bucketIn: new THREE.MeshStandardMaterial({ color: "#9FB4C4", roughness: 0.5, side: THREE.BackSide, emissive: new THREE.Color("#9FB4C4"), emissiveIntensity: 0.12 }),
  straw: new THREE.MeshStandardMaterial({ map: gearGeos().strawTex, roughness: 0.35, emissive: new THREE.Color("#ffffff"), emissiveMap: gearGeos().strawTex, emissiveIntensity: 0.2 }),
}));

/** Empty bucket held by the handle (model units, hangs below the origin). Shows its dry inside. */
const EmptyBucket: React.FC<{ color: string }> = ({ color }) => {
  const g = gearGeos();
  const m = gearMats();
  const outer = toy(color, { rough: 0.4, glow: 0.16, side: THREE.DoubleSide });
  return (
    <group rotation={[0.55, 0, 0.1]}>
      <mesh geometry={g.handle} material={toy("#C9D2DC", { metal: 0.5, rough: 0.3 })} position={[0, -1.35, 0]} />
      <group position={[0, -2.55, 0]}>
        <mesh geometry={g.bucket} material={outer} castShadow />
        <mesh geometry={g.bucketIn} material={m.bucketIn} />
        <mesh geometry={g.bucketBottom} material={toy("#7F93A3", { rough: 0.6 })} position={[0, -1.12, 0]} />
        <mesh geometry={g.bucketRim} material={outer} position={[0, 1.15, 0]} />
      </group>
    </group>
  );
};

/** A long bendy striped straw held up (model units, standing on the origin). */
const LongStraw: React.FC = () => {
  const g = gearGeos();
  const m = gearMats();
  return (
    <group position={[0, -0.6, 0]}>
      <mesh geometry={g.straw} material={m.straw} position={[0, 3.75, 0]} />
      <mesh geometry={g.strawTip} material={m.straw} position={[0.55, 7.85, 0]} rotation={[0, 0, -0.75]} />
    </group>
  );
};

/** Sweat drops forming at the top corners of the face, sliding down and falling off. */
const Sweat: React.FC<{ t: number; seed: number; amount: number }> = ({ t, seed, amount }) => {
  const g = gearGeos();
  const m = gearMats();
  if (amount <= 0.02) return null;
  return (
    <group>
      {[0, 1].map((k) => {
        const period = 1.25 + 0.2 * k + (seed % 3) * 0.08;
        const ph = (((t + seed * 0.37 + k * 0.6) / period) % 1 + 1) % 1;
        const side = k ? 1 : -1;
        const grow = ph < 0.15 ? ph / 0.15 : ph > 0.82 ? Math.max(0, 1 - (ph - 0.82) / 0.18) : 1;
        const fallK = Math.max(0, ph - 0.72) / 0.28;
        const s = 0.62 * amount * grow;
        if (s < 0.02) return null;
        return (
          <mesh
            key={k}
            geometry={g.sweat}
            material={m.sweat}
            position={[side * (5.15 + fallK * 0.9), 9.0 - 2.6 * smooth(0.08, 0.72, ph) - fallK * fallK * 3.0, 3.6]}
            rotation={[0, 0, side * 0.15]}
            scale={[s, s * 1.15, s]}
          />
        );
      })}
    </group>
  );
};

/**
 * Accessories and the thirsty details (sweat, droopy lids) of one civilian, as children of its
 * <Nubi> (model units). Lids follow the eyes; wide eyes (eyeScale > 1) lift them.
 */
const CivilianGear: React.FC<{ look: CivilianLook; pose: NubiPose; t: number; thirst: number }> = ({ look, pose, t, thirst }) => {
  const g = gearGeos();
  const m = gearMats();
  const body = look.palette.body ?? "#FFFFFF";
  const hat = toy(look.hatColor, { rough: look.hat === "sunhat" ? 0.8 : 0.5, glow: 0.16 });
  // Lids: sit over the top of each eye, outer corners lower (a tired, droopy look).
  const eyeScale = pose.eyeScale ?? 1;
  const eyeH = Math.max(0.1, (1 - (pose.blink ?? 0)) * eyeScale);
  const eyeW = Math.min(1.35, Math.max(0.8, eyeScale));
  const droop = look.droop * thirst * (1 - smooth(1.0, 1.25, eyeScale)) * (1 - (pose.blink ?? 0));
  const eh = 1.75 * eyeH;
  const ex = (pose.lookX ?? 0) * 0.5;
  const ey = 5.5 + (pose.lookY ?? 0) * 0.4;
  const lidMat = toy(shadeHex(body, -0.06), { rough: 0.42, glow: 0.14 });
  return (
    <group>
      {droop > 0.03
        ? [-1, 1].map((side) => {
            const lh = droop * eh * 0.55 + 0.2;
            return (
              <mesh
                key={side}
                geometry={g.lid}
                material={lidMat}
                position={[side * 2.3 + ex, ey + eh / 2 - lh / 2 + 0.12, 4.78]}
                rotation={[0, 0, -side * 0.26]}
                scale={[1.05 * eyeW + 0.45, lh, 1]}
              />
            );
          })
        : null}
      <Sweat t={t} seed={look.seed} amount={thirst} />
      {look.hat === "cap" ? (
        <group>
          <mesh geometry={g.capCrown} material={hat} position={[0, 9.55, -0.1]} scale={[4.6, 2.0, 4.3]} castShadow />
          <mesh geometry={g.capBill} material={hat} position={[0, 9.72, 4.75]} rotation={[0.14, 0, 0]} />
          <mesh geometry={g.button} material={hat} position={[0, 11.55, -0.1]} />
        </group>
      ) : null}
      {look.hat === "sunhat" ? (
        <group position={[0, 0, -0.2]} rotation={[-0.06, 0, 0.05]}>
          <mesh geometry={g.brim} material={hat} position={[0, 10.05, 0]} castShadow />
          <mesh geometry={g.hatCrown} material={hat} position={[0, 11.3, 0]} castShadow />
          <mesh geometry={g.hatBand} material={toy(ACCENTS[(look.seed * 3 + 1) % 7 + 1], { rough: 0.5, glow: 0.18 })} position={[0, 10.5, 0]} />
        </group>
      ) : null}
      {look.hat === "headband" ? <mesh geometry={g.headband} material={hat} position={[0, 8.65, 0]} /> : null}
      {look.glasses === "round" ? (
        <group>
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={g.ring} material={toy("#2B2F38", { rough: 0.35 })} position={[s * 2.3, 5.55, 4.85]} />
          ))}
          <mesh geometry={g.bridge} material={toy("#2B2F38", { rough: 0.35 })} position={[0, 5.9, 4.85]} scale={[0.5, 1, 1]} />
        </group>
      ) : null}
      {look.glasses === "shades" ? (
        <group position={[0, 10.05, 2.3]} rotation={[-1.25, 0, 0]}>
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={g.lens} material={m.lens} position={[s * 1.55, 0, 0]} />
          ))}
          <mesh geometry={g.bridge} material={m.lens} position={[0, 0.3, 0]} scale={[0.5, 1, 1]} />
        </group>
      ) : null}
      {look.scarf ? (
        <group>
          <mesh geometry={g.scarf} material={toy(look.scarf, { rough: 0.7, glow: 0.16 })} position={[0, 3.55, 0]} />
          <mesh geometry={g.knot} material={toy(look.scarf, { rough: 0.7, glow: 0.16 })} position={[2.4, 2.6, 4.7]} rotation={[0.2, 0, 0.2]} />
        </group>
      ) : null}
      {look.backpack ? (
        <group>
          <mesh geometry={g.pack} material={toy(look.backpack, { rough: 0.6, glow: 0.16 })} position={[0, 5.7, -5.35]} castShadow />
          <mesh geometry={g.pocket} material={toy(shadeHex(look.backpack, -0.12), { rough: 0.6 })} position={[0, 4.5, -6.75]} />
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={g.strap} material={toy(shadeHex(look.backpack ?? "#FFFFFF", -0.12), { rough: 0.6 })} position={[s * 2.9, 9.95, -0.05]} />
          ))}
        </group>
      ) : null}
    </group>
  );
};

/**
 * One thirsty civilian: a Nubi-shaped toy in `look`'s colours with its accessories, sweating
 * (`thirst` 0..1 sets the sweat and the droopy lids). Held props (empty bucket, long straw) go in
 * the right fin, which is raised to show them (finR ≥ 0.75). `holdR` replaces the held prop.
 */
export const Civilian: React.FC<{
  look: CivilianLook;
  position?: V3;
  rotationY?: number;
  pose?: NubiPose;
  t?: number;
  thirst?: number;
  shadow?: boolean;
  holdR?: React.ReactNode;
}> = ({ look, position = [0, 0, 0], rotationY = 0, pose = {}, t = 0, thirst = 1, shadow = true, holdR }) => {
  const held = holdR === undefined ? look.held : "none";
  const finR = held !== "none" ? Math.max(pose.finR ?? 0, 0.75) : pose.finR;
  const p = finR === pose.finR ? pose : { ...pose, finR };
  const heldNode =
    holdR ??
    (held === "bucket" ? (
      <Upright raise={finR ?? 0}>
        <EmptyBucket color={look.backpack ?? ACCENTS[(look.seed + 2) % ACCENTS.length]} />
      </Upright>
    ) : held === "straw" ? (
      <Upright raise={finR ?? 0}>
        <LongStraw />
      </Upright>
    ) : undefined);
  return (
    <Nubi size={look.size} position={position} rotationY={rotationY} pose={p} palette={look.palette} shadow={shadow} holdR={heldNode}>
      <CivilianGear look={look} pose={p} t={t} thirst={thirst} />
    </Nubi>
  );
};

// =======================================================================================
// Poses

/** Blends two poses (numeric fields), k = 0 → a, 1 → b. */
export const mixPose = (a: NubiPose, b: NubiPose, k: number): NubiPose => {
  const out: NubiPose = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)] as (keyof NubiPose)[]);
  const rest: Required<NubiPose> = { hop: 0, squash: 1, yaw: 0, pitch: 0, roll: 0, finL: 0, finR: 0, wiggle: 0, wigglePhase: 0, blink: 0, eyeScale: 1, lookX: 0, lookY: 0 };
  keys.forEach((key) => {
    out[key] = lerp(a[key] ?? rest[key], b[key] ?? rest[key], k);
  });
  return out;
};

/** Plodding walk in the heat (forward = the character's +z). `amount` 0..1 fades it. */
export const civilianWalk = (t: number, phase = 0, amount = 1): NubiPose => {
  const ph = t * 8.5 + phase;
  return {
    hop: Math.abs(Math.sin(ph)) * 0.55 * amount,
    squash: 1 + 0.035 * Math.cos(ph * 2) * amount,
    roll: 0.045 * Math.sin(ph) * amount,
    pitch: 0.04 * amount,
    wiggle: 0.65 * amount,
    wigglePhase: ph * 1.5,
    finL: 0.14 * Math.sin(ph) * amount,
    finR: -0.14 * Math.sin(ph) * amount,
  };
};

/** Running flat out: big hops, legs paddling, fins flapping, leaning forward, eyes wide. */
export const civilianRun = (t: number, phase = 0, amount = 1): NubiPose => {
  const ph = t * 14 + phase;
  return {
    hop: Math.abs(Math.sin(ph)) * 2.0 * amount,
    squash: 1 + 0.09 * Math.cos(ph * 2) * amount,
    pitch: 0.17 * amount,
    roll: 0.07 * Math.sin(ph) * amount,
    wiggle: amount,
    wigglePhase: ph * 2,
    finL: (0.55 + 0.4 * Math.sin(ph)) * amount,
    finR: (0.55 - 0.4 * Math.sin(ph)) * amount,
    eyeScale: 1 + 0.15 * amount,
  };
};

/** Thirsty idle: slow heavy breathing and sway; `fan` 0..1 fans itself with the left fin. */
export const civilianIdle = (t: number, phase = 0, fan = 0): NubiPose => ({
  squash: 1 + 0.025 * Math.sin(t * 2.2 + phase),
  roll: 0.03 * Math.sin(t * 1.3 + phase),
  finL: fan * (0.55 + 0.3 * Math.sin(t * 13 + phase)),
  finR: -0.1,
  lookY: -0.15,
});

/** Yaw (relative to the character's own rotationY) that faces `to` from `from` (world). */
export const yawTowards = (from: V3, rotY: number, to: V3) => wrapPi(Math.atan2(to[0] - from[0], to[2] - from[2]) - rotY);

/**
 * The synchronized head turn: k 0..1 turns the whole toy (yaw) from `pose` to face `to`, the
 * eyes lead (they reach the target first and settle back to centre as the body catches up) and
 * look up/down at the target's height. `eyeY` is the eyes' height above `from` (≈ 0.55·size).
 */
export const turnTowards = (pose: NubiPose, k: number, from: V3, rotY: number, to: V3, eyeY = 1.1): NubiPose => {
  const full = yawTowards(from, rotY, to);
  const kb = smooth(0.15, 1, k);
  const ke = smooth(0, 0.4, k);
  const yaw = lerp(pose.yaw ?? 0, full, kb);
  const rest = wrapPi(full - yaw);
  const dist = Math.hypot(to[0] - from[0], to[2] - from[2]);
  const up = clamp(((to[1] - (from[1] + eyeY)) / Math.max(1, dist)) * 2.2, -1, 1);
  return {
    ...pose,
    yaw,
    lookX: lerp(pose.lookX ?? 0, clamp(rest * 1.8, -1, 1), ke),
    lookY: lerp(pose.lookY ?? 0, up, ke),
  };
};

// =======================================================================================
// Crowd builder

export type CrowdMember = {
  look: CivilianLook;
  /** Where it stands (world, on the ground). */
  at: V3;
  /** Base facing (radians, 0 = +z). */
  rotY: number;
  /** Walk/run phase and a 0..1 random for staggering. */
  phase: number;
  r: number;
};

/**
 * Deterministic crowd of `n` civilians: on a jittered grid inside `area` [x0, z0, x1, z1] (or at
 * `spots` [x, z]), facing `facing` (radians, 0 = +z) with ±`jitter`, standing on the street's
 * ground (streetGroundY). Looks come from seeds seed, seed+1, ... (all colours differ).
 */
export const makeCrowd = (
  n: number,
  seed: number,
  o: { area?: [number, number, number, number]; spots?: [number, number][]; facing?: number; jitter?: number; sizes?: [number, number] } = {},
): CrowdMember[] => {
  const rnd = mulberry(seed * 131 + 7);
  const { area = [-3, -3, 3, 3], facing = 0, jitter = 0.35 } = o;
  let pts: [number, number][];
  if (o.spots && o.spots.length) pts = o.spots.slice(0, n);
  else {
    const [x0, z0, x1, z1] = area;
    const w = Math.abs(x1 - x0) || 1;
    const d = Math.abs(z1 - z0) || 1;
    const cols = Math.max(1, Math.round(Math.sqrt((n * w) / d)));
    const rows = Math.max(1, Math.ceil(n / cols));
    pts = [];
    for (let i = 0; i < n; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const off = r % 2 ? 0.5 : 0;
      pts.push([x0 + ((c + 0.25 + off * 0.5 + rnd() * 0.5) / cols) * (x1 - x0), z0 + ((r + 0.25 + rnd() * 0.5) / rows) * (z1 - z0)]);
    }
  }
  return pts.map(([x, z], i) => {
    const look = civilianLook(seed + i);
    if (o.sizes) look.size = o.sizes[0] + rnd() * (o.sizes[1] - o.sizes[0]);
    return { look, at: [x, streetGroundY(x, z), z], rotY: facing + (rnd() - 0.5) * 2 * jitter, phase: rnd() * Math.PI * 2, r: rnd() };
  });
};

// =======================================================================================
// Far crowd (instanced): many cheap civilians for the back rows

const farGeos = once(() => {
  const body: THREE.BufferGeometry[] = [];
  body.push(place(rbox(10, 7.4, 8.8, 0.8, 1), "#FFFFFF", [0, 6.2, 0]));
  for (const [x, z, a] of [
    [-1.3, 1.6, 0],
    [1.3, 1.6, 0],
    [-2.4, 1.2, -0.72],
    [2.4, 1.2, 0.72],
    [-2.6, -0.9, -1.72],
    [2.6, -0.9, 1.72],
  ]) {
    const leg = rbox(1.95, 2.6, 3.9, 0.42, 1);
    leg.translate(0, 1.3, 1.95);
    leg.rotateY(a);
    leg.translate(x, 0, z);
    body.push(paintGeo(leg, "#FFFFFF"));
  }
  for (const s of [-1, 1]) {
    const fin = rbox(2.6, 2.2, 2.6, 0.5, 1);
    fin.translate(1.3, 0, 0);
    fin.rotateZ(-0.15);
    fin.translate(4.8, 5.0, 0.3);
    if (s < 0) fin.scale(-1, 1, 1);
    body.push(paintGeo(fin, "#FFFFFF"));
  }
  const eyes = [-1, 1].map((s) => place(rbox(1.05, 1.75, 0.5, 0.2, 1), "#151515", [s * 2.3, 5.5, 4.45]));
  const coloured = mergeAll(body);
  // A mirrored fin flips its triangles: recompute normals on the merged geometry.
  coloured.computeVertexNormals();
  return { coloured, eyes: mergeAll(eyes) };
});

/**
 * Many cheap civilians (two InstancedMeshes: coloured bodies, black eyes) for the back of the
 * crowd. Places one at each of `spots` [x, z] (on the street ground), each with a body colour
 * from `colors`. `run` 0..1 blends from a sweaty idle bob to running hops; `lookAt` turns them
 * all to face a point (else `facing`). `size` ≈ 1.7–2.4 like the full civilians.
 */
export const FarCrowd: React.FC<{
  t: number;
  spots: [number, number][];
  colors?: string[];
  size?: number;
  facing?: number;
  lookAt?: V3;
  run?: number;
  seed?: number;
}> = ({ t, spots, colors = CIVILIAN_COLORS, size = 2, facing = 0, lookAt, run = 0, seed = 3 }) => {
  const units = useMemo(() => {
    const rnd = mulberry(seed);
    return spots.map(([x, z]) => ({ x, z, y: streetGroundY(x, z), k: 0.85 + rnd() * 0.3, phase: rnd() * Math.PI * 2, color: Math.floor(rnd() * 1e6), yaw: (rnd() - 0.5) * 0.4 }));
  }, [spots, seed]);
  const g = farGeos();
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const eyeRef = useRef<THREE.InstancedMesh>(null);
  const n = units.length;
  useLayoutEffect(() => {
    const m = bodyRef.current;
    if (!m) return;
    const c = new THREE.Color();
    units.forEach((u, i) => m.setColorAt(i, c.set(colors[u.color % colors.length])));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [units, colors]);
  useLayoutEffect(() => {
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const rk = clamp01(run);
    units.forEach((u, i) => {
      const s = (size / 10) * u.k;
      const ph = t * (2.2 + rk * 11.8) + u.phase;
      const hop = rk * Math.abs(Math.sin(ph)) * 2.0 + (1 - rk) * 0.08 * Math.max(0, Math.sin(ph));
      const squash = 1 + (rk * 0.08 + (1 - rk) * 0.02) * Math.cos(ph * 2);
      const yaw = lookAt ? Math.atan2(lookAt[0] - u.x, lookAt[2] - u.z) : facing + u.yaw;
      e.set(rk * 0.17, yaw, 0.05 * Math.sin(ph) * (0.4 + rk), "YXZ");
      q.setFromEuler(e);
      p.set(u.x, u.y + hop * s, u.z);
      sc.set(s / Math.sqrt(squash), s * squash, s / Math.sqrt(squash));
      m4.compose(p, q, sc);
      bodyRef.current?.setMatrixAt(i, m4);
      eyeRef.current?.setMatrixAt(i, m4);
    });
    for (const mesh of [bodyRef.current, eyeRef.current]) if (mesh) mesh.instanceMatrix.needsUpdate = true;
  }, [units, t, run, size, facing, lookAt]);
  return (
    <group>
      <instancedMesh ref={bodyRef} args={[g.coloured, vertexMat(0.45, false, 0.14), n]} frustumCulled={false} castShadow />
      <instancedMesh ref={eyeRef} args={[g.eyes, vertexMat(0.35, false, 0.0), n]} frustumCulled={false} />
    </group>
  );
};

// =======================================================================================
// Water: the trail of leaked drops, the last big drop

type TrailDrop = { p: THREE.Vector3; s: number; along: number; rot: number; tw: number };

/** Samples a polyline every ≈ `spacing` units with a seeded sideways jitter. */
const sampleTrail = (points: V3[], spacing: number, seed: number, size: number): TrailDrop[] => {
  const rnd = mulberry(seed);
  const out: TrailDrop[] = [];
  let total = 0;
  const segs: { a: THREE.Vector3; b: THREE.Vector3; len: number; from: number }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = new THREE.Vector3(...points[i]);
    const b = new THREE.Vector3(...points[i + 1]);
    const len = a.distanceTo(b);
    segs.push({ a, b, len, from: total });
    total += len;
  }
  if (total <= 0) return out;
  for (let d = spacing * 0.3; d < total; d += spacing * (0.7 + rnd() * 0.6)) {
    const sg = segs.find((s) => d <= s.from + s.len) ?? segs[segs.length - 1];
    const k = (d - sg.from) / Math.max(1e-6, sg.len);
    const p = sg.a.clone().lerp(sg.b, k);
    const dir = sg.b.clone().sub(sg.a).normalize();
    const side = (rnd() - 0.5) * 0.35;
    p.x += -dir.z * side;
    p.z += dir.x * side;
    out.push({ p, s: size * (0.7 + rnd() * 0.6), along: d / total, rot: rnd() * Math.PI, tw: rnd() * Math.PI * 2 });
  }
  return out;
};

/**
 * A trail of small glossy water drops and wet spots on the ground along `points` (world, y =
 * ground height at each point), one every ≈ `spacing`. `glow` 0..1 makes them shine (a soft
 * blue glow under each, twinkling with `t`), `reveal` 0..1 shows them in order along the path
 * (the trail being laid), `size` scales the drops (≈ 0.14 wide at 1).
 */
export const DropTrail: React.FC<{ points: V3[]; t?: number; glow?: number; reveal?: number; spacing?: number; seed?: number; size?: number }> = ({
  points,
  t = 0,
  glow = 0.6,
  reveal = 1,
  spacing = 0.55,
  seed = 9,
  size = 1,
}) => {
  const drops = useMemo(() => sampleTrail(points, spacing, seed, size), [points, spacing, seed, size]);
  const geos = useMemo(
    () => ({
      spot: new THREE.CircleGeometry(1, 18).rotateX(-Math.PI / 2),
      dome: new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2),
      glow: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    }),
    [],
  );
  const mats = useMemo(
    () => ({
      spot: new THREE.MeshStandardMaterial({ color: "#3C82D0", roughness: 0.08, metalness: 0.25, transparent: true, opacity: 0.55, depthWrite: false, emissive: new THREE.Color("#3FA8FF"), emissiveIntensity: 0.2 }),
      dome: new THREE.MeshStandardMaterial({ color: "#9BE6FF", roughness: 0.04, metalness: 0.1, emissive: new THREE.Color("#5CC8FF"), emissiveIntensity: 0.4 }),
      glow: additive(new THREE.MeshBasicMaterial({ map: glowTexture(), color: "#6FD8FF", toneMapped: false })),
    }),
    [],
  );
  const g = clamp01(glow);
  mats.dome.emissiveIntensity = 0.35 + 0.9 * g;
  mats.spot.emissiveIntensity = 0.15 + 0.5 * g;
  mats.glow.opacity = 0.85 * g;
  const spotRef = useRef<THREE.InstancedMesh>(null);
  const domeRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const n = drops.length;
  useLayoutEffect(() => {
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    drops.forEach((d, i) => {
      const k = reveal >= 1 ? 1 : clamp01((reveal - d.along) / 0.02);
      const tw = 0.75 + 0.25 * Math.sin(t * 4 + d.tw);
      q.setFromAxisAngle(up, d.rot);
      m4.compose(p.set(d.p.x, d.p.y + 0.012, d.p.z), q, sc.set(d.s * 0.16 * k, 1, d.s * 0.11 * k));
      spotRef.current?.setMatrixAt(i, m4);
      m4.compose(p.set(d.p.x, d.p.y + 0.01, d.p.z), q, sc.set(d.s * 0.06 * k, d.s * 0.045 * k, d.s * 0.06 * k));
      domeRef.current?.setMatrixAt(i, m4);
      m4.compose(p.set(d.p.x, d.p.y + 0.03, d.p.z), q, sc.set(d.s * 0.75 * k * tw, 1, d.s * 0.75 * k * tw));
      glowRef.current?.setMatrixAt(i, m4);
    });
    for (const mesh of [spotRef.current, domeRef.current, glowRef.current]) if (mesh) mesh.instanceMatrix.needsUpdate = true;
  }, [drops, t, reveal]);
  if (!n) return null;
  return (
    <group>
      <instancedMesh ref={spotRef} args={[geos.spot, mats.spot, n]} frustumCulled={false} renderOrder={1} />
      <instancedMesh ref={domeRef} args={[geos.dome, mats.dome, n]} frustumCulled={false} />
      {g > 0.01 ? <instancedMesh ref={glowRef} args={[geos.glow, mats.glow, n]} frustumCulled={false} renderOrder={2} /> : null}
    </group>
  );
};

const dropGeos = once(() => {
  // Classic teardrop: round bottom, pointed top (2 tall, y −1..1, ≈ 1.56 wide).
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * Math.PI;
    pts.push(new THREE.Vector2(Math.sin(a) * Math.pow(Math.sin(a / 2), 0.9), Math.cos(a)));
  }
  return {
    drop: new THREE.LatheGeometry(pts, 32),
    neck: new THREE.CylinderGeometry(1, 1, 1, 14, 1, true).translate(0, -0.5, 0),
    bead: new THREE.SphereGeometry(1, 14, 10),
    ring: new THREE.TorusGeometry(1, 0.12, 8, 40).rotateX(Math.PI / 2),
    splat: new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2),
  };
});

/**
 * The last drop, big and glossy, for the slow-motion close-up. Origin = where it hangs (the
 * bottle's hole); the ground is `height` below. `size` = the drop's radius when full.
 *   fall 0..0.35   it swells and stretches at the hole on a thinning neck, then pinches off
 *   fall 0.35..1   it falls (accelerating), wobbling, and touches the ground at fall = 1
 *   splash 0..1    a crown of droplets and a ring burst out, the wet splat spreads, then it
 *                  shrinks and evaporates in wisps of steam (nothing left at 1)
 * `t` seconds (shimmer), `glow` 0..1 its soft blue halo.
 */
export const BigDrop: React.FC<{ t?: number; fall?: number; splash?: number; height?: number; size?: number; glow?: number }> = ({
  t = 0,
  fall = 0,
  splash = 0,
  height = 1.2,
  size = 0.12,
  glow = 0.7,
}) => {
  const g = dropGeos();
  const mats = useMemo(
    () => ({
      water: new THREE.MeshStandardMaterial({
        color: "#63CCFF",
        roughness: 0.04,
        metalness: 0.15,
        transparent: true,
        opacity: 0.92,
        emissive: new THREE.Color("#2FA8FF"),
        emissiveIntensity: 0.5,
      }),
      hi: new THREE.MeshBasicMaterial({ color: "#FFFFFF", toneMapped: false }),
      splat: new THREE.MeshStandardMaterial({ color: "#3D8FD8", roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.75, depthWrite: false, emissive: new THREE.Color("#3FA8FF"), emissiveIntensity: 0.35 }),
      ring: new THREE.MeshStandardMaterial({ color: "#9BE6FF", roughness: 0.05, transparent: true, opacity: 0.85, emissive: new THREE.Color("#5CC8FF"), emissiveIntensity: 0.5 }),
      steam: [0, 1, 2, 3].map(() => new THREE.SpriteMaterial({ map: glowTexture(), color: "#FFFFFF", transparent: true, depthWrite: false, opacity: 0.6 })),
    }),
    [],
  );
  const f = clamp01(fall);
  const sp = clamp01(splash);
  const hang = clamp01(f / 0.35);
  const drop = clamp01((f - 0.35) / 0.65);
  const R = size * (0.55 + 0.45 * smooth(0, 1, hang));
  // Hanging: stretched by its weight on a neck that thins to nothing at the pinch.
  const stretch = drop > 0 ? 1.12 + 0.18 * Math.cos(drop * 18) * (1 - drop) : 1 + 0.45 * hang;
  const neckLen = drop > 0 ? 0 : size * 1.1 * hang * hang;
  const neckR = size * 0.3 * (1 - hang * 0.85);
  const startY = -neckLen - R * stretch;
  const groundY = -height;
  const y = drop > 0 ? lerp(startY, groundY + R * 1.05, drop * drop) : startY;
  const wob = 1 + 0.04 * Math.sin(t * 11);
  const showDrop = sp <= 0 && f < 1.0001;
  const hit = sp > 0;
  // Splash pieces.
  const crown = smooth(0, 0.35, sp);
  const crownFade = 1 - smooth(0.25, 0.5, sp);
  const splatR = size * (1.2 + 2.6 * smooth(0, 0.18, sp)) * (1 - smooth(0.35, 0.95, sp));
  mats.splat.opacity = 0.75 * (1 - smooth(0.6, 1, sp));
  mats.ring.opacity = 0.85 * crownFade;
  return (
    <group>
      {showDrop ? (
        <group position={[0, y, 0]}>
          <mesh geometry={g.drop} material={mats.water} scale={[R / wob, R * stretch * wob, R / wob]} />
          <mesh geometry={g.bead} material={mats.hi} position={[-R * 0.33, R * 0.15 * stretch, R * 0.55]} scale={R * 0.16} />
          <mesh geometry={g.bead} material={mats.hi} position={[R * 0.3, -R * 0.45 * stretch, R * 0.62]} scale={R * 0.07} />
          {glow > 0 ? <Glow color="#8FE6FF" size={R * 9 * glow} opacity={0.55 * glow} /> : null}
        </group>
      ) : null}
      {showDrop && neckLen > 0.001 ? <mesh geometry={g.neck} material={mats.water} scale={[neckR, neckLen + R * 0.5, neckR]} /> : null}
      {hit ? (
        <group position={[0, groundY, 0]}>
          {splatR > 0.002 ? <mesh geometry={g.splat} material={mats.splat} position={[0, 0.004, 0]} scale={[splatR, 1, splatR * 0.8]} renderOrder={1} /> : null}
          {crownFade > 0.01 ? <mesh geometry={g.ring} material={mats.ring} position={[0, size * 0.15, 0]} scale={[size * (0.6 + 2.8 * crown), size * (1.4 - crown), size * (0.6 + 2.8 * crown)]} /> : null}
          {Array.from({ length: 10 }).map((_, i) => {
            const a = (i / 10) * Math.PI * 2 + 0.3;
            const k = smooth(0, 0.42, sp);
            const v = 0.75 + ((i * 37) % 10) / 20;
            const r = size * (0.8 + 4.2 * k * v);
            const h = size * (7 * k - 7.5 * k * k) * v;
            const s = size * 0.2 * (1 - smooth(0.3, 0.45, sp));
            if (s <= 0.001 || h < -0.001) return null;
            return <mesh key={i} geometry={g.bead} material={mats.water} position={[Math.cos(a) * r, Math.max(0, h) + s, Math.sin(a) * r * 0.85]} scale={s} />;
          })}
          {/* It evaporates: wisps of steam rise and fade. */}
          {[0, 1, 2, 3].map((i) => {
            const k = clamp01((sp - 0.3 - i * 0.08) / 0.55);
            if (k <= 0 || k >= 1) return null;
            const m = mats.steam[i];
            m.opacity = Math.sin(k * Math.PI) * 0.75;
            const s = size * (1.6 + 3 * k);
            return (
              <sprite
                key={i}
                material={m}
                position={[(i - 1.5) * size * 0.9 + Math.sin(k * 6 + i) * size * 0.4, size * (0.6 + 9 * k), size * 0.3]}
                scale={[s, s, 1]}
                renderOrder={3}
              />
            );
          })}
        </group>
      ) : null}
    </group>
  );
};

// =======================================================================================
// The chase (shared by the flash-forward and the street shot)

/** Point and heading (yaw, 0 = +z) at distance `d` along a polyline (straight past its ends). */
export const alongPath = (pts: V3[], d: number): { p: V3; yaw: number } => {
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1e-6;
    const last = i === pts.length - 2;
    if (d <= acc + len || last) {
      const k = d < 0 && i === 0 ? d / len : (d - acc) / len;
      return { p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * clamp01(k), a[2] + (b[2] - a[2]) * k], yaw: Math.atan2(b[0] - a[0], b[2] - a[2]) };
    }
    acc += len;
  }
  return { p: pts[0], yaw: 0 };
};

/** One member of the chasing crowd: how far behind the runner, how far to the side, and where it pours in from. */
export type Chaser = { look: CivilianLook; lag: number; side: number; phase: number; delay: number; from: V3 };

/**
 * Deterministic chasing crowd: `n` civilians following the runner from `lag0` units behind,
 * each row `lagStep` further back, spread sideways (wider further back). `from` (where each one
 * pours in from when `flood` < 1) defaults to the sidewalks beside its place; scenes can set it.
 */
export const makeChasers = (n: number, seed: number, o: { lag0?: number; lagStep?: number; spread?: number; fromSide?: number } = {}): Chaser[] => {
  const { lag0 = 1.5, lagStep = 0.55, spread = 1.5, fromSide = 6 } = o;
  const rnd = mulberry(seed * 17 + 3);
  return Array.from({ length: n }, (_, i) => {
    const lag = lag0 + i * lagStep + rnd() * 0.4;
    const side = (i % 2 ? 1 : -1) * (0.25 + rnd() * 0.75) * spread * (1 + i * 0.05);
    return {
      look: civilianLook(seed + i),
      lag,
      side,
      phase: rnd() * Math.PI * 2,
      delay: rnd() * 0.45,
      from: [Math.sign(side || 1) * (fromSide + rnd() * 2), 0, lag * 0.6 + rnd() * 3] as V3,
    };
  });
};

/**
 * Where a chaser is: `lag` behind the runner (at `lead` along `path`) and `side` to its side,
 * or on its way there from `from` (relative to the runner when `relFrom`) while `flood` < 1.
 */
export const chaserSpot = (c: Chaser, path: V3[], lead: number, flood = 1, relFrom = true): { p: V3; k: number } => {
  const { p, yaw } = alongPath(path, lead - c.lag);
  const nx = Math.cos(yaw);
  const nz = -Math.sin(yaw);
  const tx = p[0] + nx * c.side;
  const tz = p[2] + nz * c.side;
  const k = smooth(c.delay, c.delay + 0.5, flood);
  let x = tx;
  let z = tz;
  if (k < 1) {
    const r = alongPath(path, lead).p;
    const fx = relFrom ? r[0] + c.from[0] : c.from[0];
    const fz = relFrom ? r[2] + c.from[2] : c.from[2];
    x = lerp(fx, tx, k);
    z = lerp(fz, tz, k);
  }
  return { p: [x, streetGroundY(x, z), z], k };
};

/**
 * The thirsty crowd chasing a runner (Nubi, drawn by the scene) along `path`: every chaser runs
 * (hops, paddles, eyes wide) facing the runner, `lead` = the runner's distance along the path.
 * `flood` 0..1 pours them in from their `from` spots (relative to the runner when `relFrom`).
 * `t` drives the run cycle (freeze it to freeze them). `amount` 0..1 blends the run in.
 */
export const StreetChase: React.FC<{
  t: number;
  path: V3[];
  lead: number;
  chasers: Chaser[];
  flood?: number;
  relFrom?: boolean;
  amount?: number;
  target?: V3;
}> = ({ t, path, lead, chasers, flood = 1, relFrom = true, amount = 1, target }) => {
  const runner = target ?? alongPath(path, lead).p;
  return (
    <group>
      {chasers.map((c, i) => {
        const { p, k } = chaserSpot(c, path, lead, flood, relFrom);
        if (flood < c.delay) return null;
        const rotY = Math.atan2(runner[0] - p[0], runner[2] - p[2]);
        const pose = civilianRun(t, c.phase, amount);
        return (
          <Civilian
            key={i}
            look={c.look}
            position={p}
            rotationY={rotY}
            pose={{ ...pose, eyeScale: 1.3 + 0.1 * Math.sin(t * 3 + i), lookY: 0.1, pitch: (pose.pitch ?? 0) * (0.6 + 0.4 * k) }}
            t={t}
            thirst={0.8}
          />
        );
      })}
    </group>
  );
};
