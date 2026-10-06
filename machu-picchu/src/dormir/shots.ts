// The shots of "¿Y si dormir te pagara?" in order (GLOBAL frames, `to` exclusive). Each shot component
// is rendered inside <Sequence from={SHOTS.x.from}>: its global frame is useCurrentFrame() + from.
import { ENEMIGO, FINAL, GANCHO, GIRO, MUNDO, OFICINA, PROBLEMA } from "./beats";

export const SHOTS = {
  // Agent "bedroom": Nubi's bedroom.
  gancho: { from: GANCHO.START, to: GANCHO.END },
  // Agent "office": the office full of beds.
  oficina: { from: OFICINA.START, to: OFICINA.END },
  problema: { from: PROBLEMA.START, to: PROBLEMA.END },
  // Agent "street": the bakery, the cook, the neighbour.
  mundo: { from: MUNDO.START, to: MUNDO.END },
  cama: { from: ENEMIGO.START, to: ENEMIGO.REVEAL },
  vecino: { from: ENEMIGO.REVEAL, to: ENEMIGO.L14 },
  mirada: { from: ENEMIGO.L14, to: ENEMIGO.END },
  giro: { from: GIRO.START, to: GIRO.END },
  final: { from: FINAL.START, to: FINAL.END },
};

export type ShotName = keyof typeof SHOTS;
