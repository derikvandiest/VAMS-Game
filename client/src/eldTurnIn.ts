/**
 * Mrs. Carmona, the ELD Director, in the ELD classroom: she collects the 16 assignments. All text here is SAMPLE text for
 * now. Turning in the assignments completes the "turn in" objective, which starts the last step of the game (get in a
 * car in the parking lot and drive home).
 */
import type { DialogTree, DialogSpeaker } from "./dialog";

export const TOTAL_ASSIGNMENTS = 16;

const SPEAKER: DialogSpeaker = { name: "Mrs. Carmona", title: "ELD Director" };

/** Mrs. Carmona's conversation, depending on how far the player is */
export function eldDoorDialog(assignmentsDone: number, turnedIn: boolean): { speaker: DialogSpeaker; tree: DialogTree } {
  const close = { label: "Thanks, Mrs. Carmona!" };

  let tree: DialogTree;
  if (turnedIn) {
    tree = {
      start: "root",
      nodes: {
        root: {
          paragraphs: ["(Sample text) Thank you again for turning in your work! You're all set for today.", "Now go get in your car in the parking lot and head home for the day. You've earned it!"],
          options: [close],
        },
      },
    };
  } else if (assignmentsDone >= TOTAL_ASSIGNMENTS) {
    tree = {
      start: "root",
      nodes: {
        root: {
          paragraphs: ["(Sample text) Welcome to the ELD classroom! I'm Mrs. Carmona, the ELD Director. You've completed all 16 assignments. Fantastic work!", "Are you ready to turn in your work?"],
          options: [{ label: "Turn in my assignments", next: "done" }, close],
        },
        done: {
          paragraphs: [
            "(Sample text) Your assignments are turned in. Thank you for everything you learned and shared today!",
            "That's it for the day: go get in your car in the parking lot and head home. See you next time!",
          ],
          event: "turn-in",
          options: [close],
        },
      },
    };
  } else {
    const left = TOTAL_ASSIGNMENTS - assignmentsDone;
    tree = {
      start: "root",
      nodes: {
        root: {
          paragraphs: [
            `(Sample text) Welcome to the ELD classroom! I'm Mrs. Carmona, the ELD Director. You've completed ${assignmentsDone} of ${TOTAL_ASSIGNMENTS} assignments.`,
            `Come back when you've finished the other ${left} and I'll collect your work.`,
          ],
          options: [close],
        },
      },
    };
  }
  return { speaker: SPEAKER, tree };
}
