import { startPlaceholderScene } from "./scene";
import { connectToServer } from "./net";

/**
 * Milestone 1 entry point.
 * Renders the placeholder 3D scene and connects to the multiplayer server.
 * Later milestones add character creation, movement, NPCs, quizzes, etc.
 */

// Connect FIRST: the connection badge and multiplayer must keep working
// even if 3D rendering is unavailable on a device.
connectToServer();

const app = document.getElementById("app");
if (app) {
  try {
    startPlaceholderScene(app);
  } catch (error) {
    console.error("[client] The 3D scene failed to start:", error);
  }
} else {
  console.error("[client] Could not find #app element — the 3D scene cannot start.");
}
