import { startPlaceholderScene } from "./scene";
import { connectToServer } from "./net";

/**
 * Milestone 1 entry point.
 * Renders the placeholder 3D scene and connects to the multiplayer server.
 * Later milestones add character creation, movement, NPCs, quizzes, etc.
 */
const app = document.getElementById("app");
if (app) {
  startPlaceholderScene(app);
} else {
  console.error("[client] Could not find #app element — the 3D scene cannot start.");
}

connectToServer();
