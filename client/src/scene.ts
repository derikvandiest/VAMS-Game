import * as THREE from "three";
import layout from "../../content/layout.json";
import classroomsData from "../../content/classrooms.json";
import officeSignUrl from "./assets/office_sign.png";
import { showWelcomePopup } from "./welcome";
import { NPCS, NpcDef } from "./npcs";
import { roomIdByObjective } from "./rooms";
import { Elevator } from "./elevator";
import { showDialog } from "./dialog";
import { confirmAction } from "./confirm";
import { assignmentDialog } from "./assignments";
import { eldDoorDialog } from "./eldTurnIn";
import { DOOR_TALK } from "./doorTalk";
import { roomById } from "./rooms";
import { startPresence } from "./presence";
import { getSocket, isMultiplayerActive } from "./net";
import { loadSlot, getActiveSlotId } from "./saveManager";
import {
  buildMprRoom,
  MPR_ROOM_X,
  MPR_ROOM_Z,
  MPR_ROOM_SIZE,
  MPR_ROOM_HEIGHT,
  MPR_SPAWN_X,
  MPR_SPAWN_Z,
  MPR_CAMPUS_DOOR_X,
  MPR_CAMPUS_DOOR_Z,
  MPR_CAMPUS_PARKING_DOOR_X,
  MPR_CAMPUS_PARKING_DOOR_Z,
  MPR_EXIT_DOOR_X,
  MPR_EXIT_DOOR_Z,
  MPR_EAST_EXIT_DOOR_X,
  MPR_EAST_EXIT_DOOR_Z,
  MPR_EAST_SPAWN_X,
  MPR_EAST_SPAWN_Z,
} from "./mpr";
import {
  getClassroom,
  getAllClassroomIds,
  ClassroomInstance,
} from "./classrooms";
import { createAvatarRig, GAME_AVATAR_SCALE, AvatarRig } from "./avatar";
import { loadCharacterProfile, onProfileChange } from "./profile";
import { initSettingsModal } from "./settings";

/**
 * Milestone 2 - single-player prototype (PROJECT.md section 14, milestone 2).
 *
 * Builds the placeholder campus from content/layout.json: two buildings forming
 * an L (west building + north building) around a rectangular grass field, an
 * asphalt ground with a paved inner courtyard, a parking lot with parked cars,
 * and TWO-STORY buildings - each with a ground floor and a second floor reached
 * by an exterior staircase.
 *
 * A low-poly player walks with WASD / arrow keys. The camera is LOCKED to the
 * player and orbits them (right-click + drag rotates/elevates); a compass button
 * snaps the view back to north-up. Collision is HEIGHT-AWARE: only the ground
 * stories of the two buildings (y 0..6) and the second-story walls (y 6.1..12.1)
 * are solid, so the player can walk up the stairs onto a second floor. A marked
 * WALKWAY on each second floor leads from the stair landing to the 4 upstairs
 * classrooms.
 *
 * PROTOTYPE NOTE: a building's "second floor" is a walkable platform with
 * second-story walls, door frames, and a walkway - not a furnished interior.
 * Real two-story interiors arrive at Milestone 7.
 *
 * This scene is LOCAL ONLY for now - other players appear in Milestone 3.
 */

type LayoutWall = { id?: string; x: number; z: number; w: number; d: number };
type LayoutDoor = { id: string; x: number; z: number; axis: string; floor: number };
type LayoutCar = { x: number; z: number; rot: number; color: string; type?: string; id?: string };
type LayoutStair = {
  building: string;
  center: { x: number; z: number };
  width: number; // cross-sectional width (perpendicular to climb)
  len: number; // climb length along the climb axis
  axis: string; // "z" = climb runs north-south, "x" = climb runs east-west
  dir: number; // +1/-1 step direction along the climb axis
  bottom: number; // climb-axis coordinate at the ground
  top: number; // climb-axis coordinate at the second floor
};
type LayoutTable = { x: number; z: number };
type LayoutWalkway = {
  building: string;
  axis: string; // direction the deck runs along ("z" = north-south, "x" = east-west)
  center: { x: number; z: number };
  width: number; // across the deck
  length: number; // along the deck
};
type LayoutGate = {
  id: string;
  x: number;
  z: number;
  axis: string; // "z" = barrier runs north-south (blocks east-west), "x" = runs east-west
  length: number; // along the barrier axis
  thickness: number; // across the barrier axis
  height: number;
};
type CampusLayout = typeof import("../../content/layout.json");

// --- Procedural ground textures -----------------------------------
// Subtle per-pixel noise on a canvas, tiled across each ground
// plane. Keeps the flat low-poly look while giving the surfaces
// texture (no image assets needed - PROJECT.md section 11).
function makeNoiseTexture(baseHex: string, variance: number, repeat: number): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);
  const image = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = (Math.random() - 0.5) * variance;
    image.data[i] = Math.max(0, Math.min(255, image.data[i] + n));
    image.data[i + 1] = Math.max(0, Math.min(255, image.data[i + 1] + n));
    image.data[i + 2] = Math.max(0, Math.min(255, image.data[i + 2] + n));
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const PLAYER_SPEED = 3.5; // world units / second (matches settings.walkingSpeed)
const SPRINT_MULTIPLIER = 2.5; // hold Shift to sprint noticeably faster (8.75 units/sec)
const PLAYER_RADIUS = 0.5;
const PLAYER_HEIGHT = 2.4; // used for height-aware collision

// --- Camera orbit settings -------------------------------------------------
// The camera sits at a fixed distance/height from the player and always looks
// at them. `camAngle` is the orbit angle in radians measured so that angle 0
// points the camera due SOUTH of the player looking NORTH (north-up on screen).
const CAM_DISTANCE = 30; // horizontal distance from player to camera (default zoom)
const MIN_ZOOM = 3.2; // scroll-wheel zoom limits: close-up on the character ...
const MAX_ZOOM = 50; // ... out to a campus overview (horizontal distance from the player)
const CAM_HEIGHT = 26; // camera height above the ground
const NORTH_UP_ANGLE = -Math.PI / 2; // North is where the buses are parked (+X), camera sits at -X looking +X
const DEFAULT_CAM_ANGLE = NORTH_UP_ANGLE; // north-up: facing the buses

export interface SceneController {
  stop: () => void;
  getPlayerTransform: () => { x: number; y: number; z: number; rotY: number };
}

export function startPlaceholderScene(
  container: HTMLElement,
  initialSpawn?: { x: number; y: number; z: number; rotY?: number }
): SceneController {
  const layoutData = layout as CampusLayout;

  const walls: LayoutWall[] = layoutData.walls;
  const doors: LayoutDoor[] = layoutData.doors;
  const cars: LayoutCar[] = layoutData.cars;
  const stairs: LayoutStair[] = layoutData.stairs;
  const tables: LayoutTable[] = layoutData.tables;
  const walkways: LayoutWalkway[] = layoutData.walkways;
  const gates: LayoutGate[] = layoutData.gates;
  const roofY = layoutData.boundary.wallHeight; // ground-story height (6)
  const floor2 = roofY + 0.1; // walkable second-floor surface height

  // Height-aware solid boxes for collision detection
  type Solid = { x: number; z: number; w: number; d: number; yBase: number; yTop: number };
  const railingSolids: Solid[] = [];
  const buildingSolids: Solid[] = walls.map((w) => ({
    x: w.x,
    z: w.z,
    w: w.w,
    d: w.d,
    yBase: 0,
    yTop: roofY,
  }));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9ec7e8); // soft sky
  scene.fog = new THREE.Fog(0x9ec7e8, 90, 240);

  // --- Renderer (pixel ratio capped at 2 for Retina displays - spec section 3)
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // --- Lighting: bright "day" look (dark mode arrives in Milestone 5) ------
  const hemisphere = new THREE.HemisphereLight(0xffffff, 0x6b7a5e, 0.9);
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight(0xfff4e0, 1.4);
  sun.position.set(24, 38, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const shadowCam = sun.shadow.camera;
  shadowCam.left = -65;
  shadowCam.right = 65;
  shadowCam.top = 65;
  shadowCam.bottom = -65;
  shadowCam.updateProjectionMatrix();
  scene.add(sun);

  // Soft fill light from the opposite side (no shadows) to lift dark faces.
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.35);
  fill.position.set(-20, 24, -14);
  scene.add(fill);

  // =========================================================================
  // GROUND - three stacked layers (asphalt outside, pavement inside, grass
  // field in the middle). Each sits a hair above the last to avoid z-fighting.
  // =========================================================================

  // 1) Asphalt: the base surface for the whole campus (everything outside).
  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 220),
    new THREE.MeshStandardMaterial({ map: makeNoiseTexture("#555a60", 16, 12), roughness: 1 })
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(0, 0, 10);
  asphalt.receiveShadow = true;
  scene.add(asphalt);

  // 1b) Parking lot: darker asphalt (#333333) extending all the way
  // to the perimeter fence and gates around the parking lot area, and across the
  // entire south boundary where the sidewalk used to be.
  const lot = layoutData.parkingLot;
  const lotMat = new THREE.MeshStandardMaterial({
    map: makeNoiseTexture("#333333", 12, 4),
    roughness: 1,
  });

  // Main parking lot area reaching west fence (x = -53.5), north fence/gate (z = -23.0),
  // and south fence (z = 65.5). Spans x in [-53.5, -33.0], z in [-23.0, 65.5].
  const mainLotPad = new THREE.Mesh(new THREE.PlaneGeometry(lot.width, lot.depth), lotMat);
  mainLotPad.rotation.x = -Math.PI / 2;
  mainLotPad.position.set(lot.center.x, 0.01, lot.center.z);
  mainLotPad.receiveShadow = true;
  scene.add(mainLotPad);

  // North entrance throat connecting east from the main lot toward the office building
  // Spanning x in [-33.0, -30.0], z in [-23.0, -10.0].
  const northThroatPad = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 13.0), lotMat);
  northThroatPad.rotation.x = -Math.PI / 2;
  northThroatPad.position.set(-31.5, 0.01, -16.5);
  northThroatPad.receiveShadow = true;
  scene.add(northThroatPad);

  // --- Parking spot lines: white stripes marking the spots, so the
  // lot reads as a parking lot. Derived from the car positions in
  // --- Parking spots: compact stalls with white divider stripes & concrete wheel stoppers ---
  // Row 1 (east row): x = -36.8, facing east, 17 compact spots from z = -13.0 to z = 32.6 (step = 2.85m)
  // Row 2 (west row): x = -49.5, facing west (against west hedge), 27 compact spots from z = -13.0 to z = 61.1 (step = 2.85m)
  const lineMaterial = new THREE.MeshStandardMaterial({
    color: 0xf4f4f4,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  const spotLineGeometry = new THREE.BoxGeometry(5.2, 0.02, 0.12);

  // Concrete wheel stopper materials
  const stopperMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    roughness: 0.9,
  });
  const stopperStripeMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.5,
  });
  const stopperBodyGeo = new THREE.BoxGeometry(0.16, 0.12, 1.8);
  const stopperStripeGeo = new THREE.BoxGeometry(0.17, 0.125, 0.22);

  const parkingRowsConfig = [
    { rowX: -36.8, stopperX: -34.85, startZ: -13.0, endZ: 32.6, count: 17 },
    { rowX: -49.5, stopperX: -51.35, startZ: -13.0, endZ: 55.4, count: 25 },
  ];

  const STEP = 2.85;

  for (const row of parkingRowsConfig) {
    // 1) White stripe boundaries between spots
    for (let i = 0; i <= row.count; i++) {
      const bz = row.startZ - STEP / 2 + i * STEP;
      const line = new THREE.Mesh(spotLineGeometry, lineMaterial);
      line.position.set(row.rowX, 0.025, bz);
      line.receiveShadow = true;
      scene.add(line);
    }

    // 2) Concrete parking stoppers for all stalls
    for (let i = 0; i < row.count; i++) {
      const spotZ = row.startZ + i * STEP;
      const stopperGroup = new THREE.Group();
      stopperGroup.position.set(row.stopperX, 0.06, spotZ);

      // Main concrete curb stop
      const stopper = new THREE.Mesh(stopperBodyGeo, stopperMat);
      stopper.castShadow = true;
      stopper.receiveShadow = true;
      stopperGroup.add(stopper);

      // Yellow reflective hazard stripes on each end
      const stripeL = new THREE.Mesh(stopperStripeGeo, stopperStripeMat);
      stripeL.position.set(0, 0, -0.55);
      const stripeR = new THREE.Mesh(stopperStripeGeo, stopperStripeMat);
      stripeR.position.set(0, 0, 0.55);
      stopperGroup.add(stripeL, stripeR);

      scene.add(stopperGroup);

      // Physical collision block so cars/players stop against the wheel stopper
      buildingSolids.push({
        x: row.stopperX,
        z: spotZ,
        w: 0.20,
        d: 1.85,
        yBase: 0,
        yTop: 0.20,
      });
    }
  }

  // 2) Pavement: the beige courtyard pavement extending from inside the school
  // all the way to the far south side of campus (z = 65.5), excluding the parking lot.
  const pavementMat = new THREE.MeshStandardMaterial({
    map: makeNoiseTexture("#cfc6b4", 10, 8),
    roughness: 1,
  });

  const pavement = layoutData.pavement;
  const pavementMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(pavement.width, pavement.depth),
    pavementMat
  );
  pavementMesh.rotation.x = -Math.PI / 2;
  pavementMesh.position.set(pavement.center.x, 0.02, pavement.center.z);
  pavementMesh.receiveShadow = true;
  scene.add(pavementMesh);

  // 2b) South pavement extension south of MPR connecting parking lot (x = -33.0)
  // to main courtyard pavement (x = -14.0) down to south perimeter fence (z = 65.5).
  const southPavement = (layoutData as any).southPavement;
  if (southPavement) {
    const southPavementMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(southPavement.width, southPavement.depth),
      pavementMat
    );
    southPavementMesh.rotation.x = -Math.PI / 2;
    southPavementMesh.position.set(southPavement.center.x, 0.02, southPavement.center.z);
    southPavementMesh.receiveShadow = true;
    scene.add(southPavementMesh);
  }

  // 2c) Breezeway pavement inside the school where the gate is
  const breezewayPavement = (layoutData as any).breezewayPavement;
  if (breezewayPavement) {
    const breezewayMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(breezewayPavement.width, breezewayPavement.depth),
      pavementMat
    );
    breezewayMesh.rotation.x = -Math.PI / 2;
    breezewayMesh.position.set(breezewayPavement.center.x, 0.02, breezewayPavement.center.z);
    breezewayMesh.receiveShadow = true;
    scene.add(breezewayMesh);
  }

  // 2c) White sidewalk along the west side of the buildings and wrapping around the MPR
  type SidewalkSeg = { x: number; z: number; w: number; d: number };
  const sidewalks: SidewalkSeg[] =
    (layoutData as any).sidewalks ??
    ((layoutData as any).sidewalk ? [(layoutData as any).sidewalk] : []);
  if (sidewalks.length > 0) {
    const sidewalkMat = new THREE.MeshStandardMaterial({ map: makeNoiseTexture("#f2eee6", 6, 6), roughness: 0.85 });
    const jointMaterial = new THREE.MeshStandardMaterial({ color: 0xc8c3b9, roughness: 1 });
    for (const sw of sidewalks) {
      const swMesh = new THREE.Mesh(new THREE.BoxGeometry(sw.w, 0.04, sw.d), sidewalkMat);
      swMesh.position.set(sw.x, 0.02, sw.z);
      swMesh.receiveShadow = true;
      scene.add(swMesh);

      // Expansion joints along the longer axis
      const alongZ = sw.d >= sw.w;
      if (alongZ) {
        const jointGeo = new THREE.BoxGeometry(sw.w - 0.02, 0.042, 0.08);
        const half = sw.d / 2;
        for (let off = -half + 3; off < half; off += 3) {
          const joint = new THREE.Mesh(jointGeo, jointMaterial);
          joint.position.set(sw.x, 0.021, sw.z + off);
          scene.add(joint);
        }
      } else {
        const jointGeo = new THREE.BoxGeometry(0.08, 0.042, sw.d - 0.02);
        const half = sw.w / 2;
        for (let off = -half + 3; off < half; off += 3) {
          const joint = new THREE.Mesh(jointGeo, jointMaterial);
          joint.position.set(sw.x + off, 0.021, sw.z);
          scene.add(joint);
        }
      }
    }
  }

  // 2d) Tall security perimeter fence/gate attached to the sidewalk and wrapping
  // the entire school and outside of the parking lot. (Height: 3.5m, players cannot pass).
  // Red color matching the gate, walkway railings, and doors (0x7a2f2f)
  const fencePostMat = new THREE.MeshStandardMaterial({ color: 0x7a2f2f, roughness: 0.6, metalness: 0.25 });
  const fenceRailMat = new THREE.MeshStandardMaterial({ color: 0x7a2f2f, roughness: 0.6, metalness: 0.25 });
  const fencePicketMat = new THREE.MeshStandardMaterial({ color: 0x7a2f2f, roughness: 0.55, metalness: 0.3 });

  // Perimeter fence sides (North fence and East fence).
  // Note: South and West sides are enclosed by the White Brick Perimeter Wall.
  // East fence is split around vehicle swing gate at z: [54.6, 61.4];
  // North fence is split around the parking lot north sliding gate at x: [-45.4, -38.6].
  const fenceSides = [
    { x1: -53.5, z1: -23.0, x2: -45.4, z2: -23.0 }, // North-West (parking lot west of gate)
    { x1: -38.6, z1: -23.0, x2: 55.0, z2: -23.0 },  // North-East (from gate across north campus)
    { x1: 55.0, z1: -23.0, x2: 55.0, z2: 54.6 },    // East North section (stops at vehicle gate)
    { x1: 55.0, z1: 61.4, x2: 55.0, z2: 65.5 },     // East South corner section (after vehicle gate)
  ];

  let totalFencePosts = 0;
  let totalFencePickets = 0;
  const postSpacing = 3.5;
  const picketSpacing = 0.35;

  for (const s of fenceSides) {
    const len = Math.hypot(s.x2 - s.x1, s.z2 - s.z1);
    totalFencePosts += Math.floor(len / postSpacing) + 1;
    totalFencePickets += Math.floor(len / picketSpacing);
  }

  const postGeo = new THREE.BoxGeometry(0.14, 3.6, 0.14);
  const postMesh = new THREE.InstancedMesh(postGeo, fencePostMat, totalFencePosts);
  postMesh.castShadow = true;

  const picketGeo = new THREE.BoxGeometry(0.04, 3.2, 0.04);
  const picketMesh = new THREE.InstancedMesh(picketGeo, fencePicketMat, totalFencePickets);
  picketMesh.castShadow = true;

  const dummyFence = new THREE.Object3D();
  let fPostIdx = 0;
  let fPicketIdx = 0;

  for (const s of fenceSides) {
    const len = Math.hypot(s.x2 - s.x1, s.z2 - s.z1);
    const alongX = Math.abs(s.x2 - s.x1) > Math.abs(s.z2 - s.z1);
    const dx = (s.x2 - s.x1) / len;
    const dz = (s.z2 - s.z1) / len;

    // Continuous horizontal square rails: top, middle, and bottom
    const railHeights = [0.25, 1.75, 3.35];
    for (const rh of railHeights) {
      const railGeo = new THREE.BoxGeometry(alongX ? len : 0.06, 0.06, alongX ? 0.06 : len);
      const rail = new THREE.Mesh(railGeo, fenceRailMat);
      rail.position.set((s.x1 + s.x2) / 2, rh, (s.z1 + s.z2) / 2);
      rail.castShadow = true;
      scene.add(rail);
    }

    // Heavy structural posts every 3.5m
    const numPosts = Math.floor(len / postSpacing);
    for (let i = 0; i <= numPosts; i++) {
      const d = i * (len / numPosts);
      dummyFence.position.set(s.x1 + dx * d, 1.8, s.z1 + dz * d);
      dummyFence.updateMatrix();
      if (fPostIdx < totalFencePosts) postMesh.setMatrixAt(fPostIdx++, dummyFence.matrix);
    }

    // Security vertical pickets every 0.35m
    const numPickets = Math.floor(len / picketSpacing);
    for (let i = 1; i < numPickets; i++) {
      const d = (i / numPickets) * len;
      dummyFence.position.set(s.x1 + dx * d, 1.8, s.z1 + dz * d);
      dummyFence.updateMatrix();
      if (fPicketIdx < totalFencePickets) picketMesh.setMatrixAt(fPicketIdx++, dummyFence.matrix);
    }
  }

  // Draw only the instances that were actually placed: unused ones keep the identity matrix and would all
  // show up as stray posts and pickets standing at the world origin (0, 0).
  postMesh.count = fPostIdx;
  picketMesh.count = fPicketIdx;
  postMesh.instanceMatrix.needsUpdate = true;
  picketMesh.instanceMatrix.needsUpdate = true;
  scene.add(postMesh, picketMesh);

  // --- 2e) Decorative Vehicle Gate (East Fence behind East Basketball Hoop) ---
  // Located at x = 55.0, centered at z = 53.0 directly behind the hoop at (40.5, 53.0).
  // Purely visual: does not open, players cannot pass (boundary collision blocks px >= 55.0).
  // Vehicle gate posts and ironwork in the matching signature red color (0x7a2f2f)
  const gatePostMat = new THREE.MeshStandardMaterial({ color: 0x7a2f2f, roughness: 0.55, metalness: 0.3 });
  const gateIronMat = new THREE.MeshStandardMaterial({ color: 0x7a2f2f, roughness: 0.6, metalness: 0.3 });
  const gateHardwareMat = new THREE.MeshStandardMaterial({ color: 0xc8cdd5, roughness: 0.3, metalness: 0.9 });
  const brassPadlockMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.35, metalness: 0.85 });
  const rubberWheelMat = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.85 });
  const drivewayApronMat = new THREE.MeshStandardMaterial({ color: 0x3d4148, roughness: 0.95 });
  const safetyYellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 });

  // 1) Concrete driveway apron / curb cut threshold under the gate (bridges from campus through gate across outside sidewalk to road)
  const drivewayApron = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.03, 7.4), drivewayApronMat);
  drivewayApron.position.set(55.1, 0.022, 58.0);
  drivewayApron.receiveShadow = true;
  scene.add(drivewayApron);

  // Safety yellow "KEEP CLEAR" box & diagonal stripes on the campus pavement in front of the gate
  const keepClearBorderX = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.005, 0.12), safetyYellowMat);
  const borderNorth = keepClearBorderX.clone();
  borderNorth.position.set(53.5, 0.025, 54.6);
  const borderSouth = keepClearBorderX.clone();
  borderSouth.position.set(53.5, 0.025, 61.4);
  const keepClearBorderZ = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.005, 6.8), safetyYellowMat);
  keepClearBorderZ.position.set(52.0, 0.025, 58.0);
  scene.add(borderNorth, borderSouth, keepClearBorderZ);

  // Diagonal hazard stripes across the driveway apron
  const stripeGeo = new THREE.BoxGeometry(0.12, 0.005, 2.6);
  for (let zOffset = -2.6; zOffset <= 2.6; zOffset += 1.1) {
    const stripe = new THREE.Mesh(stripeGeo, safetyYellowMat);
    stripe.position.set(53.5, 0.025, 58.0 + zOffset);
    stripe.rotation.y = Math.PI / 4;
    scene.add(stripe);
  }

  // 2) Heavy terminal gate posts flanking the vehicle opening (z = 54.6 and z = 61.4)
  const gatePostPositions = [54.6, 61.4];
  for (const gpz of gatePostPositions) {
    // Main heavy post (0.24m x 3.8m x 0.24m)
    const postCol = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.8, 0.24), gatePostMat);
    postCol.position.set(55.0, 1.9, gpz);
    postCol.castShadow = true;
    scene.add(postCol);

    // Pyramidal post cap finial
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.20, 0.16, 4), gatePostMat);
    cap.position.set(55.0, 3.88, gpz);
    cap.rotation.y = Math.PI / 4;
    scene.add(cap);

    // Flange base plate
    const basePlate = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.36), gatePostMat);
    basePlate.position.set(55.0, 0.04, gpz);
    scene.add(basePlate);

    // Heavy duty cylindrical barrel hinges connecting post to gate leaf
    const hingeZ = gpz === 54.6 ? 54.66 : 61.34;
    for (const hy of [0.6, 2.8]) {
      const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 12), gateHardwareMat);
      hinge.position.set(55.0, hy, hingeZ);
      hinge.castShadow = true;
      scene.add(hinge);
    }
  }

  // 3) Double-leaf driveway swing gate (left/North leaf: z in [54.74, 57.96], right/South leaf: z in [58.04, 61.26])
  const leafConfigs = [
    { name: "north", centerZ: 56.35, spanZ: 3.22, hingeZ: 54.78, meetingZ: 57.92, diagDir: 1 },
    { name: "south", centerZ: 59.65, spanZ: 3.22, hingeZ: 61.22, meetingZ: 58.08, diagDir: -1 }
  ];

  const vehicleGateLeaves: THREE.Group[] = [];
  for (const leaf of leafConfigs) {
    // Each leaf is a group that swings about its hinge (the group's origin is the hinge post)
    const leafGroup = new THREE.Group();
    // Outer perimeter tubular frame (0.08m square steel)
    // Horizontal rails: top, middle, bottom
    for (const ry of [0.25, 1.75, 3.35]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, leaf.spanZ), gateIronMat);
      rail.position.set(55.0, ry, leaf.centerZ);
      rail.castShadow = true;
      leafGroup.add(rail);
    }

    // Vertical stiles: hinge stile & meeting stile
    for (const sz of [leaf.hingeZ, leaf.meetingZ]) {
      const stile = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.18, 0.08), gateIronMat);
      stile.position.set(55.0, 1.8, sz);
      stile.castShadow = true;
      leafGroup.add(stile);
    }

    // Structural diagonal truss braces (classic heavy industrial vehicle gate cross bracing)
    const diagLen = Math.hypot(3.14, 1.5);
    const diagAngleLower = -leaf.diagDir * Math.atan2(1.5, 3.14);
    const diagAngleUpper = leaf.diagDir * Math.atan2(1.6, 3.14);

    const diagLower = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, diagLen), gateIronMat);
    diagLower.position.set(55.0, 1.0, leaf.centerZ);
    diagLower.rotation.x = diagAngleLower;
    diagLower.castShadow = true;
    leafGroup.add(diagLower);

    const diagUpper = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, diagLen), gateIronMat);
    diagUpper.position.set(55.0, 2.55, leaf.centerZ);
    diagUpper.rotation.x = diagAngleUpper;
    diagUpper.castShadow = true;
    leafGroup.add(diagUpper);

    // Vertical security pickets (10 pickets per leaf, spaced every 0.30m)
    for (let i = 0; i < 10; i++) {
      const pz = leaf.centerZ - 1.35 + i * 0.30;
      const picket = new THREE.Mesh(new THREE.BoxGeometry(0.04, 3.26, 0.04), gateIronMat);
      picket.position.set(55.0, 1.82, pz);
      picket.castShadow = true;
      leafGroup.add(picket);

      // Spearpoint finial on top of each picket
      const finial = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 4), gateIronMat);
      finial.position.set(55.0, 3.52, pz);
      finial.rotation.y = Math.PI / 4;
      leafGroup.add(finial);
    }

    // Bottom caster / ground support wheel under outer meeting stile
    const wheelZ = leaf.meetingZ - (leaf.diagDir * 0.08);
    const wheelBracket = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.08), gateHardwareMat);
    wheelBracket.position.set(55.0, 0.17, wheelZ);
    leafGroup.add(wheelBracket);

    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 16), rubberWheelMat);
    wheel.position.set(55.0, 0.09, wheelZ);
    wheel.rotation.z = Math.PI / 2;
    wheel.castShadow = true;
    leafGroup.add(wheel);
  
    // Swing about the hinge post: the pivot sits at the hinge, the leaf's parts keep their world positions
    const pivot = new THREE.Group();
    pivot.position.set(55.0, 0, leaf.hingeZ);
    leafGroup.position.set(-55.0, 0, -leaf.hingeZ);
    pivot.add(leafGroup);
    scene.add(pivot);
    pivot.userData.dir = leaf.name === "north" ? -1 : 1; // both leaves swing in toward campus
    vehicleGateLeaves.push(pivot);
  }

  // 4) Center meeting & locking hardware at z = 58.0
  // Embedded steel ground stop socket receiver plate
  const groundStop = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.5), gateHardwareMat);
  groundStop.position.set(55.0, 0.015, 58.0);
  scene.add(groundStop);

  // Dual vertical cane bolts (drop rods) locked into the ground socket
  for (const crz of [57.92, 58.08]) {
    // Vertical rod
    const caneBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.85, 10), gateHardwareMat);
    caneBolt.position.set(54.95, 0.45, crz);
    caneBolt.castShadow = true;
    vehicleGateLeaves[0].children[0].add(caneBolt);

    // L-shaped handle at top
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.12), gateHardwareMat);
    handle.position.set(54.95, 0.88, crz + (crz === 57.92 ? 0.04 : -0.04));
    vehicleGateLeaves[0].children[0].add(handle);

    // Guide brackets clamping cane bolt to meeting stile
    for (const by of [0.3, 0.7]) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.06), gateHardwareMat);
      bracket.position.set(54.96, by, crz);
      vehicleGateLeaves[0].children[0].add(bracket);
    }
  }

  // Center horizontal slide latch bar locking across both meeting stiles
  const latchBar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.46), gateHardwareMat);
  latchBar.position.set(54.95, 1.75, 58.0);
  latchBar.castShadow = true;
  vehicleGateLeaves[0].children[0].add(latchBar);

  // Heavy brass industrial padlock securing the latch
  const padlockBody = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.05), brassPadlockMat);
  padlockBody.position.set(54.93, 1.68, 58.0);
  padlockBody.castShadow = true;
  const padlockShackle = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 8, 16, Math.PI), gateHardwareMat);
  padlockShackle.position.set(54.93, 1.72, 58.0);
  padlockShackle.rotation.z = Math.PI;
  vehicleGateLeaves[0].children[0].add(padlockBody, padlockShackle);

  // 5) Reflective warning sign: "EMERGENCY VEHICLE ACCESS - KEEP CLEAR - DO NOT BLOCK GATE"
  function makeGateSignTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 512, 256);

    ctx.fillStyle = "#dc2626";
    ctx.fillRect(0, 0, 512, 68);

    ctx.lineWidth = 10;
    ctx.strokeStyle = "#dc2626";
    ctx.strokeRect(6, 6, 500, 244);

    ctx.fillStyle = "#dc2626";
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(15 + i * 24, 248);
      ctx.lineTo(27 + i * 24, 248);
      ctx.lineTo(7 + i * 24, 214);
      ctx.lineTo(0 + i * 24, 214);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(512 - (15 + i * 24), 248);
      ctx.lineTo(512 - (27 + i * 24), 248);
      ctx.lineTo(512 - (7 + i * 24), 214);
      ctx.lineTo(512 - (0 + i * 24), 214);
      ctx.fill();
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("EMERGENCY VEHICLE ACCESS", 256, 34);

    ctx.fillStyle = "#0f172a";
    ctx.font = "900 48px sans-serif";
    ctx.fillText("KEEP CLEAR", 256, 120);

    ctx.fillStyle = "#dc2626";
    ctx.font = "bold 25px sans-serif";
    ctx.fillText("DO NOT BLOCK GATE", 256, 172);

    ctx.fillStyle = "#475569";
    ctx.font = "600 17px sans-serif";
    ctx.fillText("AUTHORIZED VEHICLES ONLY", 256, 215);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  }

  const signTex = makeGateSignTexture();
  const signBacking = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.62, 1.05), gateHardwareMat);
  signBacking.position.set(55.0, 2.05, 58.0);
  vehicleGateLeaves[0].children[0].add(signBacking); // the warning sign is on the gate: it swings with it

  // Campus-facing sign (faces -X toward basketball court)
  const signFaceCampus = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.58),
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 })
  );
  signFaceCampus.position.set(54.94, 2.05, 58.0);
  signFaceCampus.rotation.y = -Math.PI / 2;
  vehicleGateLeaves[0].children[0].add(signFaceCampus);

  // Street-facing sign (faces +X toward outside)
  const signFaceStreet = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.58),
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 })
  );
  signFaceStreet.position.set(55.06, 2.05, 58.0);
  signFaceStreet.rotation.y = Math.PI / 2;
  vehicleGateLeaves[0].children[0].add(signFaceStreet);

  // --- 2e-2) Parking Lot North Sliding Gate (Industrial Cantilever Sliding Gate) ---
  // Located on the north perimeter fence at z = -23.0, spanning x in [-45.4, -38.6] (width: 6.8m).
  // Matches the heavy-duty style of the east vehicle gate, rendered in an OPEN position
  // (slid back to the west along its ground track/cantilever rollers) so cars can enter the parking lot.

  // 1) Concrete driveway apron & threshold under the gate opening
  const northApron = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.03, 6.0), drivewayApronMat);
  northApron.position.set(-42.0, 0.022, -23.0);
  northApron.receiveShadow = true;
  scene.add(northApron);

  // Inverted V-groove ground track embedded into the pavement running from catch post past the gantry to the end stop
  const groundTrack = new THREE.Mesh(new THREE.BoxGeometry(14.0, 0.016, 0.06), gateHardwareMat);
  groundTrack.position.set(-45.6, 0.028, -23.0);
  groundTrack.receiveShadow = true;
  scene.add(groundTrack);

  // Safety yellow hazard pavement markings flanking the entrance
  const northStripeBorderWest = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.005, 3.0), safetyYellowMat);
  northStripeBorderWest.position.set(-45.4, 0.025, -21.5);
  const northStripeBorderEast = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.005, 3.0), safetyYellowMat);
  northStripeBorderEast.position.set(-38.6, 0.025, -21.5);
  const northStripeLimit = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.005, 0.12), safetyYellowMat);
  northStripeLimit.position.set(-42.0, 0.025, -20.0);
  scene.add(northStripeBorderWest, northStripeBorderEast, northStripeLimit);

  // Diagonal hazard stripes across the entrance apron
  for (let xOffset = -3.0; xOffset <= 3.0; xOffset += 1.0) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.005, 0.12), safetyYellowMat);
    stripe.position.set(-42.0 + xOffset, 0.025, -21.5);
    stripe.rotation.y = Math.PI / 4;
    scene.add(stripe);
  }

  // 2) Terminal Catch / Receiver Post on East side of opening (x = -38.6, z = -23.0)
  const catchPost = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.8, 0.24), gatePostMat);
  catchPost.position.set(-38.6, 1.9, -23.0);
  catchPost.castShadow = true;
  scene.add(catchPost);

  const catchCap = new THREE.Mesh(new THREE.ConeGeometry(0.20, 0.16, 4), gatePostMat);
  catchCap.position.set(-38.6, 3.88, -23.0);
  catchCap.rotation.y = Math.PI / 4;
  scene.add(catchCap);

  const catchBase = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.36), gatePostMat);
  catchBase.position.set(-38.6, 0.04, -23.0);
  scene.add(catchBase);

  // Receiver catch channel and rubber stop on catch post
  const catchChannel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.1, 0.16), gateHardwareMat);
  catchChannel.position.set(-38.7, 1.8, -23.0);
  catchChannel.castShadow = true;
  const catchBumper = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.1), rubberWheelMat);
  catchBumper.position.set(-38.68, 1.8, -23.0);
  scene.add(catchChannel, catchBumper);

  // 3) Dual Guide Gantry Posts on West side of opening (x = -45.4, z = -23.0)
  // Flanking the sliding gate leaf on inner (-Z) and outer (+Z) sides
  for (const gz of [-23.14, -22.86]) {
    const gantryPost = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.8, 0.18), gatePostMat);
    gantryPost.position.set(-45.4, 1.9, gz);
    gantryPost.castShadow = true;
    scene.add(gantryPost);

    const gCap = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.14, 4), gatePostMat);
    gCap.position.set(-45.4, 3.86, gz);
    gCap.rotation.y = Math.PI / 4;
    scene.add(gCap);

    const gBase = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.28), gatePostMat);
    gBase.position.set(-45.4, 0.04, gz);
    scene.add(gBase);
  }

  // Overhead gantry bridge connector bar
  const gantryBridge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.46), gatePostMat);
  gantryBridge.position.set(-45.4, 3.65, -23.0);
  gantryBridge.castShadow = true;
  scene.add(gantryBridge);

  // Dual nylon guide rollers sandwiching the top rail of the sliding gate
  for (const ry of [1.75, 3.35]) {
    for (const rz of [-23.08, -22.92]) {
      const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.08, 12), gateHardwareMat);
      roller.position.set(-45.4, ry, rz);
      roller.castShadow = true;
      scene.add(roller);
    }
  }

  // Commercial gate electric motor operator cabinet (mounted near gantry post inside the lot)
  const operatorBox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.82, 0.38), new THREE.MeshStandardMaterial({ color: 0x242c38, roughness: 0.6, metalness: 0.5 }));
  operatorBox.position.set(-45.85, 0.45, -22.6);
  operatorBox.castShadow = true;
  scene.add(operatorBox);

  const strobeLight = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 12), new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.6 }));
  strobeLight.position.set(-45.85, 0.9, -22.6);
  scene.add(strobeLight);

  // 4) Far West End Stop Post (x = -52.4, z = -23.0)
  const endStopPost = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.4, 0.16), gatePostMat);
  endStopPost.position.set(-52.4, 0.7, -23.0);
  endStopPost.castShadow = true;
  scene.add(endStopPost);

  const endBumper = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.12), rubberWheelMat);
  endBumper.position.set(-52.32, 0.7, -23.0);
  scene.add(endBumper);

  // 5) The Cantilever Sliding Gate Leaf (Rendered in the OPEN Position!)
  // Length: 7.2m. Slid back to the west by 5.4m:
  // Front nose is at x = -44.0 (leaving a wide ~5.4m clear open driveway from -44.0 to -38.6).
  // Back tail extends to x = -51.2, supported between the guide gantry posts.
  const gateLength = 7.2;
  const gateCenterX = -47.6;
  const gateZ = -23.0;

  // Horizontal rails: bottom, middle, top
  for (const ry of [0.25, 1.75, 3.35]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(gateLength, 0.08, 0.08), gateIronMat);
    rail.position.set(gateCenterX, ry, gateZ);
    rail.castShadow = true;
    scene.add(rail);
  }

  // Vertical stiles: nose, tail, and intermediate vertical mullions
  const stileXs = [-44.0, -45.8, -47.6, -49.4, -51.2];
  for (const sx of stileXs) {
    const stile = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.18, 0.08), gateIronMat);
    stile.position.set(sx, 1.8, gateZ);
    stile.castShadow = true;
    scene.add(stile);
  }

  // Diagonal structural truss cross-bracing in each of the 4 panel bays
  const bayWidth = 1.8;
  const diagLen = Math.hypot(bayWidth, 1.5);
  for (let i = 0; i < 4; i++) {
    const bayCenter = -44.0 - (i + 0.5) * bayWidth;
    const dir = i % 2 === 0 ? 1 : -1;
    const diagAngle = dir * Math.atan2(1.5, bayWidth);

    const diagLower = new THREE.Mesh(new THREE.BoxGeometry(diagLen, 0.06, 0.06), gateIronMat);
    diagLower.position.set(bayCenter, 1.0, gateZ);
    diagLower.rotation.z = diagAngle;
    diagLower.castShadow = true;
    scene.add(diagLower);

    const diagUpper = new THREE.Mesh(new THREE.BoxGeometry(diagLen, 0.06, 0.06), gateIronMat);
    diagUpper.position.set(bayCenter, 2.55, gateZ);
    diagUpper.rotation.z = -diagAngle;
    diagUpper.castShadow = true;
    scene.add(diagUpper);
  }

  // Vertical pickets with spear finial tips every 0.35m along the gate panel
  const pMinX = -51.1;
  const pMaxX = -44.1;
  for (let px = pMinX; px <= pMaxX; px += 0.35) {
    const picket = new THREE.Mesh(new THREE.BoxGeometry(0.04, 3.2, 0.04), gateIronMat);
    picket.position.set(px, 1.8, gateZ);
    picket.castShadow = true;
    scene.add(picket);

    // Spear tip
    const spear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 4), gateIronMat);
    spear.position.set(px, 3.47, gateZ);
    spear.rotation.y = Math.PI / 4;
    scene.add(spear);
  }

  // Heavy steel V-groove wheel assemblies under bottom rail resting on ground track
  for (const wx of [-44.6, -50.6]) {
    const wheelBracket = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.12), gateHardwareMat);
    wheelBracket.position.set(wx, 0.15, gateZ);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 16), rubberWheelMat);
    wheel.position.set(wx, 0.07, gateZ);
    wheel.rotation.z = Math.PI / 2;
    wheel.castShadow = true;
    scene.add(wheelBracket, wheel);
  }

  // Reflective sign mounted on the gantry post: "STAFF & VISITOR PARKING - CAUTION: AUTOMATIC GATE"
  function makeSlidingGateSignTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 512, 256);

    ctx.fillStyle = "#1e3a8a"; // Blue header bar
    ctx.fillRect(0, 0, 512, 68);

    ctx.lineWidth = 10;
    ctx.strokeStyle = "#1e3a8a";
    ctx.strokeRect(6, 6, 500, 244);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PARKING LOT ENTRANCE", 256, 36);

    ctx.fillStyle = "#111827";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText("CAUTION: AUTOMATIC GATE", 256, 110);

    ctx.fillStyle = "#dc2626";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText("MAX SPEED 5 MPH", 256, 160);

    ctx.fillStyle = "#4b5563";
    ctx.font = "16px sans-serif";
    ctx.fillText("STAFF & VISITORS ONLY", 256, 212);

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  const slidingSignTex = makeSlidingGateSignTexture();
  const slidingSignBacking = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.52, 0.03), gateHardwareMat);
  slidingSignBacking.position.set(-45.4, 2.2, -22.75);
  const slidingSignFace = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.48), new THREE.MeshStandardMaterial({ map: slidingSignTex, roughness: 0.3 }));
  slidingSignFace.position.set(-45.4, 2.2, -22.73);
  scene.add(slidingSignBacking, slidingSignFace);

  // Perimeter collision solids (continuous line around perimeter, with posts flanking gates)
  buildingSolids.push(
    { x: (-53.5 + -45.4) / 2, z: -23.0, w: 8.1, d: 0.35, yBase: 0, yTop: 3.6 }, // North-West fence
    { x: (-38.6 + 55.0) / 2, z: -23.0, w: 93.6, d: 0.35, yBase: 0, yTop: 3.6 }, // North-East fence
    { x: -38.6, z: -23.0, w: 0.35, d: 0.35, yBase: 0, yTop: 3.8 },               // Sliding gate catch post
    { x: -45.4, z: -23.0, w: 0.45, d: 0.5, yBase: 0, yTop: 3.8 },                // Sliding gate gantry posts
    { x: -47.6, z: -23.0, w: 7.2, d: 0.25, yBase: 0, yTop: 3.6 },                 // Parked open sliding gate
    { x: 55.0, z: 15.8, w: 0.35, d: 77.6, yBase: 0, yTop: 3.6 }, // East North fence: [-23.0, 54.6]
    { x: 55.0, z: 58.0, w: 0.35, d: 6.8, yBase: 0, yTop: 3.6 },  // East vehicle gate: [54.6, 61.4]
    { x: 55.0, z: 63.45, w: 0.35, d: 4.1, yBase: 0, yTop: 3.6 }, // East South corner link: [61.4, 65.5]
    { x: 0.75, z: 65.42, w: 108.5, d: 0.50, yBase: 0, yTop: 4.15 }, // South white brick perimeter wall
    { x: -53.42, z: 21.25, w: 0.50, d: 88.5, yBase: 0, yTop: 4.15 }  // West white brick perimeter wall
  );

  // --- 2e) Organic Plant Hedge System (Branches, Foliage Clusters & Leaves) ---
  // A realistic botanical shrub generator creating living hedge bushes with visible
  // woody branches/trunks at the base and interior, layered multi-tiered foliage mounds,
  // individual leaf texture detailing with veins and highlights, and organic variation.
  function makeHedgeLeafTexture(tone: number): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;

    // Deep interior foliage shadow background
    const bgTones = ["#133718", "#173f1d", "#1a421b", "#123315"];
    ctx.fillStyle = bgTones[tone % bgTones.length];
    ctx.fillRect(0, 0, 512, 512);

    const leafPalettes = [
      // 0: Classic lush emerald privet
      { base: "#1e5422", mid: "#2a7530", high: "#43a34a", vein: "rgba(187,247,208,0.50)" },
      // 1: Vibrant sunlit garden leaf
      { base: "#27612a", mid: "#36853a", high: "#58bf5f", vein: "rgba(220,252,231,0.55)" },
      // 2: Warm golden-olive boxwood
      { base: "#2a5921", mid: "#3e792e", high: "#67b54e", vein: "rgba(217,249,157,0.50)" },
      // 3: Deep forest hedge
      { base: "#184a1e", mid: "#236629", high: "#3b9143", vein: "rgba(167,243,208,0.45)" },
    ];
    const pal = leafPalettes[tone % leafPalettes.length];

    // Draw layered realistic leaf sprigs
    const numLeaves = 460;
    for (let i = 0; i < numLeaves; i++) {
      const lx = (Math.sin(i * 127.1) * 0.5 + 0.5) * 512;
      const ly = (Math.cos(i * 311.7) * 0.5 + 0.5) * 512;
      const angle = (i * 0.618) * Math.PI * 2;
      const len = 15 + (i % 8) * 2.2;
      const wid = len * 0.46;

      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(angle);

      // Cast drop shadow underneath leaf
      ctx.fillStyle = "rgba(8, 20, 10, 0.40)";
      ctx.beginPath();
      ctx.ellipse(1.5, 2.5, wid * 0.9, len * 0.48, 0, 0, Math.PI * 2);
      ctx.fill();

      // Leaf blade with pointed tip
      ctx.fillStyle = i % 3 === 0 ? pal.high : (i % 2 === 0 ? pal.mid : pal.base);
      ctx.beginPath();
      ctx.moveTo(0, -len * 0.52);
      ctx.quadraticCurveTo(wid, -len * 0.08, 0, len * 0.52);
      ctx.quadraticCurveTo(-wid, -len * 0.08, 0, -len * 0.52);
      ctx.fill();

      // Dark edge contour
      ctx.strokeStyle = "rgba(12, 35, 14, 0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Bright central vein
      ctx.strokeStyle = pal.vein;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(0, len * 0.46);
      ctx.lineTo(0, -len * 0.44);
      ctx.stroke();

      // Subtle lateral veins
      ctx.lineWidth = 0.8;
      for (let v = -0.22; v <= 0.22; v += 0.18) {
        ctx.beginPath();
        ctx.moveTo(0, len * v);
        ctx.lineTo(wid * 0.5, len * (v - 0.1));
        ctx.moveTo(0, len * v);
        ctx.lineTo(-wid * 0.5, len * (v - 0.1));
        ctx.stroke();
      }

      ctx.restore();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // 4 varied leaf materials for realistic botanical diversity
  const hedgeLeafMats = [0, 1, 2, 3].map((t) => {
    const tex = makeHedgeLeafTexture(t);
    tex.repeat.set(1.5, 1.5);
    return new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.85,
      metalness: 0.04,
    });
  });

  // Woody branches and gnarled bark material
  const hedgeBarkMat = new THREE.MeshStandardMaterial({
    color: 0x4d3829,
    map: makeNoiseTexture("#4a3728", 8, 8),
    roughness: 0.95,
  });

  // Dark organic planting soil / garden mulch texture
  function makeDirtTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;

    // Rich dark brown organic compost soil base
    ctx.fillStyle = "#2d1e12";
    ctx.fillRect(0, 0, 512, 512);

    // Layered wood mulch chips, peat moss, and rich dark soil flecks
    const numParticles = 1400;
    for (let i = 0; i < numParticles; i++) {
      const px = Math.random() * 512;
      const py = Math.random() * 512;
      const size = 2 + Math.random() * 6;
      const isMulch = Math.random() > 0.35;
      const shade = Math.random();

      if (isMulch) {
        // Wood mulch chips
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(Math.random() * Math.PI);
        ctx.fillStyle = shade < 0.3 ? "#4a3321" : (shade < 0.7 ? "#3a2414" : "#22150b");
        ctx.fillRect(-size * 1.4, -size * 0.4, size * 2.8, size * 0.8);
        ctx.restore();
      } else {
        // Organic soil grains and fine gravel
        ctx.fillStyle = shade < 0.4 ? "#3d2919" : (shade < 0.8 ? "#523821" : "#1a1007");
        ctx.beginPath();
        ctx.arc(px, py, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const dirtBedTex = makeDirtTexture();
  dirtBedTex.repeat.set(2.0, 30.0);
  const dirtBedMat = new THREE.MeshStandardMaterial({
    map: dirtBedTex,
    roughness: 0.95,
  });

  // Shared geometry primitives
  const clusterIcoGeo = new THREE.IcosahedronGeometry(1.0, 1);
  const branchCylGeo = new THREE.CylinderGeometry(1.0, 1.4, 1.0, 6);
  const twigCylGeo = new THREE.CylinderGeometry(0.7, 1.0, 1.0, 5);

  function createPlantBush(
    targetW: number,
    targetH: number,
    targetD: number,
    seed: number
  ): THREE.Group {
    const bush = new THREE.Group();

    function rVal(s: number): number {
      const v = Math.sin(seed * 41.23 + s * 17.89) * 43758.5453;
      return v - Math.floor(v);
    }

    // Natural organic dimensions (slight unique variance per bush)
    const h = targetH * (0.97 + rVal(1) * 0.06);
    const w = targetW * (0.95 + rVal(2) * 0.10);
    const d = targetD * (0.95 + rVal(3) * 0.10);

    // Organic planting dirt mound at the base where branches emerge
    const moundRadius = Math.max(w, d) * 0.44;
    const soilMound = new THREE.Mesh(
      new THREE.CylinderGeometry(moundRadius * 0.72, moundRadius, 0.05, 10),
      dirtBedMat
    );
    soilMound.position.set(0, 0.025, 0);
    soilMound.receiveShadow = true;
    bush.add(soilMound);

    // Primary & secondary leaf material choices for this bush
    const matA = hedgeLeafMats[Math.floor(rVal(4) * 4)];
    const matB = hedgeLeafMats[Math.floor(rVal(5) * 4)];

    // 1) Woody Trunks & Branches emerging from the ground
    const numTrunks = 3 + Math.floor(rVal(6) * 2); // 3 to 4 woody canes
    for (let k = 0; k < numTrunks; k++) {
      const kSeed = k * 5.1;
      const baseX = (rVal(kSeed + 7) - 0.5) * w * 0.45;
      const baseZ = (rVal(kSeed + 8) - 0.5) * d * 0.50;
      const trunkH = h * (0.42 + rVal(kSeed + 9) * 0.28);
      const tiltX = (rVal(kSeed + 10) - 0.5) * 0.22;
      const tiltZ = (rVal(kSeed + 11) - 0.5) * 0.22;
      const rBase = 0.032 + rVal(kSeed + 12) * 0.012;

      const trunk = new THREE.Mesh(branchCylGeo, hedgeBarkMat);
      trunk.scale.set(rBase, trunkH, rBase);
      trunk.position.set(baseX + tiltX * trunkH * 0.5, trunkH * 0.5, baseZ + tiltZ * trunkH * 0.5);
      trunk.rotation.z = tiltX;
      trunk.rotation.x = tiltZ;
      trunk.castShadow = true;
      bush.add(trunk);

      // Angled branch splitting off into foliage
      const twigLen = h * (0.22 + rVal(kSeed + 13) * 0.16);
      const twig = new THREE.Mesh(twigCylGeo, hedgeBarkMat);
      const rTwig = rBase * 0.65;
      twig.scale.set(rTwig, twigLen, rTwig);
      const splitY = trunkH * (0.45 + rVal(kSeed + 14) * 0.25);
      const branchAngleX = (rVal(kSeed + 15) - 0.5) * 0.75;
      const branchAngleZ = (rVal(kSeed + 16) - 0.5) * 0.75;
      twig.position.set(
        baseX + tiltX * splitY + branchAngleX * twigLen * 0.4,
        splitY + twigLen * 0.4,
        baseZ + tiltZ * splitY + branchAngleZ * twigLen * 0.4
      );
      twig.rotation.z = branchAngleX;
      twig.rotation.x = branchAngleZ;
      twig.castShadow = true;
      bush.add(twig);
    }

    // 2) Layered Organic Foliage Mounds (Multi-Cluster Canopy)
    const clusterConfigs = [
      // [xFactor, yFactor, zFactor, rx, ry, rz, useMatB]
      // Lower tier (nestled among lower branches, leaving ground trunks exposed below)
      [-0.16, 0.38, -0.22, w * 0.42, h * 0.18, d * 0.40, false],
      [0.18, 0.42, 0.20, w * 0.44, h * 0.20, d * 0.42, true],
      // Mid tier (filling the lush body)
      [-0.10, 0.58, 0.14, w * 0.48, h * 0.24, d * 0.46, false],
      [0.12, 0.64, -0.16, w * 0.46, h * 0.23, d * 0.45, true],
      // Upper tier (shoulders)
      [-0.12, 0.80, -0.10, w * 0.44, h * 0.20, d * 0.42, true],
      [0.10, 0.84, 0.12, w * 0.42, h * 0.21, d * 0.40, false],
      // Top crown (crest reaching top height)
      [0.00, 0.94, 0.00, w * 0.40, h * 0.16, d * 0.38, false],
      // Protruding leafy breakout tufts (creates feathery, organic plant silhouette)
      [-0.32, 0.52, 0.00, w * 0.22, h * 0.12, d * 0.26, true],
      [0.34, 0.70, 0.08, w * 0.22, h * 0.12, d * 0.26, false],
      [0.00, 0.88, -0.30, w * 0.26, h * 0.13, d * 0.22, true],
      [0.00, 0.92, 0.32, w * 0.26, h * 0.13, d * 0.22, false],
    ];

    for (let c = 0; c < clusterConfigs.length; c++) {
      const cfg = clusterConfigs[c];
      const cSeed = c * 7.3;
      const jx = (rVal(cSeed + 20) - 0.5) * 0.08;
      const jy = (rVal(cSeed + 21) - 0.5) * 0.04;
      const jz = (rVal(cSeed + 22) - 0.5) * 0.08;

      const cluster = new THREE.Mesh(clusterIcoGeo, cfg[6] ? matB : matA);
      cluster.scale.set(
        (cfg[3] as number) * (0.92 + rVal(cSeed + 23) * 0.16),
        (cfg[4] as number) * (0.92 + rVal(cSeed + 24) * 0.16),
        (cfg[5] as number) * (0.92 + rVal(cSeed + 25) * 0.16)
      );
      cluster.position.set(
        (cfg[0] as number) * w + jx,
        (cfg[1] as number) * h + jy,
        (cfg[2] as number) * d + jz
      );
      cluster.rotation.set(
        rVal(cSeed + 26) * Math.PI,
        rVal(cSeed + 27) * Math.PI,
        rVal(cSeed + 28) * Math.PI
      );
      cluster.castShadow = true;
      cluster.receiveShadow = true;
      bush.add(cluster);
    }

    return bush;
  }

  // Build East Fence Green Hedge Row
  const eastHedge = (layoutData as any).eastHedge ?? {
    x: 54.45,
    minZ: -22.5,
    maxZ: 54.4,
    width: 0.85,
    height: 2.7,
    gap: 0.35,
  };

  const hedgeGap = eastHedge.gap ?? 0.35;
  const hedgeLen = eastHedge.maxZ - eastHedge.minZ;
  const hedgeSegmentLen = 1.6;
  const numHedgeSegments = Math.round(hedgeLen / hedgeSegmentLen);
  const actualSegLen = hedgeLen / numHedgeSegments;
  const bushLen = actualSegLen - hedgeGap;

  const hedgeGroup = new THREE.Group();
  for (let i = 0; i < numHedgeSegments; i++) {
    const segCenterZ = eastHedge.minZ + actualSegLen * (i + 0.5);
    const bush = createPlantBush(eastHedge.width, eastHedge.height, bushLen, i * 7.31);
    bush.position.set(eastHedge.x, 0, segCenterZ);
    hedgeGroup.add(bush);
  }
  scene.add(hedgeGroup);

  // Planter bed of rich dark organic soil beneath the east hedges
  const eastDirtBed = new THREE.Mesh(
    new THREE.BoxGeometry(eastHedge.width + 0.35, 0.035, hedgeLen + 0.6),
    dirtBedMat
  );
  eastDirtBed.position.set(eastHedge.x, 0.022, (eastHedge.minZ + eastHedge.maxZ) / 2);
  eastDirtBed.receiveShadow = true;
  scene.add(eastDirtBed);

  // Collision solid so player cannot walk inside the hedges
  buildingSolids.push({
    x: eastHedge.x,
    z: (eastHedge.minZ + eastHedge.maxZ) / 2,
    w: eastHedge.width,
    d: hedgeLen,
    yBase: 0,
    yTop: eastHedge.height,
  });

  // --- 2f) White Brick Perimeter Wall (South & West Boundaries) ---
  // A stately white brick perimeter security wall enclosing the south and west boundaries
  // where the fence was removed. Begins at the south-eastern corner (55.0, 65.42) where it
  // joins the East red fence, extends all across the south perimeter to the south-western
  // corner (-53.42, 65.42), and continues seamlessly all across the west perimeter to
  // the north-western corner (-53.42, -23.0) where it connects to the North-West fence.
  // Built to 3.88m with a stone coping cap reaching 4.0m (with pilasters and corner piers to 4.18m).
  // Features large-format architectural white masonry blocks (~71cm x 22cm) with deep, crisp mortar joints.
  function makeWhiteBrickTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;

    // Limestone mortar background
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(0, 0, 512, 512);

    // Large-format bricks: 8 courses high (64px each), 4 bricks wide per row (128px each)
    const rows = 8;
    const rowHeight = 512 / rows; // 64px per course
    const brickWidth = 128; // 128px per brick
    const mortar = 6; // Deep, bold 6px mortar joint

    for (let r = 0; r < rows; r++) {
      const y = r * rowHeight;
      const isStaggered = r % 2 === 1;
      const xOffset = isStaggered ? -(brickWidth / 2) : 0;
      const numCols = Math.ceil(512 / brickWidth) + 2;

      for (let c = 0; c < numCols; c++) {
        const x = xOffset + c * brickWidth;
        const bw = brickWidth - mortar;
        const bh = rowHeight - mortar;

        // Elegant variations of clean architectural white
        const rnd = Math.random();
        let rVal = 246;
        let gVal = 248;
        let bVal = 250;
        if (rnd < 0.22) {
          // Soft alabaster / pearl
          rVal = 240; gVal = 243; bVal = 247;
        } else if (rnd < 0.45) {
          // Warm ivory / bone white
          rVal = 253; gVal = 251; bVal = 247;
        } else if (rnd > 0.82) {
          // Brilliant clean white
          rVal = 255; gVal = 255; bVal = 255;
        } else {
          // Pure modern white
          rVal = 248; gVal = 250; bVal = 252;
        }

        ctx.fillStyle = `rgb(${rVal},${gVal},${bVal})`;
        ctx.fillRect(x + mortar, y + mortar, bw, bh);

        // Chiseled stone edge bevels:
        // Strong bottom and right shadow for deep 3D mortar recession
        ctx.fillStyle = "rgba(51, 65, 85, 0.32)";
        ctx.fillRect(x + mortar, y + rowHeight - mortar - 3, bw, 3);
        ctx.fillRect(x + brickWidth - mortar - 3, y + mortar, 3, bh);

        // Soft secondary shadow
        ctx.fillStyle = "rgba(71, 85, 105, 0.16)";
        ctx.fillRect(x + mortar, y + rowHeight - mortar - 6, bw, 3);
        ctx.fillRect(x + brickWidth - mortar - 6, y + mortar, 3, bh);

        // Crisp top and left specular highlight
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.fillRect(x + mortar, y + mortar, bw, 2.5);
        ctx.fillRect(x + mortar, y + mortar, 2.5, bh);

        // Subtle natural masonry surface grain
        for (let n = 0; n < 8; n++) {
          const nx = x + mortar + Math.random() * (bw - 3);
          const ny = y + mortar + Math.random() * (bh - 3);
          ctx.fillStyle = Math.random() > 0.5 ? "rgba(203, 213, 225, 0.5)" : "rgba(255, 255, 255, 0.8)";
          ctx.fillRect(nx, ny, 2, 2);
        }
      }
    }

    // Faint dark center line in mortar joints for realistic depth
    ctx.strokeStyle = "rgba(30, 41, 59, 0.35)";
    ctx.lineWidth = 1.5;
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * rowHeight + mortar / 2);
      ctx.lineTo(512, r * rowHeight + mortar / 2);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // Large-format repeats: ~71cm wide x 22cm high per brick
  const whiteBrickTexSouth = makeWhiteBrickTexture();
  whiteBrickTexSouth.repeat.set(38, 2.2);

  const whiteBrickTexWest = makeWhiteBrickTexture();
  whiteBrickTexWest.repeat.set(31, 2.2);

  const pilasterBrickTex = makeWhiteBrickTexture();
  pilasterBrickTex.repeat.set(0.55, 2.2);

  const southBrickMat = new THREE.MeshStandardMaterial({
    map: whiteBrickTexSouth,
    roughness: 0.82,
    metalness: 0.05,
  });

  const westBrickMat = new THREE.MeshStandardMaterial({
    map: whiteBrickTexWest,
    roughness: 0.82,
    metalness: 0.05,
  });

  const pilasterMat = new THREE.MeshStandardMaterial({
    map: pilasterBrickTex,
    roughness: 0.82,
    metalness: 0.05,
  });

  // Coping stone material (dressed limestone top cap)
  const copingMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.65,
    metalness: 0.08,
  });

  // Base trim / footing course
  const basePlinthMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.75,
    metalness: 0.05,
  });

  const whiteWallGroup = new THREE.Group();

  const WALL_H = 3.88;
  const COPING_H = 0.12;
  const BASE_H = 0.18;
  const WALL_THICK = 0.32;
  const COPING_THICK = 0.38;
  const BASE_THICK = 0.36;

  // 1) South Wall: x in [-53.5, 55.0] (len: 108.5m), z: 65.42
  const southWallLen = 108.5;
  const southWallCenterX = 0.75;
  const southWallZ = 65.42;

  const southWallBody = new THREE.Mesh(
    new THREE.BoxGeometry(southWallLen, WALL_H, WALL_THICK),
    southBrickMat
  );
  southWallBody.position.set(southWallCenterX, WALL_H / 2, southWallZ);
  southWallBody.castShadow = true;
  southWallBody.receiveShadow = true;

  const southCoping = new THREE.Mesh(
    new THREE.BoxGeometry(southWallLen, COPING_H, COPING_THICK),
    copingMat
  );
  southCoping.position.set(southWallCenterX, WALL_H + COPING_H / 2, southWallZ);
  southCoping.castShadow = true;
  southCoping.receiveShadow = true;

  const southBase = new THREE.Mesh(
    new THREE.BoxGeometry(southWallLen, BASE_H, BASE_THICK),
    basePlinthMat
  );
  southBase.position.set(southWallCenterX, BASE_H / 2, southWallZ);
  southBase.receiveShadow = true;

  whiteWallGroup.add(southWallBody, southCoping, southBase);

  // 2) West Wall: z in [-23.0, 65.5] (len: 88.5m), x: -53.42
  const westWallLen = 88.5;
  const westWallCenterZ = 21.25;
  const westWallX = -53.42;

  const westWallBody = new THREE.Mesh(
    new THREE.BoxGeometry(WALL_THICK, WALL_H, westWallLen),
    westBrickMat
  );
  westWallBody.position.set(westWallX, WALL_H / 2, westWallCenterZ);
  westWallBody.castShadow = true;
  westWallBody.receiveShadow = true;

  const westCoping = new THREE.Mesh(
    new THREE.BoxGeometry(COPING_THICK, COPING_H, westWallLen),
    copingMat
  );
  westCoping.position.set(westWallX, WALL_H + COPING_H / 2, westWallCenterZ);
  westCoping.castShadow = true;
  westCoping.receiveShadow = true;

  const westBase = new THREE.Mesh(
    new THREE.BoxGeometry(BASE_THICK, BASE_H, westWallLen),
    basePlinthMat
  );
  westBase.position.set(westWallX, BASE_H / 2, westWallCenterZ);
  westBase.receiveShadow = true;

  whiteWallGroup.add(westWallBody, westCoping, westBase);

  // 3) Buttress Pilasters along South Wall (15 pilasters, protruding slightly into campus)
  const numSouthPilasters = 15;
  const pSouthW = 0.42;
  const pSouthD = 0.38;
  const pBodyGeoSouth = new THREE.BoxGeometry(pSouthW, WALL_H + 0.06, pSouthD);
  const pCapGeoSouth = new THREE.BoxGeometry(pSouthW + 0.06, COPING_H, pSouthD + 0.06);

  for (let i = 0; i < numSouthPilasters; i++) {
    const px = -48.0 + i * (98.0 / (numSouthPilasters - 1));
    const pilasterMesh = new THREE.Mesh(pBodyGeoSouth, pilasterMat);
    pilasterMesh.position.set(px, (WALL_H + 0.06) / 2, southWallZ - 0.04);
    pilasterMesh.castShadow = true;
    pilasterMesh.receiveShadow = true;

    const capMesh = new THREE.Mesh(pCapGeoSouth, copingMat);
    capMesh.position.set(px, WALL_H + 0.06 + COPING_H / 2, southWallZ - 0.04);
    capMesh.castShadow = true;
    capMesh.receiveShadow = true;

    whiteWallGroup.add(pilasterMesh, capMesh);
  }

  // 4) Buttress Pilasters along West Wall (12 pilasters)
  const numWestPilasters = 12;
  const pWestW = 0.38;
  const pWestD = 0.42;
  const pBodyGeoWest = new THREE.BoxGeometry(pWestW, WALL_H + 0.06, pWestD);
  const pCapGeoWest = new THREE.BoxGeometry(pWestW + 0.06, COPING_H, pWestD + 0.06);

  for (let i = 0; i < numWestPilasters; i++) {
    const pz = -18.0 + i * (78.0 / (numWestPilasters - 1));
    const pilasterMesh = new THREE.Mesh(pBodyGeoWest, pilasterMat);
    pilasterMesh.position.set(westWallX + 0.04, (WALL_H + 0.06) / 2, pz);
    pilasterMesh.castShadow = true;
    pilasterMesh.receiveShadow = true;

    const capMesh = new THREE.Mesh(pCapGeoWest, copingMat);
    capMesh.position.set(westWallX + 0.04, WALL_H + 0.06 + COPING_H / 2, pz);
    capMesh.castShadow = true;
    capMesh.receiveShadow = true;

    whiteWallGroup.add(pilasterMesh, capMesh);
  }

  // 5) Prominent Corner Pillars
  // South-East corner (55.0, 65.42), South-West corner (-53.42, 65.42), North-West terminal (-53.42, -23.0)
  const cornerCoords = [
    { x: 55.0, z: southWallZ, w: 0.48, d: 0.48 },
    { x: westWallX, z: southWallZ, w: 0.52, d: 0.52 },
    { x: westWallX, z: -23.0, w: 0.48, d: 0.48 },
  ];

  for (const c of cornerCoords) {
    const pierGeo = new THREE.BoxGeometry(c.w, WALL_H + 0.14, c.d);
    const pier = new THREE.Mesh(pierGeo, pilasterMat);
    pier.position.set(c.x, (WALL_H + 0.14) / 2, c.z);
    pier.castShadow = true;
    pier.receiveShadow = true;

    // Pyramidal stone cap
    const capBaseGeo = new THREE.BoxGeometry(c.w + 0.08, 0.10, c.d + 0.08);
    const capBase = new THREE.Mesh(capBaseGeo, copingMat);
    capBase.position.set(c.x, WALL_H + 0.14 + 0.05, c.z);
    capBase.castShadow = true;

    const capPeakGeo = new THREE.ConeGeometry(Math.max(c.w, c.d) * 0.55, 0.18, 4);
    const capPeak = new THREE.Mesh(capPeakGeo, copingMat);
    capPeak.rotation.y = Math.PI / 4;
    capPeak.position.set(c.x, WALL_H + 0.14 + 0.10 + 0.09, c.z);
    capPeak.castShadow = true;

    whiteWallGroup.add(pier, capBase, capPeak);
  }

  scene.add(whiteWallGroup);

  // Solid collisions for the south and west white brick perimeter walls
  buildingSolids.push(
    // South Wall: spans x in [-53.42, 55.0] at z = 65.42
    { x: southWallCenterX, z: southWallZ, w: southWallLen, d: WALL_THICK, yBase: 0, yTop: WALL_H },
    // West Wall: spans z in [-23.0, 65.5] at x = -53.42
    { x: westWallX, z: westWallCenterZ, w: WALL_THICK, d: westWallLen, yBase: 0, yTop: WALL_H },
    // Off-campus western boundary south of North Road (prevents walking south outside the west wall)
    { x: -58.0, z: 21.25, w: 9.0, d: 88.5, yBase: 0, yTop: 5.0 }
  );

  // --- 2g) West Wall Green Hedge Row (Inside Campus, Between Wall & Cars) ---
  // A row of dense, sculpted green privacy hedges lining the western white brick wall,
  // positioned between the wall and the parked cars (spanning from z = -22.5 to z = 55.0,
  // terminating before the southwest dumpster enclosure at z = 57.5 to prevent clipping).
  // The hedges stand at 4.25m height, rising slightly above the 4.0m top of the white wall.
  const westHedge = (layoutData as any).westHedge ?? {
    x: -52.7,
    minZ: -22.5,
    maxZ: 55.0,
    width: 0.85,
    height: 4.25,
    gap: 0.35,
  };

  const westHedgeGap = westHedge.gap ?? 0.35;
  const westHedgeLen = westHedge.maxZ - westHedge.minZ;
  const westHedgeSegmentLen = 1.6;
  const numWestHedgeSegments = Math.round(westHedgeLen / westHedgeSegmentLen);
  const actualWestSegLen = westHedgeLen / numWestHedgeSegments;
  const westBushLen = actualWestSegLen - westHedgeGap;

  const westHedgeGroup = new THREE.Group();
  for (let i = 0; i < numWestHedgeSegments; i++) {
    const segCenterZ = westHedge.minZ + actualWestSegLen * (i + 0.5);
    // Ensure shrubs do not extend into or clip with the dumpster enclosure wall (z = 57.5)
    if (segCenterZ > 55.2) continue;
    const bush = createPlantBush(
      westHedge.width,
      westHedge.height,
      westBushLen,
      (i + 100) * 11.17
    );
    bush.position.set(westHedge.x, 0, segCenterZ);
    westHedgeGroup.add(bush);
  }
  scene.add(westHedgeGroup);

  // Continuous landscape planter bed of rich dark soil beneath the west hedges
  const westDirtBed = new THREE.Mesh(
    new THREE.BoxGeometry(westHedge.width + 0.45, 0.04, westHedgeLen + 0.6),
    dirtBedMat
  );
  westDirtBed.position.set(westHedge.x, 0.022, (westHedge.minZ + westHedge.maxZ) / 2);
  westDirtBed.receiveShadow = true;

  // Concrete landscape curb bordering the parking lot asphalt and hedge dirt bed
  const planterCurbMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.85 });
  const westCurb = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.07, westHedgeLen + 0.6),
    planterCurbMat
  );
  westCurb.position.set(-52.06, 0.035, (westHedge.minZ + westHedge.maxZ) / 2);
  westCurb.castShadow = true;
  westCurb.receiveShadow = true;
  scene.add(westDirtBed, westCurb);

  // Collision solid so players and cars cannot pass through the hedges
  buildingSolids.push({
    x: westHedge.x,
    z: (westHedge.minZ + westHedge.maxZ) / 2,
    w: westHedge.width,
    d: westHedgeLen,
    yBase: 0,
    yTop: westHedge.height,
  });

  // --- 2h) South-West Parking Lot Dumpster Enclosure (Beige Brick Wall, Gates, Trash & Recycle Bins) ---
  // Dedicated commercial service enclosure situated in the southwest corner of the parking lot
  // against the west and south white brick walls (x in [-53.2, -45.6], z in [58.2, 65.2]).
  // Encloses two heavy-duty commercial dumpsters: 1 for Trash (forest green) and 1 for Recycle (municipal blue).
  function makeBeigeBrickTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas unavailable");
    // Mortar joint base
    ctx.fillStyle = "#b5a798";
    ctx.fillRect(0, 0, 256, 256);
    // Running bond masonry bricks
    const rows = 16;
    const cols = 8;
    const rh = 256 / rows;
    const cw = 256 / cols;
    const mortar = 3;
    const tones = ["#d8cabb", "#cfbfad", "#e0d3c4", "#d4c5b3", "#d9ccbe", "#cbbca8", "#e3d7c9"];
    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (cw / 2);
      for (let c = -1; c < cols + 1; c++) {
        const bx = c * cw + offset + mortar / 2;
        const by = r * rh + mortar / 2;
        const bw = cw - mortar;
        const bh = rh - mortar;
        const tone = tones[(r * 7 + c + 13) % tones.length];
        ctx.fillStyle = tone;
        ctx.fillRect(bx, by, bw, bh);
        for (let n = 0; n < 12; n++) {
          const nx = bx + Math.random() * bw;
          const ny = by + Math.random() * bh;
          ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.18)" : "rgba(80,60,40,0.15)";
          ctx.fillRect(nx, ny, 2, 2);
        }
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 3);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function makeDumpsterTrashSignTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas unavailable");
    ctx.fillStyle = "#1e3a2f";
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 8;
    ctx.strokeRect(12, 12, 488, 232);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 64px 'Arial Black', Impact, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("TRASH ONLY", 256, 80);
    ctx.fillStyle = "#facc15";
    ctx.fillRect(24, 135, 464, 8);
    ctx.fillStyle = "#facc15";
    ctx.font = "bold 26px Arial, sans-serif";
    ctx.fillText("NO RECYCLING OR HAZARDOUS WASTE", 256, 175);
    ctx.font = "20px Arial, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText("KEEP AREA CLEAN • DO NOT BLOCK GATES", 256, 212);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makeDumpsterRecycleSignTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas unavailable");
    ctx.fillStyle = "#1d4ed8";
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 8;
    ctx.strokeRect(12, 12, 488, 232);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 60px 'Arial Black', Impact, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("RECYCLE ONLY", 256, 80);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(24, 135, 464, 8);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px Arial, sans-serif";
    ctx.fillText("♻ CARDBOARD • PLASTIC • PAPER • CANS ♻", 256, 175);
    ctx.font = "20px Arial, sans-serif";
    ctx.fillStyle = "#dbeafe";
    ctx.fillText("FLATTEN ALL BOXES • NO TRASH", 256, 212);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const beigeBrickMat = new THREE.MeshStandardMaterial({
    map: makeBeigeBrickTexture(),
    roughness: 0.86,
    metalness: 0.05,
  });
  const beigeCopingMat = new THREE.MeshStandardMaterial({
    color: 0xe8dfd5,
    roughness: 0.82,
  });
  const dumpsterPadMat = new THREE.MeshStandardMaterial({
    color: 0x94989e,
    roughness: 0.9,
  });
  const dumpsterGateSteelMat = new THREE.MeshStandardMaterial({
    color: 0x7a2f2f,
    roughness: 0.55,
    metalness: 0.35,
  });
  const dumpsterGateHardwareMat = new THREE.MeshStandardMaterial({
    color: 0xc8cdd5,
    roughness: 0.3,
    metalness: 0.9,
  });
  const bollardYellowMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.45,
  });
  const bollardStripeMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.5,
  });

  const dumpsterEnclosureGroup = new THREE.Group();

  // 1) Concrete foundation pad (slightly raised slab)
  const enclosurePad = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 0.06, 7.85),
    dumpsterPadMat
  );
  enclosurePad.position.set(-49.525, 0.03, 61.275);
  enclosurePad.receiveShadow = true;
  dumpsterEnclosureGroup.add(enclosurePad);

  // 2) Beige brick enclosure walls (height 2.4m, thickness 0.30m) with stone coping caps
  // West Wall (Rear solid wall against western perimeter / hedge bed)
  const westRearWall = new THREE.Mesh(new THREE.BoxGeometry(0.30, 2.4, 7.55), beigeBrickMat);
  westRearWall.position.set(-53.05, 1.20, 61.275);
  westRearWall.castShadow = true;
  westRearWall.receiveShadow = true;
  const westRearCoping = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 7.63), beigeCopingMat);
  westRearCoping.position.set(-53.05, 2.44, 61.275);
  westRearCoping.castShadow = true;
  dumpsterEnclosureGroup.add(westRearWall, westRearCoping);

  // North Wall (Left side wall facing parked cars)
  const northEnclosureWall = new THREE.Mesh(new THREE.BoxGeometry(7.05, 2.4, 0.30), beigeBrickMat);
  northEnclosureWall.position.set(-49.525, 1.20, 57.5);
  northEnclosureWall.castShadow = true;
  northEnclosureWall.receiveShadow = true;
  const northEnclosureCoping = new THREE.Mesh(new THREE.BoxGeometry(7.13, 0.08, 0.38), beigeCopingMat);
  northEnclosureCoping.position.set(-49.525, 2.44, 57.5);
  northEnclosureCoping.castShadow = true;
  dumpsterEnclosureGroup.add(northEnclosureWall, northEnclosureCoping);

  // South Wall (Right side wall against southern boundary wall)
  const southEnclosureWall = new THREE.Mesh(new THREE.BoxGeometry(7.05, 2.4, 0.30), beigeBrickMat);
  southEnclosureWall.position.set(-49.525, 1.20, 65.05);
  southEnclosureWall.castShadow = true;
  southEnclosureWall.receiveShadow = true;
  const southEnclosureCoping = new THREE.Mesh(new THREE.BoxGeometry(7.13, 0.08, 0.38), beigeCopingMat);
  southEnclosureCoping.position.set(-49.525, 2.44, 65.05);
  southEnclosureCoping.castShadow = true;
  dumpsterEnclosureGroup.add(southEnclosureWall, southEnclosureCoping);

  // East Return Piers (Front Opening on East side facing drive aisle: 5.15m wide between z = 58.7 and z = 63.85)
  // North Front Return Pier (along x = -46.0)
  const frontNorthPier = new THREE.Mesh(new THREE.BoxGeometry(0.30, 2.4, 1.20), beigeBrickMat);
  frontNorthPier.position.set(-46.0, 1.20, 58.1);
  frontNorthPier.castShadow = true;
  frontNorthPier.receiveShadow = true;
  const frontNorthCoping = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 1.28), beigeCopingMat);
  frontNorthCoping.position.set(-46.0, 2.44, 58.1);
  frontNorthCoping.castShadow = true;
  dumpsterEnclosureGroup.add(frontNorthPier, frontNorthCoping);

  // South Front Return Pier (along x = -46.0)
  const frontSouthPier = new THREE.Mesh(new THREE.BoxGeometry(0.30, 2.4, 1.20), beigeBrickMat);
  frontSouthPier.position.set(-46.0, 1.20, 64.45);
  frontSouthPier.castShadow = true;
  frontSouthPier.receiveShadow = true;
  const frontSouthCoping = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 1.28), beigeCopingMat);
  frontSouthCoping.position.set(-46.0, 2.44, 64.45);
  frontSouthCoping.castShadow = true;
  dumpsterEnclosureGroup.add(frontSouthPier, frontSouthCoping);

  // 3) Commercial Double-Leaf Service Enclosure Gate in red steel (Facing East)
  // North steel hinge post
  const northGatePost = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.5, 0.14), dumpsterGateSteelMat);
  northGatePost.position.set(-46.0, 1.25, 58.7);
  northGatePost.castShadow = true;
  // South steel hinge post
  const southGatePost = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.5, 0.14), dumpsterGateSteelMat);
  southGatePost.position.set(-46.0, 1.25, 63.85);
  southGatePost.castShadow = true;
  dumpsterEnclosureGroup.add(northGatePost, southGatePost);

  // North Gate Leaf (Closed, spans z: [58.7, 61.275], length 2.575m, height 2.2m)
  const northLeaf = new THREE.Group();
  northLeaf.position.set(-46.0, 0, 58.7);
  // Rails
  for (const ry of [0.15, 1.15, 2.15]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 2.575), dumpsterGateSteelMat);
    rail.position.set(0, ry, 1.2875);
    rail.castShadow = true;
    northLeaf.add(rail);
  }
  // Stiles
  for (const sz of [0.04, 2.535]) {
    const stile = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.06, 0.06), dumpsterGateSteelMat);
    stile.position.set(0, 1.15, sz);
    stile.castShadow = true;
    northLeaf.add(stile);
  }
  // Vertical privacy slats
  for (let s = 1; s <= 10; s++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.96, 0.18), dumpsterGateSteelMat);
    slat.position.set(0, 1.15, s * 0.235);
    slat.castShadow = true;
    northLeaf.add(slat);
  }
  // Cane drop rod & foot bolt
  const northCane = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.85, 8), dumpsterGateHardwareMat);
  northCane.position.set(0.04, 0.45, 2.48);
  northLeaf.add(northCane);
  dumpsterEnclosureGroup.add(northLeaf);

  // South Gate Leaf (Hinged at z = 63.85, swung slightly open ~28° eastward into the drive aisle)
  const southLeaf = new THREE.Group();
  southLeaf.position.set(-46.0, 0, 63.85);
  southLeaf.rotation.y = 0.50; // ajar outward into drive aisle
  for (const ry of [0.15, 1.15, 2.15]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 2.575), dumpsterGateSteelMat);
    rail.position.set(0, ry, -1.2875);
    rail.castShadow = true;
    southLeaf.add(rail);
  }
  for (const sz of [-0.04, -2.535]) {
    const stile = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.06, 0.06), dumpsterGateSteelMat);
    stile.position.set(0, 1.15, sz);
    stile.castShadow = true;
    southLeaf.add(stile);
  }
  for (let s = 1; s <= 10; s++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.96, 0.18), dumpsterGateSteelMat);
    slat.position.set(0, 1.15, -s * 0.235);
    slat.castShadow = true;
    southLeaf.add(slat);
  }
  // Slide latch & padlock on meeting edge
  const slideLatch = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.28), dumpsterGateHardwareMat);
  slideLatch.position.set(0.04, 1.15, -2.48);
  const padlock = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.007, 8, 16, Math.PI), dumpsterGateHardwareMat);
  padlock.position.set(0.06, 1.18, -2.51);
  southLeaf.add(slideLatch, padlock);
  dumpsterEnclosureGroup.add(southLeaf);

  // 4) Protective yellow safety pipe bollards at rear of each dumpster stall (West wall)
  const bollardGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.10, 16);
  const bollardBandGeo = new THREE.CylinderGeometry(0.072, 0.072, 0.08, 16);
  for (const bz of [59.9, 62.7]) {
    const bollard = new THREE.Mesh(bollardGeo, bollardYellowMat);
    bollard.position.set(-51.5, 0.55, bz);
    bollard.castShadow = true;
    const band = new THREE.Mesh(bollardBandGeo, bollardStripeMat);
    band.position.set(-51.5, 0.85, bz);
    dumpsterEnclosureGroup.add(bollard, band);
  }

  // 5) Commercial Dumpsters: 1 Trash (forest green) and 1 Recycle (municipal blue) facing EAST
  function createCommercialDumpster(
    binColorHex: number,
    signTexture: THREE.CanvasTexture
  ): THREE.Group {
    const binGroup = new THREE.Group();
    const binMat = new THREE.MeshStandardMaterial({
      color: binColorHex,
      roughness: 0.62,
      metalness: 0.35,
    });
    const lidMat = new THREE.MeshStandardMaterial({
      color: 0x1f2328,
      roughness: 0.82,
      metalness: 0.1,
    });
    const pocketMat = new THREE.MeshStandardMaterial({
      color: binColorHex,
      roughness: 0.65,
      metalness: 0.35,
    });
    const casterMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.4,
      metalness: 0.8,
    });
    const wheelRubberMat = new THREE.MeshStandardMaterial({
      color: 0x181a1d,
      roughness: 0.85,
    });

    // Main Bin Body (width 2.05m x height 1.25m x depth 1.35m)
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.88, 1.35), binMat);
    lowerBody.position.set(0, 0.54, 0);
    lowerBody.castShadow = true;
    lowerBody.receiveShadow = true;

    // Sloped upper chest
    const upperChest = new THREE.Mesh(new THREE.BoxGeometry(2.03, 0.34, 1.28), binMat);
    upperChest.position.set(0, 1.12, 0.02);
    upperChest.castShadow = true;

    // Perimeter steel top rim
    const topRim = new THREE.Mesh(new THREE.BoxGeometry(2.11, 0.06, 1.41), binMat);
    topRim.position.set(0, 1.28, 0);
    topRim.castShadow = true;
    binGroup.add(lowerBody, upperChest, topRim);

    // Dual split black HDPE plastic flip lids angled forward
    const leftLid = new THREE.Mesh(new THREE.BoxGeometry(0.99, 0.05, 1.36), lidMat);
    leftLid.position.set(-0.51, 1.32, 0.02);
    leftLid.rotation.x = 0.06;
    leftLid.castShadow = true;
    const rightLid = new THREE.Mesh(new THREE.BoxGeometry(0.99, 0.05, 1.36), lidMat);
    rightLid.position.set(0.51, 1.32, 0.02);
    rightLid.rotation.x = 0.06;
    rightLid.castShadow = true;

    // Lid grab handles
    for (const hx of [-0.51, 0.51]) {
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.06), lidMat);
      handle.position.set(hx, 1.31, -0.66);
      binGroup.add(handle);
    }

    // Rear lid hinge tube
    const hingeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 2.06, 10), casterMat);
    hingeTube.position.set(0, 1.31, 0.69);
    hingeTube.rotation.z = Math.PI / 2;
    binGroup.add(leftLid, rightLid, hingeTube);

    // Welded steel side fork lift pockets (crucial front-loader dumpster detail)
    for (const px of [-1.08, 1.08]) {
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 1.35), pocketMat);
      pocket.position.set(px, 0.64, 0);
      pocket.castShadow = true;
      // Front & rear beveled gussets
      for (const pz of [-0.68, 0.68]) {
        const gusset = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.03), casterMat);
        gusset.position.set(px, 0.64, pz);
        binGroup.add(gusset);
      }
      binGroup.add(pocket);
    }

    // Bottom runner channels & 4 heavy industrial swivel casters
    for (const rx of [-0.70, 0.70]) {
      const runner = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.35), binMat);
      runner.position.set(rx, 0.11, 0);
      binGroup.add(runner);
    }
    for (const cx of [-0.85, 0.85]) {
      for (const cz of [-0.52, 0.52]) {
        const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.08), casterMat);
        bracket.position.set(cx, 0.08, cz);
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12), wheelRubberMat);
        wheel.position.set(cx, 0.05, cz);
        wheel.rotation.z = Math.PI / 2;
        wheel.castShadow = true;
        binGroup.add(bracket, wheel);
      }
    }

    // Front custom decal sign stencil
    const decalBacking = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.48, 0.015), casterMat);
    decalBacking.position.set(0, 0.74, -0.68);
    const signMat = new THREE.MeshStandardMaterial({
      map: signTexture,
      roughness: 0.4,
      metalness: 0.1,
    });
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(1.30, 0.46), signMat);
    decal.position.set(0, 0.74, -0.69);
    decal.rotation.y = Math.PI;
    binGroup.add(decalBacking, decal);

    return binGroup;
  }

  // Dumpster 1: Trash (Dark Forest Green, facing East towards gate)
  const trashDumpster = createCommercialDumpster(0x1e3a2f, makeDumpsterTrashSignTexture());
  trashDumpster.position.set(-49.4, 0.06, 59.9);
  trashDumpster.rotation.y = Math.PI / 2; // Rotated so front sign faces East towards gate
  dumpsterEnclosureGroup.add(trashDumpster);

  // Dumpster 2: Recycle (Municipal Recycling Blue, facing East towards gate)
  const recycleDumpster = createCommercialDumpster(0x1d4ed8, makeDumpsterRecycleSignTexture());
  recycleDumpster.position.set(-49.4, 0.06, 62.7);
  recycleDumpster.rotation.y = Math.PI / 2; // Rotated so front sign faces East towards gate
  dumpsterEnclosureGroup.add(recycleDumpster);

  scene.add(dumpsterEnclosureGroup);

  // Collision solids for beige brick enclosure walls & dumpsters
  buildingSolids.push(
    // West Wall (Rear)
    { x: -53.05, z: 61.275, w: 0.30, d: 7.55, yBase: 0, yTop: 2.4 },
    // North Wall (Left)
    { x: -49.525, z: 57.5, w: 7.05, d: 0.30, yBase: 0, yTop: 2.4 },
    // South Wall (Right)
    { x: -49.525, z: 65.05, w: 7.05, d: 0.30, yBase: 0, yTop: 2.4 },
    // East Return North
    { x: -46.0, z: 58.1, w: 0.30, d: 1.20, yBase: 0, yTop: 2.4 },
    // East Return South
    { x: -46.0, z: 64.45, w: 0.30, d: 1.20, yBase: 0, yTop: 2.4 },
    // North Closed Service Gate Leaf
    { x: -46.0, z: 59.9875, w: 0.14, d: 2.575, yBase: 0, yTop: 2.2 },
    // Trash Dumpster Solid (North stall, facing East)
    { x: -49.4, z: 59.9, w: 1.45, d: 2.10, yBase: 0, yTop: 1.5 },
    // Recycle Dumpster Solid (South stall, facing East)
    { x: -49.4, z: 62.7, w: 1.45, d: 2.10, yBase: 0, yTop: 1.5 }
  );

  // --- 2f) East Road (Outside East Fence & Outside Sidewalk) ---
  // The east sidewalk is at x: [55.0, 58.0]. The road sits directly beyond it: x: [58.0, 72.0], z: [-45.0, 85.0].
  const roadMat = new THREE.MeshStandardMaterial({
    map: makeNoiseTexture("#22252c", 8, 16),
    roughness: 0.92,
  });
  const curbMat = new THREE.MeshStandardMaterial({ color: 0xd0cbc2, roughness: 0.85 });
  const roadYellowMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6 });
  const roadWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
  const farVergeMat = new THREE.MeshStandardMaterial({ map: makeNoiseTexture("#568a42", 18, 6), roughness: 0.95 });
  const farSidewalkMat = new THREE.MeshStandardMaterial({ map: makeNoiseTexture("#ece6dc", 6, 6), roughness: 0.85 });

  // 1) Main Road Asphalt Surface (14m wide x 130m long)
  const roadMesh = new THREE.Mesh(new THREE.PlaneGeometry(14.0, 130.0), roadMat);
  roadMesh.rotation.x = -Math.PI / 2;
  roadMesh.position.set(65.0, 0.015, 20.0);
  roadMesh.receiveShadow = true;
  scene.add(roadMesh);

  // 2) Curbs
  // West curb at x = 58.0 (divides outside sidewalk from road), split at:
  // - North Road T-intersection (z: [-35.5, -26.0])
  // - Vehicle driveway gate (z: [54.5, 61.5])
  const westCurbMid = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.16, 80.5), curbMat);
  westCurbMid.position.set(58.0, 0.08, 14.25); // z in [-26.0, 54.5]
  westCurbMid.castShadow = true;
  westCurbMid.receiveShadow = true;

  const westCurbFarNorth = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.16, 9.5), curbMat);
  westCurbFarNorth.position.set(58.0, 0.08, -40.25); // z in [-45.0, -35.5]
  westCurbFarNorth.castShadow = true;
  westCurbFarNorth.receiveShadow = true;

  const westCurbSouth = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.16, 23.5), curbMat);
  westCurbSouth.position.set(58.0, 0.08, 73.25); // z in [61.5, 85.0]
  westCurbSouth.castShadow = true;
  westCurbSouth.receiveShadow = true;
  scene.add(westCurbMid, westCurbFarNorth, westCurbSouth);

  // Driveway curved curb flares entering the vehicle gate
  const flareNorth = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.20), curbMat);
  flareNorth.position.set(58.1, 0.06, 54.5);
  flareNorth.rotation.y = Math.PI / 4;
  const flareSouth = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.20), curbMat);
  flareSouth.position.set(58.1, 0.06, 61.5);
  flareSouth.rotation.y = -Math.PI / 4;
  scene.add(flareNorth, flareSouth);

  // East curb at x = 72.0 (far side of the road, continuous 130m)
  const eastCurb = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.16, 130.0), curbMat);
  eastCurb.position.set(72.0, 0.08, 20.0);
  eastCurb.castShadow = true;
  eastCurb.receiveShadow = true;
  scene.add(eastCurb);

  // 3) Far side parkway verge & landscape (x: [72.0, 78.0])
  const farVerge = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 130.0), farVergeMat);
  farVerge.rotation.x = -Math.PI / 2;
  farVerge.position.set(75.0, 0.018, 20.0);
  farVerge.receiveShadow = true;
  scene.add(farVerge);

  // Far side sidewalk across the street (x: [78.0, 80.5])
  const farSidewalk = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.04, 130.0), farSidewalkMat);
  farSidewalk.position.set(79.25, 0.02, 20.0);
  farSidewalk.receiveShadow = true;
  scene.add(farSidewalk);

  // Trees on the far green verge
  const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 });
  const treeLeafMat1 = new THREE.MeshStandardMaterial({ color: 0x2e6629, roughness: 0.85 });
  const treeLeafMat2 = new THREE.MeshStandardMaterial({ color: 0x3d7a36, roughness: 0.85 });
  const treeZPositions = [-34, -10, 12, 35, 58, 80];
  for (let idx = 0; idx < treeZPositions.length; idx++) {
    const tz = treeZPositions[idx];
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 3.2, 8), treeTrunkMat);
    trunk.position.set(75.0, 1.6, tz);
    trunk.castShadow = true;

    const canopyLower = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.65),
      idx % 2 === 0 ? treeLeafMat1 : treeLeafMat2
    );
    canopyLower.position.set(75.0, 3.8, tz);
    canopyLower.castShadow = true;

    const canopyUpper = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.25),
      idx % 2 === 0 ? treeLeafMat2 : treeLeafMat1
    );
    canopyUpper.position.set(75.0, 4.9, tz);
    canopyUpper.castShadow = true;

    scene.add(trunk, canopyLower, canopyUpper);
  }

  // 4) Road Markings
  // Double yellow center divider lines (at x = 64.86 and x = 65.14)
  // Split at the school driveway (z: [54.5, 61.5]) with dashed turn pocket lines
  for (const lx of [64.86, 65.14]) {
    const yellowMid = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.006, 80.5), roadYellowMat);
    yellowMid.position.set(lx, 0.025, 14.25);
    const yellowFarNorth = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.006, 9.5), roadYellowMat);
    yellowFarNorth.position.set(lx, 0.025, -40.25);
    const yellowSouth = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.006, 23.5), roadYellowMat);
    yellowSouth.position.set(lx, 0.025, 73.25);
    scene.add(yellowMid, yellowFarNorth, yellowSouth);
  }

  // Dashed turn lines opposite the vehicle gate (z: [55.5, 60.5])
  for (let zDash = 55.5; zDash <= 60.5; zDash += 2.0) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.006, 1.0), roadYellowMat);
    dash.position.set(65.0, 0.025, zDash);
    scene.add(dash);
  }

  // Outer white fog / shoulder lines
  const whiteWestMid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.006, 80.5), roadWhiteMat);
  whiteWestMid.position.set(59.0, 0.025, 14.25);
  const whiteWestFarNorth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.006, 9.5), roadWhiteMat);
  whiteWestFarNorth.position.set(59.0, 0.025, -40.25);
  const whiteWestSouth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.006, 23.5), roadWhiteMat);
  whiteWestSouth.position.set(59.0, 0.025, 73.25);
  const whiteEast = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.006, 130.0), roadWhiteMat);
  whiteEast.position.set(71.0, 0.025, 20.0);
  scene.add(whiteWestMid, whiteWestFarNorth, whiteWestSouth, whiteEast);

  // Continental zebra school crosswalk at z = 18.0
  const zebraWidth = 1.1;
  const zebraDepth = 0.6;
  for (let i = 0; i < 7; i++) {
    const zbar = new THREE.Mesh(new THREE.BoxGeometry(zebraWidth, 0.006, zebraDepth), roadWhiteMat);
    zbar.position.set(59.8 + i * 1.6, 0.026, 18.0);
    scene.add(zbar);
  }
  // Stop lines before crosswalk
  const stopNorth = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.006, 0.45), roadWhiteMat);
  stopNorth.position.set(68.25, 0.026, 14.5);
  const stopSouth = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.006, 0.45), roadWhiteMat);
  stopSouth.position.set(61.75, 0.026, 21.5);
  scene.add(stopNorth, stopSouth);

  // 5) Streetlights along the outside sidewalk verge at x = 57.6
  const streetLightMat = new THREE.MeshStandardMaterial({ color: 0x333b47, roughness: 0.6, metalness: 0.7 });
  const luminaireLensMat = new THREE.MeshStandardMaterial({
    color: 0xfff9e6,
    emissive: 0xfffae0,
    emissiveIntensity: 0.7,
    roughness: 0.2,
  });

  const lightZPositions = [-20, 12, 42, 72];
  for (const lz of lightZPositions) {
    // Tall steel pole (7.2m tall)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7.2, 12), streetLightMat);
    pole.position.set(57.6, 3.6, lz);
    pole.castShadow = true;

    // Curved cantilever mast arm extending over the road to x = 60.5
    const armGeo = new THREE.BoxGeometry(3.0, 0.08, 0.08);
    const arm = new THREE.Mesh(armGeo, streetLightMat);
    arm.position.set(59.1, 7.35, lz);
    arm.rotation.z = -0.08;
    arm.castShadow = true;

    // Aerodynamic LED luminaire fixture
    const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.32), streetLightMat);
    fixture.position.set(60.6, 7.42, lz);
    fixture.castShadow = true;

    // Emissive glass underside lens
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.28), luminaireLensMat);
    lens.position.set(60.6, 7.35, lz);
    lens.rotation.x = Math.PI / 2;

    scene.add(pole, arm, fixture, lens);
  }

  // 6) Roadside Traffic Signs on the outside sidewalk
  function makeSchoolSignTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 384;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 256, 384);

    // Yellow fluorescent header for SCHOOL
    ctx.fillStyle = "#eab308";
    ctx.fillRect(0, 0, 256, 110);
    ctx.fillStyle = "#0f172a";
    ctx.font = "900 38px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SCHOOL", 128, 55);

    // Outer border
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#0f172a";
    ctx.strokeRect(5, 5, 246, 374);
    ctx.strokeRect(5, 110, 246, 269);

    // White body for SPEED LIMIT 25
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText("SPEED", 128, 160);
    ctx.fillText("LIMIT", 128, 205);

    ctx.font = "900 85px sans-serif";
    ctx.fillText("25", 128, 290);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  }

  const schoolSignTex = makeSchoolSignTexture();
  const signPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 8), streetLightMat);
  signPole.position.set(57.5, 1.6, 24.0);
  const signPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 1.1, 0.75),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 })
  );
  signPlate.position.set(57.5, 2.5, 24.0);
  const signFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 1.05),
    new THREE.MeshStandardMaterial({ map: schoolSignTex, roughness: 0.3 })
  );
  signFace.position.set(57.53, 2.5, 24.0);
  signFace.rotation.y = Math.PI / 2; // faces drivers heading north (+Z)
  scene.add(signPole, signPlate, signFace);

  // Municipal Fire Hydrant on the outside sidewalk at x = 57.4, z = 47.0
  const hydrantRed = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });
  const hydrantSilver = new THREE.MeshStandardMaterial({ color: 0xcfd4dc, roughness: 0.3, metalness: 0.8 });
  const hydrantBody = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.65, 12), hydrantRed);
  hydrantBody.position.set(57.4, 0.35, 47.0);
  const hydrantCap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hydrantRed);
  hydrantCap.position.set(57.4, 0.67, 47.0);
  const nozzleEast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 8), hydrantSilver);
  nozzleEast.rotation.z = Math.PI / 2;
  nozzleEast.position.set(57.5, 0.45, 47.0);
  scene.add(hydrantBody, hydrantCap, nozzleEast);

  // 7) Ambient Cars on the Road (moving & parked)
  function makeRoadVehicle(colorHex: string): THREE.Group {
    const v = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3, metalness: 0.4 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.1, metalness: 0.8 });
    const lightMatHead = new THREE.MeshStandardMaterial({ color: 0xfffae0, emissive: 0xfff5c0, emissiveIntensity: 0.6 });
    const lightMatTail = new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0xb91c1c, emissiveIntensity: 0.8 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 4.2), bodyMat);
    body.position.y = 0.55;
    body.castShadow = true;

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.55, 2.3), glassMat);
    cabin.position.set(0, 1.05, -0.2);
    cabin.castShadow = true;

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 2.0), bodyMat);
    roof.position.set(0, 1.34, -0.2);

    const hlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.04), lightMatHead);
    hlLeft.position.set(-0.65, 0.55, -2.11);
    const hlRight = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.04), lightMatHead);
    hlRight.position.set(0.65, 0.55, -2.11);

    const tlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.04), lightMatTail);
    tlLeft.position.set(-0.65, 0.6, 2.11);
    const tlRight = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.04), lightMatTail);
    tlRight.position.set(0.65, 0.6, 2.11);

    for (const wx of [-0.95, 0.95]) {
      for (const wz of [-1.3, 1.3]) {
        const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16), wheelMat);
        wh.rotation.z = Math.PI / 2;
        wh.position.set(wx, 0.32, wz);
        v.add(wh);
      }
    }

    v.add(body, cabin, roof, hlLeft, hlRight, tlLeft, tlRight);
    return v;
  }

  // Car 1: Blue sedan driving northbound in the east lane (x = 68.2, z = -12.0)
  const carNorth = makeRoadVehicle("#1d4ed8");
  carNorth.position.set(68.2, 0.02, -12.0);
  scene.add(carNorth);

  // Car 2: Pearl white SUV parked along the west curb (x = 60.1, z = 76.0)
  const carSouth = makeRoadVehicle("#f1f5f9");
  carSouth.position.set(60.1, 0.02, 76.0);
  scene.add(carSouth);

  // --- 2f-2) North One-Way Road, Outside Sidewalk, Parked Cars & 2-Story Apartments ---
  // A clean, one-way street running eastward along the north perimeter of campus (z: [-35.5, -26.0]),
  // connecting directly into the East Road at x = [58.0, 72.0].
  // Includes parallel parking along the north outside sidewalk, one-way traffic markings/signs,
  // streetlights, and a row of 3 distinct, beautiful 2-story apartment buildings on the north side.

  // 1) Procedural Textures for North Road
  function makeOneWayArrowTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 256, 512);

    ctx.fillStyle = "#f8fafc";
    // Arrow shaft
    ctx.fillRect(108, 180, 40, 260);
    // Arrow head pointing to top of canvas
    ctx.beginPath();
    ctx.moveTo(128, 40);
    ctx.lineTo(210, 200);
    ctx.lineTo(158, 200);
    ctx.lineTo(158, 210);
    ctx.lineTo(98, 210);
    ctx.lineTo(98, 200);
    ctx.lineTo(46, 200);
    ctx.closePath();
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  }

  function makeOneWayStreetSignTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 192;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 512, 192);
    ctx.fillStyle = "#0f172a";
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, 496, 176);

    ctx.beginPath();
    ctx.moveTo(60, 52);
    ctx.lineTo(360, 52);
    ctx.lineTo(360, 24);
    ctx.lineTo(450, 96);
    ctx.lineTo(360, 168);
    ctx.lineTo(360, 140);
    ctx.lineTo(60, 140);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 68px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ONE WAY", 210, 96);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  }

  function makeApartmentSignTexture(name: string, number: string): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#1e2430";
    ctx.fillRect(0, 0, 512, 256);
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#c89b3c";
    ctx.strokeRect(8, 8, 496, 240);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 34px Arial, sans-serif";
    ctx.fillStyle = "#c89b3c";
    ctx.fillText(number, 256, 70);

    ctx.font = "900 44px Arial, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(name, 256, 140);

    ctx.font = "bold 24px Arial, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("APARTMENTS", 256, 195);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  }

  // 2) North Road Asphalt Surface (x: [-62.0, 72.0], z: [-35.5, -26.0])
  const northRoadWidth = 9.5;
  const northRoadLen = 134.0;
  const northRoadMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(northRoadLen, northRoadWidth),
    roadMat
  );
  northRoadMesh.rotation.x = -Math.PI / 2;
  northRoadMesh.position.set(5.0, 0.016, -30.75);
  northRoadMesh.receiveShadow = true;
  scene.add(northRoadMesh);

  // 3) Curbs for North Road
  // South Curb (School Side, z = -26.0): split around gate driveway apron x: [-45.4, -38.6]
  const northSouthCurbWest = new THREE.Mesh(new THREE.BoxGeometry(16.6, 0.16, 0.20), curbMat);
  northSouthCurbWest.position.set(-53.7, 0.08, -26.0);
  northSouthCurbWest.castShadow = true;
  northSouthCurbWest.receiveShadow = true;

  const northSouthCurbEast = new THREE.Mesh(new THREE.BoxGeometry(96.6, 0.16, 0.20), curbMat);
  northSouthCurbEast.position.set(9.7, 0.08, -26.0);
  northSouthCurbEast.castShadow = true;
  northSouthCurbEast.receiveShadow = true;

  // South-east intersection corner curb flare connecting to East Road west curb (at 58.0, -26.0)
  const flareCornerSW = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.20), curbMat);
  flareCornerSW.position.set(58.1, 0.06, -26.0);
  flareCornerSW.rotation.y = Math.PI / 4;

  // North Curb (Apartment Side, z = -35.5, continuous along parking lane)
  const northNorthCurb = new THREE.Mesh(new THREE.BoxGeometry(120.0, 0.16, 0.20), curbMat);
  northNorthCurb.position.set(-2.0, 0.08, -35.5);
  northNorthCurb.castShadow = true;
  northNorthCurb.receiveShadow = true;

  // North-east intersection corner curb flare connecting to East Road far curb (at 58.0, -35.5)
  const flareCornerNW = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.20), curbMat);
  flareCornerNW.position.set(58.1, 0.06, -35.5);
  flareCornerNW.rotation.y = -Math.PI / 4;

  scene.add(northSouthCurbWest, northSouthCurbEast, flareCornerSW, northNorthCurb, flareCornerNW);

  // 4) Sidewalks & Landscape Verges
  // South Sidewalk (School perimeter side, between school fence z = -23.0 and curb z = -25.8)
  const southNorthSidewalk = new THREE.Mesh(
    new THREE.BoxGeometry(117.0, 0.04, 2.8),
    farSidewalkMat
  );
  southNorthSidewalk.position.set(-3.5, 0.02, -24.4);
  southNorthSidewalk.receiveShadow = true;
  scene.add(southNorthSidewalk);

  // Concrete driveway apron for vehicles exiting the north sliding gate (x: [-45.4, -38.6], z: [-26.2, -22.8])
  const gateExitApron = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 0.03, 3.4),
    drivewayApronMat
  );
  gateExitApron.position.set(-42.0, 0.022, -24.5);
  gateExitApron.receiveShadow = true;
  scene.add(gateExitApron);

  // North Sidewalk ("Outside Sidewalk" along apartment side, z in [-38.5, -35.5])
  const northOutsideSidewalk = new THREE.Mesh(
    new THREE.BoxGeometry(120.0, 0.04, 3.0),
    farSidewalkMat
  );
  northOutsideSidewalk.position.set(-2.0, 0.035, -37.0);
  northOutsideSidewalk.receiveShadow = true;
  scene.add(northOutsideSidewalk);

  // Scored sidewalk joints every 2.5m along the outside sidewalk
  const sidewalkJointMat = new THREE.MeshStandardMaterial({ color: 0xc8c3b9, roughness: 1 });
  for (let jx = -60.0; jx <= 56.0; jx += 2.5) {
    const joint = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.042, 2.96), sidewalkJointMat);
    joint.position.set(jx, 0.036, -37.0);
    scene.add(joint);
  }

  // Parkway Landscape Verge (Lawn between sidewalk and apartment frontages, z in [-41.0, -38.5])
  const northLawnVerge = new THREE.Mesh(
    new THREE.PlaneGeometry(120.0, 2.5),
    farVergeMat
  );
  northLawnVerge.rotation.x = -Math.PI / 2;
  northLawnVerge.position.set(-2.0, 0.02, -39.75);
  northLawnVerge.receiveShadow = true;
  scene.add(northLawnVerge);

  // Trees along the north parkway verge
  const northTreeXPositions = [-50, -32, -14, 4, 22, 42];
  for (let idx = 0; idx < northTreeXPositions.length; idx++) {
    const tx = northTreeXPositions[idx];
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.26, 3.2, 8), treeTrunkMat);
    trunk.position.set(tx, 1.6, -39.75);
    trunk.castShadow = true;

    const canopyLower = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.5),
      idx % 2 === 0 ? treeLeafMat1 : treeLeafMat2
    );
    canopyLower.position.set(tx, 3.6, -39.75);
    canopyLower.castShadow = true;

    const canopyUpper = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.15),
      idx % 2 === 0 ? treeLeafMat2 : treeLeafMat1
    );
    canopyUpper.position.set(tx, 4.6, -39.75);
    canopyUpper.castShadow = true;

    scene.add(trunk, canopyLower, canopyUpper);
  }

  // 5) One-Way Road Markings & Signage
  // White solid edge lines (0.12m width)
  const edgeLineSouth = new THREE.Mesh(new THREE.BoxGeometry(118.0, 0.006, 0.12), roadWhiteMat);
  edgeLineSouth.position.set(-1.0, 0.022, -26.5);
  const edgeLineNorth = new THREE.Mesh(new THREE.BoxGeometry(118.0, 0.006, 0.12), roadWhiteMat);
  edgeLineNorth.position.set(-1.0, 0.022, -35.1);
  scene.add(edgeLineSouth, edgeLineNorth);

  // Parallel parking stall boundary line & dividing ticks along the north curb (z = -32.8)
  const parkingBorderLine = new THREE.Mesh(new THREE.BoxGeometry(116.0, 0.006, 0.12), roadWhiteMat);
  parkingBorderLine.position.set(-2.0, 0.022, -32.8);
  scene.add(parkingBorderLine);

  for (let px = -58.0; px <= 54.0; px += 7.5) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.006, 2.3), roadWhiteMat);
    tick.position.set(px, 0.023, -34.0);
    scene.add(tick);
  }

  // Stenciled ONE-WAY Directional Arrows on the drive lane asphalt (z = -29.2, pointing East +X)
  const oneWayArrowTex = makeOneWayArrowTexture();
  const arrowMat = new THREE.MeshStandardMaterial({
    map: oneWayArrowTex,
    transparent: true,
    roughness: 0.4,
  });
  const arrowPositionsX = [-44, -18, 8, 34];
  for (const ax of arrowPositionsX) {
    const arrow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.2), arrowMat);
    arrow.rotation.x = -Math.PI / 2;
    arrow.rotation.z = -Math.PI / 2; // Rotate so arrow points toward East (+X)
    arrow.position.set(ax, 0.024, -29.3);
    scene.add(arrow);
  }

  // Stop Bar Line at East Road intersection (x = 57.2, z in [-32.5, -26.5])
  const stopBarNorth = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.006, 6.0), roadWhiteMat);
  stopBarNorth.position.set(57.2, 0.025, -29.5);
  scene.add(stopBarNorth);

  // Regulatory ONE WAY Signs on galvanized steel poles
  const oneWaySignTex = makeOneWayStreetSignTexture();
  const oneWaySignMat = new THREE.MeshStandardMaterial({ map: oneWaySignTex, roughness: 0.3 });
  function addOneWayStreetSign(x: number, z: number, rotY: number) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 8), streetLightMat);
    pole.position.set(x, 1.6, z);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.36, 0.03), gateHardwareMat);
    plate.position.set(x, 2.5, z);
    plate.rotation.y = rotY;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.90, 0.34), oneWaySignMat);
    face.position.set(x + (rotY === 0 ? 0 : rotY === Math.PI ? 0 : 0.02), 2.5, z + (rotY === 0 ? -0.02 : rotY === Math.PI ? 0.02 : 0));
    face.rotation.y = rotY;
    scene.add(pole, plate, face);
  }
  addOneWayStreetSign(-48.0, -25.2, Math.PI); // Facing east traffic
  addOneWayStreetSign(12.0, -36.2, 0);       // Facing east traffic

  // Octagonal STOP sign at intersection corner (57.0, -25.4)
  const stopSignTexNorth = makeStopSignTexture();
  const stopPlateNorth = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.72, 0.03),
    new THREE.MeshStandardMaterial({ map: stopSignTexNorth, roughness: 0.3 })
  );
  stopPlateNorth.position.set(57.0, 2.4, -25.4);
  stopPlateNorth.rotation.y = -Math.PI / 2; // Facing traffic approaching from west
  const stopPoleNorth = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.0, 8), streetLightMat);
  stopPoleNorth.position.set(57.0, 1.5, -25.4);
  scene.add(stopPlateNorth, stopPoleNorth);

  // Modern Cobra-Head Streetlights along the north sidewalk verge
  const northStreetLightX = [-42, -14, 14, 42];
  for (const lx of northStreetLightX) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 6.8, 12), streetLightMat);
    pole.position.set(lx, 3.4, -38.0);

    const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.8, 8);
    const arm = new THREE.Mesh(armGeo, streetLightMat);
    arm.position.set(lx, 6.7, -37.2);
    arm.rotation.x = -Math.PI / 5;

    const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.12, 0.65), streetLightMat);
    fixture.position.set(lx, 6.9, -36.3);

    const lens = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.02, 0.55),
      new THREE.MeshStandardMaterial({
        color: 0xfffae0,
        emissive: 0xfff5b8,
        emissiveIntensity: 0.75,
        roughness: 0.2,
      })
    );
    lens.position.set(lx, 6.83, -36.3);

    scene.add(pole, arm, fixture, lens);
  }

  // 6) Parked Cars Along Outside Sidewalk (North curb at z = -34.3, facing East)
  const northParkedCars = [
    { x: -40.0, color: "#1d4ed8" }, // Sapphire blue sedan
    { x: -24.0, color: "#f8fafc" }, // Pearl white SUV
    { x: -8.0,  color: "#1e293b" }, // Charcoal metallic sedan
    { x: 8.0,   color: "#b91c1c" }, // Ruby red compact
    { x: 24.0,  color: "#059669" }, // Emerald green electric
  ];

  for (const pc of northParkedCars) {
    const parkedCar = makeRoadVehicle(pc.color);
    parkedCar.position.set(pc.x, 0.02, -34.25);
    parkedCar.rotation.y = -Math.PI / 2; // Facing East (+X)
    scene.add(parkedCar);

    // Collision solid for parked car
    buildingSolids.push({
      x: pc.x,
      z: -34.25,
      w: 4.4,
      d: 2.1,
      yBase: 0,
      yTop: 1.6,
    });
  }

  // 7) Three Distinct Two-Story Apartment Buildings on the North Side
  // Shared architectural materials
  const aptGlassMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.1,
    metalness: 0.85,
  });
  const aptFrameMat = new THREE.MeshStandardMaterial({
    color: 0x1f242d,
    roughness: 0.4,
    metalness: 0.6,
  });
  const aptIronMat = new THREE.MeshStandardMaterial({
    color: 0x111622,
    roughness: 0.4,
    metalness: 0.8,
  });
  const aptCopingMat = new THREE.MeshStandardMaterial({
    color: 0x5a6370,
    roughness: 0.5,
    metalness: 0.4,
  });
  const aptTerraCottaMat = new THREE.MeshStandardMaterial({
    color: 0xb44c32, // Spanish clay roof tile
    roughness: 0.8,
  });
  const aptCedarMat = new THREE.MeshStandardMaterial({
    color: 0x8c5e39, // Warm horizontal architectural wood slat siding
    roughness: 0.65,
  });
  const aptLampMat = new THREE.MeshStandardMaterial({
    color: 0xfffbeb,
    emissive: 0xfff7d6,
    emissiveIntensity: 0.6,
    roughness: 0.2,
  });

  // Helper to construct a modern window unit with frame and sill
  function makeAptWindow(w: number, h: number): THREE.Group {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.06), aptFrameMat);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), aptGlassMat);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.06, 0.14), aptCopingMat);
    sill.position.set(0, -h / 2 - 0.03, 0.04);
    g.add(frame, glass, sill);
    return g;
  }

  // Helper to construct a cantilevered residential balcony
  function makeAptBalcony(w: number, depth: number, railStyle: "iron" | "cedar"): THREE.Group {
    const bg = new THREE.Group();
    // Concrete floor slab (thick cantilever)
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.22, depth),
      new THREE.MeshStandardMaterial({ color: 0xd6d3cd, roughness: 0.85 })
    );
    slab.position.set(0, -0.11, depth / 2);
    slab.castShadow = true;
    slab.receiveShadow = true;
    bg.add(slab);

    // Balcony railings (front and sides)
    const railMat = railStyle === "iron" ? aptIronMat : aptCedarMat;
    const railHeight = 1.0;
    // Front top rail
    const topRailF = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.06), railMat);
    topRailF.position.set(0, railHeight, depth);
    // Left & right side top rails
    const topRailL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, depth), railMat);
    topRailL.position.set(-w / 2, railHeight, depth / 2);
    const topRailR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, depth), railMat);
    topRailR.position.set(w / 2, railHeight, depth / 2);
    bg.add(topRailF, topRailL, topRailR);

    // Balusters / slats
    const numPickets = Math.round(w / 0.25);
    for (let i = 0; i <= numPickets; i++) {
      const px = -w / 2 + (w / numPickets) * i;
      const picket = new THREE.Mesh(new THREE.BoxGeometry(0.03, railHeight, 0.03), railMat);
      picket.position.set(px, railHeight / 2, depth);
      bg.add(picket);
    }
    for (let zSide = 0.2; zSide < depth; zSide += 0.25) {
      const pl = new THREE.Mesh(new THREE.BoxGeometry(0.03, railHeight, 0.03), railMat);
      pl.position.set(-w / 2, railHeight / 2, zSide);
      const pr = new THREE.Mesh(new THREE.BoxGeometry(0.03, railHeight, 0.03), railMat);
      pr.position.set(w / 2, railHeight / 2, zSide);
      bg.add(pl, pr);
    }

    return bg;
  }

  // --- Building 1: West Complex ("The Palms Apartments" at x = -36.0, z = -47.5) ---
  const apt1Group = new THREE.Group();
  const b1W = 24.0;
  const b1D = 13.0;
  const b1H = 7.4;
  const apt1StuccoMat = new THREE.MeshStandardMaterial({
    color: 0xdfd7c8, // Warm California desert sand stucco
    roughness: 0.9,
  });

  // Main 2-story building shell
  const b1Body = new THREE.Mesh(new THREE.BoxGeometry(b1W, b1H, b1D), apt1StuccoMat);
  b1Body.position.set(-36.0, b1H / 2, -47.5);
  b1Body.castShadow = true;
  b1Body.receiveShadow = true;
  apt1Group.add(b1Body);

  // Parapet eave with Spanish clay mission tiles along front roofline (z = -41.0)
  const b1ClayEaves = new THREE.Mesh(new THREE.BoxGeometry(b1W + 0.4, 0.25, 0.7), aptTerraCottaMat);
  b1ClayEaves.position.set(-36.0, b1H + 0.12, -41.0);
  b1ClayEaves.castShadow = true;
  apt1Group.add(b1ClayEaves);

  // Horizontal floor divider belt trim (at second-floor line y = 3.6m)
  const b1FloorBelt = new THREE.Mesh(
    new THREE.BoxGeometry(b1W + 0.2, 0.16, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x3a312a, roughness: 0.6 })
  );
  b1FloorBelt.position.set(-36.0, 3.6, -41.0);
  apt1Group.add(b1FloorBelt);

  // Ground Floor Entrances (Units 101 & 102)
  for (const doorX of [-43.0, -29.0]) {
    // Recessed entrance portico
    const portico = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 2.7, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xcfc5b4, roughness: 0.85 })
    );
    portico.position.set(doorX, 1.35, -40.9);

    // Front entry door
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 2.3, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x3a2c20, roughness: 0.5 })
    );
    door.position.set(doorX, 1.15, -40.95);

    // Exterior coach lantern
    const sconce = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.12), aptLampMat);
    sconce.position.set(doorX + 0.8, 1.9, -40.8);

    // Concrete walkway from door to outside sidewalk
    const walk = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.04, 3.0),
      farSidewalkMat
    );
    walk.position.set(doorX, 0.025, -39.5);
    walk.receiveShadow = true;

    apt1Group.add(portico, door, sconce, walk);
  }

  // Windows on Ground Floor
  for (const winX of [-38.0, -34.0]) {
    const win = makeAptWindow(1.8, 1.4);
    win.position.set(winX, 1.8, -41.0);
    apt1Group.add(win);
  }

  // Second Floor Balconies (Units 201 & 202)
  for (const balcX of [-43.0, -29.0]) {
    const balc = makeAptBalcony(3.2, 1.3, "iron");
    balc.position.set(balcX, 3.7, -41.0);
    balc.rotation.y = Math.PI; // Face south towards the street

    // Sliding glass balcony door
    const sDoor = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.2, 0.06), aptGlassMat);
    sDoor.position.set(balcX, 4.8, -41.02);
    apt1Group.add(balc, sDoor);
  }

  // Second Floor Windows
  for (const winX of [-38.0, -34.0]) {
    const win = makeAptWindow(1.8, 1.4);
    win.position.set(winX, 5.2, -41.0);
    apt1Group.add(win);
  }

  // Exterior Central Metal Staircase to second floor (at x = -36.0, z = -41.0)
  const stairStringerL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 4.2), aptIronMat);
  stairStringerL.position.set(-36.8, 1.85, -42.2);
  stairStringerL.rotation.x = Math.PI / 4;
  const stairStringerR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 4.2), aptIronMat);
  stairStringerR.position.set(-35.2, 1.85, -42.2);
  stairStringerR.rotation.x = Math.PI / 4;
  apt1Group.add(stairStringerL, stairStringerR);

  // Address Plaque Monument on Stone Post
  const apt1SignTex = makeApartmentSignTexture("THE PALMS", "15112");
  const apt1SignPillar = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.4, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x948b80, roughness: 0.9 })
  );
  apt1SignPillar.position.set(-25.5, 0.7, -39.6);
  const apt1SignPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.5),
    new THREE.MeshStandardMaterial({ map: apt1SignTex, roughness: 0.3 })
  );
  apt1SignPlate.position.set(-25.5, 0.75, -39.39);
  apt1Group.add(apt1SignPillar, apt1SignPlate);

  scene.add(apt1Group);

  // Building 1 collision solid
  buildingSolids.push({
    x: -36.0,
    z: -47.5,
    w: b1W,
    d: b1D,
    yBase: 0,
    yTop: b1H,
  });

  // --- Building 2: Center Complex ("Nordhoff Gardens" at x = 0.0, z = -48.0) ---
  const apt2Group = new THREE.Group();
  const b2W = 28.0;
  const b2D = 14.0;
  const b2H = 7.4;
  const apt2StuccoMat = new THREE.MeshStandardMaterial({
    color: 0xc7cbd1, // Modern cool architectural slate-grey
    roughness: 0.85,
  });

  // Main 2-story building shell
  const b2Body = new THREE.Mesh(new THREE.BoxGeometry(b2W, b2H, b2D), apt2StuccoMat);
  b2Body.position.set(0.0, b2H / 2, -48.0);
  b2Body.castShadow = true;
  b2Body.receiveShadow = true;
  apt2Group.add(b2Body);

  // Horizontal Teak/Cedar Siding Architectural Accent Panels on front facade
  for (const panelX of [-8.5, 8.5]) {
    const cedarPanel = new THREE.Mesh(new THREE.BoxGeometry(6.5, b2H - 0.2, 0.1), aptCedarMat);
    cedarPanel.position.set(panelX, b2H / 2, -41.0);
    cedarPanel.castShadow = true;
    apt2Group.add(cedarPanel);
  }

  // Modern Flat Parapet Metal Coping Cap
  const b2Coping = new THREE.Mesh(new THREE.BoxGeometry(b2W + 0.3, 0.12, b2D + 0.3), aptCopingMat);
  b2Coping.position.set(0.0, b2H + 0.06, -48.0);
  apt2Group.add(b2Coping);

  // Rooftop AC condensing units
  for (const acX of [-6.0, 6.0]) {
    const acUnit = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.9, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4, metalness: 0.6 })
    );
    acUnit.position.set(acX, b2H + 0.45, -48.0);
    apt2Group.add(acUnit);
  }

  // Ground Floor Entrances (Units 103, 104, 105)
  const b2DoorColors = [0x1e3a5f, 0x0f766e, 0x334155];
  const b2DoorX = [-9.5, 0.0, 9.5];
  for (let i = 0; i < 3; i++) {
    const dx = b2DoorX[i];
    // Modern entry stoop
    const stoop = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 1.2), farSidewalkMat);
    stoop.position.set(dx, 0.08, -41.5);

    // Front door
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 2.4, 0.06),
      new THREE.MeshStandardMaterial({ color: b2DoorColors[i], roughness: 0.4 })
    );
    door.position.set(dx, 1.25, -41.05);

    // Modern porch canopy
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.08, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.7 })
    );
    canopy.position.set(dx, 2.55, -41.35);

    // Concrete walkway connecting to sidewalk
    const walk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 3.0), farSidewalkMat);
    walk.position.set(dx, 0.025, -39.5);
    walk.receiveShadow = true;

    apt2Group.add(stoop, door, canopy, walk);
  }

  // Second Floor Balconies (Units 203, 204, 205)
  for (let i = 0; i < 3; i++) {
    const bx = b2DoorX[i];
    const balc = makeAptBalcony(2.8, 1.3, "cedar");
    balc.position.set(bx, 3.7, -41.0);
    balc.rotation.y = Math.PI;

    const sDoor = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.2, 0.06), aptGlassMat);
    sDoor.position.set(bx, 4.8, -41.02);
    apt2Group.add(balc, sDoor);
  }

  // Architectural Ribbon Windows on both floors
  for (const winX of [-4.5, 4.5]) {
    const winLow = makeAptWindow(2.2, 1.3);
    winLow.position.set(winX, 1.8, -41.0);
    const winHigh = makeAptWindow(2.2, 1.3);
    winHigh.position.set(winX, 5.2, -41.0);
    apt2Group.add(winLow, winHigh);
  }

  // Address Monument Sign
  const apt2SignTex = makeApartmentSignTexture("NORDHOFF GARDENS", "15120");
  const apt2SignPillar = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.5, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 })
  );
  apt2SignPillar.position.set(-13.0, 0.75, -39.6);
  const apt2SignPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.6),
    new THREE.MeshStandardMaterial({ map: apt2SignTex, roughness: 0.3 })
  );
  apt2SignPlate.position.set(-13.0, 0.8, -39.39);
  apt2Group.add(apt2SignPillar, apt2SignPlate);

  // Central Mailbox Kiosk Bank on concrete pad
  const mailboxPad = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 1.6), farSidewalkMat);
  mailboxPad.position.set(13.5, 0.05, -39.5);
  const mailboxBank = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.3, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.3, metalness: 0.7 })
  );
  mailboxBank.position.set(13.5, 0.75, -39.5);
  apt2Group.add(mailboxPad, mailboxBank);

  scene.add(apt2Group);

  // Building 2 collision solid
  buildingSolids.push({
    x: 0.0,
    z: -48.0,
    w: b2W,
    d: b2D,
    yBase: 0,
    yTop: b2H,
  });

  // --- Building 3: East Complex ("Vista Del Sol" at x = 36.0, z = -47.5) ---
  const apt3Group = new THREE.Group();
  const b3W = 24.0;
  const b3D = 13.0;
  const b3H = 7.4;
  const apt3StuccoMat = new THREE.MeshStandardMaterial({
    color: 0xece6d8, // Classic warm ivory cream stucco
    roughness: 0.9,
  });

  // Main 2-story building shell
  const b3Body = new THREE.Mesh(new THREE.BoxGeometry(b3W, b3H, b3D), apt3StuccoMat);
  b3Body.position.set(36.0, b3H / 2, -47.5);
  b3Body.castShadow = true;
  b3Body.receiveShadow = true;
  apt3Group.add(b3Body);

  // Decorative Pitched Hip Roof Facade with grey shingles
  const b3RoofMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 });
  const b3HipRoof = new THREE.Mesh(new THREE.BoxGeometry(b3W + 0.4, 0.6, b3D + 0.4), b3RoofMat);
  b3HipRoof.position.set(36.0, b3H + 0.3, -47.5);
  apt3Group.add(b3HipRoof);

  // Ground Floor Entrances with White Columns & Porticos (Units 106 & 107)
  for (const doorX of [29.0, 43.0]) {
    const colL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 8), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 }));
    colL.position.set(doorX - 0.9, 1.3, -40.6);
    const colR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 8), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 }));
    colR.position.set(doorX + 0.9, 1.3, -40.6);
    const porticoTop = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 0.9), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 }));
    porticoTop.position.set(doorX, 2.6, -40.75);

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 2.3, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 })
    );
    door.position.set(doorX, 1.15, -40.95);

    const walk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 3.0), farSidewalkMat);
    walk.position.set(doorX, 0.025, -39.5);
    walk.receiveShadow = true;

    apt3Group.add(colL, colR, porticoTop, door, walk);
  }

  // Windows with Navy Decorative Shutters (x in [34.0, 38.0])
  const shutterMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
  for (const winX of [34.0, 38.0]) {
    for (const winY of [1.8, 5.2]) {
      const win = makeAptWindow(1.6, 1.4);
      win.position.set(winX, winY, -41.0);
      const shutL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.4, 0.04), shutterMat);
      shutL.position.set(winX - 0.95, winY, -40.96);
      const shutR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.4, 0.04), shutterMat);
      shutR.position.set(winX + 0.95, winY, -40.96);
      apt3Group.add(win, shutL, shutR);
    }
  }

  // Second Floor Full-Length Access Gallery / Veranda (at y = 3.6m)
  const galleryFloor = new THREE.Mesh(
    new THREE.BoxGeometry(b3W - 2.0, 0.22, 1.4),
    farSidewalkMat
  );
  galleryFloor.position.set(36.0, 3.6, -40.3);
  galleryFloor.castShadow = true;
  apt3Group.add(galleryFloor);

  // Gallery Decorative White Railings
  const galleryRailMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
  const galleryTopRail = new THREE.Mesh(new THREE.BoxGeometry(b3W - 2.0, 0.06, 0.06), galleryRailMat);
  galleryTopRail.position.set(36.0, 4.6, -39.6);
  apt3Group.add(galleryTopRail);
  for (let rx = 26.0; rx <= 46.0; rx += 0.4) {
    const baluster = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.95, 0.04), galleryRailMat);
    baluster.position.set(rx, 4.12, -39.6);
    apt3Group.add(baluster);
  }

  // Second floor unit entry doors
  for (const doorX of [29.0, 43.0]) {
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 2.3, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 })
    );
    door.position.set(doorX, 4.85, -40.95);
    apt3Group.add(door);
  }

  // Side Staircase to second floor gallery (at west end x = 24.5)
  const stairStringer3 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 4.4), galleryRailMat);
  stairStringer3.position.set(24.5, 1.85, -41.2);
  stairStringer3.rotation.z = Math.PI / 4;
  apt3Group.add(stairStringer3);

  // Address Monument on Brick Post
  const apt3SignTex = makeApartmentSignTexture("VISTA DEL SOL", "15132");
  const apt3SignPillar = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.4, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xa85d45, roughness: 0.9 })
  );
  apt3SignPillar.position.set(47.5, 0.7, -39.6);
  const apt3SignPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.5),
    new THREE.MeshStandardMaterial({ map: apt3SignTex, roughness: 0.3 })
  );
  apt3SignPlate.position.set(47.5, 0.75, -39.39);
  apt3Group.add(apt3SignPillar, apt3SignPlate);

  scene.add(apt3Group);

  // Building 3 collision solid
  buildingSolids.push({
    x: 36.0,
    z: -47.5,
    w: b3W,
    d: b3D,
    yBase: 0,
    yTop: b3H,
  });

  // --- 2g) Iconic American School Bus ---
  // Parked next to the outside sidewalk (curb at x = 58.0), on the east side of the vehicle gate, facing south (+Z).
  function makeSchoolBusSignTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f59e0b"; // School bus yellow
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = "#09090b";
    ctx.font = "900 64px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SCHOOL BUS", 256, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  }

  function makeStopSignTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 256, 256);

    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    const r = 112;
    const cx = 128;
    const cy = 128;
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4 + Math.PI / 8;
      const px = cx + r * Math.cos(angle);
      const py = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    ctx.lineWidth = 6;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 62px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("STOP", 128, 128);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  }

  function buildSchoolBus(): THREE.Group {
    const bus = new THREE.Group();

    const busYellowMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.15 });
    const busRoofMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
    const busBlackMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.7, metalness: 0.2 });
    const busGlassMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.1,
      metalness: 0.7,
      transparent: true,
      opacity: 0.88,
    });
    const busChromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.9 });
    const busTireMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.85 });
    const busLightRedMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.8 });
    const busLightAmberMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.8 });
    const busLightHeadMat = new THREE.MeshStandardMaterial({ color: 0xfffae0, emissive: 0xfef08a, emissiveIntensity: 0.6 });

    // 1) Main Lower Body (Yellow Box)
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.15, 7.8), busYellowMat);
    lowerBody.position.set(0, 1.15, -0.7);
    lowerBody.castShadow = true;
    bus.add(lowerBody);

    // 2) Conventional Engine Hood ("Dog Nose")
    const hood = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.95, 2.2), busYellowMat);
    hood.position.set(0, 1.05, 4.3);
    hood.castShadow = true;
    bus.add(hood);

    // Chrome/Black Radiator Grille
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.72, 0.08), busChromeMat);
    grille.position.set(0, 0.95, 5.41);
    bus.add(grille);

    // Heavy wrap-around front bumper
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.38, 0.32), busBlackMat);
    frontBumper.position.set(0, 0.42, 5.45);
    frontBumper.castShadow = true;
    bus.add(frontBumper);

    // Folded yellow safety crossing arm across front bumper
    const crossingArm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.05), busYellowMat);
    crossingArm.position.set(0.1, 0.42, 5.62);
    bus.add(crossingArm);

    // Heavy rear bumper
    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.38, 0.32), busBlackMat);
    rearBumper.position.set(0, 0.42, -4.65);
    rearBumper.castShadow = true;
    bus.add(rearBumper);

    // 3) Black Rub Rails (3 horizontal stripes along both body sides)
    for (const ry of [0.75, 1.25, 1.70]) {
      const rubRail = new THREE.Mesh(new THREE.BoxGeometry(2.76, 0.06, 7.8), busBlackMat);
      rubRail.position.set(0, ry, -0.7);
      bus.add(rubRail);
    }

    // 4) Upper Cabin & Curved Roof
    const upperCabin = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.95, 7.8), busYellowMat);
    upperCabin.position.set(0, 2.18, -0.7);
    upperCabin.castShadow = true;
    bus.add(upperCabin);

    // Curved Yellow Roof
    const mainRoof = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.35, 8.4), busYellowMat);
    mainRoof.position.set(0, 2.80, -0.4);
    mainRoof.castShadow = true;
    bus.add(mainRoof);

    // White Heat-Reflective Roof Top Cap
    const whiteRoofCap = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 8.2), busRoofMat);
    whiteRoofCap.position.set(0, 2.98, -0.4);
    bus.add(whiteRoofCap);

    // Emergency Roof Escape Hatches
    for (const hz of [-2.2, 1.2]) {
      const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 0.85), busRoofMat);
      hatch.position.set(0, 3.03, hz);
      bus.add(hatch);
    }

    // 5) Windows
    // Front angled two-piece windshield
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.85, 0.08), busGlassMat);
    windshield.position.set(0, 2.15, 3.22);
    windshield.rotation.x = 0.12;
    bus.add(windshield);
    const windshieldDivider = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.86, 0.09), busBlackMat);
    windshieldDivider.position.set(0, 2.15, 3.22);
    windshieldDivider.rotation.x = 0.12;
    bus.add(windshieldDivider);

    // Passenger Entry Door on right side (-X, facing sidewalk!)
    // Bi-fold door panels with upper/lower glass panes
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.85, 0.95), busBlackMat);
    doorFrame.position.set(-1.36, 1.5, 2.4);
    const doorGlassTop = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.85), busGlassMat);
    doorGlassTop.position.set(-1.36, 2.0, 2.4);
    const doorGlassBottom = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.85), busGlassMat);
    doorGlassBottom.position.set(-1.36, 1.05, 2.4);
    bus.add(doorFrame, doorGlassTop, doorGlassBottom);

    // Driver side window on left side (+X)
    const driverWin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.72, 1.1), busGlassMat);
    driverWin.position.set(1.36, 2.18, 2.4);
    bus.add(driverWin);

    // Left side passenger windows (7 panes)
    for (let i = 0; i < 7; i++) {
      const pwin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.68, 0.85), busGlassMat);
      pwin.position.set(1.36, 2.18, 1.4 - i * 0.98);
      bus.add(pwin);
    }

    // Right side passenger windows (6 panes behind entry door)
    for (let i = 0; i < 6; i++) {
      const pwin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.68, 0.85), busGlassMat);
      pwin.position.set(-1.36, 2.18, 1.4 - i * 0.98);
      bus.add(pwin);
    }

    // Rear emergency door windows at z = -4.62
    const rearWinTop = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.55, 0.04), busGlassMat);
    rearWinTop.position.set(0, 2.2, -4.62);
    const rearWinBottom = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 0.04), busGlassMat);
    rearWinBottom.position.set(0, 1.4, -4.62);
    const rearDoorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.85, 0.02), busBlackMat);
    rearDoorFrame.position.set(0, 1.6, -4.61);
    bus.add(rearWinTop, rearWinBottom, rearDoorFrame);

    // 6) "SCHOOL BUS" Roof Header Signage
    const schoolBusSignTex = makeSchoolBusSignTexture();
    const signMat = new THREE.MeshStandardMaterial({ map: schoolBusSignTex, roughness: 0.4 });

    // Front Header Sign Box
    const signFront = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.28, 0.08), busYellowMat);
    signFront.position.set(0, 2.82, 3.82);
    const signFrontFace = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.26), signMat);
    signFrontFace.position.set(0, 2.82, 3.87);
    bus.add(signFront, signFrontFace);

    // Rear Header Sign Box
    const signRear = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.28, 0.08), busYellowMat);
    signRear.position.set(0, 2.82, -4.62);
    const signRearFace = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.26), signMat);
    signRearFace.position.set(0, 2.82, -4.67);
    signRearFace.rotation.y = Math.PI;
    bus.add(signRear, signRearFace);

    // 7) 8-Way Flashing Warning Lights (Amber & Red)
    // Front roof header flashers
    for (const sx of [-1.15, 1.15]) {
      const amberLight = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 12), busLightAmberMat);
      amberLight.rotation.x = Math.PI / 2;
      amberLight.position.set(sx, 2.85, 3.84);
      bus.add(amberLight);
    }
    for (const sx of [-0.75, 0.75]) {
      const redLight = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 12), busLightRedMat);
      redLight.rotation.x = Math.PI / 2;
      redLight.position.set(sx, 2.85, 3.84);
      bus.add(redLight);
    }
    // Rear roof header flashers
    for (const sx of [-1.15, 1.15]) {
      const amberLight = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 12), busLightAmberMat);
      amberLight.rotation.x = Math.PI / 2;
      amberLight.position.set(sx, 2.85, -4.64);
      bus.add(amberLight);
    }
    for (const sx of [-0.75, 0.75]) {
      const redLight = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 12), busLightRedMat);
      redLight.rotation.x = Math.PI / 2;
      redLight.position.set(sx, 2.85, -4.64);
      bus.add(redLight);
    }

    // 8) Side Stop Paddle Sign (Driver Side +X)
    const stopSignTex = makeStopSignTexture();
    const stopSignPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.65, 0.65),
      new THREE.MeshStandardMaterial({ map: stopSignTex, roughness: 0.3 })
    );
    stopSignPlate.position.set(1.42, 1.85, 1.8);
    const stopSignBracket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.08), busBlackMat);
    stopSignBracket.position.set(1.36, 1.85, 1.8);
    bus.add(stopSignPlate, stopSignBracket);

    // 9) Mirrors
    // Driver side mirror assembly
    const mirrorDriver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.25), busBlackMat);
    mirrorDriver.position.set(1.58, 2.1, 3.1);
    const mirrorBracketDriver = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.04), busBlackMat);
    mirrorBracketDriver.position.set(1.44, 2.1, 3.1);
    // Passenger side mirror assembly
    const mirrorPass = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.25), busBlackMat);
    mirrorPass.position.set(-1.58, 2.1, 3.1);
    const mirrorBracketPass = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.04), busBlackMat);
    mirrorBracketPass.position.set(-1.44, 2.1, 3.1);
    bus.add(mirrorDriver, mirrorBracketDriver, mirrorPass, mirrorBracketPass);

    // Front hood convex crossover bubble mirrors
    for (const sx of [-1.22, 1.22]) {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6), busBlackMat);
      stalk.position.set(sx, 1.35, 5.2);
      stalk.rotation.z = sx > 0 ? 0.3 : -0.3;
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), busChromeMat);
      bubble.position.set(sx > 0 ? sx + 0.1 : sx - 0.1, 1.5, 5.2);
      bus.add(stalk, bubble);
    }

    // 10) Headlights & Taillights
    for (const sx of [-0.85, 0.85]) {
      const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 14), busLightHeadMat);
      hl.rotation.x = Math.PI / 2;
      hl.position.set(sx, 0.95, 5.43);
      const turn = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 12), busLightAmberMat);
      turn.rotation.x = Math.PI / 2;
      turn.position.set(sx, 0.72, 5.43);
      bus.add(hl, turn);
    }
    // Rear round brake & turn lights
    for (const sx of [-1.0, 1.0]) {
      const brake = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 14), busLightRedMat);
      brake.rotation.x = Math.PI / 2;
      brake.position.set(sx, 0.95, -4.63);
      const turnRear = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 12), busLightAmberMat);
      turnRear.rotation.x = Math.PI / 2;
      turnRear.position.set(sx, 0.72, -4.63);
      bus.add(brake, turnRear);
    }

    // 11) Wheels (Front single, rear dual wheels)
    // Front Wheels
    for (const wx of [-1.22, 1.22]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.28, 18), busTireMat);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(wx, 0.48, 3.6);
      tire.castShadow = true;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.30, 14), busYellowMat);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(wx, 0.48, 3.6);
      bus.add(tire, hub);
    }

    // Rear Dual Wheels (2 tires on each side)
    for (const baseWx of [-1.22, 1.22]) {
      for (const dOffset of [-0.14, 0.14]) {
        const wx = baseWx + (baseWx > 0 ? dOffset : -dOffset);
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.24, 18), busTireMat);
        tire.rotation.z = Math.PI / 2;
        tire.position.set(wx, 0.48, -2.6);
        tire.castShadow = true;
        bus.add(tire);
      }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.54, 14), busYellowMat);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(baseWx, 0.48, -2.6);
      bus.add(hub);
    }

    return bus;
  }

  // School Bus 1: parked next to outside sidewalk curb leading toward gate (x = 59.75, z = 47.0, facing south)
  const schoolBus1 = buildSchoolBus();
  schoolBus1.position.set(59.75, 0.02, 47.0);
  schoolBus1.rotation.y = 0; // facing south (+Z)
  scene.add(schoolBus1);

  // School Bus 2: parked in line behind Bus 1 (x = 59.75, z = 34.0, facing south)
  const schoolBus2 = buildSchoolBus();
  schoolBus2.position.set(59.75, 0.02, 34.0);
  schoolBus2.rotation.y = 0; // facing south (+Z)
  scene.add(schoolBus2);

  // 3) Grass field: green soccer turf with slightly rounded corners
  const field = layoutData.field;
  const cornerRadius = (field as any).cornerRadius ?? 2.5;

  function createRoundedRectShape(w: number, d: number, r: number): THREE.Shape {
    const shape = new THREE.Shape();
    const x = -w / 2;
    const y = -d / 2;
    shape.moveTo(x + r, y);
    shape.lineTo(x + w - r, y);
    shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    shape.lineTo(x + w, y + d - r);
    shape.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2, false);
    shape.lineTo(x + r, y + d);
    shape.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI, false);
    shape.lineTo(x, y + r);
    shape.absarc(x + r, y + r, r, Math.PI, (3 * Math.PI) / 2, false);
    return shape;
  }

  const fieldShape = createRoundedRectShape(field.width, field.depth, cornerRadius);
  const fieldGeo = new THREE.ShapeGeometry(fieldShape, 16);
  const fieldMesh = new THREE.Mesh(
    fieldGeo,
    new THREE.MeshStandardMaterial({ map: makeNoiseTexture("#69a04f", 22, 6), roughness: 1 })
  );
  fieldMesh.rotation.x = -Math.PI / 2;
  fieldMesh.position.set(field.center.x, 0.04, field.center.z);
  fieldMesh.receiveShadow = true;
  scene.add(fieldMesh);

  // --- Soccer Goal Posts (North and South ends of the grass field, facing each other) ---
  // Style: Clean Heavy-Duty In-Ground School Goal Posts with concrete ground sleeves,
  // rounded welded elbow corners, and 45-degree inside corner reinforcement gusset braces.
  const goalPostMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.25,
    metalness: 0.2,
  });
  const groundCollarMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.85,
    metalness: 0.1,
  });

  function createSoccerGoal(): THREE.Group {
    const goal = new THREE.Group();
    const goalWidth = 6.0;
    const goalHeight = 2.44;
    const postRadius = 0.07; // Sturdy 14cm / 5.5" heavy-duty steel tube
    const gussetOffset = 0.45;
    const gussetLen = Math.hypot(gussetOffset, gussetOffset);

    // 1. Two Upright Vertical Posts
    for (const px of [-goalWidth / 2, goalWidth / 2]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(postRadius, postRadius, goalHeight, 18),
        goalPostMat
      );
      post.position.set(px, goalHeight / 2, 0);
      post.castShadow = true;
      goal.add(post);

      // Concrete / steel ground foundation collar
      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(postRadius + 0.04, postRadius + 0.05, 0.08, 16),
        groundCollarMat
      );
      collar.position.set(px, 0.04, 0);
      collar.castShadow = true;
      goal.add(collar);
    }

    // 2. Horizontal Crossbar (spans between the two vertical posts)
    const crossbarLen = goalWidth - postRadius * 2;
    const crossbar = new THREE.Mesh(
      new THREE.CylinderGeometry(postRadius, postRadius, crossbarLen, 18),
      goalPostMat
    );
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, goalHeight, 0);
    crossbar.castShadow = true;
    goal.add(crossbar);

    // 3. Smooth Welded Elbow Corners (spheres at top left & top right junctions)
    for (const px of [-goalWidth / 2, goalWidth / 2]) {
      const elbow = new THREE.Mesh(
        new THREE.SphereGeometry(postRadius, 18, 14),
        goalPostMat
      );
      elbow.position.set(px, goalHeight, 0);
      elbow.castShadow = true;
      goal.add(elbow);
    }

    // 4. 45° Corner Reinforcement Gusset Braces (inside top corners)
    // Left corner gusset:
    const leftGusset = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, gussetLen, 12),
      goalPostMat
    );
    leftGusset.position.set(-goalWidth / 2 + gussetOffset / 2, goalHeight - gussetOffset / 2, 0);
    leftGusset.rotation.z = -Math.PI / 4;
    leftGusset.castShadow = true;
    goal.add(leftGusset);

    // Right corner gusset:
    const rightGusset = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, gussetLen, 12),
      goalPostMat
    );
    rightGusset.position.set(goalWidth / 2 - gussetOffset / 2, goalHeight - gussetOffset / 2, 0);
    rightGusset.rotation.z = Math.PI / 4;
    rightGusset.castShadow = true;
    goal.add(rightGusset);

    return goal;
  }

  // Goal 1: North side of the grass field (z = 12.0, mouth facing South / +Z towards center of field)
  const northGoal = createSoccerGoal();
  northGoal.position.set(field.center.x, 0.04, 12.0);
  northGoal.rotation.y = 0; // facing south
  scene.add(northGoal);
  buildingSolids.push(
    { x: field.center.x - 3.0, z: 12.0, w: 0.35, d: 0.35, yBase: 0, yTop: 2.5 },
    { x: field.center.x + 3.0, z: 12.0, w: 0.35, d: 0.35, yBase: 0, yTop: 2.5 }
  );

  // Goal 2: South side of the grass field (z = 40.0, mouth facing North / -Z towards center of field)
  const southGoal = createSoccerGoal();
  southGoal.position.set(field.center.x, 0.04, 40.0);
  southGoal.rotation.y = Math.PI; // facing north (facing each other)
  scene.add(southGoal);
  buildingSolids.push(
    { x: field.center.x - 3.0, z: 40.0, w: 0.35, d: 0.35, yBase: 0, yTop: 2.5 },
    { x: field.center.x + 3.0, z: 40.0, w: 0.35, d: 0.35, yBase: 0, yTop: 2.5 }
  );

  // --- Soccer Field Markings (Center circle, halfway line, center kick spot) ---
  const fieldLineMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    transparent: true,
    opacity: 0.82,
  });

  const halfwayLine = new THREE.Mesh(
    new THREE.PlaneGeometry(field.width - 2.0, 0.12),
    fieldLineMat
  );
  halfwayLine.rotation.x = -Math.PI / 2;
  halfwayLine.position.set(field.center.x, 0.045, field.center.z);
  halfwayLine.receiveShadow = true;
  scene.add(halfwayLine);

  const centerCircleGeo = new THREE.RingGeometry(4.44, 4.56, 48);
  const centerCircle = new THREE.Mesh(centerCircleGeo, fieldLineMat);
  centerCircle.rotation.x = -Math.PI / 2;
  centerCircle.position.set(field.center.x, 0.045, field.center.z);
  centerCircle.receiveShadow = true;
  scene.add(centerCircle);

  const centerSpot = new THREE.Mesh(
    new THREE.CircleGeometry(0.24, 24),
    fieldLineMat
  );
  centerSpot.rotation.x = -Math.PI / 2;
  centerSpot.position.set(field.center.x, 0.046, field.center.z);
  centerSpot.receiveShadow = true;
  scene.add(centerSpot);

  // --- Soccer Ball ---------------------------------------------------------
  const BALL_RADIUS = 0.24;
  const BALL_GROUND_Y = 0.04 + BALL_RADIUS; // resting height on turf
  const BALL_RESTITUTION = 0.62; // bouncy turf bounce factor
  const BALL_FRICTION = 2.4; // turf rolling deceleration (m/s²)
  const BALL_GRAVITY = 15.0; // gravity (m/s²)

  function createSoccerBallTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 512, 256);

    ctx.strokeStyle = "#b0bec5";
    ctx.lineWidth = 2.5;

    const drawPentagon = (cx: number, cy: number, r: number) => {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = "#1e293b";
      ctx.fill();
      ctx.stroke();
    };

    for (let i = 0; i < 6; i++) {
      drawPentagon(((i + 0.5) * 512) / 6, 128, 20);
    }
    for (let i = 0; i < 6; i++) {
      drawPentagon((i * 512) / 6, 62, 17);
      drawPentagon((i * 512) / 6, 194, 17);
    }
    drawPentagon(128, 10, 14);
    drawPentagon(384, 10, 14);
    drawPentagon(128, 246, 14);
    drawPentagon(384, 246, 14);

    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const xMid = ((i + 0.5) * 512) / 6;
      const xLeft = (i * 512) / 6;
      const xRight = ((i + 1) * 512) / 6;
      ctx.moveTo(xMid, 128); ctx.lineTo(xLeft, 62);
      ctx.moveTo(xMid, 128); ctx.lineTo(xRight, 62);
      ctx.moveTo(xMid, 128); ctx.lineTo(xLeft, 194);
      ctx.moveTo(xMid, 128); ctx.lineTo(xRight, 194);
    }
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const ballTexture = createSoccerBallTexture();
  const ballMaterial = new THREE.MeshStandardMaterial({
    map: ballTexture,
    roughness: 0.35,
    metalness: 0.1,
  });
  const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 28, 20);
  const ballMesh = new THREE.Mesh(ballGeo, ballMaterial);
  ballMesh.position.set(field.center.x, BALL_GROUND_Y, field.center.z);
  ballMesh.castShadow = true;
  ballMesh.receiveShadow = true;
  scene.add(ballMesh);

  // Soft contact shadow underneath ball
  const ballShadowMat = new THREE.MeshBasicMaterial({
    color: 0x142814,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const ballShadowMesh = new THREE.Mesh(
    new THREE.CircleGeometry(BALL_RADIUS * 1.05, 20),
    ballShadowMat
  );
  ballShadowMesh.rotation.x = -Math.PI / 2;
  ballShadowMesh.position.set(field.center.x, 0.043, field.center.z);
  scene.add(ballShadowMesh);

  const ballPos = new THREE.Vector3(field.center.x, BALL_GROUND_Y, field.center.z);
  const ballVel = new THREE.Vector3(0, 0, 0);
  const ballOrientation = new THREE.Quaternion();
  let goalCelebrationTimer = 0;

  // Floating celebration banner
  const goalBanner = document.createElement("div");
  goalBanner.id = "goal-banner";
  goalBanner.textContent = "⚽ GOAL! ⚽";
  goalBanner.style.cssText =
    "position:fixed;top:18%;left:50%;transform:translateX(-50%) scale(0);background:rgba(15,23,42,0.92);color:#facc15;font-family:sans-serif;font-size:32px;font-weight:900;letter-spacing:1px;padding:14px 32px;border-radius:14px;border:3px solid #facc15;box-shadow:0 12px 35px rgba(0,0,0,0.45);pointer-events:none;z-index:1000;opacity:0;transition:transform 0.35s cubic-bezier(0.175,0.885,0.32,1.275),opacity 0.35s;text-align:center;";
  container.appendChild(goalBanner);

  function triggerGoal(goalName: string) {
    if (goalCelebrationTimer > 0) return;
    goalCelebrationTimer = 3.0;
    goalBanner.textContent = `⚽ GOAL! (${goalName.toUpperCase()}) ⚽`;
    goalBanner.style.transform = "translateX(-50%) scale(1)";
    goalBanner.style.opacity = "1";
  }

  function resetBall() {
    ballPos.set(field.center.x, BALL_GROUND_Y, field.center.z);
    ballVel.set(0, 0, 0);
    ballOrientation.set(0, 0, 0, 1);
    ballMesh.position.copy(ballPos);
    ballMesh.quaternion.copy(ballOrientation);
    ballShadowMesh.position.set(ballPos.x, 0.043, ballPos.z);
    ballShadowMesh.scale.set(1, 1, 1);
    (ballShadowMesh.material as THREE.MeshBasicMaterial).opacity = 0.45;
  }

  // --- Soccer Ball Water Runoff Vent (Reset Mechanism) -----------------------
  // Positioned at the bottom-right corner of the grass field (South-East corner:
  // x = 45.5, z = 39.2). Modeled authentically as an in-ground stormwater catch basin
  // with a heavy cast-iron slotted drain grate. Stepping onto the spring-loaded grate
  // depresses it and resets the soccer ball to the center kickoff spot.
  const PLATE_X = 45.5;
  const PLATE_Z = 39.2;

  function createWaterRunoffVentTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;

    // 1. Dark weathered cast-iron base plate
    ctx.fillStyle = "#1e2229";
    ctx.fillRect(0, 0, 512, 512);

    // Subtle cast iron surface stippling
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    for (let i = 0; i < 600; i++) {
      const rx = (Math.sin(i * 12.3) * 0.5 + 0.5) * 512;
      const ry = (Math.cos(i * 34.5) * 0.5 + 0.5) * 512;
      ctx.fillRect(rx, ry, 2, 2);
    }

    // 2. Heavy bevel outer perimeter iron frame
    const frameBorder = 32;
    ctx.strokeStyle = "#333b47";
    ctx.lineWidth = 6;
    ctx.strokeRect(frameBorder, frameBorder, 512 - frameBorder * 2, 512 - frameBorder * 2);

    ctx.strokeStyle = "#0d1117";
    ctx.lineWidth = 4;
    ctx.strokeRect(frameBorder + 4, frameBorder + 4, 512 - (frameBorder + 4) * 2, 512 - (frameBorder + 4) * 2);

    // 3. Four corner heavy anchor bolts
    const drawBolt = (bx: number, by: number) => {
      ctx.beginPath();
      ctx.arc(bx, by, 12, 0, Math.PI * 2);
      ctx.fillStyle = "#111827";
      ctx.fill();
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // Hex head
      ctx.beginPath();
      for (let h = 0; h < 6; h++) {
        const a = (h * Math.PI) / 3;
        const hx = bx + Math.cos(a) * 7;
        const hy = by + Math.sin(a) * 7;
        if (h === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fillStyle = "#64748b";
      ctx.fill();
    };
    drawBolt(frameBorder / 2 + 2, frameBorder / 2 + 2);
    drawBolt(512 - frameBorder / 2 - 2, frameBorder / 2 + 2);
    drawBolt(frameBorder / 2 + 2, 512 - frameBorder / 2 - 2);
    drawBolt(512 - frameBorder / 2 - 2, 512 - frameBorder / 2 - 2);

    // 4. Full-surface slotted cast-iron storm grate
    // Grate runs continuously across the interior with 3 tiers of drainage slots
    // separated by 2 heavy structural horizontal cross-tie ribs (no center circle)
    const slotStartX = 46;
    const slotEndX = 512 - 46;
    const slotW = 16;
    const slotSpacing = 27;

    const tiers = [
      { y: 46, h: 114 },
      { y: 198, h: 116 },
      { y: 352, h: 114 },
    ];

    for (const tier of tiers) {
      for (let x = slotStartX; x <= slotEndX; x += slotSpacing) {
        // Deep drainage slot void into the catch basin below
        ctx.fillStyle = "#030712";
        ctx.fillRect(x, tier.y, slotW, tier.h);
        // Beveled metallic iron slot rim highlight
        ctx.strokeStyle = "#384252";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, tier.y, slotW, tier.h);
        // Subtle depth gradient / water runoff reflection
        ctx.fillStyle = "rgba(2, 132, 199, 0.12)";
        ctx.fillRect(x + 2, tier.y + 2, slotW - 4, tier.h - 4);
      }
    }

    // Horizontal structural tie-bars between slot tiers
    const drawCrossRib = (y: number, h: number) => {
      ctx.fillStyle = "#262d38";
      ctx.fillRect(36, y, 512 - 72, h);
      ctx.strokeStyle = "#3a4659";
      ctx.lineWidth = 2;
      ctx.strokeRect(36, y, 512 - 72, h);
      // Center weld / rib indentation line
      ctx.strokeStyle = "#161b22";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(42, y + h / 2);
      ctx.lineTo(512 - 42, y + h / 2);
      ctx.stroke();
    };

    drawCrossRib(160, 38);
    drawCrossRib(314, 38);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // --- Water Runoff Vent 3D Assembly ---
  const ventGroup = new THREE.Group();
  ventGroup.position.set(PLATE_X, 0.04, PLATE_Z);
  scene.add(ventGroup);

  // 1. Concrete catch basin curb collar embedded flush in turf
  const concreteCollarMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.95,
    metalness: 0.05,
  });
  const concreteCollar = new THREE.Mesh(
    new THREE.BoxGeometry(1.65, 0.045, 1.65),
    concreteCollarMat
  );
  concreteCollar.position.y = 0.02;
  concreteCollar.receiveShadow = true;
  ventGroup.add(concreteCollar);

  // 2. Deep recessed dark drainage sump cavity
  const sumpMat = new THREE.MeshBasicMaterial({ color: 0x020617 });
  const sumpCavity = new THREE.Mesh(
    new THREE.BoxGeometry(1.36, 0.08, 1.36),
    sumpMat
  );
  sumpCavity.position.y = 0.01;
  ventGroup.add(sumpCavity);

  // 3. Cast-iron spring-loaded drain grate (the interactive pad)
  const padTopMat = new THREE.MeshStandardMaterial({
    map: createWaterRunoffVentTexture(),
    roughness: 0.55,
    metalness: 0.85,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 0.0,
  });
  const padSideMat = new THREE.MeshStandardMaterial({
    color: 0x1e2430,
    roughness: 0.7,
    metalness: 0.8,
  });
  const padMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.26, 0.035, 1.26),
    [padSideMat, padSideMat, padTopMat, padSideMat, padSideMat, padSideMat]
  );
  padMesh.position.y = 0.038; // resting height
  padMesh.receiveShadow = true;
  padMesh.castShadow = true;
  ventGroup.add(padMesh);

  // Water ripple ring that pulses outwards when stepped on
  const shockwaveMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  });
  const shockwaveMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.12, 0.28, 32),
    shockwaveMat
  );
  shockwaveMesh.rotation.x = -Math.PI / 2;
  shockwaveMesh.position.y = 0.042;
  ventGroup.add(shockwaveMesh);

  // --- Reset Notification Floating Banner & UI Hint ---
  const resetBanner = document.createElement("div");
  resetBanner.id = "plate-reset-toast";
  resetBanner.textContent = "⚽ All balls were reset! 🏀";
  resetBanner.style.cssText =
    "position:fixed;top:26%;left:50%;transform:translateX(-50%) scale(0);background:rgba(15,23,42,0.94);color:#38bdf8;font-family:system-ui,-apple-system,sans-serif;font-size:22px;font-weight:800;letter-spacing:0.5px;padding:12px 28px;border-radius:12px;border:2px solid #38bdf8;box-shadow:0 8px 30px rgba(0,0,0,0.5);pointer-events:none;z-index:1000;opacity:0;transition:transform 0.3s cubic-bezier(0.175,0.885,0.32,1.275),opacity 0.3s;text-align:center;";
  container.appendChild(resetBanner);

  const plateHint = document.getElementById("plate-hint");
  if (plateHint) {
    plateHint.textContent = "Step here to reset all balls ⚽ 🏀";
    plateHint.style.cssText =
      "position:fixed;bottom:78px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,0.92);color:#38bdf8;font-family:system-ui,-apple-system,sans-serif;font-size:15px;font-weight:700;letter-spacing:0.4px;padding:9px 22px;border-radius:20px;border:1.5px solid rgba(56,189,248,0.7);box-shadow:0 8px 24px rgba(0,0,0,0.4);pointer-events:none;z-index:900;opacity:0;transition:opacity 0.25s, transform 0.25s;display:none;";
  }

  let plateIsPressed = false;
  let resetBannerTimer = 0;
  let shockwaveScale = 0.2;
  let shockwaveOpacity = 0;

  type HoopTarget = {
    id: string;
    rimX: number;
    rimY: number;
    rimZ: number;
    rimRadius: number;
    boardX: number;
    boardZ: number;
    dirX: number;
    dirZ: number;
  };
  const hoopTargets: HoopTarget[] = [];

  // Full-court running East-West with 1 hoop on west, 1 on east, plus 3 hoops along north sideline.
  const bball = (layoutData as any).basketballCourt;
  if (bball) {
    const courtMat = new THREE.MeshStandardMaterial({
      map: makeNoiseTexture("#24384a", 12, 8),
      roughness: 0.9,
    });
    const keyMat = new THREE.MeshStandardMaterial({
      map: makeNoiseTexture("#1e5235", 6, 6),
      roughness: 0.9,
    });
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });

    // Main court surface pad
    const courtMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(bball.width, bball.depth),
      courtMat
    );
    courtMesh.rotation.x = -Math.PI / 2;
    courtMesh.position.set(bball.center.x, 0.03, bball.center.z);
    courtMesh.receiveShadow = true;
    scene.add(courtMesh);

    // Court border line
    const halfW = bball.width / 2;
    const halfD = bball.depth / 2;
    const lineThickness = 0.08;

    function addCourtLine(x1: number, z1: number, x2: number, z2: number) {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const isX = Math.abs(x2 - x1) > Math.abs(z2 - z1);
      const geo = new THREE.PlaneGeometry(isX ? len : lineThickness, isX ? lineThickness : len);
      const mesh = new THREE.Mesh(geo, lineMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set((x1 + x2) / 2, 0.032, (z1 + z2) / 2);
      scene.add(mesh);
    }

    // Outer boundary
    addCourtLine(bball.center.x - halfW, bball.center.z - halfD, bball.center.x + halfW, bball.center.z - halfD);
    addCourtLine(bball.center.x - halfW, bball.center.z + halfD, bball.center.x + halfW, bball.center.z + halfD);
    addCourtLine(bball.center.x - halfW, bball.center.z - halfD, bball.center.x - halfW, bball.center.z + halfD);
    addCourtLine(bball.center.x + halfW, bball.center.z - halfD, bball.center.x + halfW, bball.center.z + halfD);

    // Half-court line
    addCourtLine(bball.center.x, bball.center.z - halfD, bball.center.x, bball.center.z + halfD);

    // Center circle
    const centerCircle = new THREE.Mesh(
      new THREE.RingGeometry(1.75, 1.83, 32),
      lineMat
    );
    centerCircle.rotation.x = -Math.PI / 2;
    centerCircle.position.set(bball.center.x, 0.032, bball.center.z);
    scene.add(centerCircle);

    // Keys for West and East full-court ends
    const keyWidth = 3.6;
    const keyLength = 4.8;
    for (const side of [-1, 1]) {
      const keyBaseX = bball.center.x + side * halfW;
      const keyInnerX = keyBaseX - side * keyLength;
      const keyMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(keyLength, keyWidth),
        keyMat
      );
      keyMesh.rotation.x = -Math.PI / 2;
      keyMesh.position.set((keyBaseX + keyInnerX) / 2, 0.031, bball.center.z);
      keyMesh.receiveShadow = true;
      scene.add(keyMesh);

      // Key boundary lines
      addCourtLine(keyBaseX, bball.center.z - keyWidth / 2, keyInnerX, bball.center.z - keyWidth / 2);
      addCourtLine(keyBaseX, bball.center.z + keyWidth / 2, keyInnerX, bball.center.z + keyWidth / 2);
      addCourtLine(keyInnerX, bball.center.z - keyWidth / 2, keyInnerX, bball.center.z + keyWidth / 2);

      // Free throw circle
      const ftCircle = new THREE.Mesh(
        new THREE.RingGeometry(1.75, 1.83, 32),
        lineMat
      );
      ftCircle.rotation.x = -Math.PI / 2;
      ftCircle.position.set(keyInnerX, 0.032, bball.center.z);
      scene.add(ftCircle);
    }

    // Basketball hoops
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.5, metalness: 0.7 });
    const padMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.7 }); // safety pad
    const boardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.1 });
    const targetBoxMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.6 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.3, metalness: 0.4 });
    const netMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.9, transparent: true, opacity: 0.85 });

    for (const hoop of bball.hoops) {
      const [dirX, dirZ] = hoop.dir;

      // Pole set back 0.7m behind the backboard
      const poleDist = 0.7;
      const poleX = hoop.x - dirX * poleDist;
      const poleZ = hoop.z - dirZ * poleDist;

      // Vertical steel post
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.8, 12), poleMat);
      pole.position.set(poleX, 1.9, poleZ);
      pole.castShadow = true;
      scene.add(pole);
      buildingSolids.push({ x: poleX, z: poleZ, w: 0.4, d: 0.4, yBase: 0, yTop: 3.8 });

      // Protective foam pad on lower post
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.4, 12), padMat);
      pad.position.set(poleX, 0.7, poleZ);
      pad.castShadow = true;
      scene.add(pad);

      // Overhang gooseneck arm connecting pole to backboard
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(
          dirX !== 0 ? poleDist : 0.08,
          0.08,
          dirZ !== 0 ? poleDist : 0.08
        ),
        poleMat
      );
      arm.position.set((poleX + hoop.x) / 2, 3.25, (poleZ + hoop.z) / 2);
      arm.castShadow = true;
      scene.add(arm);

      // Diagonal support strut
      const strut = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.6, 8),
        poleMat
      );
      strut.position.set(poleX + dirX * 0.3, 3.4, poleZ + dirZ * 0.3);
      scene.add(strut);

      // Backboard (1.8m wide x 1.05m tall x 0.04m thick, solid opaque white)
      const boardThick = 0.04;
      const bw = dirX !== 0 ? boardThick : 1.8;
      const bd = dirZ !== 0 ? boardThick : 1.8;
      const board = new THREE.Mesh(new THREE.BoxGeometry(bw, 1.05, bd), boardMat);
      board.position.set(hoop.x, 3.3, hoop.z);
      board.castShadow = true;
      scene.add(board);

      // Inner target shooter square (offset 3mm on front face so no z-fighting)
      const targetOffset = boardThick / 2 + 0.003;
      const targetW = dirX !== 0 ? 0.004 : 0.59;
      const targetD = dirZ !== 0 ? 0.004 : 0.59;
      const target = new THREE.Mesh(new THREE.BoxGeometry(targetW, 0.45, targetD), targetBoxMat);
      target.position.set(hoop.x + dirX * targetOffset, 3.15, hoop.z + dirZ * targetOffset);
      scene.add(target);

      // Regulation rim at 3.05m (10 feet)
      const rimX = hoop.x + dirX * 0.38;
      const rimZ = hoop.z + dirZ * 0.38;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.022, 8, 24), rimMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(rimX, 3.05, rimZ);
      rim.castShadow = true;
      scene.add(rim);

      // Rim mount bracket
      const bracketW = dirX !== 0 ? 0.18 : 0.08;
      const bracketD = dirZ !== 0 ? 0.18 : 0.08;
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(bracketW, 0.06, bracketD), rimMat);
      bracket.position.set((hoop.x + rimX) / 2, 3.05, (hoop.z + rimZ) / 2);
      scene.add(bracket);

      // Net
      const net = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.13, 0.42, 12, 1, true), netMat);
      net.position.set(rimX, 2.82, rimZ);
      scene.add(net);

      hoopTargets.push({
        id: hoop.id,
        rimX,
        rimY: 3.05,
        rimZ,
        rimRadius: 0.23,
        boardX: hoop.x,
        boardZ: hoop.z,
        dirX,
        dirZ,
      });
    }
  }

  // --- Basketball & Realistic Ball Physics ----------------------------------
  const BASKETBALL_RADIUS = 0.12; // Official Size 7 regulation radius (12cm)
  const BASKETBALL_GROUND_Y = 0.03 + BASKETBALL_RADIUS; // resting height on court (0.15m)
  const BASKETBALL_RESTITUTION = 0.78; // high-bounce leather on asphalt court
  const BASKETBALL_GRAVITY = 16.0;

  function createBasketballTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;

    // Rich burnt orange composite leather
    ctx.fillStyle = "#ea580c";
    ctx.fillRect(0, 0, 512, 256);

    // Fine pebble grain
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    for (let i = 0; i < 2500; i++) {
      const px = (Math.sin(i * 9.1) * 0.5 + 0.5) * 512;
      const py = (Math.cos(i * 17.3) * 0.5 + 0.5) * 256;
      ctx.fillRect(px, py, 1.5, 1.5);
    }
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    for (let i = 0; i < 1500; i++) {
      const px = (Math.cos(i * 13.7) * 0.5 + 0.5) * 512;
      const py = (Math.sin(i * 23.9) * 0.5 + 0.5) * 256;
      ctx.fillRect(px, py, 1.2, 1.2);
    }

    // Black regulation rubber seams / channels
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";

    // Horizontal equator seam
    ctx.beginPath();
    ctx.moveTo(0, 128);
    ctx.lineTo(512, 128);
    ctx.stroke();

    // Vertical meridian seams
    ctx.beginPath();
    ctx.moveTo(128, 0);
    ctx.lineTo(128, 256);
    ctx.moveTo(384, 0);
    ctx.lineTo(384, 256);
    ctx.stroke();

    // Curved side channel ribs
    ctx.beginPath();
    ctx.bezierCurveTo(30, 20, 90, 80, 90, 128);
    ctx.bezierCurveTo(90, 176, 30, 236, 0, 240);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(256, 0);
    ctx.bezierCurveTo(220, 60, 220, 196, 256, 256);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(512, 16);
    ctx.bezierCurveTo(460, 60, 460, 196, 512, 240);
    ctx.stroke();

    // Brand logo stamp
    ctx.font = "900 18px sans-serif";
    ctx.fillStyle = "rgba(17, 24, 39, 0.75)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("VALOR 7", 256, 92);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  const bballTex = createBasketballTexture();
  const bballMat = new THREE.MeshStandardMaterial({
    map: bballTex,
    roughness: 0.5,
    metalness: 0.1,
  });
  const bballGeo = new THREE.SphereGeometry(BASKETBALL_RADIUS, 32, 24);
  const bballMesh = new THREE.Mesh(bballGeo, bballMat);
  const bballCourtCenter = bball ? bball.center : { x: 27.5, z: 53.0 };
  bballMesh.position.set(bballCourtCenter.x, BASKETBALL_GROUND_Y, bballCourtCenter.z);
  bballMesh.castShadow = true;
  scene.add(bballMesh);

  // Dynamic ground contact shadow
  const bballShadowMat = new THREE.MeshBasicMaterial({
    color: 0x0f172a,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const bballShadowMesh = new THREE.Mesh(
    new THREE.CircleGeometry(BASKETBALL_RADIUS * 1.05, 20),
    bballShadowMat
  );
  bballShadowMesh.rotation.x = -Math.PI / 2;
  bballShadowMesh.position.set(bballCourtCenter.x, 0.033, bballCourtCenter.z);
  scene.add(bballShadowMesh);

  const bballPos = new THREE.Vector3(bballCourtCenter.x, BASKETBALL_GROUND_Y, bballCourtCenter.z);
  const bballVel = new THREE.Vector3(0, 0, 0);
  const bballOrientation = new THREE.Quaternion();
  const bballAngVel = new THREE.Vector3(0, 0, 0);
  let bballHeld = false;
  let bballShootAnimTimer = 0;
  let bballDribblePhase = 0;
  let basketCelebrationTimer = 0;
  let lastBballY = BASKETBALL_GROUND_Y;

  // Basket celebration floating banner
  const basketBanner = document.createElement("div");
  basketBanner.id = "basket-banner";
  basketBanner.textContent = "🏀 SWISH! 🏀";
  basketBanner.style.cssText =
    "position:fixed;top:18%;left:50%;transform:translateX(-50%) scale(0);background:rgba(15,23,42,0.94);color:#ea580c;font-family:system-ui,-apple-system,sans-serif;font-size:32px;font-weight:900;letter-spacing:1px;padding:14px 32px;border-radius:14px;border:3px solid #ea580c;box-shadow:0 12px 35px rgba(0,0,0,0.5);pointer-events:none;z-index:1000;opacity:0;transition:transform 0.35s cubic-bezier(0.175,0.885,0.32,1.275),opacity 0.35s;text-align:center;";
  container.appendChild(basketBanner);

  // Ball interaction HUD prompt
  const bballHint = document.createElement("div");
  bballHint.id = "bball-hint";
  bballHint.textContent = "Press E to shoot at hoop 🏀";
  bballHint.style.cssText =
    "position:fixed;bottom:78px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,0.92);color:#ea580c;font-family:system-ui,-apple-system,sans-serif;font-size:15px;font-weight:700;letter-spacing:0.4px;padding:9px 22px;border-radius:20px;border:1.5px solid rgba(234,88,12,0.7);box-shadow:0 8px 24px rgba(0,0,0,0.4);pointer-events:none;z-index:900;opacity:0;transition:opacity 0.25s, transform 0.25s;display:none;";
  container.appendChild(bballHint);

  function triggerBucket(text: string) {
    if (basketCelebrationTimer > 0) return;
    basketCelebrationTimer = 2.8;
    basketBanner.textContent = text;
    basketBanner.style.transform = "translateX(-50%) scale(1)";
    basketBanner.style.opacity = "1";
  }

  function resetBasketball() {
    bballHeld = false;
    bballPos.set(bballCourtCenter.x, BASKETBALL_GROUND_Y, bballCourtCenter.z);
    bballVel.set(0, 0, 0);
    bballAngVel.set(0, 0, 0);
    bballOrientation.set(0, 0, 0, 1);
    bballMesh.position.copy(bballPos);
    bballMesh.quaternion.copy(bballOrientation);
    bballShadowMesh.position.set(bballPos.x, 0.033, bballPos.z);
    bballShadowMesh.scale.set(1, 1, 1);
    (bballShadowMesh.material as THREE.MeshBasicMaterial).opacity = 0.45;
  }

  function shootBasketball() {
    if (!bballHeld) return;
    bballHeld = false;
    bballShootAnimTimer = 0.45;

    // Determine target hoop aligned with player facing orientation
    const facingX = Math.sin(player.rotation.y);
    const facingZ = Math.cos(player.rotation.y);

    let bestHoop = hoopTargets[0];
    let bestScore = -Infinity;

    for (const h of hoopTargets) {
      const toX = h.rimX - player.position.x;
      const toZ = h.rimZ - player.position.z;
      const dist = Math.hypot(toX, toZ);
      const dot = (facingX * toX + facingZ * toZ) / (dist || 1);
      const score = dot * 3.0 - dist * 0.08;
      if (score > bestScore) {
        bestScore = score;
        bestHoop = h;
      }
    }

    if (!bestHoop) return;

    // Release from player's hands high above head
    bballPos.set(
      player.position.x + facingX * 0.4,
      player.position.y + 1.55,
      player.position.z + facingZ * 0.4
    );

    const dx = bestHoop.rimX - bballPos.x;
    const dz = bestHoop.rimZ - bballPos.z;
    const distH = Math.hypot(dx, dz);
    const dy = bestHoop.rimY - bballPos.y; // 3.05 - 1.55 = 1.50

    // Optimal basketball shooting arc
    const apexAboveRim = Math.max(0.9, Math.min(2.8, 0.75 + distH * 0.15));
    const totalApexHeight = dy + apexAboveRim;

    const vy = Math.sqrt(2 * BASKETBALL_GRAVITY * totalApexHeight);
    const tRise = vy / BASKETBALL_GRAVITY;
    const tFall = Math.sqrt((2 * apexAboveRim) / BASKETBALL_GRAVITY);
    const totalFlightTime = tRise + tFall;

    const vH = distH / totalFlightTime;
    const nx = distH > 0.001 ? dx / distH : facingX;
    const nz = distH > 0.001 ? dz / distH : facingZ;

    // Small touch variance (+/- 1.5%)
    const touchVariance = (Math.random() - 0.5) * 0.03;
    const finalVH = vH * (1 + touchVariance);

    bballVel.set(nx * finalVH, vy, nz * finalVH);

    // Realistic backspin
    bballAngVel.set(-nz * 16.0, 0, nx * 16.0);
  }


  // =========================================================================
  // BUILDINGS - solid ground story (walls) + a walkable second-floor platform
  // ringed by second-story walls, plus an exterior staircase up to it.
  // =========================================================================
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xe8e0d2, roughness: 0.9 });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xb0b8c0, roughness: 0.95 });
  const stairMaterial = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 1 });
  const railingMaterial = new THREE.MeshStandardMaterial({ color: 0x7a2f2f, roughness: 0.7, metalness: 0.2 });
  const railingHeight = layoutData.boundary.railingHeight; // second-story wall height (6)



  // Ground-level solid walls (collision happens below, via `collides`).
  for (const wall of walls) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(wall.w, roofY, wall.d), wallMaterial);
    mesh.position.set(wall.x, roofY / 2, wall.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // --- Windows -------------------------------------------------------------
  // - Second floor:
  //   * East side of West bldg & South side of North bldg: 4 large windows starting from floor, touching walkway.
  //   * West side of West bldg & North side of North bldg: 4 standard exterior windows (y = floor2 + 2.2).
  // - First floor:
  //   * West side of West bldg & North side of North bldg: 4 horizontal rectangular windows
  //     positioned closer to the top of the first floor wall (y = 3.25m).
  // All windows feature transparent blue glass and realistic interior room depth.
  // The classroom windows look like real windows: pale reflective glass with a soft glare in front of a lit
  // room (ceiling lights, blinds drawn to different heights). They are not see-through into the real
  // classrooms: those are separate spaces, shared with the other players of the same room only.
  const glareTexture = (() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const g = c.getContext("2d")!;
    // sky reflection: brighter at the top
    const sky = g.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0, "rgba(170,210,240,0.30)");
    sky.addColorStop(0.55, "rgba(120,165,205,0.10)");
    sky.addColorStop(1, "rgba(90,130,170,0.04)");
    g.fillStyle = sky;
    g.fillRect(0, 0, 256, 256);
    // two diagonal glare streaks
    g.fillStyle = "rgba(255,255,255,0.16)";
    for (const [x, w] of [[40, 34], [118, 14]]) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + w, 0);
      g.lineTo(x + w - 120, 256);
      g.lineTo(x - 120, 256);
      g.closePath();
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: glareTexture,
    roughness: 0.04,
    metalness: 0.35,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  });
  /** What you glimpse of the room through the glass: back wall, ceiling lights and blinds at some height */
  function makeWindowInteriorMaterial(blinds: number, tint: string, lit = false, person = 0): THREE.MeshStandardMaterial {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const g = c.getContext("2d")!;
    // back wall, lit from above
    const wall = g.createLinearGradient(0, 0, 0, 256);
    wall.addColorStop(0, lit ? "#f7e9b8" : "#8d887a");
    wall.addColorStop(0.35, lit ? "#e1cf93" : tint);
    wall.addColorStop(1, lit ? "#8c7a52" : "#1c1b19");
    g.fillStyle = wall;
    g.fillRect(0, 0, 256, 256);
    // ceiling light panels glowing along the top
    g.fillStyle = "rgba(255,248,220,1)";
    g.fillRect(20, 4, 96, 16);
    g.fillRect(140, 4, 96, 16);
    // a hint of furniture / posters at the bottom
    g.fillStyle = "rgba(60,50,45,0.55)";
    g.fillRect(20, 200, 90, 56);
    g.fillRect(150, 214, 86, 42);
    g.fillStyle = "rgba(190,60,60,0.55)";
    g.fillRect(168, 120, 40, 52);
    // someone is in the room: a silhouette moving about behind the glass (the blinds may cover part of it)
    if (person > 0) {
      const px = person === 1 ? 82 : 176;
      g.fillStyle = "rgba(38,30,26,0.9)";
      g.beginPath();
      g.arc(px, 126, 17, 0, Math.PI * 2); // head
      g.fill();
      g.beginPath();
      g.ellipse(px, 196, 36, 56, 0, Math.PI, 0); // shoulders and torso
      g.lineTo(px + 36, 256);
      g.lineTo(px - 36, 256);
      g.closePath();
      g.fill();
    }
    // vertical blinds drawn across from the left side to the given fraction (they open and close horizontally)
    const edge = Math.round(256 * blinds);
    for (let x = 0; x < edge; x += 9) {
      g.fillStyle = (x / 9) % 2 === 0 ? (lit ? "#f3ead0" : "#d9d1ba") : (lit ? "#cdbf97" : "#a39b85");
      g.fillRect(x, 0, 7, 256);
      g.fillStyle = "rgba(0,0,0,0.18)";
      g.fillRect(x + 7, 0, 2, 256);
    }
    if (blinds > 0) {
      g.fillStyle = "#a59e8b"; // leading edge of the stack
      g.fillRect(edge, 0, 6, 256);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    // lit rooms glow a little, so they read as "lights on" even in shade
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, ...(lit ? { emissive: 0xffe2a0, emissiveMap: t, emissiveIntensity: 0.55 } : {}) });
  }
  const windowInteriors = [
    makeWindowInteriorMaterial(0.45, "#5a564d"),
    makeWindowInteriorMaterial(0.8, "#524e45"),
    makeWindowInteriorMaterial(0, "#605b51"),
    makeWindowInteriorMaterial(0.25, "#5d594f"),
  ];
  // the same four looks with the lights on and someone inside
  const windowLitInteriors = [
    makeWindowInteriorMaterial(0.45, "#5a564d", true, 1),
    makeWindowInteriorMaterial(0.8, "#524e45", true, 2),
    makeWindowInteriorMaterial(0, "#605b51", true, 1),
    makeWindowInteriorMaterial(0.25, "#5d594f", true, 2),
  ];
  let windowCounter = 0;
  /** Windows by classroom: their lit panels switch on while somebody is in that room (multiplayer) */
  const roomWindows = new Map<string, Array<{ mesh: THREE.Mesh; variant: number }>>();
  function setRoomLit(roomId: string, lit: boolean): void {
    for (const w of roomWindows.get(roomId) ?? []) w.mesh.material = (lit ? windowLitInteriors : windowInteriors)[w.variant];
  }
  /** Which homeroom classroom a window belongs to: the stamp room whose door is the nearest one before it along the wall */
  function windowRoomId(building: "west" | "north", along: number, upper: boolean): string | undefined {
    let best: { id: string; c: number } | undefined;
    for (const d of layoutData.doors) {
      if (d.floor !== (upper ? 1 : 0) || roomById(d.id)?.type !== "stamp") continue;
      const onBuilding = building === "west" ? d.axis === "z" && d.x === -14 : d.axis === "x" && d.z === -2;
      if (!onBuilding) continue;
      const c = building === "west" ? d.z : d.x;
      // upstairs a window belongs to the nearest door; downstairs to the nearest one before it
      if (upper ? !best || Math.abs(c - along) < Math.abs(best.c - along) : c <= along + 0.01 && (!best || c > best.c)) best = { id: d.id, c };
    }
    return best?.id;
  }
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.8 });
  const sillMaterial = new THREE.MeshStandardMaterial({ color: 0xd9d4c6, roughness: 0.85 });
  /** A sill under the window and a horizontal muntin across it (so the glass reads as framed panes) */
  function addWindowExtras(cx: number, cy: number, cz: number, w: number, h: number, alongZ: boolean, outward: number): void {
    const sillLong = w + 0.22;
    const sill = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? 0.3 : sillLong, 0.07, alongZ ? sillLong : 0.3), sillMaterial);
    sill.position.set(cx + (alongZ ? outward * 0.15 : 0), cy - h / 2 - 0.02, cz + (alongZ ? 0 : outward * 0.15));
    sill.castShadow = true;
    const muntin = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? 0.12 : w, 0.05, alongZ ? w : 0.12), frameMaterial);
    muntin.position.set(cx + (alongZ ? outward * 0.09 : 0), cy + h * 0.1, cz + (alongZ ? 0 : outward * 0.09));
    scene.add(sill, muntin);
  }

  // 1) Standard second-floor exterior windows
  const winY = floor2 + 2.2;
  const stdFrameGeoZ = new THREE.BoxGeometry(0.16, 2.0, 1.6);
  const stdBackingGeoZ = new THREE.BoxGeometry(0.02, 1.8, 1.4);
  const stdGlassGeoZ = new THREE.BoxGeometry(0.04, 1.8, 1.4);
  const stdMullionGeoZ = new THREE.BoxGeometry(0.14, 1.8, 0.06);

  const stdFrameGeoX = new THREE.BoxGeometry(1.6, 2.0, 0.16);
  const stdBackingGeoX = new THREE.BoxGeometry(1.4, 1.8, 0.02);
  const stdGlassGeoX = new THREE.BoxGeometry(1.4, 1.8, 0.04);
  const stdMullionGeoX = new THREE.BoxGeometry(0.06, 1.8, 0.14);

  // 2) First-floor high horizontal rectangular windows (closer to top of the 4m ground wall)
  const HIGH_WIN_W = 2.2; // length horizontal
  const HIGH_WIN_H = 0.75; // shorter vertical profile
  const firstFloorHighWinY = 3.25; // near the top of the ground-story wall (roofY = 4.0)

  const highFrameGeoZ = new THREE.BoxGeometry(0.16, HIGH_WIN_H + 0.1, HIGH_WIN_W + 0.1);
  const highBackingGeoZ = new THREE.BoxGeometry(0.02, HIGH_WIN_H, HIGH_WIN_W);
  const highGlassGeoZ = new THREE.BoxGeometry(0.04, HIGH_WIN_H, HIGH_WIN_W);
  const highMullionGeoZ = new THREE.BoxGeometry(0.14, HIGH_WIN_H, 0.06);

  const highFrameGeoX = new THREE.BoxGeometry(HIGH_WIN_W + 0.1, HIGH_WIN_H + 0.1, 0.16);
  const highBackingGeoX = new THREE.BoxGeometry(HIGH_WIN_W, HIGH_WIN_H, 0.02);
  const highGlassGeoX = new THREE.BoxGeometry(HIGH_WIN_W, HIGH_WIN_H, 0.04);
  const highMullionGeoX = new THREE.BoxGeometry(0.06, HIGH_WIN_H, 0.14);

  // 3) Large floor-to-ceiling walkway-facing windows (touching the walkway floor)
  const LARGE_WIN_H = 2.6; // height matching door tops
  const LARGE_WIN_W = 2.4; // wide architectural pane
  const largeWinY = floor2 + LARGE_WIN_H / 2; // bottom rests exactly on floor2
  const largeFrameGeoZ = new THREE.BoxGeometry(0.16, LARGE_WIN_H, LARGE_WIN_W);
  const largeBackingGeoZ = new THREE.BoxGeometry(0.02, LARGE_WIN_H - 0.12, LARGE_WIN_W - 0.12);
  const largeGlassGeoZ = new THREE.BoxGeometry(0.04, LARGE_WIN_H - 0.12, LARGE_WIN_W - 0.12);
  const largeMullionGeoZ = new THREE.BoxGeometry(0.14, LARGE_WIN_H - 0.12, 0.08);
  const largeTransomGeoZ = new THREE.BoxGeometry(0.14, 0.06, LARGE_WIN_W - 0.12);

  const largeFrameGeoX = new THREE.BoxGeometry(LARGE_WIN_W, LARGE_WIN_H, 0.16);
  const largeBackingGeoX = new THREE.BoxGeometry(LARGE_WIN_W - 0.12, LARGE_WIN_H - 0.12, 0.02);
  const largeGlassGeoX = new THREE.BoxGeometry(LARGE_WIN_W - 0.12, LARGE_WIN_H - 0.12, 0.04);
  const largeMullionGeoX = new THREE.BoxGeometry(0.08, LARGE_WIN_H - 0.12, 0.14);
  const largeTransomGeoX = new THREE.BoxGeometry(LARGE_WIN_W - 0.12, 0.06, 0.14);

  /**
   * One window in a wall: the lit room (textured panel) at the wall face, the glass just in front of it,
   * and a real frame around it (four bars, a centre mullion and a cross bar) with a sill underneath.
   * planeCoord = the wall's position on its normal axis, along = where the window is along the wall.
   */
  function buildWindow(planeCoord: number, along: number, cy: number, w: number, h: number, alongZ: boolean, outward: number, barY: number, roomId?: string): void {
    const place = (m: THREE.Mesh, n: number, a: number, y: number): THREE.Mesh => {
      m.position.set(alongZ ? planeCoord + outward * n : along + a, y, alongZ ? along + a : planeCoord + outward * n);
      scene.add(m);
      return m;
    };
    const box = (dn: number, dy: number, da: number, mat: THREE.Material): THREE.Mesh =>
      new THREE.Mesh(new THREE.BoxGeometry(alongZ ? dn : da, dy, alongZ ? da : dn), mat);
    const inner = 0.09; // frame bar width
    const variant = windowCounter++ % windowInteriors.length;
    const room = place(box(0.02, h - inner * 2, w - inner * 2, windowInteriors[variant]), 0.012, 0, cy); // the room behind the glass
    if (roomId) {
      if (!roomWindows.has(roomId)) roomWindows.set(roomId, []);
      roomWindows.get(roomId)!.push({ mesh: room, variant });
    }
    place(box(0.02, h - inner * 2, w - inner * 2, glassMaterial), 0.05, 0, cy); // the glass
    // frame
    place(box(0.14, inner, w, frameMaterial), 0.07, 0, cy + h / 2 - inner / 2);
    place(box(0.14, inner, w, frameMaterial), 0.07, 0, cy - h / 2 + inner / 2);
    place(box(0.14, h - inner * 2, inner, frameMaterial), 0.07, -(w / 2 - inner / 2), cy);
    place(box(0.14, h - inner * 2, inner, frameMaterial), 0.07, w / 2 - inner / 2, cy);
    // mullion and cross bar
    place(box(0.09, h - inner * 2, 0.05, frameMaterial), 0.075, 0, cy);
    place(box(0.09, 0.05, w - inner * 2, frameMaterial), 0.075, 0, barY);
    // sill
    const sill = place(box(0.3, 0.07, w + 0.22, sillMaterial), 0.15, 0, cy - h / 2 - 0.02);
    sill.castShadow = true;
  }

  // Standard second-floor window helpers
  function addWindowZ(xWall: number, z: number, outward: number) {
    buildWindow(xWall, z, winY, 1.6, 2.0, true, outward, winY + 0.1, windowRoomId("west", z, true));
  }
  function addWindowX(x: number, zWall: number, outward: number) {
    buildWindow(zWall, x, winY, 1.6, 2.0, false, outward, winY + 0.1, windowRoomId("north", x, true));
  }

  // First-floor high horizontal window helpers (closer to top of ground wall)
  function addFirstFloorHighWindowZ(xWall: number, z: number, outward: number) {
    buildWindow(xWall, z, firstFloorHighWinY, HIGH_WIN_W + 0.1, HIGH_WIN_H + 0.1, true, outward, firstFloorHighWinY, windowRoomId("west", z, false));
  }
  function addFirstFloorHighWindowX(x: number, zWall: number, outward: number) {
    buildWindow(zWall, x, firstFloorHighWinY, HIGH_WIN_W + 0.1, HIGH_WIN_H + 0.1, false, outward, firstFloorHighWinY, windowRoomId("north", x, false));
  }

  // Large walkway window helpers (touching the walkway at floor2)
  function addLargeWindowZ(xWall: number, z: number, outward: number) {
    buildWindow(xWall, z, largeWinY, LARGE_WIN_W, LARGE_WIN_H, true, outward, floor2 + 1.8, windowRoomId("west", z, true));
  }
  function addLargeWindowX(x: number, zWall: number, outward: number) {
    // the office windows (zWall -10.5) belong to rooms that stay closed, so only the north building's get a room
    buildWindow(zWall, x, largeWinY, LARGE_WIN_W, LARGE_WIN_H, false, outward, floor2 + 1.8, zWall === -2 ? windowRoomId("north", x, true) : undefined);
  }

  // West building:
  // - 2nd floor east: 4 large windows touching walkway
  // - 2nd floor west: 4 standard exterior windows
  // - 1st floor west: 4 horizontal rectangular windows closer to top of wall
  // Upstairs, from the stairs on the MPR side: window, CSUN door, LMU door, window, window, UCLA door, USC door, window
  for (const z of [34.3, 26.7, 14.3, 6.7]) {
    addLargeWindowZ(-14, z, 1);             // 2nd floor East side (large, begins from floor touching walkway)
    addWindowZ(-30, z, -1);                  // 2nd floor West side (standard exterior)
  }
  for (const z of [8.5, 18.5, 28.5, 38.5]) {
    addFirstFloorHighWindowZ(-30, z, -1);   // 1st floor West side (horizontal rectangular, closer to top of wall)
  }

  // North building:
  // - 2nd floor south: 4 large windows touching walkway
  // - 2nd floor north: 4 standard exterior windows
  // - 1st floor north: 4 horizontal rectangular windows closer to top of wall
  // Upstairs, from the stairs on the east end: window, CSUN door, LMU door, window, window, UCLA door, USC door, window
  for (const x of [35.3, 27.7, 15.3, 7.7]) {
    addLargeWindowX(x, -2, 1);              // 2nd floor South side (large, begins from floor touching walkway)
    addWindowX(x, -20, -1);                 // 2nd floor North side (standard exterior)
  }
  for (const x of [8, 20, 32, 42]) {
    addFirstFloorHighWindowX(x, -20, -1);   // 1st floor North side (horizontal rectangular, closer to top of wall)
  }

  // Office building 2nd floor south side: 2 large windows stretching to the floor
  // (one to the right of learning-center at x = -26, one to the right of music at x = -16)
  addLargeWindowX(-22.5, -10.5, 1);
  addLargeWindowX(-12.5, -10.5, 1);

  // --- Roofs (second floor): a walkable platform inset within each building --
  // Track the roof footprints so the player can stand on them, so the
  // second-story walls know where to go, and so the walkway can be placed.
  type Roof = { minX: number; maxX: number; minZ: number; maxZ: number };
  const roofs: Roof[] = [];
  for (const wall of walls) {
    const inset = 0; // second floor has the SAME footprint as the first floor
    const roof: Roof = {
      minX: wall.x - wall.w / 2 + inset,
      maxX: wall.x + wall.w / 2 - inset,
      minZ: wall.z - wall.d / 2 + inset,
      maxZ: wall.z + wall.d / 2 - inset,
    };
    roofs.push(roof);

    // The floor slab of the second story (sits on top of the ground walls).
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(roof.maxX - roof.minX, 0.1, roof.maxZ - roof.minZ),
      roofMaterial
    );
    cap.position.set((roof.minX + roof.maxX) / 2, roofY + 0.05, (roof.minZ + roof.maxZ) / 2);
    cap.receiveShadow = true;
    scene.add(cap);
  }

  // --- Second-story walls: a closed wall around each roof platform. The roof is
  // not an access route any more - the player reaches the second floor via the
  // exterior walkway. Solid only up on the second floor (height-aware).
  for (const roof of roofs) {
    const t = 0.25; // wall thickness
    const roofCX = (roof.minX + roof.maxX) / 2;
    const roofCZ = (roof.minZ + roof.maxZ) / 2;
    const segs = [
      { x: roofCX, z: roof.minZ + t / 2, w: roof.maxX - roof.minX, d: t },
      { x: roofCX, z: roof.maxZ - t / 2, w: roof.maxX - roof.minX, d: t },
      { x: roof.minX + t / 2, z: roofCZ, w: t, d: roof.maxZ - roof.minZ },
      { x: roof.maxX - t / 2, z: roofCZ, w: t, d: roof.maxZ - roof.minZ },
    ];
    for (const seg of segs) {
      const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(seg.w, railingHeight, seg.d), wallMaterial);
      wallMesh.position.set(seg.x, floor2 + railingHeight / 2, seg.z);
      wallMesh.castShadow = true;
      railingSolids.push({ x: seg.x, z: seg.z, w: seg.w, d: seg.d, yBase: floor2, yTop: floor2 + railingHeight });
      scene.add(wallMesh);
    }
  }

  // --- Flat Top Roofs (closing all buildings at the top of the second story) ---
  const roofTopY = floor2 + railingHeight; // 7.6m
  const flatRoofMaterial = new THREE.MeshStandardMaterial({
    color: 0xbac2ca, // clean modern light gravel / reflective cool-roof membrane
    roughness: 0.95,
  });
  const roofCopingMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a929a, // metal coping cap flashing along parapet edges
    roughness: 0.5,
    metalness: 0.25,
  });
  const hvacCurbMaterial = new THREE.MeshStandardMaterial({
    color: 0x3e454d, // dark industrial equipment curb
    roughness: 0.9,
  });
  const hvacBodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x98a0a8, // galvanized sheet metal HVAC casing
    roughness: 0.45,
    metalness: 0.35,
  });
  const hvacGrilleMaterial = new THREE.MeshStandardMaterial({
    color: 0x2e353c, // dark recessed condenser fan grille
    roughness: 0.8,
  });
  const roofHatchMaterial = new THREE.MeshStandardMaterial({
    color: 0x687078, // industrial maintenance roof access hatch
    roughness: 0.4,
    metalness: 0.4,
  });
  const ventMaterial = new THREE.MeshStandardMaterial({
    color: 0x8c949c, // spun aluminum exhaust vent
    roughness: 0.4,
    metalness: 0.5,
  });

  // Reusable shared geometries for rooftop equipment (optimal GPU buffer reuse)
  const hvacCurbGeo = new THREE.BoxGeometry(2.3, 0.14, 1.6);
  const hvacBodyGeo = new THREE.BoxGeometry(2.1, 0.9, 1.4);
  const hvacGrilleGeo = new THREE.BoxGeometry(0.95, 0.08, 0.95);
  const hvacLouverGeo = new THREE.BoxGeometry(0.08, 0.5, 0.9);

  const largeHvacCurbGeo = new THREE.BoxGeometry(3.2, 0.14, 2.2);
  const largeHvacBodyGeo = new THREE.BoxGeometry(3.0, 1.1, 2.0);
  const largeHvacGrilleGeo = new THREE.BoxGeometry(1.4, 0.08, 1.4);

  const ventBaseGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.35, 10);
  const ventCapGeo = new THREE.CylinderGeometry(0.28, 0.18, 0.12, 10);

  const hatchCurbGeo = new THREE.BoxGeometry(1.3, 0.22, 1.05);
  const hatchLidGeo = new THREE.BoxGeometry(1.36, 0.06, 1.11);

  const roofSurfaceY = roofTopY + 0.11; // 7.71m (surface height of the roof deck)

  function addHvacUnit(x: number, z: number, rotY = 0) {
    const group = new THREE.Group();
    const curb = new THREE.Mesh(hvacCurbGeo, hvacCurbMaterial);
    curb.position.set(0, 0.07, 0);
    curb.castShadow = true;
    curb.receiveShadow = true;

    const body = new THREE.Mesh(hvacBodyGeo, hvacBodyMaterial);
    body.position.set(0, 0.14 + 0.45, 0);
    body.castShadow = true;
    body.receiveShadow = true;

    const grille = new THREE.Mesh(hvacGrilleGeo, hvacGrilleMaterial);
    grille.position.set(0.4, 0.14 + 0.9 + 0.04, 0);
    grille.castShadow = true;

    const louver = new THREE.Mesh(hvacLouverGeo, hvacGrilleMaterial);
    louver.position.set(-0.95, 0.14 + 0.5, 0);

    group.add(curb, body, grille, louver);
    group.rotation.y = rotY;
    group.position.set(x, roofSurfaceY, z);
    scene.add(group);
  }

  function addLargeHvacUnit(x: number, z: number, rotY = 0) {
    const group = new THREE.Group();
    const curb = new THREE.Mesh(largeHvacCurbGeo, hvacCurbMaterial);
    curb.position.set(0, 0.07, 0);
    curb.castShadow = true;
    curb.receiveShadow = true;

    const body = new THREE.Mesh(largeHvacBodyGeo, hvacBodyMaterial);
    body.position.set(0, 0.14 + 0.55, 0);
    body.castShadow = true;
    body.receiveShadow = true;

    const grille = new THREE.Mesh(largeHvacGrilleGeo, hvacGrilleMaterial);
    grille.position.set(0.6, 0.14 + 1.1 + 0.04, 0);
    grille.castShadow = true;

    group.add(curb, body, grille);
    group.rotation.y = rotY;
    group.position.set(x, roofSurfaceY, z);
    scene.add(group);
  }

  function addVent(x: number, z: number) {
    const base = new THREE.Mesh(ventBaseGeo, ventMaterial);
    base.position.set(x, roofSurfaceY + 0.175, z);
    base.castShadow = true;
    const cap = new THREE.Mesh(ventCapGeo, ventMaterial);
    cap.position.set(x, roofSurfaceY + 0.35 + 0.06, z);
    cap.castShadow = true;
    scene.add(base, cap);
  }

  function addRoofHatch(x: number, z: number, rotY = 0) {
    const group = new THREE.Group();
    const curb = new THREE.Mesh(hatchCurbGeo, hvacCurbMaterial);
    curb.position.set(0, 0.11, 0);
    curb.castShadow = true;
    const lid = new THREE.Mesh(hatchLidGeo, roofHatchMaterial);
    lid.position.set(0, 0.22 + 0.03, 0);
    lid.rotation.x = 0.04;
    lid.castShadow = true;
    group.add(curb, lid);
    group.rotation.y = rotY;
    group.position.set(x, roofSurfaceY, z);
    scene.add(group);
  }

  // Build the flat top roof and perimeter coping caps for each building
  for (let i = 0; i < roofs.length; i++) {
    const roof = roofs[i];
    const bldgW = roof.maxX - roof.minX;
    const bldgD = roof.maxZ - roof.minZ;
    const roofCX = (roof.minX + roof.maxX) / 2;
    const roofCZ = (roof.minZ + roof.maxZ) / 2;

    // 1) Flat roof deck slab: solid continuous cover over the top of the building walls
    const roofDeckMesh = new THREE.Mesh(
      new THREE.BoxGeometry(bldgW, 0.22, bldgD),
      flatRoofMaterial
    );
    roofDeckMesh.position.set(roofCX, roofTopY, roofCZ);
    roofDeckMesh.castShadow = true;
    roofDeckMesh.receiveShadow = true;
    scene.add(roofDeckMesh);

    // 2) Parapet coping caps along all exterior wall perimeters
    const t = 0.25; // wall thickness
    const copingW = t + 0.08; // 0.33m coping width with slight drip-edge overhang
    const copingH = 0.16; // coping cap height
    const copingY = roofTopY + 0.11 + copingH / 2; // resting on top of wall perimeter

    const copingSegs = [
      { x: roofCX, z: roof.minZ + t / 2, w: bldgW, d: copingW },
      { x: roofCX, z: roof.maxZ - t / 2, w: bldgW, d: copingW },
      { x: roof.minX + t / 2, z: roofCZ, w: copingW, d: bldgD },
      { x: roof.maxX - t / 2, z: roofCZ, w: copingW, d: bldgD },
    ];
    for (const cseg of copingSegs) {
      const copingMesh = new THREE.Mesh(
        new THREE.BoxGeometry(cseg.w, copingH, cseg.d),
        roofCopingMaterial
      );
      copingMesh.position.set(cseg.x, copingY, cseg.z);
      copingMesh.castShadow = true;
      copingMesh.receiveShadow = true;
      scene.add(copingMesh);
    }
  }

  // --- Equipment per building ----------------------------------------------
  // West building (x: -30..-14, z: -2..40.5)
  addHvacUnit(-24, 7);
  addHvacUnit(-24, 18);
  addHvacUnit(-24, 29);
  addVent(-20, 12);
  addVent(-20, 24);
  addVent(-20, 34);
  addRoofHatch(-19, 37.5);

  // North building (x: -8..46, z: -20..-2)
  addHvacUnit(2, -14.5, Math.PI / 2);
  addHvacUnit(14, -14.5, Math.PI / 2);
  addHvacUnit(26, -14.5, Math.PI / 2);
  addHvacUnit(38, -14.5, Math.PI / 2);
  addVent(8, -8.5);
  addVent(20, -8.5);
  addVent(32, -8.5);
  addRoofHatch(42.5, -8.5);

  // Office building (x: -30..-8, z: -20..-10.5)
  addHvacUnit(-24, -15.5, Math.PI / 2);
  addHvacUnit(-14, -15.5, Math.PI / 2);
  addVent(-19, -17);
  addRoofHatch(-19, -13);

  // MPR building (x: -38..-14, z: 40.5..62.5)
  addLargeHvacUnit(-30, 48);
  addLargeHvacUnit(-22, 55, Math.PI / 2);
  addVent(-33, 56);
  addVent(-19, 46);
  addRoofHatch(-18, 58.5);

  // --- Second-floor walkways (layout.json `walkways`): elevated decks along the
  // field-facing (door) wall of each building. The two decks join into one
  // continuous L-shaped upper walkway (the north deck bridges over the gap between
  // the buildings). The ground floor stays open. Exterior stairs land at the far ends.
  const RAIL_H = 1.0; // handrail height
  const STEP_COUNT = 12; // steps per staircase (rail posts use the same count)
  const DECK_THICKNESS = 0.25;
  const walkwayMaterial = new THREE.MeshStandardMaterial({ color: 0xd9c9a3, roughness: 1 });
  const handrailMaterial = new THREE.MeshStandardMaterial({ color: 0x7a2f2f, roughness: 0.6, metalness: 0.25 });
  type Deck = { minX: number; maxX: number; minZ: number; maxZ: number };
  // Campus elevator: in front of the Learning Center (ground floor) and the Theater (upper walkway), doors facing the building.
  // Created before the walkway rails so the railing can be opened up in front of the upper door.
  const elevator = new Elevator(scene, { x: -6.8, zFront: 1.45, floorHeight: floor2, deckEdgeZ: 1.0 });
  const decks: Deck[] = [];
  const deckBuildings: Array<LayoutWall | undefined> = [];
  const deckStairs: Array<LayoutStair | undefined> = [];
  const deckWalkways: LayoutWalkway[] = [];

  for (const walkway of walkways) {
    const alongZ = walkway.axis === "z";
    const halfLen = walkway.length / 2;
    const halfWid = walkway.width / 2;
    decks.push(
      alongZ
        ? {
          minX: walkway.center.x - halfWid,
          maxX: walkway.center.x + halfWid,
          minZ: walkway.center.z - halfLen,
          maxZ: walkway.center.z + halfLen,
        }
        : {
          minX: walkway.center.x - halfLen,
          maxX: walkway.center.x + halfLen,
          minZ: walkway.center.z - halfWid,
          maxZ: walkway.center.z + halfWid,
        }
    );
    deckWalkways.push(walkway);
    deckBuildings.push(walls.find((w) => w.id === walkway.building));
    deckStairs.push(stairs.find((s) => s.building === walkway.building));
  }

  // Footprints of the buildings (rails are not needed where a deck touches a wall).
  const buildingRects: Deck[] = walls.map((w) => ({
    minX: w.x - w.w / 2,
    maxX: w.x + w.w / 2,
    minZ: w.z - w.d / 2,
    maxZ: w.z + w.d / 2,
  }));

  // Axis-aligned flat handrail at deck level (visual bars + posts + collision).
  function addFlatRail(x1: number, z1: number, x2: number, z2: number): void {
    const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1);
    const len = alongX ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    for (const y of [floor2 + RAIL_H, floor2 + RAIL_H * 0.5]) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(alongX ? len : 0.08, 0.08, alongX ? 0.08 : len),
        handrailMaterial
      );
      bar.position.set(cx, y, cz);
      bar.castShadow = true;
      scene.add(bar);
    }
    const n = Math.max(1, Math.ceil(len / 2));
    for (let i = 0; i <= n; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, RAIL_H, 0.1), handrailMaterial);
      post.position.set(x1 + ((x2 - x1) * i) / n, floor2 + RAIL_H / 2, z1 + ((z2 - z1) * i) / n);
      post.castShadow = true;
      scene.add(post);
    }
    railingSolids.push({
      x: cx,
      z: cz,
      w: alongX ? len : 0.2,
      d: alongX ? 0.2 : len,
      yBase: floor2,
      yTop: floor2 + RAIL_H,
    });
  }

  // Handrail along a deck edge, skipping any part that runs along a wall or
  // inside the other (joined) deck, so the upper walkway is one open L shape.
  function addRailCarved(self: Deck, x1: number, z1: number, x2: number, z2: number): void {
    const eps = 0.05;
    const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1);
    const fixed = alongX ? z1 : x1;
    let kept: Array<[number, number]> = [
      alongX ? [Math.min(x1, x2), Math.max(x1, x2)] : [Math.min(z1, z2), Math.max(z1, z2)],
    ];
    const stairCutter = stairs.map((st) => {
      const hw = st.width / 2;
      return st.axis === "z"
        ? { minX: st.center.x - hw, maxX: st.center.x + hw, minZ: st.top - 0.3, maxZ: st.top + 0.3 }
        : { minX: st.top - 0.3, maxX: st.top + 0.3, minZ: st.center.z - hw, maxZ: st.center.z + hw };
    });
    const cutters = [...decks.filter((d) => d !== self), ...buildingRects, ...stairCutter, elevator.railCutter()];
    for (const c of cutters) {
      const onLine = alongX
        ? fixed >= c.minZ - eps && fixed <= c.maxZ + eps
        : fixed >= c.minX - eps && fixed <= c.maxX + eps;
      if (!onLine) continue;
      const cl = alongX ? c.minX : c.minZ;
      const ch = alongX ? c.maxX : c.maxZ;
      const next: Array<[number, number]> = [];
      for (const [a, b] of kept) {
        if (ch <= a + eps || cl >= b - eps) {
          next.push([a, b]);
          continue;
        }
        if (cl > a + eps) next.push([a, cl]);
        if (ch < b - eps) next.push([ch, b]);
      }
      kept = next;
    }
    for (const [a, b] of kept) {
      if (b - a < 0.1) continue;
      if (alongX) addFlatRail(a, fixed, b, fixed);
      else addFlatRail(fixed, a, fixed, b);
    }
  }

  decks.forEach((deck, idx) => {
    const walkway = deckWalkways[idx];
    const building = deckBuildings[idx];
    const stair = deckStairs[idx];
    if (!building) return;
    const alongZ = walkway.axis === "z";

    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(deck.maxX - deck.minX, DECK_THICKNESS, deck.maxZ - deck.minZ),
      walkwayMaterial
    );
    slab.position.set(
      (deck.minX + deck.maxX) / 2,
      floor2 - DECK_THICKNESS / 2,
      (deck.minZ + deck.maxZ) / 2
    );
    slab.castShadow = true;
    slab.receiveShadow = true;
    scene.add(slab);

    // Which end the stair lands on (if any), and which side is the open (outer) edge.
    const stairAtMax = stair ? (alongZ ? stair.top > walkway.center.z : stair.top > walkway.center.x) : null;
    const outerMax = alongZ ? walkway.center.x > building.x : walkway.center.z > building.z;
    if (alongZ) {
      const outerX = outerMax ? deck.maxX : deck.minX;
      const innerX = outerMax ? deck.minX : deck.maxX;
      addRailCarved(deck, outerX, deck.minZ, outerX, deck.maxZ);
      addRailCarved(deck, innerX, deck.minZ, innerX, deck.maxZ);
      if (stairAtMax !== true) addRailCarved(deck, deck.minX, deck.maxZ, deck.maxX, deck.maxZ);
      if (stairAtMax !== false) addRailCarved(deck, deck.minX, deck.minZ, deck.maxX, deck.minZ);
    } else {
      const outerZ = outerMax ? deck.maxZ : deck.minZ;
      const innerZ = outerMax ? deck.minZ : deck.maxZ;
      addRailCarved(deck, deck.minX, outerZ, deck.maxX, outerZ);
      addRailCarved(deck, deck.minX, innerZ, deck.maxX, innerZ);
      if (stairAtMax !== true) addRailCarved(deck, deck.maxX, deck.minZ, deck.maxX, deck.maxZ);
      if (stairAtMax !== false) addRailCarved(deck, deck.minX, deck.minZ, deck.minX, deck.maxZ);
    }

    // Support posts under the outer edge (solid at ground level).
    const spanLo = alongZ ? deck.minZ : deck.minX;
    const spanHi = alongZ ? deck.maxZ : deck.maxX;
    const count = Math.max(2, Math.round((spanHi - spanLo) / 8) + 1);
    for (let i = 0; i < count; i++) {
      const along = spanLo + 0.2 + ((spanHi - spanLo - 0.4) * i) / (count - 1);
      const px = alongZ ? (outerMax ? deck.maxX - 0.2 : deck.minX + 0.2) : along;
      const pz = alongZ ? along : outerMax ? deck.maxZ - 0.2 : deck.minZ + 0.2;
      // Skip posts that would land inside the other joined deck.
      if (decks.some((d) => d !== deck && px >= d.minX && px <= d.maxX && pz >= d.minZ && pz <= d.maxZ)) continue;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, floor2 - DECK_THICKNESS, 0.3), railingMaterial);
      post.position.set(px, (floor2 - DECK_THICKNESS) / 2, pz);
      post.castShadow = true;
      scene.add(post);
      buildingSolids.push({ x: px, z: pz, w: 0.3, d: 0.3, yBase: 0, yTop: roofY });
    }
  });

  // --- Stair handrails: outer rails and thin center railing for each staircase
  for (const stair of stairs) {
    const alongZ = stair.axis === "z";
    const rise = floor2;
    const run = stair.top - stair.bottom;
    const dir = alongZ ? new THREE.Vector3(0, rise, run) : new THREE.Vector3(run, rise, 0);
    const barLen = dir.length();
    dir.normalize();
    const railQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

    // 1) Outer handrails on both sides (with collision so player stays on stairs)
    for (const side of [-1, 1]) {
      const off = side * (stair.width / 2 - 0.05);
      const midAlong = (stair.top + stair.bottom) / 2;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, barLen), handrailMaterial);
      bar.quaternion.copy(railQuat);
      bar.position.set(
        alongZ ? stair.center.x + off : midAlong,
        rise / 2 + RAIL_H,
        alongZ ? midAlong : stair.center.z + off
      );
      bar.castShadow = true;
      scene.add(bar);
      for (let i = 0; i <= STEP_COUNT; i += 2) {
        const f = i / STEP_COUNT;
        const along = stair.bottom + run * f;
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, RAIL_H, 0.1), handrailMaterial);
        post.position.set(
          alongZ ? stair.center.x + off : along,
          rise * f + RAIL_H / 2,
          alongZ ? along : stair.center.z + off
        );
        scene.add(post);
      }
      // Solid for the whole climb: from ground to just above the deck.
      railingSolids.push({
        x: alongZ ? stair.center.x + side * (stair.width / 2) : stair.center.x,
        z: alongZ ? stair.center.z : stair.center.z + side * (stair.width / 2),
        w: alongZ ? 0.2 : stair.len,
        d: alongZ ? stair.len : 0.2,
        yBase: 0,
        yTop: floor2 + RAIL_H,
      });
    }

    // 2) Thin center railing dividing the stairs into two lanes
    const midAlong = (stair.top + stair.bottom) / 2;
    const centerBar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, barLen), handrailMaterial);
    centerBar.quaternion.copy(railQuat);
    centerBar.position.set(
      alongZ ? stair.center.x : midAlong,
      rise / 2 + RAIL_H,
      alongZ ? midAlong : stair.center.z
    );
    centerBar.castShadow = true;
    scene.add(centerBar);
    for (let i = 0; i <= STEP_COUNT; i += 2) {
      const f = i / STEP_COUNT;
      const along = stair.bottom + run * f;
      const centerPost = new THREE.Mesh(new THREE.BoxGeometry(0.05, RAIL_H, 0.05), handrailMaterial);
      centerPost.position.set(
        alongZ ? stair.center.x : along,
        rise * f + RAIL_H / 2,
        alongZ ? along : stair.center.z
      );
      centerPost.castShadow = true;
      scene.add(centerPost);
    }
  }

  // --- Exterior staircases: visibly connected to upper walkways with
  // steps (treads + risers), side & center stringers, and seamless top landing platform.
  const stringerMaterial = new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.8 });
  for (const stair of stairs) {
    const alongZ = stair.axis === "z";
    const run = stair.top - stair.bottom;
    const stepRise = floor2 / STEP_COUNT;
    const stepRun = stair.len / STEP_COUNT;
    const dirVec = alongZ ? new THREE.Vector3(0, floor2, run) : new THREE.Vector3(run, floor2, 0);
    const strLen = dirVec.length();
    dirVec.normalize();
    const strQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirVec);

    // 1) Structural steel stringers: left, center (under center rail), and right
    for (const off of [-stair.width / 2 + 0.06, 0, stair.width / 2 - 0.06]) {
      const stringer = new THREE.Mesh(
        new THREE.BoxGeometry(alongZ ? 0.12 : strLen, 0.35, alongZ ? strLen : 0.12),
        stringerMaterial
      );
      stringer.quaternion.copy(strQuat);
      stringer.position.set(
        alongZ ? stair.center.x + off : (stair.top + stair.bottom) / 2,
        floor2 / 2 - 0.15,
        alongZ ? (stair.top + stair.bottom) / 2 : stair.center.z + off
      );
      stringer.castShadow = true;
      scene.add(stringer);
    }

    // 2) Steps: clean architectural treads and risers rising continuously to floor2
    const treadThickness = 0.08;
    for (let i = 0; i < STEP_COUNT; i++) {
      const topY = stepRise * (i + 1);
      const crossOrRun = stair.axis === "z" ? stepRun + 0.04 : stair.width;
      const widthOrCross = stair.axis === "z" ? stair.width : stepRun + 0.04;
      const along = (i + 0.5) * stepRun * stair.dir;

      // Tread: horizontal surface with realistic depth and nosing
      const tread = new THREE.Mesh(
        new THREE.BoxGeometry(widthOrCross, treadThickness, crossOrRun),
        stairMaterial
      );
      const stepX = alongZ ? stair.center.x : stair.bottom + along;
      const stepZ = alongZ ? stair.bottom + along : stair.center.z;
      tread.position.set(stepX, topY - treadThickness / 2, stepZ);
      tread.castShadow = true;
      tread.receiveShadow = true;
      scene.add(tread);

      // Riser: vertical backing plate closing the step face
      const riserThickness = 0.04;
      const riser = new THREE.Mesh(
        new THREE.BoxGeometry(
          alongZ ? stair.width : riserThickness,
          stepRise,
          alongZ ? riserThickness : stair.width
        ),
        stairMaterial
      );
      const riserAlong = i * stepRun * stair.dir;
      riser.position.set(
        alongZ ? stair.center.x : stair.bottom + riserAlong,
        topY - stepRise / 2,
        alongZ ? stair.bottom + riserAlong : stair.center.z
      );
      riser.castShadow = true;
      riser.receiveShadow = true;
      scene.add(riser);
    }

    // 3) Top landing platform: connects the top step flush to the second floor walkway deck
    const landing = new THREE.Mesh(
      new THREE.BoxGeometry(alongZ ? stair.width : 1.0, DECK_THICKNESS, alongZ ? 1.0 : stair.width),
      walkwayMaterial
    );
    landing.position.set(
      stair.center.x,
      floor2 - DECK_THICKNESS / 2,
      stair.axis === "z" ? stair.top : stair.center.z
    );
    landing.castShadow = true;
    landing.receiveShadow = true;
    scene.add(landing);
  }

  // --- Doors: wooden frames on the field-facing walls ---------------------
  // axis "z" = door on an east/west-facing wall (frame narrow in x, wide in z).
  // axis "x" = door on a north/south-facing wall (frame wide in x, narrow in z).
  // floor 0 = ground; floor 1 = second floor. The second floor has the same
  // footprint as the first, so both floors' doors sit on the same wall line.
  const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4f3a, roughness: 0.8 });
  const doorPanelMaterial = new THREE.MeshStandardMaterial({ color: 0x483221, roughness: 0.6 });
  // Red color matching the gate (0x7a2f2f) for all doors except double doors
  const redDoorMaterial = new THREE.MeshStandardMaterial({ color: 0x7a2f2f, roughness: 0.7, metalness: 0.2 });
  const redDoorPanelMaterial = new THREE.MeshStandardMaterial({ color: 0x5e2222, roughness: 0.6, metalness: 0.2 });
  const doorHandleMaterial = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.2, metalness: 0.8 });
  const glassDoorFrameMaterial = new THREE.MeshStandardMaterial({ color: 0x2b303a, roughness: 0.4, metalness: 0.6 });
  const glassDoorPaneMaterial = new THREE.MeshStandardMaterial({
    color: 0x9bc8dc,
    roughness: 0.1,
    metalness: 0.15,
    transparent: true,
    opacity: 0.7,
  });
  const glassDoorHandleMaterial = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.2, metalness: 0.9 });
  const DOOR_HEIGHT = 2.6;
  const doorParts = new Map<string, { frame: THREE.Mesh; panel: THREE.Mesh; x: number; y: number; z: number; axis: "x" | "z"; floor: number }>();
  for (const door of doors) {
    const isDouble = door.id.includes("double");
    const isMpr = door.id.startsWith("mpr");
    const isGlass = door.id.includes("glass");
    const [fw, fd] = door.axis === "z" ? [0.4, 2] : [2, 0.4];
    const dy = (door.floor === 1 ? floor2 : 0) + DOOR_HEIGHT / 2;

    if (isGlass) {
      // Architectural glass double door with sleek metallic frame and floor-to-ceiling glass
      const frame = new THREE.Mesh(new THREE.BoxGeometry(fw, DOOR_HEIGHT, fd), glassDoorFrameMaterial);
      frame.position.set(door.x, dy, door.z);
      frame.castShadow = true;
      scene.add(frame);

      const pw = door.axis === "z" ? 0.36 : fd - 0.2;
      const pd = door.axis === "z" ? fd - 0.2 : 0.36;
      const glassPane = new THREE.Mesh(new THREE.BoxGeometry(pw, DOOR_HEIGHT - 0.2, pd), glassDoorPaneMaterial);
      glassPane.position.set(door.x, dy, door.z);
      scene.add(glassPane);

      const hw = door.axis === "z" ? 0.44 : 0.08;
      const hd = door.axis === "z" ? 0.08 : 0.44;
      const handle = new THREE.Mesh(new THREE.BoxGeometry(hw, 0.9, hd), glassDoorHandleMaterial);
      const handleOffset = door.id.includes("left") ? 0.65 : -0.65;
      if (door.axis === "z") {
        handle.position.set(door.x, dy, door.z + handleOffset);
      } else {
        handle.position.set(door.x + handleOffset, dy, door.z);
      }
      scene.add(handle);
    } else {
      const frameMat = isDouble ? doorMaterial : redDoorMaterial;
      const panelMat = isDouble ? doorPanelMaterial : redDoorPanelMaterial;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(fw, DOOR_HEIGHT, fd), frameMat);
      frame.position.set(door.x, dy, door.z);
      frame.castShadow = true;
      scene.add(frame);

      const pw = door.axis === "z" ? 0.36 : 1.7;
      const pd = door.axis === "z" ? 1.7 : 0.36;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(pw, DOOR_HEIGHT - 0.2, pd), panelMat);
      panel.position.set(door.x, dy, door.z);
      scene.add(panel);
      doorParts.set(door.id, { frame, panel, x: door.x, y: dy, z: door.z, axis: door.axis as "x" | "z", floor: door.floor });

      const gw = door.axis === "z" ? 0.38 : 0.8;
      const gd = door.axis === "z" ? 0.8 : 0.38;
      const glass = new THREE.Mesh(new THREE.BoxGeometry(gw, 1.0, gd), glassMaterial);
      glass.position.set(door.x, dy + 0.3, door.z);
      scene.add(glass);

      const hw = door.axis === "z" ? 0.42 : 0.08;
      const hd = door.axis === "z" ? 0.08 : 0.42;
      const handle = new THREE.Mesh(new THREE.BoxGeometry(hw, 0.25, hd), doorHandleMaterial);
      const handleOffset = isMpr ? (door.id.includes("left") ? 0.5 : -0.5) : 0.6;
      if (door.axis === "z") {
        handle.position.set(door.x, dy - 0.1, door.z + handleOffset);
      } else {
        handle.position.set(door.x + handleOffset, dy - 0.1, door.z);
      }
      scene.add(handle);
    }
  }

  // --- Double Door Header Signs & Single Classroom Plaques -----------------
  // Crisp white background, high-contrast dark typography, readable from any distance.
  function makeDoorHeaderSignTexture(mainText: string, subText?: string, sameSize = false): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas unavailable");

    // Pure crisp bright white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 1024, 256);

    // High-contrast dark charcoal architectural frame border
    ctx.lineWidth = 14;
    ctx.strokeStyle = "#0f172a";
    ctx.strokeRect(7, 7, 1010, 242);

    // Inner subtle grey pin-stripe border
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#94a3b8";
    ctx.strokeRect(20, 20, 984, 216);

    // Corner mounting screw rivets
    const screwPositions = [
      [36, 36],
      [988, 36],
      [36, 220],
      [988, 220],
    ];
    for (const [sx, sy] of screwPositions) {
      ctx.beginPath();
      ctx.arc(sx, sy, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#475569";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#0f172a";
      ctx.stroke();
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const cleanSub = subText && subText.trim() !== "" && subText.toLowerCase() !== mainText.toLowerCase() ? subText.trim() : null;

    if (cleanSub && sameSize) {
      // Two words of a single name (e.g. LEARNING / CENTER): both lines the same size and style
      ctx.font = "900 84px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Arial Black', sans-serif";
      ctx.fillStyle = "#0f172a";
      ctx.fillText(mainText, 512, 92);
      ctx.fillText(cleanSub.toUpperCase(), 512, 176);
    } else if (cleanSub) {
      // Main text: bold, pitch dark, highly readable
      ctx.font = "900 86px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Arial Black', sans-serif";
      ctx.fillStyle = "#0f172a";
      ctx.fillText(mainText, 512, 100);

      // Clean decorative divider line
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(180, 156);
      ctx.lineTo(844, 156);
      ctx.stroke();

      // Subtitle text: vibrant dark navy blue
      ctx.font = "800 38px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = "#1e3a8a";
      ctx.fillText(cleanSub.toUpperCase(), 512, 196);
    } else {
      // Single large bold text centered
      ctx.font = "900 108px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Arial Black', sans-serif";
      ctx.fillStyle = "#0f172a";
      ctx.fillText(mainText, 512, 128);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }

  function createHeaderPlaqueMesh(
    signTex: THREE.CanvasTexture,
    width: number,
    height: number
  ): THREE.Group {
    const group = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // dark slate mounting trim
      roughness: 0.35,
      metalness: 0.5,
    });
    // MeshBasicMaterial ensures the white background remains 100% bright white and legible regardless of shadows
    const faceMat = new THREE.MeshBasicMaterial({
      map: signTex,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // dark metal mounting cap
      roughness: 0.45,
      metalness: 0.6,
    });

    // Dimensional backing box
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.06, height + 0.06, 0.04),
      frameMat
    );
    box.castShadow = true;
    box.receiveShadow = true;
    group.add(box);

    // Front sign face
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      faceMat
    );
    face.position.set(0, 0, 0.022);
    face.castShadow = true;
    group.add(face);

    // Top drip cap
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.14, 0.03, 0.08),
      trimMat
    );
    cap.position.set(0, height / 2 + 0.035, 0.01);
    cap.castShadow = true;
    group.add(cap);

    return group;
  }

  // 1) Front Office Double Door Sign (West exterior wall, x = -30.0, z = -15.25)
  const frontOfficeTex = makeDoorHeaderSignTexture("FRONT OFFICE", "ADMINISTRATION");
  const frontOfficeSign = createHeaderPlaqueMesh(frontOfficeTex, 2.7, 0.54);
  frontOfficeSign.position.set(-30.06, 3.02, -15.25);
  frontOfficeSign.rotation.y = -Math.PI / 2; // Face west toward parking lot
  scene.add(frontOfficeSign);

  // 2) MPR Double Door Sign (East courtyard wall, x = -14.0, z = 51.5)
  const mprTex = makeDoorHeaderSignTexture("MPR", "MULTI-PURPOSE ROOM");
  const mprSign = createHeaderPlaqueMesh(mprTex, 2.4, 0.54);
  mprSign.position.set(-13.94, 3.02, 51.5);
  mprSign.rotation.y = Math.PI / 2; // Face east toward courtyard
  scene.add(mprSign);

  // 3) MPR Double Door Sign (West parking lot wall, x = -38.0, z = 43.0)
  const mprParkingTex = makeDoorHeaderSignTexture("MPR", "MULTI-PURPOSE ROOM");
  const mprParkingSign = createHeaderPlaqueMesh(mprParkingTex, 2.4, 0.54);
  mprParkingSign.position.set(-38.06, 3.02, 43.0);
  mprParkingSign.rotation.y = -Math.PI / 2; // Face west toward parking lot
  scene.add(mprParkingSign);

  // 4) Exterior Classroom Door Plaques for all 20 single doors
  const allClassroomIds = getAllClassroomIds();
  for (const cId of allClassroomIds) {
    const inst = getClassroom(cId);
    if (!inst) continue;
    const door = inst.campusDoor;
    const dy = (door.floor === 1 ? floor2 : 0) + 1.3;
    let mainLabel = inst.data.shortLabel;
    let subLabel = inst.data.subject || "";
    if (inst.data.type === "other") {
      if (inst.data.id === "eld") {
        mainLabel = "ELD";
        subLabel = "MR. VAN DIEST";
      } else if (inst.data.id === "music") {
        mainLabel = "MUSIC";
        subLabel = "MUSIC ROOM";
      } else if (inst.data.id === "theater") {
        mainLabel = "THEATER";
        subLabel = "DRAMA & ARTS";
      } else if (inst.data.id === "learning-center") {
        mainLabel = "LEARNING";
        subLabel = "CENTER";
      }
    }
    const plaqueTex = makeDoorHeaderSignTexture(mainLabel, subLabel, inst.data.id === "learning-center");
    const plaqueMesh = createHeaderPlaqueMesh(plaqueTex, 1.42, 0.45);

    // the sign is mounted on the door itself, at the top of the panel above the glass and the handle
    plaqueMesh.scale.setScalar(0.8);
    const signY = dy + 1.0;
    if (door.axis === "z") {
      // West building facing east
      plaqueMesh.position.set(door.x + 0.2, signY, door.z);
      plaqueMesh.rotation.y = Math.PI / 2;
    } else {
      // North & Office buildings facing south
      plaqueMesh.position.set(door.x, signY, door.z + 0.2);
      plaqueMesh.rotation.y = 0;
    }
    scene.add(plaqueMesh);
  }


  // --- Interactive Parking Lot Cars --------------------------------------
  // Detailed low-poly drivable cars with wheels, steering pivots, headlights,
  // brake lights, and driver interior.
  type DrivableCar = {
    id: number;
    type: string;
    name: string;
    group: THREE.Group;
    color: string;
    speed: number;
    steerAngle: number;
    steerPivots: THREE.Group[];
    wheelMeshes: THREE.Mesh[];
    brakeLights: THREE.Mesh[];
    headLights: THREE.Mesh[];
    brakeLightMat: THREE.MeshStandardMaterial;
    wheelbase: number;
    maxSpeed: number;
    accel: number;
    tireRadius: number;
    driverSeatPos: THREE.Vector3;
    bumperFront: number;
    bumperRear: number;
    collisionRadius: number;
    /** Multiplayer: socket id of whoever is driving it (null = free) */
    driver?: string | null;
    /** Multiplayer: where the driver says the car is (others glide to it) */
    remote?: { x: number; z: number; rotY: number; speed: number; steer: number } | null;
  };
  const parkingCars: DrivableCar[] = [];

  function createWheel(
    carGroup: THREE.Group,
    x: number,
    z: number,
    isSteer: boolean,
    radius: number,
    width: number,
    rimRadius: number,
    tireMat: THREE.Material,
    rimMat: THREE.Material,
    steerPivots: THREE.Group[],
    wheelMeshes: THREE.Mesh[]
  ): void {
    const rollGroup = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 16), tireMat);
    tire.rotation.x = Math.PI / 2;
    tire.castShadow = true;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(rimRadius, rimRadius, width + 0.01, 12), rimMat);
    rim.rotation.x = Math.PI / 2;
    rollGroup.add(tire, rim);
    wheelMeshes.push(tire);

    if (isSteer) {
      const steerPivot = new THREE.Group();
      steerPivot.position.set(x, radius, z);
      steerPivot.add(rollGroup);
      carGroup.add(steerPivot);
      steerPivots.push(steerPivot);
    } else {
      rollGroup.position.set(x, radius, z);
      carGroup.add(rollGroup);
    }
  }

  function makeSedan(colorHex: string, id: number): DrivableCar {
    const car = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.35, metalness: 0.35 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x1e2430, roughness: 0.8 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.85, transparent: true, opacity: 0.78 });
    const wheelTireMat = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.9 });
    const wheelRimMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.7 });
    const headlightMat = new THREE.MeshStandardMaterial({ color: 0xfffae0, emissive: 0xfff5c0, emissiveIntensity: 0.8 });
    const taillightMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.6 });
    const interiorMat = new THREE.MeshStandardMaterial({ color: 0x272e3b, roughness: 0.9 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.58, 1.9), bodyMat);
    body.position.y = 0.54;
    body.castShadow = true;
    body.receiveShadow = true;

    const undercarriage = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.22, 1.7), trimMat);
    undercarriage.position.y = 0.24;
    undercarriage.castShadow = true;

    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 1.94), trimMat);
    frontBumper.position.set(2.18, 0.38, 0);
    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 1.94), trimMat);
    rearBumper.position.set(-2.18, 0.38, 0);

    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.92), trimMat);
    grille.position.set(2.17, 0.52, 0);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.62, 1.62), glassMat);
    cabin.position.set(-0.25, 1.12, 0);
    cabin.castShadow = true;

    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.05, 1.54), bodyMat);
    roof.position.set(-0.25, 1.44, 0);
    roof.castShadow = true;

    const hlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.34), headlightMat);
    hlLeft.position.set(2.16, 0.54, 0.65);
    const hlRight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.34), headlightMat);
    hlRight.position.set(2.16, 0.54, -0.65);

    const tlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.34), taillightMat);
    tlLeft.position.set(-2.16, 0.58, 0.65);
    const tlRight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.34), taillightMat);
    tlRight.position.set(-2.16, 0.58, -0.65);

    const driverSeat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.38, 0.44), interiorMat);
    driverSeat.position.set(-0.15, 0.40, -0.38);
    const steerWheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 8, 16), trimMat);
    steerWheel.position.set(0.24, 0.82, -0.38);
    steerWheel.rotation.y = Math.PI / 2;
    steerWheel.rotation.x = -Math.PI / 6;

    car.add(body, undercarriage, frontBumper, rearBumper, grille, cabin, roof, hlLeft, hlRight, tlLeft, tlRight, driverSeat, steerWheel);

    const steerPivots: THREE.Group[] = [];
    const wheelMeshes: THREE.Mesh[] = [];
    createWheel(car, 1.35, 0.94, true, 0.34, 0.22, 0.20, wheelTireMat, wheelRimMat, steerPivots, wheelMeshes);
    createWheel(car, 1.35, -0.94, true, 0.34, 0.22, 0.20, wheelTireMat, wheelRimMat, steerPivots, wheelMeshes);
    createWheel(car, -1.35, 0.94, false, 0.34, 0.22, 0.20, wheelTireMat, wheelRimMat, steerPivots, wheelMeshes);
    createWheel(car, -1.35, -0.94, false, 0.34, 0.22, 0.20, wheelTireMat, wheelRimMat, steerPivots, wheelMeshes);

    return {
      id,
      type: "sedan",
      name: "Sedan",
      group: car,
      color: colorHex,
      speed: 0,
      steerAngle: 0,
      steerPivots,
      wheelMeshes,
      brakeLights: [tlLeft, tlRight],
      headLights: [hlLeft, hlRight],
      brakeLightMat: taillightMat,
      wheelbase: 2.70,
      maxSpeed: 11.5,
      accel: 9.0,
      tireRadius: 0.34,
      driverSeatPos: new THREE.Vector3(-0.15, 0.22, -0.38),
      bumperFront: 2.18,
      bumperRear: 2.18,
      collisionRadius: 2.3,
    };
  }

  function makeSuv(colorHex: string, id: number): DrivableCar {
    const car = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.40, metalness: 0.30 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x141820, roughness: 0.85 });
    const skidMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.3, metalness: 0.7 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.82 });
    const wheelTireMat = new THREE.MeshStandardMaterial({ color: 0x181a1e, roughness: 0.95 });
    const wheelRimMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.35, metalness: 0.65 });
    const headlightMat = new THREE.MeshStandardMaterial({ color: 0xfffae0, emissive: 0xfff5c0, emissiveIntensity: 0.9 });
    const taillightMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.65 });
    const interiorMat = new THREE.MeshStandardMaterial({ color: 0x1f242e, roughness: 0.9 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(4.55, 0.66, 2.02), bodyMat);
    body.position.y = 0.66;
    body.castShadow = true;
    body.receiveShadow = true;

    const undercarriage = new THREE.Mesh(new THREE.BoxGeometry(4.15, 0.26, 1.82), trimMat);
    undercarriage.position.y = 0.32;
    undercarriage.castShadow = true;

    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.34, 2.06), trimMat);
    frontBumper.position.set(2.30, 0.46, 0);
    const frontSkid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 1.10), skidMat);
    frontSkid.position.set(2.36, 0.36, 0);

    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.34, 2.06), trimMat);
    rearBumper.position.set(-2.30, 0.46, 0);
    const rearSkid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.90), skidMat);
    rearSkid.position.set(-2.36, 0.36, 0);

    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, 1.25), trimMat);
    grille.position.set(2.30, 0.70, 0);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.72, 1.76), glassMat);
    cabin.position.set(-0.35, 1.34, 0);
    cabin.castShadow = true;

    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.95, 0.05, 1.70), bodyMat);
    roof.position.set(-0.35, 1.71, 0);
    roof.castShadow = true;

    const railL = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.05, 0.05), trimMat);
    railL.position.set(-0.35, 1.77, 0.74);
    const railR = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.05, 0.05), trimMat);
    railR.position.set(-0.35, 1.77, -0.74);
    const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 1.48), trimMat);
    cross1.position.set(0.5, 1.78, 0);
    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 1.48), trimMat);
    cross2.position.set(-1.0, 1.78, 0);

    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 1.64), bodyMat);
    spoiler.position.set(-1.86, 1.74, 0);

    const hlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.38), headlightMat);
    hlLeft.position.set(2.30, 0.70, 0.72);
    const hlRight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.38), headlightMat);
    hlRight.position.set(2.30, 0.70, -0.72);

    const tlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.38), taillightMat);
    tlLeft.position.set(-2.28, 0.80, 0.72);
    const tlRight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.38), taillightMat);
    tlRight.position.set(-2.28, 0.80, -0.72);

    const driverSeat = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.40, 0.46), interiorMat);
    driverSeat.position.set(-0.10, 0.48, -0.42);
    const steerWheel = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 8, 16), trimMat);
    steerWheel.position.set(0.30, 0.96, -0.42);
    steerWheel.rotation.y = Math.PI / 2;
    steerWheel.rotation.x = -Math.PI / 6;

    car.add(body, undercarriage, frontBumper, frontSkid, rearBumper, rearSkid, grille, cabin, roof, railL, railR, cross1, cross2, spoiler, hlLeft, hlRight, tlLeft, tlRight, driverSeat, steerWheel);

    const steerPivots: THREE.Group[] = [];
    const wheelMeshes: THREE.Mesh[] = [];
    createWheel(car, 1.425, 1.02, true, 0.40, 0.26, 0.24, wheelTireMat, wheelRimMat, steerPivots, wheelMeshes);
    createWheel(car, 1.425, -1.02, true, 0.40, 0.26, 0.24, wheelTireMat, wheelRimMat, steerPivots, wheelMeshes);
    createWheel(car, -1.425, 1.02, false, 0.40, 0.26, 0.24, wheelTireMat, wheelRimMat, steerPivots, wheelMeshes);
    createWheel(car, -1.425, -1.02, false, 0.40, 0.26, 0.24, wheelTireMat, wheelRimMat, steerPivots, wheelMeshes);

    return {
      id,
      type: "suv",
      name: "SUV",
      group: car,
      color: colorHex,
      speed: 0,
      steerAngle: 0,
      steerPivots,
      wheelMeshes,
      brakeLights: [tlLeft, tlRight],
      headLights: [hlLeft, hlRight],
      brakeLightMat: taillightMat,
      wheelbase: 2.85,
      maxSpeed: 11.0,
      accel: 8.5,
      tireRadius: 0.40,
      driverSeatPos: new THREE.Vector3(-0.10, 0.32, -0.42),
      bumperFront: 2.32,
      bumperRear: 2.30,
      collisionRadius: 2.45,
    };
  }

  function makeElectric(colorHex: string, id: number): DrivableCar {
    const car = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.25, metalness: 0.45 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.05, metalness: 0.95, transparent: true, opacity: 0.85 });
    const wheelTireMat = new THREE.MeshStandardMaterial({ color: 0x1e2024, roughness: 0.9 });
    const wheelRimMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.2, metalness: 0.8 });
    const cyberLedMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2 });
    const taillightMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.85 });
    const interiorMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(4.38, 0.50, 1.92), bodyMat);
    body.position.y = 0.50;
    body.castShadow = true;
    body.receiveShadow = true;

    const undercarriage = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.18, 1.75), trimMat);
    undercarriage.position.y = 0.22;
    undercarriage.castShadow = true;

    const frontLightBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 1.82), cyberLedMat);
    frontLightBar.position.set(2.21, 0.54, 0);

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.58, 1.62), glassMat);
    canopy.position.set(-0.25, 1.04, 0);
    canopy.castShadow = true;

    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 1.64), bodyMat);
    spoiler.position.set(-2.15, 0.72, 0);

    const rearLightBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 1.82), taillightMat);
    rearLightBar.position.set(-2.20, 0.58, 0);

    const driverSeat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.38, 0.44), interiorMat);
    driverSeat.position.set(-0.12, 0.38, -0.38);
    const steerYoke = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.26), trimMat);
    steerYoke.position.set(0.24, 0.78, -0.38);
    steerYoke.rotation.x = -Math.PI / 6;

    car.add(body, undercarriage, frontLightBar, canopy, spoiler, rearLightBar, driverSeat, steerYoke);

    const steerPivots: THREE.Group[] = [];
    const wheelMeshes: THREE.Mesh[] = [];
    createWheel(car, 1.375, 0.96, true, 0.34, 0.22, 0.26, wheelTireMat, wheelRimMat, steerPivots, wheelMeshes);
    createWheel(car, 1.375, -0.96, true, 0.34, 0.22, 0.26, wheelTireMat, wheelRimMat, steerPivots, wheelMeshes);
    createWheel(car, -1.375, 0.96, false, 0.34, 0.22, 0.26, wheelTireMat, wheelRimMat, steerPivots, wheelMeshes);
    createWheel(car, -1.375, -0.96, false, 0.34, 0.22, 0.26, wheelTireMat, wheelRimMat, steerPivots, wheelMeshes);

    return {
      id,
      type: "electric",
      name: "Electric EV",
      group: car,
      color: colorHex,
      speed: 0,
      steerAngle: 0,
      steerPivots,
      wheelMeshes,
      brakeLights: [rearLightBar],
      headLights: [frontLightBar],
      brakeLightMat: taillightMat,
      wheelbase: 2.75,
      maxSpeed: 13.5,
      accel: 13.0,
      tireRadius: 0.34,
      driverSeatPos: new THREE.Vector3(-0.12, 0.20, -0.38),
      bumperFront: 2.22,
      bumperRear: 2.20,
      collisionRadius: 2.35,
    };
  }

  function makeCompact(colorHex: string, id: number): DrivableCar {
    const car = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.35, metalness: 0.30 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x1e2430, roughness: 0.8 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.85, transparent: true, opacity: 0.78 });
    const wheelTireMat = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.9 });
    const wheelRimMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.3, metalness: 0.7 });
    const headlightMat = new THREE.MeshStandardMaterial({ color: 0xfffae0, emissive: 0xfff5c0, emissiveIntensity: 0.8 });
    const taillightMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.6 });
    const interiorMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(3.45, 0.52, 1.76), bodyMat);
    body.position.y = 0.50;
    body.castShadow = true;
    body.receiveShadow = true;

    const undercarriage = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.20, 1.58), trimMat);
    undercarriage.position.y = 0.22;
    undercarriage.castShadow = true;

    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 1.78), trimMat);
    frontBumper.position.set(1.74, 0.36, 0);
    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 1.78), trimMat);
    rearBumper.position.set(-1.74, 0.36, 0);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.62, 1.54), glassMat);
    cabin.position.set(-0.15, 1.06, 0);
    cabin.castShadow = true;

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.80, 0.05, 1.46), bodyMat);
    roof.position.set(-0.15, 1.38, 0);
    roof.castShadow = true;

    const antenna = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.10, 4), trimMat);
    antenna.position.set(-0.85, 1.44, 0);
    antenna.rotation.x = -Math.PI / 12;

    const hlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.28), headlightMat);
    hlLeft.position.set(1.73, 0.52, 0.58);
    const hlRight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.28), headlightMat);
    hlRight.position.set(1.73, 0.52, -0.58);

    const tlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.30), taillightMat);
    tlLeft.position.set(-1.73, 0.62, 0.60);
    const tlRight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.30), taillightMat);
    tlRight.position.set(-1.73, 0.62, -0.60);

    const driverSeat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.36, 0.40), interiorMat);
    driverSeat.position.set(-0.10, 0.36, -0.32);
    const steerWheel = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.025, 8, 16), trimMat);
    steerWheel.position.set(0.20, 0.76, -0.32);
    steerWheel.rotation.y = Math.PI / 2;
    steerWheel.rotation.x = -Math.PI / 6;

    car.add(body, undercarriage, frontBumper, rearBumper, cabin, roof, antenna, hlLeft, hlRight, tlLeft, tlRight, driverSeat, steerWheel);

    const steerPivots: THREE.Group[] = [];
    const wheelMeshes: THREE.Mesh[] = [];
    createWheel(car, 1.08, 0.86, true, 0.30, 0.20, 0.18, wheelTireMat, wheelRimMat, steerPivots, wheelMeshes);
    createWheel(car, 1.08, -0.86, true, 0.30, 0.20, 0.18, wheelTireMat, wheelRimMat, steerPivots, wheelMeshes);
    createWheel(car, -1.08, 0.86, false, 0.30, 0.20, 0.18, wheelTireMat, wheelRimMat, steerPivots, wheelMeshes);
    createWheel(car, -1.08, -0.86, false, 0.30, 0.20, 0.18, wheelTireMat, wheelRimMat, steerPivots, wheelMeshes);

    return {
      id,
      type: "compact",
      name: "Compact Car",
      group: car,
      color: colorHex,
      speed: 0,
      steerAngle: 0,
      steerPivots,
      wheelMeshes,
      brakeLights: [tlLeft, tlRight],
      headLights: [hlLeft, hlRight],
      brakeLightMat: taillightMat,
      wheelbase: 2.15,
      maxSpeed: 11.2,
      accel: 9.5,
      tireRadius: 0.30,
      driverSeatPos: new THREE.Vector3(-0.10, 0.20, -0.32),
      bumperFront: 1.75,
      bumperRear: 1.72,
      collisionRadius: 1.9,
    };
  }

  function makeFordVan(colorHex: string, id: number): DrivableCar {
    const car = new THREE.Group();
    const vanColor = colorHex || "#ffffff";
    const bodyMat = new THREE.MeshStandardMaterial({ color: vanColor, roughness: 0.35, metalness: 0.25 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x1e2430, roughness: 0.85 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.85, transparent: true, opacity: 0.82 });
    const wheelTireMat = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.9 });
    const wheelRimMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.3, metalness: 0.7 });
    const headlightMat = new THREE.MeshStandardMaterial({ color: 0xfffae0, emissive: 0xfff5c0, emissiveIntensity: 0.85 });
    const taillightMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.65 });
    const interiorMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
    const fordBlueMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.2, metalness: 0.5 });
    const gasketMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.95 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(5.30, 0.78, 2.04), bodyMat);
    body.position.set(0, 0.66, 0);
    body.castShadow = true;
    body.receiveShadow = true;

    const undercarriage = new THREE.Mesh(new THREE.BoxGeometry(4.85, 0.26, 1.84), trimMat);
    undercarriage.position.set(0, 0.26, 0);
    undercarriage.castShadow = true;

    const rubStripL = new THREE.Mesh(new THREE.BoxGeometry(5.15, 0.08, 0.04), trimMat);
    rubStripL.position.set(0, 0.75, 1.03);
    const rubStripR = new THREE.Mesh(new THREE.BoxGeometry(5.15, 0.08, 0.04), trimMat);
    rubStripR.position.set(0, 0.75, -1.03);

    const cargoBody = new THREE.Mesh(new THREE.BoxGeometry(4.10, 1.05, 1.94), bodyMat);
    cargoBody.position.set(-0.60, 1.55, 0);
    cargoBody.castShadow = true;

    const roof = new THREE.Mesh(new THREE.BoxGeometry(4.05, 0.06, 1.90), bodyMat);
    roof.position.set(-0.60, 2.08, 0);
    roof.castShadow = true;
    for (const rz of [-0.5, 0, 0.5]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(3.90, 0.04, 0.06), bodyMat);
      rib.position.set(-0.60, 2.12, rz);
      car.add(rib);
    }

    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.48, 1.88), bodyMat);
    hood.position.set(1.95, 0.88, 0);
    hood.castShadow = true;

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.64, 1.78), glassMat);
    windshield.position.set(1.42, 1.48, 0);
    windshield.rotation.z = -Math.PI / 10;
    windshield.castShadow = true;

    const sideWinL = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.52, 0.04), glassMat);
    sideWinL.position.set(0.85, 1.52, 0.98);
    const sideWinR = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.52, 0.04), glassMat);
    sideWinR.position.set(0.85, 1.52, -0.98);

    const mirrorL = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.22, 0.12), trimMat);
    mirrorL.position.set(1.20, 1.45, 1.12);
    const mirrorR = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.22, 0.12), trimMat);
    mirrorR.position.set(1.20, 1.45, -1.12);

    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.36, 2.10), trimMat);
    frontBumper.position.set(2.70, 0.40, 0);

    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 1.55), trimMat);
    grille.position.set(2.66, 0.72, 0);

    const fordBadge = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.15), fordBlueMat);
    fordBadge.position.set(2.71, 0.74, 0);

    const hlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.36), headlightMat);
    hlLeft.position.set(2.66, 0.76, 0.74);
    const hlRight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.36), headlightMat);
    hlRight.position.set(2.66, 0.76, -0.74);

    const centerSplit = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.50, 0.04), gasketMat);
    centerSplit.position.set(-2.67, 1.30, 0);

    const winFrameL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.52, 0.68), gasketMat);
    winFrameL.position.set(-2.66, 1.52, 0.44);
    const winPaneL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.44, 0.60), glassMat);
    winPaneL.position.set(-2.67, 1.52, 0.44);

    const winFrameR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.52, 0.68), gasketMat);
    winFrameR.position.set(-2.66, 1.52, -0.44);
    const winPaneR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.44, 0.60), glassMat);
    winPaneR.position.set(-2.67, 1.52, -0.44);

    const doorHandle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.05), trimMat);
    doorHandle.position.set(-2.69, 1.10, -0.16);
    const doorKeyhole = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.03), gasketMat);
    doorKeyhole.position.set(-2.69, 0.98, -0.16);

    const hingeL1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.10, 0.05), gasketMat);
    hingeL1.position.set(-2.67, 1.80, 0.94);
    const hingeL2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.10, 0.05), gasketMat);
    hingeL2.position.set(-2.67, 0.80, 0.94);
    const hingeR1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.10, 0.05), gasketMat);
    hingeR1.position.set(-2.67, 1.80, -0.94);
    const hingeR2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.10, 0.05), gasketMat);
    hingeR2.position.set(-2.67, 0.80, -0.94);

    const chmsl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.24), taillightMat);
    chmsl.position.set(-2.67, 2.02, 0);

    const tlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.50, 0.16), taillightMat);
    tlLeft.position.set(-2.67, 1.05, 0.92);
    const tlRight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.50, 0.16), taillightMat);
    tlRight.position.set(-2.67, 1.05, -0.92);

    const rearStepBumper = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 2.12), trimMat);
    rearStepBumper.position.set(-2.72, 0.35, 0);

    const driverSeat = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.44, 0.48), interiorMat);
    driverSeat.position.set(0.45, 0.65, -0.45);
    const steerWheel = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 8, 16), trimMat);
    steerWheel.position.set(0.85, 1.15, -0.45);
    steerWheel.rotation.y = Math.PI / 2;
    steerWheel.rotation.x = -Math.PI / 4;

    car.add(
      body, undercarriage, rubStripL, rubStripR, cargoBody, roof, hood, windshield,
      sideWinL, sideWinR, mirrorL, mirrorR, frontBumper, grille, fordBadge,
      hlLeft, hlRight, centerSplit, winFrameL, winPaneL, winFrameR, winPaneR,
      doorHandle, doorKeyhole, hingeL1, hingeL2, hingeR1, hingeR2, chmsl,
      tlLeft, tlRight, rearStepBumper, driverSeat, steerWheel
    );

    const steerPivots: THREE.Group[] = [];
    const wheelMeshes: THREE.Mesh[] = [];
    createWheel(car, 1.65, 0.98, true, 0.38, 0.24, 0.22, wheelTireMat, wheelRimMat, steerPivots, wheelMeshes);
    createWheel(car, 1.65, -0.98, true, 0.38, 0.24, 0.22, wheelTireMat, wheelRimMat, steerPivots, wheelMeshes);
    createWheel(car, -1.65, 0.98, false, 0.38, 0.24, 0.22, wheelTireMat, wheelRimMat, steerPivots, wheelMeshes);
    createWheel(car, -1.65, -0.98, false, 0.38, 0.24, 0.22, wheelTireMat, wheelRimMat, steerPivots, wheelMeshes);

    return {
      id,
      type: "van",
      name: "Ford Van",
      group: car,
      color: vanColor,
      speed: 0,
      steerAngle: 0,
      steerPivots,
      wheelMeshes,
      brakeLights: [tlLeft, tlRight, chmsl],
      headLights: [hlLeft, hlRight],
      brakeLightMat: taillightMat,
      wheelbase: 3.30,
      maxSpeed: 10.5,
      accel: 7.2,
      tireRadius: 0.38,
      driverSeatPos: new THREE.Vector3(0.45, 0.44, -0.45),
      bumperFront: 2.72,
      bumperRear: 2.70,
      collisionRadius: 2.75,
    };
  }

  function makeCar(carData: LayoutCar, id: number): DrivableCar {
    const type = carData.type || "sedan";
    if (type === "van") return makeFordVan(carData.color, id);
    if (type === "suv") return makeSuv(carData.color, id);
    if (type === "electric") return makeElectric(carData.color, id);
    if (type === "compact") return makeCompact(carData.color, id);
    return makeSedan(carData.color, id);
  }

  cars.forEach((carData, idx) => {
    const carInst = makeCar(carData, idx);
    carInst.group.position.set(carData.x, 0, carData.z);
    carInst.group.rotation.y = carData.rot;
    scene.add(carInst.group);
    parkingCars.push(carInst);
  });

  // --- Main Office Entrance Facade Sign (Second Floor Above Double Doors) ---
  // Official "VALOR ACADEMY MIDDLE SCHOOL" sign mounted on the second-story exterior
  // facade of the Office building (x = -30.0), directly centered above the ground-floor
  // main entrance glass double doors (z = -15.25).
  const officeSignTexture = new THREE.TextureLoader().load(officeSignUrl);
  officeSignTexture.colorSpace = THREE.SRGBColorSpace;
  officeSignTexture.anisotropy = 8;

  const officeSignGroup = new THREE.Group();

  const SIGN_X = -30.06;
  const SIGN_Y = 5.40;
  const SIGN_Z = -15.25;
  const SIGN_W = 5.00;
  const SIGN_H = 1.24;
  const SIGN_DEPTH = 0.08;

  // 1) Architectural frame box (brushed gold/brass metallic trim)
  const officeSignFrameMat = new THREE.MeshStandardMaterial({
    color: 0xc89b3c, // warm regal gold matching the image border
    roughness: 0.28,
    metalness: 0.85,
  });

  // Main dimensional sign box
  const officeSignBox = new THREE.Mesh(
    new THREE.BoxGeometry(SIGN_DEPTH, SIGN_H + 0.08, SIGN_W + 0.08),
    officeSignFrameMat
  );
  officeSignBox.position.set(SIGN_X + SIGN_DEPTH / 2 - 0.04, SIGN_Y, SIGN_Z);
  officeSignBox.castShadow = true;
  officeSignBox.receiveShadow = true;
  officeSignGroup.add(officeSignBox);

  // 2) Sign face plaque with Valor Academy graphic
  const officeSignMat = new THREE.MeshStandardMaterial({
    map: officeSignTexture,
    roughness: 0.35,
    metalness: 0.1,
  });
  const officeSignFace = new THREE.Mesh(
    new THREE.PlaneGeometry(SIGN_W, SIGN_H),
    officeSignMat
  );
  officeSignFace.position.set(SIGN_X - 0.042, SIGN_Y, SIGN_Z);
  officeSignFace.rotation.y = -Math.PI / 2; // Face west toward the parking lot and driveway
  officeSignFace.castShadow = true;
  officeSignGroup.add(officeSignFace);

  // 3) Protective top architectural drip cap / canopy trim
  const officeDripCapMat = new THREE.MeshStandardMaterial({
    color: 0x2b303a,
    roughness: 0.5,
    metalness: 0.6,
  });
  const officeDripCap = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.04, SIGN_W + 0.22),
    officeDripCapMat
  );
  officeDripCap.position.set(SIGN_X - 0.02, SIGN_Y + SIGN_H / 2 + 0.05, SIGN_Z);
  officeDripCap.castShadow = true;
  officeSignGroup.add(officeDripCap);

  // 4) Wall Standoff Brackets (anchors pinning sign box to brick facade)
  const bracketGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.06, 8);
  const standoffOffsets = [
    [-0.45 * SIGN_H, -0.45 * SIGN_W],
    [-0.45 * SIGN_H, 0.45 * SIGN_W],
    [0.45 * SIGN_H, -0.45 * SIGN_W],
    [0.45 * SIGN_H, 0.45 * SIGN_W],
  ];
  for (const [oy, oz] of standoffOffsets) {
    const bracket = new THREE.Mesh(bracketGeo, officeDripCapMat);
    bracket.rotation.z = Math.PI / 2;
    bracket.position.set(SIGN_X + 0.035, SIGN_Y + oy, SIGN_Z + oz);
    officeSignGroup.add(bracket);
  }

  // 5) Twin Architectural Gooseneck Downward Spotlights (illuminates the sign)
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.35,
    metalness: 0.8,
  });
  const lampLensMat = new THREE.MeshStandardMaterial({
    color: 0xfffbeb,
    emissive: 0xfff7d6,
    emissiveIntensity: 0.7,
    roughness: 0.2,
  });

  const lampZOffsets = [-1.5, 1.5];
  for (const lz of lampZOffsets) {
    const lampArm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.03), lampMat);
    lampArm.position.set(SIGN_X - 0.12, SIGN_Y + SIGN_H / 2 + 0.20, SIGN_Z + lz);

    const lampHood = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.12, 12), lampMat);
    lampHood.position.set(SIGN_X - 0.24, SIGN_Y + SIGN_H / 2 + 0.16, SIGN_Z + lz);
    lampHood.rotation.z = Math.PI * 0.85;

    const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), lampLensMat);
    lampBulb.position.set(SIGN_X - 0.22, SIGN_Y + SIGN_H / 2 + 0.13, SIGN_Z + lz);

    officeSignGroup.add(lampArm, lampHood, lampBulb);
  }

  scene.add(officeSignGroup);

  // --- Car Reset Button on the Right Side of the Office Double Door --------
  // Office double door is at x: -30, z: -17.25..-13.25. The right side (south)
  // along the exterior wall is at z: -12.4, x: -30.06.
  const CAR_RESET_BTN_X = -30.06;
  const CAR_RESET_BTN_Y = 1.35;
  const CAR_RESET_BTN_Z = -12.4;

  const carResetGroup = new THREE.Group();
  carResetGroup.position.set(CAR_RESET_BTN_X, CAR_RESET_BTN_Y, CAR_RESET_BTN_Z);

  // 1) Industrial wall-mounted metal electrical box / faceplate
  const carResetBoxMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.8,
    roughness: 0.25,
  });
  const carResetFrameMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b, // Amber / yellow hazard trim
    metalness: 0.4,
    roughness: 0.4,
  });
  const carResetBox = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, 0.40), carResetBoxMat);
  carResetBox.castShadow = true;
  carResetBox.receiveShadow = true;
  const carResetFrame = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.48, 0.36), carResetFrameMat);

  // 2) Stenciled Sign Plate: "RESET CARS"
  function makeCarResetSignTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(0, 0, 256, 12);
    ctx.fillRect(0, 116, 256, 12);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🚗 CAR RESET", 128, 54);
    ctx.font = "bold 17px system-ui, sans-serif";
    ctx.fillStyle = "#fbbf24";
    ctx.fillText("PRESS BUTTON", 128, 90);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const carResetSignMat = new THREE.MeshStandardMaterial({
    map: makeCarResetSignTexture(),
    roughness: 0.3,
  });
  const carResetSign = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.18), carResetSignMat);
  carResetSign.position.set(-0.038, 0.11, 0);
  carResetSign.rotation.y = -Math.PI / 2; // face west toward parking driveway

  // 3) Pushbutton Collar & Interactive Plunger
  const carResetCollarMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.9,
    roughness: 0.2,
  });
  const carResetCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.03, 24), carResetCollarMat);
  carResetCollar.rotation.z = Math.PI / 2;
  carResetCollar.position.set(-0.038, -0.10, 0);

  const carResetBtnMat = new THREE.MeshStandardMaterial({
    color: 0xef4444, // Bright red emergency / reset actuator
    emissive: 0xdc2626,
    emissiveIntensity: 0.8,
    metalness: 0.2,
    roughness: 0.3,
  });
  const carResetPlunger = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.045, 24), carResetBtnMat);
  carResetPlunger.rotation.z = Math.PI / 2;
  carResetPlunger.position.set(-0.062, -0.10, 0);
  carResetPlunger.castShadow = true;

  // LED Ready Light
  const carResetLedMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x16a34a,
    emissiveIntensity: 0.9,
  });
  const carResetLed = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 12), carResetLedMat);
  carResetLed.position.set(-0.038, -0.01, 0.13);

  carResetGroup.add(carResetBox, carResetFrame, carResetSign, carResetCollar, carResetPlunger, carResetLed);
  scene.add(carResetGroup);

  // Floating Notification Toast for Car Reset
  const carResetToast = document.createElement("div");
  carResetToast.id = "car-reset-toast";
  carResetToast.textContent = "🚗 All cars were reset to parking spots!";
  carResetToast.style.cssText =
    "position:fixed;top:26%;left:50%;transform:translateX(-50%) scale(0);background:rgba(15,23,42,0.95);color:#f59e0b;font-family:system-ui,-apple-system,sans-serif;font-size:22px;font-weight:800;letter-spacing:0.5px;padding:12px 28px;border-radius:12px;border:2px solid #f59e0b;box-shadow:0 8px 30px rgba(0,0,0,0.5);pointer-events:none;z-index:1000;opacity:0;transition:transform 0.3s cubic-bezier(0.175,0.885,0.32,1.275),opacity 0.3s;text-align:center;";
  container.appendChild(carResetToast);

  let carResetPlungerTimer = 0;
  let carResetToastTimer = 0;

  // --- Outdoor tables: round tables with umbrellas, beneath a covered
  // awning (layout.json `tables`). Decorative in the prototype (no
  // collision, like the parked cars) - furnished interiors arrive at
  // Milestone 7.
  const tableTopMaterial = new THREE.MeshStandardMaterial({ color: 0xc9b28a, roughness: 0.9 });
  const tablePoleMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.7, metalness: 0.3 });
  const chairMaterial = new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 0.9 });
  const umbrellaMaterials = ["#d7263d", "#2f6fd0", "#2e9e4f", "#f2b705", "#8a4fd0"].map(
    (hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.8 })
  );
  const TABLE_HEIGHT = 1.1; // table-top surface height (player is ~2.4 tall)
  const CHAIR_RING = 1.4; // distance from table center to each chair
  const UMBRELLA_RADIUS = 1.8;
  const UMBRELLA_POLE_HEIGHT = 3.0;
  const tableTopGeometry = new THREE.CylinderGeometry(0.95, 0.95, 0.08, 20);
  const tableBaseGeometry = new THREE.CylinderGeometry(0.4, 0.45, 0.06, 16);
  const umbrellaPoleGeometry = new THREE.CylinderGeometry(0.045, 0.045, UMBRELLA_POLE_HEIGHT, 8);
  const umbrellaCanopyGeometry = new THREE.ConeGeometry(UMBRELLA_RADIUS, 0.55, 8);
  const finialGeometry = new THREE.SphereGeometry(0.08, 8, 6);
  const seatGeometry = new THREE.BoxGeometry(0.5, 0.07, 0.5);
  const chairLegGeometry = new THREE.BoxGeometry(0.06, 0.45, 0.06);
  const chairBackGeometry = new THREE.BoxGeometry(0.07, 0.55, 0.5);

  type ChairSlot = {
    chairX: number;
    chairZ: number;
    seatY: number;
    tableX: number;
    tableZ: number;
    facingAngle: number;
    /** Ground-floor bench seats are not used from the walkway above; they stand up at a fixed spot in front */
    bench?: { exitX: number; exitZ: number };
  };
  const chairSlots: ChairSlot[] = [];

  tables.forEach((table, i) => {
    const group = new THREE.Group();
    group.position.set(table.x, 0, table.z);
    group.scale.setScalar(0.8); // real-scale table (~0.9 m tall)

    const base = new THREE.Mesh(tableBaseGeometry, tablePoleMaterial);
    base.position.y = 0.03;
    base.receiveShadow = true;
    const top = new THREE.Mesh(tableTopGeometry, tableTopMaterial);
    top.position.y = TABLE_HEIGHT;
    top.castShadow = true;
    top.receiveShadow = true;

    // One pole runs from the base up through the table to the umbrella.
    const pole = new THREE.Mesh(umbrellaPoleGeometry, tablePoleMaterial);
    pole.position.y = UMBRELLA_POLE_HEIGHT / 2;
    pole.castShadow = true;
    const canopy = new THREE.Mesh(
      umbrellaCanopyGeometry,
      umbrellaMaterials[i % umbrellaMaterials.length]
    );
    canopy.position.y = UMBRELLA_POLE_HEIGHT + 0.05;
    canopy.rotation.y = Math.PI / 8;
    canopy.castShadow = true;
    const finial = new THREE.Mesh(finialGeometry, tablePoleMaterial);
    finial.position.y = UMBRELLA_POLE_HEIGHT + 0.36;

    group.add(base, top, pole, canopy, finial);

    // Four chairs around the table, backs facing outward.
    for (let c = 0; c < 4; c++) {
      const angle = (c / 4) * Math.PI * 2 + Math.PI / 4;
      const chair = new THREE.Group();
      chair.position.set(Math.cos(angle) * CHAIR_RING, 0, Math.sin(angle) * CHAIR_RING);
      chair.rotation.y = -angle; // local +x points away from the table
      const seat = new THREE.Mesh(seatGeometry, chairMaterial);
      seat.position.y = 0.48;
      seat.castShadow = true;
      const back = new THREE.Mesh(chairBackGeometry, chairMaterial);
      back.position.set(0.22, 0.8, 0);
      back.castShadow = true;
      chair.add(seat, back);
      for (const [lx, lz] of [[-0.2, -0.2], [-0.2, 0.2], [0.2, -0.2], [0.2, 0.2]]) {
        const leg = new THREE.Mesh(chairLegGeometry, chairMaterial);
        leg.position.set(lx, 0.225, lz);
        chair.add(leg);
      }
      group.add(chair);

      // Record world coordinates and inward facing angle for interactive seating
      const chairWorldX = table.x + Math.cos(angle) * CHAIR_RING * 0.8;
      const chairWorldZ = table.z + Math.sin(angle) * CHAIR_RING * 0.8;
      const facingAngle = Math.atan2(table.x - chairWorldX, table.z - chairWorldZ);
      chairSlots.push({
        chairX: chairWorldX,
        chairZ: chairWorldZ,
        seatY: 0.384,
        tableX: table.x,
        tableZ: table.z,
        facingAngle,
      });
    }
    scene.add(group);
  });

  // drinking from the fountain (E): leaning in for a few seconds while the water arcs into the basin
  const fountainDrops: THREE.Mesh[] = [];
  const FOUNTAIN_STAND = new THREE.Vector2(-12.78, 23.4); // where a player stands to drink
  const DRINK_TIME = 3;
  let drinkTimer = 0;
  let drinkElapsed = 0;
  const nearFountain = (): boolean =>
    !inMprRoom && !currentClassroom && !drivingCar && !seatedChair && player.position.y < 1.5 &&
    Math.hypot(player.position.x - FOUNTAIN_STAND.x, player.position.z - FOUNTAIN_STAND.y) <= 1.7;
  function startDrinking(): void {
    if (bballHeld) {
      bballHeld = false;
      bballPos.set(player.position.x + 0.5, BASKETBALL_GROUND_Y, player.position.z);
      bballVel.set(0, 0, 0);
    }
    drinkTimer = DRINK_TIME;
    drinkElapsed = 0;
    player.position.x = FOUNTAIN_STAND.x;
    player.position.z = FOUNTAIN_STAND.y;
    player.rotation.y = -Math.PI / 2; // facing the wall
  }
  function stopDrinking(): void {
    if (drinkTimer <= 0 && drinkElapsed === 0) return;
    drinkTimer = 0;
    drinkElapsed = 0;
    for (const d of fountainDrops) d.visible = false;
    torsoGroup.rotation.set(0, 0, 0);
    headGroup.rotation.set(0, 0, 0);
    leftArmPivot.rotation.set(0, 0, 0);
    rightArmPivot.rotation.set(0, 0, 0);
    leftElbowPivot.rotation.set(0, 0, 0);
    rightElbowPivot.rotation.set(0, 0, 0);
    bodyGroup.position.set(0, 0, 0);
  }

  // --- Benches against the west building's wall (orange by the 7th USC door, blue ones between UCLA and LMU),
  // and a drinking fountain on the wall past the UCLA door. The wall face is at -13.8 where the door frames stand out.
  {
    const BENCH_X = -13.5; // center (west wall)
    const BENCH_NORTH_Z = -1.5; // center (north wall, whose face is at -1.8)
    const BENCH_LEN = 2.2;
    const metal = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.5, metalness: 0.5 });
    /** A bench against the west building's wall (facing east) or the north building's wall (facing south), at `along` */
    const addBench = (along: number, color: number, wall: "west" | "north" = "west", len = BENCH_LEN): void => {
      const wood = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
      const bench = new THREE.Group();
      const north = wall === "north";
      const bx = north ? along : BENCH_X;
      const bz = north ? BENCH_NORTH_Z : along;
      bench.position.set(bx, 0, bz);
      bench.rotation.y = north ? -Math.PI / 2 : 0; // local +x is the way the bench faces
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, len), wood);
      seat.position.set(0, 0.39, 0);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, len), wood);
      back.position.set(-0.22, 0.66, 0);
      seat.castShadow = back.castShadow = true;
      seat.receiveShadow = back.receiveShadow = true;
      bench.add(seat, back);
      for (const lz of [-len / 2 + 0.15, len / 2 - 0.15]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.36, 0.06), metal);
        leg.position.set(0, 0.18, lz);
        bench.add(leg);
      }
      scene.add(bench);
      buildingSolids.push({ x: bx, z: bz, w: north ? len : 0.5, d: north ? 0.5 : len, yBase: 0, yTop: 0.9 });
      for (const off of len > 1.5 ? [-0.5, 0.5] : [0]) {
        const sx = north ? bx + off : bx + 0.05;
        const sz = north ? bz + 0.05 : bz + off;
        chairSlots.push({
          chairX: sx,
          chairZ: sz,
          seatY: 0.4,
          tableX: north ? sx : sx + 2,
          tableZ: north ? sz + 2 : sz,
          facingAngle: north ? 0 : Math.PI / 2, // looking out over the walkway
          bench: north ? { exitX: sx, exitZ: -0.7 } : { exitX: -12.7, exitZ: sz },
        });
      }
    };
    addBench(10.8, 0xf47a20); // orange, next to the 7th UCLA door
    addBench(16.6, 0x2563eb); // two blue benches in a row (with a gap) between the 7th UCLA and 7th LMU doors
    addBench(20.0, 0x2563eb);
    // 8th grade side (north building, ground floor): two between LMU and UCLA, two between UCLA and USC,
    // and three full-size ones between the Learning Center and USC
    for (const x of [-1.5, 1.1, 3.7, 9.9, 14.3, 21.9, 25.9]) addBench(x, 0x2563eb, "north");

    // Wall-mounted drinking fountain, between the blue benches and the 7th LMU door (closest to LMU)
    const FOUNTAIN_Z = 23.4;
    const FOUNTAIN_SCALE = 1.25;
    const steel = new THREE.MeshStandardMaterial({ color: 0xc4c9d0, roughness: 0.3, metalness: 0.8 });
    const fountain = new THREE.Group();
    fountain.position.set(-13.8, -0.2, FOUNTAIN_Z);
    fountain.scale.setScalar(FOUNTAIN_SCALE);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.7, 0.55), steel); // backing on the wall
    plate.position.set(0.02, 1.15, 0);
    const basin = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.5), steel);
    basin.position.set(0.21, 0.95, 0);
    const water = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.01, 0.4), new THREE.MeshStandardMaterial({ color: 0x1b2430, roughness: 0.2, metalness: 0.6 }));
    water.position.set(0.22, 1.025, 0);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 8), steel);
    spout.position.set(0.1, 1.1, 0);
    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12), new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.5 }));
    button.rotation.z = Math.PI / 2;
    button.position.set(0.05, 1.25, 0.18);
    for (const m of [plate, basin, spout, button]) m.castShadow = true;
    fountain.add(plate, basin, water, spout, button);
    // the arc of water while someone drinks: a few droplets flying out of the spout and back into the basin
    const dropMat = new THREE.MeshBasicMaterial({ color: 0x8fd3ff, transparent: true, opacity: 0.85 });
    const dropGeo = new THREE.SphereGeometry(0.014, 6, 5);
    for (let i = 0; i < 14; i++) {
      const d = new THREE.Mesh(dropGeo, dropMat);
      d.visible = false;
      fountain.add(d);
      fountainDrops.push(d);
    }
    scene.add(fountain);
    buildingSolids.push({ x: -13.55, z: FOUNTAIN_Z, w: 0.5, d: 0.7, yBase: 0.7, yTop: 1.5 });
    FOUNTAIN_STAND.set(-12.78, FOUNTAIN_Z); // just outside the solid (player radius 0.5)
  }

  // --- Lunch cover: the red roof over the tables (layout.json `cover`, ~35x10 m
  // from the aerial photo), on corner + intermediate posts.
  const cover = layoutData.cover;
  const coverMinX = cover.center.x - cover.width / 2;
  const coverMaxX = cover.center.x + cover.width / 2;
  const coverMinZ = cover.center.z - cover.depth / 2;
  const awningMaterial = new THREE.MeshStandardMaterial({ color: 0xa8322c, roughness: 0.85 });
  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(cover.width, 0.3, cover.depth),
    awningMaterial
  );
  awning.position.set(cover.center.x, cover.height, cover.center.z);
  awning.castShadow = true;
  awning.receiveShadow = true;
  scene.add(awning);
  const awningPostGeometry = new THREE.BoxGeometry(0.3, cover.height, 0.3);
  const awningPostPositions: Array<[number, number]> = [];
  const postRows = Math.max(2, Math.round(cover.depth / 8) + 1);
  for (let r = 0; r < postRows; r++) {
    const pz = coverMinZ + 0.3 + ((cover.depth - 0.6) * r) / (postRows - 1);
    awningPostPositions.push([coverMinX + 0.3, pz], [coverMaxX - 0.3, pz]);
  }
  for (const [px, pz] of awningPostPositions) {
    const post = new THREE.Mesh(awningPostGeometry, tablePoleMaterial);
    post.position.set(px, cover.height / 2, pz);
    post.castShadow = true;
    scene.add(post);
  }

  // --- Gate: an authentic ornamental double-door red security gate in the inner-corner gap
  // between the two buildings (layout.json `gates`). Matches the signature campus red ironwork
  // (terminal posts, tubular frame, security pickets with pointed spear finials, diagonal cross-braces,
  // cane drop bolts, slide latch, and center ground stop). While CLOSED it blocks east-west movement
  // through the gap (solid in `collides`); the player opens/closes it with E when within ~3.5 units.
  const GATE_INTERACT_RANGE = 3.5; // units (README controls)
  const GATE_OPEN_ANGLE = 1.5; // radians each panel swings outward (~86 degrees)
  let gateOpen = false;

  // --- The vehicle gate by the school buses (east fence): opens and closes like the main gate ----------
  let vehicleGateOpen = false;
  const VEHICLE_GATE_ANGLE = 1.45; // radians each leaf swings in toward the campus
  const vehicleGateSolid = buildingSolids.find((s) => s.x === 55 && s.z === 58 && s.d === 6.8)!;
  // while the gate is open only its two posts (and, fully open, the swung leaves) are solid
  const vehicleGatePosts: Solid[] = [
    { x: 55.0, z: 54.6, w: 0.3, d: 0.3, yBase: 0, yTop: 3.8 },
    { x: 55.0, z: 61.4, w: 0.3, d: 0.3, yBase: 0, yTop: 3.8 },
  ];
  const vehicleGateLeafSolids: Solid[] = [
    { x: 53.4, z: 54.78, w: 3.22, d: 0.2, yBase: 0, yTop: 3.6 },
    { x: 53.4, z: 61.22, w: 3.22, d: 0.2, yBase: 0, yTop: 3.6 },
  ];
  const inList = (list: Solid[], s: Solid): boolean => list.indexOf(s) >= 0;
  const setSolid = (s: Solid, on: boolean): void => {
    const i = buildingSolids.indexOf(s);
    if (on && i < 0) buildingSolids.push(s);
    else if (!on && i >= 0) buildingSolids.splice(i, 1);
  };
  /** Collision follows the animation: the barrier goes as soon as it starts opening, the swung leaves only count once open */
  function syncVehicleGateSolids(): void {
    const openness = Math.abs(vehicleGateLeaves[0].rotation.y) / VEHICLE_GATE_ANGLE;
    setSolid(vehicleGateSolid, openness < 0.2 && !vehicleGateOpen);
    for (const p of vehicleGatePosts) setSolid(p, true);
    for (const l of vehicleGateLeafSolids) setSolid(l, openness > 0.97);
  }
  void inList;
  function toggleVehicleGate(): void {
    vehicleGateOpen = !vehicleGateOpen;
    mp?.emit("world:vgate", vehicleGateOpen);
  }
  /** Distance to the vehicle gate opening (x = 55, z from 54.6 to 61.4) */
  function vehicleGateDistance(px: number, pz: number): number {
    return Math.hypot(px - 55, Math.max(54.6, Math.min(61.4, pz)) - pz);
  }

  const gatePanels: THREE.Group[] = [];

  for (const gate of gates) {
    const alongZ = gate.axis === "z";
    const halfLen = gate.length / 2;
    // Two panels, each hinged at one end of the barrier.
    const hinges: Array<[number, number]> = alongZ
      ? [
        [gate.x, gate.z - halfLen],
        [gate.x, gate.z + halfLen],
      ]
      : [
        [gate.x - halfLen, gate.z],
        [gate.x + halfLen, gate.z],
      ];

    // Heavy terminal gate posts flanking the opening (at north and south ends)
    for (let i = 0; i < hinges.length; i++) {
      const [hx, hz] = hinges[i];
      // Post column
      const postCol = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.6, 0.24), gatePostMat);
      postCol.position.set(hx, 1.8, hz);
      postCol.castShadow = true;
      // Pyramidal post cap finial
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.20, 0.16, 4), gatePostMat);
      cap.position.set(hx, 3.68, hz);
      cap.rotation.y = Math.PI / 4;
      cap.castShadow = true;
      // Base plate
      const basePlate = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.36), gatePostMat);
      basePlate.position.set(hx, 0.04, hz);
      scene.add(postCol, cap, basePlate);

      // Heavy barrel hinges connecting post to gate leaf
      for (const hy of [0.55, 2.65]) {
        const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.20, 12), gateHardwareMat);
        hinge.position.set(hx, hy, hz + (i === 0 ? 0.08 : -0.08));
        hinge.castShadow = true;
        scene.add(hinge);
      }
    }

    // Concrete & steel threshold stop in pavement at center
    const groundStop = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.44), gateHardwareMat);
    groundStop.position.set(gate.x, 0.015, gate.z);
    groundStop.receiveShadow = true;
    scene.add(groundStop);

    // Build the two swinging ornamental gate leaves
    hinges.forEach(([hx, hz], i) => {
      const pivot = new THREE.Group();
      pivot.position.set(hx, 0, hz);

      const leafGroup = new THREE.Group();
      const dir = i === 0 ? 1 : -1;
      const leafSpan = halfLen - 0.08; // ~4.17m
      const cz = dir * (leafSpan / 2 + 0.04);

      // Horizontal tubular rails (bottom, mid, top)
      for (const ry of [0.25, 1.55, 2.95]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, leafSpan), gateIronMat);
        rail.position.set(0, ry, cz);
        rail.castShadow = true;
        leafGroup.add(rail);
      }

      // Vertical stiles (hinge stile & meeting stile)
      const hingeStileZ = dir * 0.06;
      const meetingStileZ = dir * (leafSpan + 0.02);
      for (const sz of [hingeStileZ, meetingStileZ]) {
        const stile = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.78, 0.08), gateIronMat);
        stile.position.set(0, 1.60, sz);
        stile.castShadow = true;
        leafGroup.add(stile);
      }

      // Structural diagonal truss cross bracing
      const diagLen = Math.hypot(leafSpan, 1.30);
      const diagAngle = dir * Math.atan2(1.30, leafSpan);
      const diagLower = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, diagLen), gateIronMat);
      diagLower.position.set(0, 0.90, cz);
      diagLower.rotation.x = -diagAngle;
      diagLower.castShadow = true;
      const diagUpper = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, diagLen), gateIronMat);
      diagUpper.position.set(0, 2.25, cz);
      diagUpper.rotation.x = diagAngle;
      diagUpper.castShadow = true;
      leafGroup.add(diagLower, diagUpper);

      // Vertical security pickets (14 pickets per leaf with spear finials)
      const numPickets = 14;
      for (let p = 0; p < numPickets; p++) {
        const frac = (p + 0.6) / numPickets;
        const pz = dir * (0.15 + frac * (leafSpan - 0.25));
        const picket = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.82, 0.04), gateIronMat);
        picket.position.set(0, 1.60, pz);
        picket.castShadow = true;
        // Spearhead pointed finial on top of picket
        const finial = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 4), gateIronMat);
        finial.position.set(0, 3.08, pz);
        finial.rotation.y = Math.PI / 4;
        finial.castShadow = true;
        leafGroup.add(picket, finial);
      }

      // Hardware on meeting stile
      // Cane drop bolt & handle
      const caneBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.85, 10), gateHardwareMat);
      caneBolt.position.set(0.04, 0.52, meetingStileZ - dir * 0.04);
      const caneHandle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.12), gateHardwareMat);
      caneHandle.position.set(0.08, 0.92, meetingStileZ - dir * 0.04);
      leafGroup.add(caneBolt, caneHandle);

      // Heavy throw slide latch bar on meeting stile
      if (i === 0) {
        const latchBar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.32), gateHardwareMat);
        latchBar.position.set(0.05, 1.55, meetingStileZ + 0.10);
        const padlockShackle = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 8, 16, Math.PI), gateHardwareMat);
        padlockShackle.position.set(0.06, 1.59, meetingStileZ + 0.02);
        leafGroup.add(latchBar, padlockShackle);
      } else {
        const latchCatch = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.10, 0.08), gateHardwareMat);
        latchCatch.position.set(0.05, 1.55, meetingStileZ);
        leafGroup.add(latchCatch);
      }

      // Ground caster wheel under outer meeting end
      const wheelBracket = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.08), gateHardwareMat);
      wheelBracket.position.set(0, 0.16, meetingStileZ - dir * 0.08);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 16), rubberWheelMat);
      wheel.position.set(0, 0.08, meetingStileZ - dir * 0.08);
      wheel.rotation.z = Math.PI / 2;
      wheel.castShadow = true;
      leafGroup.add(wheelBracket, wheel);

      pivot.add(leafGroup);
      scene.add(pivot);
      gatePanels.push(pivot);
    });
  }

  // Distance from a point to the nearest point on any gate barrier.
  function gateDistance(px: number, pz: number): number {
    let best = Infinity;
    for (const gate of gates) {
      const halfLen = gate.length / 2;
      const cx =
        gate.axis === "z"
          ? gate.x
          : Math.max(gate.x - halfLen, Math.min(px, gate.x + halfLen));
      const cz =
        gate.axis === "z"
          ? Math.max(gate.z - halfLen, Math.min(pz, gate.z + halfLen))
          : gate.z;
      best = Math.min(best, Math.hypot(px - cx, pz - cz));
    }
    return best;
  }

  // --- Player character: shared procedural avatar rig (see avatar.ts) ------
  // The character studio preview uses the exact same builder, so what you design is what you get.
  const rig = createAvatarRig({ nameTag: true, scale: GAME_AVATAR_SCALE });
  const {
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
  } = rig;

  // Apply saved character profile & listen for live updates from the Character Studio
  rig.apply(loadCharacterProfile());
  onProfileChange((updated) => rig.apply(updated));

  // Multiplayer: other players in the same place (campus, MPR or the same classroom) are drawn and move live
  const presence = startPresence(scene, {
    getCar: (id) => {
      const c = parkingCars[id];
      return c ? { group: c.group, seat: c.driverSeatPos } : null;
    },
  });

  // --- Camera: orbits the player at a fixed distance ----------------------
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 260);
  let camAngle = DEFAULT_CAM_ANGLE; // orbit angle (radians)
  let camElevation = CAM_HEIGHT; // camera height (adjustable by dragging)
  let camDistance = CAM_DISTANCE; // camera distance (adjustable by scrolling)

  // Zoom model: the wheel sets a goal distance and the camera eases toward it. The viewing
  // angle follows the zoom (low and close behind the character when zoomed in, steeper when
  // zoomed out), and dragging up/down adds a small tilt on top (`pitchBias`).
  // Code elsewhere may still assign camDistance / camElevation directly (resets, room
  // entry): the frame loop notices and adopts those values as the new defaults.
  let zoomGoal = CAM_DISTANCE;
  let pitchBias = 0;
  let refDist = CAM_DISTANCE; // distance at which `basePitch` applies
  let basePitch = Math.atan2(CAM_HEIGHT, CAM_DISTANCE);
  let seenDist = camDistance;
  let seenElev = camElevation;

  // Capture all existing outdoor objects before creating MPR room
  const outdoorObjects = new Set<THREE.Object3D>(scene.children);

  // Build the isolated MPR Room
  const { group: mprRoomGroup, solids: mprSolids, chairs: mprChairs } = buildMprRoom();
  mprRoomGroup.visible = false;
  scene.add(mprRoomGroup);

  // NPCs: in the MPR (they hide and show with the room) or outdoors on the campus
  const npcRigs: AvatarRig[] = [];
  const npcList: Array<{ def: NpcDef; rig: AvatarRig }> = [];
  for (const def of NPCS) {
    const npcRig = createAvatarRig({ nameTag: true, scale: GAME_AVATAR_SCALE });
    npcRig.apply(def.profile);
    npcRig.player.position.set(def.x, 0, def.z);
    npcRig.player.rotation.y = def.rotY;
    const solid = { x: def.x, z: def.z, w: 0.7, d: 0.7, yBase: 0, yTop: 2.6 };
    if (def.room === "mpr") {
      mprRoomGroup.add(npcRig.player);
      mprSolids.push(solid);
    } else {
      scene.add(npcRig.player);
      outdoorObjects.add(npcRig.player); // hidden while inside the MPR or a classroom
      buildingSolids.push(solid);
    }
    npcRigs.push(npcRig);
    npcList.push({ def, rig: npcRig });
  }

  // --- Glowing "!" above an NPC the player should talk to (until its objective is complete) ----------
  const npcMarkers = new Map<string, { group: THREE.Group; glow: THREE.Sprite; mark: THREE.Sprite; baseY: number }>();
  const npcMarkTexture = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const stem = new Path2D();
    stem.roundRect(47, 10, 34, 72, 14);
    const dot = new Path2D();
    dot.arc(64, 106, 17, 0, Math.PI * 2);
    g.lineJoin = "round";
    g.lineWidth = 12;
    g.strokeStyle = "#ffffff";
    g.stroke(stem);
    g.stroke(dot);
    g.fillStyle = "#facc15";
    g.fill(stem);
    g.fill(dot);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const npcGlowTexture = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,226,90,0.95)");
    grad.addColorStop(0.4, "rgba(255,200,0,0.45)");
    grad.addColorStop(1, "rgba(255,190,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  for (const n of npcList) {
    if (!n.def.talkObjective) continue;
    const group = new THREE.Group();
    // above the name tag (tag centre is about 2.45 high for a masculine character)
    const baseY = 3.3;
    group.position.set(n.def.x, baseY, n.def.z);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: npcGlowTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(2.6, 2.6, 1);
    const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: npcMarkTexture, transparent: true, depthWrite: false }));
    mark.scale.set(0.95, 0.95, 1);
    group.add(glow, mark);
    mprRoomGroup.add(group);
    npcMarkers.set(n.def.id, { group, glow, mark, baseY });
  }
  /** Show each NPC's "!" until its objective is done */
  function updateNpcMarkers(): void {
    const done = new Set(loadSlot(getActiveSlotId())?.objectives.completedIds ?? []);
    for (const n of npcList) {
      const m = npcMarkers.get(n.def.id);
      if (m) m.group.visible = !done.has(n.def.talkObjective!);
    }
  }
  updateNpcMarkers();

  /** The NPC the player is close enough to talk to (in the same place: the MPR, or outdoors on the ground floor) */
  const NPC_TALK_RANGE = 3.8;
  function nearbyNpc(): { def: NpcDef; rig: AvatarRig } | null {
    if (seatedChair || drivingCar || currentClassroom) return null;
    const here: "mpr" | "campus" = inMprRoom ? "mpr" : "campus";
    if (here === "campus" && player.position.y > 1.5) return null; // not from the upper walkway
    let best: { def: NpcDef; rig: AvatarRig } | null = null;
    let bestD = NPC_TALK_RANGE;
    for (const n of npcList) {
      if (!n.def.dialog || n.def.room !== here) continue;
      const d = Math.hypot(player.position.x - n.def.x, player.position.z - n.def.z);
      if (d <= bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  }
  function talkToNpc(n: { def: NpcDef; rig: AvatarRig }): void {
    if (!n.def.dialog) return;
    // Face each other while talking
    const toNpc = Math.atan2(n.def.x - player.position.x, n.def.z - player.position.z);
    player.rotation.y = toNpc;
    n.rig.player.rotation.y = toNpc + Math.PI;
    showDialog(
      { name: n.def.profile.name, title: n.def.profile.title, portrait: n.def.portrait },
      n.def.dialog,
      () => {
        n.rig.player.rotation.y = n.def.rotY;
      },
      (event) => {
        // Reaching the feedback survey step completes the survey objective (removes the NPC's "!")
        if (event === "survey" && n.def.talkObjective) (window as any).__completeObjective?.(n.def.talkObjective);
      },
      (objectiveId) => !!loadSlot(getActiveSlotId())?.objectives.completedIds.includes(objectiveId)
    );
  }

  // Register all 40 MPR teacher chairs
  for (const c of mprChairs) {
    chairSlots.push(c);
  }

  let inMprRoom = false;
  let currentClassroom: ClassroomInstance | null = null;

  // Spawn in the open center/middle of the parking lot drive aisle (away from all parked cars)
  const PARKING_LOT_SPAWNS = [
    { x: -43.0, z: 10.0 },
    { x: -43.0, z: 15.0 },
    { x: -43.0, z: 20.0 },
    { x: -43.0, z: 25.0 },
    { x: -43.0, z: 30.0 },
  ];

  function getRandomParkingLotSpawn(): { x: number; z: number } {
    return PARKING_LOT_SPAWNS[Math.floor(Math.random() * PARKING_LOT_SPAWNS.length)];
  }

  const transitionOverlay = document.getElementById("scene-transition-overlay");
  function triggerTransition(onMidpoint: () => void): void {
    if (!transitionOverlay) {
      onMidpoint();
      return;
    }
    transitionOverlay.classList.add("active");
    setTimeout(() => {
      onMidpoint();
      setTimeout(() => {
        transitionOverlay.classList.remove("active");
      }, 120);
    }, 200);
  }

  /** The ELD classroom door: Mr. Van Diest collects the assignments (instead of just walking in) */
  function openEldDoor(): void {
    const slot = loadSlot(getActiveSlotId());
    const done = slot?.objectives.stampsCount ?? 0;
    const turnedIn = !!slot?.objectives.completedIds.includes("obj_turn_in");
    const { speaker, tree } = eldDoorDialog(done, turnedIn);
    showDialog(speaker, tree, undefined, (event) => {
      if (event === "turn-in") (window as any).__completeObjective?.("obj_turn_in");
    });
  }

  // --- Classroom assignment: walk up to the whiteboard and press E ---------------------------------
  function nearWhiteboard(): boolean {
    if (!currentClassroom || seatedChair || drivingCar) return false;
    const room = roomById(currentClassroom.id);
    if (!room || room.type !== "stamp") return false; // only the 16 homeroom classrooms have an assignment
    const wb = currentClassroom.whiteboard;
    const dx = Math.max(0, Math.abs(player.position.x - wb.x) - wb.w / 2);
    const dz = Math.abs(player.position.z - wb.z);
    return Math.hypot(dx, dz) <= 2.4;
  }
  /** Sit the character in a random free seat of the current classroom (not one another player is using) */
  function takeRandomSeat(): void {
    if (!currentClassroom || seatedChair) return;
    // student desks only (the teacher's chair is the first one registered); skip seats other players are using
    const free = currentClassroom.chairs.slice(1).filter((c) => !presence?.seatTaken(seatedPosX(c), seatedPosZ(c)));
    if (free.length === 0) return; // class is full: just read it standing up
    sitInChair(free[Math.floor(Math.random() * free.length)]);
  }
  const seatedPosX = (c: ChairSlot): number => c.chairX - Math.sin(c.facingAngle) * 0.08;
  const seatedPosZ = (c: ChairSlot): number => c.chairZ - Math.cos(c.facingAngle) * 0.08;

  function openAssignment(): void {
    if (!currentClassroom) return;
    takeRandomSeat(); // working on the assignment happens at a desk; stand up any time (E or move)
    const room = roomById(currentClassroom.id);
    const objectiveId = room?.objectiveId;
    const done = !!objectiveId && !!loadSlot(getActiveSlotId())?.objectives.completedIds.includes(objectiveId);
    const { speaker, tree } = assignmentDialog(currentClassroom.id, done);
    showDialog(speaker, tree, undefined, (event) => {
      if (event === "assignment-complete" && objectiveId) (window as any).__completeObjective?.(objectiveId);
    });
  }

  // --- Gold "!" on the whiteboard of every classroom whose assignment is still to do -------------------
  const boardMarkers = new Map<string, { sprite: THREE.Group; baseY: number }>();
  function ensureBoardMarker(): void {
    const inst = currentClassroom;
    if (!inst) return;
    const room = roomById(inst.id);
    if (!room || room.type !== "stamp" || boardMarkers.has(inst.id)) return;
    const group = new THREE.Group();
    const wb = inst.whiteboard;
    const baseY = 2.2;
    group.position.set(wb.x, baseY, wb.z + 0.45); // hovering on the board
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: npcGlowTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(2.6, 2.6, 1);
    const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: npcMarkTexture, transparent: true, depthWrite: false }));
    mark.scale.set(1.0, 1.0, 1);
    group.add(glow, mark);
    inst.group.add(group);
    boardMarkers.set(inst.id, { sprite: group, baseY });
  }
  /** Show each classroom's whiteboard mark until its assignment is complete */
  function updateBoardMarkers(): void {
    ensureBoardMarker();
    const done = new Set(loadSlot(getActiveSlotId())?.objectives.completedIds ?? []);
    for (const [roomId, m] of boardMarkers) {
      const obj = roomById(roomId)?.objectiveId;
      m.sprite.visible = !obj || !done.has(obj);
    }
  }

  /** On entering the MPR the character and the camera start out facing Mr. Van Diest (the camera sits behind the player). */
  function faceMrVanDiest(): void {
    const target = NPCS.find((n) => n.room === "mpr");
    if (!target) return;
    const dx = target.x - player.position.x;
    const dz = target.z - player.position.z;
    player.rotation.y = Math.atan2(dx, dz); // the character looks at him
    // the camera is placed on the opposite side of the player from him: camera = player + (sin a, cos a) * distance
    camAngle = Math.atan2(-dx, -dz);
  }

  function enterMpr(source: "parking" | "courtyard" = "courtyard"): void {
    if (drivingCar) exitCar();
    if (seatedChair) standUp();
    triggerTransition(() => {
      inMprRoom = true;
      mprRoomGroup.visible = true;
      for (const obj of outdoorObjects) {
        obj.visible = false;
      }
      if (source === "parking") {
        player.position.set(MPR_EAST_SPAWN_X, 0, MPR_EAST_SPAWN_Z);
        player.rotation.y = -Math.PI / 2; // Face West into MPR
      } else {
        player.position.set(MPR_SPAWN_X, 0, MPR_SPAWN_Z);
        player.rotation.y = 0.55; // Face South-East toward tables & presentation area
      }
      faceMrVanDiest();
      camElevation = 7.5;
      camDistance = 12.0;
      renderer.setClearColor(0x0f172a, 1);
    });
  }

  function exitMpr(dest: "parking" | "courtyard" = "courtyard"): void {
    if (seatedChair) standUp();
    triggerTransition(() => {
      inMprRoom = false;
      mprRoomGroup.visible = false;
      for (const obj of outdoorObjects) {
        obj.visible = true;
      }
      if (dest === "parking") {
        player.position.set(-39.8, 0, 43.0); // Outside MPR doors on parking lot sidewalk
        player.rotation.y = Math.PI / 2; // Face West toward parking lot
      } else {
        player.position.set(-11.5, 0, 51.5); // Outside MPR doors facing courtyard
        player.rotation.y = -Math.PI / 2; // Face East
      }
      camAngle = NORTH_UP_ANGLE;
      camElevation = CAM_HEIGHT;
      camDistance = CAM_DISTANCE;
      renderer.setClearColor(0x9ec7e8, 1);
    });
  }

  function enterClassroom(roomId: string): void {
    if (roomById(roomId)?.type !== "stamp") return; // only the 16 homeroom classrooms can be entered
    const inst = getClassroom(roomId);
    if (!inst) return;
    if (drivingCar) exitCar();
    if (seatedChair) standUp();
    if (!scene.children.includes(inst.group)) {
      scene.add(inst.group);
    }
    triggerTransition(() => {
      currentClassroom = inst;
      updateBoardMarkers();
      inst.group.visible = true;
      for (const obj of outdoorObjects) {
        obj.visible = false;
      }
      // Register chairs for this classroom
      for (const c of inst.chairs) {
        if (!chairSlots.includes(c)) chairSlots.push(c);
      }
      player.position.set(inst.spawnX, 0, inst.spawnZ);
      player.rotation.y = 0; // Face North toward front of classroom
      camAngle = 0.35; // Look down into classroom
      camElevation = 6.2;
      camDistance = 9.5;
      renderer.setClearColor(0x0f172a, 1);
    });
  }

  function exitClassroom(): void {
    if (!currentClassroom) return;
    if (seatedChair) standUp();
    const roomToExit = currentClassroom;
    const door = roomToExit.campusDoor;
    triggerTransition(() => {
      roomToExit.group.visible = false;
      currentClassroom = null;
      for (const obj of outdoorObjects) {
        obj.visible = true;
      }
      const y = door.floor === 1 ? floor2 : 0;
      if (door.axis === "z") {
        // West building: door at x = -14, walkway at x = -12.5 facing east
        player.position.set(-12.5, y, door.z);
        player.rotation.y = -Math.PI / 2;
      } else {
        // North & Office buildings: doors at z = -2 or z = -10.5, walkway to the south
        const zPos = door.z < -5 ? -9.0 : -0.5;
        player.position.set(door.x, y, zPos);
        player.rotation.y = 0;
      }
      camAngle = NORTH_UP_ANGLE;
      camElevation = CAM_HEIGHT;
      camDistance = CAM_DISTANCE;
      renderer.setClearColor(0x9ec7e8, 1);
    });
  }

  const searchParams = new URLSearchParams(window.location.search);
  const paramRoom = searchParams.get("room");
  const paramX = searchParams.has("x") ? parseFloat(searchParams.get("x")!) : NaN;
  const paramZ = searchParams.has("z") ? parseFloat(searchParams.get("z")!) : NaN;

  if (paramRoom === "mpr") {
    inMprRoom = true;
    mprRoomGroup.visible = true;
    for (const obj of outdoorObjects) {
      obj.visible = false;
    }
    player.position.set(MPR_SPAWN_X, 0, MPR_SPAWN_Z);
    faceMrVanDiest();
    camElevation = 7.5;
    camDistance = 12.0;
    renderer.setClearColor(0x0f172a, 1);
  } else if (paramRoom && allClassroomIds.includes(paramRoom)) {
    const inst = getClassroom(paramRoom);
    if (inst) {
      if (!scene.children.includes(inst.group)) scene.add(inst.group);
      currentClassroom = inst;
      updateBoardMarkers();
      inst.group.visible = true;
      for (const obj of outdoorObjects) {
        obj.visible = false;
      }
      for (const c of inst.chairs) {
        if (!chairSlots.includes(c)) chairSlots.push(c);
      }
      player.position.set(inst.spawnX, 0, inst.spawnZ);
      player.rotation.y = 0;
      camAngle = 0.35;
      camElevation = 6.2;
      camDistance = 9.5;
      renderer.setClearColor(0x0f172a, 1);
    }
  } else if (initialSpawn && !isNaN(initialSpawn.x) && !isNaN(initialSpawn.z)) {
    player.position.set(initialSpawn.x, initialSpawn.y || 0, initialSpawn.z);
    if (typeof initialSpawn.rotY === "number") player.rotation.y = initialSpawn.rotY;
  } else if (!isNaN(paramX) && !isNaN(paramZ)) {
    player.position.set(paramX, 0, paramZ);
  } else {
    // Spawns players at a random spot in the parking lot facing campus
    const spawnSpot = getRandomParkingLotSpawn();
    player.position.set(spawnSpot.x, 0, spawnSpot.z);
    player.rotation.y = -Math.PI / 2; // Face east toward campus
  }
  scene.add(player);

  // --- Interaction States: Table Seating & Vehicle Driving ---------------
  let seatedChair: ChairSlot | null = null;

  let drivingCar: DrivableCar | null = null;

  function standUp(): void {
    if (!seatedChair) return;
    const cosF = Math.cos(seatedChair.facingAngle);
    const sinF = Math.sin(seatedChair.facingAngle);
    // Test multiple safe exit spots (behind chair, or stepping out to left/right aisle)
    const candidates = [
      { fwd: -0.22, side: 0 },
      { fwd: -0.15, side: 0.35 },
      { fwd: -0.15, side: -0.35 },
      { fwd: -0.35, side: 0 },
      { fwd: 0.15, side: 0.35 },
      { fwd: 0.15, side: -0.35 },
      { fwd: 0, side: 0 },
    ];
    let standX = seatedChair.chairX - sinF * 0.22;
    let standZ = seatedChair.chairZ - cosF * 0.22;
    if (seatedChair.bench) {
      standX = seatedChair.bench.exitX;
      standZ = seatedChair.bench.exitZ;
      candidates.length = 0;
    }
    for (const c of candidates) {
      const tx = seatedChair.chairX + sinF * c.fwd + cosF * c.side;
      const tz = seatedChair.chairZ + cosF * c.fwd - sinF * c.side;
      if (!collides(tx, tz, 0)) {
        standX = tx;
        standZ = tz;
        break;
      }
    }
    player.position.x = standX;
    player.position.z = standZ;
    player.position.y = 0;
    bodyGroup.position.set(0, 0, 0);
    bodyGroup.rotation.set(0, 0, 0);
    torsoGroup.position.set(0, 0.84, 0);
    torsoGroup.rotation.set(0, 0, 0);
    headGroup.rotation.set(0, 0, 0);
    leftLegPivot.rotation.set(0, 0, 0);
    rightLegPivot.rotation.set(0, 0, 0);
    leftKneePivot.rotation.set(0, 0, 0);
    rightKneePivot.rotation.set(0, 0, 0);
    leftArmPivot.rotation.set(0, 0, 0);
    rightArmPivot.rotation.set(0, 0, 0);
    leftElbowPivot.rotation.set(0, 0, 0);
    rightElbowPivot.rotation.set(0, 0, 0);
    seatedChair = null;
    rig.syncSkeleton?.();
  }

  function sitInChair(chair: ChairSlot): void {
    if (drivingCar) exitCar();
    if (bballHeld) {
      bballHeld = false;
      bballPos.set(player.position.x + 0.5, BASKETBALL_GROUND_Y, player.position.z);
      bballVel.set(0, 0, 0);
    }
    seatedChair = chair;
    // Align with chair seat and backrest
    const seatBackOffset = 0.08;
    const seatedX = chair.chairX - Math.sin(chair.facingAngle) * seatBackOffset;
    const seatedZ = chair.chairZ - Math.cos(chair.facingAngle) * seatBackOffset;
    player.position.set(seatedX, 0, seatedZ);
    player.rotation.y = chair.facingAngle;

    // Drop body so pelvis rests directly on top of the chair seat surface
    const buttDrop = rig.seatDrop ? rig.seatDrop(chair.seatY) : (chair.seatY + 0.01) - 0.68;
    bodyGroup.position.y = buttDrop;
    bodyGroup.rotation.set(0, 0, 0);
    torsoGroup.rotation.set(0.06, 0, 0);
    headGroup.rotation.set(-0.04, 0, 0);

    // Thighs horizontal along seat, knees bent 90° down over front edge
    leftLegPivot.rotation.set(-1.52, 0, -0.06);
    rightLegPivot.rotation.set(-1.52, 0, 0.06);
    leftKneePivot.rotation.set(1.48, 0, 0);
    rightKneePivot.rotation.set(1.48, 0, 0);

    // Arms resting naturally on lap / table
    leftArmPivot.rotation.set(-0.48, 0.14, 0.18);
    rightArmPivot.rotation.set(-0.48, -0.14, -0.18);
    leftElbowPivot.rotation.set(-0.62, 0.12, 0);
    rightElbowPivot.rotation.set(-0.62, -0.12, 0);
    rig.syncSkeleton?.();

    // Objective 1: sitting at a table in the MPR completes it and shows the welcome pop-up (first time only)
    if (inMprRoom && mprChairs.includes(chair)) {
      const result = (window as any).__completeObjective?.("obj_mpr_seat") as { alreadyDone: boolean } | undefined;
      if (result && !result.alreadyDone) showWelcomePopup();
    }
  }

  function enterCar(car: DrivableCar): void {
    if (mp && car.driver && car.driver !== mp.id) return; // someone else is driving it
    if (seatedChair) standUp();
    if (mp) {
      car.driver = mp.id ?? null;
      mp.emit("world:car:claim", { id: car.id });
    }
    if (bballHeld) {
      bballHeld = false;
      bballPos.set(player.position.x + 0.6, BASKETBALL_GROUND_Y, player.position.z);
      bballVel.set(0, 0, 0);
    }
    drivingCar = car;
    car.group.add(player);
    player.scale.setScalar(0.55);
    player.position.copy(car.driverSeatPos);
    player.rotation.y = Math.PI / 2;
    leftLegPivot.rotation.set(-Math.PI / 2, 0, 0);
    rightLegPivot.rotation.set(-Math.PI / 2, 0, 0);
    leftKneePivot.rotation.set(Math.PI / 2, 0, 0);
    rightKneePivot.rotation.set(Math.PI / 2, 0, 0);
    leftArmPivot.rotation.set(-0.75, 0, -0.15);
    rightArmPivot.rotation.set(-0.75, 0, 0.15);
    leftElbowPivot.rotation.set(-0.45, 0, 0);
    rightElbowPivot.rotation.set(-0.45, 0, 0);
    bodyGroup.position.y = rig.seatDrop ? rig.seatDrop(0.37 / 0.55) : 0;
    rig.syncSkeleton?.();
  }

  function exitCar(): void {
    if (!drivingCar) return;
    scene.add(player);
    player.scale.setScalar(1.0);
    const exitDist = (drivingCar.collisionRadius || 2.2) * 0.85;
    const sideOffset = new THREE.Vector3(0, 0, -exitDist).applyAxisAngle(new THREE.Vector3(0, 1, 0), drivingCar.group.rotation.y);
    let exitX = drivingCar.group.position.x + sideOffset.x;
    let exitZ = drivingCar.group.position.z + sideOffset.z;
    if (collides(exitX, exitZ, 0)) {
      const oppOffset = new THREE.Vector3(0, 0, exitDist).applyAxisAngle(new THREE.Vector3(0, 1, 0), drivingCar.group.rotation.y);
      exitX = drivingCar.group.position.x + oppOffset.x;
      exitZ = drivingCar.group.position.z + oppOffset.z;
      if (collides(exitX, exitZ, 0)) {
        const backDist = (drivingCar.bumperRear || 2.2) + 0.6;
        const backOffset = new THREE.Vector3(-backDist, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), drivingCar.group.rotation.y);
        exitX = drivingCar.group.position.x + backOffset.x;
        exitZ = drivingCar.group.position.z + backOffset.z;
      }
    }
    player.position.set(exitX, 0, exitZ);
    player.rotation.y = drivingCar.group.rotation.y + Math.PI / 2;
    leftLegPivot.rotation.set(0, 0, 0);
    rightLegPivot.rotation.set(0, 0, 0);
    leftKneePivot.rotation.set(0, 0, 0);
    rightKneePivot.rotation.set(0, 0, 0);
    leftArmPivot.rotation.set(0, 0, 0);
    rightArmPivot.rotation.set(0, 0, 0);
    leftElbowPivot.rotation.set(0, 0, 0);
    rightElbowPivot.rotation.set(0, 0, 0);
    bodyGroup.position.y = 0;
    drivingCar.speed = 0;
    if (mp) {
      // hand the car back, leaving it where it stands
      mp.emit("world:car:release", {
        id: drivingCar.id,
        x: drivingCar.group.position.x,
        z: drivingCar.group.position.z,
        rotY: drivingCar.group.rotation.y,
        speed: 0,
        steer: 0,
      });
      drivingCar.driver = null;
    }
    drivingCar = null;
    rig.syncSkeleton?.();
  }

  function resetAllCars(fromNetwork = false): void {
    // Only cars with nobody inside are reset; a car anyone is driving stays where it is.
    if (mp && !fromNetwork) mp.emit("world:cars:reset");
    parkingCars.forEach((c) => {
      if (c === drivingCar || c.driver) return;
      c.remote = null;
      const orig = cars[c.id];
      if (orig) {
        c.group.position.set(orig.x, 0, orig.z);
        c.group.rotation.y = orig.rot;
        c.speed = 0;
        c.steerAngle = 0;
        for (const p of c.steerPivots) p.rotation.y = 0;
      }
    });
    carResetPlungerTimer = 0.35;
    carResetBtnMat.emissiveIntensity = 2.8;
    carResetToastTimer = 2.5;
    carResetToast.textContent = drivingCar || parkingCars.some((c) => c.driver) ? "🚗 All empty cars were reset to their parking spots!" : "🚗 All cars & van were reset to parking spots!";
    carResetToast.style.transform = "translateX(-50%) scale(1)";
    carResetToast.style.opacity = "1";
  }

  function resize(): void {
    const width = container.clientWidth || window.innerWidth;
    const heightPx = container.clientHeight || window.innerHeight;
    renderer.setSize(width, heightPx);
    camera.aspect = width / heightPx;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  // --- Compass: clicking it snaps the camera back to north-up -------------
  const compass = document.getElementById("compass");
  const compassNeedle = document.getElementById("compass-needle");
  const gateHint = document.getElementById("gate-hint");
  let gateHintShown = ""; // "" = hidden, otherwise the current hint text
  const mprHint = document.getElementById("mpr-hint");
  let mprHintShown = "";
  if (compass) {
    compass.addEventListener("click", () => {
      if (currentClassroom) {
        camAngle = 0.35;
        camElevation = 6.2;
        camDistance = 9.5;
      } else if (inMprRoom) {
        camAngle = 0.25;
        camElevation = 7.5;
        camDistance = 12.0;
      } else {
        camAngle = NORTH_UP_ANGLE;
        camElevation = CAM_HEIGHT;
        camDistance = CAM_DISTANCE;
      }
    });
  }

  // --- Unstuck button: teleports player to spawn point if stuck
  const unstuckBtn = document.getElementById("unstuck-btn");
  if (unstuckBtn) {
    unstuckBtn.addEventListener("click", () => {
      if (drivingCar) exitCar();
      if (seatedChair) standUp();
      if (currentClassroom) {
        exitClassroom();
      } else if (inMprRoom) {
        exitMpr("courtyard");
      }
      // Teleport directly to the front doors of the MPR in the courtyard
      player.position.set(-11.5, 0, 51.5);
      player.rotation.y = -Math.PI / 2; // Facing East toward courtyard
      camAngle = NORTH_UP_ANGLE;
      camElevation = CAM_HEIGHT;
      camDistance = CAM_DISTANCE;
    });
  }

  // --- Camera orbit: right-click + drag to rotate around the character -----
  // Horizontal drag changes the orbit angle; vertical drag changes elevation.
  // The camera NEVER leaves the player - it stays locked to them.
  let orbiting = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  const canvas = renderer.domElement;
  // Suppress the browser's right-click menu so dragging feels natural.
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  // --- Scroll-wheel zoom: move the camera closer to / farther from the
  // player, clamped to 12..55 units outside, 6..18 units inside MPR, 5..15 inside classroom.
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const maxZ = inMprRoom ? 18.0 : (currentClassroom ? 15.0 : MAX_ZOOM);
      const minZ = MIN_ZOOM;
      // Proportional (exponential) zoom feels the same at every distance. Normalise line-based
      // wheels, and make Mac trackpad pinch (ctrl+wheel) a little stronger.
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : 1) * (e.ctrlKey ? 3 : 1);
      zoomGoal = Math.min(maxZ, Math.max(minZ, zoomGoal * Math.exp(delta * 0.0014)));
    },
    { passive: false }
  );

  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      if (bballHeld) {
        shootBasketball();
        return;
      }
      const distToBtn = Math.hypot(player.position.x - CAR_RESET_BTN_X, player.position.z - CAR_RESET_BTN_Z);
      if (distToBtn <= 2.2) {
        resetAllCars();
        return;
      }
    }
    if (e.button === 2) {
      orbiting = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (!orbiting) return;
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    camAngle -= dx * 0.005; // horizontal drag orbits around the player
    pitchBias = Math.min(0.45, Math.max(-0.45, pitchBias + dy * 0.004)); // drag down = steeper view
  });

  window.addEventListener("mouseup", () => {
    orbiting = false;
  });

  // --- Input: WASD + arrow keys (spec section 5.4) ------------------------
  const keys = new Set<string>();
  const HANDLED_KEYS = new Set([
    "w", "a", "s", "d", "shift",
    "arrowup", "arrowdown", "arrowleft", "arrowright",
  ]);

  window.addEventListener("keydown", (e) => {
    const settingsModal = document.getElementById("settings-modal-overlay");
    if (settingsModal && settingsModal.style.display === "flex") {
      keys.clear();
      return;
    }

    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    ) {
      return;
    }

    if (e.shiftKey || e.code === "ShiftLeft" || e.code === "ShiftRight") {
      keys.add("shift");
    }
    // E is the action key: stand up / leave the car, shoot a held basketball, use doors and the gate,
    // press the car reset button, sit in a chair or get into a car.
    if (e.code === "KeyE") {
      e.preventDefault();
      const distToCarResetBtn = Math.hypot(player.position.x - CAR_RESET_BTN_X, player.position.z - CAR_RESET_BTN_Z);
      if (distToCarResetBtn <= 2.2) {
        resetAllCars();
        return;
      }
      if (drivingCar) {
        exitCar();
        return;
      }
      if (seatedChair) {
        standUp();
        return;
      }
      if (bballHeld) {
        shootBasketball();
        return;
      }
      if (!inMprRoom && !currentClassroom && elevator.press(player.position.x, player.position.y, player.position.z)) return;
      const talkNpc = nearbyNpc();
      if (talkNpc) {
        talkToNpc(talkNpc);
        return;
      }
      if (inMprRoom) {
        const distToWestExit = Math.hypot(player.position.x - MPR_EXIT_DOOR_X, player.position.z - MPR_EXIT_DOOR_Z);
        const distToEastExit = Math.hypot(player.position.x - MPR_EAST_EXIT_DOOR_X, player.position.z - MPR_EAST_EXIT_DOOR_Z);
        if (distToWestExit <= 2.6) {
          exitMpr("courtyard");
          return;
        }
        if (distToEastExit <= 2.6) {
          exitMpr("parking");
          return;
        }
      } else if (currentClassroom) {
        const distToExit = Math.hypot(player.position.x - currentClassroom.exitDoorX, player.position.z - currentClassroom.exitDoorZ);
        if (distToExit <= 2.6) {
          exitClassroom();
          return;
        }
        if (nearWhiteboard()) {
          openAssignment();
          return;
        }
      } else {
        // Outside campus: check MPR doors
        const distToMprEast = Math.hypot(player.position.x - MPR_CAMPUS_DOOR_X, player.position.z - MPR_CAMPUS_DOOR_Z);
        if (distToMprEast <= 2.8) {
          enterMpr("courtyard");
          return;
        }
        const distToMprParking = Math.hypot(player.position.x - MPR_CAMPUS_PARKING_DOOR_X, player.position.z - MPR_CAMPUS_PARKING_DOOR_Z);
        if (distToMprParking <= 2.8) {
          enterMpr("parking");
          return;
        }
        // Check classroom doors
        const pFloor = player.position.y > floor2 * 0.5 ? 1 : 0;
        for (const cId of allClassroomIds) {
          const inst = getClassroom(cId);
          if (!inst) continue;
          if (inst.campusDoor.floor === pFloor) {
            const d = Math.hypot(player.position.x - inst.campusDoor.x, player.position.z - inst.campusDoor.z);
            if (d <= 2.4) {
              if (cId === "eld") openEldDoor();
              else if (DOOR_TALK[cId]) showDialog(DOOR_TALK[cId].speaker, DOOR_TALK[cId].tree); // Theater / Music room: their teachers greet you at the door
              else if (roomById(cId)?.type === "stamp") enterClassroom(cId); // the Learning Center stays closed (the hint says so)
              return;
            }
          }
        }
      }
      if (gateDistance(player.position.x, player.position.z) <= GATE_INTERACT_RANGE) {
        gateOpen = !gateOpen;
        mp?.emit("world:gate", gateOpen);
        return;
      }
      if (!inMprRoom && !currentClassroom && !drivingCar && player.position.y < 1.5 && vehicleGateDistance(player.position.x, player.position.z) <= 3.5) {
        toggleVehicleGate();
        return;
      }
      if (drinkTimer > 0) {
        stopDrinking();
        return;
      }
      if (nearFountain()) {
        startDrinking();
        return;
      }
      // Check nearest chair (range: 1.8m)
      let nearestChair: ChairSlot | null = null;
      let minChairDist = 1.8;
      for (const c of chairSlots) {
        if (c.bench && (player.position.y > 1.5 || presence?.seatTaken(c.chairX - Math.sin(c.facingAngle) * 0.08, c.chairZ - Math.cos(c.facingAngle) * 0.08))) continue; // not from the walkway above, not an occupied seat
        const d = Math.hypot(player.position.x - c.chairX, player.position.z - c.chairZ);
        if (d < minChairDist) {
          minChairDist = d;
          nearestChair = c;
        }
      }
      if (nearestChair) {
        sitInChair(nearestChair);
        return;
      }
      // Check nearest car in parking lot (range: 3.8m)
      let nearestCar: DrivableCar | null = null;
      let minCarDist = 3.8;
      for (const car of parkingCars) {
        if (car.driver && car.driver !== mp?.id) continue; // taken
        const d = Math.hypot(player.position.x - car.group.position.x, player.position.z - car.group.position.z);
        if (d < minCarDist) {
          minCarDist = d;
          nearestCar = car;
        }
      }
      if (nearestCar) {
        enterCar(nearestCar);
        return;
      }
      return;
    }
    if (e.code === "Space") {
      e.preventDefault(); // never scroll the page
      return;
    }
    if (e.key.toLowerCase() === "f") {
      if (bballHeld) {
        shootBasketball();
        return;
      }
    }
    if (e.key.toLowerCase() === "b") {
      requestBallReset();
    }
    const key = e.key.toLowerCase();
    if (seatedChair && HANDLED_KEYS.has(key) && key !== "shift") {
      standUp();
    }
    if (drinkTimer > 0 && HANDLED_KEYS.has(key) && key !== "shift" && key !== "e") stopDrinking();
    if (HANDLED_KEYS.has(key)) {
      keys.add(key);
      e.preventDefault(); // stop the page from scrolling
    }
  });
  window.addEventListener("keyup", (e) => {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    ) {
      return;
    }

    const key = e.key.toLowerCase();
    keys.delete(key);
    if (!e.shiftKey && (key === "shift" || e.code === "ShiftLeft" || e.code === "ShiftRight")) {
      keys.delete("shift");
    }
  });
  window.addEventListener("blur", () => keys.clear());

  // =========================================================================
  // COLLISION - height-aware. Two kinds of solid boxes:
  //   * building walls: solid from the ground up to the roof (yBase 0..roofY)
  //   * second-story walls: solid only up on the second floor
  //     (yBase floor2..floor2+railingHeight)
  // The player (a box from feet `py` to `py + PLAYER_HEIGHT`) only collides
  // when its vertical span overlaps the solid's vertical span. So once the
  // player is up on a second floor (py ~= floor2) the ground building walls no
  // longer block them, and the second-story walls only block them up there.
  // =========================================================================
  const STEP_UP = 0.5; // feet this close to a solid's top may step onto it (stair tops)
  function inStairZone(px: number, pz: number): boolean {
    for (const stair of stairs) {
      const halfW = stair.width / 2;
      const halfLen = stair.len / 2;
      const [hx, hz] = stair.axis === "z" ? [halfW, halfLen] : [halfLen, halfW];
      if (Math.abs(px - stair.center.x) <= hx && Math.abs(pz - stair.center.z) <= hz) return true;
    }
    return false;
  }

  function collides(px: number, pz: number, py: number): boolean {
    if (currentClassroom) {
      const halfRoom = currentClassroom.size / 2;
      const minX = currentClassroom.worldX - halfRoom + 0.15;
      const maxX = currentClassroom.worldX + halfRoom - 0.15;
      const minZ = currentClassroom.worldZ - halfRoom + 0.15;
      const maxZ = currentClassroom.worldZ + halfRoom - 0.15;
      const INDOOR_PLAYER_RADIUS = 0.28;
      if (
        px <= minX + INDOOR_PLAYER_RADIUS ||
        px >= maxX - INDOOR_PLAYER_RADIUS ||
        pz <= minZ + INDOOR_PLAYER_RADIUS ||
        pz >= maxZ - INDOOR_PLAYER_RADIUS
      ) {
        return true;
      }
      for (const s of currentClassroom.solids) {
        const halfW = s.w / 2;
        const halfD = s.d / 2;
        const nearestX = Math.max(s.x - halfW, Math.min(px, s.x + halfW));
        const nearestZ = Math.max(s.z - halfD, Math.min(pz, s.z + halfD));
        const dx = px - nearestX;
        const dz = pz - nearestZ;
        if (dx * dx + dz * dz < INDOOR_PLAYER_RADIUS * INDOOR_PLAYER_RADIUS) return true;
      }
      return false;
    }

    if (inMprRoom) {
      const halfRoom = MPR_ROOM_SIZE / 2;
      const minX = MPR_ROOM_X - halfRoom + 0.15;
      const maxX = MPR_ROOM_X + halfRoom - 0.15;
      const minZ = MPR_ROOM_Z - halfRoom + 0.15;
      const maxZ = MPR_ROOM_Z + halfRoom - 0.15;
      if (
        px <= minX + PLAYER_RADIUS ||
        px >= maxX - PLAYER_RADIUS ||
        pz <= minZ + PLAYER_RADIUS ||
        pz >= maxZ - PLAYER_RADIUS
      ) {
        return true;
      }
      for (const s of mprSolids) {
        const halfW = s.w / 2;
        const halfD = s.d / 2;
        const nearestX = Math.max(s.x - halfW, Math.min(px, s.x + halfW));
        const nearestZ = Math.max(s.z - halfD, Math.min(pz, s.z + halfD));
        const dx = px - nearestX;
        const dz = pz - nearestZ;
        if (dx * dx + dz * dz < PLAYER_RADIUS * PLAYER_RADIUS) return true;
      }
      return false;
    }

    // World map outer boundaries (North Road, Apartments, East Road, and Campus)
    if (
      px <= -61.0 + PLAYER_RADIUS ||
      px >= 74.5 - PLAYER_RADIUS ||
      pz <= -54.0 + PLAYER_RADIUS ||
      pz >= 81.5 - PLAYER_RADIUS
    ) {
      return true;
    }

    const playerTop = py + PLAYER_HEIGHT;
    const onStairs = inStairZone(px, pz);
    const solids: Solid[] = (onStairs ? [] : buildingSolids).concat(railingSolids, elevator.solids());
    for (const s of solids) {
      if (py >= s.yTop - STEP_UP || playerTop <= s.yBase) continue; // no vertical overlap
      const halfW = s.w / 2;
      const halfD = s.d / 2;
      const nearestX = Math.max(s.x - halfW, Math.min(px, s.x + halfW));
      const nearestZ = Math.max(s.z - halfD, Math.min(pz, s.z + halfD));
      const dx = px - nearestX;
      const dz = pz - nearestZ;
      if (dx * dx + dz * dz < PLAYER_RADIUS * PLAYER_RADIUS) return true;
    }

    // Gate: solid while closed (its panels have swung less than ~30
    // degrees). Once swung open, the passage through the corner gap
    // is walkable.
    if (gatePanels.length > 0 && Math.abs(gatePanels[0].rotation.y) < 0.5) {
      for (const gate of gates) {
        if (py >= gate.height || playerTop <= 0) continue; // gate spans y 0..height
        const gw = gate.axis === "z" ? gate.thickness : gate.length;
        const gd = gate.axis === "z" ? gate.length : gate.thickness;
        const nearestX = Math.max(gate.x - gw / 2, Math.min(px, gate.x + gw / 2));
        const nearestZ = Math.max(gate.z - gd / 2, Math.min(pz, gate.z + gd / 2));
        const dx = px - nearestX;
        const dz = pz - nearestZ;
        if (dx * dx + dz * dz < PLAYER_RADIUS * PLAYER_RADIUS) return true;
      }
    }
    return false;
  }

  // Is the player over a roof footprint? (used to hold them at floor2)
  function onRoof(px: number, pz: number): boolean {
    for (const r of roofs) {
      if (px >= r.minX - 0.5 && px <= r.maxX + 0.5 && pz >= r.minZ - 0.5 && pz <= r.maxZ + 0.5) {
        return true;
      }
    }
    return false;
  }

  // Is the player over a walkway deck? (decks sit at floor2; ground players can
  // still walk underneath because this is only used when already up high)
  function onDeck(px: number, pz: number): boolean {
    for (const d of decks) {
      const tol = 0.3; if (px >= d.minX - tol && px <= d.maxX + tol && pz >= d.minZ - tol && pz <= d.maxZ + tol) return true;
    }
    return false;
  }

  // Compute the target floor height at the player's (x,z). Inside a stair zone
  // the height interpolates from 0 (bottom) to floor2 (top). On a roof it is
  // floor2; otherwise 0 (the ground).
  function targetFloorY(px: number, pz: number): number {
    // If already up high and still over a roof/walkway, stay up (prevents
    // snapping down while walking across it).
    // inside the elevator the floor is the cab; the landing pad in front of the upper door is at floor2
    const inElevator = elevator.floorAt(px, pz);
    if (inElevator !== null) return inElevator;
    if (player.position.y > floor2 * 0.5 && (onRoof(px, pz) || onDeck(px, pz) || elevator.onPad(px, pz))) return floor2;

    for (const stair of stairs) {
      const halfW = stair.width / 2;
      const halfLen = stair.len / 2;
      let inside = false;
      if (stair.axis === "z") {
        inside =
          px >= stair.center.x - halfW && px <= stair.center.x + halfW &&
          pz >= stair.center.z - halfLen && pz <= stair.center.z + halfLen;
      } else {
        inside =
          px >= stair.center.x - halfLen && px <= stair.center.x + halfLen &&
          pz >= stair.center.z - halfW && pz <= stair.center.z + halfW;
      }
      if (!inside) continue;
      const p =
        stair.axis === "z"
          ? (pz - stair.bottom) / (stair.top - stair.bottom)
          : (px - stair.bottom) / (stair.top - stair.bottom);
      return floor2 * Math.min(1, Math.max(0, p));
    }

    if (onRoof(px, pz)) return floor2;
    return 0;
  }


  // --- Camera clearance near the elevator --------------------------------------------------
  // Returns 0..1: how far along the line from the character (f) to the wanted camera position (c) the camera
  // can go before it would be behind a building wall.
  let camOcc = 1;
  const camWallTop = floor2 + layoutData.boundary.railingHeight;
  function cameraClearance(fx: number, fy: number, fz: number, cx: number, cy: number, cz: number): number {
    let best = 1;
    const dx = cx - fx;
    const dz = cz - fz;
    for (const w of walls) {
      // segment vs rectangle in the XZ plane (slab method)
      let t0 = 0;
      let t1 = 1;
      let hit = true;
      for (const [o, d, lo, hi] of [
        [fx, dx, w.x - w.w / 2, w.x + w.w / 2],
        [fz, dz, w.z - w.d / 2, w.z + w.d / 2],
      ] as Array<[number, number, number, number]>) {
        if (Math.abs(d) < 1e-9) {
          if (o < lo || o > hi) hit = false;
        } else {
          let a = (lo - o) / d;
          let b = (hi - o) / d;
          if (a > b) [a, b] = [b, a];
          t0 = Math.max(t0, a);
          t1 = Math.min(t1, b);
          if (t0 > t1) hit = false;
        }
      }
      if (!hit || t0 <= 0 || t0 >= 1) continue; // no hit, or the character is inside the wall rectangle
      const yAtEntry = fy + (cy - fy) * t0;
      if (yAtEntry < camWallTop) best = Math.min(best, t0 - 0.03);
    }
    // never closer than a little behind the character
    const len = Math.hypot(cx - fx, cy - fy, cz - fz) || 1;
    return Math.min(1, Math.max(best, 2.4 / len));
  }

  // Resetting the balls (stepping on the vent or pressing B) asks for confirmation first
  function doBallReset(fromNetwork = false): void {
    if (mp && !fromNetwork) mp.emit("world:balls:reset");
    ballSync.soccer.own = !mp;
    ballSync.soccer.ownerId = null;
    ballSync.soccer.hasState = false;
    ballSync.basket.own = !mp;
    ballSync.basket.ownerId = null;
    ballSync.basket.hasState = false;
    ballSync.basket.held = false;
    resetBall();
    resetBasketball();
    resetBannerTimer = 2.0;
    resetBanner.style.transform = "translateX(-50%) scale(1)";
    resetBanner.style.opacity = "1";
    shockwaveScale = 0.2;
    shockwaveOpacity = 1.0;
    padTopMat.emissive.setHex(0x0284c7);
    padTopMat.emissiveIntensity = 0.9;
  }
  function requestBallReset(): void {
    confirmAction(
      { title: "Reset the balls?", message: "The soccer ball and basketball will go back to their starting spots.", confirmLabel: "Yes, reset them", cancelLabel: "Cancel" },
      () => doBallReset()
    );
  }


  // --- Multiplayer: the shared world ------------------------------------------------------------------
  // The gate and the elevator are shared switches; each car has one driver who reports its position; each ball has an
  // owner (the last player to touch it) who simulates it and reports its position. Everyone else sees that version.
  const mp = isMultiplayerActive() ? getSocket() : null;
  type BallSync = { own: boolean; ownerId: string | null; target: THREE.Vector3; vel: THREE.Vector3; held: boolean; hasState: boolean; lastSend: number; lastClaim: number };
  const newBallSync = (): BallSync => ({ own: !mp, ownerId: null, target: new THREE.Vector3(), vel: new THREE.Vector3(), held: false, hasState: false, lastSend: 0, lastClaim: 0 });
  const ballSync = { soccer: newBallSync(), basket: newBallSync() };
  let carSendTimer = 0;

  /** Take over simulating a ball (called when this player touches it) */
  function claimBall(which: "soccer" | "basket"): void {
    if (!mp) return;
    const b = ballSync[which];
    if (b.own) return;
    const now = performance.now();
    if (now - b.lastClaim < 250) return;
    b.lastClaim = now;
    b.own = true;
    b.ownerId = mp.id ?? null;
    mp.emit("world:ball:claim", { ball: which });
  }

  const mpHandlers: Array<[string, (...args: any[]) => void]> = [];
  function mpOn(event: string, fn: (...args: any[]) => void): void {
    if (!mp) return;
    mp.on(event, fn);
    mpHandlers.push([event, fn]);
  }
  function applyBallState(which: "soccer" | "basket", st: { x: number; y: number; z: number; vx: number; vy: number; vz: number; held?: number }, snap: boolean): void {
    const b = ballSync[which];
    b.target.set(st.x, st.y, st.z);
    b.vel.set(st.vx, st.vy, st.vz);
    b.held = !!st.held;
    if (snap || !b.hasState) {
      (which === "soccer" ? ballPos : bballPos).copy(b.target);
    }
    b.hasState = true;
  }
  mpOn("world:snapshot", (s: any) => {
    gateOpen = !!s.gate;
    vehicleGateOpen = !!s.vehicleGate;
    applyOccupancy(s.occupancy ?? {});
    elevator.setLevel(s.elevatorLevel === 1 ? 1 : 0);
    for (const c of s.cars ?? []) {
      const car = parkingCars[c.id];
      if (!car) continue;
      car.driver = c.driver ?? null;
      if (c.state) {
        car.group.position.set(c.state.x, 0, c.state.z);
        car.group.rotation.y = c.state.rotY;
        car.remote = { x: c.state.x, z: c.state.z, rotY: c.state.rotY, speed: 0, steer: 0 };
      }
    }
    for (const key of ["soccer", "basket"] as const) {
      const b = s.balls?.[key];
      if (!b) continue;
      ballSync[key].ownerId = b.owner ?? null;
      ballSync[key].own = b.owner === mp!.id;
      if (b.state) applyBallState(key, b.state, true);
    }
  });
  if (mp) {
    // get the world as it is right now (also after a reconnect)
    const sync = (): void => void mp.emit("world:sync");
    if (mp.connected) sync();
    mpOn("connect", sync);
  }
  /** Windows light up (with a silhouette inside) for every classroom somebody is in */
  function applyOccupancy(counts: Record<string, number>): void {
    for (const roomId of roomWindows.keys()) setRoomLit(roomId, (counts[roomId] ?? 0) > 0);
  }
  mpOn("world:occupancy", (counts: Record<string, number>) => applyOccupancy(counts));
  mpOn("world:gate", (open: boolean) => {
    gateOpen = !!open;
  });
  mpOn("world:vgate", (open: boolean) => {
    vehicleGateOpen = !!open;
  });
  if (mp) elevator.setNetwork((dest, call) => mp.emit("world:elevator:request", { dest, call }));
  mpOn("world:elevator:go", (d: { dest: 0 | 1; call: boolean }) => {
    if (!inMprRoom && !currentClassroom) elevator.go(d.dest, d.call, player.position.x, player.position.z);
    else elevator.go(d.dest, d.call, -9999, -9999); // indoors: runs for show, nobody to carry
  });
  mpOn("world:car:driver", (d: { id: number; driver: string | null }) => {
    const car = parkingCars[d.id];
    if (!car) return;
    car.driver = d.driver;
    if (d.driver && d.driver !== mp!.id) {
      if (drivingCar === car) exitCar(); // someone else got there first
    }
    if (!d.driver && car !== drivingCar) car.remote = car.remote; // keep the last reported spot
  });
  mpOn("world:car:denied", (d: { id: number }) => {
    if (drivingCar && drivingCar.id === d.id) exitCar();
  });
  mpOn("world:car:state", (d: { id: number; x: number; z: number; rotY: number; speed: number; steer: number }) => {
    const car = parkingCars[d.id];
    if (!car || car === drivingCar) return;
    car.remote = { x: d.x, z: d.z, rotY: d.rotY, speed: d.speed, steer: d.steer };
  });
  mpOn("world:cars:reset", () => resetAllCars(true));
  mpOn("world:ball:owner", (d: { ball: "soccer" | "basket"; owner: string | null }) => {
    const b = ballSync[d.ball];
    if (!b) return;
    b.ownerId = d.owner;
    b.own = d.owner === mp!.id;
    if (!b.own && d.ball === "basket" && bballHeld) {
      bballHeld = false; // someone took the ball away
    }
  });
  mpOn("world:ball:state", (d: { ball: "soccer" | "basket"; x: number; y: number; z: number; vx: number; vy: number; vz: number; held?: number }) => {
    if (!ballSync[d.ball] || ballSync[d.ball].own) return;
    applyBallState(d.ball, d, false);
  });
  mpOn("world:balls:reset", () => doBallReset(true));
  mpOn("world:event", (d: { type: "goal" | "bucket"; text: string }) => {
    if (d.type === "goal") triggerGoal(d.text);
    else triggerBucket(d.text);
  });

  // --- Animation loop ------------------------------------------------------
  const clock = new THREE.Clock();
  let walkTime = 0;

  // --- Classrooms with an assignment still to do: a green "!" floats above the entrance door ----------
  // Each of the 16 homeroom classrooms has an assignment. The marks appear once the game has really started
  // (the player has sat down in the MPR) and each one disappears when its assignment is complete.
  const markerTexture = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    // a bold green "!" (stem and dot) with a white outline, no circle; drawn as shapes so it is crisp and
    // sits well inside the canvas (nothing is clipped)
    const stem = new Path2D();
    stem.roundRect(47, 10, 34, 72, 14);
    const dot = new Path2D();
    dot.arc(64, 106, 17, 0, Math.PI * 2);
    g.lineJoin = "round";
    g.lineWidth = 12;
    g.strokeStyle = "#ffffff";
    g.stroke(stem);
    g.stroke(dot);
    g.fillStyle = "#16a34a";
    g.fill(stem);
    g.fill(dot);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const doorMarkers = new Map<string, THREE.Sprite>();

  function setDoorMarker(roomId: string, on: boolean): void {
    const parts = doorParts.get(roomId);
    if (!parts) return;
    const cur = doorMarkers.get(roomId);
    if (on && !cur) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTexture, transparent: true }));
      // In front of the wall (doors in west-building walls face +x, doors in north-building walls face +z).
      // Ground-floor doors sit under the walkway overhang, so their mark hangs lower, in front of the upper part
      // of the door, where it is easy to see. Upper-floor doors keep theirs just above the door.
      const ground = parts.floor === 0;
      const out = ground ? 1.15 : 0.9;
      sprite.position.set(
        parts.x + (parts.axis === "z" ? out : 0),
        ground ? parts.y + 0.15 : parts.y + DOOR_HEIGHT / 2 + 0.46,
        parts.z + (parts.axis === "x" ? out : 0)
      );
      sprite.userData.baseY = sprite.position.y;
      sprite.scale.set(ground ? 1.1 : 0.85, ground ? 1.1 : 0.85, 1);
      scene.add(sprite);
      doorMarkers.set(roomId, sprite);
    } else if (!on && cur) {
      scene.remove(cur);
      (cur.material as THREE.SpriteMaterial).dispose();
      doorMarkers.delete(roomId);
    }
  }

  /** Marks over the doors of rooms still to do; none until the player has sat down in the MPR */
  function applyDoorMarkers(): void {
    const done = new Set(loadSlot(getActiveSlotId())?.objectives.completedIds ?? []);
    const started = done.has("obj_mpr_seat");
    for (const [objId, roomId] of roomIdByObjective) setDoorMarker(roomId, started && !done.has(objId));
  }
  const onObjectiveComplete = (e: Event): void => {
    const room = roomIdByObjective.get((e as CustomEvent<{ id: string }>).detail?.id);
    if ((e as CustomEvent<{ id: string }>).detail?.id === "obj_mpr_seat") applyDoorMarkers();
    updateNpcMarkers();
    updateBoardMarkers();
    if (room) setDoorMarker(room, false);
  };
  window.addEventListener("eld-objective-complete", onObjectiveComplete);
  applyDoorMarkers();

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1); // clamp to avoid huge jumps
    if (npcMarkers.size) {
      const t = performance.now() * 0.003;
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
      for (const m of npcMarkers.values()) {
        if (!m.group.visible) continue;
        m.group.position.y = m.baseY + Math.sin(t) * 0.1;
        (m.glow.material as THREE.SpriteMaterial).opacity = 0.65 + 0.35 * pulse;
        m.glow.scale.setScalar(2.4 + 0.5 * pulse);
      }
    }
    if (boardMarkers.size) {
      const t = performance.now() * 0.003;
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
      for (const m of boardMarkers.values()) {
        if (!m.sprite.visible) continue;
        m.sprite.position.y = m.baseY + Math.sin(t) * 0.08;
        const glow = m.sprite.children[0] as THREE.Sprite;
        (glow.material as THREE.SpriteMaterial).opacity = 0.65 + 0.35 * pulse;
        glow.scale.setScalar(2.3 + 0.5 * pulse);
      }
    }
    if (doorMarkers.size) {
      // gentle bob so the marks catch the eye
      const t = performance.now() * 0.003;
      for (const m of doorMarkers.values()) m.position.y = (m.userData.baseY as number) + Math.sin(t) * 0.12;
    }
    elevator.update(dt, player.position.x, player.position.y, player.position.z, camera.position.x, camera.position.z);
    // Multiplayer: cars someone else is driving glide to the position they report
    for (const c of parkingCars) {
      const r = c.remote;
      if (!r || c === drivingCar) continue;
      const k = 1 - Math.exp(-dt * 12);
      c.group.position.x += (r.x - c.group.position.x) * k;
      c.group.position.z += (r.z - c.group.position.z) * k;
      const dr = Math.atan2(Math.sin(r.rotY - c.group.rotation.y), Math.cos(r.rotY - c.group.rotation.y));
      c.group.rotation.y += dr * k;
      for (const pivot of c.steerPivots) pivot.rotation.y += (r.steer - pivot.rotation.y) * k;
      const roll = -(r.speed * dt) / c.tireRadius;
      for (const wm of c.wheelMeshes) wm.parent!.rotation.z += roll;
    }
    let inRight = 0;
    let inForward = 0;
    if (keys.has("w") || keys.has("arrowup")) inForward += 1;
    if (keys.has("s") || keys.has("arrowdown")) inForward -= 1;
    if (keys.has("a") || keys.has("arrowleft")) inRight -= 1;
    if (keys.has("d") || keys.has("arrowright")) inRight += 1;

    if (elevator.riding) {
      inRight = 0;
      inForward = 0; // no walking while the elevator carries the player
    }

    // Input is relative to the SCREEN: W goes away from the camera, so it works
    // at any orbit angle. (Camera sits at +sin/+cos of camAngle from the player.)
    let moving = false;
    let moveX = 0;
    let moveZ = 0;
    const sprinting = keys.has("shift");

    if (drivingCar) {
      let steerInput = 0;
      if (keys.has("a") || keys.has("arrowleft")) steerInput += 1;
      if (keys.has("d") || keys.has("arrowright")) steerInput -= 1;
      const targetSteer = steerInput * 0.55;
      drivingCar.steerAngle += (targetSteer - drivingCar.steerAngle) * Math.min(1, dt * 8);

      for (const p of drivingCar.steerPivots) {
        p.rotation.y = drivingCar.steerAngle;
      }

      const isBoosting = keys.has("shift");
      const baseMax = drivingCar.maxSpeed;
      const maxFwdSpeed = isBoosting ? baseMax * 1.55 : baseMax;
      const maxRevSpeed = -4.5;
      const baseAccel = drivingCar.accel;
      const accel = isBoosting ? baseAccel * 1.5 : baseAccel;
      const brakePower = 18.0;
      const coastFriction = 4.5;

      const gas = keys.has("w") || keys.has("arrowup");
      const brakeOrRev = keys.has("s") || keys.has("arrowdown");

      if (gas) {
        if (drivingCar.speed < 0) drivingCar.speed += brakePower * dt;
        else drivingCar.speed = Math.min(maxFwdSpeed, drivingCar.speed + accel * dt);
      } else if (brakeOrRev) {
        if (drivingCar.speed > 0) drivingCar.speed -= brakePower * dt;
        else drivingCar.speed = Math.max(maxRevSpeed, drivingCar.speed - accel * 0.7 * dt);
      } else {
        if (Math.abs(drivingCar.speed) <= coastFriction * dt) drivingCar.speed = 0;
        else drivingCar.speed -= Math.sign(drivingCar.speed) * coastFriction * dt;
      }

      // Brake light emissive glow
      const isBraking = brakeOrRev && drivingCar.speed > 0.1;
      drivingCar.brakeLightMat.emissiveIntensity = isBraking ? 1.5 : 0.6;

      // Heading rotation via bicycle steering model
      const wheelbase = drivingCar.wheelbase;
      const turnRate = (drivingCar.speed / wheelbase) * Math.sin(drivingCar.steerAngle);
      drivingCar.group.rotation.y += turnRate * dt;

      // Translation
      const carFwdX = Math.cos(drivingCar.group.rotation.y);
      const carFwdZ = -Math.sin(drivingCar.group.rotation.y);
      const stepDist = drivingCar.speed * dt;
      const nextCarX = drivingCar.group.position.x + carFwdX * stepDist;
      const nextCarZ = drivingCar.group.position.z + carFwdZ * stepDist;

      // Collision check for car
      const frontX = nextCarX + carFwdX * drivingCar.bumperFront;
      const frontZ = nextCarZ + carFwdZ * drivingCar.bumperFront;
      const rearX = nextCarX - carFwdX * drivingCar.bumperRear;
      const rearZ = nextCarZ - carFwdZ * drivingCar.bumperRear;

      let hitOtherCar = false;
      for (const other of parkingCars) {
        if (other === drivingCar) continue;
        const d = Math.hypot(nextCarX - other.group.position.x, nextCarZ - other.group.position.z);
        if (d < (drivingCar.collisionRadius + other.collisionRadius) * 0.5) { hitOtherCar = true; break; }
      }

      const hitSolids = collides(frontX, frontZ, 0) || collides(rearX, rearZ, 0) || collides(nextCarX, nextCarZ, 0);

      if (hitSolids || hitOtherCar) {
        drivingCar.speed = -drivingCar.speed * 0.3;
      } else {
        drivingCar.group.position.x = nextCarX;
        drivingCar.group.position.z = nextCarZ;
      }

      // Wheel roll around axle
      const rollDelta = -(drivingCar.speed * dt) / drivingCar.tireRadius;
      for (const wm of drivingCar.wheelMeshes) {
        wm.parent!.rotation.z += rollDelta;
      }

      // Keep seated driver pose
      player.position.copy(drivingCar.driverSeatPos);
      player.rotation.y = Math.PI / 2;
      leftLegPivot.rotation.set(-Math.PI / 2, 0, 0);
      rightLegPivot.rotation.set(-Math.PI / 2, 0, 0);
      leftKneePivot.rotation.set(Math.PI / 2, 0, 0);
      rightKneePivot.rotation.set(Math.PI / 2, 0, 0);
      leftArmPivot.rotation.set(-0.75, 0, -0.15);
      rightArmPivot.rotation.set(-0.75, 0, 0.15);
      leftElbowPivot.rotation.set(-0.45, 0, 0);
      rightElbowPivot.rotation.set(-0.45, 0, 0);
      bodyGroup.position.y = rig.seatDrop ? rig.seatDrop(0.37 / 0.55) : 0;
      bodyGroup.rotation.x = 0;
      // Multiplayer: tell everyone where the car is (about 15 times a second)
      if (mp) {
        carSendTimer += dt;
        if (carSendTimer >= 0.066) {
          carSendTimer = 0;
          mp.emit("world:car:state", {
            id: drivingCar.id,
            x: drivingCar.group.position.x,
            z: drivingCar.group.position.z,
            rotY: drivingCar.group.rotation.y,
            speed: drivingCar.speed,
            steer: drivingCar.steerAngle,
          });
        }
      }
    } else if (seatedChair) {
      // Keep realistic seated pose on chair
      const seatBackOffset = 0.08;
      const seatedX = seatedChair.chairX - Math.sin(seatedChair.facingAngle) * seatBackOffset;
      const seatedZ = seatedChair.chairZ - Math.cos(seatedChair.facingAngle) * seatBackOffset;
      player.position.set(seatedX, 0, seatedZ);
      player.rotation.y = seatedChair.facingAngle;

      const buttDrop = rig.seatDrop ? rig.seatDrop(seatedChair.seatY) : (seatedChair.seatY + 0.01) - 0.68;
      const breathe = Math.sin(Date.now() * 0.0022) * 0.012; // subtle realistic breathing motion
      bodyGroup.position.y = buttDrop;
      bodyGroup.rotation.set(0, 0, 0);
      torsoGroup.rotation.set(0.06 + breathe, 0, 0);
      headGroup.rotation.set(-0.04 - breathe * 0.5, 0, 0);

      leftLegPivot.rotation.set(-1.52, 0, -0.06);
      rightLegPivot.rotation.set(-1.52, 0, 0.06);
      leftKneePivot.rotation.set(1.48, 0, 0);
      rightKneePivot.rotation.set(1.48, 0, 0);

      leftArmPivot.rotation.set(-0.48, 0.14, 0.18);
      rightArmPivot.rotation.set(-0.48, -0.14, -0.18);
      leftElbowPivot.rotation.set(-0.62, 0.12, 0);
      rightElbowPivot.rotation.set(-0.62, -0.12, 0);
    } else if (drinkTimer > 0) {
      // Drinking: lean in toward the spout while the water arcs
      drinkTimer -= dt;
      drinkElapsed += dt;
      moving = false;
      rig.setLocomotion?.(0);
      const lean = Math.min(1, drinkElapsed / 0.45) * Math.min(1, Math.max(0, drinkTimer) / 0.3);
      torsoGroup.rotation.set(0.62 * lean, 0, 0);
      headGroup.rotation.set(0.25 * lean, 0, 0);
      leftArmPivot.rotation.set(-0.5 * lean, 0, 0.2 * lean);
      rightArmPivot.rotation.set(-0.5 * lean, 0, -0.2 * lean);
      leftElbowPivot.rotation.set(-0.6 * lean, 0, 0);
      rightElbowPivot.rotation.set(-0.6 * lean, 0, 0);
      leftLegPivot.rotation.x *= 0.8;
      rightLegPivot.rotation.x *= 0.8;
      leftKneePivot.rotation.x *= 0.8;
      rightKneePivot.rotation.x *= 0.8;
      // droplets: from the spout out and down into the basin
      for (let i = 0; i < fountainDrops.length; i++) {
        const ph = (drinkElapsed * 1.6 + i / fountainDrops.length) % 1;
        const d = fountainDrops[i];
        d.visible = drinkElapsed > 0.2 && drinkTimer > 0.15;
        d.position.set(0.1 + 0.18 * ph, 1.12 + 0.2 * Math.sin(ph * Math.PI) * 0.9 - 0.12 * ph * ph, 0.0);
      }
      if (drinkTimer <= 0) stopDrinking();
    } else {
      // Normal walking simulation
      const sinA = Math.sin(camAngle);
      const cosA = Math.cos(camAngle);
      moveX = inForward * -sinA + inRight * cosA;
      moveZ = inForward * -cosA + inRight * -sinA;

      moving = inForward !== 0 || inRight !== 0;
      let bob = 0;
      if (moving) {
        const len = Math.hypot(moveX, moveZ);
        const speed = sprinting ? PLAYER_SPEED * SPRINT_MULTIPLIER : PLAYER_SPEED;
        const stepX = (moveX / len) * speed * dt;
        const stepZ = (moveZ / len) * speed * dt;

        const py = player.position.y;
        const prevX = player.position.x;
        const prevZ = player.position.z;
        const nextX = player.position.x + stepX;
        const nextZ = player.position.z + stepZ;
        if (!collides(nextX, player.position.z, py)) player.position.x = nextX;
        if (!collides(player.position.x, nextZ, py)) player.position.z = nextZ;
        // Report the real ground speed (0 when blocked by a wall) so the animation matches the movement
        rig.setLocomotion?.(Math.hypot(player.position.x - prevX, player.position.z - prevZ) / Math.max(dt, 1e-4));

        // Turn smoothly toward the direction of travel (shortest way round)
        const heading = Math.atan2(moveX, moveZ);
        let turn = heading - player.rotation.y;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        player.rotation.y += turn * (1 - Math.exp(-dt * 14));

        walkTime += dt * (sprinting ? 18 : 10);
        bob = Math.abs(Math.sin(walkTime)) * (sprinting ? 0.08 : 0.04);
        const legSwing = Math.sin(walkTime) * (sprinting ? 0.75 : 0.45);
        const armSwing = Math.sin(walkTime) * (sprinting ? 0.70 : 0.40);

        leftLegPivot.rotation.x = legSwing;
        rightLegPivot.rotation.x = -legSwing;
        leftKneePivot.rotation.x = Math.max(0, -legSwing * 0.40);
        rightKneePivot.rotation.x = Math.max(0, legSwing * 0.40);
        leftArmPivot.rotation.x = -armSwing;
        rightArmPivot.rotation.x = armSwing;
        leftArmPivot.rotation.z = 0.08;
        rightArmPivot.rotation.z = -0.08;
        leftElbowPivot.rotation.x = Math.max(0, -armSwing * 0.25);
        rightElbowPivot.rotation.x = Math.max(0, armSwing * 0.25);
      } else {
        leftLegPivot.rotation.x *= 0.8;
        rightLegPivot.rotation.x *= 0.8;
        leftKneePivot.rotation.x *= 0.8;
        rightKneePivot.rotation.x *= 0.8;
        leftArmPivot.rotation.x *= 0.8;
        rightArmPivot.rotation.x *= 0.8;
        leftElbowPivot.rotation.x *= 0.8;
        rightElbowPivot.rotation.x *= 0.8;
        leftArmPivot.rotation.z *= 0.8;
        rightArmPivot.rotation.z *= 0.8;
      }

      // (Basketball arm poses are solved by the avatar from hand targets, see the basketball block below)

      if (!moving) rig.setLocomotion?.(0);

      const targetY = targetFloorY(player.position.x, player.position.z);
      player.position.y += (targetY - player.position.y) * Math.min(1, dt * 12);
      if (elevator.riding) player.position.y = elevator.cabY; // ride exactly with the cab
      bodyGroup.position.y = 0; // the walk/run clips carry their own bounce
      void bob;
    }
    rig.syncSkeleton?.();
    presence?.update(dt, {
      zone: inMprRoom ? "mpr" : currentClassroom ? currentClassroom.id : "campus",
      // while driving, the player's own position is relative to the car: share the car's place in the world
      x: drivingCar ? drivingCar.group.position.x : player.position.x,
      y: drivingCar ? 0 : player.position.y,
      z: drivingCar ? drivingCar.group.position.z : player.position.z,
      rotY: player.rotation.y,
      seatY: seatedChair ? seatedChair.seatY : null,
      driving: drivingCar ? drivingCar.id : null,
      hidden: false,
    });
    // NPCs animate only where the player can see them
    for (let i = 0; i < npcList.length; i++) {
      const room = npcList[i].def.room;
      if (room === "mpr" ? inMprRoom : !inMprRoom && !currentClassroom) npcRigs[i].syncSkeleton?.();
    }

    // --- Vehicle gate: swing the leaves toward their open/closed target ----------
    for (const pivot of vehicleGateLeaves) {
      const target = (pivot.userData.dir as number) * (vehicleGateOpen ? VEHICLE_GATE_ANGLE : 0);
      pivot.rotation.y += (target - pivot.rotation.y) * Math.min(1, dt * 3);
      if (Math.abs(target - pivot.rotation.y) < 0.005) pivot.rotation.y = target;
    }
    syncVehicleGateSolids();

    // --- Gate: swing the panels toward their open/closed target ----------
    gatePanels.forEach((pivot, i) => {
      const target = (i % 2 === 0 ? 1 : -1) * (gateOpen ? GATE_OPEN_ANGLE : 0);
      pivot.rotation.y += (target - pivot.rotation.y) * Math.min(1, dt * 6);
    });

    // --- Gate interaction prompt (shown when standing close) -------------
    if (gateHint) {
      const nearGate =
        gateDistance(player.position.x, player.position.z) <= GATE_INTERACT_RANGE;
      const nearVehicleGate = !inMprRoom && !currentClassroom && !drivingCar && player.position.y < 1.5 && vehicleGateDistance(player.position.x, player.position.z) <= 3.5;
      const wanted = nearGate
        ? gateOpen
          ? "Press E to close the gate"
          : "Press E to open the gate"
        : nearVehicleGate
          ? vehicleGateOpen
            ? "Press E to close the vehicle gate"
            : "Press E to open the vehicle gate"
          : "";
      if (wanted !== gateHintShown) {
        gateHintShown = wanted;
        gateHint.style.display = wanted === "" ? "none" : "block";
        if (wanted !== "") gateHint.textContent = wanted;
      }
    }

    // --- MPR & Classroom Room entrance / exit prompt ---------------------
    if (mprHint) {
      let wanted = "";
      if (inMprRoom) {
        const distToWestExit = Math.hypot(player.position.x - MPR_EXIT_DOOR_X, player.position.z - MPR_EXIT_DOOR_Z);
        const distToEastExit = Math.hypot(player.position.x - MPR_EAST_EXIT_DOOR_X, player.position.z - MPR_EAST_EXIT_DOOR_Z);
        if (distToWestExit <= 2.6) {
          wanted = "Press E to exit to courtyard";
        } else if (distToEastExit <= 2.6) {
          wanted = "Press E to exit to parking lot";
        }
      } else if (currentClassroom) {
        const distToExit = Math.hypot(player.position.x - currentClassroom.exitDoorX, player.position.z - currentClassroom.exitDoorZ);
        if (distToExit <= 2.6) {
          wanted = "Press E to exit to campus";
        } else if (nearWhiteboard()) {
          wanted = "Press E to read the assignment 📋";
        }
      } else {
        const distToEnterEast = Math.hypot(player.position.x - MPR_CAMPUS_DOOR_X, player.position.z - MPR_CAMPUS_DOOR_Z);
        const distToEnterParking = Math.hypot(player.position.x - MPR_CAMPUS_PARKING_DOOR_X, player.position.z - MPR_CAMPUS_PARKING_DOOR_Z);
        if (distToEnterEast <= 2.8 || distToEnterParking <= 2.8) {
          wanted = "Press E to enter MPR";
        } else {
          // Check nearest classroom
          const pFloor = player.position.y > floor2 * 0.5 ? 1 : 0;
          for (const cId of allClassroomIds) {
            const inst = getClassroom(cId);
            if (!inst) continue;
            if (inst.campusDoor.floor === pFloor) {
              const d = Math.hypot(player.position.x - inst.campusDoor.x, player.position.z - inst.campusDoor.z);
              if (d <= 2.4) {
                wanted =
                  cId === "eld"
                    ? "Press E to speak with Mr. Van Diest at the ELD door 🚪"
                    : DOOR_TALK[cId]
                      ? DOOR_TALK[cId].hint
                      : roomById(cId)?.type !== "stamp"
                        ? `${inst.data.label}: closed 🔒`
                      : `Press E to enter ${inst.data.label}`;
                break;
              }
            }
          }
        }
      }
      if (wanted !== mprHintShown) {
        mprHintShown = wanted;
        mprHint.style.display = wanted === "" ? "none" : "block";
        if (wanted !== "") mprHint.textContent = wanted;
      }
    }

    // --- Soccer Ball Physics & Interaction --------------------------------
    // 1) Player / Car kick interaction
    if (drivingCar) {
      const cdx = ballPos.x - drivingCar.group.position.x;
      const cdz = ballPos.z - drivingCar.group.position.z;
      const cdist = Math.hypot(cdx, cdz);
      if (cdist < 2.6 && ballPos.y <= 1.5) {
        claimBall("soccer");
        const cnx = cdist > 0.0001 ? cdx / cdist : 1;
        const cnz = cdist > 0.0001 ? cdz / cdist : 0;
        const carFwdX = Math.cos(drivingCar.group.rotation.y);
        const carFwdZ = -Math.sin(drivingCar.group.rotation.y);
        const pushPower = Math.abs(drivingCar.speed) * 1.6 + 5.0;
        ballVel.x = (carFwdX * 0.7 + cnx * 0.3) * Math.sign(drivingCar.speed || 1) * pushPower;
        ballVel.z = (carFwdZ * 0.7 + cnz * 0.3) * Math.sign(drivingCar.speed || 1) * pushPower;
        ballVel.y = Math.max(ballVel.y, 1.8);
      }
    } else if (!seatedChair) {
      const bdx = ballPos.x - player.position.x;
      const bdz = ballPos.z - player.position.z;
      const distToPlayer = Math.hypot(bdx, bdz);
      const minBallDist = PLAYER_RADIUS + BALL_RADIUS;
      const playerNearGround = player.position.y <= ballPos.y + 0.6;

      if (distToPlayer < minBallDist && playerNearGround) {
        claimBall("soccer");
        const bnx = distToPlayer > 0.0001 ? bdx / distToPlayer : 0;
        const bnz = distToPlayer > 0.0001 ? bdz / distToPlayer : 1;
        const overlap = minBallDist - distToPlayer;

        ballPos.x += bnx * overlap;
        ballPos.z += bnz * overlap;

        const pLen = Math.hypot(moveX, moveZ);
        const moveNx = pLen > 0.001 ? moveX / pLen : 0;
        const moveNz = pLen > 0.001 ? moveZ / pLen : 0;

        const kickDirX = bnx * 0.65 + (moving ? moveNx * 0.55 : 0);
        const kickDirZ = bnz * 0.65 + (moving ? moveNz * 0.55 : 0);
        const kLen = Math.hypot(kickDirX, kickDirZ) || 1;
        const kNx = kickDirX / kLen;
        const kNz = kickDirZ / kLen;

        const kickPower = moving ? (keys.has("shift") ? 14.5 : 7.5) : 3.2;
        ballVel.x = kNx * kickPower;
        ballVel.z = kNz * kickPower;
        ballVel.y = moving ? (keys.has("shift") ? 3.6 : 1.4) : 0.4;
      }
    }

    soccerPhysics: {
    // Multiplayer: while someone else owns the ball, show their version instead of simulating
    if (mp && !ballSync.soccer.own) {
      const b = ballSync.soccer;
      if (b.hasState) {
        const prev = ballPos.clone();
        ballPos.lerp(b.target, 1 - Math.exp(-dt * 14));
        ballVel.copy(b.vel);
        const mdx = ballPos.x - prev.x;
        const mdz = ballPos.z - prev.z;
        const mdist = Math.hypot(mdx, mdz);
        if (mdist > 1e-4 && ballPos.y <= BALL_GROUND_Y + 0.1) {
          ballOrientation.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-mdz, 0, mdx).normalize(), mdist / BALL_RADIUS));
          ballMesh.quaternion.copy(ballOrientation);
        }
      }
      ballMesh.position.copy(ballPos);
      ballShadowMesh.position.set(ballPos.x, 0.043, ballPos.z);
      break soccerPhysics;
    }
    // 2) Flight & Gravity
    ballVel.y -= BALL_GRAVITY * dt;
    ballPos.x += ballVel.x * dt;
    ballPos.z += ballVel.z * dt;
    ballPos.y += ballVel.y * dt;

    // 3) Turf collision & bounce
    if (ballPos.y <= BALL_GROUND_Y) {
      ballPos.y = BALL_GROUND_Y;
      if (ballVel.y < -0.6) {
        ballVel.y = -ballVel.y * BALL_RESTITUTION;
      } else {
        ballVel.y = 0;
      }

      // Rolling turf deceleration
      const hSpeed = Math.hypot(ballVel.x, ballVel.z);
      if (hSpeed > 0) {
        const newSpeed = Math.max(0, hSpeed - BALL_FRICTION * dt);
        const factor = newSpeed / hSpeed;
        ballVel.x *= factor;
        ballVel.z *= factor;
      }
    }

    // Aerodynamic air drag
    ballVel.x *= Math.pow(0.996, dt * 60);
    ballVel.z *= Math.pow(0.996, dt * 60);

    // 4) Goal posts collision
    const goalPosts = [
      { x: field.center.x - 3.0, z: 12.0 },
      { x: field.center.x + 3.0, z: 12.0 },
      { x: field.center.x - 3.0, z: 40.0 },
      { x: field.center.x + 3.0, z: 40.0 },
    ];
    const POST_R = 0.14;
    for (const post of goalPosts) {
      const pdx = ballPos.x - post.x;
      const pdz = ballPos.z - post.z;
      const pdist = Math.hypot(pdx, pdz);
      const postMinDist = POST_R + BALL_RADIUS;
      if (pdist < postMinDist && ballPos.y < 2.5) {
        const pnx = pdist > 0.0001 ? pdx / pdist : 1;
        const pnz = pdist > 0.0001 ? pdz / pdist : 0;
        ballPos.x = post.x + pnx * postMinDist;
        ballPos.z = post.z + pnz * postMinDist;
        const dot = ballVel.x * pnx + ballVel.z * pnz;
        if (dot < 0) {
          ballVel.x = (ballVel.x - 2 * dot * pnx) * 0.75;
          ballVel.z = (ballVel.z - 2 * dot * pnz) * 0.75;
        }
      }
    }

    // 5) Goal net collision & scoring
    if (ballPos.x > 24.5 && ballPos.x < 30.5 && ballPos.y < 2.5) {
      if (ballPos.z < 12.0 && ballPos.z > 9.8) {
        if (ballPos.z <= 10.4 + BALL_RADIUS) {
          ballPos.z = 10.4 + BALL_RADIUS;
          ballVel.z = Math.abs(ballVel.z) * 0.25;
          ballVel.x *= 0.5;
        }
        triggerGoal("North Goal");
        mp?.emit("world:event", { type: "goal", text: "North Goal" });
      }
    }
    if (ballPos.x > 24.5 && ballPos.x < 30.5 && ballPos.y < 2.5) {
      if (ballPos.z > 40.0 && ballPos.z < 42.2) {
        if (ballPos.z >= 41.6 - BALL_RADIUS) {
          ballPos.z = 41.6 - BALL_RADIUS;
          ballVel.z = -Math.abs(ballVel.z) * 0.25;
          ballVel.x *= 0.5;
        }
        triggerGoal("South Goal");
        mp?.emit("world:event", { type: "goal", text: "South Goal" });
      }
    }

    // 6) Perimeter fence rebound
    if (ballPos.x <= -53.0 + BALL_RADIUS) { ballPos.x = -53.0 + BALL_RADIUS; ballVel.x = Math.abs(ballVel.x) * 0.6; }
    if (ballPos.x >= 54.5 - BALL_RADIUS) { ballPos.x = 54.5 - BALL_RADIUS; ballVel.x = -Math.abs(ballVel.x) * 0.6; }
    if (ballPos.z <= -22.5 + BALL_RADIUS) { ballPos.z = -22.5 + BALL_RADIUS; ballVel.z = Math.abs(ballVel.z) * 0.6; }
    if (ballPos.z >= 65.0 - BALL_RADIUS) { ballPos.z = 65.0 - BALL_RADIUS; ballVel.z = -Math.abs(ballVel.z) * 0.6; }

    // 7) Building solid obstacles rebound
    for (const s of buildingSolids) {
      if (ballPos.y >= s.yTop || ballPos.y + BALL_RADIUS <= s.yBase) continue;
      const hw = s.w / 2 + BALL_RADIUS;
      const hd = s.d / 2 + BALL_RADIUS;
      if (Math.abs(ballPos.x - s.x) < hw && Math.abs(ballPos.z - s.z) < hd) {
        const ox = hw - Math.abs(ballPos.x - s.x);
        const oz = hd - Math.abs(ballPos.z - s.z);
        if (ox < oz) {
          ballPos.x = s.x + Math.sign(ballPos.x - s.x) * hw;
          ballVel.x = -ballVel.x * 0.6;
        } else {
          ballPos.z = s.z + Math.sign(ballPos.z - s.z) * hd;
          ballVel.z = -ballVel.z * 0.6;
        }
      }
    }

    // 8) Visual Mesh & Rolling Angular Spin Update
    ballMesh.position.copy(ballPos);

    const ballHSpeed = Math.hypot(ballVel.x, ballVel.z);
    if (ballHSpeed > 0.05 && ballPos.y <= BALL_GROUND_Y + 0.1) {
      const rotAngle = (ballHSpeed * dt) / BALL_RADIUS;
      const rotAxis = new THREE.Vector3(-ballVel.z, 0, ballVel.x).normalize();
      const dq = new THREE.Quaternion().setFromAxisAngle(rotAxis, rotAngle);
      ballOrientation.premultiply(dq);
      ballMesh.quaternion.copy(ballOrientation);
    }

    // Dynamic contact shadow
    ballShadowMesh.position.set(ballPos.x, 0.043, ballPos.z);
    const hAbove = Math.max(0, ballPos.y - BALL_GROUND_Y);
    const shadowScale = Math.max(0.25, 1 - hAbove * 0.22);
    ballShadowMesh.scale.set(shadowScale, shadowScale, shadowScale);
    (ballShadowMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0.08, 0.45 - hAbove * 0.12);

    } // end soccerPhysics
    // Multiplayer: the owner shares the ball's position
    if (mp && ballSync.soccer.own) {
      const b = ballSync.soccer;
      b.lastSend += dt;
      const moving = Math.hypot(ballVel.x, ballVel.y, ballVel.z) > 0.05;
      if (b.lastSend >= (moving ? 0.066 : 0.5)) {
        b.lastSend = 0;
        mp.emit("world:ball:state", { ball: "soccer", x: ballPos.x, y: ballPos.y, z: ballPos.z, vx: ballVel.x, vy: ballVel.y, vz: ballVel.z, held: 0 });
      }
    }

    // Goal celebration timer & auto-reset
    if (goalCelebrationTimer > 0) {
      goalCelebrationTimer -= dt;
      if (goalCelebrationTimer <= 0) {
        goalBanner.style.transform = "translateX(-50%) scale(0)";
        goalBanner.style.opacity = "0";
        resetBall();
      }
    }

    // --- Basketball Interaction & Real-World Physics -------------------------
    if (bballShootAnimTimer > 0) {
      bballShootAnimTimer -= dt;
      // follow-through: both hands reach up and forward
      const fx = Math.sin(player.rotation.y);
      const fz = Math.cos(player.rotation.y);
      const sx = Math.cos(player.rotation.y);
      const sz = -Math.sin(player.rotation.y);
      const up = Math.min(1, (0.45 - bballShootAnimTimer) / 0.15);
      const hy = player.position.y + 1.3 + 0.95 * up;
      rig.setHands?.(
        new THREE.Vector3(player.position.x + fx * 0.45 + sx * 0.1, hy, player.position.z + fz * 0.45 + sz * 0.1),
        new THREE.Vector3(player.position.x + fx * 0.45 - sx * 0.1, hy, player.position.z + fz * 0.45 - sz * 0.1)
      );
    }

    const bballDistToPlayer = Math.hypot(bballPos.x - player.position.x, bballPos.z - player.position.z);
    const playerNearBballGround = player.position.y <= bballPos.y + 0.6;

    // 1) Pickup basketball when player walks over it
    if (!bballHeld && !drivingCar && !seatedChair && bballShootAnimTimer <= 0 && bballDistToPlayer < 0.85 && playerNearBballGround && !(mp && !ballSync.basket.own && ballSync.basket.held)) {
      claimBall("basket");
      bballHeld = true;
      bballVel.set(0, 0, 0);
      bballAngVel.set(0, 0, 0);
    }

    // 2) Held / Dribbling State
    if (mp && !ballSync.basket.own) {
      // someone else is playing with the ball: show their version
      const b = ballSync.basket;
      if (b.hasState) {
        const prev = bballPos.clone();
        bballPos.lerp(b.target, 1 - Math.exp(-dt * 14));
        bballVel.copy(b.vel);
        const mdx = bballPos.x - prev.x;
        const mdz = bballPos.z - prev.z;
        const mdist = Math.hypot(mdx, mdz);
        if (mdist > 1e-4 && bballPos.y <= BASKETBALL_GROUND_Y + 0.1) {
          bballOrientation.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-mdz, 0, mdx).normalize(), mdist / BASKETBALL_RADIUS));
          bballMesh.quaternion.copy(bballOrientation);
        }
      }
    } else if (bballHeld) {
      const facingX = Math.sin(player.rotation.y);
      const facingZ = Math.cos(player.rotation.y);
      const rightX = Math.cos(player.rotation.y);
      const rightZ = -Math.sin(player.rotation.y);

      if (moving) {
        // Dribble physics: bounces smoothly between hand and ground
        bballDribblePhase += dt * (sprinting ? 15 : 10);
        const bounceCycle = Math.abs(Math.sin(bballDribblePhase));
        const dribbleY = BASKETBALL_GROUND_Y + bounceCycle * 0.85;
        // dribbled with the character's right hand (the model's +x side is its left)
        bballPos.set(
          player.position.x + facingX * 0.38 - rightX * 0.3,
          dribbleY,
          player.position.z + facingZ * 0.38 - rightZ * 0.3
        );
        // the hand rides on top of the ball and pushes it down; it cannot follow below its natural reach
        const handY = Math.max(player.position.y + 0.6, bballPos.y + BASKETBALL_RADIUS + 0.04);
        rig.setHands?.(null, new THREE.Vector3(bballPos.x, handY, bballPos.z));
      } else {
        // Cradled in front of chest
        bballPos.set(
          player.position.x + facingX * 0.32,
          player.position.y + 0.82,
          player.position.z + facingZ * 0.32
        );
        // both hands on the sides of the ball
        const side = BASKETBALL_RADIUS + 0.02;
        rig.setHands?.(
          new THREE.Vector3(bballPos.x + rightX * side, bballPos.y, bballPos.z + rightZ * side),
          new THREE.Vector3(bballPos.x - rightX * side, bballPos.y, bballPos.z - rightZ * side)
        );
      }

      bballHint.textContent = "Press E or Click to shoot at hoop 🏀";
      bballHint.style.display = "block";
      bballHint.style.opacity = "1";
    } else {
      // 3) Free Flight / Ground Physics
      lastBballY = bballPos.y;

      // Gravity & air resistance
      bballVel.y -= BASKETBALL_GRAVITY * dt;
      bballVel.x *= Math.pow(0.998, dt * 60);
      bballVel.z *= Math.pow(0.998, dt * 60);

      bballPos.x += bballVel.x * dt;
      bballPos.y += bballVel.y * dt;
      bballPos.z += bballVel.z * dt;

      // Ball rotation & spin integration
      const spinSpeed = bballAngVel.length();
      if (spinSpeed > 0.05) {
        const spinAxis = bballAngVel.clone().normalize();
        const spinQ = new THREE.Quaternion().setFromAxisAngle(spinAxis, spinSpeed * dt);
        bballOrientation.premultiply(spinQ);
        bballMesh.quaternion.copy(bballOrientation);
        bballAngVel.multiplyScalar(Math.max(0, 1 - dt * 0.4));
      }

      // Ground collision & bouncing
      if (bballPos.y <= BASKETBALL_GROUND_Y) {
        bballPos.y = BASKETBALL_GROUND_Y;
        if (Math.abs(bballVel.y) > 0.45) {
          bballVel.y = -bballVel.y * BASKETBALL_RESTITUTION;
          bballVel.x *= 0.88;
          bballVel.z *= 0.88;
        } else {
          bballVel.y = 0;
        }

        // Rolling friction & rolling rotation
        const hSpeed = Math.hypot(bballVel.x, bballVel.z);
        if (hSpeed > 0.01) {
          const newSpeed = Math.max(0, hSpeed - 2.2 * dt);
          const factor = newSpeed / hSpeed;
          bballVel.x *= factor;
          bballVel.z *= factor;

          const rollAngle = (hSpeed * dt) / BASKETBALL_RADIUS;
          const rollAxis = new THREE.Vector3(-bballVel.z, 0, bballVel.x).normalize();
          const rollQ = new THREE.Quaternion().setFromAxisAngle(rollAxis, rollAngle);
          bballOrientation.premultiply(rollQ);
          bballMesh.quaternion.copy(bballOrientation);
        }
      }

      // Backboard & Rim Collisions
      for (const h of hoopTargets) {
        // Backboard collision (1.8m x 1.05m box at y: 2.75 to 3.85)
        if (bballPos.y >= 2.75 && bballPos.y <= 3.85) {
          if (h.dirX !== 0) {
            const bdx = Math.abs(bballPos.x - h.boardX);
            const bdz = Math.abs(bballPos.z - h.boardZ);
            if (bdx < BASKETBALL_RADIUS + 0.04 && bdz < 0.95) {
              bballVel.x = -bballVel.x * 0.70;
              bballPos.x = h.boardX + h.dirX * (BASKETBALL_RADIUS + 0.05);
            }
          } else if (h.dirZ !== 0) {
            const bdx = Math.abs(bballPos.x - h.boardX);
            const bdz = Math.abs(bballPos.z - h.boardZ);
            if (bdz < BASKETBALL_RADIUS + 0.04 && bdx < 0.95) {
              bballVel.z = -bballVel.z * 0.70;
              bballPos.z = h.boardZ + h.dirZ * (BASKETBALL_RADIUS + 0.05);
            }
          }
        }

        // Rim ring collision (torus radius 0.23m at y: 3.05m)
        if (Math.abs(bballPos.y - 3.05) <= BASKETBALL_RADIUS + 0.06) {
          const rdx = bballPos.x - h.rimX;
          const rdz = bballPos.z - h.rimZ;
          const rdist = Math.hypot(rdx, rdz);
          const rimR = 0.23;
          const distToSteel = Math.abs(rdist - rimR);
          if (distToSteel < BASKETBALL_RADIUS + 0.02) {
            const nx = rdx / (rdist || 1);
            const nz = rdz / (rdist || 1);
            const rimPtX = h.rimX + nx * rimR;
            const rimPtZ = h.rimZ + nz * rimR;

            const cdx = bballPos.x - rimPtX;
            const cdy = bballPos.y - 3.05;
            const cdz = bballPos.z - rimPtZ;
            const cLen = Math.hypot(cdx, cdy, cdz) || 1;
            const cnx = cdx / cLen;
            const cny = cdy / cLen;
            const cnz = cdz / cLen;

            const dot = bballVel.x * cnx + bballVel.y * cny + bballVel.z * cnz;
            if (dot < 0) {
              bballVel.x = (bballVel.x - 2 * dot * cnx) * 0.65;
              bballVel.y = (bballVel.y - 2 * dot * cny) * 0.65;
              bballVel.z = (bballVel.z - 2 * dot * cnz) * 0.65;
              bballPos.x = rimPtX + cnx * (BASKETBALL_RADIUS + 0.03);
              bballPos.y = 3.05 + cny * (BASKETBALL_RADIUS + 0.03);
              bballPos.z = rimPtZ + cnz * (BASKETBALL_RADIUS + 0.03);
            }
          }
        }

        // Basket scoring detection (ball passes downward through the rim circle)
        if (lastBballY >= 3.05 && bballPos.y < 3.05 && bballVel.y < 0) {
          const sDist = Math.hypot(bballPos.x - h.rimX, bballPos.z - h.rimZ);
          if (sDist < 0.18) {
            // SWISH!
            const isThreePointer = Math.hypot(player.position.x - h.rimX, player.position.z - h.rimZ) > 7.0;
            const bucketText = isThreePointer ? "🏀 THREE-POINTER! 🏀" : (sDist < 0.10 ? "🏀 SWISH! PERFECT BUCKET! 🏀" : "🏀 BUCKET! +2 PTS 🏀");
            triggerBucket(bucketText);
            mp?.emit("world:event", { type: "bucket", text: bucketText });
            // Net dampening
            bballVel.y *= 0.60;
            bballVel.x *= 0.35;
            bballVel.z *= 0.35;
          }
        }
      }

      // Perimeter boundaries clamp
      if (bballPos.x <= -53.0 + BASKETBALL_RADIUS) { bballPos.x = -53.0 + BASKETBALL_RADIUS; bballVel.x = Math.abs(bballVel.x) * 0.6; }
      if (bballPos.x >= 54.5 - BASKETBALL_RADIUS) { bballPos.x = 54.5 - BASKETBALL_RADIUS; bballVel.x = -Math.abs(bballVel.x) * 0.6; }
      if (bballPos.z <= -22.5 + BASKETBALL_RADIUS) { bballPos.z = -22.5 + BASKETBALL_RADIUS; bballVel.z = Math.abs(bballVel.z) * 0.6; }
      if (bballPos.z >= 65.0 - BASKETBALL_RADIUS) { bballPos.z = 65.0 - BASKETBALL_RADIUS; bballVel.z = -Math.abs(bballVel.z) * 0.6; }

      // Approach pickup hint
      if (!drivingCar && !seatedChair && bballDistToPlayer < 2.0 && bballDistToPlayer >= 0.85) {
        bballHint.textContent = "Walk over basketball to pick it up 🏀";
        bballHint.style.display = "block";
        bballHint.style.opacity = "1";
      } else {
        bballHint.style.opacity = "0";
        bballHint.style.display = "none";
      }
    }

    // Mesh & Dynamic Shadow update
    bballMesh.position.copy(bballPos);
    bballShadowMesh.position.set(bballPos.x, 0.033, bballPos.z);
    const bballHeightAbove = Math.max(0, bballPos.y - BASKETBALL_GROUND_Y);
    const bShadowScale = Math.max(0.2, 1 - bballHeightAbove * 0.25);
    bballShadowMesh.scale.set(bShadowScale, bShadowScale, bShadowScale);
    (bballShadowMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0.04, 0.45 - bballHeightAbove * 0.12);

    // Multiplayer: the owner shares the basketball (also while it is being held / dribbled)
    if (mp && ballSync.basket.own) {
      const b = ballSync.basket;
      b.lastSend += dt;
      const moving = bballHeld || Math.hypot(bballVel.x, bballVel.y, bballVel.z) > 0.05;
      if (b.lastSend >= (moving ? 0.066 : 0.5)) {
        b.lastSend = 0;
        mp.emit("world:ball:state", { ball: "basket", x: bballPos.x, y: bballPos.y, z: bballPos.z, vx: bballVel.x, vy: bballVel.y, vz: bballVel.z, held: bballHeld ? 1 : 0 });
      }
    }

    // Basket celebration banner timer
    if (basketCelebrationTimer > 0) {
      basketCelebrationTimer -= dt;
      if (basketCelebrationTimer <= 0) {
        basketBanner.style.transform = "translateX(-50%) scale(0)";
        basketBanner.style.opacity = "0";
      }
    }

    // --- Water Runoff Vent interaction & physics ---------------------------
    const distToPlate = Math.hypot(player.position.x - PLATE_X, player.position.z - PLATE_Z);
    const onPlate =
      Math.abs(player.position.x - PLATE_X) <= 0.65 &&
      Math.abs(player.position.z - PLATE_Z) <= 0.65 &&
      player.position.y <= 0.45;

    // Smooth spring depression animation (grate presses down into concrete collar)
    const targetPadY = onPlate ? 0.012 : 0.038;
    padMesh.position.y += (targetPadY - padMesh.position.y) * Math.min(1, dt * 14);

    if (onPlate && !plateIsPressed) {
      plateIsPressed = true; // only asks once per visit to the plate
      requestBallReset();
    } else if (!onPlate && plateIsPressed) {
      plateIsPressed = false;
    }

    // Ease down water runoff emissive pulse
    if (padTopMat.emissiveIntensity > 0) {
      padTopMat.emissiveIntensity = Math.max(0, padTopMat.emissiveIntensity - dt * 1.5);
    }

    // Shockwave expansion animation
    if (shockwaveOpacity > 0) {
      shockwaveScale += dt * 3.5;
      shockwaveOpacity = Math.max(0, shockwaveOpacity - dt * 1.8);
      shockwaveMesh.scale.set(shockwaveScale, shockwaveScale, 1);
      shockwaveMat.opacity = shockwaveOpacity;
    }

    // Reset banner timer
    if (resetBannerTimer > 0) {
      resetBannerTimer -= dt;
      if (resetBannerTimer <= 0) {
        resetBanner.style.transform = "translateX(-50%) scale(0)";
        resetBanner.style.opacity = "0";
      }
    }

    // --- Car Reset Button Plunger & Toast Animation -----------------------
    if (carResetPlungerTimer > 0) {
      carResetPlungerTimer -= dt;
      const progress = Math.max(0, carResetPlungerTimer / 0.35);
      carResetPlunger.position.x = -0.062 + 0.018 * progress;
    } else {
      carResetPlunger.position.x = -0.062;
    }
    if (carResetBtnMat.emissiveIntensity > 0.8) {
      carResetBtnMat.emissiveIntensity = Math.max(0.8, carResetBtnMat.emissiveIntensity - dt * 2.5);
    }
    if (carResetToastTimer > 0) {
      carResetToastTimer -= dt;
      if (carResetToastTimer <= 0) {
        carResetToast.style.transform = "translateX(-50%) scale(0)";
        carResetToast.style.opacity = "0";
      }
    }

    // Proximity hint prompt
    if (plateHint) {
      const showHint = distToPlate < 3.8 && !onPlate;
      if (showHint && plateHint.style.display !== "block") {
        plateHint.style.display = "block";
        requestAnimationFrame(() => {
          if (plateHint) plateHint.style.opacity = "1";
        });
      } else if (!showHint && plateHint.style.display !== "none") {
        plateHint.style.opacity = "0";
        setTimeout(() => {
          if (!showHint && plateHint) plateHint.style.display = "none";
        }, 250);
      }
    }

    // --- Action Hint HUD (Table seating, entering & driving cars, car reset button)
    const actionHint = document.getElementById("action-hint");
    let hintText = "";
    if (drivingCar) {
      const mph = Math.round(Math.abs(drivingCar.speed) * 2.237);
      const icon = drivingCar.type === "van" ? "🚐" : drivingCar.type === "electric" ? "⚡" : drivingCar.type === "suv" ? "🚙" : "🚗";
      hintText = `${icon} Driving ${drivingCar.name} (${mph} MPH) · W/S: Gas/Brake · A/D: Steer · Shift: Boost · E: Exit car`;
    } else if (seatedChair) {
      hintText = "Press E or WASD to stand up";
    } else {
      const distToCarResetBtn = Math.hypot(player.position.x - CAR_RESET_BTN_X, player.position.z - CAR_RESET_BTN_Z);
      let nearestChairDist = 999;
      for (const c of chairSlots) {
        if (c.bench && (player.position.y > 1.5 || presence?.seatTaken(c.chairX - Math.sin(c.facingAngle) * 0.08, c.chairZ - Math.cos(c.facingAngle) * 0.08))) continue;
        const d = Math.hypot(player.position.x - c.chairX, player.position.z - c.chairZ);
        if (d < nearestChairDist) nearestChairDist = d;
      }
      let nearestCarDist = 999;
      let nearestCar: DrivableCar | null = null;
      for (const car of parkingCars) {
        if (car.driver && car.driver !== mp?.id) continue; // taken
        const d = Math.hypot(player.position.x - car.group.position.x, player.position.z - car.group.position.z);
        if (d < nearestCarDist) {
          nearestCarDist = d;
          nearestCar = car;
        }
      }
      const hintNpc = nearbyNpc();
      const hintElev = !inMprRoom && !currentClassroom ? elevator.hint(player.position.x, player.position.y, player.position.z) : "";
      if (hintNpc) {
        hintText = `Press E to talk to ${hintNpc.def.profile.name} 💬`;
      } else if (hintElev) {
        hintText = hintElev;
      } else if (distToCarResetBtn <= 2.2) {
        hintText = "Press E or Click to reset cars 🚗";
      } else if (nearFountain()) {
        hintText = "Press E to take a drink 💧";
      } else if (nearestChairDist <= 1.8) {
        hintText = "Press E to take a seat 🪑";
      } else if (nearestCarDist <= 3.8 && nearestCar) {
        if (nearestCar.type === "van") {
          hintText = "Press E to drive Ford Van 🚐";
        } else if (nearestCar.type === "electric") {
          hintText = "Press E to drive Electric Car ⚡";
        } else if (nearestCar.type === "suv") {
          hintText = "Press E to drive SUV 🚙";
        } else if (nearestCar.type === "compact") {
          hintText = "Press E to drive Compact Car 🚗";
        } else {
          hintText = "Press E to drive Sedan 🚗";
        }
      }
    }
    if (actionHint) {
      if (hintText) {
        if (actionHint.textContent !== hintText) actionHint.textContent = hintText;
        if (actionHint.style.display !== "block") {
          actionHint.style.display = "block";
          requestAnimationFrame(() => { if (actionHint) actionHint.style.opacity = "1"; });
        }
      } else if (actionHint.style.display !== "none") {
        actionHint.style.opacity = "0";
        setTimeout(() => { if (!hintText && actionHint) actionHint.style.display = "none"; }, 150);
      }
    }

    // --- Camera: locked to player / vehicle, orbiting at camAngle ---------
    const focusX = drivingCar ? drivingCar.group.position.x : player.position.x;
    const focusY = drivingCar ? drivingCar.group.position.y : player.position.y;
    const focusZ = drivingCar ? drivingCar.group.position.z : player.position.z;
    // Something else assigned the distance/elevation (reset, entering a room, compass click):
    // adopt it as the new default instead of fighting it.
    if (camDistance !== seenDist || camElevation !== seenElev) {
      zoomGoal = camDistance;
      refDist = camDistance;
      basePitch = Math.atan2(camElevation, camDistance);
      pitchBias = 0;
    }
    // Ease toward the zoom goal (frame-rate independent), then derive the viewing angle from it
    const maxZoom = inMprRoom ? 18.0 : (currentClassroom ? 15.0 : MAX_ZOOM);
    zoomGoal = Math.min(maxZoom, Math.max(MIN_ZOOM, zoomGoal));
    camDistance += (zoomGoal - camDistance) * (1 - Math.exp(-dt * 10));
    const zoomPitch = Math.max(-0.32, Math.min(0.5, Math.log(camDistance / refDist) * 0.2));
    const pitch = Math.max(0.2, Math.min(1.35, basePitch + zoomPitch + pitchBias));
    camElevation = camDistance * Math.tan(pitch);
    seenDist = camDistance;
    seenElev = camElevation;
    const camX = focusX + Math.sin(camAngle) * camDistance;
    const camZ = focusZ + Math.cos(camAngle) * camDistance;
    // Near the elevator the school walls often sit between the camera and the character. Pull the camera in
    // along its line of sight until it is in front of any wall (eased, so it never snaps).
    let occTarget = 1;
    if (!drivingCar && Math.hypot(focusX - elevator.cx, focusZ - elevator.cz) < 12) {
      const fy = focusY + 1.2;
      occTarget = cameraClearance(focusX, fy, focusZ, camX, focusY + camElevation, camZ);
    }
    camOcc += (occTarget - camOcc) * Math.min(1, dt * (occTarget < camOcc ? 14 : 4));
    camera.position.set(
      focusX + (camX - focusX) * camOcc,
      focusY + 1.2 + (focusY + camElevation - (focusY + 1.2)) * camOcc,
      focusZ + (camZ - focusZ) * camOcc
    );
    if (currentClassroom) {
      updateCutaway(getCutaway(currentClassroom.group, currentClassroom.worldX, currentClassroom.worldZ, currentClassroom.size, currentClassroom.height), camX, camera.position.y, camZ, dt);
    } else if (inMprRoom) {
      updateCutaway(getCutaway(mprRoomGroup, MPR_ROOM_X, MPR_ROOM_Z, MPR_ROOM_SIZE, MPR_ROOM_HEIGHT), camX, camera.position.y, camZ, dt);
    }
    // Aim at the character's chest when close, the feet-to-head middle when far
    const aimY = drivingCar ? 0.9 : 1.1 + 0.4 * Math.min(1, camDistance / 14);
    camera.lookAt(focusX, focusY + aimY, focusZ);

    // Rotate the compass needle so "N" always points toward north (the buses) on screen.
    if (compassNeedle) {
      const needleRot = camAngle - NORTH_UP_ANGLE;
      compassNeedle.style.transform = `rotate(${needleRot}rad)`;
    }

    renderer.render(scene, camera);
  });


  // --- Room cutaway: walls between the camera and the player fade out -------
  // The classrooms and the MPR are open-top rooms viewed from an orbiting camera. When the camera swings
  // outside a wall, that wall (and the thin things mounted on it) fades away so the room stays visible.
  interface CutawayItem { obj: THREE.Object3D; meshes: THREE.Mesh[]; side: number }
  interface CutawayRoom { cx: number; cz: number; half: number; height: number; items: CutawayItem[]; fade: number[] }
  const cutawayRooms = new Map<THREE.Object3D, CutawayRoom>();
  function getCutaway(group: THREE.Object3D, cx: number, cz: number, size: number, height: number): CutawayRoom {
    let room = cutawayRooms.get(group);
    if (room) return room;
    const half = size / 2;
    room = { cx, cz, half, height, items: [], fade: [1, 1, 1, 1, 1] };
    group.updateMatrixWorld(true);
    for (const child of group.children) {
      const box = new THREE.Box3().setFromObject(child);
      if (box.isEmpty()) continue;
      const sz = box.getSize(new THREE.Vector3());
      const c = box.getCenter(new THREE.Vector3());
      // sides: 0 west (x-), 1 east (x+), 2 north (z-), 3 south (z+), 4 ceiling fixtures
      let side = -1;
      if (sz.y <= 0.3 && c.y > height - 0.5) side = 4;
      else
      if (sz.x <= 0.3 && sz.z > 0.8) {
        if (Math.abs(c.x - (cx - half)) <= 0.25) side = 0;
        else if (Math.abs(c.x - (cx + half)) <= 0.25) side = 1;
      } else if (sz.z <= 0.3 && sz.x > 0.8) {
        if (Math.abs(c.z - (cz - half)) <= 0.25) side = 2;
        else if (Math.abs(c.z - (cz + half)) <= 0.25) side = 3;
      }
      if (side < 0) continue;
      const meshes: THREE.Mesh[] = [];
      child.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        // private materials, so fading one wall never affects another object that shares the material
        m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone();
        meshes.push(m);
      });
      room.items.push({ obj: child, meshes, side });
    }
    cutawayRooms.set(group, room);
    return room;
  }
  function updateCutaway(room: CutawayRoom, camX: number, camY: number, camZ: number, dt: number): void {
    const { cx, cz, half } = room;
    const outside = [camX < cx - half + 0.3, camX > cx + half - 0.3, camZ < cz - half + 0.3, camZ > cz + half - 0.3, camY > room.height - 0.2];
    for (let i = 0; i < 5; i++) {
      room.fade[i] += ((outside[i] ? 0 : 1) - room.fade[i]) * Math.min(1, dt * 9);
      if (room.fade[i] > 0.995) room.fade[i] = 1;
      if (room.fade[i] < 0.02) room.fade[i] = 0;
    }
    for (const item of room.items) {
      const f = room.fade[item.side];
      item.obj.visible = f > 0;
      for (const m of item.meshes) {
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
          const wasT = mat.transparent;
          mat.opacity = f;
          mat.transparent = f < 1;
          mat.depthWrite = f >= 0.5;
          if (wasT !== mat.transparent) mat.needsUpdate = true;
        }
      }
    }
  }

  (window as any).__debug = {
    setPlayer: (x: number, z: number) => { player.position.x = x; player.position.z = z; },
    setCamera: (angle: number, elev: number, dist: number) => { camAngle = angle; camElevation = elev; camDistance = dist; },
  };

  function stop(): void {
    renderer.setAnimationLoop(null);
    window.removeEventListener("resize", resize);
    window.removeEventListener("eld-objective-complete", onObjectiveComplete);
    presence?.dispose();
    if (mp) for (const [ev, fn] of mpHandlers) mp.off(ev, fn);
    if (renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement);
    }
  }

  function getPlayerTransform(): { x: number; y: number; z: number; rotY: number } {
    return {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      rotY: player.rotation.y,
    };
  }

  return {
    stop,
    getPlayerTransform,
  };
}