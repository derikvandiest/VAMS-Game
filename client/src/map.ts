/**
 * Campus map (press M or use the Map button). A simple top-down view drawn from content/layout.json,
 * oriented north-up (north is where the buses are parked, +X in the world). Classrooms whose assignment
 * is still to do are highlighted yellow (like their glowing doors); finished ones are greyed with a check.
 */
import layout from "../../content/layout.json";
import { loadSlot, getActiveSlotId } from "./saveManager";
import { ROOMS, roomById } from "./rooms";

interface PlayerPos {
  x: number;
  y: number;
  z: number;
  rotY: number;
}

let getPlayer: (() => PlayerPos | null) | null = null;
let enabled = false;
let overlay: HTMLElement | null = null;
let floor = 0;

const SVG_NS = "http://www.w3.org/2000/svg";

// North-up: world +X (north) is up on the screen and world +Z is to the right.
// map point = (sx, sy) = (z, -x)
const B = layout.boundary;
const VIEW = { x: B.minZ - 2, y: -(B.maxX + 2), w: B.maxZ - B.minZ + 4, h: B.maxX - B.minX + 4 };

type El = SVGElement;
function el(tag: string, attrs: Record<string, string | number>, parent?: El, text?: string): El {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
}

/** Rectangle given in world terms (centre x/z and sizes along x and z) */
function worldRect(parent: El, cx: number, cz: number, wx: number, dz: number, attrs: Record<string, string | number>): El {
  return el("rect", { x: cz - dz / 2, y: -(cx + wx / 2), width: dz, height: wx, ...attrs }, parent);
}

function label(parent: El, sx: number, sy: number, text: string, cls: string): El {
  return el("text", { x: sx, y: sy, class: cls, "text-anchor": "middle", "dominant-baseline": "middle" }, parent, text);
}

function completedIds(): string[] {
  return loadSlot(getActiveSlotId())?.objectives.completedIds ?? [];
}

function buildSvg(): SVGSVGElement {
  const done = new Set(completedIds());
  const svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  svg.setAttribute("viewBox", `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`);
  svg.setAttribute("class", "map-svg");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Campus map, north is up");

  const defs = el("defs", {}, svg);
  const glow = el("filter", { id: "map-glow", x: "-50%", y: "-50%", width: "200%", height: "200%" }, defs);
  el("feGaussianBlur", { stdDeviation: 0.9, result: "b" }, glow);
  const merge = el("feMerge", {}, glow);
  el("feMergeNode", { in: "b" }, merge);
  el("feMergeNode", { in: "SourceGraphic" }, merge);

  // Campus ground
  worldRect(svg, (B.minX + B.maxX) / 2, (B.minZ + B.maxZ) / 2, B.maxX - B.minX, B.maxZ - B.minZ, { class: "map-ground" });
  const pl = layout.parkingLot;
  worldRect(svg, pl.center.x, pl.center.z, pl.width, pl.depth, { class: "map-lot" });
  const f = layout.field;
  worldRect(svg, f.center.x, f.center.z, f.width, f.depth, { class: "map-field", rx: 2.5 });
  const bc = layout.basketballCourt;
  worldRect(svg, bc.center.x, bc.center.z, bc.width, bc.depth, { class: "map-court" });

  label(svg, pl.center.z, -pl.center.x, "PARKING LOT", "map-area");
  label(svg, f.center.z, -f.center.x, "FIELD", "map-area");
  label(svg, bc.center.z, -bc.center.x, "COURT", "map-area");

  // Buildings
  const names: Record<string, string> = { west: "WEST BLDG", north: "NORTH BLDG", office: "OFFICE", mpr: "MPR" };
  for (const b of layout.buildings) {
    worldRect(svg, b.x, b.z, b.w, b.d, { class: "map-building" });
    // the west and MPR buildings are tall (along z); name them along the building
    label(svg, b.z, -b.x, names[b.id] ?? b.id.toUpperCase(), "map-bname");
  }

  // Main gate
  const g = layout.gates[0];
  worldRect(svg, g.x, g.z, 1.2, g.length, { class: "map-gate" });
  label(svg, g.z, -g.x + 2.6, "MAIN GATE", "map-small");

  // Classroom doors on the chosen floor, with labels just outside the door
  const doors = layout.doors.filter((d) => d.floor === floor && !!roomById(d.id));
  for (const d of doors) {
    const room = roomById(d.id)!;
    // outward direction: west-building doors face +x (north, up on the map), north-building doors face +z (right)
    const out = d.axis === "z" ? { sx: 0, sy: -1 } : { sx: 1, sy: 0 };
    const cx = d.z + out.sx * (d.axis === "z" ? 0 : 3.6);
    const cy = -d.x + out.sy * (d.axis === "z" ? 3.2 : 0);
    const isStamp = room.type === "stamp";
    const isDone = isStamp && room.objectiveId ? done.has(room.objectiveId) : false;
    const cls = !isStamp ? "map-chip-other" : isDone ? "map-chip-done" : "map-chip-todo";
    const text = isDone ? `${room.shortLabel} ✓` : room.shortLabel;
    const w = Math.max(6.6, text.length * 1.25 + 2);
    const h = 3.6;
    // door tick: from the door to the label
    el("line", { x1: d.z, y1: -d.x, x2: cx, y2: cy, class: "map-tick" }, svg);
    const chip = el("g", { class: cls }, svg);
    el("rect", { x: cx - w / 2, y: cy - h / 2, width: w, height: h, rx: 1.2 }, chip);
    label(chip, cx, cy + 0.1, text, "map-chip-text");
  }

  // Player
  const p = getPlayer?.();
  if (p && p.x > B.minX && p.x < B.maxX && p.z > B.minZ && p.z < B.maxZ) {
    const playerFloor = p.y > 3 ? 1 : 0;
    if (playerFloor === floor) {
      const me = el("g", { transform: `translate(${p.z} ${-p.x})` }, svg);
      el("circle", { r: 2.4, class: "map-me-halo" }, me);
      // direction the character faces: world (sin rotY, cos rotY) = map (cos rotY, -sin rotY)
      const arrow = el("g", { transform: `rotate(${-p.rotY * (180 / Math.PI)})` }, me);
      el("polygon", { points: "3.6,0 0.4,-1.7 0.4,1.7", class: "map-me-arrow" }, arrow);
      el("circle", { r: 1.25, class: "map-me" }, me);
    }
  }

  // North arrow
  const n = el("g", { transform: `translate(${VIEW.x + VIEW.w - 6} ${VIEW.y + 7})` }, svg);
  el("circle", { r: 4.2, class: "map-north-ring" }, n);
  el("polygon", { points: "0,-3.2 -1.6,1.4 1.6,1.4", class: "map-north-arrow" }, n);
  label(n, 0, 3, "N", "map-north-n");

  return svg;
}

function render(): void {
  if (!overlay) return;
  const body = overlay.querySelector<HTMLElement>(".map-body")!;
  body.replaceChildren(buildSvg());
  const done = new Set(completedIds());
  const stamp = ROOMS.filter((r) => r.type === "stamp");
  const left = stamp.filter((r) => !done.has(r.objectiveId!)).length;
  overlay.querySelector<HTMLElement>(".map-remaining")!.textContent =
    left === 0 ? "All 16 assignments are complete!" : `${left} of 16 classrooms still have an assignment`;
  overlay.querySelectorAll<HTMLButtonElement>(".map-floor").forEach((b) => b.classList.toggle("active", Number(b.dataset.floor) === floor));
}

function onKey(e: KeyboardEvent): void {
  // swallow every key while the map is open so the character stays put
  e.stopImmediatePropagation();
  if (e.code === "KeyM" || e.key === "Escape") {
    e.preventDefault();
    closeMap();
  }
}

export function isMapOpen(): boolean {
  return !!overlay;
}

export function openMap(): void {
  if (overlay || !enabled) return;
  const p = getPlayer?.();
  floor = p && p.y > 3 ? 1 : 0;
  overlay = document.createElement("div");
  overlay.id = "map-overlay";
  overlay.className = "modal-overlay map-overlay";
  overlay.innerHTML = `
    <div class="modal-card map-card" role="dialog" aria-modal="true" aria-label="Campus map">
      <div class="map-head">
        <div>
          <div class="map-title">Campus Map</div>
          <div class="map-remaining"></div>
        </div>
        <div class="map-floors" role="group" aria-label="Floor">
          <button type="button" class="map-floor" data-floor="0">Ground floor</button>
          <button type="button" class="map-floor" data-floor="1">Upper floor</button>
        </div>
        <button type="button" class="map-close" aria-label="Close map">✕</button>
      </div>
      <div class="map-body"></div>
      <div class="map-legend">
        <span><i class="lg lg-todo"></i>Assignment to do (green !)</span>
        <span><i class="lg lg-done"></i>Done</span>
        <span><i class="lg lg-other"></i>Other rooms</span>
        <span><i class="lg lg-me"></i>You</span>
        <span class="map-keyhint">Press M or Esc to close</span>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeMap();
  });
  overlay.querySelector(".map-close")!.addEventListener("click", closeMap);
  overlay.querySelectorAll<HTMLButtonElement>(".map-floor").forEach((b) =>
    b.addEventListener("click", () => {
      floor = Number(b.dataset.floor);
      render();
    })
  );
  window.addEventListener("keydown", onKey, true);
  render();
}

export function closeMap(): void {
  if (!overlay) return;
  window.removeEventListener("keydown", onKey, true);
  overlay.remove();
  overlay = null;
}

/** Wires the Map button and the M key (called once by main.ts). */
export function initMap(): void {
  document.getElementById("map-btn")?.addEventListener("click", () => (overlay ? closeMap() : openMap()));
  window.addEventListener("keydown", (e) => {
    if (e.code !== "KeyM" || e.repeat) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    openMap();
  });
  // keep the map current if an objective completes while it is open
  window.addEventListener("eld-objective-complete", () => render());
}

export function setMapSource(getter: (() => PlayerPos | null) | null): void {
  getPlayer = getter;
  enabled = getter !== null;
  if (!enabled) closeMap();
}
