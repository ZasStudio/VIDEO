// The shots of the time short in order (GLOBAL frames, `to` exclusive). Each shot component is
// rendered inside <Sequence from={SHOTS.x.from}>: its global frame is useCurrentFrame() + from.
import { CARGO, COMPRAS, ESCALA, FINAL, HOOK, OFICINA, PREGUNTA, SENORA, TIMECO } from "./beats";

export const SHOTS = {
  intro: { from: HOOK.START, to: HOOK.END },
  jugo: { from: COMPRAS.START, to: COMPRAS.PIZZA },
  pizza: { from: COMPRAS.PIZZA, to: COMPRAS.END },
  vitrinas: { from: ESCALA.START, to: ESCALA.CASA_CUT },
  casa: { from: ESCALA.CASA_CUT, to: ESCALA.END },
  pregunta: { from: PREGUNTA.START, to: PREGUNTA.END },
  oficina: { from: OFICINA.START, to: OFICINA.END },
  senora: { from: SENORA.START, to: SENORA.END },
  alarma: { from: CARGO.START, to: CARGO.END },
  torre: { from: TIMECO.START, to: TIMECO.END },
  dron: { from: FINAL.START, to: FINAL.DOOR },
  puerta: { from: FINAL.DOOR, to: FINAL.BLACK },
};

export type ShotName = keyof typeof SHOTS;
