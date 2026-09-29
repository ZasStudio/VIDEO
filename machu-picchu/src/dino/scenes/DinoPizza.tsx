import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN, EASE_OUT, pop, ramp, windowIn } from "../../anim";
import { FactCard, SpeechBubble } from "../../overlay/dino/DinoUI";
import { Shake, Stage } from "../../scenes/common";
import { Vec3 } from "../../three/CameraRig";
import { Twinkles } from "../../three/Effects3D";
import { BabyDino, Raptor } from "../../three/dino/Dinos";
import { PIZZA_BOX, PizzaBox, PottedPlant } from "../../three/dino/Props";
import { CityStreet } from "../../three/dino/Sets";
import { Nubi } from "../../three/Nubi";
import { Poof, SweatDrops } from "../../inca/effects";
import { PIZZA } from "../beats";
import { Outfit } from "../outfit";
import { dinoTalk } from "../talk";
import { DINO } from "../timeline";

// First person: we are the delivery guy, walking with a pizza. "Pedir pizza sería un deporte
// extremo." A feathered raptor bursts in and snatches the box. Third person: "Dato: los
// velociraptores eran del tamaño de un pavo… ¡y con plumas!" — it's eating the pizza right
// there. "¿Y las mascotas? «Mamá, ¿puedo tener un dinosaurio?»" — "¡Ni siquiera puedes cuidar
// una planta!" — the plant wilts.

const NUBI_AT: Vec3 = [-0.9, 0, 3.0];
const RAPTOR_AT: Vec3 = [1.0, 0, 2.6];
const PLANT_AT: Vec3 = [-2.2, 0, 3.4];
const BABY_AT: Vec3 = [0.6, 0, 3.6];
const CAM = { position: [0.0, 2.3, 10.8] as Vec3, target: [0.0, 1.35, 0] as Vec3, fov: 42 };

export const DinoPizza: React.FC = () => {
  const frame = useCurrentFrame();
  const S = DINO.SCENES.pizza;
  const g = frame + S.from;
  const t = g / 30;
  const { END, SNATCH, POV_END, DATO, PLUMAS, MASCOTAS, MAMA, MOM, PLANTA } = PIZZA;
  const pov = g < POV_END;

  // ---- First person: walk along the sidewalk, box held in front; the snatch ----
  const walked = (g - S.from) * 0.07 * (1 - ramp(g, SNATCH - 2, SNATCH + 6));
  const bob = Math.abs(Math.sin(g * 0.32)) * 0.06;
  const eye: Vec3 = [-0.4, 1.55 + bob, 6 - walked];
  const povCam = { position: eye, target: [eye[0] + 0.05, 1.2, eye[2] - 6] as Vec3, fov: 55, roll: Math.sin(g * 0.16) * 0.02 };
  const grab = ramp(g, SNATCH - 4, SNATCH + 2, [0, 1], EASE_IN);
  const away = ramp(g, SNATCH + 2, POV_END + 10, [0, 1], EASE_OUT);
  // The raptor dashes in from the right, bites the box and runs off up the street.
  const rapPov: Vec3 = [
    eye[0] + 2.8 - grab * 2.6 - away * 1.2,
    0,
    eye[2] - 2.6 - away * 9,
  ];
  const boxHeld: Vec3 = [eye[0], eye[1] - 0.62 + bob * 0.3, eye[2] - 1.6];

  // ---- Third person ----
  const munch = windowIn(g, DATO - 6, MASCOTAS - 2, 6);
  const petsIn = pop(g, MASCOTAS - 2, { damping: 9, stiffness: 180 });
  const plead = windowIn(g, MAMA - 4, MOM + 4, 5);
  const wilt = ramp(g, PLANTA - 16, PLANTA + 10, [0, 1], EASE_IN);
  const plantIn = pop(g, MOM - 6, { damping: 10, stiffness: 190 });
  const sad = ramp(g, PLANTA + 4, PLANTA + 20);
  const pose = dinoTalk(g, {
    finL: plead * (1.05 + 0.1 * Math.sin(g * 0.8)) - sad * 0.4,
    finR: plead * (1.05 + 0.1 * Math.cos(g * 0.8)) - sad * 0.4 + munch * -0.2,
    eyeScale: 1 + plead * 0.35 - sad * 0.3 + windowIn(g, DATO, DATO + 30, 5) * 0.2,
    hop: plead * Math.abs(Math.sin((g - MAMA) * 0.4)) * 0.8,
    lookX: munch * 0.7 + windowIn(g, MOM, PLANTA, 4) * -0.6,
    lookY: -sad * 0.4,
    pitch: sad * 0.12,
  });
  const rapPose = {
    jaw: munch * (0.25 + 0.25 * Math.abs(Math.sin(g * 0.9))),
    headPitch: munch * 0.45,
    headYaw: windowIn(g, PLUMAS - 4, MASCOTAS, 4) * -0.6,
    tail: Math.sin(g * 0.2) * 0.5,
    blink: g % 71 < 3 ? 1 : 0,
    crouch: munch * 0.3,
  };

  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #3FA9FF 0%, #8FD3FF 60%, #DFF4FF 100%)" }}>
      <Shake frame={g} impacts={[{ at: SNATCH, amp: 22, dur: 14 }]}>
        {pov ? (
          <Stage cam={povCam} near={0.05}>
            <hemisphereLight args={["#FFFFFF", "#7F8FA8", 1.3]} />
            <directionalLight position={[-6, 12, 8]} intensity={2.4} color="#FFF6E8" />
            <CityStreet t={t} />
            {g < SNATCH ? (
              <group position={boxHeld} rotation={[0.25, 0, 0]} scale={0.6}>
                <PizzaBox open={0} />
              </group>
            ) : null}
            <Raptor
              size={1}
              position={rapPov}
              rotationY={g < SNATCH + 2 ? -Math.PI / 2 - 0.3 : Math.PI}
              pose={{ run: 1, runPhase: g * 0.9, snatch: grab * (1 - away), jaw: g < SNATCH ? 0.6 : 0.25 }}
            >
              {/* Children already sit at the bite point: just push the box out by half its depth. */}
              {g >= SNATCH ? (
                <group position={[0, 0, PIZZA_BOX.d / 2 - 0.05]}>
                  <PizzaBox open={0} />
                </group>
              ) : null}
            </Raptor>
          </Stage>
        ) : (
          <Stage cam={CAM}>
            <hemisphereLight args={["#FFFFFF", "#7F8FA8", 1.3]} />
            <directionalLight position={[-6, 12, 8]} intensity={2.4} color="#FFF6E8" />
            <CityStreet t={t} />
            <group position={[RAPTOR_AT[0] + 0.1, 0, RAPTOR_AT[2] + 0.9]}>
              <PizzaBox open={1} />
            </group>
            <Raptor size={0.95} position={RAPTOR_AT} rotationY={-0.5} pose={rapPose} />
            <group position={NUBI_AT} rotation={[0, 0.3, 0]}>
              <Nubi size={2} pose={pose} shadowOpacity={0.4}>
                <Outfit kind="delivery" />
              </Nubi>
            </group>
            {petsIn > 0.01 ? (
              <group position={BABY_AT} scale={petsIn}>
                <BabyDino size={0.8} pose={{ hop: Math.abs(Math.sin(g * 0.3)) * 0.15, blink: g % 61 < 3 ? 1 : 0, tail: Math.sin(g * 0.25) }} />
              </group>
            ) : null}
            <Poof frame={g} at={MASCOTAS - 2} position={BABY_AT} radius={1.0} />
            {plantIn > 0.01 ? (
              <group position={PLANT_AT} scale={plantIn}>
                <PottedPlant wilt={wilt} />
              </group>
            ) : null}
            <Twinkles frame={g} at={MASCOTAS} position={[BABY_AT[0], 1.0, BABY_AT[2]]} radius={0.9} count={10} />
            <SweatDrops frame={g} from={PLANTA} to={END} position={[NUBI_AT[0], 2.0, NUBI_AT[2] + 0.2]} spread={0.8} />
          </Stage>
        )}
      </Shake>
      {!pov ? (
        <>
          <FactCard
            frame={g}
            at={DATO}
            out={MASCOTAS - 8}
            x={500}
            y={640}
            text={"VELOCIRAPTOR: TAMAÑO DE UN PAVO…\n*¡Y CON PLUMAS!*"}
            visual="raptor-vs-turkey"
            highlightAt={PLUMAS}
          />
          <SpeechBubble
            frame={g}
            at={MOM}
            out={END + 10}
            x={480}
            y={440}
            speaker="MAMÁ"
            text="¡NI SIQUIERA PUEDES CUIDAR UNA PLANTA!"
            tail="left"
            tone="angry"
            wordFrames={[0, 1, 2, 3, 4, 5].map((i) => DINO.wordAt("L09", i))}
          />
        </>
      ) : null}
    </AbsoluteFill>
  );
};
