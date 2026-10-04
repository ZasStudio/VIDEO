import React, { useLayoutEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { NUBI_FIN_TIP, NubiPose } from "../Nubi";
import { V3, canvasTexture, paintGeo, toy, useFontsReady, vertexMat } from "../inca/kit";
import { mulberry } from "../noise";
import { Glow, additive } from "../thanos/FX";
import { Flashlight, flicker } from "./Flashlight";

// The night street of the Casa Matusita short: a Lima street corner in light rain (wet asphalt
// that reflects, puddles, a kerb, an orange sodium lamp that flickers, old wires, two parked toy
// cars, dark buildings) and the Casa Matusita itself as an old two-storey toy corner house: cream
// walls with peeling paint and damp stains, barred windows, a rusty shop shutter and a rusty door
// on the ground floor, a cornice, tall wooden-shuttered windows upstairs (one with a small
// balcony, one — "the" window — with its shutters ajar), the "AV. ESPAÑA" plate on the corner.
//
// World units are sized for Nubi at size 2 (2 wide, ≈ 2 tall). The road is y = 0; sidewalks and
// the paved plaza opposite the house are CURB high. The main facade is the plane z = 0 facing +z
// (x from CASA.x0 to CASA.x1), a 45° chamfer at its right end, the side facade at x = CASA.side
// facing +x along the cross street. The plaza opposite (z > ROAD.z1) is where Nubi stands; the
// cameras look towards −z, so nothing is built behind them.
//
// Wet floor: the ground is drawn see-through over a mirrored copy of the set (<StreetReflection>,
// the set rendered with mirror=true inside scale y = −1), so the lamp, the facade, the lit window
// and Nubi reflect in it; puddles reflect more. Everything is deterministic: geometry is built
// once (module caches / useMemo) and animation comes from props (`t` seconds, levels 0..1).

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** Lazily built value shared by every instance (static geometry, materials). */
const once = <T,>(make: () => T) => {
  let v: T | undefined;
  return () => (v ??= make());
};
const rbox = (w: number, h: number, d: number, r: number, seg = 2) =>
  new RoundedBoxGeometry(w, h, d, seg, Math.max(0.001, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)));

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Paints a geometry one colour, moves it into place (then by `frame`, a facade's placement). */
const place = (g: THREE.BufferGeometry, color: string, pos: V3, rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1], frame?: THREE.Matrix4) => {
  paintGeo(g, color);
  g.applyMatrix4(_m.compose(_v.set(...pos), _q.setFromEuler(_e.set(...rot)), _s.set(...scale)));
  if (frame) g.applyMatrix4(frame);
  return g;
};
/** Merges geometries (made non-indexed), keeping only the listed attributes. */
const mergeAll = (geos: THREE.BufferGeometry[], keep: string[] = ["position", "normal", "color"]) => {
  const clean = geos.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g.clone();
    for (const name of Object.keys(ng.attributes)) if (!keep.includes(name)) ng.deleteAttribute(name);
    return ng;
  });
  const m = mergeGeometries(clean, false);
  if (!m) throw new Error("mergeGeometries failed");
  return m;
};

// =======================================================================================
// Layout

export const CURB = 0.16;
/** The avenue in front of the house (Av. España) runs along x between these z. */
export const ROAD = { z0: 2.4, z1: 10.4 };
/** The cross street at the house's corner runs along z between these x (for z < ROAD.z0). */
export const CROSS = { x0: 8.8, x1: 16.8 };

/** The Casa Matusita. Heights are world y (the house stands on the sidewalk, y = CURB). */
export const CASA = {
  x0: -7,
  x1: 5,
  /** The chamfered corner goes from (x1, 0) to (side, -cham). */
  cham: 1.4,
  side: 6.4,
  back: -12,
  base: CURB,
  /** Top of the ground floor (string course). */
  f1: CURB + 3.6,
  /** Top of the upper floor wall (cornice). */
  f2: CURB + 7.3,
  /** Top of the parapet. */
  top: CURB + 8.35,
  /** Bay centres on the main facade. */
  bays: [-5.5, -2.5, 0.5, 3.5],
};
const WIN2 = { w: 1.3, h: 2.5, cy: CURB + 5.55 };
const WIN1 = { w: 1.25, h: 1.8, cy: CURB + 2.0 };
/** "The" window (upper floor, third bay): its centre on the facade plane. */
export const CASA_WINDOW: V3 = [CASA.bays[2], WIN2.cy, 0];
/** Where the two pale eyes show, in the dark gap of the window (between the eye centres). */
export const CASA_EYES: V3 = [CASA.bays[2] - 0.32, WIN2.cy + 0.4, 0.07];
/** The rusty metal door (fourth bay): base centre on the facade plane. */
export const CASA_DOOR: V3 = [CASA.bays[3], CURB, 0];
/** The rusty shop shutter (second bay): centre on the facade plane. */
export const CASA_SHUTTER: V3 = [CASA.bays[1], CURB + 1.5, 0];
/** The "AV. ESPAÑA" plate, on the chamfer. */
export const CASA_PLATE: V3 = [CASA.x1 + CASA.cham / 2 + 0.03, CURB + 2.7, -CASA.cham / 2 + 0.03];

/** The street lamp: concrete pole at the corner, the sodium head out over the road. */
export const LAMP_POLE: V3 = [6.1, CURB, 2.0];
export const LAMP_HEAD: V3 = [6.1, 7.05, 3.55];
/** Where Nubi stands in the establishing shot: on the plaza kerb across from the window. */
export const NUBI_OPPOSITE: V3 = [1.7, CURB, 11.3];

/** Ground height at (x, z): the road at 0, sidewalks and the plaza at CURB. */
export const groundY = (x: number, z: number) => {
  if (z >= ROAD.z1) return CURB;
  if (z >= ROAD.z0) return 0;
  if (x > CROSS.x0 && x < CROSS.x1) return 0;
  return CURB;
};

/** The sodium lamp's brightness at frame g: steady, with small flickers and rare stutters. */
export const lampFlicker = (g: number) => 0.78 + 0.22 * flicker(g, 7, 0.6) * (0.97 + 0.03 * Math.sin(g * 1.7));

// =======================================================================================
// Sky, fog and lights

/** CSS night sky behind the canvas (deep blue, a little lighter at the horizon); `flash` 0..1 is lightning. */
export const nightSky = (flash = 0) => {
  const mix = (a: string, b: string) => `#${new THREE.Color(a).lerp(new THREE.Color(b), clamp01(flash)).getHexString()}`;
  return `linear-gradient(180deg, ${mix("#03050D", "#5E6E9E")} 0%, ${mix("#070C1E", "#7D8CBC")} 35%, ${mix("#0E1834", "#A2B0D8")} 62%, ${mix("#17244A", "#B9C4E6")} 82%, ${mix("#1B2A52", "#C4CEEC")} 100%)`;
};
/** Fog colour: melts the far street into the night haze. */
export const NIGHT_HAZE = "#121C38";

/** Scene fog (child of the canvas). */
export const NightFog: React.FC<{ near?: number; far?: number; color?: string }> = ({ near = 14, far = 95, color = NIGHT_HAZE }) => {
  const scene = useThree((s) => s.scene);
  const fog = useMemo(() => new THREE.Fog(color, 10, 100), [color]);
  useLayoutEffect(() => {
    fog.near = near;
    fog.far = far;
    scene.fog = fog;
  });
  useLayoutEffect(
    () => () => {
      if (scene.fog === fog) scene.fog = null;
    },
    [scene, fog],
  );
  return null;
};

/**
 * Night light rig: deep blue moonlight from the upper left, a dim sky fill, a cold rim from behind
 * the house (keeps silhouettes readable) and lightning (`flash` 0..1). `k` scales the whole rig.
 */
export const NightLights: React.FC<{ k?: number; flash?: number; rim?: number }> = ({ k = 1, flash = 0, rim = 1 }) => (
  <>
    <hemisphereLight args={["#4A5C9C", "#0D0C14", 0.3 * k + 1.4 * flash]} />
    <directionalLight position={[-14, 22, 18]} intensity={0.26 * k + 3.0 * flash} color="#7F98FF" />
    <directionalLight position={[6, 16, -30]} intensity={0.6 * rim} color="#7F96E8" />
    <directionalLight position={[22, 6, 14]} intensity={0.14 * k} color="#FFB070" />
  </>
);

// =======================================================================================
// Textures

const PPU = 80;

/** Old cream plaster: rising damp, drips under the cornice and the sills, peeling patches, cracks. */
const wallTex = (key: string, wU: number, hU: number, seed: number, drips: number[]) =>
  canvasTexture(`mat-wall-${key}`, Math.round(wU * PPU), Math.round(hU * PPU), (ctx, W, H) => {
    const rnd = mulberry(seed);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#CDB27A");
    g.addColorStop(0.45, "#D8C08A");
    g.addColorStop(1, "#C4A56E");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Mottled paint.
    for (let i = 0; i < W * H * 0.004; i++) {
      ctx.fillStyle = rnd() < 0.5 ? "rgba(255,246,220,0.06)" : "rgba(80,60,30,0.07)";
      const s = 3 + rnd() * 16;
      ctx.fillRect(rnd() * W, rnd() * H, s, s * (0.5 + rnd()));
    }
    ctx.filter = "blur(7px)";
    // Big damp clouds.
    for (let i = 0; i < 7; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const r = (0.8 + rnd() * 1.6) * PPU;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, "rgba(70,72,45,0.32)");
      rg.addColorStop(1, "rgba(70,72,45,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Rising damp: a dark ragged band at the foot.
    ctx.fillStyle = "rgba(58,52,30,0.55)";
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 18) ctx.lineTo(x, H - (0.95 + 0.55 * rnd() + 0.3 * Math.sin(x * 0.01 + seed)) * PPU);
    ctx.lineTo(W, H);
    ctx.fill();
    // Grime under the cornice.
    const tg = ctx.createLinearGradient(0, 0, 0, 0.9 * PPU);
    tg.addColorStop(0, "rgba(40,38,28,0.6)");
    tg.addColorStop(1, "rgba(40,38,28,0)");
    ctx.fillStyle = tg;
    ctx.fillRect(0, 0, W, 0.9 * PPU);
    // Drips: from the top and below the sills (x in units).
    for (const dx of drips) {
      for (let k = 0; k < 5; k++) {
        const x = (dx + (rnd() - 0.5) * 1.1) * PPU;
        const y0 = rnd() < 0.5 ? 0 : (hU - (WIN2.cy - WIN2.h / 2 - CURB) + 0.1) * PPU;
        const len = (0.6 + rnd() * 1.8) * PPU;
        const dg = ctx.createLinearGradient(0, y0, 0, y0 + len);
        dg.addColorStop(0, "rgba(55,50,32,0.5)");
        dg.addColorStop(1, "rgba(55,50,32,0)");
        ctx.fillStyle = dg;
        ctx.fillRect(x, y0, 4 + rnd() * 12, len);
      }
    }
    ctx.filter = "none";
    // Peeling paint: plaster (and bricks) showing through, a pale lip around each patch.
    for (let i = 0; i < Math.round(wU * 2.2); i++) {
      const cx = rnd() * W;
      const cy = (0.15 + rnd() * 0.8) * H;
      const r = (0.12 + rnd() * 0.42) * PPU;
      const n = 9;
      const pts: [number, number][] = [];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const rr = r * (0.55 + rnd() * 0.7);
        pts.push([cx + Math.cos(a) * rr * 1.3, cy + Math.sin(a) * rr]);
      }
      const path = () => {
        ctx.beginPath();
        pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
      };
      path();
      ctx.fillStyle = "#EFE3C2";
      ctx.save();
      ctx.translate(-2, -2);
      ctx.fill();
      ctx.restore();
      path();
      ctx.fillStyle = rnd() < 0.35 ? "#8F5E45" : "#A99272";
      ctx.fill();
      if (rnd() < 0.5) {
        ctx.strokeStyle = "rgba(60,40,25,0.5)";
        ctx.lineWidth = 1.5;
        for (let y = cy - r; y < cy + r; y += 9) {
          ctx.beginPath();
          ctx.moveTo(cx - r * 0.6, y);
          ctx.lineTo(cx + r * 0.6, y);
          ctx.stroke();
        }
      }
    }
    // Cracks.
    ctx.strokeStyle = "rgba(45,35,22,0.75)";
    ctx.lineCap = "round";
    for (let k = 0; k < Math.round(wU * 0.9); k++) {
      let x = rnd() * W;
      let y = rnd() * H;
      let a = Math.PI / 2 + (rnd() - 0.5) * 1.2;
      ctx.lineWidth = 1 + rnd() * 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 8; s++) {
        a += (rnd() - 0.5) * 1.0;
        x += Math.cos(a) * 12;
        y += Math.sin(a) * 12;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });

/** Louvred wooden shutter leaf: dark varnish worn through, slats, a frame. */
const louverTex = () =>
  canvasTexture("mat-louver", 128, 480, (ctx, W, H) => {
    const rnd = mulberry(31);
    ctx.fillStyle = "#3D2F22";
    ctx.fillRect(0, 0, W, H);
    for (let y = 22; y < H - 22; y += 15) {
      ctx.fillStyle = "#5E4A36";
      ctx.fillRect(12, y, W - 24, 6);
      ctx.fillStyle = "#211810";
      ctx.fillRect(12, y + 9, W - 24, 3);
    }
    ctx.strokeStyle = "#2A1F15";
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, W - 10, H - 10);
    ctx.fillStyle = "#2A1F15";
    ctx.fillRect(0, H * 0.48, W, 12);
    for (let i = 0; i < 22; i++) {
      ctx.fillStyle = rnd() < 0.5 ? "rgba(150,130,100,0.35)" : "rgba(20,14,8,0.35)";
      ctx.fillRect(rnd() * W, rnd() * H, 4 + rnd() * 26, 3 + rnd() * 10);
    }
  });

/** Corrugated roll-down metal shutter, rusted. */
const shutterTex = () =>
  canvasTexture("mat-shutter", 512, 600, (ctx, W, H) => {
    const rnd = mulberry(41);
    ctx.fillStyle = "#5D4D44";
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 20) {
      ctx.fillStyle = "#7C6A5E";
      ctx.fillRect(0, y, W, 3);
      ctx.fillStyle = "#2E2420";
      ctx.fillRect(0, y + 14, W, 4);
    }
    ctx.filter = "blur(5px)";
    for (let i = 0; i < 26; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const r = 20 + rnd() * 70;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, rnd() < 0.5 ? "rgba(160,72,28,0.75)" : "rgba(120,58,26,0.7)");
      rg.addColorStop(1, "rgba(120,58,26,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    for (let i = 0; i < 30; i++) {
      const x = rnd() * W;
      const y = rnd() * H * 0.6;
      const len = 60 + rnd() * 240;
      const dg = ctx.createLinearGradient(0, y, 0, y + len);
      dg.addColorStop(0, "rgba(150,70,30,0.6)");
      dg.addColorStop(1, "rgba(150,70,30,0)");
      ctx.fillStyle = dg;
      ctx.fillRect(x, y, 3 + rnd() * 9, len);
    }
    ctx.filter = "none";
    // A faded old stencil and a tag.
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = "#D8D2C4";
    ctx.font = "800 64px Montserrat, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SE ALQUILA", W / 2, H * 0.42);
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "#B03A3A";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(W * 0.18, H * 0.75);
    ctx.bezierCurveTo(W * 0.3, H * 0.6, W * 0.38, H * 0.9, W * 0.5, H * 0.72);
    ctx.bezierCurveTo(W * 0.58, H * 0.62, W * 0.66, H * 0.84, W * 0.8, H * 0.7);
    ctx.stroke();
    ctx.globalAlpha = 1;
    const bg = ctx.createLinearGradient(0, H * 0.8, 0, H);
    bg.addColorStop(0, "rgba(20,15,10,0)");
    bg.addColorStop(1, "rgba(20,15,10,0.7)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, H * 0.8, W, H * 0.2);
  });

/** Rusty metal door with raised panels. */
const doorTex = () =>
  canvasTexture("mat-door", 256, 512, (ctx, W, H) => {
    const rnd = mulberry(53);
    ctx.fillStyle = "#4A3A33";
    ctx.fillRect(0, 0, W, H);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 2; c++) {
        const x = 26 + c * 108;
        const y = 30 + r * 158;
        ctx.fillStyle = "#5C4A40";
        ctx.fillRect(x, y, 96, 140);
        ctx.fillStyle = "#6E5A4D";
        ctx.fillRect(x, y, 96, 5);
        ctx.fillRect(x, y, 5, 140);
        ctx.fillStyle = "#251B16";
        ctx.fillRect(x, y + 135, 96, 5);
        ctx.fillRect(x + 91, y, 5, 140);
      }
    }
    ctx.filter = "blur(4px)";
    for (let i = 0; i < 22; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const r = 12 + rnd() * 40;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, "rgba(165,75,28,0.8)");
      rg.addColorStop(1, "rgba(165,75,28,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    for (let i = 0; i < 16; i++) {
      const x = rnd() * W;
      const y = rnd() * H * 0.7;
      const dg = ctx.createLinearGradient(0, y, 0, y + 160);
      dg.addColorStop(0, "rgba(150,68,26,0.6)");
      dg.addColorStop(1, "rgba(150,68,26,0)");
      ctx.fillStyle = dg;
      ctx.fillRect(x, y, 3 + rnd() * 6, 160);
    }
    ctx.filter = "none";
  });

/** Wet asphalt: dark, speckled aggregate, cracks, a patch, a faded lane mark at v = 0.5. */
const asphaltTex = () =>
  canvasTexture(
    "mat-asphalt",
    512,
    512,
    (ctx, W, H) => {
      const rnd = mulberry(61);
      ctx.fillStyle = "#24272F";
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 2600; i++) {
        ctx.fillStyle = rnd() < 0.5 ? "rgba(200,205,220,0.07)" : "rgba(0,0,0,0.18)";
        const s = 1 + rnd() * 3;
        ctx.fillRect(rnd() * W, rnd() * H, s, s);
      }
      ctx.fillStyle = "rgba(10,10,14,0.35)";
      ctx.fillRect(W * 0.12, H * 0.62, W * 0.3, H * 0.2);
      ctx.strokeStyle = "rgba(8,8,10,0.7)";
      ctx.lineCap = "round";
      for (let k = 0; k < 9; k++) {
        let x = rnd() * W;
        let y = rnd() * H;
        let a = rnd() * Math.PI * 2;
        ctx.lineWidth = 1.5 + rnd() * 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let s = 0; s < 10; s++) {
          a += (rnd() - 0.5) * 1.3;
          x += Math.cos(a) * 14;
          y += Math.sin(a) * 14;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    },
    { wrapS: true, wrapT: true },
  );

/** Grey concrete slabs (sidewalks, the plaza). */
const pavementTex = () =>
  canvasTexture(
    "mat-pavement",
    256,
    256,
    (ctx, W, H) => {
      const rnd = mulberry(71);
      ctx.fillStyle = "#1E2026";
      ctx.fillRect(0, 0, W, H);
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
          const l = 88 + Math.floor(rnd() * 14);
          ctx.fillStyle = `rgb(${l},${l + 3},${l + 10})`;
          ctx.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
        }
      }
      for (let i = 0; i < 700; i++) {
        ctx.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.12)";
        ctx.fillRect(rnd() * W, rnd() * H, 2, 2);
      }
    },
    { wrapS: true, wrapT: true },
  );

/** Puddle mask for the see-through wet ground (green channel: darker = more reflection). */
const puddleTex = () =>
  canvasTexture(
    "mat-puddles",
    512,
    512,
    (ctx, W, H) => {
      const rnd = mulberry(83);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, W, H);
      ctx.filter = "blur(10px)";
      for (let i = 0; i < 9; i++) {
        const x = rnd() * W;
        const y = rnd() * H;
        const rx = 30 + rnd() * 90;
        const ry = rx * (0.4 + rnd() * 0.5);
        for (const [ox, oy] of [
          [0, 0],
          [W, 0],
          [-W, 0],
          [0, H],
          [0, -H],
        ]) {
          ctx.fillStyle = "rgb(70,70,70)";
          ctx.beginPath();
          ctx.ellipse(x + ox, y + oy, rx, ry, rnd() * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.filter = "none";
    },
    { wrapS: true, wrapT: true },
  );

/** "AV. ESPAÑA": enamel street plate (dark blue, white letters), a little rusted. */
const plateTex = () =>
  canvasTexture("mat-plate", 640, 200, (ctx, W, H) => {
    ctx.fillStyle = "#E9ECF2";
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 26);
    ctx.fill();
    ctx.fillStyle = "#183B86";
    ctx.beginPath();
    ctx.roundRect(12, 12, W - 24, H - 24, 18);
    ctx.fill();
    ctx.fillStyle = "#F4F6FA";
    ctx.font = "900 112px Montserrat, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("AV. ESPAÑA", W / 2, H / 2 + 6, W - 70);
    const rnd = mulberry(97);
    ctx.filter = "blur(3px)";
    for (let i = 0; i < 9; i++) {
      const x = rnd() < 0.5 ? rnd() * 90 : W - rnd() * 90;
      const y = rnd() * H;
      ctx.fillStyle = "rgba(140,70,30,0.55)";
      ctx.beginPath();
      ctx.arc(x, y, 6 + rnd() * 14, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.filter = "none";
  });

/** Window grid for the neighbouring blocks (mostly dark, a couple dimly lit). */
const blockTex = (key: string, wU: number, hU: number, base: string, seed: number) =>
  canvasTexture(`mat-block-${key}`, Math.round(wU * 40), Math.round(hU * 40), (ctx, W, H) => {
    const rnd = mulberry(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < W * H * 0.002; i++) {
      ctx.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.1)";
      ctx.fillRect(rnd() * W, rnd() * H, 6 + rnd() * 20, 4 + rnd() * 10);
    }
    const ppu = W / wU;
    const cols = Math.max(2, Math.round(wU / 2.2));
    for (let y = 1.2; y + 1.6 < hU - 0.6; y += 3.1) {
      for (let c = 0; c < cols; c++) {
        const x = (wU / cols) * (c + 0.5);
        const lit = rnd();
        ctx.fillStyle = "#8A8F9C";
        ctx.fillRect((x - 0.62) * ppu, (y - 0.1) * ppu, 1.24 * ppu, 1.8 * ppu);
        ctx.fillStyle = lit < 0.08 ? "#7A5526" : lit < 0.13 ? "#2D4170" : "#0B0E16";
        ctx.fillRect((x - 0.52) * ppu, y * ppu, 1.04 * ppu, 1.6 * ppu);
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect((x - 0.04) * ppu, y * ppu, 0.08 * ppu, 1.6 * ppu);
      }
    }
  });

/** Soft mist blobs (white, alpha) for the drifting low mist. */
const mistTex = () =>
  canvasTexture("mat-mist", 256, 256, (ctx, W, H) => {
    const rnd = mulberry(101);
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) {
      const x = W * (0.2 + rnd() * 0.6);
      const y = H * (0.3 + rnd() * 0.4);
      const r = W * (0.1 + rnd() * 0.2);
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, "rgba(255,255,255,0.22)");
      rg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    }
  });

/** Vertical fade (bright at the bottom of the texture) for light streaks on the wet ground. */
const streakTex = () =>
  canvasTexture("mat-streak", 64, 256, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.08, "rgba(255,255,255,0.9)");
    g.addColorStop(0.35, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const s = ctx.createLinearGradient(0, 0, W, 0);
    s.addColorStop(0, "rgba(0,0,0,1)");
    s.addColorStop(0.5, "rgba(0,0,0,0)");
    s.addColorStop(1, "rgba(0,0,0,1)");
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = s;
    ctx.fillRect(0, 0, W, H);
  });

// =======================================================================================
// Materials

const texMats = new Map<string, THREE.Material>();
/** Lit material for a canvas texture (a little self-glow so nothing goes pure black), cached. */
const texMat = (key: string, tex: () => THREE.Texture, o: { rough?: number; metal?: number; glow?: number; repeat?: [number, number] } = {}) => {
  let m = texMats.get(key);
  if (!m) {
    let t = tex();
    if (o.repeat) {
      t = t.clone();
      t.repeat.set(...o.repeat);
      t.needsUpdate = true;
    }
    m = new THREE.MeshStandardMaterial({
      map: t,
      roughness: o.rough ?? 0.9,
      metalness: o.metal ?? 0,
      emissive: new THREE.Color("#ffffff"),
      emissiveMap: t,
      emissiveIntensity: o.glow ?? 0.03,
    });
    texMats.set(key, m);
  }
  return m;
};

/** See-through wet ground over the mirrored set (puddles more see-through). */
const groundMat = (key: string, tex: () => THREE.Texture, w: number, d: number, tile: number, opacity: number) => {
  const k = `ground|${key}|${w}|${d}`;
  let m = texMats.get(k) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    const map = tex().clone();
    map.repeat.set(w / tile, d / tile);
    map.needsUpdate = true;
    const wet = puddleTex().clone();
    wet.repeat.set(w / 17, d / 17);
    wet.offset.set(key.length * 0.13, key.length * 0.29);
    wet.needsUpdate = true;
    m = new THREE.MeshStandardMaterial({
      map,
      alphaMap: wet,
      transparent: true,
      opacity,
      depthWrite: false,
      roughness: 0.3,
      metalness: 0.1,
      emissive: new THREE.Color("#ffffff"),
      emissiveMap: map,
      emissiveIntensity: 0.025,
    });
    texMats.set(k, m);
  }
  return m;
};

const SET = vertexMat(0.85, false, 0.035);
const IRON = vertexMat(0.5, false, 0.02, 0.3);
const WET = vertexMat(0.32, false, 0.03);

// =======================================================================================
// The house

type Frame = { pos: V3; rotY: number; w: number };
/** Placement of each facade: main (+z), the chamfer, the side (+x). Local x runs along it. */
const FACES: Record<"main" | "cham" | "side", Frame> = {
  main: { pos: [(CASA.x0 + CASA.x1) / 2, 0, 0], rotY: 0, w: CASA.x1 - CASA.x0 },
  cham: { pos: [CASA.x1 + CASA.cham / 2, 0, -CASA.cham / 2], rotY: Math.PI / 4, w: CASA.cham * Math.SQRT2 },
  side: { pos: [CASA.side, 0, (-CASA.cham + CASA.back) / 2], rotY: Math.PI / 2, w: -CASA.cham - CASA.back },
};
const frameMatrix = (f: Frame) => new THREE.Matrix4().compose(new THREE.Vector3(...f.pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, f.rotY, 0)), new THREE.Vector3(1, 1, 1));

const STONE = "#E3D3A8";
const STONE_DARK = "#B9A275";
const PLINTH = "#7C6B4E";
const IRON_C = "#16171B";
const VOID = "#05060A";

type Opening = { face: keyof typeof FACES; x: number; kind: "win2" | "win1" | "shutter" | "door" | "balcony" | "the" | "narrow2" | "narrow1" };
const OPENINGS: Opening[] = [
  { face: "main", x: CASA.bays[0] - FACES.main.pos[0], kind: "win2" },
  { face: "main", x: CASA.bays[1] - FACES.main.pos[0], kind: "balcony" },
  { face: "main", x: CASA.bays[2] - FACES.main.pos[0], kind: "the" },
  { face: "main", x: CASA.bays[3] - FACES.main.pos[0], kind: "win2" },
  { face: "main", x: CASA.bays[0] - FACES.main.pos[0], kind: "win1" },
  { face: "main", x: CASA.bays[1] - FACES.main.pos[0], kind: "shutter" },
  { face: "main", x: CASA.bays[2] - FACES.main.pos[0], kind: "win1" },
  { face: "main", x: CASA.bays[3] - FACES.main.pos[0], kind: "door" },
  { face: "cham", x: 0, kind: "narrow2" },
  { face: "side", x: -3.3, kind: "win2" },
  { face: "side", x: 0.2, kind: "win2" },
  { face: "side", x: 3.6, kind: "win2" },
  { face: "side", x: -3.3, kind: "win1" },
  { face: "side", x: 3.6, kind: "win1" },
];

/** Static, vertex-coloured parts of the house, merged: mouldings, ironwork, voids, shutter leaves. */
const houseGeos = once(() => {
  const stone: THREE.BufferGeometry[] = [];
  const iron: THREE.BufferGeometry[] = [];
  const voids: THREE.BufferGeometry[] = [];
  const leaves: THREE.BufferGeometry[] = [];
  for (const key of Object.keys(FACES) as (keyof typeof FACES)[]) {
    const f = FACES[key];
    const M = frameMatrix(f);
    const w = f.w;
    // Plinth, string course, cornice, parapet.
    stone.push(place(rbox(w + 0.04, 0.62, 0.1, 0.03), PLINTH, [0, CASA.base + 0.31, 0.05], undefined, undefined, M));
    stone.push(place(rbox(w + 0.06, 0.24, 0.22, 0.05), STONE, [0, CASA.f1, 0.11], undefined, undefined, M));
    stone.push(place(rbox(w + 0.06, 0.12, 0.16, 0.04), STONE_DARK, [0, CASA.f1 - 0.17, 0.08], undefined, undefined, M));
    stone.push(place(rbox(w + 0.1, 0.22, 0.38, 0.06), STONE, [0, CASA.f2 + 0.11, 0.19], undefined, undefined, M));
    stone.push(place(rbox(w + 0.2, 0.16, 0.58, 0.05), STONE, [0, CASA.f2 + 0.3, 0.29], undefined, undefined, M));
    stone.push(place(rbox(w + 0.04, 0.12, 0.2, 0.04), STONE_DARK, [0, CASA.f2 - 0.08, 0.1], undefined, undefined, M));
    stone.push(place(rbox(w, 0.62, 0.26, 0.05), STONE, [0, CASA.f2 + 0.38 + 0.31, 0.13], undefined, undefined, M));
    stone.push(place(rbox(w + 0.14, 0.12, 0.34, 0.04), STONE, [0, CASA.top - 0.06, 0.15], undefined, undefined, M));
    // Pilasters at the bay edges (main facade) or the facade ends.
    const pil = key === "main" ? [-5.8, -3, 0, 3, 5.8] : key === "side" ? [-w / 2 + 0.25, -1.55, 1.95, w / 2 - 0.25] : [];
    for (const px of pil) {
      stone.push(place(rbox(0.42, CASA.f1 - CASA.base - 0.8, 0.12, 0.04), STONE, [px, CASA.base + 0.62 + (CASA.f1 - CASA.base - 0.8) / 2, 0.06], undefined, undefined, M));
      stone.push(place(rbox(0.4, CASA.f2 - CASA.f1 - 0.25, 0.12, 0.04), STONE, [px, (CASA.f1 + CASA.f2) / 2 + 0.03, 0.06], undefined, undefined, M));
      stone.push(place(rbox(0.5, 0.86, 0.34, 0.05), STONE, [px, CASA.f2 + 0.38 + 0.43, 0.17], undefined, undefined, M));
    }
  }
  // The corner edges of the chamfer get a quoin strip.
  for (const x of [-FACES.cham.w / 2 + 0.12, FACES.cham.w / 2 - 0.12]) {
    stone.push(place(rbox(0.24, CASA.f2 - CASA.base - 0.2, 0.14, 0.04), STONE, [x, (CASA.f2 + CASA.base) / 2, 0.07], undefined, undefined, frameMatrix(FACES.cham)));
  }

  for (const o of OPENINGS) {
    const M = frameMatrix(FACES[o.face]);
    const x = o.x;
    if (o.kind === "win2" || o.kind === "balcony" || o.kind === "the" || o.kind === "narrow2") {
      const ww = o.kind === "narrow2" ? 1.0 : WIN2.w;
      const hh = WIN2.h;
      const cy = WIN2.cy;
      voids.push(place(new THREE.PlaneGeometry(ww, hh), VOID, [x, cy, 0.012], undefined, undefined, M));
      // Moulded frame, sill on corbels, a lintel with a little cornice.
      stone.push(place(rbox(ww + 0.32, 0.16, 0.16, 0.04), STONE, [x, cy + hh / 2 + 0.08, 0.08], undefined, undefined, M));
      stone.push(place(rbox(0.16, hh, 0.14, 0.04), STONE, [x - ww / 2 - 0.08, cy, 0.07], undefined, undefined, M));
      stone.push(place(rbox(0.16, hh, 0.14, 0.04), STONE, [x + ww / 2 + 0.08, cy, 0.07], undefined, undefined, M));
      stone.push(place(rbox(ww + 0.6, 0.14, 0.3, 0.04), STONE, [x, cy + hh / 2 + 0.3, 0.15], undefined, undefined, M));
      stone.push(place(rbox(ww + 0.36, 0.2, 0.2, 0.04), STONE_DARK, [x, cy + hh / 2 + 0.43, 0.1], undefined, undefined, M));
      stone.push(place(rbox(0.3, 0.34, 0.2, 0.05), STONE, [x, cy + hh / 2 + 0.16, 0.12], undefined, undefined, M));
      stone.push(place(rbox(ww + 0.44, 0.12, 0.28, 0.04), STONE, [x, cy - hh / 2 - 0.06, 0.14], undefined, undefined, M));
      for (const s of [-1, 1]) stone.push(place(rbox(0.16, 0.3, 0.2, 0.04), STONE_DARK, [x + s * (ww / 2 + 0.06), cy - hh / 2 - 0.27, 0.1], undefined, undefined, M));
      if (o.kind !== "the") {
        // Two closed louvred leaves.
        for (const s of [-1, 1]) leaves.push(place(rbox(ww / 2 - 0.01, hh - 0.04, 0.06, 0.02), "#FFFFFF", [x + (s * ww) / 4, cy, 0.05], undefined, undefined, M));
      }
      if (o.kind === "balcony") {
        // A small balcony: slab on corbels, an iron railing.
        const y0 = cy - hh / 2 - 0.02;
        stone.push(place(rbox(ww + 0.9, 0.16, 0.85, 0.05), STONE, [x, y0, 0.42], undefined, undefined, M));
        for (const s of [-1, 0, 1]) stone.push(place(rbox(0.18, 0.42, 0.6, 0.06), STONE_DARK, [x + s * 0.7, y0 - 0.26, 0.3], [0.25, 0, 0], undefined, M));
        const rw = ww + 0.8;
        iron.push(place(rbox(rw, 0.06, 0.06, 0.02), IRON_C, [x, y0 + 0.92, 0.8], undefined, undefined, M));
        iron.push(place(rbox(rw, 0.04, 0.04, 0.01), IRON_C, [x, y0 + 0.2, 0.8], undefined, undefined, M));
        for (const s of [-1, 1]) {
          iron.push(place(rbox(0.06, 0.06, 0.78, 0.02), IRON_C, [x + (s * rw) / 2, y0 + 0.92, 0.42], undefined, undefined, M));
          iron.push(place(rbox(0.04, 0.82, 0.04, 0.01), IRON_C, [x + (s * rw) / 2, y0 + 0.5, 0.06], undefined, undefined, M));
        }
        for (let k = 0; k <= 14; k++) iron.push(place(rbox(0.03, 0.82, 0.03, 0.01), IRON_C, [x - rw / 2 + (rw * k) / 14, y0 + 0.5, 0.8], undefined, undefined, M));
        for (let k = 0; k < 4; k++) iron.push(place(new THREE.TorusGeometry(0.12, 0.014, 5, 14), IRON_C, [x - rw * 0.375 + k * rw * 0.25, y0 + 0.5, 0.8], undefined, undefined, M));
      }
    } else if (o.kind === "win1" || o.kind === "narrow1") {
      const ww = o.kind === "narrow1" ? 0.95 : WIN1.w;
      const hh = WIN1.h;
      const cy = WIN1.cy;
      voids.push(place(new THREE.PlaneGeometry(ww, hh), "#0A0D16", [x, cy, 0.012], undefined, undefined, M));
      stone.push(place(rbox(ww + 0.3, 0.16, 0.14, 0.04), STONE, [x, cy + hh / 2 + 0.08, 0.07], undefined, undefined, M));
      stone.push(place(rbox(0.15, hh, 0.12, 0.04), STONE, [x - ww / 2 - 0.075, cy, 0.06], undefined, undefined, M));
      stone.push(place(rbox(0.15, hh, 0.12, 0.04), STONE, [x + ww / 2 + 0.075, cy, 0.06], undefined, undefined, M));
      stone.push(place(rbox(ww + 0.4, 0.12, 0.24, 0.04), STONE, [x, cy - hh / 2 - 0.06, 0.12], undefined, undefined, M));
      stone.push(place(rbox(0.26, 0.3, 0.16, 0.04), STONE, [x, cy + hh / 2 + 0.12, 0.1], undefined, undefined, M));
      // Window bars (a grille standing a little proud of the wall).
      const n = o.kind === "narrow1" ? 4 : 6;
      for (let k = 0; k < n; k++) iron.push(place(rbox(0.035, hh + 0.1, 0.035, 0.01), IRON_C, [x - ww / 2 + (ww * (k + 0.5)) / n, cy, 0.17], undefined, undefined, M));
      for (const yy of [-0.62, 0, 0.62]) iron.push(place(rbox(ww + 0.08, 0.04, 0.03, 0.01), IRON_C, [x, cy + yy * (hh / 2) * 1.0, 0.17], undefined, undefined, M));
      for (let k = 0; k < n - 1; k++) iron.push(place(new THREE.TorusGeometry(0.06, 0.01, 4, 10), IRON_C, [x - ww / 2 + (ww * (k + 1)) / n, cy + hh * 0.42, 0.17], undefined, undefined, M));
    } else if (o.kind === "shutter") {
      const ww = 2.5;
      stone.push(place(rbox(0.18, 3.0, 0.16, 0.04), STONE, [x - ww / 2 - 0.09, CASA.base + 1.5, 0.08], undefined, undefined, M));
      stone.push(place(rbox(0.18, 3.0, 0.16, 0.04), STONE, [x + ww / 2 + 0.09, CASA.base + 1.5, 0.08], undefined, undefined, M));
      stone.push(place(rbox(ww + 0.5, 0.2, 0.2, 0.04), STONE, [x, CASA.base + 3.08, 0.1], undefined, undefined, M));
    } else if (o.kind === "door") {
      const ww = 1.45;
      stone.push(place(rbox(0.2, 2.95, 0.16, 0.04), STONE, [x - ww / 2 - 0.1, CASA.base + 1.47, 0.08], undefined, undefined, M));
      stone.push(place(rbox(0.2, 2.95, 0.16, 0.04), STONE, [x + ww / 2 + 0.1, CASA.base + 1.47, 0.08], undefined, undefined, M));
      stone.push(place(rbox(ww + 0.6, 0.22, 0.24, 0.05), STONE, [x, CASA.base + 3.0, 0.12], undefined, undefined, M));
      stone.push(place(rbox(0.3, 0.36, 0.2, 0.05), STONE, [x, CASA.base + 3.0, 0.16], undefined, undefined, M));
      stone.push(place(rbox(ww + 0.3, 0.1, 0.4, 0.03), STONE_DARK, [x, CASA.base + 0.05, 0.2], undefined, undefined, M));
      // Fanlight over the door: dark glass behind a sunburst of bars.
      voids.push(place(new THREE.PlaneGeometry(ww, 0.4), "#090C14", [x, CASA.base + 2.68, 0.013], undefined, undefined, M));
      for (let k = 0; k < 7; k++) iron.push(place(rbox(0.03, 0.42, 0.03, 0.01), IRON_C, [x - ww / 2 + (ww * (k + 0.5)) / 7, CASA.base + 2.68, 0.06], [0, 0, (k - 3) * 0.18], undefined, M));
    }
  }
  return {
    stone: mergeAll(stone),
    iron: mergeAll(iron),
    voids: mergeAll(voids),
    leaves: mergeAll(leaves, ["position", "normal", "color", "uv"]),
  };
});

/** One louvred leaf of "the" window (hinge at local x = 0, the leaf extends towards +x). */
const leafGeo = once(() => {
  const g = rbox(WIN2.w / 2 - 0.01, WIN2.h - 0.04, 0.06, 0.02);
  g.translate((WIN2.w / 2 - 0.01) / 2, 0, 0);
  return g;
});
const planeGeo = once(() => new THREE.PlaneGeometry(1, 1));
/** A unit almond (an eye shape: pointed corners), 1 wide and 1 tall. */
const eyeGeo = once(() => {
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0);
  s.quadraticCurveTo(0, 0.85, 0.5, 0);
  s.quadraticCurveTo(0, -0.85, -0.5, 0);
  return new THREE.ShapeGeometry(s, 12);
});

/** The torn net curtain behind "the" window (alpha: ragged bottom, a tear). */
const curtainTex = () =>
  canvasTexture("mat-curtain", 128, 256, (ctx, W, H) => {
    const rnd = mulberry(7);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, 0);
    for (let x = W; x >= 0; x -= 8) ctx.lineTo(x, H * (0.72 + 0.22 * rnd()));
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.moveTo(W * 0.3, H * 0.4);
    ctx.lineTo(W * 0.55, H * 0.55);
    ctx.lineTo(W * 0.42, H * 0.85);
    ctx.lineTo(W * 0.24, H * 0.7);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    for (let x = 6; x < W; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 3, H);
      ctx.stroke();
    }
  });

const theMats = once(() => ({
  glow: additive(new THREE.MeshBasicMaterial({ color: "#FFB25E", toneMapped: false, fog: false })),
  curtain: new THREE.MeshStandardMaterial({ map: curtainTex(), transparent: true, alphaTest: 0.05, color: "#8C9198", roughness: 1, emissive: new THREE.Color("#FFAA55"), emissiveIntensity: 0, side: THREE.DoubleSide, depthWrite: false }),
  eye: additive(new THREE.MeshBasicMaterial({ color: "#EAF6F0", toneMapped: false, fog: false })),
  /** The room behind "the" window: unlit black, so torch light never fills it. */
  dark: new THREE.MeshBasicMaterial({ color: "#010103" }),
}));

/**
 * The Casa Matusita (walls, mouldings, openings, the shutter, the door, the plate, "the" window
 * with its shutters ajar). `glow` 0..1 lights "the" window from inside (warm); `eyes` 0..1 opens
 * the two pale eyes in its dark gap; `creak` swings the loose leaf a little (radians).
 */
export const CasaMatusita: React.FC<{ glow?: number; eyes?: number; creak?: number; mirror?: boolean }> = ({ glow = 0, eyes = 0, creak = 0, mirror = false }) => {
  const ready = useFontsReady();
  const g = houseGeos();
  const tm = theMats();
  const walls = useMemo(() => {
    const H = CASA.top - CASA.base;
    return (Object.keys(FACES) as (keyof typeof FACES)[]).map((k) => {
      const f = FACES[k];
      const drips = k === "main" ? CASA.bays.map((b) => b - CASA.x0) : k === "side" ? [2.0, 5.3, 8.7] : [1.0];
      const mat = texMat(`wall-${k}`, () => wallTex(k, f.w, H, k.length * 13 + 5, drips), { rough: 0.95, glow: 0.035 });
      return { k, f, mat, H };
    });
  }, []);
  const leafMat = texMat("louver", louverTex, { rough: 0.8, glow: 0.03 });
  // "The" window: the left leaf swung wide open, the right one ajar.
  const thx = CASA_WINDOW[0];
  const thy = CASA_WINDOW[1];
  const lw = WIN2.w;
  tm.glow.opacity = 0.42 * glow;
  tm.curtain.emissiveIntensity = 0.55 * glow;
  const eyeOpen = clamp01(eyes);
  tm.eye.opacity = Math.min(1, eyeOpen * 1.4);
  return (
    <group>
      {walls.map(({ k, f, mat, H }) => (
        <mesh key={k} material={mat} geometry={planeGeo()} position={[f.pos[0], CASA.base + H / 2, f.pos[2]]} rotation={[0, f.rotY, 0]} scale={[f.w, H, 1]} />
      ))}
      <mesh geometry={g.stone} material={SET} />
      <mesh geometry={g.iron} material={IRON} />
      <mesh geometry={g.voids} material={WET} />
      <mesh geometry={g.leaves} material={leafMat} />
      {/* The rusty shop shutter with its roller box and padlock. */}
      <group position={[CASA_SHUTTER[0], 0, 0]}>
        <mesh geometry={planeGeo()} material={texMat("shutter", shutterTex, { rough: 0.6, metal: 0.35, glow: 0.03 })} position={[0, CASA.base + 1.42, 0.03]} scale={[2.5, 2.84, 1]} />
        <mesh material={toy("#4A362B", { rough: 0.6, metal: 0.4, glow: 0.03 })} position={[0, CASA.base + 2.95, 0.12]}>
          <boxGeometry args={[2.6, 0.3, 0.22]} />
        </mesh>
        <mesh material={toy("#2C2622", { rough: 0.5, metal: 0.5, glow: 0.03 })} position={[0, CASA.base + 0.06, 0.08]}>
          <boxGeometry args={[2.5, 0.12, 0.1]} />
        </mesh>
        <mesh material={toy("#8A7A52", { rough: 0.4, metal: 0.6, glow: 0.05 })} position={[0.55, CASA.base + 0.2, 0.15]}>
          <boxGeometry args={[0.16, 0.2, 0.08]} />
        </mesh>
      </group>
      {/* The rusty metal door, its handle and hinges. */}
      <group position={[CASA_DOOR[0], CASA.base, 0]}>
        <mesh geometry={planeGeo()} material={texMat("door", doorTex, { rough: 0.6, metal: 0.35, glow: 0.03 })} position={[0, 1.24, 0.035]} scale={[1.45, 2.48, 1]} />
        <mesh material={toy("#2B2420", { rough: 0.45, metal: 0.6, glow: 0.03 })} position={[0.52, 1.2, 0.09]}>
          <boxGeometry args={[0.08, 0.26, 0.08]} />
        </mesh>
        {[0.4, 1.3, 2.2].map((y) => (
          <mesh key={y} material={toy("#3A2C24", { rough: 0.5, metal: 0.5, glow: 0.03 })} position={[-0.68, y, 0.07]}>
            <boxGeometry args={[0.12, 0.2, 0.06]} />
          </mesh>
        ))}
      </group>
      {/* "AV. ESPAÑA" on the chamfer. */}
      {ready ? (
        <mesh geometry={planeGeo()} material={texMat("plate", plateTex, { rough: 0.35, glow: 0.12 })} position={CASA_PLATE} rotation={[0, Math.PI / 4, 0]} scale={[1.45, 0.45, 1]} />
      ) : null}
      {/* "The" window: curtain, inner glow, eyes, two leaves. */}
      <group position={[thx, thy, 0]}>
        <mesh geometry={planeGeo()} material={tm.dark} position={[0, 0, 0.016]} scale={[lw, WIN2.h, 1]} />
        <mesh geometry={planeGeo()} material={tm.curtain} position={[0.3, 0.12, 0.022]} scale={[0.66, 2.2, 1]} />
        {glow > 0.004 ? (
          <>
            <mesh geometry={planeGeo()} material={tm.glow} position={[0, 0, 0.018]} scale={[lw * 0.98, WIN2.h * 0.98, 1]} renderOrder={3} />
            {!mirror ? <pointLight position={[0, -0.2, 0.9]} intensity={2.2 * glow} distance={4} decay={1.6} color="#FFAE5A" /> : null}
            <Glow color="#FFA24A" size={2.6} opacity={0.22 * glow} position={[0, 0, 0.4]} />
          </>
        ) : null}
        {eyeOpen > 0.01
          ? [-1, 1].map((s) => (
              <group key={s} position={[CASA_EYES[0] - thx + s * 0.17, CASA_EYES[1] - thy, CASA_EYES[2]]}>
                <mesh geometry={eyeGeo()} material={tm.eye} scale={[0.27, 0.135 * eyeOpen, 1]} renderOrder={6} />
                <Glow color="#9ED2FF" size={0.85} opacity={0.45 * eyeOpen} />
                <Glow color="#E6F6FF" size={0.3} opacity={0.55 * eyeOpen} />
              </group>
            ))
          : null}
        <group position={[-lw / 2, 0, 0.04]} rotation={[0, -2.25 + creak, 0]}>
          <mesh geometry={leafGeo()} material={leafMat} />
        </group>
        <group position={[lw / 2, 0, 0.04]} rotation={[0, -Math.PI + 0.32 + creak * 0.4, 0]}>
          <mesh geometry={leafGeo()} material={leafMat} />
        </group>
      </group>
    </group>
  );
};

// =======================================================================================
// Neighbours, distant skyline

const Block: React.FC<{ x0: number; x1: number; z0: number; z1: number; h: number; color: string; seed: number; faces: ("front" | "left" | "right")[] }> = ({ x0, x1, z0, z1, h, color, seed, faces }) => {
  const w = x1 - x0;
  const d = z1 - z0;
  return (
    <group>
      <mesh material={toy(color, { rough: 0.9, glow: 0.02 })} position={[(x0 + x1) / 2, CURB + h / 2, (z0 + z1) / 2]}>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      {faces.includes("front") ? (
        <mesh geometry={planeGeo()} material={texMat(`block-${seed}-f`, () => blockTex(`${seed}f`, w, h, color, seed), { rough: 0.9, glow: 0.05 })} position={[(x0 + x1) / 2, CURB + h / 2, z1 + 0.01]} scale={[w, h, 1]} />
      ) : null}
      {faces.includes("left") ? (
        <mesh geometry={planeGeo()} material={texMat(`block-${seed}-l`, () => blockTex(`${seed}l`, d, h, color, seed + 1), { rough: 0.9, glow: 0.05 })} position={[x0 - 0.01, CURB + h / 2, (z0 + z1) / 2]} rotation={[0, -Math.PI / 2, 0]} scale={[d, h, 1]} />
      ) : null}
      {faces.includes("right") ? (
        <mesh geometry={planeGeo()} material={texMat(`block-${seed}-r`, () => blockTex(`${seed}r`, d, h, color, seed + 2), { rough: 0.9, glow: 0.05 })} position={[x1 + 0.01, CURB + h / 2, (z0 + z1) / 2]} rotation={[0, Math.PI / 2, 0]} scale={[d, h, 1]} />
      ) : null}
      <mesh material={toy("#2A2E3A", { rough: 0.9, glow: 0.02 })} position={[(x0 + x1) / 2, CURB + h + 0.15, z1 - 0.1]}>
        <boxGeometry args={[w + 0.2, 0.3, 0.4]} />
      </mesh>
    </group>
  );
};

const skylineGeo = once(() => {
  const rnd = mulberry(211);
  const geos: THREE.BufferGeometry[] = [];
  for (let x = -70; x < 80; ) {
    const w = 5 + rnd() * 9;
    const h = 8 + rnd() * 16;
    const z = -32 - rnd() * 30;
    const c = rnd() < 0.5 ? "#141A2C" : "#10162A";
    geos.push(place(new THREE.BoxGeometry(w, h, 6), c, [x + w / 2, h / 2, z]));
    if (rnd() < 0.3) geos.push(place(new THREE.BoxGeometry(1.4, 2.4, 1.4), c, [x + w * 0.3, h + 1.2, z]));
    x += w + rnd() * 2;
  }
  // A church dome and towers far off (old Lima).
  geos.push(place(new THREE.SphereGeometry(4.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), "#151B30", [-26, 20, -58]));
  geos.push(place(new THREE.CylinderGeometry(4.3, 4.3, 4, 18), "#151B30", [-26, 18, -58]));
  for (const s of [-1, 1]) {
    geos.push(place(new THREE.BoxGeometry(3, 26, 3), "#131930", [-26 + s * 8, 13, -56]));
    geos.push(place(new THREE.ConeGeometry(2.1, 4, 4), "#131930", [-26 + s * 8, 28, -56], [0, Math.PI / 4, 0]));
  }
  return mergeAll(geos);
});

// =======================================================================================
// Street furniture: the lamp, the poles and wires, parked cars

const catenary = (a: V3, b: V3, sag: number, n = 18) => {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t));
  }
  return new THREE.CatmullRomCurve3(pts);
};
const POLE_L: V3 = [-13.6, CURB, 2.0];
const POLE_X: V3 = [18.2, CURB, 2.0];

const furnitureGeo = once(() => {
  const geos: THREE.BufferGeometry[] = [];
  const conc = "#5E626B";
  const wire = "#0B0C10";
  // Concrete poles (tapered), with a crossbar near the top.
  for (const p of [LAMP_POLE, POLE_L, POLE_X]) {
    geos.push(place(new THREE.CylinderGeometry(0.09, 0.15, 10.6, 10), conc, [p[0], p[1] + 5.3, p[2]]));
    geos.push(place(rbox(1.5, 0.12, 0.12, 0.03), conc, [p[0], p[1] + 10.1, p[2]]));
    for (const s of [-1, 1]) geos.push(place(new THREE.CylinderGeometry(0.04, 0.05, 0.16, 6), "#C9C3B4", [p[0] + s * 0.6, p[1] + 10.24, p[2]]));
    geos.push(place(rbox(0.32, 0.5, 0.22, 0.04), "#3D4048", [p[0], p[1] + 6.3, p[2] - 0.15]));
  }
  // The lamp arm: a curved pipe out over the road.
  const arm = new THREE.CatmullRomCurve3([
    new THREE.Vector3(LAMP_POLE[0], 6.6, LAMP_POLE[2]),
    new THREE.Vector3(LAMP_POLE[0], 7.25, LAMP_POLE[2] + 0.5),
    new THREE.Vector3(LAMP_POLE[0], 7.25, LAMP_HEAD[2] - 0.3),
  ]);
  geos.push(place(new THREE.TubeGeometry(arm, 14, 0.055, 6, false), "#3F434B", [0, 0, 0]));
  // The cobra head.
  geos.push(place(rbox(0.36, 0.16, 0.8, 0.07), "#2E3138", [LAMP_HEAD[0], LAMP_HEAD[1] + 0.12, LAMP_HEAD[2]]));
  // Wires: along the street, across the cross street, a service drop to the house, a sagging
  // bundle along the facade under the cornice and a loose coil on the pole.
  const tops = (p: V3, dx: number): V3 => [p[0] + dx, p[1] + 10.24, p[2]];
  const fy = CASA.f1 - 0.32;
  const spans: [V3, V3, number][] = [
    [tops(POLE_L, -0.6), tops(LAMP_POLE, -0.6), 0.8],
    [tops(POLE_L, 0.6), tops(LAMP_POLE, 0.6), 1.0],
    [tops(LAMP_POLE, 0.6), tops(POLE_X, -0.6), 0.6],
    [tops(LAMP_POLE, -0.6), tops(POLE_X, 0.6), 0.8],
    [tops(POLE_L, -0.6), [-40, 10.4, 2.0], 1.3],
    [tops(POLE_L, 0.6), [-40, 10.3, 2.2], 1.6],
    [tops(POLE_X, 0.6), [44, 10.4, 2.0], 1.4],
    [[LAMP_POLE[0], 6.0, 2.0], [4.6, fy, 0.2], 0.3],
    [[LAMP_POLE[0], 5.9, 2.0], [CASA.side + 0.12, fy, -3.0], 0.25],
    [[CASA.x0 + 0.3, fy, 0.2], [-1.0, fy, 0.2], 0.12],
    [[-1.0, fy, 0.2], [4.6, fy, 0.2], 0.16],
    [[CASA.x0 + 0.3, fy - 0.08, 0.22], [4.6, fy - 0.1, 0.22], 0.3],
    [[POLE_L[0], 6.0, 2.0], [CASA.x0 + 0.3, fy, 0.2], 0.5],
  ];
  for (const [a, b, sag] of spans) geos.push(place(new THREE.TubeGeometry(catenary(a, b, sag), 40, 0.024, 4, false), wire, [0, 0, 0]));
  const coil = new THREE.TorusGeometry(0.32, 0.03, 4, 18);
  geos.push(place(coil, wire, [LAMP_POLE[0] + 0.05, 5.6, LAMP_POLE[2] - 0.2], [0.3, 0.2, 0]));
  geos.push(place(new THREE.TorusGeometry(0.24, 0.025, 4, 16), wire, [LAMP_POLE[0] - 0.05, 5.3, LAMP_POLE[2] - 0.2], [0.1, -0.3, 0.2]));
  // Wall hooks for the facade bundle.
  for (const x of [-6.7, -1.0, 4.6]) geos.push(place(rbox(0.08, 0.08, 0.26, 0.02), "#2A2A2E", [x, fy, 0.12]));
  // Kerbs: faded yellow faces (road side).
  return mergeAll(geos);
});

const kerbGeo = once(() => {
  const geos: THREE.BufferGeometry[] = [];
  const yel = "#9C8A3A";
  const h = CURB;
  const kerb = (x0: number, x1: number, z: number, faceZ: 1 | -1) => {
    for (let x = x0; x < x1; x += 1.2) {
      const w = Math.min(1.2, x1 - x) - 0.03;
      const c = Math.abs(x - CROSS.x0) < 6 && Math.floor(x / 1.2) % 2 === 0 ? "#1C1C1E" : yel;
      geos.push(place(rbox(w, h + 0.02, 0.18, 0.04), c, [x + w / 2, h / 2, z - faceZ * 0.09]));
    }
  };
  kerb(-80, CROSS.x0, ROAD.z0, 1);
  kerb(CROSS.x1, 80, ROAD.z0, 1);
  kerb(-80, 80, ROAD.z1, -1);
  for (let z = -60; z < ROAD.z0; z += 1.2) {
    const w = Math.min(1.2, ROAD.z0 - z) - 0.03;
    geos.push(place(rbox(0.18, h + 0.02, w, 0.04), Math.floor(z / 1.2) % 2 === 0 && z > -6 ? "#1C1C1E" : yel, [CROSS.x0 - 0.09, h / 2, z + w / 2]));
    geos.push(place(rbox(0.18, h + 0.02, w, 0.04), yel, [CROSS.x1 + 0.09, h / 2, z + w / 2]));
  }
  // A manhole cover and a storm drain grate.
  geos.push(place(new THREE.CylinderGeometry(0.55, 0.55, 0.03, 20), "#2A2B30", [-2.2, 0.012, 6.6]));
  geos.push(place(rbox(1.1, 0.03, 0.4, 0.02), "#15161A", [3.2, 0.012, ROAD.z0 + 0.25]));
  return mergeAll(geos);
});

type CarKind = "beetle" | "sedan";
const carGeos = new Map<string, THREE.BufferGeometry>();
const carGeo = (kind: CarKind, color: string) => {
  const key = `${kind}|${color}`;
  let geo = carGeos.get(key);
  if (geo) return geo;
  const geos: THREE.BufferGeometry[] = [];
  const glass = "#141B2A";
  const tyre = "#121214";
  const chrome = "#9AA0A8";
  if (kind === "beetle") {
    geos.push(place(rbox(2.7, 0.62, 1.42, 0.3, 3), color, [0, 0.62, 0]));
    geos.push(place(rbox(1.5, 0.62, 1.22, 0.3, 3), color, [-0.12, 1.12, 0]));
    geos.push(place(rbox(1.36, 0.46, 1.25, 0.2, 2), glass, [-0.12, 1.15, 0]));
    for (const [x, z] of [
      [0.85, 0.62],
      [-0.85, 0.62],
      [0.85, -0.62],
      [-0.85, -0.62],
    ])
      geos.push(place(rbox(0.85, 0.5, 0.36, 0.17, 2), color, [x, 0.56, z]));
    for (const z of [-0.45, 0.45]) geos.push(place(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12), "#D8D2B8", [1.36, 0.72, z], [0, 0, Math.PI / 2]));
    geos.push(place(rbox(0.14, 0.08, 1.46, 0.03), chrome, [1.38, 0.38, 0]));
    geos.push(place(rbox(0.14, 0.08, 1.46, 0.03), chrome, [-1.38, 0.38, 0]));
  } else {
    geos.push(place(rbox(3.5, 0.55, 1.5, 0.12, 2), color, [0, 0.62, 0]));
    geos.push(place(rbox(1.9, 0.52, 1.36, 0.1, 2), color, [-0.15, 1.13, 0]));
    geos.push(place(rbox(1.7, 0.42, 1.39, 0.08, 2), glass, [-0.15, 1.12, 0]));
    for (const z of [-0.52, 0.52]) geos.push(place(rbox(0.06, 0.16, 0.36, 0.03), "#D8D2B8", [1.75, 0.72, z]));
    for (const z of [-0.6, 0.6]) geos.push(place(rbox(0.06, 0.12, 0.26, 0.03), "#6E1A1A", [-1.75, 0.74, z]));
    geos.push(place(rbox(0.12, 0.1, 1.52, 0.03), chrome, [1.76, 0.42, 0]));
    geos.push(place(rbox(0.12, 0.1, 1.52, 0.03), chrome, [-1.76, 0.42, 0]));
  }
  const wx = kind === "beetle" ? 0.85 : 1.15;
  for (const x of [-wx, wx]) for (const z of [-0.68, 0.68]) geos.push(place(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 16), tyre, [x, 0.3, z], [Math.PI / 2, 0, 0]));
  geo = mergeAll(geos);
  carGeos.set(key, geo);
  return geo;
};

/** A parked toy car (wet, glossy), base centre at the origin, front towards +x. */
export const ParkedCar: React.FC<{ kind: CarKind; color: string; position: V3; rotationY?: number }> = ({ kind, color, position, rotationY = 0 }) => (
  <mesh geometry={carGeo(kind, color)} material={WET} position={position} rotation={[0, rotationY, 0]} />
);

const lampMats = once(() => ({
  lens: new THREE.MeshBasicMaterial({ color: "#FFB15A", toneMapped: false }),
  cone: (() => {
    const m = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color("#FF9A48") }, uOpacity: { value: 0.1 } },
      vertexShader: /* glsl */ `
        varying float vT; varying vec3 vN; varying vec3 vView;
        void main() {
          vT = uv.y;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vView = normalize(-mv.xyz);
          vN = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uOpacity;
        varying float vT; varying vec3 vN; varying vec3 vView;
        void main() {
          float rim = pow(abs(dot(normalize(vN), normalize(vView))), 1.4);
          float along = pow(vT, 1.3);
          gl_FragColor = vec4(uColor, uOpacity * rim * along);
        }`,
      side: THREE.DoubleSide,
    });
    return additive(m);
  })(),
  streak: additive(new THREE.MeshBasicMaterial({ map: streakTex(), color: "#FF9A48", toneMapped: false, fog: false })),
}));

/**
 * The sodium street lamp's light, lens, halo and visible cone (the pole is in the furniture).
 * `on` is its brightness (flicker it with lampFlicker). `eye` (the camera position) orients the
 * long reflection streak on the wet road.
 */
export const LampLight: React.FC<{ on: number; mirror?: boolean; eye?: V3 }> = ({ on, mirror = false, eye }) => {
  const m = lampMats();
  const target = useMemo(() => new THREE.Object3D(), []);
  m.lens.color.set("#FFB15A").multiplyScalar(0.25 + 0.75 * on);
  m.cone.uniforms.uOpacity.value = 0.085 * on;
  m.streak.opacity = 0.55 * on;
  const H = LAMP_HEAD;
  let streak: React.ReactNode = null;
  if (!mirror && eye) {
    // The long wobbly reflection on the wet road: from under the lamp towards the camera.
    const dx = eye[0] - H[0];
    const dz = eye[2] - H[2];
    const yaw = Math.atan2(dx, dz);
    const len = Math.min(16, Math.hypot(dx, dz) * 0.7);
    streak = (
      <group position={[H[0], 0.02, H[2] + 0.4]} rotation={[0, yaw, 0]}>
        <mesh geometry={planeGeo()} material={m.streak} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, len / 2 - 0.6]} scale={[1.0, len, 1]} renderOrder={2} />
      </group>
    );
  }
  return (
    <group>
      <mesh material={m.lens} position={[H[0], H[1] + 0.03, H[2]]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.26, 18]} />
      </mesh>
      <mesh material={m.lens} position={[H[0], H[1] + 0.03, H[2]]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1.4, 1]}>
        <circleGeometry args={[0.16, 18]} />
      </mesh>
      <Glow color="#FF9A40" size={3.4} opacity={(mirror ? 0.3 : 0.55) * on} position={[H[0], H[1] - 0.05, H[2]]} />
      <Glow color="#FFD6A0" size={0.9} opacity={(mirror ? 0.4 : 0.8) * on} position={[H[0], H[1] - 0.02, H[2]]} />
      {!mirror ? (
        <>
          <spotLight position={[H[0], H[1] - 0.05, H[2]]} target={target} angle={0.82} penumbra={0.8} intensity={40 * on} distance={22} decay={1.35} color="#FF9440" />
          <primitive object={target} position={[H[0] - 0.6, 0, H[2] + 2.4]} />
          <pointLight position={[H[0], H[1] - 0.4, H[2] - 0.2]} intensity={1.4 * on} distance={4.5} decay={1.3} color="#FF9A48" />
          <mesh material={m.cone} position={[H[0], H[1] / 2, H[2]]}>
            <coneGeometry args={[3.6, H[1], 32, 1, true]} />
          </mesh>
          {streak}
        </>
      ) : null}
    </group>
  );
};

// =======================================================================================
// Ground

const groundGeo = once(() => new THREE.PlaneGeometry(1, 1));
type Rect = { key: string; x0: number; x1: number; z0: number; z1: number; y: number; tex: "asphalt" | "pavement"; tile: number; opacity: number };
const GROUND: Rect[] = [
  { key: "road", x0: -80, x1: 80, z0: ROAD.z0, z1: ROAD.z1, y: 0, tex: "asphalt", tile: 8, opacity: 0.72 },
  { key: "cross", x0: CROSS.x0, x1: CROSS.x1, z0: -60, z1: ROAD.z0, y: 0, tex: "asphalt", tile: 8, opacity: 0.72 },
  { key: "walk", x0: -80, x1: CROSS.x0, z0: 0, z1: ROAD.z0, y: CURB, tex: "pavement", tile: 2.4, opacity: 0.86 },
  { key: "walk-side", x0: CASA.x1, x1: CROSS.x0, z0: -60, z1: 0, y: CURB, tex: "pavement", tile: 2.4, opacity: 0.86 },
  { key: "walk-far", x0: CROSS.x1, x1: 80, z0: -60, z1: ROAD.z0, y: CURB, tex: "pavement", tile: 2.4, opacity: 0.86 },
  { key: "plaza", x0: -80, x1: 80, z0: ROAD.z1, z1: 70, y: CURB, tex: "pavement", tile: 3.2, opacity: 0.8 },
];

/** The wet ground (see-through over <StreetReflection>), kerbs, a lane line. */
export const WetGround: React.FC = () => {
  const rects = useMemo(
    () =>
      GROUND.map((r) => ({
        ...r,
        mat: groundMat(r.key, r.tex === "asphalt" ? asphaltTex : pavementTex, r.x1 - r.x0, r.z1 - r.z0, r.tile, r.opacity),
      })),
    [],
  );
  return (
    <group>
      {rects.map((r) => (
        <mesh
          key={r.key}
          geometry={groundGeo()}
          material={r.mat}
          position={[(r.x0 + r.x1) / 2, r.y, (r.z0 + r.z1) / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[r.x1 - r.x0, r.z1 - r.z0, 1]}
          renderOrder={-1}
        />
      ))}
      <mesh geometry={kerbGeo()} material={SET} />
      {/* Faded centre line (dashes). */}
      {Array.from({ length: 28 }, (_, i) => -60 + i * 4.5).map((x) => (
        <mesh key={x} geometry={groundGeo()} material={laneMat()} position={[x, 0.006, (ROAD.z0 + ROAD.z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} scale={[2.2, 0.14, 1]} renderOrder={0} />
      ))}
    </group>
  );
};
const laneMat = once(() => new THREE.MeshStandardMaterial({ color: "#8C7E48", transparent: true, opacity: 0.55, depthWrite: false, roughness: 0.4 }));

// =======================================================================================
// The whole set

/**
 * The street, the house and the neighbours. `mirror`: the copy drawn upside down under the wet
 * ground (no lights, no ground). `lamp` is the sodium lamp's brightness; `glow`/`eyes`/`creak`
 * go to "the" window. `eye` is the camera position (for the lamp's streak on the road).
 */
export const MatusitaStreet: React.FC<{ lamp?: number; glow?: number; eyes?: number; creak?: number; mirror?: boolean; eye?: V3; far?: boolean }> = ({
  lamp = 1,
  glow = 0,
  eyes = 0,
  creak = 0,
  mirror = false,
  eye,
  far = true,
}) => (
  <group>
    {!mirror ? <WetGround /> : null}
    <CasaMatusita glow={glow} eyes={eyes} creak={creak} mirror={mirror} />
    {/* The neighbours: a taller grey block on the left, a dark one across the cross street, the
        house's own back wing behind the corner. */}
    <Block x0={-19} x1={CASA.x0} z0={-12} z1={-0.25} h={11.4} color="#3E4558" seed={301} faces={["front"]} />
    <Block x0={-31} x1={-19.2} z0={-12} z1={0} h={8.6} color="#4A4A54" seed={307} faces={["front"]} />
    <Block x0={CROSS.x1 + 2.4} x1={34} z0={-14} z1={0} h={13.5} color="#353B4C" seed={311} faces={["front", "left"]} />
    <Block x0={CROSS.x1 + 2.4} x1={30} z0={-34} z1={-14.4} h={9.5} color="#30364A" seed={317} faces={["left"]} />
    <mesh material={toy("#3A3424", { rough: 0.95, glow: 0.02 })} position={[(CASA.x0 + 0.1 + CASA.side - 0.2) / 2, CURB + 4.1, (CASA.back - 1.6) / 2]}>
      <boxGeometry args={[CASA.side - 0.2 - CASA.x0 - 0.1, 8.2, -1.6 - CASA.back]} />
    </mesh>
    {far ? <mesh geometry={skylineGeo()} material={SET} /> : null}
    <mesh geometry={furnitureGeo()} material={SET} />
    <LampLight on={lamp} mirror={mirror} eye={eye} />
    <ParkedCar kind="beetle" color="#3E6E8E" position={[-5.3, 0, ROAD.z0 + 0.95]} rotationY={Math.PI} />
    <ParkedCar kind="sedan" color="#7A2E2A" position={[-12.2, 0, ROAD.z0 + 1.0]} rotationY={Math.PI} />
  </group>
);

/** The mirror image of the set and of `children` (Nubi etc.) under the see-through wet ground. */
export const StreetReflection: React.FC<{ children?: React.ReactNode }> = ({ children }) => <group scale={[1, -1, 1]}>{children}</group>;

// =======================================================================================
// Rain, splashes, mist

const RAIN_VERT = /* glsl */ `
attribute vec4 aDrop;
uniform float uTime;
uniform vec3 uMin;
uniform vec3 uSize;
uniform float uSpeed;
uniform float uLen;
uniform float uPx;
uniform vec2 uWind;
uniform vec3 uLampPos;
uniform float uLamp;
uniform vec3 uTorchPos;
uniform vec3 uTorchDir;
uniform float uTorchCos;
uniform float uTorch;
uniform float uFlash;
uniform float uFar;
varying vec3 vCol;
varying float vA;
varying float vAlong;
varying float vSide;
void main() {
  float sp = uSpeed * (0.85 + 0.3 * aDrop.w);
  float y = uMin.y + uSize.y * fract(aDrop.y - uTime * sp / uSize.y);
  vec3 head = vec3(uMin.x + aDrop.x * uSize.x, y, uMin.z + aDrop.z * uSize.z);
  head.xz += uWind * (y - uMin.y - 0.5 * uSize.y);
  vec3 dir = normalize(vec3(uWind.x, -1.0, uWind.y));
  vec3 tail = head - dir * uLen * (0.75 + 0.5 * aDrop.w);
  vec3 p = mix(tail, head, position.y);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec4 mh = modelViewMatrix * vec4(head, 1.0);
  vec4 mt = modelViewMatrix * vec4(tail, 1.0);
  vec2 d = mh.xy / max(0.05, -mh.z) - mt.xy / max(0.05, -mt.z);
  vec2 side = normalize(vec2(-d.y, d.x) + vec2(1e-5, 0.0));
  float dist = max(0.05, -mv.z);
  mv.xy += side * position.x * uPx * dist / (960.0 * projectionMatrix[1][1]);
  gl_Position = projectionMatrix * mv;
  float dl = distance(head, uLampPos);
  float lamp = uLamp * exp(-dl * dl / 20.0);
  vec3 tv = head - uTorchPos;
  float tl = max(1e-3, length(tv));
  float cone = smoothstep(uTorchCos - 0.015, uTorchCos + 0.03, dot(tv / tl, uTorchDir));
  float torch = uTorch * cone * exp(-tl * 0.09);
  vCol = vec3(0.6, 0.72, 1.0) * 0.6 + vec3(1.0, 0.6, 0.28) * lamp * 2.6 + vec3(1.0, 0.9, 0.72) * torch * 3.2 + vec3(0.85, 0.9, 1.0) * uFlash * 1.4;
  vA = smoothstep(0.35, 1.6, dist) * (1.0 - smoothstep(uFar * 0.45, uFar, dist));
  vAlong = position.y;
  vSide = position.x * 2.0;
}`;
const RAIN_FRAG = /* glsl */ `
uniform float uOpacity;
varying vec3 vCol;
varying float vA;
varying float vAlong;
varying float vSide;
void main() {
  float a = uOpacity * vA * (0.2 + 0.8 * vAlong) * (1.0 - vSide * vSide);
  gl_FragColor = vec4(vCol, a);
}`;

const rainGeo = (count: number, seed: number) => {
  const g = new THREE.InstancedBufferGeometry();
  g.setIndex([0, 1, 2, 2, 1, 3]);
  g.setAttribute("position", new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, -0.5, 1, 0, 0.5, 1, 0], 3));
  const rnd = mulberry(seed);
  const a = new Float32Array(count * 4);
  for (let i = 0; i < count * 4; i++) a[i] = rnd();
  g.setAttribute("aDrop", new THREE.InstancedBufferAttribute(a, 4));
  g.instanceCount = count;
  return g;
};

export type TorchInfo = { pos: V3; dir: V3; on: number; angle?: number };

/**
 * Instanced rain streaks in the box [min, min + size] (they wrap as they fall), slanted by `wind`
 * (x, z drift per unit of fall). Streaks brighten near the lamp, inside the torch's cone and in a
 * lightning `flash`. `px` is the streak width in pixels; `opacity` the overall strength.
 */
export const Rain: React.FC<{
  t: number;
  min: V3;
  size: V3;
  count?: number;
  seed?: number;
  speed?: number;
  len?: number;
  px?: number;
  wind?: [number, number];
  opacity?: number;
  lamp?: number;
  torch?: TorchInfo;
  flash?: number;
  far?: number;
}> = ({ t, min, size, count = 1800, seed = 5, speed = 11, len = 0.42, px = 2.6, wind = [0.12, 0.05], opacity = 0.32, lamp = 1, torch, flash = 0, far = 40 }) => {
  const geo = useMemo(() => rainGeo(count, seed), [count, seed]);
  const mat = useMemo(
    () =>
      additive(
        new THREE.ShaderMaterial({
          vertexShader: RAIN_VERT,
          fragmentShader: RAIN_FRAG,
          side: THREE.DoubleSide,
          uniforms: {
            uTime: { value: 0 },
            uMin: { value: new THREE.Vector3() },
            uSize: { value: new THREE.Vector3() },
            uSpeed: { value: 11 },
            uLen: { value: 0.4 },
            uPx: { value: 2.6 },
            uWind: { value: new THREE.Vector2() },
            uLampPos: { value: new THREE.Vector3(...LAMP_HEAD) },
            uLamp: { value: 1 },
            uTorchPos: { value: new THREE.Vector3() },
            uTorchDir: { value: new THREE.Vector3(0, 0, 1) },
            uTorchCos: { value: 0.95 },
            uTorch: { value: 0 },
            uFlash: { value: 0 },
            uFar: { value: 40 },
            uOpacity: { value: 0.3 },
          },
        }),
      ),
    [],
  );
  const u = mat.uniforms;
  u.uTime.value = t;
  u.uMin.value.set(...min);
  u.uSize.value.set(...size);
  u.uSpeed.value = speed;
  u.uLen.value = len;
  u.uPx.value = px;
  u.uWind.value.set(...wind);
  u.uLamp.value = lamp;
  u.uFlash.value = flash;
  u.uFar.value = far;
  u.uOpacity.value = opacity;
  if (torch) {
    u.uTorchPos.value.set(...torch.pos);
    u.uTorchDir.value.set(...torch.dir).normalize();
    u.uTorchCos.value = Math.cos(torch.angle ?? 0.3);
    u.uTorch.value = torch.on;
  } else u.uTorch.value = 0;
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={4} />;
};

const SPLASH_VERT = /* glsl */ `
attribute vec4 aSplash;
uniform float uTime;
uniform float uRate;
uniform vec3 uLampPos;
uniform float uLamp;
varying vec2 vUv;
varying float vLife;
varying float vLampK;
void main() {
  float h = fract(aSplash.z * 7.13);
  float life = fract(uTime * uRate * (0.7 + 0.6 * h) + aSplash.z);
  float r = aSplash.w * (0.2 + 0.8 * life);
  vec3 c = vec3(aSplash.x, 0.0, aSplash.y);
  c.y = (c.z > ${ROAD.z1.toFixed(2)} || c.z < ${ROAD.z0.toFixed(2)}) ? ${(CURB + 0.012).toFixed(3)} : 0.012;
  vec3 p = c + vec3(position.x * r, 0.0, position.y * r);
  vUv = position.xy;
  vLife = life;
  vec2 dl = c.xz - uLampPos.xz;
  vLampK = uLamp * exp(-dot(dl, dl) / 18.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const SPLASH_FRAG = /* glsl */ `
uniform float uOpacity;
varying vec2 vUv;
varying float vLife;
varying float vLampK;
void main() {
  float d = length(vUv);
  float ring = smoothstep(0.62, 0.88, d) * (1.0 - smoothstep(0.88, 1.0, d));
  float dotc = (1.0 - smoothstep(0.0, 0.3, d)) * (1.0 - smoothstep(0.0, 0.1, vLife));
  float a = uOpacity * (ring * pow(1.0 - vLife, 1.5) + dotc * 1.6);
  vec3 col = vec3(0.62, 0.72, 0.95) * 1.2 + vec3(1.0, 0.62, 0.3) * vLampK * 2.0;
  gl_FragColor = vec4(col, a);
}`;

/** Rain ripples and tiny impact flashes on the wet ground, in the rectangle [x0, x1] × [z0, z1]. */
export const Splashes: React.FC<{ t: number; x0: number; x1: number; z0: number; z1: number; count?: number; seed?: number; size?: number; opacity?: number; lamp?: number }> = ({
  t,
  x0,
  x1,
  z0,
  z1,
  count = 260,
  seed = 9,
  size = 0.16,
  opacity = 0.32,
  lamp = 1,
}) => {
  const geo = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry();
    g.setIndex([0, 1, 2, 2, 1, 3]);
    g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3));
    const rnd = mulberry(seed);
    const a = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      a[i * 4] = x0 + rnd() * (x1 - x0);
      a[i * 4 + 1] = z0 + rnd() * (z1 - z0);
      a[i * 4 + 2] = rnd();
      a[i * 4 + 3] = size * (0.6 + rnd() * 0.8);
    }
    g.setAttribute("aSplash", new THREE.InstancedBufferAttribute(a, 4));
    g.instanceCount = count;
    return g;
  }, [x0, x1, z0, z1, count, seed, size]);
  const mat = useMemo(
    () =>
      additive(
        new THREE.ShaderMaterial({
          vertexShader: SPLASH_VERT,
          fragmentShader: SPLASH_FRAG,
          side: THREE.DoubleSide,
          uniforms: { uTime: { value: 0 }, uRate: { value: 1.6 }, uLampPos: { value: new THREE.Vector3(...LAMP_HEAD) }, uLamp: { value: 1 }, uOpacity: { value: 0.3 } },
        }),
      ),
    [],
  );
  mat.uniforms.uTime.value = t;
  mat.uniforms.uLamp.value = lamp;
  mat.uniforms.uOpacity.value = opacity;
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={2} />;
};

const mistMat = once(() => additive(new THREE.SpriteMaterial({ map: mistTex(), color: "#6F84C0", toneMapped: false, fog: false })));
/** Low mist drifting over the street: soft sprites in the box [x0, x1] × [z0, z1] (a few warm near the lamp). */
export const Mist: React.FC<{ t: number; x0: number; x1: number; z0: number; z1: number; count?: number; opacity?: number; y?: number; seed?: number }> = ({
  t,
  x0,
  x1,
  z0,
  z1,
  count = 14,
  opacity = 0.16,
  y = 0.5,
  seed = 13,
}) => {
  const spots = useMemo(() => {
    const rnd = mulberry(seed);
    return Array.from({ length: count }, () => ({ x: rnd(), z: z0 + rnd() * (z1 - z0), s: 5 + rnd() * 8, v: 0.12 + rnd() * 0.2, y: y + rnd() * 1.2, o: 0.6 + rnd() * 0.4 }));
  }, [count, seed, z0, z1, y]);
  const m = mistMat();
  m.opacity = opacity;
  const w = x1 - x0;
  return (
    <group>
      {spots.map((p, i) => {
        const x = x0 + ((((p.x * w + t * p.v) % w) + w) % w);
        return <sprite key={i} material={m} position={[x, p.y, p.z]} scale={[p.s * 1.8, p.s * 0.55 * p.o, 1]} renderOrder={3} />;
      })}
    </group>
  );
};

// =======================================================================================
// Nubi's flashlight in a fin, aimed at a world point

/** Nubi's placement (the props of <Nubi>) for fin and torch maths. */
export type NubiAt = { position: V3; rotationY: number; size: number; pose: NubiPose };
const FIN_PIVOT: V3 = [4.8, 5.0, 0.3];
const _a = new THREE.Matrix4();
const _b = new THREE.Matrix4();

/** World matrix of the hold point at the tip of a fin (side "R" = finR, "L" = finL). */
export const finHoldMatrix = (n: NubiAt, side: "R" | "L") => {
  const s = n.size / 10;
  const p = n.pose;
  const sq = Math.max(0.3, p.squash ?? 1);
  const sx = 1 / Math.sqrt(sq);
  const m = new THREE.Matrix4().compose(_v.set(...n.position), _q.setFromEuler(_e.set(0, n.rotationY, 0)), _s.set(s, s, s));
  m.multiply(_a.makeTranslation(0, p.hop ?? 0, 0));
  m.multiply(_a.makeRotationFromEuler(_e.set(p.pitch ?? 0, p.yaw ?? 0, p.roll ?? 0)));
  m.multiply(_a.makeScale(sx, sq, sx));
  if (side === "L") m.multiply(_a.makeScale(-1, 1, 1));
  m.multiply(_a.makeTranslation(...FIN_PIVOT));
  m.multiply(_b.makeRotationFromEuler(_e.set(0, -0.12, (side === "R" ? (p.finR ?? 0) : (p.finL ?? 0)) * 0.55)));
  m.multiply(_a.makeTranslation(...NUBI_FIN_TIP));
  if (side === "L") m.multiply(_a.makeScale(-1, 1, 1));
  return m;
};

/** Local rotation (inside the fin's hold group) that points the torch's +Z at `target`, and the lens position. */
export const torchAim = (n: NubiAt, side: "R" | "L", target: V3) => {
  const M = finHoldMatrix(n, side);
  const pos = new THREE.Vector3();
  const rot = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  M.decompose(pos, rot, scl);
  const dWorld = new THREE.Vector3(target[0] - pos.x, target[1] - pos.y, target[2] - pos.z).normalize();
  const dLocal = dWorld.clone().applyQuaternion(rot.clone().invert());
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dLocal);
  const lens = pos.clone().addScaledVector(dWorld, 0.43);
  return { q, grip: [pos.x, pos.y, pos.z] as V3, lens: [lens.x, lens.y, lens.z] as V3, dir: [dWorld.x, dWorld.y, dWorld.z] as V3 };
};

const BEAM_VERT = /* glsl */ `
varying float vT;
varying vec3 vN;
varying vec3 vView;
varying float vAxis;
void main() {
  vT = uv.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = normalize(-mv.xyz);
  vN = normalize(normalMatrix * normal);
  vec3 axis = normalize((modelViewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  vAxis = abs(dot(axis, vView));
  gl_Position = projectionMatrix * mv;
}`;
const BEAM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vT;
varying vec3 vN;
varying vec3 vView;
varying float vAxis;
void main() {
  float rim = pow(abs(dot(normalize(vN), normalize(vView))), 1.2);
  float thick = max(rim, vAxis * 0.8);
  float along = pow(vT, 1.7);
  gl_FragColor = vec4(uColor, uOpacity * along * thick);
}`;

/**
 * A visible torch beam that also reads when seen along its axis (from behind the torch, where the
 * shared Flashlight's beam fades out): a soft additive cone from the lens along +Z.
 */
export const BeamCone: React.FC<{ reach: number; angle: number; opacity: number; color?: string }> = ({ reach, angle, opacity, color = "#FFE2A8" }) => {
  const geo = useMemo(() => new THREE.ConeGeometry(Math.tan(angle) * reach, reach, 40, 1, true), [angle, reach]);
  const mat = useMemo(
    () =>
      additive(
        new THREE.ShaderMaterial({
          vertexShader: BEAM_VERT,
          fragmentShader: BEAM_FRAG,
          uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
          side: THREE.DoubleSide,
        }),
      ),
    [color, opacity],
  );
  mat.uniforms.uOpacity.value = opacity;
  if (opacity <= 0.004) return null;
  return <mesh geometry={geo} material={mat} position={[0, 0, 0.43 + reach / 2]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5} />;
};

const torchPropMats = once(() => ({
  body: new THREE.MeshStandardMaterial({ color: "#2B2F3A", roughness: 0.5, metalness: 0.4 }),
  lens: new THREE.MeshBasicMaterial({ color: "#FFE9B8", toneMapped: false }),
}));

/**
 * Nubi's flashlight held in a fin (pass as holdR / holdL), pointing at `target`. In the mirrored
 * copy (`mirror`), a light-less stand-in (torch + glowing lens) so the lights aren't doubled.
 */
export const HeldTorch: React.FC<{
  nubi: NubiAt;
  side: "R" | "L";
  target: V3;
  on: number;
  reach?: number;
  angle?: number;
  intensity?: number;
  beam?: number;
  mirror?: boolean;
  /** Opacity of the extra all-angle beam (see BeamCone). */
  haze?: number;
}> = ({ nubi, side, target, on, reach = 12, angle = 0.3, intensity = 60, beam = 0.22, mirror = false, haze = 0 }) => {
  const { q } = torchAim(nubi, side, target);
  const k = 10 / nubi.size;
  if (mirror) {
    const m = torchPropMats();
    return (
      <group quaternion={q} scale={k}>
        <mesh material={m.body} position={[0, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.055, 0.42, 12]} />
        </mesh>
        <Glow color="#FFE2A8" size={0.9} opacity={0.6 * on} position={[0, 0, 0.45]} />
      </group>
    );
  }
  return (
    <group quaternion={q} scale={k}>
      <Flashlight on={on} reach={reach} angle={angle} intensity={intensity} beam={beam} />
      <BeamCone reach={reach} angle={angle * 0.9} opacity={haze * on} />
    </group>
  );
};
