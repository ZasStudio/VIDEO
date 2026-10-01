import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FONT } from "../../theme";
import { THANOS, ThanosScene } from "../timeline";
import { ThanosCarrera } from "./ThanosCarrera";
import { ThanosHeroes } from "./ThanosHeroes";
import { ThanosPortal } from "./ThanosPortal";
import { ThanosThor } from "./ThanosThor";

// Scene registry of the Thanos short (placeholders are replaced scene by scene).

const Placeholder: React.FC<{ k: ThanosScene }> = ({ k }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#2B1B3D", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: FONT.heavy, fontSize: 90, color: "#FFFFFF" }}>{k}</div>
      <div style={{ fontFamily: FONT.heavy, fontSize: 50, color: "#FFD60A" }}>{frame + THANOS.SCENES[k].from}</div>
    </AbsoluteFill>
  );
};

const make = (k: ThanosScene): React.FC => {
  const C: React.FC = () => <Placeholder k={k} />;
  C.displayName = `Scene_${k}`;
  return C;
};

export const SCENE_COMPONENTS: Record<ThanosScene, React.FC> = {
  portal: ThanosPortal,
  carrera: ThanosCarrera,
  thor: ThanosThor,
  heroes: ThanosHeroes,
  trajes: make("trajes"),
  piedras: make("piedras"),
  portales: make("portales"),
  final: make("final"),
  poscreditos: make("poscreditos"),
  doom: make("doom"),
  cierre: make("cierre"),
};
