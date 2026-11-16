/**
 * Player inventory: a quick bar of 5 slots (always on screen, bottom centre) and a backpack for everything else
 * (the 🎒 button under the Map button, or the I key). There is no inventory until the player picks up a backpack
 * from the hooks in the MPR (equipBackpack): then the bar and the button appear and the character wears it. Items are dragged between any two slots with the mouse or a
 * finger: drop on a slot to move there (swapping with what is in it, or stacking the same item). Keys 1-5 pick the
 * active quick slot.
 *
 * The contents are saved per save slot in localStorage. Other code adds items with addItem() (e.g. picking
 * something up); window.__giveItem(id, qty) does the same from the console.
 */
import itemsData from "../../content/items.json";
import { getActiveSlotId, loadSlot } from "./saveManager";
import { ROOMS } from "./rooms";
import { openChromebook, isChromebookOpen, closeChromebook } from "./chromebook";
import { loadCharacterProfile, saveCharacterProfile } from "./profile";

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  stack: number;
  starter?: boolean;
  /** drawn faded (an empty bottle) */
  dim?: boolean;
  /** a small emoji in the slot's corner */
  badge?: string;
}
interface Stack {
  id: string;
  qty: number;
}
type Slot = Stack | null;
type Area = "quick" | "bag" | "pouch";

export const ITEMS: ItemDef[] = (itemsData as { items: ItemDef[] }).items;
const itemById = (id: string): ItemDef | undefined => ITEMS.find((i) => i.id === id);

/**
 * Drawn icons for items that no emoji fits ("icon": "svg:<name>" in items.json).
 * stanley: a 40 oz Stanley Quencher tumbler: tapered body, stainless band, lid with a straw, big side handle.
 */
const SVG_ICONS: Record<string, string> = {
  chromebook: `<svg viewBox="0 0 64 64" class="inv-svg" aria-hidden="true">
    <rect x="12" y="12" width="40" height="27" rx="2.5" fill="#2b2f36"/>
    <rect x="15" y="15" width="34" height="21" rx="1" fill="#5b9be6"/>
    <circle cx="32" cy="25.5" r="5.2" fill="#ffffff"/>
    <circle cx="32" cy="25.5" r="2.2" fill="#5b9be6"/>
    <path d="M6 41 H58 L54 48 H10 Z" fill="#c3c8cf"/>
    <rect x="27" y="42" width="10" height="2" rx="1" fill="#8b929b"/>
  </svg>`,
  stanley: `<svg viewBox="0 0 64 64" class="inv-svg" aria-hidden="true">
    <path d="M40 22 C52 22 54 26 54 34 C54 42 52 46 44 46" fill="none" stroke="#5f8f86" stroke-width="5" stroke-linecap="round"/>
    <path d="M40 22 C52 22 54 26 54 34 C54 42 52 46 44 46" fill="none" stroke="#86b8ad" stroke-width="2" stroke-linecap="round"/>
    <path d="M17 18 L45 18 L41 58 Q31 61 21 58 Z" fill="#7fb3a7"/>
    <path d="M17 18 L23 18 L24 58 Q22 58.5 21 58 Z" fill="#9cc9bf" opacity="0.8"/>
    <path d="M38 18 L45 18 L41 58 Q39.5 58.5 38 58.6 Z" fill="#5f8f86" opacity="0.7"/>
    <rect x="18.5" y="26" width="25.5" height="5" fill="#d7dde2"/>
    <text x="31" y="45" font-family="Arial, sans-serif" font-size="5.5" font-weight="700" fill="#e8f3f0" text-anchor="middle">STANLEY</text>
    <rect x="14.5" y="13" width="33" height="6.5" rx="2.5" fill="#cfd6db"/>
    <rect x="16" y="10" width="30" height="4.5" rx="2" fill="#e6ebee"/>
    <rect x="34" y="2" width="3.4" height="11" rx="1.5" fill="#6aa196" transform="rotate(12 35.7 8)"/>
  </svg>`,
};
/** A zippered pencil pouch in the backpack's color */
function pouchSvg(color: string): string {
  return `<svg viewBox="0 0 64 64" class="inv-svg" aria-hidden="true">
    <rect x="5" y="20" width="54" height="28" rx="12" fill="${color}" stroke="rgba(0,0,0,0.35)" stroke-width="1.5"/>
    <rect x="5" y="20" width="54" height="11" rx="10" fill="rgba(255,255,255,0.16)"/>
    <path d="M11 27 H53" stroke="#c9ced4" stroke-width="2.4" stroke-dasharray="2 1.4"/>
    <rect x="47" y="24" width="5" height="10" rx="2" fill="#9ca3af"/>
    <circle cx="49.5" cy="36.5" r="2.4" fill="none" stroke="#9ca3af" stroke-width="1.4"/>
  </svg>`;
}
/** An item's icon as HTML: an emoji, or a drawn SVG icon */
function iconHtml(icon: string): string {
  if (icon === "svg:pouch") return pouchSvg(state.backpack ?? "#64748b");
  return icon.startsWith("svg:") ? SVG_ICONS[icon.slice(4)] ?? "❔" : icon;
}

const QUICK_SLOTS = 5;
const BAG_SLOTS = 20;

const POUCH_SLOTS = 6;
/** What starts out inside the pencil pouch */
const POUCH_START: Stack[] = [
  { id: "pencil", qty: 5 },
];
const state: {
  quick: Slot[];
  bag: Slot[];
  pouch: Slot[]; // the pencil pouch's pockets
  selected: number;
  backpack: string | null;
  starterGiven: boolean;
  showBackpack: boolean;
} = {
  quick: new Array(QUICK_SLOTS).fill(null),
  bag: new Array(BAG_SLOTS).fill(null),
  pouch: new Array(POUCH_SLOTS).fill(null),
  selected: 0,
  backpack: null, // the color of the backpack the player picked up (null = none yet: no inventory)
  starterGiven: false,
  showBackpack: true, // drawn on the character (it can be hidden: the inventory works either way)
};
let started = false;
let panel: HTMLElement | null = null;
let bar: HTMLElement | null = null;

// ---------------------------------------------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------------------------------------------
const storageKey = (): string => `eld_inventory_slot_${getActiveSlotId()}`;

function sanitize(list: unknown, size: number): Slot[] {
  const out: Slot[] = new Array(size).fill(null);
  if (!Array.isArray(list)) return out;
  for (let i = 0; i < size; i++) {
    const s = list[i] as { id?: unknown; qty?: unknown } | null;
    const def = s && typeof s.id === "string" ? itemById(s.id) : undefined;
    if (def) out[i] = { id: def.id, qty: Math.max(1, Math.min(def.stack, Math.floor(Number(s!.qty) || 1))) };
  }
  return out;
}

function load(): void {
  state.quick = new Array(QUICK_SLOTS).fill(null);
  state.bag = new Array(BAG_SLOTS).fill(null);
  state.pouch = new Array(POUCH_SLOTS).fill(null);
  state.selected = 0;
  state.backpack = null;
  state.starterGiven = false;
  state.showBackpack = true;
  try {
    const raw = localStorage.getItem(storageKey());
    if (raw) {
      const d = JSON.parse(raw);
      state.quick = sanitize(d.quick, QUICK_SLOTS);
      state.bag = sanitize(d.bag, BAG_SLOTS);
      state.pouch = sanitize(d.pouch, POUCH_SLOTS);
      state.selected = Math.max(0, Math.min(QUICK_SLOTS - 1, Number(d.selected) || 0));
      state.backpack = typeof d.backpack === "string" && /^#[0-9a-fA-F]{6}$/.test(d.backpack) ? d.backpack : null;
      state.starterGiven = d.starterGiven === true || state.quick.some(Boolean) || state.bag.some(Boolean);
      state.showBackpack = d.showBackpack !== false;
      // saves from before the folder and the bottle: they come with the backpack now
      if (state.backpack && d.kit !== 3) giveKit();
    }
  } catch {
    /* start fresh */
  }
  wearBackpack(state.backpack && state.showBackpack ? state.backpack : null);
}

/** Show the backpack on the character (the profile carries it, so other players see it too) */
function wearBackpack(color: string | null): void {
  const p = loadCharacterProfile();
  if ((p.backpack || "") !== (color || "")) saveCharacterProfile({ ...p, backpack: color || "" });
}

/** The backpack's starting kit: the assignment folder, an empty water bottle, the pencil pouch (with 5 sharpened
 *  pencils inside), a student agenda and a Chromebook (whatever is not already carried) */
function giveKit(): void {
  for (const i of ITEMS.filter((x) => x.starter)) {
    const has = (id: string): boolean => [...state.quick, ...state.bag, ...state.pouch].some((s) => s?.id === id);
    if (has(i.id) || (i.id === "water-bottle-empty" && has("water-bottle-full"))) continue;
    const k = state.bag.indexOf(null);
    if (k < 0) continue;
    state.bag[k] = { id: i.id, qty: 1 };
    if (i.id === "pencil-pouch") POUCH_START.forEach((s, j) => (state.pouch[j] = { ...s }));
  }
  kitGiven = true;
}
let kitGiven = false;

/** The classroom assignments the player has completed so far (they are what fills the folder) */
export function completedAssignments(): Array<{ id: string; label: string }> {
  const done = new Set(loadSlot(getActiveSlotId())?.objectives.completedIds ?? []);
  return ROOMS.filter((r) => r.type === "stamp" && r.objectiveId && done.has(r.objectiveId)).map((r) => ({ id: r.id, label: r.label }));
}
const TOTAL_ASSIGNMENTS = 16;

/** Swap one item for another in the same slot (e.g. an empty bottle becoming a full one). Returns false if not carried. */
function transform(fromId: string, toId: string): boolean {
  for (const list of [state.quick, state.bag]) {
    const k = list.findIndex((s) => s?.id === fromId);
    if (k >= 0) {
      list[k] = { id: toId, qty: 1 };
      save();
      render();
      return true;
    }
  }
  return false;
}

/** At the drinking fountain: fill an empty water bottle if the player carries one. Returns true if one was filled. */
export function fillWaterBottle(): boolean {
  if (!state.backpack) return false;
  const filled = transform("water-bottle-empty", "water-bottle-full");
  if (filled) toast("💧 Stanley cup filled!");
  return filled;
}

/** Drink the water bottle (it becomes empty again; refill it at the fountain). The character lifts the cup and
 *  drinks (scene.ts listens for "eld-drink"). */
export function drinkWaterBottle(): boolean {
  if (countItem("water-bottle-full") === 0) return false;
  window.dispatchEvent(new CustomEvent("eld-drink"));
  // the cup is empty once the sip is over
  window.setTimeout(() => {
    if (transform("water-bottle-full", "water-bottle-empty")) toast("Ahh, refreshing! Refill your Stanley at the drinking fountain.");
  }, 1900);
  return true;
}

/** A short message above the quick bar */
let toastTimer = 0;
function toast(text: string): void {
  let el = document.getElementById("inv-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "inv-toast";
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove("show"), 2600);
}

/** Is the backpack drawn on the character? */
export function backpackVisible(): boolean {
  return state.showBackpack;
}

/** Show or hide the backpack on the character (only once the player has one; the inventory keeps working) */
export function setBackpackVisible(show: boolean): void {
  if (!state.backpack) return;
  state.showBackpack = show;
  save();
  wearBackpack(show ? state.backpack : null);
  render();
}

/** Does the player have a backpack (and so an inventory)? */
export function hasBackpack(): boolean {
  return state.backpack !== null;
}

/** The color of the backpack the player wears, or null */
export function backpackColor(): string | null {
  return state.backpack;
}

/** Pick up (or swap to) a backpack of this color: the inventory opens up; the first one comes with the PD supplies. */
export function equipBackpack(color: string): void {
  state.backpack = color;
  state.showBackpack = true; // picking one up puts it on
  if (!state.starterGiven) {
    state.starterGiven = true;
    giveKit();
  }
  save();
  wearBackpack(color);
  render();
}

function save(): void {
  try {
    localStorage.setItem(storageKey(), JSON.stringify({ ...state, kit: kitGiven || state.starterGiven ? 3 : 0 }));
  } catch {
    /* storage unavailable: keep it for this session */
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------------------------------------------
/** Put items in the inventory (stacks first, then the first empty backpack slot, then the quick bar). Returns how many fit. */
export function addItem(id: string, qty = 1): number {
  const def = itemById(id);
  if (!def || qty <= 0 || !state.backpack) return 0; // nothing to carry it in
  let left = qty;
  for (const list of [state.quick, state.bag]) {
    for (const s of list) {
      if (left > 0 && s && s.id === id && s.qty < def.stack) {
        const n = Math.min(left, def.stack - s.qty);
        s.qty += n;
        left -= n;
      }
    }
  }
  for (const list of [state.bag, state.quick]) {
    for (let i = 0; i < list.length && left > 0; i++) {
      if (!list[i]) {
        const n = Math.min(left, def.stack);
        list[i] = { id, qty: n };
        left -= n;
      }
    }
  }
  save();
  render();
  return qty - left;
}

/** Take items out (from anywhere). Returns how many were removed. */
export function removeItem(id: string, qty = 1): number {
  let left = qty;
  for (const list of [state.quick, state.bag]) {
    for (let i = 0; i < list.length && left > 0; i++) {
      const s = list[i];
      if (s && s.id === id) {
        const n = Math.min(left, s.qty);
        s.qty -= n;
        left -= n;
        if (s.qty <= 0) list[i] = null;
      }
    }
  }
  save();
  render();
  return qty - left;
}

/** How many of an item the player has */
export function countItem(id: string): number {
  return [...state.quick, ...state.bag, ...state.pouch].reduce((n, s) => n + (s && s.id === id ? s.qty : 0), 0);
}
const hasPouch = (): boolean => [...state.quick, ...state.bag].some((s) => s?.id === "pencil-pouch");

/** The item in the active quick slot (or null) */
export function selectedItem(): ItemDef | null {
  const s = state.quick[state.selected];
  return s ? itemById(s.id) ?? null : null;
}

export function isBackpackOpen(): boolean {
  return !!panel;
}

/** Load this save slot's inventory and show the quick bar (called when a game starts). */
export function startInventory(): void {
  load();
  if (!started) {
    started = true;
    document.getElementById("backpack-btn")?.addEventListener("click", () => (panel ? closeBackpack() : openBackpack()));
    window.addEventListener("keydown", onGlobalKey, true); // before the Esc = leave-game handler
    (window as unknown as { __giveItem: typeof addItem }).__giveItem = addItem;
    // a completed classroom assignment goes into the folder
    window.addEventListener("eld-objective-complete", (e) => {
      const id = (e as CustomEvent<{ id?: string }>).detail?.id;
      if (!id || !ROOMS.some((r) => r.objectiveId === id)) return;
      render();
      if (state.backpack && countItem("assignment-folder") > 0) toast(`📁 Assignment added to your folder (${completedAssignments().length}/${TOTAL_ASSIGNMENTS})`);
    });
  }
  buildBar();
  render();
}

/** Hide everything (leaving the game). */
export function stopInventory(): void {
  closeChromebook();
  closeBackpack();
  bar?.remove();
  bar = null;
}

// ---------------------------------------------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------------------------------------------
const listOf = (area: Area): Slot[] => (area === "quick" ? state.quick : area === "pouch" ? state.pouch : state.bag);
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function slotHtml(area: Area, i: number, s: Slot): string {
  const def = s ? itemById(s.id) : undefined;
  const sel = area === "quick" && i === state.selected ? " selected" : "";
  const key = area === "quick" ? `<span class="inv-key">${i + 1}</span>` : "";
  const folder = def?.id === "assignment-folder" ? `<span class="inv-qty">${completedAssignments().length}/${TOTAL_ASSIGNMENTS}</span>` : "";
  const body = def
    ? `<span class="inv-icon${def.dim ? " dim" : ""}">${iconHtml(def.icon)}</span>${def.badge ? `<span class="inv-badge">${def.badge}</span>` : ""}${
        folder || (s!.qty > 1 ? `<span class="inv-qty">${s!.qty}</span>` : "")
      }`
    : "";
  const title = def ? ` title="${esc(def.name)}"` : "";
  return `<div class="inv-slot${def ? " filled" : ""}${sel}" data-area="${area}" data-index="${i}"${title}>${key}${body}</div>`;
}

function buildBar(): void {
  if (bar) return;
  bar = document.createElement("div");
  bar.id = "quickbar";
  bar.setAttribute("aria-label", "Quick slots");
  document.body.appendChild(bar);
  bar.addEventListener("pointerdown", onPointerDown);
}

function render(): void {
  // no backpack, no inventory: the quick bar and the backpack button only appear once the player has one
  const has = state.backpack !== null;
  const btn = document.getElementById("backpack-btn");
  if (btn && bar) btn.style.display = has ? "flex" : "none";
  if (bar) bar.style.display = has ? "flex" : "none";
  if (!has && panel) closeBackpack();
  if (bar) {
    const sel = selectedItem();
    bar.innerHTML =
      state.quick.map((s, i) => slotHtml("quick", i, s)).join("") +
      `<div class="inv-bar-label">${sel ? esc(sel.name) : ""}</div>`;
  }
  if (panel) {
    panel.querySelector(".inv-grid")!.innerHTML = state.bag.map((s, i) => slotHtml("bag", i, s)).join("");
    // the pencil pouch's pockets (only while the player carries the pouch)
    const pouchBox = panel.querySelector<HTMLElement>(".inv-pouch")!;
    pouchBox.style.display = hasPouch() ? "block" : "none";
    pouchBox.querySelector(".inv-pouch-grid")!.innerHTML = state.pouch.map((s, i) => slotHtml("pouch", i, s)).join("");
    pouchBox.querySelector<HTMLElement>(".inv-pouch-icon")!.innerHTML = iconHtml("svg:pouch");
    const used = state.bag.filter(Boolean).length;
    panel.querySelector(".inv-count")!.textContent = `${used} / ${BAG_SLOTS}`;
    const vis = panel.querySelector<HTMLButtonElement>(".inv-visible");
    if (vis) {
      vis.classList.toggle("off", !state.showBackpack);
      vis.setAttribute("aria-pressed", String(state.showBackpack));
      vis.textContent = state.showBackpack ? "👁 Shown on character" : "🚫 Hidden on character";
      vis.title = state.showBackpack ? "Hide the backpack on your character" : "Show the backpack on your character";
    }
  }
}

function showDetail(area: Area, i: number): void {
  if (!panel) return;
  const s = listOf(area)[i];
  const def = s ? itemById(s.id) : undefined;
  const box = panel.querySelector<HTMLElement>(".inv-detail")!;
  let extra = "";
  if (def?.id === "assignment-folder") {
    const done = completedAssignments();
    extra =
      `<div class="inv-folder"><div class="inv-folder-count">${done.length} of ${TOTAL_ASSIGNMENTS} assignments</div>` +
      (done.length
        ? `<ul>${done.map((a) => `<li>📝 ${esc(a.label)}</li>`).join("")}</ul>`
        : `<div class="inv-detail-desc">Empty for now. Complete a classroom's assignment and it goes in here.</div>`) +
      `</div>`;
  } else if (def?.id === "water-bottle-full") {
    extra = `<button type="button" class="inv-use" data-use="drink">💧 Drink</button>`;
  }
  box.innerHTML = def
    ? `<div class="inv-detail-icon${def.dim ? " dim" : ""}">${iconHtml(def.icon)}</div><div class="inv-detail-main"><div class="inv-detail-name">${esc(def.name)}${s!.qty > 1 ? ` <span>×${s!.qty}</span>` : ""}</div><div class="inv-detail-desc">${esc(def.description)}</div>${extra}</div>`
    : `<div class="inv-detail-desc">Drag items onto the quick bar at the bottom of the screen to keep them handy. Keys <b>1–5</b> pick a quick slot.</div>`;
  box.querySelector<HTMLButtonElement>("[data-use='drink']")?.addEventListener("click", () => {
    drinkWaterBottle();
    showDetail(area, i);
  });
}

export function openBackpack(): void {
  if (panel || !state.backpack) return;
  panel = document.createElement("div");
  panel.id = "backpack-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Backpack");
  panel.innerHTML = `
    <div class="inv-head">
      <div class="inv-title"><span class="inv-swatch" style="background:${state.backpack}"></span>Backpack <span class="inv-count"></span></div>
      <button type="button" class="inv-close" aria-label="Close backpack">✕</button>
    </div>
    <button type="button" class="inv-visible" aria-pressed="true"></button>
    <div class="inv-grid"></div>
    <div class="inv-pouch">
      <div class="inv-pouch-title"><span class="inv-pouch-icon"></span>Pencil Pouch</div>
      <div class="inv-pouch-grid"></div>
    </div>
    <div class="inv-detail"></div>
    <div class="inv-foot">Drag items to and from the quick bar · <kbd>I</kbd> or <kbd>Esc</kbd> to close</div>`;
  document.body.appendChild(panel);
  panel.querySelector(".inv-close")!.addEventListener("click", closeBackpack);
  panel.querySelector(".inv-visible")!.addEventListener("click", () => setBackpackVisible(!state.showBackpack));
  panel.addEventListener("pointerdown", onPointerDown);
  panel.addEventListener("pointerover", (e) => {
    const slot = (e.target as HTMLElement).closest<HTMLElement>(".inv-slot");
    if (slot) showDetail(slot.dataset.area as Area, Number(slot.dataset.index));
  });
  document.getElementById("backpack-btn")?.classList.add("open");
  render();
  showDetail("bag", -1);
}

export function closeBackpack(): void {
  if (!panel) return;
  panel.remove();
  panel = null;
  document.getElementById("backpack-btn")?.classList.remove("open");
}

function onGlobalKey(e: KeyboardEvent): void {
  if (!bar) return; // not in a game
  if (isChromebookOpen()) return; // the laptop has the keyboard
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
  if (document.querySelector(".dialog-overlay, #map-overlay, #settings-modal-overlay[style*='flex']")) return;
  if (panel && e.key === "Escape") {
    e.preventDefault();
    e.stopImmediatePropagation();
    closeBackpack();
    return;
  }
  if (e.code === "KeyI" && !e.repeat && state.backpack) {
    e.preventDefault();
    if (panel) closeBackpack();
    else openBackpack();
    return;
  }
  const n = Number(e.key);
  if (n >= 1 && n <= QUICK_SLOTS && !e.repeat && state.backpack) {
    state.selected = n - 1;
    save();
    render();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Drag and drop (pointer events: mouse, pen and touch)
// ---------------------------------------------------------------------------------------------------------------
let drag: { area: Area; index: number; ghost: HTMLElement; startX: number; startY: number; moved: boolean; pointerId: number } | null =
  null;

function onPointerDown(e: PointerEvent): void {
  if (e.button !== 0) return;
  const slot = (e.target as HTMLElement).closest<HTMLElement>(".inv-slot");
  if (!slot) return;
  e.preventDefault();
  e.stopPropagation(); // never reaches the 3D view (no camera drag)
  const area = slot.dataset.area as Area;
  const index = Number(slot.dataset.index);
  if (!listOf(area)[index]) {
    if (area === "quick") selectQuick(index);
    return;
  }
  const ghost = document.createElement("div");
  ghost.className = "inv-ghost";
  ghost.innerHTML = slot.querySelector(".inv-icon")?.outerHTML ?? "";
  ghost.style.display = "none";
  document.body.appendChild(ghost);
  drag = { area, index, ghost, startX: e.clientX, startY: e.clientY, moved: false, pointerId: e.pointerId };
  slot.classList.add("dragging");
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
}

function onPointerMove(e: PointerEvent): void {
  if (!drag || e.pointerId !== drag.pointerId) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 4) {
    drag.moved = true;
    drag.ghost.style.display = "flex";
  }
  if (drag.moved) {
    drag.ghost.style.left = `${e.clientX}px`;
    drag.ghost.style.top = `${e.clientY}px`;
    document.querySelectorAll(".inv-slot.drop-target").forEach((el) => el.classList.remove("drop-target"));
    targetSlot(e)?.classList.add("drop-target");
  }
}

function targetSlot(e: PointerEvent): HTMLElement | null {
  const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
  return under?.closest<HTMLElement>(".inv-slot") ?? null;
}

function onPointerUp(e: PointerEvent): void {
  if (!drag || e.pointerId !== drag.pointerId) return;
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("pointercancel", onPointerUp);
  const from = drag;
  drag = null;
  from.ghost.remove();
  document.querySelectorAll(".inv-slot.dragging, .inv-slot.drop-target").forEach((el) => el.classList.remove("dragging", "drop-target"));
  if (!from.moved) {
    // a click: pick the quick slot, or show the item's details; clicking a full Stanley cup drinks from it
    if (from.area === "quick") selectQuick(from.index);
    else showDetail(from.area, from.index);
    const clicked = listOf(from.area)[from.index]?.id;
    if (clicked === "water-bottle-full") drinkWaterBottle();
    if (clicked === "chromebook") openChromebook(loadCharacterProfile().name); // open the laptop at its login screen
    return;
  }
  const target = e.type === "pointerup" ? targetSlot(e) : null;
  if (!target) return; // dropped outside a slot: nothing changes
  moveItem(from.area, from.index, target.dataset.area as Area, Number(target.dataset.index));
}

function selectQuick(i: number): void {
  state.selected = i;
  save();
  render();
}

/** Move the stack in one slot to another: stack onto the same item, otherwise swap the two slots. */
function moveItem(fromArea: Area, fromIndex: number, toArea: Area, toIndex: number): void {
  if (fromArea === toArea && fromIndex === toIndex) return;
  const a = listOf(fromArea);
  const b = listOf(toArea);
  const src = a[fromIndex];
  const dst = b[toIndex];
  if (!src) return;
  // the pouch can't go inside itself (nor be swapped into it)
  if ((toArea === "pouch" && src.id === "pencil-pouch") || (fromArea === "pouch" && dst?.id === "pencil-pouch")) return;
  const def = itemById(src.id)!;
  if (dst && dst.id === src.id && dst.qty < def.stack) {
    const n = Math.min(src.qty, def.stack - dst.qty);
    dst.qty += n;
    src.qty -= n;
    if (src.qty <= 0) a[fromIndex] = null;
  } else {
    a[fromIndex] = dst;
    b[toIndex] = src;
  }
  if (toArea === "quick") state.selected = toIndex; // what you just put on the bar is ready to use
  save();
  render();
  if (panel) showDetail(toArea, toIndex);
}
