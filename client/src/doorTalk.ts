/**
 * Teachers who greet players at the door of a room that stays closed (the Theater).
 * Press E at the door to talk. All text here is SAMPLE text for now.
 */
import type { DialogTree, DialogSpeaker } from "./dialog";
import larkPortrait from "./assets/lark_portrait.png";

export interface DoorTalk {
  speaker: DialogSpeaker;
  tree: DialogTree;
  /** The on-screen hint at the door */
  hint: string;
}

const close = { label: "Close" };

export const DOOR_TALK: Record<string, DoorTalk> = {
  theater: {
    speaker: { name: "Mr. Lark", title: "Theater Teacher", portrait: larkPortrait },
    hint: "Press E to talk to Mr. Lark at the Theater door 🎭",
    tree: {
      start: "root",
      nodes: {
        root: {
          paragraphs: ["(Sample text) Hi there! I'm Mr. Lark, and this is the Theater. Drama and the arts are what we do here.", "The theater is closed for now, but stop by anytime to say hello."],
          options: [{ label: "What happens in the Theater?", next: "about" }, close],
        },
        about: {
          paragraphs: ["(Sample text) Our students rehearse plays, practice public speaking, and put on shows for the whole school. It's a great place to try something new."],
          options: [{ label: "I have another question", next: "root" }, close],
        },
      },
    },
  },
};
