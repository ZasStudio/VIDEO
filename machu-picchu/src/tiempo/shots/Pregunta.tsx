import React from "react";
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, clamp01, ramp } from "../../anim";
import { LifeCounter } from "../../overlay/tiempo/TiempoUI";
import { Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Civilian, civilianLook, civilianWalk } from "../../three/agua/Street";
import { Nubi, NubiPose } from "../../three/Nubi";
import { Avenue, BILLBOARD, DUSK_SKY, DuskLights, TIMECO_X, WorryDrop } from "../../three/tiempo/Avenue";
import { PREGUNTA } from "../beats";
import { NUBI_EVENTS, extraSeconds, nubiDraining, nubiHolding, nubiSeconds } from "../clock";
import { counterAt } from "../counter";
import { SHOTS } from "../shots";
import { tiempoTalk } from "../talk";

// Shot "pregunta" (PREGUNTA.START → PREGUNTA.END): "Entonces… ¿cómo consigue tiempo la gente?"
// Dusk on the avenue. Medium close-up of Nubi, who turns from the street to the camera, worried
// (a sweat drop slides down its head), and asks; on "¿cómo…?" a helpless shrug. Behind it, high on
// the dark TIMECO building, the backlit billboard (logo + "TIMECO", "TU TIEMPO, NUESTRO
// NEGOCIO") fills the top of the frame (y ≈ 230-560); tired passers-by with low counters plod by.

const FOV = 44;
const NUBI_AT: Vec3 = [TIMECO_X - 0.15, 0, 5.3];
/** Body centre (≈ 1.25 up) at screen (540, 1010): the legs sink behind the captions. */
const BODY: Vec3 = [NUBI_AT[0], 1.25, NUBI_AT[2]];
const C0: Cam = aim([NUBI_AT[0] + 0.55, 1.2, NUBI_AT[2] + 7.9], FOV, BODY, 540, 1010, 12);
const C1: Cam = aim([NUBI_AT[0] + 0.25, 1.25, NUBI_AT[2] + 7.2], FOV, BODY, 540, 1010, 12);

/** Passers-by: [look seed, counter seed, z, x at START (relative to Nubi), direction, size]. */
const WALKERS: [number, number, number, number, 1 | -1][] = [
  [61, 32, 2.0, -3.3, 1],
  [64, 14, 1.3, 2.9, -1],
  [67, 29, 2.6, 1.2, 1],
  [70, 37, 0.9, -1.4, -1],
];
const WALK_SPEED = 0.85;

export const PreguntaShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.pregunta.from;
  const t = g / 30;
  const { START, L05, COMO, END } = PREGUNTA;

  const push = ramp(g, START, END, [0, 1], Easing.inOut(Easing.sin));
  const cam: Cam = { position: lerp3(C0.position, C1.position, push), target: lerp3(C0.target, C1.target, push), fov: FOV };

  // ---- Nubi turns from the street to the camera, worried; shrugs on "¿cómo…?".
  const turn = ramp(g, START, L05 + 12, [0, 1], EASE_IN_OUT);
  const hopIn = Math.sin(Math.PI * ramp(g, START + 2, START + 12, [0, 1], Easing.linear));
  const shrug = ramp(g, COMO - 3, COMO + 6, [0, 1], EASE_OUT) * (1 - ramp(g, END - 22, END - 6, [0, 1], EASE_IN_OUT));
  const tremble = Math.sin(g * 1.9) * 0.012;
  const base: NubiPose = {
    yaw: 0,
    pitch: -0.05 + 0.03 * shrug,
    roll: tremble + 0.1 * shrug,
    hop: 0.6 * hopIn,
    squash: 0.97 - 0.03 * shrug,
    eyeScale: 1.08 + 0.1 * shrug,
    lookX: -0.5 * (1 - turn),
    lookY: 0.2 * turn + 0.15 * shrug,
    finL: 0.12 + 0.75 * shrug,
    finR: 0.12 + 0.75 * shrug,
  };
  const pose = tiempoTalk(g, base, 0.9);
  const rotY = -1.0 * (1 - turn) + 0.08;
  const drop = ramp(g, L05 + 6, L05 + 16, [0, 1], EASE_OUT);
  const slide = clamp01((g - L05 - 16) / Math.max(1, END - L05 - 16));

  const nubiCounter = counterAt(cam, [NUBI_AT[0], 2.12 + (pose.hop ?? 0) * 0.1, NUBI_AT[2]]);

  // ---- Tired passers-by plodding along the shop fronts.
  const walkers = WALKERS.map(([lookSeed, counterSeed, z, x0, dir], i) => {
    const x = NUBI_AT[0] + x0 + dir * WALK_SPEED * ((g - START) / 30);
    const look = civilianLook(lookSeed, { held: "none", backpack: null });
    const at: Vec3 = [x, 0, z];
    const w = civilianWalk(t * 0.75, i * 1.7, 1);
    const pose2: NubiPose = { ...w, pitch: 0.12, lookY: -0.5, eyeScale: 0.95 };
    const c = counterAt(cam, [x, look.size * 1.05 + 0.12, z]);
    // Fade a counter while it passes behind Nubi's own (centre of the frame).
    const clear = clamp01((Math.abs(c.x - 540) - 230) / 90);
    return { look, at, rot: dir > 0 ? Math.PI / 2 : -Math.PI / 2, pose: pose2, c, clear, counterSeed };
  });

  return (
    <AbsoluteFill style={{ background: DUSK_SKY }}>
      <Stage cam={cam} near={0.2}>
        <DuskLights billboard={BILLBOARD.center} />
        <Avenue t={t} dusk={1} xRange={[NUBI_AT[0] - 12, NUBI_AT[0] + 12]} />
        {walkers.map((w, i) => (
          <Civilian key={i} look={w.look} position={w.at} rotationY={w.rot} pose={w.pose} t={t} thirst={0.75} />
        ))}
        <Nubi size={2} position={NUBI_AT} rotationY={rotY} pose={pose} shadowOpacity={0.45}>
          <WorryDrop k={drop} slide={slide} side={1} />
        </Nubi>
      </Stage>
      {walkers.map((w, i) =>
        !w.c.behind && w.clear > 0 ? (
          <LifeCounter key={i} frame={g} seconds={extraSeconds(w.counterSeed, g)} x={w.c.x} y={w.c.y} scale={0.55} opacity={w.clear} />
        ) : null,
      )}
      {!nubiCounter.behind ? (
        <LifeCounter frame={g} seconds={nubiSeconds(g)} events={NUBI_EVENTS} draining={nubiDraining(g)} frozen={nubiHolding(g)} x={nubiCounter.x} y={nubiCounter.y} scale={0.95} />
      ) : null}
    </AbsoluteFill>
  );
};
