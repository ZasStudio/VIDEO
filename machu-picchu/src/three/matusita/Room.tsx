import React, { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Upright } from "../../inca/outfit";
import { PottedPlant } from "../dino/Props";
import { V3, canvasTexture, toy } from "../inca/kit";
import { Nubi, NubiPose } from "../Nubi";
import { Glow } from "../thanos/FX";
import { Flashlight } from "./Flashlight";

// Nubi's creator room at night, for the end of the Casa Matusita short ("puerta", "cuarto",
// "final"): a desk against the front wall with a small camera on a tripod (red REC light), a ring
// light and a monitor, Nubi's swivel chair facing the camera, and behind the chair the back wall
// with the white door (the payoff), a shelf of toys, fairy lights and a window with the night city
// in the rain. A short pitch-dark hallway lies behind the door. Also the doppelgänger: the other
// Nubi sitting in the chair, perfectly still, eyes a touch too wide, never blinking.
//
// World units are sized for Nubi at size 2 (2 wide, 2 tall); the floor is y = 0 and +z points from
// the back (door) wall towards the desk. Walls are one-sided planes facing into the room, so a
// camera can stand outside the front wall (the "tripod camera" view) and look in. Hide the desk
// props (`desk={false}`) for views from the front: they stand between that camera and the chair.
//
// Layout (see ROOM): x −4.4..4.2, z −3.4 (back wall, door) .. 2.4 (front wall, desk), walls 5.4 high.
//   back wall:  plant, poster, the door (x −1.0, hinge on its −x side, opens into the room), the
//               toy shelf above the chair, the window (x 2.0) with the city and the rain, fairy lights
//   front wall: desk (x −1.5..2.3) with lamp, mug, tripod camera + ring light, monitor, keyboard;
//               posters, a second toy shelf and fairy lights above it
//   right wall: the bed (back corner).   Floor: rug under the chair.
//
// Lights: <RoomLights /> (warm practicals that dim and flicker through `lights`, cold moonlight
// and a dim cold fill that stay when they are off). Everything is deterministic (`t` in seconds).

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const rbox = (w: number, h: number, d: number, r: number, seg = 3) =>
  new RoundedBoxGeometry(w, h, d, seg, Math.max(0.001, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)));

/** Plane w × h whose uvs are in world units (textures tile by their own repeat). */
const worldPlane = (w: number, h: number) => {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  return g;
};

/** One-sided wall (w × h, origin at its bottom-left) with rectangular holes (centre x/y, w, h). */
const wallGeometry = (w: number, h: number, holes: { x: number; y: number; w: number; h: number }[]) => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(w, 0);
  s.lineTo(w, h);
  s.lineTo(0, h);
  s.closePath();
  for (const o of holes) {
    const p = new THREE.Path();
    p.moveTo(o.x - o.w / 2, o.y - o.h / 2);
    p.lineTo(o.x - o.w / 2, o.y + o.h / 2);
    p.lineTo(o.x + o.w / 2, o.y + o.h / 2);
    p.lineTo(o.x + o.w / 2, o.y - o.h / 2);
    p.closePath();
    s.holes.push(p);
  }
  const g = new THREE.ShapeGeometry(s);
  // World-unit uvs (the shape is already in units).
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getY(i));
  return g;
};

const texMatCache = new Map<string, THREE.MeshStandardMaterial>();
/** Material for a canvas texture with a small emissive share. Cached per key. */
const texMat = (key: string, tex: THREE.Texture, o: { rough?: number; glow?: number; side?: THREE.Side } = {}) => {
  let m = texMatCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: o.rough ?? 0.8,
      emissive: new THREE.Color("#ffffff"),
      emissiveMap: tex,
      emissiveIntensity: o.glow ?? 0.05,
      side: o.side ?? THREE.FrontSide,
    });
    texMatCache.set(key, m);
  }
  return m;
};

const withRepeat = (tex: THREE.Texture, rx: number, ry: number) => {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  return tex;
};

// =======================================================================================
// Layout

export const ROOM = { x0: -4.4, x1: 4.2, zBack: -3.4, zFront: 2.4, height: 5.4 };
/** The door in the back wall: centre x, width, height (Nubi-sized: it opens into the room, hinge on
 *  its +x side, the chair's side, so when it is ajar the gap shows on the far side). */
export const ROOM_DOOR = { x: -1.5, w: 2.25, h: 3.0 };
const WALL_T = 0.14;
const HINGE: V3 = [ROOM_DOOR.x + ROOM_DOOR.w / 2 - 0.02, 0, ROOM.zBack - 0.04];
/** Window in the back wall (centre x/y, size). */
const WINDOW = { x: 2.7, y: 2.55, w: 1.3, h: 1.6 };
/** The swivel chair (its base) and the seat height. */
export const ROOM_CHAIR: V3 = [1.0, 0, -0.15];
export const ROOM_SEAT_Y = 0.6;
/** Where a <Nubi size={2}> sits in the chair (it faces +z, the desk, at rotationY 0). */
export const ROOM_SIT: V3 = [ROOM_CHAIR[0], ROOM_SEAT_Y, ROOM_CHAIR[2] + 0.2];
/** Where the sitter is when the chair is swivelled by `yaw` (it turns round the column). */
export const sitAt = (yaw: number): V3 => [ROOM_CHAIR[0] + 0.2 * Math.sin(yaw), ROOM_SEAT_Y, ROOM_CHAIR[2] + 0.2 * Math.cos(yaw)];
/** The desk against the front wall. */
const DESK = { x0: -0.95, x1: 2.95, z0: 1.4, z1: 2.38, top: 0.95 };
/** The tripod camera's lens (it looks at the chair, along −z) and the ring light behind it. */
export const ROOM_LENS: V3 = [ROOM_SIT[0], 1.72, 1.66];
const RING: V3 = [ROOM_SIT[0], 1.76, 2.05];
const MONITOR: V3 = [-0.2, DESK.top, 2.0];
const LAMP: V3 = [2.25, DESK.top, 2.05];
/** Nubi standing on the threshold of the door, in the doorway (faces +z, into the room). */
export const ROOM_THRESHOLD: V3 = [ROOM_DOOR.x, 0, ROOM.zBack - 0.1];
/** The hallway behind the door: x range and how far it runs (towards −z). */
const HALL = { x0: ROOM_DOOR.x - 2.9, x1: ROOM_DOOR.x + 1.35, len: 6, h: 4.0 };
/** Turn (rotationY) for a Nubi in the chair to face the doorway. */
export const FACE_DOOR_YAW = Math.atan2(ROOM_DOOR.x - ROOM_SIT[0], ROOM.zBack - ROOM_SIT[2]);
/** Yaw from a seated Nubi towards a world point. */
export const yawTo = (p: V3, from: V3 = ROOM_SIT) => Math.atan2(p[0] - from[0], p[2] - from[2]);

// =======================================================================================
// Textures

const wallTex = () =>
  canvasTexture(
    "mat-wall",
    256,
    256,
    (ctx, W, H) => {
      ctx.fillStyle = "#3A4670";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#404D7A";
      for (let i = 0; i < 4; i++) ctx.fillRect(i * 64 + 22, 0, 20, H);
      ctx.fillStyle = "#56639A";
      for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 4; i++) {
          const x = i * 64 + 32 + (j % 2) * 32 - 16;
          const y = j * 64 + 32;
          ctx.beginPath();
          for (let k = 0; k < 8; k++) {
            const r = k % 2 ? 2 : 6;
            const a = (k * Math.PI) / 4;
            ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
          }
          ctx.closePath();
          ctx.fill();
        }
      }
    },
    { wrapS: true, wrapT: true },
  );

const floorTex = () =>
  canvasTexture(
    "mat-floor",
    512,
    512,
    (ctx, W) => {
      const tones = ["#7A5238", "#6E4930", "#86603F", "#73503A"];
      for (let r = 0; r < 4; r++) {
        const y = r * 128;
        const off = [0, 128, 64, 192][r];
        for (let k = -1; k < 3; k++) {
          const x0 = off + k * 256;
          ctx.fillStyle = tones[(r + k + 4) % 4];
          ctx.fillRect(x0, y, 256, 128);
          ctx.strokeStyle = "rgba(40,20,10,0.25)";
          ctx.lineWidth = 3;
          for (let g = 0; g < 4; g++) {
            const gy = y + 22 + g * 27 + ((k * 7 + r * 3) % 9);
            ctx.beginPath();
            ctx.moveTo(x0 + 10, gy);
            ctx.bezierCurveTo(x0 + 80, gy - 6, x0 + 170, gy + 7, x0 + 246, gy);
            ctx.stroke();
          }
          ctx.fillStyle = "#3E2618";
          ctx.fillRect(x0, y, 4, 128);
        }
        ctx.fillStyle = "#3E2618";
        ctx.fillRect(0, y, W, 4);
      }
    },
    { wrapS: true, wrapT: true },
  );

const rugTex = () =>
  canvasTexture("mat-rug", 256, 256, (ctx, W) => {
    const c = W / 2;
    const rings = ["#E7B44C", "#2F8F86", "#F2E3C2", "#2F8F86", "#E7B44C", "#C2563F"];
    rings.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(c, c, c - i * 18, 0, Math.PI * 2);
      ctx.fill();
    });
  });

/** The view from the window: night sky, moon, the city's towers with lit windows. */
const cityTex = () =>
  canvasTexture("mat-city", 512, 512, (ctx, W, H) => {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#070B22");
    sky.addColorStop(0.6, "#18224A");
    sky.addColorStop(1, "#33305A");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(220,230,255,${0.3 + 0.5 * hash(i * 3.1)})`;
      ctx.fillRect(hash(i) * W, hash(i + 40) * H * 0.45, 2, 2);
    }
    // The moon, behind thin cloud.
    const mx = W * 0.3;
    const my = H * 0.2;
    const halo = ctx.createRadialGradient(mx, my, 10, mx, my, 120);
    halo.addColorStop(0, "rgba(210,225,255,0.55)");
    halo.addColorStop(1, "rgba(210,225,255,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#E8EEFF";
    ctx.beginPath();
    ctx.arc(mx, my, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#C9D3F0";
    ctx.beginPath();
    ctx.arc(mx - 9, my - 6, 7, 0, Math.PI * 2);
    ctx.arc(mx + 11, my + 9, 5, 0, Math.PI * 2);
    ctx.fill();
    // Two rows of towers: far (bluish) and near (dark), windows lit at random.
    const row = (base: number, col: string, lit: string, seed: number, minH: number, maxH: number) => {
      let x = -10;
      let k = 0;
      while (x < W) {
        const w = 34 + hash(seed + k) * 60;
        const h = minH + hash(seed + k + 50) * (maxH - minH);
        ctx.fillStyle = col;
        ctx.fillRect(x, H - base - h, w, h + base);
        for (let wy = H - base - h + 10; wy < H - 6; wy += 14) {
          for (let wx = x + 6; wx < x + w - 8; wx += 11) {
            const r = hash(wx * 0.37 + wy * 1.31 + seed);
            if (r > 0.72) {
              ctx.fillStyle = r > 0.93 ? "#9FD3FF" : lit;
              ctx.fillRect(wx, wy, 5, 7);
            }
          }
        }
        if (hash(seed + k + 9) > 0.6) {
          ctx.fillStyle = "#FF4A4A";
          ctx.fillRect(x + w / 2 - 2, H - base - h - 8, 4, 4);
        }
        x += w + 4 + hash(seed + k + 20) * 10;
        k++;
      }
    };
    row(30, "#1E2550", "#E8C877", 11, 120, 260);
    row(0, "#0B0F24", "#FFD27A", 77, 60, 200);
  });

/** Rain: thin slanted streaks on transparency (tiles vertically; scrolled through the offset). */
const rainTex = () =>
  canvasTexture(
    "mat-rain",
    256,
    512,
    (ctx, W, H) => {
      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = "round";
      for (let i = 0; i < 90; i++) {
        const x = hash(i * 1.7) * W;
        const y = hash(i * 2.9 + 4) * H;
        const len = 18 + hash(i * 5.3) * 46;
        ctx.strokeStyle = `rgba(200,220,255,${0.25 + 0.45 * hash(i * 7.7)})`;
        ctx.lineWidth = 1 + hash(i * 3.3) * 1.5;
        for (const dy of [0, -H, H]) {
          ctx.beginPath();
          ctx.moveTo(x, y + dy);
          ctx.lineTo(x - len * 0.12, y + len + dy);
          ctx.stroke();
        }
      }
    },
    { wrapS: true, wrapT: true },
  );

/** Drops sliding down the glass. */
const dropsTex = () =>
  canvasTexture(
    "mat-drops",
    256,
    256,
    (ctx, W, H) => {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < 40; i++) {
        const x = hash(i * 9.1) * W;
        const y = hash(i * 4.3 + 2) * H;
        const r = 2 + hash(i * 6.1) * 4;
        for (const dy of [0, -H, H]) {
          ctx.fillStyle = "rgba(210,230,255,0.55)";
          ctx.beginPath();
          ctx.ellipse(x, y + dy, r * 0.8, r, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(210,230,255,0.18)";
          ctx.fillRect(x - 1, y + dy - r * 6, 2, r * 6);
        }
      }
    },
    { wrapS: true, wrapT: true },
  );

const posterGhostTex = () =>
  canvasTexture("mat-poster-ghost", 256, 340, (ctx, W, H) => {
    ctx.fillStyle = "#5B3F8C";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#FFE7A3";
    ctx.beginPath();
    ctx.arc(W * 0.72, H * 0.2, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5B3F8C";
    ctx.beginPath();
    ctx.arc(W * 0.78, H * 0.17, 26, 0, Math.PI * 2);
    ctx.fill();
    // A cute ghost.
    ctx.fillStyle = "#F7F4FF";
    ctx.beginPath();
    ctx.moveTo(70, 270);
    ctx.lineTo(70, 160);
    ctx.arc(128, 160, 58, Math.PI, 0);
    ctx.lineTo(186, 270);
    for (let k = 0; k < 4; k++) ctx.quadraticCurveTo(186 - k * 29 - 14, 250, 186 - (k + 1) * 29, 270);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#231A33";
    ctx.beginPath();
    ctx.ellipse(108, 165, 9, 14, 0, 0, Math.PI * 2);
    ctx.ellipse(148, 165, 9, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FF8FB0";
    ctx.beginPath();
    ctx.ellipse(128, 200, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8F75C9";
    ctx.fillRect(0, H - 34, W, 34);
  });

const posterPlayTex = () =>
  canvasTexture("mat-poster-play", 256, 340, (ctx, W, H) => {
    ctx.fillStyle = "#1F7A5C";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#8EDCA2";
    ctx.beginPath();
    ctx.roundRect(38, 90, 180, 160, 26);
    ctx.fill();
    ctx.fillStyle = "#151515";
    ctx.fillRect(90, 140, 18, 30);
    ctx.fillRect(148, 140, 18, 30);
    ctx.fillStyle = "#FF4F5E";
    ctx.beginPath();
    ctx.arc(W / 2, 300, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.moveTo(W / 2 - 7, 288);
    ctx.lineTo(W / 2 + 11, 300);
    ctx.lineTo(W / 2 - 7, 312);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#FFD36E";
    for (let i = 0; i < 6; i++) ctx.fillRect(20 + i * 40, 30, 22, 8);
  });

const posterPlanetTex = () =>
  canvasTexture("mat-poster-planet", 256, 340, (ctx, W, H) => {
    ctx.fillStyle = "#13214A";
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillRect(hash(i + 3) * W, hash(i + 90) * H, 2, 2);
    }
    ctx.fillStyle = "#FF9E6E";
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#FFE08A";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.ellipse(W / 2, H / 2, 112, 26, -0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#E9774F";
    ctx.fillRect(W / 2 - 50, H / 2 - 10, 100, 9);
  });

/** The recording app on the monitor (the camera feed is drawn on top with meshes). */
const screenTex = () =>
  canvasTexture("mat-screen", 512, 320, (ctx, W, H) => {
    ctx.fillStyle = "#0E1220";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#1C2440";
    ctx.fillRect(14, 14, W - 28, H - 66);
    ctx.fillStyle = "#2A3358";
    ctx.fillRect(14, H - 40, W - 28, 10);
    ctx.fillStyle = "#FF4F5E";
    ctx.fillRect(14, H - 40, (W - 28) * 0.62, 10);
    ctx.beginPath();
    ctx.arc(34, 34, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8C96B8";
    for (let i = 0; i < 5; i++) ctx.fillRect(W - 150 + i * 26, H - 22, 16, 8);
  });

// =======================================================================================
// Shared bits

/** Fairy-light bulbs (emissive, brightness set per frame through `glow`). */
const bulbMat = new THREE.MeshStandardMaterial({ color: "#FFE2A0", emissive: new THREE.Color("#FFC870"), roughness: 0.4 });
const lampGlowMat = new THREE.MeshStandardMaterial({ color: "#FFE7B8", emissive: new THREE.Color("#FFC27A"), roughness: 0.5, side: THREE.DoubleSide });
const ringMat = new THREE.MeshStandardMaterial({ color: "#FFF8EC", emissive: new THREE.Color("#FFF1DA"), roughness: 0.4, toneMapped: false });
const recMat = new THREE.MeshBasicMaterial({ color: "#FF2A2A", toneMapped: false });

/** A garland of fairy lights hanging between a and b with `n` bulbs (sagging `sag`). */
const FairyLights: React.FC<{ a: V3; b: V3; n: number; sag?: number; on: number; t: number; seed?: number }> = ({ a, b, n, sag = 0.25, on, t, seed = 0 }) => {
  const geos = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 40; i++) {
      const u = i / 40;
      const scallop = Math.abs(Math.sin(u * Math.PI * 3));
      pts.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - sag * scallop, a[2] + (b[2] - a[2]) * u));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const bulbs: V3[] = [];
    for (let i = 0; i < n; i++) {
      const p = curve.getPoint((i + 0.5) / n);
      bulbs.push([p.x, p.y - 0.05, p.z]);
    }
    return { wire: new THREE.TubeGeometry(curve, 80, 0.008, 4, false), bulb: new THREE.SphereGeometry(0.035, 10, 8), bulbs };
  }, [a, b, n, sag]);
  bulbMat.emissiveIntensity = 0.15 + 2.2 * on;
  return (
    <group>
      <mesh geometry={geos.wire} material={toy("#1A1A22", { glow: 0 })} />
      {geos.bulbs.map((p, i) => (
        <group key={i} position={p}>
          <mesh geometry={geos.bulb} material={bulbMat} />
          <Glow color={i % 3 === 0 ? "#FFB36B" : "#FFD99A"} size={0.32} opacity={on * (0.45 + 0.15 * Math.sin(t * 2 + i * 1.7 + seed))} />
        </group>
      ))}
    </group>
  );
};

/** A framed poster on a wall (local: faces +z). */
const Poster: React.FC<{ tex: () => THREE.Texture; k: string; w?: number; h?: number; position: V3; rotationY?: number; tilt?: number }> = ({ tex, k, w = 0.8, h = 1.06, position, rotationY = 0, tilt = 0 }) => {
  const geos = useMemo(() => ({ frame: rbox(w + 0.07, h + 0.07, 0.03, 0.015), art: new THREE.PlaneGeometry(w, h) }), [w, h]);
  return (
    <group position={position} rotation={[0, rotationY, tilt]}>
      <mesh geometry={geos.frame} material={toy("#F3EEE6", { glow: 0.04, rough: 0.6 })} />
      <mesh geometry={geos.art} material={texMat(k, tex(), { glow: 0.06, rough: 0.7 })} position={[0, 0, 0.017]} />
    </group>
  );
};

/** A wall shelf with toys (local: shelf along x, wall behind at −z, faces +z). */
const ToyShelf: React.FC<{ position: V3; rotationY?: number; variant?: 0 | 1 }> = ({ position, rotationY = 0, variant = 0 }) => {
  const geos = useMemo(
    () => ({
      board: rbox(1.5, 0.05, 0.3, 0.02),
      bracket: rbox(0.04, 0.16, 0.22, 0.015),
      book: rbox(0.07, 0.3, 0.22, 0.012),
      robotBody: rbox(0.18, 0.2, 0.14, 0.03),
      robotHead: rbox(0.16, 0.13, 0.13, 0.03),
      eye: new THREE.SphereGeometry(0.018, 8, 6),
      antenna: new THREE.CylinderGeometry(0.008, 0.008, 0.08, 6),
      ball: new THREE.SphereGeometry(0.025, 8, 6),
      duck: new THREE.SphereGeometry(0.09, 16, 12),
      duckHead: new THREE.SphereGeometry(0.06, 14, 10),
      beak: new THREE.ConeGeometry(0.03, 0.06, 10),
      ghost: new THREE.CapsuleGeometry(0.075, 0.1, 6, 14),
      cube: rbox(0.12, 0.12, 0.12, 0.02),
    }),
    [],
  );
  const dark = toy("#111111", { glow: 0 });
  const books = variant === 0 ? ["#C2563F", "#E7B44C", "#2F8F86", "#7B6CC2"] : ["#2F8F86", "#E7B44C", "#C2563F"];
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geos.board} material={toy("#E9E1D3", { glow: 0.04, rough: 0.6 })} />
      <mesh geometry={geos.bracket} material={toy("#E9E1D3", { glow: 0.04 })} position={[-0.55, -0.1, -0.03]} />
      <mesh geometry={geos.bracket} material={toy("#E9E1D3", { glow: 0.04 })} position={[0.55, -0.1, -0.03]} />
      {books.map((c, i) => (
        <mesh key={c} geometry={geos.book} material={toy(c, { glow: 0.05 })} position={[-0.68 + i * 0.075, 0.175, 0]} rotation={[0, 0, i === books.length - 1 ? -0.3 : 0]} scale={[1, 0.8 + 0.1 * (i % 3), 1]} />
      ))}
      {variant === 0 ? (
        <>
          {/* A little robot. */}
          <group position={[-0.22, 0.025, 0]}>
            <mesh geometry={geos.robotBody} material={toy("#8FA3C8", { metal: 0.3, rough: 0.4, glow: 0.05 })} position={[0, 0.1, 0]} />
            <mesh geometry={geos.robotHead} material={toy("#A9BBDD", { metal: 0.3, rough: 0.4, glow: 0.05 })} position={[0, 0.27, 0]} />
            <mesh geometry={geos.eye} material={toy("#7FE3FF", { glow: 0.9 })} position={[-0.035, 0.28, 0.066]} />
            <mesh geometry={geos.eye} material={toy("#7FE3FF", { glow: 0.9 })} position={[0.035, 0.28, 0.066]} />
            <mesh geometry={geos.antenna} material={dark} position={[0, 0.37, 0]} />
            <mesh geometry={geos.ball} material={toy("#FF5A4E", { glow: 0.4 })} position={[0, 0.42, 0]} />
          </group>
          {/* Mini Nubi figures (blue and pink). */}
          <Nubi size={0.3} position={[0.08, 0.025, 0.02]} rotationY={-0.2} shadow={false} palette={{ body: "#7FB2FF" }} pose={{ finL: 0.6, finR: 0.2 }} />
          <Nubi size={0.26} position={[0.36, 0.025, 0.02]} rotationY={0.25} shadow={false} palette={{ body: "#FF9EC4" }} pose={{ finR: 0.7 }} />
          {/* A ghost plushie. */}
          <group position={[0.6, 0.15, 0]}>
            <mesh geometry={geos.ghost} material={toy("#F4F1FF", { glow: 0.08, rough: 0.9 })} />
            <mesh geometry={geos.eye} material={dark} position={[-0.03, 0.04, 0.072]} />
            <mesh geometry={geos.eye} material={dark} position={[0.03, 0.04, 0.072]} />
          </group>
        </>
      ) : (
        <>
          {/* A rubber duck, a puzzle cube and a mini Nubi. */}
          <group position={[-0.25, 0.025, 0]} rotation={[0, 0.5, 0]}>
            <mesh geometry={geos.duck} material={toy("#FFD23F", { glow: 0.08 })} position={[0, 0.08, 0]} scale={[1.15, 0.85, 1]} />
            <mesh geometry={geos.duckHead} material={toy("#FFD23F", { glow: 0.08 })} position={[0.05, 0.19, 0]} />
            <mesh geometry={geos.beak} material={toy("#FF8A2A", { glow: 0.1 })} position={[0.12, 0.19, 0]} rotation={[0, 0, -Math.PI / 2]} />
            <mesh geometry={geos.eye} material={dark} position={[0.08, 0.22, 0.04]} scale={0.6} />
          </group>
          <mesh geometry={geos.cube} material={toy("#FF5A4E", { glow: 0.06 })} position={[0.05, 0.085, 0]} rotation={[0, 0.6, 0]} />
          <Nubi size={0.3} position={[0.38, 0.025, 0.02]} rotationY={-0.3} shadow={false} palette={{ body: "#FFC35C" }} pose={{ finL: 0.5, finR: 0.5 }} />
        </>
      )}
    </group>
  );
};

// =======================================================================================
// The door

/** The white wooden door: slab with raised panels and lever handles (both sides), casing, jambs. */
const Door: React.FC<{ open: number; rattle?: number }> = ({ open, rattle = 0 }) => {
  const { w, h } = ROOM_DOOR;
  const geos = useMemo(
    () => ({
      slab: rbox(w - 0.02, h - 0.015, 0.07, 0.015),
      panelTall: rbox(0.82, 1.2, 0.025, 0.015),
      panelLow: rbox(0.82, 0.95, 0.025, 0.015),
      rose: new THREE.CylinderGeometry(0.06, 0.065, 0.025, 20),
      lever: rbox(0.24, 0.045, 0.045, 0.02),
      neck: new THREE.CylinderGeometry(0.012, 0.012, 0.05, 10),
      hinge: rbox(0.04, 0.16, 0.04, 0.01),
      casingV: rbox(0.14, h + 0.1, 0.04, 0.015),
      casingH: rbox(w + 0.36, 0.15, 0.04, 0.015),
      jambV: new THREE.PlaneGeometry(WALL_T, h),
      jambH: new THREE.PlaneGeometry(w, WALL_T),
    }),
    [w, h],
  );
  const white = toy("#F4F1EA", { rough: 0.5, glow: 0.07 });
  const panel = toy("#ECE7DD", { rough: 0.5, glow: 0.07 });
  const metal = toy("#C9B48A", { metal: 0.6, rough: 0.3, glow: 0.05 });
  const jamb = toy("#E8E2D6", { rough: 0.6, glow: 0.04, side: THREE.DoubleSide });
  const zB = ROOM.zBack;
  const face = (sz: number) => (
    <group>
      {[-0.5, 0.5].map((px) => (
        <group key={px}>
          <mesh geometry={geos.panelTall} material={panel} position={[px, 0.62, sz * 0.03]} />
          <mesh geometry={geos.panelLow} material={panel} position={[px, -0.75, sz * 0.03]} />
        </group>
      ))}
      {/* Lever handle near the free edge (the −x edge). */}
      <group position={[-w / 2 + 0.17, 1.15 - h / 2, sz * 0.035]}>
        <mesh geometry={geos.rose} material={metal} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={geos.neck} material={metal} position={[0, 0, sz * 0.03]} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={geos.lever} material={metal} position={[0.06, 0, sz * 0.055]} />
      </group>
    </group>
  );
  const shake = rattle * 0.012;
  return (
    <group>
      {/* Slab pivots at the hinge; opens into the room (+z). */}
      <group position={HINGE} rotation={[0, open + shake, 0]}>
        <group position={[-w / 2 + 0.02, h / 2, 0]}>
          <mesh geometry={geos.slab} material={white} />
          {face(1)}
          {face(-1)}
        </group>
        <mesh geometry={geos.hinge} material={metal} position={[0.01, 0.45, 0]} />
        <mesh geometry={geos.hinge} material={metal} position={[0.01, h - 0.4, 0]} />
      </group>
      {/* Casing on the room side and on the hallway side. */}
      {[zB + 0.017, zB - WALL_T - 0.017].map((z) => (
        <group key={z}>
          <mesh geometry={geos.casingV} material={white} position={[ROOM_DOOR.x - w / 2 - 0.07, (h + 0.1) / 2, z]} />
          <mesh geometry={geos.casingV} material={white} position={[ROOM_DOOR.x + w / 2 + 0.07, (h + 0.1) / 2, z]} />
          <mesh geometry={geos.casingH} material={white} position={[ROOM_DOOR.x, h + 0.075, z]} />
        </group>
      ))}
      {/* Jambs and head (the wall's thickness). */}
      <mesh geometry={geos.jambV} material={jamb} position={[ROOM_DOOR.x - w / 2, h / 2, zB - WALL_T / 2]} rotation={[0, Math.PI / 2, 0]} />
      <mesh geometry={geos.jambV} material={jamb} position={[ROOM_DOOR.x + w / 2, h / 2, zB - WALL_T / 2]} rotation={[0, -Math.PI / 2, 0]} />
      <mesh geometry={geos.jambH} material={jamb} position={[ROOM_DOOR.x, h, zB - WALL_T / 2]} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  );
};

/** The pitch-dark hallway behind the door (only a flashlight shows it). */
const Hallway: React.FC = () => {
  const { x0, x1, len, h } = HALL;
  const zB = ROOM.zBack - WALL_T;
  const W = x1 - x0;
  const geos = useMemo(
    () => ({
      floor: worldPlane(W, len),
      side: worldPlane(len, h),
      end: worldPlane(W, h),
      // The hallway face of the back wall, around the door (faces −z).
      face: wallGeometry(W, h, [{ x: x1 - ROOM_DOOR.x, y: ROOM_DOOR.h / 2, w: ROOM_DOOR.w, h: ROOM_DOOR.h }]),
      skirt: rbox(len, 0.1, 0.03, 0.01),
    }),
    [W, len, h, x1],
  );
  const wall = texMat("hall-wall", withRepeat(wallTex().clone(), 1 / 1.3, 1 / 1.3), { glow: 0, rough: 0.95 });
  wall.color.set("#6E6A78");
  const floor = texMat("hall-floor", withRepeat(floorTex().clone(), 0.5, 0.5), { glow: 0, rough: 0.7 });
  floor.color.set("#5A5050");
  return (
    <group>
      <mesh geometry={geos.floor} material={floor} rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, 0.001, zB - len / 2]} />
      <mesh geometry={geos.floor} material={toy("#14141A", { glow: 0, rough: 1 })} rotation={[Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, h, zB - len / 2]} />
      <mesh geometry={geos.side} material={wall} position={[x0, h / 2, zB - len / 2]} rotation={[0, Math.PI / 2, 0]} />
      <mesh geometry={geos.side} material={wall} position={[x1, h / 2, zB - len / 2]} rotation={[0, -Math.PI / 2, 0]} />
      <mesh geometry={geos.end} material={wall} position={[(x0 + x1) / 2, h / 2, zB - len]} />
      <mesh geometry={geos.face} material={wall} position={[x1, 0, zB]} rotation={[0, Math.PI, 0]} />
      <mesh geometry={geos.skirt} material={toy("#2A2630", { glow: 0 })} position={[x0 + 0.02, 0.05, zB - len / 2]} rotation={[0, Math.PI / 2, 0]} />
      <mesh geometry={geos.skirt} material={toy("#2A2630", { glow: 0 })} position={[x1 - 0.02, 0.05, zB - len / 2]} rotation={[0, Math.PI / 2, 0]} />
    </group>
  );
};

// =======================================================================================
// Window with the night city and the rain

const NightWindow: React.FC<{ t: number }> = ({ t }) => {
  const { w, h } = WINDOW;
  const geos = useMemo(
    () => ({
      view: new THREE.PlaneGeometry(w + 2.6, h + 2.0),
      glass: new THREE.PlaneGeometry(w, h),
      top: rbox(w + 0.2, 0.1, 0.14, 0.03),
      side: rbox(0.1, h + 0.2, 0.14, 0.03),
      munV: rbox(0.05, h, 0.05, 0.015),
      munH: rbox(w, 0.05, 0.05, 0.015),
      revealH: new THREE.PlaneGeometry(w, WALL_T + 0.2),
      revealV: new THREE.PlaneGeometry(WALL_T + 0.2, h),
      sill: rbox(w + 0.34, 0.06, 0.2, 0.02),
      curtain: rbox(0.32, h + 0.55, 0.06, 0.03),
      rod: new THREE.CylinderGeometry(0.018, 0.018, w + 1.0, 8),
    }),
    [w, h],
  );
  const rainA = useMemo(() => {
    const tex = rainTex().clone();
    tex.needsUpdate = true;
    tex.repeat.set(1.4, 0.9);
    return new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false });
  }, []);
  const rainB = useMemo(() => {
    const tex = rainTex().clone();
    tex.needsUpdate = true;
    tex.repeat.set(2.2, 1.4);
    return new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false });
  }, []);
  const drops = useMemo(() => {
    const tex = dropsTex().clone();
    tex.needsUpdate = true;
    tex.repeat.set(1.3, 1.4);
    return new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.6, depthWrite: false });
  }, []);
  (rainA.map as THREE.Texture).offset.set(-t * 0.15, t * 2.1);
  (rainB.map as THREE.Texture).offset.set(-t * 0.1, t * 1.4);
  (drops.map as THREE.Texture).offset.set(0, t * 0.05);
  const white = toy("#E9E3D8", { rough: 0.5, glow: 0.05 });
  const reveal = toy("#2E3757", { rough: 0.9, glow: 0.02, side: THREE.DoubleSide });
  const curtain = toy("#2D5E63", { rough: 0.9, glow: 0.03 });
  return (
    <group position={[WINDOW.x, WINDOW.y, ROOM.zBack]}>
      <mesh geometry={geos.view} material={texMat("city", cityTex(), { glow: 1.0, rough: 1 })} position={[0, 0.25, -0.9]} />
      <mesh geometry={geos.glass} material={rainB} position={[0, 0, -0.4]} />
      <mesh geometry={geos.glass} material={rainA} position={[0, 0, -0.12]} />
      <mesh geometry={geos.glass} material={drops} position={[0, 0, -0.06]} />
      <mesh geometry={geos.revealH} material={reveal} position={[0, h / 2, -0.1]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={geos.revealH} material={reveal} position={[0, -h / 2, -0.1]} rotation={[-Math.PI / 2, 0, 0]} />
      <mesh geometry={geos.revealV} material={reveal} position={[-w / 2, 0, -0.1]} rotation={[0, Math.PI / 2, 0]} />
      <mesh geometry={geos.revealV} material={reveal} position={[w / 2, 0, -0.1]} rotation={[0, -Math.PI / 2, 0]} />
      <mesh geometry={geos.munV} material={white} position={[0, 0, -0.07]} />
      <mesh geometry={geos.munH} material={white} position={[0, 0.12, -0.07]} />
      <mesh geometry={geos.top} material={white} position={[0, h / 2 + 0.05, 0.02]} />
      <mesh geometry={geos.top} material={white} position={[0, -h / 2 - 0.05, 0.02]} />
      <mesh geometry={geos.side} material={white} position={[-w / 2 - 0.05, 0, 0.02]} />
      <mesh geometry={geos.side} material={white} position={[w / 2 + 0.05, 0, 0.02]} />
      <mesh geometry={geos.sill} material={white} position={[0, -h / 2 - 0.1, 0.08]} />
      <mesh geometry={geos.rod} material={toy("#1E1E26", { glow: 0 })} position={[0, h / 2 + 0.28, 0.12]} rotation={[0, 0, Math.PI / 2]} />
      <mesh geometry={geos.curtain} material={curtain} position={[-w / 2 - 0.3, -0.02, 0.12]} rotation={[0, 0, 0.02]} />
      <mesh geometry={geos.curtain} material={curtain} position={[w / 2 + 0.3, -0.02, 0.12]} rotation={[0, 0, -0.02]} />
    </group>
  );
};

// =======================================================================================
// The chair

/** Nubi's swivel gaming chair. `yaw` turns the seat (and backrest) on the column. */
export const Chair: React.FC<{ yaw?: number }> = ({ yaw = 0 }) => {
  const geos = useMemo(
    () => ({
      spoke: rbox(0.72, 0.07, 0.11, 0.03),
      caster: new THREE.SphereGeometry(0.06, 10, 8),
      column: new THREE.CylinderGeometry(0.05, 0.06, 0.4, 14),
      hub: new THREE.CylinderGeometry(0.12, 0.14, 0.1, 18),
      seat: rbox(1.75, 0.18, 1.55, 0.08),
      stripe: rbox(0.3, 0.012, 1.4, 0.006),
      back: rbox(1.6, 1.0, 0.2, 0.09),
      backStripe: rbox(0.3, 0.9, 0.012, 0.006),
      stem: rbox(0.12, 0.3, 0.08, 0.03),
    }),
    [],
  );
  const shell = toy("#3B2D63", { rough: 0.55, glow: 0.05 });
  const accent = toy("#8EDCA2", { rough: 0.55, glow: 0.12 });
  const black = toy("#18161E", { rough: 0.5, glow: 0 });
  const S = ROOM_SEAT_Y;
  return (
    <group position={ROOM_CHAIR}>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        return (
          <group key={i} rotation={[0, a, 0]}>
            <mesh geometry={geos.spoke} material={black} position={[0.36, 0.1, 0]} />
            <mesh geometry={geos.caster} material={black} position={[0.68, 0.06, 0]} />
          </group>
        );
      })}
      <mesh geometry={geos.column} material={toy("#8A8F9C", { metal: 0.6, rough: 0.3, glow: 0.02 })} position={[0, 0.32, 0]} />
      <group rotation={[0, yaw, 0]}>
        <mesh geometry={geos.hub} material={black} position={[0, S - 0.22, 0.1]} />
        <mesh geometry={geos.seat} material={shell} position={[0, S - 0.09, 0.15]} />
        <mesh geometry={geos.stripe} material={accent} position={[0, S + 0.002, 0.15]} />
        <mesh geometry={geos.stem} material={black} position={[0, S + 0.05, -0.68]} />
        <group position={[0, S + 0.62, -0.78]} rotation={[-0.1, 0, 0]}>
          <mesh geometry={geos.back} material={shell} />
          <mesh geometry={geos.backStripe} material={accent} position={[0, 0, 0.1]} />
          <mesh geometry={geos.backStripe} material={accent} position={[0, 0, -0.1]} />
        </group>
      </group>
    </group>
  );
};

// =======================================================================================
// Desk and the creator setup

/** The monitor (faces −z): the recording app, and the camera feed of whoever sits in the chair. */
const Monitor: React.FC<{ on: number; feedYaw: number; feed: boolean; t: number }> = ({ on, feedYaw, feed, t }) => {
  const geos = useMemo(
    () => ({
      body: rbox(1.0, 0.64, 0.06, 0.03),
      screen: new THREE.PlaneGeometry(0.92, 0.56),
      neck: rbox(0.07, 0.34, 0.05, 0.02),
      foot: rbox(0.36, 0.03, 0.22, 0.015),
      face: rbox(0.34, 0.3, 0.001, 0.05, 2),
      eye: new THREE.PlaneGeometry(0.035, 0.06),
      dot: new THREE.CircleGeometry(0.012, 12),
    }),
    [],
  );
  const scr = texMat("screen", screenTex(), { glow: 1, rough: 0.4 });
  scr.emissiveIntensity = 0.08 + 1.0 * on;
  scr.color.setScalar(0.2 + 0.8 * on);
  const faceMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#7FCB93", toneMapped: false }), []);
  faceMat.color.set("#7FCB93").multiplyScalar(0.1 + 0.9 * on);
  const eyeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#0A0A0A" }), []);
  // The feed (mirrored like a selfie preview): a cube turning by feedYaw shows its eyes while it
  // faces the lens; they slide off to one side as it turns away.
  const c = Math.cos(feedYaw);
  const s = Math.sin(feedYaw);
  const recOn = Math.floor(t * 1.2) % 2 === 0;
  return (
    <group position={MONITOR} rotation={[0, yawTo(ROOM_SIT, MONITOR) + Math.PI, 0]}>
      <mesh geometry={geos.foot} material={toy("#22252E", { glow: 0.02 })} position={[0, 0.015, 0]} />
      <mesh geometry={geos.neck} material={toy("#22252E", { glow: 0.02 })} position={[0, 0.2, 0.04]} />
      <group position={[0, 0.62, 0]}>
        <mesh geometry={geos.body} material={toy("#1A1C24", { glow: 0.02, rough: 0.4 })} />
        <mesh geometry={geos.screen} material={scr} position={[0, 0, -0.032]} rotation={[0, Math.PI, 0]} />
        {feed && on > 0.02 ? (
          <group position={[0, 0.02, -0.034]} rotation={[0, Math.PI, 0]}>
            <mesh geometry={geos.face} material={faceMat} position={[0, -0.04, 0]} />
            {c > 0.08
              ? [-1, 1].map((sd) => (
                  <mesh key={sd} geometry={geos.eye} material={eyeMat} position={[-(sd * 0.075 * c + 0.15 * s), -0.02, 0.001]} scale={[Math.max(0.15, c), 1, 1]} />
                ))
              : null}
          </group>
        ) : null}
        {on > 0.02 && recOn ? <mesh geometry={geos.dot} material={recMat} position={[0.4, 0.23, -0.035]} rotation={[0, Math.PI, 0]} /> : null}
      </group>
    </group>
  );
};

/** The small camera on its tripod (lens at ROOM_LENS, looking at the chair) with its REC light. */
const TripodCamera: React.FC<{ rec: number; t: number }> = ({ rec, t }) => {
  const geos = useMemo(
    () => ({
      body: rbox(0.3, 0.2, 0.18, 0.04),
      lens: new THREE.CylinderGeometry(0.075, 0.085, 0.14, 22),
      glass: new THREE.CircleGeometry(0.062, 22),
      led: new THREE.SphereGeometry(0.018, 10, 8),
      leg: new THREE.CylinderGeometry(0.012, 0.01, 0.82, 6),
      head: new THREE.CylinderGeometry(0.035, 0.04, 0.1, 10),
      flip: rbox(0.03, 0.14, 0.18, 0.01),
    }),
    [],
  );
  const [lx, ly, lz] = ROOM_LENS;
  const base = DESK.top;
  const blink = rec > 0 && Math.floor(t * 1.2) % 2 === 0 ? rec : 0.1 * rec;
  return (
    <group>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        const foot: V3 = [lx + Math.sin(a) * 0.22, base, lz + 0.08 + Math.cos(a) * 0.22];
        const top: V3 = [lx, ly - 0.17, lz + 0.08];
        const mid: V3 = [(foot[0] + top[0]) / 2, (foot[1] + top[1]) / 2, (foot[2] + top[2]) / 2];
        const dir = new THREE.Vector3(top[0] - foot[0], top[1] - foot[1], top[2] - foot[2]);
        const len = dir.length();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        return <mesh key={i} geometry={geos.leg} material={toy("#2A2D36", { glow: 0.02 })} position={mid} quaternion={q} scale={[1, len / 0.82, 1]} />;
      })}
      <mesh geometry={geos.head} material={toy("#2A2D36", { glow: 0.02 })} position={[lx, ly - 0.14, lz + 0.08]} />
      <group position={[lx, ly, lz + 0.08]}>
        <mesh geometry={geos.body} material={toy("#24262E", { rough: 0.45, glow: 0.03 })} />
        <mesh geometry={geos.flip} material={toy("#1B1D24", { glow: 0.02 })} position={[0.17, 0, 0]} />
        <mesh geometry={geos.lens} material={toy("#121318", { rough: 0.3, metal: 0.3, glow: 0.02 })} position={[0, 0, -0.15]} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={geos.glass} material={toy("#2B3B66", { rough: 0.1, metal: 0.5, glow: 0.15 })} position={[0, 0, -0.221]} rotation={[0, Math.PI, 0]} />
        <mesh geometry={geos.led} material={blink > 0.5 ? recMat : toy("#3A1010", { glow: 0.1 })} position={[0.1, 0.07, -0.09]} />
        <Glow color="#FF3030" size={0.22} opacity={0.9 * blink} position={[0.1, 0.07, -0.11]} />
      </group>
    </group>
  );
};

const Desk: React.FC<{ lights: number; monitor: number; feedYaw: number; feed: boolean; rec: number; t: number }> = ({ lights, monitor, feedYaw, feed, rec, t }) => {
  const W = DESK.x1 - DESK.x0;
  const D = DESK.z1 - DESK.z0;
  const geos = useMemo(
    () => ({
      top: rbox(W, 0.07, D, 0.025),
      leg: rbox(0.07, DESK.top - 0.07, 0.07, 0.02),
      drawers: rbox(0.7, 0.6, D - 0.1, 0.03),
      drawerLine: new THREE.BoxGeometry(0.6, 0.012, 0.01),
      knob: new THREE.SphereGeometry(0.025, 10, 8),
      keyboard: rbox(0.62, 0.035, 0.2, 0.012),
      keys: new THREE.PlaneGeometry(0.56, 0.15),
      mug: new THREE.CylinderGeometry(0.07, 0.065, 0.15, 18),
      handle: new THREE.TorusGeometry(0.04, 0.012, 6, 14),
      lampBase: new THREE.CylinderGeometry(0.1, 0.12, 0.04, 18),
      lampArm: new THREE.CylinderGeometry(0.014, 0.014, 0.5, 8),
      shade: new THREE.ConeGeometry(0.15, 0.2, 20, 1, true),
      bulb: new THREE.SphereGeometry(0.05, 12, 8),
      ring: new THREE.TorusGeometry(0.42, 0.04, 12, 56),
      ringBack: new THREE.TorusGeometry(0.42, 0.055, 10, 56),
      pole: new THREE.CylinderGeometry(0.018, 0.018, 1, 8),
      clamp: rbox(0.1, 0.08, 0.12, 0.02),
      succ: new THREE.CylinderGeometry(0.08, 0.06, 0.12, 14),
      succLeaf: new THREE.SphereGeometry(0.05, 10, 8),
    }),
    [W, D],
  );
  const wood = toy("#B9875A", { rough: 0.6, glow: 0.04 });
  const white = toy("#E9E3D8", { rough: 0.5, glow: 0.04 });
  const dark = toy("#22252E", { rough: 0.5, glow: 0.02 });
  ringMat.emissiveIntensity = 0.05 + 1.6 * lights;
  ringMat.color.setScalar(0.25 + 0.75 * lights);
  lampGlowMat.emissiveIntensity = 0.05 + 1.4 * lights;
  const cx = (DESK.x0 + DESK.x1) / 2;
  const cz = (DESK.z0 + DESK.z1) / 2;
  const ringPole = RING[1] - 0.42 - DESK.top;
  return (
    <group>
      <mesh geometry={geos.top} material={wood} position={[cx, DESK.top - 0.035, cz]} />
      {[
        [DESK.x0 + 0.08, DESK.z0 + 0.08],
        [DESK.x0 + 0.08, DESK.z1 - 0.08],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} geometry={geos.leg} material={white} position={[x, (DESK.top - 0.07) / 2, z]} />
      ))}
      <mesh geometry={geos.drawers} material={white} position={[DESK.x1 - 0.4, 0.33, cz]} />
      {[0.5, 0.25].map((y) => (
        <group key={y}>
          <mesh geometry={geos.drawerLine} material={toy("#B9B0A2", { glow: 0.02 })} position={[DESK.x1 - 0.4, y - 0.06, DESK.z0 + 0.05]} />
          <mesh geometry={geos.knob} material={toy("#2F8F86", { glow: 0.05 })} position={[DESK.x1 - 0.4, y + 0.04, DESK.z0 + 0.06]} />
        </group>
      ))}
      {/* Keyboard and a mug. */}
      <group position={[-0.15, DESK.top, 1.68]} rotation={[0, -0.2, 0]}>
        <mesh geometry={geos.keyboard} material={dark} position={[0, 0.018, 0]} />
        <mesh geometry={geos.keys} material={toy("#4A4F60", { glow: 0.1 })} position={[0, 0.037, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      </group>
      <group position={[1.75, DESK.top, 1.62]}>
        <mesh geometry={geos.mug} material={toy("#8EDCA2", { glow: 0.06 })} position={[0, 0.075, 0]} />
        <mesh geometry={geos.handle} material={toy("#8EDCA2", { glow: 0.06 })} position={[0.08, 0.075, 0]} />
      </group>
      {/* Desk lamp (warm). */}
      <group position={LAMP}>
        <mesh geometry={geos.lampBase} material={toy("#E7B44C", { glow: 0.05 })} position={[0, 0.02, 0]} />
        <mesh geometry={geos.lampArm} material={toy("#E7B44C", { glow: 0.05 })} position={[0.05, 0.27, 0]} rotation={[0, 0, -0.2]} />
        <group position={[0.16, 0.52, -0.06]} rotation={[0.35, 0, -0.5]}>
          <mesh geometry={geos.shade} material={toy("#E7B44C", { glow: 0.05, side: THREE.DoubleSide })} />
          <mesh geometry={geos.bulb} material={lampGlowMat} position={[0, -0.06, 0]} />
        </group>
        <Glow color="#FFB860" size={0.9} opacity={0.55 * lights} position={[0.2, 0.42, -0.05]} />
      </group>
      {/* Ring light on a pole clamped to the desk, behind the camera. */}
      <mesh geometry={geos.clamp} material={dark} position={[RING[0], DESK.top + 0.04, RING[2] + 0.12]} />
      <mesh geometry={geos.pole} material={dark} position={[RING[0], DESK.top + ringPole / 2, RING[2] + 0.12]} scale={[1, ringPole, 1]} />
      <group position={RING}>
        <mesh geometry={geos.ringBack} material={dark} position={[0, 0, 0.03]} />
        <mesh geometry={geos.ring} material={ringMat} />
        <Glow color="#FFF0D8" size={1.5} opacity={0.4 * lights} position={[0, 0, -0.05]} />
      </group>
      <TripodCamera rec={rec} t={t} />
      <Monitor on={monitor} feedYaw={feedYaw} feed={feed} t={t} />
      <Glow color="#8FB6FF" size={1.6} opacity={0.22 * monitor} position={[MONITOR[0] - 0.05, MONITOR[1] + 0.62, MONITOR[2] - 0.15]} />
      {/* A little succulent. */}
      <group position={[2.7, DESK.top, 2.15]}>
        <mesh geometry={geos.succ} material={toy("#C2563F", { glow: 0.04 })} position={[0, 0.06, 0]} />
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} geometry={geos.succLeaf} material={toy("#5FB878", { glow: 0.05 })} position={[Math.cos(i * 1.26) * 0.04, 0.14, Math.sin(i * 1.26) * 0.04]} scale={[0.7, 1.2, 0.7]} />
        ))}
      </group>
    </group>
  );
};

/** The bed in the back-right corner. */
const Bed: React.FC = () => {
  const B = { x0: 2.75, x1: ROOM.x1, z0: ROOM.zBack, z1: -1.2, top: 0.62 };
  const geos = useMemo(
    () => ({
      base: rbox(B.x1 - B.x0, 0.32, B.z1 - B.z0, 0.06),
      mattress: rbox(B.x1 - B.x0 - 0.08, 0.2, B.z1 - B.z0 - 0.1, 0.08),
      quilt: rbox(B.x1 - B.x0 + 0.06, 0.08, (B.z1 - B.z0) * 0.62, 0.04),
      pillow: rbox(0.9, 0.18, 0.45, 0.09),
      head: rbox(B.x1 - B.x0, 1.05, 0.1, 0.05),
    }),
    [B.x0, B.x1, B.z0, B.z1],
  );
  const cx = (B.x0 + B.x1) / 2;
  return (
    <group>
      <mesh geometry={geos.base} material={toy("#6B4A3A", { glow: 0.03 })} position={[cx, 0.22, (B.z0 + B.z1) / 2]} />
      <mesh geometry={geos.mattress} material={toy("#E9E3D8", { glow: 0.04 })} position={[cx, B.top - 0.1, (B.z0 + B.z1) / 2]} />
      <mesh geometry={geos.quilt} material={toy("#6E4FA8", { glow: 0.05, rough: 0.9 })} position={[cx, B.top + 0.02, B.z1 - (B.z1 - B.z0) * 0.31]} />
      <mesh geometry={geos.pillow} material={toy("#F2EDE4", { glow: 0.05 })} position={[cx, B.top + 0.07, B.z0 + 0.35]} rotation={[0.2, 0, 0]} />
      <mesh geometry={geos.head} material={toy("#6B4A3A", { glow: 0.03 })} position={[cx, 0.55, B.z0 + 0.06]} />
    </group>
  );
};

// =======================================================================================
// The room

export type RoomProps = {
  t?: number;
  /** Warm practical lights (ring light, desk lamp, fairy lights, monitor glow), 0..1. */
  lights?: number;
  /** The monitor screen, 0..1 (defaults to `lights`). */
  monitor?: number;
  /** Door opening angle (radians, into the room). */
  door?: number;
  /** Small rattle of the door slab (knocks), 0..1. */
  rattle?: number;
  /** The chair's swivel (radians; 0 = facing the desk). */
  chairYaw?: number;
  /** Show the desk, its props and the front wall's decorations (hide them for views from the
   *  front: the camera then stands outside the front wall, looking at the chair and the door). */
  desk?: boolean;
  /** The camera feed on the monitor: whoever sits in the chair, turned by feedYaw. */
  feed?: boolean;
  feedYaw?: number;
  /** REC light on the tripod camera, 0..1. */
  rec?: number;
  /** Render the hallway behind the door. */
  hall?: boolean;
};

export const Room: React.FC<RoomProps> = ({ t = 0, lights = 1, monitor, door = 0, rattle = 0, chairYaw = 0, desk = true, feed = true, feedYaw = 0, rec = 1, hall = true }) => {
  const { x0, x1, zBack, zFront, height: H } = ROOM;
  const W = x1 - x0;
  const Dp = zFront - zBack;
  const geos = useMemo(
    () => ({
      floor: worldPlane(W + 8, Dp + 10),
      ceiling: new THREE.PlaneGeometry(W + 8, Dp + 10),
      back: wallGeometry(W, H, [
        { x: ROOM_DOOR.x - x0, y: ROOM_DOOR.h / 2, w: ROOM_DOOR.w, h: ROOM_DOOR.h },
        { x: WINDOW.x - x0, y: WINDOW.y, w: WINDOW.w, h: WINDOW.h },
      ]),
      side: wallGeometry(Dp, H, []),
      front: wallGeometry(W, H, []),
      skirt: rbox(1, 0.12, 0.04, 0.015),
      rug: new THREE.CircleGeometry(1.45, 48),
    }),
    [W, Dp, H, x0],
  );
  const wall = texMat("room-wall", withRepeat(wallTex(), 1 / 1.3, 1 / 1.3), { glow: 0.03, rough: 0.92 });
  const floor = texMat("room-floor", withRepeat(floorTex(), 0.5, 0.5), { glow: 0.03, rough: 0.6 });
  const skirt = toy("#E9E3D8", { rough: 0.5, glow: 0.04 });
  return (
    <group>
      <mesh geometry={geos.floor} material={floor} rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, 0, (zBack + zFront) / 2 + 5]} />
      <mesh geometry={geos.ceiling} material={toy("#1E2236", { glow: 0.02, rough: 1 })} rotation={[Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, H, (zBack + zFront) / 2 + 5]} />
      <mesh geometry={geos.back} material={wall} position={[x0, 0, zBack]} />
      <mesh geometry={geos.side} material={wall} position={[x0, 0, zFront]} rotation={[0, Math.PI / 2, 0]} />
      <mesh geometry={geos.side} material={wall} position={[x1, 0, zBack]} rotation={[0, -Math.PI / 2, 0]} />
      <mesh geometry={geos.front} material={wall} position={[x1, 0, zFront]} rotation={[0, Math.PI, 0]} />
      {/* Skirting along the back wall (both sides of the door) and the front wall. */}
      <mesh geometry={geos.skirt} material={skirt} position={[(x0 + ROOM_DOOR.x - ROOM_DOOR.w / 2) / 2, 0.06, zBack + 0.02]} scale={[ROOM_DOOR.x - ROOM_DOOR.w / 2 - x0, 1, 1]} />
      <mesh geometry={geos.skirt} material={skirt} position={[(x1 + ROOM_DOOR.x + ROOM_DOOR.w / 2) / 2, 0.06, zBack + 0.02]} scale={[x1 - ROOM_DOOR.x - ROOM_DOOR.w / 2, 1, 1]} />
      <mesh geometry={geos.skirt} material={skirt} position={[0, 0.06, zFront - 0.02]} scale={[W, 1, 1]} />

      <Door open={door} rattle={rattle} />
      {hall ? <Hallway /> : null}
      <NightWindow t={t} />

      {/* Back wall: plant, ghost poster, the toy shelf above the chair, fairy lights. */}
      <group position={[-3.55, 0, zBack + 0.45]} scale={1.3}>
        <PottedPlant />
      </group>
      <Poster tex={posterGhostTex} k="ghost" position={[-3.55, 2.55, zBack + 0.02]} tilt={0.03} />
      <ToyShelf position={[ROOM_CHAIR[0] + 0.15, 3.9, zBack + 0.16]} />
      <Poster tex={posterPlanetTex} k="planet" position={[ROOM_DOOR.x + 0.15, 4.1, zBack + 0.02]} tilt={-0.03} w={0.7} h={0.92} />
      <Poster tex={posterPlayTex} k="play" position={[WINDOW.x + 0.1, 4.25, zBack + 0.02]} tilt={0.04} w={0.6} h={0.8} />
      <FairyLights a={[x0 + 0.3, 5.05, zBack + 0.04]} b={[x1 - 0.3, 5.05, zBack + 0.04]} n={26} sag={0.26} on={lights} t={t} />

      {/* Front wall (hidden with the desk): posters, a second shelf, fairy lights. */}
      {desk ? (
        <>
          <Poster tex={posterPlayTex} k="play" position={[-0.25, 2.75, zFront - 0.02]} rotationY={Math.PI} tilt={-0.04} />
          <Poster tex={posterPlanetTex} k="planet" position={[2.3, 2.85, zFront - 0.02]} rotationY={Math.PI} tilt={0.03} w={0.7} h={0.92} />
          <ToyShelf position={[ROOM_CHAIR[0], 3.45, zFront - 0.16]} rotationY={Math.PI} variant={1} />
          <FairyLights a={[x1 - 0.3, 5.05, zFront - 0.04]} b={[x0 + 0.3, 5.05, zFront - 0.04]} n={24} sag={0.26} on={lights} t={t} seed={3} />
        </>
      ) : null}

      <Bed />
      <mesh geometry={geos.rug} material={texMat("rug", rugTex(), { glow: 0.03, rough: 0.95 })} rotation={[-Math.PI / 2, 0, 0]} position={[ROOM_CHAIR[0], 0.006, ROOM_CHAIR[2] + 0.1]} />
      <Chair yaw={chairYaw} />
      {desk ? <Desk lights={lights} monitor={monitor ?? lights} feedYaw={feedYaw} feed={feed} rec={rec} t={t} /> : null}
    </group>
  );
};

/**
 * Lights of the room. `lights` dims the warm practicals (ring light on the chair, desk lamp, fairy
 * lights, monitor); `moon` is the cold moonlight through the window plus a dim cold fill, which
 * stay when the practicals are off. Put the ring light's key on the chair from the front with
 * `ring` (it is behind the camera in the front views).
 */
export const RoomLights: React.FC<{ lights?: number; moon?: number; ring?: number }> = ({ lights = 1, moon = 1, ring = 1 }) => {
  const L = clamp01(lights);
  return (
    <>
      <hemisphereLight args={["#5E72B8", "#1A1626", 0.55 * moon + 0.25 * L]} />
      {/* Moonlight from the window (back wall) into the room. */}
      <directionalLight position={[WINDOW.x + 1.2, 5.5, ROOM.zBack - 4]} intensity={0.9 * moon} color="#8FA8FF" />
      <pointLight position={[WINDOW.x, WINDOW.y, ROOM.zBack + 0.5]} intensity={1.6 * moon} distance={4.5} decay={1.5} color="#7F98F0" />
      {/* Ring light: soft key on the chair from the desk (a near light and a soft frontal wash). */}
      <pointLight position={[RING[0], RING[1] + 0.1, RING[2] + 0.4]} intensity={3.2 * L * ring} distance={0} decay={1.25} color="#FFF0DC" />
      <directionalLight position={[RING[0] + 1, RING[1] + 1.5, RING[2] + 8]} intensity={0.7 * L * ring} color="#FFE6C8" />
      {/* Desk lamp (warm) and the monitor (cool). */}
      <pointLight position={[LAMP[0] + 0.2, LAMP[1] + 0.45, LAMP[2] - 0.2]} intensity={3.2 * L} distance={7} decay={1.4} color="#FFB060" />
      <pointLight position={[MONITOR[0] - 0.1, MONITOR[1] + 0.6, MONITOR[2] - 0.4]} intensity={1.6 * L} distance={4} decay={1.5} color="#8FB6FF" />
      {/* Fairy lights: a warm wash over the back wall (the door) and the front wall. */}
      <pointLight position={[-0.4, 4.3, ROOM.zBack + 1.1]} intensity={2.6 * L} distance={6} decay={1.4} color="#FFC27A" />
      <pointLight position={[0.6, 4.3, ROOM.zFront - 0.9]} intensity={1.6 * L} distance={5.5} decay={1.4} color="#FFC27A" />
    </>
  );
};

// =======================================================================================
// Nubi's flashlight held at a fin, and the doppelgänger

/**
 * The flashlight held at a fin tip (pass as holdR / holdL of a <Nubi size={size}>): it points
 * straight ahead of Nubi, tilted down by `pitch` and turned by `turn` (radians), whatever the
 * fin raise.
 */
export const HeldTorch: React.FC<{
  raise: number;
  side?: "R" | "L";
  pitch?: number;
  turn?: number;
  on?: number;
  size?: number;
  reach?: number;
  intensity?: number;
  beam?: number;
}> = ({ raise, side = "R", pitch = 0.3, turn = 0, on = 1, size = 2, reach = 7, intensity = 40, beam = 0.2 }) => (
  <Upright raise={raise} side={side}>
    <group scale={10 / size} rotation={[pitch, turn, 0]} position={[0, 0.05, -0.6]}>
      <Flashlight on={on} reach={reach} intensity={intensity} beam={beam} />
    </group>
  </Upright>
);

/** The doppelgänger's pose: perfectly still, eyes a touch too wide, never blinks. */
export const DOPPEL_POSE: NubiPose = { eyeScale: 1.2, squash: 0.985, finR: -0.12, finL: -0.18, blink: 0, lookX: 0, lookY: 0 };
/** Its flashlight points at the desk. */
export const DOPPEL_TORCH = { raise: -0.12, pitch: 0.38 };

/** The torch's spill on a face from just below and in front of it (Nubi's model space, `at` + yaw). */
const FaceUplight: React.FC<{ at: V3; yaw: number; on: number }> = ({ at, yaw, on }) => {
  const target = useMemo(() => new THREE.Object3D(), []);
  if (on < 0.01) return null;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const w = (lx: number, ly: number, lz: number): V3 => [at[0] + lx * c + lz * s, at[1] + ly, at[2] - lx * s + lz * c];
  return (
    <>
      <spotLight position={w(0.15, 0.4, 1.35)} target={target} angle={0.8} penumbra={1} intensity={10 * on} distance={3} decay={2} color="#FFD49A" />
      <primitive object={target} position={w(0, 2.3, 0.55)} />
      <pointLight position={w(0.9, 0.6, 1.0)} intensity={0.5 * on} distance={1.8} decay={1.5} color="#FFC27A" />
    </>
  );
};

const glintMat = new THREE.MeshBasicMaterial({ color: "#FFF1D6", transparent: true, toneMapped: false, depthWrite: false });
const glintGeo = new THREE.CircleGeometry(1, 16);
/** Small warm catchlights low in each eye (light from below), in Nubi's model units. */
const EyeGlints: React.FC<{ eyeScale: number; on: number }> = ({ eyeScale, on }) => {
  if (on < 0.05) return null;
  glintMat.opacity = 0.85 * on;
  return (
    <>
      {[-1, 1].map((side) => (
        <mesh key={side} geometry={glintGeo} material={glintMat} position={[side * 2.3 + 0.18, 5.5 - 0.52 * eyeScale, 4.73]} scale={[0.17, 0.12, 1]} />
      ))}
    </>
  );
};

/** Matte eyes: a torch hot spot never blows them out to white. */
const DOPPEL_PALETTE = { eyeRough: 0.75 };

/**
 * The other Nubi, sitting in the chair. `turn` = its rotationY (0 faces the desk and its camera;
 * pass the same value as the room's chairYaw so the seat turns with it). `torch` = its flashlight.
 * `chin` 0..1 brings the flashlight from the desk up under its chin, pointing up past its face
 * (campfire-story light, like the hook): its face is then lit from below by its own torch.
 */
export const Doppelganger: React.FC<{ turn?: number; torch?: number; stare?: number; chin?: number }> = ({ turn = 0, torch = 1, stare = 0, chin = 0 }) => {
  const at = sitAt(turn);
  const eyeScale = (DOPPEL_POSE.eyeScale ?? 1) + 0.08 * stare;
  const raise = DOPPEL_TORCH.raise + 0.4 * chin;
  const pitch = DOPPEL_TORCH.pitch + (-1.25 - DOPPEL_TORCH.pitch) * chin;
  return (
    <>
      <Nubi
        size={2}
        position={at}
        rotationY={turn}
        shadow={false}
        palette={DOPPEL_PALETTE}
        pose={{ ...DOPPEL_POSE, eyeScale, finR: raise }}
        holdR={<HeldTorch raise={raise} pitch={pitch} turn={-0.4 * chin} on={torch} intensity={30 - 18 * chin} beam={0.16 + 0.06 * chin} reach={5} />}
      >
        <EyeGlints eyeScale={eyeScale} on={torch * chin} />
      </Nubi>
      <FaceUplight at={at} yaw={turn} on={torch * chin} />
    </>
  );
};
