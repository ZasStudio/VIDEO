import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Captions } from "../overlay/Captions";
import { Mix } from "../Soundtrack";
import { BEDS, CUES, MUSIC_PARTS, musicGain } from "./cues";
import { DormirOverlays } from "./Overlays";
import { SAFE } from "./safe";
import { SHOTS, ShotName } from "./shots";
import { GanchoShot } from "./shots/Gancho";
import { OficinaShot } from "./shots/Oficina";
import { ProblemaShot } from "./shots/Problema";
import { MundoShot } from "./shots/Mundo";
import { CamaShot } from "./shots/Cama";
import { VecinoShot } from "./shots/Vecino";
import { MiradaShot } from "./shots/Mirada";
import { GiroShot } from "./shots/Giro";
import { FinalShot } from "./shots/Final";
import { DORMIR } from "./timeline";

// "¿Y si dormir te pagara?": Nubi's vertical comedy short (1080 x 1920, 75 s).

const SHOT_COMPONENTS: Record<ShotName, React.FC> = {
  gancho: GanchoShot,
  oficina: OficinaShot,
  problema: ProblemaShot,
  mundo: MundoShot,
  cama: CamaShot,
  vecino: VecinoShot,
  mirada: MiradaShot,
  giro: GiroShot,
  final: FinalShot,
};

export const DormirSoundtrack: React.FC = () => (
  <Mix
    music="dormir/music.wav"
    musicParts={MUSIC_PARTS}
    musicGain={musicGain}
    duration={DORMIR.DURATION}
    cues={CUES}
    beds={BEDS}
    lines={DORMIR.LINES}
    voiceDir="dormir/voice"
    ducking={DORMIR.ducking}
  />
);

export const DormirShort: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
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
      <DormirOverlays />
      <Captions chunks={DORMIR.CAPTIONS} {...SAFE.captions} />
      {withAudio ? <DormirSoundtrack /> : null}
    </AbsoluteFill>
  );
};
