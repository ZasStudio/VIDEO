import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN, EASE_IN_OUT, ramp, windowIn } from "../../anim";
import { ChatScreen, PhoneFrame } from "../../overlay/inca/PhoneUI";
import { SMOOTH, Shake, Stage } from "../../scenes/common";
import { Vec3, lerp3, projectToScreen } from "../../three/CameraRig";
import { DustPuff, Twinkles } from "../../three/Effects3D";
import { PUTUTU_HOLD_R, Pututu } from "../../three/inca/Costumes";
import { Phone3D } from "../../three/inca/Phone3D";
import { QhapaqNan } from "../../three/inca/Sets";
import { Nubi } from "../../three/Nubi";
import { SweatDrops, Zzz } from "../effects";
import { Outfit, Upright } from "../outfit";
import { DayNightSky, SpeedLines, nightAt } from "../overlays";
import { incaTalk } from "../talk";
import { CHASQUI } from "../beats";
import { INCA, INCA_HEIGHT, INCA_WIDTH } from "../timeline";

// Nubi as a chasqui on the Qhapaq Ñan: "Antes, los chasquis corríamos por relevos… ¡días
// enteros para llevar un solo mensaje!" It toots the pututu and runs (the road scrolls, days
// and nights fly by), trips on a stone and face-plants. "Ahora solo escribiría: «Mi Inca,
// noticias urgentes»… y me iría a dormir." It types the message and falls asleep.

const NUBI_AT: Vec3 = [0, 0, 0.3];
const NUBI_SIZE = 1.9;
const HEADING = 0.95;
/** Road scroll speed while running (world units per frame). */
const V = 0.22;

// Side-on while running (tracking in a little), then round to the front.
const RUN_CAM_A = { position: [-1.5, 2.4, 11.2] as Vec3, target: [0.04, 1.27, 0] as Vec3 };
const RUN_CAM_B = { position: [-1.2, 2.3, 10.4] as Vec3, target: [0.04, 1.18, 0] as Vec3 };
const FRONT_CAM = { position: [0.25, 2.0, 10.2] as Vec3, target: [-0.01, 1.28, 0] as Vec3 };

export const IncaChasqui: React.FC = () => {
  const frame = useCurrentFrame();
  const S = INCA.SCENES.chasqui;
  const g = frame + S.from;
  const { END, TOOT, RUN, RELEVOS, DIAS, TRIP, MENSAJE, GETUP, AHORA, ESCRIBIRIA, MI, SEND, Y, DORMIR } = CHASQUI;

  // Road scroll: speeds up when the run starts and stops dead at the trip.
  const speedAt = (f: number) => V * ramp(f, RUN, RUN + 10) * (1 - ramp(f, TRIP, TRIP + 5));
  let scroll = 0;
  for (let f = RUN; f < g; f++) scroll += speedAt(f);
  let scrollAtTrip = 0;
  for (let f = RUN; f < TRIP; f++) scrollAtTrip += speedAt(f);
  const running = speedAt(g) / V;

  // Days and nights fly by on "¡días enteros".
  const NIGHT_FROM = DIAS - 2;
  const NIGHT_TO = TRIP - 2;
  const night = nightAt(g, NIGHT_FROM, NIGHT_TO, 3);

  // Camera: side-on while running, then round to the front for the phone and the nap.
  const turn = ramp(g, AHORA - 6, AHORA + 14, [0, 1], SMOOTH);
  const trackIn = ramp(g, S.from, AHORA, [0, 1], (x) => x);
  const run = {
    position: lerp3(RUN_CAM_A.position, RUN_CAM_B.position, trackIn),
    target: lerp3(RUN_CAM_A.target, RUN_CAM_B.target, trackIn),
  };
  const cam = {
    position: lerp3(run.position, FRONT_CAM.position, turn),
    target: lerp3(run.target, FRONT_CAM.target, turn),
    fov: 42,
  };

  // --- Nubi -----------------------------------------------------------------------------
  const toot = windowIn(g, TOOT, TOOT + 16, 4);
  const tired = ramp(g, RELEVOS, DIAS + 20);
  const tripT = ramp(g, TRIP, MENSAJE, [0, 1], EASE_IN);
  const tripping = g >= TRIP && g < GETUP + 16;
  const getUp = ramp(g, GETUP, GETUP + 14, [0, 1], EASE_IN_OUT);
  const down = tripping ? tripT * (1 - getUp) : 0;
  const dl = g - MENSAJE;
  const landSquash = g >= MENSAJE && g < GETUP ? 1 - 0.18 * Math.exp(-dl / 4) * Math.cos(dl * 0.7) : 1;
  const exhausted = windowIn(g, GETUP + 6, Y - 2, 6);
  const phoneOut = windowIn(g, AHORA + 4, Y + 4, 6);
  const yawn = windowIn(g, Y + 2, DORMIR - 2, 4);
  const sleep = ramp(g, DORMIR - 2, DORMIR + 10, [0, 1], EASE_IN_OUT);
  const stride = g * 0.65;
  const pose = incaTalk(g, {
    hop: running * Math.abs(Math.sin(stride)) * 1.6 + down * (Math.sin(tripT * Math.PI) * 3 + 3.4) + toot * 0.6,
    squash: landSquash * (1 + yawn * 0.14 * Math.sin(((g - Y - 2) / (DORMIR - Y - 4)) * Math.PI)) * (1 - sleep * 0.16) * (1 + sleep * 0.03 * Math.sin(g * 0.18)),
    pitch: running * (0.12 + tired * 0.1) + down * 1.25 + exhausted * 0.08 - toot * 0.15,
    finL: running * (0.3 + 0.6 * Math.sin(stride)) + toot * 1.0 - exhausted * 0.4 - sleep * 0.3,
    finR: running * (0.3 - 0.6 * Math.sin(stride)) + phoneOut * 0.75 - exhausted * 0.35 * (1 - phoneOut) - sleep * 0.5,
    wiggle: Math.max(running, down * 0.8),
    wigglePhase: g * 1.3,
    blink: Math.max(tired * running * 0.35, exhausted * 0.45, sleep),
    eyeScale: 1 + toot * 0.2 + (g >= TRIP && g < MENSAJE ? 0.5 : 0),
    lookX: phoneOut * 0.45 * (1 - yawn),
    lookY: -phoneOut * 0.3 * (1 - yawn),
  });
  const heading = HEADING * (1 - turn) + 0.12 * turn;
  const fwd = down * 0.9;
  const nubiPos: Vec3 = [NUBI_AT[0] + Math.sin(heading) * fwd, NUBI_AT[1], NUBI_AT[2] + Math.cos(heading) * fwd];

  // The pututu goes up for a toot before the run; the phone comes out on "ahora".
  const holdL =
    toot > 0.01 ? (
      <group {...PUTUTU_HOLD_R}>
        {/* Turned round so the mouthpiece points at Nubi in the left fin. */}
        <group rotation={[0, Math.PI, 0]}>
          <Pututu />
        </group>
      </group>
    ) : null;
  const holdR =
    phoneOut > 0.01 ? (
      <Upright raise={pose.finR ?? 0}>
        <group position={[0.1, 1.2, 0.9]} rotation={[0.1, -0.2, 0]} scale={2.6 * Math.min(1, phoneOut * 1.4)}>
          <Phone3D screen="chat" glow={0.9} />
        </group>
      </Upright>
    ) : null;

  // The stone that trips Nubi rides in on the road and reaches its feet at TRIP.
  const rockX = NUBI_AT[0] + 0.75 + (scrollAtTrip - scroll);
  const light = 1 - 0.55 * night;
  const head = projectToScreen(cam, [nubiPos[0], 2.0, nubiPos[2]], INCA_WIDTH, INCA_HEIGHT);

  return (
    <AbsoluteFill>
      <DayNightSky frame={g} from={NIGHT_FROM} to={NIGHT_TO} cycles={3} />
      <Shake
        frame={g}
        impacts={[
          { at: TRIP, amp: 6, dur: 8 },
          { at: MENSAJE, amp: 18, dur: 14 },
        ]}
      >
        <Stage cam={cam}>
          <hemisphereLight args={[night > 0.5 ? "#9FB2FF" : "#F2F8FF", "#6B5A3A", 1.3 * light]} />
          <directionalLight position={[-6, 10, 8]} intensity={2.5 * light} color={night > 0.5 ? "#C9D4FF" : "#FFF4E0"} />
          <directionalLight position={[7, 4, -4]} intensity={0.9 * light} color="#FFD2A0" />
          <QhapaqNan scroll={scroll} />
          {rockX > -6 && rockX < 12 && g < GETUP ? (
            <mesh position={[rockX, 0.14, NUBI_AT[2] + 0.1]} rotation={[0.4, 0.7, 0.2]} scale={[0.32, 0.22, 0.28]} castShadow>
              <dodecahedronGeometry args={[1, 0]} />
              <meshStandardMaterial color="#8E8A84" roughness={0.9} flatShading />
            </mesh>
          ) : null}
          <group position={nubiPos} rotation={[0, heading, 0]}>
            <Nubi size={NUBI_SIZE} pose={pose} shadowOpacity={0.4} holdL={holdL} holdR={holdR}>
              <Outfit kind="chasqui" swing={running * Math.sin(stride * 2) * 0.6} hide={toot > 0.01 ? ["pututu"] : []} />
            </Nubi>
          </group>
          <SweatDrops frame={g} from={RELEVOS} to={TRIP - 4} position={[nubiPos[0], 2.0, nubiPos[2]]} spread={0.9} />
          <SweatDrops frame={g} from={GETUP + 8} to={AHORA} position={[nubiPos[0], 1.9, nubiPos[2]]} spread={0.8} />
          <DustPuff frame={g} at={MENSAJE} position={[nubiPos[0] + 0.6, 0, nubiPos[2] + 0.5]} radius={1.3} />
          <Twinkles frame={g} at={MENSAJE + 2} position={[nubiPos[0] + 0.5, 0.9, nubiPos[2] + 0.6]} radius={0.9} count={8} />
        </Stage>
        <SpeedLines frame={g} k={running * (1 - turn)} />
        {/* Insert: the phone fills the frame while Nubi types, then drops away for the nap. */}
        <PhoneFrame frame={g} at={ESCRIBIRIA} out={Y - 2} x={540} y={700} scale={0.85}>
          <ChatScreen
            frame={g}
            contact={{ name: "Sapa Inca", avatar: "crown" }}
            messages={[{ at: SEND, from: "me", text: "Mi Inca, noticias urgentes", typingFrom: MI }]}
            fontSize={54}
          />
        </PhoneFrame>
      </Shake>
      <Zzz frame={g} from={DORMIR + 4} x={head.x + 40} y={head.y - 30} />
      <AbsoluteFill style={{ background: "#0B1240", opacity: sleep * 0.25 * ramp(g, DORMIR, END), pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
