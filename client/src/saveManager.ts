/**
 * Save Manager & Objective Persistence System.
 * Handles slot-based localStorage persistence (Slots 1-3), objective tracking,
 * autosaves on objective completion, and HUD save notifications.
 */

import { CharacterProfile, loadCharacterProfile } from "./profile";

export interface ObjectiveDef {
  id: string;
  title: string;
  roomName: string;
  description: string;
  isStamp: boolean;
}

export const GAME_OBJECTIVES: ObjectiveDef[] = [
  // Welcome
  { id: "obj_mpr_seat", title: "Welcome to the PD", roomName: "Multi-Purpose Room (MPR)", description: "Go to the MPR and take a seat at one of the tables", isStamp: false },

  // 5th Grade
  { id: "obj_5th_csun", title: "5th Grade CSUN", roomName: "5th Grade CSUN (History)", description: "Visit 5th Grade CSUN and earn stamp", isStamp: true },
  { id: "obj_5th_lmu", title: "5th Grade LMU", roomName: "5th Grade LMU (Math)", description: "Visit 5th Grade LMU and earn stamp", isStamp: true },
  { id: "obj_5th_ucla", title: "5th Grade UCLA", roomName: "5th Grade UCLA (English)", description: "Visit 5th Grade UCLA and earn stamp", isStamp: true },
  { id: "obj_5th_usc", title: "5th Grade USC", roomName: "5th Grade USC (Science)", description: "Visit 5th Grade USC and earn stamp", isStamp: true },

  // 6th Grade
  { id: "obj_6th_csun", title: "6th Grade CSUN", roomName: "6th Grade CSUN (Math)", description: "Visit 6th Grade CSUN and earn stamp", isStamp: true },
  { id: "obj_6th_lmu", title: "6th Grade LMU", roomName: "6th Grade LMU (Science)", description: "Visit 6th Grade LMU and earn stamp", isStamp: true },
  { id: "obj_6th_ucla", title: "6th Grade UCLA", roomName: "6th Grade UCLA (History)", description: "Visit 6th Grade UCLA and earn stamp", isStamp: true },
  { id: "obj_6th_usc", title: "6th Grade USC", roomName: "6th Grade USC (English)", description: "Visit 6th Grade USC and earn stamp", isStamp: true },

  // 7th Grade
  { id: "obj_7th_csun", title: "7th Grade CSUN", roomName: "7th Grade CSUN (Math)", description: "Visit 7th Grade CSUN and earn stamp", isStamp: true },
  { id: "obj_7th_lmu", title: "7th Grade LMU", roomName: "7th Grade LMU (History)", description: "Visit 7th Grade LMU and earn stamp", isStamp: true },
  { id: "obj_7th_ucla", title: "7th Grade UCLA", roomName: "7th Grade UCLA (Science)", description: "Visit 7th Grade UCLA and earn stamp", isStamp: true },
  { id: "obj_7th_usc", title: "7th Grade USC", roomName: "7th Grade USC (English)", description: "Visit 7th Grade USC and earn stamp", isStamp: true },

  // 8th Grade
  { id: "obj_8th_csun", title: "8th Grade CSUN", roomName: "8th Grade CSUN (English)", description: "Visit 8th Grade CSUN and earn stamp", isStamp: true },
  { id: "obj_8th_lmu", title: "8th Grade LMU", roomName: "8th Grade LMU (History)", description: "Visit 8th Grade LMU and earn stamp", isStamp: true },
  { id: "obj_8th_ucla", title: "8th Grade UCLA", roomName: "8th Grade UCLA (Math)", description: "Visit 8th Grade UCLA and earn stamp", isStamp: true },
  { id: "obj_8th_usc", title: "8th Grade USC", roomName: "8th Grade USC (Science)", description: "Visit 8th Grade USC and earn stamp", isStamp: true },

  // Culminating Objectives
  { id: "obj_turn_in", title: "Turn in Report Card", roomName: "ELD Classroom", description: "Deliver your completed report card to Mr. Van Diest", isStamp: false },
  { id: "obj_exit_campus", title: "Leave Campus", roomName: "Parking Lot", description: "Exit campus through the parking lot to receive completion certificate", isStamp: false },

  // Optional: Mr. Van Diest's feedback survey (removes the "!" over his head)
  { id: "obj_survey", title: "Feedback Survey", roomName: "MPR", description: "Complete the feedback survey with Mr. Van Diest", isStamp: false },
];

export interface SaveSlotData {
  id: number;
  name: string;
  mode: "singleplayer" | "multiplayer";
  lastSaved: string; // ISO date
  playtimeSeconds: number;
  profile: CharacterProfile;
  objectives: {
    completedIds: string[];
    currentObjectiveId: string;
    stampsCount: number; // out of 16
  };
  playerTransform: {
    x: number;
    y: number;
    z: number;
    rotY: number;
  };
}

const STORAGE_PREFIX = "eld_save_slot_";
const ACTIVE_SLOT_KEY = "eld_active_save_slot";
const TOTAL_STAMPS = 16;

let activeSlotId: number = 1;
let lastAutosaveTime = Date.now();

export function getActiveSlotId(): number {
  const stored = localStorage.getItem(ACTIVE_SLOT_KEY);
  if (stored) {
    const num = parseInt(stored, 10);
    if (num >= 1 && num <= 3) return num;
  }
  return 1;
}

export function setActiveSlotId(slotId: number): void {
  activeSlotId = slotId;
  localStorage.setItem(ACTIVE_SLOT_KEY, String(slotId));
}

export function loadSlot(slotId: number): SaveSlotData | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + slotId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveSlotData;
    if (parsed && typeof parsed.id === "number") {
      return parsed;
    }
  } catch (err) {
    console.error(`[saveManager] Error loading slot ${slotId}:`, err);
  }
  return null;
}

export function getSaveSlots(): (SaveSlotData | null)[] {
  return [loadSlot(1), loadSlot(2), loadSlot(3)];
}

export function getLatestSlot(): SaveSlotData | null {
  const slots = getSaveSlots().filter((s): s is SaveSlotData => s !== null);
  if (slots.length === 0) return null;
  slots.sort((a, b) => new Date(b.lastSaved).getTime() - new Date(a.lastSaved).getTime());
  return slots[0];
}

export function saveSlot(slotId: number, data: Partial<SaveSlotData>): SaveSlotData {
  const existing = loadSlot(slotId);
  const profile = data.profile || existing?.profile || loadCharacterProfile();
  const name = data.name || profile.name || existing?.name || "Teacher";

  const updated: SaveSlotData = {
    id: slotId,
    name,
    mode: data.mode || existing?.mode || "singleplayer",
    lastSaved: new Date().toISOString(),
    playtimeSeconds: (existing?.playtimeSeconds || 0) + Math.max(0, Math.floor((Date.now() - lastAutosaveTime) / 1000)),
    profile,
    objectives: {
      completedIds: data.objectives?.completedIds || existing?.objectives.completedIds || [],
      currentObjectiveId: data.objectives?.currentObjectiveId || existing?.objectives.currentObjectiveId || GAME_OBJECTIVES[0].id,
      stampsCount: data.objectives?.stampsCount ?? existing?.objectives.stampsCount ?? 0,
    },
    playerTransform: data.playerTransform || existing?.playerTransform || {
      x: -36.8, // Parking lot initial spawn
      y: 0,
      z: 22.0,
      rotY: 0,
    },
  };

  lastAutosaveTime = Date.now();
  try {
    localStorage.setItem(STORAGE_PREFIX + slotId, JSON.stringify(updated));
    localStorage.setItem(ACTIVE_SLOT_KEY, String(slotId));
  } catch (err) {
    console.error(`[saveManager] Error saving slot ${slotId}:`, err);
  }
  return updated;
}

export function deleteSlot(slotId: number): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + slotId);
  } catch (err) {
    console.error(`[saveManager] Error deleting slot ${slotId}:`, err);
  }
}

export function createNewSave(
  slotId: number,
  mode: "singleplayer" | "multiplayer",
  profile: CharacterProfile
): SaveSlotData {
  setActiveSlotId(slotId);
  const newSave: SaveSlotData = {
    id: slotId,
    name: profile.name || "Teacher",
    mode,
    lastSaved: new Date().toISOString(),
    playtimeSeconds: 0,
    profile,
    objectives: {
      completedIds: [],
      currentObjectiveId: GAME_OBJECTIVES[0].id,
      stampsCount: 0,
    },
    playerTransform: {
      x: -36.8,
      y: 0,
      z: 22.0,
      rotY: 0,
    },
  };

  try {
    localStorage.setItem(STORAGE_PREFIX + slotId, JSON.stringify(newSave));
    localStorage.setItem(ACTIVE_SLOT_KEY, String(slotId));
  } catch (err) {
    console.error(`[saveManager] Failed to create new save in slot ${slotId}:`, err);
  }
  return newSave;
}

export function autoSave(currentTransform?: { x: number; y: number; z: number; rotY: number }): SaveSlotData {
  const currentSlotId = getActiveSlotId();
  const current = loadSlot(currentSlotId);
  const profile = loadCharacterProfile();

  const saved = saveSlot(currentSlotId, {
    profile,
    playerTransform: currentTransform || current?.playerTransform,
  });

  showSaveToast();
  return saved;
}

/**
 * Marks an objective complete, updates stamp count, and triggers an autosave.
 */
export function completeObjective(
  objectiveId: string,
  currentTransform?: { x: number; y: number; z: number; rotY: number }
): { completed: boolean; stampsCount: number; alreadyDone: boolean } {
  const currentSlotId = getActiveSlotId();
  const slot = loadSlot(currentSlotId) || createNewSave(currentSlotId, "singleplayer", loadCharacterProfile());

  if (slot.objectives.completedIds.includes(objectiveId)) {
    return { completed: true, stampsCount: slot.objectives.stampsCount, alreadyDone: true };
  }

  const def = GAME_OBJECTIVES.find((o) => o.id === objectiveId);
  const isStamp = def ? def.isStamp : true;
  const newCompleted = [...slot.objectives.completedIds, objectiveId];
  const newStampsCount = isStamp
    ? Math.min(TOTAL_STAMPS, slot.objectives.stampsCount + 1)
    : slot.objectives.stampsCount;

  // Determine next objective
  let nextObjId = "obj_turn_in";
  for (const obj of GAME_OBJECTIVES) {
    if (!newCompleted.includes(obj.id)) {
      nextObjId = obj.id;
      break;
    }
  }

  saveSlot(currentSlotId, {
    objectives: {
      completedIds: newCompleted,
      currentObjectiveId: nextObjId,
      stampsCount: newStampsCount,
    },
    playerTransform: currentTransform,
  });

  window.dispatchEvent(new CustomEvent("eld-objective-complete", { detail: { id: objectiveId } }));
  const objTitle = def ? def.title : "Objective";
  showSaveToast(`Objective Completed: ${objTitle}! Progress Saved.`);
  return { completed: true, stampsCount: newStampsCount, alreadyDone: false };
}

let toastTimeout: number | undefined;

export function showSaveToast(customMessage?: string): void {
  let toast = document.getElementById("save-toast-banner");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "save-toast-banner";
    toast.className = "save-toast-banner";
    document.body.appendChild(toast);
  }

  const message = customMessage || "💾 Progress Saved";
  toast.innerHTML = `<span class="save-toast-icon">💾</span> <span class="save-toast-text">${message}</span>`;
  toast.classList.add("visible");

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => {
    toast?.classList.remove("visible");
  }, 3200);
}
