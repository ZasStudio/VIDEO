import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { CameraRig } from "../three/CameraRig";
import { LOOKS, Text3D, TitleLights } from "../three/Text3D";

export const TitleTest: React.FC = () => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 50% 40%, #3A7BFF 0%, #2A1B8F 55%, #12062E 100%)",
      }}
    >
      <ThreeCanvas
        width={width}
        height={height}
        flat
        gl={{ antialias: true }}
        camera={{ position: [0, 0, 20], fov: 30 }}
      >
        <CameraRig position={[0, 0, 20]} target={[0, 0, 0]} fov={30} />
        <TitleLights />
        <Text3D
          text="SIN CEMENTO"
          size={1.5}
          look={LOOKS.white}
          position={[0, 3.2, 0]}
          rotation={[-0.25, 0.25, 0.04]}
        />
        <Text3D
          text="SECRETO #1"
          size={1.9}
          look={LOOKS.gold}
          position={[0, 0.2, 0]}
          rotation={[0.18, -0.22, -0.05]}
          shine={1}
        />
        <Text3D
          text="¿CÓMO LO HICIERON?"
          size={1.1}
          look={LOOKS.red}
          position={[0, -2.6, 0]}
          rotation={[-0.1, 0.1, 0]}
        />
        <Text3D
          text="60% BAJO TIERRA"
          size={0.9}
          look={LOOKS.cyan}
          position={[-3.5, -4.4, 0]}
          rotation={[0, 0.35, 0]}
        />
        <Text3D
          text="MIT'A"
          size={0.9}
          look={LOOKS.green}
          position={[5, -4.4, 0]}
          rotation={[0, -0.35, 0]}
        />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
