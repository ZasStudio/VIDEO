import React from "react";
import { CavemanOutfit, DeliveryOutfit, DinoKingOutfit, TouristOutfit } from "../three/dino/Costumes";
import { Goggles, LabCoat } from "../three/oxigeno/Costumes";

// Nubi's outfits in the dinosaur short, as <Nubi> children (model units).

export type DinoOutfitKind = "none" | "scientist" | "tourist" | "delivery" | "caveman" | "king";

export const Outfit: React.FC<{ kind: DinoOutfitKind; roar?: number }> = ({ kind, roar = 0 }) => {
  switch (kind) {
    case "scientist":
      return (
        <>
          <LabCoat />
          <Goggles />
        </>
      );
    case "tourist":
      return <TouristOutfit />;
    case "delivery":
      return <DeliveryOutfit />;
    case "caveman":
      return <CavemanOutfit />;
    case "king":
      return <DinoKingOutfit roar={roar} />;
    default:
      return null;
  }
};
