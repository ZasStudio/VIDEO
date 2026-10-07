import React, { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { V3, canvasTexture, shadeHex, toy } from "../inca/kit";
import { NUBI_GREEN } from "../Nubi";
import { Glow } from "../thanos/FX";

// The candlelit restaurant of "¿Y si tus mentiras salieran sobre tu cabeza?" (shot "cita"): a small
// round table with a floor-length white tablecloth, a candle (warm flicker), two glasses of red wine,
// a rose in a slim vase and two plates; two red velvet chairs; behind them a burgundy damask wall
// with a big window on the night city (fairy lights along its top, velvet curtains at its sides),
// wall sconces and other diners' candles glowing in the dark. Plus Nubi's date-night gear: a tuxedo
// bib with a black bow tie, a slick black quiff, and the "fin on heart" pose piece.
//
// World units are sized for a <Nubi size={2}> (2 wide, ≈ 2 tall); floor y = 0; +z faces the default
// camera. The two sit at the left and right of the table, turned towards each other and a little
// towards the camera (NUBI_SEAT / DATE_SEAT, NUBI_RY / DATE_RY). No shadow maps, at most four
// lights, geometry and canvas textures built once.

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
const basicCache = new Map<string, THREE.MeshBasicMaterial>();
const basic = (color: string, opacity = 1) => {
  const k = `${color}|${opacity}`;
  let m = basicCache.get(k);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
    basicCache.set(k, m);
  }
  return m;
};

// =======================================================================================
// LAYOUT

export const REST = { zBack: -3.4, x0: -7, x1: 7, height: 5.4 };
export const TABLE = { r: 0.5, top: 0.95 };
/** Seat height of the chairs (a seated character's <Nubi position> y). */
export const SEAT_Y = 0.52;
export const NUBI_SEAT: V3 = [-1.22, SEAT_Y, 0.05];
export const DATE_SEAT: V3 = [1.22, SEAT_Y, 0.05];
/** Seated characters turn towards each other, cheated towards the camera. */
export const NUBI_RY = 0.72;
export const DATE_RY = -0.72;
/** The tall candle stands at the front of the table, between their faces; its flame sits FLAME_DY over the table top. */
export const CANDLE_AT: V3 = [0, TABLE.top, 0.2];
const WAX_H = 0.5;
export const FLAME_DY = 0.14 + WAX_H + 0.06;
export const FLAME_AT: V3 = [CANDLE_AT[0], TABLE.top + FLAME_DY, CANDLE_AT[2]];
export const CITA_WINDOW = { x: 0, y: 2.75, w: 4.6, h: 2.9 };
/** The restaurant's background colour (behind the canvas). */
export const CITA_BG = "#1A0B16";

/** Candle flicker (≈ 0.85..1.15), deterministic from the frame. */
export const flicker = (g: number) => 1 + 0.07 * Math.sin(g * 0.83) + 0.05 * Math.sin(g * 2.17 + 1.3) + 0.03 * Math.sin(g * 5.3 + 0.4);

// =======================================================================================
// TEXTURES

const cityTex = () =>
  canvasTexture("mentiras-cita-city", 1024, 640, (ctx, w, h) => {
    const gr = ctx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#0B1038");
    gr.addColorStop(0.45, "#26206A");
    gr.addColorStop(0.78, "#6A2E78");
    gr.addColorStop(1, "#C85A7A");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.6 * hash(i + 3)})`;
      const r = 0.8 + 1.5 * hash(i + 7);
      ctx.beginPath();
      ctx.arc(hash(i) * w, hash(i + 1) * h * 0.5, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // A big soft moon.
    const mx = w * 0.8;
    const my = h * 0.2;
    const halo = ctx.createRadialGradient(mx, my, 20, mx, my, 120);
    halo.addColorStop(0, "rgba(255,240,210,0.55)");
    halo.addColorStop(1, "rgba(255,240,210,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(mx - 130, my - 130, 260, 260);
    ctx.fillStyle = "#FFF4D8";
    ctx.beginPath();
    ctx.arc(mx, my, 40, 0, Math.PI * 2);
    ctx.fill();
    // Far skyline (hazy) and near skyline with lit windows.
    const skyline = (seed: number, y0: number, y1: number, color: string, lit: number) => {
      let x = -10;
      let k = 0;
      while (x < w) {
        const bw = 46 + 70 * hash(k + seed);
        const bh = h * (y0 + (y1 - y0) * hash(k + seed + 50));
        ctx.fillStyle = color;
        ctx.fillRect(x, h - bh, bw, bh);
        if (hash(k + seed + 9) > 0.7) ctx.fillRect(x + bw * 0.45, h - bh - 26, 4, 26);
        for (let yy = h - bh + 10; yy < h - 8; yy += 17)
          for (let xx = x + 7; xx < x + bw - 8; xx += 13)
            if (hash(xx * 3.1 + yy * 7.7 + seed) > lit) {
              ctx.fillStyle = hash(xx + yy + seed) > 0.3 ? "#FFD27A" : "#9FD0FF";
              ctx.fillRect(xx, yy, 6, 8);
            }
        x += bw + 3;
        k++;
      }
    };
    skyline(11, 0.35, 0.62, "#3A2460", 0.82);
    skyline(77, 0.18, 0.45, "#120C2C", 0.62);
    // Out-of-focus city lights (bokeh) near the bottom.
    for (let i = 0; i < 26; i++) {
      const x = hash(i + 200) * w;
      const y = h * (0.72 + 0.26 * hash(i + 300));
      const r = 10 + 22 * hash(i + 400);
      const c = hash(i + 500) > 0.35 ? "255,196,110" : "255,120,170";
      const bg = ctx.createRadialGradient(x, y, 0, x, y, r);
      bg.addColorStop(0, `rgba(${c},0.55)`);
      bg.addColorStop(0.7, `rgba(${c},0.25)`);
      bg.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });

const damaskTex = () => {
  const t = canvasTexture(
    "mentiras-cita-damask",
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = "#5C1628";
      ctx.fillRect(0, 0, w, h);
      // Vertical stripes and a soft diamond medallion pattern.
      ctx.fillStyle = "rgba(255,190,150,0.05)";
      for (let x = 0; x < w; x += 64) ctx.fillRect(x, 0, 18, h);
      const medal = (cx: number, cy: number) => {
        ctx.fillStyle = "rgba(255,180,140,0.1)";
        ctx.beginPath();
        ctx.moveTo(cx, cy - 46);
        ctx.quadraticCurveTo(cx + 30, cy - 10, cx, cy + 46);
        ctx.quadraticCurveTo(cx - 30, cy - 10, cx, cy - 46);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy - 4, 10, 0, Math.PI * 2);
        ctx.fill();
      };
      medal(w * 0.5, h * 0.25);
      medal(0, h * 0.75);
      medal(w, h * 0.75);
    },
    { wrapS: true, wrapT: true },
  );
  t.repeat.set(5, 2.4);
  return t;
};

const floorTex = () => {
  const t = canvasTexture(
    "mentiras-cita-floor",
    256,
    256,
    (ctx, w, h) => {
      const tones = ["#3B2216", "#432819", "#352013", "#3F2417"];
      const rows = 8;
      for (let r = 0; r < rows; r++) {
        let x = -hash(r) * 120;
        let k = 0;
        while (x < w) {
          const len = 90 + 80 * hash(r * 13 + k);
          ctx.fillStyle = tones[(r + k) % tones.length];
          ctx.fillRect(x, (r * h) / rows, len, h / rows - 2);
          ctx.fillStyle = "rgba(0,0,0,0.35)";
          ctx.fillRect(x + len - 2, (r * h) / rows, 2, h / rows);
          x += len;
          k++;
        }
      }
    },
    { wrapS: true, wrapT: true },
  );
  t.repeat.set(4, 4);
  return t;
};

// =======================================================================================
// TABLE PROPS (world units, base at the origin)

const flameGeo = once(() => {
  const s = new THREE.SphereGeometry(1, 16, 12);
  // A teardrop: pull the top half up into a point.
  const p = s.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y > 0) {
      p.setY(i, y * 2.3);
      const k = 1 - 0.75 * y;
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k);
    }
  }
  s.computeVertexNormals();
  return s;
});
const candleGeos = once(() => ({
  base: new THREE.CylinderGeometry(0.1, 0.12, 0.03, 24),
  stem: new THREE.CylinderGeometry(0.025, 0.04, 0.07, 12),
  cup: new THREE.CylinderGeometry(0.065, 0.04, 0.04, 20),
  wax: new THREE.CylinderGeometry(0.044, 0.05, WAX_H, 20),
  drip: new THREE.SphereGeometry(0.014, 8, 6),
  wick: new THREE.CylinderGeometry(0.004, 0.004, 0.035, 6),
}));
/** The candle in its brass holder. `flame` 0..1 scales the flame (it shrinks on the record scratch). */
export const Candle: React.FC<{ g: number; flame?: number }> = ({ g, flame = 1 }) => {
  const c = candleGeos();
  const brass = toy("#E2B04A", { metal: 0.55, rough: 0.3, glow: 0.22 });
  const wax = toy("#FFF4E0", { rough: 0.6, glow: 0.35 });
  const f = flicker(g) * flame;
  const sway = 0.06 * Math.sin(g * 0.37) * flame;
  const top = 0.14 + WAX_H;
  return (
    <group>
      <mesh geometry={c.base} material={brass} position={[0, 0.015, 0]} />
      <mesh geometry={c.stem} material={brass} position={[0, 0.065, 0]} />
      <mesh geometry={c.cup} material={brass} position={[0, 0.12, 0]} />
      <mesh geometry={c.wax} material={wax} position={[0, 0.14 + WAX_H / 2, 0]} />
      <mesh geometry={c.drip} material={wax} position={[0.042, top - 0.04, 0.012]} scale={[1, 2.2, 1]} />
      <mesh geometry={c.drip} material={wax} position={[-0.03, top - 0.06, 0.034]} scale={[1, 3, 1]} />
      <mesh geometry={c.wick} material={toy("#2A1A10")} position={[0, top + 0.015, 0]} />
      {flame > 0.02 ? (
        <group position={[0, top + 0.03, 0]} rotation={[0, 0, sway]}>
          <mesh geometry={flameGeo()} material={basic("#FF9A2E")} position={[0, 0.025 * f, 0]} scale={[0.03 * f, 0.034 * f * (1 + 0.08 * Math.sin(g * 1.7)), 0.03 * f]} />
          <mesh geometry={flameGeo()} material={basic("#FFF3C4")} position={[0, 0.018 * f, 0.004]} scale={[0.017 * f, 0.02 * f, 0.017 * f]} />
        </group>
      ) : null}
      <Glow color="#FFB050" size={1.15 * Math.max(0.15, f)} opacity={0.62 * Math.min(1, flame * 1.4)} position={[0, top + 0.07, 0.02]} />
      <Glow color="#FFE2A0" size={0.35 * Math.max(0.2, f)} opacity={0.8 * Math.min(1, flame * 1.4)} position={[0, top + 0.06, 0.03]} />
    </group>
  );
};

const lathe = (pts: [number, number][], seg = 28) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
const glassGeos = once(() => ({
  glass: lathe([
    [0.0, 0.0],
    [0.075, 0.0],
    [0.074, 0.008],
    [0.014, 0.02],
    [0.009, 0.05],
    [0.009, 0.14],
    [0.02, 0.158],
    [0.052, 0.18],
    [0.07, 0.22],
    [0.069, 0.27],
    [0.058, 0.32],
  ]),
  wine: lathe([
    [0.0, 0.162],
    [0.022, 0.163],
    [0.05, 0.182],
    [0.064, 0.215],
    [0.064, 0.225],
    [0.0, 0.225],
  ]),
}));
const glassMat = once(
  () =>
    new THREE.MeshStandardMaterial({
      color: "#EEF6FF",
      transparent: true,
      opacity: 0.34,
      roughness: 0.06,
      metalness: 0.1,
      emissive: new THREE.Color("#B8CCFF"),
      emissiveIntensity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
);
/** A wine glass with red wine (base at the origin). */
export const WineGlass: React.FC = () => {
  const g = glassGeos();
  return (
    <group>
      <mesh geometry={g.wine} material={toy("#8E0E2E", { rough: 0.2, glow: 0.3 })} />
      <mesh geometry={g.glass} material={glassMat()} renderOrder={2} />
    </group>
  );
};

const roseGeos = once(() => ({
  vase: lathe([
    [0.0, 0.0],
    [0.05, 0.0],
    [0.062, 0.04],
    [0.05, 0.11],
    [0.024, 0.19],
    [0.024, 0.23],
    [0.034, 0.25],
  ]),
  stem: new THREE.CylinderGeometry(0.007, 0.008, 0.3, 6),
  bud: new THREE.SphereGeometry(0.042, 14, 10),
  petal: new THREE.SphereGeometry(0.04, 12, 8),
  leaf: new THREE.SphereGeometry(0.03, 10, 6),
}));
/** A red rose in a slim vase (base at the origin). */
export const RoseVase: React.FC = () => {
  const g = roseGeos();
  const red = toy("#D0123A", { rough: 0.5, glow: 0.26 });
  const dark = toy("#A30C2E", { rough: 0.5, glow: 0.22 });
  const green = toy("#2F8F45", { rough: 0.6, glow: 0.16 });
  return (
    <group>
      <mesh geometry={g.vase} material={glassMat()} renderOrder={2} />
      <mesh geometry={g.stem} material={green} position={[0, 0.33, 0]} rotation={[0, 0, 0.05]} />
      <mesh geometry={g.leaf} material={green} position={[0.03, 0.34, 0]} rotation={[0, 0, -0.8]} scale={[1.6, 0.5, 0.8]} />
      <mesh geometry={g.leaf} material={green} position={[-0.028, 0.4, 0]} rotation={[0, 0, 0.8]} scale={[1.4, 0.45, 0.8]} />
      <group position={[-0.008, 0.5, 0]}>
        <mesh geometry={g.bud} material={dark} scale={[1, 1.1, 1]} />
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2;
          return (
            <mesh key={i} geometry={g.petal} material={red} position={[Math.cos(a) * 0.03, -0.012 + 0.006 * (i % 2), Math.sin(a) * 0.03]} rotation={[Math.sin(a) * 0.5, a, -Math.cos(a) * 0.5]} scale={[1, 0.95, 0.55]} />
          );
        })}
      </group>
    </group>
  );
};

const plateGeos = once(() => ({
  plate: new THREE.CylinderGeometry(0.2, 0.16, 0.024, 36),
  rim: new THREE.TorusGeometry(0.19, 0.006, 6, 40).rotateX(Math.PI / 2),
  napkin: rbox(0.12, 0.16, 0.05, 0.02),
}));
export const Plate: React.FC = () => {
  const g = plateGeos();
  return (
    <group>
      <mesh geometry={g.plate} material={toy("#FFFFFF", { rough: 0.3, glow: 0.3 })} position={[0, 0.012, 0]} />
      <mesh geometry={g.rim} material={toy("#E2B04A", { metal: 0.5, rough: 0.3, glow: 0.25 })} position={[0, 0.025, 0]} />
      <mesh geometry={g.napkin} material={toy("#B0123A", { rough: 0.7, glow: 0.2 })} position={[0, 0.1, -0.02]} rotation={[-0.25, 0, 0]} />
    </group>
  );
};

const tableGeos = once(() => {
  const r = TABLE.r;
  // Floor-length cloth with soft folds that widen towards the hem.
  const skirt = new THREE.CylinderGeometry(r + 0.01, r + 0.1, TABLE.top - 0.02, 64, 6, true);
  const p = skirt.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const y = p.getY(i);
    const k = 0.5 - y / (TABLE.top - 0.02); // 0 at the top, 1 at the hem
    const a = Math.atan2(z, x);
    const rr = Math.hypot(x, z) + Math.sin(a * 14) * 0.022 * k;
    p.setX(i, Math.cos(a) * rr);
    p.setZ(i, Math.sin(a) * rr);
  }
  skirt.computeVertexNormals();
  return {
    top: new THREE.CylinderGeometry(r + 0.012, r + 0.012, 0.04, 64),
    skirt,
  };
});
/** The table with its tablecloth (centre at the origin) and everything on it. */
export const CitaTable: React.FC<{ g: number; flame?: number; glassR?: boolean }> = ({ g, flame = 1, glassR = true }) => {
  const t = tableGeos();
  const cloth = toy("#FFF8F0", { rough: 0.8, glow: 0.22, side: THREE.DoubleSide });
  return (
    <group>
      <mesh geometry={t.top} material={cloth} position={[0, TABLE.top - 0.02, 0]} />
      <mesh geometry={t.skirt} material={cloth} position={[0, (TABLE.top - 0.02) / 2, 0]} />
      <group position={[CANDLE_AT[0], TABLE.top, CANDLE_AT[2]]}>
        <Candle g={g} flame={flame} />
      </group>
      <group position={[0.1, TABLE.top, -0.28]}>
        <RoseVase />
      </group>
      <group position={[-0.28, TABLE.top, -0.02]} rotation={[0, 0.7, 0]}>
        <Plate />
      </group>
      <group position={[0.28, TABLE.top, -0.02]} rotation={[0, -0.7, 0]}>
        <Plate />
      </group>
      <group position={[-0.3, TABLE.top, 0.26]}>
        <WineGlass />
      </group>
      {glassR ? (
        <group position={[0.3, TABLE.top, 0.26]}>
          <WineGlass />
        </group>
      ) : null}
    </group>
  );
};

// =======================================================================================
// CHAIRS

const chairGeos = once(() => ({
  seat: rbox(1.5, 0.14, 1.35, 0.06),
  leg: new THREE.CylinderGeometry(0.045, 0.035, 1, 10),
  back: rbox(1.3, 1.5, 0.12, 0.12),
  frame: rbox(1.48, 1.7, 0.08, 0.1),
  knob: new THREE.SphereGeometry(0.07, 12, 8),
}));
/**
 * An elegant restaurant chair (local frame: the sitter at the origin facing +z, the seat top at
 * SEAT_Y, the back behind it at local −z). `push` 0..1 slides it back (and skews it a little).
 */
export const CitaChair: React.FC<{ push?: number }> = ({ push = 0 }) => {
  const c = chairGeos();
  const velvet = toy("#A3173A", { rough: 0.75, glow: 0.16 });
  const wood = toy("#3A1C12", { rough: 0.45, glow: 0.1 });
  const gold = toy("#E2B04A", { metal: 0.55, rough: 0.3, glow: 0.22 });
  const legH = SEAT_Y - 0.14;
  return (
    <group position={[0, 0, -0.55 * push]} rotation={[0, 0.12 * push, 0]}>
      <mesh geometry={c.seat} material={velvet} position={[0, SEAT_Y - 0.07, -0.05]} />
      {[
        [-0.62, 0.5],
        [0.62, 0.5],
        [-0.62, -0.6],
        [0.62, -0.6],
      ].map(([x, z], i) => (
        <mesh key={i} geometry={c.leg} material={wood} position={[x, legH / 2, z]} scale={[1, legH, 1]} />
      ))}
      <group position={[0, SEAT_Y + 0.82, -0.72]} rotation={[-0.08, 0, 0]}>
        <mesh geometry={c.frame} material={wood} position={[0, 0, -0.04]} />
        <mesh geometry={c.back} material={velvet} />
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={c.knob} material={gold} position={[s * 0.72, 0.86, -0.03]} />
        ))}
      </group>
    </group>
  );
};

// =======================================================================================
// THE ROOM

const roomGeos = once(() => ({
  wall: new THREE.PlaneGeometry(REST.x1 - REST.x0, REST.height),
  floor: new THREE.PlaneGeometry(REST.x1 - REST.x0, 14),
  wainscot: new THREE.PlaneGeometry(REST.x1 - REST.x0, 1.2),
  rail: rbox(REST.x1 - REST.x0, 0.07, 0.07, 0.02),
  sky: new THREE.PlaneGeometry(CITA_WINDOW.w, CITA_WINDOW.h),
  bar: rbox(1, 1, 1, 0.025),
  bulb: new THREE.SphereGeometry(0.035, 8, 6),
  curtain: (() => {
    const g = new THREE.PlaneGeometry(1.15, REST.height - 0.2, 28, 1);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setZ(i, 0.06 * Math.sin(p.getX(i) * 22));
    g.computeVertexNormals();
    return g;
  })(),
  valance: (() => {
    const g = new THREE.CylinderGeometry(0.16, 0.16, CITA_WINDOW.w + 2.6, 24, 1);
    g.rotateZ(Math.PI / 2);
    return g;
  })(),
  sconce: new THREE.ConeGeometry(0.16, 0.22, 16, 1, true),
  bracket: rbox(0.06, 0.3, 0.12, 0.02),
  smallTop: new THREE.CylinderGeometry(0.5, 0.56, 0.9, 28),
  wax: new THREE.CylinderGeometry(0.03, 0.03, 0.18, 10),
}));

/**
 * The restaurant: damask wall with wainscot, the night-city window with its frame, fairy lights and
 * velvet curtains, two wall sconces, other diners' candle-lit tables in the dark, the wooden floor.
 * `lights` 0..1 dims the decorative glows (they stay on).
 */
export const CitaRoom: React.FC<{ g: number; lights?: number }> = ({ g, lights = 1 }) => {
  const r = roomGeos();
  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({ map: damaskTex(), roughness: 0.85, emissive: new THREE.Color("#ffffff"), emissiveMap: damaskTex(), emissiveIntensity: 0.12 }), []);
  const floorMat = useMemo(() => new THREE.MeshStandardMaterial({ map: floorTex(), roughness: 0.92, emissive: new THREE.Color("#ffffff"), emissiveMap: floorTex(), emissiveIntensity: 0.1 }), []);
  const skyMat = useMemo(() => new THREE.MeshBasicMaterial({ map: cityTex(), toneMapped: false }), []);
  const W = CITA_WINDOW;
  const z = REST.zBack;
  const frame = toy("#2B140D", { rough: 0.5, glow: 0.1 });
  const gold = toy("#E2B04A", { metal: 0.55, rough: 0.3, glow: 0.22 });
  const velvet = toy("#8C1230", { rough: 0.8, glow: 0.14, side: THREE.DoubleSide });
  const fr = 0.09;
  // Fairy lights along the top of the window (a gentle sag), twinkling.
  const bulbs = Array.from({ length: 15 }, (_, i) => {
    const u = i / 14;
    const x = W.x - W.w / 2 + 0.1 + u * (W.w - 0.2);
    const y = W.y + W.h / 2 - 0.12 - 0.2 * Math.sin(Math.PI * ((u * 3) % 1));
    const tw = 0.75 + 0.25 * Math.sin(g * 0.15 + i * 1.7);
    return { x, y, tw, i };
  });
  return (
    <group>
      <mesh geometry={r.wall} material={wallMat} position={[0, REST.height / 2, z]} />
      <mesh geometry={r.wainscot} material={toy("#3A1A12", { rough: 0.55, glow: 0.1 })} position={[0, 0.6, z + 0.02]} />
      <mesh geometry={r.rail} material={gold} position={[0, 1.2, z + 0.04]} />
      <mesh geometry={r.floor} material={floorMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, z + 7]} />
      {/* The window: the night city, a dark frame with gold mullions. */}
      <mesh geometry={r.sky} material={skyMat} position={[W.x, W.y, z + 0.03]} />
      {[W.y + W.h / 2, W.y - W.h / 2].map((y, i) => (
        <mesh key={`h${i}`} geometry={r.bar} material={frame} position={[W.x, y, z + 0.07]} scale={[W.w + fr * 2, fr * 1.6, 0.1]} />
      ))}
      <mesh geometry={r.bar} material={gold} position={[W.x, W.y + 0.25, z + 0.07]} scale={[W.w, 0.035, 0.06]} />
      {[-0.5, -1 / 6, 1 / 6, 0.5].map((u, i) => (
        <mesh key={`v${i}`} geometry={r.bar} material={i === 0 || i === 3 ? frame : gold} position={[W.x + u * W.w, W.y, z + 0.07]} scale={[i === 0 || i === 3 ? fr * 1.6 : 0.035, W.h, i === 0 || i === 3 ? 0.1 : 0.06]} />
      ))}
      {bulbs.map((b) => (
        <group key={b.i} position={[b.x, b.y, z + 0.16]}>
          <mesh geometry={r.bulb} material={basic("#FFE6A8")} />
          <Glow color="#FFC870" size={0.34} opacity={0.75 * b.tw * lights} />
        </group>
      ))}
      {/* Velvet curtains and the valance. */}
      {[-1, 1].map((s) => (
        <group key={s} position={[W.x + s * (W.w / 2 + 0.42), (REST.height - 0.2) / 2, z + 0.22]}>
          <mesh geometry={r.curtain} material={velvet} />
          <mesh geometry={r.bar} material={gold} position={[0, -0.95, 0.12]} scale={[1.2, 0.08, 0.1]} />
        </group>
      ))}
      <mesh geometry={r.valance} material={velvet} position={[W.x, W.y + W.h / 2 + 0.38, z + 0.3]} scale={[1, 1.4, 1]} />
      {/* Wall sconces. */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 4.15, 2.55, z + 0.05]}>
          <mesh geometry={r.bracket} material={gold} position={[0, -0.12, 0.05]} />
          <mesh geometry={r.sconce} material={toy("#FFE2B0", { glow: 0.9, rough: 0.5, side: THREE.DoubleSide })} position={[0, 0.06, 0.16]} />
          <Glow color="#FFB860" size={1.6} opacity={0.5 * lights} position={[0, 0.1, 0.25]} />
        </group>
      ))}
      {/* Other diners' tables in the dark, each with its little candle. */}
      {(
        [
          [-4.6, -1.6],
          [4.5, -1.9],
          [-5.6, 1.6],
          [5.4, 1.2],
        ] as [number, number][]
      ).map(([x, zz], i) => (
        <group key={i} position={[x, 0, zz]}>
          <mesh geometry={r.smallTop} material={toy("#E9DED2", { rough: 0.8, glow: 0.12 })} position={[0, 0.45, 0]} />
          <mesh geometry={r.wax} material={toy("#FFF4E0", { glow: 0.4 })} position={[0, 0.99, 0]} />
          <Glow color="#FFB050" size={0.9 * flicker(g + i * 17)} opacity={0.6 * lights} position={[0, 1.12, 0]} />
        </group>
      ))}
    </group>
  );
};

/**
 * The restaurant's lights (4): warm purple ambience, a soft warm key on the couple from the front
 * left, a cool rim from the window and the candle's flickering point light. `candle` 0..1 follows the
 * flame; `keyLight` 0..1 dims the key.
 */
export const CitaLights: React.FC<{ g: number; candle?: number; keyLight?: number }> = ({ g, candle = 1, keyLight = 1 }) => (
  <>
    <hemisphereLight args={["#C9A6E0", "#4A2030", 1.05]} />
    <directionalLight position={[-2.5, 4.5, 7]} intensity={1.35 * keyLight} color="#FFE4CC" />
    <directionalLight position={[0.5, 3.5, -7]} intensity={1.1} color="#8FA8FF" />
    <pointLight position={[FLAME_AT[0], FLAME_AT[1] + 0.05, FLAME_AT[2] + 0.15]} intensity={2.6 * candle * flicker(g)} distance={4.2} decay={1.5} color="#FFA048" />
  </>
);

// =======================================================================================
// NUBI'S DATE-NIGHT GEAR (model units: children of a <Nubi>; body 10 wide, front at z 4.4)

const gearGeos = once(() => {
  const wing = (() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.42);
    s.lineTo(1.75, 1.02);
    s.quadraticCurveTo(2.15, 1.05, 2.15, 0.6);
    s.lineTo(2.15, -0.6);
    s.quadraticCurveTo(2.15, -1.05, 1.75, -1.02);
    s.lineTo(0, -0.42);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2, curveSegments: 6 });
    g.translate(0, 0, -0.18);
    return g;
  })();
  // A slick quiff: a tapered lock swept up off the front edge of the head into a curl (it sits on
  // the slicked-back hair, a thin glossy slab over the top of the head).
  const quiff = (() => {
    const curve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(-1.4, 10.1, -0.6),
        new THREE.Vector3(-0.4, 10.35, 1.6),
        new THREE.Vector3(0.6, 10.9, 3.5),
        new THREE.Vector3(1.2, 11.55, 4.45),
        new THREE.Vector3(1.4, 11.95, 3.9),
        new THREE.Vector3(1.2, 11.7, 3.25),
      ],
      false,
      "centripetal",
    );
    const tub = 48;
    const rad = 12;
    const g = new THREE.TubeGeometry(curve, tub, 1, rad, false);
    const p = g.attributes.position as THREE.BufferAttribute;
    const c = new THREE.Vector3();
    for (let i = 0; i <= tub; i++) {
      const u = i / tub;
      curve.getPointAt(u, c);
      const r = 0.95 * (1 - u) + 0.12 * u + 0.18 * Math.sin(Math.PI * Math.min(1, u * 1.8));
      for (let j = 0; j <= rad; j++) {
        const k = i * (rad + 1) + j;
        p.setXYZ(k, c.x + (p.getX(k) - c.x) * r * 2.2, c.y + (p.getY(k) - c.y) * r, c.z + (p.getZ(k) - c.z) * r);
      }
    }
    g.computeVertexNormals();
    return g;
  })();
  const hair = rbox(9.0, 0.6, 8.0, 0.28, 3);
  // The fin laid on the heart: a short wedge lying on the chest, tapering towards its tip (−x).
  const heartFin = (() => {
    const len = 3.0;
    const g = new RoundedBoxGeometry(len, 2.3, 1.1, 4, 0.45);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const t = (len / 2 - p.getX(i)) / len; // 0 at the base (+x), 1 at the tip (−x)
      p.setY(i, p.getY(i) * (1 - 0.45 * t));
      p.setZ(i, p.getZ(i) * (1 - 0.3 * t));
    }
    g.computeVertexNormals();
    return g;
  })();
  return {
    wing,
    knot: rbox(0.95, 1.05, 0.75, 0.25, 3),
    bib: rbox(3.4, 2.4, 0.16, 0.5, 3),
    button: new THREE.SphereGeometry(0.17, 10, 8),
    quiff,
    hair,
    heartFin,
    heart: (() => {
      const s = new THREE.Shape();
      s.moveTo(0, -0.9);
      s.bezierCurveTo(-0.2, -0.65, -1.0, -0.2, -1.0, 0.25);
      s.bezierCurveTo(-1.0, 0.75, -0.35, 0.95, 0, 0.5);
      s.bezierCurveTo(0.35, 0.95, 1.0, 0.75, 1.0, 0.25);
      s.bezierCurveTo(1.0, -0.2, 0.2, -0.65, 0, -0.9);
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2, curveSegments: 10 });
      g.translate(0, 0, -0.15);
      return g;
    })(),
  };
});

/** Tuxedo bib with a black bow tie under the eyes (model units). */
export const BowTie: React.FC<{ wiggle?: number }> = ({ wiggle = 0 }) => {
  const g = gearGeos();
  const black = toy("#15151C", { rough: 0.3, glow: 0.06 });
  return (
    <group>
      <mesh geometry={g.bib} material={toy("#FFFFFF", { rough: 0.55, glow: 0.22 })} position={[0, 3.15, 4.42]} />
      {[2.55, 1.95].map((y) => (
        <mesh key={y} geometry={g.button} material={black} position={[0, y, 4.55]} scale={[1, 1, 0.5]} />
      ))}
      <group position={[0, 3.62, 4.72]} rotation={[0, 0, 0.12 * wiggle]}>
        <mesh geometry={g.wing} material={black} rotation={[0, 0, 0.04]} />
        <mesh geometry={g.wing} material={black} rotation={[0, Math.PI, -0.04]} />
        <mesh geometry={g.knot} material={black} />
      </group>
    </group>
  );
};

/** Slicked-back black hair with a quiff swept up at the front (model units). */
export const Quiff: React.FC = () => {
  const g = gearGeos();
  const m = toy("#17171F", { rough: 0.16, glow: 0.05 });
  return (
    <group>
      <mesh geometry={g.hair} material={m} position={[0, 10.0, -0.3]} />
      <mesh geometry={g.quiff} material={m} />
    </group>
  );
};

/**
 * The fin laid flat on the heart (model units): pass `on` 0..1. Lower the real screen-right fin out of
 * sight (finR ≈ −2.9) while it shows. `pat` 0..1 lifts it off the chest a little (a heartbeat tap).
 */
export const HeartFin: React.FC<{ on: number; pat?: number }> = ({ on, pat = 0 }) => {
  if (on <= 0.01) return null;
  const g = gearGeos();
  const k = Math.min(1, on);
  return (
    <group position={[4.55, 4.05, 4.25 + 0.6 * k + 0.35 * pat]} rotation={[0, -0.25 + 0.25 * k, 0.18 - 0.3 * (1 - k)]} scale={[0.4 + 0.6 * k, 1, 1]}>
      <mesh geometry={g.heartFin} material={toy(NUBI_GREEN, { rough: 0.42, glow: 0.14 })} position={[-1.5, 0, 0]} />
    </group>
  );
};

/** A small glossy red heart (model units, centred). */
export const HeartShape: React.FC<{ color?: string }> = ({ color = "#FF3B6B" }) => <mesh geometry={gearGeos().heart} material={toy(color, { rough: 0.3, glow: 0.35 })} />;

/** The date's eyelid colour (her pink, a shade darker). */
export const DATE_LID = shadeHex("#FF9EC7", -0.05);
