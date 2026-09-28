import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { EASE_IN, EASE_OUT, ramp } from "../anim";
import { CameraRig } from "../three/CameraRig";
import { Text3D, TitleLights, TitleLook } from "../three/Text3D";

// Overlay canvas for big 3D titles. Visible area at z = 0 is ~19 x 10.7 units.

export type TitleLine = {
  text: string;
  size: number;
  look: TitleLook;
  y?: number;
  x?: number;
  delay?: number;
};

/** Slam-in / hold / exit animation for a group of 3D lines. `at` = impact frame. */
export const TitleSlam: React.FC<{
  lines: TitleLine[];
  at: number;
  out: number;
  frame: number;
  position?: [number, number, number];
  tilt?: number;
  shine?: boolean;
  exit?: "shrink" | "up" | "zoom";
  children?: React.ReactNode;
}> = ({
  lines,
  at,
  out,
  frame,
  position = [0, 0, 0],
  tilt = 0,
  shine = true,
  exit = "shrink",
  children,
}) => {
  if (frame < at - 6 || frame > out + 8) return null;
  const t = frame - at;
  return (
    <group position={position}>
      {lines.map((l, i) => {
        const d = l.delay ?? i * 4;
        const lt = t - d;
        if (lt < -6) return null;
        // Comes from huge and close to the camera, lands with a little bounce.
        const inS =
          lt < 0
            ? 1 + Math.pow(-lt / 6, 2) * 2.4
            : 1 + Math.sin(Math.min(lt, 10) * 0.9) * 0.1 * Math.exp(-lt / 5);
        const inOp = ramp(lt, -6, -3);
        const k = ramp(frame, out, out + 7, [0, 1], EASE_IN);
        const exS = exit === "zoom" ? 1 + k * 3 : 1 - k;
        const exY = exit === "up" ? k * 9 : 0;
        const sway = Math.sin((frame + i * 11) * 0.06) * 0.08;
        const drift = ramp(frame, at, out + 8, [1, 1.06], (x) => x);
        const sh = shine
          ? ramp(lt, 4, 22, [0, 1], EASE_OUT) * (1 - ramp(lt, 22, 30))
          : 0;
        return (
          <group
            key={i}
            position={[l.x ?? 0, (l.y ?? 0) + exY, 0]}
            rotation={[
              -0.08 + sway * 0.5,
              sway + tilt * 0.3,
              tilt * (i % 2 ? -1 : 1) * 0.05,
            ]}
            scale={Math.max(0.001, inS * exS * drift)}
          >
            <Text3D
              text={l.text}
              size={l.size}
              look={l.look}
              shine={sh}
              opacity={Math.min(inOp, exit === "zoom" ? 1 - k : 1)}
            />
          </group>
        );
      })}
      {children}
    </group>
  );
};

export const TitleCanvas: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas
      width={width}
      height={height}
      flat
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0, 20], fov: 30, near: 0.1, far: 200 }}
      style={{ position: "absolute", inset: 0 }}
    >
      <CameraRig position={[0, 0, 20]} target={[0, 0, 0]} fov={30} />
      <TitleLights />
      {children}
    </ThreeCanvas>
  );
};

/** Convenience: a title overlay driven by the current (local) frame. */
export const useLocalFrame = () => useCurrentFrame();
