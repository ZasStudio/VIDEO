import React from "react";
import * as THREE from "three";
import { AbsoluteFill, Easing, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { ramp, shake } from "../anim";
import { CameraRig, Vec3 } from "../three/CameraRig";

// Shared scene scaffolding.

/** 3D canvas that fills the frame (transparent, so CSS gradients show through). */
export const Stage: React.FC<{
  children: React.ReactNode;
  cam: { position: Vec3; target: Vec3; fov?: number; roll?: number };
  near?: number;
  far?: number;
}> = ({ children, cam, near = 0.5, far = 1500 }) => {
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas
      width={width}
      height={height}
      flat
      gl={{ antialias: true, alpha: true }}
      camera={{ position: cam.position, fov: cam.fov ?? 40, near, far }}
      style={{ position: "absolute", inset: 0 }}
    >
      <CameraRig
        position={cam.position}
        target={cam.target}
        fov={cam.fov ?? 40}
        roll={cam.roll ?? 0}
      />
      {children}
    </ThreeCanvas>
  );
};

/** Smooth camera path through key points (Catmull-Rom), parameterised by u in [0, 1]. */
export const pathCam = (points: Vec3[]) => {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
    false,
    "centripetal",
  );
  return (u: number): Vec3 => {
    const v = curve.getPoint(Math.max(0, Math.min(1, u)));
    return [v.x, v.y, v.z];
  };
};

export const SMOOTH = Easing.bezier(0.45, 0, 0.2, 1);

/** Applies a screen shake to everything inside. */
export const Shake: React.FC<{
  frame: number;
  impacts: { at: number; amp: number; dur?: number }[];
  children: React.ReactNode;
}> = ({ frame, impacts, children }) => {
  const s = shake(frame, impacts);
  return (
    <AbsoluteFill
      style={{
        transform: `translate(${s.x}px, ${s.y}px) rotate(${s.r}deg) scale(${1 + Math.min(0.04, Math.abs(s.x) * 0.002)})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Zoom-blur in/out at the edges of a scene (a fast "punch" cut). */
export const ZoomCut: React.FC<{
  frame: number;
  duration: number;
  inFrames?: number;
  outFrames?: number;
  children: React.ReactNode;
}> = ({ frame, duration, inFrames = 7, outFrames = 6, children }) => {
  const kin = inFrames > 0 ? 1 - ramp(frame, 0, inFrames) : 0;
  const kout =
    outFrames > 0
      ? ramp(
          frame,
          duration - outFrames,
          duration,
          [0, 1],
          Easing.in(Easing.quad),
        )
      : 0;
  const scale = 1 + kin * 0.22 + kout * 0.25;
  const blur = kin * 14 + kout * 16;
  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale})`,
        filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
