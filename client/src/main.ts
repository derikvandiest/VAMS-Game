import { startPlaceholderScene, SceneController } from "./scene";
import { connectToServer, disconnectFromServer, setOfflineBadge } from "./net";
import { initChat } from "./chat";
import { initSettingsModal } from "./settings";
import {
  SaveSlotData,
  autoSave,
  getActiveSlotId,
  loadSlot,
  completeObjective,
  GAME_OBJECTIVES,
} from "./saveManager";
import { saveCharacterProfile } from "./profile";
import { StartMenu } from "./startMenu";

/**
 * Game Entry Point:
 * Displays the Valor Academy Start Menu with school logo,
 * Handles Single Player vs Multiplayer modes,
 * Manages Save Slots 1-3 & Automatic Progress Saving,
 * And provides in-game "Leave Game" return to menu.
 */

let activeScene: SceneController | null = null;
let currentMode: "singleplayer" | "multiplayer" = "singleplayer";
let autosaveInterval: number | undefined;

// Initialize Settings Modal so it can be opened from the Start Menu or HUD
initSettingsModal(() => {
  if (activeScene) {
    autoSave(activeScene.getPlayerTransform());
  }
});

const app = document.getElementById("app");
const hudElements = [
  "status-badge",
  "compass",
  "settings-btn",
  "unstuck-btn",
  "leave-game-btn",
  "objective-hud",
  "controls-hint",
];

function setHudVisibility(visible: boolean): void {
  for (const id of hudElements) {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = visible ? (id === "compass" || id === "settings-btn" || id === "unstuck-btn" || id === "leave-game-btn" ? "flex" : "block") : "none";
    }
  }

  // Handle chat widget visibility (multiplayer only)
  const chatWidget = document.getElementById("chat-widget");
  if (chatWidget) {
    chatWidget.style.display = visible && currentMode === "multiplayer" ? "block" : "none";
  }
}

// Hide HUD before starting game
setHudVisibility(false);

function updateObjectiveHud(slot: SaveSlotData): void {
  const stampsEl = document.getElementById("obj-hud-stamps");
  const descEl = document.getElementById("obj-hud-desc");
  if (stampsEl) {
    stampsEl.textContent = `${slot.objectives.stampsCount} / 16 Stamps`;
  }
  if (descEl) {
    const currentDef = GAME_OBJECTIVES.find((o) => o.id === slot.objectives.currentObjectiveId);
    if (currentDef) {
      descEl.textContent = `${currentDef.roomName} — ${currentDef.description}`;
    } else {
      descEl.textContent = "Explore campus & complete teacher stamp stations";
    }
  }
}

// Create and show Start Menu
const startMenu = new StartMenu({
  onStartGame: (mode, slotData) => {
    launchGame(mode, slotData);
  },
});

function launchGame(mode: "singleplayer" | "multiplayer", slotData: SaveSlotData): void {
  currentMode = mode;
  if (!app) {
    console.error("[client] Could not find #app element — the 3D scene cannot start.");
    return;
  }

  // Sync profile into active character memory
  saveCharacterProfile(slotData.profile);

  // Network & chat mode configuration
  if (mode === "multiplayer") {
    connectToServer();
    initChat();
  } else {
    setOfflineBadge();
  }

  // Show In-Game HUD
  setHudVisibility(true);
  updateObjectiveHud(slotData);

  // Start 3D Scene with saved transform
  try {
    if (activeScene) {
      activeScene.stop();
    }
    activeScene = startPlaceholderScene(app, slotData.playerTransform);
  } catch (error) {
    console.error("[client] The 3D scene failed to start:", error);
  }

  // Start background autosave timer (every 45s)
  if (autosaveInterval) clearInterval(autosaveInterval);
  autosaveInterval = window.setInterval(() => {
    if (activeScene) {
      autoSave(activeScene.getPlayerTransform());
    }
  }, 45000);
}

// Setup Leave Game Modal and Button
const leaveGameBtn = document.getElementById("leave-game-btn");
const leaveModalOverlay = document.getElementById("leave-modal-overlay");
const leaveConfirmBtn = document.getElementById("leave-confirm-btn");
const leaveCancelBtn = document.getElementById("leave-cancel-btn");

function openLeaveModal(): void {
  if (leaveModalOverlay) leaveModalOverlay.style.display = "flex";
}

function closeLeaveModal(): void {
  if (leaveModalOverlay) leaveModalOverlay.style.display = "none";
}

leaveGameBtn?.addEventListener("click", openLeaveModal);
leaveCancelBtn?.addEventListener("click", closeLeaveModal);

leaveModalOverlay?.addEventListener("click", (e) => {
  if (e.target === leaveModalOverlay) closeLeaveModal();
});

leaveConfirmBtn?.addEventListener("click", () => {
  closeLeaveModal();
  returnToMainMenu();
});

function returnToMainMenu(): void {
  if (autosaveInterval) clearInterval(autosaveInterval);

  // Save current player location and state before stopping
  if (activeScene) {
    const transform = activeScene.getPlayerTransform();
    autoSave(transform);
    activeScene.stop();
    activeScene = null;
  }

  if (currentMode === "multiplayer") {
    disconnectFromServer();
  }

  // Hide In-Game HUD and show Start Menu
  setHudVisibility(false);
  startMenu.show();
}

// Listen for Escape key to trigger leave modal while playing
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && activeScene) {
    const settingsModal = document.getElementById("settings-modal-overlay");
    if (settingsModal && settingsModal.style.display === "flex") {
      return; // Handled by settings modal
    }
    if (leaveModalOverlay && leaveModalOverlay.style.display === "flex") {
      closeLeaveModal();
    } else {
      openLeaveModal();
    }
  }
});

// Automatic save on browser tab close or refresh
window.addEventListener("beforeunload", () => {
  if (activeScene) {
    autoSave(activeScene.getPlayerTransform());
  }
});

// Global API for completing objectives (callable from quizzes, dialogues, or interactions)
(window as any).__completeObjective = (objectiveId: string) => {
  const transform = activeScene ? activeScene.getPlayerTransform() : undefined;
  const result = completeObjective(objectiveId, transform);
  const currentSlot = loadSlot(getActiveSlotId());
  if (currentSlot) {
    updateObjectiveHud(currentSlot);
  }
  return result;
};

(window as any).__leaveGame = returnToMainMenu;
