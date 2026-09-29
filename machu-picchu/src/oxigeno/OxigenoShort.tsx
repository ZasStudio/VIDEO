import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { PoofWipe } from "../inca/PoofWipe";
import { Captions } from "../overlay/Captions";
import { Vignette } from "../overlay/Graphics";
import { ZoomCut } from "../scenes/common";
import { Mix } from "../Soundtrack";
import { OXI_BEDS, OXI_CUES } from "./cues";
import { OxiBoton } from "./scenes/OxiBoton";
import { OxiFinal } from "./scenes/OxiFinal";
import { OxiFuego } from "./scenes/OxiFuego";
import { OxiHumanos } from "./scenes/OxiHumanos";
import { OxiIntro } from "./scenes/OxiIntro";
import { OxiMotores } from "./scenes/OxiMotores";
import { OxiRegreso } from "./scenes/OxiRegreso";
import { MUSIC_TRIM, OXI, OxiScene } from "./timeline";

// "¿Y si desaparece el oxígeno por 5 segundos?" Nubi's vertical short (1080 x 1920, 60 s).
// Costume changes happen behind a cloud of smoke; the lab scenes cut straight.

const SCENE_COMPONENTS: Record<OxiScene, React.FC> = {
  intro: OxiIntro,
  boton: OxiBoton,
  fuego: OxiFuego,
  motores: OxiMotores,
  humanos: OxiHumanos,
  regreso: OxiRegreso,
  final: OxiFinal,
};

/** Scenes that open with a costume change behind smoke (and where it gathers). */
const POOF_AT: Partial<Record<OxiScene, [number, number]>> = {
  fuego: [540, 1000],
  motores: [540, 960],
  humanos: [540, 1000],
  regreso: [460, 1040],
};

const SceneSlot: React.FC<{ k: OxiScene }> = ({ k }) => {
  const frame = useCurrentFrame();
  const Comp = SCENE_COMPONENTS[k];
  return (
    <ZoomCut frame={frame} duration={OXI.SCENES[k].duration} inFrames={k === "intro" || k === "boton" ? 0 : 6} outFrames={k === "final" || k === "intro" ? 0 : 5}>
      <Comp />
    </ZoomCut>
  );
};

export const OxigenoSoundtrack: React.FC = () => (
  <Mix
    music="oxigeno/music.wav"
    musicTrim={MUSIC_TRIM}
    duration={OXI.DURATION}
    fadeOut={20}
    cues={OXI_CUES}
    beds={OXI_BEDS}
    lines={OXI.LINES}
    voiceDir="oxigeno/voice"
    ducking={OXI.ducking}
  />
);

export const OxigenoShort: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
  const frame = useCurrentFrame();
  const keys = Object.keys(OXI.SCENES) as OxiScene[];
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {keys.map((k) => (
        <Sequence key={k} from={OXI.SCENES[k].from} durationInFrames={OXI.SCENES[k].duration} name={k}>
          <SceneSlot k={k} />
        </Sequence>
      ))}
      <Vignette strength={0.3} />
      {keys.map((k) => {
        const at = POOF_AT[k];
        return at ? <PoofWipe key={k} frame={frame} at={OXI.SCENES[k].from} x={at[0]} y={at[1]} /> : null;
      })}
      <Captions chunks={OXI.CAPTIONS} bottom={440} fontSize={92} maxWidth={960} />
      {withAudio ? <OxigenoSoundtrack /> : null}
    </AbsoluteFill>
  );
};
