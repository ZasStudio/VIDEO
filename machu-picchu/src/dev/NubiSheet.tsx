import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { CameraRig } from "../three/CameraRig";
import { Nubi, NubiPose } from "../three/Nubi";

// Model check for Nubi: the reference photo angle big on the left, poses on the right.
const POSES: { pose: NubiPose; yaw: number }[] = [
  { pose: {}, yaw: 0 },
  { pose: { finL: 1, finR: 1, hop: 2.5, squash: 1.12, eyeScale: 1.25 }, yaw: 0.45 },
  { pose: { squash: 0.82, blink: 1, finL: -0.4, finR: -0.4 }, yaw: -0.45 },
  { pose: { finR: 1.2, lookX: 0.8, wiggle: 1, wigglePhase: 1.5 }, yaw: 1.2 },
  { pose: { wiggle: 1, wigglePhase: 3, finL: 0.6, roll: 0.12 }, yaw: 2.4 },
  { pose: { eyeScale: 0.6, pitch: 0.18, finL: 0.3, finR: -0.2 }, yaw: -1.2 },
];

export const NubiSheet: React.FC = () => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #EFE9E1 0%, #EFE9E1 55%, #C98B4E 55%, #B8763B 100%)" }}>
      <ThreeCanvas width={width} height={height} flat gl={{ antialias: true }} camera={{ position: [0, 8, 60], fov: 30 }}>
        <CameraRig position={[-9, 6.5, 58]} target={[-9, 3.2, 0]} fov={30} />
        <hemisphereLight args={["#FFF8EE", "#B8763B", 1.25]} />
        <directionalLight position={[-20, 30, 25]} intensity={2.3} color="#FFFFFF" />
        <directionalLight position={[25, 12, -10]} intensity={0.7} color="#FFE9CC" />
        {/* Reference angle: slightly above, turned a touch to its left. */}
        <Nubi size={9} position={[-17, 0, 6]} rotationY={-0.18} />
        {POSES.map((p, i) => (
          <Nubi key={i} size={4.4} position={[-3 + (i % 3) * 7.2, i < 3 ? 6.2 : -1.6, i < 3 ? -4 : 6]} rotationY={p.yaw} pose={p.pose} />
        ))}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
