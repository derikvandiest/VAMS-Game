import * as THREE from "three";
import layout from "../../content/layout.json";

/**
 * Milestone 2 — single-player prototype (PROJECT.md section 14, milestone 2).
 *
 * Builds the placeholder campus from content/layout.json (two buildings forming
 * an L around a rectangular grass field, plus a parking lot with parked cars),
 * draws a low-poly player, and lets the player walk with WASD / arrow keys.
 *
 * The camera is LOCKED to the player: it always orbits around the character at a
 * fixed distance. Right-click + drag rotates the view (and adjusts elevation).
 * A compass button in the UI snaps the camera back to north-up. Walls (from the
 * layout) are solid: the player cannot walk through them.
 *
 * This scene is LOCAL ONLY for now — other players appear in Milestone 3.
 */

type LayoutWall = { x: number; z: number; w: number; d: number };
type LayoutDoor = { id: string; x: number; z: number; axis: string };
type LayoutCar = { x: number; z: number; rot: number; color: string };
type CampusLayout = typeof import("../../content/layout.json");

const PLAYER_SPEED = 3.5; // world units / second (matches settings.walkingSpeed)
const PLAYER_RADIUS = 0.5;

// --- Camera orbit settings -------------------------------------------------
// The camera sits at a fixed distance/height from the player and always looks
// at them. `camAngle` is the orbit angle in radians measured so that angle 0
// points the camera due SOUTH of the player looking NORTH (north-up on screen).
const CAM_DISTANCE = 30; // horizontal distance from player to camera
const CAM_HEIGHT = 26; // camera height above the ground
const DEFAULT_CAM_ANGLE = Math.PI / 4; // classic 45° isometric feel
const NORTH_UP_ANGLE = 0; // camera due south, looking north (north is up)
const MIN_ELEVATION = 12; // closest to top-down when dragging down
const MAX_ELEVATION = 40; // furthest from top-down when dragging up

export function startPlaceholderScene(container: HTMLElement): void {
  const layoutData = layout as CampusLayout;
  const walls: LayoutWall[] = layoutData.walls;
  const doors: LayoutDoor[] = layoutData.doors;
  const cars: LayoutCar[] = layoutData.cars;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9ec7e8); // soft sky
  scene.fog = new THREE.Fog(0x9ec7e8, 60, 130);

  // --- Renderer (pixel ratio capped at 2 for Retina displays — spec section 3)
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // --- Lighting: bright "day" look (dark mode arrives in Milestone 5) ------
  const hemisphere = new THREE.HemisphereLight(0xffffff, 0x6b7a5e, 0.9);
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight(0xfff4e0, 1.4);
  sun.position.set(18, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const shadowCam = sun.shadow.camera;
  shadowCam.left = -34;
  shadowCam.right = 34;
  shadowCam.top = 34;
  shadowCam.bottom = -34;
  shadowCam.updateProjectionMatrix();
  scene.add(sun);

  // --- Ground: one big lawn under the whole campus ------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: 0x7fae6b, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // --- Field: a distinct rectangular grass area in the middle ----------------
  // Drawn slightly different green with a thin white border so it clearly
  // reads as "the field" between the two buildings.
  const field = layoutData.field;
  const fieldMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(field.width, field.depth),
    new THREE.MeshStandardMaterial({ color: 0x69a04f, roughness: 1 })
  );
  fieldMesh.rotation.x = -Math.PI / 2;
  fieldMesh.position.set(field.center.x, 0.03, field.center.z);
  fieldMesh.receiveShadow = true;
  scene.add(fieldMesh);

  // Thin white border around the field (four thin boxes just above the grass).
  const borderMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  const borderThickness = 0.25;
  const borderHeight = 0.06;
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
    edge.position.set(bx, borderHeight / 2, bz);
    scene.add(edge);
  }

  // --- Walkable paths: parking lot + a short path to the field -------------
  const pathMaterial = new THREE.MeshStandardMaterial({ color: 0xd9c9a3, roughness: 1 });
  const paths: Array<[number, number, number, number]> = [
    [layoutData.parkingLot.center.x, layoutData.parkingLot.center.z, layoutData.parkingLot.width, layoutData.parkingLot.depth],
    [0, -12.5, 5, 5], // parking → field (short connector, just south of the lot)
  ];
  for (const [x, z, w, d] of paths) {
    const path = new THREE.Mesh(new THREE.PlaneGeometry(w, d), pathMaterial);
    path.rotation.x = -Math.PI / 2;
    path.position.set(x, 0.02, z);
    path.receiveShadow = true;
    scene.add(path);
  }

  // --- Walls: solid blocks used for both rendering and collision ----------
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xe8e0d2, roughness: 0.9 });
  const wallHeight = layoutData.boundary.wallHeight;
  for (const wall of walls) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(wall.w, wallHeight, wall.d), wallMaterial);
    mesh.position.set(wall.x, wallHeight / 2, wall.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // --- Doors: wooden frames on the field-facing walls ---------------------
  // axis "z" → the door sits on an east/west-facing wall, so the frame is
  //            narrow in x and wide in z (opening runs north-south).
  // axis "x" → the door sits on a north/south-facing wall, so the frame is
  //            wide in x and narrow in z (opening runs east-west).
  const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4f3a, roughness: 0.8 });
  for (const door of doors) {
    const [fw, fd] = door.axis === "z" ? [0.4, 2] : [2, 0.4];
    const frame = new THREE.Mesh(new THREE.BoxGeometry(fw, 3, fd), doorMaterial);
    frame.position.set(door.x, 1.5, door.z);
    frame.castShadow = true;
    scene.add(frame);
  }

  // --- Parked cars (decorative — no collision, so the lot stays walkable) -
  // A tiny reusable low-poly car: body + cabin. (The arriving/departing car
  // animation in Milestone 11 will reuse this shape.)
  function makeCar(colorHex: string): THREE.Group {
    const car = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.6, 3.8),
      new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5, metalness: 0.2 })
    );
    body.position.y = 0.6;
    body.castShadow = true;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.55, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.4 })
    );
    cabin.position.set(0, 1.15, -0.2);
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
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 220);
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
  // The camera NEVER leaves the player — it stays locked to them.
  let orbiting = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  const canvas = renderer.domElement;
  // Suppress the browser's right-click menu so dragging feels natural.
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 2) {
      // right button starts an orbit
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

    // Horizontal drag → orbit around the player.
    camAngle -= dx * 0.005;
    // Vertical drag → raise/lower the camera (clamped).
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
  // If the tab loses focus, drop all held keys so the player doesn't "stick".
  window.addEventListener("blur", () => keys.clear());

  // --- Collision: circle (player) vs axis-aligned boxes (walls) -----------
  // Returns true if a circle at (px,pz) with PLAYER_RADIUS overlaps any wall.
  function collides(px: number, pz: number): boolean {
    for (const wall of walls) {
      const halfW = wall.w / 2;
      const halfD = wall.d / 2;
      // Closest point on the box to the circle center:
      const nearestX = Math.max(wall.x - halfW, Math.min(px, wall.x + halfW));
      const nearestZ = Math.max(wall.z - halfD, Math.min(pz, wall.z + halfD));
      const dx = px - nearestX;
      const dz = pz - nearestZ;
      if (dx * dx + dz * dz < PLAYER_RADIUS * PLAYER_RADIUS) return true;
    }
    return false;
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
      // Normalize so diagonal movement isn't faster.
      const len = Math.hypot(moveX, moveZ);
      const stepX = (moveX / len) * PLAYER_SPEED * dt;
      const stepZ = (moveZ / len) * PLAYER_SPEED * dt;

      // Try the full move; if it hits a wall, slide along each axis instead.
      const nextX = player.position.x + stepX;
      const nextZ = player.position.z + stepZ;
      if (!collides(nextX, player.position.z)) player.position.x = nextX;
      if (!collides(player.position.x, nextZ)) player.position.z = nextZ;

      // Face the direction of travel.
      player.rotation.y = Math.atan2(moveX, moveZ);

      // Simple walk cycle: legs swing side to side.
      walkTime += dt * 10;
      const swing = Math.sin(walkTime) * 0.5;
      leftLeg.rotation.x = swing;
      rightLeg.rotation.x = -swing;
      // A little up/down bob so the walk reads clearly.
      player.position.y = Math.abs(Math.sin(walkTime)) * 0.08;
    } else {
      // Ease legs back to standing when idle.
      leftLeg.rotation.x *= 0.8;
      rightLeg.rotation.x *= 0.8;
      player.position.y *= 0.8;
    }

    // --- Camera: locked to the player, orbiting at camAngle ---------------
    // At camAngle = 0 the camera is due SOUTH (+z) of the player looking
    // NORTH (-z), so north is up on screen. Positive camAngle rotates the
    // view clockwise (as seen from above).
    const camX = player.position.x + Math.sin(camAngle) * CAM_DISTANCE;
    const camZ = player.position.z + Math.cos(camAngle) * CAM_DISTANCE;
    camera.position.set(camX, camElevation, camZ);
    camera.lookAt(player.position.x, 1, player.position.z);

    // Rotate the compass needle so "N" always points north on screen.
    if (compassNeedle) {
      compassNeedle.style.transform = `rotate(${camAngle}rad)`;
    }

    renderer.render(scene, camera);
  });
}
