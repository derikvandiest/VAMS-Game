/**
 * Shared lookups between classrooms (content/classrooms.json) and objectives (saveManager.ts).
 * Each of the 16 homeroom classrooms has one assignment objective, e.g. "5th-csun-humanities" -> "obj_5th_csun".
 */
import classroomsData from "../../content/classrooms.json";

export interface RoomInfo {
  id: string;
  label: string;
  shortLabel: string;
  type: "stamp" | "other";
  /** Objective id of the room's assignment (stamp rooms only) */
  objectiveId?: string;
  grade?: number;
  /** The homeroom's name (USC, UCLA, LMU, CSUN) */
  homeroom?: string;
  subject?: string;
}

export const ROOMS: RoomInfo[] = (
  classroomsData.classrooms as Array<{ id: string; label: string; shortLabel: string; type: string; grade?: number; homeroom?: string; subject?: string }>
).map((c) => ({
  id: c.id,
  label: c.label,
  shortLabel: c.shortLabel,
  type: c.type === "stamp" ? "stamp" : "other",
  objectiveId: c.type === "stamp" && c.grade && c.homeroom ? `obj_${c.grade}th_${c.homeroom.toLowerCase()}` : undefined,
  grade: c.grade,
  homeroom: c.homeroom,
  subject: c.subject,
}));

export const roomById = (id: string): RoomInfo | undefined => ROOMS.find((r) => r.id === id);
export const roomIdByObjective = new Map<string, string>(ROOMS.filter((r) => r.objectiveId).map((r) => [r.objectiveId!, r.id]));
