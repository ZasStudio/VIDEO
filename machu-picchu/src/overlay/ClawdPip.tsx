import React from "react";
import { ThreeCanvas } from "@remotion/three";
import { EASE_IN, pop, ramp } from "../anim";
import { talkPose } from "../talk";
import { CameraRig } from "../three/CameraRig";
import { Clawd } from "../three/Clawd";

// Small round "facecam" with Clawd talking, for shots where Clawd is too far to see.
// Sits bottom-left, above the captions (never at the top of the frame).

const SIZE = 250;

export const ClawdPip: React.FC<{ g: number; from: number; to: number }> = ({ g, from, to }) => {
  if (g < from || g > to + 10) return null;
  const k = pop(g, from, { damping: 13, stiffness: 150 }) * (1 - ramp(g, to, to + 10, [0, 1], EASE_IN));
  if (k < 0.01) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 64,
        top: 560,
        width: SIZE,
        height: SIZE,
        borderRadius: "50%",
        overflow: "hidden",
        border: "8px solid #fff",
        boxShadow: "0 12px 0 rgba(0,0,0,0.3), 0 24px 40px rgba(0,0,0,0.35)",
        background: "radial-gradient(circle at 50% 35%, #FFD27A 0%, #FF8A3D 45%, #D6336C 100%)",
        transform: `scale(${k}) rotate(${(1 - k) * -20}deg)`,
      }}
    >
      <ThreeCanvas width={SIZE} height={SIZE} flat gl={{ antialias: true, alpha: true }} camera={{ position: [0, 3.2, 11], fov: 30 }}>
        <CameraRig position={[0, 3.3, 10.5]} target={[0, 2.6, 0]} fov={30} />
        <hemisphereLight args={["#FFF1E0", "#7B2A6A", 1.4]} />
        <directionalLight position={[-4, 8, 8]} intensity={2.3} />
        <group position={[0, 0, 0]} rotation={[0, 0.25, 0]}>
          <Clawd size={3.1} shadow={false} pose={talkPose(g, { hat: 1 })} />
        </group>
      </ThreeCanvas>
    </div>
  );
};
