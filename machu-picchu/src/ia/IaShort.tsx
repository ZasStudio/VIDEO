import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Captions } from "../overlay/Captions";
import { Mix } from "../Soundtrack";
import { BEDS, CUES, MUSIC_PARTS, musicGain } from "./cues";
import { IaOverlays } from "./Overlays";
import { SAFE } from "./safe";
import { SHOTS, ShotName } from "./shots";
import { ChicaShot } from "./shots/Chica";
import { ChicoShot } from "./shots/Chico";
import { NubiShot } from "./shots/Nubi";
import { MensajeShot } from "./shots/Mensaje";
import { TareaShot } from "./shots/Tarea";
import { JefeShot } from "./shots/Jefe";
import { FotoShot } from "./shots/Foto";
import { GiroNubiShot } from "./shots/GiroNubi";
import { GiroChicoShot } from "./shots/GiroChico";
import { GiroSwitchShot } from "./shots/GiroSwitch";
import { AlmuerzoShot } from "./shots/Almuerzo";
import { FinalShot } from "./shots/Final";
import { IA } from "./timeline";

// "¿Qué pasaría si la IA no existiera?": Nubi's vertical comedy short (1080 x 1920, 76 s).

const SHOT_COMPONENTS: Record<ShotName, React.FC> = {
  chica: ChicaShot,
  chico: ChicoShot,
  nubi: NubiShot,
  mensaje: MensajeShot,
  tarea: TareaShot,
  jefe: JefeShot,
  foto: FotoShot,
  giroNubi: GiroNubiShot,
  giroChico: GiroChicoShot,
  giroSwitch: GiroSwitchShot,
  almuerzo: AlmuerzoShot,
  final: FinalShot,
};

export const IaSoundtrack: React.FC = () => (
  <Mix
    music="ia/music.wav"
    musicParts={MUSIC_PARTS}
    musicGain={musicGain}
    duration={IA.DURATION}
    cues={CUES}
    beds={BEDS}
    lines={IA.LINES}
    voiceDir="ia/voice"
    ducking={IA.ducking}
  />
);

export const IaShort: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
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
      <IaOverlays />
      <Captions chunks={IA.CAPTIONS} {...SAFE.captions} />
      {withAudio ? <IaSoundtrack /> : null}
    </AbsoluteFill>
  );
};
