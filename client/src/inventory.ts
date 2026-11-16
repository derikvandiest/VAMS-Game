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
import { getActiveSlotId } from "./saveManager";
import { loadCharacterProfile, saveCharacterProfile } from "./profile";

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  stack: number;
  starter?: boolean;
}
interface Stack {
  id: string;
  qty: number;
}
type Slot = Stack | null;
type Area = "quick" | "bag";

export const ITEMS: ItemDef[] = (itemsData as { items: ItemDef[] }).items;
const itemById = (id: string): ItemDef | undefined => ITEMS.find((i) => i.id === id);

const QUICK_SLOTS = 5;
const BAG_SLOTS = 20;

const state: { quick: Slot[]; bag: Slot[]; selected: number; backpack: string | null; starterGiven: boolean } = {
  quick: new Array(QUICK_SLOTS).fill(null),
  bag: new Array(BAG_SLOTS).fill(null),
  selected: 0,
  backpack: null, // the color of the backpack the player picked up (null = none yet: no inventory)
  starterGiven: false,
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
  state.selected = 0;
  state.backpack = null;
  state.starterGiven = false;
  try {
    const raw = localStorage.getItem(storageKey());
    if (raw) {
      const d = JSON.parse(raw);
      state.quick = sanitize(d.quick, QUICK_SLOTS);
      state.bag = sanitize(d.bag, BAG_SLOTS);
      state.selected = Math.max(0, Math.min(QUICK_SLOTS - 1, Number(d.selected) || 0));
      state.backpack = typeof d.backpack === "string" && /^#[0-9a-fA-F]{6}$/.test(d.backpack) ? d.backpack : null;
      state.starterGiven = d.starterGiven === true || state.quick.some(Boolean) || state.bag.some(Boolean);
    }
  } catch {
    /* start fresh */
  }
  wearBackpack(state.backpack);
}

/** Show the backpack on the character (the profile carries it, so other players see it too) */
function wearBackpack(color: string | null): void {
  const p = loadCharacterProfile();
  if ((p.backpack || "") !== (color || "")) saveCharacterProfile({ ...p, backpack: color || "" });
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
  if (!state.starterGiven) {
    state.starterGiven = true;
    ITEMS.filter((i) => i.starter).forEach((i) => {
      const k = state.bag.indexOf(null);
      if (k >= 0) state.bag[k] = { id: i.id, qty: 1 };
    });
  }
  save();
  wearBackpack(color);
  render();
}

function save(): void {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(state));
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
  return [...state.quick, ...state.bag].reduce((n, s) => n + (s && s.id === id ? s.qty : 0), 0);
}

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
  }
  buildBar();
  render();
}

/** Hide everything (leaving the game). */
export function stopInventory(): void {
  closeBackpack();
  bar?.remove();
  bar = null;
}

// ---------------------------------------------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------------------------------------------
const listOf = (area: Area): Slot[] => (area === "quick" ? state.quick : state.bag);
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function slotHtml(area: Area, i: number, s: Slot): string {
  const def = s ? itemById(s.id) : undefined;
  const sel = area === "quick" && i === state.selected ? " selected" : "";
  const key = area === "quick" ? `<span class="inv-key">${i + 1}</span>` : "";
  const body = def
    ? `<span class="inv-icon">${def.icon}</span>${s!.qty > 1 ? `<span class="inv-qty">${s!.qty}</span>` : ""}`
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
    const used = state.bag.filter(Boolean).length;
    panel.querySelector(".inv-count")!.textContent = `${used} / ${BAG_SLOTS}`;
  }
}

function showDetail(area: Area, i: number): void {
  if (!panel) return;
  const s = listOf(area)[i];
  const def = s ? itemById(s.id) : undefined;
  const box = panel.querySelector<HTMLElement>(".inv-detail")!;
  box.innerHTML = def
    ? `<div class="inv-detail-icon">${def.icon}</div><div><div class="inv-detail-name">${esc(def.name)}${s!.qty > 1 ? ` <span>×${s!.qty}</span>` : ""}</div><div class="inv-detail-desc">${esc(def.description)}</div></div>`
    : `<div class="inv-detail-desc">Drag items onto the quick bar at the bottom of the screen to keep them handy. Keys <b>1–5</b> pick a quick slot.</div>`;
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
    <div class="inv-grid"></div>
    <div class="inv-detail"></div>
    <div class="inv-foot">Drag items to and from the quick bar · <kbd>I</kbd> or <kbd>Esc</kbd> to close</div>`;
  document.body.appendChild(panel);
  panel.querySelector(".inv-close")!.addEventListener("click", closeBackpack);
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
    // a click: pick the quick slot, or show the item's details
    if (from.area === "quick") selectQuick(from.index);
    else showDetail(from.area, from.index);
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
