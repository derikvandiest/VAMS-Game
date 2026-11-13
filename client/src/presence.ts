/**
 * Multiplayer presence: other players are visible, and move around, in the same place as you (the outdoor campus,
 * the MPR, or inside the same classroom). The server only sends you the players in your current zone.
 *
 * The local player's position is sent about 15 times a second; remote players are drawn as normal characters
 * (their own look and name tag) that glide between the updates and walk, stand or sit like anyone else.
 */
import * as THREE from "three";
import type { Socket } from "socket.io-client";
import { createAvatarRig, animateAvatar, GAME_AVATAR_SCALE, AvatarRig } from "./avatar";
import { sanitizeProfile, loadCharacterProfile, onProfileChange } from "./profile";
import { getSocket, isMultiplayerActive } from "./net";

export interface LocalPresence {
  zone: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  /** Height of the seat while sitting, otherwise null */
  seatY: number | null;
  /** Not drawn for others (for example while driving a car) */
  hidden: boolean;
}

interface Remote {
  id: string;
  rig: AvatarRig;
  pos: THREE.Vector3;
  target: THREE.Vector3;
  rotY: number;
  targetRotY: number;
  seatY: number | null;
  lastSeen: number;
  clock: number;
  speed: number;
}

interface WireState {
  id: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  seatY: number | null;
  hidden: boolean;
  profile?: Record<string, unknown>;
}

const SEND_INTERVAL = 0.066; // seconds between position updates
const STALE_AFTER = 8; // drop a remote player we have not heard from for this long (seconds)

export interface Presence {
  update(dt: number, local: LocalPresence): void;
  dispose(): void;
}

/** Starts presence for this scene, or returns null when not playing on the multiplayer server. */
export function startPresence(scene: THREE.Scene): Presence | null {
  if (!isMultiplayerActive()) return null;
  const socket: Socket = getSocket();

  const remotes = new Map<string, Remote>();
  let zone = "";
  let sendTimer = 0;
  let joined = false;
  let last: LocalPresence | null = null;

  const clearRemotes = (): void => {
    for (const r of remotes.values()) scene.remove(r.rig.player);
    remotes.clear();
  };

  function upsert(w: WireState): void {
    if (w.hidden) {
      const gone = remotes.get(w.id);
      if (gone) {
        scene.remove(gone.rig.player);
        remotes.delete(w.id);
      }
      return;
    }
    let r = remotes.get(w.id);
    if (!r) {
      if (!w.profile) return; // appearance not known yet (it arrives with the next update)
      const rig = createAvatarRig({ nameTag: true, scale: GAME_AVATAR_SCALE });
      rig.apply(sanitizeProfile(w.profile));
      const pos = new THREE.Vector3(w.x, w.y, w.z);
      rig.player.position.copy(pos);
      rig.player.rotation.y = w.rotY;
      scene.add(rig.player);
      r = { id: w.id, rig, pos, target: pos.clone(), rotY: w.rotY, targetRotY: w.rotY, seatY: w.seatY, lastSeen: 0, clock: Math.random() * 10, speed: 0 };
      remotes.set(w.id, r);
    } else if (w.profile) {
      r.rig.apply(sanitizeProfile(w.profile)); // they changed their look
    }
    r.target.set(w.x, w.y, w.z);
    r.targetRotY = w.rotY;
    r.seatY = w.seatY;
    r.lastSeen = 0;
  }

  const onSnapshot = (list: WireState[]): void => {
    clearRemotes();
    for (const w of list) upsert(w);
  };
  const onUpdate = (w: WireState): void => upsert(w);
  const onLeft = (id: string): void => {
    const r = remotes.get(id);
    if (r) {
      scene.remove(r.rig.player);
      remotes.delete(id);
    }
  };
  socket.on("presence:snapshot", onSnapshot);
  socket.on("presence:update", onUpdate);
  socket.on("presence:left", onLeft);

  const sendJoin = (l: LocalPresence): void => {
    socket.emit("presence:join", { profile: loadCharacterProfile(), zone: l.zone });
    zone = l.zone;
    joined = true;
  };
  // (re)join after a connection loss
  const onConnect = (): void => {
    joined = false;
    clearRemotes();
  };
  socket.on("connect", onConnect);
  const offProfile = onProfileChange((p) => {
    if (joined) socket.emit("presence:profile", { profile: p });
  });

  const sendState = (l: LocalPresence): void => {
    socket.emit("presence:state", { zone: l.zone, x: l.x, y: l.y, z: l.z, rotY: l.rotY, seatY: l.seatY, hidden: l.hidden });
  };

  return {
    update(dt: number, local: LocalPresence): void {
      last = local;
      // --- send ---
      if (socket.connected) {
        if (!joined) {
          sendJoin(local);
        } else if (local.zone !== zone) {
          // moved to another place: forget everyone here, the server sends the new place's players
          clearRemotes();
          zone = local.zone;
          sendState(local);
          sendTimer = 0;
        } else {
          sendTimer += dt;
          if (sendTimer >= SEND_INTERVAL) {
            sendTimer = 0;
            sendState(local);
          }
        }
      }
      // --- draw the others ---
      const k = 1 - Math.exp(-dt * 12);
      for (const r of remotes.values()) {
        r.lastSeen += dt;
        if (r.lastSeen > STALE_AFTER) {
          scene.remove(r.rig.player);
          remotes.delete(r.id);
          continue;
        }
        const before = r.pos.clone();
        r.pos.lerp(r.target, k);
        const speed = r.pos.distanceTo(before) / Math.max(dt, 1e-4);
        r.speed += (speed - r.speed) * Math.min(1, dt * 8);
        let dr = r.targetRotY - r.rotY;
        dr = Math.atan2(Math.sin(dr), Math.cos(dr));
        r.rotY += dr * Math.min(1, dt * 12);
        r.rig.player.position.copy(r.pos);
        r.rig.player.rotation.y = r.rotY;
        r.clock += dt;
        const seated = r.seatY !== null;
        if (seated) {
          animateAvatar(r.rig, r.clock, 0, { seated: true });
          r.rig.bodyGroup.position.y = r.rig.seatDrop ? r.rig.seatDrop(r.seatY as number) : 0;
          r.rig.setLocomotion?.(0);
        } else {
          animateAvatar(r.rig, r.clock, Math.min(1, r.speed / 3));
          r.rig.setLocomotion?.(r.speed > 0.15 ? r.speed : 0);
          r.rig.bodyGroup.position.y = 0;
        }
        r.rig.syncSkeleton?.();
      }
    },
    dispose(): void {
      socket.off("presence:snapshot", onSnapshot);
      socket.off("presence:update", onUpdate);
      socket.off("presence:left", onLeft);
      socket.off("connect", onConnect);
      offProfile?.();
      clearRemotes();
      void last;
    },
  };
}
