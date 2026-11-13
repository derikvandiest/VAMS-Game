/**
 * The ELD classroom door: Mr. Van Diest collects the 16 assignments. All text here is SAMPLE text for now.
 * Turning in the assignments completes the "turn in" objective, which starts the last step of the game
 * (go to the parking lot and drive away in a car).
 */
import type { DialogTree, DialogSpeaker } from "./dialog";
import vanDiestPortrait from "./assets/vandiest_portrait.png";

export const TOTAL_ASSIGNMENTS = 16;

const SPEAKER: DialogSpeaker = { name: "Mr. Van Diest", title: "ELD Coordinator/Teacher", portrait: vanDiestPortrait };

/** The pop-up for the ELD classroom door, depending on how far the player is */
export function eldDoorDialog(assignmentsDone: number, turnedIn: boolean): { speaker: DialogSpeaker; tree: DialogTree } {
  const enter = { label: "Go into the ELD classroom", action: "enter-eld" };
  const close = { label: "Close" };

  let tree: DialogTree;
  if (turnedIn) {
    tree = {
      start: "root",
      nodes: {
        root: {
          paragraphs: ["(Sample text) Thank you again for turning in your work! You're all set.", "Head out to the parking lot and drive away in one of the cars to finish the game."],
          options: [enter, close],
        },
      },
    };
  } else if (assignmentsDone >= TOTAL_ASSIGNMENTS) {
    tree = {
      start: "root",
      nodes: {
        root: {
          paragraphs: ["(Sample text) Welcome back! You've completed all 16 assignments. Fantastic work.", "Are you ready to turn in your work?"],
          options: [{ label: "Turn in my assignments", next: "done" }, enter, close],
        },
        done: {
          paragraphs: [
            "(Sample text) Your assignments are turned in. Well done!",
            "The last step: head to the parking lot and drive away in one of the cars to finish the game.",
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
            `(Sample text) Welcome to the ELD classroom! You've completed ${assignmentsDone} of ${TOTAL_ASSIGNMENTS} assignments.`,
            `Come back when you've finished the other ${left} and I'll collect your work.`,
          ],
          options: [enter, close],
        },
      },
    };
  }
  return { speaker: SPEAKER, tree };
}
