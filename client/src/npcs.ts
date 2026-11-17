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
import droriPortrait from "./assets/drori_portrait.png";

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
  /** Sitting (on a bench or chair) with the seat at this height; x/z/rotY are then the seated position */
  seatY?: number;
  /** Classroom teacher: show the dialogue first (an option with action "open-assignment" hands out the assignment) */
  chatFirst?: boolean;
  /** No floating name tag above the head (generic, unnamed characters) */
  noNameTag?: boolean;
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
  x: -1.3, // moved diagonally toward the elevator (in front of the Learning Center / Theater, x = -6.8)
  z: 6.8,
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
    outfitColor: "#c2a57c", // tan jacket
    hairStyle: "f-witch", // long and straight, center part
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
          "Inside, talk to the teacher or read the whiteboard to get the assignment. When you finish them all, take your work to Mr. Van Diest at the ELD classroom upstairs.",
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
  x: 18.6, // in front of the 8th UCLA door (x = 18, wall z = -2), halfway to the field (its edge is at z = 10.5)
  z: 5.2,
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
  x: -12.5, // the MPR doors are at x = -14, z 50.5 .. 52.5; the stairs start at z = 46.5
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
 * Mr. Drori, the 8th grade USC science teacher, standing in front of the whiteboard in his classroom (talk to him for
 * the assignment). Teaches mostly space science. Dry, very smart, sarcastic, and he speaks in memes. Matches his portrait: short
 * dark crew cut, a reddish-brown goatee and moustache, fair skin, a navy varsity jacket with gray sleeves over a
 * light gray button-up jersey.
 */
const DRORI_NAVY = "#27306a";
const DRORI_JERSEY = "#c9c9d6";
export const NPC_DRORI: NpcDef = {
  id: "npc-drori",
  room: "classroom",
  classroomId: "8th-usc-science",
  x: 0, // set from the classroom's whiteboard
  z: 0,
  rotY: 0, // facing the class
  talkRange: 2.2,
  chatFirst: true,
  profile: {
    ...getDefaultProfile(),
    name: "Mr. Drori",
    title: "8th Grade Science Teacher",
    noHomeroom: true,
    gender: "masculine",
    look: "masc-suit", // the jacket is his varsity jacket, the shirt his jersey
    outfitColor: DRORI_NAVY,
    noHair: true,
    extraHair: "buzz", // short crew cut
    hairColor: "#4a2c1a",
    facialHair: "van-dyke", // moustache and goatee, clean cheeks
    skinTone: "#EDBE9C",
    glasses: "none",
    shoes: "sneakers",
    shoeColor: "#1f1f24",
    partColors: { White: DRORI_JERSEY, Tie: DRORI_JERSEY, "Legs:Suit": "#2a2f3a" },
    polkaDots: { parts: ["Body:Suit"], base: DRORI_NAVY, dot: "#a9adb6", shape: "sleeves" },
  },
  portrait: droriPortrait,
  // SAMPLE TEXT: replace with Mr. Drori's real dialogue
  dialog: {
    start: "root",
    nodes: {
      root: {
        paragraphs: [
          "(Sample text) Hi, I'm Mr. Drori. I teach 8th grade science here in USC, mostly space. Yes, the whole universe. No, it doesn't fit in one unit.",
          "Your assignment's ready whenever you are. Take your time; the universe has been waiting 13.8 billion years.",
        ],
        options: [
          { label: "Show me the assignment!", action: "open-assignment" },
          { label: "What are your students learning?", next: "learn" },
          { label: "Thanks, Mr. Drori!", next: "bye" },
        ],
      },
      learn: {
        paragraphs: [
          "(Sample text) The scale of the solar system. If the sun were a basketball, Earth would be a peppercorn about 26 meters away. My students' reaction: \u201Cwait, that's ILLEGAL.\u201D",
          "Then gravity and orbits. They compare real NASA data and defend their claims with sentence frames, like tiny astrophysicists with very strong opinions about Pluto.",
        ],
        options: [
          { label: "Show me the assignment!", action: "open-assignment" },
          { label: "I have another question", next: "root" },
          { label: "Thanks, Mr. Drori!", next: "bye" },
        ],
      },
      bye: {
        paragraphs: ["(Sample text) To infinity and... well, the next classroom. Good luck out there. \uD83D\uDE80"],
        options: [{ label: "See you, Mr. Drori!" }],
      },
    },
  },
};

export const NPCS: NpcDef[] = [NPC_VAN_DIEST, NPC_PRINCIPAL, NPC_KURISU, NPC_BLESSING, NPC_MORRIS, NPC_ASHI, NPC_NAVARRO, NPC_DANI, NPC_IPENA, NPC_CASTANEDA, NPC_TUNSON, NPC_STAUFFER, NPC_ROLDAN, NPC_GUERRERO, NPC_NAYFELD, NPC_SOMOZA, NPC_DRORI];

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
