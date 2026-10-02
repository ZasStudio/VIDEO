import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Captions } from "../overlay/Captions";
import { Vignette } from "../overlay/Graphics";
import { Mix } from "../Soundtrack";
import { BEDS, CUES, MUSIC_PARTS, musicGain } from "./cues";
import { AguaOverlays } from "./Overlays";
import { SAFE } from "./safe";
import { SHOTS, ShotName } from "./shots";
import { CalleShot } from "./shots/Calle";
import { CamaShot } from "./shots/Cama";
import { CamposShot } from "./shots/Campos";
import { EsconditeShot } from "./shots/Escondite";
import { FlashShot } from "./shots/Flash";
import { GrifoShot } from "./shots/Grifo";
import { OceanoShot } from "./shots/Oceano";
import { PlantaShot } from "./shots/Planta";
import { PlayaShot } from "./shots/Playa";
import { SuperShot } from "./shots/Super";
import { VasoShot } from "./shots/Vaso";
import { VendedorShot } from "./shots/Vendedor";
import { AGUA } from "./timeline";

// "¿Y si toda el agua desapareciera?" Nubi's vertical short (1080 x 1920, 70 s), a reply to a
// viewer's comment. Every other character is a Nubi-shaped toy in other colours.

const SHOT_COMPONENTS: Record<ShotName, React.FC> = {
  vaso: VasoShot,
  oceano: OceanoShot,
  flash: FlashShot,
  grifo: GrifoShot,
  playa: PlayaShot,
  planta: PlantaShot,
  campos: CamposShot,
  super: SuperShot,
  vendedor: VendedorShot,
  calle: CalleShot,
  escondite: EsconditeShot,
  cama: CamaShot,
};

export const AguaSoundtrack: React.FC = () => (
  <Mix
    music="agua/music.wav"
    musicParts={MUSIC_PARTS}
    musicGain={musicGain}
    duration={AGUA.DURATION}
    cues={CUES}
    beds={BEDS}
    lines={AGUA.LINES}
    voiceDir="agua/voice"
    ducking={AGUA.ducking}
  />
);

export const AguaShort: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
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
      <AguaOverlays />
      <Captions chunks={AGUA.CAPTIONS} {...SAFE.captions} />
      {withAudio ? <AguaSoundtrack /> : null}
    </AbsoluteFill>
  );
};
