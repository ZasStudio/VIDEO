import React, { useMemo } from "react";
import * as THREE from "three";
import { Font, FontData } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import luckiest from "../assets/luckiest-guy.json";

// Real extruded 3D titles: gradient face, shaded thick sides and a dark outline plate behind.

const FONT = new Font(luckiest as unknown as FontData);

export type TitleLook = {
  top: string;
  mid: string;
  bottom: string;
  side: string;
  outline: string;
};

export const LOOKS = {
  gold: {
    top: "#FFFBD1",
    mid: "#FFD21F",
    bottom: "#FF9500",
    side: "#B84A00",
    outline: "#200800",
  },
  white: {
    top: "#FFFFFF",
    mid: "#F2F6FF",
    bottom: "#B9CCF5",
    side: "#43557E",
    outline: "#070B18",
  },
  red: {
    top: "#FFC2B8",
    mid: "#FF4B3E",
    bottom: "#D0101E",
    side: "#6E0710",
    outline: "#1A0003",
  },
  green: {
    top: "#EFFFB8",
    mid: "#7CF03C",
    bottom: "#12B33B",
    side: "#0A5E22",
    outline: "#021808",
  },
  cyan: {
    top: "#E6FFFF",
    mid: "#4FE3FF",
    bottom: "#1284FF",
    side: "#0A3C8C",
    outline: "#020A1E",
  },
  orange: {
    top: "#FFE7C9",
    mid: "#FF9B3D",
    bottom: "#F2541B",
    side: "#7A2306",
    outline: "#1C0600",
  },
  pink: {
    top: "#FFE3F6",
    mid: "#FF6FC8",
    bottom: "#C8207E",
    side: "#5E0A3A",
    outline: "#1A0210",
  },
} satisfies Record<string, TitleLook>;

const faceVertex = /* glsl */ `
varying float vY;
void main() {
  vY = position.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const faceFragment = /* glsl */ `
uniform vec3 cTop;
uniform vec3 cMid;
uniform vec3 cBot;
uniform float y0;
uniform float y1;
uniform float shine;
uniform float opacity;
varying float vY;
void main() {
  float t = clamp((vY - y0) / (y1 - y0), 0.0, 1.0);
  vec3 c = t > 0.55 ? mix(cMid, cTop, smoothstep(0.55, 1.0, t)) : mix(cBot, cMid, smoothstep(0.0, 0.55, t));
  // Glossy band that sweeps across the letters.
  c += vec3(0.35) * shine * smoothstep(0.06, 0.0, abs(t - 0.72));
  gl_FragColor = vec4(c, opacity);
  #include <colorspace_fragment>
}
`;

type Built = {
  face: THREE.BufferGeometry;
  outline: THREE.BufferGeometry;
  width: number;
  height: number;
  y0: number;
  y1: number;
};

const cache = new Map<string, Built>();

const build = (text: string, size: number): Built => {
  const key = `${text}|${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const face = new TextGeometry(text, {
    font: FONT,
    size,
    depth: size * 0.32,
    curveSegments: 6,
    bevelEnabled: true,
    bevelThickness: size * 0.05,
    bevelSize: size * 0.03,
    bevelSegments: 2,
  });
  face.computeBoundingBox();
  const bb = face.boundingBox!;
  const cx = (bb.min.x + bb.max.x) / 2;
  // Center on the cap height so lines with/without descenders align.
  const cy = size * 0.36;
  face.translate(-cx, -cy, 0);
  const outline = new TextGeometry(text, {
    font: FONT,
    size,
    depth: size * 0.3,
    curveSegments: 6,
    bevelEnabled: true,
    bevelThickness: size * 0.02,
    bevelSize: size * 0.02,
    bevelOffset: size * 0.085,
    bevelSegments: 1,
  });
  outline.translate(-cx, -cy, -size * 0.12);
  const built = {
    face,
    outline,
    width: bb.max.x - bb.min.x,
    height: bb.max.y - bb.min.y,
    y0: bb.min.y - cy,
    y1: bb.max.y - cy,
  };
  cache.set(key, built);
  return built;
};

export const measureText3D = (text: string, size: number) => {
  const b = build(text, size);
  return { width: b.width, height: b.height };
};

/** One line of 3D text centered at the origin. */
export const Text3D: React.FC<{
  text: string;
  size?: number;
  look?: TitleLook;
  shine?: number;
  opacity?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
}> = ({
  text,
  size = 1,
  look = LOOKS.gold,
  shine = 0,
  opacity = 1,
  position,
  rotation,
  scale,
}) => {
  const b = build(text, size);
  const faceMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: faceVertex,
        fragmentShader: faceFragment,
        transparent: true,
        uniforms: {
          cTop: { value: new THREE.Color(look.top) },
          cMid: { value: new THREE.Color(look.mid) },
          cBot: { value: new THREE.Color(look.bottom) },
          y0: { value: b.y0 },
          y1: { value: b.y1 },
          shine: { value: 0 },
          opacity: { value: 1 },
        },
      }),
    [look, b.y0, b.y1],
  );
  faceMat.uniforms.shine.value = shine;
  faceMat.uniforms.opacity.value = opacity;
  const sideMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: look.side,
        roughness: 0.35,
        metalness: 0.05,
        emissive: new THREE.Color(look.side),
        emissiveIntensity: 0.35,
        transparent: true,
      }),
    [look],
  );
  sideMat.opacity = opacity;
  const outlineMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({ color: look.outline, transparent: true }),
    [look],
  );
  outlineMat.opacity = opacity;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={b.outline} material={outlineMat} />
      <mesh geometry={b.face} material={[faceMat, sideMat]} />
    </group>
  );
};

/** Lighting rig for canvases that only show titles. */
export const TitleLights: React.FC = () => (
  <>
    <hemisphereLight args={["#FFFFFF", "#402060", 1.4]} />
    <directionalLight position={[4, 8, 10]} intensity={2.2} />
  </>
);
