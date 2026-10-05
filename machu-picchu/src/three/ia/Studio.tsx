import React, { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rand } from "../../anim";
import { PottedPlant } from "../dino/Props";
import { V3, canvasTexture, paintGeo, toy, vertexMat } from "../inca/kit";
import { NUBI_FIN_TIP, Nubi, NubiPalette, NubiPose } from "../Nubi";
import { Text3D, LOOKS } from "../Text3D";
import { Glow, SparkBurst } from "../thanos/FX";
import { Stage } from "../../scenes/common";
import type { Vec3 } from "../CameraRig";

// Sets of the "¿Qué pasaría si la IA no existiera?" short (agent "studio"):
//  - Nubi's creator studio: a warm, colourful room with a desk (glowing monitor, keyboard, lamp),
//    shelves of books with fairy lights, a tall bookcase, acoustic panels and a neon "play" sign, a
//    ring light and a camera on a tripod in the foreground, plants, a round rug — and on the wall
//    beside Nubi the big IA SWITCH: a chunky breaker with an "IA" plate, a lever and two lamps
//    (ON green / OFF red). Everything that glows is driven by a PowerState, so the studio can power
//    down (and back up) in a cascade; the lights keep a dim blue fill when it is off.
//  - The influencer: a gold Nubi with big black sunglasses that it can lower.
//  - The "luxury" photo set: a glossy red toy sports car on a road-painted board on a stool, a
//    printed sunset poster with palm trees on stands (a friend holds it), a phone on a tripod, in
//    an ordinary parking lot.
//
// World units are sized for Nubi at size 2 (2 wide, 2 tall); the floor is y = 0 and +z points out
// of the back wall towards the camera. Everything is deterministic (`t` in seconds).

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

const rbox = (w: number, h: number, d: number, r: number, seg = 3) =>
  new RoundedBoxGeometry(w, h, d, seg, Math.max(0.001, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)));

const worldPlane = (w: number, h: number) => {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  return g;
};

const texMatCache = new Map<string, THREE.MeshStandardMaterial>();
const texMat = (key: string, tex: THREE.Texture, o: { rough?: number; glow?: number; metal?: number } = {}) => {
  let m = texMatCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: o.rough ?? 0.7,
      metalness: o.metal ?? 0,
      emissive: new THREE.Color("#ffffff"),
      emissiveMap: tex,
      emissiveIntensity: o.glow ?? 0.06,
    });
    texMatCache.set(key, m);
  }
  return m;
};

const repeat = (tex: THREE.Texture, rx: number, ry: number) => {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  return tex;
};

// =======================================================================================
// Layout

/** The studio: back wall at z = wallZ (x0..x1), floor y = 0. */
export const STUDIO = { x0: -7, x1: 7, wallZ: -1.3, height: 7 };
/** Where Nubi stands talking (centre of the studio, in front of the acoustic panels). */
export const NUBI_SPOT: V3 = [0, 0, -0.2];
/** The IA switch: plate centre on the wall, the lever's pivot and arm length. */
export const SWITCH = {
  x: 1.75,
  plateY: 1.3,
  pivot: [1.75, 1.15, STUDIO.wallZ + 0.36] as V3,
  arm: 0.42,
  /** Lever angle (radians above horizontal) at ON / OFF. */
  on: 0.6,
  off: -0.62,
};
/** World position of the lever's handle at angle `a`. */
export const leverHandle = (a: number): V3 => [SWITCH.pivot[0], SWITCH.pivot[1] + SWITCH.arm * Math.sin(a), SWITCH.pivot[2] + SWITCH.arm * Math.cos(a)];
/** Lever angle for `on` 0 (OFF) .. 1 (ON). */
export const leverAngle = (on: number) => lerp(SWITCH.off, SWITCH.on, on);

/** Desk with the computer (left of Nubi), and the tripod camera / ring light in the foreground. */
const DESK = { x0: -3.9, x1: -1.55, z0: STUDIO.wallZ, z1: STUDIO.wallZ + 0.85, top: 0.84 };
export const MONITOR: V3 = [-2.75, 1.42, STUDIO.wallZ + 0.32];
const LAMP: V3 = [-1.85, DESK.top, STUDIO.wallZ + 0.35];
export const RING: V3 = [-2.15, 0, 1.05];
export const TRIPOD: V3 = [-1.25, 0, 1.9];
const BOOKCASE = { x0: 2.75, x1: 4.15, top: 3.3 };

// ---- Fin tip of a size-2 Nubi (same model numbers as Nubi.tsx), used to put its fin on the lever.
const FIN_PIVOT = new THREE.Vector3(4.8, 5.0, 0.3);
const tipLocal = (raise: number) => new THREE.Vector3(...NUBI_FIN_TIP).applyEuler(new THREE.Euler(0, -0.12, raise * 0.55)).add(FIN_PIVOT);
/** World offset (from Nubi's feet) of the screen-right fin tip: raise, body yaw, squash, hop (model units). */
export const finTipR = (raise: number, yaw = 0, squash = 1, hop = 0): V3 => {
  const v = tipLocal(raise);
  const sq = Math.max(0.3, squash);
  const sx = 1 / Math.sqrt(sq);
  v.set(v.x * sx, v.y * sq + hop, v.z * sx).multiplyScalar(0.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  return [v.x, v.y, v.z];
};
/** Fin raise that puts the screen-right fin tip at height `y` (world) for Nubi's feet at `feetY`. */
export const raiseToReach = (y: number, feetY: number, yaw = 0, squash = 1, hop = 0) => {
  let lo = -0.6;
  let hi = 3.1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (feetY + finTipR(mid, yaw, squash, hop)[1] < y) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};
/** Nubi beside the switch: turned towards it, the screen-right fin on the handle. */
export const REACH_YAW = 0.42;
const reachTip = finTipR(raiseToReach(leverHandle(SWITCH.on)[1], 0, REACH_YAW), REACH_YAW);
const HANDLE_ON = leverHandle(SWITCH.on);
export const NUBI_AT_SWITCH: V3 = [HANDLE_ON[0] - reachTip[0] - 0.05, 0, HANDLE_ON[2] - reachTip[2] + 0.05];

// =======================================================================================
// Power: what glows. 1 = on, 0 = off (with a flicker while switching).

export type PowerState = { monitor: number; ring: number; lamps: number; main: number; led: number };
export const POWER_ON: PowerState = { monitor: 1, ring: 1, lamps: 1, main: 1, led: 1 };
export const POWER_OFF: PowerState = { monitor: 0, ring: 0, lamps: 0, main: 0, led: 0 };

/** One light dying at `at` (a short stutter first) or coming on at `at` (flickers, then steady). */
const flick = (g: number, at: number, dir: "off" | "on", seed: number) => {
  const d = g - at;
  if (dir === "off") {
    if (d < 0) return 1;
    if (d >= 5) return 0;
    return rand(Math.floor(g) * 3.7 + seed) > 0.45 + d * 0.1 ? 0.9 : 0.12;
  }
  if (d < 0) return 0;
  if (d >= 6) return 1;
  return rand(Math.floor(g) * 5.3 + seed) > 0.5 - d * 0.08 ? 1 : 0.15;
};

/** Studio power at frame g: everything goes off in a cascade from `offAt` and comes back from `onAt`. */
export const studioPower = (g: number, offAt?: number, onAt?: number): PowerState => {
  const ch = (dOff: number, dOn: number, seed: number) => {
    if (onAt !== undefined && g >= onAt + dOn) return flick(g, onAt + dOn, "on", seed + 9);
    if (offAt !== undefined) return flick(g, offAt + dOff, "off", seed);
    return onAt !== undefined ? 0 : 1;
  };
  const led = onAt !== undefined && g >= onAt ? 1 : offAt !== undefined ? (g >= offAt ? 0 : 1) : onAt !== undefined ? 0 : 1;
  return { monitor: ch(1, 11, 1), ring: ch(4, 8, 2), lamps: ch(7, 5, 3), main: ch(10, 2, 4), led };
};

// =======================================================================================
// Textures

const floorTex = () =>
  canvasTexture("ia-floor", 512, 512, (ctx, w, h) => {
    const rows = 8;
    for (let r = 0; r < rows; r++) {
      const y = (r * h) / rows;
      const off = (r % 2) * 0.5;
      for (let k = -1; k < 3; k++) {
        const x = (k + off) * (w / 2);
        const tone = 0.85 + 0.15 * rand(r * 7 + k * 3);
        ctx.fillStyle = `rgb(${Math.round(222 * tone)},${Math.round(160 * tone)},${Math.round(104 * tone)})`;
        ctx.fillRect(x, y, w / 2, h / rows);
        ctx.fillStyle = "rgba(120,70,30,0.12)";
        for (let s = 0; s < 6; s++) ctx.fillRect(x, y + (h / rows) * (0.15 + 0.13 * s), w / 2, 1.5);
        ctx.fillStyle = "rgba(90,50,20,0.55)";
        ctx.fillRect(x, y, 3, h / rows);
      }
      ctx.fillStyle = "rgba(90,50,20,0.6)";
      ctx.fillRect(0, y, w, 3);
    }
  });

const rugTex = () =>
  canvasTexture("ia-rug", 512, 512, (ctx, w) => {
    const cols = ["#FF8FA3", "#FFD166", "#8EDCA2", "#7FC8F8", "#C3A6FF", "#FFF4E0"];
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = cols[i];
      ctx.beginPath();
      ctx.arc(w / 2, w / 2, (w / 2) * (1 - i * 0.16), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 12]);
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(w / 2, w / 2, (w / 2) * (1 - i * 0.16) - 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

const screenTex = () =>
  canvasTexture("ia-screen", 512, 320, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#2B3A78");
    g.addColorStop(1, "#18204A");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Preview window with a green Nubi.
    ctx.fillStyle = "#FFE3C9";
    ctx.fillRect(24, 22, 270, 170);
    ctx.fillStyle = "#8EDCA2";
    ctx.beginPath();
    ctx.roundRect(110, 62, 100, 86, 16);
    ctx.fill();
    ctx.fillStyle = "#151515";
    ctx.fillRect(135, 92, 12, 22);
    ctx.fillRect(172, 92, 12, 22);
    // Chat panel with bubbles.
    ctx.fillStyle = "#222C5C";
    ctx.fillRect(312, 22, 176, 170);
    const bubbles: [number, number, number, string][] = [
      [324, 36, 110, "#7FC8F8"],
      [354, 72, 120, "#FFD166"],
      [324, 108, 130, "#7FC8F8"],
      [374, 146, 100, "#FF8FA3"],
    ];
    for (const [x, y, bw, c] of bubbles) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.roundRect(x, y, bw, 26, 12);
      ctx.fill();
    }
    // Timeline with coloured clips.
    ctx.fillStyle = "#121733";
    ctx.fillRect(24, 210, 464, 90);
    const clips = ["#FF8FA3", "#8EDCA2", "#FFD166", "#C3A6FF", "#7FC8F8"];
    let x = 30;
    for (let i = 0; i < 9; i++) {
      const cw = 30 + rand(i * 3.1) * 50;
      ctx.fillStyle = clips[i % clips.length];
      ctx.fillRect(x, 220 + (i % 2) * 36, cw, 28);
      x += cw + 8;
      if (x > 470) break;
    }
    ctx.fillStyle = "#FF4B3E";
    ctx.fillRect(210, 212, 4, 86);
  });

/** The printed "luxury" backdrop: a sunset over the sea with palm trees. */
export const sunsetTex = () =>
  canvasTexture("ia-sunset", 512, 640, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.68);
    sky.addColorStop(0, "#5B2A86");
    sky.addColorStop(0.35, "#D9467A");
    sky.addColorStop(0.7, "#FF8A3D");
    sky.addColorStop(1, "#FFD36B");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    // Sun.
    const sunY = h * 0.6;
    const sg = ctx.createRadialGradient(w * 0.55, sunY, 10, w * 0.55, sunY, 170);
    sg.addColorStop(0, "rgba(255,250,210,1)");
    sg.addColorStop(0.35, "rgba(255,220,120,0.9)");
    sg.addColorStop(1, "rgba(255,160,80,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#FFF3B8";
    ctx.beginPath();
    ctx.arc(w * 0.55, sunY, 62, 0, Math.PI * 2);
    ctx.fill();
    // Sea with sun glints.
    const sea = ctx.createLinearGradient(0, h * 0.66, 0, h);
    sea.addColorStop(0, "#E0637A");
    sea.addColorStop(1, "#3B2466");
    ctx.fillStyle = sea;
    ctx.fillRect(0, h * 0.66, w, h * 0.34);
    ctx.fillStyle = "rgba(255,230,160,0.8)";
    for (let i = 0; i < 14; i++) {
      const y = h * 0.68 + i * 13;
      const ww = 120 - i * 7;
      ctx.fillRect(w * 0.55 - ww / 2 + Math.sin(i * 2.1) * 10, y, ww, 4);
    }
    // Palm trees (silhouettes).
    const palm = (x: number, base: number, hgt: number, lean: number) => {
      ctx.strokeStyle = "#2A1037";
      ctx.lineCap = "round";
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(x, base);
      ctx.quadraticCurveTo(x + lean * 0.4, base - hgt * 0.6, x + lean, base - hgt);
      ctx.stroke();
      const tx = x + lean;
      const ty = base - hgt;
      ctx.fillStyle = "#2A1037";
      for (let k = 0; k < 7; k++) {
        const a = -Math.PI + (k / 6) * Math.PI + (k % 2 ? 0.2 : -0.1);
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo(tx + Math.cos(a) * 70, ty + Math.sin(a) * 50 - 25, tx + Math.cos(a) * 120, ty + Math.sin(a) * 40 + 35);
        ctx.quadraticCurveTo(tx + Math.cos(a) * 60, ty + Math.sin(a) * 30 - 2, tx, ty + 6);
        ctx.fill();
      }
    };
    palm(60, h, 470, 70);
    palm(470, h, 400, -60);
    palm(400, h, 250, -30);
  });

const asphaltTex = () =>
  canvasTexture("ia-asphalt", 256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#8C8F94";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) {
      const v = 110 + Math.floor(rand(i * 1.7) * 70);
      ctx.fillStyle = `rgba(${v},${v},${v + 4},0.5)`;
      ctx.fillRect(rand(i * 3.3) * w, rand(i * 5.9) * h, 2, 2);
    }
  });

const roadBoardTex = () =>
  canvasTexture("ia-roadboard", 512, 256, (ctx, w, h) => {
    ctx.fillStyle = "#3A3D44";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.05 + rand(i) * 0.06})`;
      ctx.fillRect(rand(i * 2.3) * w, rand(i * 4.1) * h, 2, 2);
    }
    ctx.fillStyle = "#FFD23F";
    for (let x = 10; x < w; x += 90) ctx.fillRect(x, h / 2 - 6, 50, 12);
    ctx.fillStyle = "#F4F4F4";
    ctx.fillRect(0, 14, w, 8);
    ctx.fillRect(0, h - 22, w, 8);
    // Light-brown wooden edge (it is a board).
    ctx.fillStyle = "#C79A62";
    ctx.fillRect(0, 0, w, 6);
    ctx.fillRect(0, h - 6, w, 6);
  });

// =======================================================================================
// Studio pieces

/** Books on a shelf: one merged, vertex-coloured mesh. Row from x0 to x1 standing on y = 0. */
const BOOK_COLS = ["#FF6B6B", "#FFD166", "#06D6A0", "#4D96FF", "#C77DFF", "#FF9F1C", "#F15BB5", "#2EC4B6", "#F7F7F7"];
const useBooks = (x0: number, x1: number, seed: number, maxH = 0.42, depth = 0.26) =>
  useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    let x = x0;
    let i = 0;
    while (x < x1 - 0.05) {
      const w = 0.05 + rand(seed + i * 1.3) * 0.06;
      const hh = maxH * (0.62 + rand(seed + i * 2.7) * 0.38);
      if (rand(seed + i * 5.1) < 0.08 && x + hh < x1) {
        // A book lying flat.
        const b = new THREE.BoxGeometry(hh, w, depth * 0.9);
        b.translate(x + hh / 2, w / 2, 0);
        parts.push(paintGeo(b, BOOK_COLS[i % BOOK_COLS.length]));
        x += hh + 0.02;
      } else {
        const b = new THREE.BoxGeometry(w, hh, depth * (0.8 + rand(seed + i) * 0.2));
        const tilt = rand(seed + i * 9.1) < 0.1 ? 0.18 : 0;
        b.rotateZ(-tilt);
        b.translate(x + w / 2 + tilt * hh * 0.5, hh / 2, 0);
        parts.push(paintGeo(b, BOOK_COLS[Math.floor(rand(seed + i * 3.3) * BOOK_COLS.length)]));
        x += w + 0.008 + tilt * hh * 0.6;
      }
      i++;
    }
    return mergeGeometries(parts.map((p) => p.toNonIndexed()));
  }, [x0, x1, seed, maxH, depth]);

const Books: React.FC<{ x0: number; x1: number; seed: number; position: V3; maxH?: number }> = ({ x0, x1, seed, position, maxH }) => {
  const geo = useBooks(x0, x1, seed, maxH);
  return <mesh geometry={geo} material={vertexMat(0.65, false, 0.16)} position={position} />;
};

/** Fairy lights along a sagging wire from a to b. */
const FairyLights: React.FC<{ a: V3; b: V3; n: number; sag: number; on: number; t: number }> = ({ a, b, n, sag, on, t }) => {
  const geo = useMemo(() => new THREE.SphereGeometry(0.045, 10, 8), []);
  const cols = ["#FFD166", "#FF8FA3", "#8EDCA2", "#7FC8F8"];
  const mats = useMemo(() => cols.map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: new THREE.Color(c), emissiveIntensity: 1, toneMapped: false })), []); // eslint-disable-line react-hooks/exhaustive-deps
  const wire = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const k = i / 24;
      pts.push(new THREE.Vector3(lerp(a[0], b[0], k), lerp(a[1], b[1], k) - sag * 4 * k * (1 - k), lerp(a[2], b[2], k)));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.008, 4, false);
  }, [a, b, sag]);
  mats.forEach((m, i) => {
    const tw = 0.85 + 0.15 * Math.sin(t * 3 + i * 1.7);
    m.emissiveIntensity = 0.06 + 1.4 * on * tw;
    m.color.set(cols[i]).multiplyScalar(0.35 + 0.65 * on);
  });
  return (
    <group>
      <mesh geometry={wire} material={toy("#3A3A3A", { glow: 0.02 })} />
      {Array.from({ length: n }).map((_, i) => {
        const k = (i + 0.5) / n;
        return (
          <mesh
            key={i}
            geometry={geo}
            material={mats[i % mats.length]}
            position={[lerp(a[0], b[0], k), lerp(a[1], b[1], k) - sag * 4 * k * (1 - k) - 0.05, lerp(a[2], b[2], k)]}
          />
        );
      })}
    </group>
  );
};

/** Neon "play" sign: a rounded frame with a triangle (pink tube). */
const NeonPlay: React.FC<{ on: number; position: V3 }> = ({ on, position }) => {
  const geos = useMemo(() => {
    const frame: THREE.Vector3[] = [];
    const W = 0.62;
    const H = 0.42;
    const r = 0.12;
    const corners: [number, number, number][] = [
      [W - r, H - r, 0],
      [-W + r, H - r, Math.PI / 2],
      [-W + r, -H + r, Math.PI],
      [W - r, -H + r, (3 * Math.PI) / 2],
    ];
    for (const [cx, cy, a0] of corners) for (let k = 0; k <= 6; k++) frame.push(new THREE.Vector3(cx + r * Math.cos(a0 + (k / 6) * (Math.PI / 2)), cy + r * Math.sin(a0 + (k / 6) * (Math.PI / 2)), 0));
    const tri = [new THREE.Vector3(-0.14, 0.2, 0), new THREE.Vector3(0.22, 0, 0), new THREE.Vector3(-0.14, -0.2, 0)];
    return {
      frame: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(frame, true, "catmullrom", 0.1), 80, 0.03, 6, true),
      tri: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tri, true, "catmullrom", 0.05), 30, 0.03, 6, true),
    };
  }, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#FF5FA2", emissive: new THREE.Color("#FF5FA2"), toneMapped: false }), []);
  const mat2 = useMemo(() => new THREE.MeshStandardMaterial({ color: "#7FF0FF", emissive: new THREE.Color("#7FF0FF"), toneMapped: false }), []);
  mat.emissiveIntensity = 0.05 + 1.6 * on;
  mat2.emissiveIntensity = 0.05 + 1.6 * on;
  mat.color.set("#FF5FA2").multiplyScalar(0.3 + 0.7 * on);
  mat2.color.set("#7FF0FF").multiplyScalar(0.3 + 0.7 * on);
  return (
    <group position={position}>
      <mesh geometry={geos.frame} material={mat} />
      <mesh geometry={geos.tri} material={mat2} />
      <Glow color="#FF5FA2" size={2.0} opacity={0.35 * on} position={[0, 0, 0.1]} />
    </group>
  );
};

/** Computer monitor with a glowing screen. */
const Monitor: React.FC<{ on: number }> = ({ on }) => {
  const geos = useMemo(
    () => ({
      frame: rbox(1.22, 0.78, 0.07, 0.04),
      screen: new THREE.PlaneGeometry(1.12, 0.68),
      neck: new THREE.BoxGeometry(0.08, 0.36, 0.06),
      foot: rbox(0.42, 0.04, 0.26, 0.02),
    }),
    [],
  );
  const screen = useMemo(() => {
    const tex = screenTex();
    return new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color("#ffffff"), roughness: 0.25, toneMapped: false });
  }, []);
  screen.color.setScalar(0.04 + 0.5 * on);
  screen.emissiveIntensity = 1.05 * on;
  return (
    <group position={MONITOR}>
      <mesh geometry={geos.frame} material={toy("#2B2D35", { rough: 0.4, glow: 0.05 })} />
      <mesh geometry={geos.screen} material={screen} position={[0, 0, 0.037]} />
      <mesh geometry={geos.neck} material={toy("#C9CED8", { metal: 0.3, rough: 0.35 })} position={[0, -0.5, -0.06]} />
      <mesh geometry={geos.foot} material={toy("#C9CED8", { metal: 0.3, rough: 0.35 })} position={[0, MONITOR[1] * -1 + DESK.top + 0.02, 0]} />
      <Glow color="#7FA8FF" size={2.2} opacity={0.32 * on} position={[0, 0, 0.12]} />
    </group>
  );
};

const Desk: React.FC<{ power: PowerState; t: number }> = ({ power }) => {
  const W = DESK.x1 - DESK.x0;
  const D = DESK.z1 - DESK.z0;
  const geos = useMemo(
    () => ({
      top: rbox(W, 0.07, D, 0.025),
      leg: new THREE.BoxGeometry(0.07, DESK.top, 0.07),
      drawer: rbox(0.6, 0.5, D - 0.06, 0.03),
      kb: rbox(0.8, 0.04, 0.24, 0.015),
      mug: new THREE.CylinderGeometry(0.07, 0.065, 0.16, 18),
      shade: new THREE.ConeGeometry(0.17, 0.2, 20, 1, true),
      arm: new THREE.CylinderGeometry(0.018, 0.018, 0.5, 8),
      base: new THREE.CylinderGeometry(0.11, 0.12, 0.04, 18),
      bulb: new THREE.SphereGeometry(0.06, 12, 10),
    }),
    [W, D],
  );
  const bulb = useMemo(() => new THREE.MeshStandardMaterial({ color: "#FFF2C8", emissive: new THREE.Color("#FFD27A"), toneMapped: false }), []);
  bulb.emissiveIntensity = 0.05 + 2 * power.lamps;
  const cx = (DESK.x0 + DESK.x1) / 2;
  const cz = (DESK.z0 + DESK.z1) / 2;
  return (
    <group>
      <mesh geometry={geos.top} material={toy("#F2F2EE", { rough: 0.45, glow: 0.08 })} position={[cx, DESK.top - 0.035, cz]} />
      {[
        [DESK.x0 + 0.08, DESK.z1 - 0.08],
        [DESK.x1 - 0.08, DESK.z1 - 0.08],
        [DESK.x1 - 0.08, DESK.z0 + 0.08],
      ].map(([x, z], i) => (
        <mesh key={i} geometry={geos.leg} material={toy("#E0B07A")} position={[x, DESK.top / 2 - 0.035, z]} />
      ))}
      <mesh geometry={geos.drawer} material={toy("#FFB4A2", { glow: 0.1 })} position={[DESK.x0 + 0.4, DESK.top - 0.32, cz]} />
      <Monitor on={power.monitor} />
      <mesh geometry={geos.kb} material={toy("#E9ECF2", { rough: 0.4 })} position={[MONITOR[0], DESK.top + 0.02, DESK.z1 - 0.22]} />
      <mesh geometry={geos.mug} material={toy("#FFD166", { glow: 0.12 })} position={[MONITOR[0] - 0.85, DESK.top + 0.08, DESK.z1 - 0.25]} />
      {/* Desk lamp. */}
      <group position={LAMP}>
        <mesh geometry={geos.base} material={toy("#4D96FF")} position={[0, 0.02, 0]} />
        <mesh geometry={geos.arm} material={toy("#4D96FF")} position={[0, 0.27, 0]} />
        <group position={[-0.08, 0.55, 0.04]} rotation={[0.2, 0, 0.6]}>
          <mesh geometry={geos.shade} material={toy("#4D96FF", { side: THREE.DoubleSide })} />
          <mesh geometry={geos.bulb} material={bulb} position={[0, -0.08, 0]} />
        </group>
        <Glow color="#FFC870" size={1.3} opacity={0.5 * power.lamps} position={[-0.15, 0.42, 0.1]} />
      </group>
    </group>
  );
};

/** Ring light on a stand, turned towards Nubi. */
const RingLight: React.FC<{ on: number; position: V3; yaw: number }> = ({ on, position, yaw }) => {
  const geos = useMemo(
    () => ({
      ring: new THREE.TorusGeometry(0.36, 0.055, 12, 48),
      pole: new THREE.CylinderGeometry(0.022, 0.022, 1.75, 8),
      leg: new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6),
      hub: new THREE.CylinderGeometry(0.05, 0.05, 0.1, 10),
    }),
    [],
  );
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#FFFFFF", emissive: new THREE.Color("#FFF6EA"), toneMapped: false, roughness: 0.4 }), []);
  mat.emissiveIntensity = 0.02 + 1.3 * on;
  mat.color.setScalar(0.35 + 0.65 * on);
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} geometry={geos.leg} material={toy("#2B2D35")} position={[0.18 * Math.sin((i * 2 * Math.PI) / 3), 0.25, 0.18 * Math.cos((i * 2 * Math.PI) / 3)]} rotation={[0.6 * Math.cos((i * 2 * Math.PI) / 3), 0, -0.6 * Math.sin((i * 2 * Math.PI) / 3)]} />
      ))}
      <mesh geometry={geos.pole} material={toy("#2B2D35")} position={[0, 0.95, 0]} />
      <group position={[0, 1.95, 0]}>
        <mesh geometry={geos.ring} material={mat} />
        <mesh geometry={geos.hub} material={toy("#2B2D35")} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.36, 0]} />
        <Glow color="#FFF2DE" size={1.6} opacity={0.45 * on} position={[0, 0, 0.15]} />
      </group>
    </group>
  );
};

/** Camera on a tripod (we see its back: a little screen and a red REC light). */
const TripodCamera: React.FC<{ on: number; position: V3; yaw: number; t: number }> = ({ on, position, yaw, t }) => {
  const geos = useMemo(
    () => ({
      leg: new THREE.CylinderGeometry(0.022, 0.016, 1.45, 6),
      body: rbox(0.46, 0.3, 0.26, 0.05),
      lens: new THREE.CylinderGeometry(0.1, 0.11, 0.24, 18),
      glass: new THREE.CircleGeometry(0.085, 18),
      screen: new THREE.PlaneGeometry(0.3, 0.19),
      rec: new THREE.SphereGeometry(0.025, 10, 8),
      head: new THREE.CylinderGeometry(0.06, 0.07, 0.1, 10),
    }),
    [],
  );
  const recOn = on * (Math.sin(t * 5) > -0.2 ? 1 : 0.2);
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      {[0, 1, 2].map((i) => {
        const a = (i * 2 * Math.PI) / 3 + 0.3;
        return <mesh key={i} geometry={geos.leg} material={toy("#30333C")} position={[0.24 * Math.sin(a), 0.68, 0.24 * Math.cos(a)]} rotation={[0.35 * Math.cos(a), 0, -0.35 * Math.sin(a)]} />;
      })}
      <mesh geometry={geos.head} material={toy("#30333C")} position={[0, 1.42, 0]} />
      <group position={[0, 1.62, 0]}>
        <mesh geometry={geos.body} material={toy("#24262E", { rough: 0.35 })} />
        <mesh geometry={geos.lens} material={toy("#1A1B20", { rough: 0.3 })} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.24]} />
        <mesh geometry={geos.glass} material={toy("#3A5BA8", { rough: 0.1, glow: 0.3 })} rotation={[0, Math.PI, 0]} position={[0, 0, -0.361]} />
        <mesh geometry={geos.screen} material={toy("#7FC8F8", { glow: 0.2 + 0.7 * on })} position={[0, 0, 0.131]} />
        <mesh geometry={geos.rec} material={toy(recOn > 0.5 ? "#FF2E2E" : "#5A1A1A", { glow: recOn > 0.5 ? 1.2 : 0.1 })} position={[0.17, 0.11, 0.13]} />
      </group>
    </group>
  );
};

/** Acoustic panels: a pastel grid of soft squares behind Nubi. */
const Panels: React.FC<{ position: V3 }> = ({ position }) => {
  const geo = useMemo(() => rbox(0.5, 0.5, 0.08, 0.1), []);
  const cols = ["#C3A6FF", "#7FC8F8", "#FF8FA3", "#FFD166", "#8EDCA2", "#C3A6FF"];
  return (
    <group position={position}>
      {[-1, 0, 1].flatMap((cx) =>
        [0, 1].map((cy) => <mesh key={`${cx}-${cy}`} geometry={geo} material={toy(cols[(cx + 1 + cy * 3) % cols.length], { glow: 0.16, rough: 0.9 })} position={[cx * 0.58, cy * 0.58, 0]} />),
      )}
    </group>
  );
};

// =======================================================================================
// The IA switch

/** The big IA breaker: plate with "IA", ON (green) and OFF (red) lamps, lever. `on` 0..1 = lever position. */
export const IaSwitch: React.FC<{ lever: number; led: number; t: number; jolt?: number }> = ({ lever, led, jolt = 0 }) => {
  const geos = useMemo(
    () => ({
      back: rbox(1.15, 1.62, 0.14, 0.08),
      plate: rbox(1.0, 1.46, 0.08, 0.07),
      stripe: new THREE.BoxGeometry(1.0, 0.07, 0.02),
      slot: rbox(0.2, 0.86, 0.05, 0.05),
      ear: rbox(0.08, 0.26, 0.26, 0.03),
      hub: new THREE.CylinderGeometry(0.1, 0.1, 0.34, 20),
      arm: rbox(0.1, 0.1, SWITCH.arm, 0.04),
      handle: new THREE.CapsuleGeometry(0.075, 0.38, 6, 14),
      lamp: new THREE.SphereGeometry(0.085, 16, 12),
      bezel: new THREE.TorusGeometry(0.09, 0.025, 8, 20),
      screw: new THREE.CylinderGeometry(0.03, 0.03, 0.02, 10),
    }),
    [],
  );
  const green = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2EE86A", emissive: new THREE.Color("#2EE86A"), toneMapped: false, roughness: 0.25 }), []);
  const red = useMemo(() => new THREE.MeshStandardMaterial({ color: "#FF3030", emissive: new THREE.Color("#FF3030"), toneMapped: false, roughness: 0.25 }), []);
  green.emissiveIntensity = 0.03 + 1.6 * led;
  green.color.set("#2EE86A").multiplyScalar(0.25 + 0.75 * led);
  red.emissiveIntensity = 0.03 + 1.6 * (1 - led);
  red.color.set("#FF3030").multiplyScalar(0.25 + 0.75 * (1 - led));
  const a = leverAngle(lever);
  const z0 = STUDIO.wallZ;
  const P = SWITCH.pivot;
  const lampX = SWITCH.x + 0.33;
  return (
    <group>
      <group position={[SWITCH.x, SWITCH.plateY, z0 + 0.07]} rotation={[0, 0, jolt * 0.04]}>
        <mesh geometry={geos.back} material={toy("#3C4358", { rough: 0.5, metal: 0.2, glow: 0.08 })} />
        <mesh geometry={geos.plate} material={toy("#F5D547", { rough: 0.45, glow: 0.18 })} position={[0, 0, 0.08]} />
        {/* Hazard stripes along the top and bottom of the plate. */}
        {[-0.66, 0.66].map((y) => (
          <mesh key={y} geometry={geos.stripe} material={toy("#24262E", { glow: 0.05 })} position={[0, y, 0.125]} />
        ))}
        <mesh geometry={geos.slot} material={toy("#24262E", { rough: 0.6 })} position={[-0.12, -0.1, 0.12]} />
        {[
          [-0.42, 0.6],
          [0.42, 0.6],
          [-0.42, -0.6],
          [0.42, -0.6],
        ].map(([x, y], i) => (
          <mesh key={i} geometry={geos.screw} material={toy("#C9CED8", { metal: 0.5, rough: 0.3 })} rotation={[Math.PI / 2, 0, 0]} position={[x, y, 0.13]} />
        ))}
        <Text3D text="IA" size={0.3} look={LOOKS.white} position={[0, 0.43, 0.15]} />
        <Text3D text="ON" size={0.13} look={LOOKS.green} position={[lampX - SWITCH.x, 0.12, 0.15]} />
        <Text3D text="OFF" size={0.11} look={LOOKS.red} position={[lampX - SWITCH.x, -0.52, 0.15]} />
      </group>
      {/* Lamps: ON (green, top), OFF (red, bottom). */}
      <group position={[lampX, SWITCH.plateY - 0.05, z0 + 0.22]}>
        <mesh geometry={geos.bezel} material={toy("#C9CED8", { metal: 0.5, rough: 0.3 })} />
        <mesh geometry={geos.lamp} material={green} />
        <Glow color="#2EE86A" size={0.9} opacity={0.75 * led} position={[0, 0, 0.08]} />
      </group>
      <group position={[lampX, SWITCH.plateY - 0.33, z0 + 0.22]}>
        <mesh geometry={geos.bezel} material={toy("#C9CED8", { metal: 0.5, rough: 0.3 })} />
        <mesh geometry={geos.lamp} material={red} />
        <Glow color="#FF3030" size={0.9} opacity={0.8 * (1 - led)} position={[0, 0, 0.08]} />
      </group>
      {/* Lever: ears, hub, arm and the red handle bar. */}
      {[-0.2, 0.2].map((dx) => (
        <mesh key={dx} geometry={geos.ear} material={toy("#3C4358", { metal: 0.2 })} position={[P[0] - 0.12 + dx, P[1], P[2] - 0.12]} />
      ))}
      <group position={[P[0] - 0.12, P[1], P[2]]} rotation={[-a, 0, 0]}>
        <mesh geometry={geos.hub} material={toy("#C9CED8", { metal: 0.5, rough: 0.3 })} rotation={[0, 0, Math.PI / 2]} />
        <mesh geometry={geos.arm} material={toy("#C9CED8", { metal: 0.5, rough: 0.3 })} position={[0, 0, SWITCH.arm / 2]} />
        <mesh geometry={geos.handle} material={toy("#FF3B3B", { rough: 0.3, glow: 0.2 })} rotation={[0, 0, Math.PI / 2]} position={[0.12, 0, SWITCH.arm]} />
      </group>
    </group>
  );
};

// =======================================================================================
// The studio set

export type StudioSetProps = {
  t?: number;
  power?: PowerState;
  /** Lever position 0 (OFF) .. 1 (ON). */
  lever?: number;
  /** Seconds since the lever hit (sparks), or < 0 for none. */
  sparks?: number;
  jolt?: number;
};

export const StudioSet: React.FC<StudioSetProps> = ({ t = 0, power = POWER_ON, lever = 1, sparks = -1, jolt = 0 }) => {
  const { x0, x1, wallZ, height: H } = STUDIO;
  const W = x1 - x0;
  const geos = useMemo(
    () => ({
      floor: worldPlane(W + 6, 16),
      wall: new THREE.PlaneGeometry(W, H),
      wains: new THREE.BoxGeometry(W, 0.9, 0.06),
      rail: new THREE.BoxGeometry(W, 0.06, 0.1),
      shelf: rbox(2.3, 0.06, 0.32, 0.02),
      bracket: new THREE.BoxGeometry(0.04, 0.16, 0.26),
      rug: new THREE.CircleGeometry(1.5, 48),
      caseSide: new THREE.BoxGeometry(0.07, BOOKCASE.top, 0.42),
      caseShelf: new THREE.BoxGeometry(BOOKCASE.x1 - BOOKCASE.x0, 0.06, 0.42),
      caseBack: new THREE.PlaneGeometry(BOOKCASE.x1 - BOOKCASE.x0, BOOKCASE.top),
      frame: rbox(0.6, 0.75, 0.04, 0.02),
      art: new THREE.PlaneGeometry(0.5, 0.65),
      cable: new THREE.CylinderGeometry(0.02, 0.02, 1, 6),
    }),
    [W, H],
  );
  const floor = texMat("ia-floor", repeat(floorTex(), 0.4, 0.4), { glow: 0.05, rough: 0.55 });
  const shelfMat = toy("#E8B583", { glow: 0.1 });
  const shelvesX = (DESK.x0 + DESK.x1) / 2;
  const caseX = (BOOKCASE.x0 + BOOKCASE.x1) / 2;
  const caseShelves = [0.06, 0.82, 1.6, 2.38, 3.27];
  return (
    <group>
      <mesh geometry={geos.floor} material={floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, wallZ + 8]} />
      <mesh geometry={geos.wall} material={toy("#FFD9BE", { glow: 0.12, rough: 0.95 })} position={[0, H / 2, wallZ]} />
      <mesh geometry={geos.wains} material={toy("#7CCFC4", { glow: 0.12, rough: 0.8 })} position={[0, 0.45, wallZ + 0.03]} />
      <mesh geometry={geos.rail} material={toy("#F7F2EA", { glow: 0.1 })} position={[0, 0.92, wallZ + 0.05]} />
      <mesh geometry={geos.rug} material={texMat("ia-rug", rugTex(), { glow: 0.06, rough: 0.95 })} rotation={[-Math.PI / 2, 0, 0]} position={[0.3, 0.006, 0.35]} />

      {/* Left: desk with the computer, two shelves of books with fairy lights above it. */}
      <Desk power={power} t={t} />
      {[2.25, 2.95].map((y, i) => (
        <group key={y}>
          <mesh geometry={geos.shelf} material={shelfMat} position={[shelvesX, y, wallZ + 0.17]} />
          {[-0.9, 0.9].map((dx) => (
            <mesh key={dx} geometry={geos.bracket} material={shelfMat} position={[shelvesX + dx, y - 0.11, wallZ + 0.14]} />
          ))}
          <Books x0={-1.1} x1={i === 0 ? 0.45 : 1.1} seed={11 + i * 40} position={[shelvesX, y + 0.03, wallZ + 0.17]} />
        </group>
      ))}
      <group position={[shelvesX + 0.85, 2.28, wallZ + 0.2]} scale={0.42}>
        <PottedPlant />
      </group>
      <FairyLights a={[DESK.x0 - 0.1, 3.45, wallZ + 0.08]} b={[1.1, 3.45, wallZ + 0.08]} n={18} sag={0.12} on={power.lamps} t={t} />

      {/* Behind Nubi: acoustic panels and the neon play sign. */}
      <Panels position={[0.05, 2.25, wallZ + 0.04]} />
      <NeonPlay on={power.lamps} position={[0.05, 3.55, wallZ + 0.05]} />

      {/* Framed picture right of the switch. */}
      <mesh geometry={geos.frame} material={toy("#F7F2EA")} position={[SWITCH.x + 0.05, 2.75, wallZ + 0.03]} />
      <mesh geometry={geos.art} material={texMat("ia-sunset-art", sunsetTex(), { glow: 0.12 })} position={[SWITCH.x + 0.05, 2.75, wallZ + 0.06]} />

      {/* Right: tall bookcase with a plant on top. */}
      <group position={[caseX, 0, wallZ + 0.22]}>
        <mesh geometry={geos.caseBack} material={toy("#C3A6FF", { glow: 0.14 })} position={[0, BOOKCASE.top / 2, -0.2]} />
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={geos.caseSide} material={toy("#F7F2EA", { glow: 0.1 })} position={[(s * (BOOKCASE.x1 - BOOKCASE.x0)) / 2, BOOKCASE.top / 2, 0]} />
        ))}
        {caseShelves.map((y) => (
          <mesh key={y} geometry={geos.caseShelf} material={toy("#F7F2EA", { glow: 0.1 })} position={[0, y, 0]} />
        ))}
        {caseShelves.slice(0, 4).map((y, i) => (
          <Books key={y} x0={-0.62} x1={0.62} seed={100 + i * 17} position={[0, y + 0.03, 0]} maxH={0.6} />
        ))}
        <group position={[0.2, BOOKCASE.top + 0.03, 0]} scale={0.6}>
          <PottedPlant />
        </group>
      </group>
      <group position={[2.4, 0, STUDIO.wallZ + 0.75]} scale={1.15}>
        <PottedPlant />
      </group>

      <IaSwitch lever={lever} led={power.led} t={t} jolt={jolt} />
      {/* Cable from the switch up into the ceiling. */}
      <mesh geometry={geos.cable} material={toy("#30333C")} position={[SWITCH.x - 0.35, SWITCH.plateY + 0.81 + 2.5, STUDIO.wallZ + 0.05]} scale={[1, 5, 1]} />
      {sparks >= 0 ? (
        <>
          <SparkBurst t={sparks} position={[SWITCH.x, SWITCH.plateY + 0.1, STUDIO.wallZ + 0.4]} size={0.9} count={60} seed={4} color="#FFB02E" up={0.5} />
          <SparkBurst t={sparks - 0.12} position={[SWITCH.x - 0.35, SWITCH.plateY + 0.75, STUDIO.wallZ + 0.2]} size={0.6} count={30} seed={9} color="#7FD8FF" hot="#FFFFFF" up={0.3} />
        </>
      ) : null}

      {/* Foreground: ring light and the camera on its tripod, both aimed at Nubi. */}
      <RingLight on={power.ring} position={RING} yaw={Math.atan2(NUBI_SPOT[0] - RING[0], NUBI_SPOT[2] - RING[2]) + Math.PI} />
      <TripodCamera on={power.monitor} position={TRIPOD} yaw={Math.atan2(NUBI_SPOT[0] - TRIPOD[0], NUBI_SPOT[2] - TRIPOD[2]) + Math.PI} t={t} />
    </group>
  );
};

/**
 * Lights of the studio (5 lights). With power on: a warm cosy key, the ring light on Nubi, the
 * monitor's cool glow and the switch lamp. Off: a dim blue fill keeps Nubi readable. `warm` adds a
 * soft warm glow from the side (a calmer, sincere mood, also when the power is off).
 */
export const StudioLights: React.FC<{ power: PowerState; warm?: number }> = ({ power, warm = 0 }) => {
  const m = clamp01(power.main);
  const sky = new THREE.Color("#4A62C0").lerp(new THREE.Color("#FFF1E2"), m);
  const ground = new THREE.Color("#1B1A33").lerp(new THREE.Color("#8A6A5A"), m);
  const ledCol = power.led > 0.5 ? "#2EE86A" : "#FF3030";
  return (
    <>
      <hemisphereLight args={[sky, ground, 0.75 + 0.75 * m + 0.25 * warm]} />
      <directionalLight position={[-3 + 6 * warm * (1 - m), 6, 8]} intensity={1.7 * m + 0.75 * (1 - m) * (0.35 + warm)} color={m > 0.5 ? "#FFE7CF" : warm > 0 ? "#FFB27A" : "#7E95FF"} />
      <pointLight position={[RING[0] + 0.3, 1.95, RING[2] - 0.3]} intensity={3.4 * clamp01(power.ring)} distance={0} decay={1.3} color="#FFF4E6" />
      <pointLight position={[MONITOR[0] + 0.2, MONITOR[1], MONITOR[2] + 0.7]} intensity={2.2 * clamp01(power.monitor)} distance={5} decay={1.4} color="#8FB6FF" />
      <pointLight position={[SWITCH.x + 0.33, SWITCH.plateY - 0.2, STUDIO.wallZ + 0.7]} intensity={1.2} distance={2.6} decay={1.5} color={ledCol} />
    </>
  );
};

// =======================================================================================
// Characters

/** Nubi in the studio: glossy eyes tamed (the ring light sits near the camera). */
export const STUDIO_NUBI_PALETTE: NubiPalette = { eyeRough: 0.7 };

/**
 * Nubi's eyes drawn by hand (pass `hideEyes` to <Nubi> and this as a child): each eye has its own
 * height, for the one-eye squint ("raised eyebrow"). `squintR` / `squintL` 0..1 narrow the screen-
 * right / screen-left eye to half its height (a flat, sceptical lid).
 */
export const SquintEyes: React.FC<{ pose: NubiPose; squintR?: number; squintL?: number; rough?: number }> = ({ pose, squintR = 0, squintL = 0, rough = 0.7 }) => {
  const geo = useMemo(() => rbox(1.05, 1.75, 0.5, 0.2, 4), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#151515", roughness: rough }), [rough]);
  const { blink = 0, eyeScale = 1, lookX = 0, lookY = 0 } = pose;
  const eyeW = Math.min(1.35, Math.max(0.8, eyeScale));
  return (
    <>
      {[-1, 1].map((side) => {
        const sq = side > 0 ? squintR : squintL;
        const h = Math.max(0.1, (1 - blink) * eyeScale * (1 - 0.52 * sq));
        // A squinting eye keeps its top lower (the lid comes down) — sits a touch lower.
        return <mesh key={side} geometry={geo} material={mat} position={[side * 2.3 + lookX * 0.5, 5.5 + lookY * 0.4 - 0.32 * sq, 4.45]} scale={[eyeW * (1 + 0.12 * sq), h, 1]} />;
      })}
    </>
  );
};

/** Big black sunglasses (model units, child of <Nubi>). `down` 0..1 slides them down the face. */
export const Sunglasses: React.FC<{ down?: number }> = ({ down = 0 }) => {
  const geos = useMemo(
    () => ({
      lens: rbox(2.55, 2.0, 0.35, 0.55, 4),
      bridge: rbox(1.0, 0.35, 0.3, 0.12),
      arm: new THREE.BoxGeometry(0.25, 0.3, 4.2),
      shine: new THREE.PlaneGeometry(0.35, 1.1),
    }),
    [],
  );
  const glass = toy("#0E0E12", { rough: 0.12, metal: 0.4, glow: 0.02 });
  const k = clamp01(down);
  return (
    <group position={[0, 5.55 - 1.45 * k, 4.75 + 0.1 * k]} rotation={[0.25 * k, 0, 0]}>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 2.2, 0, 0]}>
          <mesh geometry={geos.lens} material={glass} />
          <mesh geometry={geos.shine} material={toy("#FFFFFF", { glow: 0.6 })} position={[-0.55, 0.25, 0.19]} rotation={[0, 0, -0.5]} />
        </group>
      ))}
      <mesh geometry={geos.bridge} material={toy("#D9A400", { metal: 0.6, rough: 0.25, glow: 0.25 })} position={[0, 0.45, 0]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geos.arm} material={glass} position={[s * 3.5, 0.45, -2.0]} />
      ))}
    </group>
  );
};

/** Peace sign held at the fin tip (model units, pass inside holdR / holdL). */
export const PeaceSign: React.FC<{ color?: string }> = ({ color = "#FFD45B" }) => {
  const geo = useMemo(() => rbox(0.55, 1.7, 0.55, 0.26), []);
  const mat = toy(color, { rough: 0.42, glow: 0.14 });
  return (
    <group position={[0.1, 0.3, 0]}>
      <mesh geometry={geo} material={mat} position={[-0.32, 0.75, 0]} rotation={[0, 0, 0.28]} />
      <mesh geometry={geo} material={mat} position={[0.32, 0.75, 0]} rotation={[0, 0, -0.28]} />
    </group>
  );
};

export const INFLUENCER_PALETTE: NubiPalette = { body: "#FFD45B", eyeRough: 0.6 };

/** The influencer: gold Nubi with big sunglasses (that it can lower), optionally a peace sign. */
export const Influencer: React.FC<{ pose: NubiPose; position: V3; rotationY?: number; size?: number; glassesDown?: number; peace?: number }> = ({
  pose,
  position,
  rotationY = 0,
  size = 2,
  glassesDown = 0,
  peace = 1,
}) => (
  <Nubi pose={pose} position={position} rotationY={rotationY} size={size} palette={INFLUENCER_PALETTE} holdR={peace > 0.5 ? <PeaceSign /> : undefined} hideEyes={glassesDown < 0.35}>
    <Sunglasses down={glassesDown} />
  </Nubi>
);

// =======================================================================================
// The luxury photo set (a parking lot)

/** Chunky stylised red sports car, 1 unit long (x), nose towards +x. Scale it to size. */
export const ToyCar: React.FC<{ spin?: number }> = ({ spin = 0 }) => {
  const geos = useMemo(() => {
    const body = rbox(1.0, 0.26, 0.48, 0.09, 4);
    // Slope the hood down towards the nose and the tail a little.
    const p = body.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      if (y > 0) p.setY(i, y - 0.1 * Math.max(0, x) * 2 * (y / 0.13) - 0.03 * Math.max(0, -x - 0.3) * 4);
    }
    body.computeVertexNormals();
    const cabin = rbox(0.46, 0.2, 0.4, 0.08, 4);
    const cp = cabin.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < cp.count; i++) {
      const y = cp.getY(i);
      if (y > 0) cp.setX(i, cp.getX(i) * 0.72 - 0.04);
    }
    cabin.computeVertexNormals();
    return {
      body,
      cabin,
      wheel: new THREE.CylinderGeometry(0.115, 0.115, 0.09, 22),
      hub: new THREE.CylinderGeometry(0.06, 0.06, 0.095, 14),
      light: rbox(0.03, 0.05, 0.12, 0.012),
      spoiler: rbox(0.12, 0.025, 0.46, 0.01),
      post: new THREE.BoxGeometry(0.03, 0.07, 0.03),
      shine: rbox(0.36, 0.006, 0.05, 0.002),
      key: new THREE.TorusGeometry(0.05, 0.014, 8, 16),
    };
  }, []);
  const paint = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#E8121E", roughness: 0.18, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08, emissive: new THREE.Color("#E8121E"), emissiveIntensity: 0.12 }), []);
  const glass = toy("#1B2440", { rough: 0.08, metal: 0.5, glow: 0.05 });
  const lightMat = toy("#FFF6D0", { glow: 1.0 });
  const tailMat = toy("#FF2E2E", { glow: 0.8 });
  const white = toy("#FFFFFF", { glow: 0.9 });
  return (
    <group>
      <mesh geometry={geos.body} material={paint} position={[0, 0.2, 0]} />
      <mesh geometry={geos.cabin} material={glass} position={[-0.08, 0.38, 0]} />
      {/* Fake glossy reflections (white streaks) on the hood, roof and flank. */}
      <mesh geometry={geos.shine} material={white} position={[0.26, 0.315, 0.08]} rotation={[0, 0.35, -0.2]} />
      <mesh geometry={geos.shine} material={white} position={[-0.1, 0.485, 0.05]} rotation={[0, 0.2, 0]} scale={[0.6, 1, 1]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geos.shine} material={white} position={[0.05, 0.25, s * 0.243]} rotation={[Math.PI / 2, 0, 0]} scale={[1.4, 1, 0.5]} />
      ))}
      {[
        [0.31, 0.24],
        [-0.31, 0.24],
        [0.31, -0.24],
        [-0.31, -0.24],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0.115, z]} rotation={[Math.PI / 2, spin, 0]}>
          <mesh geometry={geos.wheel} material={toy("#16161A", { rough: 0.6 })} />
          <mesh geometry={geos.hub} material={toy("#E8E8EE", { metal: 0.7, rough: 0.2, glow: 0.2 })} />
        </group>
      ))}
      {[-0.15, 0.15].map((z) => (
        <mesh key={`h${z}`} geometry={geos.light} material={lightMat} position={[0.5, 0.2, z]} />
      ))}
      {[-0.17, 0.17].map((z) => (
        <mesh key={`t${z}`} geometry={geos.light} material={tailMat} position={[-0.5, 0.24, z]} />
      ))}
      <mesh geometry={geos.spoiler} material={paint} position={[-0.44, 0.4, 0]} />
      {[-0.15, 0.15].map((z) => (
        <mesh key={`p${z}`} geometry={geos.post} material={toy("#222")} position={[-0.44, 0.355, z]} />
      ))}
      {/* Wind-up key on the far side (it's a toy). */}
      <mesh geometry={geos.key} material={toy("#C9CED8", { metal: 0.6, rough: 0.3 })} position={[-0.2, 0.22, -0.3]} />
    </group>
  );
};

/** Layout of the photo set (parking lot). The phone's lens is where the "post" camera sits. */
export const LOT = {
  influencer: [0.5, 0, -2.4] as V3,
  backdrop: { x: 0.35, z: -3.4, w: 3.8, h: 3.9, bottom: 0.05 },
  stool: [-0.22, 0, 2.55] as V3,
  stoolTop: 0.82,
  carScale: 0.62,
  carYaw: -0.55,
  phone: [-0.08, 1.0, 3.75] as V3,
  friend: [2.55, 0, -3.65] as V3,
};

/** A boring parked car (box-ish hatchback). */
const PlainCar: React.FC<{ color: string; position: V3; rotationY?: number }> = ({ color, position, rotationY = 0 }) => {
  const geos = useMemo(
    () => ({
      body: rbox(3.4, 0.8, 1.6, 0.2),
      cabin: rbox(2.0, 0.65, 1.45, 0.18),
      wheel: new THREE.CylinderGeometry(0.33, 0.33, 0.25, 16),
    }),
    [],
  );
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geos.body} material={toy(color, { glow: 0.08 })} position={[0, 0.65, 0]} />
      <mesh geometry={geos.cabin} material={toy("#5B6A7A", { rough: 0.2, glow: 0.05 })} position={[-0.25, 1.35, 0]} />
      {[
        [1.1, 0.75],
        [-1.1, 0.75],
        [1.1, -0.75],
        [-1.1, -0.75],
      ].map(([x, z], i) => (
        <mesh key={i} geometry={geos.wheel} material={toy("#1C1C20")} position={[x, 0.33, z]} rotation={[Math.PI / 2, 0, 0]} />
      ))}
    </group>
  );
};

const Cone: React.FC<{ position: V3 }> = ({ position }) => {
  const geos = useMemo(() => ({ cone: new THREE.ConeGeometry(0.2, 0.6, 16), base: new THREE.BoxGeometry(0.45, 0.05, 0.45), band: new THREE.CylinderGeometry(0.115, 0.15, 0.1, 16) }), []);
  return (
    <group position={position}>
      <mesh geometry={geos.base} material={toy("#FF6A13")} position={[0, 0.025, 0]} />
      <mesh geometry={geos.cone} material={toy("#FF6A13", { glow: 0.15 })} position={[0, 0.33, 0]} />
      <mesh geometry={geos.band} material={toy("#F4F4F4", { glow: 0.2 })} position={[0, 0.35, 0]} />
    </group>
  );
};

/** The phone on its tripod, its screen (facing +z) showing the glossy photo. */
const PhoneTripod: React.FC<{ position: V3 }> = ({ position }) => {
  const geos = useMemo(
    () => ({
      phone: rbox(0.2, 0.38, 0.03, 0.03),
      screen: new THREE.PlaneGeometry(0.18, 0.34),
      leg: new THREE.CylinderGeometry(0.012, 0.01, position[1], 6),
      clamp: new THREE.BoxGeometry(0.24, 0.04, 0.05),
    }),
    [position],
  );
  return (
    <group position={position}>
      <mesh geometry={geos.phone} material={toy("#1E1F25", { rough: 0.3 })} />
      <mesh geometry={geos.screen} material={texMat("ia-phone-post", sunsetTex(), { glow: 0.8, rough: 0.2 })} position={[0, 0, 0.017]} />
      <mesh geometry={geos.clamp} material={toy("#30333C")} position={[0, -0.19, 0]} />
      {[0, 1, 2].map((i) => {
        const a = (i * 2 * Math.PI) / 3 + 0.5;
        return (
          <mesh key={i} geometry={geos.leg} material={toy("#30333C")} position={[0.12 * Math.sin(a), -position[1] / 2 - 0.1, 0.12 * Math.cos(a)]} rotation={[0.2 * Math.cos(a), 0, -0.2 * Math.sin(a)]} />
        );
      })}
    </group>
  );
};

/** The parking lot with the photo set. `friendPose` animates the friend holding the backdrop. */
export const LuxurySet: React.FC<{ t?: number; friendPose?: NubiPose; phone?: boolean; carSpin?: number }> = ({ friendPose = {}, phone = true, carSpin = 0 }) => {
  const B = LOT.backdrop;
  const geos = useMemo(
    () => ({
      ground: worldPlane(80, 80),
      line: new THREE.PlaneGeometry(0.12, 4.5),
      poster: new THREE.PlaneGeometry(B.w, B.h),
      posterBack: new THREE.PlaneGeometry(B.w, B.h),
      pole: new THREE.CylinderGeometry(0.035, 0.035, B.h + B.bottom + 0.3, 8),
      bar: new THREE.CylinderGeometry(0.03, 0.03, B.w + 0.3, 8),
      foot: new THREE.BoxGeometry(0.7, 0.06, 0.12),
      wall: new THREE.BoxGeometry(40, 2.4, 0.4),
      building: new THREE.BoxGeometry(40, 9, 1),
      window: new THREE.PlaneGeometry(1.4, 1.0),
      stoolSeat: new THREE.CylinderGeometry(0.3, 0.3, 0.07, 24),
      stoolLeg: new THREE.CylinderGeometry(0.03, 0.025, LOT.stoolTop, 8),
      board: rbox(0.9, 0.03, 0.55, 0.01),
      boardTop: new THREE.PlaneGeometry(0.88, 0.53),
      sign: rbox(0.9, 0.9, 0.06, 0.08),
      signPole: new THREE.CylinderGeometry(0.04, 0.04, 2.6, 8),
      bin: rbox(1.6, 1.2, 1.0, 0.06),
    }),
    [B.w, B.h, B.bottom],
  );
  const asphalt = texMat("ia-asphalt", repeat(asphaltTex(), 0.25, 0.25), { glow: 0.06, rough: 0.9 });
  const S = LOT.stool;
  return (
    <group>
      <mesh geometry={geos.ground} material={asphalt} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -10]} />
      {/* Parking bay lines. */}
      {[-6.6, -3.6, 4.2, 7.2].map((x) => (
        <mesh key={x} geometry={geos.line} material={toy("#F2F2F2", { glow: 0.3 })} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.005, -7.2]} />
      ))}
      {[-1.2, 2.0].map((x) => (
        <mesh key={x} geometry={geos.line} material={toy("#F2F2F2", { glow: 0.3 })} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.005, 0.8]} />
      ))}
      {/* Ordinary surroundings: a low wall, a dull building with windows, parked cars, a bin, a P sign, cones. */}
      <mesh geometry={geos.wall} material={toy("#B9B6AE", { glow: 0.08 })} position={[0, 1.2, -10.5]} />
      <mesh geometry={geos.building} material={toy("#D6CDBF", { glow: 0.1 })} position={[0, 4.5, -15]} />
      {[-8, -5.5, -3, -0.5, 2, 4.5, 7].flatMap((x) =>
        [4.5, 7].map((y) => <mesh key={`${x}-${y}`} geometry={geos.window} material={toy("#7D93A8", { rough: 0.3, glow: 0.1 })} position={[x, y, -14.48]} />),
      )}
      <PlainCar color="#C9C3B3" position={[-5.1, 0, -7.3]} rotationY={Math.PI / 2} />
      <PlainCar color="#8D99A6" position={[5.7, 0, -7.3]} rotationY={Math.PI / 2} />
      <PlainCar color="#E6E6E6" position={[-8.2, 0, -7.2]} rotationY={Math.PI / 2} />
      <mesh geometry={geos.bin} material={toy("#3F7A4E", { glow: 0.08 })} position={[3.2, 0.6, -9.6]} />
      <group position={[-2.6, 0, -9.4]}>
        <mesh geometry={geos.signPole} material={toy("#9AA0A8", { metal: 0.3 })} position={[0, 1.3, 0]} />
        <mesh geometry={geos.sign} material={toy("#2F6FE0", { glow: 0.2 })} position={[0, 2.45, 0.05]} />
        <Text3D text="P" size={0.55} look={LOOKS.white} position={[0, 2.45, 0.12]} />
      </group>
      <Cone position={[1.6, 0, 0.6]} />
      <Cone position={[-2.4, 0, -1.2]} />

      {/* The printed backdrop on two stands. */}
      <group position={[B.x, 0, B.z]}>
        <mesh geometry={geos.poster} material={texMat("ia-poster", sunsetTex(), { glow: 0.35, rough: 0.6 })} position={[0, B.bottom + B.h / 2, 0]} />
        <mesh geometry={geos.posterBack} material={toy("#EDEDED", { glow: 0.1 })} position={[0, B.bottom + B.h / 2, -0.01]} rotation={[0, Math.PI, 0]} />
        <mesh geometry={geos.bar} material={toy("#30333C")} position={[0, B.bottom + B.h + 0.03, 0.02]} rotation={[0, 0, Math.PI / 2]} />
        {[-1, 1].map((s) => (
          <group key={s} position={[(s * (B.w + 0.2)) / 2, 0, 0]}>
            <mesh geometry={geos.pole} material={toy("#30333C")} position={[0, (B.h + B.bottom + 0.3) / 2, 0]} />
            <mesh geometry={geos.foot} material={toy("#30333C")} position={[0, 0.03, 0]} rotation={[0, Math.PI / 2, 0]} />
          </group>
        ))}
      </group>
      {/* The friend holding the backdrop's edge, peeking out. */}
      <Nubi size={1.7} position={LOT.friend} rotationY={-0.5} pose={friendPose} palette={{ body: "#7FB8FF", eyeRough: 0.6 }} />

      {/* Stool with the road-painted board and the toy car. */}
      <group position={S}>
        <mesh geometry={geos.stoolSeat} material={toy("#C98E56", { glow: 0.1 })} position={[0, LOT.stoolTop - 0.035, 0]} />
        {[0, 1, 2].map((i) => {
          const a = (i * 2 * Math.PI) / 3;
          return <mesh key={i} geometry={geos.stoolLeg} material={toy("#A86F3E")} position={[0.2 * Math.sin(a), LOT.stoolTop / 2 - 0.05, 0.2 * Math.cos(a)]} rotation={[0.1 * Math.cos(a), 0, -0.1 * Math.sin(a)]} />;
        })}
        <group position={[0, LOT.stoolTop + 0.015, 0]} rotation={[0, LOT.carYaw * 0.4, 0]}>
          <mesh geometry={geos.board} material={toy("#C79A62")} />
          <mesh geometry={geos.boardTop} material={texMat("ia-roadboard", roadBoardTex(), { glow: 0.1, rough: 0.8 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.017, 0]} />
        </group>
        <group position={[0, LOT.stoolTop + 0.032, 0]} rotation={[0, LOT.carYaw, 0]} scale={LOT.carScale}>
          <ToyCar spin={carSpin} />
        </group>
      </group>
      {phone ? <PhoneTripod position={LOT.phone} /> : null}
    </group>
  );
};

/** Overcast daylight for the parking lot plus a warm "golden hour" reflector on the influencer. */
export const LotLights: React.FC<{ golden?: number }> = ({ golden = 1 }) => (
  <>
    <hemisphereLight args={["#F4F7FF", "#7A746C", 1.35]} />
    <directionalLight position={[5, 9, 6]} intensity={1.3} color="#FFFFFF" />
    <directionalLight position={[-2, 2.5, 8]} intensity={1.2 * golden} color="#FFB36B" />
  </>
);

export const LOT_SKY = "linear-gradient(180deg, #BFD0E0 0%, #DCE4EA 60%, #E9ECEE 100%)";
export const STUDIO_BG = "#2A2238";

/** The studio inside a Stage: the set, its lights and the characters passed as children. */
export const StudioStage: React.FC<StudioSetProps & { cam: { position: Vec3; target: Vec3; fov?: number; roll?: number }; warm?: number; children?: React.ReactNode }> = ({
  cam,
  warm = 0,
  children,
  power = POWER_ON,
  ...rest
}) => (
  <Stage cam={cam} near={0.1} far={80}>
    <StudioLights power={power} warm={warm} />
    <StudioSet power={power} {...rest} />
    {children}
  </Stage>
);
