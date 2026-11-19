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
import navarroPortrait from "./assets/navarro_portrait.png";
import ipenaPortrait from "./assets/ipena_portrait.png";
import castanedaPortrait from "./assets/castaneda_portrait.png";
import tunsonPortrait from "./assets/tunson_portrait.png";
import staufferPortrait from "./assets/stauffer_portrait.png";
import roldanPortrait from "./assets/roldan_portrait.png";
import guerreroPortrait from "./assets/guerrero_portrait.png";
import nayfeldPortrait from "./assets/nayfeld_portrait.png";
import daniPortrait from "./assets/dani_portrait.png";
import somozaPortrait from "./assets/somoza_portrait.png";
import weberPortrait from "./assets/weber_portrait.png";
import dominguezPortrait from "./assets/dominguez_portrait.png";
import larkPortrait from "./assets/lark_portrait.png";
import gillettPortrait from "./assets/gillett_portrait.png";
import noroPortrait from "./assets/norori_portrait.png";
import ramirezPortrait from "./assets/ramirez_portrait.png";
import martinezPortrait from "./assets/martinez_portrait.png";
import traePortrait from "./assets/trae_portrait.png";
import bakooPortrait from "./assets/bakoo_portrait.png";
import getisPortrait from "./assets/getis_portrait.png";
import mrMartinezPortrait from "./assets/mrmartinez_portrait.png";
import delmaPortrait from "./assets/delma_portrait.png";
import raquelPortrait from "./assets/raquel_portrait.png";
import aparicioPortrait from "./assets/aparicio_portrait.png";
import carreraPortrait from "./assets/carrera_portrait.png";
import williamsPortrait from "./assets/williams_portrait.png";
import mariaPortrait from "./assets/maria_portrait.png";
import quintanaPortrait from "./assets/quintana_portrait.png";
import nellyPortrait from "./assets/nelly_portrait.png";

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
  /** A teacher who stands somewhere else (not in their room): the room whose assignment carries their name/portrait */
  teaches?: string;
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
  /** Sitting (on a bench or chair) with the seat at this height; x/z/rotY are then the seated position */
  seatY?: number;
  /** Classroom teacher: show the dialogue first (an option with action "open-assignment" hands out the assignment) */
  chatFirst?: boolean;
  /** No floating name tag above the head (generic, unnamed characters) */
  noNameTag?: boolean;
  /** Campus NPC on the upper walkway (second floor) instead of the ground */
  floor?: 1;
  /** Standing height (e.g. on a stage); default 0 */
  y?: number;
  /** Classroom teacher: how much further from the whiteboard (toward the class) than the usual 1.3 m */
  offsetZ?: number;
  /** A special standing pose (applied after the animation every frame): "keyboard" = playing a keyboard in front */
  pose?: "keyboard";
  /** Something held in the right hand */
  holding?: "coffee"; // drawn as a 40 oz Stanley tumbler
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
          "Complete all 16 assignments in any order, then turn in your work to Mrs. Carmona, our ELD Director, in the ELD classroom upstairs. After that, get in your car in the parking lot and head home for the day.",
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
  x: 2.4, // near the corner of the field, toward the lunch tables
  z: 8.8,
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
  chatFirst: true,
  profile: {
    ...getDefaultProfile(),
    name: "Mr. Kurisu",
    title: "8th Grade Math Teacher & Grade Level Lead",
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
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "Hi! I'm Mr. Kurisu, and I teach 8th grade math here in UCLA.",
          "Today I'm facilitating part of our ELD PD: Supporting MLLs in Math, with a focus on algebra. Algebra is a language of its own, so let's crack the code. It only takes about three minutes!",
        ],
        options: [
          { label: "Show me the assignment!", action: "open-assignment" },
          { label: "What are your students learning?", next: "learn" },
          { label: "Thanks, Mr. Kurisu!", next: "bye" },
        ],
      },
      learn: {
        paragraphs: [
          "We're writing linear equations from real situations, like phone plans and savings goals.",
          "Every problem gets Three Reads before anyone touches the numbers, and we connect the table, the graph and the equation. My students explain their thinking with sentence frames, in English or in their home language.",
        ],
        options: [
          { label: "Show me the assignment!", action: "open-assignment" },
          { label: "I have another question", next: "root" },
          { label: "Thanks, Mr. Kurisu!", next: "bye" },
        ],
      },
      bye: {
        paragraphs: ["Thanks for stopping by! Good luck with the rest of your classrooms."],
        options: [{ label: "See you, Mr. Kurisu!" }],
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

/**
 * Mr. Navarro, instructional assistant (upper school) and girls volleyball coach. He runs the car gate by the school
 * buses: asking him is the only way to open or close it. Matches his portrait: warm tan skin, short full dark
 * curly hair, a mustache and chin beard, a slate-blue button-up shirt (the suit model in one color, no tie).
 */
const NAVARRO_SHIRT = "#6f84a3";
export const NPC_NAVARRO: NpcDef = {
  id: "npc-navarro",
  room: "campus",
  x: 53.4, // inside the campus, just north of the car gate (x = 55, z 54.6 .. 61.4)
  z: 53.3,
  rotY: -Math.PI / 2 - 0.35, // facing into the campus, turned a little toward the gate
  talkRange: 3.0,
  profile: {
    ...getDefaultProfile(),
    name: "Mr. Navarro",
    title: "Instructional Assistant",
    noHomeroom: true,
    gender: "masculine",
    look: "masc-suit",
    outfitColor: NAVARRO_SHIRT,
    hairStyle: "m-explorer", // wavy base under the curls
    extraHair: "curlyTop",
    hairColor: "#24180f",
    facialHair: "goatee",
    skinTone: "#C68A5E",
    glasses: "none",
    shoes: "sneakers",
    shoeColor: "#2a2d33",
    partColors: { White: NAVARRO_SHIRT, Tie: NAVARRO_SHIRT, "Legs:Suit": "#2c3442" },
  },
  portrait: navarroPortrait,
  // SAMPLE TEXT: replace with Mr. Navarro's real dialogue
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Hey, I'm Mr. Navarro! I'm an instructional assistant here, supporting our upper school students and teachers.",
          "I also take care of the car gate by the buses. Need it opened or closed? Just ask.",
        ],
        options: [
          { label: "Can you open the car gate?", action: "vgate-open" },
          { label: "Can you close the car gate?", action: "vgate-close" },
          { label: "What do you do in the upper school?", next: "upper" },
          { label: "I heard you coach volleyball!", next: "volleyball" },
          { label: "Thanks, Mr. Navarro!" },
        ],
      },
      upper: {
        paragraphs: [
          "(Sample text) I work alongside the 6th, 7th and 8th grade teachers, helping students in small groups, checking in during work time, and making sure everyone has what they need to keep up.",
          "A lot of it is building relationships: when students know someone is in their corner, they take more risks with their learning.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Mr. Navarro!" },
        ],
      },
      volleyball: {
        paragraphs: [
          "(Sample text) Yes! I lead the girls volleyball team. We practice after school, and the team works hard on teamwork, communication and never giving up on a play.",
          "Come cheer us on at our next home game!",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Go team!" },
        ],
      },
    },
  },
};

/**
 * Ms. Dani, instructional assistant (lower school) who runs student drop-off and pick-up at the car line. She stands
 * in the parking lot at the gate to the street (north fence, opening x -45.4 .. -38.6), on its right-hand side as
 * you face the gate from the lot. Matches her portrait: fair skin, dark
 * shoulder-length hair with a center part, a tan chore jacket with a brown collar over a dark top, dark jeans.
 */
export const NPC_DANI: NpcDef = {
  id: "npc-dani",
  room: "campus",
  x: -37.3, // just east of the gate's catch post (x = -38.6), inside the lot
  z: -21.3,
  rotY: -0.5, // facing the cars coming in, turned a little toward the gate
  profile: {
    ...getDefaultProfile(),
    name: "Ms. Dani",
    title: "Instructional Assistant",
    noHomeroom: true,
    gender: "feminine",
    look: "fem-suit", // the jacket is her chore coat, the shirt her dark top
    outfitColor: "#1e1f24", // black chore coat
    hairStyle: "f-witch", // shoulder length, center part
    hairLength: 1.4,
    hairColor: "#1f1a18",
    skinTone: "#F0C6A8",
    glasses: "none",
    shoes: "sneakers",
    shoeColor: "#2a2d33",
    partColors: { "Body:White": "#2a2a2e", "Legs:Black": "#2f3646" },
  },
  portrait: daniPortrait,
  // SAMPLE TEXT: replace with Ms. Dani's real dialogue
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Hi, welcome to Valor! I'm Ms. Dani. I'm an instructional assistant in the lower school, and every morning and afternoon you'll find me out here running the car line for drop-off and pick-up.",
          "Heading onto campus? Walk over to the entrance gate by the office. Ms. Castaneda opens and closes it, so just let her know.",
        ],
        options: [
          { label: "How do I get through the gate?", next: "gate" },
          { label: "What do you do in the lower school?", next: "lower" },
          { label: "How does the car line work?", next: "carline" },
          { label: "Thanks, Ms. Dani!" },
        ],
      },
      gate: {
        paragraphs: [
          "(Sample text) Talk to Ms. Castaneda. She's in charge of the entrance gate and will open it or close it for you.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Ms. Dani!" },
        ],
      },
      lower: {
        paragraphs: [
          "(Sample text) I support our youngest students and their teachers: reading with small groups, helping during centers, and making sure everyone feels safe and ready to learn.",
          "The little ones keep me busy, but I wouldn't have it any other way!",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Ms. Dani!" },
        ],
      },
      carline: {
        paragraphs: [
          "(Sample text) Families pull up along the sidewalk, stay in their cars, and we walk the students in or out. Keep moving forward, no parking in the line, and be patient: it goes fast when everyone follows the flow!",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Got it, thanks!" },
        ],
      },
    },
  },
};

/**
 * Mr. Ipina, Operations Assistant, sitting on the blue bench closest to the entrance gate (the west building's
 * end wall in the breezeway). Matches his portrait: warm tan skin, short neat dark brown hair, dark gray
 * rectangular glasses, clean-shaven, a cream long-sleeve henley (the suit model all in cream), dark pants.
 */
const IPENA_SHIRT = "#e6dcc8";
export const NPC_IPENA: NpcDef = {
  id: "npc-ipena",
  room: "campus",
  x: -25.5, // the bench seat nearest the gate (the bench is at x = -25, against the wall at z = -2)
  z: -2.27,
  rotY: Math.PI, // facing the breezeway
  seatY: 0.4,
  talkRange: 2.4,
  profile: {
    ...getDefaultProfile(),
    name: "Mr. Ipina",
    title: "Operations Assistant",
    noHomeroom: true,
    gender: "masculine",
    look: "masc-suit",
    outfitColor: IPENA_SHIRT,
    hairStyle: "m-suit", // short and neat
    hairColor: "#2b1d14",
    facialHair: "none",
    glasses: "rect",
    glassesColor: "#3d3f44",
    skinTone: "#C98E66",
    shoes: "sneakers",
    shoeColor: "#2a2d33",
    partColors: { White: IPENA_SHIRT, Tie: IPENA_SHIRT, "Legs:Suit": "#323844" },
  },
  portrait: ipenaPortrait,
  // SAMPLE TEXT: replace with Mr. Ipina's real dialogue
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Hey there! I'm Mr. Ipina, the Operations Assistant. Just taking a quick break before the next thing.",
          "I help keep the campus running behind the scenes: facilities, supplies, events setup, and whatever else comes up during the day.",
        ],
        options: [
          { label: "Can you help me find my way around? (the map)", next: "map" },
          { label: "What does an Operations Assistant do?", next: "ops" },
          { label: "Who do I ask if something is broken?", next: "broken" },
          { label: "Thanks, Mr. Ipina!" },
        ],
      },
      map: {
        paragraphs: [
          "(Sample text) Of course! Getting around is easy once you know the map. Press M at any time, or click the Map button in the top-right corner, to open it. Press M again, press Esc, or click the ✕ to close it.",
          "While the map is open your character stays put, so take your time.",
        ],
        options: [
          { label: "How do I read it?", next: "mapRead" },
          { label: "Open the map for me", action: "open-map" },
          { label: "Back", next: "root" },
        ],
      },
      mapRead: {
        paragraphs: [
          "(Sample text) The map is a top-down view of the whole campus with north at the top. The little arrow in the corner points north, and the compass in the top-left of your screen does too: click the compass to turn your camera to face north.",
          "The blue arrow is you, and it points the way you're facing. Classroom names are written right on the map.",
        ],
        options: [
          { label: "What do the colors mean?", next: "mapColors" },
          { label: "Open the map for me", action: "open-map" },
          { label: "Back", next: "map" },
        ],
      },
      mapColors: {
        paragraphs: [
          "(Sample text) Green classrooms still have an assignment for you, just like the green ! over their doors on campus. Dark gray rooms with a check mark are done. Rooms with a dashed outline, like the office, the MPR and the Learning Center, don't have an assignment.",
          "At the top of the map it also tells you how many of the 16 classrooms still have an assignment.",
        ],
        options: [
          { label: "What about the second floor?", next: "mapFloors" },
          { label: "Open the map for me", action: "open-map" },
          { label: "Back", next: "mapRead" },
        ],
      },
      mapFloors: {
        paragraphs: [
          "(Sample text) The classrooms are on two floors. Use the Ground floor and Upper floor buttons at the top of the map to switch between them. The map opens on whichever floor you're on.",
          "To get upstairs, take the stairs at the far end of each building, or the elevator in front of the Learning Center (it's a little slow to arrive, so be patient!).",
        ],
        options: [
          { label: "Any tips for finding a room fast?", next: "mapTips" },
          { label: "Open the map for me", action: "open-map" },
          { label: "Back", next: "mapColors" },
        ],
      },
      mapTips: {
        paragraphs: [
          "(Sample text) Find the yellow room on the map, close it, and walk toward it, checking the map again whenever you need to. When you get close, look for the green ! over the door, then press E to go inside.",
          "Inside, talk to the teacher or read the whiteboard to get the assignment. When you finish them all, take your work to Mrs. Carmona, the ELD Director, in the ELD classroom upstairs.",
        ],
        options: [
          { label: "Open the map for me", action: "open-map" },
          { label: "Start over", next: "map" },
          { label: "Thanks, Mr. Ipina!" },
        ],
      },
      ops: {
        paragraphs: [
          "(Sample text) A little bit of everything! I coordinate with maintenance, order and deliver supplies, set up rooms for events like this PD, and make sure the day runs smoothly for students and staff.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Mr. Ipina!" },
        ],
      },
      broken: {
        paragraphs: [
          "(Sample text) Come find me, or let the front office know, and I'll make sure it gets taken care of.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Will do, thanks!" },
        ],
      },
    },
  },
};

/**
 * Ms. Castaneda, Assistant Dean of Restorative Practices, standing outside the front entrance gate (on the
 * parking-lot side). She opens and closes the entrance gate: asking her is the only way. Matches her portrait:
 * warm light-medium skin, shoulder-length wavy honey-brown hair with a center part, a gray knit cardigan over a
 * black top, dark pants.
 */
export const NPC_CASTANEDA: NpcDef = {
  id: "npc-castaneda",
  room: "campus",
  x: -30.3, // right in front of the gate (x = -28, opening z -10.5 .. -2), on the sidewalk outside
  z: -6.25,
  rotY: -Math.PI / 2, // facing the parking lot and the people arriving
  talkRange: 4.2, // reachable from both sides of the closed gate
  profile: {
    ...getDefaultProfile(),
    name: "Ms. Castaneda",
    title: "Assistant Dean of Restorative Practices",
    noHomeroom: true,
    gender: "feminine",
    look: "fem-suit", // the jacket is her cardigan, the shirt her black top
    outfitColor: "#9fa3a9", // gray knit cardigan
    hairStyle: "f-long", // shoulder length, center part
    extraHair: "curls", // soft waves
    hairColor: "#9a6a3c",
    glasses: "none",
    skinTone: "#E3AE88",
    shoes: "dress",
    shoeColor: "#1f1f24",
    partColors: { "Body:White": "#1f2023", "Legs:Black": "#2b2e36" },
  },
  portrait: castanedaPortrait,
  // SAMPLE TEXT: replace with Ms. Castaneda's real dialogue
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Hi, welcome! I'm Ms. Castaneda, the Assistant Dean of Restorative Practices.",
          "I also look after the front entrance gate. Want me to open it or close it for you?",
        ],
        options: [
          { label: "Can you open the gate?", action: "gate-open" },
          { label: "Can you close the gate?", action: "gate-close" },
          { label: "What are restorative practices?", next: "rp" },
          { label: "Thanks, Ms. Castaneda!" },
        ],
      },
      rp: {
        paragraphs: [
          "(Sample text) Restorative practices are about building strong relationships and repairing harm when something goes wrong. Instead of only giving consequences, we bring people together to talk about what happened, who was affected, and how to make it right.",
          "Things like community circles and restorative conversations help students feel heard and take responsibility, and they make our whole school community stronger.",
        ],
        options: [
          { label: "How can teachers use it?", next: "rpClass" },
          { label: "I have another question", next: "root" },
          { label: "Thanks, Ms. Castaneda!" },
        ],
      },
      rpClass: {
        paragraphs: [
          "(Sample text) Start small: morning check-in circles, affective statements like \"I felt frustrated when...\", and asking restorative questions instead of \"Why did you do that?\". When students know they belong, behavior and learning both improve.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Ms. Castaneda!" },
        ],
      },
    },
  },
};

/**
 * Mrs. Tunson, Dean of Restorative Practices, just outside the MPR's courtyard doors (on the left as you face the
 * doors). She reminds players to grab a backpack from the MPR. Matches her portrait: brown skin, locs gathered up
 * and falling to one side under a yellow patterned head wrap, a gray cardigan over a black V-neck, dark pants.
 */
export const NPC_TUNSON: NpcDef = {
  id: "npc-tunson",
  room: "campus",
  x: -12.5, // outside the MPR doors (x = -14, z 50.5 .. 52.5), on their left as you face them from the courtyard
  z: 54.7,
  rotY: Math.PI / 2 - 0.4, // facing the courtyard, turned a little toward people coming to the doors
  talkRange: 1.8, // short, so E at the doors still opens them
  profile: {
    ...getDefaultProfile(),
    name: "Mrs. Tunson",
    title: "Dean of Restorative Practices",
    noHomeroom: true,
    gender: "feminine",
    look: "fem-suit", // the jacket is her cardigan, the shirt her black top
    outfitColor: "#a7aaaf", // heather gray cardigan
    hairStyle: "f-wavy", // pulled back under the wrap
    extraHair: "locsWrap",
    hairColor: "#2a1d14",
    skinTone: "#8A5A3B",
    glasses: "none",
    shoes: "sneakers",
    shoeColor: "#1f1f24",
    partColors: { "Body:White": "#1d1e22", "Legs:Black": "#2a2d35" },
  },
  portrait: tunsonPortrait,
  // SAMPLE TEXT: replace with Mrs. Tunson's real dialogue
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Hi there, welcome! I'm Mrs. Tunson, the Dean of Restorative Practices. So glad you're here today.",
          "Before you head out to the classrooms, don't forget to grab a backpack from the MPR! They're hanging on the wall just inside these doors. Without one you can't carry anything, and your supplies need somewhere to go.",
        ],
        options: [
          { label: "How do I get a backpack?", next: "backpack" },
          { label: "What does a Dean of Restorative Practices do?", next: "rp" },
          { label: "Thanks, Mrs. Tunson!" },
        ],
      },
      backpack: {
        paragraphs: [
          "(Sample text) Go through the MPR doors right here. As you walk in, look to your right along the wall the doors are in: black, gray, white, blue and red backpacks are hanging on the hooks. Walk up to the one you like and press E to put it on.",
          "Your first backpack comes with your PD supplies. Then press I or click the Backpack button (under the Map button) to see everything, and drag your favorite items onto the quick bar at the bottom of the screen. Keys 1 to 5 pick a quick slot.",
        ],
        options: [
          { label: "Can I change the color later?", next: "color" },
          { label: "I have another question", next: "root" },
          { label: "Got it, thanks!" },
        ],
      },
      color: {
        paragraphs: [
          "(Sample text) Of course! Just go back to the hooks and press E at a different color. Everything you're carrying moves over to the new backpack.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Mrs. Tunson!" },
        ],
      },
      rp: {
        paragraphs: [
          "(Sample text) I lead our restorative practices: building a school community where everyone belongs, and when harm happens, bringing people together to understand it and make things right.",
          "I work with Ms. Castaneda and our teachers on circles, restorative conversations and classroom practices that keep relationships at the center of learning.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Mrs. Tunson!" },
        ],
      },
    },
  },
};

/**
 * Mr. Stauffer, the 6th grade LMU science teacher, standing in front of the whiteboard in his classroom (talk to him
 * for the assignment). Matches his portrait: fair skin, long brown hair with a center part, a mustache and beard,
 * an olive green t-shirt.
 */
export const NPC_STAUFFER: NpcDef = {
  id: "npc-stauffer",
  room: "classroom",
  classroomId: "6th-lmu-science",
  x: 0, // set from the classroom's whiteboard
  z: 0,
  rotY: 0, // facing the class
  talkRange: 2.2,
  profile: {
    ...getDefaultProfile(),
    name: "Mr. Stauffer",
    title: "6th Grade Science Teacher",
    noHomeroom: true,
    gender: "masculine",
    look: "masc-tee",
    outfitColor: "#748a3c", // olive green tee
    hairStyle: "f-long", // the modelled shoulder-length hair with a center part (borrowed from the feminine models)
    hairColor: "#7a4a24",
    facialHair: "beard",
    skinTone: "#F0C3A0",
    glasses: "none",
    shoes: "sneakers",
    shoeColor: "#5b4636",
  },
  portrait: staufferPortrait,
};

/**
 * Ms. Roldan, 5th grade IET and the creator of the co-teaching program, standing outside the Learning Center, to
 * the right of its door (as you face it). Matches her portrait: warm tan skin, short full curly black hair, a pink
 * ribbed mock-neck sweater with a hint of purple.
 */
export const NPC_ROLDAN: NpcDef = {
  id: "npc-roldan",
  room: "campus",
  x: -1.9, // the Learning Center door is at x = -4 (north building, wall z = -2): she is a little to its right
  z: 0.4, // just in front of the benches
  rotY: -0.35, // facing the courtyard, turned a little toward the door
  talkRange: 1.7, // short, so E at the Learning Center door still reaches the door
  profile: {
    ...getDefaultProfile(),
    name: "Ms. Roldan",
    title: "5th Grade IET",
    noHomeroom: true,
    gender: "feminine",
    look: "fem-casual",
    outfitColor: "#f272b8", // pink sweater
    hairStyle: "f-long", // chin length
    extraHair: "curlyBob", // full curls all over, down to the chin
    hairColor: "#1b1512",
    skinTone: "#C98B63",
    glasses: "none",
    shoes: "sneakers",
    shoeColor: "#f1f1f1",
    partColors: { "Legs:Orange": "#2f3546" },
    polkaDots: { parts: ["Body:White"], base: "#f272b8", dot: "#d24f98", accent: "#a970d8", shape: "ribs" },
  },
  portrait: roldanPortrait,
  // SAMPLE TEXT: replace with Ms. Roldan's real dialogue
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Hi! I'm Ms. Roldan, the 5th grade IET. I'm also the creator of our co-teaching program here at Valor!",
          "Co-teaching means two teachers sharing one classroom, planning, teaching and assessing together so every student gets what they need.",
        ],
        options: [
          { label: "How did the co-teaching program start?", next: "start" },
          { label: "What does co-teaching look like in a classroom?", next: "models" },
          { label: "What does a 5th grade IET do?", next: "iet" },
          { label: "Thanks, Ms. Roldan!" },
        ],
      },
      start: {
        paragraphs: [
          "(Sample text) I saw how much our students grew when two teachers brought their strengths into the same room. So I built a program that pairs teachers, gives them common planning time, and helps them grow as a team.",
          "Now co-teaching is part of how we make sure all of our learners, including our English learners and students with IEPs, are supported in the general education classroom.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Ms. Roldan!" },
        ],
      },
      models: {
        paragraphs: [
          "(Sample text) There are a few models we use: station teaching, where students rotate through small groups; parallel teaching, where each teacher teaches half the class the same lesson; alternative teaching for a small group that needs something different; and team teaching, where both teachers lead together.",
          "The key is planning together and both teachers owning every student in the room.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Ms. Roldan!" },
        ],
      },
      iet: {
        paragraphs: [
          "(Sample text) I work alongside our 5th grade teachers to support students who need extra help, co-planning lessons, adapting materials and teaching small groups so everyone can access grade-level learning.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Ms. Roldan!" },
        ],
      },
    },
  },
};

/**
 * Mr. Guerrero, Assistant Principal for the upper school (grades 7 and 8), standing between the 8th UCLA classroom and the field,
 * looking out at the field. Matches his portrait: warm tan skin, short neat black
 * hair, a mustache and goatee, a crisp white button-up shirt.
 */
const GUERRERO_SHIRT = "#eef2f6";
export const NPC_GUERRERO: NpcDef = {
  id: "npc-guerrero",
  room: "campus",
  x: 23.4, // between the ledges in front of the 8th grade rooms, at the edge of the field (z = 10.5)
  z: 8.7,
  rotY: 0.08, // looking out at the field
  profile: {
    ...getDefaultProfile(),
    name: "Mr. Guerrero",
    title: "Assistant Principal, Upper School",
    noHomeroom: true,
    gender: "masculine",
    look: "masc-suit",
    outfitColor: GUERRERO_SHIRT,
    hairStyle: "m-suit", // short, neat, swept up
    hairColor: "#141214",
    facialHair: "goatee",
    skinTone: "#D49C74",
    glasses: "none",
    shoes: "dress",
    shoeColor: "#1f1f24",
    partColors: { White: GUERRERO_SHIRT, Tie: GUERRERO_SHIRT, "Legs:Suit": "#283041" },
  },
  portrait: guerreroPortrait,
  // SAMPLE TEXT: replace with Mr. Guerrero's real dialogue
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Good morning! I'm Mr. Guerrero, the Assistant Principal for our upper school, grades 7 and 8.",
          "How's the PD going? Make sure you stop by every classroom, our teachers have some great things to share.",
        ],
        options: [
          { label: "What does an Assistant Principal do?", next: "ap" },
          { label: "Any advice for our English learners in the upper grades?", next: "eld" },
          { label: "Thanks, Mr. Guerrero!" },
        ],
      },
      ap: {
        paragraphs: [
          "(Sample text) A little of everything! I support our 7th and 8th grade teachers in their classrooms, help with student support and discipline, and work with families so every student has what they need.",
          "Most of all, I'm out here making sure our students feel known and cared for.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Mr. Guerrero!" },
        ],
      },
      eld: {
        paragraphs: [
          "(Sample text) Give them lots of chances to talk. Sentence frames, partner talk and clear academic vocabulary go a long way. And keep expectations high: our English learners can do rigorous work with the right support.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Mr. Guerrero!" },
        ],
      },
    },
  },
};

/**
 * Mrs. Nayfeld, Assistant Principal for the lower school (grades 5 and 6), outside the MPR's courtyard doors on the side toward the stairs up to the west building's walkway
 * (Mrs. Tunson is on the other side). Matches her portrait: warm light-medium skin, long wavy brown hair with a
 * center part, a beige button-up utility shirt, dark pants.
 */
const NAYFELD_SHIRT = "#d8c8ad";
export const NPC_NAYFELD: NpcDef = {
  id: "npc-nayfeld",
  room: "campus",
  x: -12.5, // the MPR doors are at x = -14, z 50.5 .. 52.5; the stairs start at z = 43.2
  z: 48.4,
  rotY: Math.PI / 2 + 0.4, // facing the courtyard, turned a little toward the doors
  talkRange: 1.8, // short, so E at the MPR doors still opens them
  profile: {
    ...getDefaultProfile(),
    name: "Mrs. Nayfeld",
    title: "Assistant Principal, Lower School",
    noHomeroom: true,
    gender: "feminine",
    look: "fem-suit", // jacket and shirt both her beige utility shirt
    outfitColor: NAYFELD_SHIRT,
    hairStyle: "f-witch", // long, center part
    hairColor: "#6b3f22",
    skinTone: "#E8B48C",
    glasses: "none",
    shoes: "sneakers",
    shoeColor: "#f1f1f1",
    partColors: { "Body:White": NAYFELD_SHIRT, "Legs:Black": "#2e3442" },
  },
  portrait: nayfeldPortrait,
  // SAMPLE TEXT: replace with Mrs. Nayfeld's real dialogue
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Hi there! I'm Mrs. Nayfeld, the Assistant Principal for our lower school, grades 5 and 6. Welcome to our PD day!",
          "Heading upstairs? These stairs take you up to the 6th grade classrooms on the walkway.",
        ],
        options: [
          { label: "What does an Assistant Principal do?", next: "ap" },
          { label: "Where should I go first?", next: "first" },
          { label: "Any tips for today?", next: "tips" },
          { label: "Thanks, Mrs. Nayfeld!" },
        ],
      },
      ap: {
        paragraphs: [
          "(Sample text) I support our 5th and 6th grade teachers and students: visiting classrooms, coaching, helping with student support, and partnering with families so our younger students get off to a strong start.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Mrs. Nayfeld!" },
        ],
      },
      first: {
        paragraphs: [
          "(Sample text) Start in the MPR and take a seat for the welcome. After that, visit the classrooms in any order you like. Your map (press M) shows which ones still have an assignment.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Mrs. Nayfeld!" },
        ],
      },
      tips: {
        paragraphs: [
          "(Sample text) Grab a backpack in the MPR so you can carry your things, and keep an eye on your student agenda to see what's left. And take your time: every classroom has something great to share!",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Mrs. Nayfeld!" },
        ],
      },
    },
  },
};

/**
 * Mr. Somoza, the 7th grade LMU humanities teacher, standing in front of the whiteboard in his classroom (talk to him
 * for the assignment). Always excited; says goodbye with "Here we go!" Matches his portrait: black wide-brim hat, dark hair, a full
 * dark curly beard, warm tan skin, an open gray-and-brown plaid flannel over a navy tee, jeans.
 */
const SOMOZA_NAVY = "#1d2433";
export const NPC_SOMOZA: NpcDef = {
  id: "npc-somoza",
  room: "classroom",
  classroomId: "7th-lmu-humanities",
  x: 0, // set from the classroom's whiteboard
  z: 0,
  rotY: 0, // facing the class
  talkRange: 2.2,
  chatFirst: true,
  profile: {
    ...getDefaultProfile(),
    name: "Mr. Somoza",
    title: "7th Grade Humanities Teacher",
    noHomeroom: true,
    gender: "masculine",
    look: "masc-suit", // the jacket is his open flannel, the shirt his navy tee
    outfitColor: SOMOZA_NAVY,
    hairStyle: "f-long", // modelled hair down to the collar (like Mr. Stauffer's), under the hat
    hairColor: "#2a1a10", // dark brown
    extraHair: "scalp", // hair-colored scalp under the long hair: no skin shows between the hair and the hat
    skinTone: "#D9A074", // warm tan
    facialHair: "full-beard",
    hat: "farmer",
    hatColor: "#17171a", // black wide-brim hat
    glasses: "none",
    shoes: "boots",
    shoeColor: "#3b2a1e",
    partColors: { "Body:White": SOMOZA_NAVY, "Body:Tie": SOMOZA_NAVY, "Legs:Suit": "#3a4a63", "Hat:Beige": "#17171a", "Hat:Red": "#0d0d0f" },
    polkaDots: { parts: ["Body:Suit"], base: "#8d8a84", dot: "#3a332d", accent: "#e4ddd0", shape: "plaid" },
  },
  portrait: somozaPortrait,
  // SAMPLE TEXT: replace with Mr. Somoza's real dialogue
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Welcome, welcome! I'm Mr. Somoza, and I teach 7th grade humanities here in LMU!",
          "I am SO excited you're here today. History is full of amazing stories, and my students tell them best!",
        ],
        options: [
          { label: "Show me the assignment!", action: "open-assignment" },
          { label: "What are your students learning?", next: "learn" },
          { label: "Why are you always so excited?", next: "excited" },
          { label: "Thanks, Mr. Somoza!", next: "bye" },
        ],
      },
      learn: {
        paragraphs: [
          "(Sample text) Right now we're traveling back in time to ancient civilizations! My students read primary sources, talk with partners using sentence frames, and then debate big questions.",
          "Every student gets a voice, especially my English learners!",
        ],
        options: [
          { label: "Show me the assignment!", action: "open-assignment" },
          { label: "I have another question", next: "root" },
          { label: "Thanks, Mr. Somoza!", next: "bye" },
        ],
      },
      excited: {
        paragraphs: [
          "(Sample text) Because every day is a new adventure! Energy is contagious: bring it, and your students will bring it too.",
          "And when it's time to go? You'll hear it. My students know it by heart!",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Mr. Somoza!", next: "bye" },
        ],
      },
      bye: {
        // how Mr. Somoza always says goodbye
        paragraphs: ["Here we go!"],
        options: [{ label: "See you, Mr. Somoza!" }],
      },
    },
  },
};

/**
 * Mrs. Weber, the 7th grade USC English teacher, standing in front of the whiteboard in her classroom (talk to her for
 * the assignment). Matches her portrait: long, wavy dark-blonde hair with a center part, fair skin, a gray knit
 * crewneck sweater.
 */
const WEBER_GRAY = "#7f848b";
export const NPC_WEBER: NpcDef = {
  id: "npc-weber",
  room: "classroom",
  classroomId: "7th-usc-english",
  x: 0, // set from the classroom's whiteboard
  z: 0,
  rotY: 0, // facing the class
  talkRange: 2.2,
  chatFirst: true,
  profile: {
    ...getDefaultProfile(),
    name: "Mrs. Weber",
    title: "7th Grade English Teacher & Grade Level Lead",
    noHomeroom: true,
    gender: "feminine",
    look: "fem-casual",
    outfitColor: WEBER_GRAY,
    hairStyle: "f-witch", // center part, lengthened below the shoulders
    hairLength: 2.0,
    hairColor: "#c9a160", // dark blonde
    skinTone: "#F2C9AE",
    glasses: "none",
    shoes: "sneakers",
    shoeColor: "#e9e9e6",
    partColors: { "Legs:Orange": "#2f3546" },
    // a soft knit texture on the sweater
    polkaDots: { parts: ["Body:White"], base: WEBER_GRAY, dot: "#6f747b", accent: "#8b9097", shape: "ribs" },
  },
  portrait: weberPortrait,
  // SAMPLE TEXT: replace with Mrs. Weber's real dialogue
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "Hi there! I'm Mrs. Weber, and I teach 7th grade English here in USC. Welcome!",
          "Today I'm facilitating part of our ELD PD: Learning Objectives, and how a language objective helps our multilingual learners reach grade-level content. It only takes about three minutes, and there's a slot machine!",
        ],
        options: [
          { label: "Show me the assignment!", action: "open-assignment" },
          { label: "What are your students learning?", next: "learn" },
          { label: "Thanks, Mrs. Weber!", next: "bye" },
        ],
      },
      learn: {
        paragraphs: [
          "We're looking at how authors develop a character's perspective over time. My students cite evidence from the text to back up their thinking.",
          "Every lesson has a language objective on the board, like \"Students will explain how the narrator changes using because and as a result in a partner discussion.\" That way everyone, especially my English learners, knows exactly what language to use.",
        ],
        options: [
          { label: "Show me the assignment!", action: "open-assignment" },
          { label: "I have another question", next: "root" },
          { label: "Thanks, Mrs. Weber!", next: "bye" },
        ],
      },
      bye: {
        paragraphs: ["Have a wonderful day! Enjoy the rest of the classrooms."],
        options: [{ label: "See you, Mrs. Weber!" }],
      },
    },
  },
};

/**
 * Mr. Dominguez, the music teacher, at the front of the music room playing the keyboard. Matches his portrait: bald,
 * a short light-brown beard, a black polo under an open maroon hoodie.
 */
const DOMINGUEZ_MAROON = "#6b2233";
const DOMINGUEZ_BLACK = "#1e1f23";
export const NPC_DOMINGUEZ: NpcDef = {
  id: "npc-dominguez",
  room: "classroom",
  classroomId: "music",
  x: 0, // set from the classroom's whiteboard (the keyboard stands in front of him)
  z: 0,
  rotY: 0, // facing the class
  talkRange: 2.4,
  chatFirst: true,
  pose: "keyboard",
  profile: {
    ...getDefaultProfile(),
    name: "Mr. Dominguez",
    title: "Music Teacher",
    noHomeroom: true,
    gender: "masculine",
    look: "masc-suit", // the jacket is his open hoodie, the shirt his black polo
    outfitColor: DOMINGUEZ_MAROON,
    noHair: true, // bald
    hairColor: "#7a5a42", // his short beard
    facialHair: "beard",
    skinTone: "#DDA582",
    glasses: "none",
    shoes: "sneakers",
    shoeColor: DOMINGUEZ_BLACK,
    partColors: { White: DOMINGUEZ_BLACK, Tie: DOMINGUEZ_BLACK, "Legs:Suit": "#2a2d33" },
  },
  portrait: dominguezPortrait,
  // SAMPLE TEXT: replace with Mr. Dominguez's real dialogue
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Welcome to the Music room! I'm Mr. Dominguez, the music teacher. Pull up a chair, the band is warming up.",
          "Feel free to look around: guitars along the wall, the drum set in the corner, and our wind section right here.",
        ],
        options: [
          { label: "What do students do in Music?", next: "about" },
          { label: "What are you playing?", next: "playing" },
          { label: "Thanks, Mr. Dominguez!", next: "bye" },
        ],
      },
      about: {
        paragraphs: [
          "(Sample text) We learn to read music, play instruments, and perform together. Every student can find an instrument they enjoy.",
          "Music is a language too, so my English learners practice listening, rhythm, and vocabulary every single class.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Mr. Dominguez!", next: "bye" },
        ],
      },
      playing: {
        paragraphs: ["(Sample text) Just a warm-up! Scales first, then the song we're performing at the winter concert."],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Mr. Dominguez!", next: "bye" },
        ],
      },
      bye: {
        paragraphs: ["(Sample text) Thanks for stopping by! Keep the music going. \uD83C\uDFB5"],
        options: [{ label: "See you, Mr. Dominguez!" }],
      },
    },
  },
};

/**
 * Mr. Lark, the theater teacher, on the stage at the front of the theater (in front of the whiteboard). Matches his
 * portrait: short curly brown hair, light stubble, a white collared shirt with a black vest.
 */
export const NPC_LARK: NpcDef = {
  id: "npc-lark",
  room: "classroom",
  classroomId: "theater",
  x: 0, // set from the classroom's whiteboard
  z: 0,
  offsetZ: 0.9, // toward the front of the stage
  y: 0.45, // standing on the stage
  rotY: 0, // facing the audience
  talkRange: 2.4,
  chatFirst: true,
  profile: {
    ...getDefaultProfile(),
    name: "Mr. Lark",
    title: "Theatre Teacher",
    noHomeroom: true,
    gender: "masculine",
    look: "masc-suit", // the jacket is his vest (white shirt sleeves), the shirt his white collar
    outfitColor: "#18181b",
    hairStyle: "m-suit", // short neat sides under the curls
    extraHair: "curlyTop", // the curly top with curls over the forehead
    hairColor: "#7a4a26",
    facialHair: "beard", // light stubble
    beardColor: "#a77b58", // lighter than his hair, so it reads as stubble
    skinTone: "#F1C6A6",
    glasses: "none",
    shoes: "dress",
    shoeColor: "#1f1f24",
    partColors: { White: "#f4f4f2", Tie: "#f4f4f2", "Legs:Suit": "#2b2d33" },
    polkaDots: { parts: ["Body:Suit"], base: "#18181b", dot: "#f1f1ef", shape: "sleeves" },
  },
  portrait: larkPortrait,
  // SAMPLE TEXT: replace with Mr. Lark's real dialogue
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Welcome to the Theatre! I'm Mr. Lark, the theatre teacher. Have a seat, rehearsal is about to begin.",
          "See the colored tape on the stage? Those are our spike marks: every actor knows exactly where to stand.",
        ],
        options: [
          { label: "What happens in the Theatre?", next: "about" },
          { label: "What are the tape marks for?", next: "tape" },
          { label: "Thanks, Mr. Lark!", next: "bye" },
        ],
      },
      about: {
        paragraphs: [
          "(Sample text) Our students rehearse plays, practice public speaking, and put on shows for the whole school. It's a great place to try something new.",
          "Theatre is wonderful for English learners: they practice speaking, listening, and expression, all with a script to support them.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Mr. Lark!", next: "bye" },
        ],
      },
      tape: {
        paragraphs: [
          "(Sample text) Each color is a different actor or a different scene. When the lights go down, you find your color and hit your mark.",
          "Upstage is the back, downstage is the front, and stage left is the actor's left. Check the poster on the wall!",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Mr. Lark!", next: "bye" },
        ],
      },
      bye: {
        paragraphs: ["(Sample text) Break a leg out there! \uD83C\uDFAD"],
        options: [{ label: "See you, Mr. Lark!" }],
      },
    },
  },
};

/**
 * Ms. Gillett, the 6th grade USC English teacher, standing in front of the whiteboard in her classroom (talk to her for
 * the assignment). Matches her portrait: long, wavy honey-blonde hair with a center part, fair skin, a black hoodie.
 */
const GILLETT_BLACK = "#1c1d21";
export const NPC_GILLETT: NpcDef = {
  id: "npc-gillett",
  room: "classroom",
  classroomId: "6th-usc-english",
  x: 0, // set from the classroom's whiteboard
  z: 0,
  rotY: 0, // facing the class
  talkRange: 2.2,
  chatFirst: true,
  profile: {
    ...getDefaultProfile(),
    name: "Ms. Gillett",
    title: "6th Grade English Teacher & Grade Level Lead",
    noHomeroom: true,
    gender: "feminine",
    look: "fem-casual",
    outfitColor: GILLETT_BLACK,
    hairStyle: "f-witch", // center part, lengthened below the shoulders
    hairLength: 2.0,
    hairColor: "#b48a56", // honey blonde
    skinTone: "#F3C8AE",
    glasses: "none",
    shoes: "sneakers",
    shoeColor: "#1f1f24",
    partColors: { "Body:White": GILLETT_BLACK, "Legs:Orange": "#2a3142" },
  },
  portrait: gillettPortrait,
  // SAMPLE TEXT: replace with Ms. Gillett's real dialogue
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Hi, welcome! I'm Ms. Gillett, and I teach 6th grade English here in USC.",
          "Your assignment is ready whenever you are. Come on in!",
        ],
        options: [
          { label: "Show me the assignment!", action: "open-assignment" },
          { label: "What are your students learning?", next: "learn" },
          { label: "Thanks, Ms. Gillett!", next: "bye" },
        ],
      },
      learn: {
        paragraphs: [
          "(Sample text) We're reading closely and looking at how characters change over the course of a story. My students back up their ideas with evidence from the text.",
          "Lots of partner talk with sentence frames, so every student, especially my English learners, has a voice in our discussions.",
        ],
        options: [
          { label: "Show me the assignment!", action: "open-assignment" },
          { label: "I have another question", next: "root" },
          { label: "Thanks, Ms. Gillett!", next: "bye" },
        ],
      },
      bye: {
        paragraphs: ["(Sample text) Have a great day! Enjoy visiting the other classrooms."],
        options: [{ label: "See you, Ms. Gillett!" }],
      },
    },
  },
};

/**
 * Mr. Norori, the 6th grade UCLA humanities teacher, standing in front of the whiteboard in his classroom (talk to him
 * for the assignment). Matches his portrait: short black hair, black rectangular glasses, a thin moustache and chin
 * goatee, tan skin, a gray Valor polo.
 */
const NORORI_GRAY = "#8a8d93";
export const NPC_NORORI: NpcDef = {
  id: "npc-norori",
  room: "classroom",
  classroomId: "6th-ucla-humanities",
  x: 0, // set from the classroom's whiteboard
  z: 0,
  rotY: 0, // facing the class
  talkRange: 2.2,
  chatFirst: true,
  profile: {
    ...getDefaultProfile(),
    name: "Mr. Norori",
    title: "6th Grade Humanities Teacher",
    noHomeroom: true,
    gender: "masculine",
    look: "masc-tee",
    outfitColor: NORORI_GRAY,
    noHair: true,
    extraHair: "buzz", // short and neat, faded sides
    hairColor: "#141210",
    facialHair: "chin-goatee",
    beardColor: "#2b221d",
    skinTone: "#C99068",
    glasses: "rect",
    glassesColor: "#1d2129",
    shoes: "sneakers",
    shoeColor: "#1f1f24",
  },
  portrait: noroPortrait,
  // SAMPLE TEXT: replace with Mr. Norori's real dialogue
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Hey, welcome in! I'm Mr. Norori, and I teach 6th grade humanities here in UCLA.",
          "Your assignment is ready whenever you are. Make yourself comfortable.",
        ],
        options: [
          { label: "Show me the assignment!", action: "open-assignment" },
          { label: "What are your students learning?", next: "learn" },
          { label: "Thanks, Mr. Norori!", next: "bye" },
        ],
      },
      learn: {
        paragraphs: [
          "(Sample text) We're exploring ancient civilizations: how people lived, what they believed, and how their ideas still shape our world today.",
          "My students analyze primary sources and discuss them with partners using sentence frames, so everyone, including my English learners, can share their thinking.",
        ],
        options: [
          { label: "Show me the assignment!", action: "open-assignment" },
          { label: "I have another question", next: "root" },
          { label: "Thanks, Mr. Norori!", next: "bye" },
        ],
      },
      bye: {
        paragraphs: ["(Sample text) Take care! Enjoy the rest of the classrooms."],
        options: [{ label: "See you, Mr. Norori!" }],
      },
    },
  },
};

/**
 * Mr. Ramirez, the 8th grade LMU history teacher, standing in front of the whiteboard in his classroom (talk to him for
 * the assignment). Matches his portrait: black hair swept back with faded sides, thin silver rectangular glasses, a full
 * trimmed beard, tan skin, a blue button-up shirt with a rust-colored print.
 */
const RAMIREZ_BLUE = "#466a8c";
export const NPC_RAMIREZ: NpcDef = {
  id: "npc-ramirez",
  room: "classroom",
  classroomId: "8th-lmu-humanities",
  x: 0, // set from the classroom's whiteboard
  z: 0,
  rotY: 0, // facing the class
  talkRange: 2.2,
  chatFirst: true,
  profile: {
    ...getDefaultProfile(),
    name: "Mr. Ramirez",
    title: "8th Grade History Teacher",
    noHomeroom: true,
    gender: "masculine",
    look: "masc-suit", // jacket + shirt + tie all printed as one button-up shirt
    outfitColor: RAMIREZ_BLUE,
    hairStyle: "m-king", // short, neat and full on top
    hairColor: "#16151a",
    facialHair: "beard",
    skinTone: "#C98E66",
    glasses: "rect",
    glassesColor: "#9aa0a8", // thin silver frames
    shoes: "dress",
    shoeColor: "#2a1f19",
    partColors: { "Legs:Suit": "#2b2f38" },
    polkaDots: { parts: ["Body:Suit", "Body:White", "Body:Tie"], base: RAMIREZ_BLUE, dot: "#a5614c", accent: "#d8c7ad", shape: "diamonds" },
  },
  portrait: ramirezPortrait,
  // SAMPLE TEXT: replace with Mr. Ramirez's real dialogue
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "Welcome! I'm Mr. Ramirez, and I teach 8th grade history here in LMU.",
          "Today I'm facilitating part of our ELD PD: Grading for Equity. Two students, same learning, very different grades. Let's find out why. It only takes about three minutes!",
        ],
        options: [
          { label: "Show me the assignment!", action: "open-assignment" },
          { label: "What are your students learning?", next: "learn" },
          { label: "Thanks, Mr. Ramirez!", next: "bye" },
        ],
      },
      learn: {
        paragraphs: [
          "We're at the Constitutional Convention: how the founders debated, compromised, and built the government we still have today.",
          "My students read primary sources and argue both sides with sentence frames. History is a conversation, and every student, especially my English learners, gets to join it.",
        ],
        options: [
          { label: "Show me the assignment!", action: "open-assignment" },
          { label: "I have another question", next: "root" },
          { label: "Thanks, Mr. Ramirez!", next: "bye" },
        ],
      },
      bye: {
        paragraphs: ["Thanks for stopping by! Enjoy the rest of your visit."],
        options: [{ label: "See you, Mr. Ramirez!" }],
      },
    },
  },
};

/**
 * Ms. Martinez, the 7th grade CSUN math teacher, standing in front of the whiteboard in her classroom (talk to her for
 * the assignment). Matches her portrait: very long, wavy black hair with a center part, black rectangular glasses,
 * a light blue crewneck tee.
 */
const MARTINEZ_BLUE = "#7cb9df";
export const NPC_MARTINEZ: NpcDef = {
  id: "npc-martinez",
  room: "classroom",
  classroomId: "7th-csun-math",
  x: 0, // set from the classroom's whiteboard
  z: 0,
  rotY: 0, // facing the class
  talkRange: 2.2,
  chatFirst: true,
  profile: {
    ...getDefaultProfile(),
    name: "Ms. Martinez",
    title: "7th Grade Math Teacher",
    noHomeroom: true,
    gender: "feminine",
    look: "fem-casual",
    outfitColor: MARTINEZ_BLUE,
    hairStyle: "f-witch", // center part, lengthened well past the shoulders
    hairLength: 2.4,
    hairColor: "#17141a",
    skinTone: "#E6B48F",
    glasses: "rect",
    glassesColor: "#1d1f24",
    shoes: "sneakers",
    shoeColor: "#f0f0ee",
    partColors: { "Body:White": MARTINEZ_BLUE, "Legs:Orange": "#2a3142" },
  },
  portrait: martinezPortrait,
  // SAMPLE TEXT: replace with Ms. Martinez's real dialogue
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Hi, welcome! I'm Ms. Martinez, and I teach 7th grade math here in CSUN.",
          "Your assignment is ready whenever you are. Come on in!",
        ],
        options: [
          { label: "Show me the assignment!", action: "open-assignment" },
          { label: "What are your students learning?", next: "learn" },
          { label: "Thanks, Ms. Martinez!", next: "bye" },
        ],
      },
      learn: {
        paragraphs: [
          "(Sample text) We're working on slope and linear equations: finding patterns in tables and graphs and writing the equation that describes them.",
          "My students explain their strategies to a partner using math sentence frames, so everyone, especially my English learners, practices the language of math.",
        ],
        options: [
          { label: "Show me the assignment!", action: "open-assignment" },
          { label: "I have another question", next: "root" },
          { label: "Thanks, Ms. Martinez!", next: "bye" },
        ],
      },
      bye: {
        paragraphs: ["(Sample text) Have a great day! Good luck with the rest of the classrooms."],
        options: [{ label: "See you, Ms. Martinez!" }],
      },
    },
  },
};

/**
 * Mrs. Trae, a founding member of the school: the 5th grade USC science teacher, grade level lead and an administrator.
 * She stands beside Mr. Perry, on his left (her room's assignment is on its whiteboard and still carries her name).
 * Matches her portrait: long, straight black hair with a center part, a green-and-white striped
 * button-up shirt.
 */
export const NPC_TRAE: NpcDef = {
  id: "npc-trae",
  room: "campus",
  teaches: "5th-usc-science",
  x: 3.31, // a step to Mr. Perry's left (he is at 2.4, 8.8 facing rotY 0.8)
  z: 7.87,
  rotY: 0.8, // looking out toward the field with him
  talkRange: 2.2,
  profile: {
    ...getDefaultProfile(),
    name: "Mrs. Trae",
    title: "5th Grade Science Teacher, Grade Level Lead & Administrator",
    noHomeroom: true,
    gender: "feminine",
    look: "fem-suit", // jacket + shirt printed as one long-sleeved striped shirt
    outfitColor: "#f2f5f0",
    hairStyle: "f-witch", // center part, lengthened to the chest
    hairLength: 1.9,
    hairColor: "#141216",
    skinTone: "#EBC09C",
    glasses: "none",
    shoes: "sneakers",
    shoeColor: "#f0f0ee",
    partColors: { "Legs:Black": "#2b2f38" },
    polkaDots: { parts: ["Body:Black", "Body:White"], base: "#f2f5f0", dot: "#4f8f5f", shape: "stripes" },
  },
  portrait: traePortrait,
  // SAMPLE TEXT: replace with Mrs. Trae's real dialogue
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Hello and welcome! I'm Mrs. Trae. I've been here since the very beginning: I'm one of Valor's founding members.",
          "I teach 5th grade science in USC, I'm the 5th grade level lead, and I'm part of the administration team. My room's assignment is on the whiteboard upstairs!",
        ],
        options: [
          { label: "What are your students learning?", next: "learn" },
          { label: "Thanks, Mrs. Trae!", next: "bye" },
        ],
      },
      learn: {
        paragraphs: [
          "(Sample text) We're learning how plants make their own food from sunlight, water, and air, and how energy moves through an ecosystem.",
          "My students observe, record what they see in their science journals, and explain it to a partner with sentence frames. Every student is a scientist here, especially my English learners!",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Mrs. Trae!", next: "bye" },
        ],
      },
      bye: {
        paragraphs: ["(Sample text) Thanks for visiting! Have a wonderful day."],
        options: [{ label: "See you, Mrs. Trae!" }],
      },
    },
  },
};

/**
 * Ms. Bakoo, the 7th grade UCLA science teacher, standing in front of the whiteboard in her classroom (talk to her for
 * the assignment). Matches her portrait: long, straight dark brown-black hair swept back on top, a navy top.
 */
const BAKOO_NAVY = "#25325c";
export const NPC_BAKOO: NpcDef = {
  id: "npc-bakoo",
  room: "classroom",
  classroomId: "7th-ucla-science",
  x: 0, // set from the classroom's whiteboard
  z: 0,
  rotY: 0, // facing the class
  talkRange: 2.2,
  chatFirst: true,
  profile: {
    ...getDefaultProfile(),
    name: "Ms. Bakoo",
    title: "7th Grade Science Teacher",
    noHomeroom: true,
    gender: "feminine",
    look: "fem-casual",
    outfitColor: BAKOO_NAVY,
    hairStyle: "f-witch", // lengthened to the chest
    hairLength: 2.0,
    hairColor: "#221916",
    skinTone: "#ECBF9F",
    glasses: "none",
    shoes: "sneakers",
    shoeColor: "#1f1f24",
    partColors: { "Body:White": BAKOO_NAVY, "Legs:Orange": "#2a2f3a" },
  },
  portrait: bakooPortrait,
  // SAMPLE TEXT: replace with Ms. Bakoo's real dialogue
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Hi there, welcome! I'm Ms. Bakoo, and I teach 7th grade science here in UCLA.",
          "Your assignment is ready whenever you are. Come on in and explore!",
        ],
        options: [
          { label: "Show me the assignment!", action: "open-assignment" },
          { label: "What are your students learning?", next: "learn" },
          { label: "Thanks, Ms. Bakoo!", next: "bye" },
        ],
      },
      learn: {
        paragraphs: [
          "(Sample text) We're studying how living things get and use energy: photosynthesis in plants and cellular respiration in our own cells.",
          "My students run labs, record their data, and explain their findings to a partner with sentence frames, so everyone, especially my English learners, talks like a scientist.",
        ],
        options: [
          { label: "Show me the assignment!", action: "open-assignment" },
          { label: "I have another question", next: "root" },
          { label: "Thanks, Ms. Bakoo!", next: "bye" },
        ],
      },
      bye: {
        paragraphs: ["(Sample text) Thanks for stopping by! Enjoy the rest of your day."],
        options: [{ label: "See you, Ms. Bakoo!" }],
      },
    },
  },
};

/**
 * Ms. Getis, the 5th grade UCLA English teacher, standing in front of the whiteboard in her classroom (talk to her for
 * the assignment). Matches her portrait: wavy light-brown hair with a center part, a coral floral short-sleeve cardigan
 * over a white top.
 */
const GETIS_CORAL = "#d9604a";
export const NPC_GETIS: NpcDef = {
  id: "npc-getis",
  room: "classroom",
  classroomId: "5th-ucla-english",
  x: 0, // set from the classroom's whiteboard
  z: 0,
  rotY: 0, // facing the class
  talkRange: 2.2,
  chatFirst: true,
  profile: {
    ...getDefaultProfile(),
    name: "Ms. Getis",
    title: "5th Grade English Teacher",
    noHomeroom: true,
    gender: "feminine",
    look: "fem-suit", // the jacket is her open floral cardigan, the shirt her white top
    outfitColor: GETIS_CORAL,
    hairStyle: "f-witch", // center part, lengthened to the chest
    hairLength: 1.9,
    hairColor: "#a27c4c", // golden light brown
    skinTone: "#F4CDB4",
    glasses: "none",
    shoes: "sneakers",
    shoeColor: "#f0f0ee",
    partColors: { "Body:White": "#f6f4ef", "Legs:Black": "#2f3a52" },
    polkaDots: { parts: ["Body:Black"], base: GETIS_CORAL, dot: "#2f5f8a", accent: "#e8c64f", shape: "dots" },
  },
  portrait: getisPortrait,
  // SAMPLE TEXT: replace with Ms. Getis's real dialogue
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Hi there, welcome! I'm Ms. Getis, and I teach 5th grade English here in UCLA.",
          "Your assignment is ready whenever you are. Come on in!",
        ],
        options: [
          { label: "Show me the assignment!", action: "open-assignment" },
          { label: "What are your students learning?", next: "learn" },
          { label: "Thanks, Ms. Getis!", next: "bye" },
        ],
      },
      learn: {
        paragraphs: [
          "(Sample text) We're reading stories together and talking about how characters think and feel, using clues from the text to explain our ideas.",
          "My 5th graders practice with partners and sentence frames every day, and it's amazing to watch my English learners grow their confidence!",
        ],
        options: [
          { label: "Show me the assignment!", action: "open-assignment" },
          { label: "I have another question", next: "root" },
          { label: "Thanks, Ms. Getis!", next: "bye" },
        ],
      },
      bye: {
        paragraphs: ["(Sample text) Have a wonderful day! Enjoy the rest of the classrooms."],
        options: [{ label: "See you, Ms. Getis!" }],
      },
    },
  },
};

/**
 * Mr. Martinez, the Community Schools Manager, behind his white folding table by the MPR near the south brick wall
 * (scene.ts: pamphlets, a trifold poster), facing the lunch tables. He gives players the "Partners in Learning" handout
 * (handout.ts) on how schools can leverage families and the community to support multilingual learners. Matches his
 * portrait: black hair swept back, a short trimmed beard, tan skin, a navy-and-gray striped button-up over a white tee.
 */
const MR_MARTINEZ_NAVY = "#3b4558";
export const NPC_MARTINEZ_CS: NpcDef = {
  id: "npc-martinez-cs",
  room: "campus",
  x: -10.3, // behind the table (table centre z = 60.6, in line with Delma's)
  z: 61.45,
  rotY: Math.PI, // facing the lunch tables across the plaza
  talkRange: 2.6, // talk across the table
  profile: {
    ...getDefaultProfile(),
    name: "Mr. Martinez",
    title: "Community Schools Manager",
    noHomeroom: true,
    gender: "masculine",
    look: "masc-suit", // the jacket is his open striped button-up, the shirt his white tee
    outfitColor: MR_MARTINEZ_NAVY,
    hairStyle: "m-king", // short, swept back
    hairColor: "#15131a",
    facialHair: "beard",
    beardColor: "#221a15",
    skinTone: "#C68E66",
    glasses: "none",
    shoes: "sneakers",
    shoeColor: "#2a2d33",
    partColors: { White: "#f2f2ef", Tie: "#f2f2ef", "Legs:Suit": "#2b2f38" }, // the white tee at his open collar
    polkaDots: { parts: ["Body:Suit"], base: MR_MARTINEZ_NAVY, dot: "#8fa3c4", shape: "hstripes" },
  },
  portrait: mrMartinezPortrait,
  // SAMPLE TEXT (greeting / role): replace with Mr. Martinez's real words. The handout content is in handout.ts.
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Hi, welcome! I'm Mr. Martinez, the Community Schools Manager here at Valor.",
          "This table is all about partnering with our families and our community to help our multilingual learners thrive. Take a look around, and grab a handout!",
        ],
        options: [
          { label: "Can I have a handout?", action: "give-handout" },
          { label: "What does a Community Schools Manager do?", next: "role" },
          { label: "Why do families matter so much for MLLs?", next: "why" },
          { label: "Thanks, Mr. Martinez!", next: "bye" },
        ],
      },
      role: {
        paragraphs: [
          "(Sample text) I connect our school with families and community partners: health and food resources, adult ESL classes, family workshops, and after-school programs.",
          "I also support our ELAC so families have a real voice in decisions. When students' basic needs are met and their families feel welcome, they can focus on learning.",
        ],
        options: [
          { label: "Can I have a handout?", action: "give-handout" },
          { label: "I have another question", next: "root" },
          { label: "Thanks, Mr. Martinez!", next: "bye" },
        ],
      },
      why: {
        paragraphs: [
          "Research keeps finding the same thing: when schools and families work as partners, students attend more and learn more, across every background.",
          "Our multilingual families bring so much: languages, cultures, skills, and stories. The handout has research-based strategies to tap into that, plus what the law requires for communicating with families.",
        ],
        options: [
          { label: "Can I have a handout?", action: "give-handout" },
          { label: "I have another question", next: "root" },
          { label: "Thanks, Mr. Martinez!", next: "bye" },
        ],
      },
      bye: {
        paragraphs: ["(Sample text) Thanks for stopping by! Remember: families are our partners."],
        options: [{ label: "See you, Mr. Martinez!" }],
      },
    },
  },
};

/**
 * Delma, the Dean of Operations, behind her white folding table in front of the food truck by the MPR (scene.ts),
 * handing out burritos (classic or vegan). She also gives a brand-new Stanley cup to players who threw theirs away.
 * Matches her portrait: long straight black hair with a center part fading to deep red at the ends, medium tan skin,
 * a black polo.
 */
export const NPC_DELMA: NpcDef = {
  id: "npc-delma",
  room: "campus",
  x: -6.85, // behind her table (table centre z = 60.6), the truck behind her
  z: 61.45,
  rotY: Math.PI, // facing the players in front of the tables
  talkRange: 2.3,
  profile: {
    ...getDefaultProfile(),
    name: "Delma",
    title: "Dean of Operations",
    noHomeroom: true,
    gender: "feminine",
    look: "fem-casual",
    outfitColor: "#1b1c20",
    hairStyle: "f-witch", // center part, lengthened past the shoulders
    hairLength: 2.0,
    hairColor: "#18131a",
    hairTips: "#7a2a26", // deep red ombre toward the ends
    skinTone: "#D9A47E",
    glasses: "none",
    shoes: "sneakers",
    shoeColor: "#1f1f24",
    partColors: { "Body:White": "#1b1c20", "Legs:Orange": "#25272d" },
  },
  portrait: delmaPortrait,
  // SAMPLE TEXT: replace with Delma's real words
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Hi! I'm Delma, the Dean of Operations. Welcome to the food truck!",
          "We've got warm burritos today, and a vegan option too. What can I get you?",
        ],
        options: [
          { label: "Can I have a burrito?", action: "give-burrito" },
          { label: "Can I have the vegan burrito?", action: "give-burrito-vegan" },
          { label: "I need a new water bottle", action: "give-bottle" },
          { label: "What does a Dean of Operations do?", next: "role" },
          { label: "Thanks, Delma!", next: "bye" },
        ],
      },
      role: {
        paragraphs: [
          "(Sample text) I keep the campus running: facilities, safety, schedules, lunch, supplies, and events like today. If it needs to happen on campus, it probably comes through me!",
          "And if you ever lose your Stanley cup or throw it away, come see me: I've got new ones.",
        ],
        options: [
          { label: "Can I have a burrito?", action: "give-burrito" },
          { label: "I have another question", next: "root" },
          { label: "Thanks, Delma!", next: "bye" },
        ],
      },
      bye: {
        paragraphs: ["(Sample text) Enjoy the rest of your day! Come back if you get hungry."],
        options: [{ label: "See you, Delma!" }],
      },
    },
  },
};

/**
 * Raquel, an assistant, at the second white table in front of the food truck (next to Delma). She only speaks
 * Spanish, and she hands out burritos too. Matches her portrait: long wavy black hair, light-medium skin, a black tee.
 */
export const NPC_RAQUEL: NpcDef = {
  id: "npc-raquel",
  room: "campus",
  x: -4.95, // behind her table (table centre z = 60.6)
  z: 61.45,
  rotY: Math.PI,
  talkRange: 2.3,
  profile: {
    ...getDefaultProfile(),
    name: "Raquel",
    title: "Asistente",
    noHomeroom: true,
    gender: "feminine",
    look: "fem-casual",
    outfitColor: "#1b1c20",
    hairStyle: "f-witch", // lengthened to the chest
    hairLength: 1.9,
    hairColor: "#151217",
    skinTone: "#E3B08C",
    glasses: "none",
    shoes: "sneakers",
    shoeColor: "#1f1f24",
    partColors: { "Body:White": "#1b1c20", "Legs:Orange": "#25272d" },
  },
  portrait: raquelPortrait,
  // SAMPLE TEXT (in Spanish: Raquel only speaks Spanish): replace with Raquel's real words
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Texto de muestra) ¡Hola! Soy Raquel. ¡Bienvenido al camión de comida!",
          "Tenemos burritos calientitos, y también hay opción vegana. ¿Qué te doy?",
        ],
        options: [
          { label: "¿Me da un burrito, por favor?", action: "give-burrito" },
          { label: "¿Tiene la opción vegana?", action: "give-burrito-vegan" },
          { label: "¿Qué hay en el burrito vegano?", next: "vegan" },
          { label: "¡Gracias, Raquel!", next: "bye" },
        ],
      },
      vegan: {
        paragraphs: ["(Texto de muestra) El burrito vegano tiene frijoles, arroz, verduras asadas y salsa. ¡Nada de carne ni de queso, y está bien rico!"],
        options: [
          { label: "¿Me da uno vegano, por favor?", action: "give-burrito-vegan" },
          { label: "Tengo otra pregunta", next: "root" },
          { label: "¡Gracias, Raquel!", next: "bye" },
        ],
      },
      bye: {
        paragraphs: ["(Texto de muestra) ¡De nada! ¡Que te vaya muy bien!"],
        options: [{ label: "¡Adiós, Raquel!" }],
      },
    },
  },
};

/**
 * Ms. Aparicio, the 6th grade CSUN math teacher, standing in front of the whiteboard in her classroom (talk to her for
 * the assignment). Matches her portrait: very long, wavy black hair with a center part, warm brown skin, a dark navy
 * band tee.
 */
const APARICIO_NAVY = "#1c2333";
export const NPC_APARICIO: NpcDef = {
  id: "npc-aparicio",
  room: "classroom",
  classroomId: "6th-csun-math",
  x: 0, // set from the classroom's whiteboard
  z: 0,
  rotY: 0, // facing the class
  talkRange: 2.2,
  chatFirst: true,
  profile: {
    ...getDefaultProfile(),
    name: "Ms. Aparicio",
    title: "6th Grade Math Teacher",
    noHomeroom: true,
    gender: "feminine",
    look: "fem-casual",
    outfitColor: APARICIO_NAVY,
    hairStyle: "f-witch", // center part, lengthened well past the shoulders
    hairLength: 2.4,
    hairColor: "#141217",
    skinTone: "#B9805A",
    glasses: "none",
    shoes: "sneakers",
    shoeColor: "#1f1f24",
    partColors: { "Body:White": APARICIO_NAVY, "Legs:Orange": "#25272d" },
  },
  portrait: aparicioPortrait,
  // SAMPLE TEXT: replace with Ms. Aparicio's real dialogue
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Hi, welcome in! I'm Ms. Aparicio, and I teach 6th grade math here in CSUN.",
          "Your assignment is ready whenever you are. Make yourself comfortable!",
        ],
        options: [
          { label: "Show me the assignment!", action: "open-assignment" },
          { label: "What are your students learning?", next: "learn" },
          { label: "Thanks, Ms. Aparicio!", next: "bye" },
        ],
      },
      learn: {
        paragraphs: [
          "(Sample text) We're working with ratios and rates: comparing quantities in tables, tape diagrams, and real-life problems like recipes and unit prices.",
          "My students explain their thinking to a partner with math sentence frames, so everyone, especially my English learners, builds the language of math.",
        ],
        options: [
          { label: "Show me the assignment!", action: "open-assignment" },
          { label: "I have another question", next: "root" },
          { label: "Thanks, Ms. Aparicio!", next: "bye" },
        ],
      },
      bye: {
        paragraphs: ["(Sample text) Have a great day! Enjoy the rest of the classrooms."],
        options: [{ label: "See you, Ms. Aparicio!" }],
      },
    },
  },
};

/**
 * Ms. Carrera, the 7th grade IET, sitting on the blue bench between the 7th grade UCLA and LMU doors (the bench at
 * z = 20 against the west building, facing the walkway). Matches her portrait: long wavy brown hair with caramel ends
 * and a side part, fair skin, a pink tweed jacket over a black top.
 */
export const NPC_CARRERA: NpcDef = {
  id: "npc-carrera",
  room: "campus",
  x: -13.67, // the bench seat nearer the 7th UCLA door (seat x -13.45, z 19.5)
  z: 19.5,
  rotY: Math.PI / 2, // facing the walkway
  seatY: 0.4,
  y: 0.16, // the bench stands on the ankle-high ledge
  talkRange: 2.4,
  profile: {
    ...getDefaultProfile(),
    name: "Ms. Carrera",
    title: "7th Grade IET",
    noHomeroom: true,
    gender: "feminine",
    look: "fem-suit", // the jacket is her pink tweed jacket, the shirt her black top
    outfitColor: "#e8a7b4",
    hairStyle: "f-witch", // lengthened well past the shoulders
    hairLength: 2.3,
    hairColor: "#3f2617",
    hairTips: "#7d5232", // caramel toward the ends
    skinTone: "#EDC2A4",
    glasses: "none",
    shoes: "dress",
    shoeColor: "#1f1f24",
    partColors: { "Body:White": "#1c1d22", "Legs:Black": "#25272d" },
    polkaDots: { parts: ["Body:Black"], base: "#e8a7b4", dot: "#3a3036", accent: "#f7f1ef", shape: "tweed" },
  },
  portrait: carreraPortrait,
  // SAMPLE TEXT: replace with Ms. Carrera's real dialogue
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Hi there! I'm Ms. Carrera, the 7th grade IET. Just taking a quick break between classes.",
          "Have you visited the 7th grade classrooms yet? They're all right here on this walkway.",
        ],
        options: [
          { label: "What does an IET do?", next: "role" },
          { label: "Any tips for the 7th grade rooms?", next: "tips" },
          { label: "Thanks, Ms. Carrera!", next: "bye" },
        ],
      },
      role: {
        paragraphs: [
          "(Sample text) I'm an Inclusion / Education Specialist Teacher: I support our students with IEPs, co-teach with the general education teachers, and make sure every lesson is accessible.",
          "Scaffolds that help my students, like visuals, sentence frames and chunked directions, help our English learners too. Good support is good teaching for everyone!",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Ms. Carrera!", next: "bye" },
        ],
      },
      tips: {
        paragraphs: [
          "(Sample text) Look for how each teacher builds in partner talk. And watch for the small supports on the walls and whiteboards: they make a big difference!",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Ms. Carrera!", next: "bye" },
        ],
      },
      bye: {
        paragraphs: ["(Sample text) Enjoy your visits! See you around."],
        options: [{ label: "See you, Ms. Carrera!" }],
      },
    },
  },
};

/**
 * Ms. Williams, the 8th grade IET and lead IET (the most knowledgeable IET on campus), standing next to Ms. Roldan outside the Learning Center (to her right), turned a little toward her.
 * Matches her portrait: long curly hair, dark at the roots and honey blonde toward the ends, warm brown skin, an open
 * pink cardigan over a navy tee.
 */
export const NPC_WILLIAMS: NpcDef = {
  id: "npc-williams",
  room: "campus",
  x: -0.75, // beside Ms. Roldan (x -1.9, z 0.4)
  z: 0.5,
  rotY: -0.7, // facing the courtyard, turned toward Ms. Roldan
  talkRange: 1.7,
  profile: {
    ...getDefaultProfile(),
    name: "Ms. Williams",
    title: "8th Grade IET · Lead IET",
    noHomeroom: true,
    gender: "feminine",
    look: "fem-suit", // the jacket is her pink cardigan, the shirt her navy tee
    outfitColor: "#d63384",
    hairStyle: "f-witch", // long, lengthened well past the shoulders
    hairLength: 2.3,
    hairColor: "#2c1e16",
    hairTips: "#c9a46a", // honey blonde toward the ends
    skinTone: "#C08A64",
    glasses: "none",
    shoes: "sneakers",
    shoeColor: "#f0f0ee",
    partColors: { "Body:White": "#24315a", "Legs:Black": "#25272d" },
  },
  portrait: williamsPortrait,
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "Hi there, welcome! I'm Ms. Williams, the 8th grade IET and our lead IET here at Valor.",
          "Ms. Roldan and I were just talking about how we support every learner on campus. Ask me anything about inclusion and supports, and grab my handout on supporting multilingual learners with IEPs!",
        ],
        options: [
          { label: "What's in your handout?", next: "handout" },
          { label: "What does a lead IET do?", next: "lead" },
          { label: "How do supports for IEPs help English learners?", next: "overlap" },
          { label: "Any advice for supporting every learner?", next: "advice" },
          { label: "Can I have your handout?", action: "give-iep-handout" },
          { label: "Thanks, Ms. Williams!", next: "bye" },
        ],
      },
      handout: {
        paragraphs: [
          "It's called \"Both/And.\" About 1 in 6 of our multilingual learners also has an IEP, and they're entitled to BOTH: English language development AND special education services. One never replaces the other.",
          "It covers how to tell a language difference from a disability, what an English learner's IEP must include, working with interpreters, ELPAC decisions, and classroom moves that work for these students.",
        ],
        options: [
          { label: "Can I have your handout?", action: "give-iep-handout" },
          { label: "I have another question", next: "root" },
          { label: "Thanks, Ms. Williams!", next: "bye" },
        ],
      },
      lead: {
        paragraphs: [
          "Besides supporting my 8th graders with IEPs, I coach and support our IET team across every grade: planning accommodations, co-teaching models, IEP goals and progress monitoring.",
          "If a teacher has a question about a student's plan, I'm usually the first person they come to.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Can I have your handout?", action: "give-iep-handout" },
          { label: "Thanks, Ms. Williams!", next: "bye" },
        ],
      },
      overlap: {
        paragraphs: [
          "So much of what we do for students with IEPs is just good teaching for everyone: visuals, modeling, chunked directions, extra wait time, and sentence frames.",
          "Some of our students are English learners and have an IEP too. For them we plan both together, so language support and learning support work as one. And we never confuse learning a new language with a disability.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Can I have your handout?", action: "give-iep-handout" },
          { label: "Thanks, Ms. Williams!", next: "bye" },
        ],
      },
      advice: {
        paragraphs: [
          "Empathy, compassion and inclusion. Know your students, plan the supports before the lesson, and make every student feel they belong. When they feel safe, they take risks, and that's when the learning happens.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Can I have your handout?", action: "give-iep-handout" },
          { label: "Thanks, Ms. Williams!", next: "bye" },
        ],
      },
      bye: {
        paragraphs: ["Have a wonderful day! Come find me if you ever have a question about supports."],
        options: [{ label: "See you, Ms. Williams!" }],
      },
    },
  },
};

/**
 * Maria, the school custodian, on the upper walkway next to the red trash can by the elevator. She speaks mostly
 * Spanish and a little English, and she'll take your trash (the same choices as the trash can). Matches her portrait:
 * shoulder-length wavy light-brown hair, fair skin, a black jacket over a royal blue top.
 */
export const NPC_MARIA: NpcDef = {
  id: "npc-maria",
  room: "campus",
  floor: 1,
  x: -9.75, // just west of the red trash can (x -8.75, z 0.55)
  z: 0.15,
  rotY: 1.93, // facing the Theatre door (x -4, z -2 on the upper walkway)
  talkRange: 1.8,
  profile: {
    ...getDefaultProfile(),
    name: "Maria",
    title: "Custodian · Conserje",
    noHomeroom: true,
    gender: "feminine",
    look: "fem-suit", // the jacket is her black jacket, the shirt her blue top
    outfitColor: "#1c1d22",
    hairStyle: "f-witch", // shoulder length
    hairLength: 1.4,
    hairColor: "#8a6038",
    hairTips: "#a9804f",
    skinTone: "#EEC6A8",
    glasses: "none",
    shoes: "sneakers",
    shoeColor: "#1f1f24",
    partColors: { "Body:White": "#2557c9", "Legs:Black": "#25272d" },
  },
  portrait: mariaPortrait,
  // SAMPLE TEXT (mostly Spanish, a little English): replace with Maria's real words
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Texto de muestra) ¡Hola, buenos días! Soy Maria, la conserje de la escuela. Hello!",
          "Aquí cuido que todo esté limpio. ¿Tienes basura? Trash? Yo te ayudo.",
        ],
        options: [
          { label: "Sí, tengo basura / I have trash", action: "trash-dialog" },
          { label: "¿Qué hace una conserje?", next: "role" },
          { label: "¡Gracias, Maria!", next: "bye" },
        ],
      },
      role: {
        paragraphs: [
          "(Texto de muestra) Limpio los salones, los baños y el campus, y arreglo cositas. Todos los días, temprano, temprano.",
          "Un poquito English: clean school, happy students! Si ves un problema, me avisas, ¿sí?",
        ],
        options: [
          { label: "Sí, tengo basura / I have trash", action: "trash-dialog" },
          { label: "Tengo otra pregunta", next: "root" },
          { label: "¡Gracias, Maria!", next: "bye" },
        ],
      },
      bye: {
        paragraphs: ["(Texto de muestra) ¡De nada, mijo! Have a nice day. ¡Que te vaya bien!"],
        options: [{ label: "¡Adiós, Maria! Bye!" }],
      },
    },
  },
};

/**
 * Ms. Quintana, the school psychologist, sitting outside the 8th grade classrooms on the blue bench nearest the 8th
 * grade LMU door (bench at x = 25.9 against the north building, facing the walkway). Matches her portrait: long,
 * voluminous curly black hair, light-medium skin, a navy pinstripe button-up shirt.
 */
const QUINTANA_NAVY = "#1f2740";
export const NPC_QUINTANA: NpcDef = {
  id: "npc-quintana",
  room: "campus",
  x: 26.4, // the bench seat nearer the 8th LMU door (seat x 26.4, z -1.45)
  z: -1.67,
  rotY: 0, // facing the walkway and the field
  seatY: 0.4,
  talkRange: 2.4,
  profile: {
    ...getDefaultProfile(),
    name: "Ms. Quintana",
    title: "School Psychologist",
    noHomeroom: true,
    gender: "feminine",
    look: "fem-suit", // jacket + shirt printed as one pinstripe button-up
    outfitColor: QUINTANA_NAVY,
    hairStyle: "f-long", // shoulder length, center part (same as Castaneda)
    extraHair: "curls", // soft waves (same as Castaneda)
    hairColor: "#121116", // keep black
    skinTone: "#E6B898",
    glasses: "none",
    shoes: "dress",
    shoeColor: "#1f1f24",
    partColors: { "Body:White": QUINTANA_NAVY, "Legs:Black": "#25272d" },
    polkaDots: { parts: ["Body:Black", "Body:White"], base: QUINTANA_NAVY, dot: "#6b7799", shape: "stripes" },
  },
  portrait: quintanaPortrait,
  // SAMPLE TEXT: replace with Ms. Quintana's real dialogue
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Hi there! I'm Ms. Quintana, the school psychologist. Have a seat if you'd like!",
          "I'm just catching my breath between student meetings. How's your PD day going?",
        ],
        options: [
          { label: "What does a school psychologist do?", next: "role" },
          { label: "How do you work with English learners?", next: "mll" },
          { label: "Any tip for supporting students' well-being?", next: "tip" },
          { label: "Thanks, Ms. Quintana!", next: "bye" },
        ],
      },
      role: {
        paragraphs: [
          "(Sample text) I support students' learning and mental health: assessments for special education, counseling, crisis support, and working with teachers and families on plans that help students succeed.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Ms. Quintana!", next: "bye" },
        ],
      },
      mll: {
        paragraphs: [
          "(Sample text) Carefully! When an English learner is struggling, the first question is whether it's language, learning, or something else, like trauma or adjusting to a new country.",
          "I look at progress in both languages, use interpreters with families, and choose assessments that are fair for students learning English. Learning a new language is never a disability.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Ms. Quintana!", next: "bye" },
        ],
      },
      tip: {
        paragraphs: [
          "(Sample text) Connection first. A warm greeting at the door, knowing each student's name and story, and a calm, predictable classroom go a long way, especially for newcomers who have been through big changes.",
        ],
        options: [
          { label: "I have another question", next: "root" },
          { label: "Thanks, Ms. Quintana!", next: "bye" },
        ],
      },
      bye: {
        paragraphs: ["(Sample text) Take care of yourself today too! See you around."],
        options: [{ label: "See you, Ms. Quintana!" }],
      },
    },
  },
};

/**
 * Nelly, a custodian like Maria, inside the MPR standing next to the storage room door (the door is at x 408.4 on the
 * back wall, z 388.12). She only speaks Spanish, and she'll take your trash like Maria. Matches her portrait: wavy
 * black hair swept back to below the shoulders, warm light-medium skin, a purple floral blouse with a black tie.
 */
export const NPC_NELLY: NpcDef = {
  id: "npc-nelly",
  room: "mpr",
  x: 406.35, // just west of the storage door, against the back wall
  z: 388.85,
  rotY: -0.3, // facing Mr. Van Diest at the front of the MPR (x 400, z 409.3)
  talkRange: 1.4, // short, so E in front of the storage door still opens the storage room
  profile: {
    ...getDefaultProfile(),
    name: "Nelly",
    title: "Conserje",
    noHomeroom: true,
    gender: "feminine",
    look: "fem-casual",
    outfitColor: "#8b6cc4",
    hairStyle: "f-witch",
    hairLength: 1.6,
    hairColor: "#15131a",
    skinTone: "#DDA984",
    glasses: "none",
    shoes: "sneakers",
    shoeColor: "#1f1f24",
    partColors: { "Legs:Orange": "#25272d" },
    polkaDots: { parts: ["Body:White"], base: "#8b6cc4", dot: "#f3ead8", accent: "#2b2440", shape: "dots" },
  },
  portrait: nellyPortrait,
  // SAMPLE TEXT (Spanish only): replace with Nelly's real words
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Texto de muestra) ¡Hola, buenos días! Soy Nelly, la conserje del MPR.",
          "Aquí mantengo todo limpio y ordenado para el día de hoy. ¿Necesitas algo? ¿Tienes basura?",
        ],
        options: [
          { label: "Sí, tengo basura", action: "trash-dialog" },
          { label: "¿Qué hay en el cuarto de almacén?", next: "storage" },
          { label: "¿Qué hace una conserje?", next: "role" },
          { label: "¡Gracias, Nelly!", next: "bye" },
        ],
      },
      storage: {
        paragraphs: [
          "(Texto de muestra) ¡Muchas cosas! Lápices, carpetas, papel y estuches para lápices de todos los colores. Toca la puerta del almacén si necesitas un estuche.",
          "Y las mochilas están en la pared, cerca de la entrada del MPR.",
        ],
        options: [
          { label: "Tengo otra pregunta", next: "root" },
          { label: "¡Gracias, Nelly!", next: "bye" },
        ],
      },
      role: {
        paragraphs: [
          "(Texto de muestra) Limpio el MPR, pongo las mesas y las sillas para los eventos, y ayudo a Maria con todo el campus. Un lugar limpio ayuda a los estudiantes a aprender.",
        ],
        options: [
          { label: "Tengo otra pregunta", next: "root" },
          { label: "¡Gracias, Nelly!", next: "bye" },
        ],
      },
      bye: {
        paragraphs: ["(Texto de muestra) ¡De nada! ¡Que tengas un bonito día!"],
        options: [{ label: "¡Adiós, Nelly!" }],
      },
    },
  },
};

/**
 * Mrs. Carmona, the ELD Director, in the ELD classroom (upstairs, office building) in front of the whiteboard. She
 * collects the 16 assignments (eldTurnIn.ts; her conversation is opened by scene.ts because it depends on progress).
 * TODO: her look is a placeholder until we have her photo.
 */
export const NPC_CARMONA: NpcDef = {
  id: "npc-carmona",
  room: "classroom",
  classroomId: "eld",
  x: 0, // set from the classroom's whiteboard
  z: 0,
  rotY: 0,
  talkRange: 2.4,
  chatFirst: true,
  profile: {
    ...getDefaultProfile(),
    name: "Mrs. Carmona",
    title: "ELD Director",
    noHomeroom: true,
    gender: "feminine",
    look: "fem-suit",
    outfitColor: "#7f1d1d",
    hairStyle: "f-witch",
    hairLength: 1.6,
    hairColor: "#2a1d16",
    skinTone: "#D9A47E",
    glasses: "none",
    shoes: "dress",
    shoeColor: "#1f1f24",
  },
  dialog: { start: "root", nodes: { root: { paragraphs: [""], options: [] } } }, // replaced at run time (eldTurnIn.ts)
};

export const NPCS: NpcDef[] = [NPC_VAN_DIEST, NPC_PRINCIPAL, NPC_KURISU, NPC_BLESSING, NPC_MORRIS, NPC_ASHI, NPC_NAVARRO, NPC_DANI, NPC_IPENA, NPC_CASTANEDA, NPC_TUNSON, NPC_STAUFFER, NPC_ROLDAN, NPC_GUERRERO, NPC_NAYFELD, NPC_SOMOZA, NPC_WEBER, NPC_DOMINGUEZ, NPC_LARK, NPC_GILLETT, NPC_NORORI, NPC_RAMIREZ, NPC_MARTINEZ, NPC_TRAE, NPC_BAKOO, NPC_GETIS, NPC_MARTINEZ_CS, NPC_DELMA, NPC_RAQUEL, NPC_APARICIO, NPC_CARRERA, NPC_WILLIAMS, NPC_MARIA, NPC_QUINTANA, NPC_NELLY, NPC_CARMONA];

// ---------------------------------------------------------------------------------------------------------------
// Generic PD attendees: teachers seated at the MPR tables (wearing their homeroom colors), with a short chat.
// Seats: west-side chairs face east (+x), east-side chairs face west (-x); x/z is the seated spot (8 cm back from the
// chair's centre, like the player). See mpr.ts for the table positions.
// ---------------------------------------------------------------------------------------------------------------
type Attendee = {
  id: string;
  title: string;
  homeroom: CharacterProfile["homeroom"];
  /** table centre and chair: side -1 = west chair (faces +x), 1 = east chair (faces -x); dz = chair offset along the table */
  table: [number, number];
  side: -1 | 1;
  dz: number;
  look: Partial<CharacterProfile>;
  lines: string[];
};

const ATTENDEES: Attendee[] = [
  {
    id: "npc-attendee-1", title: "6th Grade Teacher", homeroom: "CSUN", table: [400, 400], side: -1, dz: -0.6,
    look: { gender: "feminine", look: "fem-casual", hairStyle: "f-wavy", hairColor: "#2b1b12", skinTone: "#C68E5E", glasses: "round", glassesColor: "#3b2a1e", shoes: "sneakers" },
    lines: ["(Sample text) Hi! I'm saving this seat for my co-teacher. Have you visited any classrooms yet?", "I heard the sentence frames in the 7th grade rooms are great for academic talk."],
  },
  {
    id: "npc-attendee-2", title: "7th Grade Teacher", homeroom: "LMU", table: [400, 400], side: 1, dz: 1.8,
    look: { gender: "masculine", look: "masc-tee", hairStyle: "m-suit", hairColor: "#141414", skinTone: "#7A4A2E", facialHair: "goatee", shoes: "sneakers" },
    lines: ["(Sample text) Morning! I'm just finishing my notes from the welcome.", "Tip: your student agenda keeps track of every assignment you still need."],
  },
  {
    id: "npc-attendee-3", title: "5th Grade Teacher", homeroom: "UCLA", table: [405.5, 405], side: 1, dz: -0.6,
    look: { gender: "feminine", look: "fem-suit", hairStyle: "f-long", hairColor: "#141414", skinTone: "#EBC7A4", shoes: "dress", shoeColor: "#1f1f24" },
    lines: ["(Sample text) Hello! This is my favorite PD day of the year.", "I'm trying a few of these strategies with my newcomers next week."],
  },
  {
    id: "npc-attendee-4", title: "8th Grade Teacher", homeroom: "USC", table: [405.5, 405], side: -1, dz: 0.6,
    look: { gender: "masculine", look: "masc-hoodie", hairStyle: "m-explorer", hairColor: "#6b4a2b", skinTone: "#F1C9A5", facialHair: "beard", glasses: "rect", glassesColor: "#1f1f24", shoes: "work" },
    lines: ["(Sample text) Hey there. Grab a backpack by the doors if you haven't yet: you'll want somewhere to keep your things.", "See you out in the classrooms!"],
  },
  {
    id: "npc-attendee-5", title: "Instructional Coach", homeroom: "LMU", table: [394.5, 405], side: -1, dz: 1.8,
    look: { gender: "feminine", look: "fem-dress", hairStyle: "f-cadet", hairColor: "#1c1410", skinTone: "#A86B45", shoes: "sneakers" },
    lines: ["(Sample text) Hi! I'm one of the coaches today. Let me know if you have any questions.", "The map (press M) shows which classrooms still have an assignment."],
  },
  {
    id: "npc-attendee-6", title: "6th Grade Teacher", homeroom: "CSUN", table: [405.5, 395], side: -1, dz: -1.8,
    look: { gender: "masculine", look: "masc-tee", hairStyle: "m-beach", hairColor: "#2b1b12", skinTone: "#B07A52", facialHair: "moustache", shoes: "sneakers" },
    lines: ["(Sample text) Hey! First time at Valor's PD? You'll love it.", "Don't forget to fill your water bottle at the fountain. It's a long day!"],
  },
];

export const ATTENDEE_NPCS: NpcDef[] = ATTENDEES.map((a) => {
  const chairX = a.table[0] + a.side * 1.05;
  const facing = a.side === -1 ? Math.PI / 2 : -Math.PI / 2;
  return {
    id: a.id,
    room: "mpr",
    x: chairX - Math.sin(facing) * 0.08,
    z: a.table[1] + a.dz,
    rotY: facing,
    seatY: 0.44,
    talkRange: 2.2,
    noNameTag: true,
    profile: {
      ...getDefaultProfile(),
      // unnamed: the dialogue shows the role ("6th Grade Teacher") with "PD Participant" under it
      name: a.title,
      title: "PD Participant",
      homeroom: a.homeroom,
      outfitColor: "",
      ...a.look,
    },
    dialog: {
      start: "root",
      nodes: {
        root: { paragraphs: a.lines, options: [{ label: "Nice to meet you!" }] },
      },
    },
  } as NpcDef;
});

NPCS.push(...ATTENDEE_NPCS);
