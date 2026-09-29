import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN, ramp, rand } from "../../anim";
import { ExistenceMeter } from "../../overlay/dino/DinoUI";
import { Shake, Stage } from "../../scenes/common";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Brachio, TRex, Trike } from "../../three/dino/Dinos";
import { Club } from "../../three/dino/Props";
import { PrehistoricValley } from "../../three/dino/Sets";
import { Nubi } from "../../three/Nubi";
import { CAVE } from "../beats";
import { Outfit } from "../outfit";
import { dinoTalk } from "../talk";
import { DINO } from "../timeline";

// First person as a tiny mammal hiding in the ferns: a Brachiosaurus leg thunders down right
// in front of us. Then Nubi, a tiny caveman among giants: "Los mamíferos, como nosotros, casi
// no habríamos podido evolucionar. O sea… puede que los humanos ni siquiera existiéramos." The
// existence meter drains and Nubi glitches out of existence.

const NUBI_AT: Vec3 = [0.2, 0, 3.4];
const CAM = { position: [0.4, 2.4, 11.8] as Vec3, target: [0.1, 2.6, 0] as Vec3, fov: 44 };

export const DinoCave: React.FC = () => {
  const frame = useCurrentFrame();
  const S = DINO.SCENES.cavernicola;
  const g = frame + S.from;
  const t = g / 30;
  const { END, POV_END, HUMANOS, L11_END } = CAVE;
  const pov = g < POV_END;

  // First person from the ground, looking up at a walking Brachiosaurus.
  const povCam = { position: [0, 0.35, 6] as Vec3, target: [0.6, 3.2, -2] as Vec3, fov: 62 };
  const brachioWalk = (g - S.from) * 0.05;

  // Glitching out of existence.
  const glitch = ramp(g, HUMANOS, L11_END, [0, 1], EASE_IN);
  const gone = ramp(g, L11_END - 4, L11_END + 6);
  const flicker = glitch > 0 && rand(Math.floor(g / 2)) < glitch * 0.6 ? 0 : 1;
  const jitter = glitch * (rand(g * 3) - 0.5) * 0.4;
  const scale = (1 - gone) * (flicker ? 1 : 0.001);

  const u = ramp(g, POV_END, END, [0, 1], (x) => x);
  const cam = { position: lerp3(CAM.position, [0.3, 2.2, 10.4], u), target: CAM.target, fov: CAM.fov };
  const pose = dinoTalk(g, {
    finR: 0.5 + 0.15 * Math.sin(g * 0.4),
    lookY: 0.6,
    lookX: Math.sin(g * 0.05) * 0.4,
    eyeScale: 1.1 + glitch * 0.4,
    roll: jitter * 0.5,
  });

  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #FF9A5A 0%, #FFC97A 45%, #FFE9B0 100%)" }}>
      <Shake frame={g} impacts={[{ at: S.from + 8, amp: 20, dur: 16 }]}>
        <Stage cam={pov ? povCam : cam} near={0.05}>
          <hemisphereLight args={["#FFF1D6", "#5A7A3A", 1.3]} />
          <directionalLight position={[-6, 12, 8]} intensity={2.4} color="#FFE8C8" />
          <PrehistoricValley t={t} />
          {pov ? (
            <Brachio size={0.55} position={[1.2 - brachioWalk, 0, 0.5]} rotationY={-Math.PI / 2} pose={{ walk: 1, walkPhase: g * 0.12, neck: 0.2 }} />
          ) : (
            <>
              <Brachio size={0.8} position={[-3.5 + (g - S.from) * 0.012, 0, -9]} rotationY={Math.PI / 2 - 0.3} pose={{ walk: 1, walkPhase: g * 0.1, neck: Math.sin(g * 0.03) * 0.3 }} />
              <TRex size={0.8} position={[3.6, 0, -3.5]} rotationY={-0.6} pose={{ jaw: 0.2, headYaw: -0.4, tail: Math.sin(g * 0.06) * 0.4, blink: g % 90 < 3 ? 1 : 0 }} />
              <Trike size={1.1} position={[-2.6, 0, 0.8]} rotationY={0.7} pose={{ headYaw: 0.3, blink: g % 77 < 3 ? 1 : 0 }} />
              <group position={[NUBI_AT[0] + jitter, 0, NUBI_AT[2]]} rotation={[0, -0.1, 0]} scale={[scale * (1 + glitch * 0.2 * Math.sin(g)), scale, scale]}>
                <Nubi size={1.5} pose={pose} shadowOpacity={0.4} holdR={<Club />}>
                  <Outfit kind="caveman" />
                </Nubi>
              </group>
            </>
          )}
        </Stage>
      </Shake>
      {!pov ? <ExistenceMeter frame={g} from={HUMANOS} to={L11_END} x={500} y={460} /> : null}
      {/* RGB-split tint while glitching out. */}
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(255,0,80,0.25), rgba(0,255,220,0.25))", mixBlendMode: "screen", opacity: glitch * (flicker ? 0.3 : 0.8), pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
