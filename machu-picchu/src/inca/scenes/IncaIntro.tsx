import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_OUT, ramp, windowIn } from "../../anim";
import { Burst, Confetti, Flash } from "../../overlay/Graphics";
import { TitleCanvas, TitleSlam } from "../../overlay/TitleOverlay";
import { SMOOTH, Shake, Stage } from "../../scenes/common";
import { CLAWD_SPOT } from "../../scenes/places";
import { Vec3, lerp3, projectToScreen } from "../../three/CameraRig";
import { DustPuff, Twinkles } from "../../three/Effects3D";
import { Phone3D } from "../../three/inca/Phone3D";
import { Nubi } from "../../three/Nubi";
import { LOOKS } from "../../three/Text3D";
import { Atmosphere, World, skyGradient } from "../../three/World";
import { Outfit, Upright } from "../outfit";
import { incaTalk } from "../talk";
import { INTRO } from "../beats";
import { INCA, INCA_HEIGHT, INCA_WIDTH } from "../timeline";

// "Espera… ¿y si el Imperio Inca hubiera tenido celulares?" Nubi, in a noble's tunic on a
// terrace of Machu Picchu, looks up: a giant phone falls from the sky right into its fin
// on "celulares". The title slams in at the top.

export const INTRO_SPOT: Vec3 = CLAWD_SPOT;
export const INTRO_SIZE = 2.1;
export const INTRO_YAW = 0.2;

// Vertical framing: Nubi just above the captions, the phone on the screen-right side.
const CAM_A = { position: [3.95, 2.6, 32.2] as Vec3, target: [2.4, -0.95, 0] as Vec3 };
const CAM_B = { position: [3.9, 2.4, 30.8] as Vec3, target: [2.4, -0.9, 0] as Vec3 };

/** Where the phone sits in the right fin (fin-tip space, after Upright) and its size. */
const PHONE_AT: Vec3 = [0.9, 2.6, 0.9];
const PHONE_SCALE = 8;

export const IncaIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const S = INCA.SCENES.intro;
  const g = frame + S.from;
  const { END, WAIT, LAND, FALL, WOW, TODO } = INTRO;

  const dl = g - LAND;
  const landed = g >= LAND;
  const u = ramp(g, S.from, END, [0, 1], SMOOTH);
  const punch = landed ? 0.9 * Math.exp(-dl / 6) : 0;
  const base = lerp3(CAM_A.position, CAM_B.position, u);
  const cam = {
    position: [base[0], base[1], base[2] - punch] as Vec3,
    target: lerp3(CAM_A.target, CAM_B.target, u),
    fov: 45,
  };

  // Nubi: "wait!" with a raised fin, looks up at the whistle, catches the phone and staggers
  // under its weight, stares at it, then celebrates on "¡cambiaría absolutamente todo!".
  const wait = windowIn(g, WAIT, WAIT + 24, 5);
  const lookUp = ramp(g, LAND - 30, LAND - 18) * (1 - ramp(g, LAND + 2, LAND + 10));
  const catchK = ramp(g, LAND - 14, LAND - 3);
  const weight = landed ? Math.exp(-dl / 12) : 0;
  const lookPhone = ramp(g, LAND + 8, LAND + 18) * (1 - ramp(g, WOW - 6, WOW + 2));
  const cheer = windowIn(g, WOW, END + 20, 5);
  const squash = landed ? 1 - 0.3 * Math.exp(-dl / 4) * Math.cos(dl * 0.6) : 1;
  const finR = Math.max(wait * 0.95, catchK * 0.8) + cheer * 0.25 * Math.sin((g - WOW) * 0.5);
  const pose = incaTalk(g, {
    squash,
    roll: -0.22 * weight * (0.6 + 0.4 * Math.sin(dl * 0.45)),
    finR,
    finL: cheer * (0.9 + 0.35 * Math.sin((g - WOW) * 0.6)) + wait * 0.2,
    hop: cheer * Math.abs(Math.sin((g - WOW) * 0.3)) * 1.4,
    eyeScale: 1 + lookUp * 0.3 + lookPhone * 0.25 + (landed ? 0.35 * Math.exp(-dl / 8) : 0) + cheer * 0.1,
    lookX: lookPhone * 0.75 + wait * 0.1,
    lookY: lookUp * 0.9 + lookPhone * 0.35,
  });

  // The phone: spins down from the sky, lands in the fin with a bounce, then lights up.
  const ft = ramp(g, LAND - FALL, LAND, [0, 1], (x) => x);
  const fallY = landed ? 1.3 * Math.abs(Math.sin(dl * 0.5)) * Math.exp(-dl / 5) : 160 * (1 - ft * ft);
  const spin = landed ? 0.12 * Math.sin(dl * 0.5) * Math.exp(-dl / 6) : (1 - ft) * 3.2;
  const glow = ramp(g, LAND + 10, LAND + 18);
  const phone = g >= LAND - FALL - 2 ? (
    <Upright raise={finR}>
      <group position={[PHONE_AT[0], PHONE_AT[1] + fallY, PHONE_AT[2]]} rotation={[spin * 0.3, spin * 0.5, spin]} scale={PHONE_SCALE}>
        <Phone3D screen={glow > 0 ? "home" : "off"} glow={glow} />
      </group>
    </Upright>
  ) : null;

  const phoneScreen = projectToScreen(cam, [INTRO_SPOT[0] + 1.5, 1.9, INTRO_SPOT[2]], INCA_WIDTH, INCA_HEIGHT);
  const bump = ramp(g, TODO - 2, TODO + 2) * (1 - ramp(g, TODO + 3, TODO + 14, [0, 1], EASE_OUT));

  return (
    <AbsoluteFill style={{ background: skyGradient("day") }}>
      <Shake
        frame={g}
        impacts={[
          { at: LAND, amp: 18, dur: 14 },
          { at: WOW, amp: 10, dur: 12 },
        ]}
      >
        <Stage cam={cam}>
          <Atmosphere variant="day" sunPos={[60, 80, 90]} />
          <World frame={g} />
          <group position={INTRO_SPOT} rotation={[0, INTRO_YAW, 0]}>
            <Nubi size={INTRO_SIZE} pose={pose} shadowOpacity={0.45} holdR={phone}>
              <Outfit kind="noble" />
            </Nubi>
          </group>
          <DustPuff frame={g} at={LAND} position={INTRO_SPOT} radius={1.5} />
          <Twinkles frame={g} at={LAND + 10} position={[INTRO_SPOT[0] + 1.5, 2.0, INTRO_SPOT[2]]} radius={1.3} count={12} />
        </Stage>
        <Burst frame={g} at={LAND} x={phoneScreen.x} y={phoneScreen.y} color="#FFD60A" size={520} />
        <Burst frame={g} at={WOW} x={540} y={420} color="#4FE3FF" size={760} />
        <TitleCanvas>
          <group scale={1 + 0.06 * bump}>
            <TitleSlam
              frame={g}
              at={WAIT + 4}
              out={END - 12}
              exit="up"
              lines={[
                { text: "¿ASÍ SERÍA", size: 0.8, look: LOOKS.white, y: 4.3 },
                { text: "VIVIR EN EL", size: 0.77, look: LOOKS.white, y: 3.45 },
                { text: "IMPERIO INCA", size: 0.64, look: LOOKS.gold, y: 2.65 },
                { text: "CON CELULAR?", size: 0.6, look: LOOKS.cyan, y: 1.9 },
              ]}
            />
          </group>
        </TitleCanvas>
        <Confetti frame={g} at={WOW} count={110} />
      </Shake>
      <Flash frame={g} at={LAND} dur={6} peak={0.45} />
    </AbsoluteFill>
  );
};
