import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, pop, ramp, wordPulse } from "../anim";
import { Burst, Card } from "../overlay/Graphics";
import { TitleCanvas, TitleSlam } from "../overlay/TitleOverlay";
import { WORD_FRAMES } from "../script";
import { SCENES } from "../theme";
import { Clawd } from "../three/Clawd";
import { Vec3, lerp3 } from "../three/CameraRig";
import { Island } from "../three/Island";
import { getStoneTexture } from "../three/Citadel";
import {
  BlockDef,
  WallMesh,
  blockGeometry,
  buildWall,
  useGraniteMaterials,
} from "../three/Masonry";
import { LOOKS } from "../three/Text3D";
import { Worker } from "../three/Worker";
import { Shake, Stage } from "./common";

// 52-56 s: who built it? Thousands of people taking turns: the mit'a.

const RAMP = { x0: -6.2, x1: 2.2, h: 2.4, z: 0.4, w: 2.4 };
const slope = RAMP.h / (RAMP.x1 - RAMP.x0);
const rampY = (x: number) =>
  x <= RAMP.x0 ? 0 : x >= RAMP.x1 ? RAMP.h : (x - RAMP.x0) * slope;

const Rotate: React.FC = () => (
  <svg width={80} height={80} viewBox="0 0 100 100">
    <path
      d="M78 42 A30 30 0 0 0 24 34"
      stroke="#fff"
      strokeWidth={11}
      fill="none"
      strokeLinecap="round"
    />
    <path
      d="M14 20 L24 38 L40 26"
      stroke="#fff"
      strokeWidth={11}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M22 58 A30 30 0 0 0 76 66"
      stroke="#fff"
      strokeWidth={11}
      fill="none"
      strokeLinecap="round"
    />
    <path
      d="M86 80 L76 62 L60 74"
      stroke="#fff"
      strokeWidth={11}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Block: React.FC = () => {
  const geo = useMemo(
    () =>
      blockGeometry(
        {
          poly: [
            [-0.9, -0.55],
            [0.95, -0.55],
            [1.0, 0.35],
            [0.6, 0.62],
            [-0.85, 0.58],
          ],
          cx: 0,
          cy: 0,
          row: 0,
          index: 0,
        },
        1.3,
      ),
    [],
  );
  const mats = useGraniteMaterials();
  return <mesh geometry={geo} material={mats[1]} castShadow />;
};

export const Mita: React.FC = () => {
  const frame = useCurrentFrame();
  const g = frame + SCENES.mita.from;
  const top = useMemo(
    () =>
      buildWall({
        width: 4.2,
        height: 1.6,
        rows: 2,
        seed: 52,
        minBlock: 1.0,
        maxBlock: 1.6,
      }),
    [],
  );
  const stoneMat = useMemo(() => {
    const t = getStoneTexture().clone();
    t.needsUpdate = true;
    t.repeat.set(0.9, 1.6);
    return new THREE.MeshStandardMaterial({
      color: "#FFFFFF",
      map: t,
      roughness: 0.9,
    });
  }, []);
  const rampMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#B98A5A", roughness: 1 }),
    [],
  );

  // Block on its sled creeping up the ramp; workers pull ahead of it.
  const bx = -4.6 + ramp(g, 1560, 1680, [0, 2.7], (x) => x);
  const by = rampY(bx);
  const phase = g * 0.42;
  const workers = [0, 1, 2, 3, 4].map((i) => {
    const x = bx + 2.2 + i * 1.15;
    return { x, y: rampY(x), i };
  });
  const ropeFrom: Vec3 = [bx + 0.95, by + 0.75, RAMP.z + 0.5];
  const last = workers[workers.length - 1];
  const ropeTo: Vec3 = [last.x + 0.5, last.y + 1.45, RAMP.z + 0.5];
  const ropeLen = Math.hypot(ropeTo[0] - ropeFrom[0], ropeTo[1] - ropeFrom[1]);
  const ropeAng = Math.atan2(ropeTo[1] - ropeFrom[1], ropeTo[0] - ropeFrom[0]);

  // Many more people appear for "MILES DE PERSONAS".
  const crowd = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2 + 0.3;
        const r = 5.6 + (i % 3) * 0.7;
        return {
          p: [Math.cos(a) * r * 1.05, 0, Math.sin(a) * r * 0.7 - 0.6] as Vec3,
          at: 1596 + i * 1.2,
          v: i + 2,
          yaw: -a + Math.PI / 2,
        };
      }).filter((c) => !(c.p[2] > 0.6 && Math.abs(c.p[0]) < 5.5)),
    [],
  );

  const u = ramp(g, 1560, 1680, [0, 1], EASE_IN_OUT);
  const position = lerp3([0.8, 4.6, 18.5], [1.6, 3.6, 15.2], u);
  const target: Vec3 = [0.6, 1.5, 0];
  const talk = wordPulse(g, WORD_FRAMES);
  const cheer = ramp(g, 1658, 1664);

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 50% 30%, #FFF2B3 0%, #7FD4FF 38%, #2F7BEA 72%, #1B3A9E 100%)",
      }}
    >
      <AbsoluteFill
        style={{
          background: `repeating-conic-gradient(from ${g * 0.25}deg at 50% 30%, rgba(255,255,255,0.08) 0deg 8deg, rgba(255,255,255,0) 8deg 20deg)`,
        }}
      />
      <Shake
        frame={g}
        impacts={[
          { at: 1560, amp: 16, dur: 14 },
          { at: 1658, amp: 16 },
        ]}
      >
        <Stage cam={{ position, target, fov: 38 }}>
          <hemisphereLight args={["#FFF8E8", "#2F5A9E", 1.4]} />
          <directionalLight
            position={[-8, 12, 10]}
            intensity={2.5}
            color="#FFF6E0"
          />
          <directionalLight
            position={[9, 5, -6]}
            intensity={1.0}
            color="#BFE6FF"
          />
          <Island radius={8.4} />
          {/* Ramp of packed earth and the stone platform it leads to. */}
          <mesh
            position={[(RAMP.x0 + RAMP.x1) / 2, RAMP.h / 2 - 0.02, RAMP.z]}
            rotation={[0, 0, Math.atan(slope)]}
            scale={[Math.hypot(RAMP.x1 - RAMP.x0, RAMP.h), 0.3, RAMP.w]}
            material={rampMat}
          >
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
          <mesh
            position={[(RAMP.x0 + RAMP.x1) / 2 + 0.8, RAMP.h / 4, RAMP.z]}
            scale={[RAMP.x1 - RAMP.x0 - 1.6, RAMP.h / 2, RAMP.w * 0.98]}
            material={rampMat}
          >
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
          <mesh position={[4.4, RAMP.h / 2, 0.2]} material={stoneMat}>
            <boxGeometry args={[4.4, RAMP.h, 4.2]} />
          </mesh>
          <group position={[2.3, RAMP.h, -1.6]}>
            <WallMesh blocks={top as BlockDef[]} depth={0.9} />
          </group>
          {/* Sled + block. */}
          <group
            position={[bx, by, RAMP.z]}
            rotation={[0, 0, Math.atan(slope)]}
          >
            <mesh position={[0, 0.08, 0]}>
              <boxGeometry args={[2.1, 0.16, 1.5]} />
              <meshStandardMaterial color="#8A5A2B" roughness={0.9} />
            </mesh>
            <group position={[0, 0.72, 0]}>
              <Block />
            </group>
          </group>
          {/* Rope. */}
          <mesh
            position={[
              (ropeFrom[0] + ropeTo[0]) / 2,
              (ropeFrom[1] + ropeTo[1]) / 2,
              ropeFrom[2],
            ]}
            rotation={[0, 0, ropeAng]}
          >
            <boxGeometry args={[ropeLen, 0.07, 0.07]} />
            <meshStandardMaterial color="#D9B36C" roughness={0.9} />
          </mesh>
          {workers.map((w) => (
            <group
              key={w.i}
              position={[w.x, w.y, RAMP.z]}
              rotation={[0, 0, Math.atan(slope) * (w.x < RAMP.x1 ? 1 : 0)]}
            >
              <Worker phase={phase + w.i * 1.3} variant={w.i} lean={0.45} />
            </group>
          ))}
          {crowd.map((c, i) => {
            const k = pop(g, c.at, { damping: 10, stiffness: 200 });
            if (k < 0.01) return null;
            return (
              <group key={i} position={c.p} rotation={[0, c.yaw, 0]} scale={k}>
                <Worker
                  phase={g * 0.3 + i}
                  walk={0.15}
                  lean={0.05}
                  pull={0.1}
                  variant={c.v}
                  bob={Math.abs(Math.sin(g * 0.35 + i)) * 0.12}
                />
              </group>
            );
          })}
          <group position={[5.2, RAMP.h, 1.0]} rotation={[0, -0.35, 0]}>
            <Clawd
              size={1.8}
              pose={{
                hat: 1,
                squash: 1 - 0.06 * talk,
                hop: talk * 0.5 + cheer * Math.abs(Math.sin(g * 0.5)) * 1.4,
                armL: 0.3 * talk + cheer * 1.3,
                armR: 0.3 * talk + cheer * 1.3,
                lookX: -0.6,
              }}
            />
          </group>
        </Stage>
        <Card
          frame={g}
          at={1622}
          out={1652}
          x={1420}
          y={220}
          icon={<Rotate />}
          title="POR TURNOS"
          sub="TRABAJO COMUNITARIO"
          rotate={-3}
          gradient="linear-gradient(135deg, #1FA35B 0%, #0E6B8C 100%)"
        />
        <Burst frame={g} at={1658} x={960} y={360} color="#FFD60A" size={640} />
        {g >= 1652 ? (
          <TitleCanvas>
            <TitleSlam
              frame={g}
              at={1658}
              out={1674}
              exit="zoom"
              lines={[{ text: "MIT'A", size: 2.6, look: LOOKS.gold, y: 1.9 }]}
            />
          </TitleCanvas>
        ) : null}
      </Shake>
    </AbsoluteFill>
  );
};
