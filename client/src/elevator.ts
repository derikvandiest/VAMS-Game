/**
 * Campus elevator: a square tower, clad like the school (cream walls, red trim, a flat roof like the
 * classroom roofs), with a box-shaped cab that travels between the ground floor (in front of the Learning
 * Center) and the upper walkway (in front of the Theater). The doors face the building (north). The call
 * buttons are on the wall to the west (left) of the door. Press E outside to call the cab, E inside to go
 * up or down.
 */
import * as THREE from "three";

export interface ElevatorConfig {
  /** Centre of the shaft along x */
  x: number;
  /** z of the door plane (the front face of the tower) */
  zFront: number;
  /** Height of the upper floor above the ground */
  floorHeight: number;
  /** Outer width/depth of the tower (square) */
  size?: number;
  /** z where the upper walkway deck ends (the elevator pad bridges from here to the door) */
  deckEdgeZ: number;
  /** Exterior wall color (same as the school walls) */
  wallColor?: number;
  /** Trim color (same as the school's red posts and railings) */
  trimColor?: number;
}

export interface ElevatorSolid {
  x: number;
  z: number;
  w: number;
  d: number;
  yBase: number;
  yTop: number;
}

type Phase = "idle" | "closing" | "moving" | "opening";
/** W/E/S = west/east/south walls, N = the door face, T = roof and cab ceiling */
type Side = "W" | "E" | "S" | "N" | "T";
const SIDES: Side[] = ["W", "E", "S", "N", "T"];

const DOOR_W = 1.7; // clear opening
const DOOR_H = 2.5;
const TRAVEL_TIME = 3.2; // seconds between floors
const DOOR_SPEED = 1.5; // door travel per second (0..1)
// Easter egg: the elevator is slow to arrive when you call it (like the one at school). The trip takes this
// long, with a pause halfway ("it stopped!") before it carries on.
const CALL_TIME = 14;
const CALL_PHASES = { moveA: 5, stall: 3.5 }; // seconds: first leg, then the pause (the rest is the second leg)

export class Elevator {
  readonly group = new THREE.Group();
  readonly cfg: Required<ElevatorConfig>;
  /** Current height of the cab floor */
  cabY = 0;
  /** The floor the cab is at (or leaving) */
  level: 0 | 1 = 0;
  phase: Phase = "idle";
  /** True while a passenger is being carried (input is locked) */
  riding = false;
  private dest: 0 | 1 = 0;
  private from = 0;
  private progress = 0;
  private doorOpen = 0;
  private doorTarget = 0;
  /** true while the cab is on its way to a caller (the slow trip), false when carrying a passenger */
  private isCall = false;
  private callT = 0;
  private indicators: Array<{ level: 0 | 1; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture }> = [];
  private indicatorKey = "";
  private lamps: THREE.Mesh[] = [];
  private cab = new THREE.Group();
  private cabDoors: THREE.Mesh[] = [];
  private shaftDoors: Array<{ level: 0 | 1; panels: THREE.Mesh[] }> = [];
  readonly cx: number;
  readonly cz: number;
  readonly half: number;
  /**
   * Parts of the tower and cab by side. While a passenger is inside, the side facing the camera (and the roof)
   * is cut away, like the classroom cutaway, so the passenger is always visible and the inside is clean.
   */
  private parts: Record<Side, THREE.Mesh[]> = { W: [], E: [], S: [], N: [], T: [] };
  private partVis: Record<Side, number> = { W: 1, E: 1, S: 1, N: 1, T: 1 };

  constructor(scene: THREE.Scene, cfg: ElevatorConfig) {
    this.cfg = { size: 3.2, wallColor: 0xe8e0d2, trimColor: 0x7a2f2f, ...cfg };
    this.half = this.cfg.size / 2;
    this.cx = cfg.x;
    this.cz = cfg.zFront + this.half;
    this.build();
    scene.add(this.group);
  }

  /** Tower height: the same as the second-story walls of the school buildings */
  private get towerHeight(): number {
    return this.cfg.floorHeight + 4;
  }

  // ------------------------------------------------------------------ geometry
  private build(): void {
    const { floorHeight: F, size: S, zFront } = this.cfg;
    const H = this.towerHeight;
    const g = this.group;
    const cx = this.cx;
    const cz = this.cz;
    const h = S / 2;

    // Exterior: the school's cream walls and red trim
    const wallMat = new THREE.MeshStandardMaterial({ color: this.cfg.wallColor, roughness: 0.9 });
    const trimMat = new THREE.MeshStandardMaterial({ color: this.cfg.trimColor, roughness: 0.7, metalness: 0.2 });
    const plinthMat = new THREE.MeshStandardMaterial({ color: 0x5e2222, roughness: 0.6, metalness: 0.2 });
    // Roof: the same as the classroom roofs (cool-roof membrane, metal coping, a rooftop HVAC unit)
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xbac2ca, roughness: 0.95 });
    const copingMat = new THREE.MeshStandardMaterial({ color: 0x8a929a, roughness: 0.5, metalness: 0.25 });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x3e454d, roughness: 0.9 });
    const hvacMat = new THREE.MeshStandardMaterial({ color: 0x98a0a8, roughness: 0.45, metalness: 0.35 });
    const grilleMat = new THREE.MeshStandardMaterial({ color: 0x2e353c, roughness: 0.8 });
    // Inside the cab: plain light panels and a neutral floor (no red, no glass)
    const cabWall = new THREE.MeshStandardMaterial({ color: 0xdfe1e4, roughness: 0.6, metalness: 0.15 });
    const cabFloor = new THREE.MeshStandardMaterial({ color: 0x555a62, roughness: 0.7 });
    const cabCeiling = new THREE.MeshStandardMaterial({ color: 0xcfd2d6, roughness: 0.6 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.3, metalness: 0.85 });

    const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, side?: Side, shadow = true): THREE.Mesh => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = shadow;
      m.receiveShadow = true;
      parent.add(m);
      if (side) this.parts[side].push(m);
      return m;
    };

    // base plinth
    add(g, new THREE.BoxGeometry(S + 0.2, 0.12, S + 0.2), plinthMat, cx, 0.06, cz);

    // four corner posts (red); each belongs to the two walls it joins
    const postSide: Record<string, [Side, Side]> = { "-1,-1": ["W", "N"], "1,-1": ["E", "N"], "-1,1": ["W", "S"], "1,1": ["E", "S"] };
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const m = add(g, new THREE.BoxGeometry(0.2, H, 0.2), trimMat.clone(), cx + sx * (h - 0.1), H / 2, cz + sz * (h - 0.1));
        m.userData.sides = postSide[`${sx},${sz}`];
      }
    }
    // solid school-colored walls: west, east and back (south)
    add(g, new THREE.BoxGeometry(0.2, H, S - 0.2), wallMat, cx - h + 0.1, H / 2, cz, "W");
    add(g, new THREE.BoxGeometry(0.2, H, S - 0.2), wallMat, cx + h - 0.1, H / 2, cz, "E");
    add(g, new THREE.BoxGeometry(S - 0.2, H, 0.2), wallMat, cx, H / 2, cz + h - 0.1, "S");
    // red bands at the floor lines (outside trim)
    for (const y of [0.18, F - 0.05]) {
      add(g, new THREE.BoxGeometry(S, 0.1, 0.12), trimMat, cx, y, cz + h - 0.06, "S");
      add(g, new THREE.BoxGeometry(0.12, 0.1, S), trimMat, cx - h + 0.06, y, cz, "W");
      add(g, new THREE.BoxGeometry(0.12, 0.1, S), trimMat, cx + h - 0.06, y, cz, "E");
      add(g, new THREE.BoxGeometry(S, 0.1, 0.12), trimMat, cx, y, cz - h + 0.06, "N");
    }

    // north (door) face: wall strips either side of the opening and headers above each door
    const strip = (S - DOOR_W) / 2;
    const zN = zFront + 0.06;
    for (const sx of [-1, 1]) add(g, new THREE.BoxGeometry(strip, H, 0.12), wallMat, cx + sx * (DOOR_W / 2 + strip / 2), H / 2, zN, "N");
    add(g, new THREE.BoxGeometry(DOOR_W, F - DOOR_H - 0.1, 0.12), wallMat, cx, (DOOR_H + F - 0.1) / 2 + 0.05, zN, "N"); // above the ground door
    add(g, new THREE.BoxGeometry(DOOR_W, H - (F + DOOR_H), 0.12), wallMat, cx, (F + DOOR_H + H) / 2, zN, "N"); // above the upper door

    // call buttons: an up / down plate on the wall to the WEST (left) of each door
    const plate = (() => {
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 128;
      const g2 = c.getContext("2d")!;
      g2.fillStyle = "#14181f";
      g2.fillRect(0, 0, 64, 128);
      g2.fillStyle = "#facc15";
      g2.beginPath();
      g2.moveTo(32, 14);
      g2.lineTo(50, 50);
      g2.lineTo(14, 50);
      g2.fill();
      g2.beginPath();
      g2.moveTo(32, 114);
      g2.lineTo(50, 78);
      g2.lineTo(14, 78);
      g2.fill();
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    for (const y of [1.25, F + 1.25]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.44), new THREE.MeshBasicMaterial({ map: plate }));
      m.position.set(cx - DOOR_W / 2 - 0.2, y, zFront - 0.002);
      m.rotation.y = Math.PI;
      g.add(m);
      this.parts.N.push(m);
    }

    // floor indicator above each door (shows where the cab is, and an arrow while it is travelling)
    for (const level of [0, 1] as const) {
      const c = document.createElement("canvas");
      c.width = 128;
      c.height = 64;
      const ctx = c.getContext("2d")!;
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ map: tex }));
      m.position.set(cx, (level === 1 ? F : 0) + DOOR_H + 0.24, zFront - 0.004);
      m.rotation.y = Math.PI;
      g.add(m);
      this.parts.N.push(m);
      this.indicators.push({ level, ctx, tex });
    }
    this.drawIndicators("1", "");
    // a lamp above each call-button plate: lit while the elevator has been called
    for (const y of [1.25 + 0.4, F + 1.25 + 0.4]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.03), new THREE.MeshStandardMaterial({ color: 0x4a3b10, emissive: 0x000000 }));
      lamp.position.set(cx - DOOR_W / 2 - 0.2, y, zFront - 0.01);
      g.add(lamp);
      this.parts.N.push(lamp);
      this.lamps.push(lamp);
    }

    // shaft doors (one pair per floor)
    for (const level of [0, 1] as const) {
      const y = (level === 1 ? F : 0) + DOOR_H / 2 + 0.02;
      const panels: THREE.Mesh[] = [];
      for (const sx of [-1, 1]) {
        const m = add(g, new THREE.BoxGeometry(DOOR_W / 2, DOOR_H, 0.07), doorMat, cx + sx * (DOOR_W / 4), y, zFront + 0.06, "N");
        m.userData.sx = sx;
        m.userData.baseX = m.position.x;
        panels.push(m);
      }
      this.shaftDoors.push({ level, panels });
    }

    // landing pad bridging the walkway deck to the upper door
    const padDepth = zFront - this.cfg.deckEdgeZ;
    if (padDepth > 0.02) {
      add(g, new THREE.BoxGeometry(DOOR_W + 0.5, 0.3, padDepth + 0.05), new THREE.MeshStandardMaterial({ color: 0x7a6a58, roughness: 0.8 }), cx, F - 0.15, this.cfg.deckEdgeZ + padDepth / 2);
    }

    // ---- roof, like the classroom roofs: flat membrane, metal coping, an HVAC unit ----
    const roof = new THREE.Group();
    const R = S + 0.3;
    add(roof, new THREE.BoxGeometry(R, 0.16, R), roofMat, cx, H + 0.08, cz, "T");
    const cope = 0.18;
    const ch = 0.16;
    add(roof, new THREE.BoxGeometry(R, ch, cope), copingMat, cx, H + 0.16 + ch / 2 - 0.04, cz - R / 2 + cope / 2, "T");
    add(roof, new THREE.BoxGeometry(R, ch, cope), copingMat, cx, H + 0.16 + ch / 2 - 0.04, cz + R / 2 - cope / 2, "T");
    add(roof, new THREE.BoxGeometry(cope, ch, R - 2 * cope), copingMat, cx - R / 2 + cope / 2, H + 0.16 + ch / 2 - 0.04, cz, "T");
    add(roof, new THREE.BoxGeometry(cope, ch, R - 2 * cope), copingMat, cx + R / 2 - cope / 2, H + 0.16 + ch / 2 - 0.04, cz, "T");
    const hx = cx + 0.45;
    const hz = cz + 0.5;
    add(roof, new THREE.BoxGeometry(1.5, 0.12, 1.1), curbMat, hx, H + 0.22, hz, "T");
    add(roof, new THREE.BoxGeometry(1.35, 0.6, 0.95), hvacMat, hx, H + 0.58, hz, "T");
    add(roof, new THREE.BoxGeometry(0.62, 0.05, 0.62), grilleMat, hx, H + 0.9, hz, "T");
    g.add(roof);

    // ---- cab (moves up and down inside the tower) ----
    const CS = S - 0.5; // cab outer size
    const CH = 2.75;
    const cabHalf = CS / 2;
    const cab = this.cab;
    cab.position.set(cx, 0, cz);
    add(cab, new THREE.BoxGeometry(CS, 0.14, CS), cabFloor, 0, 0.07, 0); // floor (always visible)
    add(cab, new THREE.BoxGeometry(CS, 0.12, CS), cabCeiling, 0, CH + 0.06, 0, "T"); // ceiling
    add(cab, new THREE.BoxGeometry(CS, CH, 0.1), cabWall, 0, CH / 2, cabHalf - 0.05, "S"); // back
    add(cab, new THREE.BoxGeometry(0.1, CH, CS), cabWall, -cabHalf + 0.05, CH / 2, 0, "W");
    add(cab, new THREE.BoxGeometry(0.1, CH, CS), cabWall, cabHalf - 0.05, CH / 2, 0, "E");
    // front of the cab: strips beside the opening and a lintel
    const cStrip = (CS - DOOR_W) / 2;
    for (const sx of [-1, 1]) add(cab, new THREE.BoxGeometry(cStrip, CH, 0.1), cabWall, sx * (DOOR_W / 2 + cStrip / 2), CH / 2, -cabHalf + 0.05, "N");
    add(cab, new THREE.BoxGeometry(DOOR_W, CH - DOOR_H - 0.02, 0.1), cabWall, 0, (DOOR_H + 0.02 + CH) / 2, -cabHalf + 0.05, "N");
    for (const sx of [-1, 1]) {
      const m = add(cab, new THREE.BoxGeometry(DOOR_W / 2, DOOR_H, 0.06), doorMat, sx * (DOOR_W / 4), DOOR_H / 2 + 0.14, -cabHalf + 0.05, "N");
      m.userData.sx = sx;
      m.userData.baseX = m.position.x;
      this.cabDoors.push(m);
    }
    // inside switch: on the same wall and side as the outside one (the front wall, west/left of the door)
    const insidePlate = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.44), new THREE.MeshBasicMaterial({ map: plate }));
    insidePlate.position.set(-(DOOR_W / 2 + cStrip / 2), 1.25, -cabHalf + 0.115);
    cab.add(insidePlate); // faces +z, into the cab
    this.parts.N.push(insidePlate);
    const insideLamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.03), new THREE.MeshStandardMaterial({ color: 0x4a3b10, emissive: 0x000000 }));
    insideLamp.position.set(-(DOOR_W / 2 + cStrip / 2), 1.65, -cabHalf + 0.12);
    cab.add(insideLamp);
    this.parts.N.push(insideLamp);
    this.lamps.push(insideLamp);

    // ceiling light
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff0b8, emissiveIntensity: 1.4 });
    add(cab, new THREE.BoxGeometry(CS * 0.5, 0.04, CS * 0.5), lampMat, 0, CH - 0.03, 0, "T", false);
    const cabLight = new THREE.PointLight(0xfff0c8, 0.9, 5, 2);
    cabLight.position.set(0, CH - 0.4, 0);
    cab.add(cabLight);
    g.add(cab);

    // every part gets its own material copy so a cut-away wall never changes another
    for (const side of SIDES) {
      for (const m of this.parts[side]) m.material = (m.material as THREE.Material).clone();
    }
  }

  private drawIndicators(floor: string, arrow: string): void {
    for (const ind of this.indicators) {
      const c = ind.ctx;
      c.fillStyle = "#07090d";
      c.fillRect(0, 0, 128, 64);
      c.strokeStyle = "#3a3f4a";
      c.lineWidth = 4;
      c.strokeRect(2, 2, 124, 60);
      c.fillStyle = "#ffb020";
      c.font = "800 44px ui-monospace, Consolas, monospace";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(`${arrow}${floor}`.trim() || "-", 64, 34);
      ind.tex.needsUpdate = true;
    }
  }

  /** Where the slow trip to a caller is, 0..1 (first leg, a pause halfway, second leg) */
  private callProgress(t: number): number {
    const a = CALL_PHASES.moveA;
    const s = CALL_PHASES.stall;
    const smooth = (x: number): number => x * x * (3 - 2 * x);
    if (t < a) return 0.5 * smooth(t / a);
    if (t < a + s) return 0.5;
    return 0.5 + 0.5 * smooth(Math.min(1, (t - a - s) / (CALL_TIME - a - s)));
  }

  /** The lines the player reads while waiting for the elevator */
  private waitingMessage(): string {
    const t = this.callT;
    const a = CALL_PHASES.moveA;
    const s = CALL_PHASES.stall;
    if (this.phase === "closing" || t < 1.5) return "Calling the elevator… 🛗";
    if (t < a) return "The elevator is on its way… 🛗";
    if (t < a + s) return "Hmm… it seems to have stopped. Any second now… ⏳";
    if (t < a + s + 2.5) return "…and it's moving again! 🛗";
    return "Almost there… 🛗";
  }

  // ------------------------------------------------------------------ collision
  /** Walls of the tower plus the doorways (closed doors block). */
  solids(): ElevatorSolid[] {
    const { size: S, zFront, floorHeight: F } = this.cfg;
    const H = this.towerHeight;
    const out: ElevatorSolid[] = [];
    const t = 0.2;
    out.push({ x: this.cx - this.half + t / 2, z: this.cz, w: t, d: S, yBase: 0, yTop: H }); // west
    out.push({ x: this.cx + this.half - t / 2, z: this.cz, w: t, d: S, yBase: 0, yTop: H }); // east
    out.push({ x: this.cx, z: zFront + S - t / 2, w: S, d: t, yBase: 0, yTop: H }); // back
    const strip = (S - DOOR_W) / 2;
    for (const sx of [-1, 1]) out.push({ x: this.cx + sx * (DOOR_W / 2 + strip / 2), z: zFront + t / 2, w: strip, d: t, yBase: 0, yTop: H }); // front strips
    // each doorway is blocked unless the cab is at that floor with the doors open
    for (const level of [0, 1] as const) {
      const open = this.phase !== "moving" && this.level === level && this.doorOpen > 0.6;
      if (!open) {
        out.push({ x: this.cx, z: zFront + t / 2, w: DOOR_W, d: t, yBase: level === 0 ? 0 : F - 0.2, yTop: level === 0 ? F - 0.2 : H });
      }
    }
    return out;
  }

  /** Is (x, z) inside the cab / shaft footprint? */
  inShaft(x: number, z: number): boolean {
    return Math.abs(x - this.cx) < this.half - 0.15 && z > this.cfg.zFront + 0.25 && z < this.cfg.zFront + this.cfg.size - 0.15;
  }

  /** The landing pad between the upper deck and the door (upper floor height). */
  onPad(x: number, z: number): boolean {
    return Math.abs(x - this.cx) < DOOR_W / 2 + 0.25 && z > this.cfg.deckEdgeZ - 0.3 && z < this.cfg.zFront + 0.4;
  }

  /** Rectangle at deck level where the walkway railing must be removed for the door. */
  railCutter(): { minX: number; maxX: number; minZ: number; maxZ: number } {
    return { minX: this.cx - DOOR_W / 2 - 0.3, maxX: this.cx + DOOR_W / 2 + 0.3, minZ: this.cfg.deckEdgeZ - 0.1, maxZ: this.cfg.deckEdgeZ + 0.1 };
  }

  /** Where a standing player should be vertically here (null = not an elevator spot). */
  floorAt(x: number, z: number): number | null {
    if (this.inShaft(x, z)) return this.cabY;
    return null;
  }

  // ------------------------------------------------------------------ interaction
  private playerLevel(y: number): 0 | 1 {
    return y > this.cfg.floorHeight * 0.5 ? 1 : 0;
  }

  private nearDoor(x: number, z: number, y: number, level: 0 | 1): boolean {
    if (this.playerLevel(y) !== level && !this.inShaft(x, z)) return false;
    return Math.hypot(x - this.cx, z - (this.cfg.zFront + 0.6)) < 3.6;
  }

  /** What E would do right now, for the on-screen hint (empty = nothing). */
  hint(x: number, y: number, z: number): string {
    if (this.riding) return "";
    if (this.phase !== "idle") {
      // the cab is on its way to a caller: tell people near the doors how it is going
      return this.isCall && Math.hypot(x - this.cx, z - this.cfg.zFront) < 6 ? this.waitingMessage() : "";
    }
    if (this.inShaft(x, z)) return this.level === 0 ? "Press E to go up to the second floor ▲" : "Press E to go down to the first floor ▼";
    const lvl = this.playerLevel(y);
    if (this.nearDoor(x, z, y, lvl) && Math.hypot(x - this.cx, z - this.cfg.zFront) < 3.0) {
      return this.level !== lvl ? "Press E to call the elevator 🛗" : "";
    }
    return "";
  }

  /** E pressed. Returns true if the elevator handled it. */
  press(x: number, y: number, z: number): boolean {
    if (this.riding || this.phase !== "idle") return false;
    if (this.inShaft(x, z)) {
      this.dest = this.level === 0 ? 1 : 0;
      this.riding = true;
      this.begin();
      return true;
    }
    const lvl = this.playerLevel(y);
    if (this.nearDoor(x, z, y, lvl) && Math.hypot(x - this.cx, z - this.cfg.zFront) < 3.0 && this.level !== lvl) {
      this.dest = lvl; // call: the cab comes to the player
      this.begin();
      return true;
    }
    return false;
  }

  private begin(): void {
    this.isCall = !this.riding;
    this.callT = 0;
    this.phase = "closing";
    this.doorTarget = 0;
  }

  // ------------------------------------------------------------------ cut-away while occupied
  private updateCutaway(dt: number, occupied: boolean, camX: number, camZ: number): void {
    // which wall faces the camera? (only that one, plus the roof, is cut away)
    let hide: Side | null = null;
    if (occupied) {
      const dx = camX - this.cx;
      const dz = camZ - this.cz;
      hide = Math.abs(dx) > Math.abs(dz) ? (dx < 0 ? "W" : "E") : dz < 0 ? "N" : "S";
    }
    for (const side of SIDES) {
      const wantHidden = occupied && (side === "T" || side === hide);
      const target = wantHidden ? 0 : 1;
      const cur = this.partVis[side];
      if (cur === target) continue;
      const next = Math.abs(cur - target) < 0.02 ? target : cur + (target - cur) * Math.min(1, dt * 12);
      this.partVis[side] = next;
    }
    for (const side of SIDES) this.applyVis(side);
    // posts belong to two walls: hidden when either of them is cut away
    for (const m of this.group.children) {
      const sides = (m as THREE.Mesh).userData.sides as [Side, Side] | undefined;
      if (!sides) continue;
      const vis = Math.min(this.partVis[sides[0]], this.partVis[sides[1]]);
      this.setMeshVis(m as THREE.Mesh, vis);
    }
  }

  private setMeshVis(m: THREE.Mesh, vis: number): void {
    const mat = m.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
    if (vis >= 0.99) {
      m.visible = true;
      if (mat.transparent) {
        mat.transparent = false;
        mat.opacity = 1;
        mat.needsUpdate = true;
      }
      return;
    }
    if (vis <= 0.03) {
      m.visible = false;
      return;
    }
    m.visible = true;
    if (!mat.transparent) {
      mat.transparent = true;
      mat.needsUpdate = true;
    }
    mat.opacity = vis;
  }

  private applyVis(side: Side): void {
    const vis = this.partVis[side];
    for (const m of this.parts[side]) this.setMeshVis(m, vis);
  }

  // ------------------------------------------------------------------ per-frame
  update(dt: number, px: number, py: number, pz: number, camX = this.cx, camZ = this.cz - 10): void {
    const inside = this.inShaft(px, pz);
    this.updateCutaway(dt, inside || this.riding, camX, camZ);
    switch (this.phase) {
      case "idle": {
        const wantOpen = inside || this.nearDoor(px, pz, py, this.level);
        this.doorTarget = wantOpen ? 1 : 0;
        break;
      }
      case "closing":
        this.doorTarget = 0;
        if (this.doorOpen <= 0.02) {
          if (this.dest === this.level) {
            this.phase = "opening";
          } else {
            this.phase = "moving";
            this.from = this.cabY;
            this.progress = 0;
          }
        }
        break;
      case "moving": {
        let e: number;
        let p: number;
        if (this.isCall) {
          // the slow trip to a caller
          this.callT += dt;
          e = this.callProgress(this.callT);
          p = this.callT >= CALL_TIME ? 1 : 0;
        } else {
          this.progress = Math.min(1, this.progress + dt / TRAVEL_TIME);
          p = this.progress;
          e = p * p * (3 - 2 * p); // smooth start and stop
        }
        const to = this.dest === 1 ? this.cfg.floorHeight : 0;
        this.cabY = this.from + (to - this.from) * e;
        if (p >= 1) {
          this.isCall = false;
          this.level = this.dest;
          this.cabY = to;
          this.phase = "opening";
        }
        break;
      }
      case "opening":
        this.doorTarget = 1;
        if (this.doorOpen >= 0.98) {
          this.phase = "idle";
          this.riding = false;
        }
        break;
    }
    // floor indicator and call lamp
    const floorNum = this.cabY < this.cfg.floorHeight / 2 ? "1" : "2";
    const stalled = this.phase === "moving" && this.isCall && this.callT >= CALL_PHASES.moveA && this.callT < CALL_PHASES.moveA + CALL_PHASES.stall;
    const arrow = this.phase === "moving" ? (this.dest === 1 ? "▲" : "▼") : "";
    const blink = stalled && Math.floor(performance.now() / 450) % 2 === 0;
    const key = `${floorNum}|${arrow}|${blink}`;
    if (key !== this.indicatorKey) {
      this.indicatorKey = key;
      this.drawIndicators(blink ? "--" : floorNum, blink ? "" : arrow);
    }
    const called = (this.isCall || this.riding) && this.phase !== "idle";
    for (const lamp of this.lamps) {
      const m = lamp.material as THREE.MeshStandardMaterial;
      m.emissive.setHex(called ? 0xffb020 : 0x000000);
      m.emissiveIntensity = called ? 1.6 : 0;
      m.color.setHex(called ? 0xffd34d : 0x4a3b10);
    }
    const step = DOOR_SPEED * dt;
    this.doorOpen += Math.max(-step, Math.min(step, this.doorTarget - this.doorOpen));
    this.cab.position.y = this.cabY;

    // door panels slide apart into the side strips
    const slide = this.doorOpen * (DOOR_W / 2 - 0.02);
    for (const m of this.cabDoors) m.position.x = (m.userData.baseX as number) + (m.userData.sx as number) * slide;
    for (const d of this.shaftDoors) {
      const open = this.phase !== "moving" && this.level === d.level ? this.doorOpen : 0;
      const s = open * (DOOR_W / 2 - 0.02);
      for (const m of d.panels) m.position.x = (m.userData.baseX as number) + (m.userData.sx as number) * s;
    }
  }
}
