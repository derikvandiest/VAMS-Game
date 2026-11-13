/**
 * NPC definitions. An NPC is a character profile (same options as the player's character creation, plus
 * NPC-only extras like the crown) and a place to stand.
 */
import { CharacterProfile, getDefaultProfile } from "./profile";

export interface NpcDef {
  id: string;
  /** Where the NPC is placed: "mpr" = Multi-Purpose Room */
  room: "mpr";
  x: number;
  z: number;
  /** Rotation about Y in radians (0 faces +z, PI faces -z) */
  rotY: number;
  profile: CharacterProfile;
}

const BLACK = "#1f1f24";

/** Mr. Van Diest (the ELD teacher who runs the PD): suit, neat hair, full beard and a gold crown. */
export const NPC_VAN_DIEST: NpcDef = {
  id: "npc-van-diest",
  room: "mpr",
  // front of the MPR, in front of the projection screen, facing the tables
  x: 400,
  z: 409.3,
  rotY: Math.PI,
  profile: {
    ...getDefaultProfile(),
    name: "Mr. Van Diest",
    noHomeroom: true,
    gender: "masculine",
    look: "masc-suit",
    outfitColor: BLACK,
    hairStyle: "m-suit",
    facialHair: "full-beard",
    hat: "crown",
    shoes: "dress",
    shoeColor: BLACK,
  },
};

export const NPCS: NpcDef[] = [NPC_VAN_DIEST];
