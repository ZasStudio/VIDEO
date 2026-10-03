import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, clamp01, ramp, windowIn } from "../../anim";
import { LifeCounter } from "../../overlay/tiempo/TiempoUI";
import { Shake, Stage } from "../../scenes/common";
import { aim } from "../../thanos/camera";
import { Vec3 } from "../../three/CameraRig";
import { Nubi, NubiPose } from "../../three/Nubi";
import { Civilian, civilianIdle, civilianLook, civilianWalk } from "../../three/agua/Street";
import { Banknote, MARKET, MARKET_SKY, MarketLights, MarketStreet, SandGlints } from "../../three/tiempo/Market";
import { HOOK } from "../beats";
import { NUBI_EVENTS, extraSeconds, nubiDraining, nubiHolding, nubiSeconds } from "../clock";
import { counterAt } from "../counter";
import { SHOTS } from "../shots";
import { tiempoTalk } from "../talk";

// Shot 1 "intro" (HOOK.START → HOOK.END). L01 "En mi mundo no existe el dinero… todo se paga con
// el tiempo que te queda de vida." Medium close-up of Nubi on the sunny market street, facing the
// camera, slow push-in, talking the whole line; its life counter big over its head (bottom ≈ y
// 650) while the top band (y 230-470) stays free for the title sticker. Passers-by walk behind
// with their own small counters. On DINERO a banknote flutters down past Nubi's left side and
// crumbles into golden sand (gone by DINERO + 20); Nubi glances at it. On TIEMPO the camera rises
// and pushes in: the counter becomes the hero (scale → 1.25, bottom ≈ y 790) with Nubi's eyes
// still above the captions; Nubi glances up at it.

const FPS = 30;
const FOV = 36;
const NUBI = MARKET.introNubi;
const EYE: Vec3 = [NUBI[0], NUBI[1] + 1.12, NUBI[2]];
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Passers-by behind Nubi: [seed, x at frame 0, z, speed (units/s, 0 = standing), facing]. */
const WALKERS: [number, number, number, number, number][] = [
  [3, -3.3, -2.3, 0.95, Math.PI / 2],
  [8, 4.4, -3.4, -0.85, -Math.PI / 2],
  [12, 2.35, -1.6, 0, -0.5],
];

export const IntroShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.intro.from;
  const { START, DINERO, TIEMPO, VIDA } = HOOK;
  const t = g / FPS;

  // ---- Camera: slow push-in; on TIEMPO it rises and pushes so the counter is the hero.
  const push = ramp(g, START, TIEMPO, [0, 1], (x) => x);
  const rise = ramp(g, TIEMPO - 2, TIEMPO + 16, [0, 1], EASE_IN_OUT);
  const dist = lerp(9.7, 8.9, push) - 1.55 * rise;
  const position: Vec3 = [0.4 - 0.15 * rise + 0.08 * Math.sin(t * 0.7), 1.45 + 1.05 * rise, NUBI[2] + dist];
  const cam = aim(position, FOV, EYE, 540, lerp(985, 1128, rise));

  // ---- The banknote: flutters in from the upper left, crumbles on DINERO + 2.
  const fallU = ramp(g, DINERO - 16, DINERO + 10, [0, 1], (x) => x);
  const notePos: Vec3 = [lerp(-2.15, -1.0, fallU) + 0.16 * Math.sin(g * 0.24), lerp(2.55, 1.3, fallU), NUBI[2] + 0.95];
  const noteRot: Vec3 = [0.35 + 0.45 * Math.sin(g * 0.29), 0.35 * Math.sin(g * 0.21), 0.55 * Math.sin(g * 0.17)];
  const crumbleAt = DINERO + 2;
  const showNote = g >= DINERO - 16 && g < DINERO + 22;

  // ---- Nubi: talks the whole line; glances at the note, then up at its counter on TIEMPO.
  const glance = windowIn(g, DINERO - 10, DINERO + 18, 5);
  const noteDown = ramp(g, DINERO - 10, DINERO + 12, [0, 1], (x) => x);
  const lookUp = windowIn(g, TIEMPO + 3, VIDA - 4, 6);
  const open = windowIn(g, START + 14, START + 40, 8);
  const base: NubiPose = {
    lookX: -0.75 * glance,
    lookY: glance * lerp(0.25, -0.45, noteDown) + 0.7 * lookUp,
    yaw: -0.16 * glance,
    pitch: -0.08 * lookUp,
    eyeScale: 1 + 0.12 * glance + 0.08 * lookUp,
    finL: 0.25 * open + 0.15 * glance,
    finR: 0.25 * open,
  };
  const pose = tiempoTalk(g, base, 1);

  // ---- Life counters.
  const head: Vec3 = [NUBI[0], NUBI[1] + 1.98 + 0.1 + 0.2 * (pose.hop ?? 0), NUBI[2]];
  const nubiC = counterAt(cam, head);
  const nubiScale = lerp(0.95, 1.25, rise);

  const walkers = WALKERS.map(([seed, x0, z, speed, facing], i) => {
    const look = civilianLook(seed, { held: "none", glasses: i === 1 ? "round" : "none" });
    const x = x0 + speed * t;
    const at: Vec3 = [x, 0, z];
    const p: NubiPose = speed !== 0 ? civilianWalk(t, i * 1.7, 1) : { ...civilianIdle(t, i), finR: 0.2 + 0.15 * Math.sin(t * 2), lookX: 0.3 };
    const c = counterAt(cam, [x, look.size * 0.99 + 0.12 + (look.size / 10) * (p.hop ?? 0), z]);
    // Fade a passer-by's counter while it passes behind Nubi's own.
    const fade = clamp01((Math.abs(c.x - nubiC.x) - 190) / 90);
    return { look, at, rot: facing, pose: p, c, fade, seed };
  });

  const crumbleD = g - crumbleAt;
  return (
    <AbsoluteFill style={{ background: MARKET_SKY }}>
      <Shake frame={g} impacts={[{ at: TIEMPO, amp: 3, dur: 10 }]}>
        <Stage cam={cam} near={0.1}>
          <MarketLights />
          <MarketStreet t={t} />
          {walkers.map((w, i) => (
            <Civilian key={i} look={w.look} position={w.at} rotationY={w.rot} pose={w.pose} t={t} thirst={0} />
          ))}
          <Nubi size={2} position={NUBI} pose={pose} shadowOpacity={0.4} />
          {showNote ? <Banknote d={crumbleD} pos={notePos} rot={noteRot} crumble={9} /> : null}
          <SandGlints d={crumbleD} pos={notePos} />
        </Stage>
        {walkers.map((w, i) =>
          w.c.behind || w.fade <= 0 ? null : (
            <LifeCounter key={i} frame={g} seconds={extraSeconds(w.seed, g)} x={w.c.x} y={w.c.y} scale={0.55} opacity={w.fade} />
          ),
        )}
        {nubiC.behind ? null : (
          <LifeCounter
            frame={g}
            seconds={nubiSeconds(g)}
            x={nubiC.x}
            y={nubiC.y}
            scale={nubiScale * (1 + 0.04 * ramp(g, TIEMPO, TIEMPO + 4, [0, 1], EASE_OUT) * (1 - ramp(g, TIEMPO + 4, TIEMPO + 14)))}
            events={NUBI_EVENTS}
            draining={nubiDraining(g)}
            frozen={nubiHolding(g)}
          />
        )}
      </Shake>
    </AbsoluteFill>
  );
};
