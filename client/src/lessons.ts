/** The interactive lessons, by classroom (see lessonEngine.ts) */
import { openLessonDef, type LessonDef } from "./lessonEngine";
import { OBJECTIVES_LESSON } from "./lessonObjectives";
import { GRADING_LESSON } from "./lessonGrading";
import { ALGEBRA_LESSON } from "./lessonAlgebra";
import { ORGANIZERS_LESSON } from "./lessonOrganizers";
import { MANIPULATIVES_LESSON } from "./lessonManipulatives";

export { isLessonOpen, closeLesson } from "./lessonEngine";

const LESSONS: Record<string, LessonDef> = Object.fromEntries([OBJECTIVES_LESSON, GRADING_LESSON, ALGEBRA_LESSON, ORGANIZERS_LESSON, MANIPULATIVES_LESSON].map((l) => [l.roomId, l]));

/** The rooms that have one of these interactive lessons */
export function hasLesson(roomId: string): boolean {
  return roomId in LESSONS;
}

export function openLesson(roomId: string, alreadyDone: boolean, complete: () => void): void {
  const def = LESSONS[roomId];
  if (def) openLessonDef(def, alreadyDone, complete);
}
