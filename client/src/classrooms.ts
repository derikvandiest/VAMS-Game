import * as THREE from "three";
import type { Solid, ChairSlot } from "./mpr";
import classroomsData from "../../content/classrooms.json";
import layoutData from "../../content/layout.json";

export interface ClassroomData {
  id: string;
  label: string;
  shortLabel: string;
  type: string;
  grade?: number;
  homeroom?: "CSUN" | "LMU" | "UCLA" | "USC";
  subject?: string;
  roomNumber?: string;
  npcId?: string;
  topicTitle?: string;
}

export interface ClassroomInstance {
  id: string;
  data: ClassroomData;
  group: THREE.Group;
  solids: Solid[];
  chairs: ChairSlot[];
  worldX: number;
  worldZ: number;
  size: number;
  height: number;
  spawnX: number;
  spawnZ: number;
  exitDoorX: number;
  exitDoorZ: number;
  /** The front whiteboard (where the assignment is read): centre x, wall z and width */
  whiteboard: { x: number; z: number; w: number };
  /** The black laptop cart (Chromebooks to borrow while in this room): where to stand to use it */
  laptopCart: { x: number; z: number };
  campusDoor: {
    id: string;
    x: number;
    z: number;
    floor: number;
    axis: "x" | "z";
  };
}

export const CLASSROOM_SIZE = 12.0; // 12m x 12m square classroom
export const CLASSROOM_HEIGHT = 4.0; // 4.0m ceiling height
const BASE_X = 600.0;
const BASE_Z = 600.0;
const SPACING = 40.0;

// Cached instances
const instances = new Map<string, ClassroomInstance>();

// Color themes
export const COLLEGE_COLORS = {
  CSUN: {
    primary: 0xd97706, // Sunflower gold
    secondary: 0xfef08a,
    bannerBg: "#ca8a04",
    bannerText: "#ffffff",
    motto: "CSUN MATADORS",
  },
  LMU: {
    primary: 0x15803d, // Emerald green
    secondary: 0xbbf7d0,
    bannerBg: "#166534",
    bannerText: "#ffffff",
    motto: "LMU LIONS",
  },
  UCLA: {
    primary: 0x1d4ed8, // Bruin blue
    secondary: 0xfde047,
    bannerBg: "#1e40af",
    bannerText: "#facc15",
    motto: "UCLA BRUINS",
  },
  USC: {
    primary: 0x991b1b, // Cardinal red
    secondary: 0xfef08a,
    bannerBg: "#7f1d1d",
    bannerText: "#fbbf24",
    motto: "USC TROJANS",
  },
};

const SPECIAL_THEMES: Record<string, { primary: number; secondary: number; bannerBg: string; bannerText: string; motto: string }> = {
  eld: {
    primary: 0xc2410c, // Warm terracotta
    secondary: 0xfed7aa,
    bannerBg: "#9a3412",
    bannerText: "#fef3c7",
    motto: "WELCOME TO ELD - MR. VAN DIEST",
  },
  music: {
    primary: 0x4338ca, // Deep indigo
    secondary: 0xc7d2fe,
    bannerBg: "#3730a3",
    bannerText: "#e0e7ff",
    motto: "VALOR MUSIC ACADEMY",
  },
  "learning-center": {
    primary: 0x0f766e, // Calming teal
    secondary: 0x99f6e4,
    bannerBg: "#115e59",
    bannerText: "#f0fdfa",
    motto: "STUDENT LEARNING CENTER",
  },
  theater: {
    primary: 0x881337, // Dramatic velvet crimson
    secondary: 0xfecdd3,
    bannerBg: "#4c0519",
    bannerText: "#fef08a",
    motto: "VALOR DRAMA & THEATER",
  },
};

/**
 * Returns the door definition from layout.json for the given single classroom.
 */
function getCampusDoor(roomId: string) {
  const doors = (layoutData as any).doors as Array<{
    id: string;
    x: number;
    z: number;
    floor: number;
    axis: "x" | "z";
  }>;
  return doors.find((d) => d.id === roomId) || null;
}

/**
 * Creates high-resolution whiteboard texture unique to each classroom.
 */
function makeWhiteboardTexture(room: ClassroomData): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;

  // Smooth whiteboard enamel background with light gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, "#f8fafc");
  grad.addColorStop(1, "#f1f5f9");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2048, 1024);

  // Outer frame edge
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, 2034, 1010);

  // Top header banner
  let headerColor = "#1e293b";
  let bannerText = room.label.toUpperCase();
  if (room.homeroom && COLLEGE_COLORS[room.homeroom]) {
    headerColor = COLLEGE_COLORS[room.homeroom].bannerBg;
  } else if (SPECIAL_THEMES[room.id]) {
    headerColor = SPECIAL_THEMES[room.id].bannerBg;
  }

  ctx.fillStyle = headerColor;
  ctx.fillRect(20, 20, 2008, 140);

  ctx.font = "bold 64px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(bannerText, 60, 90);

  // Date and Period on right side of banner
  ctx.font = "bold 38px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "right";
  ctx.fillStyle = "#facc15";
  ctx.fillText("OCTOBER 2026 · PERIOD 3", 1980, 90);

  // Left Section: Objectives & Standard (x: 60..1000)
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 44px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("TODAY'S OBJECTIVE (SWBAT):", 60, 230);

  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(60, 255);
  ctx.lineTo(950, 255);
  ctx.stroke();

  ctx.font = "36px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#1e293b";

  if (room.subject === "Math") {
    ctx.fillText("• Graph linear equations in slope-intercept form (y = mx + b)", 60, 310);
    ctx.fillText("• Identify slope (m = rise/run) and y-intercept (0, b)", 60, 370);
    ctx.fillText("• Practice Problem Set #4 with your collaborative partner", 60, 430);

    // Coordinate grid diagram
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 3;
    const cx = 550;
    const cy = 720;
    ctx.strokeRect(cx - 200, cy - 180, 400, 360);
    // Axes
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx - 200, cy); ctx.lineTo(cx + 200, cy); // x-axis
    ctx.moveTo(cx, cy - 180); ctx.lineTo(cx, cy + 180); // y-axis
    ctx.stroke();
    // Line y = 0.5x + 20
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx - 160, cy + 80);
    ctx.lineTo(cx + 160, cy - 80);
    ctx.stroke();
    ctx.font = "bold 32px system-ui";
    ctx.fillStyle = "#ef4444";
    ctx.fillText("y = ½x + 2", cx + 50, cy - 90);
  } else if (room.subject === "Science") {
    ctx.fillText("• Model the phases of cellular respiration and photosynthesis", 60, 310);
    ctx.fillText("• Safely conduct chemical reaction observations at lab sinks", 60, 370);
    ctx.fillText("• Record temperature & mass change in lab journals", 60, 430);

    // Chemical equation box
    ctx.fillStyle = "#eff6ff";
    ctx.fillRect(60, 500, 880, 150);
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 3;
    ctx.strokeRect(60, 500, 880, 150);
    ctx.font = "bold 40px 'Courier New', monospace";
    ctx.fillStyle = "#1d4ed8";
    ctx.fillText("6CO₂ + 6H₂O + light ➔ C₆H₁₂O₆ + 6O₂", 90, 585);

    ctx.font = "32px system-ui";
    ctx.fillStyle = "#059669";
    ctx.fillText("Photosynthesis (Sunlight energy stored as glucose)", 90, 625);
  } else if (room.subject === "English") {
    ctx.fillText("• Analyze how authors develop character perspective over time", 60, 310);
    ctx.fillText("• Cite strong textual evidence using MLA in-text citations", 60, 370);
    ctx.fillText("• Socratic Seminar: Chapter 7 discussion & claim formulation", 60, 430);

    // Plot diagram
    ctx.strokeStyle = "#8b5cf6";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(80, 850);
    ctx.lineTo(280, 800); // Exposition
    ctx.lineTo(520, 620); // Climax
    ctx.lineTo(760, 820); // Falling action
    ctx.lineTo(920, 850); // Resolution
    ctx.stroke();
    ctx.font = "bold 30px system-ui";
    ctx.fillStyle = "#6d28d9";
    ctx.fillText("Climax", 480, 590);
    ctx.fillText("Exposition", 80, 880);
    ctx.fillText("Resolution", 780, 880);
  } else if (room.subject === "History" || room.subject === "Humanities") {
    ctx.fillText("• Investigate the causes of the American Constitutional Convention", 60, 310);
    ctx.fillText("• Compare the Virginia Plan vs. New Jersey Plan compromises", 60, 370);
    ctx.fillText("• Primary Source Analysis: Federalist No. 10 & 51 excerpts", 60, 430);

    // Timeline graphic
    ctx.strokeStyle = "#b45309";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(80, 720); ctx.lineTo(920, 720);
    ctx.stroke();
    const dates = [
      { year: "1776", text: "Dec. of Indep." },
      { year: "1781", text: "Articles of Conf." },
      { year: "1787", text: "Constitution" },
      { year: "1791", text: "Bill of Rights" },
    ];
    dates.forEach((d, i) => {
      const dx = 120 + i * 250;
      ctx.fillStyle = "#b45309";
      ctx.beginPath(); ctx.arc(dx, 720, 12, 0, Math.PI * 2); ctx.fill();
      ctx.font = "bold 32px system-ui";
      ctx.fillText(d.year, dx - 35, 690);
      ctx.font = "24px system-ui";
      ctx.fillText(d.text, dx - 55, 765);
    });
  } else if (room.id === "eld") {
    ctx.fillText("• Welcome! Practice academic language discussion protocols", 60, 310);
    ctx.fillText("• Sentence Frames: 'Based on my analysis, I argue that...'", 60, 370);
    ctx.fillText("• PD Participant Goal: Complete all 16 classroom PD stamps!", 60, 430);

    // Multi-lingual welcome banner
    ctx.fillStyle = "#fff7ed";
    ctx.fillRect(60, 520, 880, 380);
    ctx.strokeStyle = "#ea580c";
    ctx.lineWidth = 4;
    ctx.strokeRect(60, 520, 880, 380);
    ctx.font = "bold 38px system-ui";
    ctx.fillStyle = "#c2410c";
    ctx.fillText("ACADEMIC LANGUAGE SCAFFOLDS", 100, 575);
    ctx.font = "32px system-ui";
    ctx.fillStyle = "#1e293b";
    ctx.fillText("1. Agreement: 'I agree with [Name] because...'", 100, 640);
    ctx.fillText("2. Clarification: 'Could you elaborate on why...?'", 100, 700);
    ctx.fillText("3. Evidence: 'The data indicates that...'", 100, 760);
    ctx.fillText("4. Synthesis: 'In conclusion, both sources show...'", 100, 820);
  } else if (room.id === "music") {
    ctx.fillText("• Warm up: Vocal & breath control exercises at tempo 84 BPM", 60, 310);
    ctx.fillText("• Rehearse Spring Concert Suite - Measures 24 through 68", 60, 370);
    ctx.fillText("• Sight-reading rhythm syncopation in 4/4 and 6/8 meter", 60, 430);

    // Musical stave
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 3;
    for (let l = 0; l < 5; l++) {
      ctx.beginPath();
      ctx.moveTo(80, 620 + l * 28);
      ctx.lineTo(920, 620 + l * 28);
      ctx.stroke();
    }
    ctx.font = "bold 96px serif";
    ctx.fillStyle = "#1e293b";
    ctx.fillText("𝄞", 90, 715); // Treble clef
    ctx.font = "bold 48px system-ui";
    ctx.fillText("𝄢  𝅘𝅥  𝅘𝅥  𝅘𝅥  𝅘𝅥   |   𝅘𝅥𝅯  𝅘𝅥𝅯  𝅘𝅥", 250, 700);
  } else if (room.id === "theater") {
    ctx.fillText("• Physical theater warmup & diaphragmatic voice projection", 60, 310);
    ctx.fillText("• Act II, Scene 1 Blocking: Stage Left to Center Stage focus", 60, 370);
    ctx.fillText("• Character motivation & subtext monologue rehearsals", 60, 430);

    ctx.fillStyle = "#fdf2f8";
    ctx.fillRect(60, 520, 880, 380);
    ctx.strokeStyle = "#be185d";
    ctx.lineWidth = 4;
    ctx.strokeRect(60, 520, 880, 380);
    ctx.font = "bold 38px system-ui";
    ctx.fillStyle = "#9d174d";
    ctx.fillText("STAGE BLOCKING MAP", 100, 575);
    ctx.font = "bold 32px system-ui";
    ctx.fillStyle = "#374151";
    ctx.fillText("UPSTAGE RIGHT       UPSTAGE CENTER       UPSTAGE LEFT", 100, 650);
    ctx.fillText("STAGE RIGHT               CENTER STAGE           STAGE LEFT", 100, 720);
    ctx.fillText("DOWNSTAGE RIGHT   DOWNSTAGE CENTER   DOWNSTAGE LEFT", 100, 790);
    ctx.fillStyle = "#be185d";
    ctx.fillText("                     ▼ AUDIENCE / HOUSE ▼", 100, 860);
  } else {
    // Learning Center
    ctx.fillText("• Executive Functioning: Weekly assignment planner check-in", 60, 310);
    ctx.fillText("• Focused study blocks: 25-minute Pomodoro intervals", 60, 370);
    ctx.fillText("• Small-group tutoring: Math review & reading comprehension", 60, 430);

    ctx.fillStyle = "#f0fdfa";
    ctx.fillRect(60, 520, 880, 380);
    ctx.strokeStyle = "#0d9488";
    ctx.lineWidth = 4;
    ctx.strokeRect(60, 520, 880, 380);
    ctx.font = "bold 38px system-ui";
    ctx.fillStyle = "#0f766e";
    ctx.fillText("WEEKLY SUCCESS TRACKER", 100, 580);
    ctx.font = "30px system-ui";
    ctx.fillStyle = "#1e293b";
    ctx.fillText("☑ Math homework check & corrections complete", 100, 650);
    ctx.fillText("☑ Science lab review packet turned in", 100, 715);
    ctx.fillText("☑ English reading log: 45 min reading logged", 100, 780);
    ctx.fillText("☑ Binder organization: All subjects sorted", 100, 845);
  }

  // Right Section: Agenda, Homework, Homeroom Pride (x: 1040..2000)
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 44px system-ui, -apple-system, sans-serif";
  ctx.fillText("AGENDA & ASSIGNMENTS:", 1040, 230);

  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(1040, 255);
  ctx.lineTo(1980, 255);
  ctx.stroke();

  ctx.font = "34px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#1e293b";
  ctx.fillText("1. Do Now / Warm-up Reflection (5 min)", 1040, 310);
  ctx.fillText("2. Direct Instruction & Concept Modeling (15 min)", 1040, 370);
  ctx.fillText("3. Collaborative Small-Group Application (20 min)", 1040, 430);
  ctx.fillText("4. Individual Exit Ticket & Stamp Check (10 min)", 1040, 490);

  // Homework box
  ctx.fillStyle = "#fef3c7";
  ctx.fillRect(1040, 560, 940, 160);
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 4;
  ctx.strokeRect(1040, 560, 940, 160);

  ctx.font = "bold 36px system-ui";
  ctx.fillStyle = "#b45309";
  ctx.fillText("TONIGHT'S HOMEWORK:", 1070, 615);
  ctx.font = "30px system-ui";
  ctx.fillStyle = "#1e293b";
  ctx.fillText("• Complete Study Guide Section B (Due Tomorrow)", 1070, 665);

  // College / Motto Pride Footer
  let mottoText = "VALOR ACADEMY MIDDLE SCHOOL";
  if (room.homeroom && COLLEGE_COLORS[room.homeroom]) {
    mottoText = COLLEGE_COLORS[room.homeroom].motto;
  } else if (SPECIAL_THEMES[room.id]) {
    mottoText = SPECIAL_THEMES[room.id].motto;
  }
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(1040, 770, 940, 130);
  ctx.font = "bold 42px system-ui";
  ctx.fillStyle = "#facc15";
  ctx.textAlign = "center";
  ctx.fillText(mottoText, 1510, 845);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Creates custom white and light yellow checkered floor texture for all classrooms.
 */
function makeClassroomFloorTexture(_room: ClassroomData): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;

  // 8x8 tiles per canvas repeat unit
  const numTiles = 8;
  const ts = 1024 / numTiles; // 128px per tile

  const whiteColor = "#ffffff";
  const lightYellowColor = "#fef9c3"; // Warm light yellow / pastel lemon cream
  const groutColor = "#e2e8f0";

  for (let row = 0; row < numTiles; row++) {
    for (let col = 0; col < numTiles; col++) {
      const isYellow = (row + col) % 2 === 1;
      const x = col * ts;
      const y = row * ts;

      // Base tile color
      ctx.fillStyle = isYellow ? lightYellowColor : whiteColor;
      ctx.fillRect(x, y, ts, ts);

      // Subtle tile surface sheen / border shading
      const grad = ctx.createLinearGradient(x, y, x + ts, y + ts);
      grad.addColorStop(0, "rgba(255, 255, 255, 0.45)");
      grad.addColorStop(0.5, "rgba(255, 255, 255, 0)");
      grad.addColorStop(1, isYellow ? "rgba(234, 179, 8, 0.12)" : "rgba(148, 163, 184, 0.10)");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, ts, ts);

      // Fine grout border
      ctx.strokeStyle = groutColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 0.5, y + 0.5, ts - 1, ts - 1);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3); // 24x24 tiles across the 12m classroom (0.5m per tile)
  return tex;
}

/**
 * Creates custom illuminated EXIT sign texture.
 */
function makeExitSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, 0, 512, 256);

  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 12;
  ctx.strokeRect(12, 12, 488, 232);

  ctx.font = "bold 130px Arial, sans-serif";
  ctx.fillStyle = "#22c55e";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("EXIT", 256, 128);

  return new THREE.CanvasTexture(canvas);
}

/**
 * Creates college pennant texture for wall decor.
 */
function makePennantTexture(college: string, motto: string, bg: string, fg: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 384;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, 1024, 384);

  // Triangular pennant shape
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(20, 20);
  ctx.lineTo(1000, 192);
  ctx.lineTo(20, 364);
  ctx.closePath();
  ctx.fill();

  // White border
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 10;
  ctx.stroke();

  // Inner border
  ctx.strokeStyle = fg;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(36, 40);
  ctx.lineTo(950, 192);
  ctx.lineTo(36, 344);
  ctx.closePath();
  ctx.stroke();

  // Text
  ctx.font = "900 80px system-ui, Arial Black";
  ctx.fillStyle = fg;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(college, 120, 170);

  ctx.font = "bold 40px system-ui";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(motto, 125, 235);

  return new THREE.CanvasTexture(canvas);
}

// ---------------------------------------------------------------------------
// CACHED ASSETS: PROCEDURAL BLUE TENNIS BALLS, NET DRAWERS & TRIANGULAR FURNITURE
// ---------------------------------------------------------------------------

let cachedTennisBallTex: THREE.CanvasTexture | null = null;
/**
 * Creates authentic procedural blue tennis ball texture with felt fibers and white curved seam.
 */
function getTennisBallTexture(): THREE.CanvasTexture {
  if (cachedTennisBallTex) return cachedTennisBallTex;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;

  // 1) Vibrant royal felt blue base
  ctx.fillStyle = "#2563eb";
  ctx.fillRect(0, 0, 256, 128);

  // 2) Subtle felt fiber noise
  for (let i = 0; i < 1500; i++) {
    const rx = Math.random() * 256;
    const ry = Math.random() * 128;
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(59, 130, 246, 0.4)" : "rgba(29, 78, 216, 0.4)";
    ctx.fillRect(rx, ry, 1.5, 1.5);
  }

  // 3) Exact spherical tennis ball curve: x(t) = a*cos(t)+b*cos(3t), y(t) = a*sin(t)-b*sin(3t), z(t) = 2*sqrt(ab)*sin(2t)
  const a = 0.82;
  const b = 0.18;
  const steps = 1000;

  // Darker blue recessed seam groove
  ctx.fillStyle = "rgba(30, 58, 138, 0.65)";
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = a * Math.cos(t) + b * Math.cos(3 * t);
    const y = a * Math.sin(t) - b * Math.sin(3 * t);
    const z = 2 * Math.sqrt(a * b) * Math.sin(2 * t);
    const u = (Math.atan2(x, z) / (2 * Math.PI) + 0.5) * 256;
    const v = (Math.asin(Math.max(-1, Math.min(1, y))) / Math.PI + 0.5) * 128;
    ctx.beginPath();
    ctx.arc(u, v, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Crisp white/cream seam line
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = a * Math.cos(t) + b * Math.cos(3 * t);
    const y = a * Math.sin(t) - b * Math.sin(3 * t);
    const z = 2 * Math.sqrt(a * b) * Math.sin(2 * t);
    const u = (Math.atan2(x, z) / (2 * Math.PI) + 0.5) * 256;
    const v = (Math.asin(Math.max(-1, Math.min(1, y))) / Math.PI + 0.5) * 128;
    ctx.beginPath();
    ctx.arc(u, v, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  cachedTennisBallTex = new THREE.CanvasTexture(canvas);
  cachedTennisBallTex.wrapS = THREE.RepeatWrapping;
  cachedTennisBallTex.wrapT = THREE.ClampToEdgeWrapping;
  return cachedTennisBallTex;
}

let cachedNetDrawerTex: THREE.CanvasTexture | null = null;
/**
 * Creates transparent wire net texture for desk storage drawers.
 */
function getNetDrawerTexture(): THREE.CanvasTexture {
  if (cachedNetDrawerTex) return cachedNetDrawerTex;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 64, 64);

  // Sturdy dark steel mesh grid
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 4;
  for (let x = 0; x <= 64; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x, 64);
    ctx.stroke();
  }
  for (let y = 0; y <= 64; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y); ctx.lineTo(64, y);
    ctx.stroke();
  }

  // Diagonal mesh wire weaves
  ctx.strokeStyle = "rgba(71, 85, 105, 0.7)";
  ctx.lineWidth = 2;
  for (let d = -64; d <= 128; d += 32) {
    ctx.beginPath();
    ctx.moveTo(d, 0); ctx.lineTo(d + 64, 64);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(d, 64); ctx.lineTo(d + 64, 0);
    ctx.stroke();
  }

  cachedNetDrawerTex = new THREE.CanvasTexture(canvas);
  cachedNetDrawerTex.wrapS = THREE.RepeatWrapping;
  cachedNetDrawerTex.wrapT = THREE.RepeatWrapping;
  cachedNetDrawerTex.repeat.set(4, 3);
  return cachedNetDrawerTex;
}

let cachedTriDeskGeo: THREE.BufferGeometry | null = null;
/**
 * Generates triangular desk top scaled to adult proportions (1.05m x 0.84m)
 * with significantly rounded corners (20cm-24cm fillets) and smooth bullnose bevel.
 */
function getTriangularDeskGeometry(): THREE.BufferGeometry {
  if (cachedTriDeskGeo) return cachedTriDeskGeo;

  const shape = new THREE.Shape();
  // Width: 1.05m, Depth: 0.84m
  // The wide base (facing student) is at y = -0.36, apex is at y = +0.48
  const halfW = 0.525;
  const yBase = -0.36;
  const yApex = 0.48;
  const rBase = 0.20; // 20cm rounded corners at student base
  const rApex = 0.24; // 24cm broad rounded apex nose

  // Slanted edge direction vector: (-0.525, 0.84), length ~ 0.9907m
  // Unit vector: (-0.5299, 0.8479)
  const ux = -0.5299;
  const uy = 0.8479;

  // 1) Bottom base edge (facing student)
  shape.moveTo(-halfW + rBase, yBase);
  shape.lineTo(halfW - rBase, yBase);

  // 2) Right base corner - generous smooth curve
  shape.quadraticCurveTo(halfW, yBase, halfW + ux * rBase, yBase + uy * rBase);

  // 3) Right slanted edge leading to apex
  shape.lineTo(0 - ux * rApex, yApex - uy * rApex);

  // 4) Apex corner - broad, friendly rounded nose
  shape.quadraticCurveTo(0, yApex, 0 + ux * rApex, yApex - uy * rApex);

  // 5) Left slanted edge leading back down
  shape.lineTo(-halfW - ux * rBase, yBase + uy * rBase);

  // 6) Left base corner - generous smooth curve back to start
  shape.quadraticCurveTo(-halfW, yBase, -halfW + rBase, yBase);

  cachedTriDeskGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.038,
    bevelEnabled: true,
    bevelSegments: 5,
    steps: 1,
    bevelSize: 0.020, // smooth bullnose rounded perimeter
    bevelThickness: 0.012,
  });
  cachedTriDeskGeo.center();
  return cachedTriDeskGeo;
}

let cachedSeatGeo: THREE.BufferGeometry | null = null;
/**
 * Ergonomic molded school chair seat shell scaled to fit character pelvis (0.56m x 0.48m).
 */
function getStudentSeatGeometry(): THREE.BufferGeometry {
  if (cachedSeatGeo) return cachedSeatGeo;
  const shape = new THREE.Shape();
  const halfW = 0.28; // 0.56m wide
  const halfD = 0.24; // 0.48m deep
  const r = 0.08; // 8cm rounded corners
  shape.moveTo(-halfW + r, -halfD);
  shape.lineTo(halfW - r, -halfD);
  shape.quadraticCurveTo(halfW, -halfD, halfW, -halfD + r);
  shape.lineTo(halfW, halfD - r);
  shape.quadraticCurveTo(halfW, halfD, halfW - r, halfD);
  shape.lineTo(-halfW + r, halfD);
  shape.quadraticCurveTo(-halfW, halfD, -halfW, halfD - r);
  shape.lineTo(-halfW, -halfD + r);
  shape.quadraticCurveTo(-halfW, -halfD, -halfW + r, -halfD);

  cachedSeatGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.028,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.012,
    bevelThickness: 0.008,
  });
  cachedSeatGeo.center();
  return cachedSeatGeo;
}

let cachedBackGeo: THREE.BufferGeometry | null = null;
/**
 * Ergonomic school chair backrest scaled to character torso (0.52m x 0.44m) with carry handle.
 */
function getStudentBackGeometry(): THREE.BufferGeometry {
  if (cachedBackGeo) return cachedBackGeo;
  const shape = new THREE.Shape();
  const halfW = 0.26; // 0.52m wide
  const halfH = 0.22; // 0.44m tall
  const r = 0.08; // 8cm rounded corners
  shape.moveTo(-halfW + r, -halfH);
  shape.lineTo(halfW - r, -halfH);
  shape.quadraticCurveTo(halfW, -halfH, halfW, -halfH + r);
  shape.lineTo(halfW, halfH - r);
  shape.quadraticCurveTo(halfW, halfH, halfW - r, halfH);
  shape.lineTo(-halfW + r, halfH);
  shape.quadraticCurveTo(-halfW, halfH, -halfW, halfH - r);
  shape.lineTo(-halfW, -halfH + r);
  shape.quadraticCurveTo(-halfW, -halfH, -halfW + r, -halfH);

  // Ergonomic oval handle cutout slot
  const hole = new THREE.Path();
  const slotW = 0.08;
  const slotH = 0.02;
  const slotY = 0.10;
  const hr = 0.015;
  hole.moveTo(-slotW + hr, slotY - slotH);
  hole.lineTo(slotW - hr, slotY - slotH);
  hole.quadraticCurveTo(slotW, slotY - slotH, slotW, slotY);
  hole.quadraticCurveTo(slotW, slotY + slotH, slotW - hr, slotY + slotH);
  hole.lineTo(-slotW + hr, slotY + slotH);
  hole.quadraticCurveTo(-slotW, slotY + slotH, -slotW, slotY);
  hole.quadraticCurveTo(-slotW, slotY - slotH, -slotW + hr, slotY - slotH);
  shape.holes.push(hole);

  cachedBackGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.024,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.010,
    bevelThickness: 0.007,
  });
  cachedBackGeo.center();
  return cachedBackGeo;
}

/**
 * Builds a single, self-contained classroom instance.
 */
export function buildClassroom(roomId: string, index: number): ClassroomInstance | null {
  const roomData = (classroomsData.classrooms as ClassroomData[]).find((c) => c.id === roomId);
  const campusDoor = getCampusDoor(roomId);

  if (!roomData || !campusDoor) {
    console.warn(`[classrooms] Room or campus door not found for: ${roomId}`);
    return null;
  }

  const col = index % 5;
  const row = Math.floor(index / 5);
  const worldX = BASE_X + col * SPACING;
  const worldZ = BASE_Z + row * SPACING;

  const group = new THREE.Group();
  const solids: Solid[] = [];
  const chairs: ChairSlot[] = [];

  const half = CLASSROOM_SIZE / 2; // 6.0m
  const minX = worldX - half;
  const maxX = worldX + half;
  const minZ = worldZ - half;
  const maxZ = worldZ + half;

  // Primary accent color
  let accentColor = 0x3b82f6;
  let pennantTitle = "VALOR";
  let pennantMotto = "ACADEMICS";
  let pennantBg = "#1e3a8a";
  let pennantFg = "#facc15";

  if (roomData.homeroom && COLLEGE_COLORS[roomData.homeroom]) {
    const colCfg = COLLEGE_COLORS[roomData.homeroom];
    accentColor = colCfg.primary;
    pennantTitle = roomData.homeroom;
    pennantMotto = colCfg.motto;
    pennantBg = colCfg.bannerBg;
    pennantFg = colCfg.bannerText;
  } else if (SPECIAL_THEMES[roomData.id]) {
    const spCfg = SPECIAL_THEMES[roomData.id];
    accentColor = spCfg.primary;
    pennantTitle = roomData.shortLabel.toUpperCase();
    pennantMotto = spCfg.motto;
    pennantBg = spCfg.bannerBg;
    pennantFg = spCfg.bannerText;
  }

  // 1) FLOOR
  const floorMat = new THREE.MeshStandardMaterial({
    map: makeClassroomFloorTexture(roomData),
    roughness: 0.45,
    metalness: 0.05,
  });
  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(CLASSROOM_SIZE, CLASSROOM_SIZE),
    floorMat
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(worldX, 0, worldZ);
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  // Special rug for ELD classroom
  if (roomData.id === "eld") {
    const rugCanvas = document.createElement("canvas");
    rugCanvas.width = 512;
    rugCanvas.height = 512;
    const rctx = rugCanvas.getContext("2d")!;
    rctx.fillStyle = "#ea580c";
    rctx.fillRect(0, 0, 512, 512);
    rctx.strokeStyle = "#fef3c7";
    rctx.lineWidth = 16;
    rctx.strokeRect(16, 16, 480, 480);
    rctx.fillStyle = "#c2410c";
    rctx.beginPath();
    rctx.arc(256, 256, 180, 0, Math.PI * 2);
    rctx.fill();
    rctx.strokeStyle = "#fef3c7";
    rctx.lineWidth = 10;
    rctx.stroke();
    rctx.font = "bold 34px system-ui";
    rctx.fillStyle = "#ffffff";
    rctx.textAlign = "center";
    rctx.fillText("COMMUNITY CIRCLE", 256, 265);

    const rugTex = new THREE.CanvasTexture(rugCanvas);
    const rugMat = new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.9 });
    const rugMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.2), rugMat);
    rugMesh.rotation.x = -Math.PI / 2;
    rugMesh.position.set(worldX, 0.015, worldZ + 0.5);
    group.add(rugMesh);
  }

  // 2) Open-Top Diorama Room (No ceiling, so orbital camera has clear diorama visibility)

  // 3) WALLS
  const valorRed = 0x991b1b; // Valor Academy logo crimson red
  const wallPlasterMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.85 });
  const wallRedMat = new THREE.MeshStandardMaterial({ color: valorRed, roughness: 0.75 });
  const baseboardMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
  const wallCapMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.5 }); // Oak wall cap trim

  // North Wall (Tall Back Teaching Wall painted Valor Red like the logo - Full 4m height)
  const northWall = new THREE.Mesh(
    new THREE.BoxGeometry(CLASSROOM_SIZE, CLASSROOM_HEIGHT, 0.2),
    wallRedMat
  );
  northWall.position.set(worldX, CLASSROOM_HEIGHT / 2, minZ);
  northWall.castShadow = true;
  northWall.receiveShadow = true;
  group.add(northWall);

  // East Wall (Full height)
  const eastWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, CLASSROOM_HEIGHT, CLASSROOM_SIZE),
    wallPlasterMat
  );
  eastWall.position.set(maxX, CLASSROOM_HEIGHT / 2, worldZ);
  eastWall.castShadow = true;
  eastWall.receiveShadow = true;
  group.add(eastWall);

  // West Wall (Full height)
  const westWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, CLASSROOM_HEIGHT, CLASSROOM_SIZE),
    wallPlasterMat
  );
  westWall.position.set(minX, CLASSROOM_HEIGHT / 2, worldZ);
  westWall.castShadow = true;
  westWall.receiveShadow = true;
  group.add(westWall);

  // South Wall (Back Entrance Wall - painted Valor Red like the logo: Cutaway 1.1m half-wall for clear isometric sightlines)
  const exitDoorX = worldX - 3.5;
  const exitDoorZ = maxZ;
  const doorW = 1.3;
  const doorH = 2.6;
  const CUTAWAY_H = 1.1;

  // South wall left segment (minX to exitDoorX - doorW/2)
  const swLeftW = (exitDoorX - doorW / 2) - minX;
  const swLeftMesh = new THREE.Mesh(
    new THREE.BoxGeometry(swLeftW, CUTAWAY_H, 0.2),
    wallRedMat
  );
  swLeftMesh.position.set(minX + swLeftW / 2, CUTAWAY_H / 2, maxZ);
  const swLeftCap = new THREE.Mesh(
    new THREE.BoxGeometry(swLeftW, 0.05, 0.26),
    wallCapMat
  );
  swLeftCap.position.set(minX + swLeftW / 2, CUTAWAY_H + 0.025, maxZ);
  group.add(swLeftMesh, swLeftCap);

  // South wall right segment (exitDoorX + doorW/2 to maxX)
  const swRightW = maxX - (exitDoorX + doorW / 2);
  const swRightMesh = new THREE.Mesh(
    new THREE.BoxGeometry(swRightW, CUTAWAY_H, 0.2),
    wallRedMat
  );
  swRightMesh.position.set((exitDoorX + doorW / 2) + swRightW / 2, CUTAWAY_H / 2, maxZ);
  const swRightCap = new THREE.Mesh(
    new THREE.BoxGeometry(swRightW, 0.05, 0.26),
    wallCapMat
  );
  swRightCap.position.set((exitDoorX + doorW / 2) + swRightW / 2, CUTAWAY_H + 0.025, maxZ);
  group.add(swRightMesh, swRightCap);

  // Doorway posts and lintel for Exit Door
  const postMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
  const postLeft = new THREE.Mesh(new THREE.BoxGeometry(0.12, doorH + 0.5, 0.22), postMat);
  postLeft.position.set(exitDoorX - doorW / 2, (doorH + 0.5) / 2, maxZ);
  const postRight = new THREE.Mesh(new THREE.BoxGeometry(0.12, doorH + 0.5, 0.22), postMat);
  postRight.position.set(exitDoorX + doorW / 2, (doorH + 0.5) / 2, maxZ);
  const lintelMesh = new THREE.Mesh(new THREE.BoxGeometry(doorW, 0.5, 0.22), postMat);
  lintelMesh.position.set(exitDoorX, doorH + 0.25, maxZ);
  group.add(postLeft, postRight, lintelMesh);

  // Solid collisions for the South half-wall segments
  solids.push(
    { x: minX + swLeftW / 2, z: maxZ, w: swLeftW, d: 0.3, yBase: 0, yTop: 3.5 },
    { x: (exitDoorX + doorW / 2) + swRightW / 2, z: maxZ, w: swRightW, d: 0.3, yBase: 0, yTop: 3.5 }
  );

  // Baseboards along walls
  const bbN = new THREE.Mesh(new THREE.BoxGeometry(CLASSROOM_SIZE, 0.16, 0.04), baseboardMat);
  bbN.position.set(worldX, 0.08, minZ + 0.11);
  const bbE = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, CLASSROOM_SIZE), baseboardMat);
  bbE.position.set(maxX - 0.11, 0.08, worldZ);
  const bbW = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, CLASSROOM_SIZE), baseboardMat);
  bbW.position.set(minX + 0.11, 0.08, worldZ);
  group.add(bbN, bbE, bbW);

  // 4) INTERIOR EXIT DOOR (Realistic frame + leaf + push bar + illuminated EXIT sign)
  const exitDoorGroup = new THREE.Group();
  exitDoorGroup.position.set(exitDoorX, 0, exitDoorZ - 0.02);

  const doorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
  const doorGlassMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.35, roughness: 0.1 });
  const pushBarMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 });

  // Door leaf
  const leafMesh = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.05, doorH, 0.06), doorMat);
  leafMesh.position.y = doorH / 2;
  const glassMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.1, 0.07), doorGlassMat);
  glassMesh.position.set(0, doorH * 0.62, 0);
  const pushBar = new THREE.Mesh(new THREE.BoxGeometry(doorW * 0.75, 0.06, 0.06), pushBarMat);
  pushBar.position.set(0, 1.05, -0.05);
  exitDoorGroup.add(leafMesh, glassMesh, pushBar);

  // Illuminated EXIT sign
  const exitSignMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.32, 0.10),
    new THREE.MeshBasicMaterial({ map: makeExitSignTexture() })
  );
  exitSignMesh.position.set(0, doorH + 0.22, -0.06);
  const exitSignLight = new THREE.PointLight(0x22c55e, 0.45, 3.5);
  exitSignLight.position.set(0, doorH + 0.22, -0.15);
  exitDoorGroup.add(exitSignMesh, exitSignLight);
  group.add(exitDoorGroup);

  // 5) LIGHTING
  // Warm ambient light inside the room
  const roomAmbient = new THREE.AmbientLight(0xfffbeb, 0.75);
  group.add(roomAmbient);

  // Recessed fluorescent/LED ceiling troffers
  const lightOffsets = [
    [-3, -3],
    [3, -3],
    [-3, 2],
    [3, 2],
  ];
  for (const [lx, lz] of lightOffsets) {
    const troffer = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.06, 0.8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    troffer.position.set(worldX + lx, CLASSROOM_HEIGHT - 0.03, worldZ + lz);
    const pLight = new THREE.PointLight(0xfffbeb, 0.55, 7.5);
    pLight.position.set(worldX + lx, CLASSROOM_HEIGHT - 0.3, worldZ + lz);
    group.add(troffer, pLight);
  }

  // 6) FRONT WHITEBOARD / SMARTBOARD
  const wbTex = makeWhiteboardTexture(roomData);
  const wbMat = new THREE.MeshStandardMaterial({ map: wbTex, roughness: 0.25, metalness: 0.05 });
  const wbWidth = 6.4;
  const wbHeight = 2.1;
  const wbMesh = new THREE.Mesh(new THREE.PlaneGeometry(wbWidth, wbHeight), wbMat);
  wbMesh.position.set(worldX - 0.3, 2.15, minZ + 0.11);
  group.add(wbMesh);

  // Whiteboard marker tray
  const trayMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 });
  const trayMesh = new THREE.Mesh(new THREE.BoxGeometry(wbWidth, 0.04, 0.12), trayMat);
  trayMesh.position.set(worldX - 0.3, 1.08, minZ + 0.16);
  group.add(trayMesh);

  // Wall clock above the whiteboard
  const clockMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.05, 24),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
  );
  clockMesh.rotation.x = Math.PI / 2;
  clockMesh.position.set(worldX + 3.8, 3.4, minZ + 0.12);
  group.add(clockMesh);

  // 7) TEACHER WORKSTATION
  const tDeskX = worldX + 3.8;
  const tDeskZ = minZ + 2.0;
  const tDeskMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 });
  const tLegMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 });

  // Desk top
  const tDeskTop = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.9), tDeskMat);
  tDeskTop.position.set(tDeskX, 0.76, tDeskZ);
  tDeskTop.castShadow = true;
  group.add(tDeskTop);

  // Desk modesty panel & legs
  const tModesty = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.04), tDeskMat);
  tModesty.position.set(tDeskX, 0.46, tDeskZ - 0.4);
  group.add(tModesty);
  for (const lx of [-0.8, 0.8]) {
    for (const lz of [-0.38, 0.38]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.72), tLegMat);
      leg.position.set(tDeskX + lx, 0.36, tDeskZ + lz);
      group.add(leg);
    }
  }

  // Teacher Laptop
  const laptopBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.02, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.3 })
  );
  laptopBase.position.set(tDeskX, 0.81, tDeskZ);
  const laptopScreen = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.22, 0.02),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
  );
  laptopScreen.position.set(tDeskX, 0.92, tDeskZ - 0.1);
  laptopScreen.rotation.x = -0.2;
  group.add(laptopBase, laptopScreen);

  // Graded papers stack & teacher mug
  const paperStack = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.05, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xfef08a })
  );
  paperStack.position.set(tDeskX - 0.55, 0.825, tDeskZ);
  const mugMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.04, 0.09, 12),
    new THREE.MeshStandardMaterial({ color: accentColor })
  );
  mugMesh.position.set(tDeskX + 0.55, 0.845, tDeskZ);
  group.add(paperStack, mugMesh);

  // Teacher Chair
  const tChairX = tDeskX;
  const tChairZ = tDeskZ + 0.65;
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });
  const tSeat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.06, 0.46), chairMat);
  tSeat.position.set(tChairX, 0.48, tChairZ);
  const tBack = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.48, 0.06), chairMat);
  tBack.position.set(tChairX, 0.74, tChairZ + 0.2);
  const tChairPost = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45), tLegMat);
  tChairPost.position.set(tChairX, 0.24, tChairZ);
  group.add(tSeat, tBack, tChairPost);

  // Register Teacher Chair
  chairs.push({
    chairX: tChairX,
    chairZ: tChairZ,
    seatY: 0.48,
    tableX: tDeskX,
    tableZ: tDeskZ,
    facingAngle: Math.PI, // Faces North toward whiteboard & desk
  });

  // Solid collision for teacher desk
  solids.push({
    x: tDeskX,
    z: tDeskZ,
    w: 2.0,
    d: 1.1,
    yBase: 0,
    yTop: 1.2,
  });

  // 8) STUDENT FURNITURE & LAYOUTS (Proportional Scale, Extra Rounded Corners, Correct Seating)
  const sDeskTopMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.45,
    metalness: 0.05,
  });
  // Uniform royal school blue chair material across EVERY classroom
  const sChairBlueMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    roughness: 0.45,
    metalness: 0.05,
  });
  const tennisBallMat = new THREE.MeshStandardMaterial({
    map: getTennisBallTexture(),
    roughness: 0.9,
    metalness: 0.02,
  });
  const netDrawerMat = new THREE.MeshStandardMaterial({
    map: getNetDrawerTexture(),
    transparent: true,
    alphaTest: 0.25,
    side: THREE.DoubleSide,
    metalness: 0.4,
    roughness: 0.4,
  });

  // Proportional geometries for adult educator avatar
  const tennisBallGeo = new THREE.SphereGeometry(0.046, 18, 14);
  const chairTennisBallGeo = new THREE.SphereGeometry(0.040, 16, 12);
  const deskLegGeo = new THREE.CylinderGeometry(0.020, 0.020, 0.67, 16);
  const chairLegGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.44, 12);
  const notebookGeo = new THREE.BoxGeometry(0.28, 0.022, 0.34);
  const notebookMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.6 });

  /**
   * Adds the standardized school blue chair with 4 tubular legs and tennis balls.
   * In chair local space:
   *  +Z is forward (where the seated character looks, thighs extend, and desk is).
   *  -Z is backward (where the character's back rests against the backrest).
   */
  function addStudentChair(cx: number, cz: number, facing: number = Math.PI) {
    const chairGroup = new THREE.Group();
    chairGroup.position.set(cx, 0, cz);
    chairGroup.rotation.y = facing;

    // 1) Contoured blue seat shell with waterfall front
    const seatMesh = new THREE.Mesh(getStudentSeatGeometry(), sChairBlueMat);
    seatMesh.rotation.x = Math.PI / 2;
    seatMesh.position.set(0, 0.48, 0);
    seatMesh.castShadow = true;
    chairGroup.add(seatMesh);

    // Waterfall front lip curve at +Z (front of seat)
    const waterfallFront = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.52, 14),
      sChairBlueMat
    );
    waterfallFront.rotation.z = Math.PI / 2;
    waterfallFront.position.set(0, 0.468, 0.24);
    chairGroup.add(waterfallFront);

    // 2) Ergonomic blue backrest at -Z (behind the character)
    const backMesh = new THREE.Mesh(getStudentBackGeometry(), sChairBlueMat);
    backMesh.position.set(0, 0.72, -0.22);
    backMesh.rotation.x = -0.10; // leans back naturally away from seat
    backMesh.castShadow = true;
    chairGroup.add(backMesh);

    // 3) Steel under-seat mounting frame
    const seatFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.025, 0.36),
      tLegMat
    );
    seatFrame.position.set(0, 0.44, 0);
    chairGroup.add(seatFrame);

    // 4) 4 Tubular steel legs with tennis balls at the bottom
    const chairLegCorners = [
      [-0.22, 0.20],  // Front-left
      [0.22, 0.20],   // Front-right
      [-0.24, -0.22], // Rear-left
      [0.24, -0.22],  // Rear-right
    ];

    for (const [lx, lz] of chairLegCorners) {
      // Tennis ball resting on the floor
      const tBall = new THREE.Mesh(chairTennisBallGeo, tennisBallMat);
      tBall.position.set(lx, 0.040, lz);
      tBall.rotation.y = Math.random() * Math.PI * 2;
      tBall.castShadow = true;
      chairGroup.add(tBall);

      // Angled tubular steel leg
      const leg = new THREE.Mesh(chairLegGeo, tLegMat);
      leg.position.set(lx * 0.90, 0.24, lz * 0.90);
      leg.rotation.z = -lx * 0.22;
      leg.rotation.x = -lz * 0.20;
      chairGroup.add(leg);
    }

    group.add(chairGroup);

    // Register chair for player sitting interaction
    chairs.push({
      chairX: cx,
      chairZ: cz,
      seatY: 0.48,
      tableX: cx + Math.sin(facing) * 0.68,
      tableZ: cz + Math.cos(facing) * 0.68,
      facingAngle: facing,
    });
  }

  /**
   * Adds triangular student desk with rounded edges, 3 legs with blue tennis balls,
   * net storage drawer, and matching blue student chair.
   */
  function addStudentDesk(dx: number, dz: number, facing: number = Math.PI) {
    const deskGroup = new THREE.Group();
    deskGroup.position.set(dx, 0, dz);
    deskGroup.rotation.y = facing;

    // 1) Triangular Desk Top with Rounded Edges & Bevel (1.05m x 0.84m)
    // In local desk space:
    //  -Z is the wide rounded base (facing the student)
    //  +Z is the broad rounded apex (facing forward)
    const deskTop = new THREE.Mesh(getTriangularDeskGeometry(), sDeskTopMat);
    deskTop.rotation.x = Math.PI / 2;
    deskTop.position.set(0, 0.76, 0);
    deskTop.castShadow = true;
    deskTop.receiveShadow = true;
    deskGroup.add(deskTop);

    // Protective dark armor edge trim along student base edge
    const edgeTrim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.98, 14),
      tLegMat
    );
    edgeTrim.rotation.z = Math.PI / 2;
    edgeTrim.position.set(0, 0.76, -0.38);
    deskGroup.add(edgeTrim);

    // 2) 3 Legs (1 on each rounded corner) with Blue Tennis Balls
    const cornerLegs = [
      [-0.38, -0.26], // Corner 1: Base-Left
      [0.38, -0.26],  // Corner 2: Base-Right
      [0.0, 0.30],    // Corner 3: Apex Nose
    ];

    for (const [lx, lz] of cornerLegs) {
      // Blue Tennis Ball at the bottom of the leg
      const tennisBall = new THREE.Mesh(tennisBallGeo, tennisBallMat);
      tennisBall.position.set(lx, 0.046, lz);
      tennisBall.rotation.y = Math.random() * Math.PI * 2;
      tennisBall.castShadow = true;
      deskGroup.add(tennisBall);

      // Tubular steel leg
      const leg = new THREE.Mesh(deskLegGeo, tLegMat);
      leg.position.set(lx, 0.40, lz);
      deskGroup.add(leg);

      // Steel mounting collar at desk underside
      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.010, 12),
        tLegMat
      );
      collar.position.set(lx, 0.735, lz);
      deskGroup.add(collar);

      // Rubber grommet where leg enters tennis ball
      const grommet = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.028, 0.016, 12),
        tLegMat
      );
      grommet.position.set(lx, 0.07, lz);
      deskGroup.add(grommet);
    }

    // 3) Net Storage Drawer Under Desk (High clearance for character thighs)
    const netFrameW = 0.64;
    const netFrameD = 0.44;
    const rimY = 0.715;
    const netBottomY = 0.645;

    // Rim perimeter tubes
    const rimFront = new THREE.Mesh(new THREE.BoxGeometry(netFrameW, 0.012, 0.012), tLegMat);
    rimFront.position.set(0, rimY, -0.22);
    const rimBack = new THREE.Mesh(new THREE.BoxGeometry(netFrameW, 0.012, 0.012), tLegMat);
    rimBack.position.set(0, rimY, 0.22);
    const rimLeft = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, netFrameD), tLegMat);
    rimLeft.position.set(-netFrameW / 2, rimY, 0);
    const rimRight = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, netFrameD), tLegMat);
    rimRight.position.set(netFrameW / 2, rimY, 0);
    deskGroup.add(rimFront, rimBack, rimLeft, rimRight);

    // 4 suspension arms attaching drawer to desk underside
    for (const sx of [-netFrameW / 2 + 0.03, netFrameW / 2 - 0.03]) {
      for (const sz of [-0.18, 0.18]) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.03), tLegMat);
        arm.position.set(sx, 0.73, sz);
        deskGroup.add(arm);
      }
    }

    // Net Basket: Bottom wire net shelf
    const netBottom = new THREE.Mesh(
      new THREE.PlaneGeometry(netFrameW, netFrameD),
      netDrawerMat
    );
    netBottom.rotation.x = Math.PI / 2;
    netBottom.position.set(0, netBottomY, 0);
    deskGroup.add(netBottom);

    // Net basket walls (left, right, rear)
    const netLeft = new THREE.Mesh(
      new THREE.PlaneGeometry(netFrameD, rimY - netBottomY),
      netDrawerMat
    );
    netLeft.rotation.y = Math.PI / 2;
    netLeft.position.set(-netFrameW / 2, (rimY + netBottomY) / 2, 0);

    const netRight = new THREE.Mesh(
      new THREE.PlaneGeometry(netFrameD, rimY - netBottomY),
      netDrawerMat
    );
    netRight.rotation.y = -Math.PI / 2;
    netRight.position.set(netFrameW / 2, (rimY + netBottomY) / 2, 0);

    const netBack = new THREE.Mesh(
      new THREE.PlaneGeometry(netFrameW, rimY - netBottomY),
      netDrawerMat
    );
    netBack.position.set(0, (rimY + netBottomY) / 2, 0.22);

    // Front retaining wire lip facing student (open top for notebooks)
    const netFrontLip = new THREE.Mesh(
      new THREE.PlaneGeometry(netFrameW, 0.028),
      netDrawerMat
    );
    netFrontLip.position.set(0, netBottomY + 0.014, -0.22);

    // Bottom wire support ribs
    for (let r = -0.24; r <= 0.24; r += 0.08) {
      const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, netFrameD), tLegMat);
      rib.rotation.x = Math.PI / 2;
      rib.position.set(r, netBottomY + 0.003, 0);
      deskGroup.add(rib);
    }

    deskGroup.add(netLeft, netRight, netBack, netFrontLip);

    // Student notebook tucked inside net drawer
    const notebook = new THREE.Mesh(notebookGeo, notebookMat);
    notebook.position.set(0.04, netBottomY + 0.015, -0.04);
    notebook.rotation.y = 0.06;
    deskGroup.add(notebook);

    group.add(deskGroup);

    // 4) Student Blue Chair placed behind desk (direction opposite of facing)
    const dist = 0.68;
    const cx = dx - Math.sin(facing) * dist;
    const cz = dz - Math.cos(facing) * dist;
    addStudentChair(cx, cz, facing);

    // Solid collision for desk footprint (compact core tripod zone so players can walk freely down aisles)
    solids.push({
      x: dx,
      z: dz,
      w: 0.55,
      d: 0.45,
      yBase: 0,
      yTop: 0.80,
    });
  }

  // If Science room, add a dedicated perimeter demonstration lab bench along the East wall
  if (roomData.subject === "Science") {
    const labX = maxX - 0.75;
    const labZ = worldZ - 0.8;
    const labBench = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.84, 2.6),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.2 })
    );
    labBench.position.set(labX, 0.42, labZ);
    labBench.castShadow = true;
    group.add(labBench);

    // Sink basin & gooseneck faucet
    const sink = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.5), tLegMat);
    sink.position.set(labX, 0.84, labZ);
    const faucet = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3), pushBarMat);
    faucet.position.set(labX - 0.2, 0.99, labZ);
    group.add(sink, faucet);

    // Glass beakers & science supplies
    const beaker1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 12), doorGlassMat);
    beaker1.position.set(labX, 0.90, labZ - 0.7);
    const beaker2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.10, 12), doorGlassMat);
    beaker2.position.set(labX, 0.89, labZ + 0.7);
    group.add(beaker1, beaker2);

    solids.push({
      x: labX,
      z: labZ,
      w: 1.3,
      d: 2.7,
      yBase: 0,
      yTop: 0.9,
    });
  }

  // Room-specific layouts for all classrooms
  if (roomData.id === "music") {
    // Music Room: Upright Piano + Music Stands & Arc Chairs
    // Piano
    const pianoMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.3 });
    const pianoMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.25, 0.65), pianoMat);
    pianoMesh.position.set(worldX - 3.8, 0.625, minZ + 1.8);
    group.add(pianoMesh);
    // Piano keyboard ledge
    const keysMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.06, 0.25),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    keysMesh.position.set(worldX - 3.8, 0.68, minZ + 2.15);
    group.add(keysMesh);

    solids.push({
      x: worldX - 3.8,
      z: minZ + 1.8,
      w: 1.7,
      d: 0.8,
      yBase: 0,
      yTop: 1.3,
    });

    // Rehearsal arcs of blue student chairs & music stands
    const arcRadii = [2.6, 4.0];
    for (const r of arcRadii) {
      for (let a = -0.7; a <= 0.7; a += 0.35) {
        const cx = worldX + Math.sin(a) * r;
        const cz = minZ + 2.2 + Math.cos(a) * r;

        // Use the uniform blue student chair with tennis balls facing the conductor
        addStudentChair(cx, cz, Math.PI - a);

        // Music stand in front
        const mx = worldX + Math.sin(a) * (r - 0.7);
        const mz = minZ + 2.2 + Math.cos(a) * (r - 0.7);
        const standPole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.05), tLegMat);
        standPole.position.set(mx, 0.525, mz);
        const standDesk = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.32, 0.02), tDeskMat);
        standDesk.position.set(mx, 1.08, mz);
        standDesk.rotation.x = 0.35;
        group.add(standPole, standDesk);
      }
    }
  } else if (roomData.id === "theater") {
    // Raised mini rehearsal stage + Director table
    const stageMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.5 });
    const stageMesh = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.28, 3.2), stageMat);
    stageMesh.position.set(worldX - 0.4, 0.14, minZ + 2.2);
    stageMesh.receiveShadow = true;
    group.add(stageMesh);

    solids.push({
      x: worldX - 0.4,
      z: minZ + 2.2,
      w: 6.3,
      d: 3.3,
      yBase: 0,
      yTop: 0.3,
    });

    // Theater masks banner
    const maskMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4, metalness: 0.6 });
    const maskMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 16), maskMat);
    maskMesh.rotation.x = Math.PI / 2;
    maskMesh.position.set(worldX - 3.2, 2.5, minZ + 0.12);
    group.add(maskMesh);

    // Director's desk and chair facing rehearsal stage (North)
    addStudentDesk(worldX, worldZ + 2.6, Math.PI);
  } else if (roomData.grade === 5 || roomData.id === "eld") {
    // Grade 5 & ELD: Collaborative table pods with wide peripheral aisles
    const podCenters = [
      [-2.4, -0.8],
      [2.4, -0.8],
      [-2.4, 2.2],
      [2.4, 2.2],
    ];
    for (const [px, pz] of podCenters) {
      // North side of pod facing South into cluster
      addStudentDesk(worldX + px - 0.70, worldZ + pz - 0.55, 0);
      addStudentDesk(worldX + px + 0.70, worldZ + pz - 0.55, 0);
      // South side of pod facing North into cluster
      addStudentDesk(worldX + px - 0.70, worldZ + pz + 0.55, Math.PI);
      addStudentDesk(worldX + px + 0.70, worldZ + pz + 0.55, Math.PI);
    }
  } else if (roomData.grade === 8) {
    // Grade 8: Seminar U-Shape Conference Arrangement
    for (let x = -2.8; x <= 2.8; x += 1.4) {
      addStudentDesk(worldX + x, worldZ + 2.8, Math.PI); // bottom of U facing North
    }
    for (let z = -0.6; z <= 1.6; z += 1.3) {
      addStudentDesk(worldX - 3.2, worldZ + z, Math.PI / 2); // left wing facing East
      addStudentDesk(worldX + 3.2, worldZ + z, -Math.PI / 2);  // right wing facing West
    }
  } else {
    // Traditional paired desk rows (Grade 6 & 7 and other classrooms) facing North toward whiteboard
    const rowX = [-2.8, 1.4];
    const rowZ = [-1.1, 0.7, 2.5];
    for (const rx of rowX) {
      for (const rz of rowZ) {
        addStudentDesk(worldX + rx, worldZ + rz, Math.PI);
        addStudentDesk(worldX + rx + 1.25, worldZ + rz, Math.PI);
      }
    }
  }

  // 9) BOOKSHELVES & WALL STORAGE (West wall & East wall)
  const bkMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.6 });
  const bookColors = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xec4899];

  // Tall Bookcase along West wall
  const bkX = minX + 0.45;
  const bkZ = worldZ - 1.2;
  const bookcase = new THREE.Mesh(new THREE.BoxGeometry(0.65, 2.4, 1.8), bkMat);
  bookcase.position.set(bkX, 1.2, bkZ);
  bookcase.castShadow = true;
  group.add(bookcase);

  // Books on shelves
  for (let s = 0; s < 3; s++) {
    const sy = 0.6 + s * 0.7;
    for (let b = 0; b < 6; b++) {
      const bColor = bookColors[(s + b) % bookColors.length];
      const bookMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.26, 0.08),
        new THREE.MeshStandardMaterial({ color: bColor })
      );
      bookMesh.position.set(bkX, sy, bkZ - 0.6 + b * 0.22);
      group.add(bookMesh);
    }
  }
  solids.push({
    x: bkX,
    z: bkZ,
    w: 0.75,
    d: 1.9,
    yBase: 0,
    yTop: 2.5,
  });

  // Student Cubbies along South wall
  const cubbyX = maxX - 2.2;
  const cubbyZ = maxZ - 0.35;
  const cubbyMesh = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.1, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.7 })
  );
  cubbyMesh.position.set(cubbyX, 0.55, cubbyZ);
  group.add(cubbyMesh);
  solids.push({
    x: cubbyX,
    z: cubbyZ,
    w: 2.5,
    d: 0.6,
    yBase: 0,
    yTop: 1.2,
  });

  // Black laptop cart along the West wall (south of the bookcase): Chromebooks standing in its slots
  const lcX = minX + 0.42;
  const lcZ = worldZ + 1.8;
  {
    const black = new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.55, metalness: 0.3 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x9aa1aa, roughness: 0.35, metalness: 0.8 });
    const shell = new THREE.MeshStandardMaterial({ color: 0x3a3d43, roughness: 0.5, metalness: 0.4 });
    const cartBody = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 1.25), black);
    cartBody.position.set(lcX, 0.5, lcZ);
    cartBody.castShadow = true;
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.04, 1.3), black);
    top.position.set(lcX, 0.91, lcZ);
    // front doors: two panels with vents, a latch
    const doorL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.62, 0.58), new THREE.MeshStandardMaterial({ color: 0x222428, roughness: 0.5 }));
    doorL.position.set(lcX + 0.32, 0.5, lcZ - 0.3);
    const doorR = doorL.clone();
    doorR.position.z = lcZ + 0.3;
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.05), steel);
    latch.position.set(lcX + 0.34, 0.6, lcZ);
    group.add(cartBody, top, doorL, doorR, latch);
    for (let v = 0; v < 6; v++) {
      for (const dz of [-0.3, 0.3]) {
        const vent = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.015, 0.4), new THREE.MeshStandardMaterial({ color: 0x0c0d0f }));
        vent.position.set(lcX + 0.332, 0.35 + v * 0.06, lcZ + dz);
        group.add(vent);
      }
    }
    // the Chromebooks standing on top, in a rack
    for (let k = 0; k < 8; k++) {
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.025), shell);
      book.position.set(lcX, 1.03, lcZ - 0.5 + k * 0.142);
      book.castShadow = true;
      const logo = new THREE.Mesh(new THREE.CircleGeometry(0.018, 12), new THREE.MeshBasicMaterial({ color: 0xd8dde3 }));
      logo.rotation.y = Math.PI / 2;
      logo.position.set(lcX + 0.131, 1.04, lcZ - 0.5 + k * 0.142);
      group.add(book, logo);
    }
    for (const dz of [-0.63, 0.63]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.02), steel);
      rail.position.set(lcX, 1.0, lcZ + dz);
      group.add(rail);
    }
    // push handle and casters
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 8), steel);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(lcX + 0.36, 0.86, lcZ);
    group.add(handle);
    for (const dx of [-0.24, 0.24]) {
      for (const dz of [-0.55, 0.55]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.035, 12), black);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(lcX + dx, 0.05, lcZ + dz);
        group.add(wheel);
      }
    }
    solids.push({ x: lcX, z: lcZ, w: 0.7, d: 1.35, yBase: 0, yTop: 1.2 });
  }

  // Trash & Recycle Bins near door
  const trashBin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.15, 0.45, 12),
    new THREE.MeshStandardMaterial({ color: 0x475569 })
  );
  trashBin.position.set(exitDoorX + 1.2, 0.225, maxZ - 0.35);
  const recycleBin = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.45, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x2563eb })
  );
  recycleBin.position.set(exitDoorX + 1.6, 0.225, maxZ - 0.35);
  group.add(trashBin, recycleBin);

  // 10) COLLEGE PENNANT / MOTTO BANNER on East Wall
  const pennantTex = makePennantTexture(pennantTitle, pennantMotto, pennantBg, pennantFg);
  const pennantMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 0.9),
    new THREE.MeshStandardMaterial({ map: pennantTex, transparent: true, side: THREE.DoubleSide })
  );
  pennantMesh.rotation.y = -Math.PI / 2;
  pennantMesh.position.set(maxX - 0.11, 2.6, worldZ - 1.2);
  group.add(pennantMesh);

  // 11) WINDOWS with daytime sky glow on East wall
  const winFrameMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 });
  const winGlassMat = new THREE.MeshStandardMaterial({
    color: 0xbae6fd,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.35,
    roughness: 0.1,
  });
  for (const wz of [worldZ + 1.5, worldZ + 3.8]) {
    const winFrame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 1.6), winFrameMat);
    winFrame.position.set(maxX - 0.08, 2.5, wz);
    const winGlass = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.6, 1.4), winGlassMat);
    winGlass.position.set(maxX - 0.08, 2.5, wz);
    group.add(winFrame, winGlass);
  }

  // Hide by default until entered
  group.visible = false;

  const instance: ClassroomInstance = {
    id: roomId,
    data: roomData,
    group,
    solids,
    chairs,
    worldX,
    worldZ,
    size: CLASSROOM_SIZE,
    height: CLASSROOM_HEIGHT,
    spawnX: exitDoorX,
    spawnZ: maxZ - 1.2,
    exitDoorX,
    exitDoorZ,
    whiteboard: { x: worldX - 0.3, z: minZ + 0.11, w: wbWidth },
    laptopCart: { x: lcX + 0.95, z: lcZ },
    campusDoor,
  };

  instances.set(roomId, instance);
  return instance;
}

/**
 * Gets or lazily creates a classroom instance.
 */
export function getClassroom(roomId: string): ClassroomInstance | null {
  if (instances.has(roomId)) {
    return instances.get(roomId)!;
  }
  const allIds = getAllClassroomIds();
  const idx = allIds.indexOf(roomId);
  if (idx === -1) return null;
  return buildClassroom(roomId, idx);
}

/**
 * Returns all valid classroom IDs that have single doors.
 */
export function getAllClassroomIds(): string[] {
  const doors = (layoutData as any).doors as Array<{ id: string }>;
  const classrooms = (classroomsData.classrooms as ClassroomData[]);
  // Only include single doors that exist in classrooms.json
  return classrooms
    .filter((c) => doors.some((d) => d.id === c.id))
    .map((c) => c.id);
}
