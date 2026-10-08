/**
 * ELD PD Game — Node server (Milestone 1)
 *
 * This one server does two jobs (PROJECT.md section 2):
 *   1. Serves the game files to the browser (the built files in /dist).
 *   2. Handles multiplayer through Socket.io — WebSockets with an automatic
 *      long-polling fallback for restrictive networks.
 *
 * In later milestones it will also validate movement, quizzes, stamps, and
 * email sending. Game content lives in /content — never hard-code it here.
 */
import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Port can be overridden with an environment variable (see .env.example). */
const PORT = Number(process.env.PORT) || 3001;

const app = express();
const httpServer = createServer(app);

/** Socket.io automatically falls back to long-polling if WebSockets are blocked. */
const io = new Server(httpServer);

// --- Serving the game -------------------------------------------------------
// In production (`npm run build` then `npm start`) the browser files live in /dist.
const distFolder = path.resolve(__dirname, "../../dist");
app.use(express.static(distFolder));

// Health check so we (and the hosting provider) can confirm the server is alive.
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, players: io.engine.clientsCount });
});

// Any other page request gets the game's main page (a single-page app).
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  res.sendFile(path.join(distFolder, "index.html"), (err) => {
    if (err) next(); // /dist not built yet — normal during development
  });
});

// --- Multiplayer (Milestone 1: connection tracking only) --------------------
let peakPlayers = 0;

function broadcastStats(): void {
  const players = io.engine.clientsCount;
  peakPlayers = Math.max(peakPlayers, players);
  io.emit("stats", { players, peak: peakPlayers });
}

io.on("connection", (socket) => {
  console.log(`[server] player connected (${socket.id})`);
  broadcastStats();

  socket.on("disconnect", () => {
    console.log(`[server] player disconnected (${socket.id})`);
    broadcastStats();
  });
});

httpServer.listen(PORT, () => {
  console.log(`[server] ELD PD Game server running at http://localhost:${PORT}`);
  console.log("[server] During development, open http://localhost:5173 instead.");
});
