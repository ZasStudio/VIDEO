import React from "react";
import { ChasquiHat, EarSpools, FarmerBand, Mascaypacha, Pututu, QUIPU_HIP_R, Quipu, Unku } from "../three/inca/Costumes";

// Nubi's outfits in the Inca-phone short, as <Nubi> children (model units).

export type OutfitKind = "none" | "noble" | "chasqui" | "inca" | "farmer";

export const Outfit: React.FC<{ kind: OutfitKind; swing?: number; hide?: ("pututu" | "quipu")[] }> = ({ kind, swing = 0, hide = [] }) => {
  switch (kind) {
    case "noble":
      return <Unku variant="noble" />;
    case "chasqui":
      return (
        <>
          <Unku variant="chasqui" />
          <ChasquiHat />
          {/* The conch hangs on its strap at the left hip, the quipu at the right. */}
          {hide.includes("pututu") ? null : <Pututu strap side={-1} swing={swing * 0.5} />}
          {hide.includes("quipu") ? null : (
            <group {...QUIPU_HIP_R}>
              <Quipu swing={swing} />
            </group>
          )}
        </>
      );
    case "inca":
      return (
        <>
          <Unku variant="inca" />
          <Mascaypacha />
          <EarSpools />
        </>
      );
    case "farmer":
      return (
        <>
          <Unku variant="farmer" />
          <FarmerBand />
        </>
      );
    default:
      return null;
  }
};

/**
 * Keeps an object held at a fin tip (`holdR` / `holdL` of <Nubi>) upright and facing the
 * camera whatever the fin raise: it undoes the fin's own rotation.
 */
export const Upright: React.FC<{ raise: number; side?: "R" | "L"; children: React.ReactNode }> = ({ raise, side = "R", children }) => {
  const k = side === "R" ? 1 : -1;
  return (
    <group rotation={[0, 0, -k * raise * 0.55]}>
      <group rotation={[0, k * 0.12, 0]}>{children}</group>
    </group>
  );
};
