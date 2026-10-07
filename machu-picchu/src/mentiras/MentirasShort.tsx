import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Captions } from "../overlay/Captions";
import { Mix } from "../Soundtrack";
import { BEDS, CUES, MUSIC_PARTS, musicGain } from "./cues";
import { MentirasOverlays } from "./Overlays";
import { SAFE } from "./safe";
import { SHOTS, ShotName } from "./shots";
import { GanchoShot } from "./shots/Gancho";
import { EscapeShot } from "./shots/Escape";
import { DeudaShot } from "./shots/Deuda";
import { CitaShot } from "./shots/Cita";
import { JefeShot } from "./shots/Jefe";
import { GiroShot } from "./shots/Giro";
import { FinalShot } from "./shots/Final";
import { MENTIRAS } from "./timeline";

// "¿Y si tus mentiras salieran sobre tu cabeza?": Nubi's vertical comedy short (1080 x 1920, 72 s).

const SHOT_COMPONENTS: Record<ShotName, React.FC> = {
  gancho: GanchoShot,
  escape: EscapeShot,
  deuda: DeudaShot,
  cita: CitaShot,
  jefe: JefeShot,
  giro: GiroShot,
  final: FinalShot,
};

export const MentirasSoundtrack: React.FC = () => (
  <Mix
    music="mentiras/music.wav"
    musicParts={MUSIC_PARTS}
    musicGain={musicGain}
    duration={MENTIRAS.DURATION}
    cues={CUES}
    beds={BEDS}
    lines={MENTIRAS.LINES}
    voiceDir="mentiras/voice"
    ducking={MENTIRAS.ducking}
  />
);

export const MentirasShort: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
  const keys = Object.keys(SHOTS) as ShotName[];
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {keys.map((k) => {
        const Comp = SHOT_COMPONENTS[k];
        return (
          <Sequence key={k} from={SHOTS[k].from} durationInFrames={SHOTS[k].to - SHOTS[k].from} name={k}>
            <Comp />
          </Sequence>
        );
      })}
      <MentirasOverlays />
      <Captions chunks={MENTIRAS.CAPTIONS} {...SAFE.captions} />
      {withAudio ? <MentirasSoundtrack /> : null}
    </AbsoluteFill>
  );
};
