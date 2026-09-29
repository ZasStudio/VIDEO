import React from "react";
import { FireHelmet, Goggles, LabCoat, PilotCap } from "../three/oxigeno/Costumes";

// Nubi's outfits in the oxygen short, as <Nubi> children (model units).

export type OxiOutfit = "none" | "scientist" | "firefighter" | "pilot";

export const Outfit: React.FC<{ kind: OxiOutfit; flutter?: number }> = ({ kind, flutter = 0 }) => {
  switch (kind) {
    case "scientist":
      return (
        <>
          <LabCoat />
          <Goggles />
        </>
      );
    case "firefighter":
      return <FireHelmet />;
    case "pilot":
      return <PilotCap flutter={flutter} wind={1} />;
    default:
      return null;
  }
};
