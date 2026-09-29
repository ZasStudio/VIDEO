import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN, EASE_IN_OUT, ramp, windowIn } from "../../anim";
import { ImpactHUD, TelescopeView } from "../../overlay/dino/DinoUI";
import { TitleCanvas, TitleSlam } from "../../overlay/TitleOverlay";
import { SMOOTH, Stage } from "../../scenes/common";
import { Vec3, lerp3, projectToScreen } from "../../three/CameraRig";
import { Asteroid, Telescope } from "../../three/dino/Props";
import { PrehistoricValley } from "../../three/dino/Sets";
import { Nubi } from "../../three/Nubi";
import { LOOKS } from "../../three/Text3D";
import { INTRO } from "../beats";
import { Outfit } from "../outfit";
import { dinoTalk } from "../talk";
import { DINO, DINO_HEIGHT, DINO_WIDTH } from "../timeline";

// "Hace 66 millones de años, un asteroide cambió todo… ¿y si hubiera fallado?" Nubi the
// scientist watches the sky from a prehistoric hill; then, in first person through the
// telescope, the asteroid comes at us, the HUD locks on… and it misses.

export const HILL_NUBI: Vec3 = [-0.7, 0, 1.2];
export const HILL_SCOPE: Vec3 = [0.9, 0, 1.0];
export const HILL_CAM_A = { position: [0.4, 2.6, 11.4] as Vec3, target: [-0.3, 1.9, 0] as Vec3 };
export const HILL_CAM_B = { position: [0.3, 2.4, 10.2] as Vec3, target: [-0.3, 1.8, 0] as Vec3 };
/** Dusk sky behind the prehistoric hill. */
export const DUSK = "linear-gradient(180deg, #2B1B5A 0%, #7B3FA0 38%, #FF7A59 72%, #FFC46B 100%)";

/** Where the asteroid is in the sky (world units) at progress u (0 → 1). */
const asteroidPath = (u: number): Vec3 => lerp3([9, 26, -60], [3.5, 12, -20], u);

export const DinoIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const S = DINO.SCENES.intro;
  const g = frame + S.from;
  const t = g / 30;
  const { END, ASTEROIDE, SCOPE, FALLADO } = INTRO;
  const pov = g >= SCOPE;

  // ---- Third person: Nubi on the hill, the asteroid a bright dot growing in the dusk sky ----
  const u = ramp(g, S.from, SCOPE, [0, 1], SMOOTH);
  const cam = { position: lerp3(HILL_CAM_A.position, HILL_CAM_B.position, u), target: lerp3(HILL_CAM_A.target, HILL_CAM_B.target, u), fov: 42 };
  const spot = windowIn(g, ASTEROIDE - 8, SCOPE + 10, 5);
  const pose = dinoTalk(g, {
    finR: spot * (1.15 + 0.08 * Math.sin(g * 0.6)),
    lookX: spot * 0.5,
    lookY: 0.25 + spot * 0.55,
    eyeScale: 1 + spot * 0.35,
  });
  const skyU = ramp(g, S.from, END, [0, 1], (x) => x);

  // ---- First person through the telescope: the rock comes at us, then veers off on "fallado" ----
  const come = ramp(g, SCOPE, FALLADO, [0, 1], EASE_IN_OUT);
  const veer = ramp(g, FALLADO - 2, END, [0, 1], EASE_IN);
  const rock: Vec3 = [veer * 9, veer * 3, -40 + come * 26 + veer * 6];
  const povCam = { position: [0, 0, 0] as Vec3, target: [0, 0, -30] as Vec3, fov: 32 };
  const hud = projectToScreen(povCam, rock, DINO_WIDTH, DINO_HEIGHT);
  const hudX = Math.min(760, Math.max(320, g < FALLADO ? hud.x : projectToScreen(povCam, [0, 0, -40 + 26], DINO_WIDTH, DINO_HEIGHT).x));
  const hudY = 700;

  return (
    <AbsoluteFill style={{ background: pov ? "radial-gradient(circle at 50% 45%, #3A2A80 0%, #120A33 70%, #05030F 100%)" : DUSK }}>
      {pov ? (
        <>
          <AbsoluteFill>
            {Array.from({ length: 70 }, (_, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: ((i * 137.5) % 1080) + Math.sin(i) * 20,
                  top: ((i * 263.3) % 1920) + Math.cos(i) * 30,
                  width: 4 + (i % 3) * 2,
                  height: 4 + (i % 3) * 2,
                  borderRadius: 4,
                  background: "#FFFFFF",
                  opacity: 0.35 + 0.5 * Math.abs(Math.sin(i * 1.7 + g * 0.08)),
                }}
              />
            ))}
          </AbsoluteFill>
          <Stage cam={povCam} near={0.1}>
            <hemisphereLight args={["#FFE3C0", "#2B1B5A", 1.2]} />
            <directionalLight position={[4, 6, 5]} intensity={2.2} color="#FFD9A0" />
            <group position={rock} rotation={[g * 0.03, g * 0.02, 0]}>
              <Asteroid size={1.6} fire={1} t={t} />
            </group>
          </Stage>
          <TelescopeView frame={g} from={SCOPE} to={END} x={540} y={860} radius={410} />
          <ImpactHUD frame={g} at={SCOPE + 4} missAt={FALLADO} out={END - 10} x={hudX} y={hudY} scale={0.9} />
        </>
      ) : (
        <>
          <Stage cam={cam}>
            <hemisphereLight args={["#FFE3C0", "#4A2A6A", 1.25]} />
            <directionalLight position={[-6, 8, 6]} intensity={2.2} color="#FFC98A" />
            <directionalLight position={[6, 4, -6]} intensity={0.8} color="#B08CFF" />
            <PrehistoricValley t={t} />
            <group position={asteroidPath(skyU)} rotation={[0.33, -0.14, 0, "YXZ"]}>
              <Asteroid size={1.2} fire={1} t={t} />
            </group>
            <group position={HILL_SCOPE} rotation={[0, -0.5, 0]}>
              <Telescope tilt={0.7} />
            </group>
            <group position={HILL_NUBI} rotation={[0, 0.3, 0]}>
              <Nubi size={2} pose={pose} shadowOpacity={0.4}>
                <Outfit kind="scientist" />
              </Nubi>
            </group>
          </Stage>
          <TitleCanvas>
            <TitleSlam
              frame={g}
              at={-16}
              out={SCOPE - 14}
              exit="up"
              lines={[
                { text: "¿Y SI LOS", size: 0.34, look: LOOKS.white, y: 4.05, delay: 0 },
                { text: "DINOSAURIOS", size: 0.42, look: LOOKS.green, y: 3.45, delay: 3 },
                { text: "NUNCA SE HUBIERAN", size: 0.25, look: LOOKS.white, y: 2.95, delay: 6 },
                { text: "EXTINGUIDO?", size: 0.38, look: LOOKS.orange, y: 2.48, delay: 9 },
              ]}
            />
          </TitleCanvas>
        </>
      )}
    </AbsoluteFill>
  );
};
