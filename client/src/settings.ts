/**
 * Ultimate Character Studio (Option 5 — Avaturn Realistic 3D Avatar Creator & 24-Hairstyle Configurator).
 *
 * Features:
 * - Photorealistic adult 3D educator models (`avatarsdk.glb`, `avaturn_female.glb`, `brunette.glb`, `default_model.glb`).
 * - 24 local 3D hairstyles (including photorealistic Avaturn textured hair + sculpted 3D hair meshes)
 *   rigidly bound and calibrated to the realistic cranium (`Head` bone).
 * - Full color customization for skin tone, hair color, shirt/jacket color, pants color, shoes, eyewear, and headwear.
 * - Embedded official `@avaturn/sdk` Web 3D Avatar Creator (`https://demo.avaturn.dev`) + custom `.glb` file import
 *   stored locally in IndexedDB.
 */

import * as THREE from "three";
import { AvaturnSDK } from "@avaturn/sdk";
import { setLocalPlayerName } from "./chat";
import {
  createAvatarRig,
  AvatarRig,
  preloadAvatarAssets,
  areAvatarAssetsReady,
} from "./avatar";
import {
  CharacterProfile,
  Gender,
  Homeroom,
  HairCategory,
  HOMEROOMS,
  HOMEROOM_INFO,
  SKIN_TONES,
  HEAD_STYLES,
  HAIR_STYLES,
  HAIR_COLORS,
  TOP_STYLES,
  SHIRT_COLORS,
  PANTS_COLORS,
  SHOE_COLORS,
  GLASSES_OPTIONS,
  GLASSES_COLORS,
  HEADWEAR_OPTIONS,
  HAT_COLORS,
  EARRING_OPTIONS,
  SHOE_STYLES,
  BOTTOM_STYLES,
  FACIAL_HAIR_OPTIONS,
  loadCharacterProfile,
  saveCharacterProfile,
  randomizeProfile,
  saveCustomAvatarGlb,
  clearCustomAvatarGlb,
} from "./profile";

export * from "./profile";

type ThumbKind =
  | "head"
  | "hair"
  | "facial"
  | "glasses"
  | "headwear"
  | "earrings"
  | "top"
  | "bottoms"
  | "shoes";

type CameraView = "full" | "head" | "face" | "upper" | "lower" | "shoes";
type Swatch = { label: string; hex: string };

const ICONS = {
  user: '<svg class="cs-ico" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>',
  hair: '<svg class="cs-ico" viewBox="0 0 24 24"><path d="M4 13a8 8 0 0 1 16 0v7h-4v-6l-3-3-5 2-1 7H4z"/></svg>',
  face: '<svg class="cs-ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><circle cx="9" cy="10" r="0.8"/><circle cx="15" cy="10" r="0.8"/></svg>',
  shirt: '<svg class="cs-ico" viewBox="0 0 24 24"><path d="M8 3 3 6l2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z"/></svg>',
  pants: '<svg class="cs-ico" viewBox="0 0 24 24"><path d="M6 3h12l1 18h-5l-2-11-2 11H5L6 3z"/></svg>',
  shoes: '<svg class="cs-ico" viewBox="0 0 24 24"><path d="M3 16l2-7h5l3 4h6a2 2 0 0 1 2 2v3H3v-2z"/></svg>',
  glasses: '<svg class="cs-ico" viewBox="0 0 24 24"><circle cx="6.5" cy="14.5" r="3.5"/><circle cx="17.5" cy="14.5" r="3.5"/><path d="M10 14.5h4M3 14l2-6M21 14l-2-6"/></svg>',
  dice: '<svg class="cs-ico" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.1"/><circle cx="15" cy="9" r="1.1"/><circle cx="9" cy="15" r="1.1"/><circle cx="15" cy="15" r="1.1"/></svg>',
  spin: '<svg class="cs-ico" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>',
  sparkles: '<svg class="cs-ico" viewBox="0 0 24 24"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M5 19l.9 2.1L8 22l-2.1.9L5 25l-.9-2.1L2 22l2.1-.9L5 19z"/></svg>',
};

const TABS: Array<{ id: string; label: string; icon: string; cam: CameraView }> = [
  { id: "identity", label: "Identity", icon: ICONS.user, cam: "full" },
  { id: "hair", label: "Hair", icon: ICONS.hair, cam: "head" },
  { id: "face", label: "Face", icon: ICONS.face, cam: "face" },
  { id: "top", label: "Top", icon: ICONS.shirt, cam: "upper" },
  { id: "bottom", label: "Bottom", icon: ICONS.pants, cam: "lower" },
  { id: "shoes", label: "Shoes", icon: ICONS.shoes, cam: "shoes" },
  { id: "gear", label: "Gear", icon: ICONS.glasses, cam: "head" },
];

const CAMERA_PRESETS: Record<CameraView, { pos: [number, number, number]; target: [number, number, number] }> = {
  full: { pos: [0, 0.96, 3.35], target: [0, 0.86, 0] },
  head: { pos: [0, 1.52, 0.92], target: [0, 1.48, 0] },
  face: { pos: [0, 1.50, 0.72], target: [0, 1.47, 0] },
  upper: { pos: [0, 1.14, 1.65], target: [0, 1.06, 0] },
  lower: { pos: [0, 0.52, 1.78], target: [0, 0.45, 0] },
  shoes: { pos: [0, 0.20, 1.12], target: [0, 0.08, 0] },
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const sameHex = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Determines whether a hex color is bright so we can use a dark checkmark on light swatches. */
function isLightHex(hex: string): boolean {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 0.68;
}

/** Renders crisp 3D thumbnails for every modular GLB option directly from the realistic Avaturn avatar rig. */
class ThumbRenderer {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
  private rig: AvatarRig | null = null;
  private cache = new Map<string, string>();

  clearCache(): void {
    this.cache.clear();
  }

  private init(): boolean {
    if (this.renderer) return true;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch {
      return false;
    }
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(180, 180, false);
    this.renderer.setClearColor(0x000000, 0);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x64748b, 1.35));
    const key = new THREE.DirectionalLight(0xffffff, 1.85);
    key.position.set(2.2, 3.2, 4.2);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x93c5fd, 0.95);
    rim.position.set(-2.5, 2.0, -2.5);
    this.scene.add(rim);
    this.rig = createAvatarRig();
    this.scene.add(this.rig.player);
    return true;
  }

  get(kind: ThumbKind, id: string, p: CharacterProfile): string {
    const ready = areAvatarAssetsReady();
    const key = [
      ready ? "r6_avaturn" : "r0_avaturn",
      kind,
      id,
      p.gender,
      p.headStyle,
      p.skinTone,
      p.hairColor,
      p.hairHighlight,
      p.shirtColor,
      p.pantsColor,
      p.shoesColor,
      p.glassesColor,
      p.hatColor,
      p.customAvatarUrl || "",
      kind === "hair" ? "" : p.hairStyle,
    ].join("|");
    const hit = this.cache.get(key);
    if (hit) return hit;
    if (!this.init() || !this.rig || !this.renderer) return "";

    const rig = this.rig;
    const t: CharacterProfile = { ...p, name: "x" };

    const s = p.gender === "girl" ? 0.96 : 1.0;
    let cy = p.gender === "girl" ? 1.475 : 1.515;
    let dist = 0.85;
    let rotY = -0.32;
    let lookDy = 0;

    switch (kind) {
      case "head":
        t.headStyle = id as CharacterProfile["headStyle"];
        t.glasses = "none";
        t.headwear = "none";
        t.facialHair = "none";
        cy = p.gender === "girl" ? 1.47 : 1.51;
        dist = 0.78;
        rotY = -0.22;
        lookDy = -0.01;
        break;
      case "hair": {
        t.hairStyle = id as CharacterProfile["hairStyle"];
        t.glasses = "none";
        t.headwear = "none";
        t.facialHair = "none";
        const long = [
          "Hair.Afro",
          "Hair.Dreads",
          "Hair.LongWaves",
          "Hair.Bob",
          "Hair.Braids",
          "Avaturn.LongWaves",
          "Avaturn.ShoulderLob",
        ].includes(id);
        lookDy = long ? -0.025 : 0.015;
        dist = long ? 0.98 : 0.82;
        rotY = ["Hair.Afro", "Hair.Braids", "Hair.Dreads"].includes(id)
          ? -0.55
          : -0.34;
        break;
      }
      case "facial":
        t.facialHair = id as CharacterProfile["facialHair"];
        t.glasses = "none";
        dist = 0.68;
        rotY = -0.26;
        lookDy = -0.045;
        break;
      case "glasses":
        t.glasses = id as CharacterProfile["glasses"];
        t.headwear = "none";
        dist = 0.68;
        rotY = -0.28;
        lookDy = 0.0;
        break;
      case "headwear":
        t.headwear = id as CharacterProfile["headwear"];
        dist = 0.94;
        rotY = id.startsWith("Bow.") ? -2.4 : -0.35;
        lookDy = id.startsWith("Bow.") ? -0.02 : 0.04;
        break;
      case "earrings":
        t.earrings = id as CharacterProfile["earrings"];
        t.headwear = "none";
        dist = 0.65;
        rotY = -0.82;
        lookDy = -0.02;
        break;
      case "top":
        t.topStyle = id as CharacterProfile["topStyle"];
        cy = 1.12 * s;
        dist = 1.55;
        rotY = -0.32;
        break;
      case "bottoms":
        t.bottoms = id as CharacterProfile["bottoms"];
        cy = 0.48 * s;
        dist = 1.65;
        rotY = -0.35;
        break;
      case "shoes":
        t.shoeStyle = id as CharacterProfile["shoeStyle"];
        cy = 0.09 * s;
        dist = 0.92;
        rotY = -0.72;
        break;
    }

    rig.setStudioPose?.(null);
    rig.apply(t);
    rig.player.rotation.y = rotY;
    rig.player.updateMatrixWorld(true);
    rig.syncSkeleton?.();

    const ty = cy + lookDy;
    this.camera.position.set(0, ty + dist * 0.05, dist);
    this.camera.lookAt(0, ty, 0);
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL("image/png");
    if (ready) {
      this.cache.set(key, url);
    }
    return url;
  }
}

export function initSettingsModal(onSave?: (profile: CharacterProfile) => void): void {
  let current = loadCharacterProfile();
  let draft: CharacterProfile = { ...current };
  let activeTab = "identity";
  let hairFilter: "all" | HairCategory = "all";
  let cameraView: CameraView = "full";
  let avaturnSdk: AvaturnSDK | null = null;
  const thumbs = new ThumbRenderer();

  const existingOverlay = document.getElementById("settings-modal-overlay");
  if (existingOverlay) existingOverlay.remove();

  // ---- DOM --------------------------------------------------------------------------------
  const overlay = document.createElement("div");
  overlay.id = "settings-modal-overlay";
  overlay.className = "cs-overlay";
  overlay.style.display = "none";
  overlay.innerHTML = `
    <div class="cs-modal" role="dialog" aria-modal="true" aria-labelledby="cs-title">
      <header class="cs-header">
        <div class="cs-brand">
          <span class="cs-logo">${ICONS.sparkles}</span>
          <div>
            <h2 id="cs-title">Character Studio</h2>
            <p>Customize your 3D educator appearance</p>
          </div>
        </div>
        <button id="settings-close-x" class="cs-icon-btn" type="button" aria-label="Close">&#10005;</button>
      </header>

      <div class="cs-body">
        <aside class="cs-preview">
          <div class="cs-stage">
            <!-- Floating Camera Framing Bar -->
            <div class="cs-cam-bar" id="cs-cam-bar">
              <button type="button" class="cs-cam-pill active" data-cam="full">Full</button>
              <button type="button" class="cs-cam-pill" data-cam="head">Head</button>
              <button type="button" class="cs-cam-pill" data-cam="face">Face</button>
              <button type="button" class="cs-cam-pill" data-cam="upper">Top</button>
              <button type="button" class="cs-cam-pill" data-cam="lower">Bottom</button>
              <button type="button" class="cs-cam-pill" data-cam="shoes">Shoes</button>
            </div>

            <canvas id="cs-canvas"></canvas>

            <span class="cs-stage-hint">Drag to rotate &bull; Scroll to zoom</span>
          </div>

          <div class="cs-idcard">
            <span id="cs-chip" class="cs-chip"></span>
            <strong id="cs-name-out"></strong>
            <span id="cs-gender-tag" class="cs-gender-tag"></span>
          </div>

          <div class="cs-preview-actions">
            <button id="cs-random" class="cs-btn cs-btn-accent" type="button">${ICONS.dice}<span>Randomize Look</span></button>
            <button id="cs-spin" class="cs-btn cs-btn-ghost cs-toggle" type="button" title="Toggle auto-rotate">${ICONS.spin}</button>
          </div>
        </aside>

        <section class="cs-panel">
          <nav class="cs-tabs" role="tablist" id="cs-tabs"></nav>
          <div class="cs-tab-body" id="cs-tab-body"></div>
        </section>
      </div>

      <footer class="cs-footer">
        <span class="cs-footnote">Saved locally on this computer &bull; Powered by Avaturn 3D &amp; Three.js</span>
        <div class="cs-footer-actions">
          <button id="settings-cancel-btn" class="cs-btn cs-btn-ghost" type="button">Cancel</button>
          <button id="settings-save-btn" class="cs-btn cs-btn-primary" type="button">Save &amp; Apply</button>
        </div>
      </footer>
    </div>
  `;
  document.body.appendChild(overlay);

  const hudBtn =
    (document.getElementById("settings-btn") as HTMLButtonElement | null) ||
    (document.getElementById("hud-settings-btn") as HTMLButtonElement | null);

  // Once all GLB assets finish preloading, refresh thumbnails so every card displays its 3D mesh
  preloadAvatarAssets().then(() => {
    thumbs.clearCache();
    if (overlay.style.display !== "none") {
      if (activeTab !== "avaturn") renderBody();
      refreshPreview();
    }
  });

  // ---- 3D Studio Preview Stage ------------------------------------------------------------
  const canvas = overlay.querySelector("#cs-canvas") as HTMLCanvasElement;
  const tabNav = overlay.querySelector("#cs-tabs") as HTMLElement;
  const tabBody = overlay.querySelector("#cs-tab-body") as HTMLElement;
  const chipEl = overlay.querySelector("#cs-chip") as HTMLElement;
  const nameOut = overlay.querySelector("#cs-name-out") as HTMLElement;
  const genderTagEl = overlay.querySelector("#cs-gender-tag") as HTMLElement;
  const spinBtn = overlay.querySelector("#cs-spin") as HTMLButtonElement;
  const camBar = overlay.querySelector("#cs-cam-bar") as HTMLElement;

  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let previewRig: AvatarRig | null = null;
  let animId: number | null = null;
  let rotY = 0.24;
  let autoSpin = false;
  let dragging = false;
  let dragX = 0;
  let zoomOffset = 0;

  const currentCamPos = new THREE.Vector3(...CAMERA_PRESETS.full.pos);
  const currentCamTarget = new THREE.Vector3(...CAMERA_PRESETS.full.target);

  function destroyAvaturnSdk(): void {
    if (avaturnSdk) {
      try {
        avaturnSdk.destroy();
      } catch {
        // ignore cleanup errors
      }
      avaturnSdk = null;
    }
  }

  function setCameraView(view: CameraView): void {
    cameraView = view;
    zoomOffset = 0;
    camBar.querySelectorAll<HTMLButtonElement>(".cs-cam-pill").forEach((b) => {
      b.classList.toggle("active", b.dataset.cam === view);
    });
  }

  camBar.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-cam]");
    if (btn && btn.dataset.cam) {
      setCameraView(btn.dataset.cam as CameraView);
    }
  });

  function ensurePreview(): void {
    if (renderer) return;
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
    camera.position.copy(currentCamPos);
    camera.lookAt(currentCamTarget);

    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    } catch (err) {
      console.warn("Character Studio 3D preview unavailable:", err);
      renderer = null;
      return;
    }

    // Balanced studio lighting for accurate PBR color reproduction
    scene.add(new THREE.AmbientLight(0xffffff, 0.72));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x475569, 1.2));
    const key = new THREE.DirectionalLight(0xfffaf0, 1.75);
    key.position.set(2.6, 4.2, 3.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x93c5fd, 0.75);
    fill.position.set(-2.8, 2.2, 1.6);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xc4b5fd, 0.85);
    rim.position.set(0, 2.6, -2.8);
    scene.add(rim);

    // Studio pedestal disc with glowing ring
    const ped = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.76, 0.08, 48),
      new THREE.MeshStandardMaterial({ color: 0x1e2538, roughness: 0.35, metalness: 0.45 })
    );
    disc.position.y = -0.04;
    disc.receiveShadow = true;
    ped.add(disc);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.70, 0.015, 12, 64),
      new THREE.MeshStandardMaterial({
        color: 0x60a5fa,
        emissive: 0x3b82f6,
        emissiveIntensity: 0.85,
        roughness: 0.2,
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.002;
    ped.add(ring);
    scene.add(ped);

    previewRig = createAvatarRig();
    previewRig.setStudioPose?.(null);
    previewRig.apply(draft);
    scene.add(previewRig.player);

    canvas.addEventListener("pointerdown", (e) => {
      dragging = true;
      dragX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      rotY += (e.clientX - dragX) * 0.012;
      dragX = e.clientX;
    });
    const endDrag = () => {
      dragging = false;
    };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);

    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        zoomOffset = Math.max(-0.45, Math.min(1.2, zoomOffset + e.deltaY * 0.001));
      },
      { passive: false }
    );
  }

  function resizePreview(): void {
    if (!renderer || !camera) return;
    const rect = canvas.parentElement?.getBoundingClientRect();
    const w = Math.max(240, Math.floor(rect?.width || 300));
    const h = Math.max(280, Math.floor(rect?.height || 380));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function applyPoseAnimation(rig: AvatarRig, t: number): void {
    rig.bodyGroup.position.y = Math.sin(t * 2.0) * 0.004;
    rig.bodyGroup.rotation.x = 0;
    rig.torsoGroup.rotation.set(0, 0, 0);
    rig.headGroup.rotation.set(0, 0, 0);
    rig.leftLegPivot.rotation.set(0, 0, 0);
    rig.rightLegPivot.rotation.set(0, 0, 0);
    rig.leftKneePivot.rotation.set(0, 0, 0);
    rig.rightKneePivot.rotation.set(0, 0, 0);
    rig.leftArmPivot.rotation.set(0, 0, 0);
    rig.rightArmPivot.rotation.set(0, 0, 0);
    rig.leftElbowPivot.rotation.set(0, 0, 0);
    rig.rightElbowPivot.rotation.set(0, 0, 0);
    rig.syncSkeleton?.();
  }

  function startLoop(): void {
    if (animId !== null) return;
    const t0 = performance.now();
    const tick = () => {
      animId = requestAnimationFrame(tick);
      if (!renderer || !scene || !camera || !previewRig) return;
      const t = (performance.now() - t0) * 0.001;
      if (autoSpin && !dragging) rotY += 0.007;
      previewRig.player.rotation.y = rotY;
      applyPoseAnimation(previewRig, t);

      const preset = CAMERA_PRESETS[cameraView];
      const desiredPos = new THREE.Vector3(
        preset.pos[0],
        preset.pos[1],
        Math.max(0.45, preset.pos[2] + zoomOffset)
      );
      const desiredTarget = new THREE.Vector3(...preset.target);
      currentCamPos.lerp(desiredPos, 0.12);
      currentCamTarget.lerp(desiredTarget, 0.12);
      camera.position.copy(currentCamPos);
      camera.lookAt(currentCamTarget);

      renderer.render(scene, camera);
    };
    tick();
  }

  function stopLoop(): void {
    if (animId !== null) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  function refreshPreview(): void {
    if (previewRig) previewRig.apply(draft);
    const info = HOMEROOM_INFO[draft.homeroom];
    chipEl.textContent = info.label;
    chipEl.style.background = info.shirtColor;
    chipEl.style.color = info.textHex;
    nameOut.textContent = draft.name || "Unnamed";
    genderTagEl.textContent = draft.gender === "girl" ? "♀ Feminine" : "♂ Masculine";
    genderTagEl.className = `cs-gender-tag ${draft.gender === "girl" ? "cs-gender-f" : "cs-gender-m"}`;
  }

  // ---- HTML Builders ----------------------------------------------------------------------
  const colorSection = (
    title: string,
    subtitle: string,
    field: keyof CharacterProfile,
    list: Swatch[],
    currentHex: string
  ) => {
    const matched = list.find((s) => sameHex(currentHex, s.hex));
    const activeLabel = matched ? matched.label : `Custom (${currentHex.toUpperCase()})`;
    return `
      <div class="cs-section">
        <div class="cs-section-head">
          <span class="cs-label">${title}${subtitle ? ` <span>${subtitle}</span>` : ""}</span>
          <span class="cs-color-readout">
            <i class="cs-color-dot" style="background-color:${esc(currentHex)}"></i>
            <span>${esc(activeLabel)}</span>
          </span>
        </div>
        <div class="cs-swatches">
          ${list
            .map((s) => {
              const on = sameHex(currentHex, s.hex);
              const light = isLightHex(s.hex);
              return `<button type="button" class="cs-swatch${on ? " active" : ""}${light ? " cs-swatch-light" : ""}" data-swatch="${field}" data-hex="${s.hex}" title="${esc(s.label)}" aria-label="${esc(s.label)}" style="background-color:${s.hex};--sw:${s.hex}"></button>`;
            })
            .join("")}
          <label class="cs-swatch cs-swatch-custom${!matched ? " active" : ""}" title="Pick Custom Color">
            <input type="color" data-custom-color="${field}" value="${esc(currentHex)}" aria-label="Custom ${esc(title)}" />
          </label>
        </div>
      </div>
    `;
  };

  const thumbGrid = <T extends string>(
    field: keyof CharacterProfile,
    kind: ThumbKind,
    list: Array<{ id: T; label: string; category?: HairCategory }>,
    currentId: T
  ) =>
    `<div class="cs-cards">${list
      .map((o) => {
        const on = o.id === currentId;
        const badge =
          o.category === "boy"
            ? '<span class="cs-card-badge cs-badge-boy">B</span>'
            : o.category === "girl"
              ? '<span class="cs-card-badge cs-badge-girl">G</span>'
              : o.category === "all"
                ? '<span class="cs-card-badge cs-badge-all">A</span>'
                : "";

        if (o.id === "none") {
          return `<button type="button" class="cs-card${on ? " active" : ""}" data-pick="${field}" data-val="${o.id}">
            <span class="cs-card-img">
              ${badge}
              <span class="cs-card-none" aria-hidden="true">&#8709;</span>
            </span>
            <span class="cs-card-label">${esc(o.label)}</span>
          </button>`;
        }

        const src = thumbs.get(kind, o.id, draft);
        return `<button type="button" class="cs-card${on ? " active" : ""}" data-pick="${field}" data-val="${o.id}">
          <span class="cs-card-img">
            ${badge}
            ${src ? `<img src="${src}" alt="${esc(o.label)}" loading="lazy"/>` : ""}
          </span>
          <span class="cs-card-label">${esc(o.label)}</span>
        </button>`;
      })
      .join("")}</div>`;

  function renderTabs(): void {
    tabNav.innerHTML = TABS.map(
      (t) =>
        `<button type="button" role="tab" class="cs-tab${t.id === activeTab ? " active" : ""}" data-tab="${t.id}" aria-selected="${t.id === activeTab}">${t.icon}<span>${t.label}</span></button>`
    ).join("");
  }

  function initEmbeddedAvaturnStudio(): void {
    destroyAvaturnSdk();
    const container = tabBody.querySelector("#cs-avaturn-container") as HTMLElement | null;
    const statusEl = tabBody.querySelector("#cs-avaturn-status") as HTMLElement | null;
    if (!container) return;

    try {
      avaturnSdk = new AvaturnSDK();
      avaturnSdk
        .init(container, {
          url: "https://demo.avaturn.dev",
          iframeClassName: "cs-avaturn-iframe",
        })
        .then(() => {
          if (!avaturnSdk) return;
          avaturnSdk.on("load", () => {
            if (statusEl) {
              statusEl.textContent = "Avaturn 3D Studio Ready — Customize & click 'Next / Export' to apply!";
            }
          });
          avaturnSdk.on("export", async (data) => {
            if (statusEl) {
              statusEl.textContent = "Importing exported 3D avatar into ELD PD Campus...";
            }
            await saveCustomAvatarGlb(data.url);
            draft.customAvatarUrl = "idb://custom-avatar";
            if (data.gender === "female") {
              draft.gender = "girl";
            } else if (data.gender === "male") {
              draft.gender = "boy";
            }
            thumbs.clearCache();
            refreshPreview();
            if (statusEl) {
              statusEl.textContent = "✓ Custom Avaturn 3D Avatar applied! Click 'Save & Apply' below to keep it.";
            }
          });
        })
        .catch(() => {
          if (statusEl) {
            statusEl.textContent =
              "Offline mode active — Use the local 24-hairstyle tabs or upload a downloaded .glb file below.";
          }
        });
    } catch {
      if (statusEl) {
        statusEl.textContent = "Use the upload button below to import any Avaturn .glb avatar file.";
      }
    }
  }

  function renderBody(): void {
    if (activeTab !== "avaturn") {
      destroyAvaturnSdk();
    }

    switch (activeTab) {
      case "identity":
        tabBody.innerHTML = `
          <div class="cs-section">
            <div class="cs-section-head">
              <label class="cs-label" for="cs-name-in">Educator Display Name <span>Max 18 characters</span></label>
            </div>
            <input id="cs-name-in" class="cs-input" type="text" maxlength="18" value="${esc(draft.name)}" placeholder="Enter educator name..." autocomplete="off"/>
          </div>

          <div class="cs-section">
            <div class="cs-section-head">
              <span class="cs-label">Body Type &amp; Educator Rig <span>Photorealistic adult proportions</span></span>
            </div>
            <div class="cs-segment">
              <button type="button" class="cs-seg-btn${draft.gender === "boy" ? " active" : ""}" data-gender="boy">
                <span>&#9794; Masculine Educator</span>
              </button>
              <button type="button" class="cs-seg-btn${draft.gender === "girl" ? " active" : ""}" data-gender="girl">
                <span>&#9792; Feminine Educator</span>
              </button>
            </div>
          </div>

          <div class="cs-section">
            <div class="cs-section-head">
              <span class="cs-label">Homeroom Affiliation <span>Sets campus badge &amp; spirit color</span></span>
            </div>
            <div class="cs-homerooms">
              ${HOMEROOMS.map((hr) => {
                const info = HOMEROOM_INFO[hr];
                const on = draft.homeroom === hr;
                return `<button type="button" class="cs-homeroom${on ? " active" : ""}" data-hr="${hr}" style="--hr:${info.shirtColor}">
                  <span class="cs-hr-dot" style="background-color:${info.shirtColor}"></span>
                  <span class="cs-hr-name">${info.label}</span>
                </button>`;
              }).join("")}
            </div>
          </div>

          ${colorSection("Skin Tone", "Natural complexion tint", "skinTone", SKIN_TONES, draft.skinTone)}

          <div class="cs-section">
            <div class="cs-section-head">
              <span class="cs-label">3D Educator Face &amp; Model Preset <span>Select realistic facial features</span></span>
            </div>
            ${thumbGrid("headStyle", "head", HEAD_STYLES, draft.headStyle || "")}
          </div>
        `;
        break;

      case "hair": {
        const filteredHairs =
          hairFilter === "all"
            ? HAIR_STYLES
            : HAIR_STYLES.filter((h) => h.category === hairFilter);
        tabBody.innerHTML = `
          <div class="cs-section">
            <div class="cs-section-head">
              <span class="cs-label">Hairstyles <span>Native Avaturn hair</span></span>
            </div>
            <div class="cs-filter-bar">
              <button type="button" class="cs-filter-pill${hairFilter === "boy" ? " active" : ""}" data-hair-filter="boy">Masculine / Short</button>
              <button type="button" class="cs-filter-pill${hairFilter === "girl" ? " active" : ""}" data-hair-filter="girl">Feminine / Long</button>
              <button type="button" class="cs-filter-pill${hairFilter === "all" ? " active" : ""}" data-hair-filter="all">All</button>
            </div>
            ${thumbGrid("hairStyle", "hair", filteredHairs, draft.hairStyle)}
          </div>

          ${colorSection("Primary Hair Color", "Tints the hair", "hairColor", HAIR_COLORS, draft.hairColor)}
        `;
        break;
      }

      case "face":
        tabBody.innerHTML = `
          <div class="cs-section">
            <div class="cs-section-head">
              <span class="cs-label">3D Educator Face Preset <span>Photorealistic facial identity</span></span>
            </div>
            ${thumbGrid("headStyle", "head", HEAD_STYLES, draft.headStyle || "")}
          </div>

          ${colorSection("Skin Tone", "Natural complexion tint", "skinTone", SKIN_TONES, draft.skinTone)}

          <div class="cs-section">
            <div class="cs-section-head">
              <span class="cs-label">3D Eyewear &amp; Glasses <span>Includes Avaturn designer frames</span></span>
            </div>
            ${thumbGrid("glasses", "glasses", GLASSES_OPTIONS, draft.glasses || "")}
          </div>

          ${colorSection("Eyewear Frame Color", "Tints glasses frames", "glassesColor", GLASSES_COLORS, draft.glassesColor || "")}
        `;
        break;

      case "top":
        tabBody.innerHTML = `
          ${colorSection("Shirt / Jacket / Top Color", "Homeroom spirit & educator wardrobe palette", "shirtColor", SHIRT_COLORS, draft.shirtColor)}

          <div class="cs-section">
            <div class="cs-section-head">
              <span class="cs-label">Upper Body Attire Style <span>Preview with current wardrobe color</span></span>
            </div>
            ${thumbGrid("topStyle", "top", TOP_STYLES, draft.topStyle)}
          </div>
        `;
        break;

      case "bottom":
        tabBody.innerHTML = `
          ${colorSection("Trousers / Bottom Color", "Tailored slacks, denim, khaki & charcoal", "pantsColor", PANTS_COLORS, draft.pantsColor || "")}
        `;
        break;

      case "shoes":
        tabBody.innerHTML = `
          ${colorSection("Footwear Color", "Primary dress shoe & sneaker color", "shoesColor", SHOE_COLORS, draft.shoesColor || "")}
        `;
        break;

      case "gear":
        tabBody.innerHTML = `
          <div class="cs-section">
            <div class="cs-section-head">
              <span class="cs-label">3D Eyewear &amp; Glasses <span>Frames &amp; shades</span></span>
            </div>
            ${thumbGrid("glasses", "glasses", GLASSES_OPTIONS, draft.glasses || "")}
          </div>

          ${colorSection("Eyewear Frame Color", "Tints glasses frames", "glassesColor", GLASSES_COLORS, draft.glassesColor || "")}
        `;
        break;

      case "avaturn":
        tabBody.innerHTML = `
          <div class="cs-avaturn-wrap">
            <div class="cs-avaturn-toolbar">
              <div class="cs-avaturn-info">
                <strong>Avaturn Web 3D Avatar Creator (@avaturn/sdk)</strong>
                <span id="cs-avaturn-status">Connecting to live Avaturn 3D studio...</span>
              </div>
              <div class="cs-avaturn-actions">
                <label class="cs-btn cs-btn-ghost cs-avaturn-upload">
                  <span>Upload .GLB File</span>
                  <input type="file" id="cs-glb-upload" accept=".glb,model/gltf-binary" hidden />
                </label>
                ${
                  draft.customAvatarUrl
                    ? `<button type="button" id="cs-avaturn-reset" class="cs-btn cs-btn-ghost">Reset to Preset Educator</button>`
                    : ""
                }
              </div>
            </div>
            <div id="cs-avaturn-container" class="cs-avaturn-stage"></div>
          </div>
        `;
        initEmbeddedAvaturnStudio();
        break;
    }

    const nameIn = tabBody.querySelector("#cs-name-in") as HTMLInputElement | null;
    if (nameIn) {
      nameIn.addEventListener("input", () => {
        draft.name = nameIn.value;
        refreshPreview();
      });
    }

    const glbUpload = tabBody.querySelector("#cs-glb-upload") as HTMLInputElement | null;
    if (glbUpload) {
      glbUpload.addEventListener("change", () => {
        const file = glbUpload.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
          if (typeof reader.result === "string") {
            await saveCustomAvatarGlb(reader.result);
            draft.customAvatarUrl = "idb://custom-avatar";
            thumbs.clearCache();
            refreshPreview();
            renderBody();
          }
        };
        reader.readAsDataURL(file);
      });
    }

    const resetBtn = tabBody.querySelector("#cs-avaturn-reset") as HTMLButtonElement | null;
    if (resetBtn) {
      resetBtn.addEventListener("click", async () => {
        await clearCustomAvatarGlb();
        delete draft.customAvatarUrl;
        thumbs.clearCache();
        refreshPreview();
        renderBody();
      });
    }

    tabBody.querySelectorAll<HTMLInputElement>("[data-custom-color]").forEach((inp) => {
      inp.addEventListener("input", () => {
        const field = inp.dataset.customColor as keyof CharacterProfile;
        if (field && /^#[0-9a-fA-F]{6}$/.test(inp.value)) {
          (draft as unknown as Record<string, string>)[field] = inp.value;
          refreshPreview();
        }
      });
      inp.addEventListener("change", () => {
        renderBody();
        refreshPreview();
      });
    });
  }

  // ---- Delegated Events -------------------------------------------------------------------
  tabNav.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-tab]");
    if (!btn || !btn.dataset.tab) return;
    activeTab = btn.dataset.tab;
    const tabDef = TABS.find((t) => t.id === activeTab);
    if (tabDef) setCameraView(tabDef.cam);
    renderTabs();
    renderBody();
  });

  tabBody.addEventListener("click", (e) => {
    const el = e.target as HTMLElement;

    const filterBtn = el.closest<HTMLButtonElement>("[data-hair-filter]");
    if (filterBtn && filterBtn.dataset.hairFilter) {
      hairFilter = filterBtn.dataset.hairFilter as "all" | HairCategory;
      renderBody();
      return;
    }

    const gBtn = el.closest<HTMLButtonElement>("[data-gender]");
    if (gBtn) {
      const g = gBtn.dataset.gender as Gender;
      if (draft.gender !== g) {
        draft.gender = g;
        setCameraView("full");

        const currentHairObj = HAIR_STYLES.find((h) => h.id === draft.hairStyle);
        if (g === "girl") {
          draft.facialHair = "none";
          if (currentHairObj?.category === "boy") {
            draft.hairStyle = "hair-long";
          }
        } else {
          if (currentHairObj?.category === "girl") {
            draft.hairStyle = "hair-afro";
          }
        }
      }
      renderBody();
      refreshPreview();
      return;
    }

    const hrBtn = el.closest<HTMLButtonElement>("[data-hr]");
    if (hrBtn) {
      const hr = hrBtn.dataset.hr as Homeroom;
      const prevDefault = HOMEROOM_INFO[draft.homeroom].shirtColor;
      draft.homeroom = hr;
      if (sameHex(draft.shirtColor, prevDefault)) {
        draft.shirtColor = HOMEROOM_INFO[hr].shirtColor;
      }
      if (sameHex(draft.hatColor || "", prevDefault)) {
        draft.hatColor = HOMEROOM_INFO[hr].shirtColor;
      }
      renderBody();
      refreshPreview();
      return;
    }

    const sw = el.closest<HTMLButtonElement>("[data-swatch]");
    if (sw) {
      const field = sw.dataset.swatch as keyof CharacterProfile;
      const hex = sw.dataset.hex!;
      (draft as unknown as Record<string, string>)[field] = hex;
      renderBody();
      refreshPreview();
      return;
    }

    const pickBtn = el.closest<HTMLButtonElement>("[data-pick]");
    if (pickBtn) {
      const field = pickBtn.dataset.pick as keyof CharacterProfile;
      const val = pickBtn.dataset.val!;
      (draft as unknown as Record<string, string>)[field] = val;
      if (field === "hairStyle" || field === "headwear") {
        setCameraView("head");
      } else if (field === "facialHair" || field === "glasses" || field === "earrings" || field === "headStyle") {
        setCameraView("face");
      } else if (field === "topStyle") {
        setCameraView("upper");
      } else if (field === "bottoms") {
        setCameraView("lower");
      } else if (field === "shoeStyle") {
        setCameraView("shoes");
      }
      renderBody();
      refreshPreview();
    }
  });

  overlay.querySelector("#cs-random")!.addEventListener("click", () => {
    const btn = overlay.querySelector("#cs-random") as HTMLButtonElement;
    btn.classList.remove("pulse");
    void btn.offsetWidth;
    btn.classList.add("pulse");
    draft = randomizeProfile(draft);
    rotY = 0.24;
    setCameraView("full");
    if (activeTab !== "avaturn") renderBody();
    refreshPreview();
  });

  spinBtn.addEventListener("click", () => {
    autoSpin = !autoSpin;
    spinBtn.classList.toggle("active", autoSpin);
  });

  let currentOnSaveCallback: ((profile: CharacterProfile) => void) | undefined = onSave;

  function openModal(customOnSave?: (profile: CharacterProfile) => void): void {
    currentOnSaveCallback = customOnSave ?? onSave;
    current = loadCharacterProfile();
    draft = { ...current };
    rotY = 0.24;
    setCameraView(TABS.find((t) => t.id === activeTab)?.cam || "full");
    overlay.style.display = "flex";
    ensurePreview();
    resizePreview();
    renderTabs();
    renderBody();
    refreshPreview();
    startLoop();
  }

  function closeModal(): void {
    destroyAvaturnSdk();
    stopLoop();
    overlay.style.display = "none";
  }

  function saveAndClose(): void {
    const clean = draft.name.trim();
    draft.name = clean ? clean.slice(0, 18) : current.name;
    current = { ...draft };
    saveCharacterProfile(current);
    setLocalPlayerName(current.name);
    if (currentOnSaveCallback) currentOnSaveCallback(current);
    closeModal();
  }

  overlay.querySelector("#settings-close-x")!.addEventListener("click", closeModal);
  overlay.querySelector("#settings-cancel-btn")!.addEventListener("click", closeModal);
  overlay.querySelector("#settings-save-btn")!.addEventListener("click", saveAndClose);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.style.display === "flex") closeModal();
  });
  window.addEventListener("resize", () => {
    if (overlay.style.display === "flex") resizePreview();
  });

  if (hudBtn) {
    hudBtn.onclick = () => openModal();
  }
  (window as unknown as { __openCharacterStudio?: (cb?: (profile: CharacterProfile) => void) => void }).__openCharacterStudio =
    openModal;
}

export function openSettingsModal(onSave?: (profile: CharacterProfile) => void): void {
  const fn = (window as unknown as { __openCharacterStudio?: (cb?: (profile: CharacterProfile) => void) => void })
    .__openCharacterStudio;
  if (fn) fn(onSave);
}
