import React, { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BlobShadow } from "../BlobShadow";
import { V3, canvasTexture, paintGeo, shadeHex, toy, useFontsReady, vertexMat } from "../inca/kit";
import { mulberry } from "../noise";
import { Nubi, NubiPalette, NubiPose } from "../Nubi";

// The street of "¿Y si dormir te pagara?" (agent "street"): a cute morning bakery corner, the
// restaurant next door, the neighbour's hallway, and their people.
//
// BAKERY: a butter-yellow shop whose open front shows shelves of bread; a wooden counter stands on
// the sidewalk in front of it (glass case of croissants on its front), the baker behind it on a
// hidden step. Props on the counter (cash register, service bell, bread baskets, the loaf with its
// price flag, the chalkboard) are separate components so a shot places them. RESTO: the sky-blue
// restaurant next door (+x) with an open kitchen window: the steel stove counter (a steaming pot, a
// frying pan with an egg) where the cook sleeps. HALL: the pastel hallway by Nubi's flat with the
// neighbour's open door, his cardboard sign, the stool and the speaker.
//
// People: the BAKER (chubby tan Nubi, tall pleated hat, curly moustache, flour-dusted apron), the
// COOK (white-ish Nubi, puffy toque, red neckerchief) and the NEIGHBOUR (blue-grey Nubi, backwards
// cap, half-lidded smug eyes, one raised brow). Props: the drill (never spins, its plug dangles
// free), the Bluetooth speaker (pulsing cone, sound-wave rings), the snot bubble, the ding lines.
//
// World units are sized for Nubi at size 2 (2 wide, ≈ 2 tall); ground y = 0; +z points to the
// camera. Everything is deterministic and built once (module caches); `t` is time in seconds.

const TITLE = "'Luckiest Guy', 'Lilita One', sans-serif";
const FUN = "'Lilita One', 'Luckiest Guy', sans-serif";
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
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
    if (ng.attributes.uv1) ng.deleteAttribute("uv1");
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

const texMatCache = new Map<THREE.Texture, THREE.MeshStandardMaterial>();
/** Material for a canvas texture (emissive map keeps colours bright). Cached per texture. */
const texMat = (tex: THREE.Texture, rough = 0.6, glow = 0.18, transparent = false) => {
  let m = texMatCache.get(tex);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: rough,
      emissive: new THREE.Color("#ffffff"),
      emissiveMap: tex,
      emissiveIntensity: glow,
      transparent,
      alphaTest: transparent ? 0.5 : 0,
    });
    texMatCache.set(tex, m);
  }
  return m;
};

// =======================================================================================
// Layout, sky and light

/** Morning sky for the CSS background behind the canvas. */
export const STREET_SKY = "linear-gradient(180deg, #6EC3FF 0%, #9ED8FF 34%, #D2EEFF 64%, #FFE6C2 100%)";

/**
 * The bakery corner. facadeZ: the shop fronts' plane; open: the bakery's open front (x0..x1, up
 * to h); counter: the sidewalk counter (centre x / z, width, depth, height); baker: his spot on
 * the hidden step behind the counter; sign: centre of the PANADERÍA sign.
 */
export const BAKERY = {
  facadeZ: -1.7,
  x0: -3.9,
  x1: 3.0,
  height: 6.6,
  open: { x0: -2.6, x1: 2.45, h: 3.6 },
  backZ: -3.7,
  counter: { x: 0.35, z: -0.35, w: 3.3, d: 0.8, h: 1.05 },
  step: 0.36,
  baker: [0.55, 0.36, -1.12] as V3,
  sign: [-0.35, 5.35, -1.62] as V3,
};

/** The restaurant next door: its kitchen window, the stove counter and the cook's spot. */
export const RESTO = {
  x0: 3.0,
  x1: 9.8,
  height: 6.2,
  win: { x0: 4.3, x1: 7.9, y0: 0.95, y1: 3.2 },
  backZ: -4.0,
  stove: { z: -2.3, d: 0.75, h: 1.0 },
  step: 0.36,
  cook: [6.25, 0.36, -3.0] as V3,
  pot: [4.95, 1.0, -2.3] as V3,
  pan: [7.35, 1.0, -2.25] as V3,
  sign: [6.1, 4.25, -1.62] as V3,
};

/** The hallway by Nubi's flat: the back wall, the neighbour's doorway, his stool and sign. */
export const HALL = {
  wallZ: -1.2,
  door: { x: 0, w: 1.55, h: 2.75 },
  stool: [1.45, 0, -0.55] as V3,
  stoolH: 0.62,
  sign: [-1.55, 1.95, -1.13] as V3,
  vecino: [0.05, 0, -0.45] as V3,
};
export const HALL_BG = "linear-gradient(180deg, #FFE3B0 0%, #FFD39A 55%, #F7B98A 100%)";

/** Bright, warm morning light (three lights). `k` scales it. */
export const StreetLights: React.FC<{ k?: number }> = ({ k = 1 }) => (
  <>
    <hemisphereLight args={["#EAF6FF", "#D9A877", 1.25 * k]} />
    <directionalLight position={[-7, 10, 9]} intensity={2.25 * k} color="#FFEACB" />
    <directionalLight position={[7, 4, 7]} intensity={0.75 * k} color="#CFE6FF" />
  </>
);

/** Warm indoor light for the hallway (three lights). */
export const HallLights: React.FC<{ k?: number }> = ({ k = 1 }) => (
  <>
    <hemisphereLight args={["#FFF4E0", "#C98F66", 1.3 * k]} />
    <directionalLight position={[-5, 8, 9]} intensity={2.0 * k} color="#FFE9CC" />
    <directionalLight position={[6, 3, 6]} intensity={0.7 * k} color="#D6E6FF" />
  </>
);

// =======================================================================================
// Textures

const pavementTexture = () =>
  canvasTexture(
    "dormir-pavement",
    256,
    256,
    (ctx, W, H) => {
      ctx.fillStyle = "#D8BFA0";
      ctx.fillRect(0, 0, W, H);
      const rnd = mulberry(11);
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
          ctx.fillStyle = (i + j) % 2 ? "#F4E3CB" : "#ECD5B6";
          ctx.beginPath();
          ctx.roundRect(i * 128 + 4, j * 128 + 4, 120, 120, 12);
          ctx.fill();
          for (let k = 0; k < 12; k++) {
            ctx.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.2)" : "rgba(150,100,60,0.08)";
            ctx.fillRect(i * 128 + 10 + rnd() * 100, j * 128 + 10 + rnd() * 100, 3 + rnd() * 5, 3 + rnd() * 5);
          }
        }
      }
    },
    { wrapS: true, wrapT: true },
  );

const woodFloorTexture = () =>
  canvasTexture(
    "dormir-woodfloor",
    256,
    256,
    (ctx, W, H) => {
      const rnd = mulberry(5);
      const n = 4;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = ["#D99A62", "#CF8F58", "#E0A56C", "#D4935C"][i];
        ctx.fillRect(0, (i * H) / n, W, H / n);
        ctx.fillStyle = "rgba(90,50,20,0.35)";
        ctx.fillRect(0, (i * H) / n, W, 3);
        const cut = rnd() * W;
        ctx.fillRect(cut, (i * H) / n, 3, H / n);
        for (let k = 0; k < 5; k++) {
          ctx.fillStyle = "rgba(120,70,30,0.12)";
          ctx.fillRect(rnd() * W, (i * H) / n + 8 + rnd() * (H / n - 16), 30 + rnd() * 60, 2);
        }
      }
    },
    { wrapS: true, wrapT: true },
  );

const stripeTexture = (a: string, b: string, scallop: boolean) =>
  canvasTexture(`dormir-awning|${a}|${b}|${scallop}`, 256, scallop ? 96 : 64, (ctx, W, H) => {
    const n = 8;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? b : a;
      ctx.fillRect((i * W) / n, 0, W / n + 1, H);
    }
    if (scallop) {
      ctx.globalCompositeOperation = "destination-out";
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.arc(((i + 0.5) * W) / n, H + 8, W / n / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }
  });

const fitFont = (ctx: CanvasRenderingContext2D, text: string, size: number, maxW: number, family = TITLE) => {
  let s = size;
  ctx.font = `${s}px ${family}`;
  while (ctx.measureText(text).width > maxW && s > 20) {
    s -= 4;
    ctx.font = `${s}px ${family}`;
  }
  return s;
};

/** A shop sign: coloured board with a white rim and big letters (a loaf icon on the bakery's). */
const shopSignTexture = (text: string, bg: string, fg: string, loaf: boolean) =>
  canvasTexture(`dormir-sign|${text}|${bg}|${fg}|${loaf}`, 1024, 256, (ctx, W, H) => {
    ctx.fillStyle = "#FFF8EC";
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 70);
    ctx.fill();
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(14, 14, W - 28, H - 28, 58);
    ctx.fill();
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    const x0 = loaf ? 150 : 0;
    fitFont(ctx, text, 150, W - 120 - x0);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillText(text, (W + x0) / 2 + 5, H / 2 + 14);
    ctx.fillStyle = fg;
    ctx.fillText(text, (W + x0) / 2, H / 2 + 8);
    if (loaf) {
      // A loaf with three cuts.
      ctx.fillStyle = "#F2B25C";
      ctx.beginPath();
      ctx.ellipse(118, H / 2 + 6, 78, 52, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#B8642A";
      ctx.lineWidth = 12;
      ctx.lineCap = "round";
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(118 + k * 34 - 12, H / 2 - 26);
        ctx.lineTo(118 + k * 34 + 14, H / 2 + 30);
        ctx.stroke();
      }
    }
  });

/** The counter's chalkboard: «HORARIO: CUANDO DESPIERTE». */
const chalkTexture = () =>
  canvasTexture("dormir-chalk", 512, 600, (ctx, W, H) => {
    ctx.fillStyle = "#B57A43";
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 40);
    ctx.fill();
    ctx.fillStyle = "#26352E";
    ctx.beginPath();
    ctx.roundRect(26, 26, W - 52, H - 52, 22);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let k = 0; k < 9; k++) ctx.fillRect(40 + k * 50, 50, 26, H - 100);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#FFD86B";
    ctx.font = `76px ${FUN}`;
    ctx.fillText("HORARIO:", W / 2, 118);
    ctx.fillStyle = "#FFFFFF";
    fitFont(ctx, "CUANDO", 112, W - 90, FUN);
    ctx.fillText("CUANDO", W / 2, 262);
    fitFont(ctx, "DESPIERTE", 112, W - 80, FUN);
    ctx.fillText("DESPIERTE", W / 2, 388);
    ctx.fillStyle = "#9BE7FF";
    ctx.font = `64px ${FUN}`;
    ctx.fillText("zzz", W / 2, 498);
  });

/** The price flag stuck in the loaf: «S/100» in red marker on a white card. */
const priceTexture = () =>
  canvasTexture("dormir-price", 512, 300, (ctx, W, H) => {
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 40);
    ctx.fill();
    ctx.strokeStyle = "#E3262B";
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.roundRect(16, 16, W - 32, H - 32, 30);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fitFont(ctx, "S/100", 210, W - 70);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillText("S/100", W / 2 + 6, H / 2 + 20);
    ctx.fillStyle = "#E3262B";
    ctx.fillText("S/100", W / 2, H / 2 + 14);
  });

/** The neighbour's cardboard sign: «SE VENDE SILENCIO», hand-lettered in black marker. */
const cardboardTexture = () =>
  canvasTexture("dormir-cardboard", 640, 520, (ctx, W, H) => {
    // Kraft board with a torn-ish edge and corrugation lines.
    ctx.fillStyle = "#C99A5E";
    ctx.beginPath();
    const rnd = mulberry(23);
    ctx.moveTo(12, 18);
    for (let x = 12; x <= W - 12; x += 32) ctx.lineTo(x, 10 + rnd() * 14);
    for (let y = 18; y <= H - 14; y += 32) ctx.lineTo(W - 8 - rnd() * 12, y);
    for (let x = W - 12; x >= 12; x -= 32) ctx.lineTo(x, H - 8 - rnd() * 14);
    for (let y = H - 14; y >= 18; y -= 32) ctx.lineTo(6 + rnd() * 12, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(120,80,40,0.16)";
    for (let y = 30; y < H - 20; y += 22) ctx.fillRect(20, y, W - 40, 6);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(40, H - 90, 160, 40);
    // Hand lettering: each letter a little rotated and shifted.
    const line = (text: string, y: number, size: number, color: string, seed: number) => {
      const r = mulberry(seed);
      ctx.font = `${size}px ${FUN}`;
      const widths = [...text].map((ch) => ctx.measureText(ch).width * 0.96);
      const total = widths.reduce((a, b) => a + b, 0);
      let x = (W - total) / 2;
      [...text].forEach((ch, i) => {
        ctx.save();
        ctx.translate(x + widths[i] / 2, y + (r() - 0.5) * 10);
        ctx.rotate((r() - 0.5) * 0.22);
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(ch, 0, 0);
        ctx.restore();
        x += widths[i];
      });
    };
    line("SE VENDE", 150, 118, "#1A1A1A", 3);
    line("SILENCIO", 300, 138, "#D21F2B", 7);
    // Underline scribble and an arrow pointing down at the man.
    ctx.strokeStyle = "#1A1A1A";
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(110, 382);
    ctx.quadraticCurveTo(W / 2, 362, W - 110, 386);
    ctx.stroke();
    ctx.font = `70px ${FUN}`;
    ctx.fillStyle = "#1A1A1A";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PREGUNTE →", W / 2, 452);
  });

/** Flour-dusted apron: cream cloth with white powder blotches and a pocket seam. */
const apronTexture = () =>
  canvasTexture("dormir-apron", 512, 192, (ctx, W, H) => {
    ctx.fillStyle = "#FFF4E2";
    ctx.fillRect(0, 0, W, H);
    const rnd = mulberry(17);
    for (let k = 0; k < 26; k++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const r = 8 + rnd() * 26;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // A floury fin print and a smear.
    ctx.fillStyle = "rgba(214,170,112,0.45)";
    ctx.beginPath();
    ctx.ellipse(W * 0.72, H * 0.5, 34, 22, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(200,150,90,0.25)";
    ctx.fillRect(W * 0.18, H * 0.62, 90, 12);
    ctx.strokeStyle = "rgba(170,120,70,0.5)";
    ctx.lineWidth = 6;
    ctx.setLineDash([12, 10]);
    ctx.strokeRect(W * 0.3, H * 0.3, 120, 80);
  });

/** Kitchen wall tiles (white with a teal band). */
const tileTexture = () =>
  canvasTexture(
    "dormir-tiles",
    256,
    256,
    (ctx, W, H) => {
      ctx.fillStyle = "#CFE3E6";
      ctx.fillRect(0, 0, W, H);
      for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = j === 1 ? "#5FC4C9" : "#F6FBFB";
          ctx.fillRect(i * 64 + 3, j * 64 + 3, 58, 58);
        }
      }
    },
    { wrapS: true, wrapT: true },
  );

// =======================================================================================
// The ground

/** Sidewalk (or a wooden hallway floor with `wood`), a big plane at y = 0. */
export const Ground: React.FC<{ wood?: boolean; center?: V3; size?: [number, number] }> = ({ wood = false, center = [0, 0, 2], size = [40, 22] }) => {
  const mat = useMemo(() => {
    const tex = (wood ? woodFloorTexture() : pavementTexture()).clone();
    tex.repeat.set(size[0] / (wood ? 2.4 : 1.6), size[1] / (wood ? 2.4 : 1.6));
    tex.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, emissive: new THREE.Color("#ffffff"), emissiveMap: tex, emissiveIntensity: 0.12 });
  }, [wood, size]);
  return (
    <mesh position={center} rotation={[-Math.PI / 2, 0, 0]} material={mat}>
      <planeGeometry args={size} />
    </mesh>
  );
};

// =======================================================================================
// Bread (shared by the shelves, the baskets and the counter)

const LOAF = "#E6A04E";
const loafGeo = (pos: V3, s: number, color: string, rot = 0) => [
  place(new THREE.SphereGeometry(1, 14, 10), color, pos, [0, rot, 0], [0.34 * s, 0.2 * s, 0.24 * s]),
  ...[-1, 0, 1].map((k) =>
    place(rbox(0.05, 0.03, 0.2, 0.012), shadeHex(color, -0.16), [pos[0] + Math.cos(rot) * k * 0.12 * s, pos[1] + 0.18 * s, pos[2] - Math.sin(rot) * k * 0.12 * s], [0.3, rot + 0.5, 0], [s, s, s]),
  ),
];
const baguetteGeo = (pos: V3, rot: V3, len: number, color = LOAF) => [
  place(new THREE.CapsuleGeometry(0.075, len, 4, 10), color, pos, rot),
];
const croissantGeo = (pos: V3, s: number, rotY: number) => [
  place(new THREE.TorusGeometry(0.14 * s, 0.065 * s, 8, 14, Math.PI * 1.25), "#EDA54A", pos, [Math.PI / 2, 0, rotY - Math.PI * 0.62], [1, 1, 0.8]),
];

// =======================================================================================
// The bakery and the restaurant (one vertex-coloured mesh), signs and awnings

const BAKERY_WALL = "#FFD27A";
const BAKERY_TRIM = "#9A5B2C";
const RESTO_WALL = "#7CC6F2";
const CREAM = "#FFF6E6";

const streetGeometry = once(() => {
  const geos: THREE.BufferGeometry[] = [];
  const z = BAKERY.facadeZ;
  const D = 0.4;
  const zc = z - D / 2;
  const { open } = BAKERY;
  // ---- Bakery facade with its open front.
  const B = BAKERY;
  geos.push(place(rbox(open.x0 - B.x0, open.h, D, 0.06), BAKERY_WALL, [(B.x0 + open.x0) / 2, open.h / 2, zc]));
  geos.push(place(rbox(B.x1 - open.x1, open.h, D, 0.06), BAKERY_WALL, [(B.x1 + open.x1) / 2, open.h / 2, zc]));
  geos.push(place(rbox(B.x1 - B.x0, B.height - open.h, D, 0.06), BAKERY_WALL, [(B.x0 + B.x1) / 2, (B.height + open.h) / 2, zc]));
  geos.push(place(rbox(B.x1 - B.x0 + 0.3, 0.36, D + 0.36, 0.1), CREAM, [(B.x0 + B.x1) / 2, B.height, zc]));
  geos.push(place(rbox(B.x1 - B.x0 + 0.04, 0.42, D + 0.08, 0.06), shadeHex(BAKERY_WALL, -0.18), [(B.x0 + B.x1) / 2, 0.21, zc]));
  // Wooden frame of the open front.
  geos.push(place(rbox(open.x1 - open.x0 + 0.4, 0.24, D + 0.14, 0.06), BAKERY_TRIM, [(open.x0 + open.x1) / 2, open.h + 0.06, zc]));
  for (const x of [open.x0, open.x1]) geos.push(place(rbox(0.22, open.h, D + 0.14, 0.06), BAKERY_TRIM, [x, open.h / 2, zc]));
  // Interior: back wall, side walls, floor, ceiling.
  const iw = open.x1 - open.x0;
  const ix = (open.x0 + open.x1) / 2;
  const idz = z - B.backZ;
  geos.push(place(new THREE.BoxGeometry(iw, open.h, 0.1), "#FBE6C4", [ix, open.h / 2, B.backZ]));
  for (const x of [open.x0 + 0.05, open.x1 - 0.05]) geos.push(place(new THREE.BoxGeometry(0.1, open.h, idz), "#F5D9AE", [x, open.h / 2, (z + B.backZ) / 2]));
  geos.push(place(new THREE.BoxGeometry(iw, 0.04, idz), "#E9C9A0", [ix, 0.02, (z + B.backZ) / 2]));
  geos.push(place(new THREE.BoxGeometry(iw, 0.1, idz), "#F2D2A6", [ix, open.h - 0.05, (z + B.backZ) / 2]));
  // Bread shelves on the back wall, full of loaves; a tall bin of baguettes on the left.
  const rnd = mulberry(3);
  for (const [k, y] of [1.15, 1.85, 2.55].entries()) {
    geos.push(place(rbox(iw - 0.5, 0.08, 0.5, 0.03), BAKERY_TRIM, [ix + 0.15, y, B.backZ + 0.3]));
    for (let x = open.x0 + 0.95; x < open.x1 - 0.35; x += 0.42) {
      const c = [LOAF, "#D88A3E", "#F0B868", "#C9772F"][Math.floor(rnd() * 4)];
      if (k === 1 && rnd() < 0.5) geos.push(...croissantGeo([x, y + 0.1, B.backZ + 0.32], 1.1, rnd() * 0.6 - 0.3));
      else geos.push(...loafGeo([x, y + 0.12, B.backZ + 0.32], 0.85 + rnd() * 0.2, c, rnd() * 0.5 - 0.25));
    }
  }
  geos.push(place(new THREE.CylinderGeometry(0.3, 0.25, 0.75, 16), "#B9773C", [open.x0 + 0.55, 0.38, B.backZ + 0.45]));
  for (let k = 0; k < 6; k++) {
    geos.push(...baguetteGeo([open.x0 + 0.4 + (k % 3) * 0.14, 0.95, B.backZ + 0.38 + Math.floor(k / 3) * 0.14], [0.12 * (k - 2.5), 0, 0.1 * ((k % 3) - 1)], 0.75));
  }
  // Upper floor: two windows with sills and a flower box.
  for (const x of [B.x0 + 1.25, B.x1 - 1.35]) {
    geos.push(place(rbox(1.15, 1.35, 0.14, 0.08), "#FFFFFF", [x, 4.95, z + 0.06]));
    geos.push(place(rbox(0.9, 1.1, 0.1, 0.05), "#A6DDFF", [x, 4.95, z + 0.1]));
    geos.push(place(rbox(0.07, 1.05, 0.04, 0.02), "#FFFFFF", [x, 4.95, z + 0.16]));
    geos.push(place(rbox(1.3, 0.14, 0.3, 0.05), "#FFFFFF", [x, 4.22, z + 0.12]));
    geos.push(place(rbox(1.0, 0.24, 0.3, 0.05), BAKERY_TRIM, [x, 4.38, z + 0.3]));
    for (let f = 0; f < 4; f++) {
      geos.push(place(new THREE.IcosahedronGeometry(0.13, 0), ["#FF4F7B", "#FFFFFF", "#FF8A3D", "#B57BFF"][f], [x - 0.36 + f * 0.24, 4.58, z + 0.32]));
      geos.push(place(new THREE.IcosahedronGeometry(0.1, 0), "#2FAE4E", [x - 0.24 + f * 0.24, 4.52, z + 0.26]));
    }
  }
  // A potted bay tree left of the shop and a lamp post between the shops.
  geos.push(place(rbox(0.75, 0.6, 0.75, 0.1), "#E07A4F", [B.x0 + 0.55, 0.3, z + 0.55]));
  geos.push(place(new THREE.CylinderGeometry(0.06, 0.08, 1.0, 8), "#7A4B2A", [B.x0 + 0.55, 1.1, z + 0.55]));
  geos.push(place(new THREE.IcosahedronGeometry(0.55, 1), "#3DBA5A", [B.x0 + 0.55, 1.75, z + 0.55]));
  const lx = (B.x1 + RESTO.x0) / 2 + 0.05;
  geos.push(place(new THREE.CylinderGeometry(0.08, 0.12, 4.0, 12), "#2B3A55", [lx, 2.0, z + 1.25]));
  geos.push(place(new THREE.CylinderGeometry(0.18, 0.24, 0.3, 14), "#2B3A55", [lx, 0.15, z + 1.25]));
  geos.push(place(new THREE.SphereGeometry(0.3, 16, 12), "#FFF4C2", [lx, 4.25, z + 1.25]));
  geos.push(place(new THREE.CylinderGeometry(0.34, 0.18, 0.15, 14), "#2B3A55", [lx, 4.57, z + 1.25]));

  // ---- Restaurant facade with its kitchen window, door and interior.
  const R = RESTO;
  const w = R.win;
  geos.push(place(rbox(R.x1 - R.x0, w.y0, D, 0.06), RESTO_WALL, [(R.x0 + R.x1) / 2, w.y0 / 2, zc]));
  geos.push(place(rbox(w.x0 - R.x0, w.y1 - w.y0, D, 0.06), RESTO_WALL, [(R.x0 + w.x0) / 2, (w.y0 + w.y1) / 2, zc]));
  geos.push(place(rbox(R.x1 - w.x1, w.y1 - w.y0, D, 0.06), RESTO_WALL, [(R.x1 + w.x1) / 2, (w.y0 + w.y1) / 2, zc]));
  geos.push(place(rbox(R.x1 - R.x0, R.height - w.y1, D, 0.06), RESTO_WALL, [(R.x0 + R.x1) / 2, (R.height + w.y1) / 2, zc]));
  geos.push(place(rbox(R.x1 - R.x0 + 0.3, 0.36, D + 0.36, 0.1), CREAM, [(R.x0 + R.x1) / 2, R.height, zc]));
  geos.push(place(rbox(R.x1 - R.x0 + 0.04, 0.42, D + 0.08, 0.06), shadeHex(RESTO_WALL, -0.2), [(R.x0 + R.x1) / 2, 0.21, zc]));
  // Window frame and sill.
  geos.push(place(rbox(w.x1 - w.x0 + 0.5, 0.16, 0.7, 0.05), "#FFFFFF", [(w.x0 + w.x1) / 2, w.y0, z + 0.05]));
  geos.push(place(rbox(w.x1 - w.x0 + 0.36, 0.2, D + 0.12, 0.05), "#FFFFFF", [(w.x0 + w.x1) / 2, w.y1 + 0.02, zc]));
  for (const x of [w.x0, w.x1]) geos.push(place(rbox(0.18, w.y1 - w.y0, D + 0.12, 0.05), "#FFFFFF", [x, (w.y0 + w.y1) / 2, zc]));
  // Door on the right with a round window.
  const dx = (w.x1 + R.x1) / 2 + 0.05;
  geos.push(place(rbox(1.0, 2.3, 0.12, 0.06), "#E3402B", [dx, 1.15, z + 0.06]));
  geos.push(place(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 20), "#A6DDFF", [dx, 1.6, z + 0.14], [Math.PI / 2, 0, 0]));
  geos.push(place(new THREE.SphereGeometry(0.06, 10, 8), "#FFD23F", [dx + 0.32, 1.05, z + 0.16]));
  // Interior: floor, side walls, ceiling, the range hood and a shelf of pots.
  const rw = w.x1 - w.x0;
  const rx = (w.x0 + w.x1) / 2;
  const rdz = z - R.backZ;
  geos.push(place(new THREE.BoxGeometry(rw, 0.04, rdz), "#B9C7CF", [rx, w.y0 - 0.05, (z + R.backZ) / 2]));
  for (const x of [w.x0 + 0.05, w.x1 - 0.05]) geos.push(place(new THREE.BoxGeometry(0.1, w.y1 - w.y0 + 1.2, rdz), "#E2EEF0", [x, (w.y0 + w.y1) / 2, (z + R.backZ) / 2]));
  geos.push(place(new THREE.BoxGeometry(rw, 0.1, rdz), "#E8F2F4", [rx, w.y1 + 0.02, (z + R.backZ) / 2]));
  geos.push(place(new THREE.CylinderGeometry(0.55, 1.1, 0.5, 4, 1), "#AEB8C2", [R.pot[0] + 0.15, 2.85, R.backZ + 0.75], [0, Math.PI / 4, 0], [1.25, 1, 0.8]));
  geos.push(place(rbox(1.5, 0.07, 0.35, 0.03), "#8D99A6", [rx + 0.9, 2.45, R.backZ + 0.22]));
  geos.push(place(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 14), "#E3402B", [rx + 0.5, 2.64, R.backZ + 0.22]));
  geos.push(place(new THREE.CylinderGeometry(0.16, 0.16, 0.24, 14), "#FFB020", [rx + 1.05, 2.61, R.backZ + 0.22]));
  geos.push(place(new THREE.CylinderGeometry(0.18, 0.18, 0.28, 14), "#4E7BEA", [rx + 1.5, 2.63, R.backZ + 0.22]));
  // Hanging ladle and spatula.
  geos.push(place(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 6), "#7D8894", [rx - 1.2, 2.2, R.backZ + 0.15]));
  geos.push(place(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), "#7D8894", [rx - 1.2, 1.9, R.backZ + 0.15]));
  geos.push(place(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 6), "#7D8894", [rx - 0.85, 2.2, R.backZ + 0.15]));
  geos.push(place(rbox(0.18, 0.22, 0.03, 0.02), "#7D8894", [rx - 0.85, 1.85, R.backZ + 0.15]));
  // Stove counter: steel body, dark top, two burners, knobs.
  const st = R.stove;
  geos.push(place(rbox(rw - 0.2, st.h, st.d, 0.04), "#C3CDD6", [rx, st.h / 2, st.z]));
  geos.push(place(rbox(rw - 0.16, 0.05, st.d + 0.04, 0.02), "#8A97A4", [rx, st.h, st.z]));
  for (const p of [R.pot, R.pan]) geos.push(place(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 20), "#2B2F38", [p[0], st.h + 0.03, p[2]]));
  for (let k = 0; k < 4; k++) geos.push(place(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 10), "#2B2F38", [w.x0 + 0.5 + k * 0.28, st.h - 0.2, st.z + st.d / 2 + 0.02], [Math.PI / 2, 0, 0]));
  // Upper floor windows.
  for (const x of [R.x0 + 1.3, (R.x0 + R.x1) / 2 + 0.2, R.x1 - 1.2]) {
    geos.push(place(rbox(1.1, 1.3, 0.14, 0.08), "#FFFFFF", [x, 5.15, z + 0.06]));
    geos.push(place(rbox(0.86, 1.06, 0.1, 0.05), "#A6DDFF", [x, 5.15, z + 0.1]));
    geos.push(place(rbox(1.26, 0.14, 0.28, 0.05), "#FFFFFF", [x, 4.45, z + 0.12]));
  }
  // ---- Neighbouring buildings (left and right), plain with windows.
  for (const [x0, x1, h, c] of [
    [-11, B.x0, 7.6, "#C9B3FF"],
    [R.x1, 16, 7.2, "#FFB0C8"],
  ] as [number, number, number, string][]) {
    geos.push(place(rbox(x1 - x0 - 0.06, h, 3, 0.15), c, [(x0 + x1) / 2, h / 2, z - 1.5]));
    for (let y = 1.6; y < h - 1; y += 2.1) {
      for (let x = x0 + 0.9; x < x1 - 0.5; x += 1.7) {
        geos.push(place(rbox(1.0, 1.25, 0.12, 0.06), "#FFFFFF", [x, y, z + 0.04]));
        geos.push(place(rbox(0.78, 1.02, 0.1, 0.04), shadeHex(c, -0.22), [x, y, z + 0.08]));
      }
    }
  }
  return mergeAll(geos);
});

const Awning: React.FC<{ x0: number; x1: number; y: number; depth: number; colors: [string, string]; slope?: number }> = ({ x0, x1, y, depth, colors, slope = 0.42 }) => {
  const w = x1 - x0;
  return (
    <group position={[(x0 + x1) / 2, y, BAKERY.facadeZ + 0.02]} rotation={[slope, 0, 0]}>
      <mesh position={[0, 0, depth / 2]}>
        <boxGeometry args={[w, 0.05, depth]} />
        <primitive object={texMat(stripeTexture(colors[0], colors[1], false), 0.6, 0.22)} attach="material" />
      </mesh>
      <mesh position={[0, -0.16, depth]} rotation={[-slope, 0, 0]}>
        <planeGeometry args={[w, 0.34]} />
        <primitive object={texMat(stripeTexture(colors[0], colors[1], true), 0.6, 0.22, true)} attach="material" />
      </mesh>
    </group>
  );
};

/**
 * The bakery corner: sidewalk, the bakery (open front, shelves of bread, PANADERÍA sign, striped
 * awning), the lamp post, the restaurant next door (kitchen window with its stove, RESTAURANTE
 * sign, red door), and the neighbouring buildings. The counter and its props are separate.
 */
export const BakeryStreet: React.FC = () => {
  const ready = useFontsReady();
  const tiles = useMemo(() => {
    const tex = tileTexture().clone();
    tex.repeat.set((RESTO.win.x1 - RESTO.win.x0) / 0.9, 3.4 / 0.9);
    tex.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, emissive: new THREE.Color("#ffffff"), emissiveMap: tex, emissiveIntensity: 0.22 });
  }, []);
  return (
    <group>
      <Ground center={[3, 0, 3]} size={[44, 14]} />
      <mesh geometry={streetGeometry()} material={vertexMat(0.55, false, 0.17)} />
      <mesh position={[(RESTO.win.x0 + RESTO.win.x1) / 2, (RESTO.win.y0 + RESTO.win.y1) / 2 + 0.3, RESTO.backZ]} material={tiles}>
        <planeGeometry args={[RESTO.win.x1 - RESTO.win.x0, 3.4]} />
      </mesh>
      <Awning x0={BAKERY.open.x0 - 0.2} x1={BAKERY.open.x1 + 0.2} y={4.55} depth={0.95} colors={["#FFF3D6", "#E0892F"]} />
      <Awning x0={RESTO.win.x0 - 0.2} x1={RESTO.win.x1 + 0.2} y={3.62} depth={0.85} colors={["#FFFFFF", "#E3262B"]} />
      {ready ? (
        <>
          <mesh position={BAKERY.sign}>
            <planeGeometry args={[3.9, 0.975]} />
            <primitive object={texMat(shopSignTexture("PANADERÍA", "#9A5B2C", "#FFE7A8", true), 0.5, 0.32)} attach="material" />
          </mesh>
          <mesh position={RESTO.sign}>
            <planeGeometry args={[3.6, 0.9]} />
            <primitive object={texMat(shopSignTexture("RESTAURANTE", "#E3262B", "#FFFFFF", false), 0.5, 0.32)} attach="material" />
          </mesh>
        </>
      ) : null}
    </group>
  );
};

// =======================================================================================
// The bakery counter and its props

const counterGeometry = once(() => {
  const { w, d, h } = BAKERY.counter;
  const geos: THREE.BufferGeometry[] = [];
  // Wooden body, cream top, a kick plate; the glass case of croissants on the right of the front.
  geos.push(place(rbox(w, h - 0.08, d, 0.06), "#C98A4E", [0, (h - 0.08) / 2, 0]));
  geos.push(place(rbox(w + 0.12, 0.09, d + 0.12, 0.04), CREAM, [0, h - 0.045, 0]));
  geos.push(place(rbox(w - 0.04, 0.14, d + 0.02, 0.04), "#8F5728", [0, 0.07, 0]));
  // Front panels: planks on the left, the croissant case on the right.
  const caseX0 = -0.05;
  const caseX1 = w / 2 - 0.12;
  for (let x = -w / 2 + 0.18; x < caseX0 - 0.05; x += 0.26) geos.push(place(rbox(0.04, h - 0.32, 0.03, 0.01), "#B07440", [x, h / 2 - 0.02, d / 2 + 0.01]));
  geos.push(place(rbox(caseX1 - caseX0 + 0.08, 0.7, 0.06, 0.03), "#8F5728", [(caseX0 + caseX1) / 2, 0.56, d / 2 + 0.01]));
  geos.push(place(rbox(caseX1 - caseX0 - 0.08, 0.56, 0.04, 0.02), "#FFF1DA", [(caseX0 + caseX1) / 2, 0.56, d / 2 + 0.02]));
  geos.push(place(rbox(caseX1 - caseX0 - 0.1, 0.05, 0.2, 0.02), "#FFFFFF", [(caseX0 + caseX1) / 2, 0.36, d / 2 + 0.08]));
  for (let k = 0; k < 5; k++) {
    const x = caseX0 + 0.22 + k * ((caseX1 - caseX0 - 0.4) / 4);
    geos.push(...croissantGeo([x, 0.45 + (k % 2) * 0.03, d / 2 + 0.1], 1.25, 0.2 * (k - 2)));
    if (k < 4) geos.push(...loafGeo([x + 0.16, 0.72, d / 2 + 0.08], 0.6, k % 2 ? "#F0B868" : "#D88A3E", 0));
  }
  return mergeAll(geos);
});

/** Glass of the croissant case (a see-through pane, drawn after the solid set). */
const glassMat = once(
  () =>
    new THREE.MeshStandardMaterial({
      color: "#CFF1FF",
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: 0.22,
      emissive: new THREE.Color("#CFF1FF"),
      emissiveIntensity: 0.25,
      depthWrite: false,
    }),
);

/** The sidewalk counter (origin = floor centre, front = +z), with the croissant case on its front. */
export const BakeryCounter: React.FC = () => {
  const { w, d } = BAKERY.counter;
  return (
    <group>
      <BlobShadow radius={w * 0.55} opacity={0.22} stretch={0.35} />
      <mesh geometry={counterGeometry()} material={vertexMat(0.55, false, 0.16)} />
      <mesh position={[(-0.05 + w / 2 - 0.12) / 2, 0.56, d / 2 + 0.2]} material={glassMat()} renderOrder={2}>
        <boxGeometry args={[w / 2 - 0.1, 0.62, 0.02]} />
      </mesh>
    </group>
  );
};

const basketGeometry = once(() => {
  const geos: THREE.BufferGeometry[] = [];
  geos.push(place(new THREE.CylinderGeometry(0.34, 0.27, 0.22, 18), "#B9773C", [0, 0.11, 0], [0, 0, 0], [1, 1, 0.75]));
  geos.push(place(new THREE.TorusGeometry(0.34, 0.035, 6, 24), "#8F5728", [0, 0.22, 0], [Math.PI / 2, 0, 0], [1, 0.75, 1]));
  geos.push(place(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 16), "#FFF6E6", [0, 0.2, 0], [0, 0, 0], [1, 1, 0.75]));
  geos.push(...loafGeo([-0.12, 0.27, 0.02], 0.7, LOAF, 0.3));
  geos.push(...loafGeo([0.13, 0.28, -0.04], 0.68, "#D88A3E", -0.4));
  geos.push(...baguetteGeo([0.02, 0.42, -0.08], [0.35, 0, 0.9], 0.55, "#F0B868"));
  return mergeAll(geos);
});

/** A wicker basket of bread (origin = its base). */
export const BreadBasket: React.FC = () => <mesh geometry={basketGeometry()} material={vertexMat(0.6, false, 0.16)} />;

const registerGeometry = once(() => {
  const geos: THREE.BufferGeometry[] = [];
  const red = "#E8473B";
  geos.push(place(rbox(0.62, 0.16, 0.48, 0.05), "#2B2F38", [0, 0.08, 0]));
  geos.push(place(rbox(0.58, 0.28, 0.44, 0.07), red, [0, 0.3, -0.02]));
  geos.push(place(rbox(0.5, 0.14, 0.3, 0.05), red, [0, 0.48, -0.06], [-0.5, 0, 0]));
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) geos.push(place(rbox(0.07, 0.04, 0.06, 0.015), j === 2 && i === 3 ? "#FFD23F" : CREAM, [-0.15 + i * 0.1, 0.5 + j * 0.04, 0.05 - j * 0.06], [-0.5, 0, 0]));
  // Pop-up price display.
  geos.push(place(rbox(0.06, 0.2, 0.06, 0.02), "#2B2F38", [0.12, 0.62, -0.15]));
  geos.push(place(rbox(0.3, 0.14, 0.06, 0.03), "#2B2F38", [0.12, 0.76, -0.15]));
  geos.push(place(rbox(0.25, 0.09, 0.02, 0.02), "#7CFFB0", [0.12, 0.76, -0.115]));
  // Drawer and its knob.
  geos.push(place(rbox(0.5, 0.08, 0.03, 0.02), shadeHex(red, -0.15), [0, 0.17, 0.24]));
  geos.push(place(new THREE.SphereGeometry(0.03, 8, 6), "#FFD23F", [0, 0.17, 0.27]));
  return mergeAll(geos);
});

/** A retro red cash register (origin = its base, facing +z). */
export const CashRegister: React.FC = () => <mesh geometry={registerGeometry()} material={vertexMat(0.4, false, 0.16)} />;

/** The service bell (origin = its base). `press` 0..1 pushes the plunger down. */
export const ServiceBell: React.FC<{ press?: number }> = ({ press = 0 }) => {
  const gold = toy("#FFC21A", { metal: 0.55, rough: 0.25, glow: 0.24 });
  const dark = toy("#2B2F38", { rough: 0.4 });
  return (
    <group>
      <mesh material={dark} position={[0, 0.025, 0]}>
        <cylinderGeometry args={[0.2, 0.22, 0.05, 24]} />
      </mesh>
      <mesh material={gold} position={[0, 0.05, 0]} scale={[1, 0.85 - 0.12 * press, 1]}>
        <sphereGeometry args={[0.17, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh material={gold} position={[0, 0.21 - 0.05 * press, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.08, 8]} />
      </mesh>
      <mesh material={gold} position={[0, 0.26 - 0.05 * press, 0]}>
        <sphereGeometry args={[0.04, 12, 8]} />
      </mesh>
    </group>
  );
};

/**
 * The bell's "ding": short rays around it and a ring, for `age` frames after the hit (0 = hit).
 * Drawn in world units around the bell's top.
 */
export const DingLines: React.FC<{ age: number; size?: number }> = ({ age, size = 1 }) => {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#FFE15A", transparent: true, depthWrite: false, toneMapped: false }), []);
  if (age < 0 || age > 12) return null;
  const k = clamp01(age / 12);
  mat.opacity = 1 - k * k;
  const r0 = (0.32 + 0.35 * Math.sqrt(k)) * size;
  return (
    <group renderOrder={6}>
      {[-1.2, -0.6, 0, 0.6, 1.2].map((a, i) => (
        <mesh key={i} material={mat} position={[Math.sin(a) * r0, 0.2 + Math.cos(a) * r0 * 0.9, 0.05]} rotation={[0, 0, -a]}>
          <capsuleGeometry args={[0.03 * size, 0.2 * size * (1 - 0.5 * k), 3, 6]} />
        </mesh>
      ))}
    </group>
  );
};

/** The counter chalkboard on a little easel (origin = its base, facing +z). */
export const Chalkboard: React.FC = () => {
  const ready = useFontsReady();
  const wood = toy("#8F5728", { rough: 0.7 });
  return (
    <group rotation={[-0.12, 0, 0]}>
      <mesh material={wood} position={[0, 0.03, -0.12]}>
        <boxGeometry args={[0.5, 0.06, 0.28]} />
      </mesh>
      <mesh material={wood} position={[0, 0.4, -0.16]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[0.06, 0.8, 0.04]} />
      </mesh>
      {ready ? (
        <mesh position={[0, 0.46, 0]}>
          <planeGeometry args={[0.66, 0.77]} />
          <primitive object={texMat(chalkTexture(), 0.8, 0.26)} attach="material" />
        </mesh>
      ) : null}
    </group>
  );
};

/** The single loaf Nubi wants (origin = its base on the counter). */
const bigLoafGeometry = once(() => mergeAll(loafGeo([0, 0.13, 0], 1.25, "#E9A24F", 0.15)));
export const Loaf: React.FC = () => <mesh geometry={bigLoafGeometry()} material={vertexMat(0.6, false, 0.18)} />;

/**
 * The «S/100» price flag on a toothpick (origin = where the pick enters the loaf). `pop` 0..1+
 * springs it up (scale), `wobble` rocks it after the slap.
 */
export const PriceFlag: React.FC<{ pop?: number; wobble?: number }> = ({ pop = 1, wobble = 0 }) => {
  const ready = useFontsReady();
  if (pop <= 0.01) return null;
  const s = Math.max(0, pop);
  return (
    <group scale={[s, s, s]} rotation={[0, 0, wobble]}>
      <mesh material={toy("#F2D9A6", { rough: 0.7 })} position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.56, 6]} />
      </mesh>
      {ready ? (
        <mesh position={[0, 0.62, 0.01]}>
          <planeGeometry args={[0.72, 0.42]} />
          <primitive object={texMat(priceTexture(), 0.6, 0.3)} attach="material" />
        </mesh>
      ) : null}
    </group>
  );
};

/** Steam puffs rising from a pot (origin = the pot's lid), looping with `t`. */
export const Steam: React.FC<{ t: number; amount?: number }> = ({ t, amount = 1 }) => {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#FFFFFF", transparent: true, depthWrite: false, roughness: 1, emissive: new THREE.Color("#FFFFFF"), emissiveIntensity: 0.5 }), []);
  mat.opacity = 0.55 * amount;
  return (
    <group>
      {[0, 1, 2, 3].map((i) => {
        const u = (t * 0.55 + i * 0.25) % 1;
        const s = 0.1 + 0.22 * u;
        return (
          <mesh key={i} material={mat} position={[Math.sin(u * 5 + i) * 0.1, 0.1 + u * 1.0, 0]} scale={[s, s * 0.85, s]}>
            <sphereGeometry args={[1, 12, 8]} />
          </mesh>
        );
      })}
    </group>
  );
};

/** The stove's pot (red, with a lid) and the frying pan with an egg (origins = burner tops). */
export const StovePot: React.FC = () => (
  <group>
    <mesh material={toy("#E3402B", { rough: 0.35, glow: 0.18 })} position={[0, 0.22, 0]}>
      <cylinderGeometry args={[0.28, 0.26, 0.42, 22]} />
    </mesh>
    <mesh material={toy("#C3CDD6", { rough: 0.3, metal: 0.3 })} position={[0, 0.45, 0]}>
      <cylinderGeometry args={[0.3, 0.3, 0.04, 22]} />
    </mesh>
    <mesh material={toy("#2B2F38")} position={[0, 0.5, 0]}>
      <sphereGeometry args={[0.05, 10, 8]} />
    </mesh>
  </group>
);
export const FryingPan: React.FC = () => (
  <group>
    <mesh material={toy("#2B2F38", { rough: 0.35 })} position={[0, 0.05, 0]}>
      <cylinderGeometry args={[0.3, 0.25, 0.08, 22]} />
    </mesh>
    <mesh material={toy("#2B2F38", { rough: 0.35 })} position={[0.48, 0.07, 0.1]} rotation={[0, -0.2, Math.PI / 2]}>
      <capsuleGeometry args={[0.035, 0.32, 3, 8]} />
    </mesh>
    <mesh material={toy("#FFFFFF", { rough: 0.5, glow: 0.25 })} position={[0, 0.095, 0]} scale={[1, 0.25, 0.85]}>
      <sphereGeometry args={[0.18, 16, 8]} />
    </mesh>
    <mesh material={toy("#FFC21A", { rough: 0.35, glow: 0.3 })} position={[0.02, 0.12, 0.02]} scale={[1, 0.6, 1]}>
      <sphereGeometry args={[0.07, 12, 8]} />
    </mesh>
  </group>
);

// =======================================================================================
// Faces: eyelids, brows, the snot bubble (model units of a Nubi, children of <Nubi>)

/** Where an eye is drawn for this pose (model units), as Nubi draws it. */
const eyeShape = (pose: NubiPose) => {
  const eyeScale = pose.eyeScale ?? 1;
  const eyeH = Math.max(0.1, (1 - (pose.blink ?? 0)) * eyeScale);
  const eyeW = Math.min(1.35, Math.max(0.8, eyeScale));
  return { ex: (pose.lookX ?? 0) * 0.5, ey: 5.5 + (pose.lookY ?? 0) * 0.4, eh: 1.75 * eyeH, eyeW, blink: pose.blink ?? 0 };
};
const lidGeo = once(() => rbox(1, 1, 0.22, 0.1, 2));

/**
 * Eyelids over the top `droop` (0..1) of each eye, coloured like the body. `tilt` > 0 drops the
 * outer corners (sleepy, sad), < 0 drops the inner corners (grumpy). Wide eyes lift them.
 */
export const Lids: React.FC<{ pose: NubiPose; droop: number; tilt?: number; color: string }> = ({ pose, droop, tilt = 0, color }) => {
  const { ex, ey, eh, eyeW, blink } = eyeShape(pose);
  const wide = clamp01(((pose.eyeScale ?? 1) - 1.05) / 0.3);
  const d = droop * (1 - blink) * (1 - wide * 0.8);
  if (d < 0.03) return null;
  const mat = toy(color, { rough: 0.42, glow: 0.14 });
  return (
    <group>
      {[-1, 1].map((side) => {
        const lh = d * eh + 0.2;
        return (
          <mesh
            key={side}
            geometry={lidGeo()}
            material={mat}
            position={[side * 2.3 + ex, ey + eh / 2 - lh / 2 + 0.16, 4.8]}
            rotation={[0, 0, -side * tilt]}
            scale={[1.05 * eyeW + 0.55, lh, 1]}
          />
        );
      })}
    </group>
  );
};

/** Two dark brows above the eyes; `raise` lifts the screen-right one (cocky), `tilt` angles both. */
export const Brows: React.FC<{ pose: NubiPose; raise?: number; tilt?: number; color?: string }> = ({ pose, raise = 0, tilt = 0, color = "#2B2F3A" }) => {
  const { ex, ey, eh } = eyeShape(pose);
  const mat = toy(color, { rough: 0.5, glow: 0.08 });
  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          geometry={lidGeo()}
          material={mat}
          position={[side * 2.3 + ex, ey + Math.max(eh, 0.6) / 2 + 0.55 + (side > 0 ? raise : 0), 4.72]}
          rotation={[0, 0, -side * tilt + (side > 0 ? -0.25 * raise : 0)]}
          scale={[1.7, 0.36, 0.8]}
        />
      ))}
    </group>
  );
};

/**
 * A snot bubble growing from the face (model units): `size` 0..1 inflates it, `burst` 0..1 pops it
 * (a quick swell and fade). Hidden at size 0.
 */
export const SnotBubble: React.FC<{ size: number; burst?: number; at?: V3 }> = ({ size, burst = 0, at = [0.9, 4.15, 4.55] }) => {
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#BDEBFF",
        transparent: true,
        opacity: 0.5,
        roughness: 0.1,
        emissive: new THREE.Color("#BDEBFF"),
        emissiveIntensity: 0.35,
        depthWrite: false,
      }),
    [],
  );
  const hi = useMemo(() => new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }), []);
  if (size <= 0.02 || burst >= 1) return null;
  const r = (0.35 + 1.25 * size) * (1 + 0.5 * burst);
  mat.opacity = 0.5 * (1 - burst);
  hi.opacity = 0.9 * (1 - burst);
  return (
    <group position={[at[0], at[1] - r * 0.25, at[2] + r * 0.85]}>
      <mesh material={mat} scale={[r, r, r]} renderOrder={3}>
        <sphereGeometry args={[1, 20, 14]} />
      </mesh>
      <mesh material={hi} position={[-r * 0.38, r * 0.4, r * 0.82]} scale={[r * 0.2, r * 0.14, r * 0.05]} renderOrder={4}>
        <sphereGeometry args={[1, 10, 8]} />
      </mesh>
    </group>
  );
};

// =======================================================================================
// The baker

export const BAKER_TAN = "#D9A066";
export const BAKER_PALETTE: NubiPalette = { body: BAKER_TAN, fins: "#E2AE78", legs: "#C68A50" };
export const BAKER_SIZE = 2.1;
/** Chubby: the baker is wider and deeper than a Nubi of his size. */
export const BAKER_CHUB: V3 = [1.16, 1, 1.1];
/** Model-unit height of the top of his hat (body top 9.9 + the hat), for counters and zzz. */
export const BAKER_HAT_TOP = 17.4;

const hatGeos = once(() => {
  // Tall pleated baker's hat: band, pleated column widening upwards, puffy top.
  const column = new THREE.CylinderGeometry(3.55, 3.15, 5.2, 40, 3, true);
  const p = column.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 + 0.05 * Math.cos(a * 14);
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  column.computeVertexNormals();
  const top = new THREE.SphereGeometry(3.85, 32, 14);
  const tp = top.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < tp.count; i++) {
    const a = Math.atan2(tp.getZ(i), tp.getX(i));
    const k = 1 + 0.06 * Math.cos(a * 7);
    tp.setX(i, tp.getX(i) * k);
    tp.setZ(i, tp.getZ(i) * k);
  }
  top.computeVertexNormals();
  return {
    band: new THREE.CylinderGeometry(3.2, 3.25, 1.3, 32),
    column,
    top,
    apron: rbox(8.8, 2.3, 0.4, 0.18),
    strap: rbox(1.1, 4.4, 0.36, 0.16),
    lobe: new THREE.SphereGeometry(1, 16, 10),
    curl: new THREE.TorusGeometry(0.42, 0.2, 8, 14, Math.PI * 1.4),
    dust: new THREE.SphereGeometry(1, 10, 6),
  };
});

/**
 * The baker's gear (model units): the tall hat (`flop` tips it over when he sleeps), the curly
 * moustache (`twitch` flutters it on the snore, `lift` raises it in the yawn), the flour-dusted
 * apron, flour on his cheek, and his lids (`droop`, `tilt` < 0 = grumpy).
 */
export const BakerGear: React.FC<{ pose: NubiPose; flop?: number; twitch?: number; lift?: number; droop?: number; tilt?: number }> = ({
  pose,
  flop = 0,
  twitch = 0,
  lift = 0,
  droop = 0,
  tilt = 0,
}) => {
  const ready = useFontsReady();
  const g = hatGeos();
  const white = toy("#FFFFFF", { rough: 0.65, glow: 0.22 });
  const stache = toy("#5A3418", { rough: 0.6, glow: 0.1 });
  const flour = toy("#FFFFFF", { rough: 0.9, glow: 0.3 });
  return (
    <group>
      {/* Hat: pivots at the back of the head so it tips forward and sideways. */}
      <group position={[0, 9.7, -1.0]} rotation={[0.35 * flop, 0, -0.45 * flop]}>
        <group position={[0, 0, 1.0]}>
          <mesh geometry={g.band} material={white} position={[0, 0.65, 0]} />
          <mesh geometry={g.column} material={white} position={[0, 3.85, 0]} />
          <mesh geometry={g.top} material={white} position={[0, 6.45, 0]} scale={[1, 0.38, 1]} />
        </group>
      </group>
      {/* Moustache: two fat lobes with curled tips, under the eyes. */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 1.15, 4.0 + 0.25 * lift, 4.55]} rotation={[0, 0, s * (0.28 + 0.18 * twitch + 0.3 * lift)]}>
          <mesh geometry={g.lobe} material={stache} position={[s * 0.4, 0, 0.1]} scale={[1.45, 0.62, 0.5]} />
          <mesh geometry={g.curl} material={stache} position={[s * 1.75, 0.35, 0.1]} rotation={[0, s > 0 ? 0 : Math.PI, -0.6]} />
        </group>
      ))}
      {/* Flour-dusted apron and its straps. */}
      {ready ? (
        <mesh position={[0, 3.25, 4.62]}>
          <planeGeometry args={[8.8, 2.3]} />
          <primitive object={texMat(apronTexture(), 0.8, 0.22)} attach="material" />
        </mesh>
      ) : null}
      <mesh geometry={g.apron} material={toy("#FFF4E2", { rough: 0.8, glow: 0.18 })} position={[0, 3.25, 4.4]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={g.strap} material={toy("#FFF4E2", { rough: 0.8, glow: 0.18 })} position={[s * 4.35, 6.4, 4.42]} />
      ))}
      {/* Flour on the cheek and forehead. */}
      <mesh geometry={g.dust} material={flour} position={[3.5, 7.6, 4.42]} scale={[0.75, 0.5, 0.12]} />
      <mesh geometry={g.dust} material={flour} position={[-3.6, 4.6, 4.42]} scale={[0.55, 0.38, 0.12]} />
      <mesh geometry={g.dust} material={flour} position={[-1.2, 8.7, 4.42]} scale={[0.4, 0.3, 0.12]} />
      <Lids pose={pose} droop={droop} tilt={tilt} color={shadeHex(BAKER_TAN, -0.06)} />
    </group>
  );
};

/** The baker: a chubby tan Nubi with his gear. Extra gear (the snot bubble) goes in children. */
export const Baker: React.FC<{
  position?: V3;
  rotationY?: number;
  pose?: NubiPose;
  flop?: number;
  twitch?: number;
  lift?: number;
  droop?: number;
  tilt?: number;
  holdR?: React.ReactNode;
  holdL?: React.ReactNode;
  shadow?: boolean;
  children?: React.ReactNode;
}> = ({ position = [0, 0, 0], rotationY = 0, pose = {}, flop, twitch, lift, droop, tilt, holdR, holdL, shadow = false, children }) => (
  <group position={position} rotation={[0, rotationY, 0]} scale={BAKER_CHUB}>
    <Nubi size={BAKER_SIZE} pose={pose} palette={{ ...BAKER_PALETTE, eyeRough: 0.5 }} holdR={holdR} holdL={holdL} shadow={shadow}>
      <BakerGear pose={pose} flop={flop} twitch={twitch} lift={lift} droop={droop} tilt={tilt} />
      {children}
    </Nubi>
  </group>
);

// =======================================================================================
// The cook

export const COOK_PALETTE: NubiPalette = { body: "#F3EFE6", fins: "#FAF7F0", legs: "#E0DACD", eyeRough: 0.5 };
export const COOK_SIZE = 2.0;
/** Model-unit height of the top of his toque. */
export const COOK_HAT_TOP = 15.2;

const cookGeos = once(() => ({
  band: new THREE.CylinderGeometry(3.7, 3.7, 1.8, 28),
  puff: new THREE.SphereGeometry(1, 18, 12),
  scarf: rbox(10.6, 1.0, 9.4, 0.48),
  knot: new THREE.ConeGeometry(1.1, 2.0, 4).rotateX(Math.PI).rotateY(Math.PI / 4),
}));

/** The cook's toque (puffy), red neckerchief and its knot (model units). `flop` tips the toque. */
export const CookGear: React.FC<{ flop?: number }> = ({ flop = 0 }) => {
  const g = cookGeos();
  const white = toy("#FFFFFF", { rough: 0.6, glow: 0.22 });
  const red = toy("#E3262B", { rough: 0.65, glow: 0.18 });
  return (
    <group>
      <group position={[0, 9.7, -1.0]} rotation={[0.3 * flop, 0, 0.5 * flop]}>
        <group position={[0, 0, 1.0]}>
          <mesh geometry={g.band} material={white} position={[0, 0.9, 0]} />
          {[
            [0, 3.1, 0, 2.6],
            [-2.0, 2.6, 0, 2.0],
            [2.0, 2.6, 0, 2.0],
            [0, 2.6, 1.8, 2.0],
            [0, 2.6, -1.9, 2.0],
          ].map(([x, y, z, r], i) => (
            <mesh key={i} geometry={g.puff} material={white} position={[x, y, z]} scale={r} />
          ))}
        </group>
      </group>
      <mesh geometry={g.scarf} material={red} position={[0, 2.9, 0]} />
      <mesh geometry={g.knot} material={red} position={[2.6, 2.0, 4.7]} rotation={[0.2, 0, 0.2]} />
    </group>
  );
};

/** The cook: a white-ish Nubi with his toque and neckerchief. */
export const Cook: React.FC<{ position?: V3; rotationY?: number; pose?: NubiPose; flop?: number; shadow?: boolean; children?: React.ReactNode }> = ({
  position = [0, 0, 0],
  rotationY = 0,
  pose = {},
  flop = 0,
  shadow = false,
  children,
}) => (
  <Nubi size={COOK_SIZE} position={position} rotationY={rotationY} pose={pose} palette={COOK_PALETTE} shadow={shadow}>
    <CookGear flop={flop} />
    {children}
  </Nubi>
);

// =======================================================================================
// The neighbour, his drill and his speaker

export const VECINO_GREY = "#7F8FA6";
export const VECINO_PALETTE: NubiPalette = { body: VECINO_GREY, fins: "#8C9BB0", legs: "#6E7D93", eyeRough: 0.5 };
export const VECINO_SIZE = 2.1;

const capGeos = once(() => ({
  crown: new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  bill: rbox(5.0, 0.32, 3.0, 0.15),
  button: new THREE.SphereGeometry(0.5, 12, 8),
  strap: rbox(2.4, 0.9, 0.3, 0.12),
}));

/** Backwards cap (red, the bill at the back), smug lids and brows (model units). */
export const VecinoGear: React.FC<{ pose: NubiPose; droop?: number; raise?: number }> = ({ pose, droop = 0.5, raise = 0 }) => {
  const g = capGeos();
  const cap = toy("#E8423F", { rough: 0.5, glow: 0.16 });
  return (
    <group>
      <group rotation={[0, 0, -0.06]}>
        <mesh geometry={g.crown} material={cap} position={[0, 9.55, 0.1]} scale={[4.7, 2.0, 4.4]} />
        <mesh geometry={g.bill} material={cap} position={[0, 9.7, -4.6]} rotation={[-0.14, 0, 0]} />
        <mesh geometry={g.button} material={toy("#FFFFFF", { rough: 0.5, glow: 0.2 })} position={[0, 11.55, 0.1]} />
        <mesh geometry={g.strap} material={toy("#FFFFFF", { rough: 0.5, glow: 0.2 })} position={[0, 10.0, 4.45]} />
      </group>
      <Lids pose={pose} droop={droop} tilt={0.05} color={shadeHex(VECINO_GREY, -0.08)} />
      <Brows pose={pose} raise={raise} tilt={-0.08} />
    </group>
  );
};

/** The neighbour: a blue-grey Nubi with a backwards cap and a smug, half-lidded look. */
export const Vecino: React.FC<{
  position?: V3;
  rotationY?: number;
  pose?: NubiPose;
  droop?: number;
  raise?: number;
  holdR?: React.ReactNode;
  holdL?: React.ReactNode;
}> = ({ position = [0, 0, 0], rotationY = 0, pose = {}, droop, raise, holdR, holdL }) => (
  <Nubi size={VECINO_SIZE} position={position} rotationY={rotationY} pose={pose} palette={VECINO_PALETTE} holdR={holdR} holdL={holdL} shadowOpacity={0.4}>
    <VecinoGear pose={pose} droop={droop} raise={raise} />
  </Nubi>
);

const drillGeometry = once(() => {
  const geos: THREE.BufferGeometry[] = [];
  const yellow = "#FFB81C";
  const dark = "#2B2F38";
  // Motor body along +x, the chuck and the (still) bit, the pistol grip, the trigger.
  geos.push(place(new THREE.CapsuleGeometry(0.19, 0.62, 6, 16), yellow, [0, 0, 0], [0, 0, Math.PI / 2]));
  geos.push(place(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 16), dark, [-0.42, 0, 0], [0, 0, Math.PI / 2]));
  for (let k = 0; k < 4; k++) geos.push(place(rbox(0.05, 0.04, 0.3, 0.01), dark, [-0.22 + k * 0.08, 0.17, 0], [0, 0, 0]));
  geos.push(place(new THREE.CylinderGeometry(0.13, 0.1, 0.24, 16), dark, [0.5, 0, 0], [0, 0, Math.PI / 2]));
  geos.push(place(new THREE.CylinderGeometry(0.035, 0.03, 0.5, 8), "#C9D2DC", [0.86, 0, 0], [0, 0, Math.PI / 2]));
  for (let k = 0; k < 5; k++) geos.push(place(new THREE.TorusGeometry(0.036, 0.012, 4, 10), "#8D99A6", [0.7 + k * 0.07, 0, 0], [0, Math.PI / 2 + 0.5, 0]));
  geos.push(place(rbox(0.22, 0.62, 0.26, 0.09), dark, [-0.12, -0.36, 0], [0, 0, -0.22]));
  geos.push(place(rbox(0.26, 0.12, 0.3, 0.05), yellow, [-0.2, -0.68, 0], [0, 0, -0.22]));
  geos.push(place(rbox(0.07, 0.14, 0.1, 0.03), "#E3262B", [0.04, -0.17, 0], [0, 0, -0.3]));
  return mergeAll(geos);
});

/** The cord (origin = where it leaves the grip, hanging along −y) and its unplugged plug. */
const cordGeometry = once(() => {
  const dark = "#2B2F38";
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.04, -0.2, 0.05),
    new THREE.Vector3(0.05, -0.45, 0.08),
    new THREE.Vector3(0.14, -0.62, 0.05),
    new THREE.Vector3(0.17, -0.74, 0.02),
  ]);
  return mergeAll([
    place(new THREE.TubeGeometry(curve, 20, 0.028, 6, false), dark, [0, 0, 0]),
    place(rbox(0.14, 0.2, 0.1, 0.04), dark, [0.18, -0.84, 0.02], [0, 0, 0.12]),
    ...[-1, 1].map((s) => place(new THREE.BoxGeometry(0.025, 0.12, 0.012), "#E8E8E8", [0.19 + s * 0.035, -0.98, 0.02], [0, 0, 0.12])),
  ]);
});

/**
 * The power drill (origin = the grip, the bit along +x). It never spins; its cord hangs from the
 * grip to a plug that dangles free (`hang` turns the cord about the grip so it hangs plumb,
 * `swing` rocks it).
 */
export const Drill: React.FC<{ hang?: number; swing?: number }> = ({ hang = 0, swing = 0 }) => (
  <group>
    <mesh geometry={drillGeometry()} material={vertexMat(0.4, false, 0.18)} />
    <group position={[-0.27, -0.74, 0]} rotation={[swing * 0.5, 0, hang + swing]}>
      <mesh geometry={cordGeometry()} material={vertexMat(0.4, false, 0.12)} />
    </group>
  </group>
);

const speakerGeometry = once(() => {
  const geos: THREE.BufferGeometry[] = [];
  geos.push(place(rbox(0.9, 0.62, 0.46, 0.2, 3), "#22B8CF", [0, 0.31, 0]));
  geos.push(place(rbox(0.94, 0.08, 0.5, 0.04), "#1D2430", [0, 0.04, 0]));
  geos.push(place(new THREE.TorusGeometry(0.24, 0.05, 8, 24), "#1D2430", [0, 0.33, 0.235]));
  // Carry strap and buttons.
  geos.push(place(new THREE.TorusGeometry(0.2, 0.04, 6, 16, Math.PI), "#1D2430", [0, 0.62, 0], [0, 0, 0]));
  for (let k = 0; k < 3; k++) geos.push(place(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 10), k === 1 ? "#FF4F7B" : "#FFFFFF", [-0.3 + k * 0.08, 0.6, 0.12]));
  return mergeAll(geos);
});

/**
 * The Bluetooth speaker (origin = its base, the cone facing +z), blasting: `beat` 0..1 pumps the
 * cone and shakes the box, and its LED glows.
 */
export const Speaker: React.FC<{ beat?: number; on?: number }> = ({ beat = 0, on = 1 }) => {
  const b = beat * on;
  return (
    <group position={[Math.sin(b * 37) * 0.012 * b, 0.015 * b, 0]} scale={[1 + 0.03 * b, 1 - 0.02 * b, 1]}>
      <mesh geometry={speakerGeometry()} material={vertexMat(0.45, false, 0.18)} />
      <mesh material={toy("#3A4250", { rough: 0.45 })} position={[0, 0.33, 0.22 + 0.05 * b]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1 + 0.6 * b, 1]}>
        <coneGeometry args={[0.22, 0.12, 24, 1, true]} />
      </mesh>
      <mesh material={toy("#5A6474", { rough: 0.4 })} position={[0, 0.33, 0.25 + 0.08 * b]}>
        <sphereGeometry args={[0.07, 14, 10]} />
      </mesh>
      <mesh material={toy("#7CFFB0", { rough: 0.3, glow: 0.4 + 0.8 * b })} position={[0.33, 0.12, 0.235]}>
        <sphereGeometry args={[0.03, 8, 6]} />
      </mesh>
    </group>
  );
};

/**
 * Sound-wave rings leaving the speaker towards +z (origin = the cone), one every `every` frames
 * while `on`, each growing and fading over `life` frames.
 */
export const SoundRings: React.FC<{ g: number; on?: number; every?: number; life?: number; reach?: number; color?: string }> = ({
  g,
  on = 1,
  every = 7,
  life = 22,
  reach = 1.6,
  color = "#FFE15A",
}) => {
  const mats = useMemo(
    () =>
      [0, 1, 2, 3].map(
        () => new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
      ),
    [color],
  );
  if (on <= 0.01) return null;
  const n = Math.ceil(life / every);
  return (
    <group renderOrder={6}>
      {Array.from({ length: Math.min(4, n) }, (_, i) => {
        const age = (g % every) + i * every;
        const k = age / life;
        if (k >= 1) return null;
        const m = mats[i];
        m.opacity = on * 0.85 * (1 - k) * Math.min(1, k * 6);
        const r = 0.25 + 0.9 * k;
        return (
          <mesh key={i} material={m} position={[0, 0, 0.05 + reach * k]} scale={[r, r, r]}>
            <ringGeometry args={[0.82, 1, 40]} />
          </mesh>
        );
      })}
    </group>
  );
};

// =======================================================================================
// The hallway

const hallGeometry = once(() => {
  const geos: THREE.BufferGeometry[] = [];
  const z = HALL.wallZ;
  const { x: dx, w: dw, h: dh } = HALL.door;
  const W0 = -7;
  const W1 = 7;
  const H = 5.2;
  const wall = "#FFE7B0";
  const lower = "#8FD3C0";
  const D = 0.3;
  const zc = z - D / 2;
  const left = dx - dw / 2;
  const right = dx + dw / 2;
  // Wall with the door opening; a mint wainscot below a white rail; a skirting board.
  geos.push(place(new THREE.BoxGeometry(left - W0, H, D), wall, [(W0 + left) / 2, H / 2, zc]));
  geos.push(place(new THREE.BoxGeometry(W1 - right, H, D), wall, [(W1 + right) / 2, H / 2, zc]));
  geos.push(place(new THREE.BoxGeometry(dw, H - dh, D), wall, [dx, (H + dh) / 2, zc]));
  for (const [x0, x1] of [
    [W0, left],
    [right, W1],
  ]) {
    geos.push(place(new THREE.BoxGeometry(x1 - x0, 1.05, 0.04), lower, [(x0 + x1) / 2, 0.525, z + 0.02]));
    geos.push(place(rbox(x1 - x0, 0.1, 0.1, 0.03), "#FFFFFF", [(x0 + x1) / 2, 1.08, z + 0.04]));
    geos.push(place(rbox(x1 - x0, 0.16, 0.08, 0.03), "#FFFFFF", [(x0 + x1) / 2, 0.08, z + 0.04]));
  }
  // Door frame (white) and the threshold.
  geos.push(place(rbox(dw + 0.36, 0.18, 0.16, 0.05), "#FFFFFF", [dx, dh + 0.09, z + 0.06]));
  for (const x of [left - 0.09, right + 0.09]) geos.push(place(rbox(0.18, dh + 0.18, 0.16, 0.05), "#FFFFFF", [x, (dh + 0.18) / 2, z + 0.06]));
  geos.push(place(rbox(dw, 0.04, 0.4, 0.02), "#B07440", [dx, 0.02, z - 0.05]));
  // His flat beyond: floor, walls, a lamp-lit back wall with a poster, boxes and a ladder.
  const bz = z - 3.0;
  geos.push(place(new THREE.BoxGeometry(4, 0.04, 3), "#C9874E", [dx, 0.0, z - 1.5]));
  geos.push(place(new THREE.BoxGeometry(4, 3.2, 0.1), "#B8A7E8", [dx, 1.6, bz]));
  for (const x of [left - 0.3, right + 0.3]) geos.push(place(new THREE.BoxGeometry(0.1, 3.2, 3), "#A796DB", [x, 1.6, z - 1.5]));
  geos.push(place(new THREE.BoxGeometry(4, 0.1, 3), "#CFC3F2", [dx, 3.2, z - 1.5]));
  geos.push(place(rbox(0.55, 0.45, 0.45, 0.04), "#C99A5E", [dx - 0.45, 0.23, bz + 0.6]));
  geos.push(place(rbox(0.45, 0.38, 0.4, 0.04), "#D8AE72", [dx - 0.42, 0.65, bz + 0.62], [0, 0.3, 0]));
  geos.push(place(rbox(0.6, 0.5, 0.5, 0.04), "#C99A5E", [dx + 0.5, 0.25, bz + 0.8], [0, -0.2, 0]));
  for (const s of [-1, 1]) geos.push(place(rbox(0.06, 2.2, 0.06, 0.02), "#7D8894", [dx + 0.2 + s * 0.22, 1.1, bz + 0.25], [0.12, 0, 0]));
  for (let k = 0; k < 5; k++) geos.push(place(rbox(0.46, 0.05, 0.06, 0.02), "#7D8894", [dx + 0.2, 0.3 + k * 0.42, bz + 0.25 + 0.05 * (k - 2) * -0.12]));
  // Door number plate.
  geos.push(place(rbox(0.5, 0.26, 0.04, 0.05), "#FFC21A", [dx, dh + 0.42, z + 0.04]));
  // A wall lamp on each side, a coat hook, a potted plant on the left.
  for (const x of [-2.6, 2.6]) {
    geos.push(place(rbox(0.12, 0.3, 0.1, 0.04), "#C98A4E", [x, 2.35, z + 0.05]));
    geos.push(place(new THREE.SphereGeometry(0.2, 16, 10), "#FFF1C2", [x, 2.6, z + 0.2]));
  }
  geos.push(place(new THREE.CylinderGeometry(0.26, 0.2, 0.45, 16), "#E07A4F", [-2.3, 0.23, z + 0.45]));
  for (let k = 0; k < 6; k++) geos.push(place(new THREE.IcosahedronGeometry(0.22, 0), k % 2 ? "#2FAE4E" : "#4CC75E", [-2.3 + Math.cos(k) * 0.16, 0.6 + (k % 3) * 0.16, z + 0.45 + Math.sin(k) * 0.12]));
  // The doormat.
  geos.push(place(rbox(1.25, 0.03, 0.62, 0.02), "#8F5728", [dx, 0.015, z + 0.45]));
  geos.push(place(rbox(1.05, 0.032, 0.42, 0.02), "#B07440", [dx, 0.018, z + 0.45]));
  // The stool for the speaker.
  const [sx, , sz] = HALL.stool;
  const sh = HALL.stoolH;
  geos.push(place(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 20), "#C98A4E", [sx, sh - 0.04, sz]));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.4;
    geos.push(place(new THREE.CylinderGeometry(0.035, 0.045, sh, 8), "#8F5728", [sx + Math.cos(a) * 0.22, sh / 2 - 0.04, sz + Math.sin(a) * 0.22], [Math.sin(a) * 0.1, 0, -Math.cos(a) * 0.1]));
  }
  return mergeAll(geos);
});

/** The open door leaf, swung into the flat (hinged at the left jamb). */
const DoorLeaf: React.FC = () => {
  const { x, w, h } = HALL.door;
  return (
    <group position={[x - w / 2, 0, HALL.wallZ - 0.1]} rotation={[0, 1.95, 0]}>
      <mesh material={toy("#3B6FD8", { rough: 0.45, glow: 0.14 })} position={[w / 2, h / 2, 0]}>
        <boxGeometry args={[w - 0.04, h - 0.04, 0.09]} />
      </mesh>
      <mesh material={toy("#FFC21A", { metal: 0.5, rough: 0.3, glow: 0.2 })} position={[w - 0.16, 1.05, 0.08]}>
        <sphereGeometry args={[0.06, 10, 8]} />
      </mesh>
    </group>
  );
};

/** The neighbour's cardboard sign, taped to the wall (origin = its centre, facing +z). */
export const CardboardSign: React.FC<{ swing?: number }> = ({ swing = 0 }) => {
  const ready = useFontsReady();
  const tape = toy("#EDE6C8", { rough: 0.7, glow: 0.2 });
  return (
    <group rotation={[0, 0, -0.06 + swing]}>
      {ready ? (
        <mesh>
          <planeGeometry args={[1.25, 1.02]} />
          <primitive object={texMat(cardboardTexture(), 0.85, 0.22, true)} attach="material" />
        </mesh>
      ) : null}
      {[-1, 1].map((s) => (
        <mesh key={s} material={tape} position={[s * 0.55, 0.47, 0.01]} rotation={[0, 0, s * 0.6]}>
          <boxGeometry args={[0.3, 0.09, 0.005]} />
        </mesh>
      ))}
    </group>
  );
};

/** The hallway: wooden floor, the wall with the neighbour's open door and his flat beyond. */
export const NeighbourHall: React.FC = () => (
  <group>
    <Ground wood center={[0, 0, 3]} size={[16, 10]} />
    <mesh geometry={hallGeometry()} material={vertexMat(0.6, false, 0.17)} />
    <DoorLeaf />
    <group position={HALL.sign}>
      <CardboardSign />
    </group>
  </group>
);

// =======================================================================================
// Sleep helpers

/**
 * Snore cycle at frame g (period in frames): `breath` 0..1 (1 = lungs full), `out` 0..1 while
 * breathing out (the bubble grows, the moustache flutters), `puff` a short pulse at each exhale
 * start (a "Z" leaves).
 */
export const snore = (g: number, period = 54, phase = 0) => {
  const u = (((g + phase) / period) % 1 + 1) % 1;
  const breath = u < 0.45 ? Math.sin((u / 0.45) * (Math.PI / 2)) : Math.cos(((u - 0.45) / 0.55) * (Math.PI / 2));
  const out = u < 0.45 ? 0 : Math.sin(((u - 0.45) / 0.55) * Math.PI);
  const puff = u >= 0.45 && u < 0.6 ? Math.sin(((u - 0.45) / 0.15) * Math.PI) : 0;
  return { breath, out, puff, u, cycle: Math.floor((g + phase) / period) };
};

/** A pose lerp (numeric fields). */
export const mixPose = (a: NubiPose, b: NubiPose, k: number): NubiPose => {
  const out: NubiPose = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof NubiPose>;
  keys.forEach((key) => {
    const d = key === "squash" || key === "eyeScale" ? 1 : 0;
    out[key] = lerp(a[key] ?? d, b[key] ?? d, k);
  });
  return out;
};

// =======================================================================================
// Posed points (for counters, zzz and held props)

const tmpObj = new THREE.Object3D();
const tmpInner = new THREE.Object3D();
const tmpSquash = new THREE.Object3D();
/**
 * World position of a model-space point (Nubi units: body 10 wide, feet at y 0) on a posed
 * Nubi-shaped character placed like <Nubi position rotationY size pose> (wrapped in `outer`
 * scale, as the chubby baker is).
 */
export const nubiPoint = (position: V3, rotationY: number, size: number, pose: NubiPose, local: V3, outer: V3 = [1, 1, 1]): V3 => {
  const s = size / 10;
  tmpObj.position.set(...position);
  tmpObj.rotation.set(0, rotationY, 0);
  tmpObj.scale.set(outer[0] * s, outer[1] * s, outer[2] * s);
  tmpInner.position.set(0, pose.hop ?? 0, 0);
  tmpInner.rotation.set(pose.pitch ?? 0, pose.yaw ?? 0, pose.roll ?? 0);
  const sq = Math.max(0.3, pose.squash ?? 1);
  const sx = 1 / Math.sqrt(sq);
  tmpSquash.scale.set(sx, sq, sx);
  tmpObj.updateMatrix();
  tmpInner.updateMatrix();
  tmpSquash.updateMatrix();
  const v = new THREE.Vector3(...local).applyMatrix4(tmpSquash.matrix).applyMatrix4(tmpInner.matrix).applyMatrix4(tmpObj.matrix);
  return [v.x, v.y, v.z];
};
