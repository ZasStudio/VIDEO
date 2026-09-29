import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { PoofWipe } from "../inca/PoofWipe";
import { Captions } from "../overlay/Captions";
import { Vignette } from "../overlay/Graphics";
import { ZoomCut } from "../scenes/common";
import { Mix } from "../Soundtrack";
import { DINO_BEDS, DINO_CUES } from "./cues";
import { SAFE } from "./safe";
import { DinoCave } from "./scenes/DinoCave";
import { DinoCiudad } from "./scenes/DinoCiudad";
import { DinoFinal } from "./scenes/DinoFinal";
import { DinoIntro } from "./scenes/DinoIntro";
import { DinoPasa } from "./scenes/DinoPasa";
import { DinoPizza } from "./scenes/DinoPizza";
import { DinoRey } from "./scenes/DinoRey";
import { DINO, DinoScene, MUSIC_TRIM } from "./timeline";

// "¿Y si los dinosaurios nunca se hubieran extinguido?" Nubi's vertical short (1080 x 1920, 60 s).
// Costume changes happen behind a cloud of smoke; several shots are in first person.

const SCENE_COMPONENTS: Record<DinoScene, React.FC> = {
  intro: DinoIntro,
  pasa: DinoPasa,
  ciudad: DinoCiudad,
  pizza: DinoPizza,
  cavernicola: DinoCave,
  rey: DinoRey,
  final: DinoFinal,
};

/** Scenes that open with a costume change behind smoke (and where it gathers). */
const POOF_AT: Partial<Record<DinoScene, [number, number]>> = {
  ciudad: [480, 1000],
  pizza: [480, 1100],
  cavernicola: [480, 1000],
  rey: [480, 1000],
};

const SceneSlot: React.FC<{ k: DinoScene }> = ({ k }) => {
  const frame = useCurrentFrame();
  const Comp = SCENE_COMPONENTS[k];
  return (
    <ZoomCut frame={frame} duration={DINO.SCENES[k].duration} inFrames={k === "intro" ? 0 : 6} outFrames={k === "final" ? 0 : 5}>
      <Comp />
    </ZoomCut>
  );
};

export const DinoSoundtrack: React.FC = () => (
  <Mix
    music="dino/music.wav"
    musicTrim={MUSIC_TRIM}
    duration={DINO.DURATION}
    fadeOut={12}
    cues={DINO_CUES}
    beds={DINO_BEDS}
    lines={DINO.LINES}
    voiceDir="dino/voice"
    ducking={DINO.ducking}
  />
);

export const DinoShort: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
  const frame = useCurrentFrame();
  const keys = Object.keys(DINO.SCENES) as DinoScene[];
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {keys.map((k) => (
        <Sequence key={k} from={DINO.SCENES[k].from} durationInFrames={DINO.SCENES[k].duration} name={k}>
          <SceneSlot k={k} />
        </Sequence>
      ))}
      <Vignette strength={0.28} />
      {keys.map((k) => {
        const at = POOF_AT[k];
        return at ? <PoofWipe key={k} frame={frame} at={DINO.SCENES[k].from} x={at[0]} y={at[1]} /> : null;
      })}
      <Captions chunks={DINO.CAPTIONS} {...SAFE.captions} />
      {withAudio ? <DinoSoundtrack /> : null}
    </AbsoluteFill>
  );
};
