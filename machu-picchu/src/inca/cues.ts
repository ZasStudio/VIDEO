// Sound design of the Inca-phone short: the Magnific effects ("inca/<name>") plus the
// synthesized ones of the earlier videos, anchored to the same beats as the animation.
import type { Bed, Cue } from "../sfx";
import { CAMINOS, CHASQUI, CTA, INTRO, PAPA, SELFIE, THRONE } from "./beats";
import { INCA } from "./timeline";

const { SCENES } = INCA;

/** Each costume change: the smoke gathers over the 9 frames before the cut. */
const poofs = (): Cue[] =>
  (["chasqui", "inca", "papa", "selfie", "caminos", "cta"] as const).map((k) => [SCENES[k].from - 8, "inca/poof", 0.55]);

const intro = (): Cue[] => {
  const { WAIT, LAND, FALL, WOW, TODO } = INTRO;
  return [
    [WAIT + 4, "pop", 0.3],
    [LAND - FALL - 14, "inca/fall", 0.6],
    [LAND, "impact", 0.32],
    [LAND + 10, "sparkle", 0.3],
    [WOW, "whoosh", 0.3],
    [WOW + 1, "pop", 0.3],
    [TODO, "impact", 0.2],
  ];
};

const chasqui = (): Cue[] => {
  const { TOOT, DIAS, TRIP, MENSAJE, ESCRIBIRIA, MI, SEND, Y, DORMIR } = CHASQUI;
  const nightSpan = TRIP - 2 - (DIAS - 2);
  return [
    [TOOT, "inca/pututu", 0.5],
    // Three day/night flips.
    ...[0, 1, 2].map((k): Cue => [Math.round(DIAS - 2 + (k + 0.5) * (nightSpan / 3)), "whoosh-short", 0.22]),
    [TRIP, "inca/trip", 0.55],
    [MENSAJE, "stone-thud", 0.35],
    [ESCRIBIRIA, "pop", 0.3],
    [MI, "inca/type", 0.45, SEND - MI],
    [SEND, "inca/sent", 0.5],
    [Y - 2, "whoosh-short", 0.25],
    [DORMIR + 6, "inca/snore", 0.5],
  ];
};

const throne = (): Cue[] => {
  const { STORM_FROM, NOVENTA, CHAT_IN, C_START, SEND, LOC_AT, PUES } = THRONE;
  return [
    [STORM_FROM, "inca/notifs", 0.5],
    [STORM_FROM + 2, "inca/buzz", 0.45],
    [NOVENTA, "impact", 0.28],
    [CHAT_IN, "pop", 0.3],
    [C_START, "ding", 0.3],
    [SEND, "inca/sent", 0.45],
    [LOC_AT, "ding", 0.35],
    [PUES, "pop", 0.25],
  ];
};

const papa = (): Cue[] => {
  const { APP, P_START, BOT_POP, PERFECTO, STRIKES, SPROUT, PAPA_TEC } = PAPA;
  return [
    [APP, "tick", 0.3],
    [BOT_POP, "inca/chime", 0.55],
    [BOT_POP + 1, "pop", 0.3],
    [P_START - 2, "whoosh-short", 0.22],
    [PERFECTO, "pop", 0.3],
    ...STRIKES.map((s): Cue => [s, "stone-thud", 0.32]),
    ...[0, 1, 2, 3].map((i): Cue => [SPROUT(i), "pop", 0.24]),
    [PAPA_TEC, "sparkle", 0.4],
  ];
};

const selfie = (): Cue[] => {
  const { VIRAL, POV, AIRE, GRABAS, SHOVE, FLASH } = SELFIE;
  return [
    [VIRAL, "sparkle", 0.35],
    [VIRAL + 4, "pop", 0.25],
    [POV, "whoosh-short", 0.35],
    [POV + 2, "tick", 0.3],
    [AIRE, "inca/llama", 0.5],
    [GRABAS, "inca/llama", 0.35],
    [SHOVE, "whoosh", 0.4],
    [SHOVE + 2, "impact", 0.3],
    [FLASH, "inca/shutter", 0.6],
    [FLASH + 6, "pop", 0.3],
  ];
};

const caminos = (): Cue[] => {
  const { TOSS, LOS, TREINTA, CHASQUIS, QUIPUS } = CAMINOS;
  return [
    [TOSS, "whoosh", 0.35],
    [LOS - 4, "paper", 0.35],
    [LOS, "riser", 0.2],
    [TREINTA, "ding", 0.3],
    [CHASQUIS, "inca/run", 0.3, 45],
    [QUIPUS, "rope", 0.35],
  ];
};

const cta = (): Cue[] => {
  const { EPOCA, TE } = CTA;
  return [
    [EPOCA - 8, "pop", 0.3],
    [TE, "ding", 0.35],
  ];
};

export const INCA_CUES: Cue[] = [...poofs(), ...intro(), ...chasqui(), ...throne(), ...papa(), ...selfie(), ...caminos(), ...cta()]
  .filter(([f]) => f >= 0)
  .sort((a, b) => a[0] - b[0]);

export const INCA_BEDS: Bed[] = [
  // Running footsteps from the start of the run to the trip.
  [CHASQUI.RUN, CHASQUI.TRIP + 2, "inca/run", 0.45],
];
