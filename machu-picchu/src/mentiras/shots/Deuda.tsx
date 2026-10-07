import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, clamp01, ramp, windowIn } from "../../anim";
import { TruthTag } from "../../overlay/mentiras/TruthTag";
import { Shake, Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Lids } from "../../three/dormir/Street";
import { CALLE, CALLE_SKY, Amigo, BreathFog, CalleLights, CalleStreet, DustPuffs, HeartStream, HeldBill, NubiCap, SneakerDisplay } from "../../three/mentiras/Calle";
import { NUBI_GREEN, Nubi, NubiPose } from "../../three/Nubi";
import { tagAt } from "../anchor";
import { DEUDA } from "../beats";
import { SHOTS } from "../shots";
import { amigoTalk, nubiTalk } from "../talk";
import { MENTIRAS } from "../timeline";

// Shot "deuda" (DEUDA.START → END, 9.3 s). The sneaker shop next to the café. Frame 0: from INSIDE
// the shop window, past the glowing gold sneakers on their pedestal, the friend is squashed against
// the glass, fins up, heart eyes beating, breath fogging the glass, hearts floating up (a heavenly
// choir in the mix). Nubi slides in behind him, sweet: L07 "¿Y mis cien soles?". He jumps — CUT
// outside on the jump: he spins round in the air, lands facing Nubi, sweating, empty fins out: L08
// "Te pagaría, pero estoy misio." TAG: «TIENE S/800» slams over his head; DETAIL «QUIERE COMPRAR
// ZAPATILLAS» (his eyes flick to the sneakers). HAND: Nubi holds out its fin, palm up. RUN: he
// bolts, legs spinning cartoon-style; GRAB: Nubi catches him by the hood, he keeps running in place
// (dust puffs), the tag bobbing with his head. CUT tighter for L09 (Nubi calm, menacing, half-lidded):
// "Tranquilo… tus zapatillas pueden esperar." PAGA: he gives up and hands over a 100-soles note;
// the tag's first line flips to «TIENE S/700». Nubi wears the cap with the torn hole on top.

const FOV = 40;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

const PED = CALLE.pedestal;
/** The friend squashed against the glass (his front on it), turned a little towards the sneakers. */
const PRESS: Vec3 = [3.72, 0, CALLE.glassZ + 0.9];
const PRESS_YAW = Math.PI - 0.32;
/** After the jump: back to the window, facing Nubi (and the camera). */
const FACE: Vec3 = [3.95, 0, -0.32];
const FACE_YAW = -0.28;
/** Nubi behind him (inside view), then beside him (outside). */
const NUBI_BEHIND: Vec3 = [2.75, 0, 0.45];
const NUBI_D: Vec3 = [2.05, 0, -1.2];
const NUBI_GRAB: Vec3 = [2.5, 0, -0.72];

const L07_END = MENTIRAS.lineEnd("L07");
const MISIO = MENTIRAS.wordAt("L08", 4);
const TUS = MENTIRAS.wordAt("L09", 1);

export const DeudaShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.deuda.from;
  const { START, END, L07, L08, TAG, DETAIL, HAND, RUN, GRAB, L09, PAGA } = DEUDA;
  const t = g / 30;

  const JUMP = L07_END;
  const CUT_OUT = JUMP + 2;
  const CUT_L09 = L09 - 2;
  const GIVE_UP = PAGA - 16;

  // ---- The friend.
  const pressed = g < JUMP ? 1 : 0;
  const hearts = g < JUMP ? 1 : 0;
  const rub = Math.sin(t * 2.4);
  const jumpK = ramp(g, JUMP, JUMP + 12, [0, 1], (x) => x);
  const hopArc = g >= JUMP ? Math.sin(Math.PI * jumpK) : 0;
  const turnK = ramp(g, JUMP + 1, JUMP + 10, [0, 1], EASE_IN_OUT);
  const nervous = ramp(g, JUMP + 8, L08 + 4) * (1 - ramp(g, RUN - 2, RUN + 2));
  const finsOut = windowIn(g, L08 + 2, TAG + 4, 6);
  const shrug = windowIn(g, MISIO - 3, MISIO + 12, 3);
  const tagHit = windowIn(g, TAG, TAG + 7, 1);
  const upAtTag = windowIn(g, TAG + 3, DETAIL - 1, 3);
  const flick = windowIn(g, DETAIL, HAND + 2, 2);
  const running = ramp(g, RUN, RUN + 3) * (1 - ramp(g, GIVE_UP, GIVE_UP + 10, [0, 1], EASE_IN_OUT));
  const bolt = ramp(g, RUN, GRAB - 1, [0, 1], EASE_OUT);
  const yank = windowIn(g, GRAB, GRAB + 6, 1);
  const caught = g >= GRAB ? 1 : 0;
  const giveUp = ramp(g, GIVE_UP, GIVE_UP + 10, [0, 1], EASE_IN_OUT);
  const hand = ramp(g, PAGA - 8, PAGA, [0, 1], EASE_OUT) * (1 - ramp(g, PAGA + 3, PAGA + 8));
  const slump = ramp(g, PAGA + 2, PAGA + 12, [0, 1], EASE_OUT);
  const runYaw = 1.35;
  let friendYaw = g < JUMP ? PRESS_YAW : lerp(PRESS_YAW, FACE_YAW + Math.PI * 2, turnK);
  if (g >= RUN - 2) friendYaw = lerp(FACE_YAW, runYaw, ramp(g, RUN - 2, RUN + 3, [0, 1], EASE_OUT));
  if (g >= GIVE_UP) friendYaw = lerp(runYaw, FACE_YAW - 0.15, giveUp);
  const runX = 0.7 * bolt - 0.18 * caught * ramp(g, GRAB, GRAB + 4) + 0.03 * running * Math.sin(g * 1.3);
  const friendPos: Vec3 =
    g < JUMP
      ? [PRESS[0] + 0.03 * rub, 0, PRESS[2]]
      : g < RUN
        ? lerp3(PRESS, FACE, ramp(g, JUMP, JUMP + 11, [0, 1], EASE_OUT))
        : [FACE[0] + runX * (1 - giveUp) - 0.12 * giveUp, 0, FACE[2]];
  const runBob = running * Math.abs(Math.sin(g * 1.2));
  const friendBase: NubiPose = {
    hop: 3.4 * hopArc + 0.5 * shrug + 1.2 * runBob + 0.9 * yank,
    squash: 1 - 0.1 * tagHit + 0.04 * hopArc - 0.06 * runBob - 0.08 * slump + 0.03 * Math.sin(t * 2) * pressed,
    pitch: pressed * 0.05 + 0.38 * running - 0.2 * yank + 0.12 * slump - 0.08 * upAtTag,
    roll: pressed * 0.04 * rub + 0.07 * running * Math.sin(g * 1.2) + 0.05 * nervous * Math.sin(g * 0.9),
    yaw: 0.3 * flick + 0.05 * nervous * Math.sin(g * 0.7),
    finL: pressed * (1.15 + 0.08 * rub) + finsOut * 0.85 + shrug * 0.5 + running * (0.6 + 0.9 * Math.sin(g * 1.2)) + hand * 0.55 - 0.2 * slump,
    finR: pressed * (1.15 - 0.08 * rub) + finsOut * 0.85 + shrug * 0.5 + running * (0.6 - 0.9 * Math.sin(g * 1.2)) - 0.2 * slump,
    wiggle: running * 1.0 + 0.4 * hopArc,
    wigglePhase: g * (running > 0.1 ? 2.6 : 0.8),
    lookX: 0.15 * pressed + 0.6 * nervous * Math.sin(g * 0.45) * (1 - upAtTag) * (1 - flick) + 0.95 * flick - 0.35 * hand,
    lookY: 0.65 * upAtTag - 0.2 * slump,
    eyeScale: 1 + 0.4 * windowIn(g, JUMP, JUMP + 14, 2) + 0.25 * tagHit + 0.15 * running - 0.12 * slump,
    blink: 0,
  };
  const friendPose = amigoTalk(g, friendBase, 1);
  if (g < JUMP + 14 || tagHit > 0.1) friendPose.blink = 0;
  const friendDroop = Math.max(0.35 * nervous * (1 - flick) * (1 - tagHit), 0.55 * slump);
  const sweat = g >= L08 + 6 && g < RUN ? ((g - L08 - 6) % 30) / 30 : 0;
  const hoodPull = caught * (1 - ramp(g, PAGA, PAGA + 6)) * (0.55 + 0.12 * Math.sin(g * 1.2) * running);

  // ---- Nubi: slides in behind him (sweet), then beside him: fin out (HAND), the grab, L09 calm and
  // menacing, takes the money and raises it.
  const slideIn = ramp(g, L07 - 10, L07 + 2, [0, 1], EASE_OUT);
  const sweet = windowIn(g, L07 - 6, JUMP + 2, 4);
  const handOut = ramp(g, HAND - 2, HAND + 5, [0, 1], EASE_OUT) * (1 - ramp(g, RUN, RUN + 4));
  const gimme = handOut * Math.max(0, Math.sin((g - HAND) * 0.7)) * 0.25;
  const lunge = ramp(g, RUN + 2, GRAB, [0, 1], EASE_OUT);
  const holding = ramp(g, GRAB - 3, GRAB + 1) * (1 - ramp(g, PAGA, PAGA + 6));
  const menace = ramp(g, L09 - 2, L09 + 8) * (1 - ramp(g, PAGA + 2, PAGA + 10));
  const took = g >= PAGA + 3 ? 1 : 0;
  const raise = ramp(g, PAGA + 3, PAGA + 12, [0, 1], EASE_OUT);
  const nubiPos: Vec3 =
    g < JUMP ? [NUBI_BEHIND[0] - 1.6 * (1 - slideIn), 0, NUBI_BEHIND[2]] : lerp3(NUBI_D, NUBI_GRAB, lunge * (1 - 0.6 * ramp(g, PAGA + 4, PAGA + 16, [0, 1], EASE_IN_OUT)));
  const nubiYaw = g < JUMP ? 2.62 : lerp(0.72, 0.3, lunge) + 0.1 * raise;
  const nubiBase: NubiPose = {
    hop: 0.5 * windowIn(g, L07 - 10, L07 - 2, 3) * (g < JUMP ? 1 : 0) + 0.6 * raise * windowIn(g, PAGA + 3, PAGA + 14, 2),
    roll: 0.14 * sweet,
    pitch: 0.06 * sweet + 0.13 * menace,
    finR: 0.3 * sweet + 0.32 * handOut + gimme + holding * 1.15 + raise * 1.25,
    finL: 0.3 * sweet + 0.05,
    eyeScale: 1 + 0.18 * sweet - 0.04 * menace,
    lookX: (g < JUMP ? 0 : 0.55) - 0.4 * menace * windowIn(g, TUS, PAGA - 4, 4),
    lookY: 0.05,
    wiggle: 0.35 * windowIn(g, L07 - 10, L07, 2),
    wigglePhase: g * 0.7,
  };
  const nubiPose = nubiTalk(g, nubiBase, g >= L09 ? 0.6 : 0.85);
  const nubiDroop = 0.5 * menace;

  // ---- Cameras: D1 inside the shop window; D2 outside two-shot (tracks his getaway a little);
  // D3 tighter for L09 and the payment.
  const faceOnGlass: Vec3 = [PRESS[0], 1.15, CALLE.glassZ];
  const drift = ramp(g, START, CUT_OUT, [0, 1], (x) => x);
  const camD1 = aim([PED[0] - 0.55 + 0.1 * drift, 2.05, -9.6 + 0.5 * drift], FOV, faceOnGlass, 540, 760);
  const track = ramp(g, RUN, GRAB + 6, [0, 1], EASE_IN_OUT);
  const pushD2 = ramp(g, CUT_OUT, CUT_L09, [0, 1], (x) => x);
  const friendEyes: Vec3 = [FACE[0] + 0.35 * track, 1.12, FACE[2]];
  const camD2 = aim([lerp(5.6, 5.5, pushD2) + 0.35 * track, 1.95, lerp(10.0, 9.5, pushD2)], FOV, friendEyes, 600, 1010);
  const pushD3 = ramp(g, CUT_L09, END, [0, 1], (x) => x);
  const camD3 = aim([lerp(5.5, 5.35, pushD3), 1.7, lerp(8.6, 8.1, pushD3)], FOV, [FACE[0] + 0.4, 1.12, FACE[2]], 620, 1020);
  const cam: Cam = g < CUT_OUT ? camD1 : g < CUT_L09 ? camD2 : camD3;

  // ---- The truth tag over the friend's head (his backwards cap's top ≈ 11.9 model units).
  const fs = friendPose.squash ?? 1;
  const headTop = 0.2 * ((friendPose.hop ?? 0) + fs * 11.9) + 0.22;
  const lean = 0.2 * 6 * Math.sin(friendPose.pitch ?? 0);
  const tg = tagAt(cam, [friendPos[0] + lean * Math.sin(friendYaw), headTop, friendPos[2] + lean * Math.cos(friendYaw)], { max: 1.05 });
  const tagX = Math.min(620, Math.max(460, tg.x));
  const tagY = Math.max(600, Math.min(1000, tg.y));

  return (
    <AbsoluteFill style={{ background: CALLE_SKY }}>
      <Shake
        frame={g}
        impacts={[
          { at: JUMP, amp: 6, dur: 8 },
          { at: TAG, amp: 12, dur: 12 },
          { at: GRAB, amp: 7, dur: 8 },
          { at: PAGA, amp: 3, dur: 6 },
        ]}
      >
        <Stage cam={cam} near={0.1} far={120}>
          <CalleLights />
          <CalleStreet />
          <group position={PED}>
            <SneakerDisplay t={t} glow={g < JUMP ? 1.4 : 0.8} />
          </group>
          {g < JUMP ? <BreathFog position={[PRESS[0] + 0.03 * rub, 1.0, CALLE.glassZ - 0.02]} amount={0.55 + 0.45 * Math.max(0, Math.sin(t * 2.6))} /> : null}
          <Amigo
            position={friendPos}
            rotationY={friendYaw}
            pose={friendPose}
            hearts={hearts}
            beat={g}
            squish={pressed}
            droop={friendDroop}
            tilt={slump > 0.3 ? 0.25 : -0.05}
            hood={hoodPull}
            sweat={sweat}
            shadow={g >= JUMP}
            holdL={hand > 0.02 && !took ? <HeldBill raise={friendBase.finL ?? 0} side="L" turn={-0.4} /> : null}
          />
          {g < JUMP ? <HeartStream g={g} at={[PRESS[0], 2.15, PRESS[2] - 0.6]} on={1} size={0.17} /> : null}
          <Nubi size={2} position={nubiPos} rotationY={nubiYaw} pose={nubiPose} shadowOpacity={0.4} palette={{ eyeRough: 0.6 }} holdR={took ? <HeldBill raise={nubiPose.finR ?? 0} turn={0.5} /> : null}>
            <NubiCap rip={0.92} wobble={g} />
            <Lids pose={nubiPose} droop={nubiDroop} tilt={-0.3} color={NUBI_GREEN} />
          </Nubi>
          <DustPuffs g={g} at={[friendPos[0] - 0.3, 0, friendPos[2]]} on={running * caught} dir={[1, 0]} />
        </Stage>
        {!tg.behind && g >= TAG - 1 ? (
          <TruthTag
            frame={g}
            at={TAG}
            lines={[{ text: "TIENE S/800", then: { text: "TIENE S/700", at: PAGA } }, { text: "QUIERE COMPRAR ZAPATILLAS", at: DETAIL }]}
            x={tagX}
            y={tagY}
            scale={tg.scale * (1 + 0.04 * clamp01(windowIn(g, PAGA, PAGA + 8, 2)))}
          />
        ) : null}
      </Shake>
    </AbsoluteFill>
  );
};

