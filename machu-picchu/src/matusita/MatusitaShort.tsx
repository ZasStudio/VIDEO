import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Captions } from "../overlay/Captions";
import { Mix } from "../Soundtrack";
import { BEDS, CUES, MUSIC_PARTS, musicGain } from "./cues";
import { MatusitaOverlays } from "./Overlays";
import { SAFE } from "./safe";
import { SHOTS, ShotName } from "./shots";
import { OjosShot } from "./shots/Ojos";
import { FachadaShot } from "./shots/Fachada";
import { VentanaShot } from "./shots/Ventana";
import { EntradaShot } from "./shots/Entrada";
import { PasilloShot } from "./shots/Pasillo";
import { PuertaShot } from "./shots/Puerta";
import { CuartoShot } from "./shots/Cuarto";
import { FinalShot } from "./shots/Final";
import { MATUSITA } from "./timeline";

// "La noche que nadie quiso pasar en la Casa Matusita": Nubi's vertical horror short
// (1080 x 1920, 68 s). Dark and mysterious, with a little of Nubi's humour.

const SHOT_COMPONENTS: Record<ShotName, React.FC> = {
  ojos: OjosShot,
  fachada: FachadaShot,
  ventana: VentanaShot,
  entrada: EntradaShot,
  pasillo: PasilloShot,
  puerta: PuertaShot,
  cuarto: CuartoShot,
  final: FinalShot,
};

export const MatusitaSoundtrack: React.FC = () => (
  <Mix
    music="matusita/music.wav"
    musicParts={MUSIC_PARTS}
    musicGain={musicGain}
    duration={MATUSITA.DURATION}
    cues={CUES}
    beds={BEDS}
    lines={MATUSITA.LINES}
    voiceDir="matusita/voice"
    ducking={MATUSITA.ducking}
  />
);

export const MatusitaShort: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
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
      <MatusitaOverlays />
      <Captions chunks={MATUSITA.CAPTIONS} {...SAFE.captions} />
      {withAudio ? <MatusitaSoundtrack /> : null}
    </AbsoluteFill>
  );
};
