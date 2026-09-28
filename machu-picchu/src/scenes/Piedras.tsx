import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import {
  EASE_IN,
  EASE_IN_OUT,
  EASE_OUT,
  keyframes,
  pop,
  ramp,
  rand,
  windowIn,
  wordPulse,
} from "../anim";
import { Burst, Card } from "../overlay/Graphics";
import { TitleCanvas, TitleSlam } from "../overlay/TitleOverlay";
import { WORD_FRAMES } from "../script";
import { FONT, SCENES } from "../theme";
import { Clawd } from "../three/Clawd";
import { Vec3, lerp3, projectToScreen } from "../three/CameraRig";
import { DustPuff, Sparks, Twinkles } from "../three/Effects3D";
import { Island, Quarry } from "../three/Island";
import { BlockDef, WallMesh, buildWall } from "../three/Masonry";
import { CementBag, Chisel, HammerStone, NoSign, Paper } from "../three/Props";
import { LOOKS } from "../three/Text3D";
import { Shake, Stage } from "./common";

// 24-34 s: SECRETO #1: granite from the same mountain, fitted without mortar,
// not even a sheet of paper fits, carved with harder stones and bronze.

const WALL_POS: Vec3 = [-2.9, 0, -0.8];
const WALL_W = 7.4;
const WALL_H = 4.2;
const DEPTH = 1.15;
const QUARRY: Vec3 = [5.4, 0, -2.4];
const CLAWD_AT: Vec3 = [-5.2, 0, 3.0];

export const PIEDRAS_LANDINGS: number[] = [];

const useWall = () =>
  useMemo(
    () =>
      buildWall({
        width: WALL_W,
        height: WALL_H,
        rows: 4,
        seed: 12,
        minBlock: 1.3,
        maxBlock: 2.5,
      }),
    [],
  );

const order = (blocks: BlockDef[]) =>
  [...blocks].sort((a, b) => a.row - b.row || a.cx - b.cx);

export const landingFrames = () => {
  const wall = buildWall({
    width: WALL_W,
    height: WALL_H,
    rows: 4,
    seed: 12,
    minBlock: 1.3,
    maxBlock: 2.5,
  });
  return order(wall).map((_, k) => 762 + Math.round(k * 4.6));
};

const HIT1 = 950;
const HIT2 = 966;

export const Piedras: React.FC = () => {
  const frame = useCurrentFrame();
  const g = frame + SCENES.piedras.from;
  const wall = useWall();
  const sorted = useMemo(() => order(wall), [wall]);
  const landAt = useMemo(
    () => new Map(sorted.map((b, k) => [b.index, 762 + Math.round(k * 4.6)])),
    [sorted],
  );

  // The seam the paper tries to enter: horizontal joint between rows 1 and 2, near the centre.
  const jx = WALL_W * 0.52;
  const J: Vec3 = [
    WALL_POS[0] + jx,
    WALL_POS[1] + wall.boundaryY(2, jx),
    WALL_POS[2] + DEPTH / 2,
  ];
  // Top-right block, where the hammerstone strikes.
  const target = sorted[sorted.length - 1];
  const HITP: Vec3 = [
    WALL_POS[0] + target.cx + 0.2,
    WALL_POS[1] + target.cy + 0.1,
    WALL_POS[2] + DEPTH / 2 + 0.1,
  ];

  // Camera: wide orbit -> close-up on the seam -> medium on the hammer strikes.
  const orbit = keyframes(g, [720, 870], [-0.22, 0.1], (x) => x);
  const wideR = 15.8;
  const wide = {
    position: [
      0.6 + Math.sin(orbit) * wideR,
      4.4,
      Math.cos(orbit) * wideR,
    ] as Vec3,
    target: [0.6, 1.9, 0] as Vec3,
  };
  const close = {
    position: [J[0] + 2.3, J[1] + 1.1, J[2] + 3.3] as Vec3,
    target: [J[0] + 0.2, J[1], J[2]] as Vec3,
  };
  const medium = {
    position: [HITP[0] + 2.6, HITP[1] + 1.5, HITP[2] + 8.0] as Vec3,
    target: [HITP[0] - 0.8, HITP[1] - 0.9, HITP[2]] as Vec3,
  };
  const kClose =
    ramp(g, 870, 884, [0, 1], EASE_IN_OUT) *
    (1 - ramp(g, 928, 942, [0, 1], EASE_IN_OUT));
  const kMed = ramp(g, 930, 944, [0, 1], EASE_IN_OUT);
  let position = lerp3(wide.position, close.position, kClose);
  let tgt = lerp3(wide.target, close.target, kClose);
  position = lerp3(position, medium.position, kMed);
  tgt = lerp3(tgt, medium.target, kMed);
  const cam = { position, target: tgt, fov: 38 };

  const anim = (b: BlockDef) => {
    const L = landAt.get(b.index)!;
    const start = L - 12;
    if (g < start)
      return { pos: [0, 0, 0] as Vec3, rot: [0, 0, 0] as Vec3, visible: false };
    const rest: Vec3 = [WALL_POS[0] + b.cx, WALL_POS[1] + b.cy, WALL_POS[2]];
    const from: Vec3 = [
      QUARRY[0] - rest[0],
      QUARRY[1] + 1.2 - rest[1],
      QUARRY[2] - rest[2],
    ];
    let pos: Vec3 = [0, 0, 0];
    let rot: Vec3 = [0, 0, 0];
    let scale = 1;
    if (g < L) {
      const t = ramp(g, start, L, [0, 1], EASE_IN_OUT);
      const arc = 4 * t * (1 - t) * 3.4;
      pos = [from[0] * (1 - t), from[1] * (1 - t) + arc, from[2] * (1 - t)];
      rot = [
        (1 - t) * (rand(b.index) - 0.5) * 3,
        (1 - t) * (rand(b.index + 9) - 0.5) * 3,
        (1 - t) * (rand(b.index + 4) - 0.5) * 2,
      ];
      scale = 0.45 + 0.55 * t;
    } else {
      const d = g - L;
      pos = [0, 0.14 * Math.abs(Math.sin(d * 0.9)) * Math.exp(-d / 3), 0];
    }
    // Hammer strikes shake the top-right block.
    if (b.index === target.index) {
      for (const h of [HIT1, HIT2]) {
        const d = g - h;
        if (d >= 0 && d < 8)
          pos = [
            pos[0] + Math.sin(d * 3) * 0.05 * (1 - d / 8),
            pos[1],
            pos[2] - 0.06 * (1 - d / 8),
          ];
      }
    }
    return { pos, rot, scale };
  };

  // Paper test.
  const pIn = ramp(g, 874, 892, [0, 1], EASE_OUT);
  const bend = ramp(g, 892, 900, [0, 1], EASE_OUT) * 0.9;
  const fall = ramp(g, 900, 918, [0, 1], EASE_IN);
  const paperPos: Vec3 = [
    J[0] + 2.4 * (1 - pIn) + fall * 0.6,
    J[1] + 0.02 - fall * 3.5,
    J[2] + 0.58 + 2.2 * (1 - pIn) + fall * 1.0,
  ];
  const paperShown = g >= 872 && g < 922;
  const jScreen = projectToScreen(cam, J);
  const xShow = pop(g, 900, { damping: 9, stiffness: 240 });

  // Hammerstone swing.
  const swing = (h: number) => {
    const d = g - h;
    if (d < -8) return 1;
    if (d < 0) return ramp(d, -8, 0, [1, 0], EASE_IN);
    return ramp(d, 0, 7, [0, 1], EASE_OUT);
  };
  const hs = Math.min(swing(HIT1), g < HIT1 + 8 ? 1 : swing(HIT2));
  const hammerIn = ramp(g, 936, 944, [0, 1], EASE_OUT);
  const hammerOut = ramp(g, 1012, 1018, [0, 1], EASE_IN);
  const hammerPos: Vec3 = [
    HITP[0] + 0.9 + hs * 1.6 + (1 - hammerIn) * 5,
    HITP[1] + 0.2 + hs * 1.4,
    HITP[2] + 0.8 + hs * 0.5,
  ];
  const chiselK = pop(g, 1000, { damping: 10, stiffness: 180 });
  const talk = wordPulse(g, WORD_FRAMES);
  const flinch = [HIT1, HIT2].some((h) => g >= h && g < h + 6) ? 1 : 0;
  const cheer = windowIn(g, 1000, 1030, 4);
  const lookAtWall = ramp(g, 760, 770);
  const bagK =
    pop(g, 856, { damping: 10, stiffness: 200 }) * (1 - ramp(g, 868, 874));
  const labelHammer = projectToScreen(cam, [
    hammerPos[0],
    hammerPos[1] + 1.3,
    hammerPos[2],
  ]);
  const chiselScreen = projectToScreen(cam, [
    HITP[0] + 1.2,
    HITP[1] - 1.9,
    HITP[2] + 1.6,
  ]);
  const quarryScreen = projectToScreen(cam, [
    QUARRY[0],
    QUARRY[1] + 2.2,
    QUARRY[2],
  ]);

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 50% 38%, #FFC46B 0%, #FF7A45 30%, #D6336C 62%, #4C1D7A 100%)",
      }}
    >
      <AbsoluteFill
        style={{
          background: `repeating-conic-gradient(from ${g * 0.25}deg at 50% 38%, rgba(255,255,255,0.08) 0deg 8deg, rgba(255,255,255,0) 8deg 20deg)`,
        }}
      />
      <Shake
        frame={g}
        impacts={[
          { at: 720, amp: 18, dur: 14 },
          { at: HIT1, amp: 9 },
          { at: HIT2, amp: 9 },
        ]}
      >
        <Stage cam={cam}>
          <hemisphereLight args={["#FFF3E6", "#7B2A6A", 1.35]} />
          <directionalLight
            position={[-6, 12, 10]}
            intensity={2.5}
            color="#FFF6E8"
          />
          <directionalLight
            position={[9, 4, -6]}
            intensity={1.2}
            color="#FF9AD5"
          />
          <group position={[0, -0.02, 0]}>
            <Island radius={7.6} />
          </group>
          <group position={QUARRY}>
            <Quarry />
          </group>
          <group position={WALL_POS}>
            <WallMesh blocks={wall} depth={DEPTH} anim={anim} />
          </group>
          {sorted
            .filter((b) => b.row === 0)
            .map((b) => (
              <DustPuff
                key={b.index}
                frame={g}
                at={landAt.get(b.index)!}
                position={[WALL_POS[0] + b.cx, 0, WALL_POS[2] + 0.4]}
                radius={0.9}
                count={7}
              />
            ))}
          <group position={CLAWD_AT} rotation={[0, 0.55 - lookAtWall * 0.1, 0]}>
            <Clawd
              size={2.2}
              pose={{
                hat: 1,
                squash: 1 - 0.06 * talk,
                hop: talk * 0.5 + cheer * Math.abs(Math.sin(g * 0.5)) * 1.2,
                armL: 0.25 * talk + cheer * 1.3,
                armR: 0.25 * talk + cheer * 1.3,
                lookX: 0.7,
                lookY: 0.2,
                eyeScale: flinch ? 0.25 : 1 + cheer * 0.2,
              }}
            />
          </group>
          {/* Callback: no cement bag needed. */}
          {bagK > 0.01 ? (
            <group position={[4.8, 5.2, 0.5]} scale={0.8 * bagK}>
              <CementBag />
              <group position={[0, 0, 0.2]}>
                <NoSign k={1} />
              </group>
            </group>
          ) : null}
          {paperShown ? (
            <group
              position={paperPos}
              rotation={[
                -Math.PI / 2 + fall * 1.4,
                fall * 0.6,
                0.35 + fall * 0.8,
              ]}
              scale={[0.55, 0.55 * (1 - bend * 0.12), 0.55]}
            >
              <Paper bend={bend} />
            </group>
          ) : null}
          {g >= 936 ? (
            <group
              position={hammerPos}
              rotation={[0.3, -0.4, 0.4 + hs * 0.6]}
              scale={0.62}
            >
              <group scale={1 - hammerOut}>
                <HammerStone />
              </group>
            </group>
          ) : null}
          <Sparks frame={g} at={HIT1} position={HITP} count={18} />
          <Sparks frame={g} at={HIT2} position={HITP} count={18} />
          {chiselK > 0.01 ? (
            <group
              position={[HITP[0] + 1.2, HITP[1] - 1.9, HITP[2] + 1.6]}
              rotation={[0.2, g * 0.08, -0.5]}
              scale={0.55 * chiselK * (1 - hammerOut)}
            >
              <Chisel />
            </group>
          ) : null}
          <Twinkles
            frame={g}
            at={1000}
            position={[HITP[0] + 1.2, HITP[1] - 1.9, HITP[2] + 1.6]}
            radius={1.3}
            count={10}
          />
        </Stage>
        {/* Magnifier on the seam + red X. */}
        {g >= 884 && g < 932 ? (
          <div
            style={{
              position: "absolute",
              left: jScreen.x - 150,
              top: jScreen.y - 150,
              width: 300,
              height: 300,
              borderRadius: "50%",
              border: "12px solid #fff",
              boxShadow:
                "0 0 0 8px rgba(0,0,0,0.35), 0 10px 30px rgba(0,0,0,0.4)",
              transform: `scale(${pop(g, 884, { damping: 12, stiffness: 200 }) * (1 - ramp(g, 926, 932))})`,
            }}
          />
        ) : null}
        {g >= 900 && g < 932 ? (
          <svg
            width={260}
            height={260}
            viewBox="0 0 100 100"
            style={{
              position: "absolute",
              left: jScreen.x + 110,
              top: jScreen.y - 230,
              transform: `scale(${xShow * (1 - ramp(g, 926, 932))}) rotate(${(1 - xShow) * 30}deg)`,
            }}
          >
            <path
              d="M18 18 L82 82 M82 18 L18 82"
              stroke="#000"
              strokeWidth={26}
              strokeLinecap="round"
            />
            <path
              d="M18 18 L82 82 M82 18 L18 82"
              stroke="#FF2D2D"
              strokeWidth={16}
              strokeLinecap="round"
            />
          </svg>
        ) : null}
        <Card
          frame={g}
          at={976}
          out={1010}
          x={Math.min(1600, labelHammer.x + 40)}
          y={Math.max(160, labelHammer.y - 140)}
          title="PIEDRA MÁS DURA"
          sub="QUE EL GRANITO"
          rotate={-4}
          gradient="linear-gradient(135deg, #4A4A58 0%, #1E1E26 100%)"
        />
        <Card
          frame={g}
          at={1002}
          out={1014}
          x={chiselScreen.x - 260}
          y={chiselScreen.y - 170}
          title="BRONCE"
          rotate={4}
          gradient="linear-gradient(135deg, #F2B04A 0%, #B8641E 100%)"
        />
        <Card
          frame={g}
          at={804}
          out={834}
          x={quarryScreen.x}
          y={quarryScreen.y - 130}
          title="CANTERA"
          sub="EN EL MISMO CERRO"
          rotate={-4}
          gradient="linear-gradient(135deg, #8D867A 0%, #4E4940 100%)"
        />
        <Burst
          frame={g}
          at={HIT1}
          x={projectToScreen(cam, HITP).x}
          y={projectToScreen(cam, HITP).y}
          color="#FFD24A"
          size={300}
        />
        <Burst
          frame={g}
          at={HIT2}
          x={projectToScreen(cam, HITP).x}
          y={projectToScreen(cam, HITP).y}
          color="#FFD24A"
          size={300}
        />
        {g < 764 ? (
          <TitleCanvas>
            <TitleSlam
              frame={g}
              at={722}
              out={754}
              exit="up"
              lines={[
                { text: "SECRETO #1", size: 2.0, look: LOOKS.gold, y: 1.0 },
                {
                  text: "LAS PIEDRAS",
                  size: 1.2,
                  look: LOOKS.white,
                  y: -1.2,
                  delay: 13,
                },
              ]}
            />
          </TitleCanvas>
        ) : null}
      </Shake>
      {g >= 884 && g < 932 ? (
        <div
          style={{
            position: "absolute",
            left: jScreen.x - 70,
            top: jScreen.y + 150,
            fontFamily: FONT.title,
            fontSize: 44,
            color: "#fff",
            WebkitTextStroke: "10px #000",
            paintOrder: "stroke fill",
            transform: `scale(${pop(g, 890) * (1 - ramp(g, 926, 932))})`,
          }}
        >
          0 mm
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
