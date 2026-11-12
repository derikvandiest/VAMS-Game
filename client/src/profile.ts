/**
 * Character profile: types, option catalogues (from content/character-options.json),
 * persistence and change events.
 *
 * A character is: name + homeroom + gender filter + "look" (one Quaternius model)
 * + skin tone + hair color. Shirt color always comes from the homeroom
 * (PROJECT.md 5.1/5.2), so it is derived, never stored.
 */
import options from "../../content/character-options.json";

export type Homeroom = "CSUN" | "LMU" | "UCLA" | "USC";
export type Gender = "masculine" | "feminine";

export interface LookDef {
  id: string;
  name: string;
  gender: Gender;
  /** Path under /models/quaternius/ without extension, e.g. "Male/Suit" */
  model: string;
  /** "Part:Material" entries tinted with the homeroom color */
  shirt: string[];
  /** Hair materials: first = full hair color, others are shaded darker */
  hair: string[];
  brows: string[];
  /** Legs end above the ankle: swapped shoes need skin legs underneath (see avatar.ts) */
  fillLegs?: boolean;
}

export interface HairStyleDef { id: string; name: string; gender: Gender | "both"; donor?: string; parts?: string[] }
export interface FacialHairDef { id: string; name: string; donor?: string; parts?: string[] }
export interface HatDef { id: string; name: string; proc?: "beanie"; donors?: Partial<Record<Gender, string>>; parts?: string[] }
export interface GlassesDef { id: string; name: string; proc?: "round" | "square" | "shades" }
export interface ShoeDef { id: string; name: string; /** reaches the knee: no skin legs needed underneath */ tall?: boolean; donors?: Partial<Record<Gender, string>>; tint?: Partial<Record<Gender, string[]>> }

export interface CharacterProfile {
  name: string;
  homeroom: Homeroom;
  gender: Gender;
  look: string;
  hairStyle: string;
  facialHair: string;
  hat: string;
  /** "" = the homeroom color */
  hatColor: string;
  glasses: string;
  glassesColor: string;
  shoes: string;
  /** "" = the shoe's original color */
  shoeColor: string;
  skinTone: string;
  hairColor: string;
}

export const HOMEROOM_INFO: Record<Homeroom, { label: string; shirtColor: string; textHex: string }> = {
  CSUN: { label: "CSUN", shirtColor: "#d97706", textHex: "#ffffff" },
  LMU: { label: "LMU", shirtColor: "#15803d", textHex: "#ffffff" },
  UCLA: { label: "UCLA", shirtColor: "#1d4ed8", textHex: "#ffffff" },
  USC: { label: "USC", shirtColor: "#991b1b", textHex: "#ffffff" },
};
export const HOMEROOMS = Object.keys(HOMEROOM_INFO) as Homeroom[];

export const LOOKS = options.looks as LookDef[];
export const SKIN_TONES = options.skinTones.map((s) => ({ id: s.id, label: s.name, hex: s.hex }));
export const HAIR_COLORS = options.hairColors.map((h) => ({ id: h.id, label: h.name, hex: h.hex }));
export const HAIR_STYLES = options.hairStyles as HairStyleDef[];
export const FACIAL_HAIR = options.facialHair as FacialHairDef[];
export const HATS = options.hats as HatDef[];
export const GLASSES = options.glasses as GlassesDef[];
export const SHOES = options.shoes as ShoeDef[];
export const ACCENT_COLORS = options.accentColors as Array<{ name: string; hex: string }>;
export const GENDERS = options.genders as Array<{ id: Gender; label: string }>;

export const MAX_NAME_LENGTH = 16;

export function getLook(id: string): LookDef {
  return LOOKS.find((l) => l.id === id) ?? LOOKS[0];
}

export function looksForGender(gender: Gender): LookDef[] {
  return LOOKS.filter((l) => l.gender === gender);
}


export const hairStylesFor = (g: Gender): HairStyleDef[] => HAIR_STYLES.filter((h) => h.gender === "both" || h.gender === g);
/** Facial hair is offered to the masculine models only. */
export const facialHairFor = (g: Gender): FacialHairDef[] => (g === "masculine" ? FACIAL_HAIR : [FACIAL_HAIR[0]]);
export const hatsFor = (g: Gender): HatDef[] => HATS.filter((h) => !h.donors || h.donors[g]);
export const shoesFor = (g: Gender): ShoeDef[] => SHOES.filter((s) => !s.donors || s.donors[g]);
const byId = <T extends { id: string }>(list: T[], id: unknown, fallback: T): T => list.find((x) => x.id === id) ?? fallback;
export const getHairStyle = (id: string): HairStyleDef => byId(HAIR_STYLES, id, HAIR_STYLES[0]);
export const getFacialHair = (id: string): FacialHairDef => byId(FACIAL_HAIR, id, FACIAL_HAIR[0]);
export const getHat = (id: string): HatDef => byId(HATS, id, HATS[0]);
export const getGlasses = (id: string): GlassesDef => byId(GLASSES, id, GLASSES[0]);
export const getShoes = (id: string): ShoeDef => byId(SHOES, id, SHOES[0]);

export function shirtColorFor(homeroom: Homeroom): string {
  return HOMEROOM_INFO[homeroom].shirtColor;
}

const STORAGE_KEY = "eld_character_profile_v4"; // same key: sanitizeProfile migrates older shapes

export function getDefaultProfile(): CharacterProfile {
  return {
    name: "",
    homeroom: "UCLA",
    gender: "feminine",
    look: "fem-casual",
    hairStyle: "original",
    facialHair: "none",
    hat: "none",
    hatColor: "",
    glasses: "none",
    glassesColor: ACCENT_COLORS[0].hex,
    shoes: "default",
    shoeColor: "",
    skinTone: SKIN_TONES[1].hex,
    hairColor: HAIR_COLORS[1].hex,
  };
}

const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);

/** Accepts any stored/legacy object and returns a valid profile. */
export function sanitizeProfile(raw: unknown): CharacterProfile {
  const fb = getDefaultProfile();
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  // Legacy gender values (boy/girl/male/female); the removed "neutral" falls back to the default
  const legacy: Record<string, Gender> = { boy: "masculine", male: "masculine", girl: "feminine", female: "feminine" };
  const g = typeof p.gender === "string" ? legacy[p.gender] ?? p.gender : "";
  const gender: Gender = g === "masculine" || g === "feminine" ? g : fb.gender;
  const lookId = typeof p.look === "string" ? p.look.replace(/^boy-/, "masc-").replace(/^girl-/, "fem-") : "";
  const allowed = looksForGender(gender);
  const look = allowed.find((l) => l.id === lookId) ?? allowed[0];
  return {
    name: (typeof p.name === "string" ? p.name.trim() : fb.name).slice(0, MAX_NAME_LENGTH),
    homeroom: HOMEROOMS.includes(p.homeroom as Homeroom) ? (p.homeroom as Homeroom) : fb.homeroom,
    gender,
    look: look.id,
    hairStyle: byId(hairStylesFor(gender), p.hairStyle, HAIR_STYLES[0]).id,
    facialHair: byId(facialHairFor(gender), p.facialHair, FACIAL_HAIR[0]).id,
    hat: byId(hatsFor(gender), p.hat, HATS[0]).id,
    hatColor: isHex(p.hatColor) ? p.hatColor : "",
    glasses: getGlasses(p.glasses as string).id,
    glassesColor: isHex(p.glassesColor) ? p.glassesColor : fb.glassesColor,
    shoes: byId(shoesFor(gender), p.shoes, SHOES[0]).id,
    shoeColor: isHex(p.shoeColor) ? p.shoeColor : "",
    skinTone: isHex(p.skinTone) ? p.skinTone : fb.skinTone,
    hairColor: isHex(p.hairColor) ? p.hairColor : fb.hairColor,
  };
}

export function loadCharacterProfile(): CharacterProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return sanitizeProfile(JSON.parse(raw));
  } catch {
    /* fall through */
  }
  const fb = getDefaultProfile();
  try {
    fb.name = (localStorage.getItem("eld_player_name") || "").slice(0, MAX_NAME_LENGTH);
  } catch {
    /* ignore */
  }
  return fb;
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
  const clean = sanitizeProfile(profile);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    localStorage.setItem("eld_player_name", clean.name);
  } catch (err) {
    console.warn("Could not save character profile:", err);
  }
  for (const cb of listeners) cb(clean);
}

const randOf = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

export function randomizeProfile(base: CharacterProfile): CharacterProfile {
  return {
    ...base,
    look: randOf(looksForGender(base.gender)).id,
    hairStyle: randOf(hairStylesFor(base.gender)).id,
    hat: randOf(hatsFor(base.gender)).id,
    glasses: randOf(GLASSES).id,
    shoes: randOf(shoesFor(base.gender)).id,
    skinTone: randOf(SKIN_TONES).hex,
    hairColor: randOf(HAIR_COLORS).hex,
  };
}
