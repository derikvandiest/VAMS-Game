/**
 * The parking-lot cars: low-poly but car-shaped. Each style is a side silhouette (hood, cabin, trunk or hatch) extruded
 * across the car's width, with wheel arches cut out, a glass greenhouse, a body-colored roof and pillars, lights,
 * bumpers, grille, mirrors, door seams, handles and license plates. Car space: +x is the front, y up, z across
 * (the driver sits on the -z side). The scene (scene.ts) adds the driving behavior.
 */
import * as THREE from "three";

export type CarStyle = "sedan" | "coupe" | "hatchback" | "suv" | "crossover" | "pickup" | "minivan" | "ev" | "schoolvan";

interface Spec {
  name: string;
  L: number; // length
  W: number; // width
  wr: number; // wheel radius
  wf: number; // front axle x
  wb: number; // rear axle x
  noseY: number; // front bumper top
  hoodY: number; // hood (front edge)
  beltY: number; // window line
  roofY: number; // roof
  deckY: number; // trunk lid / top of the rear (= beltY for hatches)
  xA: number; // windshield base
  xB: number; // roof front
  xC: number; // roof back
  xD: number; // rear glass base
  tail: "trunk" | "hatch" | "flat"; // shape of the back
  bed?: boolean; // pickup bed behind the cab
  grille?: "big" | "slim" | "none";
  spoiler?: boolean;
  rails?: boolean; // roof rails
  slide?: boolean; // sliding side door (minivan / van)
  lightBar?: boolean; // EV light bars
  decal?: string; // text on the sides
  pillars?: number[]; // the side window dividers (instead of the default door pillars)
  van?: boolean; // passenger-van details (tall roof cap, cladding, hex grille, steel wheels)
}

const SPECS: Record<CarStyle, Spec> = {
  sedan: { name: "Sedan", L: 4.4, W: 1.86, wr: 0.34, wf: 1.35, wb: -1.35, noseY: 0.56, hoodY: 0.8, beltY: 0.93, roofY: 1.42, deckY: 0.9, xA: 0.72, xB: 0.12, xC: -0.95, xD: -1.45, tail: "trunk", grille: "slim" },
  coupe: { name: "Sports Coupe", L: 4.4, W: 1.88, wr: 0.34, wf: 1.38, wb: -1.32, noseY: 0.5, hoodY: 0.7, beltY: 0.86, roofY: 1.27, deckY: 0.88, xA: 0.55, xB: -0.12, xC: -0.72, xD: -1.55, tail: "trunk", grille: "big", spoiler: true },
  hatchback: { name: "Hatchback", L: 3.6, W: 1.76, wr: 0.3, wf: 1.1, wb: -1.08, noseY: 0.52, hoodY: 0.78, beltY: 0.9, roofY: 1.4, deckY: 0.9, xA: 0.55, xB: 0.0, xC: -1.25, xD: -1.66, tail: "hatch", grille: "slim" },
  suv: { name: "SUV", L: 4.6, W: 2.0, wr: 0.4, wf: 1.43, wb: -1.43, noseY: 0.72, hoodY: 1.0, beltY: 1.12, roofY: 1.76, deckY: 1.12, xA: 0.95, xB: 0.35, xC: -2.05, xD: -2.2, tail: "hatch", grille: "big", rails: true },
  crossover: { name: "Crossover", L: 4.5, W: 1.96, wr: 0.38, wf: 1.42, wb: -1.4, noseY: 0.66, hoodY: 0.92, beltY: 1.04, roofY: 1.62, deckY: 1.02, xA: 0.85, xB: 0.22, xC: -1.62, xD: -2.08, tail: "hatch", grille: "slim", rails: true },
  pickup: { name: "Pickup Truck", L: 4.8, W: 2.0, wr: 0.4, wf: 1.62, wb: -1.42, noseY: 0.78, hoodY: 1.06, beltY: 1.14, roofY: 1.78, deckY: 1.14, xA: 1.0, xB: 0.42, xC: -0.48, xD: -0.62, tail: "flat", bed: true, grille: "big" },
  minivan: { name: "Minivan", L: 4.6, W: 1.98, wr: 0.36, wf: 1.5, wb: -1.42, noseY: 0.62, hoodY: 0.92, beltY: 1.02, roofY: 1.78, deckY: 1.02, xA: 1.25, xB: 0.45, xC: -2.1, xD: -2.24, tail: "hatch", grille: "slim", slide: true },
  ev: { name: "Electric Car", L: 4.4, W: 1.9, wr: 0.34, wf: 1.38, wb: -1.38, noseY: 0.55, hoodY: 0.74, beltY: 0.9, roofY: 1.38, deckY: 0.88, xA: 0.78, xB: 0.05, xC: -0.6, xD: -1.75, tail: "trunk", grille: "none", lightBar: true },
  // a full-size passenger van (like a Transit): short sloped nose, raked windshield, tall rounded roof, a long band of
  // side windows, dark lower cladding and bumpers, big hexagonal grille
  schoolvan: { name: "Valor Van", L: 5.4, W: 2.06, wr: 0.38, wf: 1.85, wb: -1.7, noseY: 0.78, hoodY: 1.02, beltY: 1.22, roofY: 1.78, deckY: 1.22, xA: 1.95, xB: 1.18, xC: -2.6, xD: -2.66, tail: "hatch", grille: "none", slide: true, pillars: [0.55, -0.62, -1.72], van: true },
};

// shared materials (per-car ones: body paint and the brake-light material)
const M = {
  trim: new THREE.MeshStandardMaterial({ color: 0x1b1e24, roughness: 0.75 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xd8dde3, roughness: 0.25, metalness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x1a2433, roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.86 }),
  well: new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 1 }),
  tire: new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 0.92 }),
  rimSilver: new THREE.MeshStandardMaterial({ color: 0xc3c8cf, roughness: 0.3, metalness: 0.8 }),
  rimDark: new THREE.MeshStandardMaterial({ color: 0x2b2e34, roughness: 0.35, metalness: 0.7 }),
  head: new THREE.MeshStandardMaterial({ color: 0xfffbea, emissive: 0xfff3c4, emissiveIntensity: 0.8, roughness: 0.2 }),
  amber: new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xb45309, emissiveIntensity: 0.4 }),
  plate: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 }),
};

const geoCache = new Map<string, THREE.BufferGeometry>();
function extrude(key: string, shape: THREE.Shape, depth: number, bevel = 0.05): THREE.BufferGeometry {
  const have = geoCache.get(key);
  if (have) return have;
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  geoCache.set(key, g);
  return g;
}

/** The side silhouette of the body (below the windows), with the wheel arches cut out */
function bodyShape(s: Spec): THREE.Shape {
  const ar = s.wr + 0.07; // arch radius
  const y0 = s.wr * 0.92;
  const h = new THREE.Shape();
  const rear = -s.L / 2, front = s.L / 2;
  h.moveTo(rear + 0.12, y0);
  h.lineTo(s.wb - ar, y0);
  h.absarc(s.wb, s.wr, ar, Math.PI, 0, true);
  h.lineTo(s.wf - ar, y0);
  h.absarc(s.wf, s.wr, ar, Math.PI, 0, true);
  h.lineTo(front - 0.14, y0);
  h.quadraticCurveTo(front, y0, front, y0 + 0.14);
  h.lineTo(front, s.noseY);
  h.quadraticCurveTo(front, s.hoodY, front - 0.4, s.hoodY + 0.02);
  h.lineTo(s.xA, s.beltY); // the hood rises gently to the windshield
  if (s.tail === "trunk") {
    h.lineTo(s.xD, s.beltY);
    h.quadraticCurveTo(s.xD - 0.25, s.deckY + 0.03, rear + 0.35, s.deckY);
    h.quadraticCurveTo(rear, s.deckY, rear, s.deckY - 0.22);
  } else {
    h.lineTo(rear + 0.1, s.beltY);
    h.quadraticCurveTo(rear, s.beltY, rear, s.beltY - 0.12);
  }
  h.lineTo(rear, y0 + 0.14);
  h.quadraticCurveTo(rear, y0, rear + 0.12, y0);
  return h;
}

/** The greenhouse (windows): windshield, roof line, rear glass */
function cabinShape(s: Spec, inset = 0): THREE.Shape {
  const c = new THREE.Shape();
  const base = s.beltY - 0.02;
  c.moveTo(s.xA - inset, base);
  c.quadraticCurveTo(s.xA - (s.xA - s.xB) * 0.55, s.roofY - inset * 0.3, s.xB - inset * 0.3, s.roofY - inset);
  c.lineTo(s.xC + inset * 0.3, s.roofY - inset);
  c.quadraticCurveTo(s.xD + (s.xC - s.xD) * 0.3, s.roofY - (s.roofY - base) * 0.15, s.xD + inset, base);
  c.lineTo(s.xA - inset, base);
  return c;
}

function box(parent: THREE.Object3D, mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function decalTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#991b1b";
  g.fillRect(0, 40, 1024, 48);
  g.fillStyle = "#facc15";
  g.fillRect(0, 92, 1024, 8);
  g.fillStyle = "#ffffff";
  g.font = "900 44px Arial Black, Arial";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 512, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface CarModel {
  group: THREE.Group;
  name: string;
  steerPivots: THREE.Group[];
  wheelMeshes: THREE.Mesh[];
  brakeLights: THREE.Mesh[];
  headLights: THREE.Mesh[];
  brakeLightMat: THREE.MeshStandardMaterial;
  wheelRadius: number;
  frontX: number;
  rearX: number;
}

export function buildCarModel(style: CarStyle, color: string, seed = 0): CarModel {
  const s = SPECS[style];
  const car = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.45 });
  const brakeLightMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0xb91c1c, emissiveIntensity: 0.6, roughness: 0.3 });
  const W = s.W;
  const half = W / 2;

  // body, greenhouse and roof
  const body = new THREE.Mesh(extrude(`${style}-body`, bodyShape(s), W - 0.1, 0.05), paint);
  body.castShadow = true;
  body.receiveShadow = true;
  const glass = new THREE.Mesh(extrude(`${style}-glass`, cabinShape(s), W - 0.26, 0.03), M.glass);
  const roofShape = new THREE.Shape();
  roofShape.moveTo(s.xB + 0.05, s.roofY - 0.03);
  roofShape.lineTo(s.xC - 0.05, s.roofY - 0.03);
  roofShape.lineTo(s.xC + 0.03, s.roofY + 0.04);
  roofShape.lineTo(s.xB - 0.03, s.roofY + 0.04);
  const roof = new THREE.Mesh(extrude(`${style}-roof`, roofShape, W - 0.22, 0.03), paint);
  roof.castShadow = true;
  car.add(body, glass, roof);

  // pillars (A at the windshield, B between the doors, C/D at the back) and a black window trim at the belt line
  const pillar = (x0: number, x1: number, y0: number, y1: number): void => {
    for (const side of [-1, 1]) {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const p = box(car, paint, 0.09, len, 0.05, (x0 + x1) / 2, (y0 + y1) / 2, side * (half - 0.14));
      p.rotation.z = Math.atan2(x0 - x1, y1 - y0);
    }
  };
  pillar(s.xA - 0.04, s.xB, s.beltY, s.roofY);
  const bx = s.pillars ? s.pillars[0] : s.bed ? s.xD + 0.08 : s.xB + (s.xC - s.xB) * (s.slide ? 0.33 : 0.45);
  if (s.pillars) for (const px of s.pillars) pillar(px, px, s.beltY, s.roofY);
  else {
    pillar(bx, bx, s.beltY, s.roofY);
    if (s.slide) pillar(s.xB + (s.xC - s.xB) * 0.72, s.xB + (s.xC - s.xB) * 0.72, s.beltY, s.roofY);
  }
  pillar(s.xC, s.xD + 0.06, s.roofY, s.beltY);
  for (const side of [-1, 1]) box(car, M.trim, s.xA - s.xD, 0.04, 0.03, (s.xA + s.xD) / 2, s.beltY - 0.01, side * (half - 0.06));

  // lights, bumpers, grille, plates
  const front = s.L / 2, rear = -s.L / 2;
  const lightY = (s.noseY + s.hoodY) / 2;
  const headLights: THREE.Mesh[] = [];
  if (s.lightBar) {
    headLights.push(box(car, M.head, 0.05, 0.05, W - 0.5, front - 0.02, s.hoodY - 0.06, 0));
  }
  for (const side of [-1, 1]) {
    const hl = box(car, M.head, 0.1, 0.12, 0.38, front - 0.06, lightY, side * (half - 0.32));
    hl.rotation.y = side * 0.12;
    headLights.push(hl);
    box(car, M.amber, 0.06, 0.05, 0.14, front - 0.07, lightY - 0.1, side * (half - 0.2));
  }
  box(car, M.trim, 0.22, 0.2, W + 0.02, front - 0.02, s.wr * 0.92 + 0.12, 0); // front bumper
  box(car, M.trim, 0.22, 0.2, W + 0.02, rear + 0.02, s.wr * 0.92 + 0.12, 0); // rear bumper
  if (s.grille === "big") {
    box(car, M.trim, 0.06, (s.hoodY - s.noseY) * 0.9, W * 0.48, front + 0.01, lightY, 0);
    for (let k = 0; k < 3; k++) box(car, M.chrome, 0.07, 0.02, W * 0.46, front + 0.02, lightY - 0.08 + k * 0.08, 0);
  } else if (s.grille === "slim") {
    box(car, M.trim, 0.06, 0.08, W * 0.4, front + 0.01, lightY + 0.02, 0);
    box(car, M.trim, 0.06, 0.12, W * 0.55, front + 0.01, s.noseY - 0.1, 0);
  }
  box(car, M.plate, 0.02, 0.12, 0.34, front + 0.11, s.wr * 0.92 + 0.12, 0);
  box(car, M.plate, 0.02, 0.12, 0.34, rear - 0.11, s.wr * 0.92 + 0.22, 0);
  const tailY = (s.tail === "trunk" ? s.deckY : s.beltY) - 0.12;
  const brakeLights: THREE.Mesh[] = [];
  if (s.lightBar) brakeLights.push(box(car, brakeLightMat, 0.05, 0.06, W - 0.4, rear - 0.01, tailY, 0));
  for (const side of [-1, 1]) {
    const tall = s.tail === "hatch" && !s.lightBar;
    if (s.van) brakeLights.push(box(car, brakeLightMat, 0.1, 0.7, 0.16, rear + 0.03, 1.08, side * (half - 0.1))); // tall corner lamps
    else brakeLights.push(box(car, brakeLightMat, 0.1, tall ? 0.32 : 0.17, tall ? 0.3 : 0.42, rear + 0.03, tall ? tailY + 0.05 : tailY + 0.02, side * (half - (tall ? 0.22 : 0.27))));
  }
  brakeLights.push(box(car, brakeLightMat, 0.04, 0.04, 0.34, s.xD - 0.02, s.tail === "trunk" ? s.beltY + 0.06 : s.roofY - 0.04, 0)); // third brake light

  // mirrors, door seams, handles
  for (const side of [-1, 1]) {
    const mz = side * (half + 0.08);
    box(car, M.trim, 0.04, 0.03, 0.14, s.xA - 0.12, s.beltY + 0.03, side * (half - 0.02));
    box(car, paint, 0.14, 0.12, 0.08, s.xA - 0.12, s.beltY + 0.1, mz);
    const doorFront = s.xA - 0.05;
    const doors = s.bed ? [doorFront, s.xD + 0.04] : s.slide ? [doorFront, bx, s.xB + (s.xC - s.xB) * 0.72] : style === "coupe" ? [doorFront, s.xC + 0.1] : [doorFront, bx, s.xC + 0.12];
    for (const dx of doors) box(car, M.trim, 0.015, s.beltY - s.wr * 1.3, 0.012, dx, (s.beltY + s.wr * 1.3) / 2, side * (half - 0.04));
    for (let k = 0; k + 1 < doors.length; k++) box(car, M.chrome, 0.12, 0.03, 0.03, doors[k] - 0.2, s.beltY - 0.14, side * (half - 0.03));
    if (s.slide) box(car, M.trim, (bx - s.xC) * 0.9, 0.02, 0.012, (bx + s.xC) / 2, s.beltY - 0.04, side * (half - 0.04)); // sliding-door track
  }

  // extras
  if (s.spoiler) {
    box(car, paint, 0.22, 0.03, W - 0.3, rear + 0.2, s.deckY + 0.12, 0);
    for (const side of [-1, 1]) box(car, M.trim, 0.04, 0.1, 0.04, rear + 0.2, s.deckY + 0.06, side * (half - 0.35));
  }
  if (s.rails) for (const side of [-1, 1]) box(car, M.trim, (s.xB - s.xC) * 0.85, 0.04, 0.05, (s.xB + s.xC) / 2, s.roofY + 0.08, side * (half - 0.25));
  if (s.bed) {
    // open bed: dark liner on top of the body behind the cab, bed rails and a tailgate lip
    box(car, M.well, s.xD - rear - 0.16, 0.02, W - 0.24, (s.xD + rear) / 2 - 0.02, s.beltY + 0.012, 0);
    for (const side of [-1, 1]) box(car, paint, s.xD - rear, 0.14, 0.08, (s.xD + rear) / 2, s.beltY + 0.07, side * (half - 0.08));
    box(car, paint, 0.08, 0.14, W - 0.1, rear + 0.04, s.beltY + 0.07, 0);
    box(car, paint, 0.08, 0.18, W - 0.1, s.xD - 0.04, s.beltY + 0.09, 0);
  }
  if (s.decal) {
    const mat = new THREE.MeshStandardMaterial({ map: decalTexture(s.decal), transparent: true, roughness: 0.5 });
    for (const side of [-1, 1]) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(s.L * 0.62, s.L * 0.62 / 8), mat);
      d.position.set(-0.35, s.van ? 0.88 : s.beltY - 0.24, side * (half + 0.001));
      if (side < 0) d.rotation.y = Math.PI;
      car.add(d);
    }
  }

  if (s.van) {
    const front0 = s.L / 2, rear0 = -s.L / 2, ar = s.wr + 0.07;
    // the tall roof: a body-colored cap above the window band, rounded at the front over the windshield
    const cap = new THREE.Shape();
    cap.moveTo(s.xB + 0.02, s.roofY - 0.02);
    cap.quadraticCurveTo(s.xB - 0.12, s.roofY + 0.24, s.xB - 0.45, s.roofY + 0.27);
    cap.lineTo(rear0 + 0.18, s.roofY + 0.27);
    cap.quadraticCurveTo(rear0 + 0.02, s.roofY + 0.25, rear0 + 0.02, s.roofY + 0.05);
    cap.lineTo(rear0 + 0.02, s.roofY - 0.02);
    const capMesh = new THREE.Mesh(extrude(`${style}-cap`, cap, W - 0.12, 0.05), paint);
    capMesh.castShadow = true;
    car.add(capMesh);
    // dark lower cladding along the sides, between and around the wheel arches, and a running board
    const clY0 = s.wr * 0.95, clY1 = 0.64;
    const segs: Array<[number, number]> = [[front0 - 0.1, s.wf + ar], [s.wf - ar, s.wb + ar], [s.wb - ar, rear0 + 0.1]];
    for (const side of [-1, 1]) for (const [a, b] of segs) box(car, M.trim, a - b, clY1 - clY0, 0.05, (a + b) / 2, (clY0 + clY1) / 2, side * (half - 0.02));
    for (const side of [-1, 1]) box(car, M.trim, s.wf - s.wb - 2 * ar, 0.05, 0.12, (s.wf + s.wb) / 2, clY0 - 0.02, side * (half - 0.05));
    // tall front bumper with a lower vent and fog-light pockets; the rear step bumper
    box(car, M.trim, 0.3, 0.44, W + 0.04, front0 - 0.04, 0.54, 0);
    box(car, M.well, 0.04, 0.1, W * 0.5, front0 + 0.12, 0.46, 0);
    for (const sd of [-1, 1]) box(car, M.well, 0.04, 0.09, 0.26, front0 + 0.12, 0.62, sd * (half - 0.32));
    box(car, M.trim, 0.32, 0.3, W + 0.04, rear0 + 0.04, 0.52, 0);
    // the face: a wide black grille (slightly narrower at the bottom) with horizontal bars and a small oval badge on
    // its surface, flat headlights on each side of it, amber turn signals below them
    const gTop = 1.04, gBot = 0.8, gw = W * 0.27;
    const grilleShape = new THREE.Shape();
    grilleShape.moveTo(-gw, gTop); grilleShape.lineTo(gw, gTop); grilleShape.lineTo(gw * 0.86, gBot); grilleShape.lineTo(-gw * 0.86, gBot); grilleShape.closePath();
    const grille = new THREE.Mesh(new THREE.ExtrudeGeometry(grilleShape, { depth: 0.06, bevelEnabled: false }), M.trim);
    grille.rotation.y = Math.PI / 2; // the shape's x runs across the van (z), y stays up
    grille.position.set(front0 - 0.02, 0, 0);
    car.add(grille);
    for (let k = 0; k < 3; k++) box(car, M.well, 0.02, 0.03, gw * 1.7, front0 + 0.045, gBot + 0.06 + k * 0.065, 0);
    const badge = new THREE.Mesh(new THREE.CircleGeometry(0.09, 24), new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.3, metalness: 0.5 }));
    badge.scale.set(1, 0.45, 1);
    badge.rotation.y = Math.PI / 2;
    badge.position.set(front0 + 0.058, (gTop + gBot) / 2 + 0.01, 0);
    car.add(badge);
    for (const side of [-1, 1]) {
      const z = side * (gw + 0.3);
      box(car, M.trim, 0.05, 0.2, 0.42, front0 - 0.02, 0.96, z); // headlight housing
      box(car, M.head, 0.03, 0.14, 0.36, front0 + 0.01, 0.97, z); // lens
      box(car, M.amber, 0.03, 0.05, 0.36, front0 + 0.01, 0.86, z); // turn signal
      box(car, M.well, 0.3, 0.02, 0.07, front0 - 0.6, s.hoodY + 0.12, side * 0.42); // hood vents
      box(car, M.trim, 0.06, 0.06, 0.18, s.xA - 0.12, s.beltY + 0.06, side * (half + 0.06)); // mirror arm
      box(car, M.trim, 0.12, 0.26, 0.12, s.xA - 0.12, s.beltY + 0.18, side * (half + 0.17)); // mirror
    }
    box(car, M.trim, 0.02, 0.5, 0.02, s.xB - 0.3, s.roofY + 0.5, -half + 0.3);
    // black window frames: dividers between the panes and a strip along the bottom and top of the window band
    for (const side of [-1, 1]) {
      for (const px of [...(s.pillars ?? []), s.xD + 0.12]) box(car, M.trim, 0.13, s.roofY - s.beltY, 0.05, px, (s.roofY + s.beltY) / 2, side * (half - 0.11));
      box(car, M.trim, s.xB - s.xD, 0.05, 0.05, (s.xB + s.xD) / 2, s.roofY - 0.02, side * (half - 0.11));
    }
  }

  // wheel wells (dark behind each wheel) and the wheels
  for (const x of [s.wf, s.wb]) {
    const well = new THREE.Mesh(new THREE.CylinderGeometry(s.wr + 0.06, s.wr + 0.06, W - 0.16, 18), M.well);
    well.rotation.x = Math.PI / 2;
    well.position.set(x, s.wr, 0);
    car.add(well);
  }
  const steerPivots: THREE.Group[] = [];
  const wheelMeshes: THREE.Mesh[] = [];
  const rimMat = s.van ? M.rimSilver : seed % 3 === 0 ? M.rimDark : M.rimSilver;
  const tireW = s.wr * 0.62;
  for (const [x, steer] of [[s.wf, true], [s.wb, false]] as const) {
    for (const side of [-1, 1]) {
      const roll = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(s.wr, s.wr, tireW, 20), M.tire);
      tire.rotation.x = Math.PI / 2;
      tire.castShadow = true;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(s.wr * 0.62, s.wr * 0.62, tireW + 0.012, 18), rimMat);
      rim.rotation.x = Math.PI / 2;
      roll.add(tire, rim);
      // five spokes on the outer face (they turn with the wheel)
      for (let k = 0; k < 5; k++) {
        const sp = new THREE.Mesh(new THREE.BoxGeometry(s.wr * 0.12, s.wr * 1.05, 0.02), M.trim);
        sp.position.z = side * (tireW / 2 + 0.008);
        sp.rotation.z = (k / 5) * Math.PI * 2;
        roll.add(sp);
      }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(s.wr * 0.16, s.wr * 0.16, tireW + 0.03, 10), M.chrome);
      hub.rotation.x = Math.PI / 2;
      roll.add(hub);
      wheelMeshes.push(tire);
      const z = side * (half - tireW / 2 + 0.03);
      if (steer) {
        const pivot = new THREE.Group();
        pivot.position.set(x, s.wr, z);
        pivot.add(roll);
        car.add(pivot);
        steerPivots.push(pivot);
      } else {
        roll.position.set(x, s.wr, z);
        car.add(roll);
      }
    }
  }

  // a simple interior: seats and a steering wheel (the driver sits on the -z side)
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.9 });
  for (const z of [-0.42, 0.42]) {
    box(car, seatMat, 0.5, 0.12, 0.46, -0.15, s.beltY - 0.38, z);
    box(car, seatMat, 0.1, 0.55, 0.44, -0.42, s.beltY - 0.1, z);
  }
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 8, 18), M.trim);
  wheel.position.set(s.xA - 0.38, s.beltY + 0.02, -0.42);
  wheel.rotation.set(0, Math.PI / 2, 0.45);
  car.add(wheel);

  return { group: car, name: s.name, steerPivots, wheelMeshes, brakeLights, headLights, brakeLightMat, wheelRadius: s.wr, frontX: front + 0.12, rearX: -rear + 0.12 };
}

/** Which style each parking space type gets (a mix, so the lot has variety) */
export function styleFor(type: string, index: number): CarStyle {
  const pick = <T,>(a: T[]): T => a[index % a.length];
  if (type === "van") return "schoolvan";
  if (type === "suv") return pick<CarStyle>(["suv", "pickup", "minivan"]);
  if (type === "electric") return pick<CarStyle>(["ev", "crossover"]);
  if (type === "compact") return "hatchback";
  return pick<CarStyle>(["sedan", "coupe"]);
}
