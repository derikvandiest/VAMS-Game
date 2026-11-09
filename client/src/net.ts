import { io, Socket } from "socket.io-client";

let currentSocket: Socket | null = null;

export function getSocket(): Socket {
  if (!currentSocket) {
    currentSocket = io();
  }
  return currentSocket;
}

/**
 * Multiplayer connection (Milestone 1: connection status only).
 * Later milestones sync player movement, dialogue, stamps, and emojis here.
 *
 * `io()` connects to the same address the page came from:
 *  - Development: http://localhost:5173 (Vite forwards to the server — see vite.config.ts)
 *  - Production:  the game's public URL (the Node server serves everything)
 */
export function connectToServer(): Socket {
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

