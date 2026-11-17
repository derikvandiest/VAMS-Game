/**
 * Teachers who greet players at the door of a room that stays closed (none right now).
 * Press E at the door to talk. All text here is SAMPLE text for now.
 */
import type { DialogTree, DialogSpeaker } from "./dialog";

export interface DoorTalk {
  speaker: DialogSpeaker;
  tree: DialogTree;
  /** The on-screen hint at the door */
  hint: string;
}


export const DOOR_TALK: Record<string, DoorTalk> = {
  // (The Theater and the Music room used to greet you at the door; both are open now, with the teacher inside.)
};
