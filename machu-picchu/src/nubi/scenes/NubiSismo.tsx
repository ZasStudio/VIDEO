import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { pop, ramp, rand, windowIn } from "../../anim";
import { Shake, Stage } from "../../scenes/common";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Twinkles } from "../../three/Effects3D";
import { Island } from "../../three/Island";
import { BlockDef, WallMesh, buildWall } from "../../three/Masonry";
import { Nubi } from "../../three/Nubi";
import { nubiTalk } from "../talk";
import { NUBI } from "../timeline";

// "Así, cuando tiembla, ¡bailan... y vuelven a su lugar!" The wall with its trapezoid door
// shakes, its stones hop about (and Nubi dances with them), then everything settles back.

const W = 7.0;
const H = 5.0;
const ROWS = 5;
const LEAN = 0.12;
const DOOR = { bottom: 1.8, top: 1.35, height: (H / ROWS) * 3 };
const DEPTH = 1.2;
const WALL_POS: Vec3 = [-W / 2, 0, -1.0];
const NUBI_AT: Vec3 = [1.8, 0, 2.8];

export const NubiSismo: React.FC = () => {
  const frame = useCurrentFrame();
  const S = NUBI.SCENES.sismo;
  const g = frame + S.from;
  const END = S.from + S.duration;
  const QUAKE_IN = NUBI.wordAt("L03", 2);
  const SETTLE = NUBI.wordAt("L03", 5);
  const OK = NUBI.wordAt("L03", 8);

  const wall = useMemo(
    () => buildWall({ width: W, height: H, rows: ROWS, seed: 34, lean: LEAN, door: DOOR, minBlock: 1.0, maxBlock: 1.9 }),
    [],
  );
  const quake = windowIn(g, QUAKE_IN, SETTLE, 5);
  const anim = (b: BlockDef) => {
    const d = g - SETTLE;
    // A little bounce as every stone drops back into its seat.
    const settle = d >= 0 && d < 12 ? 0.1 * Math.abs(Math.sin(d * 0.8 + b.index)) * (1 - d / 12) : 0;
    if (quake <= 0.001) return { pos: [0, settle, 0] as Vec3, rot: [0, 0, 0] as Vec3 };
    const ph = rand(b.index * 7) * Math.PI * 2;
    const f = 0.7 + rand(b.index * 3) * 0.5;
    const amp = quake * (0.13 + (0.12 * b.row) / ROWS);
    return {
      pos: [
        Math.sin(g * f * 0.8 + ph) * amp * 0.5,
        Math.abs(Math.sin(g * f * 0.65 + ph)) * amp * 1.7 + settle,
        Math.cos(g * f * 0.6 + ph) * amp * 0.3,
      ] as Vec3,
      rot: [0, 0, Math.sin(g * f * 0.7 + ph) * amp * 0.28] as Vec3,
    };
  };
  const islandShake: Vec3 = [Math.sin(g * 1.3) * 0.12 * quake, 0, Math.cos(g * 1.05) * 0.05 * quake];

  const u = ramp(g, S.from, END, [0, 1], (x) => x);
  const cam = {
    position: lerp3([-0.6, 6.0, 22.8], [-0.2, 5.4, 21.0], u),
    target: lerp3([0.2, 1.7, 0], [0.2, 1.6, 0], u),
    fov: 40,
  };

  // Nubi dances while the stones "dance", then cheers when they are back in place.
  const dance = quake;
  const beat = Math.abs(Math.sin((g - QUAKE_IN) * 0.42));
  const cheer = windowIn(g, OK, END + 20, 6);
  const check = pop(g, OK, { damping: 9, stiffness: 220 });

  return (
    <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 36%, #9FD8FF 0%, #5B7CFF 34%, #6A3DE8 64%, #1B0F4A 100%)" }}>
      <AbsoluteFill
        style={{
          background: `repeating-conic-gradient(from ${g * 0.25}deg at 50% 36%, rgba(255,255,255,0.08) 0deg 8deg, rgba(255,255,255,0) 8deg 20deg)`,
        }}
      />
      <Shake
        frame={g}
        impacts={[
          { at: S.from, amp: 12, dur: 12 },
          { at: QUAKE_IN, amp: 14, dur: Math.max(1, SETTLE - QUAKE_IN) },
          { at: SETTLE, amp: 12 },
        ]}
      >
        <Stage cam={cam}>
          <hemisphereLight args={["#EEF4FF", "#3A2A8A", 1.35]} />
          <directionalLight position={[-6, 12, 10]} intensity={2.5} color="#FFFFFF" />
          <directionalLight position={[9, 4, -6]} intensity={1.1} color="#9FD8FF" />
          <group position={islandShake}>
            <Island radius={6.4} grass="#5CC98A" />
            <group position={WALL_POS}>
              <WallMesh blocks={wall} depth={DEPTH} anim={anim} />
            </group>
          </group>
          <group position={NUBI_AT} rotation={[0, -0.3, 0]}>
            <Nubi
              size={2.3}
              pose={nubiTalk(g, {
                hop: dance * beat * 2.2 + cheer * Math.abs(Math.sin((g - OK) * 0.35)) * 1.4,
                squash: 1 + dance * (beat - 0.5) * 0.16,
                roll: dance * Math.sin((g - QUAKE_IN) * 0.21) * 0.18,
                finL: dance * (0.6 + 0.6 * Math.sin((g - QUAKE_IN) * 0.42)) + cheer * 1.1,
                finR: dance * (0.6 - 0.6 * Math.sin((g - QUAKE_IN) * 0.42)) + cheer * 1.1,
                wiggle: dance,
                wigglePhase: g * 0.8,
                eyeScale: 1 + 0.2 * (dance + cheer),
                lookX: -0.5,
                lookY: 0.2,
              })}
            />
          </group>
          <Twinkles frame={g} at={OK} position={[0, H * 0.7, WALL_POS[2] + 1]} radius={3.4} count={14} />
        </Stage>
        {g >= OK ? (
          <svg
            width={210}
            height={210}
            viewBox="0 0 100 100"
            style={{
              position: "absolute",
              left: 790,
              top: 300,
              transform: `scale(${check}) rotate(${(1 - check) * -40}deg)`,
            }}
          >
            <circle cx={50} cy={50} r={44} fill="#12B33B" stroke="#fff" strokeWidth={7} />
            <path d="M28 52 L44 67 L73 35" stroke="#fff" strokeWidth={12} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </Shake>
    </AbsoluteFill>
  );
};
