/**
 * NPC definitions. An NPC is a character profile (same options as the player's character creation, plus
 * NPC-only extras like the crown) and a place to stand.
 */
import { CharacterProfile, getDefaultProfile } from "./profile";
import type { DialogTree } from "./dialog";
import vanDiestPortrait from "./assets/vandiest_portrait.png";
import perryPortrait from "./assets/perry_portrait.png";
import kurisuPortrait from "./assets/kurisu_portrait.png";
import morrisPortrait from "./assets/morris_portrait.png";
import ashiPortrait from "./assets/ashi_portrait.png";

/** Feedback survey QR code image. TODO: put the real QR code image URL here (e.g. "/survey-qr.png"). Empty = placeholder. */
export const SURVEY_QR_IMAGE = "";

export interface NpcDef {
  id: string;
  /**
   * Where the NPC is placed: "mpr" = inside the Multi-Purpose Room, "campus" = outdoors, "classroom" = inside
   * `classroomId`, standing in front of the whiteboard (x/z are then filled in from the room). A classroom teacher
   * gives out the room's assignment when a player presses E next to them (instead of the whiteboard).
   */
  room: "mpr" | "campus" | "classroom";
  classroomId?: string;
  x: number;
  z: number;
  /** Rotation about Y in radians (0 faces +z, PI faces -z) */
  rotY: number;
  profile: CharacterProfile;
  /** What the NPC says when a player talks to him/her (shown in a pop-up) */
  dialog?: DialogTree;
  /** Cartoon portrait shown in the dialogue box (URL) */
  portrait?: string;
  /** A glowing "!" floats above the NPC until this objective is complete (see saveManager.ts) */
  talkObjective?: string;
  /** How close a player must be to talk (default 3.8); smaller next to a door so E still opens the door */
  talkRange?: number;
}

const BLACK = "#1f1f24";

/** Mr. Van Diest (the ELD teacher who runs the PD): suit, neat hair and a full beard. */
export const NPC_VAN_DIEST: NpcDef = {
  id: "npc-van-diest",
  room: "mpr",
  // front of the MPR, in front of the projection screen, facing the tables
  x: 400,
  z: 409.3,
  rotY: Math.PI,
  profile: {
    ...getDefaultProfile(),
    name: "Mr. Van Diest",
    title: "ELD Coordinator/Teacher",
    noHomeroom: true,
    gender: "masculine",
    look: "masc-suit",
    outfitColor: BLACK,
    hairStyle: "m-suit",
    facialHair: "full-beard",
    shoes: "dress",
    shoeColor: BLACK,
    glasses: "round",
    glassesColor: BLACK,
  },
  portrait: vanDiestPortrait,
  talkObjective: "obj_survey",
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: ["Hi there! Thanks so much for participating in our unique ELD PD!", "What can I help you with?"],
        options: [
          { label: "How was this game made?", next: "made" },
          { label: "What do I need to do?", next: "tasks" },
          { label: "I'd like to give feedback", next: "feedback", markerObjective: "obj_survey" },
          { label: "Goodbye" },
        ],
      },
      made: {
        paragraphs: [
          "I used AI to make this game. I built it inside of Google's Antigravity, using a combination of models, including Gemini, Sonnet, Space Alpha Bunny, Laguna, Solar Mini, Nemotron 3.5, and more.",
          "The character models were created using Claude Code.",
        ],
        options: [
          { label: "That's amazing! I'd like to give feedback", next: "feedback", markerObjective: "obj_survey" },
          { label: "I have another question", next: "root" },
          { label: "Goodbye" },
        ],
      },
      tasks: {
        paragraphs: [
          "Explore the campus! Every homeroom classroom has an assignment, and a green exclamation mark floats above the door of each one you still need to do.",
          "Complete all 16 assignments in any order, then turn in your work to me in the ELD classroom. After that, head to the parking lot and drive away in one of the cars to finish the game.",
        ],
        options: [
          { label: "Got it! I have another question", next: "root" },
          { label: "Goodbye" },
        ],
      },
      feedback: {
        paragraphs: [
          "If you enjoy this presentation, let me know, so we can potentially introduce this to our students!",
          "Please take a moment to complete our feedback survey by scanning the QR code below.",
        ],
        qr: { caption: "Scan to complete the feedback survey", qrImage: SURVEY_QR_IMAGE || undefined },
        event: "survey",
        options: [
          { label: "Thanks! I have another question", next: "root" },
          { label: "Goodbye" },
        ],
      },
    },
  },
};

/** The school principal (Mr. Perry), standing where the elevator, the soccer field and the lunch tables meet. */
export const NPC_PRINCIPAL: NpcDef = {
  id: "npc-principal",
  room: "campus",
  x: 1.5,
  z: 9.5,
  rotY: 0.8, // looking out toward the field
  profile: {
    ...getDefaultProfile(),
    name: "Mr. Perry",
    title: "Principal",
    noHomeroom: true,
    gender: "masculine",
    look: "masc-suit",
    // From his portrait: ponytail, clean-shaven, round black glasses,
    // warm brown skin, a white button-down with navy polka dots (the suit model: jacket, shirt and tie all dotted
    // white so it reads as one shirt), dark trousers
    outfitColor: "#f1f1ef",
    hairStyle: "m-ponytail",
    hairColor: "#1a1410",
    facialHair: "none", // clean-shaven
    glasses: "round",
    glassesColor: BLACK, // black frames
    skinTone: "#6E4428",
    shoes: "dress",
    shoeColor: BLACK,
    partColors: { "Legs:Suit": "#2c313b" },
    polkaDots: { parts: ["Body:Suit", "Body:White", "Body:Tie"], base: "#f1f1ef", dot: "#26365e" },
  },
  portrait: perryPortrait,
  // SAMPLE TEXT: replace with the principal's real dialogue
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Welcome to Valor Academy! I'm the principal. It's great to see everyone out here today.",
          "This is placeholder dialogue. The real conversation will go here.",
        ],
        options: [
          { label: "Tell me about the school", next: "school" },
          { label: "Goodbye" },
        ],
      },
      school: {
        paragraphs: [
          "(Sample text) Our students and teachers work hard every day, and we're proud of this campus.",
          "Take your time exploring, and let me know if you have any questions.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Goodbye" },
        ],
      },
    },
  },
};

/**
 * Mr. Kurisu, the 8th grade UCLA math teacher, standing in front of the whiteboard in his classroom (talk to him
 * for the assignment).
 * Matches his portrait: short neat black hair, tan skin, clean-shaven, blue-gray button-down shirt and a red tie
 * (the suit model with the jacket and shirt both tinted the shirt's blue-gray, so it reads as a shirt and tie).
 */
const KURISU_SHIRT = "#6a7d9c";
export const NPC_KURISU: NpcDef = {
  id: "npc-kurisu",
  room: "classroom",
  classroomId: "8th-ucla-math",
  x: 0, // set from the classroom's whiteboard
  z: 0,
  rotY: 0, // facing the class
  talkRange: 2.2,
  profile: {
    ...getDefaultProfile(),
    name: "Mr. Kurisu",
    title: "8th Grade Math Teacher",
    noHomeroom: true,
    gender: "masculine",
    look: "masc-suit",
    outfitColor: KURISU_SHIRT,
    hairStyle: "m-suit", // short, neat, swept back
    hairColor: "#16120f", // black
    skinTone: "#D49A6A", // warm tan
    facialHair: "none",
    glasses: "none",
    shoes: "dress",
    shoeColor: BLACK,
    partColors: { White: KURISU_SHIRT, Tie: "#9b1b30", Black: "#2a2d33" },
  },
  portrait: kurisuPortrait,
  // SAMPLE TEXT: replace with Mr. Kurisu's real dialogue
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Hi! I'm Mr. Kurisu, I teach 8th grade math here in UCLA.",
          "Come on in when you're ready, your assignment is on the whiteboard.",
        ],
        options: [{ label: "Thanks, Mr. Kurisu!" }],
      },
    },
  },
};

/**
 * Ms. Blessing, the 5th grade CSUN humanities teacher, standing in front of the whiteboard in her classroom
 * (talk to her for the assignment). Matches her portrait: long curly brown hair with a center part, round
 * reddish-brown glasses, fair skin, an open red cardigan over a white blouse with a light blue diamond print.
 */
export const NPC_BLESSING: NpcDef = {
  id: "npc-blessing",
  room: "classroom",
  classroomId: "5th-csun-humanities",
  x: 0, // set from the classroom's whiteboard
  z: 0,
  rotY: 0, // facing the class
  talkRange: 2.2,
  profile: {
    ...getDefaultProfile(),
    name: "Ms. Blessing",
    title: "5th Grade Humanities Teacher",
    noHomeroom: true,
    gender: "feminine",
    look: "fem-suit", // the jacket is her cardigan, the shirt her blouse
    outfitColor: "#b8312f", // red cardigan
    hairStyle: "f-long", // shoulder-length base: the crown and center part; the curls fall from it
    extraHair: "curls",
    hairColor: "#8a5530", // warm brown
    glasses: "round",
    glassesColor: "#8a3a2a", // reddish-brown frames
    skinTone: "#F2CCB0",
    shoes: "dress",
    shoeColor: BLACK,
    partColors: { "Legs:Black": "#2b3245" },
    polkaDots: { parts: ["Body:White"], base: "#f4f6f8", dot: "#9cc3d5", accent: "#c0392b", shape: "diamonds" },
  },
};

/**
 * Mrs. Morris, by the basketball cart at the courts. Matches her portrait: dark brown skin, hair slicked back
 * into one long braid over her right shoulder, a black hoodie (the suit model in black: jacket and shirt), black
 * joggers and sneakers.
 */
export const NPC_MORRIS: NpcDef = {
  id: "npc-morris",
  room: "campus",
  x: 26.3, // beside the basketball cart, south of the courts
  talkRange: 1.5, // short, so E next to the cart still grabs a ball
  z: 62.4,
  rotY: Math.PI, // looking out over the courts
  profile: {
    ...getDefaultProfile(),
    name: "Mrs. Morris",
    title: "PE Teacher",
    noHomeroom: true,
    gender: "feminine",
    look: "fem-suit",
    outfitColor: "#1b1c20", // black hoodie
    hairStyle: "f-wavy", // pulled straight back from the face (no bangs over the brows); the braid hangs from it
    extraHair: "braid",
    hairColor: "#1a1412",
    skinTone: "#7A4A2E",
    glasses: "none",
    shoes: "sneakers",
    shoeColor: "#1b1c20",
    partColors: { "Body:White": "#1b1c20", "Legs:Black": "#202227" },
  },
  portrait: morrisPortrait,
  // SAMPLE TEXT: replace with Mrs. Morris's real dialogue
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Hey there! I'm Mrs. Morris. Welcome to the courts!",
          "Grab a ball from the cart and shoot a few hoops whenever you need a break.",
        ],
        options: [{ label: "Thanks, Mrs. Morris!" }],
      },
    },
  },
};

/**
 * Mr. Ashi, on the soccer field's south-east corner by the ball reset grate (toward the vehicle gate). Matches his
 * portrait: warm brown skin, a short black fade, a mustache and chin beard, a black zip-up track jacket (the suit
 * model all in black), black track pants and sneakers.
 */
const ASHI_BLACK = "#18191d";
export const NPC_ASHI: NpcDef = {
  id: "npc-ashi",
  room: "campus",
  x: 47.6,
  z: 40.6,
  rotY: -2.35, // looking out over the field
  talkRange: 2.4,
  profile: {
    ...getDefaultProfile(),
    name: "Mr. Ashi",
    title: "Coach",
    noHomeroom: true,
    gender: "masculine",
    look: "masc-suit",
    outfitColor: ASHI_BLACK,
    noHair: true,
    extraHair: "buzz", // a short fade
    hairColor: "#141110",
    facialHair: "goatee",
    skinTone: "#9A5F3C",
    glasses: "none",
    shoes: "sneakers",
    shoeColor: ASHI_BLACK,
    partColors: { White: ASHI_BLACK, Tie: ASHI_BLACK, "Legs:Suit": "#1d1f24" },
  },
  portrait: ashiPortrait,
  // SAMPLE TEXT: replace with Mr. Ashi's real dialogue
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Hey! I'm Mr. Ashi. I keep an eye on the field.",
          "Soccer ball rolled away or stuck somewhere? Step on the drain grate right here in the corner and it sends the soccer ball back to the center of the field.",
          "If the basketball gets lost too, I can reset both balls for you.",
        ],
        options: [
          { label: "Please reset both balls", action: "reset-balls" },
          { label: "How does the reset work?", next: "how" },
          { label: "Thanks, Mr. Ashi!" },
        ],
      },
      how: {
        paragraphs: [
          "(Sample text) The metal grate in the corner of the field resets the soccer ball. Walk onto it and say yes when it asks, and the ball goes back to the center spot for everyone playing.",
          "The grate doesn't touch the basketball. For that, grab a ball from the cart by the courts, or ask me to reset both.",
        ],
        options: [
          { label: "Please reset both balls", action: "reset-balls" },
          { label: "Got it, thanks!" },
        ],
      },
    },
  },
};

export const NPCS: NpcDef[] = [NPC_VAN_DIEST, NPC_PRINCIPAL, NPC_KURISU, NPC_BLESSING, NPC_MORRIS, NPC_ASHI];
