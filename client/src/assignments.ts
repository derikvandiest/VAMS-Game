/**
 * The assignment shown when a player reads the whiteboard in a classroom (press E at the whiteboard).
 * All text here is SAMPLE text for now: replace it per classroom. Each classroom can name its teacher and give
 * a portrait; rooms without an entry get a generic placeholder.
 */
import type { DialogTree, DialogSpeaker } from "./dialog";
import { roomById } from "./rooms";
import kurisuPortrait from "./assets/kurisu_portrait.png";
import blessingPortrait from "./assets/blessing_portrait.png";
import staufferPortrait from "./assets/stauffer_portrait.png";
import { NPCS } from "./npcs";

interface AssignmentContent {
  teacher: DialogSpeaker;
  /** What the teacher says first */
  intro: string[];
  /** The assignment itself */
  task: string[];
  /** Shown when the player says they have finished */
  finished: string[];
}

const ASSIGNMENTS: Record<string, AssignmentContent> = {
  "6th-lmu-science": {
    teacher: { name: "Mr. Stauffer", title: "6th Grade Science Teacher", portrait: staufferPortrait },
    intro: ["(Sample text) Hey, welcome to 6th Grade LMU Science! I'm Mr. Stauffer. Grab a seat, scientists!"],
    task: [
      "(Sample assignment) Today's assignment: look at the investigation on the board, make a prediction with your partner, and explain your reasoning using one piece of evidence.",
      "When you have finished, come back and let me know.",
    ],
    finished: ["(Sample text) Awesome thinking! I'm marking your assignment as complete. Keep asking questions!"],
  },
  "5th-csun-humanities": {
    teacher: { name: "Ms. Blessing", title: "5th Grade Humanities Teacher", portrait: blessingPortrait },
    intro: ["(Sample text) Hi, welcome to 5th Grade CSUN Humanities! I'm Ms. Blessing. I'm so glad you're here."],
    task: [
      "(Sample assignment) Today's assignment: read the short passage on the board with a partner, then share one thing you noticed and one question you still have.",
      "When you have finished, come back and let me know.",
    ],
    finished: ["(Sample text) Wonderful job! I'm marking your assignment as complete. Thank you!"],
  },
  "8th-ucla-math": {
    teacher: { name: "Mr. Kurisu", title: "8th Grade Math Teacher", portrait: kurisuPortrait },
    intro: ["(Sample text) Welcome to 8th Grade UCLA Math! I'm Mr. Kurisu. Glad you could stop by."],
    task: [
      "(Sample assignment) Today's assignment: work through the three practice problems on the board, show your steps, and explain your thinking out loud to a partner.",
      "When you have finished, come back and let me know.",
    ],
    finished: ["(Sample text) Excellent work! I'm marking your assignment as complete. Keep it up!"],
  },
};

/** The teacher of a classroom, if one has been set up (for the student agenda) */
/** The teacher character standing in a classroom (npcs.ts), if it has one */
function classroomNpc(roomId: string) {
  return NPCS.find((n) => (n.room === "classroom" && n.classroomId === roomId) || n.teaches === roomId);
}

export function teacherFor(roomId: string): string | undefined {
  return classroomNpc(roomId)?.profile.name ?? ASSIGNMENTS[roomId]?.teacher.name;
}

function contentFor(roomId: string): AssignmentContent {
  const known = ASSIGNMENTS[roomId];
  if (known) return known;
  const room = roomById(roomId);
  const npc = classroomNpc(roomId);
  return {
    teacher: npc
      ? { name: npc.profile.name, title: npc.profile.title, portrait: npc.portrait }
      : { name: "Your Teacher", title: room ? room.label : undefined },
    intro: ["(Sample text) Welcome to class!"],
    task: ["(Sample assignment) This classroom's assignment will appear here.", "When you have finished, come back and let me know."],
    finished: ["(Sample text) Great work! Your assignment is complete."],
  };
}

/** The pop-up for a classroom's assignment: the speaker and the conversation tree. */
export function assignmentDialog(roomId: string, alreadyDone: boolean): { speaker: DialogSpeaker; tree: DialogTree } {
  const c = contentFor(roomId);
  const tree: DialogTree = {
    start: alreadyDone ? "already" : "root",
    nodes: {
      root: {
        paragraphs: [...c.intro, ...c.task],
        options: [{ label: "I've completed the assignment", next: "done" }, { label: "Close" }],
      },
      done: {
        paragraphs: c.finished,
        event: "assignment-complete",
        options: [{ label: "Close" }],
      },
      already: {
        paragraphs: ["You've already completed this assignment. Nice work!"],
        options: [{ label: "Read the assignment again", next: "again" }, { label: "Close" }],
      },
      again: {
        paragraphs: [...c.task],
        options: [{ label: "Close" }],
      },
    },
  };
  return { speaker: c.teacher, tree };
}
