import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Captions } from "../overlay/Captions";
import { Vignette } from "../overlay/Graphics";
import { Mix } from "../Soundtrack";
import { BEDS, CUES, MUSIC_PARTS, musicGain } from "./cues";
import { TiempoOverlays } from "./Overlays";
import { SAFE } from "./safe";
import { SHOTS, ShotName } from "./shots";
import { IntroShot } from "./shots/Intro";
import { JugoShot } from "./shots/Jugo";
import { PizzaShot } from "./shots/Pizza";
import { VitrinasShot } from "./shots/Vitrinas";
import { CasaShot } from "./shots/Casa";
import { PreguntaShot } from "./shots/Pregunta";
import { OficinaShot } from "./shots/Oficina";
import { SenoraShot } from "./shots/Senora";
import { AlarmaShot } from "./shots/Alarma";
import { TorreShot } from "./shots/Torre";
import { DronShot } from "./shots/Dron";
import { PuertaShot } from "./shots/Puerta";
import { TIEMPO } from "./timeline";

// "¿Qué pasaría si el dinero fuera tiempo de vida?" Nubi's vertical short (1080 x 1920, 70 s).
// Everyone has a life counter floating over their head; every other character is a Nubi-shaped
// toy in other colours.

const SHOT_COMPONENTS: Record<ShotName, React.FC> = {
  intro: IntroShot,
  jugo: JugoShot,
  pizza: PizzaShot,
  vitrinas: VitrinasShot,
  casa: CasaShot,
  pregunta: PreguntaShot,
  oficina: OficinaShot,
  senora: SenoraShot,
  alarma: AlarmaShot,
  torre: TorreShot,
  dron: DronShot,
  puerta: PuertaShot,
};

export const TiempoSoundtrack: React.FC = () => (
  <Mix
    music="tiempo/music.wav"
    musicParts={MUSIC_PARTS}
    musicGain={musicGain}
    duration={TIEMPO.DURATION}
    cues={CUES}
    beds={BEDS}
    lines={TIEMPO.LINES}
    voiceDir="tiempo/voice"
    ducking={TIEMPO.ducking}
  />
);

export const TiempoShort: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
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
      <Vignette strength={0.25} />
      <TiempoOverlays />
      <Captions chunks={TIEMPO.CAPTIONS} {...SAFE.captions} />
      {withAudio ? <TiempoSoundtrack /> : null}
    </AbsoluteFill>
  );
};
