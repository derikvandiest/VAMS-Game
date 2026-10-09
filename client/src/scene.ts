import * as THREE from "three";
import layout from "../../content/layout.json";

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

type LayoutWall = { x: number; z: number; w: number; d: number };
type LayoutDoor = { id: string; x: number; z: number; axis: string; floor: number };
type LayoutCar = { x: number; z: number; rot: number; color: string };
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
type CampusLayout = typeof import("../../content/layout.json");

const PLAYER_SPEED = 3.5; // world units / second (matches settings.walkingSpeed)
const PLAYER_RADIUS = 0.5;
const PLAYER_HEIGHT = 2.4; // used for height-aware collision

// --- Camera orbit settings -------------------------------------------------
// The camera sits at a fixed distance/height from the player and always looks
// at them. `camAngle` is the orbit angle in radians measured so that angle 0
// points the camera due SOUTH of the player looking NORTH (north-up on screen).
const CAM_DISTANCE = 30; // horizontal distance from player to camera
const CAM_HEIGHT = 26; // camera height above the ground
const DEFAULT_CAM_ANGLE = Math.PI / 4; // classic 45-degree isometric feel
const NORTH_UP_ANGLE = 0; // camera due south, looking north (north is up)
const MIN_ELEVATION = 12; // closest to top-down when dragging down
const MAX_ELEVATION = 40; // furthest from top-down when dragging up

export function startPlaceholderScene(container: HTMLElement): void {
  const layoutData = layout as CampusLayout;
  const walls: LayoutWall[] = layoutData.walls;
  const doors: LayoutDoor[] = layoutData.doors;
  const cars: LayoutCar[] = layoutData.cars;
  const stairs: LayoutStair[] = layoutData.stairs;
  const roofY = layoutData.boundary.wallHeight; // ground-story height (6)
  const floor2 = roofY + 0.1; // walkable second-floor surface height

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9ec7e8); // soft sky
  scene.fog = new THREE.Fog(0x9ec7e8, 70, 150);

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
  sun.shadow.mapSize.set(1024, 1024);
  const shadowCam = sun.shadow.camera;
  shadowCam.left = -36;
  shadowCam.right = 36;
  shadowCam.top = 36;
  shadowCam.bottom = -36;
  shadowCam.updateProjectionMatrix();
  scene.add(sun);

  // =========================================================================
  // GROUND - three stacked layers (asphalt outside, pavement inside, grass
  // field in the middle). Each sits a hair above the last to avoid z-fighting.
  // =========================================================================

  // 1) Asphalt: the base surface for the whole campus (everything outside).
  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 140),
    new THREE.MeshStandardMaterial({ color: 0x555a60, roughness: 1 })
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.receiveShadow = true;
  scene.add(asphalt);

  // 2) Pavement: the inner courtyard between the two buildings ("inside").
  const pavement = layoutData.pavement;
  const pavementMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(pavement.width, pavement.depth),
    new THREE.MeshStandardMaterial({ color: 0xcfc6b4, roughness: 1 })
  );
  pavementMesh.rotation.x = -Math.PI / 2;
  pavementMesh.position.set(pavement.center.x, 0.02, pavement.center.z);
  pavementMesh.receiveShadow = true;
  scene.add(pavementMesh);

  // 3) Grass field: a distinct rectangle in the very middle, with a thin
  //    white border so it clearly reads as "the field".
  const field = layoutData.field;
  const fieldMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(field.width, field.depth),
    new THREE.MeshStandardMaterial({ color: 0x69a04f, roughness: 1 })
  );
  fieldMesh.rotation.x = -Math.PI / 2;
  fieldMesh.position.set(field.center.x, 0.04, field.center.z);
  fieldMesh.receiveShadow = true;
  scene.add(fieldMesh);

  const borderMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  const borderThickness = 0.25;
  const borderHeight = 0.08;
  const halfW = field.width / 2;
  const halfD = field.depth / 2;
  const borderEdges: Array<[number, number, number, number]> = [
    [field.center.x, field.center.z - halfD, field.width, borderThickness], // north
    [field.center.x, field.center.z + halfD, field.width, borderThickness], // south
    [field.center.x - halfW, field.center.z, borderThickness, field.depth], // west
    [field.center.x + halfW, field.center.z, borderThickness, field.depth], // east
  ];
  for (const [bx, bz, bw, bd] of borderEdges) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(bw, borderHeight, bd), borderMaterial);
    edge.position.set(bx, 0.06, bz);
    scene.add(edge);
  }

  // =========================================================================
  // BUILDINGS - solid ground story (walls) + a walkable second-floor platform
  // ringed by second-story walls, plus an exterior staircase up to it.
  // =========================================================================
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xe8e0d2, roughness: 0.9 });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xb0b8c0, roughness: 0.95 });
  const stairMaterial = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 1 });
  const railingMaterial = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.8 });
  const railingHeight = layoutData.boundary.railingHeight; // second-story wall height (6)

  // Height-aware solid boxes (declared early: the second-story wall loop below
  // fills `railingSolids` as it builds the walls). See the COLLISION section.
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

  // Ground-level solid walls (collision happens below, via `collides`).
  for (const wall of walls) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(wall.w, roofY, wall.d), wallMaterial);
    mesh.position.set(wall.x, roofY / 2, wall.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // --- Roofs (second floor): a walkable platform inset within each building --
  // Track the roof footprints so the player can stand on them, so the
  // second-story walls know where to go, and so the walkway can be placed.
  type Roof = { minX: number; maxX: number; minZ: number; maxZ: number };
  const roofs: Roof[] = [];
  for (const wall of walls) {
    const inset = 0.4; // keep the walkable roof just inside the wall edge
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

  // --- Second-story walls: full-height walls around each roof so the player
  // can't walk off - EXCEPT a gap where the matching staircase lands. The gap
  // goes on whichever roof edge the stair is nearest (position-based, so it
  // works whether the stair is on the south or the east). These walls are
  // solid only up on the second floor (height-aware collision).
  for (const stair of stairs) {
    const wall = walls.find((w) => (stair.building === "west" ? w.w < w.d : w.d <= w.w));
    if (!wall) continue;
    const roof = roofs[walls.indexOf(wall)];
    const roofCX = (roof.minX + roof.maxX) / 2;
    const roofCZ = (roof.minZ + roof.maxZ) / 2;

    const t = 0.25; // wall thickness
    const gapHalf = stair.width / 2 + 0.5; // half-width of the stair gap
    const segs: Array<{ x: number; z: number; w: number; d: number }> = [];
    const add = (x: number, z: number, w: number, d: number) => segs.push({ x, z, w, d });

    if (stair.axis === "z") {
      // Stair climbs north-south, so it lands on the north or south edge (which
      // runs along x). The gap is centered on stair.center.x.
      const onSouth = stair.center.z > roofCZ;
      const edgeZ = onSouth ? roof.maxZ : roof.minZ;
      add((roof.minX + (stair.center.x - gapHalf)) / 2, edgeZ, stair.center.x - gapHalf - roof.minX, t);
      add(((stair.center.x + gapHalf) + roof.maxX) / 2, edgeZ, roof.maxX - (stair.center.x + gapHalf), t);
      const oppZ = onSouth ? roof.minZ : roof.maxZ;
      add(roofCX, oppZ, roof.maxX - roof.minX, t);
      add(roof.minX, roofCZ, t, roof.maxZ - roof.minZ);
      add(roof.maxX, roofCZ, t, roof.maxZ - roof.minZ);
    } else {
      // Stair climbs east-west, so it lands on the east or west edge (which
      // runs along z). The gap is centered on stair.center.z.
      const onEast = stair.center.x > roofCX;
      const edgeX = onEast ? roof.maxX : roof.minX;
      add(edgeX, (roof.minZ + (stair.center.z - gapHalf)) / 2, t, stair.center.z - gapHalf - roof.minZ);
      add(edgeX, ((stair.center.z + gapHalf) + roof.maxZ) / 2, t, roof.maxZ - (stair.center.z + gapHalf));
      const oppX = onEast ? roof.minX : roof.maxX;
      add(oppX, roofCZ, t, roof.maxZ - roof.minZ);
      add(roofCX, roof.minZ, roof.maxX - roof.minX, t);
      add(roofCX, roof.maxZ, roof.maxX - roof.minX, t);
    }

    for (const seg of segs) {
      if (seg.w <= 0 || seg.d <= 0) continue; // skip zero-length pieces
      const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(seg.w, railingHeight, seg.d), railingMaterial);
      wallMesh.position.set(seg.x, floor2 + railingHeight / 2, seg.z);
      wallMesh.castShadow = true;
      // Solid only up on the second floor (height-aware).
      railingSolids.push({ x: seg.x, z: seg.z, w: seg.w, d: seg.d, yBase: floor2, yTop: floor2 + railingHeight });
      scene.add(wallMesh);
    }
  }

  // --- Second-floor walkways: a marked corridor on each roof running from the
  // stair landing along the field-facing (door) wall to the upstairs classrooms.
  // Purely visual - the whole roof platform is already walkable; this just makes
  // the route to the 4 upstairs doors read clearly.
  const walkwayMaterial = new THREE.MeshStandardMaterial({ color: 0xd9c9a3, roughness: 1 });
  for (const wall of walls) {
    const roof = roofs[walls.indexOf(wall)];
    const upDoors = doors.filter(
      (d) => d.floor === 1 && (wall.w < wall.d ? d.axis === "z" : d.axis === "x")
    );
    if (upDoors.length === 0) continue;
    if (wall.w < wall.d) {
      // West building: doors on the east wall (run north-south). Walkway hugs
      // that wall, spanning the doors and reaching toward the stair (south).
      const zs = upDoors.map((d) => d.z);
      const zMin = Math.min(...zs) - 1;
      const zMax = Math.max(...zs) + 3;
      const ww = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, zMax - zMin), walkwayMaterial);
      ww.position.set(roof.maxX - 0.7, floor2 + 0.03, (zMin + zMax) / 2);
      ww.receiveShadow = true;
      scene.add(ww);
    } else {
      // North building: doors on the south wall (run east-west). Walkway hugs
      // that wall, spanning the doors and reaching toward the stair (east).
      const xs = upDoors.map((d) => d.x);
      const xMin = Math.min(...xs) - 1;
      const xMax = Math.max(...xs) + 6;
      const ww = new THREE.Mesh(new THREE.BoxGeometry(xMax - xMin, 0.06, 1.4), walkwayMaterial);
      ww.position.set((xMin + xMax) / 2, floor2 + 0.03, roof.maxZ - 0.7);
      ww.receiveShadow = true;
      scene.add(ww);
    }
  }

  // --- Exterior staircases: stepped boxes climbing from the ground to the
  // second floor. Purely visual (walking is handled by the stair-zone Y
  // interpolation in `targetFloorY`).
  const STEP_COUNT = 8;
  for (const stair of stairs) {
    const stepRise = floor2 / STEP_COUNT;
    const stepRun = stair.len / STEP_COUNT;
    for (let i = 0; i < STEP_COUNT; i++) {
      const h = stepRise * (i + 1);
      const crossOrRun = stair.axis === "z" ? stepRun : stair.width;
      const widthOrCross = stair.axis === "z" ? stair.width : stepRun;
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(widthOrCross, stepRise, crossOrRun),
        stairMaterial
      );
      // Position steps from bottom (ground) to top (second floor).
      const along = (i + 0.5) * stepRun * stair.dir;
      if (stair.axis === "z") {
        step.position.set(stair.center.x, h / 2, stair.bottom + along);
      } else {
        step.position.set(stair.bottom + along, h / 2, stair.center.z);
      }
      step.castShadow = true;
      step.receiveShadow = true;
      scene.add(step);
    }
  }

  // --- Doors: wooden frames on the field-facing walls ---------------------
  // axis "z" = door on an east/west-facing wall (frame narrow in x, wide in z).
  // axis "x" = door on a north/south-facing wall (frame wide in x, narrow in z).
  // floor 0 = ground (y~1.5); floor 1 = second floor (y~floor2+1.5). Second-floor
  // doors are shifted by the roof inset so they sit on the second-story wall.
  const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4f3a, roughness: 0.8 });
  const inset = 0.4;
  for (const door of doors) {
    const [fw, fd] = door.axis === "z" ? [0.4, 2] : [2, 0.4];
    let dx = door.x;
    let dz = door.z;
    let dy = 1.5;
    if (door.floor === 1) {
      dy = floor2 + 1.5;
      if (door.axis === "z") dx = door.x - inset;
      else dz = door.z - inset;
    }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(fw, 3, fd), doorMaterial);
    frame.position.set(dx, dy, dz);
    frame.castShadow = true;
    scene.add(frame);
  }

  // --- Parked cars (decorative - no collision, so the lot stays walkable) -
  // A tiny reusable low-poly car: body + cabin. (The arriving/departing car
  // animation in Milestone 11 will reuse this shape.)
  function makeCar(colorHex: string): THREE.Group {
    const car = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.6, 0.95),
      new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5, metalness: 0.2 })
    );
    body.position.y = 0.45;
    body.castShadow = true;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.5, 0.85),
      new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5, metalness: 0.2 })
    );
    cabin.position.set(-0.1, 0.95, 0);
    cabin.castShadow = true;
    car.add(body, cabin);
    return car;
  }
  for (const car of cars) {
    const mesh = makeCar(car.color);
    mesh.position.set(car.x, 0, car.z);
    mesh.rotation.y = car.rot;
    scene.add(mesh);
  }

  // --- Player character: a simple low-poly figure -------------------------
  // (Real character customization arrives in Milestone 4.)
  const player = new THREE.Group();

  const shirt = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.9, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x2f6fd0, roughness: 0.8 })
  );
  shirt.position.y = 1.15;
  shirt.castShadow = true;

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.6, 0.6),
    new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.8 })
  );
  head.position.y = 1.95;
  head.castShadow = true;

  const legGeometry = new THREE.BoxGeometry(0.32, 0.7, 0.32);
  const legMaterial = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.9 });
  const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
  leftLeg.position.set(-0.22, 0.35, 0);
  leftLeg.castShadow = true;
  const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
  rightLeg.position.set(0.22, 0.35, 0);
  rightLeg.castShadow = true;

  player.add(shirt, head, leftLeg, rightLeg);
  player.position.set(layoutData.spawn.x, 0, layoutData.spawn.z);
  scene.add(player);

  // --- Camera: orbits the player at a fixed distance ----------------------
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 260);
  let camAngle = DEFAULT_CAM_ANGLE; // orbit angle (radians)
  let camElevation = CAM_HEIGHT; // camera height (adjustable by dragging)

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
  if (compass) {
    compass.addEventListener("click", () => {
      camAngle = NORTH_UP_ANGLE;
      camElevation = CAM_HEIGHT;
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

  canvas.addEventListener("mousedown", (e) => {
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
    camElevation = Math.min(MAX_ELEVATION, Math.max(MIN_ELEVATION, camElevation + dy * 0.05));
  });

  window.addEventListener("mouseup", () => {
    orbiting = false;
  });

  // --- Input: WASD + arrow keys (spec section 5.4) ------------------------
  const keys = new Set<string>();
  const HANDLED_KEYS = new Set([
    "w", "a", "s", "d",
    "arrowup", "arrowdown", "arrowleft", "arrowright",
  ]);

  window.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    if (HANDLED_KEYS.has(key)) {
      keys.add(key);
      e.preventDefault(); // stop the page from scrolling
    }
  });
  window.addEventListener("keyup", (e) => {
    keys.delete(e.key.toLowerCase());
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
  function collides(px: number, pz: number, py: number): boolean {
    const playerTop = py + PLAYER_HEIGHT;
    const solids: Solid[] = buildingSolids.concat(railingSolids);
    for (const s of solids) {
      if (py >= s.yTop || playerTop <= s.yBase) continue; // no vertical overlap
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

  // Is the player over a roof footprint? (used to hold them at floor2)
  function onRoof(px: number, pz: number): boolean {
    for (const r of roofs) {
      if (px >= r.minX - 0.5 && px <= r.maxX + 0.5 && pz >= r.minZ - 0.5 && pz <= r.maxZ + 0.5) {
        return true;
      }
    }
    return false;
  }

  // Compute the target floor height at the player's (x,z). Inside a stair zone
  // the height interpolates from 0 (bottom) to floor2 (top). On a roof it is
  // floor2; otherwise 0 (the ground).
  function targetFloorY(px: number, pz: number): number {
    // If already up high and still over a roof, stay up (prevents snapping
    // down while walking across the middle of a roof).
    if (player.position.y > floor2 * 0.5 && onRoof(px, pz)) return floor2;

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

  // --- Animation loop ------------------------------------------------------
  const clock = new THREE.Clock();
  let walkTime = 0;

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1); // clamp to avoid huge jumps
    let moveX = 0;
    let moveZ = 0;
    if (keys.has("w") || keys.has("arrowup")) moveZ -= 1;
    if (keys.has("s") || keys.has("arrowdown")) moveZ += 1;
    if (keys.has("a") || keys.has("arrowleft")) moveX -= 1;
    if (keys.has("d") || keys.has("arrowright")) moveX += 1;

    const moving = moveX !== 0 || moveZ !== 0;
    if (moving) {
      const len = Math.hypot(moveX, moveZ);
      const stepX = (moveX / len) * PLAYER_SPEED * dt;
      const stepZ = (moveZ / len) * PLAYER_SPEED * dt;

      // Try the full move; if it hits a solid, slide along each axis instead.
      const py = player.position.y;
      const nextX = player.position.x + stepX;
      const nextZ = player.position.z + stepZ;
      if (!collides(nextX, player.position.z, py)) player.position.x = nextX;
      if (!collides(player.position.x, nextZ, py)) player.position.z = nextZ;

      player.rotation.y = Math.atan2(moveX, moveZ);

      // Simple walk cycle: legs swing side to side.
      walkTime += dt * 10;
      const swing = Math.sin(walkTime) * 0.5;
      leftLeg.rotation.x = swing;
      rightLeg.rotation.x = -swing;
    } else {
      leftLeg.rotation.x *= 0.8;
      rightLeg.rotation.x *= 0.8;
    }

    // --- Vertical position: ease toward the target floor height -----------
    const targetY = targetFloorY(player.position.x, player.position.z);
    player.position.y += (targetY - player.position.y) * Math.min(1, dt * 12);
    if (moving) {
      player.position.y += Math.abs(Math.sin(walkTime)) * 0.08; // walk bob
    }

    // --- Camera: locked to the player, orbiting at camAngle ---------------
    const camX = player.position.x + Math.sin(camAngle) * CAM_DISTANCE;
    const camZ = player.position.z + Math.cos(camAngle) * CAM_DISTANCE;
    camera.position.set(camX, player.position.y + camElevation, camZ);
    camera.lookAt(player.position.x, player.position.y + 1, player.position.z);

    // Rotate the compass needle so "N" always points north on screen.
    if (compassNeedle) {
      compassNeedle.style.transform = `rotate(${camAngle}rad)`;
    }

    renderer.render(scene, camera);
  });
}
