import React from "react";
import { ThanosScene } from "../timeline";
import { ThanosCarrera } from "./ThanosCarrera";
import { ThanosCierre } from "./ThanosCierre";
import { ThanosDoom } from "./ThanosDoom";
import { ThanosFinal } from "./ThanosFinal";
import { ThanosHeroes } from "./ThanosHeroes";
import { ThanosPiedras } from "./ThanosPiedras";
import { ThanosPortal } from "./ThanosPortal";
import { ThanosPortales } from "./ThanosPortales";
import { ThanosPoscreditos } from "./ThanosPoscreditos";
import { ThanosThor } from "./ThanosThor";
import { ThanosTrajes } from "./ThanosTrajes";

// Scene registry of the Thanos short.
export const SCENE_COMPONENTS: Record<ThanosScene, React.FC> = {
  portal: ThanosPortal,
  carrera: ThanosCarrera,
  thor: ThanosThor,
  heroes: ThanosHeroes,
  trajes: ThanosTrajes,
  piedras: ThanosPiedras,
  portales: ThanosPortales,
  final: ThanosFinal,
  poscreditos: ThanosPoscreditos,
  doom: ThanosDoom,
  cierre: ThanosCierre,
};
