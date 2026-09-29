import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN, EASE_IN_OUT, EASE_OUT, pop, ramp, windowIn } from "../../anim";
import { Card, Flash } from "../../overlay/Graphics";
import { SelfieUI } from "../../overlay/inca/PhoneUI";
import { SMOOTH, Shake, Stage } from "../../scenes/common";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Llama } from "../../three/inca/Llama";
import { Phone3D } from "../../three/inca/Phone3D";
import { Nubi } from "../../three/Nubi";
import { Atmosphere, World, skyGradient } from "../../three/World";
import { SweatDrops } from "../effects";
import { Outfit, Upright } from "../outfit";
import { ViralHearts } from "../overlays";
import { incaTalk } from "../talk";
import { SELFIE as B } from "../beats";
import { INCA } from "../timeline";
import { INTRO_SIZE, INTRO_SPOT, INTRO_YAW } from "./IncaIntro";

// "Y Machu Picchu sería el lugar más viral del imperio." Nubi takes a selfie on a terrace and
// the likes pour in. "POV: subiste hasta aquí, te falta el aire… pero igual grabas tu
// TikTok": we see through the phone's front camera; two llamas photobomb and one shoves
// Nubi out of the shot ("¡Oye!") to pose for the photo itself.

const SPOT = INTRO_SPOT;

// Shot 1: Machu Picchu and Nubi with its phone up high.
const WIDE_A = { position: [4.4, 3.4, 34.5] as Vec3, target: [2.4, -0.6, 0] as Vec3 };
const WIDE_B = { position: [4.1, 3.0, 32.6] as Vec3, target: [2.4, -0.5, 0] as Vec3 };
// Shot 2: the front camera, at arm's length, a little above Nubi.
const SELFIE: { position: Vec3; target: Vec3 } = {
  position: [SPOT[0] + 0.35, 1.75, SPOT[2] + 4.3],
  target: [SPOT[0] - 0.1, 1.05, SPOT[2] - 6],
};

const LLAMA_SIZE = 1.9;

export const IncaSelfie: React.FC = () => {
  const frame = useCurrentFrame();
  const S = INCA.SCENES.selfie;
  const g = frame + S.from;
  const { END, VIRAL, POV, AIRE, PERO, GRABAS, OYE, SHOVE, FLASH } = B;

  const selfie = g >= POV;
  // After the shutter the photo freezes.
  const t = Math.min(g, FLASH);

  // ---- Shot 1 --------------------------------------------------------------------------
  const u = ramp(g, S.from, POV, [0, 1], SMOOTH);
  const wideCam = { position: lerp3(WIDE_A.position, WIDE_B.position, u), target: lerp3(WIDE_A.target, WIDE_B.target, u), fov: 45 };
  const raise = ramp(g, S.from + 4, S.from + 18, [0, 1], EASE_OUT);
  const likes = windowIn(g, VIRAL, POV + 10, 4);
  const widePose = incaTalk(g, {
    finR: 1.15 * raise,
    finL: likes * (0.8 + 0.3 * Math.sin((g - VIRAL) * 0.6)),
    hop: likes * Math.abs(Math.sin((g - VIRAL) * 0.32)) * 1.2,
    lookX: 0.45 * raise,
    lookY: 0.55 * raise,
    eyeScale: 1 + likes * 0.2,
  });

  // ---- Shot 2: through the front camera ---------------------------------------------------
  const hand = selfie ? [Math.sin(t * 0.21) * 0.03, Math.cos(t * 0.17) * 0.025] : [0, 0];
  const selfieCam = {
    position: [SELFIE.position[0] + hand[0], SELFIE.position[1] + hand[1], SELFIE.position[2]] as Vec3,
    target: SELFIE.target,
    fov: 50,
    roll: 0.05,
  };
  const pant = windowIn(t, POV + 4, PERO - 2, 6);
  const posing = windowIn(t, PERO, SHOVE, 5);
  // The shove: Nubi flies out to the left, spinning.
  const fly = ramp(t, SHOVE, SHOVE + 11, [0, 1], EASE_IN);
  const nubiX = -fly * 3.4;
  const selfiePose = incaTalk(t, {
    squash: 1 + pant * 0.06 * Math.sin(t * 0.55),
    pitch: pant * 0.1,
    blink: pant * 0.45,
    finR: 0.55,
    finL: posing * (1.25 + 0.1 * Math.sin((t - PERO) * 0.5)),
    hop: posing * Math.abs(Math.sin((t - PERO) * 0.3)) * 0.8,
    eyeScale: 1 + posing * 0.15 + fly * 0.45,
    roll: fly * 1.2,
    lookX: fly * -0.8,
    lookY: 0.05,
  });

  // Llama A peeks in on the right on "aire", leans in, shoves, then takes the middle.
  const aIn = ramp(t, AIRE - 6, AIRE + 8, [0, 1], EASE_OUT);
  const aShove = ramp(t, SHOVE - 6, SHOVE + 2, [0, 1], EASE_IN_OUT) * (1 - ramp(t, SHOVE + 6, SHOVE + 14));
  const aCentre = ramp(t, OYE + 1, OYE + 12, [0, 1], EASE_IN_OUT);
  const llamaA: Vec3 = [
    SPOT[0] + 2.5 - aIn * 1.25 - aShove * 0.9 - aCentre * 0.35,
    0,
    SPOT[2] - 1.3 + aShove * 0.8 + aCentre * 1.0,
  ];
  const aPose = {
    walk: Math.max(ramp(t, AIRE - 6, AIRE + 8) * (1 - ramp(t, AIRE + 6, AIRE + 10)), windowIn(t, OYE + 1, OYE + 12, 2)),
    walkPhase: t * 0.5,
    neck: 0.2 + aShove * 0.5 - aCentre * 0.1,
    headTurn: -0.35 + aCentre * 0.35 + Math.sin(t * 0.13) * 0.08 * (1 - aCentre),
    lean: aShove,
    ears: 0.5 + 0.5 * aCentre,
    blink: (t % 71) < 3 ? 1 : 0,
  };
  // Llama B pops up on the left on "pero" and stays to photobomb.
  const bIn = ramp(t, PERO + 6, PERO + 18, [0, 1], EASE_OUT);
  const llamaB: Vec3 = [SPOT[0] - 2.6 + bIn * 1.2, 0, SPOT[2] - 1.9];
  const bPose = {
    walk: ramp(t, PERO + 6, PERO + 18) * (1 - ramp(t, PERO + 16, PERO + 20)),
    walkPhase: t * 0.5 + 1.3,
    neck: 0.1,
    headTurn: 0.4 + Math.sin(t * 0.11 + 1) * 0.1,
    hop: pop(t, GRABAS, { damping: 8 }) > 0.5 && t < GRABAS + 12 ? Math.sin(((t - GRABAS) / 12) * Math.PI) * 1.2 : 0,
    ears: 0.8,
    blink: (t % 83) < 3 ? 1 : 0,
  };

  // Freeze-frame "printed photo" after the shutter.
  const photo = ramp(g, FLASH, FLASH + 8, [0, 1], EASE_OUT);

  const stage = selfie ? (
    <Stage cam={selfieCam}>
      <Atmosphere variant="day" sunPos={[60, 80, 90]} />
      <World frame={t} />
      <group position={[SPOT[0] + nubiX, 0, SPOT[2]]} rotation={[0, 0.05, 0]}>
        <Nubi size={INTRO_SIZE} pose={selfiePose} shadowOpacity={0.45}>
          <Outfit kind="noble" />
        </Nubi>
      </group>
      <SweatDrops frame={t} from={POV + 20} to={PERO - 4} position={[SPOT[0], 1.9, SPOT[2] + 0.2]} spread={0.9} />
      {t >= AIRE - 6 ? (
        <group position={llamaA} rotation={[0, -0.35 + aCentre * 0.3, 0]}>
          <Llama color="white" size={LLAMA_SIZE} pose={aPose} />
        </group>
      ) : null}
      {t >= PERO + 6 ? (
        <group position={llamaB} rotation={[0, 0.5, 0]}>
          <Llama color="brown" size={LLAMA_SIZE * 0.95} pose={bPose} />
        </group>
      ) : null}
    </Stage>
  ) : (
    <Stage cam={wideCam}>
      <Atmosphere variant="day" sunPos={[60, 80, 90]} />
      <World frame={g} />
      <group position={SPOT} rotation={[0, INTRO_YAW, 0]}>
        <Nubi
          size={INTRO_SIZE}
          pose={widePose}
          shadowOpacity={0.45}
          holdR={
            <Upright raise={widePose.finR ?? 0}>
              {/* Screen towards Nubi: we see the back of the phone. */}
              <group position={[0.4, 1.4, 0.6]} rotation={[0.15, Math.PI - 0.5, 0]} scale={3.2}>
                <Phone3D screen="camera" glow={1} />
              </group>
            </Upright>
          }
        >
          <Outfit kind="noble" />
        </Nubi>
      </group>
    </Stage>
  );

  return (
    <AbsoluteFill style={{ background: "linear-gradient(160deg, #2E8BFF 0%, #7B61FF 100%)" }}>
      <AbsoluteFill
        style={{
          transform: `scale(${1 - photo * 0.14}) rotate(${-photo * 3}deg)`,
          border: photo > 0 ? `${Math.round(photo * 26)}px solid #FFFFFF` : undefined,
          borderBottomWidth: photo > 0 ? Math.round(photo * 110) : undefined,
          boxShadow: photo > 0 ? `0 30px 80px rgba(0,0,0,${0.45 * photo})` : undefined,
          overflow: "hidden",
          background: skyGradient("day"),
        }}
      >
        <Shake frame={g} impacts={[{ at: POV, amp: 8, dur: 10 }, { at: SHOVE + 2, amp: 16, dur: 12 }]}>
          {stage}
          {!selfie ? <ViralHearts frame={g} at={VIRAL} out={POV - 2} /> : null}
          {selfie ? <SelfieUI frame={g} at={POV} out={FLASH + 60} recStart={POV} flashAt={FLASH} /> : null}
        </Shake>
      </AbsoluteFill>
      <Card
        frame={g}
        at={FLASH + 6}
        out={END + 20}
        x={540}
        y={330}
        title="¡FOTOBOMBA!"
        rotate={-5}
        gradient="linear-gradient(135deg, #FF6FB5 0%, #FF3D7F 55%, #C21E5B 100%)"
        scale={1.15}
      />
      <Flash frame={g} at={POV} dur={6} peak={0.5} />
      <Flash frame={g} at={FLASH} dur={10} peak={0.95} />
    </AbsoluteFill>
  );
};
