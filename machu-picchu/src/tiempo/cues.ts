// Sound design of the time short: the Magnific effects ("tiempo/<name>"), a few synthesized ones
// and three Magnific scores cut to the story, anchored to the beats.
import type { MusicPart } from "../Soundtrack";
import type { Bed, Cue } from "../sfx";
import { CARGO, COMPRAS, ESCALA, FINAL, HOOK, OFICINA, PREGUNTA, SENORA, TIMECO } from "./beats";
import { RICH_BUY } from "./clock";

const FPS = 30;
/** Seconds into a music file -> frames to trim. */
const at = (s: number) => Math.round(s * FPS);
const TENDER = "tiempo/sfx/tierno.wav";
const DARK = "tiempo/sfx/oscuro.wav";

/**
 * The playful clockwork score (119.5 BPM) runs from the hook to the street question, its band
 * landing on the cut to the juice stand; the office gets its busier groove; the old lady gets a
 * tender piano that swells on the hug; the alarm switches to the dark score, which stops dead
 * while Nubi holds its breath; the tower reveal lands on its choir and brass; the last ten
 * seconds run on its quiet ticking section until the cut to black.
 */
export const MUSIC_PARTS: MusicPart[] = [
  [15, OFICINA.START + 4, 0, 6, 8],
  [OFICINA.START, SENORA.START + 4, at(72.63), 3, 8],
  [SENORA.L09 - 8, CARGO.ALARM + 2, at(21.94), 12, 6, TENDER],
  [CARGO.ALARM, CARGO.INHALE + 8, at(22.11), 2, 3, DARK],
  [TIMECO.START, FINAL.MULTA + 2, at(72.05), 4, 3, DARK],
  [FINAL.MULTA + 12, FINAL.BLACK, at(126.55), 15, 2, DARK],
];

/** The music steps back for the deadpan line, the worried question and the final question. */
export const musicGain = (g: number) => {
  const dip = (from: number, to: number, depth: number) =>
    g < from - 8 || g > to + 8 ? 1 : 1 - depth * Math.min(1, (g - (from - 8)) / 8, (to + 8 - g) / 8);
  return dip(PREGUNTA.L05, PREGUNTA.END, 0.3) * dip(OFICINA.L07, OFICINA.END, 0.4) * dip(FINAL.L15, FINAL.BLACK, 0.3);
};

const hook = (): Cue[] => {
  const { DINERO, TIEMPO } = HOOK;
  return [
    [DINERO - 2, "paper", 0.45],
    [DINERO + 8, "sparkle", 0.35],
    [TIEMPO - 3, "whoosh-short", 0.3],
    [TIEMPO + 2, "tiempo/reward", 0.25],
  ];
};

const compras = (): Cue[] => {
  const { START, TAP, SEIS, SLURP, PIZZA, TRES } = COMPRAS;
  return [
    [START - 3, "whoosh", 0.3],
    [TAP, "tiempo/pay", 0.85],
    [SEIS, "tiempo/drain", 0.3, 24],
    [SLURP, "tiempo/slurp", 0.85],
    [PIZZA - 2, "whoosh-short", 0.3],
    [TRES - 1, "agua/sting", 0.6],
    [TRES, "pop", 0.35],
  ];
};

const escala = (): Cue[] => {
  const { START, MES, ANOS, CASA_CUT, CASA, ENTERA } = ESCALA;
  return [
    [START - 2, "whoosh-short", 0.25],
    [MES - 2, "pop", 0.4],
    [RICH_BUY - 2, "tiempo/chaching", 0.8],
    [ANOS - 2, "pop", 0.4],
    [CASA_CUT - 2, "whoosh", 0.35],
    [CASA - 4, "agua/choir", 0.5, 50],
    [CASA, "pop", 0.4],
    [ENTERA, "tiempo/drain", 0.25, 30],
  ];
};

const oficina = (): Cue[] => {
  const { START, L06, LAPSE, LAPSE_END, DIA, BELL, REWARD } = OFICINA;
  return [
    [START - 2, "whoosh-short", 0.3],
    [START + 10, "tiempo/stamp", 0.55],
    [START + 12, "tiempo/reward", 0.25],
    [START + 24, "tiempo/stamp", 0.45],
    [L06 + 6, "tiempo/stamp", 0.4],
    [LAPSE, "tiempo/clockfast", 0.8, LAPSE_END - LAPSE + 6],
    [DIA - 2, "pop", 0.4],
    [BELL, "tiempo/bell", 0.75],
    [REWARD, "tiempo/reward", 0.45],
  ];
};

const senora = (): Cue[] => {
  const { START, L09, TOME, ANO, HUG } = SENORA;
  return [
    [START, "tiempo/mop", 0.6],
    [START + 6, "tiempo/run", 0.5, 30],
    [L09 - 10, "tiempo/mop", 0.35],
    [TOME - 4, "tiempo/transfer", 0.9],
    [ANO, "sparkle", 0.45],
    [ANO + 2, "tiempo/reward", 0.4],
    [HUG, "pop", 0.3],
  ];
};

const cargo = (): Cue[] => {
  const { ALARM, NOTIF, INHALE, EXHALE } = CARGO;
  return [
    [ALARM, "tiempo/alarm", 0.85, 80],
    [ALARM + 6, "tiempo/drain", 0.55],
    [NOTIF, "tiempo/notif", 0.9],
    [INHALE - 2, "tiempo/inhale", 0.95],
    [EXHALE - 2, "tiempo/exhale", 0.95],
    [EXHALE + 6, "tiempo/drain", 0.45],
  ];
};

const timeco = (): Cue[] => {
  const { START, TOWER, SCREEN } = TIMECO;
  return [
    [START, "tiempo/run", 0.75],
    [TOWER - 2, "tiempo/reveal", 0.85],
    [SCREEN - 1, "tiempo/redalert", 0.8],
  ];
};

const final = (): Cue[] => {
  const { DRONE, SCAN, MULTA, DOOR, CARD, BLACK } = FINAL;
  // One tick per second of Nubi's last ten seconds, on the flips of its counter.
  const ticks: Cue[] = Array.from({ length: Math.floor((BLACK - MULTA) / FPS) + 1 }, (_, k) => [MULTA + FPS * k, "tick", 0.55] as Cue);
  return [
    [DRONE, "tiempo/drone", 0.75],
    [SCAN, "tiempo/scan", 0.8],
    [MULTA - 1, "tiempo/crash", 1.0],
    [MULTA, "impact", 0.4],
    ...ticks,
    [DOOR - 2, "tiempo/door", 0.9],
    [CARD, "pop", 0.4],
    [CARD + 10, "pop", 0.35],
    [BLACK, "impact", 0.45],
    [BLACK + 2, "tiempo/reveal", 0.45],
    // The last tick, in the dark.
    [FINAL.END - 14, "tick", 0.6],
  ];
};

export const CUES: Cue[] = [...hook(), ...compras(), ...escala(), ...oficina(), ...senora(), ...cargo(), ...timeco(), ...final()];

export const BEDS: Bed[] = [
  [HOOK.START, HOOK.END, "tiempo/tick", 0.35],
  [COMPRAS.START, ESCALA.END, "tiempo/city", 0.35],
  [PREGUNTA.START, PREGUNTA.END, "tiempo/city", 0.25],
  [OFICINA.START, OFICINA.END, "tiempo/office", 0.45],
  [SENORA.START, SENORA.TOME, "tiempo/tick", 0.6],
  [TIMECO.TOWER, FINAL.BLACK, "tiempo/machine", 0.35],
  [FINAL.MULTA + 20, FINAL.END, "tiempo/heartbeat", 0.55],
];
