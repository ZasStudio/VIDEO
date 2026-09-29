import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, ramp, windowIn } from "../../anim";
import { Burst } from "../../overlay/Graphics";
import { ChatScreen, NotificationStorm, PhoneFrame } from "../../overlay/inca/PhoneUI";
import { Shake, Stage } from "../../scenes/common";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Twinkles } from "../../three/Effects3D";
import { Phone3D } from "../../three/inca/Phone3D";
import { ThroneRoom } from "../../three/inca/Sets";
import { Nubi } from "../../three/Nubi";
import { Outfit, Upright } from "../outfit";
import { incaTalk } from "../talk";
import { THRONE } from "../beats";
import { INCA, SPEAKER } from "../timeline";

// Nubi as the Sapa Inca on the throne: the phone explodes with 99 notifications, a chasqui
// writes "¡Mi Inca, hay un problema en el norte!" and Nubi snaps: "¡Entonces manda tu
// ubicación, pues!". The location arrives in a second (no more running for days).

/** Nubi stands on the tiana (the royal stool) of the ThroneRoom set. */
export const THRONE_NUBI_AT: Vec3 = [0, 0.62, 0.35];
const NUBI_SIZE = 2.0;
const CAM_A = { position: [0.5, 2.2, 8.6] as Vec3, target: [0.1, 2.6, 0] as Vec3 };
const CAM_B = { position: [0.3, 2.0, 7.7] as Vec3, target: [0.05, 2.55, 0] as Vec3 };

export const IncaThrone: React.FC = () => {
  const frame = useCurrentFrame();
  const S = INCA.SCENES.inca;
  const g = frame + S.from;
  const { END, NOVENTA, MENSAJES, STORM_FROM, STORM_TO, C_START, CHAT_IN, ENTONCES, UBIC, SEND, LOC_AT, PUES } = THRONE;

  const u = ramp(g, S.from, END, [0, 1], (x) => x);
  const cam = { position: lerp3(CAM_A.position, CAM_B.position, u), target: lerp3(CAM_A.target, CAM_B.target, u), fov: 42 };

  // Royal and calm, then shocked by the storm, listening, annoyed, commanding, satisfied.
  const shock = windowIn(g, NOVENTA - 2, MENSAJES + 18, 4);
  const listen = windowIn(g, C_START, ENTONCES - 2, 6);
  const annoyed = windowIn(g, ENTONCES - 4, PUES + 6, 5);
  const command = windowIn(g, UBIC - 4, PUES + 10, 4);
  const pleased = ramp(g, LOC_AT + 4, LOC_AT + 12, [0, 1], EASE_OUT);
  const buzz = windowIn(g, STORM_FROM, STORM_TO + 6, 2);
  const pose = incaTalk(g, {
    hop: shock * Math.max(0, Math.sin(((g - NOVENTA + 2) / 14) * Math.PI)) * 5 * (g < NOVENTA + 12 ? 1 : 0) + pleased * Math.abs(Math.sin((g - LOC_AT) * 0.35)) * 0.8,
    squash: 1 + shock * 0.08,
    finR: 0.55 + shock * 0.35 + buzz * 0.05 * Math.sin(g * 3.1),
    finL: shock * 1.2 * (1 - annoyed) + command * (1.1 + 0.1 * Math.sin((g - UBIC) * 0.8)) - annoyed * (1 - command) * 0.35,
    eyeScale: 1 + shock * 0.55 - annoyed * 0.3 + pleased * 0.1,
    lookX: 0.55 * listen + 0.4 * (1 - listen) * windowIn(g, STORM_FROM, NOVENTA, 3),
    lookY: 0.15 * listen,
    roll: annoyed * 0.06 * Math.sin((g - ENTONCES) * 0.25),
    pitch: annoyed * 0.06,
  });

  // The phone in Nubi's fin shows the storm, then the chat; it glows while it speaks.
  const badge = Math.round(99 * ramp(g, STORM_FROM, STORM_TO, [0, 1], (x) => x));
  const speaking = SPEAKER.celular.voiceLevel(g);
  const phone = (
    <Upright raise={pose.finR ?? 0}>
      <group
        position={[0.5 + buzz * 0.08 * Math.sin(g * 2.7), 1.5 + buzz * 0.06 * Math.cos(g * 3.3), 0.9]}
        rotation={[0.1, -0.35, buzz * 0.08 * Math.sin(g * 4.1)]}
        scale={3.1}
      >
        <Phone3D screen={g < CHAT_IN ? "notifs" : "chat"} badge={badge} glow={0.55 + 0.45 * speaking} />
      </group>
    </Upright>
  );

  const storm = g >= STORM_FROM && g < CHAT_IN + 4;
  const exitStorm = ramp(g, CHAT_IN - 6, CHAT_IN + 2, [0, 1], EASE_IN_OUT);

  return (
    <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 30%, #FFE08A 0%, #FFB02E 30%, #C2410C 68%, #3B0F05 100%)" }}>
      <Shake
        frame={g}
        impacts={[
          { at: NOVENTA, amp: 16, dur: 14 },
          { at: PUES, amp: 10, dur: 10 },
        ]}
      >
        <Stage cam={cam}>
          <hemisphereLight args={["#FFF1D6", "#5A2A10", 1.25]} />
          <directionalLight position={[-5, 9, 8]} intensity={2.4} color="#FFF4E0" />
          <directionalLight position={[6, 4, -5]} intensity={1.0} color="#FFB36B" />
          <ThroneRoom />
          <group position={THRONE_NUBI_AT} rotation={[0, 0, 0]}>
            <Nubi size={NUBI_SIZE} pose={pose} shadowOpacity={0.4} holdR={phone}>
              <Outfit kind="inca" />
            </Nubi>
          </group>
          <Twinkles frame={g} at={S.from + 2} position={[0, 2.4, 0.4]} radius={1.8} count={14} color="#FFE27A" />
          <Twinkles frame={g} at={LOC_AT + 2} position={[0.6, 2.2, 0.6]} radius={1.4} count={10} />
        </Stage>
        {storm ? (
          <AbsoluteFill style={{ opacity: 1 - exitStorm, transform: `translateY(${-exitStorm * 120}px) scale(${1 - exitStorm * 0.1})` }}>
            <NotificationStorm frame={g} from={STORM_FROM} to={STORM_TO} count={99} x={540} y={560} />
          </AbsoluteFill>
        ) : null}
        <Burst frame={g} at={NOVENTA} x={540} y={520} color="#FF3D3D" size={640} />
        <PhoneFrame frame={g} at={CHAT_IN} out={END + 10} x={540} y={590} scale={0.6}>
          <ChatScreen
            frame={g}
            contact={{ name: "Chasqui del Norte", avatar: "chasqui" }}
            messages={[
              { at: C_START + 2, from: "them", text: "¡Mi Inca, hay un problema en el norte!", typingFrom: CHAT_IN + 4 },
              { at: SEND, from: "me", text: "¡Manda tu ubicación, pues!", typingFrom: ENTONCES + 2 },
              { at: LOC_AT, from: "them", kind: "location", place: "Tumbes, norte del imperio", typingFrom: SEND + 3 },
            ]}
          />
        </PhoneFrame>
      </Shake>
    </AbsoluteFill>
  );
};
