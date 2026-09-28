import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { CameraRig } from "../three/CameraRig";
import { Clawd, ClawdPose } from "../three/Clawd";

const POSES: { pose: ClawdPose; yaw: number }[] = [
  { pose: {}, yaw: 0 },
  { pose: { armR: 1.2, armL: 0.2, hat: 1 }, yaw: 0.35 },
  {
    pose: { hop: 3, squash: 1.15, armL: 0.9, armR: 0.9, eyeScale: 1.3 },
    yaw: -0.3,
  },
  { pose: { squash: 0.8, blink: 1, hat: 1 }, yaw: 0.6 },
  { pose: { armR: 0.35, reachR: 1.2, lookX: 1, hat: 1 }, yaw: -0.6 },
  { pose: { walk: 1, walkPhase: 1.2, eyeScale: 0.5, hat: 1 }, yaw: 1.2 },
];

export const ClawdSheet: React.FC = () => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(135deg, #FFB347 0%, #FF5F6D 50%, #6A3DE8 100%)",
      }}
    >
      <ThreeCanvas
        width={width}
        height={height}
        flat
        gl={{ antialias: true }}
        camera={{ position: [0, 8, 60], fov: 30 }}
      >
        <CameraRig position={[0, 10, 62]} target={[0, 2.2, 0]} fov={30} />
        <hemisphereLight args={["#FFF1E0", "#6A3DE8", 1.3]} />
        <directionalLight
          position={[-20, 30, 25]}
          intensity={2.4}
          color="#FFFFFF"
        />
        {POSES.map((p, i) => (
          <Clawd
            key={i}
            size={6}
            position={[(i % 3) * 16 - 16, i < 3 ? 6 : -6, 0]}
            rotationY={p.yaw}
            pose={p.pose}
            shadow={false}
          />
        ))}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
