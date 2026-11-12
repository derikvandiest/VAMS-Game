/**
 * Quaternius character rig (CC0, Ultimate Modular Men & Women packs).
 *
 * Each "look" (content/character-options.json) is one fully rigged GLB with
 * built-in Idle / Walk / Run / Wave clips. Per profile we tint:
 *   - Skin / Skin_Darker materials  -> skin tone
 *   - the look's "shirt" parts      -> homeroom color
 *   - the look's hair/brow materials -> hair color
 * Props (Icosphere, Pistol) are hidden. Animation is driven by syncSkeleton(),
 * which reads the proxy leg/arm pivots that scene.ts animates.
 */

import * as THREE from "three";
import { GLTFLoader, GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { transplant, recolor, matchesEntry, partName, buildProcedural, Role, RoleColors, EyeInfo } from "./accessories";
import {
  CharacterProfile,
  getHairStyle,
  getFacialHair,
  getHat,
  getGlasses,
  getShoes,
  HAIR_STYLES,
  FACIAL_HAIR,
  HATS,
  SHOES,
  shirtColorFor,
  Homeroom,
  HOMEROOM_INFO,
  LOOKS,
  getLook,
  sanitizeProfile,
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
  /** bodyGroup.y that puts the seated thighs on a seat surface at height `seatY` */
  seatDrop?: (seatY: number) => number;
  /** Actual ground speed in world units/second this frame (0 = standing). Drives walk/run blending and stride. */
  setLocomotion?: (speed: number) => void;
}

// ---------------------------------------------------------------------------
// Looks: each look (content/character-options.json) is one Quaternius model.
// ---------------------------------------------------------------------------

export function resolveLookUrl(lookId: string): string {
  return `/models/quaternius/${getLook(lookId).model}.glb`;
}

/** Skin materials on the Quaternius rigs (lower-cased names). */
const SKIN_MAT_NAMES = new Set(["skin", "skin_darker"]);

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

const donorUrl = (m: string): string => `/models/quaternius/${m}.glb`;
const CORE_QUATERNIUS_URLS: string[] = [
  ...new Set([
    ...LOOKS.map((l) => resolveLookUrl(l.id)),
    ...HAIR_STYLES.filter((h) => h.donor).map((h) => donorUrl(h.donor!)),
    ...FACIAL_HAIR.filter((h) => h.donor).map((h) => donorUrl(h.donor!)),
    ...HATS.flatMap((h) => Object.values(h.donors ?? {}).map(donorUrl)),
    ...SHOES.flatMap((s) => Object.values(s.donors ?? {}).map(donorUrl)),
  ]),
];

let coreAssetsReady = false;
let preloadAllPromise: Promise<void> | null = null;

export function preloadAvatarAssets(): Promise<void> {
  if (preloadAllPromise) return preloadAllPromise;

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

/** Scale used in the game world, where doors are 2.6 units high (the character screens use QUAT_SCALE). */
export const GAME_AVATAR_SCALE = 1.2;


/** Y-offset to bring the model's feet exactly to y=0 */
const QUAT_Y_OFFSET = 0.0;

/** Time-step accumulator driving the AnimationMixer */

export function createAvatarRig(opts: { nameTag?: boolean; scale?: number } = {}): AvatarRig {
  const modelScale = opts.scale ?? QUAT_SCALE;
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
  modelRoot.scale.setScalar(modelScale);
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
  /** Add-on slots (hair, hat, ...): the objects currently attached and the key they were built for */
  const slots = new Map<string, { key: string; objs: THREE.Object3D[] }>();
  let headBox: THREE.Box3 | null = null; // bind-pose head size in model space (for procedural add-ons)
  let hideBakedHair = false;
  let hideBakedFeet = false;
  let mixer: THREE.AnimationMixer | null = null;
  let idleAction: THREE.AnimationAction | null = null;
  let walkAction: THREE.AnimationAction | null = null;
  let runAction: THREE.AnimationAction | null = null;
  let waveAction: THREE.AnimationAction | null = null;
  let currentProfile: CharacterProfile | null = null;
  let currentStudioPose: string | null = null;
  let _mixerTime = 0;
  /** Skeleton bones used by the seated pose (names lose their dots when three.js loads the GLB) */
  type SitBones = Record<"upLegL" | "upLegR" | "loLegL" | "loLegR" | "footL" | "footR" | "toeL" | "toeR" | "upArmL" | "upArmR" | "loArmL" | "loArmR", THREE.Object3D>;
  let sitBones: SitBones | null = null;
  /** Foot position in each shin bone's own space at rest (the foot bones are not children of the shins) */
  const footRest = { L: new THREE.Vector3(), R: new THREE.Vector3() };
  /** Rest-pose transforms of the bones the code poses by hand, restored every frame before the mixer runs */
  let restPose: Array<[THREE.Object3D, THREE.Vector3, THREE.Quaternion]> = [];
  let legPivotHeight = 1.0 * modelScale; // standing height of the hip joint in player space
  // Locomotion: the scene reports the real ground speed and the walk/run cycles are driven from it
  let locoSpeed = 0; // reported speed (world units/s)
  let locoStamp = 0; // when it was reported (ms); stale = fall back to the leg-pivot heuristic
  let smoothSpeed = 0;
  let gaitPhase = 0; // 0..1 position in the shared walk/run cycle
  let gait = { walkCycle: 1.85, runCycle: 1.15, walkDur: 1.33, runDur: 0.8 }; // measured per model (native units)
  let lastBob = 0; // torsoGroup bob already applied to bodyGroup
  let lastSyncMs = 0; // per rig: each rig has its own clock
  let seatBlend = 0; // 0 = standing animation, 1 = fully in the seated pose

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
    const look = getLook(p.look);
    const skin = new THREE.Color(p.skinTone);
    const skinDark = skin.clone().multiplyScalar(0.85);
    const shirt = new THREE.Color(shirtColorFor(p.homeroom));
    const hair = new THREE.Color(p.hairColor);
    const hairDark = hair.clone().multiplyScalar(0.55);
    const brows = hair.clone().multiplyScalar(0.7);

    armatureScene.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh || obj.userData.role) return; // skip add-ons (hair, hats, ...)
      const mesh = obj as THREE.Mesh;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Part name: the mesh's own name or, for multi-material meshes, its parent's
      const meshName = partName(obj);
      if (meshName.includes("_Feet")) mesh.visible = !hideBakedFeet;
      // NOTE: keep the material shape. A single-element array on a mesh without
      // geometry groups renders nothing in three.js (the original "invisible character" bug).
      const tint = (m: THREE.Material): THREE.Material => {
        const std = (m as THREE.MeshStandardMaterial).clone();
        const name = std.name || "";
        const key = name.toLowerCase();
        if (SKIN_MAT_NAMES.has(key)) {
          std.color.copy(key === "skin" ? skin : skinDark);
        } else if (matchesEntry(look.shirt, meshName, name)) {
          std.color.copy(shirt);
        } else if (matchesEntry(look.hair, meshName, name)) {
          if (!Array.isArray(mesh.material)) mesh.visible = !hideBakedHair; // replaced by a borrowed hairstyle
          std.color.copy(look.hair.length > 1 && name !== look.hair[0].split(":")[1] ? hairDark : hair);
        } else if (matchesEntry(look.brows, meshName, name)) {
          std.color.copy(brows);
        }
        return std;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(tint) : tint(mesh.material);
    });
  }

  // ---------------------------------------------------------------------------
  // Add-ons: hair / facial hair / hat / glasses / shoes
  // ---------------------------------------------------------------------------
  function setSlot(name: string, key: string, build: () => THREE.Object3D[] | null): THREE.Object3D[] {
    const cur = slots.get(name);
    if (cur && cur.key === key) return cur.objs;
    if (cur) for (const o of cur.objs) o.removeFromParent();
    slots.delete(name);
    if (key === "") return [];
    const objs = build();
    if (!objs) return []; // donor model still loading; refreshed when it arrives
    slots.set(name, { key, objs });
    return objs;
  }

  /** Lift parts of a donor model onto this skeleton. role(i, mat) picks the color role for entry i. */
  function borrow(donor: string, entries: string[], role: (i: number, mat: string) => Role | null): THREE.Object3D[] | null {
    const g = getOrLoadGlb(donorUrl(donor));
    if (!g || !armatureScene) return null;
    return transplant(g.scene, armatureScene, (part, mat) => {
      const i = entries.findIndex((e) => matchesEntry([e], part, mat));
      return i < 0 ? null : role(i, mat);
    });
  }

  /**
   * Some donor hairstyles have a beard modelled into the same mesh. Keep only the beard triangles
   * (lower face, in front of the ears) or only everything else, so beards can be a separate option.
   */
  function cutRegion(objs: THREE.Object3D[] | null, cut?: "beard" | "rest"): THREE.Object3D[] | null {
    if (!objs || !cut) return objs;
    for (const o of objs) {
      const mesh = o as THREE.Mesh;
      const geo = mesh.geometry.clone();
      const pos = geo.getAttribute("position");
      const idx = geo.getIndex();
      if (!idx) continue;
      const keep: number[] = [];
      for (let t = 0; t < idx.count; t += 3) {
        let y = 0;
        let z = 0;
        for (let k = 0; k < 3; k++) {
          y += pos.getY(idx.getX(t + k)) / 3;
          z += pos.getZ(idx.getX(t + k)) / 3;
        }
        const isBeard = y < 1.655 && z > 0.05;
        if (isBeard === (cut === "beard")) keep.push(idx.getX(t), idx.getX(t + 1), idx.getX(t + 2));
      }
      geo.setIndex(keep);
      geo.clearGroups();
      mesh.geometry = geo;
    }
    return objs;
  }

  /** Bind-pose size of the head (skin meshes only), measured once per model. */
  function measureHead(): THREE.Box3 | null {
    if (headBox) return headBox;
    const root = armatureScene;
    if (!root) return null;
    player.updateMatrixWorld(true);
    const box = new THREE.Box3();
    root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      const mat = Array.isArray(m.material) ? m.material[0] : m.material;
      if (m.isSkinnedMesh && !m.userData.role && /_Head/.test(partName(m)) && /^skin/i.test(mat?.name ?? "")) {
        box.union(new THREE.Box3().setFromObject(m, true));
      }
    });
    if (box.isEmpty()) return null;
    headBox = box.applyMatrix4(root.matrixWorld.clone().invert());
    return headBox;
  }

  /** Skin box of the head and the eye position, measured in the current pose (model space). */
  function measureNow(): { box: THREE.Box3; eye?: EyeInfo } | null {
    const root = armatureScene;
    if (!root) return null;
    player.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const eyes = new THREE.Box3();
    root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh || m.userData.role || !/_Head/.test(partName(m))) return;
      const name = (Array.isArray(m.material) ? m.material[0] : m.material)?.name ?? "";
      if (/^skin/i.test(name)) box.union(new THREE.Box3().setFromObject(m, true));
      else if (/^(eye|brown)$/i.test(name)) eyes.union(new THREE.Box3().setFromObject(m, true));
    });
    if (box.isEmpty()) return null;
    const inv = root.matrixWorld.clone().invert();
    box.applyMatrix4(inv);
    let eye: EyeInfo | undefined;
    if (!eyes.isEmpty()) {
      eyes.applyMatrix4(inv);
      eye = { y: (eyes.min.y + eyes.max.y) / 2, z: eyes.max.z, span: eyes.max.x - eyes.min.x };
    }
    return { box, eye };
  }

  /** Build a procedural accessory, fit it to the head as it is now, and attach it to the head bone. */
  function buildOnHead(kind: Parameters<typeof buildProcedural>[0]): THREE.Object3D[] | null {
    const root = armatureScene;
    const bone = root?.getObjectByName("Head") as THREE.Bone | undefined;
    const m = measureNow();
    if (!root || !bone || !m) return null;
    const obj = buildProcedural(kind, m.box, currentProfile?.gender === "feminine" ? 1.15 : 1, m.eye);
    root.add(obj);
    root.updateMatrixWorld(true);
    bone.attach(obj); // keeps the world placement and follows the head from now on
    return [obj];
  }

  /**
   * Tall boots are modelled around a bare leg: with trousers or a different leg shape under them the
   * leg pokes through the shaft while walking. Swell the shaft slightly around each leg's axis.
   */
  function swellBoots(objs: THREE.Object3D[] | null): THREE.Object3D[] | null {
    const root = armatureScene;
    if (!objs || !root || !sitBones) return objs;
    root.updateMatrixWorld(true);
    const axis = (bone: THREE.Object3D) => root.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));
    const left = axis(sitBones.loLegL);
    const right = axis(sitBones.loLegR);
    for (const o of objs) {
      const geo = (o as THREE.Mesh).geometry.clone();
      const pos = geo.getAttribute("position");
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const k = 1 + 0.12 * Math.min(1, Math.max(0, (y - 0.05) / 0.12)); // 1 at the sole, 1.12 up the shaft
        const c = pos.getX(i) >= 0 ? left : right;
        pos.setX(i, c.x + (pos.getX(i) - c.x) * k);
        pos.setZ(i, c.z + (pos.getZ(i) - c.z) * k);
      }
      pos.needsUpdate = true;
      (o as THREE.Mesh).geometry = geo;
    }
    return objs;
  }

  /** Donor hats are sized for a bare head: enlarge them slightly so they sit over the hair. */
  function growOverHair(objs: THREE.Object3D[] | null): THREE.Object3D[] | null {
    const box = measureHead();
    if (!objs || !box) return objs;
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    c.y = box.max.y - 0.45 * size.x;
    for (const o of objs) {
      const m = o as THREE.Mesh;
      m.geometry = m.geometry.clone().translate(-c.x, -c.y, -c.z).scale(1.16, 1.1, 1.16).translate(c.x, c.y + 0.012, c.z);
    }
    return objs;
  }

  function applyAddons(p: CharacterProfile): void {
    const g = p.gender;
    const L = (id: string) => `${activeOutfitUrl}|${id}`;

    const hair = getHairStyle(p.hairStyle);
    const hairObjs = setSlot("hair", hair.donor ? L(hair.id) : "", () =>
      cutRegion(borrow(hair.donor!, hair.parts ?? [], (i) => (i === 0 ? "hair" : "hairDark")), hair.cut)
    );
    hideBakedHair = hairObjs.length > 0;

    const fh = getFacialHair(p.facialHair);
    setSlot("facial", fh.donor ? L(fh.id) : "", () => cutRegion(borrow(fh.donor!, fh.parts ?? [], () => (fh.cut ? "hair" : "hairDark")), fh.cut));

    const hat = getHat(p.hat);
    setSlot("hat", hat.id === "none" ? "" : L(hat.id), () =>
      hat.proc ? buildOnHead(hat.proc) : growOverHair(borrow(hat.donors![g]!, hat.parts ?? [], () => "fixed"))
    );

    const gl = getGlasses(p.glasses);
    setSlot("glasses", gl.proc ? L(gl.id) : "", () => buildOnHead(gl.proc!));

    const shoe = getShoes(p.shoes);
    const tint = shoe.tint?.[g] ?? [];
    const shoeObjs = setSlot("shoes", shoe.donors ? L(shoe.id) : "", () => {
      const objs = borrow(shoe.donors![g]!, ["Feet:Skin", "Feet:Skin_Darker", ...tint.map((t) => `Feet:${t}`), ...donorFeetRest(shoe.donors![g]!, tint)], (i, mat) =>
        /^skin_darker$/i.test(mat) ? "skinDark" : /^skin$/i.test(mat) ? "skin" : tint.includes(mat) ? "shoe" : "fixed"
      );
      return shoe.tall ? swellBoots(objs) : objs;
    });
    hideBakedFeet = shoeObjs.length > 0;

    // Looks whose legs end above the ankle (tall boots) would show a gap under swapped shoes:
    // add bare skin legs borrowed from another feminine model to fill the shins and ankles.
    const fill = hideBakedFeet && !shoe.tall && getLook(p.look).fillLegs;
    setSlot("legfill", fill ? L("legfill") : "", () => borrow("Female/Formal", ["Legs:Skin"], () => "skin"));
  }

  /** Every other material on the donor's Feet (soles, laces...), so the whole shoe is borrowed. */
  function donorFeetRest(donor: string, tint: string[]): string[] {
    const g = getOrLoadGlb(donorUrl(donor));
    const out: string[] = [];
    g?.scene.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh && partName(m).includes("_Feet")) {
        const n = (Array.isArray(m.material) ? m.material[0] : m.material).name;
        if (n && !tint.includes(n)) out.push(`Feet:${n}`);
      }
    });
    return out;
  }

  function recolorAddons(p: CharacterProfile): void {
    const hair = new THREE.Color(p.hairColor);
    const skin = new THREE.Color(p.skinTone);
    const base: RoleColors = {
      hair,
      hairDark: hair.clone().multiplyScalar(0.55),
      skin,
      skinDark: skin.clone().multiplyScalar(0.85),
    };
    const objs = (n: string) => slots.get(n)?.objs ?? [];
    recolor([...objs("hair"), ...objs("facial")], base);
    recolor(objs("legfill"), { skin: base.skin ?? skin });
    recolor(objs("shoes"), { ...base, ...(p.shoeColor ? { shoe: new THREE.Color(p.shoeColor) } : {}) });
    recolor(objs("hat"), { accent: new THREE.Color(p.hatColor || shirtColorFor(p.homeroom)) });
    recolor(objs("glasses"), { accent: new THREE.Color(p.glassesColor) });
  }

  // ---------------------------------------------------------------------------
  // rebuildAvatarMeshes — load/swap the GLB and wire up animations
  // ---------------------------------------------------------------------------
  function rebuildAvatarMeshes(): void {
    if (!currentProfile) return;
    const p = currentProfile;

    const outfitUrl = resolveLookUrl(p.look);
    const gltf = getOrLoadGlb(outfitUrl);
    if (!gltf) return; // will auto-refresh when loaded

    // Swap the armature scene when the outfit changes
    if (!armatureScene || activeOutfitUrl !== outfitUrl) {
      if (armatureScene) {
        modelRoot.remove(armatureScene);
        if (mixer) { mixer.stopAllAction(); mixer.uncacheRoot(armatureScene); }
      }
      activeOutfitUrl = outfitUrl;
      slots.clear(); // add-ons belonged to the previous armature
      headBox = null;
      armatureScene = SkeletonUtils.clone(gltf.scene);

      // Remove the decorative Icosphere (Quaternius always includes one)
      armatureScene.traverse((obj) => {
        // Icosphere is a decorative blob; the Pistol/Sword props (a Group when they have several
        // materials) is not for a school game. Hiding the node hides all its children.
        if (obj.name === "Icosphere" || /^(Pistol|Sword)/.test(obj.name)) {
          obj.visible = false;
        }
      });

      modelRoot.add(armatureScene);

      findSitBones();

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
      measureGait(gltf);
    }

    applyAddons(p);
    // Always re-apply materials (profile colors may have changed)
    applyMaterials(p);
    recolorAddons(p);
  }

  activeRigs.add(rebuildAvatarMeshes);

  // ---------------------------------------------------------------------------
  // Seated pose. The Quaternius clips have no sitting animation, so while the scene
  // reports "seated" (legs pivots folded) the leg and arm bones are aimed by hand:
  // thighs forward, shins down to the floor, forearms resting forward.
  // ---------------------------------------------------------------------------
  function findSitBones(): void {
    const root = armatureScene;
    if (!root) return;
    const get = (n: string) => root.getObjectByName(n);
    const b = {
      upLegL: get("UpperLegL"), upLegR: get("UpperLegR"), loLegL: get("LowerLegL"), loLegR: get("LowerLegR"),
      footL: get("FootL"), footR: get("FootR"), toeL: get("PTL"), toeR: get("PTR"), upArmL: get("UpperArmL"), upArmR: get("UpperArmR"),
      loArmL: get("LowerArmL"), loArmR: get("LowerArmR"),
    };
    sitBones = Object.values(b).every(Boolean) ? (b as SitBones) : null;
    restPose = [...Object.values(b), get("Body"), get("PTL"), get("PTR")]
      .filter((o): o is THREE.Object3D => !!o)
      .map((o) => [o, o.position.clone(), o.quaternion.clone()] as [THREE.Object3D, THREE.Vector3, THREE.Quaternion]);
    // Standing height of the hip joint relative to the player origin
    player.updateMatrixWorld(true);
    if (sitBones) {
      const p = new THREE.Vector3();
      sitBones.upLegL.getWorldPosition(p);
      legPivotHeight = player.worldToLocal(p).y - bodyGroup.position.y * scaleContainer.scale.y;
      sitBones.footL.getWorldPosition(p);
      footRest.L.copy(sitBones.loLegL.worldToLocal(p.clone()));
      sitBones.footR.getWorldPosition(p);
      footRest.R.copy(sitBones.loLegR.worldToLocal(p.clone()));
    }
  }

  const _v1 = new THREE.Vector3();
  const _v2 = new THREE.Vector3();
  const _q1 = new THREE.Quaternion();
  const _q2 = new THREE.Quaternion();
  const _q3 = new THREE.Quaternion();

  /**
   * Rotate `bone` about its joint so that its axis points along dirPlayer (player space).
   * The axis is the direction to `child`, or `axisLocal` (in the bone's own space) when it has no child.
   */
  function aimBone(bone: THREE.Object3D, child: THREE.Object3D | null, axisLocal: THREE.Vector3 | null, dirPlayer: THREE.Vector3, t: number, worldDir = false): void {
    if (t <= 0.001 || !bone.parent) return;
    bone.updateWorldMatrix(true, true);
    if (child) {
      bone.getWorldPosition(_v1);
      child.getWorldPosition(_v2);
      _v2.sub(_v1).normalize();
    } else {
      bone.getWorldQuaternion(_q1);
      _v2.copy(axisLocal!).normalize().applyQuaternion(_q1);
    }
    player.getWorldQuaternion(_q1);
    const dirW = worldDir ? dirPlayer.clone().normalize() : dirPlayer.clone().normalize().applyQuaternion(_q1);
    _q2.setFromUnitVectors(_v2, dirW); // world-space delta
    bone.getWorldQuaternion(_q3);
    _q2.multiply(_q3); // new world rotation
    bone.parent.getWorldQuaternion(_q1);
    _q1.invert().multiply(_q2); // as a local rotation
    bone.quaternion.slerp(_q1, t);
    bone.updateMatrixWorld(true);
  }

  function applySeatedPose(t: number): void {
    const s = sitBones;
    if (!s || t <= 0.001) return;
    player.updateMatrixWorld(true);

    // Hip joint height above the floor right now (bodyGroup has been dropped onto the seat)
    s.upLegL.getWorldPosition(_v1);
    const hipY = player.worldToLocal(_v1.clone()).y;
    s.loLegL.getWorldPosition(_v1);
    const shinLen = _v1.distanceTo(s.loLegL.localToWorld(footRest.L.clone()));
    // Shins go straight down when the seat is high enough, otherwise they angle forward to reach the floor
    const ankleY = 0.06 * modelScale;
    const drop = Math.max(0.05, hipY - ankleY);
    const down = Math.min(1, drop / shinLen);
    const fwd = Math.sqrt(1 - down * down);

    // Feet and toes are driven by the walk animation, not by the shins: remember where they were
    const footW = [s.footL, s.footR].map((f) => f.getWorldPosition(new THREE.Vector3()));
    const toeW = [s.toeL, s.toeR].map((f) => f?.getWorldPosition(new THREE.Vector3()));

    const dir = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    aimBone(s.upLegL, s.loLegL, null, dir(0.1, -0.03, 1), t);
    aimBone(s.upLegR, s.loLegR, null, dir(-0.1, -0.03, 1), t);
    aimBone(s.loLegL, null, footRest.L, dir(0, -down, fwd), t);
    aimBone(s.loLegR, null, footRest.R, dir(0, -down, fwd), t);
    aimBone(s.upArmL, s.loArmL, null, dir(0.12, -1, 0.25), t);
    aimBone(s.upArmR, s.loArmR, null, dir(-0.12, -1, 0.25), t);
    aimBone(s.loArmL, s.loArmL.children[0] ?? null, null, dir(-0.2, -0.25, 1), t);
    aimBone(s.loArmR, s.loArmR.children[0] ?? null, null, dir(0.2, -0.25, 1), t);

    // Move each foot (and its toe) to the end of its shin, keeping the foot flat
    const rests = [footRest.L, footRest.R];
    [s.footL, s.footR].forEach((foot, i) => {
      const shin = i === 0 ? s.loLegL : s.loLegR;
      const target = shin.localToWorld(rests[i].clone());
      const cur = footW[i];
      const next = cur.clone().lerp(target, t);
      const delta = next.clone().sub(cur);
      const root = foot.parent!;
      root.updateWorldMatrix(true, false);
      foot.position.copy(root.worldToLocal(next.clone()));
      foot.updateMatrixWorld(true);
      const toe = i === 0 ? s.toeL : s.toeR;
      const tw = toeW[i];
      if (toe && tw && toe.parent) {
        toe.position.copy(toe.parent.worldToLocal(tw.clone().add(delta)));
        toe.updateMatrixWorld(true);
      }
    });
  }

  /**
   * Stride lengths of the Walk and Run clips: the distance the body travels in one cycle, taken from how fast
   * the planted foot moves backwards relative to the hips. Used to match animation speed to movement speed.
   */
  function measureGait(gltf: GLTF): void {
    const root = armatureScene;
    const foot = root?.getObjectByName("FootL");
    if (!root || !foot) return;
    const probe = new THREE.AnimationMixer(root);
    const out = { ...gait };
    for (const kind of ["walk", "run"] as const) {
      const clip = gltf.animations.find((c) => c.name === (kind === "walk" ? "Walk" : "Run"));
      if (!clip) continue;
      const act = probe.clipAction(clip);
      act.play();
      act.paused = true;
      const N = 96;
      const zs: number[] = [];
      const ys: number[] = [];
      const v = new THREE.Vector3();
      for (let i = 0; i < N; i++) {
        act.time = (clip.duration * i) / N;
        probe.update(0);
        root.updateMatrixWorld(true);
        foot.getWorldPosition(v);
        root.worldToLocal(v);
        zs.push(v.z);
        ys.push(v.y);
      }
      const lo = Math.min(...ys);
      const dt = clip.duration / N;
      const contact = ys.map((y, i) => (y < lo + 0.04 ? (zs[(i + 1) % N] - zs[i]) / dt : null)).filter((x): x is number => x !== null);
      if (contact.length) {
        const speed = -contact.reduce((s, x) => s + x, 0) / contact.length; // native units / s
        if (speed > 0.2) out[kind === "walk" ? "walkCycle" : "runCycle"] = speed * clip.duration;
      }
      out[kind === "walk" ? "walkDur" : "runDur"] = clip.duration;
      act.stop();
    }
    probe.stopAllAction();
    probe.uncacheRoot(root);
    gait = out;
  }

  // ---------------------------------------------------------------------------
  // Foot glue. The foot/toe bones are not children of the shins, so while the clips blend (walk <-> run,
  // changing stride) the shoes can drift away from the ankles and the legs seem to break. After all
  // animation, put each foot back at the end of its shin (toes move with it).
  // ---------------------------------------------------------------------------
  function glueFeet(): void {
    const s = sitBones;
    if (!s || !armatureScene) return;
    armatureScene.updateMatrixWorld(true);
    const shins = [s.loLegL, s.loLegR];
    const rests = [footRest.L, footRest.R];
    const feet = [s.footL, s.footR];
    const toes = [s.toeL, s.toeR];
    for (let i = 0; i < 2; i++) {
      const foot = feet[i];
      const root = foot.parent;
      if (!root) continue;
      const cur = foot.getWorldPosition(new THREE.Vector3());
      const target = shins[i].localToWorld(rests[i].clone());
      const delta = target.clone().sub(cur);
      if (delta.lengthSq() < 1e-10) continue;
      const toe = toes[i];
      const tw = toe?.getWorldPosition(new THREE.Vector3());
      root.updateWorldMatrix(true, false);
      foot.position.copy(root.worldToLocal(target.clone()));
      foot.updateMatrixWorld(true);
      if (toe && tw && toe.parent) {
        toe.parent.updateWorldMatrix(true, false);
        toe.position.copy(toe.parent.worldToLocal(tw.add(delta)));
        toe.updateMatrixWorld(true);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // syncSkeleton — called every frame by scene.ts (also via onBeforeRender)
  // ---------------------------------------------------------------------------
  function syncSkeleton(): void {
    if (!armatureScene || !mixer) return;

    const nowMs = typeof performance !== "undefined" ? performance.now() : 0;
    const dt = lastSyncMs > 0 ? Math.min(0.1, (nowMs - lastSyncMs) * 0.001) : 0.016;
    lastSyncMs = nowMs;

    // Derive motion intensity from the leg pivot angles that scene.ts drives
    const legSwing = Math.abs(leftLegPivot.rotation.x) + Math.abs(rightLegPivot.rotation.x);
    const armActivity = Math.abs(leftArmPivot.rotation.x) + Math.abs(rightArmPivot.rotation.x);
    const isSeated = leftLegPivot.rotation.x < -1.1 && rightLegPivot.rotation.x < -1.1;
    const driven = nowMs - locoStamp < 250 && !isSeated; // scene reports real speed this frame
    const isWaving = armActivity > 1.8 && legSwing <= 0.04;

    let targetIdle: number;
    let targetWalk: number;
    let targetRun: number;
    let mixerDt = dt;

    if (driven) {
      // Speed-driven locomotion. World speed -> animation speed so feet don't skate, with limits that keep
      // the legs looking human (the game's walk/sprint speeds are fast for a character this size).
      smoothSpeed += (locoSpeed - smoothSpeed) * Math.min(1, dt * 9);
      const scale = modelScale * scaleContainer.scale.y;
      const walkWorld = gait.walkCycle * scale; // world distance per walk cycle
      const runWorld = gait.runCycle * scale;
      const v = smoothSpeed;
      const smooth = (e0: number, e1: number, x: number) => {
        const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
        return t * t * (3 - 2 * t);
      };
      const wRun = smooth(2.2, 4.2, v); // walk -> jog/run blend
      const moveW = smooth(0.12, 0.6, v); // idle -> moving
      targetIdle = 1 - moveW;
      targetWalk = moveW * (1 - wRun);
      targetRun = moveW * wRun;
      // cycles per second for each clip, clamped to a natural cadence
      const walkRate = Math.min(1.45, Math.max(0.55, v / (walkWorld / gait.walkDur))) / gait.walkDur;
      const runRate = Math.min(1.75, Math.max(0.8, v / (runWorld / gait.runDur))) / gait.runDur;
      gaitPhase = (gaitPhase + dt * (walkRate * (1 - wRun) + runRate * wRun) * moveW) % 1;
      if (walkAction) { walkAction.paused = true; walkAction.time = gaitPhase * gait.walkDur; }
      if (runAction) { runAction.paused = true; runAction.time = gaitPhase * gait.runDur; }
      // Forward lean grows with speed (a sprint leans more than a jog)
      modelRoot.rotation.x = 0;
      bodyGroup.rotation.x = 0.02 + 0.1 * smooth(4, 9, v) * moveW;
    } else {
      // Fallback (previews, seated, driving): infer from the leg pivots the scene animates
      smoothSpeed = 0;
      const isMoving = legSwing > 0.04;
      const isSprinting = legSwing > 0.75;
      targetIdle = isSeated ? 1 : (isMoving ? 0 : 1);
      targetWalk = isMoving && !isSprinting && !isSeated ? 1 : 0;
      targetRun = isSprinting && !isSeated ? 1 : 0;
      if (walkAction) walkAction.paused = false;
      if (runAction) runAction.paused = false;
      mixerDt = isSeated ? dt * 0.2 : dt * (isSprinting ? 1.4 : 1.0);
    }
    const targetWave = isWaving ? 1 : 0;

    const lerpSpeed = Math.min(1, dt * 8);

    if (idleAction) idleAction.weight += (targetIdle - idleAction.weight) * lerpSpeed;
    if (walkAction) walkAction.weight += (targetWalk - walkAction.weight) * lerpSpeed;
    if (runAction)  runAction.weight  += (targetRun  - runAction.weight)  * lerpSpeed;
    if (waveAction) waveAction.weight += (targetWave - waveAction.weight) * lerpSpeed;

    // Undo last frame's hand-made poses first; bones the clips animate are overwritten by the mixer anyway
    for (const [o, p, q] of restPose) {
      o.position.copy(p);
      o.quaternion.copy(q);
    }
    mixer.update(mixerDt);

    // Blend into / out of the procedural seated pose
    seatBlend += ((isSeated ? 1 : 0) - seatBlend) * Math.min(1, dt * 8);
    if (seatBlend < 0.002) seatBlend = 0;
    if (seatBlend > 0.998) seatBlend = 1;
    applySeatedPose(seatBlend);

    glueFeet();

    // Sync bodyGroup height to torsoGroup for scene.ts bob (keeps feet on ground)
    // (apply only the change, so a seat drop set by scene.ts is kept)
    const bob = torsoGroup.position.y - 0.84;
    bodyGroup.position.y += bob - lastBob;
    lastBob = bob;

    // Keep model root flat (scene.ts may tilt torsoGroup for running lean)
    modelRoot.rotation.x = 0;
    modelRoot.rotation.z = 0;
  }

  // ---------------------------------------------------------------------------
  // apply — called when profile changes
  // ---------------------------------------------------------------------------
  function apply(profile: CharacterProfile): void {
    profile = sanitizeProfile(profile);
    currentProfile = { ...profile };

    // Slightly smaller feminine models
    const s = profile.gender === "feminine" ? 0.96 : 1.0;
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
      nameTagSprite.position.y = (1.73 * modelScale + 0.32) * s;
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
    setLocomotion: (speed: number) => {
      locoSpeed = speed;
      locoStamp = typeof performance !== "undefined" ? performance.now() : 0;
    },
    seatDrop: (seatY: number) => (seatY + 0.01 + 0.095 * modelScale - legPivotHeight) / scaleContainer.scale.y,
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
