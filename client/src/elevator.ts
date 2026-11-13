/**
 * Campus elevator: a square glass-and-steel tower with a box-shaped cab that travels between the ground floor
 * (in front of the Learning Center) and the upper walkway (in front of the Theater). The doors face the
 * building (north). Press E outside to call the cab, and E inside to go up or down.
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

const DOOR_W = 1.7; // clear opening
const DOOR_H = 2.5;
const TRAVEL_TIME = 3.2; // seconds between floors
const DOOR_SPEED = 1.5; // door travel per second (0..1)

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
  private cab = new THREE.Group();
  private cabDoors: THREE.Mesh[] = [];
  private shaftDoors: Array<{ level: 0 | 1; panels: THREE.Mesh[] }> = [];
  private lamp: THREE.Mesh | null = null;
  readonly cx: number;
  readonly cz: number;
  readonly half: number;

  constructor(scene: THREE.Scene, cfg: ElevatorConfig) {
    this.cfg = { size: 3.2, ...cfg };
    this.half = this.cfg.size / 2;
    this.cx = cfg.x;
    this.cz = cfg.zFront + this.half;
    this.build();
    scene.add(this.group);
  }

  // ------------------------------------------------------------------ geometry
  private build(): void {
    const { floorHeight: F, size: S, zFront } = this.cfg;
    const H = F + 3.7; // tower height: the upper door plus a header and a roof
    const g = this.group;
    const steel = new THREE.MeshStandardMaterial({ color: 0x59606b, roughness: 0.45, metalness: 0.7 });
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.5, metalness: 0.6 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fd3e8, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.3, depthWrite: false });
    const brushed = new THREE.MeshStandardMaterial({ color: 0xaeb4bd, roughness: 0.35, metalness: 0.8 });
    const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, shadow = true): THREE.Mesh => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = shadow;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    const cx = this.cx;
    const cz = this.cz;
    const h = S / 2;

    // base plinth and roof cap
    add(g, new THREE.BoxGeometry(S + 0.2, 0.12, S + 0.2), darkSteel, cx, 0.06, cz);
    add(g, new THREE.BoxGeometry(S + 0.3, 0.3, S + 0.3), darkSteel, cx, H + 0.15, cz);
    add(g, new THREE.BoxGeometry(S * 0.5, 0.35, S * 0.5), steel, cx, H + 0.47, cz); // machine housing on the roof

    // four corner posts
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) add(g, new THREE.BoxGeometry(0.2, H, 0.2), steel, cx + sx * (h - 0.1), H / 2, cz + sz * (h - 0.1));
    }
    // glass: west, east and back (south) walls
    add(g, new THREE.BoxGeometry(0.05, H - 0.2, S - 0.4), glass, cx - h + 0.1, H / 2, cz, false);
    add(g, new THREE.BoxGeometry(0.05, H - 0.2, S - 0.4), glass, cx + h - 0.1, H / 2, cz, false);
    add(g, new THREE.BoxGeometry(S - 0.4, H - 0.2, 0.05), glass, cx, H / 2, cz + h - 0.1, false);
    // horizontal frame bands at the floor lines and the top
    for (const y of [0.18, F - 0.05, H - 0.05]) {
      add(g, new THREE.BoxGeometry(S, 0.1, 0.12), steel, cx, y, cz - h + 0.06);
      add(g, new THREE.BoxGeometry(S, 0.1, 0.12), steel, cx, y, cz + h - 0.06);
      add(g, new THREE.BoxGeometry(0.12, 0.1, S), steel, cx - h + 0.06, y, cz);
      add(g, new THREE.BoxGeometry(0.12, 0.1, S), steel, cx + h - 0.06, y, cz);
    }

    // north (door) face: steel strips either side of the opening, headers above each door
    const strip = (S - DOOR_W) / 2;
    const zN = zFront + 0.06;
    for (const sx of [-1, 1]) add(g, new THREE.BoxGeometry(strip, H, 0.12), brushed, cx + sx * (DOOR_W / 2 + strip / 2), H / 2, zN);
    const headerY0 = DOOR_H;
    add(g, new THREE.BoxGeometry(DOOR_W, F - headerY0 - 0.1, 0.12), brushed, cx, (headerY0 + F - 0.1) / 2 + 0.05, zN); // above the ground door
    add(g, new THREE.BoxGeometry(DOOR_W, H - (F + DOOR_H), 0.12), brushed, cx, (F + DOOR_H + H) / 2, zN); // above the upper door

    // "ELEVATOR" signs above the doors
    const sign = (() => {
      const c = document.createElement("canvas");
      c.width = 512;
      c.height = 128;
      const g2 = c.getContext("2d")!;
      g2.fillStyle = "#101826";
      g2.fillRect(0, 0, 512, 128);
      g2.strokeStyle = "#d4a017";
      g2.lineWidth = 8;
      g2.strokeRect(6, 6, 500, 116);
      g2.fillStyle = "#ffffff";
      g2.font = "800 64px system-ui, -apple-system, Segoe UI, sans-serif";
      g2.textAlign = "center";
      g2.textBaseline = "middle";
      g2.fillText("ELEVATOR", 256, 68);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    for (const y of [F - 0.5, F + DOOR_H + 0.55]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.32), new THREE.MeshBasicMaterial({ map: sign }));
      m.position.set(cx, y, zFront - 0.002);
      m.rotation.y = Math.PI; // faces north (-z)
      g.add(m);
    }

    // call-button panels beside each door (an up/down arrow plate)
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
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.4), new THREE.MeshBasicMaterial({ map: plate }));
      m.position.set(cx + DOOR_W / 2 + 0.2, y, zFront - 0.002);
      m.rotation.y = Math.PI;
      g.add(m);
    }

    // shaft doors (one pair per floor)
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.3, metalness: 0.85 });
    for (const level of [0, 1] as const) {
      const y = (level === 1 ? F : 0) + DOOR_H / 2 + 0.02;
      const panels: THREE.Mesh[] = [];
      for (const sx of [-1, 1]) {
        const m = add(g, new THREE.BoxGeometry(DOOR_W / 2, DOOR_H, 0.07), doorMat, cx + sx * (DOOR_W / 4), y, zFront + 0.13);
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

    // ---- cab (moves up and down inside the tower) ----
    const CS = S - 0.5; // cab outer size
    const CH = 2.75;
    const ch = CS / 2;
    const cab = this.cab;
    cab.position.set(cx, 0, cz);
    const wall = new THREE.MeshStandardMaterial({ color: 0x8b929d, roughness: 0.4, metalness: 0.75 });
    const inner = new THREE.MeshStandardMaterial({ color: 0xd8dce2, roughness: 0.5, metalness: 0.3 });
    add(cab, new THREE.BoxGeometry(CS, 0.14, CS), darkSteel, 0, 0.07, 0); // floor
    add(cab, new THREE.BoxGeometry(CS, 0.12, CS), steel, 0, CH + 0.06, 0); // ceiling
    add(cab, new THREE.BoxGeometry(CS, CH, 0.1), wall, 0, CH / 2, ch - 0.05); // back
    add(cab, new THREE.BoxGeometry(0.1, CH, CS), wall, -ch + 0.05, CH / 2, 0);
    add(cab, new THREE.BoxGeometry(0.1, CH, CS), wall, ch - 0.05, CH / 2, 0);
    add(cab, new THREE.BoxGeometry(CS - 0.2, CH - 0.3, 0.02), inner, 0, CH / 2, ch - 0.12); // interior panel
    // front of the cab: strips beside the opening and a lintel
    const cStrip = (CS - DOOR_W) / 2;
    for (const sx of [-1, 1]) add(cab, new THREE.BoxGeometry(cStrip, CH, 0.1), wall, sx * (DOOR_W / 2 + cStrip / 2), CH / 2, -ch + 0.05);
    add(cab, new THREE.BoxGeometry(DOOR_W, CH - DOOR_H - 0.02, 0.1), wall, 0, (DOOR_H + 0.02 + CH) / 2, -ch + 0.05);
    for (const sx of [-1, 1]) {
      const m = add(cab, new THREE.BoxGeometry(DOOR_W / 2, DOOR_H, 0.06), doorMat, sx * (DOOR_W / 4), DOOR_H / 2 + 0.14, -ch + 0.12);
      m.userData.sx = sx;
      m.userData.baseX = m.position.x;
      this.cabDoors.push(m);
    }
    // ceiling light and a control panel with up / down buttons
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff0b8, emissiveIntensity: 1.6 });
    add(cab, new THREE.BoxGeometry(CS * 0.5, 0.04, CS * 0.5), lampMat, 0, CH - 0.03, 0, false);
    this.lamp = add(cab, new THREE.BoxGeometry(0.01, 0.01, 0.01), lampMat, 0, 0, 0, false);
    const panel = add(cab, new THREE.BoxGeometry(0.3, 0.7, 0.04), darkSteel, ch - 0.16, 1.25, -ch + 0.4); // beside the door on the right wall? (inside, east wall)
    panel.position.set(ch - 0.14, 1.25, -ch * 0.35);
    panel.rotation.y = -Math.PI / 2;
    for (const [i, c] of [0xffd34d, 0xffd34d].entries()) {
      const b = add(cab, new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.2 }), ch - 0.17, 1.4 - i * 0.2, -ch * 0.35, false);
      b.rotation.z = Math.PI / 2;
    }
    const cabLight = new THREE.PointLight(0xfff0c8, 0.9, 5, 2);
    cabLight.position.set(0, CH - 0.4, 0);
    cab.add(cabLight);
    g.add(cab);
  }

  // ------------------------------------------------------------------ collision
  /** Walls of the tower plus the doorways (closed doors block). */
  solids(): ElevatorSolid[] {
    const { size: S, zFront, floorHeight: F } = this.cfg;
    const H = F + 3.7;
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
    if (this.riding || this.phase !== "idle") return "";
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
    this.phase = "closing";
    this.doorTarget = 0;
  }

  // ------------------------------------------------------------------ per-frame
  update(dt: number, px: number, py: number, pz: number): void {
    const inside = this.inShaft(px, pz);
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
        this.progress = Math.min(1, this.progress + dt / TRAVEL_TIME);
        const p = this.progress;
        const e = p * p * (3 - 2 * p); // smooth start and stop
        const to = this.dest === 1 ? this.cfg.floorHeight : 0;
        this.cabY = this.from + (to - this.from) * e;
        if (p >= 1) {
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
    void this.lamp;
  }
}
