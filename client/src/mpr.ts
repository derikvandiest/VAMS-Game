import * as THREE from "three";

export type Solid = {
  x: number;
  z: number;
  w: number;
  d: number;
  yBase: number;
  yTop: number;
};

export type ChairSlot = {
  chairX: number;
  chairZ: number;
  seatY: number;
  tableX: number;
  tableZ: number;
  facingAngle: number;
};

export const MPR_ROOM_X = 400.0;
export const MPR_ROOM_Z = 400.0;
export const MPR_ROOM_SIZE = 24.0; // 24m x 24m square room
export const MPR_ROOM_HEIGHT = 5.2; // 5.2m ceiling height
/** Presenter podium in front of the projection screen (Mr. Van Diest stands just south of it) */
export const MPR_PODIUM_X = 400.0;
export const MPR_PODIUM_Z = 408.15;
export const MPR_SPAWN_X = 389.8; // just inside the west doors in North-West corner
export const MPR_SPAWN_Z = 390.0;
export const MPR_CAMPUS_DOOR_X = -13.2; // outdoor courtyard double doors location
export const MPR_CAMPUS_DOOR_Z = 51.5;
export const MPR_CAMPUS_PARKING_DOOR_X = -38.0; // outdoor parking lot double doors location
export const MPR_CAMPUS_PARKING_DOOR_Z = 43.0;
export const MPR_EXIT_DOOR_X = 388.2; // West doors inside MPR (to courtyard)
export const MPR_EXIT_DOOR_Z = 390.0;
export const MPR_EAST_EXIT_DOOR_X = 411.8; // East doors inside MPR (to parking lot)
export const MPR_EAST_EXIT_DOOR_Z = 400.0;
export const MPR_EAST_SPAWN_X = 410.2;
export const MPR_EAST_SPAWN_Z = 400.0;

export interface MprRoomBuildResult {
  group: THREE.Group;
  solids: Solid[];
  chairs: ChairSlot[];
}

export function buildMprRoom(): MprRoomBuildResult {
  const mprGroup = new THREE.Group();
  const solids: Solid[] = [];
  const chairs: ChairSlot[] = [];

  const halfSize = MPR_ROOM_SIZE / 2; // 12.0m
  const minX = MPR_ROOM_X - halfSize; // 388.0
  const maxX = MPR_ROOM_X + halfSize; // 412.0
  const minZ = MPR_ROOM_Z - halfSize; // 388.0
  const maxZ = MPR_ROOM_Z + halfSize; // 412.0

  // =========================================================================
  // 1) MATERIALS & TEXTURES
  // =========================================================================

  // Polished school floor tile (multi-tone cream/beige terrazzo with subtle reflection)
  function makeFloorTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#e2d9cc";
    ctx.fillRect(0, 0, 1024, 1024);

    const tileSize = 128;
    for (let x = 0; x < 1024; x += tileSize) {
      for (let y = 0; y < 1024; y += tileSize) {
        const shade = ((x / tileSize) + (y / tileSize)) % 2 === 0 ? "#ded5c7" : "#e6ded2";
        ctx.fillStyle = shade;
        ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);

        // subtle terrazzo specks
        for (let i = 0; i < 18; i++) {
          const rx = x + Math.random() * tileSize;
          const ry = y + Math.random() * tileSize;
          const speckColor = Math.random() > 0.5 ? "#b0a596" : "#f5ede2";
          ctx.fillStyle = speckColor;
          ctx.beginPath();
          ctx.arc(rx, ry, Math.random() * 2 + 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // Grout lines
    ctx.strokeStyle = "#c8beb0";
    ctx.lineWidth = 2;
    for (let i = 0; i <= 1024; i += tileSize) {
      ctx.beginPath();
      ctx.moveTo(i, 0); ctx.lineTo(i, 1024);
      ctx.moveTo(0, i); ctx.lineTo(1024, i);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    return tex;
  }

  const floorMat = new THREE.MeshStandardMaterial({
    map: makeFloorTexture(),
    roughness: 0.32,
    metalness: 0.08,
  });

  // Wall materials: lower acoustic wood paneling & upper clean school plaster
  const wallWoodMat = new THREE.MeshStandardMaterial({
    color: 0x8b5a2b, // warm oak wainscoting
    roughness: 0.6,
  });

  const wallUpperMat = new THREE.MeshStandardMaterial({
    color: 0xf4f1ea, // warm eggshell
    roughness: 0.85,
  });

  const wallUpperRedMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b, // School pride bold crimson red
    roughness: 0.80,
  });

  const baseboardMat = new THREE.MeshStandardMaterial({
    color: 0x3e2723, // dark walnut baseboard
    roughness: 0.5,
  });

  const chairRailMat = new THREE.MeshStandardMaterial({
    color: 0x5d4037, // molded chair rail
    roughness: 0.45,
  });

  // Presentation Screen High-Res Procedural Texture
  function makeProjectorScreenTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d")!;

    // Clean presentation slide background with soft diagonal gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 1920, 1080);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(0.4, "#1e293b");
    bgGrad.addColorStop(1, "#090d16");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1920, 1080);

    // Decorative top accent bar
    const barGrad = ctx.createLinearGradient(0, 0, 1920, 0);
    barGrad.addColorStop(0, "#c89b3c");
    barGrad.addColorStop(0.5, "#facc15");
    barGrad.addColorStop(1, "#c89b3c");
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 0, 1920, 16);

    // School Header Box
    ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
    ctx.fillRect(80, 50, 1760, 130);
    ctx.strokeStyle = "rgba(200, 155, 60, 0.4)";
    ctx.lineWidth = 3;
    ctx.strokeRect(80, 50, 1760, 130);

    // School Crest / Lion symbol badge
    ctx.fillStyle = "#c89b3c";
    ctx.beginPath();
    ctx.arc(150, 115, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "bold 44px Arial, sans-serif";
    ctx.fillStyle = "#0f172a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🦁", 150, 115);

    // School title text
    ctx.textAlign = "left";
    ctx.font = "bold 38px 'Segoe UI', Arial, sans-serif";
    ctx.fillStyle = "#c89b3c";
    ctx.fillText("VALOR ACADEMY MIDDLE SCHOOL", 220, 95);

    ctx.font = "600 24px 'Segoe UI', Arial, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("BRIGHT STAR SCHOOLS · PROFESSIONAL DEVELOPMENT", 220, 138);

    // Main Presentation Title
    ctx.font = "900 68px 'Segoe UI', Arial, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("ELD Professional Development Meeting", 80, 270);

    ctx.font = "500 32px 'Segoe UI', Arial, sans-serif";
    ctx.fillStyle = "#38bdf8";
    ctx.fillText("English Language Development & Cross-Curricular Support Strategies", 80, 330);

    // Subtle divider
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 370);
    ctx.lineTo(1840, 370);
    ctx.stroke();

    // Meeting Agenda Cards (5 Bullets)
    const agendaItems = [
      { num: "01", title: "Welcome & School-Wide Objectives", desc: "Setting the vision for multilingual student excellence across all 4 homerooms." },
      { num: "02", title: "Integrated vs. Designated ELD", desc: "Structured language practice, sentence frames, and academic vocabulary routines." },
      { num: "03", title: "Scaffolding Complex Grade-Level Texts", desc: "Chunking, graphic organizers, and reciprocal teaching strategies in subject classrooms." },
      { num: "04", title: "Data Review & Growth Monitoring", desc: "ELPAC levels analysis and tracking quarterly student progress indicators." },
      { num: "05", title: "Department Planning & Action Steps", desc: "Grade-level cohort alignment, classroom implementation roadmap, and teacher Q&A." },
    ];

    const cardY = 410;
    const cardH = 95;
    for (let i = 0; i < agendaItems.length; i++) {
      const y = cardY + i * 115;
      const item = agendaItems[i];

      // Card background
      ctx.fillStyle = "rgba(30, 41, 59, 0.7)";
      ctx.fillRect(80, y, 1760, cardH);
      ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(80, y, 1760, cardH);

      // Number pill
      ctx.fillStyle = "#2563eb";
      ctx.fillRect(105, y + 16, 68, 62);
      ctx.font = "bold 32px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.num, 139, y + 47);

      // Agenda title & description
      ctx.textAlign = "left";
      ctx.font = "bold 32px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = "#f8fafc";
      ctx.fillText(item.title, 200, y + 36);

      ctx.font = "400 22px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(item.desc, 200, y + 72);
    }

    // Bottom Footer
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(0, 1010, 1920, 70);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 1010, 1920, 70);

    ctx.font = "600 22px 'Segoe UI', Arial, sans-serif";
    ctx.fillStyle = "#cbd5e1";
    ctx.textAlign = "left";
    ctx.fillText("📍 Multi-Purpose Room (MPR) · All Teachers & Staff", 80, 1050);

    ctx.textAlign = "right";
    ctx.fillStyle = "#facc15";
    ctx.fillText("Facilitator: Mr. Van Diest · October 2026", 1840, 1050);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  }

  // =========================================================================
  // 2) ROOM ENCLOSURE (FLOOR, CEILING, WALLS)
  // =========================================================================

  // Polished Floor
  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(MPR_ROOM_SIZE, MPR_ROOM_SIZE),
    floorMat
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(MPR_ROOM_X, 0.01, MPR_ROOM_Z);
  floorMesh.receiveShadow = true;
  mprGroup.add(floorMesh);

  // Note: Open-top room (no ceiling/roof) so orbital camera has clear diorama visibility of character and all tables/chairs.

  // Helper to build a multi-tone interior wall with baseboard, wainscoting, and chair rail
  function buildInteriorWall(
    width: number,
    pos: [number, number, number],
    rotY: number,
    doorOffset: number | null = null,
    isRedWall: boolean = false
  ) {
    const wallGroup = new THREE.Group();
    const wainscotH = 1.2;
    const upperH = MPR_ROOM_HEIGHT - wainscotH;
    const activeUpperMat = isRedWall ? wallUpperRedMat : wallUpperMat;

    const segments: { cx: number; w: number }[] = [];
    if (doorOffset === null) {
      segments.push({ cx: 0, w: width });
    } else {
      const doorW = 2.4;
      const doorMin = doorOffset - doorW / 2;
      const doorMax = doorOffset + doorW / 2;
      // Segment before door (negative local X)
      if (doorMin > -width / 2) {
        const w1 = doorMin - (-width / 2);
        segments.push({ cx: -width / 2 + w1 / 2, w: w1 });
      }
      // Segment after door (positive local X)
      if (doorMax < width / 2) {
        const w2 = width / 2 - doorMax;
        segments.push({ cx: width / 2 - w2 / 2, w: w2 });
      }

      // Lintel section above the double doors
      const doorH = 2.6;
      const lintelH = MPR_ROOM_HEIGHT - doorH;
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW, lintelH, 0.06), activeUpperMat);
      lintel.position.set(doorOffset, doorH + lintelH / 2, 0);
      wallGroup.add(lintel);
    }

    for (const seg of segments) {
      // 1) Baseboard
      const baseboard = new THREE.Mesh(new THREE.BoxGeometry(seg.w, 0.18, 0.08), baseboardMat);
      baseboard.position.set(seg.cx, 0.09, 0);
      // 2) Lower Wainscoting (Wood acoustic paneling)
      const lower = new THREE.Mesh(new THREE.BoxGeometry(seg.w, wainscotH, 0.06), wallWoodMat);
      lower.position.set(seg.cx, wainscotH / 2, 0);
      // 3) Chair rail molding
      const chairRail = new THREE.Mesh(new THREE.BoxGeometry(seg.w, 0.08, 0.10), chairRailMat);
      chairRail.position.set(seg.cx, wainscotH, 0);
      // 4) Upper Plaster Wall
      const upper = new THREE.Mesh(new THREE.BoxGeometry(seg.w, upperH, 0.06), activeUpperMat);
      upper.position.set(seg.cx, wainscotH + upperH / 2, 0);

      wallGroup.add(baseboard, lower, chairRail, upper);
    }

    wallGroup.position.set(pos[0], pos[1], pos[2]);
    wallGroup.rotation.y = rotY;
    mprGroup.add(wallGroup);
  }

  // 1) East Wall (Solid - RED ACCENT WALL)
  buildInteriorWall(MPR_ROOM_SIZE, [maxX, 0, MPR_ROOM_Z], -Math.PI / 2, null, true);
  // 2) West Wall (Exit Doors in North-West corner - RED ACCENT WALL)
  // Local X offset: worldZ = MPR_ROOM_Z - localX => localX = MPR_ROOM_Z - MPR_EXIT_DOOR_Z
  const westDoorLocalOffset = MPR_ROOM_Z - MPR_EXIT_DOOR_Z;
  buildInteriorWall(MPR_ROOM_SIZE, [minX, 0, MPR_ROOM_Z], Math.PI / 2, westDoorLocalOffset, true);
  // 3) North Wall (Solid - Across from Projector, Natural Plaster)
  buildInteriorWall(MPR_ROOM_SIZE, [MPR_ROOM_X, 0, minZ], 0, null, false);
  // 4) South Wall (Presentation Wall, Solid - Projector Wall, Natural Plaster)
  buildInteriorWall(MPR_ROOM_SIZE, [MPR_ROOM_X, 0, maxZ], Math.PI, null, false);

  // --- Interior Illumination for Open-Top Room ---
  // Warm ambient fill so all furniture, walls, and players are brightly visible from above
  const indoorAmbient = new THREE.AmbientLight(0xfff8ee, 0.7);
  mprGroup.add(indoorAmbient);

  // Downward directional light (sun/stage downlight shining South)
  const interiorFill = new THREE.DirectionalLight(0xfffaed, 0.85);
  interiorFill.position.set(MPR_ROOM_X, 16, MPR_ROOM_Z - 6);
  mprGroup.add(interiorFill);

  // 4 Point Lights for warm indoor ambient illumination
  const lightPositions: [number, number][] = [
    [-5.5, -5.5],
    [5.5, -5.5],
    [-5.5, 5.5],
    [5.5, 5.5],
  ];
  for (const [lx, lz] of lightPositions) {
    const pl = new THREE.PointLight(0xfff6ea, 0.65, 24);
    pl.position.set(MPR_ROOM_X + lx, 4.2, MPR_ROOM_Z + lz);
    pl.castShadow = false;
    mprGroup.add(pl);
  }

  // =========================================================================
  // 3) SOUTH WALL PROJECTOR & STAGE SETUP (FACING NORTH TOWARD ROOM)
  // =========================================================================

  // Large High-Definition Projection Screen on South Wall
  const screenW = 7.2;
  const screenH = 4.0;
  const screenFace = new THREE.Mesh(
    new THREE.PlaneGeometry(screenW, screenH),
    new THREE.MeshBasicMaterial({ map: makeProjectorScreenTexture() })
  );
  screenFace.position.set(MPR_ROOM_X, 2.6, maxZ - 0.09);
  screenFace.rotation.y = Math.PI; // facing North (-Z) into the room

  // Sleek black bezel frame for the screen
  const frameBorderMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.3 });
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(screenW + 0.16, 0.08, 0.06), frameBorderMat);
  frameTop.position.set(MPR_ROOM_X, 2.6 + screenH / 2 + 0.04, maxZ - 0.08);
  const frameBottom = new THREE.Mesh(new THREE.BoxGeometry(screenW + 0.16, 0.08, 0.06), frameBorderMat);
  frameBottom.position.set(MPR_ROOM_X, 2.6 - screenH / 2 - 0.04, maxZ - 0.08);
  const frameWest = new THREE.Mesh(new THREE.BoxGeometry(0.08, screenH, 0.06), frameBorderMat);
  frameWest.position.set(MPR_ROOM_X - screenW / 2 - 0.04, 2.6, maxZ - 0.08);
  const frameEast = new THREE.Mesh(new THREE.BoxGeometry(0.08, screenH, 0.06), frameBorderMat);
  frameEast.position.set(MPR_ROOM_X + screenW / 2 + 0.04, 2.6, maxZ - 0.08);

  mprGroup.add(screenFace, frameTop, frameBottom, frameWest, frameEast);

  // Architectural steel cross-truss beam across the room (holds projector & AV gear)
  const trussMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.4 });
  const avTrussBeam = new THREE.Mesh(
    new THREE.BoxGeometry(MPR_ROOM_SIZE, 0.14, 0.14),
    trussMat
  );
  avTrussBeam.position.set(MPR_ROOM_X, 4.8, maxZ - 6.2);
  mprGroup.add(avTrussBeam);

  // Digital Projector mounted to the AV truss beam, projecting South
  const projGroup = new THREE.Group();
  projGroup.position.set(MPR_ROOM_X, 4.4, maxZ - 6.2);
  projGroup.rotation.y = Math.PI; // pointing South (+Z) toward the screen

  const projMountPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 })
  );
  projMountPipe.position.y = 0.2;

  const projBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.22, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
  );
  const projLens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.08, 16),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
  );
  projLens.rotation.x = Math.PI / 2;
  projLens.position.set(0.14, 0, -0.26);

  // Translucent projection beam cone shining toward the screen
  const beamGeo = new THREE.ConeGeometry(3.6, 6.0, 16, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.04,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beamMesh = new THREE.Mesh(beamGeo, beamMat);
  beamMesh.rotation.x = -Math.PI / 2;
  beamMesh.position.set(0, -0.1, -3.0);

  projGroup.add(projMountPipe, projBody, projLens, beamMesh);
  mprGroup.add(projGroup);

  // =========================================================================
  // 3b) BLACK ROLLING TECH EQUIPMENT CART (SOUTH-EAST CORNER CLOSE TO PROJECTOR)
  // =========================================================================

  const cartGroup = new THREE.Group();
  const cartX = maxX - 2.2; // 409.8 (South-East corner close to projector)
  const cartZ = maxZ - 2.2; // 409.8
  cartGroup.position.set(cartX, 0, cartZ);
  cartGroup.rotation.y = -Math.PI / 4; // angled toward the room

  // Cart Materials (Commercial Black Steel AV Media Cart)
  const cartSteelMat = new THREE.MeshStandardMaterial({
    color: 0x18181b, // Jet black powder-coated steel
    metalness: 0.85,
    roughness: 0.35,
  });
  const cartCasterMat = new THREE.MeshStandardMaterial({
    color: 0x52525b,
    metalness: 0.9,
    roughness: 0.2,
  });
  const techBlackMat = new THREE.MeshStandardMaterial({
    color: 0x09090b,
    roughness: 0.45,
  });
  const techSilverMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    metalness: 0.85,
    roughness: 0.25,
  });
  const ledGreenMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  const ledBlueMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const ledAmberMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  const ledRedMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

  const cartW = 0.88;
  const cartD = 0.62;
  const cartH = 1.05;

  // 1) 4 Vertical Steel Corner Posts
  for (const cx of [-cartW / 2 + 0.03, cartW / 2 - 0.03]) {
    for (const cz of [-cartD / 2 + 0.03, cartD / 2 - 0.03]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, cartH - 0.08, 8),
        cartSteelMat
      );
      post.position.set(cx, cartH / 2 + 0.04, cz);
      cartGroup.add(post);

      // Caster swivel wheel at bottom
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.032, 0.025, 12),
        cartCasterMat
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(cx, 0.035, cz);
      cartGroup.add(wheel);
    }
  }

  // 2) 3 Steel Trays / Shelves with safety retaining lips (Bottom, Middle, Top)
  for (const shelfY of [0.10, 0.55, cartH]) {
    // Shelf bottom plate
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(cartW, 0.02, cartD), cartSteelMat);
    shelf.position.y = shelfY;
    shelf.castShadow = true;
    shelf.receiveShadow = true;

    // Retaining safety lip around shelf
    const lipFront = new THREE.Mesh(new THREE.BoxGeometry(cartW, 0.03, 0.015), cartSteelMat);
    lipFront.position.set(0, shelfY + 0.015, cartD / 2);
    const lipBack = new THREE.Mesh(new THREE.BoxGeometry(cartW, 0.03, 0.015), cartSteelMat);
    lipBack.position.set(0, shelfY + 0.015, -cartD / 2);
    const lipLeft = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.03, cartD), cartSteelMat);
    lipLeft.position.set(-cartW / 2, shelfY + 0.015, 0);
    const lipRight = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.03, cartD), cartSteelMat);
    lipRight.position.set(cartW / 2, shelfY + 0.015, 0);

    cartGroup.add(shelf, lipFront, lipBack, lipLeft, lipRight);
  }

  // Cart Push Handle
  const handleBar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, cartD * 0.8), cartSteelMat);
  handleBar.position.set(-cartW / 2 - 0.08, cartH, 0);
  for (const hz of [-cartD * 0.35, cartD * 0.35]) {
    const handleArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.02), cartSteelMat);
    handleArm.position.set(-cartW / 2 - 0.04, cartH, hz);
    cartGroup.add(handleArm);
  }
  cartGroup.add(handleBar);

  // 3) TECH EQUIPMENT INSIDE & ON TOP OF CART

  // --- TOP SHELF: Presentation Tech Laptop & AV Video Switcher ---
  const laptopGroup = new THREE.Group();
  laptopGroup.position.set(-0.10, cartH + 0.01, 0.02);

  const lBase = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.016, 0.26), techBlackMat);
  lBase.position.y = 0.008;

  const lScreen = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.012), techBlackMat);
  lScreen.position.set(0, 0.12, -0.12);
  lScreen.rotation.x = -0.25;

  const lDisplay = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.21), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
  lDisplay.position.set(0, 0.12, -0.113);
  lDisplay.rotation.x = -0.25;

  const lTrackpad = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.002, 0.06), techSilverMat);
  lTrackpad.position.set(0, 0.017, 0.08);

  laptopGroup.add(lBase, lScreen, lDisplay, lTrackpad);
  cartGroup.add(laptopGroup);

  // AV Video Switcher Box (Extron style)
  const avSwitcher = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.055, 0.18), techBlackMat);
  avSwitcher.position.set(0.24, cartH + 0.028, 0);

  // Status LEDs on front of AV switcher
  for (let li = 0; li < 4; li++) {
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.004), li < 2 ? ledGreenMat : ledBlueMat);
    led.position.set(0.16 + li * 0.04, cartH + 0.035, 0.092);
    cartGroup.add(led);
  }
  cartGroup.add(avSwitcher);

  // --- MIDDLE SHELF: Audio Power Amplifier / Mixer & Wireless Mic Receiver ---
  const ampChassis = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.44), techBlackMat);
  ampChassis.position.set(0, 0.55 + 0.06, 0);

  // Rotary knobs on amp front face
  for (const kx of [-0.22, -0.14, -0.06, 0.02]) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.015, 8), techSilverMat);
    knob.rotation.x = Math.PI / 2;
    knob.position.set(kx, 0.55 + 0.06, 0.225);
    cartGroup.add(knob);
  }

  // VU meter LED bar
  for (let vi = 0; vi < 6; vi++) {
    const vLed = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.015, 0.004), vi < 4 ? ledGreenMat : (vi === 4 ? ledAmberMat : ledRedMat));
    vLed.position.set(0.12 + vi * 0.018, 0.55 + 0.06, 0.223);
    cartGroup.add(vLed);
  }
  cartGroup.add(ampChassis);

  // Wireless Mic Receiver with dual rubber-duck antennas on top of amp
  const micReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.045, 0.18), techBlackMat);
  micReceiver.position.set(0.12, 0.55 + 0.145, -0.05);

  for (const ax of [0.04, 0.20]) {
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.16, 6), techBlackMat);
    antenna.position.set(ax, 0.55 + 0.22, -0.12);
    antenna.rotation.x = -0.3;
    cartGroup.add(antenna);
  }
  cartGroup.add(micReceiver);

  // --- BOTTOM SHELF: Coiled Heavy-Duty AV Cables & Commercial Power Strip ---
  const cableCoil1 = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.025, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.7 })
  );
  cableCoil1.rotation.x = Math.PI / 2;
  cableCoil1.position.set(-0.16, 0.10 + 0.03, 0.02);

  const cableCoil2 = new THREE.Mesh(
    new THREE.TorusGeometry(0.11, 0.02, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 })
  );
  cableCoil2.rotation.x = Math.PI / 2;
  cableCoil2.position.set(0.12, 0.10 + 0.025, -0.04);

  // Power strip with red illuminated switch
  const powerStrip = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.035, 0.08), techSilverMat);
  powerStrip.position.set(0, 0.10 + 0.02, 0.18);

  const powerSwitch = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.015, 0.02), ledRedMat);
  powerSwitch.position.set(0.14, 0.10 + 0.04, 0.18);

  cartGroup.add(cableCoil1, cableCoil2, powerStrip, powerSwitch);

  // Indicator light glow
  const cartLedLight = new THREE.PointLight(0x38bdf8, 0.35, 3.2);
  cartLedLight.position.set(0, cartH + 0.2, 0);
  cartGroup.add(cartLedLight);

  mprGroup.add(cartGroup);

  // =========================================================================
  // 3c) PRESENTER PODIUM WITH A LAPTOP (in front of Mr. Van Diest, who stands just south of it)
  // =========================================================================
  {
    const px = MPR_PODIUM_X;
    const pz = MPR_PODIUM_Z;
    const podium = new THREE.Group();
    podium.position.set(px, 0, pz);
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.6 });
    const woodDark = new THREE.MeshStandardMaterial({ color: 0x3f2616, roughness: 0.65 });
    const redTrim = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.5 });
    const goldTrim = new THREE.MeshStandardMaterial({ color: 0xd4a017, roughness: 0.3, metalness: 0.6 });
    const PW = 0.95;
    const PD = 0.62;
    const PH = 1.12;
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      podium.add(m);
      return m;
    };
    add(new THREE.BoxGeometry(PW + 0.06, 0.08, PD + 0.06), woodDark, 0, 0.04, 0); // plinth
    add(new THREE.BoxGeometry(PW, PH - 0.1, PD), wood, 0, 0.08 + (PH - 0.1) / 2, 0); // body
    add(new THREE.BoxGeometry(PW + 0.1, 0.07, PD + 0.1), woodDark, 0, PH - 0.02, 0); // top slab
    add(new THREE.BoxGeometry(PW - 0.2, 0.5, 0.02), redTrim, 0, 0.62, -PD / 2 - 0.005); // red panel on the audience side (north = -z)
    add(new THREE.BoxGeometry(PW - 0.2, 0.025, 0.025), goldTrim, 0, 0.88, -PD / 2 - 0.015); // gold trim above it
    add(new THREE.BoxGeometry(PW - 0.2, 0.025, 0.025), goldTrim, 0, 0.37, -PD / 2 - 0.015); // gold trim below it
    const emblem = add(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 24), goldTrim, 0, 0.62, -PD / 2 - 0.02);
    emblem.rotation.x = Math.PI / 2;

    // Laptop on top: hinge toward the audience, screen facing the presenter (south, +z)
    const top = PH + 0.015;
    const laptop = new THREE.Group();
    laptop.position.set(0, top, -0.02);
    const silver = new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.35, metalness: 0.7 });
    const keys = new THREE.MeshStandardMaterial({ color: 0x1f2430, roughness: 0.8 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.03, 0.32), silver);
    base.position.y = 0.015;
    base.castShadow = true;
    laptop.add(base);
    const keyboard = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.005, 0.15), keys);
    keyboard.position.set(0, 0.032, 0.04);
    laptop.add(keyboard);
    const touchpad = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.004, 0.08), new THREE.MeshStandardMaterial({ color: 0x9aa0aa, roughness: 0.4, metalness: 0.5 }));
    touchpad.position.set(0, 0.032, 0.125);
    laptop.add(touchpad);
    const lid = new THREE.Group();
    lid.position.set(0, 0.03, -0.16); // hinge at the back edge (audience side)
    lid.rotation.x = -0.28; // leaning back, away from the presenter
    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.015), silver);
    shell.position.y = 0.15;
    shell.castShadow = true;
    lid.add(shell);
    const screenTex = (() => {
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 160;
      const g = c.getContext("2d")!;
      const grad = g.createLinearGradient(0, 0, 256, 160);
      grad.addColorStop(0, "#1e3a8a");
      grad.addColorStop(1, "#0f172a");
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 160);
      g.fillStyle = "#facc15";
      g.fillRect(24, 24, 208, 10);
      g.fillStyle = "#e2e8f0";
      g.fillRect(24, 54, 150, 8);
      g.fillRect(24, 74, 190, 8);
      g.fillRect(24, 94, 120, 8);
      return new THREE.CanvasTexture(c);
    })();
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26), new THREE.MeshBasicMaterial({ map: screenTex }));
    screen.position.set(0, 0.15, 0.009); // front face of the lid = facing +z (the presenter)
    lid.add(screen);
    laptop.add(lid);
    podium.add(laptop);
    mprGroup.add(podium);

    solids.push({ x: px, z: pz, w: PW + 0.1, d: PD + 0.1, yBase: 0, yTop: PH + 0.05 });
  }

  // Physical collision box for the tech cart
  solids.push({
    x: cartX,
    z: cartZ,
    w: cartW + 0.1,
    d: cartD + 0.1,
    yBase: 0,
    yTop: cartH + 0.1,
  });


  // =========================================================================
  // 4) FIVE WHITE FOLDABLE BANQUET TABLES & 40 FOLDABLE CHAIRS
  // =========================================================================

  // Blow-Molded White Plastic Folding Tabletop Material
  const foldingTableTopMat = new THREE.MeshStandardMaterial({
    color: 0xf4f4f5, // Crisp blow-molded polyethylene white plastic
    roughness: 0.55,
    metalness: 0.02,
  });
  const foldingTableEdgeMat = new THREE.MeshStandardMaterial({
    color: 0xe4e4e7, // Rounded drop edge profile
    roughness: 0.5,
  });
  const foldingTableSubframeMat = new THREE.MeshStandardMaterial({
    color: 0x475569, // Charcoal grey steel perimeter under-frame
    roughness: 0.45,
    metalness: 0.75,
  });
  const foldingTableLegMat = new THREE.MeshStandardMaterial({
    color: 0x64748b, // Hammer-tone silver/grey tubular folding wishbone legs
    roughness: 0.35,
    metalness: 0.82,
  });
  const foldingRubberFootMat = new THREE.MeshStandardMaterial({
    color: 0x18181b, // Non-marring black rubber foot caps
    roughness: 0.9,
  });

  // Folding Chair Materials (Classic institutional steel folding chair)
  const foldingChairFrameMat = new THREE.MeshStandardMaterial({
    color: 0x334155, // Durable powder-coated slate steel tubular frame
    roughness: 0.38,
    metalness: 0.75,
  });
  const foldingChairSeatMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b, // Contoured charcoal institutional seat & backrest
    roughness: 0.65,
  });
  const foldingHingeMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8, // Steel pivot rivets and scissor hinge brackets
    roughness: 0.25,
    metalness: 0.9,
  });

  // Reusable Geometries for Folding Chairs
  const chairFrontLegGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.82, 8);
  const chairRearLegGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.50, 8);
  const chairCrossbarFrontGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.40, 8);
  const chairCrossbarRearGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.38, 8);
  const chairHingeGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.02, 8);
  const chairSeatGeo = new THREE.BoxGeometry(0.42, 0.028, 0.40);
  const chairBackGeo = new THREE.BoxGeometry(0.42, 0.22, 0.025);
  const chairHandleCutoutGeo = new THREE.BoxGeometry(0.14, 0.035, 0.035);

  function createFoldableChair(): THREE.Group {
    const chair = new THREE.Group();

    // 1) Front Main Frame (Inverted-U tubular stanchions angled back ~10°)
    for (const sx of [-0.19, 0.19]) {
      const fLeg = new THREE.Mesh(chairFrontLegGeo, foldingChairFrameMat);
      fLeg.position.set(sx, 0.40, -0.04);
      fLeg.rotation.x = -0.17;
      chair.add(fLeg);

      // Rubber foot glide
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.03, 8), foldingRubberFootMat);
      foot.position.set(sx, 0.015, 0.03);
      chair.add(foot);
    }

    // Top arch of back frame
    const topArch = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.024, 0.024), foldingChairFrameMat);
    topArch.position.set(0, 0.80, -0.11);
    chair.add(topArch);

    // Front lower stretcher crossbar
    const fCross = new THREE.Mesh(chairCrossbarFrontGeo, foldingChairFrameMat);
    fCross.rotation.z = Math.PI / 2;
    fCross.position.set(0, 0.08, 0.02);
    chair.add(fCross);

    // 2) Rear Scissor Legs (Angled forward ~16° up to the under-seat pivot)
    for (const sx of [-0.18, 0.18]) {
      const rLeg = new THREE.Mesh(chairRearLegGeo, foldingChairFrameMat);
      rLeg.position.set(sx, 0.24, -0.08);
      rLeg.rotation.x = 0.28;
      chair.add(rLeg);

      // Rear foot glide
      const rFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.03, 8), foldingRubberFootMat);
      rFoot.position.set(sx, 0.015, -0.15);
      chair.add(rFoot);

      // Scissor hinge pivot rivet
      const rivet = new THREE.Mesh(chairHingeGeo, foldingHingeMat);
      rivet.rotation.z = Math.PI / 2;
      rivet.position.set(sx + (sx > 0 ? 0.01 : -0.01), 0.42, 0.01);
      chair.add(rivet);
    }

    // Rear lower stretcher crossbar
    const rCross = new THREE.Mesh(chairCrossbarRearGeo, foldingChairFrameMat);
    rCross.rotation.z = Math.PI / 2;
    rCross.position.set(0, 0.08, -0.13);
    chair.add(rCross);

    // 3) Contoured Seat Pan
    const seat = new THREE.Mesh(chairSeatGeo, foldingChairSeatMat);
    seat.position.set(0, 0.44, 0.01);
    seat.rotation.x = -0.06; // subtle ergonomic recline
    seat.castShadow = true;

    // Curved front waterfall lip
    const waterfall = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.42, 8), foldingChairSeatMat);
    waterfall.rotation.z = Math.PI / 2;
    waterfall.position.set(0, 0.43, 0.20);

    chair.add(seat, waterfall);

    // 4) Contoured Backrest with integrated handle cutout
    const back = new THREE.Mesh(chairBackGeo, foldingChairSeatMat);
    back.position.set(0, 0.71, -0.09);
    back.rotation.x = -0.17;
    back.castShadow = true;

    // Oval handle slot
    const handleCutout = new THREE.Mesh(chairHandleCutoutGeo, foldingChairFrameMat);
    handleCutout.position.set(0, 0.77, -0.10);
    handleCutout.rotation.x = -0.17;

    chair.add(back, handleCutout);
    return chair;
  }

  function createFoldableTable(width: number, depth: number, height: number): THREE.Group {
    const tableGroup = new THREE.Group();

    // 1) Blow-Molded Polyethylene Tabletop Slab
    const topSlab = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, depth), foldingTableTopMat);
    topSlab.position.y = height;
    topSlab.castShadow = true;
    topSlab.receiveShadow = true;

    // Rounded drop edge / perimeter trim underneath
    const rim = new THREE.Mesh(new THREE.BoxGeometry(width + 0.02, 0.045, depth + 0.02), foldingTableEdgeMat);
    rim.position.y = height - 0.02;

    // Recessed dark steel sub-frame rail
    const subframe = new THREE.Mesh(new THREE.BoxGeometry(width * 0.92, 0.03, depth * 0.82), foldingTableSubframeMat);
    subframe.position.y = height - 0.04;

    // Center folding seam (groove down the middle of fold-in-half tables)
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.012, depth + 0.022), foldingTableSubframeMat);
    seam.position.set(0, height + 0.024, 0);

    // Molded center carry handle slot
    const carryHandle = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.025, 0.04), foldingTableSubframeMat);
    carryHandle.position.set(0, height - 0.02, depth / 2 + 0.01);

    tableGroup.add(topSlab, rim, subframe, seam, carryHandle);

    // 2) Wishbone Tubular Steel Folding Legs (Left and Right ends)
    for (const lx of [-width * 0.38, width * 0.38]) {
      const legAssembly = new THREE.Group();
      legAssembly.position.set(lx, 0, 0);

      // Two vertical leg columns
      for (const lz of [-depth * 0.34, depth * 0.34]) {
        const tube = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.018, height - 0.06, 8),
          foldingTableLegMat
        );
        tube.position.set(0, (height - 0.06) / 2 + 0.02, lz);

        // Black rubber foot caps
        const foot = new THREE.Mesh(
          new THREE.CylinderGeometry(0.024, 0.024, 0.04, 8),
          foldingRubberFootMat
        );
        foot.position.set(0, 0.02, lz);

        legAssembly.add(tube, foot);
      }

      // Bottom horizontal floor crossbar connecting feet
      const footBar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, depth * 0.68, 8),
        foldingTableLegMat
      );
      footBar.rotation.x = Math.PI / 2;
      footBar.position.set(0, 0.03, 0);

      // Top pivot hinge tube
      const topBar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, depth * 0.68, 8),
        foldingTableLegMat
      );
      topBar.rotation.x = Math.PI / 2;
      topBar.position.set(0, height - 0.05, 0);

      // Diagonal folding support strut (angled tube toward table center)
      const strutDir = lx > 0 ? -1 : 1;
      const strut = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 0.72, 8),
        foldingTableLegMat
      );
      strut.position.set(strutDir * 0.28, (height - 0.06) * 0.62, 0);
      strut.rotation.z = strutDir * 0.58;

      // Gravity locking ring collar
      const lockRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.04, 8),
        foldingHingeMat
      );
      lockRing.position.set(strutDir * 0.28, (height - 0.06) * 0.62, 0);
      lockRing.rotation.z = strutDir * 0.58;

      legAssembly.add(footBar, topBar, strut, lockRing);
      tableGroup.add(legAssembly);
    }

    return tableGroup;
  }

  // Accessories to place on tables (laptops, notebooks, mugs)
  const laptopMatSilver = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.8, roughness: 0.2 });
  const laptopMatDark = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.4 });
  const notebookMat1 = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.7 });
  const notebookMat2 = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.7 });
  const mugMatBlue = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.3 });
  const mugMatWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });

  // 5 Foldable Table Coordinates (rotated 90 degrees: length runs North-South along Z)
  // 2 Columns (East & West) of Front & Rear tables + 1 Staggered Center table
  const TABLE_W = 5.2; // 5.2m long (along Z after 90° rotation)
  const TABLE_D = 1.35; // 1.35m wide (along X after 90° rotation)
  const TABLE_H = 0.75;

  const tableConfigs = [
    { id: "tbl-center",      x: MPR_ROOM_X,       z: MPR_ROOM_Z },
    { id: "tbl-front-left",  x: MPR_ROOM_X + 5.5, z: MPR_ROOM_Z + 5.0 },
    { id: "tbl-front-right", x: MPR_ROOM_X - 5.5, z: MPR_ROOM_Z + 5.0 },
    { id: "tbl-rear-left",   x: MPR_ROOM_X + 5.5, z: MPR_ROOM_Z - 5.0 },
    { id: "tbl-rear-right",  x: MPR_ROOM_X - 5.5, z: MPR_ROOM_Z - 5.0 },
  ];

  // Build each of the 5 white foldable tables and attach 8 foldable chairs per table = 40 chairs total
  tableConfigs.forEach((cfg, tIdx) => {
    const tblGroup = createFoldableTable(TABLE_W, TABLE_D, TABLE_H);
    tblGroup.position.set(cfg.x, 0, cfg.z);
    tblGroup.rotation.y = -Math.PI / 2; // Rotated 90 degrees: table length runs along world Z

    // Meeting items on table (laptops, notebooks, mugs)
    const itemOffsets = [-1.8, -0.6, 0.6, 1.8];
    itemOffsets.forEach((ox, idx) => {
      // Laptop on alternating seats
      if ((idx + tIdx) % 2 === 0) {
        const laptop = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.015, 0.24), idx % 2 === 0 ? laptopMatSilver : laptopMatDark);
        laptop.position.set(ox, TABLE_H + 0.035, 0.22);
        laptop.rotation.y = (Math.random() - 0.5) * 0.15;
        tblGroup.add(laptop);
      } else {
        const nb = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.012, 0.30), idx % 2 === 0 ? notebookMat1 : notebookMat2);
        nb.position.set(ox, TABLE_H + 0.035, 0.22);
        nb.rotation.y = (Math.random() - 0.5) * 0.2;
        tblGroup.add(nb);
      }

      // Coffee mug or water bottle
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.10, 10), idx % 2 === 0 ? mugMatBlue : mugMatWhite);
      mug.position.set(ox + 0.28, TABLE_H + 0.08, -0.22);
      tblGroup.add(mug);
    });

    mprGroup.add(tblGroup);

    // Physical collision box for the rotated table (width along X, depth along Z)
    solids.push({
      x: cfg.x,
      z: cfg.z,
      w: TABLE_D,
      d: TABLE_W,
      yBase: 0,
      yTop: TABLE_H + 0.05,
    });

    // 8 FOLDABLE CHAIRS PER TABLE (4 West side facing East, 4 East side facing West)
    // 5 tables * 8 chairs = 40 spots for teachers!
    const chairZOffsets = [-1.8, -0.6, 0.6, 1.8];

    // West side chairs (facing East toward table)
    for (const oz of chairZOffsets) {
      const chair = createFoldableChair();
      const chairWorldX = cfg.x - 1.05; // West of table
      const chairWorldZ = cfg.z + oz;
      chair.position.set(chairWorldX, 0, chairWorldZ);
      chair.rotation.y = Math.PI / 2; // facing East (+X) toward table
      mprGroup.add(chair);

      chairs.push({
        chairX: chairWorldX,
        chairZ: chairWorldZ,
        seatY: 0.44,
        tableX: cfg.x,
        tableZ: cfg.z,
        facingAngle: Math.PI / 2, // facing East (+X)
      });
    }

    // East side chairs (facing West toward table)
    for (const oz of chairZOffsets) {
      const chair = createFoldableChair();
      const chairWorldX = cfg.x + 1.05; // East of table
      const chairWorldZ = cfg.z + oz;
      chair.position.set(chairWorldX, 0, chairWorldZ);
      chair.rotation.y = -Math.PI / 2; // facing West (-X) toward table
      mprGroup.add(chair);

      chairs.push({
        chairX: chairWorldX,
        chairZ: chairWorldZ,
        seatY: 0.44,
        tableX: cfg.x,
        tableZ: cfg.z,
        facingAngle: -Math.PI / 2, // facing West (-X)
      });
    }
  });

  // =========================================================================
  // 5) WEST WALL ENTRANCE / EXIT DOUBLE DOORS
  // =========================================================================

  const exitDoorGroup = new THREE.Group();
  exitDoorGroup.position.set(MPR_EXIT_DOOR_X, 0, MPR_EXIT_DOOR_Z);
  exitDoorGroup.rotation.y = -Math.PI / 2; // facing East into room

  // Door Frame
  const exitFrameMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.4 });
  const exitDoorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
  const exitGlassMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.35, roughness: 0.1 });
  const exitPushBarMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 });

  const DOOR_W = 1.15;
  const DOOR_H = 2.5;

  for (const side of [-1, 1]) {
    const doorLeaf = new THREE.Group();
    doorLeaf.position.set(side * (DOOR_W / 2 + 0.02), 0, 0);

    // Door body
    const leafMesh = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W, DOOR_H, 0.08), exitDoorMat);
    leafMesh.position.y = DOOR_H / 2;

    // Vision glass panel
    const glassMesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, 0.09), exitGlassMat);
    glassMesh.position.set(0, DOOR_H * 0.62, 0);

    // Panic exit push bar (crash bar) on the inside
    const pushBar = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W * 0.8, 0.06, 0.06), exitPushBarMat);
    pushBar.position.set(0, 1.05, -0.06);

    doorLeaf.add(leafMesh, glassMesh, pushBar);
    exitDoorGroup.add(doorLeaf);
  }

  // Illuminated EXIT sign above doors
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

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  const exitSignPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.36, 0.12),
    new THREE.MeshBasicMaterial({ map: makeExitSignTexture() })
  );
  exitSignPlate.position.set(0, DOOR_H + 0.28, -0.08);

  const exitLight = new THREE.PointLight(0x22c55e, 0.4, 4);
  exitLight.position.set(0, DOOR_H + 0.28, -0.2);

  exitDoorGroup.add(exitSignPlate, exitLight);
  mprGroup.add(exitDoorGroup);

  // 6) EAST WALL COURTYARD EXIT DOUBLE DOORS
  const eastExitDoorGroup = exitDoorGroup.clone(true);
  eastExitDoorGroup.position.set(MPR_EAST_EXIT_DOOR_X, 0, MPR_EAST_EXIT_DOOR_Z);
  eastExitDoorGroup.rotation.y = Math.PI / 2; // facing West into room
  mprGroup.add(eastExitDoorGroup);

  return {
    group: mprGroup,
    solids,
    chairs,
  };
}
