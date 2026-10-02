// The shots of the water short in order (GLOBAL frames, `to` exclusive). Each shot component is
// rendered inside <Sequence from={SHOTS.x.from}>: its global frame is useCurrentFrame() + from.
import { ANTES, FINAL, GIRO, HOOK, PELIGRO, PROBLEMA, SOLUCION } from "./beats";

export const SHOTS = {
  vaso: { from: HOOK.START, to: HOOK.OCEAN },
  oceano: { from: HOOK.OCEAN, to: HOOK.L02 },
  flash: { from: HOOK.L02, to: HOOK.END },
  grifo: { from: ANTES.START, to: ANTES.PLAYA },
  playa: { from: ANTES.PLAYA, to: ANTES.END },
  planta: { from: PROBLEMA.START, to: PROBLEMA.L06 },
  campos: { from: PROBLEMA.L06, to: PROBLEMA.CONSEGUIR },
  super: { from: PROBLEMA.CONSEGUIR, to: PROBLEMA.END },
  vendedor: { from: SOLUCION.START, to: SOLUCION.END },
  calle: { from: PELIGRO.START, to: PELIGRO.END },
  escondite: { from: GIRO.START, to: GIRO.END },
  cama: { from: FINAL.START, to: FINAL.END },
};

export type ShotName = keyof typeof SHOTS;
