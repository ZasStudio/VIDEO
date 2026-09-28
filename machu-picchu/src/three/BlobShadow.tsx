import React, { useMemo } from "react";
import * as THREE from "three";

// Soft round contact shadow drawn as a transparent radial gradient (cheaper than shadow maps).
let shadowTexture: THREE.CanvasTexture | null = null;
const getShadowTexture = () => {
  if (shadowTexture) return shadowTexture;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(0.45, "rgba(0,0,0,0.6)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  shadowTexture = new THREE.CanvasTexture(canvas);
  return shadowTexture;
};

export const BlobShadow: React.FC<{
  radius: number;
  opacity?: number;
  y?: number;
  stretch?: number;
}> = ({ radius, opacity = 0.35, y = 0.02, stretch = 0.75 }) => {
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: getShadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity,
      }),
    [opacity],
  );
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, y, 0]}
      scale={[radius * 2, radius * 2 * stretch, 1]}
      material={mat}
      renderOrder={1}
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
};
