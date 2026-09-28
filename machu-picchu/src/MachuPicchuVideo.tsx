import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { Captions } from "./overlay/Captions";
import { Soundtrack } from "./Soundtrack";
import { Vignette } from "./overlay/Graphics";
import { Hook } from "./scenes/Hook";
import { Intro } from "./scenes/Intro";
import { Datos } from "./scenes/Datos";
import { Inca } from "./scenes/Inca";
import { Reto } from "./scenes/Reto";
import { Piedras } from "./scenes/Piedras";
import { Sismos } from "./scenes/Sismos";
import { Subsuelo } from "./scenes/Subsuelo";
import { Mita } from "./scenes/Mita";
import { Final } from "./scenes/Final";
import { ZoomCut } from "./scenes/common";
import { SCENES } from "./theme";

type SceneKey = keyof typeof SCENES;

// Scenes that continue the previous shot without a punch cut.
const NO_CUT_IN: SceneKey[] = ["hook", "datos"];
const NO_CUT_OUT: SceneKey[] = ["intro", "final"];

const SCENE_COMPONENTS: Partial<Record<SceneKey, React.FC>> = {
  hook: Hook,
  intro: Intro,
  datos: Datos,
  inca: Inca,
  reto: Reto,
  piedras: Piedras,
  sismos: Sismos,
  subsuelo: Subsuelo,
  mita: Mita,
  final: Final,
};

const SceneSlot: React.FC<{ k: SceneKey }> = ({ k }) => {
  const frame = useCurrentFrame();
  const Comp = SCENE_COMPONENTS[k];
  if (!Comp) return <AbsoluteFill style={{ background: "#222" }} />;
  const s = SCENES[k];
  return (
    <ZoomCut
      frame={frame}
      duration={s.duration}
      inFrames={NO_CUT_IN.includes(k) ? 0 : 7}
      outFrames={NO_CUT_OUT.includes(k) ? 0 : 6}
    >
      <Comp />
    </ZoomCut>
  );
};

export const MachuPicchuVideo: React.FC<{ withAudio?: boolean }> = ({
  withAudio = true,
}) => {
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {(Object.keys(SCENES) as SceneKey[]).map((k) => (
        <Sequence
          key={k}
          from={SCENES[k].from}
          durationInFrames={SCENES[k].duration}
          name={k}
        >
          <SceneSlot k={k} />
        </Sequence>
      ))}
      <Vignette strength={0.38} />
      <Captions />
      {withAudio ? <Soundtrack /> : null}
    </AbsoluteFill>
  );
};
