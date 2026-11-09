/** Habbo Hotel style character system
 *  - 2.5D cartoon aesthetic (flat shapes, bright colors, geometric hair)
 *  - Optimized hair styles: minimal but iconic silhouettes
 *  - Animations: idle sway, walk, wave, cheer
 */

export type Homeroom = "CSUN" | "LMU" | "UCLA" | "USC";
export type Gender = "male" | "female" | "neutral";
export type HairStyle =
  | "bob"
  | "long"
  | "bouncy"
  | "spiky"
  | "curly"
  | "afro"
  | "pixie"
  | "mohawk"
  | "fringe"
  | "bald";
export type HairCategory = "male" | "female" | "unisex" | "all";
export type ShirtStyle = "plain" | "stripes" | "check" | "plaid" | "logo";
export type PantsStyle = "jeans" | "trousers" | "shorts" | "skirt";
export type ShoeStyle = "sneakers" | "boots" | "sandals" | "dressy";

export interface CharacterProfile {
  name: string;
  homeroom: Homeroom;
  gender: Gender;
  hairStyle: HairStyle;
  hairColor: string;
  hairHighlight: string;
  skinTone: string;
  shirtColor: string;
  shirtPattern: ShirtStyle;
  pantsColor: string;
  pantsStyle: PantsStyle;
  shoeColor: string;
  shoeStyle: ShoeStyle;
  eyeColor: string;
  mouthStyle: "smile" | "neutral" | "sad";
  accessories: string[];
  isEmoteActive: boolean;
}

export const HOMEROOM_INFO: Record<
  Homeroom,
  { label: string; shirtColor: string; textHex: string; pantsColor: string }
> = {
  CSUN: { label: "CSUN", shirtColor: "#d97706", textHex: "#ffffff", pantsColor: "#facc15" },
  LMU: { label: "LMU", shirtColor: "#15803d", textHex: "#ffffff", pantsColor: "#86efac" },
  UCLA: { label: "UCLA", shirtColor: "#1d4ed8", textHex: "#ffffff", pantsColor: "#bfdbfe" },
  USC: { label: "USC", shirtColor: "#991b1b", textHex: "#ffffff", pantsColor: "#fecaca" },
};


export const SKIN_TONES = [
  "Peach",
  "Tan",
  "Brown",
  "DarkBrown",
  "BlackLeather",
  "White",
];

export const HAIR_COLORS = [
  { label: "Platinum", hex: "#f4f4f4" },
  { label: "Blonde", hex: "#f4d97a" },
  { label: "Golden", hex: "#fbd381" },
  { label: "Auburn", hex: "#c66f4e" },
  { label: "Brown", hex: "#8b5a2b" },
  { label: "Black", hex: "#2d2d2d" },
  { label: "Blue", hex: "#4a7f83" },
  { label: "Green", hex: "#4a9f6f" },
  { label: "Red", hex: "#d94f4f" },
  { label: "Purple", hex: "#7a5a9f" },
];

export const HAIR_STYLES: Array<{
  id: HairStyle;
  label: string;
  category: HairCategory;
  description: string;
}> = [
    { id: "bob", label: "Bob Cut", category: "female", description: "Short, squared-off bob — instantly recognizable" },
    { id: "long", label: "Long Wig", category: "female", description: "Flowing shoulder-length with volume" },
    { id: "bouncy", label: "Bouncy", category: "female", description: "Big, rounded volume with a playful bounce" },
    { id: "spiky", label: "Spiky", category: "unisex", description: "Sharp triangular spikes pushing upward" },
    { id: "curly", label: "Curly", category: "all", description: "Round, fluffy curls — Volkmann-style" },
    { id: "afro", label: "Afro", category: "all", description: "Big, round, full volume" },
    { id: "pixie", label: "Pixie", category: "male", description: "Very short, on-the-sides crew cut" },
    { id: "mohawk", label: "Mohawk", category: "male", description: "Central strip of sharp points" },
    { id: "fringe", label: "Fringe", category: "male", description: "Thick, blunt bangs with textured sides" },
    { id: "bald", label: "Bald", category: "all", description: "Shaven head, smooth technology look" },
  ];

export const EYE_STYLES = [
  { id: "big", label: "Big Eyes", style: "round", size: 0.12 },
  { id: "squint", label: "Squint", style: "narrow", size: 0.08 },
  { id: "closed", label: "Closed", style: "half", size: 0.06 },
];

export const MOUTH_STYLES = [
  { id: "smile", label: "Happy Smile" },
  { id: "neutral", label: "Neutral" },
  { id: "sad", label: "Sad" },
];

export const SHIRT_PATTERNS = [
  { id: "plain", label: "Plain" },
  { id: "stripes", label: "Stripes" },
  { id: "check", label: "Checkered" },
  { id: "plaid", label: "Plaid" },
  { id: "logo", label: "School Logo" },
];

export const PANTS_STYLES = [
  { id: "jeans", label: "Jeans" },
  { id: "trousers", label: "Trousers" },
  { id: "shorts", label: "Shorts" },
  { id: "skirt", label: "Skirt" },
];

export const SHOE_STYLES = [
  { id: "sneakers", label: "Sneakers" },
  { id: "boots", label: "Boots" },
  { id: "sandals", label: "Sandals" },
  { id: "dressy", label: "Dress Shoes" },
];

export const ACCESSORIES_LIBRARY = [
  "Horn-Rimmed Glasses",
  "Ponytail",
  "Bowtie",
  "Tie",
  "Earrings",
  "Watch",
  "Necklace",
];

export const DEFAULT_HABBO_PROFILE: CharacterProfile = {
  name: "Newcomer",
  homeroom: "CSUN",
  gender: "neutral",
  hairStyle: "bob",
  hairColor: "#8b5a2b",
  hairHighlight: "#c66f4e",
  skinTone: "Peach",
  shirtColor: "#d97706",
  shirtPattern: "plain",
  pantsColor: "#facc15",
  pantsStyle: "jeans",
  shoeColor: "#334155",
  shoeStyle: "sneakers",
  eyeColor: "#3b82f6",
  mouthStyle: "smile",
  accessories: [],
  isEmoteActive: false,
};

export function randomizeHabboProfile(base: CharacterProfile): CharacterProfile {
  const gender: Gender = Math.random() < 0.5 ? "male" : "female";
  const homeroom = HOMEROOMS[Math.floor(Math.random() * HOMEROOMS.length)];

  const hairPool = HAIR_STYLES.filter(
    (h) => h.category === gender || h.category === "all" || h.category === "unisex"
  );
  const hair = hairPool[Math.floor(Math.random() * hairPool.length)];

  return {
    ...base,
    name: base.name || "Newcomer",
    homeroom,
    gender,
    hairStyle: hair.id,
    hairColor: HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)].hex,
    hairHighlight:
      hair.id === "bald" || hair.id === "mohawk"
        ? base.hairColor
        : HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)].hex,
    skinTone: SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)],
    shirtColor:
      homeroom === base.homeroom ? HOMEROOM_INFO[homeroom].shirtColor : base.shirtColor,
    shirtPattern: SHIRT_PATTERNS[Math.floor(Math.random() * SHIRT_PATTERNS.length)].id as ShirtStyle,
    pantsColor:
      homeroom === base.homeroom
        ? HOMEROOM_INFO[homeroom].pantsColor
        : base.pantsColor,
    pantsStyle: base.pantsStyle,
    shoeColor: base.shoeColor,
    shoeStyle: base.shoeStyle,
    eyeColor: HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)].hex,
    mouthStyle: "smile" as const,
    accessories: [""] as string[],
    isEmoteActive: false,
  };
}

export const HOMEROOMS = Object.keys(HOMEROOM_INFO) as Homeroom[];
