import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN, EASE_OUT, ramp, rand } from "../../anim";
import { Burst, Card } from "../../overlay/Graphics";
import { SMOOTH, Shake, Stage } from "../../scenes/common";
import { CLAWD_SPOT } from "../../scenes/places";
import { Vec3, lerp3, projectToScreen } from "../../three/CameraRig";
import { DustPuff } from "../../three/Effects3D";
import { Nubi } from "../../three/Nubi";
import { Atmosphere, World, skyGradient } from "../../three/World";
import { nubiTalk } from "../talk";
import { NUBI, NUBI_HEIGHT, NUBI_WIDTH } from "../timeline";

// "¿Por qué Machu Picchu no se cayó con tantos terremotos?" The citadel shakes, Nubi drops
// onto a terrace and hangs on; the quake peaks on "terremotos".

export const NUBI_SPOT: Vec3 = CLAWD_SPOT;
export const NUBI_SIZE = 2.1;
export const NUBI_YAW = 0.2;

// Vertical framing: Nubi centred just above the captions, Huayna Picchu towering behind.
const CAM_A = { position: [3.9, 2.6, 35.5] as Vec3, target: [2.1, -0.4, 0] as Vec3 };
const CAM_B = { position: [3.8, 2.4, 33.5] as Vec3, target: [2.1, -0.2, 0] as Vec3 };

export const NubiHook: React.FC = () => {
  const frame = useCurrentFrame();
  const S = NUBI.SCENES.hook;
  const g = frame + S.from;
  const END = S.from + S.duration;
  const LAND = S.from + 12;
  const PEAK = NUBI.wordAt("L01", 9);

  // The quake rumbles all along and peaks on "terremotos".
  const quake = 0.35 + 0.65 * ramp(g, PEAK - 8, PEAK + 2) * (1 - ramp(g, PEAK + 14, END + 10));
  const qx = quake * (Math.sin(g * 2.7) * 0.1 + (rand(g) - 0.5) * 0.08);
  const qy = quake * Math.cos(g * 3.3) * 0.07;
  const u = ramp(g, S.from, END, [0, 1], SMOOTH);
  const base = lerp3(CAM_A.position, CAM_B.position, u);
  const cam = {
    position: [base[0] + qx, base[1] + qy, base[2]] as Vec3,
    target: lerp3(CAM_A.target, CAM_B.target, u),
    fov: 45,
  };

  // Nubi falls in, lands with a squash and then holds on while the ground shakes.
  const t = ramp(g, S.from, LAND, [0, 1], EASE_IN);
  const inAir = g < LAND;
  const dl = g - LAND;
  const squash = inAir ? 1.12 : 1 - 0.24 * Math.exp(-dl / 4) * Math.cos(dl * 0.6);
  const wobble = inAir ? 0 : quake * Math.sin(g * 1.9) * 0.09;
  const pose = inAir
    ? { squash, finL: 1.1, finR: 1.1, eyeScale: 1.3, hop: (1 - t) * 30 }
    : nubiTalk(g, {
        squash,
        roll: wobble,
        finL: 0.35 + quake * 0.4 * Math.sin(g * 0.9),
        finR: 0.35 + quake * 0.4 * Math.cos(g * 0.9),
        eyeScale: 1.1 + quake * 0.25,
        lookX: -0.2,
        lookY: 0.25,
        wiggle: 0.6 * quake,
        wigglePhase: g * 0.9,
      });

  const tag = projectToScreen(cam, [NUBI_SPOT[0], NUBI_SPOT[1] + 3.1, NUBI_SPOT[2]], NUBI_WIDTH, NUBI_HEIGHT);
  const whiteout = 1 - ramp(g, S.from + 1, S.from + 16, [0, 1], EASE_OUT);
  const redPulse = ramp(g, PEAK - 2, PEAK + 2) * (1 - ramp(g, PEAK + 4, PEAK + 22));

  return (
    <AbsoluteFill style={{ background: skyGradient("day") }}>
      <Shake
        frame={g}
        impacts={[
          { at: S.from, amp: 14, dur: 14 },
          { at: LAND, amp: 10 },
          { at: PEAK, amp: 22, dur: 18 },
        ]}
      >
        <Stage cam={cam}>
          <Atmosphere variant="day" sunPos={[60, 80, 90]} />
          <World frame={g} />
          <group position={NUBI_SPOT} rotation={[0, NUBI_YAW, 0]}>
            <Nubi size={NUBI_SIZE} pose={pose} shadowOpacity={0.45} />
          </group>
          <DustPuff frame={g} at={LAND} position={NUBI_SPOT} radius={1.4} />
          {[0, 1, 2, 3].map((i) => (
            <DustPuff
              key={i}
              frame={g}
              at={PEAK + i * 3}
              position={[NUBI_SPOT[0] - 3 + i * 2.2, 0, NUBI_SPOT[2] - 4 - i * 1.5]}
              radius={1.6}
              count={8}
            />
          ))}
        </Stage>
        <AbsoluteFill style={{ background: "#fff", opacity: whiteout }} />
        <Card
          frame={g}
          at={LAND + 4}
          out={NUBI.wordAt("L01", 4) - 2}
          x={tag.x}
          y={tag.y - 70}
          title="NUBI"
          sub="TU GUÍA DE HOY"
          rotate={-4}
          gradient="linear-gradient(135deg, #6EE7A0 0%, #22B573 55%, #128A55 100%)"
        />
        <Burst frame={g} at={PEAK} x={540} y={430} color="#FF4B3E" size={560} />
        <Card
          frame={g}
          at={PEAK - 1}
          out={END + 20}
          x={540}
          y={430}
          title="¡TERREMOTO!"
          rotate={-4}
          gradient="linear-gradient(135deg, #FF6A3D 0%, #E0322B 60%, #A3161B 100%)"
          scale={1.25}
        />
      </Shake>
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at 50% 50%, rgba(255,40,30,0) 45%, rgba(255,40,30,0.55) 100%)",
          opacity: redPulse,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
