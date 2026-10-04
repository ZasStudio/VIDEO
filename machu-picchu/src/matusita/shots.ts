// The shots of the Casa Matusita short in order (GLOBAL frames, `to` exclusive). Each shot component
// is rendered inside <Sequence from={SHOTS.x.from}>: its global frame is useCurrentFrame() + from.
// After FINAL.BLACK there is no shot: the end card sits on black.
import { FINAL, GANCHO, LUGAR, MIEDO, RETO, SUSTO, VERDAD } from "./beats";

export const SHOTS = {
  ojos: { from: GANCHO.START, to: GANCHO.END },
  fachada: { from: LUGAR.START, to: LUGAR.RAISE },
  ventana: { from: LUGAR.RAISE, to: LUGAR.END },
  entrada: { from: RETO.START, to: RETO.END },
  pasillo: { from: MIEDO.START, to: MIEDO.END },
  puerta: { from: SUSTO.START, to: SUSTO.END },
  cuarto: { from: VERDAD.START, to: VERDAD.END },
  final: { from: FINAL.START, to: FINAL.BLACK },
};

export type ShotName = keyof typeof SHOTS;
