import { io, Socket } from "socket.io-client";

let currentSocket: Socket | null = null;

/**
 * Where the multiplayer server lives. When the game pages are hosted somewhere else (Vercel), the build sets
 * VITE_SERVER_URL to the server's address (e.g. https://eld-pd-game.onrender.com). Empty = the same address the page
 * came from (development, or one server hosting everything).
 */
const SERVER_URL: string = ((import.meta as any).env?.VITE_SERVER_URL ?? "").trim();
let multiplayerActive = false;

/** True while playing on the multiplayer server (other systems, like player presence, check this). */
export function isMultiplayerActive(): boolean {
  return multiplayerActive;
}

export function getSocket(): Socket {
  if (!currentSocket) {
    currentSocket = SERVER_URL ? io(SERVER_URL) : io();
  }
  return currentSocket;
}

/**
 * Multiplayer connection (Milestone 1: connection status only). (VITE_SERVER_URL can point it at a separate server.)
 * Later milestones sync player movement, dialogue, stamps, and emojis here.
 *
 * `io()` connects to the same address the page came from:
 *  - Development: http://localhost:5173 (Vite forwards to the server — see vite.config.ts)
 *  - Production:  the game's public URL (the Node server serves everything)
 */
export function connectToServer(): Socket {
  multiplayerActive = true;
  const socket = getSocket();

  socket.on("connect", () => {
    setBadge(`Server: connected`, "badge-ok");
    console.log(`[client] connected to server (${socket.id})`);
  });

  socket.on("disconnect", () => {
    setBadge(`Server: connection lost — reconnecting…`, "badge-bad");
    console.log("[client] disconnected from server");
  });

  // The server broadcasts how many players are online — seeing this update
  // proves the browser and server are truly talking to each other.
  socket.on("stats", (stats: { players: number; peak: number }) => {
    if (socket.connected) {
      setBadge(`Server: connected — players online: ${stats.players}`, "badge-ok");
    }
  });

  return socket;
}

export function disconnectFromServer(): void {
  multiplayerActive = false;
  if (currentSocket) {
    currentSocket.disconnect();
    currentSocket = null;
  }
}

export function setOfflineBadge(): void {
  disconnectFromServer();
  setBadge("Mode: Single Player (Offline)", "badge-singleplayer");
}

export function setBadge(text: string, cssClass: string): void {
  const badge = document.getElementById("status-badge");
  if (badge) {
    badge.textContent = text;
    badge.className = `badge ${cssClass}`;
  }
}

