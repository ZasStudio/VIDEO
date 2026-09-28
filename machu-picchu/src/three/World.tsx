import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { C } from "../theme";
import { Citadel } from "./Citadel";
import { fbm, mulberry, noise2, smoothstep } from "./noise";
import {
  RIVER_Y,
  VALLEY,
  heightAt,
  onPlateau,
  polar,
  riverRadius,
} from "./terrain";

export type WorldVariant = "day" | "golden" | "storm";

export const SKY: Record<
  WorldVariant,
  { top: string; mid: string; horizon: string; fog: string }
> = {
  day: { top: "#1250D8", mid: "#3FA6F5", horizon: "#BFE6FF", fog: "#C6E8FA" },
  golden: {
    top: "#2A2A8C",
    mid: "#E0558E",
    horizon: "#FFB870",
    fog: "#F6B48C",
  },
  storm: { top: "#070B1C", mid: "#1C2346", horizon: "#48506E", fog: "#3A4262" },
};

/** CSS gradient that matches the fog colour at the horizon. */
export const skyGradient = (v: WorldVariant) =>
  `linear-gradient(180deg, ${SKY[v].top} 0%, ${SKY[v].mid} 45%, ${SKY[v].horizon} 78%, ${SKY[v].fog} 100%)`;

// Warped grid: dense around the citadel, coarse towards the horizon.
const warp = (u: number, S: number) => {
  const a = Math.abs(u);
  return Math.sign(u) * S * (0.22 * a + 0.78 * a * a * a);
};

let terrainCache: THREE.BufferGeometry | null = null;
const buildTerrain = () => {
  if (terrainCache) return terrainCache;
  const N = 300;
  const S = 470;
  const geo = new THREE.PlaneGeometry(2, 2, N, N);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = warp(pos.getX(i), S);
    const z = warp(pos.getZ(i), S);
    pos.setXYZ(i, x, heightAt(x, z), z);
  }
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const grass = new THREE.Color(C.grass);
  const lush = new THREE.Color("#3E9A43");
  const forest = new THREE.Color(C.forest);
  const rock = new THREE.Color("#7C776C");
  const snow = new THREE.Color("#F4F7FB");
  const riverBank = new THREE.Color("#5E8C3A");
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const slope = 1 - nrm.getY(i);
    c.copy(lush).lerp(grass, smoothstep(0.25, 0.02, slope) * 0.8);
    c.lerp(forest, smoothstep(0.18, 0.5, slope) * 0.85);
    c.lerp(rock, smoothstep(0.5, 0.78, slope) * 0.75);
    // High Andean peaks: bare rock, then snow caps.
    c.lerp(rock, smoothstep(55, 85, y) * 0.8);
    c.lerp(
      snow,
      smoothstep(92, 108, y + fbm(x * 0.03, z * 0.03, 3) * 14) *
        smoothstep(0.75, 0.35, slope),
    );
    // River banks.
    c.lerp(riverBank, smoothstep(VALLEY + 5, VALLEY + 1, y) * 0.6);
    const n = 0.92 + 0.16 * noise2(x * 0.09, z * 0.09);
    colors[i * 3] = c.r * n;
    colors[i * 3 + 1] = c.g * n;
    colors[i * 3 + 2] = c.b * n;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  terrainCache = geo;
  return geo;
};

let treeCache: { mats: THREE.Matrix4[]; cols: THREE.Color[] } | null = null;
const buildTrees = () => {
  if (treeCache) return treeCache;
  const rnd = mulberry(2430);
  const mats: THREE.Matrix4[] = [];
  const cols: THREE.Color[] = [];
  const palette = ["#1F5A2C", "#27693A", "#2F7A33", "#3B8A3A", "#23502A"].map(
    (h) => new THREE.Color(h),
  );
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  let tries = 0;
  while (mats.length < 2600 && tries < 40000) {
    tries++;
    const ang = rnd() * Math.PI * 2;
    const rad = Math.sqrt(rnd()) * 175;
    const x = Math.sin(ang) * rad;
    const z = -8 - Math.cos(ang) * rad;
    if (onPlateau(x, z, 2.5)) continue;
    const y = heightAt(x, z);
    if (y < VALLEY + 2 || y > 42) continue;
    const e = 0.9;
    const dx = heightAt(x + e, z) - heightAt(x - e, z);
    const dz = heightAt(x, z + e) - heightAt(x, z - e);
    const slope = Math.hypot(dx, dz) / (2 * e);
    if (slope > 2.4) continue;
    // Denser forest down in the valley, sparser near the top.
    if (rnd() > 0.45 + 0.5 * smoothstep(20, -30, y)) continue;
    const k = 0.9 + rnd() * 0.9;
    q.setFromAxisAngle(up, rnd() * Math.PI);
    mats.push(
      new THREE.Matrix4().compose(
        new THREE.Vector3(x, y + 0.7 * k, z),
        q,
        new THREE.Vector3(1.2 * k, 1.5 * k, 1.2 * k),
      ),
    );
    cols.push(palette[Math.floor(rnd() * palette.length)]);
  }
  treeCache = { mats, cols };
  return treeCache;
};

const Trees: React.FC = () => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(buildTrees, []);
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }),
    [],
  );
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    data.mats.forEach((mx, i) => {
      m.setMatrixAt(i, mx);
      m.setColorAt(i, data.cols[i]);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [data]);
  return (
    <instancedMesh
      ref={ref}
      args={[geo, mat, data.mats.length]}
      castShadow
      receiveShadow
      frustumCulled={false}
    />
  );
};

const River: React.FC<{ variant: WorldVariant }> = ({ variant }) => {
  const geo = useMemo(() => {
    // A ribbon that follows the river loop (only visible where the valley dips below it).
    const g = new THREE.PlaneGeometry(420, 420, 1, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -8);
    return g;
  }, []);
  const color =
    variant === "storm"
      ? "#3B5E86"
      : variant === "golden"
        ? "#7C7FE0"
        : "#2FA3EE";
  return (
    <mesh geometry={geo} position={[0, RIVER_Y, 0]}>
      <meshStandardMaterial color={color} roughness={0.25} metalness={0.1} />
    </mesh>
  );
};

type CloudDef = {
  x: number;
  y: number;
  z: number;
  s: number;
  puffs: [number, number, number, number][];
};
export type CloudSpot = [number, number, number, number];

const DEFAULT_SPOTS: CloudSpot[] = [
  [-30, 22, -78, 1.3],
  [22, 30, -95, 1.6],
  [-55, 8, -30, 1.1],
  [48, 4, -20, 1.2],
  [-20, -22, 40, 1.4],
  [60, 14, -120, 2.2],
  [-80, 26, -140, 2.4],
  [10, -30, -40, 1.0],
  [-60, -12, 60, 1.5],
  [90, 34, -60, 2.0],
  [-110, 40, -40, 2.6],
  [35, 42, 70, 1.8],
];

const buildClouds = (spots: CloudSpot[]): CloudDef[] => {
  const rnd = mulberry(83);
  const defs: CloudDef[] = [];
  for (const [x, y, z, s] of spots) {
    const puffs: [number, number, number, number][] = [];
    const n = 5 + Math.floor(rnd() * 4);
    for (let i = 0; i < n; i++) {
      puffs.push([
        (rnd() - 0.5) * 9,
        (rnd() - 0.3) * 1.8,
        (rnd() - 0.5) * 4,
        1.6 + rnd() * 1.8,
      ]);
    }
    defs.push({ x, y, z, s, puffs });
  }
  return defs;
};

export const Clouds: React.FC<{
  frame: number;
  variant: WorldVariant;
  opacity?: number;
  spots?: CloudSpot[];
}> = ({ frame, variant, opacity = 1, spots = DEFAULT_SPOTS }) => {
  const defs = useMemo(() => buildClouds(spots), [spots]);
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const color =
    variant === "storm"
      ? "#8E96B4"
      : variant === "golden"
        ? "#FFE0C2"
        : "#FFFFFF";
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 1,
        flatShading: true,
        emissive: new THREE.Color(color),
        emissiveIntensity: variant === "storm" ? 0.05 : 0.35,
        transparent: opacity < 1,
        opacity,
      }),
    [color, variant, opacity],
  );
  return (
    <group>
      {defs.map((d, i) => (
        <group
          key={i}
          position={[d.x + frame * 0.02 * (1 + (i % 3) * 0.4), d.y, d.z]}
          scale={d.s * 2}
        >
          {d.puffs.map((p, j) => (
            <mesh
              key={j}
              geometry={geo}
              material={mat}
              position={[p[0], p[1], p[2]]}
              scale={[p[3], p[3] * 0.72, p[3]]}
            />
          ))}
        </group>
      ))}
    </group>
  );
};

const Terrain: React.FC = () => {
  const geo = useMemo(buildTerrain, []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        flatShading: true,
      }),
    [],
  );
  return <mesh geometry={geo} material={mat} receiveShadow />;
};

const skyVertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const skyFragment = /* glsl */ `
uniform vec3 cTop;
uniform vec3 cMid;
uniform vec3 cHorizon;
uniform vec3 cFog;
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform float sunGlow;
varying vec3 vWorld;
void main() {
  vec3 d = normalize(vWorld - cameraPosition);
  float y = d.y;
  vec3 c = mix(cFog, cHorizon, smoothstep(-0.02, 0.06, y));
  c = mix(c, cMid, smoothstep(0.06, 0.32, y));
  c = mix(c, cTop, smoothstep(0.32, 0.85, y));
  float s = max(0.0, dot(d, normalize(sunDir)));
  c += sunColor * (pow(s, 12.0) * 0.45 + pow(s, 200.0) * 0.9) * sunGlow;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}
`;

/** Gradient sky dome computed from the view direction, so the horizon always matches the fog. */
export const SkyDome: React.FC<{
  variant: WorldVariant;
  sunDir?: [number, number, number];
  flash?: number;
}> = ({ variant, sunDir, flash = 0 }) => {
  const mat = useMemo(() => {
    const sky = SKY[variant];
    return new THREE.ShaderMaterial({
      vertexShader: skyVertex,
      fragmentShader: skyFragment,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        cTop: { value: new THREE.Color(sky.top) },
        cMid: { value: new THREE.Color(sky.mid) },
        cHorizon: { value: new THREE.Color(sky.horizon) },
        cFog: { value: new THREE.Color(sky.fog) },
        sunDir: {
          value: new THREE.Vector3(...(sunDir ?? [-0.6, 0.25, -0.75])),
        },
        sunColor: {
          value: new THREE.Color(variant === "golden" ? "#FFD08A" : "#FFFFFF"),
        },
        sunGlow: {
          value: variant === "storm" ? 0 : variant === "golden" ? 1 : 0.35,
        },
      },
    });
  }, [variant, sunDir]);
  const base = new THREE.Color(SKY[variant].top);
  const lit = base.clone().lerp(new THREE.Color("#C8D6FF"), flash * 0.7);
  mat.uniforms.cTop.value.copy(lit);
  return (
    <mesh material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[1200, 32, 20]} />
    </mesh>
  );
};

/** Lights + fog for a look. `flash` (0..1) adds a lightning flash. */
export const Atmosphere: React.FC<{
  variant: WorldVariant;
  flash?: number;
  fogNear?: number;
  fogFar?: number;
  sunPos?: [number, number, number];
}> = ({ variant, flash = 0, fogNear = 90, fogFar = 430, sunPos }) => {
  const scene = useThree((s) => s.scene);
  useLayoutEffect(() => {
    const fogColor = new THREE.Color(SKY[variant].fog).lerp(
      new THREE.Color("#DCE6FF"),
      flash * 0.6,
    );
    scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
  });
  const sun =
    variant === "golden"
      ? { pos: [-120, 45, -60] as const, color: "#FFC27A", intensity: 3.2 }
      : variant === "storm"
        ? { pos: [60, 120, 40] as const, color: "#9FB0E0", intensity: 0.7 }
        : { pos: [80, 95, 45] as const, color: "#FFF4DE", intensity: 2.7 };
  const hemi =
    variant === "golden"
      ? { sky: "#FFE0C4", ground: "#5A4060", intensity: 1.35 }
      : variant === "storm"
        ? { sky: "#7080B0", ground: "#1A2030", intensity: 0.75 }
        : { sky: "#D6EEFF", ground: "#44602C", intensity: 1.3 };
  return (
    <>
      <hemisphereLight
        args={[hemi.sky, hemi.ground, hemi.intensity + flash * 2.2]}
      />
      <directionalLight
        position={sunPos ?? [...sun.pos]}
        color={sun.color}
        intensity={sun.intensity + flash * 1.5}
      />
    </>
  );
};

export const World: React.FC<{
  frame: number;
  variant?: WorldVariant;
  citadel?: boolean;
  clouds?: boolean;
  cloudSpots?: CloudSpot[];
  sky?: boolean;
  flash?: number;
}> = ({
  frame,
  variant = "day",
  citadel = true,
  clouds = true,
  cloudSpots,
  sky = true,
  flash = 0,
}) => (
  <group>
    {sky ? <SkyDome variant={variant} flash={flash} /> : null}
    <Terrain />
    <Trees />
    <River variant={variant} />
    {citadel ? <Citadel /> : null}
    {clouds ? (
      <Clouds frame={frame} variant={variant} spots={cloudSpots} />
    ) : null}
  </group>
);

export { heightAt, polar, riverRadius };
