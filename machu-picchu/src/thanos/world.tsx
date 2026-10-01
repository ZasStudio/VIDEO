import React from "react";
import { Vec3 } from "../three/CameraRig";
import { BattleLights } from "../three/thanos/Sets";

/** Thanos in the battle scenes (a little left of the set's spot, so his raised gauntlet stays in frame). */
export const THANOS_AT: Vec3 = [-0.6, 0, -6];

// Shared light of the Thanos short's battle scenes: the battlefield's dusk lights, plus a white
// lightning flash and the stones' purple glow when they fire.
export const FieldLights: React.FC<{ flash?: number; tint?: number; tintAt?: [number, number, number] }> = ({ flash = 0, tint = 0, tintAt = [1.5, 5, -4] }) => (
  <>
    <BattleLights k={1 + flash * 0.9} />
    {tint > 0 ? <pointLight position={tintAt} intensity={tint * 80} distance={24} decay={1.6} color="#C58BFF" /> : null}
  </>
);
