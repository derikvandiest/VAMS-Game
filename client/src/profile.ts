/**
 * Character profile data: types, option catalogues, persistence and change events.
 * Powered by Option 5: Avaturn Realistic 3D Avatar System (@avaturn/sdk + Avaturn GLB Rigs).
 */

export type Homeroom = "CSUN" | "LMU" | "UCLA" | "USC";
export type Gender = "male" | "female";

export type HeadStyle = "Head.001" | "Head.002" | "Head.003" | "Head.004";

export type HairStyle =
  | "Hair.Afro"
  | "Hair.Dreads"
  | "Hair.Fade"
  | "Hair.Crop"
  | "Hair.SidePart"
  | "Hair.LongWaves"
  | "Hair.Bob"
  | "Hair.Braids"
  | "Hair.002"
  | "Avaturn.LongWaves"
  | "Avaturn.ShoulderLob"
  | "bald";

export type HairCategory = "male" | "female" | "unisex";

export type EyeStyle =
  | "Eyes.001"
  | "Eyes.002"
  | "Eyes.003"
  | "Eyes.004"
  | "Eyes.005"
  | "Eyes.006"
  | "Eyes.007"
  | "Eyes.008"
  | "Eyes.009"
  | "Eyes.010"
  | "Eyes.011"
  | "Eyes.012";

export type BrowStyle =
  | "EyeBrow.001"
  | "EyeBrow.002"
  | "EyeBrow.003"
  | "EyeBrow.004"
  | "EyeBrow.005"
  | "EyeBrow.006"
  | "EyeBrow.007"
  | "EyeBrow.008"
  | "EyeBrow.009"
  | "EyeBrow.010";

export type NoseStyle = "Nose.001" | "Nose.002" | "Nose.003" | "Nose.004";

export type FaceDetailStyle =
  | "none"
  | "Face.001"
  | "Face.002"
  | "Face.003"
  | "Face.004"
  | "Face.005"
  | "Face.006"
  | "Face.007";

export type FacialHair = "none";

export type GlassesStyle = "none" | "Glasses.001";

export type HeadwearStyle = "none";

export type EarringStyle = "none";

export type TopStyle =
  | "Top.ButtonUp"
  | "Top.Polo"
  | "Top.Sweater"
  | "Top.Blazer"
  | "Top.001"
  | "Top.002";

export type BottomStyle = "Bottom.001";

export type ShoeStyle = "Shoes.001";

export interface CharacterProfile {
  name: string;
  homeroom: Homeroom;
  gender: Gender;
  headStyle: HeadStyle;
  skinTone: string;
  eyeStyle: EyeStyle;
  eyeColor: string;
  browStyle: BrowStyle;
  noseStyle: NoseStyle;
  faceDetail: FaceDetailStyle;
  lipColor: string;
  hairStyle: HairStyle;
  hairColor: string;
  hairHighlight: string;
  facialHair: FacialHair;
  glasses: GlassesStyle;
  glassesColor: string;
  headwear: HeadwearStyle;
  hatColor: string;
  earrings: EarringStyle;
  topStyle: TopStyle;
  shirtColor: string;
  bottoms: BottomStyle;
  pantsColor: string;
  shoeStyle: ShoeStyle;
  shoesColor: string;
  /** Optional custom exported Avaturn GLB URL or 'idb:custom' marker */
  customAvatarUrl?: string;
}

export const HOMEROOM_INFO: Record<Homeroom, { label: string; shirtColor: string; textHex: string }> = {
  CSUN: { label: "CSUN", shirtColor: "#d97706", textHex: "#ffffff" },
  LMU: { label: "LMU", shirtColor: "#15803d", textHex: "#ffffff" },
  UCLA: { label: "UCLA", shirtColor: "#1d4ed8", textHex: "#ffffff" },
  USC: { label: "USC", shirtColor: "#991b1b", textHex: "#ffffff" },
};

export const HOMEROOMS = Object.keys(HOMEROOM_INFO) as Homeroom[];

export const SKIN_TONES = [
  { label: "Porcelain Alabaster", hex: "#fbe4d8" },
  { label: "Fair Neutral", hex: "#f7d5c3" },
  { label: "Warm Peach", hex: "#f0c3a8" },
  { label: "Light Sand", hex: "#e5b18f" },
  { label: "Golden Honey", hex: "#d69e77" },
  { label: "Olive Warm", hex: "#c48a60" },
  { label: "Amber Tan", hex: "#b4774d" },
  { label: "Sun Bronze", hex: "#a1653c" },
  { label: "Warm Caramel", hex: "#8c532e" },
  { label: "Chestnut Brown", hex: "#764223" },
  { label: "Dark Walnut", hex: "#5f3319" },
  { label: "Deep Espresso", hex: "#4a2512" },
  { label: "Midnight Cocoa", hex: "#381a0b" },
  { label: "Rich Ebony", hex: "#261207" },
];

export const HEAD_STYLES: Array<{ id: HeadStyle; label: string }> = [
  { id: "Head.001", label: "Avaturn Classic" },
  { id: "Head.002", label: "Modern Educator" },
  { id: "Head.003", label: "Warm Expression" },
  { id: "Head.004", label: "Confident Smile" },
];

export const EYE_STYLES: Array<{ id: EyeStyle; label: string }> = [
  { id: "Eyes.001", label: "Natural Realistic" },
  { id: "Eyes.002", label: "Wide Expressive" },
  { id: "Eyes.003", label: "Soft Almond" },
  { id: "Eyes.004", label: "Bright Gaze" },
  { id: "Eyes.005", label: "Warm Smile" },
  { id: "Eyes.006", label: "Calm Focus" },
  { id: "Eyes.007", label: "Cheerful" },
  { id: "Eyes.008", label: "Friendly" },
  { id: "Eyes.009", label: "Attentive" },
  { id: "Eyes.010", label: "Defined Lash" },
  { id: "Eyes.011", label: "Deep Gaze" },
  { id: "Eyes.012", label: "Relaxed" },
];

export const EYE_COLORS = [
  { label: "Obsidian Black", hex: "#14110f" },
  { label: "Espresso Brown", hex: "#3b2314" },
  { label: "Warm Brown", hex: "#63391f" },
  { label: "Golden Amber", hex: "#b46927" },
  { label: "Hazel Green", hex: "#6e7838" },
  { label: "Emerald Green", hex: "#15803d" },
  { label: "Sapphire Blue", hex: "#2563eb" },
  { label: "Ocean Blue", hex: "#0284c7" },
  { label: "Slate Gray", hex: "#475569" },
  { label: "Violet", hex: "#7c3aed" },
];

export const LIP_COLORS = [
  { label: "Natural Blush", hex: "#d95b72" },
  { label: "Soft Rose", hex: "#e11d48" },
  { label: "Warm Coral", hex: "#f97316" },
  { label: "Blossom Pink", hex: "#ec4899" },
  { label: "Berry Plum", hex: "#9d174d" },
  { label: "Classic Crimson", hex: "#b91c1c" },
  { label: "Warm Terracotta", hex: "#b45309" },
];

export const BROW_STYLES: Array<{ id: BrowStyle; label: string }> = [
  { id: "EyeBrow.001", label: "Natural Soft" },
  { id: "EyeBrow.002", label: "Classic Arch" },
  { id: "EyeBrow.003", label: "Soft Rounded" },
  { id: "EyeBrow.004", label: "Bold & Full" },
  { id: "EyeBrow.005", label: "Sleek Straight" },
  { id: "EyeBrow.006", label: "Gentle Curve" },
  { id: "EyeBrow.007", label: "Expressive Tilt" },
  { id: "EyeBrow.008", label: "High Arch" },
  { id: "EyeBrow.009", label: "Raised" },
  { id: "EyeBrow.010", label: "Sculpted Angle" },
];

export const NOSE_STYLES: Array<{ id: NoseStyle; label: string }> = [
  { id: "Nose.001", label: "Classic Straight" },
  { id: "Nose.002", label: "Soft Rounded" },
  { id: "Nose.003", label: "Sculpted Bridge" },
  { id: "Nose.004", label: "Defined" },
];

export const FACE_DETAIL_OPTIONS: Array<{ id: FaceDetailStyle; label: string }> = [
  { id: "none", label: "None" },
  { id: "Face.001", label: "Warm Blush" },
  { id: "Face.002", label: "Beauty Mark" },
  { id: "Face.003", label: "Subtle Freckles" },
  { id: "Face.004", label: "Cheek Accent" },
  { id: "Face.005", label: "Star Pin" },
  { id: "Face.006", label: "Sport Stripe" },
  { id: "Face.007", label: "Face Mask" },
];

export const HAIR_STYLES: Array<{ id: HairStyle; label: string; category: HairCategory }> = [
  { id: "Hair.Afro", label: "Classic Volumetric Afro", category: "unisex" },
  { id: "Hair.Dreads", label: "Layered Dreadlocks / Locs", category: "unisex" },
  { id: "Hair.Fade", label: "Clean Lineup Fade", category: "male" },
  { id: "Hair.Crop", label: "Textured Modern Crop", category: "male" },
  { id: "Hair.SidePart", label: "Executive Side Part", category: "male" },
  { id: "Hair.LongWaves", label: "Flowing Long Waves", category: "female" },
  { id: "Hair.Bob", label: "Shoulder Lob / Bob", category: "female" },
  { id: "Hair.Braids", label: "Braided Long Locs", category: "unisex" },
  { id: "bald", label: "Clean Shaved", category: "unisex" },
];

export const HAIR_COLORS = [
  { label: "Jet Black", hex: "#14110f" },
  { label: "Espresso", hex: "#26170e" },
  { label: "Dark Brown", hex: "#3b2314" },
  { label: "Warm Brown", hex: "#54341e" },
  { label: "Chestnut", hex: "#734222" },
  { label: "Copper Auburn", hex: "#943d1b" },
  { label: "Ginger Red", hex: "#bf521b" },
  { label: "Honey Blonde", hex: "#b88a3d" },
  { label: "Golden Blonde", hex: "#deb352" },
  { label: "Platinum Blonde", hex: "#ede2ba" },
  { label: "Silver Fox", hex: "#9ca3af" },
  { label: "Snow White", hex: "#f1f5f9" },
  { label: "Cobalt Blue", hex: "#2563eb" },
  { label: "Rose Pink", hex: "#ec4899" },
  { label: "Royal Purple", hex: "#7c3aed" },
  { label: "Teal", hex: "#0d9488" },
];

export const TOP_STYLES: Array<{ id: TopStyle; label: string }> = [
  { id: "Top.ButtonUp", label: "Formal Suit" },
  { id: "Top.Polo", label: "Casual Outfit" },
  { id: "Top.Sweater", label: "Hoodie / Casual" },
  { id: "Top.Blazer", label: "Business Suit" },
];

export const SHIRT_COLORS = [
  { label: "CSUN Gold", hex: HOMEROOM_INFO.CSUN.shirtColor },
  { label: "LMU Green", hex: HOMEROOM_INFO.LMU.shirtColor },
  { label: "UCLA Blue", hex: HOMEROOM_INFO.UCLA.shirtColor },
  { label: "USC Cardinal", hex: HOMEROOM_INFO.USC.shirtColor },
  { label: "Crisp White", hex: "#f8fafc" },
  { label: "Onyx Black", hex: "#1f2937" },
  { label: "Heather Gray", hex: "#6b7280" },
  { label: "Crimson", hex: "#dc2626" },
  { label: "Sunset Orange", hex: "#f97316" },
  { label: "Sunshine", hex: "#facc15" },
  { label: "Emerald", hex: "#22c55e" },
  { label: "Teal", hex: "#14b8a6" },
  { label: "Sky Blue", hex: "#38bdf8" },
  { label: "Oxford Navy", hex: "#1e3a8a" },
  { label: "Royal Purple", hex: "#7c3aed" },
  { label: "Blush Pink", hex: "#ec4899" },
];

export const PANTS_COLORS = [
  { label: "Charcoal", hex: "#2c3340" },
  { label: "Jet Black", hex: "#111827" },
  { label: "Deep Navy", hex: "#1e3a5f" },
  { label: "Classic Denim", hex: "#3b6aa0" },
  { label: "Light Wash Denim", hex: "#608ec4" },
  { label: "Warm Khaki", hex: "#c8a97a" },
  { label: "Olive Drab", hex: "#4d5b2f" },
  { label: "Espresso", hex: "#5a3b24" },
  { label: "Slate Gray", hex: "#8b949e" },
  { label: "Burgundy", hex: "#7f1d1d" },
  { label: "Cream White", hex: "#e5e7eb" },
  { label: "Blush Rose", hex: "#f472b6" },
];

export const SHOE_COLORS = [
  { label: "Clean White", hex: "#f1f5f9" },
  { label: "Onyx Black", hex: "#18181b" },
  { label: "Cognac Leather", hex: "#854d0e" },
  { label: "Dark Espresso", hex: "#3f2314" },
  { label: "Navy Suede", hex: "#1e3a8a" },
  { label: "Crimson Sport", hex: "#b91c1c" },
  { label: "Slate Grey", hex: "#64748b" },
  { label: "Sandstone", hex: "#d6c5b3" },
];

export const GLASSES_COLORS = [
  { label: "Charcoal Slate", hex: "#1e293b" },
  { label: "Jet Black", hex: "#0f172a" },
  { label: "Tortoiseshell", hex: "#78350f" },
  { label: "Brushed Gold", hex: "#ca8a04" },
  { label: "Silver Wire", hex: "#94a3b8" },
  { label: "Ruby Frame", hex: "#991b1b" },
  { label: "Cobalt Frame", hex: "#1d4ed8" },
  { label: "Rose Gold", hex: "#db2777" },
];

export const HAT_COLORS = [
  { label: "UCLA Blue", hex: HOMEROOM_INFO.UCLA.shirtColor },
  { label: "USC Cardinal", hex: HOMEROOM_INFO.USC.shirtColor },
  { label: "CSUN Gold", hex: HOMEROOM_INFO.CSUN.shirtColor },
  { label: "LMU Green", hex: HOMEROOM_INFO.LMU.shirtColor },
  { label: "Onyx Black", hex: "#1e293b" },
  { label: "Warm Camel", hex: "#b4834b" },
  { label: "Cream White", hex: "#f8fafc" },
  { label: "Navy Blue", hex: "#1e3a8a" },
  { label: "Heather Gray", hex: "#64748b" },
  { label: "Blush Pink", hex: "#ec4899" },
];

export const BOTTOM_STYLES: Array<{ id: BottomStyle; label: string }> = [{ id: "Bottom.001", label: "Tailored Trousers" }];

export const SHOE_STYLES: Array<{ id: ShoeStyle; label: string }> = [{ id: "Shoes.001", label: "Sneakers" }];

export const FACIAL_HAIR_OPTIONS: Array<{ id: FacialHair; label: string }> = [{ id: "none", label: "Clean Shaven" }];

export const GLASSES_OPTIONS: Array<{ id: GlassesStyle; label: string }> = [
  { id: "none", label: "No Glasses" },
  { id: "Glasses.001", label: "Designer Frames" },
];

export const HEADWEAR_OPTIONS: Array<{ id: HeadwearStyle; label: string }> = [{ id: "none", label: "No Headwear" }];

export const EARRING_OPTIONS: Array<{ id: EarringStyle; label: string }> = [{ id: "none", label: "No Earrings" }];

const STORAGE_KEY = "eld_character_profile_v3";
const IDB_NAME = "eld_avaturn_storage_v1";
const IDB_STORE = "avatars";
const IDB_CUSTOM_KEY = "player_custom_avaturn_glb";

let cachedCustomGlbUrl: string | null = null;

function openAvatarDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not supported"));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCustomAvatarGlb(urlOrDataUrl: string): Promise<void> {
  cachedCustomGlbUrl = urlOrDataUrl;
  try {
    const db = await openAvatarDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(urlOrDataUrl, IDB_CUSTOM_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Could not persist custom Avaturn GLB to IndexedDB:", err);
  }
}

export async function clearCustomAvatarGlb(): Promise<void> {
  cachedCustomGlbUrl = null;
  try {
    const db = await openAvatarDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(IDB_CUSTOM_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }
}

export function getCachedCustomAvatarGlb(): string | null {
  return cachedCustomGlbUrl;
}

export async function hydrateCustomAvatarGlb(): Promise<string | null> {
  if (cachedCustomGlbUrl) return cachedCustomGlbUrl;
  try {
    const db = await openAvatarDb();
    const val = await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(IDB_CUSTOM_KEY);
      req.onsuccess = () => resolve(typeof req.result === "string" ? req.result : null);
      req.onerror = () => reject(req.error);
    });
    if (val) {
      cachedCustomGlbUrl = val;
    }
    return val;
  } catch {
    return null;
  }
}

export function getDefaultProfile(): CharacterProfile {
  return {
    name: localStorage.getItem("eld_player_name") || "Educator",
    homeroom: "UCLA",
    gender: "male",
    headStyle: "Head.001",
    skinTone: "#f5c6a5",
    eyeStyle: "Eyes.001",
    eyeColor: "#3b2314",
    browStyle: "EyeBrow.001",
    noseStyle: "Nose.001",
    faceDetail: "none",
    lipColor: "#d95b72",
    hairStyle: "Hair.Afro",
    hairColor: "#26170e",
    hairHighlight: "#1d4ed8",
    facialHair: "none",
    glasses: "none",
    glassesColor: "#1e293b",
    headwear: "none",
    hatColor: HOMEROOM_INFO.UCLA.shirtColor,
    earrings: "none",
    topStyle: "Top.ButtonUp",
    shirtColor: HOMEROOM_INFO.UCLA.shirtColor,
    bottoms: "Bottom.001",
    pantsColor: "#2c3340",
    shoeStyle: "Shoes.001",
    shoesColor: "#f1f5f9",
    customAvatarUrl: "",
  };
}

const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
const pick = <T extends string>(v: unknown, list: Array<{ id: T }>, fallback: T): T =>
  list.some((o) => o.id === v) ? (v as T) : fallback;

export function loadCharacterProfile(): CharacterProfile {
  const fb = getDefaultProfile();
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("eld_character_profile_v2");
    if (!raw) return fb;
    const p = JSON.parse(raw);
    const gender: Gender = p.gender === "female" ? "female" : "male";
    const defaultHair: HairStyle = gender === "female" ? "Hair.LongWaves" : "Hair.Afro";
    const hairColor = isHex(p.hairColor) ? p.hairColor : fb.hairColor;
    const shirtColor = isHex(p.shirtColor) ? p.shirtColor : fb.shirtColor;
    return {
      name: (typeof p.name === "string" && p.name.trim() ? p.name.trim() : fb.name).slice(0, 18),
      homeroom: HOMEROOMS.includes(p.homeroom) ? p.homeroom : fb.homeroom,
      gender,
      headStyle: pick(p.headStyle, HEAD_STYLES, fb.headStyle),
      skinTone: isHex(p.skinTone) ? p.skinTone : fb.skinTone,
      eyeStyle: pick(p.eyeStyle, EYE_STYLES, fb.eyeStyle),
      eyeColor: isHex(p.eyeColor) ? p.eyeColor : fb.eyeColor,
      browStyle: pick(p.browStyle, BROW_STYLES, fb.browStyle),
      noseStyle: pick(p.noseStyle, NOSE_STYLES, fb.noseStyle),
      faceDetail: pick(p.faceDetail, FACE_DETAIL_OPTIONS, fb.faceDetail),
      lipColor: isHex(p.lipColor) ? p.lipColor : fb.lipColor,
      hairStyle: pick(p.hairStyle, HAIR_STYLES, defaultHair),
      hairColor,
      hairHighlight: isHex(p.hairHighlight) ? p.hairHighlight : shirtColor,
      facialHair: pick(p.facialHair, FACIAL_HAIR_OPTIONS, fb.facialHair),
      glasses: pick(p.glasses, GLASSES_OPTIONS, fb.glasses),
      glassesColor: isHex(p.glassesColor) ? p.glassesColor : fb.glassesColor,
      headwear: pick(p.headwear, HEADWEAR_OPTIONS, fb.headwear),
      hatColor: isHex(p.hatColor) ? p.hatColor : shirtColor,
      earrings: pick(p.earrings, EARRING_OPTIONS, fb.earrings),
      topStyle: pick(
        p.topStyle === "Top.001" || p.topStyle === "Top.002" ? "Top.ButtonUp" : p.topStyle,
        TOP_STYLES,
        fb.topStyle
      ),
      shirtColor,
      bottoms: pick(p.bottoms, BOTTOM_STYLES, fb.bottoms),
      pantsColor: isHex(p.pantsColor) ? p.pantsColor : fb.pantsColor,
      shoeStyle: pick(p.shoeStyle, SHOE_STYLES, fb.shoeStyle),
      shoesColor: isHex(p.shoesColor) ? p.shoesColor : fb.shoesColor,
      customAvatarUrl: typeof p.customAvatarUrl === "string" ? p.customAvatarUrl : "",
    };
  } catch {
    return fb;
  }
}

const listeners: Array<(profile: CharacterProfile) => void> = [];

export function onProfileChange(cb: (profile: CharacterProfile) => void): () => void {
  listeners.push(cb);
  return () => {
    const idx = listeners.indexOf(cb);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

export function saveCharacterProfile(profile: CharacterProfile): void {
  try {
    // Avoid storing multi-MB data URLs directly inside localStorage; use 'idb:custom' marker instead
    const toStore: CharacterProfile = { ...profile };
    if (toStore.customAvatarUrl && toStore.customAvatarUrl.startsWith("data:")) {
      void saveCustomAvatarGlb(toStore.customAvatarUrl);
      toStore.customAvatarUrl = "idb:custom";
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    localStorage.setItem("eld_player_name", profile.name);
  } catch (err) {
    console.warn("Could not save character profile to localStorage:", err);
  }
  for (const cb of listeners) cb(profile);
}

const randOf = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

export function randomizeProfile(base: CharacterProfile): CharacterProfile {
  const gender: Gender = Math.random() < 0.5 ? "male" : "female";
  const homeroom = randOf(HOMEROOMS);
  const validHairs = HAIR_STYLES.filter(
    (h) => h.id !== "bald" && (h.category === gender || h.category === "unisex")
  );
  const hairPool = HAIR_COLORS.slice(0, 12);
  const baseHairColor = randOf(hairPool).hex;
  const shirtColor = Math.random() < 0.55 ? HOMEROOM_INFO[homeroom].shirtColor : randOf(SHIRT_COLORS).hex;
  const highlightColor = Math.random() < 0.5 ? shirtColor : randOf(HAIR_COLORS).hex;

  const standardTops: TopStyle[] = ["Top.ButtonUp", "Top.Polo", "Top.Sweater", "Top.Blazer"];
  const topStyle = randOf(standardTops);

  const bottomPool: BottomStyle[] = ["Bottom.001"];
  const facialPool = FACIAL_HAIR_OPTIONS;

  return {
    name: base.name,
    homeroom,
    gender,
    headStyle: randOf(HEAD_STYLES).id,
    skinTone: randOf(SKIN_TONES).hex,
    eyeStyle: randOf(EYE_STYLES.slice(0, 10)).id,
    eyeColor: randOf(EYE_COLORS).hex,
    browStyle: randOf(BROW_STYLES).id,
    noseStyle: randOf(NOSE_STYLES).id,
    faceDetail: "none",
    lipColor: randOf(LIP_COLORS).hex,
    hairStyle: randOf(validHairs).id,
    hairColor: baseHairColor,
    hairHighlight: highlightColor,
    facialHair: gender === "male" && Math.random() < 0.35 ? randOf(facialPool).id : "none",
    glasses: Math.random() < 0.30 ? randOf(GLASSES_OPTIONS.filter((g) => g.id !== "none")).id : "none",
    glassesColor: randOf(GLASSES_COLORS).hex,
    headwear: Math.random() < 0.15 ? randOf(HEADWEAR_OPTIONS.filter((h) => h.id !== "none")).id : "none",
    hatColor: randOf(HAT_COLORS).hex,
    earrings: gender === "female" && Math.random() < 0.45 ? randOf(EARRING_OPTIONS.filter((e) => e.id !== "none")).id : "none",
    topStyle,
    shirtColor,
    bottoms: randOf(bottomPool),
    pantsColor: randOf(PANTS_COLORS).hex,
    shoeStyle: randOf(SHOE_STYLES).id,
    shoesColor: randOf(SHOE_COLORS).hex,
    customAvatarUrl: "",
  };
}
