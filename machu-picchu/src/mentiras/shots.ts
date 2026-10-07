// The shots of "¿Y si tus mentiras salieran sobre tu cabeza?" in order (GLOBAL frames, `to` exclusive).
// Each shot component is rendered inside <Sequence from={SHOTS.x.from}>: its global frame is
// useCurrentFrame() + from. A shot may cut between several camera angles inside itself.
import { CITA, DEUDA, ESCAPE, FINAL, GANCHO, GIRO, JEFE } from "./beats";

export const SHOTS = {
  // Agent "casa": Nubi's bedroom (the call, the pizza, the question).
  gancho: { from: GANCHO.START, to: GANCHO.END },
  // Agent "calle": the café terrace and the sneaker shop next door.
  escape: { from: ESCAPE.START, to: ESCAPE.END },
  deuda: { from: DEUDA.START, to: DEUDA.END },
  // Agent "cita-oficina": the candlelit restaurant and the office at 6 pm.
  cita: { from: CITA.START, to: CITA.END },
  jefe: { from: JEFE.START, to: JEFE.END },
  // Agent "casa" again.
  giro: { from: GIRO.START, to: GIRO.END },
  final: { from: FINAL.START, to: FINAL.END },
};

export type ShotName = keyof typeof SHOTS;
