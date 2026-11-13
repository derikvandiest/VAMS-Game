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


// --- Presence: players see each other in the same place ---------------------
// Every player is in one "zone": the outdoor campus, the MPR, or one classroom. A player only receives the
// movement of the players in the same zone (a Socket.io room per zone), so every room is its own shared space.
interface Presence {
  zone: string;
  profile: unknown; // the player's character (appearance); the client sanitizes it before use
  x: number;
  y: number;
  z: number;
  rotY: number;
  seatY: number | null; // height of the seat when sitting
  driving: number | null; // id of the car being driven
  hidden: boolean; // e.g. driving a car (the car itself is not synced yet)
  lastTs: number;
}
const presence = new Map<string, Presence>();

const zoneRoom = (zone: string): string => `zone:${zone}`;
function cleanZone(raw: unknown): string {
  return typeof raw === "string" && /^[a-z0-9-]{1,40}$/.test(raw) ? raw : "campus";
}
function num(raw: unknown, lo: number, hi: number, fallback = 0): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
  return Math.min(hi, Math.max(lo, n));
}
/** Keep the character profile small and plain (only strings/booleans, bounded length) */
function cleanProfile(raw: unknown): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 40)) {
      if (typeof v === "string") out[k.slice(0, 30)] = v.slice(0, 60);
      else if (typeof v === "boolean") out[k.slice(0, 30)] = v;
    }
  }
  return out;
}
function publicState(id: string, p: Presence): Record<string, unknown> {
  return { id, x: p.x, y: p.y, z: p.z, rotY: p.rotY, seatY: p.seatY, driving: p.driving, hidden: p.hidden };
}
/** Put a player into a zone: tell the old zone they left, give them the zone's current players, announce them. */
function enterZone(socket: import("socket.io").Socket, p: Presence, zone: string): void {
  const old = p.zone;
  if (old && old !== zone) {
    socket.leave(zoneRoom(old));
    socket.to(zoneRoom(old)).emit("presence:left", socket.id);
  }
  p.zone = zone;
  socket.join(zoneRoom(zone));
  const others: unknown[] = [];
  for (const [id, other] of presence) {
    if (id !== socket.id && other.zone === zone) others.push({ ...publicState(id, other), profile: other.profile });
  }
  socket.emit("presence:snapshot", others);
  socket.to(zoneRoom(zone)).emit("presence:update", { ...publicState(socket.id, p), profile: p.profile });
}


// --- Shared world: gate, elevator, cars, soccer ball, basketball ------------
// The gate and the elevator are shared switches. Each car has at most one driver, who simulates it and sends its
// position. Each ball has an owner (the last player to touch it) who simulates it and sends its position; everybody
// else sees the owner's version. The server keeps the latest of everything so that late joiners see the same world.
type Vec = Record<string, number>;
interface CarSync {
  driver: string | null;
  state: Vec | null;
}
interface BallSync {
  owner: string | null;
  state: (Vec & { held?: number }) | null;
}
const ELEVATOR_CALL_TIME = 12; // the slow trip to a caller (seconds); must match client/src/elevator.ts
const ELEVATOR_RIDE_TIME = 3.2;
const world = {
  gate: false,
  vehicleGate: false,
  elevator: { level: 0 as 0 | 1, busyUntil: 0 },
  cars: new Map<number, CarSync>(),
  balls: { soccer: { owner: null, state: null } as BallSync, basket: { owner: null, state: null } as BallSync },
};
const ballKey = (raw: unknown): "soccer" | "basket" | null => (raw === "soccer" || raw === "basket" ? raw : null);
const carId = (raw: unknown): number | null => (typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw < 64 ? raw : null);
function cleanVec(raw: unknown, keys: string[]): Vec | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const out: Vec = {};
  for (const k of keys) {
    const v = o[k];
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    out[k] = Math.min(5000, Math.max(-5000, v));
  }
  return out;
}
const CAR_KEYS = ["x", "z", "rotY", "speed", "steer"];
const BALL_KEYS = ["x", "y", "z", "vx", "vy", "vz", "held"];
function carSync(id: number): CarSync {
  let c = world.cars.get(id);
  if (!c) {
    c = { driver: null, state: null };
    world.cars.set(id, c);
  }
  return c;
}
function releaseWorldItems(socketId: string): void {
  for (const [id, car] of world.cars) {
    if (car.driver === socketId) {
      car.driver = null;
      io.emit("world:car:driver", { id, driver: null });
    }
  }
  for (const key of ["soccer", "basket"] as const) {
    const b = world.balls[key];
    if (b.owner === socketId) {
      b.owner = null;
      io.emit("world:ball:owner", { ball: key, owner: null });
    }
  }
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


  // 5) Presence (see other players in the same zone)
  socket.on("presence:join", (data: { profile?: unknown; zone?: unknown }) => {
    const p: Presence = {
      zone: "",
      profile: cleanProfile(data?.profile),
      x: 0,
      y: 0,
      z: 0,
      rotY: 0,
      seatY: null,
      driving: null,
      hidden: false,
      lastTs: 0,
    };
    presence.set(socket.id, p);
    enterZone(socket, p, cleanZone(data?.zone));
  });

  socket.on("presence:profile", (data: { profile?: unknown }) => {
    const p = presence.get(socket.id);
    if (!p) return;
    p.profile = cleanProfile(data?.profile);
    socket.to(zoneRoom(p.zone)).emit("presence:update", { ...publicState(socket.id, p), profile: p.profile });
  });

  socket.on(
    "presence:state",
    (d: { zone?: unknown; x?: unknown; y?: unknown; z?: unknown; rotY?: unknown; seatY?: unknown; driving?: unknown; hidden?: unknown }) => {
      const p = presence.get(socket.id);
      if (!p) return;
      const now = Date.now();
      if (now - p.lastTs < 30) return; // at most ~30 updates a second per player
      p.lastTs = now;
      p.x = num(d?.x, -2000, 2000);
      p.y = num(d?.y, -20, 50);
      p.z = num(d?.z, -2000, 2000);
      p.rotY = num(d?.rotY, -10, 10);
      p.seatY = typeof d?.seatY === "number" && Number.isFinite(d.seatY) ? num(d.seatY, 0, 5) : null;
      p.driving = carId(d?.driving);
      p.hidden = d?.hidden === true;
      const zone = cleanZone(d?.zone);
      if (zone !== p.zone) {
        enterZone(socket, p, zone);
      } else {
        socket.to(zoneRoom(zone)).emit("presence:update", publicState(socket.id, p));
      }
    }
  );


  // 6) Shared world
  const sendWorldSnapshot = (): void => {
    socket.emit("world:snapshot", {
      gate: world.gate,
      vehicleGate: world.vehicleGate,
      elevatorLevel: world.elevator.level,
      cars: Array.from(world.cars, ([id, c]) => ({ id, driver: c.driver, state: c.state })),
      balls: { soccer: world.balls.soccer, basket: world.balls.basket },
    });
  };
  sendWorldSnapshot();
  // the game scene asks again once it is ready to listen (it starts after the connection is made)
  socket.on("world:sync", sendWorldSnapshot);

  socket.on("world:gate", (open: unknown) => {
    world.gate = open === true;
    socket.broadcast.emit("world:gate", world.gate);
  });

  socket.on("world:vgate", (open: unknown) => {
    world.vehicleGate = open === true;
    socket.broadcast.emit("world:vgate", world.vehicleGate);
  });

  socket.on("world:elevator:request", (d: { dest?: unknown; call?: unknown }) => {
    const dest = d?.dest === 1 ? 1 : 0;
    const now = Date.now();
    if (now < world.elevator.busyUntil || dest === world.elevator.level) {
      socket.emit("world:elevator:denied");
      return;
    }
    const call = d?.call === true;
    world.elevator.level = dest;
    // closing doors + the trip + opening doors (a little extra margin)
    world.elevator.busyUntil = now + ((call ? ELEVATOR_CALL_TIME : ELEVATOR_RIDE_TIME) + 2.6) * 1000;
    io.emit("world:elevator:go", { dest, call });
  });

  socket.on("world:car:claim", (d: { id?: unknown }) => {
    const id = carId(d?.id);
    if (id === null) return;
    const car = carSync(id);
    if (car.driver && car.driver !== socket.id) {
      socket.emit("world:car:denied", { id });
      return;
    }
    car.driver = socket.id;
    io.emit("world:car:driver", { id, driver: socket.id });
  });

  socket.on("world:car:state", (d: { id?: unknown } & Record<string, unknown>) => {
    const id = carId(d?.id);
    if (id === null) return;
    const car = carSync(id);
    if (car.driver !== socket.id) return;
    const st = cleanVec(d, CAR_KEYS);
    if (!st) return;
    car.state = st;
    socket.broadcast.emit("world:car:state", { id, ...st });
  });

  socket.on("world:car:release", (d: { id?: unknown } & Record<string, unknown>) => {
    const id = carId(d?.id);
    if (id === null) return;
    const car = carSync(id);
    if (car.driver !== socket.id) return;
    const st = cleanVec(d, CAR_KEYS);
    if (st) {
      car.state = st;
      socket.broadcast.emit("world:car:state", { id, ...st });
    }
    car.driver = null;
    io.emit("world:car:driver", { id, driver: null });
  });

  socket.on("world:cars:reset", () => {
    for (const [id, car] of world.cars) {
      if (!car.driver) world.cars.set(id, { driver: null, state: null });
    }
    socket.broadcast.emit("world:cars:reset");
  });

  socket.on("world:ball:claim", (d: { ball?: unknown }) => {
    const key = ballKey(d?.ball);
    if (!key) return;
    world.balls[key].owner = socket.id;
    io.emit("world:ball:owner", { ball: key, owner: socket.id });
  });

  socket.on("world:ball:state", (d: { ball?: unknown } & Record<string, unknown>) => {
    const key = ballKey(d?.ball);
    if (!key) return;
    const b = world.balls[key];
    if (b.owner !== socket.id) return;
    const st = cleanVec(d, BALL_KEYS);
    if (!st) return;
    b.state = st;
    socket.broadcast.emit("world:ball:state", { ball: key, ...st });
  });

  socket.on("world:balls:reset", () => {
    for (const key of ["soccer", "basket"] as const) world.balls[key] = { owner: null, state: null };
    socket.broadcast.emit("world:balls:reset");
  });

  socket.on("world:event", (d: { type?: unknown; text?: unknown }) => {
    if ((d?.type !== "goal" && d?.type !== "bucket") || typeof d.text !== "string") return;
    socket.broadcast.emit("world:event", { type: d.type, text: d.text.slice(0, 60) });
  });

  socket.on("disconnect", () => {
    console.log(`[server] player disconnected (${socket.id})`);
    releaseWorldItems(socket.id);
    const gone = presence.get(socket.id);
    if (gone) {
      socket.to(zoneRoom(gone.zone)).emit("presence:left", socket.id);
      presence.delete(socket.id);
    }
    players.delete(socket.id);
    broadcastOnlineUsers();
    broadcastStats();
  });
});

httpServer.listen(PORT, () => {
  console.log(`[server] ELD PD Game server running at http://localhost:${PORT}`);
  console.log("[server] During development, open http://localhost:5173 instead.");
});
