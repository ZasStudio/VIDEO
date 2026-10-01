import React from "react";
import { AbsoluteFill } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { CameraRig } from "../three/CameraRig";
import { Halo } from "../three/oxigeno/Props";
import { Glow, LightningBolt } from "../three/thanos/FX";

export const THANOS_PROPS_SHEET_FRAMES = 1;

export const ThanosPropsSheet: React.FC = () => (
  <AbsoluteFill style={{ background: "linear-gradient(180deg, #2A1B54 0%, #6B3A87 40%, #E07A5A 80%, #FFC68A 100%)" }}>
    <ThreeCanvas width={1920} height={1080} flat gl={{ antialias: true, alpha: true }} camera={{ position: [0, 0, 10], fov: 40 }} style={{ position: "absolute", inset: 0 }}>
      <CameraRig position={[0, 0, 10]} target={[0, 0, 0]} fov={40} />
      <hemisphereLight args={["#FFFFFF", "#444444", 1.2]} />
      <mesh position={[0, -2, -1]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#8E6A4A" />
      </mesh>
      <Glow color="#FF8A1F" size={3} position={[-5, 1.5, 0]} />
      <Halo color="#FF8A1F" size={3} opacity={1} position={[-5, -1.5, 0]} />
      <LightningBolt from={[-2, 3.5, 0]} to={[2, -2.5, 0]} t={1.2} seed={1} width={0.4} />
      <LightningBolt from={[3, 3.5, 0]} to={[5.5, -1, 0]} t={2.2} seed={2} width={0.25} color="#B45CFF" />
    </ThreeCanvas>
  </AbsoluteFill>
);
