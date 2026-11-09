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
// --- Multiplayer & Chat Management -----------------------------------------
interface Player {
  socketId: string;
  name: string;
}

interface ChatReactions {
  likes: string[]; // array of socketIds who liked
  hearts: string[]; // array of socketIds who hearted
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isPrivate: boolean;
  recipientName?: string;
  recipientId?: string;
  isSystem?: boolean;
  reactions: ChatReactions;
}

const players = new Map<string, Player>();
const messageHistory: ChatMessage[] = []; // stores recent public messages (last 60)
const allMessages = new Map<string, ChatMessage>(); // all active messages for reaction lookup
let peakPlayers = 0;

function sanitizeName(raw: any): string {
  if (typeof raw !== "string") return "";
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_\-\s]/g, "").slice(0, 16);
  return cleaned;
}

function sanitizeText(raw: any): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, 500);
}

function generateDefaultName(): string {
  return `Player_${Math.floor(100 + Math.random() * 900)}`;
}

function broadcastStats(): void {
  const count = io.engine.clientsCount;
  peakPlayers = Math.max(peakPlayers, count);
  io.emit("stats", { players: count, peak: peakPlayers });
}

function broadcastOnlineUsers(): void {
  const list = Array.from(players.values()).map((p) => ({
    socketId: p.socketId,
    name: p.name,
  }));
  io.emit("chat:users", list);
}

io.on("connection", (socket) => {
  console.log(`[server] player connected (${socket.id})`);
  broadcastStats();

  // 1) Player Registration / Join
  socket.on("player:join", (data: { name?: string }) => {
    let clean = sanitizeName(data?.name);
    if (!clean) clean = generateDefaultName();

    players.set(socket.id, { socketId: socket.id, name: clean });
    socket.emit("player:assigned", { name: clean, socketId: socket.id });
    broadcastOnlineUsers();

    // Send recent public messages history to the joining player
    socket.emit("chat:history", messageHistory);
  });

  // 2) Player Rename
  socket.on("player:rename", (data: { name?: string }) => {
    const player = players.get(socket.id);
    const clean = sanitizeName(data?.name);
    if (!player || !clean || clean === player.name) return;

    const oldName = player.name;
    player.name = clean;
    socket.emit("player:assigned", { name: clean, socketId: socket.id });
    broadcastOnlineUsers();

    // Broadcast system notification of name change
    const sysMsg: ChatMessage = {
      id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderId: "system",
      senderName: "System",
      text: `${oldName} is now known as @${clean}`,
      timestamp: Date.now(),
      isPrivate: false,
      isSystem: true,
      reactions: { likes: [], hearts: [] },
    };
    allMessages.set(sysMsg.id, sysMsg);
    messageHistory.push(sysMsg);
    if (messageHistory.length > 60) messageHistory.shift();
    io.emit("chat:message", sysMsg);
  });

  // 3) Sending Chat Messages (Public or Private)
  socket.on(
    "chat:send",
    (data: { text: string; isPrivate?: boolean; recipientName?: string }) => {
      const sender = players.get(socket.id);
      if (!sender) return;

      const rawText = sanitizeText(data?.text);
      if (!rawText) return;

      let isPrivate = Boolean(data?.isPrivate);
      let recipientName = sanitizeName(data?.recipientName);
      let messageText = rawText;

      // Auto-detect @mention at start of message if not explicitly flagged as private
      // e.g. "@Alex hey how are you" or "@Player_123: secret note"
      const mentionMatch = rawText.match(/^@([a-zA-Z0-9_\-]+)[:\s]+([\s\S]*)$/);
      if (mentionMatch) {
        isPrivate = true;
        recipientName = mentionMatch[1];
        messageText = mentionMatch[2].trim();
        if (!messageText) return;
      }

      if (isPrivate && recipientName) {
        // Find recipient in online players (case-insensitive)
        const recipient = Array.from(players.values()).find(
          (p) => p.name.toLowerCase() === recipientName.toLowerCase()
        );

        if (!recipient) {
          socket.emit("chat:error", {
            text: `Player @${recipientName} is not online right now.`,
          });
          return;
        }

        const msg: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          senderId: socket.id,
          senderName: sender.name,
          text: messageText,
          timestamp: Date.now(),
          isPrivate: true,
          recipientName: recipient.name,
          recipientId: recipient.socketId,
          reactions: { likes: [], hearts: [] },
        };

        allMessages.set(msg.id, msg);

        // Deliver only to sender and recipient
        socket.emit("chat:message", msg);
        if (recipient.socketId !== socket.id) {
          io.to(recipient.socketId).emit("chat:message", msg);
        }
      } else {
        // Public server broadcast
        const msg: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          senderId: socket.id,
          senderName: sender.name,
          text: messageText,
          timestamp: Date.now(),
          isPrivate: false,
          reactions: { likes: [], hearts: [] },
        };

        allMessages.set(msg.id, msg);
        messageHistory.push(msg);
        if (messageHistory.length > 60) messageHistory.shift();

        io.emit("chat:message", msg);
      }
    }
  );

  // 4) Message Reactions (Likes 👍 and Hearts ❤️)
  socket.on(
    "chat:react",
    (data: { messageId: string; reaction: "like" | "heart" }) => {
      const msg = allMessages.get(data?.messageId);
      if (!msg) return;

      const reactionType = data.reaction;
      if (reactionType !== "like" && reactionType !== "heart") return;

      const targetList = reactionType === "like" ? msg.reactions.likes : msg.reactions.hearts;
      const index = targetList.indexOf(socket.id);

      if (index >= 0) {
        // Toggle off
        targetList.splice(index, 1);
      } else {
        // Toggle on
        targetList.push(socket.id);
      }

      const updatePayload = {
        messageId: msg.id,
        reactions: msg.reactions,
      };

      if (msg.isPrivate) {
        // Only emit to private participants
        socket.emit("chat:reaction_updated", updatePayload);
        if (msg.recipientId && msg.recipientId !== socket.id) {
          io.to(msg.recipientId).emit("chat:reaction_updated", updatePayload);
        }
        if (msg.senderId !== socket.id && msg.senderId !== msg.recipientId) {
          io.to(msg.senderId).emit("chat:reaction_updated", updatePayload);
        }
      } else {
        // Broadcast to all clients
        io.emit("chat:reaction_updated", updatePayload);
      }
    }
  );

  socket.on("disconnect", () => {
    console.log(`[server] player disconnected (${socket.id})`);
    players.delete(socket.id);
    broadcastOnlineUsers();
    broadcastStats();
  });
});

httpServer.listen(PORT, () => {
  console.log(`[server] ELD PD Game server running at http://localhost:${PORT}`);
  console.log("[server] During development, open http://localhost:5173 instead.");
});
