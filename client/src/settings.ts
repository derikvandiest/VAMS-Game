/**
 * Character Studio (creation + edit screen).
 *
 * Built for the Quaternius character models: each "look" is one rigged model
 * (outfit + hairstyle + face baked in). The player picks a name, gender,
 * look, skin tone, hair color and homeroom; the homeroom color tints the shirt.
 * A live, drag-to-rotate 3D preview uses the exact same rig as the game
 * (avatar.ts), so what you design is what you get.
 *
 * Public API (unchanged for callers): initSettingsModal(), openSettingsModal().
 */

import * as THREE from "three";
import { setLocalPlayerName } from "./chat";
import { createAvatarRig, AvatarRig, preloadAvatarAssets } from "./avatar";
import {
  ACCENT_COLORS,
  OUTFIT_COLORS,
  CharacterProfile,
  Gender,
  Homeroom,
  GENDERS,
  GLASSES,
  HAIR_COLORS,
  HOMEROOMS,
  HOMEROOM_INFO,
  MAX_NAME_LENGTH,
  SKIN_TONES,
  facialHairFor,
  hairStylesFor,
  hatsFor,
  looksForGender,
  loadCharacterProfile,
  getDefaultProfile,
  randomizeProfile,
  saveCharacterProfile,
  sanitizeProfile,
  shoesFor,
} from "./profile";

type SaveCb = (profile: CharacterProfile) => void;

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const THUMB_W = 96;
const THUMB_H = 128;

function addLights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a8, 1.9));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(2.5, 4, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xaac4ff, 0.8);
  rim.position.set(-3, 2, -3);
  scene.add(rim);
}

/** Renders small still images of every look using the player's current skin/hair/homeroom. */
class LookThumbs {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(28, THUMB_W / THUMB_H, 0.1, 30);
  private rig: AvatarRig | null = null;

  private init(): boolean {
    if (this.renderer) return true;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = THUMB_W * 2;
      canvas.height = THUMB_H * 2;
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(THUMB_W * 2, THUMB_H * 2, false);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.setClearColor(0x000000, 0);
    } catch {
      this.renderer = null;
      return false;
    }
    addLights(this.scene);
    this.rig = createAvatarRig();
    this.scene.add(this.rig.player);
    this.camera.position.set(0, 0.75, 3.5);
    this.camera.lookAt(0, 0.68, 0);
    return true;
  }

  /**
   * One PNG data URL per item: the character with `patch(item)` applied, framed by the camera
   * view ("full" body, "head" close-up or "feet"). Empty if WebGL is unavailable.
   */
  render<T extends { id: string }>(
    base: CharacterProfile,
    items: T[],
    patch: (item: T) => Partial<CharacterProfile>,
    view: "full" | "head" | "feet"
  ): Record<string, string> {
    const out: Record<string, string> = {};
    if (!this.init() || !this.renderer || !this.rig) return out;
    const cams = { full: [0.75, 3.5, 0.68], head: [1.12, 1.0, 1.1], feet: [0.2, 1.25, 0.1] } as const;
    const [y, z, ly] = cams[view];
    this.camera.position.set(0, y, z);
    this.camera.lookAt(0, ly, 0);
    for (const item of items) {
      this.rig.apply({ ...base, ...patch(item) });
      this.renderer.render(this.scene, this.camera);
      out[item.id] = this.renderer.domElement.toDataURL("image/png");
    }
    return out;
  }
}

export function initSettingsModal(onSave?: SaveCb): void {
  let current = loadCharacterProfile();
  let draft: CharacterProfile = { ...current };
  let currentOnSave: SaveCb | undefined = onSave;
  let isNewCharacter = false;
  type Tab = "look" | "hair" | "extras";
  let tab: Tab = "look";
  /** Thumbnails by group (look, hair, facial, hat, glasses, shoes) then item id */
  let thumbs: Record<string, Record<string, string>> = {};
  let thumbTimer = 0;
  const thumbRenderer = new LookThumbs();

  document.getElementById("settings-modal-overlay")?.remove();

  // ---- DOM ---------------------------------------------------------------------------------
  const overlay = document.createElement("div");
  overlay.id = "settings-modal-overlay";
  overlay.className = "cc-overlay";
  overlay.style.display = "none";
  overlay.innerHTML = `
    <div class="cc-card" role="dialog" aria-modal="true" aria-labelledby="cc-title">
      <div class="cc-stage">
        <canvas id="cc-canvas" aria-label="Character preview (drag to rotate)"></canvas>
        <div class="cc-stage-note" id="cc-stage-note">Drag to rotate</div>
        <div class="cc-stage-fallback" id="cc-stage-fallback" hidden>3D preview is not available on this device, but you can still create your character.</div>
      </div>
      <div class="cc-panel">
        <header class="cc-head">
          <h2 id="cc-title">Create Your Character</h2>
          <button type="button" class="cc-x" id="cc-close" aria-label="Close">&times;</button>
        </header>
        <div class="cc-top">
          <label class="cc-label" for="cc-name">Name</label>
          <input id="cc-name" class="cc-input" type="text" maxlength="${MAX_NAME_LENGTH}" autocomplete="off" spellcheck="false" placeholder="Your name" />
          <div class="cc-error" id="cc-error" role="alert"></div>
          <div class="cc-tabs" role="tablist">
            <button type="button" role="tab" class="cc-tab" data-tab="look">Look</button>
            <button type="button" role="tab" class="cc-tab" data-tab="hair">Hair</button>
            <button type="button" role="tab" class="cc-tab" data-tab="extras">Accessories</button>
          </div>
        </div>
        <div class="cc-scroll" id="cc-body"></div>
        <div class="cc-homeroom-bar">
          <div class="cc-label">Homeroom <span class="cc-hint">(shown on your name badge)</span></div>
          <div class="cc-homerooms" id="cc-homeroom" role="radiogroup" aria-label="Homeroom"></div>
        </div>
        <footer class="cc-foot">
          <button type="button" class="cc-btn cc-btn-ghost" id="cc-random">🎲 Randomize</button>
          <span class="cc-spacer"></span>
          <button type="button" class="cc-btn cc-btn-ghost" id="cc-cancel">Cancel</button>
          <button type="button" class="cc-btn cc-btn-primary" id="cc-save">Save &amp; Continue</button>
        </footer>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const $ = <T extends HTMLElement>(id: string): T => overlay.querySelector(`#${id}`) as T;
  const nameInput = $<HTMLInputElement>("cc-name");
  const errorEl = $("cc-error");
  const titleEl = $("cc-title");
  const saveBtn = $<HTMLButtonElement>("cc-save");
  const canvas = $<HTMLCanvasElement>("cc-canvas");
  const hudBtn = document.getElementById("settings-btn");

  // ---- 3D preview --------------------------------------------------------------------------
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let rig: AvatarRig | null = null;
  let pivot: THREE.Group | null = null;
  let rafId = 0;
  let rotY = 0.35;
  let dragging = false;
  let lastX = 0;
  let idleSince = 0;

  function ensurePreview(): void {
    if (renderer) return;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    } catch (err) {
      console.warn("Character preview unavailable:", err);
      renderer = null;
      canvas.style.display = "none";
      $("cc-stage-note").hidden = true;
      $("cc-stage-fallback").hidden = false;
      return;
    }
    scene = new THREE.Scene();
    addLights(scene);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.1, 48),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0.16 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.002;
    floor.receiveShadow = true;
    scene.add(floor);
    camera = new THREE.PerspectiveCamera(28, 1, 0.1, 40);
    camera.position.set(0, 0.95, 4.2);
    camera.lookAt(0, 0.75, 0);
    rig = createAvatarRig();
    pivot = new THREE.Group();
    pivot.add(rig.player);
    scene.add(pivot);
  }

  function resizePreview(): void {
    if (!renderer || !camera) return;
    const w = canvas.clientWidth || 400;
    const h = canvas.clientHeight || 500;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function loop(): void {
    rafId = requestAnimationFrame(loop);
    if (!renderer || !scene || !camera || !pivot) return;
    if (!dragging && performance.now() - idleSince > 1800) rotY += 0.006;
    pivot.rotation.y = rotY;
    renderer.render(scene, camera);
  }

  const onDown = (e: PointerEvent): void => {
    dragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent): void => {
    if (!dragging) return;
    rotY += (e.clientX - lastX) * 0.012;
    lastX = e.clientX;
    idleSince = performance.now();
  };
  const onUp = (): void => {
    dragging = false;
    idleSince = performance.now();
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);

  // ---- Controls ----------------------------------------------------------------------------
  const radioBtn = (attrs: string, on: boolean, cls: string, inner: string, label?: string): string =>
    `<button type="button" role="radio" aria-checked="${on}" class="${cls}${on ? " on" : ""}" ${attrs}${
      label ? ` title="${esc(label)}" aria-label="${esc(label)}"` : ""
    }>${inner}</button>`;

  /** Picker grid of items with optional thumbnails (group = thumbnail set, key = profile field). */
  function itemGrid(group: string, key: string, items: Array<{ id: string; name: string }>, selected: string): string {
    const html = items
      .map((it) => {
        const url = thumbs[group]?.[it.id];
        const img = url ? `<img src="${url}" alt="" />` : `<span class="cc-look-ph"></span>`;
        return radioBtn(`data-pick="${key}:${it.id}"`, selected === it.id, `cc-look cc-item-${group}`, `${img}<span>${esc(it.name)}</span>`);
      })
      .join("");
    return `<div class="cc-looks" role="radiogroup">${html}</div>`;
  }

  function swatches(key: string, colors: Array<{ name: string; hex: string }>, selected: string, extra = ""): string {
    const chips = colors
      .map((c) =>
        radioBtn(`data-color="${key}:${c.hex}" style="background:${c.hex}"`, c.hex.toLowerCase() === selected.toLowerCase(), "cc-sw", "", c.name)
      )
      .join("");
    return `<div class="cc-swatches" role="radiogroup">${extra}${chips}</div>`;
  }

  // ---- Color wheel ---------------------------------------------------------------------------
  // Every color setting (outfit, hair, glasses, shoes) has preset swatches plus a "custom" swatch that opens
  // a color wheel (hue around, saturation outward) with a brightness slider.
  let wheelKey: string | null = null;
  let wheel = { h: 0, s: 1, v: 1 };
  const WHEEL = 176;

  function hsvToHex(h: number, s: number, v: number): string {
    const f = (n: number): number => {
      const k = (n + h / 60) % 6;
      return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    };
    const to = (x: number): string => Math.round(x * 255).toString(16).padStart(2, "0");
    return `#${to(f(5))}${to(f(3))}${to(f(1))}`;
  }
  function hexToHsv(hex: string): { h: number; s: number; v: number } {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const d = max - Math.min(r, g, b);
    let h = 0;
    if (d > 0) {
      if (max === r) h = 60 * (((g - b) / d + 6) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
    }
    return { h, s: max === 0 ? 0 : d / max, v: max };
  }

  /** Preset swatches + the custom (wheel) swatch, with the wheel panel below when it is open for this key. */
  function colorControl(key: string, colors: Array<{ name: string; hex: string }>, selected: string, extra = ""): string {
    const isPreset = colors.some((c) => c.hex.toLowerCase() === selected.toLowerCase());
    const custom = `<button type="button" class="cc-sw cc-sw-wheel${!isPreset ? " on" : ""}${wheelKey === key ? " open" : ""}" data-wheel-toggle="${key}" title="Custom color" aria-label="Custom color wheel" aria-expanded="${wheelKey === key}"${
      !isPreset ? ` style="--custom:${selected}"` : ""
    }></button>`;
    const chips = colors
      .map((c) => radioBtn(`data-color="${key}:${c.hex}" style="background:${c.hex}"`, c.hex.toLowerCase() === selected.toLowerCase(), "cc-sw", "", c.name))
      .join("");
    const panel =
      wheelKey === key
        ? `<div class="cc-wheel-panel">
             <canvas class="cc-wheel" id="cc-wheel" width="${WHEEL}" height="${WHEEL}" aria-label="Color wheel"></canvas>
             <div class="cc-wheel-side">
               <div class="cc-wheel-preview" id="cc-wheel-preview" style="background:${selected}"></div>
               <div class="cc-wheel-hex" id="cc-wheel-hex">${selected.toUpperCase()}</div>
               <label class="cc-wheel-label" for="cc-wheel-v">Brightness</label>
               <input type="range" id="cc-wheel-v" min="0" max="100" value="${Math.round(wheel.v * 100)}" />
             </div>
           </div>`
        : "";
    return `<div class="cc-swatches" role="radiogroup">${extra}${chips}${custom}</div>${panel}`;
  }

  function drawWheel(): void {
    const c = overlay.querySelector<HTMLCanvasElement>("#cc-wheel");
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(WHEEL, WHEEL);
    const R = WHEEL / 2;
    for (let y = 0; y < WHEEL; y++) {
      for (let x = 0; x < WHEEL; x++) {
        const dx = x + 0.5 - R;
        const dy = y + 0.5 - R;
        const r = Math.hypot(dx, dy);
        const i = (y * WHEEL + x) * 4;
        if (r > R) {
          img.data[i + 3] = 0;
          continue;
        }
        const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
        const hex = hsvToHex(hue, Math.min(1, r / (R - 1)), wheel.v);
        img.data[i] = parseInt(hex.slice(1, 3), 16);
        img.data[i + 1] = parseInt(hex.slice(3, 5), 16);
        img.data[i + 2] = parseInt(hex.slice(5, 7), 16);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // marker at the current hue / saturation
    const a = (wheel.h * Math.PI) / 180;
    const mx = R + Math.cos(a) * wheel.s * (R - 1);
    const my = R + Math.sin(a) * wheel.s * (R - 1);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(mx, my, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#000000";
    ctx.beginPath();
    ctx.arc(mx, my, 9.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  /** Apply the wheel color without rebuilding the controls (so a drag is never interrupted). */
  function applyWheel(): void {
    if (!wheelKey) return;
    const hex = hsvToHex(wheel.h, wheel.s, wheel.v);
    const name = nameInput.value.slice(0, MAX_NAME_LENGTH);
    draft = sanitizeProfile({ ...draft, [wheelKey]: hex });
    draft.name = name;
    refreshPreview();
    const prev = overlay.querySelector<HTMLElement>("#cc-wheel-preview");
    if (prev) prev.style.background = hex;
    const label = overlay.querySelector<HTMLElement>("#cc-wheel-hex");
    if (label) label.textContent = hex.toUpperCase();
    const sw = overlay.querySelector<HTMLElement>(".cc-sw-wheel.open");
    if (sw) {
      sw.style.setProperty("--custom", hex);
      sw.classList.add("on");
    }
    drawWheel();
  }

  let wheelDragging = false;
  function wheelFromPointer(e: PointerEvent): void {
    const c = e.currentTarget as HTMLCanvasElement;
    const rect = c.getBoundingClientRect();
    const R = rect.width / 2;
    const dx = e.clientX - rect.left - R;
    const dy = e.clientY - rect.top - R;
    wheel.h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    wheel.s = Math.min(1, Math.hypot(dx, dy) / (R * ((WHEEL - 1) / WHEEL)));
    applyWheel();
  }

  const section = (title: string, html: string): string => `<div class="cc-label">${title}</div>${html}`;

  function renderControls(): void {
    for (const el of overlay.querySelectorAll<HTMLElement>(".cc-tab")) {
      const on = el.dataset.tab === tab;
      el.classList.toggle("on", on);
      el.setAttribute("aria-selected", String(on));
    }

    const g = draft.gender;
    let body = "";
    if (tab === "look") {
      body += section(
        "Gender",
        `<div class="cc-seg" role="radiogroup">${GENDERS.map((x) =>
          radioBtn(`data-gender="${x.id}"`, draft.gender === x.id, "cc-seg-btn", esc(x.label))
        ).join("")}</div>`
      );
      body += section("Look", itemGrid("look", "look", looksForGender(g), draft.look));
      body += section("Outfit color", colorControl("outfitColor", OUTFIT_COLORS, draft.outfitColor));
      body += section("Skin tone", swatches("skinTone", SKIN_TONES.map((s) => ({ name: s.label, hex: s.hex })), draft.skinTone));
    } else if (tab === "hair") {
      body += section("Hairstyle", itemGrid("hair", "hairStyle", hairStylesFor(g), draft.hairStyle));
      if (g === "masculine") body += section("Facial hair", itemGrid("facial", "facialHair", facialHairFor(g), draft.facialHair));
      body += section("Hair color", colorControl("hairColor", HAIR_COLORS.map((h) => ({ name: h.label, hex: h.hex })), draft.hairColor));
    } else {
      const hats = hatsFor(g);
      body += section("Hat", itemGrid("hat", "hat", hats, draft.hat));
      body += section("Glasses", itemGrid("glasses", "glasses", GLASSES, draft.glasses));
      if (draft.glasses !== "none") body += section("Frame color", colorControl("glassesColor", ACCENT_COLORS, draft.glassesColor));
      body += section("Shoes", itemGrid("shoes", "shoes", shoesFor(g), draft.shoes));
      body += section("Shoe color", colorControl("shoeColor", ACCENT_COLORS, draft.shoeColor));
    }
    const bodyEl = $("cc-body");
    const scrollTop = bodyEl.scrollTop;
    bodyEl.innerHTML = body;
    bodyEl.scrollTop = scrollTop;
    drawWheel();

    $("cc-homeroom").innerHTML = HOMEROOMS.map((h) =>
      radioBtn(
        `data-homeroom="${h}"`,
        draft.homeroom === h,
        "cc-hr",
        `<span class="cc-hr-dot" style="background:${HOMEROOM_INFO[h].shirtColor}"></span>${h}`
      )
    ).join("");
  }

  function refreshPreview(): void {
    ensurePreview();
    rig?.apply(draft);
  }

  /** Re-render the thumbnails of the visible tab (debounced; they depend on the whole draft). */
  function scheduleThumbs(): void {
    window.clearTimeout(thumbTimer);
    thumbTimer = window.setTimeout(() => {
      void preloadAvatarAssets().then(() => {
        if (overlay.style.display !== "flex") return;
        const base = draft;
        const g = base.gender;
        const R = thumbRenderer;
        if (tab === "look") {
          thumbs.look = R.render(base, looksForGender(g), (l) => ({ look: l.id }), "full");
        } else if (tab === "hair") {
          thumbs.hair = R.render(base, hairStylesFor(g), (h) => ({ hairStyle: h.id }), "head");
          if (g === "masculine") thumbs.facial = R.render(base, facialHairFor(g), (f) => ({ facialHair: f.id }), "head");
        } else {
          thumbs.hat = R.render(base, hatsFor(g), (h) => ({ hat: h.id }), "head");
          thumbs.glasses = R.render(base, GLASSES, (x) => ({ glasses: x.id }), "head");
          thumbs.shoes = R.render(base, shoesFor(g), (x) => ({ shoes: x.id }), "feet");
        }
        renderControls();
      });
    }, 150);
  }

  function setDraft(patch: Partial<CharacterProfile>, thumbsChanged = true): void {
    draft = sanitizeProfile({ ...draft, ...patch });
    // sanitizeProfile trims the name; keep what the player is typing
    draft.name = nameInput.value.slice(0, MAX_NAME_LENGTH);
    renderControls();
    refreshPreview();
    if (thumbsChanged) scheduleThumbs();
  }

  overlay.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest("button") as HTMLElement | null;
    if (!t) {
      if (e.target === overlay) closeModal();
      return;
    }
    const d = t.dataset;
    if (d.tab) wheelKey = null; // the wheel closes when switching tabs
    if (d.wheelToggle) {
      const key = d.wheelToggle;
      wheelKey = wheelKey === key ? null : key;
      if (wheelKey) wheel = hexToHsv((draft as unknown as Record<string, string>)[key] || "#ffffff");
      renderControls();
      overlay.querySelector(".cc-wheel-panel")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else if (d.tab) {
      tab = d.tab as Tab;
      renderControls();
      scheduleThumbs();
    } else if (d.gender) {
      const gender = d.gender as Gender;
      if (gender !== draft.gender) setDraft({ gender, look: looksForGender(gender)[0].id });
    } else if (d.pick) {
      const [key, ...rest] = d.pick.split(":");
      setDraft({ [key]: rest.join(":") } as Partial<CharacterProfile>);
    } else if (d.color !== undefined) {
      const [key, ...rest] = d.color.split(":");
      setDraft({ [key]: rest.join(":") } as Partial<CharacterProfile>);
    } else if (d.homeroom) {
      setDraft({ homeroom: d.homeroom as Homeroom });
    }
  });

  // Color wheel interaction (delegated: the wheel is re-created whenever the controls re-render)
  overlay.addEventListener("pointerdown", (e) => {
    const c = e.target as HTMLElement;
    if (c.id !== "cc-wheel") return;
    wheelDragging = true;
    c.setPointerCapture(e.pointerId);
    wheelFromPointer(e);
  });
  overlay.addEventListener("pointermove", (e) => {
    if (wheelDragging && (e.target as HTMLElement).id === "cc-wheel") wheelFromPointer(e);
  });
  const endWheelDrag = (): void => {
    if (!wheelDragging) return;
    wheelDragging = false;
    renderControls(); // refresh the selected swatch states
    scheduleThumbs();
  };
  overlay.addEventListener("pointerup", endWheelDrag);
  overlay.addEventListener("pointercancel", endWheelDrag);
  overlay.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id !== "cc-wheel-v") return;
    wheel.v = Number(t.value) / 100;
    applyWheel();
  });
  overlay.addEventListener("change", (e) => {
    if ((e.target as HTMLElement).id === "cc-wheel-v") {
      renderControls();
      scheduleThumbs();
    }
  });

  nameInput.addEventListener("input", () => {
    draft.name = nameInput.value.slice(0, MAX_NAME_LENGTH);
    errorEl.textContent = "";
    nameInput.classList.remove("bad");
  });
  // Typing a name must never trigger game hotkeys (WASD, M, R, E, Space)
  for (const type of ["keydown", "keyup", "keypress"] as const) {
    nameInput.addEventListener(type, (e) => {
      const ke = e as KeyboardEvent;
      if (type === "keydown" && ke.key === "Enter") {
        e.preventDefault();
        saveAndClose();
      } else if (type === "keydown" && ke.key === "Escape") {
        closeModal();
      }
      e.stopPropagation();
    });
  }

  $("cc-random").addEventListener("click", () => {
    setDraft(randomizeProfile(draft), true);
  });
  $("cc-close").addEventListener("click", () => closeModal());
  $("cc-cancel").addEventListener("click", () => closeModal());
  saveBtn.addEventListener("click", () => saveAndClose());

  // ---- Open / close / save ------------------------------------------------------------------
  function openModal(customOnSave?: SaveCb): void {
    currentOnSave = customOnSave ?? onSave;
    isNewCharacter = !!customOnSave;
    // a new character starts from the defaults (first outfit, first hairstyle, no accessories)
    current = isNewCharacter ? getDefaultProfile() : loadCharacterProfile();
    draft = { ...current };
    nameInput.value = draft.name;
    errorEl.textContent = "";
    nameInput.classList.remove("bad");
    titleEl.textContent = isNewCharacter ? "Create Your Character" : "Edit Your Character";
    saveBtn.textContent = isNewCharacter ? "Start Playing" : "Save";
    rotY = 0.35;
    idleSince = performance.now();
    thumbs = {};
    tab = "look";
    overlay.style.display = "flex";
    renderControls();
    ensurePreview();
    resizePreview();
    refreshPreview();
    cancelAnimationFrame(rafId);
    loop();
    scheduleThumbs();
    window.setTimeout(() => nameInput.focus(), 50);
  }

  function closeModal(): void {
    window.clearTimeout(thumbTimer);
    cancelAnimationFrame(rafId);
    overlay.style.display = "none";
  }

  function saveAndClose(): void {
    const name = nameInput.value.trim();
    if (!name) {
      errorEl.textContent = "Please enter a name for your character.";
      nameInput.classList.add("bad");
      nameInput.focus();
      return;
    }
    current = sanitizeProfile({ ...draft, name });
    saveCharacterProfile(current);
    setLocalPlayerName(current.name);
    const cb = currentOnSave;
    closeModal();
    if (cb) cb(current);
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.style.display === "flex") closeModal();
  });
  window.addEventListener("resize", () => {
    if (overlay.style.display === "flex") resizePreview();
  });

  if (hudBtn) hudBtn.onclick = () => openModal();
  (window as unknown as { __openCharacterStudio?: (cb?: SaveCb) => void }).__openCharacterStudio = openModal;
}

export function openSettingsModal(onSave?: SaveCb): void {
  const fn = (window as unknown as { __openCharacterStudio?: (cb?: SaveCb) => void }).__openCharacterStudio;
  if (fn) fn(onSave);
}
