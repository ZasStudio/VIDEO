import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN, EASE_IN_OUT, pop, ramp, rand, windowIn } from "../../anim";
import { Burst } from "../../overlay/Graphics";
import { Shake, Stage } from "../../scenes/common";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { DustPuff, Twinkles } from "../../three/Effects3D";
import { Island } from "../../three/Island";
import { BlockDef, WallMesh, buildWall } from "../../three/Masonry";
import { Nubi } from "../../three/Nubi";
import { CementBag, NoSign } from "../../three/Props";
import { nubiTalk } from "../talk";
import { NUBI } from "../timeline";

// "Sus piedras encajan como un rompecabezas... ¡sin cemento!" The wall builds itself block by
// block while Nubi talks, and a crossed-out cement bag pops up on "sin cemento".

const WALL_W = 7.0;
const WALL_H = 4.0;
const DEPTH = 1.15;
const WALL_POS: Vec3 = [-WALL_W / 2, 0, -1.2];
const NUBI_AT: Vec3 = [1.7, 0, 3.0];
const FALL = 11;

const order = (blocks: BlockDef[]) => [...blocks].sort((a, b) => a.row - b.row || a.cx - b.cx);

export const NubiPiedras: React.FC = () => {
  const frame = useCurrentFrame();
  const S = NUBI.SCENES.piedras;
  const g = frame + S.from;
  const END = S.from + S.duration;
  const FIRST = NUBI.wordAt("L02", 1);
  const LAST = NUBI.wordAt("L02", 5) + 6;
  const PUZZLE = NUBI.wordAt("L02", 5);
  const NO_CEMENT = NUBI.wordAt("L02", 6);

  const wall = useMemo(
    () => buildWall({ width: WALL_W, height: WALL_H, rows: 4, seed: 12, minBlock: 1.3, maxBlock: 2.4 }),
    [],
  );
  const sorted = useMemo(() => order(wall), [wall]);
  const landAt = useMemo(() => {
    const n = sorted.length;
    return new Map(sorted.map((b, k) => [b.index, Math.round(FIRST + 4 + (k * (LAST - FIRST - 4)) / (n - 1))]));
  }, [sorted, FIRST, LAST]);

  // Blocks drop from the sky, spinning a little, and bounce as they lock in.
  const anim = (b: BlockDef) => {
    const L = landAt.get(b.index)!;
    if (g < L - FALL) return { pos: [0, 0, 0] as Vec3, rot: [0, 0, 0] as Vec3, visible: false };
    if (g < L) {
      const t = ramp(g, L - FALL, L, [0, 1], EASE_IN);
      return {
        pos: [0, (1 - t) * 8, (1 - t) * 1.5] as Vec3,
        rot: [(1 - t) * (rand(b.index) - 0.5) * 2, (1 - t) * (rand(b.index + 9) - 0.5) * 2, (1 - t) * (rand(b.index + 4) - 0.5) * 1.5] as Vec3,
      };
    }
    const d = g - L;
    return { pos: [0, 0.14 * Math.abs(Math.sin(d * 0.7)) * Math.exp(-d / 4), 0] as Vec3, rot: [0, 0, 0] as Vec3 };
  };

  const u = ramp(g, S.from, END, [0, 1], (x) => x);
  // The wall fills the middle of the frame, Nubi stands just above the captions.
  const cam = {
    position: lerp3([1.0, 5.6, 21.5], [0.6, 5.0, 19.8], u),
    target: lerp3([0.3, 1.2, 0], [0.3, 1.1, 0], u),
    fov: 40,
  };
  const bagK = pop(g, NO_CEMENT, { damping: 12, stiffness: 170 });
  const cheer = windowIn(g, NO_CEMENT + 4, END + 20, 6);
  const look = ramp(g, FIRST, FIRST + 10, [0, 1], EASE_IN_OUT) * (1 - ramp(g, NO_CEMENT - 6, NO_CEMENT + 4));

  return (
    <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 36%, #FFC46B 0%, #FF7A45 30%, #D6336C 62%, #4C1D7A 100%)" }}>
      <AbsoluteFill
        style={{
          background: `repeating-conic-gradient(from ${g * 0.25}deg at 50% 36%, rgba(255,255,255,0.08) 0deg 8deg, rgba(255,255,255,0) 8deg 20deg)`,
        }}
      />
      <Shake frame={g} impacts={[{ at: S.from, amp: 12, dur: 12 }, { at: NO_CEMENT, amp: 10 }]}>
        <Stage cam={cam}>
          <hemisphereLight args={["#FFF3E6", "#7B2A6A", 1.35]} />
          <directionalLight position={[-6, 12, 10]} intensity={2.5} color="#FFF6E8" />
          <directionalLight position={[9, 4, -6]} intensity={1.2} color="#FF9AD5" />
          <group position={[0, -0.02, 0]}>
            <Island radius={6.4} />
          </group>
          <group position={WALL_POS}>
            <WallMesh blocks={wall} depth={DEPTH} anim={anim} />
          </group>
          {sorted
            .filter((b) => b.row === 0)
            .map((b) => (
              <DustPuff key={b.index} frame={g} at={landAt.get(b.index)!} position={[WALL_POS[0] + b.cx, 0, WALL_POS[2] + 0.4]} radius={0.9} count={7} />
            ))}
          <Twinkles frame={g} at={PUZZLE + 4} position={[0, WALL_H * 0.6, WALL_POS[2] + 0.8]} radius={3.2} count={14} />
          <group position={NUBI_AT} rotation={[0, -0.25 - look * 0.45, 0]}>
            <Nubi
              size={2.3}
              pose={nubiTalk(g, {
                hop: cheer * Math.abs(Math.sin((g - NO_CEMENT) * 0.35)) * 1.6,
                finL: cheer * 1.1,
                finR: cheer * 1.1,
                lookX: -0.6 * look,
                lookY: 0.3 * look,
                eyeScale: 1 + cheer * 0.2,
              })}
            />
          </group>
          {bagK > 0.01 ? (
            <group position={[-1.2, WALL_H + 2.0, WALL_POS[2] + 0.6]} scale={0.85 * bagK} rotation={[0, 0.25, -0.1]}>
              <CementBag />
              <group position={[0, 0, 0.2]}>
                <NoSign k={1} />
              </group>
            </group>
          ) : null}
        </Stage>
        <Burst frame={g} at={NO_CEMENT} x={420} y={560} color="#FFD60A" size={520} />
      </Shake>
    </AbsoluteFill>
  );
};
