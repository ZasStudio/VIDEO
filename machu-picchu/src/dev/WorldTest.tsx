import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { CameraRig, Vec3 } from "../three/CameraRig";
import { Atmosphere, World, WorldVariant, skyGradient } from "../three/World";
import { Clawd } from "../three/Clawd";

const VIEWS: { pos: Vec3; target: Vec3; fov: number; variant: WorldVariant }[] =
  [
    { pos: [16, 20, 58], target: [-4, -3, -30], fov: 42, variant: "day" }, // postcard
    { pos: [0, 330, 1], target: [0, 0, 0], fov: 55, variant: "day" }, // top-down
    { pos: [70, 70, 110], target: [0, -10, -20], fov: 40, variant: "day" }, // wide aerial
    { pos: [14, 3.5, 34], target: [4, 1.2, 20], fov: 38, variant: "day" }, // Clawd close-up on terrace
    { pos: [16, 20, 58], target: [-4, -3, -30], fov: 42, variant: "golden" },
    { pos: [16, 20, 58], target: [-4, -3, -30], fov: 42, variant: "storm" },
  ];

export const WorldTest: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const v = VIEWS[frame % VIEWS.length];
  return (
    <AbsoluteFill style={{ background: skyGradient(v.variant) }}>
      <ThreeCanvas
        width={width}
        height={height}
        flat
        gl={{ antialias: true }}
        camera={{ position: v.pos, fov: v.fov, near: 0.5, far: 1200 }}
      >
        <CameraRig position={v.pos} target={v.target} fov={v.fov} />
        <Atmosphere variant={v.variant} />
        <World frame={frame * 20} variant={v.variant} />
        <Clawd
          size={2.2}
          position={[4, 0, 20]}
          rotationY={0.5}
          pose={{ armR: 1, hat: 1 }}
        />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
