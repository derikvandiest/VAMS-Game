/**
 * Quaternius Modular Character System
 *
 * Uses Quaternius Ultimate Modular Men & Women packs (CC0) for all player characters.
 * - 11 male outfits: Adventurer, Beach, Casual_2, Casual_Hoodie, Farmer, King, Punk, Spacesuit, Suit, Swat, Worker
 * - 10 female outfits: Adventurer, Casual, Formal, Medieval, Punk, SciFi, Soldier, Suit, Witch, Worker
 * - Each GLB is fully rigged (62 bones, CharacterArmature) with 24 built-in animations:
 *   Walk, Run, Idle, Wave, Interact, Death, etc.
 * - Bone naming: Root, Body, Hips, Abdomen, Torso, Chest, Neck, Head,
 *   Shoulder.L/R, UpperArm.L/R, LowerArm.L/R, Wrist.L/R,
 *   UpperLeg.L/R, LowerLeg.L/R, Foot.L/R, PT.L/R (toe)
 * - Skin tinting via "Skin" material color property
 * - Outfit color tinting via per-material hex override
 */

import * as THREE from "three";
import { GLTFLoader, GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  CharacterProfile,
  Homeroom,
  HOMEROOM_INFO,
  getCachedCustomAvatarGlb,
  hydrateCustomAvatarGlb,
} from "./profile";

export interface AvatarRig {
  player: THREE.Group;
  bodyGroup: THREE.Group;
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  leftKneePivot: THREE.Group;
  rightKneePivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftElbowPivot: THREE.Group;
  rightElbowPivot: THREE.Group;
  apply: (profile: CharacterProfile) => void;
  setStudioPose?: (poseName: string | null) => void;
  syncSkeleton?: () => void;
}

// ---------------------------------------------------------------------------
// Outfit catalog: maps TopStyle / gender to a Quaternius GLB path
// ---------------------------------------------------------------------------

/** Maps (gender, topStyle) → GLB filename under /models/quaternius/Male/ or /Female/ */
const MALE_OUTFIT_MAP: Record<string, string> = {
  "Top.ButtonUp": "Suit",
  "Top.Polo":     "Casual_2",
  "Top.Sweater":  "Casual_Hoodie",
  "Top.Blazer":   "Suit",
  default:        "Casual_Hoodie",
};

const FEMALE_OUTFIT_MAP: Record<string, string> = {
  "Top.ButtonUp": "Formal",
  "Top.Polo":     "Casual",
  "Top.Sweater":  "Casual",
  "Top.Blazer":   "Suit",
  default:        "Casual",
};

export function resolveOutfitUrl(topStyle: string, gender: string): string {
  const isFemale = gender === "female";
  const map = isFemale ? FEMALE_OUTFIT_MAP : MALE_OUTFIT_MAP;
  const name = map[topStyle] ?? map["default"];
  const folder = isFemale ? "Female" : "Male";
  return `/models/quaternius/${folder}/${name}.glb`;
}

/** Kept for backwards-compat; delegates to resolveOutfitUrl */
export function resolveShirtUrl(topStyle: string, gender: string): string {
  return resolveOutfitUrl(topStyle, gender);
}

/** No standalone hair GLBs for Quaternius — hair is baked into the head mesh */
export function resolveHairUrl(_style: string, _gender: string): string | null {
  return null;
}

// ---------------------------------------------------------------------------
// Which material slots control skin tone vs outfit color
// ---------------------------------------------------------------------------

/** Material names that contain visible skin on the Quaternius rigs */
const SKIN_MAT_NAMES = new Set(["skin", "skin_darker"]);

/** Material names that should receive the shirt color tint */
const SHIRT_MAT_NAMES = new Set([
  "lightbrown", "lightblue", "purple", "white", "blue", "green", "lightgreen",
  "beige", "red", "orange", "pink", "worker_vest", "worker_yellow",
  "swat", "metal", "metal_dark",
]);

/** Material names that receive pants color */
const PANTS_MAT_NAMES = new Set([
  "brown", "brown2", "brown_02", "darkbrown", "lightblue", "black", "grey",
]);

// ---------------------------------------------------------------------------
// GLB loading with cache
// ---------------------------------------------------------------------------

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/");
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

const glbCache = new Map<string, GLTF>();
const glbPromises = new Map<string, Promise<GLTF>>();
const activeRigs = new Set<() => void>();

function loadGlbUrl(url: string): Promise<GLTF> {
  if (glbCache.has(url)) return Promise.resolve(glbCache.get(url)!);
  if (glbPromises.has(url)) return glbPromises.get(url)!;
  const p = new Promise<GLTF>((resolve, reject) => {
    gltfLoader.load(
      url,
      (gltf) => { glbCache.set(url, gltf); resolve(gltf); },
      undefined,
      (err) => { glbPromises.delete(url); reject(err); }
    );
  });
  glbPromises.set(url, p);
  return p;
}

function getOrLoadGlb(url: string): GLTF | null {
  if (glbCache.has(url)) return glbCache.get(url)!;
  void loadGlbUrl(url).then(() => {
    for (const refresh of activeRigs) refresh();
  });
  return null;
}

// ---------------------------------------------------------------------------
// Core outfit GLBs to preload at startup
// ---------------------------------------------------------------------------

const CORE_QUATERNIUS_URLS: string[] = [
  // Male defaults
  "/models/quaternius/Male/Casual_Hoodie.glb",
  "/models/quaternius/Male/Suit.glb",
  "/models/quaternius/Male/Casual_2.glb",
  // Female defaults
  "/models/quaternius/Female/Casual.glb",
  "/models/quaternius/Female/Formal.glb",
  "/models/quaternius/Female/Suit.glb",
];

let coreAssetsReady = false;
let preloadAllPromise: Promise<void> | null = null;

export function preloadAvatarAssets(): Promise<void> {
  if (preloadAllPromise) return preloadAllPromise;

  void hydrateCustomAvatarGlb().then((val) => {
    if (val) {
      for (const refresh of activeRigs) refresh();
    }
  });

  preloadAllPromise = Promise.all(
    CORE_QUATERNIUS_URLS.map((u) => loadGlbUrl(u).catch(() => null))
  ).then(() => {
    coreAssetsReady = true;
    for (const refresh of activeRigs) refresh();
  });

  return preloadAllPromise;
}

void preloadAvatarAssets();

export function areAvatarAssetsReady(): boolean {
  return coreAssetsReady;
}

// ---------------------------------------------------------------------------
// Name-tag sprite helper (unchanged from previous system)
// ---------------------------------------------------------------------------

function makeNameTagTexture(name: string, homeroom: Homeroom): THREE.CanvasTexture {
  const info = HOMEROOM_INFO[homeroom] ?? HOMEROOM_INFO.UCLA;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, c.width, c.height);

  ctx.font = "bold 36px system-ui, -apple-system, Segoe UI, sans-serif";
  const nameW = ctx.measureText(name).width;
  ctx.font = "bold 26px system-ui, -apple-system, Segoe UI, sans-serif";
  const tagW = ctx.measureText(info.label).width + 28;
  const padX = 28;
  const gap = 14;
  const w = Math.min(492, Math.max(200, Math.ceil(nameW + tagW + padX * 2 + gap)));
  const h = 76;
  const x = (c.width - w) / 2;
  const y = (c.height - h) / 2;
  const r = h / 2;

  ctx.fillStyle = "rgba(15, 23, 42, 0.86)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.88)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const pillH = 44;
  const pillY = y + (h - pillH) / 2;
  const pillX = x + 16;
  const pillR = pillH / 2;
  ctx.fillStyle = info.shirtColor;
  ctx.beginPath();
  ctx.moveTo(pillX + pillR, pillY);
  ctx.arcTo(pillX + tagW, pillY, pillX + tagW, pillY + pillH, pillR);
  ctx.arcTo(pillX + tagW, pillY + pillH, pillX, pillY + pillH, pillR);
  ctx.arcTo(pillX, pillY + pillH, pillX, pillY, pillR);
  ctx.arcTo(pillX, pillY, pillX + tagW, pillY, pillR);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = info.textHex;
  ctx.font = "bold 26px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(info.label, pillX + tagW / 2, c.height / 2 + 1);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 36px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(name, pillX + tagW + gap, c.height / 2 + 2);

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// createAvatarRig — main factory
// ---------------------------------------------------------------------------

/**
 * Character scale factor:  Quaternius models are ~2 m tall in Y-up space.
 * We scale them down so the character fits the existing campus (designed for ~1.7m avatars).
 */
const QUAT_SCALE = 0.78;

/** Y-offset to bring the model's feet exactly to y=0 */
const QUAT_Y_OFFSET = 0.0;

/** Time-step accumulator driving the AnimationMixer */
let _lastNow = 0;

export function createAvatarRig(opts: { nameTag?: boolean } = {}): AvatarRig {
  const player = new THREE.Group();

  const scaleContainer = new THREE.Group();
  player.add(scaleContainer);

  const bodyGroup = new THREE.Group();
  scaleContainer.add(bodyGroup);

  // ---- Proxy pivot groups kept for scene.ts / settings.ts compatibility ----
  // These are NOT attached to the visual model — they just carry rotation state
  // that syncSkeleton reads to drive the AnimationMixer time.

  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.84, 0);
  bodyGroup.add(torsoGroup);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.46, 0);
  torsoGroup.add(headGroup);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(0.11, 0.82, 0);
  bodyGroup.add(leftLegPivot);

  const leftKneePivot = new THREE.Group();
  leftKneePivot.position.set(0, -0.38, 0);
  leftLegPivot.add(leftKneePivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(-0.11, 0.82, 0);
  bodyGroup.add(rightLegPivot);

  const rightKneePivot = new THREE.Group();
  rightKneePivot.position.set(0, -0.38, 0);
  rightLegPivot.add(rightKneePivot);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(0.17, 0.40, 0);
  torsoGroup.add(leftArmPivot);

  const leftElbowPivot = new THREE.Group();
  leftElbowPivot.position.set(0, -0.25, 0);
  leftArmPivot.add(leftElbowPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(-0.17, 0.40, 0);
  torsoGroup.add(rightArmPivot);

  const rightElbowPivot = new THREE.Group();
  rightElbowPivot.position.set(0, -0.25, 0);
  rightArmPivot.add(rightElbowPivot);

  // ---- Quaternius model container ----
  const modelRoot = new THREE.Group();
  modelRoot.scale.setScalar(QUAT_SCALE);
  modelRoot.position.y = QUAT_Y_OFFSET;
  bodyGroup.add(modelRoot);

  // ---- Name tag sprite ----
  let nameTagSprite: THREE.Sprite | null = null;
  let lastTagKey = "";
  if (opts.nameTag) {
    const spriteMat = new THREE.SpriteMaterial({ transparent: true, depthTest: false });
    nameTagSprite = new THREE.Sprite(spriteMat);
    nameTagSprite.scale.set(2.2, 0.55, 1);
    nameTagSprite.position.set(0, 2.4, 0);
    player.add(nameTagSprite);
  }

  // ---- Runtime state ----
  let activeOutfitUrl = "";
  let armatureScene: THREE.Object3D | null = null;
  let mixer: THREE.AnimationMixer | null = null;
  let idleAction: THREE.AnimationAction | null = null;
  let walkAction: THREE.AnimationAction | null = null;
  let runAction: THREE.AnimationAction | null = null;
  let waveAction: THREE.AnimationAction | null = null;
  let currentProfile: CharacterProfile | null = null;
  let currentStudioPose: string | null = null;
  let _mixerTime = 0;

  // Auto-advancing sync trigger mesh (zero-area triangle, invisible)
  const syncTriggerGeo = new THREE.BufferGeometry();
  syncTriggerGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([0, 0.8, 0, 0.001, 0.8, 0, 0, 0.801, 0]), 3)
  );
  const syncTriggerMat = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    transparent: true,
    opacity: 0,
  });
  const syncTriggerMesh = new THREE.Mesh(syncTriggerGeo, syncTriggerMat);
  syncTriggerMesh.frustumCulled = false;
  syncTriggerMesh.renderOrder = -1000;
  syncTriggerMesh.onBeforeRender = () => {
    syncSkeleton();
  };
  modelRoot.add(syncTriggerMesh);

  // ---------------------------------------------------------------------------
  // applyMaterials — tint Skin / outfit materials from profile colors
  // ---------------------------------------------------------------------------
  function applyMaterials(p: CharacterProfile): void {
    if (!armatureScene) return;

    const skinColor = new THREE.Color(p.skinTone);
    const shirtColor = new THREE.Color(p.shirtColor);
    const pantsColor = new THREE.Color(p.pantsColor);
    const hairColor = new THREE.Color(p.hairColor);
    const eyeColor = new THREE.Color(p.eyeColor || "#3b2314");

    armatureScene.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const rawMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mesh.material = rawMats.map((m) => {
        const std = (m as THREE.MeshStandardMaterial).clone();
        const key = (std.name || "").toLowerCase().replace(/[^a-z0-9_]/g, "");

        if (SKIN_MAT_NAMES.has(key)) {
          std.color.copy(skinColor);
          std.roughness = 0.65;
          std.metalness = 0.0;
        } else if (key.startsWith("hair")) {
          std.color.copy(hairColor);
          std.roughness = 0.75;
          std.metalness = 0.0;
        } else if (key === "eye") {
          std.color.copy(eyeColor);
          std.roughness = 0.15;
        } else if (key === "eyebrows" || key === "brown") {
          // keep roughly the dark brow colour; tint toward hair
          const browTint = hairColor.clone().multiplyScalar(0.75);
          std.color.copy(browTint);
        } else if (SHIRT_MAT_NAMES.has(key)) {
          std.color.copy(shirtColor);
          std.roughness = 0.68;
          std.metalness = 0.0;
        } else if (PANTS_MAT_NAMES.has(key)) {
          std.color.copy(pantsColor);
          std.roughness = 0.72;
          std.metalness = 0.0;
        }
        return std;
      });
    });
  }

  // ---------------------------------------------------------------------------
  // rebuildAvatarMeshes — load/swap the GLB and wire up animations
  // ---------------------------------------------------------------------------
  function rebuildAvatarMeshes(): void {
    if (!currentProfile) return;
    const p = currentProfile;

    const outfitUrl = resolveOutfitUrl(p.topStyle, p.gender);
    const gltf = getOrLoadGlb(outfitUrl);
    if (!gltf) return; // will auto-refresh when loaded

    // Swap the armature scene when the outfit changes
    if (!armatureScene || activeOutfitUrl !== outfitUrl) {
      if (armatureScene) {
        modelRoot.remove(armatureScene);
        if (mixer) { mixer.stopAllAction(); mixer.uncacheRoot(armatureScene); }
      }
      activeOutfitUrl = outfitUrl;
      armatureScene = SkeletonUtils.clone(gltf.scene);

      // Remove the decorative Icosphere (Quaternius always includes one)
      armatureScene.traverse((obj) => {
        if (obj.name === "Icosphere" && (obj as THREE.Mesh).isMesh) {
          obj.visible = false;
        }
      });

      modelRoot.add(armatureScene);

      // Wire up AnimationMixer using the clips embedded in the GLB
      mixer = new THREE.AnimationMixer(armatureScene);
      idleAction = null; walkAction = null; runAction = null; waveAction = null;

      for (const clip of gltf.animations) {
        const name = clip.name;
        const action = mixer.clipAction(clip, armatureScene);
        action.setLoop(THREE.LoopRepeat, Infinity);

        if (name === "Idle" || name === "Idle_Neutral") {
          idleAction = action;
        } else if (name === "Walk") {
          walkAction = action;
        } else if (name === "Run") {
          runAction = action;
        } else if (name === "Wave") {
          waveAction = action;
        }
      }

      // Start idle playing at zero weight; we'll blend in syncSkeleton
      if (idleAction) { idleAction.play(); idleAction.weight = 1; }
      if (walkAction) { walkAction.play(); walkAction.weight = 0; }
      if (runAction) { runAction.play(); runAction.weight = 0; }
      if (waveAction) { waveAction.play(); waveAction.weight = 0; }

      _mixerTime = 0;
    }

    // Always re-apply materials (profile colors may have changed)
    applyMaterials(p);
  }

  activeRigs.add(rebuildAvatarMeshes);

  // ---------------------------------------------------------------------------
  // syncSkeleton — called every frame by scene.ts (also via onBeforeRender)
  // ---------------------------------------------------------------------------
  function syncSkeleton(): void {
    if (!armatureScene || !mixer) return;

    const nowMs = typeof performance !== "undefined" ? performance.now() : 0;
    const dt = _lastNow > 0 ? Math.min(0.1, (nowMs - _lastNow) * 0.001) : 0.016;
    _lastNow = nowMs;

    // Derive motion intensity from the leg pivot angles that scene.ts drives
    const legSwing = Math.abs(leftLegPivot.rotation.x) + Math.abs(rightLegPivot.rotation.x);
    const armActivity = Math.abs(leftArmPivot.rotation.x) + Math.abs(rightArmPivot.rotation.x);

    // Detect sprinting by unusually large arm/leg swings (scene.ts pushes these further when sprinting)
    const isMoving = legSwing > 0.04;
    const isSprinting = legSwing > 0.75;
    const isWaving = armActivity > 1.8 && !isMoving;
    const isSeated = leftLegPivot.rotation.x < -1.1 && rightLegPivot.rotation.x < -1.1;

    // Blend targets
    const targetIdle   = isSeated ? 1 : (isMoving ? 0 : 1);
    const targetWalk   = isMoving && !isSprinting && !isSeated ? 1 : 0;
    const targetRun    = isSprinting && !isSeated ? 1 : 0;
    const targetWave   = isWaving ? 1 : 0;

    const lerpSpeed = dt * 6;

    if (idleAction) idleAction.weight += (targetIdle - idleAction.weight) * lerpSpeed;
    if (walkAction) walkAction.weight += (targetWalk - walkAction.weight) * lerpSpeed;
    if (runAction)  runAction.weight  += (targetRun  - runAction.weight)  * lerpSpeed;
    if (waveAction) waveAction.weight += (targetWave - waveAction.weight) * lerpSpeed;

    // Advance the mixer — use real delta when moving, idle breath speed when still
    const mixerDt = isSeated ? dt * 0.2 : dt * (isSprinting ? 1.4 : 1.0);
    mixer.update(mixerDt);

    // Sync bodyGroup height to torsoGroup for scene.ts bob (keeps feet on ground)
    bodyGroup.position.y = torsoGroup.position.y - 0.84;

    // Keep model root flat (scene.ts may tilt torsoGroup for running lean)
    modelRoot.rotation.x = 0;
    modelRoot.rotation.z = 0;
  }

  // ---------------------------------------------------------------------------
  // apply — called when profile changes
  // ---------------------------------------------------------------------------
  function apply(profile: CharacterProfile): void {
    currentProfile = { ...profile };

    // Slight scale difference female vs male
    const s = profile.gender === "female" ? 0.96 : 1.0;
    scaleContainer.scale.set(s, s, s);

    if (nameTagSprite) {
      const key = `${profile.name}|${profile.homeroom}`;
      if (key !== lastTagKey) {
        lastTagKey = key;
        const mat = nameTagSprite.material as THREE.SpriteMaterial;
        if (mat.map) mat.map.dispose();
        mat.map = makeNameTagTexture(profile.name, profile.homeroom);
        mat.needsUpdate = true;
      }
      nameTagSprite.position.y = 1.76 * s;
    }

    rebuildAvatarMeshes();
  }

  function setStudioPose(poseName: string | null): void {
    currentStudioPose = poseName;
    // With Quaternius AnimationMixer animations, studio poses are handled
    // via the pivot groups that syncSkeleton reads — no extra bone work needed.
  }

  return {
    player,
    bodyGroup,
    torsoGroup,
    headGroup,
    leftLegPivot,
    rightLegPivot,
    leftKneePivot,
    rightKneePivot,
    leftArmPivot,
    rightArmPivot,
    leftElbowPivot,
    rightElbowPivot,
    apply,
    setStudioPose,
    syncSkeleton,
  };
}

// ---------------------------------------------------------------------------
// animateAvatar — drives the proxy pivot groups from scene.ts walk loops
// (scene.ts uses this for remote player animations too)
// ---------------------------------------------------------------------------

export function animateAvatar(
  rig: AvatarRig,
  t: number,
  walkSpeed: number,
  opts: { wave?: number; cheer?: number; seated?: boolean } = {}
): void {
  const wave = opts.wave ?? 0;
  const cheer = opts.cheer ?? 0;

  if (opts.seated) {
    rig.torsoGroup.position.y = 0.62;
    rig.torsoGroup.rotation.set(0, 0, 0);
    rig.leftLegPivot.rotation.set(-1.45, 0, 0);
    rig.rightLegPivot.rotation.set(-1.45, 0, 0);
    rig.leftKneePivot.rotation.set(1.45, 0, 0);
    rig.rightKneePivot.rotation.set(1.45, 0, 0);
    rig.leftArmPivot.rotation.set(-0.35, 0, 0);
    rig.rightArmPivot.rotation.set(-0.35, 0, 0);
    rig.leftElbowPivot.rotation.set(-0.4, 0, 0);
    rig.rightElbowPivot.rotation.set(-0.4, 0, 0);
    rig.syncSkeleton?.();
    return;
  }

  const moving = Math.min(1, walkSpeed);
  const swing = Math.sin(t * 7) * 0.52 * moving;
  const bounce = Math.abs(Math.cos(t * 7)) * 0.032 * moving;
  const breathe = Math.sin(t * 2.1) * 0.012 * (1 - moving * 0.5);

  rig.torsoGroup.position.y = 0.84 + bounce + breathe;
  rig.torsoGroup.rotation.x = 0.04 * moving;
  rig.torsoGroup.rotation.y = Math.sin(t * 7) * 0.045 * moving;
  rig.torsoGroup.rotation.z = Math.cos(t * 7) * 0.018 * moving;

  rig.headGroup.rotation.y = Math.sin(t * 1.1) * 0.05 * (1 - moving);
  rig.headGroup.rotation.x = Math.sin(t * 1.6) * 0.025 * (1 - moving);

  rig.leftLegPivot.rotation.x = swing;
  rig.rightLegPivot.rotation.x = -swing;
  rig.leftKneePivot.rotation.x = Math.max(0, -swing * 0.78);
  rig.rightKneePivot.rotation.x = Math.max(0, swing * 0.78);

  rig.leftArmPivot.rotation.set(-swing * 0.65, 0, 0);
  rig.leftElbowPivot.rotation.set(-Math.max(0.08, -swing * 0.35), 0, 0);

  if (cheer > 0.01) {
    const pump = Math.sin(t * 11) * 0.25;
    rig.leftArmPivot.rotation.set(-2.5 + pump, 0, 0.22);
    rig.rightArmPivot.rotation.set(-2.5 - pump, 0, -0.22);
    rig.leftElbowPivot.rotation.set(-0.25, 0, 0);
    rig.rightElbowPivot.rotation.set(-0.25, 0, 0);
  } else if (wave > 0.01) {
    rig.rightArmPivot.rotation.set(-2.35, 0, -0.3 + Math.sin(t * 10) * 0.28);
    rig.rightElbowPivot.rotation.set(-0.45 + Math.cos(t * 10) * 0.2, 0, 0);
  } else {
    rig.rightArmPivot.rotation.set(swing * 0.65, 0, 0);
    rig.rightElbowPivot.rotation.set(-Math.max(0.08, swing * 0.35), 0, 0);
  }

  rig.syncSkeleton?.();
}
