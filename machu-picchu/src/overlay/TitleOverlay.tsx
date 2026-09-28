import React from "react";
import { useVideoConfig } from "remotion";
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

const IN = 10; // frames to land
const OUT = 10; // frames to leave

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
  if (frame < at - IN || frame > out + OUT + 1) return null;
  const t = frame - at;
  return (
    <group position={position}>
      {lines.map((l, i) => {
        const d = l.delay ?? i * 5;
        const lt = t - d;
        if (lt < -IN) return null;
        // Glides in from big and close to the camera and settles with a soft bounce.
        const inS =
          lt < 0
            ? 1 + Math.pow(-lt / IN, 2) * 1.6
            : 1 + Math.sin(Math.min(lt, 14) * 0.6) * 0.07 * Math.exp(-lt / 7);
        const inOp = ramp(lt, -IN, -IN / 2);
        const k = ramp(frame, out, out + OUT, [0, 1], EASE_IN);
        const exS = exit === "zoom" ? 1 + k * 2 : 1 - k;
        const exY = exit === "up" ? k * 7 : 0;
        const sway = Math.sin((frame + i * 11) * 0.04) * 0.07;
        const drift = ramp(frame, at, out + OUT, [1, 1.05], (x) => x);
        const sh = shine
          ? ramp(lt, 6, 30, [0, 1], EASE_OUT) * (1 - ramp(lt, 30, 40))
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
