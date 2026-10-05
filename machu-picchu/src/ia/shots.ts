// The shots of the AI short in order (GLOBAL frames, `to` exclusive). Each shot component is
// rendered inside <Sequence from={SHOTS.x.from}>: its global frame is useCurrentFrame() + from.
// After FINAL.CARD there is no shot: the end card (2D) sits on its own background.
import { FINAL, FOTO, GANCHO, GIRO, JEFE, MENSAJE, TAREA } from "./beats";

export const SHOTS = {
  // Agent "rooms": the girl's and the boy's rooms.
  chica: { from: GANCHO.START, to: GANCHO.TYPE },
  chico: { from: GANCHO.TYPE, to: GANCHO.NUBI },
  // Agent "studio": Nubi's studio with the big IA switch.
  nubi: { from: GANCHO.NUBI, to: GANCHO.END },
  mensaje: { from: MENSAJE.START, to: MENSAJE.END },
  // Agent "work": the student's desk and the office.
  tarea: { from: TAREA.START, to: TAREA.END },
  jefe: { from: JEFE.START, to: JEFE.END },
  // Agent "studio": the luxury photo; the turn; the ending.
  foto: { from: FOTO.START, to: FOTO.END },
  giroNubi: { from: GIRO.START, to: GIRO.YA },
  giroChico: { from: GIRO.YA, to: GIRO.PREGUNTA },
  giroSwitch: { from: GIRO.PREGUNTA, to: GIRO.TODO - 6 },
  almuerzo: { from: GIRO.TODO - 6, to: GIRO.END },
  final: { from: FINAL.START, to: FINAL.CARD },
};

export type ShotName = keyof typeof SHOTS;
