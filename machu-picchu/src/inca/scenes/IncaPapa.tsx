import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_OUT, pop, ramp, windowIn } from "../../anim";
import { Burst } from "../../overlay/Graphics";
import { WeatherCard } from "../../overlay/inca/PhoneUI";
import { Shake, Stage } from "../../scenes/common";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { DustPuff, Twinkles } from "../../three/Effects3D";
import { Chaquitaclla } from "../../three/inca/Costumes";
import { PapaBot } from "../../three/inca/PapaBot";
import { Phone3D } from "../../three/inca/Phone3D";
import { PotatoPlant, Terraces } from "../../three/inca/Sets";
import { Nubi } from "../../three/Nubi";
import { skyGradient } from "../../three/World";
import { Outfit, Upright } from "../outfit";
import { incaTalk } from "../talk";
import { PAPA } from "../beats";
import { INCA, SPEAKER } from "../timeline";

// Nubi as a farmer on the terraces: "Los agricultores tendrían una app para saber cuándo
// sembrar." A potato-shaped assistant pops out of the phone: "Mañana habrá lluvia."
// "¡Perfecto! Hoy toca sembrar… ¡papa con tecnología!" and potato plants sprout in a row.

const NUBI_AT: Vec3 = [-0.7, 0, 1.6];
const NUBI_SIZE = 1.9;
const BOT_AT: Vec3 = [0.9, 1.75, 1.9];
const PLANTS: Vec3[] = [
  [0.3, 0, 2.3],
  [1.0, 0, 2.0],
  [1.7, 0, 1.7],
  [2.4, 0, 1.4],
];
const CAM_A = { position: [0.7, 2.6, 9.4] as Vec3, target: [0.3, 2.3, 0] as Vec3 };
const CAM_B = { position: [0.5, 2.4, 8.4] as Vec3, target: [0.25, 2.2, 0] as Vec3 };

export const IncaPapa: React.FC = () => {
  const frame = useCurrentFrame();
  const S = INCA.SCENES.papa;
  const g = frame + S.from;
  const { END, APP, P_START, BOT_POP, PERFECTO, HOY, SEMBRAR, STRIKES, SPROUT, PAPA_TEC } = PAPA;

  const u = ramp(g, S.from, END, [0, 1], (x) => x);
  const cam = { position: lerp3(CAM_A.position, CAM_B.position, u), target: lerp3(CAM_A.target, CAM_B.target, u), fov: 42 };

  // The phone goes up on "app"; on "¡perfecto!" Nubi jumps, then strikes the ground with the
  // chaquitaclla (the fin swings down on each strike).
  const phoneUp = windowIn(g, APP - 4, PERFECTO + 4, 6);
  const happy = windowIn(g, PERFECTO, HOY - 4, 4);
  const cheer = windowIn(g, PAPA_TEC, END + 20, 5);
  const strike = STRIKES.reduce((acc, s) => Math.max(acc, g >= s - 6 && g < s + 8 ? (g < s ? (g - s + 6) / 6 : 1 - (g - s) / 8) : 0), 0);
  const finR = 0.35 + 0.55 * windowIn(g, HOY - 8, SEMBRAR + 26, 4) - strike * 0.9 + cheer * 0.6;
  const pose = incaTalk(g, {
    finR,
    finL: 0.25 + phoneUp * 0.75 + cheer * 0.4 * Math.sin((g - PAPA_TEC) * 0.6),
    hop: happy * Math.abs(Math.sin((g - PERFECTO) * 0.4)) * 2 + cheer * Math.abs(Math.sin((g - PAPA_TEC) * 0.32)) * 1.2,
    pitch: strike * 0.18,
    lookX: phoneUp * -0.5 + windowIn(g, BOT_POP, PERFECTO, 5) * 0.55 + windowIn(g, HOY, PAPA_TEC, 5) * 0.6,
    lookY: phoneUp * 0.25,
    eyeScale: 1 + happy * 0.25 + (g >= BOT_POP && g < BOT_POP + 14 ? 0.35 : 0),
  });

  // The potato assistant: pops out of the phone, bounces while it talks, cheers at the end.
  const botK = pop(g, BOT_POP, { damping: 10, stiffness: 190 });
  const papaLvl = SPEAKER.papa.voiceLevel(g);
  const papaAcc = SPEAKER.papa.voiceAccent(g);
  const botPos: Vec3 = lerp3([NUBI_AT[0] - 0.9, 1.2, NUBI_AT[2] + 0.4], BOT_AT, ramp(g, BOT_POP, BOT_POP + 12, [0, 1], EASE_OUT));
  const botPose = {
    hop: papaAcc * 0.25 + Math.sin(g * 0.12) * 0.06 + cheer * Math.abs(Math.sin((g - PAPA_TEC) * 0.32 + 1)) * 0.35,
    squash: 1 - papaLvl * 0.06 + papaAcc * 0.1,
    talk: papaLvl,
    glow: 0.5 + papaLvl * 0.5,
    blink: g % 67 < 3 ? 1 : 0,
  };

  return (
    <AbsoluteFill style={{ background: skyGradient("day") }}>
      <Shake frame={g} impacts={[{ at: PERFECTO, amp: 8, dur: 10 }, ...STRIKES.map((s) => ({ at: s, amp: 6, dur: 8 }))]}>
        <Stage cam={cam}>
          <hemisphereLight args={["#F4FBFF", "#5C7A3A", 1.3]} />
          <directionalLight position={[-6, 10, 8]} intensity={2.5} color="#FFF6E4" />
          <directionalLight position={[7, 4, -4]} intensity={0.9} color="#BFE3FF" />
          <Terraces />
          {PLANTS.map((p, i) => {
            const k = pop(g, SPROUT(i), { damping: 9, stiffness: 200 });
            return k > 0.01 ? (
              <group key={i} position={p} scale={Math.max(0.001, k)}>
                <PotatoPlant />
              </group>
            ) : null;
          })}
          {STRIKES.map((s) => (
            <DustPuff key={s} frame={g} at={s} position={[NUBI_AT[0] + 1.2, 0, NUBI_AT[2] + 0.4]} radius={0.8} count={7} color="#C9A46A" />
          ))}
          <group position={NUBI_AT} rotation={[0, 0.3, 0]}>
            <Nubi
              size={NUBI_SIZE}
              pose={pose}
              shadowOpacity={0.4}
              holdR={
                <Upright raise={finR}>
                  <group position={[0.2, 1.0, 0.6]} rotation={[0, 0, -0.25 - strike * 0.5]}>
                    <Chaquitaclla />
                  </group>
                </Upright>
              }
              holdL={
                <Upright raise={pose.finL ?? 0} side="L">
                  <group position={[-0.2, 1.3, 0.8]} rotation={[0.1, 0.3, 0]} scale={2.6}>
                    <Phone3D screen={g < BOT_POP ? "home" : "weather"} glow={phoneUp} />
                  </group>
                </Upright>
              }
            >
              <Outfit kind="farmer" />
            </Nubi>
          </group>
          {botK > 0.01 ? (
            <group position={botPos} scale={Math.max(0.001, botK)}>
              <PapaBot size={0.95} pose={botPose} />
            </group>
          ) : null}
          <Twinkles frame={g} at={BOT_POP} position={BOT_AT} radius={1.0} count={10} color="#9FF3FF" />
          <Twinkles frame={g} at={PAPA_TEC} position={[1.4, 0.8, 1.9]} radius={1.8} count={16} />
        </Stage>
        <WeatherCard frame={g} at={P_START} out={SEMBRAR - 4} x={540} y={470} />
        <Burst frame={g} at={PAPA_TEC} x={600} y={900} color="#FFD60A" size={620} />
      </Shake>
    </AbsoluteFill>
  );
};
