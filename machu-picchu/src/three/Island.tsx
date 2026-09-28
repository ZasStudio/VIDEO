import React, { useMemo } from "react";
import * as THREE from "three";
import { mulberry } from "./noise";

// Floating diorama island used for the explainer set pieces.

export const Island: React.FC<{
  radius?: number;
  height?: number;
  grass?: string;
  soil?: string;
  rock?: string;
}> = ({
  radius = 7,
  height = 1.1,
  grass = "#62C24E",
  soil = "#9A6A43",
  rock = "#6E655C",
}) => {
  const under = useMemo(() => {
    const g = new THREE.ConeGeometry(radius * 0.98, radius * 1.05, 12, 4);
    g.rotateX(Math.PI);
    const p = g.attributes.position;
    const rnd = mulberry(5);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y > radius * 0.5 - 0.01) continue;
      p.setX(i, p.getX(i) * (0.9 + rnd() * 0.2));
      p.setZ(i, p.getZ(i) * (0.9 + rnd() * 0.2));
    }
    g.computeVertexNormals();
    return g;
  }, [radius]);
  return (
    <group>
      <mesh position={[0, -0.12, 0]} receiveShadow>
        <cylinderGeometry args={[radius, radius, 0.24, 64]} />
        <meshStandardMaterial
          color={grass}
          roughness={0.95}
          emissive={grass}
          emissiveIntensity={0.08}
        />
      </mesh>
      <mesh position={[0, -0.24 - height / 2, 0]}>
        <cylinderGeometry args={[radius * 0.995, radius * 0.97, height, 64]} />
        <meshStandardMaterial color={soil} roughness={1} />
      </mesh>
      <mesh geometry={under} position={[0, -0.24 - height - radius * 0.52, 0]}>
        <meshStandardMaterial color={rock} roughness={1} flatShading />
      </mesh>
    </group>
  );
};

/** Pile of grey granite rocks (the on-site quarry). */
export const Quarry: React.FC<{ seed?: number }> = ({ seed = 3 }) => {
  const rocks = useMemo(() => {
    const rnd = mulberry(seed);
    const list: {
      p: [number, number, number];
      s: [number, number, number];
      r: [number, number, number];
    }[] = [];
    for (let i = 0; i < 9; i++) {
      const a = rnd() * Math.PI * 2;
      const d = rnd() * 1.3;
      const s = 0.55 + rnd() * 0.6;
      list.push({
        p: [Math.cos(a) * d, s * 0.55 + (i > 5 ? 0.6 : 0), Math.sin(a) * d],
        s: [s * (1 + rnd() * 0.4), s * (0.8 + rnd() * 0.4), s],
        r: [rnd() * 3, rnd() * 3, rnd() * 3],
      });
    }
    return list;
  }, [seed]);
  const geo = useMemo(() => new THREE.DodecahedronGeometry(1, 0), []);
  return (
    <group>
      {rocks.map((k, i) => (
        <mesh
          key={i}
          geometry={geo}
          position={k.p}
          scale={k.s}
          rotation={k.r}
          castShadow
        >
          <meshStandardMaterial
            color={i % 2 ? "#B9B2A6" : "#A69F93"}
            roughness={0.9}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
};
