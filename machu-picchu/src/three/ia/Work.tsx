import React, { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { V3, canvasTexture, shadeHex, toy } from "../inca/kit";
import { Nubi, NubiPalette, NubiPose } from "../Nubi";
import { Glow } from "../thanos/FX";
import { EyeBags, Lids, ShirtAndTie, mixHex } from "../tiempo/Office";

// Sets, props and characters of the "work" part of the AI short ("¿Qué pasaría si la IA no
// existiera?"): the student's bedroom desk at midnight and the office where "rapidito" takes all
// night. World units are sized for a Nubi of size 2 (2 wide, ≈ 2 tall, eyes at y ≈ 1.1); floor
// y = 0; +z points towards the default camera. No shadow maps (blob shadows only), at most four
// lights per set, geometry built once (module caches) so the CPU renderer stays quick.
//
// BEDROOM: the desk (top at BED_DESK.top) runs along x in front of the student (STUDENT_AT, behind
//   the desk, turned STUDENT_RY towards the laptop). The laptop (LAPTOP_AT) shows its lid's back to
//   the camera: its screen faces the student, so its light (LaptopLight) paints his face (red on
//   the error). The wall clock (BED_CLOCK) and the night window sit on the back wall.
// OFFICE: the worker's desk (OFFICE_DESK) with the monitor (MONITOR_AT, screen facing the worker
//   at WORKER_AT); the boss leans on its right end (BOSS_AT). The big window behind them goes from
//   night to sunrise with `sun` 0..1; the coffee counter stands at the back left.

const once = <T,>(make: () => T) => {
  let v: T | undefined;
  return () => (v ??= make());
};
const rbox = (w: number, h: number, d: number, r: number, seg = 2) =>
  new RoundedBoxGeometry(w, h, d, seg, Math.max(0.001, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)));
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const basic = (() => {
  const cache = new Map<string, THREE.MeshBasicMaterial>();
  return (color: string, transparent = false) => {
    const k = `${color}|${transparent}`;
    let m = cache.get(k);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent });
      cache.set(k, m);
    }
    return m;
  };
})();

/** Generic toy desk: top slab at height `top`, a front panel hiding what is behind it, side legs. */
const deskGeos = once(() => ({ slab: rbox(1, 1, 1, 0.03), panel: rbox(1, 1, 1, 0.02), knob: new THREE.SphereGeometry(0.035, 10, 8) }));
export const Desk: React.FC<{ w: number; d: number; top: number; color: string; panel: string; drawers?: boolean }> = ({ w, d, top, color, panel, drawers = true }) => {
  const g = deskGeos();
  const t = 0.07;
  const slab = toy(color, { rough: 0.6, glow: 0.12 });
  const pan = toy(panel, { rough: 0.7, glow: 0.1 });
  return (
    <group>
      <mesh geometry={g.slab} material={slab} position={[0, top - t / 2, 0]} scale={[w, t, d]} />
      <mesh geometry={g.panel} material={pan} position={[0, (top - t) / 2, d / 2 - 0.06]} scale={[w - 0.06, top - t, 0.05]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={g.panel} material={pan} position={[s * (w / 2 - 0.05), (top - t) / 2, 0]} scale={[0.07, top - t, d - 0.06]} />
      ))}
      {drawers
        ? [-1, 1].map((s) => (
            <mesh key={s} geometry={g.knob} material={toy("#E9E2D2", { rough: 0.3 })} position={[s * w * 0.28, top * 0.55, d / 2 - 0.02]} />
          ))
        : null}
    </group>
  );
};

// =======================================================================================
// CHARACTERS

/** Where a held object sits on a size-2 Nubi's fin tip: world size → model units. */
export const HOLD_SCALE = 10 / 2;

// ---- The student: orange Nubi with round glasses ----------------------------------------
export const STUDENT_ORANGE = "#FFB25B";
export const STUDENT_PALETTE: NubiPalette = { body: STUDENT_ORANGE, legs: "#F09A45", eyeRough: 0.7 };
const glassesGeos = once(() => ({
  ring: new THREE.TorusGeometry(1.22, 0.19, 10, 30),
  bridge: rbox(1.4, 0.26, 0.26, 0.1),
  arm: rbox(0.22, 0.24, 3.8, 0.08),
}));
/** Round glasses on the face (model units, children of a <Nubi>). */
export const Glasses: React.FC<{ color?: string }> = ({ color = "#2A1E1A" }) => {
  const g = glassesGeos();
  const m = toy(color, { rough: 0.35, glow: 0.05 });
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={g.ring} material={m} position={[s * 2.3, 5.55, 4.62]} />
          <mesh geometry={g.arm} material={m} position={[s * 5.02, 5.9, 2.7]} />
        </group>
      ))}
      <mesh geometry={g.bridge} material={m} position={[0, 5.85, 4.62]} />
    </group>
  );
};
export const Student: React.FC<{ pose?: NubiPose; position?: V3; rotationY?: number; holdR?: React.ReactNode; holdL?: React.ReactNode; shadowOpacity?: number }> = ({
  pose = {},
  position,
  rotationY,
  holdR,
  holdL,
  shadowOpacity = 0.35,
}) => (
  <Nubi size={2} palette={STUDENT_PALETTE} pose={pose} position={position} rotationY={rotationY} holdR={holdR} holdL={holdL} shadowOpacity={shadowOpacity}>
    <Glasses />
  </Nubi>
);

// ---- The worker: lilac Nubi with an ID lanyard, droopy lids and dark circles ----------------
export const WORKER_LILAC = "#B9A3E8";
export const WORKER_PALETTE: NubiPalette = { body: WORKER_LILAC, legs: "#A58ED9", eyeRough: 0.7 };
const lanyardGeos = once(() => {
  const strap = (x0: number, x1: number) => {
    const a = new THREE.Vector3(x0, 9.95, 0);
    const b = new THREE.Vector3(x1, 4.25, 0);
    const len = a.distanceTo(b);
    const geo = new THREE.BoxGeometry(0.42, len, 0.1);
    geo.rotateZ(Math.atan2(-(b.x - a.x), b.y - a.y));
    geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, 4.47);
    return geo;
  };
  return {
    left: strap(-1.7, -0.3),
    right: strap(1.7, 0.3),
    top: new THREE.BoxGeometry(3.8, 0.1, 8.6),
    card: rbox(2.3, 1.65, 0.14, 0.12),
    clip: rbox(0.5, 0.45, 0.2, 0.08),
    photo: new THREE.PlaneGeometry(0.62, 0.78),
    line: new THREE.PlaneGeometry(0.95, 0.14),
    band: new THREE.PlaneGeometry(2.1, 0.32),
  };
});
/** ID lanyard: a teal strap over the head and down the face to a white badge (model units). */
export const Lanyard: React.FC = () => {
  const g = lanyardGeos();
  const strap = toy("#1FA7A0", { rough: 0.6, glow: 0.12 });
  return (
    <group>
      <mesh geometry={g.left} material={strap} />
      <mesh geometry={g.right} material={strap} />
      <mesh geometry={g.top} material={strap} position={[0, 9.92, 0]} scale={[0.5, 1, 1]} />
      <mesh geometry={g.clip} material={toy("#C9CED8", { metal: 0.5, rough: 0.3 })} position={[0, 4.3, 4.6]} />
      <group position={[0, 3.35, 4.62]}>
        <mesh geometry={g.card} material={toy("#FFFFFF", { rough: 0.4, glow: 0.25 })} />
        <mesh geometry={g.band} material={basic("#2E7BE0")} position={[0, 0.6, 0.075]} />
        <mesh geometry={g.photo} material={basic("#9C86D6")} position={[-0.6, -0.15, 0.075]} />
        <mesh geometry={g.line} material={basic("#55607A")} position={[0.45, 0.0, 0.075]} />
        <mesh geometry={g.line} material={basic("#9AA3B8")} position={[0.45, -0.32, 0.075]} />
      </group>
    </group>
  );
};
export const Worker: React.FC<{
  pose?: NubiPose;
  position?: V3;
  rotationY?: number;
  /** Eyelids 0..1 and dark circles 0..1. */
  droop?: number;
  bags?: number;
  holdR?: React.ReactNode;
  holdL?: React.ReactNode;
  shadowOpacity?: number;
}> = ({ pose = {}, position, rotationY, droop = 0.45, bags = 1, holdR, holdL, shadowOpacity = 0.35 }) => (
  <Nubi size={2} palette={WORKER_PALETTE} pose={pose} position={position} rotationY={rotationY} holdR={holdR} holdL={holdL} shadowOpacity={shadowOpacity}>
    <Lanyard />
    <Lids pose={pose} droop={droop} tilt={0.06} color={shadeHex(WORKER_LILAC, -0.06)} />
    <EyeBags pose={pose} color="#4B3C7E" amount={bags} />
  </Nubi>
);

// ---- The boss: slate-grey Nubi, red tie, bushy moustache, smug lids ---------------------------
export const BOSS_SLATE = "#9AA5B8";
export const BOSS_SIZE = 2.15;
export const BOSS_PALETTE: NubiPalette = { body: BOSS_SLATE, legs: "#8792A8", eyeRough: 0.7 };
const moustacheGeo = once(() => {
  const blobs: [number, number, number][] = [
    [0.45, 4.3, 0.62],
    [1.2, 4.28, 0.62],
    [1.95, 4.45, 0.52],
    [2.55, 4.8, 0.36],
    [2.85, 5.12, 0.22],
  ];
  const geos: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1])
    for (const [x, y, r] of blobs) {
      const sp = new THREE.SphereGeometry(r, 12, 9);
      sp.scale(1.15, 1, 0.55);
      sp.translate(s * x, y - 4.4, 4.52);
      geos.push(sp.toNonIndexed());
    }
  const n = geos.reduce((a, g) => a + g.attributes.position.count, 0);
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    o += g.attributes.position.count;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  m.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  return m;
});
export const Moustache: React.FC<{ wiggle?: number }> = ({ wiggle = 0 }) => (
  <mesh geometry={moustacheGeo()} material={toy("#4A3428", { rough: 0.85, glow: 0.08 })} position={[0, 4.4, 0]} scale={[1 + 0.05 * wiggle, 1 + 0.12 * wiggle, 1]} />
);
export const Boss: React.FC<{
  pose?: NubiPose;
  position?: V3;
  rotationY?: number;
  smug?: number;
  holdR?: React.ReactNode;
  holdL?: React.ReactNode;
  shadowOpacity?: number;
}> = ({ pose = {}, position, rotationY, smug = 0.35, holdR, holdL, shadowOpacity = 0.35 }) => (
  <Nubi size={BOSS_SIZE} palette={BOSS_PALETTE} pose={pose} position={position} rotationY={rotationY} holdR={holdR} holdL={holdL} shadowOpacity={shadowOpacity}>
    <ShirtAndTie tie="#E2262E" />
    <Moustache wiggle={Math.max(0, (pose.squash ?? 1) - 1) * 4} />
    <Lids pose={pose} droop={smug} tilt={-0.05} color={shadeHex(BOSS_SLATE, -0.06)} />
  </Nubi>
);

// ---- Mugs and cups (world units, base at the origin) ---------------------------------------
const mugGeos = once(() => ({
  body: new THREE.CylinderGeometry(0.11, 0.1, 0.24, 20),
  band: new THREE.CylinderGeometry(0.1125, 0.1065, 0.07, 20, 1, true),
  coffee: new THREE.CircleGeometry(0.098, 20).rotateX(-Math.PI / 2),
  handle: new THREE.TorusGeometry(0.06, 0.02, 8, 14),
}));
/** The boss's red mug with a white band. */
export const BossMug: React.FC = () => {
  const g = mugGeos();
  const red = toy("#E2262E", { rough: 0.35, glow: 0.18 });
  return (
    <group>
      <mesh geometry={g.body} material={red} position={[0, 0.12, 0]} />
      <mesh geometry={g.band} material={toy("#FFFFFF", { rough: 0.35, glow: 0.25, side: THREE.DoubleSide })} position={[0, 0.13, 0]} />
      <mesh geometry={g.coffee} material={toy("#4A2C18", { rough: 0.2 })} position={[0, 0.241, 0]} />
      <mesh geometry={g.handle} material={red} position={[0.12, 0.13, 0]} />
    </group>
  );
};
const cupGeos = once(() => ({
  body: new THREE.CylinderGeometry(0.09, 0.066, 0.24, 16),
  sleeve: new THREE.CylinderGeometry(0.087, 0.075, 0.09, 16, 1, true),
  lid: new THREE.CylinderGeometry(0.095, 0.095, 0.03, 16),
}));
/** A take-away paper cup with a brown sleeve and a lid. */
export const PaperCup: React.FC<{ tipped?: boolean }> = ({ tipped = false }) => {
  const g = cupGeos();
  return (
    <group rotation={tipped ? [0, 0, Math.PI / 2] : [0, 0, 0]} position={tipped ? [0, 0.09, 0] : [0, 0, 0]}>
      <mesh geometry={g.body} material={toy("#FFFFFF", { rough: 0.5, glow: 0.22 })} position={[0, 0.12, 0]} />
      <mesh geometry={g.sleeve} material={toy("#B8763E", { rough: 0.8, glow: 0.12, side: THREE.DoubleSide })} position={[0, 0.11, 0]} />
      <mesh geometry={g.lid} material={toy("#3B2A22", { rough: 0.5 })} position={[0, 0.255, 0]} />
    </group>
  );
};
/** Spots of the worker's growing pile of empty cups on the desk (relative to the desk centre). */
const CUP_SPOTS: (V3 & { length: 3 })[] = (() => {
  const out: V3[] = [];
  // Bottom layer: a loose cluster; then a second and third layer on top (stacked rims).
  const base: [number, number][] = [
    [0.55, 0.25],
    [0.78, 0.18],
    [0.66, 0.42],
    [0.9, 0.38],
    [0.45, 0.45],
    [1.02, 0.2],
    [0.78, 0.55],
  ];
  base.forEach(([x, z]) => out.push([x, 0, z]));
  [
    [0.66, 0.3],
    [0.85, 0.3],
    [0.6, 0.48],
    [0.95, 0.45],
  ].forEach(([x, z]) => out.push([x, 0.27, z]));
  [
    [0.75, 0.38],
    [0.88, 0.38],
  ].forEach(([x, z]) => out.push([x, 0.54, z]));
  out.push([0.8, 0.81, 0.38]);
  return out;
})();
export const CupPile: React.FC<{ count: number; pop?: number }> = ({ count, pop = 1 }) => (
  <group>
    {CUP_SPOTS.slice(0, Math.min(CUP_SPOTS.length, Math.floor(count))).map((p, i, arr) => {
      const last = i === arr.length - 1;
      const s = last ? 0.6 + 0.4 * pop : 1;
      return (
        <group key={i} position={p} rotation={[0, hash(i) * 6, (hash(i + 9) - 0.5) * 0.12]} scale={s}>
          <PaperCup />
        </group>
      );
    })}
  </group>
);
export const MAX_CUPS = CUP_SPOTS.length;

// =======================================================================================
// BEDROOM (night)

export const BED = { zBack: -3.3, x0: -4.5, x1: 4.5, height: 4.2 };
export const BED_DESK = { x: 0.1, z: -0.78, w: 3.8, d: 1.55, top: 0.5 };
export const STUDENT_AT: V3 = [0.35, 0, -2.42];
export const LAPTOP_AT: V3 = [-0.42, BED_DESK.top, -1.02];
export const LAPTOP_RY = 2.66;
export const STUDENT_RY = -0.48;
export const BED_CLOCK: V3 = [-1.45, 2.0, BED.zBack + 0.06];
export const BED_LAMP: V3 = [1.95, BED_DESK.top, -1.3];
/** The lamp's shade (world), where its warm light comes from. */
export const LAMP_SHADE: V3 = [1.55, 1.7, -0.62];
export const BOOKS_AT: V3 = [1.45, BED_DESK.top, -0.4];
export const BED_WINDOW = { x: 0.85, y: 2.15, w: 2.3, h: 1.65 };

const nightTex = () =>
  canvasTexture("ia-night-window", 512, 384, (ctx, w, h) => {
    const gr = ctx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#0A1238");
    gr.addColorStop(1, "#2B3A7C");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.6 * hash(i + 3)})`;
      const r = 0.8 + 1.6 * hash(i + 7);
      ctx.beginPath();
      ctx.arc(hash(i) * w, hash(i + 1) * h * 0.6, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Moon.
    ctx.fillStyle = "#FFF6D6";
    ctx.beginPath();
    ctx.arc(w * 0.78, h * 0.22, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0E1840";
    ctx.beginPath();
    ctx.arc(w * 0.78 + 16, h * 0.22 - 8, 30, 0, Math.PI * 2);
    ctx.fill();
    // Skyline with a few lit windows.
    let x = 0;
    let k = 0;
    while (x < w) {
      const bw = 40 + 60 * hash(k + 40);
      const bh = h * (0.18 + 0.32 * hash(k + 50));
      ctx.fillStyle = "#070B22";
      ctx.fillRect(x, h - bh, bw, bh);
      for (let yy = h - bh + 10; yy < h - 8; yy += 18)
        for (let xx = x + 7; xx < x + bw - 8; xx += 14)
          if (hash(xx * 3.1 + yy * 7.7) > 0.72) {
            ctx.fillStyle = hash(xx + yy) > 0.5 ? "#FFD27A" : "#9FC8FF";
            ctx.fillRect(xx, yy, 6, 8);
          }
      x += bw + 4;
      k++;
    }
  });
const clockFaceTex = () =>
  canvasTexture("ia-clock-face", 256, 256, (ctx, w) => {
    const c = w / 2;
    ctx.fillStyle = "#FFFDF4";
    ctx.beginPath();
    ctx.arc(c, c, c - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#222";
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const big = i % 3 === 0;
      ctx.lineWidth = big ? 14 : 6;
      const r0 = big ? c - 52 : c - 34;
      ctx.beginPath();
      ctx.moveTo(c + Math.sin(a) * r0, c - Math.cos(a) * r0);
      ctx.lineTo(c + Math.sin(a) * (c - 14), c - Math.cos(a) * (c - 14));
      ctx.stroke();
    }
  });

const clockGeos = once(() => ({
  rim: new THREE.CylinderGeometry(1, 1, 0.12, 40).rotateX(Math.PI / 2),
  face: new THREE.CircleGeometry(0.86, 40),
  hand: (() => {
    const g = rbox(1, 1, 1, 0.2);
    g.translate(0, 0.42, 0);
    return g;
  })(),
  pin: new THREE.CylinderGeometry(0.06, 0.06, 0.08, 12).rotateX(Math.PI / 2),
  bell: new THREE.SphereGeometry(0.3, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
}));
/**
 * The wall clock (front +z, centre at the origin). `seconds` counts from 11:58:00. `radius` in world
 * units; `shake` 0..1 jiggles it (the midnight ring).
 */
export const NightClock: React.FC<{ seconds: number; radius?: number; shake?: number; t?: number }> = ({ seconds, radius = 0.42, shake = 0, t = 0 }) => {
  const g = clockGeos();
  const total = 11 * 3600 + 58 * 60 + seconds;
  // The minute hand jumps on the minute (ticks), the second hand sweeps.
  const min = Math.floor(total / 60) % 60;
  const hr = (total / 3600) % 12;
  const sec = total % 60;
  const face = useMemo(() => new THREE.MeshBasicMaterial({ map: clockFaceTex(), toneMapped: false, color: "#E9E6DA" }), []);
  const ang = (u: number) => -u * Math.PI * 2;
  const jig = shake * Math.sin(t * 60) * 0.12;
  return (
    <group scale={radius} rotation={[0, 0, jig]}>
      <mesh geometry={g.rim} material={toy("#E8473C", { rough: 0.35, glow: 0.2 })} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={g.bell} material={toy("#E8473C", { rough: 0.3, glow: 0.2 })} position={[s * 0.62, 0.86, -0.02]} rotation={[0, 0, -s * 0.55]} />
      ))}
      <mesh geometry={g.face} material={face} position={[0, 0, 0.065]} />
      <mesh geometry={g.hand} material={toy("#1E1E26", { rough: 0.4 })} position={[0, 0, 0.09]} rotation={[0, 0, ang(hr / 12)]} scale={[0.1, 0.55, 0.03]} />
      <mesh geometry={g.hand} material={toy("#1E1E26", { rough: 0.4 })} position={[0, 0, 0.11]} rotation={[0, 0, ang(min / 60)]} scale={[0.07, 0.86, 0.03]} />
      <mesh geometry={g.hand} material={basic("#E8262E")} position={[0, 0, 0.13]} rotation={[0, 0, ang(sec / 60)]} scale={[0.03, 0.92, 0.02]} />
      <mesh geometry={g.pin} material={toy("#E8262E")} position={[0, 0, 0.14]} />
    </group>
  );
};

const laptopGeos = once(() => ({
  base: rbox(0.98, 0.045, 0.66, 0.02),
  keys: new THREE.PlaneGeometry(0.84, 0.3),
  lid: rbox(0.98, 0.64, 0.035, 0.02),
  screen: new THREE.PlaneGeometry(0.9, 0.56),
  sticker: new THREE.CircleGeometry(0.075, 16),
}));
/** LAPTOP: base on the desk at the origin, keyboard towards local +z, the lid hinged at the back. */
export const LAPTOP_LID = { hingeZ: -0.32, tilt: -0.28, h: 0.64 };
export const Laptop: React.FC<{ screen: string; glow?: number }> = ({ screen, glow = 1 }) => {
  const g = laptopGeos();
  const shell = toy("#3C4150", { rough: 0.35, metal: 0.3, glow: 0.12 });
  return (
    <group>
      <mesh geometry={g.base} material={shell} position={[0, 0.023, 0]} />
      <mesh geometry={g.keys} material={toy("#1C1F28", { rough: 0.6 })} position={[0, 0.047, 0.05]} rotation={[-Math.PI / 2, 0, 0]} />
      <group position={[0, 0.04, LAPTOP_LID.hingeZ]} rotation={[LAPTOP_LID.tilt, 0, 0]}>
        <mesh geometry={g.lid} material={shell} position={[0, LAPTOP_LID.h / 2, -0.02]} />
        <mesh geometry={g.screen} material={basic(screen)} position={[0, LAPTOP_LID.h / 2, 0.0]} />
        {/* Stickers on the back of the lid. */}
        <mesh geometry={g.sticker} material={toy("#FFD23F", { glow: 0.3 })} position={[0.22, 0.42, -0.04]} rotation={[0, Math.PI, 0]} />
        <mesh geometry={g.sticker} material={toy("#7ED0FF", { glow: 0.3 })} position={[-0.18, 0.24, -0.04]} rotation={[0, Math.PI, 0]} scale={0.8} />
        <Glow color={screen} size={1.9} opacity={0.5 * glow} position={[0, LAPTOP_LID.h / 2, 0.18]} />
      </group>
    </group>
  );
};

const bookGeo = once(() => rbox(1, 1, 1, 0.02));
const BOOKS: { w: number; h: number; d: number; color: string; yaw: number }[] = [
  { w: 0.62, h: 0.11, d: 0.46, color: "#2E6FD8", yaw: 0.1 },
  { w: 0.56, h: 0.09, d: 0.42, color: "#E04848", yaw: -0.15 },
  { w: 0.66, h: 0.12, d: 0.48, color: "#3DAA6A", yaw: 0.25 },
  { w: 0.5, h: 0.08, d: 0.38, color: "#F2C230", yaw: -0.05 },
  { w: 0.58, h: 0.1, d: 0.44, color: "#8F5BD6", yaw: 0.35 },
  { w: 0.46, h: 0.08, d: 0.36, color: "#F07A2E", yaw: -0.3 },
];
/** A pile of books; `jump` 0..1 bounces them up (the face-plant thud), each a little differently. */
export const BookPile: React.FC<{ jump?: number }> = ({ jump = 0 }) => {
  let y = 0;
  return (
    <group>
      {BOOKS.map((b, i) => {
        const yy = y + b.h / 2;
        y += b.h + 0.004;
        const j = jump * (0.12 + 0.05 * i);
        return (
          <group key={i} position={[0, yy + j, 0]} rotation={[jump * 0.15 * (hash(i) - 0.5), b.yaw + jump * 0.4 * (hash(i + 3) - 0.5), jump * 0.25 * (hash(i + 5) - 0.5)]}>
            <mesh geometry={bookGeo()} material={toy(b.color, { rough: 0.6 })} scale={[b.w, b.h, b.d]} />
            <mesh geometry={bookGeo()} material={toy("#FFF8E8", { rough: 0.8 })} position={[0.012, 0, 0]} scale={[b.w - 0.03, b.h - 0.025, b.d + 0.004]} />
          </group>
        );
      })}
    </group>
  );
};
const canGeos = once(() => ({ body: new THREE.CylinderGeometry(0.06, 0.06, 0.22, 16), top: new THREE.CylinderGeometry(0.052, 0.06, 0.02, 16), band: new THREE.CylinderGeometry(0.0615, 0.0615, 0.07, 16, 1, true) }));
/** An energy-drink can (base at the origin). */
export const Can: React.FC<{ color: string; band: string }> = ({ color, band }) => {
  const g = canGeos();
  return (
    <group>
      <mesh geometry={g.body} material={toy(color, { rough: 0.3, metal: 0.4, glow: 0.2 })} position={[0, 0.11, 0]} />
      <mesh geometry={g.band} material={toy(band, { rough: 0.3, glow: 0.35, side: THREE.DoubleSide })} position={[0, 0.12, 0]} />
      <mesh geometry={g.top} material={toy("#C9CED8", { metal: 0.6, rough: 0.3 })} position={[0, 0.23, 0]} />
    </group>
  );
};
const lampGeos = once(() => ({
  base: new THREE.CylinderGeometry(0.17, 0.2, 0.05, 20),
  arm: new THREE.CylinderGeometry(0.025, 0.025, 1, 8),
  joint: new THREE.SphereGeometry(0.045, 10, 8),
  shade: new THREE.ConeGeometry(0.2, 0.26, 20, 1, true),
  bulb: new THREE.SphereGeometry(0.07, 12, 8),
}));
/** The desk lamp (base on the desk at BED_LAMP) bending over to LAMP_SHADE. */
export const DeskLamp: React.FC<{ on?: number }> = ({ on = 1 }) => {
  const g = lampGeos();
  const red = toy("#2F6FE0", { rough: 0.35, glow: 0.2 });
  const base = new THREE.Vector3(...BED_LAMP).add(new THREE.Vector3(0, 0.05, 0));
  const elbow = new THREE.Vector3(BED_LAMP[0] + 0.1, 1.95, BED_LAMP[2] - 0.2);
  const shade = new THREE.Vector3(...LAMP_SHADE);
  const seg = (a: THREE.Vector3, b: THREE.Vector3, k: number) => {
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const len = a.distanceTo(b);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return <mesh key={k} geometry={g.arm} material={red} position={mid.toArray() as V3} quaternion={q} scale={[1, len, 1]} />;
  };
  const dir = shade.clone().sub(elbow).normalize();
  const tilt = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dir.x * 0.6, 1, dir.z * 0.6).normalize().multiplyScalar(-1));
  return (
    <group>
      <mesh geometry={g.base} material={red} position={[BED_LAMP[0], BED_LAMP[1] + 0.025, BED_LAMP[2]]} />
      {seg(base, elbow, 0)}
      {seg(elbow, shade, 1)}
      <mesh geometry={g.joint} material={red} position={elbow.toArray() as V3} />
      <group position={LAMP_SHADE} quaternion={tilt}>
        <mesh geometry={g.shade} material={toy("#2F6FE0", { rough: 0.35, glow: 0.2, side: THREE.DoubleSide })} rotation={[Math.PI, 0, 0]} />
      </group>
      <mesh geometry={g.bulb} material={basic("#FFF2C8")} position={[LAMP_SHADE[0], LAMP_SHADE[1] - 0.1, LAMP_SHADE[2]]} />
      <Glow color="#FFC46B" size={1.1} opacity={0.55 * on} position={[LAMP_SHADE[0], LAMP_SHADE[1] - 0.16, LAMP_SHADE[2]]} />
    </group>
  );
};

const poolTex = () =>
  canvasTexture("ia-lamp-pool", 128, 128, (ctx, w) => {
    const gr = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, "rgba(255,196,110,0.9)");
    gr.addColorStop(0.5, "rgba(255,170,80,0.35)");
    gr.addColorStop(1, "rgba(255,160,70,0)");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, w);
  });

const bedGeos = once(() => ({
  wall: new THREE.PlaneGeometry(BED.x1 - BED.x0, BED.height),
  floor: new THREE.PlaneGeometry(BED.x1 - BED.x0, 9),
  frame: rbox(1, 1, 1, 0.03),
  sky: new THREE.PlaneGeometry(BED_WINDOW.w, BED_WINDOW.h),
  pool: new THREE.PlaneGeometry(2.2, 1.5),
  paper: new THREE.PlaneGeometry(0.42, 0.56),
  cork: rbox(1.1, 0.8, 0.05, 0.03),
  note: new THREE.PlaneGeometry(0.16, 0.16),
  ball: new THREE.IcosahedronGeometry(0.07, 0),
}));

/** The student's bedroom: wall, floor, night window, wall clock, desk, lamp, books, cans, papers. */
export const Bedroom: React.FC<{ seconds: number; t: number; jump?: number; clockShake?: number; lamp?: number }> = ({ seconds, t, jump = 0, clockShake = 0, lamp = 1 }) => {
  const g = bedGeos();
  const wall = toy("#2C3A72", { rough: 0.9, glow: 0.1 });
  const frame = toy("#E9E4D8", { rough: 0.5, glow: 0.15 });
  const skyMat = useMemo(() => new THREE.MeshBasicMaterial({ map: nightTex(), toneMapped: false }), []);
  const poolMat = useMemo(() => new THREE.MeshBasicMaterial({ map: poolTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), []);
  poolMat.opacity = 0.55 * lamp;
  const W = BED_WINDOW;
  const fr = 0.07;
  return (
    <group>
      <mesh geometry={g.wall} material={wall} position={[0, BED.height / 2, BED.zBack]} />
      <mesh geometry={g.floor} material={toy("#3A2C3C", { rough: 0.8, glow: 0.08 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, BED.zBack + 4.5]} />
      {/* Window: the night sky, a frame and a cross bar. */}
      <mesh geometry={g.sky} material={skyMat} position={[W.x, W.y, BED.zBack + 0.01]} />
      {[
        [W.x, W.y + W.h / 2, W.w + fr * 2, fr],
        [W.x, W.y - W.h / 2, W.w + fr * 2, fr],
        [W.x, W.y, W.w, fr * 0.7],
      ].map(([x, y, w, h], i) => (
        <mesh key={`h${i}`} geometry={g.frame} material={frame} position={[x, y, BED.zBack + 0.04]} scale={[w, h, 0.06]} />
      ))}
      {[W.x - W.w / 2, W.x + W.w / 2, W.x].map((x, i) => (
        <mesh key={`v${i}`} geometry={g.frame} material={frame} position={[x, W.y, BED.zBack + 0.04]} scale={[i === 2 ? fr * 0.7 : fr, W.h, 0.06]} />
      ))}
      {/* Cork board with sticky notes. */}
      <group position={[-2.55, 1.85, BED.zBack + 0.03]}>
        <mesh geometry={g.cork} material={toy("#C08A55", { rough: 0.9 })} />
        {["#FFE45C", "#FF8FB1", "#7FE0A8", "#8FC7FF", "#FFE45C"].map((c, i) => (
          <mesh key={i} geometry={g.note} material={toy(c, { glow: 0.25 })} position={[-0.36 + 0.18 * i, 0.15 * Math.sin(i * 2.1), 0.03]} rotation={[0, 0, (hash(i) - 0.5) * 0.4]} />
        ))}
      </group>
      <group position={BED_CLOCK}>
        <NightClock seconds={seconds} radius={0.4} shake={clockShake} t={t} />
      </group>
      <group position={[BED_DESK.x, 0, BED_DESK.z]}>
        <Desk w={BED_DESK.w} d={BED_DESK.d} top={BED_DESK.top} color="#B07A4E" panel="#8E5E3A" />
      </group>
      <mesh geometry={g.pool} material={poolMat} rotation={[-Math.PI / 2, 0, 0]} position={[LAMP_SHADE[0] - 0.2, BED_DESK.top + 0.004, LAMP_SHADE[2] + 0.2]} />
      <DeskLamp on={lamp} />
      <group position={BOOKS_AT}>
        <BookPile jump={jump} />
      </group>
      <group position={[BOOKS_AT[0] + 0.15, BED_DESK.top, BOOKS_AT[2] - 0.55]} rotation={[0, 0.3, 0]}>
        <group position={[0, 0, 0]}>
          <BookPile jump={jump * 0.6} />
        </group>
      </group>
      {/* Energy drinks: two standing, one knocked over, near the laptop. */}
      {(
        [
          [-1.45, -0.62, "#2FD06A", "#111"],
          [-1.25, -0.4, "#FF4FA0", "#1A1A1A"],
          [-1.62, -0.35, "#2FD06A", "#111"],
        ] as [number, number, string, string][]
      ).map(([x, z, c, b], i) => (
        <group key={i} position={[x, BED_DESK.top + jump * 0.08 * (i + 1), z]} rotation={i === 2 ? [0, 0.6, Math.PI / 2] : [0, 0, jump * 0.3 * (i ? 1 : -1)]}>
          <group position={i === 2 ? [0.06, 0, 0] : [0, 0, 0]}>
            <Can color={c} band={b} />
          </group>
        </group>
      ))}
      {/* Papers and crumpled balls in front of the student. */}
      <mesh geometry={g.paper} material={toy("#F4F1E8", { rough: 0.9, glow: 0.18 })} rotation={[-Math.PI / 2, 0, 0.3]} position={[0.55, BED_DESK.top + 0.005, -0.55]} />
      <mesh geometry={g.paper} material={toy("#F4F1E8", { rough: 0.9, glow: 0.18 })} rotation={[-Math.PI / 2, 0, -0.2]} position={[0.2, BED_DESK.top + 0.008, -0.4]} />
      {[
        [-0.95, -0.25],
        [0.95, -0.15],
        [-0.15, -0.2],
      ].map(([x, z], i) => (
        <mesh key={i} geometry={g.ball} material={toy("#EDEAE0", { rough: 0.9, flat: true })} position={[x, BED_DESK.top + 0.06 + jump * 0.1, z]} rotation={[i, i * 2, 0]} />
      ))}
    </group>
  );
};

/** Night lights of the bedroom: moody blue fill, moonlight from the window, the lamp and the screen. */
export const BedroomLights: React.FC<{ screen: string; screenK: number; lamp?: number }> = ({ screen, screenK, lamp = 1 }) => (
  <>
    <hemisphereLight args={["#5267B0", "#1A1430", 0.95]} />
    <directionalLight position={[2.5, 4, -6]} intensity={1.0} color="#9DB4FF" />
    <pointLight position={[LAMP_SHADE[0], LAMP_SHADE[1] - 0.15, LAMP_SHADE[2]]} intensity={2.6 * lamp} distance={5} decay={1.4} color="#FFB45E" />
    <pointLight position={[LAPTOP_AT[0] + 0.25, LAPTOP_AT[1] + 0.45, LAPTOP_AT[2] - 0.35]} intensity={screenK} distance={3.2} decay={1.4} color={screen} />
  </>
);

/** Small blue sweat drops flying off the head (world units) between `from` and `to`. */
export const SweatDrops: React.FC<{ g: number; from: number; to: number; head: V3; every?: number; seed?: number; spread?: number }> = ({
  g,
  from,
  to,
  head,
  every = 4,
  seed = 1,
  spread = 1,
}) => {
  const geo = useMemo(() => {
    const s = new THREE.SphereGeometry(0.05, 10, 8);
    // A teardrop: pull the top vertices up into a point.
    const p = s.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y > 0) {
        const k = y / 0.05;
        p.setY(i, y * (1 + 1.4 * k));
        p.setX(i, p.getX(i) * (1 - 0.6 * k));
        p.setZ(i, p.getZ(i) * (1 - 0.6 * k));
      }
    }
    s.computeVertexNormals();
    return s;
  }, []);
  const mat = toy("#6FCBFF", { rough: 0.15, glow: 0.45 });
  const life = 16;
  const drops: React.ReactNode[] = [];
  for (let k = Math.floor((g - life - from) / every); k * every + from <= Math.min(g, to); k++) {
    const born = from + k * every;
    if (born < from) continue;
    const d = g - born;
    if (d < 0 || d > life) continue;
    const r = (n: number) => hash(seed * 100 + k * 7 + n);
    const side = r(1) > 0.5 ? 1 : -1;
    const vx = side * (0.6 + 0.8 * r(2)) * spread;
    const vy = 1.4 + 1.0 * r(3);
    const vz = (r(4) - 0.2) * 0.8;
    const tt = d / 30;
    const x = head[0] + side * 0.45 + vx * tt;
    const y = head[1] - 0.1 + vy * tt - 4.5 * tt * tt;
    const z = head[2] + 0.2 + vz * tt;
    const s = 1.2 * Math.min(1, d / 3) * (1 - Math.max(0, (d - life + 4) / 4));
    const ang = Math.atan2(vy - 9 * tt, vx);
    drops.push(<mesh key={k} geometry={geo} material={mat} position={[x, y, z]} rotation={[0, 0, ang - Math.PI / 2]} scale={s} />);
  }
  return <group>{drops}</group>;
};

// =======================================================================================
// OFFICE

export const OFF = { zBack: -4.6, x0: -7, x1: 7, height: 4.2 };
export const OFFICE_DESK = { x: 0, z: -0.95, w: 2.9, d: 1.2, top: 0.5 };
export const WORKER_AT: V3 = [0.25, 0, -2.45];
export const WORKER_RY = -0.62;
export const MONITOR_AT: V3 = [-0.75, OFFICE_DESK.top, -1.05];
export const MONITOR_RY = 2.5;
export const BOSS_AT: V3 = [2.55, 0, -1.3];
export const BOSS_RY = -0.95;
/** Monitor screen (local to the monitor group): centre and size, facing local +z. */
export const MONITOR_SCREEN = { y: 0.62, w: 1.12, h: 0.66 };
export const OFF_WINDOW = { x: -0.2, y: 2.05, w: 4.6, h: 2.3 };
export const CUPS_AT: V3 = [OFFICE_DESK.x - 0.05, OFFICE_DESK.top, OFFICE_DESK.z - 0.35];

const officeNightTex = () =>
  canvasTexture("ia-office-night", 512, 256, (ctx, w, h) => {
    const gr = ctx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#141A4A");
    gr.addColorStop(1, "#3B3F8A");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.5 * hash(i + 11)})`;
      ctx.fillRect(hash(i + 2) * w, hash(i + 5) * h * 0.45, 2, 2);
    }
    let x = 0;
    let k = 0;
    while (x < w) {
      const bw = 30 + 50 * hash(k + 70);
      const bh = h * (0.3 + 0.45 * hash(k + 80));
      ctx.fillStyle = "#0B0E2A";
      ctx.fillRect(x, h - bh, bw, bh);
      for (let yy = h - bh + 8; yy < h - 6; yy += 14)
        for (let xx = x + 6; xx < x + bw - 6; xx += 11)
          if (hash(xx * 1.7 + yy * 5.3) > 0.6) {
            ctx.fillStyle = "#FFD98A";
            ctx.fillRect(xx, yy, 5, 6);
          }
      x += bw + 3;
      k++;
    }
  });
const officeSunTex = () =>
  canvasTexture("ia-office-sunrise", 512, 256, (ctx, w, h) => {
    const gr = ctx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#FF8A5C");
    gr.addColorStop(0.5, "#FFB86B");
    gr.addColorStop(1, "#FFE6A0");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
    const sx = w * 0.42;
    const sy = h * 0.66;
    const halo = ctx.createRadialGradient(sx, sy, 10, sx, sy, 170);
    halo.addColorStop(0, "rgba(255,255,220,1)");
    halo.addColorStop(0.25, "rgba(255,240,170,0.8)");
    halo.addColorStop(1, "rgba(255,200,120,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#FFF8D8";
    ctx.beginPath();
    ctx.arc(sx, sy, 34, 0, Math.PI * 2);
    ctx.fill();
    let x = 0;
    let k = 0;
    while (x < w) {
      const bw = 30 + 50 * hash(k + 70);
      const bh = h * (0.3 + 0.45 * hash(k + 80));
      ctx.fillStyle = "#B4547A";
      ctx.fillRect(x, h - bh, bw, bh);
      x += bw + 3;
      k++;
    }
  });

const monitorGeos = once(() => ({
  frame: rbox(1.24, 0.78, 0.07, 0.04),
  back: rbox(0.6, 0.4, 0.12, 0.06),
  neck: rbox(0.09, 0.26, 0.06, 0.02),
  foot: rbox(0.42, 0.03, 0.26, 0.015),
  screen: new THREE.PlaneGeometry(MONITOR_SCREEN.w, MONITOR_SCREEN.h),
  kb: rbox(0.7, 0.03, 0.24, 0.015),
}));
/** The worker's monitor (foot on the desk at the origin, screen towards local +z) and keyboard. */
export const Monitor: React.FC<{ screen?: string; glow?: number }> = ({ screen = "#F2F6FF", glow = 1 }) => {
  const g = monitorGeos();
  const shell = toy("#2B2F3C", { rough: 0.4, glow: 0.1 });
  return (
    <group>
      <mesh geometry={g.foot} material={shell} position={[0, 0.015, -0.05]} />
      <mesh geometry={g.neck} material={shell} position={[0, 0.15, -0.08]} />
      <mesh geometry={g.frame} material={shell} position={[0, MONITOR_SCREEN.y, -0.035]} />
      <mesh geometry={g.back} material={shell} position={[0, MONITOR_SCREEN.y, -0.1]} />
      <mesh geometry={g.screen} material={basic(screen)} position={[0, MONITOR_SCREEN.y, 0.002]} />
      <mesh geometry={g.kb} material={toy("#E4E7EE", { rough: 0.5 })} position={[0.05, 0.015, 0.42]} />
      <Glow color="#CFE0FF" size={1.6} opacity={0.18 * glow} position={[0, MONITOR_SCREEN.y, 0.2]} />
    </group>
  );
};

const coffeeGeos = once(() => ({
  body: rbox(0.55, 0.62, 0.45, 0.06),
  top: rbox(0.6, 0.12, 0.5, 0.05),
  spout: new THREE.CylinderGeometry(0.035, 0.035, 0.1, 10),
  tray: rbox(0.4, 0.03, 0.25, 0.01),
  led: new THREE.CircleGeometry(0.025, 10),
  counter: rbox(1.5, 0.9, 0.7, 0.04),
  door: new THREE.PlaneGeometry(0.62, 0.7),
}));
/** The coffee corner: a counter with a chunky coffee machine (base at the floor). */
export const CoffeeCorner: React.FC<{ t?: number }> = ({ t = 0 }) => {
  const g = coffeeGeos();
  return (
    <group>
      <mesh geometry={g.counter} material={toy("#E6E2DA", { rough: 0.6 })} position={[0, 0.45, 0]} />
      {[-0.37, 0.37].map((x) => (
        <mesh key={x} geometry={g.door} material={toy("#CFC8BC", { rough: 0.6 })} position={[x, 0.42, 0.352]} />
      ))}
      <group position={[-0.25, 0.9, 0]}>
        <mesh geometry={g.body} material={toy("#C83A3A", { rough: 0.35, glow: 0.18 })} position={[0, 0.31, -0.02]} />
        <mesh geometry={g.top} material={toy("#2B2B33", { rough: 0.4 })} position={[0, 0.66, -0.02]} />
        <mesh geometry={g.spout} material={toy("#C9CED8", { metal: 0.6, rough: 0.3 })} position={[0, 0.38, 0.24]} />
        <mesh geometry={g.tray} material={toy("#2B2B33")} position={[0, 0.03, 0.26]} />
        {[0, 1, 2].map((i) => (
          <mesh key={i} geometry={g.led} material={basic(i === Math.floor(t * 2) % 3 ? "#7CFF9A" : "#2E7A45")} position={[-0.15 + 0.1 * i, 0.52, 0.21]} />
        ))}
        <group position={[0, 0.045, 0.26]} scale={0.9}>
          <PaperCup />
        </group>
      </group>
      <group position={[0.35, 0.9, 0.1]}>
        <PaperCup />
        <group position={[0.15, 0, -0.08]}>
          <PaperCup />
        </group>
      </group>
    </group>
  );
};

const plantGeos = once(() => ({ pot: new THREE.CylinderGeometry(0.2, 0.15, 0.32, 16), leaf: new THREE.SphereGeometry(0.2, 10, 8) }));
export const Plant: React.FC<{ droop?: number }> = ({ droop = 0 }) => {
  const g = plantGeos();
  return (
    <group>
      <mesh geometry={g.pot} material={toy("#E07A4E", { rough: 0.6 })} position={[0, 0.16, 0]} />
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return <mesh key={i} geometry={g.leaf} material={toy(i % 2 ? "#3FB56A" : "#56C97C", { rough: 0.6 })} position={[Math.cos(a) * 0.14, 0.42 + 0.08 * (i % 2) - droop * 0.08, Math.sin(a) * 0.14]} scale={[0.9, 1.4 - droop * 0.4, 0.9]} />;
      })}
    </group>
  );
};

const officeGeos = once(() => ({
  wall: new THREE.PlaneGeometry(OFF.x1 - OFF.x0, OFF.height),
  floor: new THREE.PlaneGeometry(OFF.x1 - OFF.x0, 10),
  frame: rbox(1, 1, 1, 0.03),
  sky: new THREE.PlaneGeometry(OFF_WINDOW.w, OFF_WINDOW.h),
  panel: rbox(1.4, 0.06, 0.5, 0.02),
  board: rbox(1.6, 1.0, 0.05, 0.03),
  scribble: new THREE.PlaneGeometry(1, 0.06),
}));

/**
 * The office: wall with the big window (`sun` 0 → 1: night → sunrise), floor, ceiling lights, the
 * coffee corner, a background desk, the worker's desk with its monitor and the pile of cups.
 */
export const OfficeSet: React.FC<{ sun: number; cups: number; cupPop?: number; t?: number; screen?: string; front?: boolean }> = ({
  sun,
  cups,
  cupPop = 1,
  t = 0,
  screen = "#F2F6FF",
  front = false,
}) => {
  const g = officeGeos();
  const nightMat = useMemo(() => new THREE.MeshBasicMaterial({ map: officeNightTex(), toneMapped: false }), []);
  const sunMat = useMemo(() => new THREE.MeshBasicMaterial({ map: officeSunTex(), toneMapped: false, transparent: true }), []);
  sunMat.opacity = sun;
  const W = OFF_WINDOW;
  const fr = 0.08;
  const frame = toy("#F6F7FB", { rough: 0.5, glow: 0.2 });
  return (
    <group>
      <mesh geometry={g.wall} material={toy(mixHex("#DCE3F2", "#F6D9C4", sun), { rough: 0.9, glow: 0.12 })} position={[0, OFF.height / 2, OFF.zBack]} />
      <mesh geometry={g.floor} material={toy("#8D98B4", { rough: 0.9, glow: 0.1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, OFF.zBack + 5]} />
      <mesh geometry={g.sky} material={nightMat} position={[W.x, W.y, OFF.zBack + 0.01]} />
      {sun > 0.01 ? <mesh geometry={g.sky} material={sunMat} position={[W.x, W.y, OFF.zBack + 0.015]} /> : null}
      {[W.y + W.h / 2, W.y - W.h / 2, W.y].map((y, i) => (
        <mesh key={`h${i}`} geometry={g.frame} material={frame} position={[W.x, y, OFF.zBack + 0.04]} scale={[W.w + fr * 2, i === 2 ? fr * 0.6 : fr, 0.08]} />
      ))}
      {[-0.5, -1 / 6, 1 / 6, 0.5].map((u, i) => (
        <mesh key={`v${i}`} geometry={g.frame} material={frame} position={[W.x + u * W.w, W.y, OFF.zBack + 0.04]} scale={[i === 0 || i === 3 ? fr : fr * 0.6, W.h, 0.08]} />
      ))}
      {/* Sun glow pouring through the window at sunrise. */}
      <Glow color="#FFB45A" size={5.5} opacity={0.55 * sun} position={[W.x - 0.3, W.y - 0.3, OFF.zBack + 0.3]} />
      {front ? (
        // The opposite wall (only for the reverse angle over the worker's shoulder).
        <group position={[0, 0, 2.4]} rotation={[0, Math.PI, 0]}>
          <mesh geometry={g.wall} material={toy(mixHex("#DCE3F2", "#F6D9C4", sun), { rough: 0.9, glow: 0.12 })} position={[0, OFF.height / 2, 0]} />
          <mesh geometry={g.board} material={toy("#FFD54A", { rough: 0.5, glow: 0.2 })} position={[0.6, 2.1, 0.03]} scale={[0.8, 1.1, 1]} />
          <mesh geometry={g.board} material={toy("#5BC0EB", { rough: 0.5, glow: 0.2 })} position={[-1.6, 1.9, 0.03]} scale={[0.6, 0.8, 1]} />
          <mesh geometry={g.frame} material={toy("#9A6B4A", { rough: 0.6 })} position={[2.6, 1.05, 0.04]} scale={[1.0, 2.1, 0.06]} />
        </group>
      ) : null}
      {/* Ceiling light panels. */}
      {[-2.4, 0, 2.4].map((x) => (
        <mesh key={x} geometry={g.panel} material={basic("#FFFFFF")} position={[x, OFF.height - 0.03, -1.4]} />
      ))}
      {/* Whiteboard with scribbles (right of the window). */}
      <group position={[3.4, 1.95, OFF.zBack + 0.03]}>
        <mesh geometry={g.board} material={toy("#FFFFFF", { rough: 0.4, glow: 0.2 })} />
        {[0.28, 0.12, -0.04, -0.2].map((y, i) => (
          <mesh key={i} geometry={g.scribble} material={basic(i === 1 ? "#E2262E" : "#2E5BD8")} position={[-0.2 + 0.1 * i, y, 0.03]} scale={[0.9 - 0.15 * i, 1, 1]} />
        ))}
      </group>
      <group position={[-3.1, 0, OFF.zBack + 0.45]}>
        <CoffeeCorner t={t} />
      </group>
      {/* A background desk with its own (dark) monitor. */}
      <group position={[3.5, 0, -3.5]}>
        <Desk w={2.0} d={1.0} top={0.5} color="#F2F2F2" panel="#B5BED0" drawers={false} />
        <group position={[0, 0.5, -0.2]} rotation={[0, 0, 0]} scale={0.85}>
          <Monitor screen="#3A4256" glow={0} />
        </group>
      </group>
      <group position={[-2.1, 0, -3.6]}>
        <Plant droop={sun} />
      </group>
      <group position={[OFFICE_DESK.x, 0, OFFICE_DESK.z]}>
        <Desk w={OFFICE_DESK.w} d={OFFICE_DESK.d} top={OFFICE_DESK.top} color="#F4F4F6" panel="#7F8AA6" />
      </group>
      <group position={MONITOR_AT} rotation={[0, MONITOR_RY, 0]}>
        <Monitor screen={screen} />
      </group>
      <group position={CUPS_AT}>
        <CupPile count={cups} pop={cupPop} />
      </group>
    </group>
  );
};

/** Office lights: bright fluorescent fill; `sun` floods it orange through the window. */
export const OfficeLights: React.FC<{ sun: number; night?: number }> = ({ sun, night = 0 }) => (
  <>
    <hemisphereLight args={[mixHex(mixHex("#F4F7FF", "#C9CFF5", night), "#FFC490", sun), mixHex("#7A84A0", "#9A6A60", sun), 1.35]} />
    <directionalLight position={[3, 6, 9]} intensity={1.6 - 0.3 * sun} color={mixHex("#FFFFFF", "#FFE0C0", sun)} />
    <directionalLight position={[-1.5, 2.5, -9]} intensity={0.5 + 2.8 * sun} color={mixHex("#8C96E8", "#FF8A3A", sun)} />
  </>
);
