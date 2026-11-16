/**
 * Character add-ons: hair, hats, shoes (borrowed from other Quaternius models) and
 * procedural glasses / beanies (built from simple shapes).
 *
 * All Quaternius models of the same gender share one skeleton, so a part (e.g. the hair
 * of Female/Punk) can be lifted off its model and re-bound to the player's skeleton and
 * it animates and fits exactly.
 */
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

/** How an add-on mesh is colored when the profile changes. */
export type Role = "hair" | "hairDark" | "skin" | "skinDark" | "shoe" | "accent" | "fixed";

/** "Part:Material" entry test (Part = a suffix of the mesh group name such as Head, Body, Feet). */
export function matchesEntry(entries: string[], meshName: string, matName: string): boolean {
  for (const e of entries) {
    const [part, mat] = e.split(":");
    if (mat === matName && meshName.includes(`_${part}`)) return true;
  }
  return false;
}

export function partName(o: THREE.Object3D): string {
  return `${o.name}|${o.parent?.name ?? ""}`;
}

/**
 * Lift skinned meshes out of a donor model and bind them to `target`'s skeleton.
 * `pick` returns the color role for a mesh, or null to leave it behind.
 */
export function transplant(
  donorScene: THREE.Object3D,
  target: THREE.Object3D,
  pick: (partName: string, matName: string) => Role | null
): THREE.SkinnedMesh[] {
  const donor = SkeletonUtils.clone(donorScene);
  donor.updateMatrixWorld(true);
  const picked: Array<{ mesh: THREE.SkinnedMesh; role: Role }> = [];
  donor.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    const role = pick(partName(m), mat?.name ?? "");
    if (role) picked.push({ mesh: m, role });
  });

  const out: THREE.SkinnedMesh[] = [];
  for (const { mesh, role } of picked) {
    const bones = mesh.skeleton.bones.map((b) => target.getObjectByName(b.name) as THREE.Bone | undefined);
    if (bones.some((b) => !b)) continue;
    const skeleton = new THREE.Skeleton(bones as THREE.Bone[], mesh.skeleton.boneInverses);
    mesh.removeFromParent();
    target.add(mesh);
    mesh.updateMatrixWorld(true);
    mesh.bind(skeleton, mesh.bindMatrix);
    mesh.material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).clone();
    mesh.userData.role = role;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    out.push(mesh);
  }
  return out;
}

export type RoleColors = Partial<Record<Role, THREE.Color>>;

/** Apply colors to add-on meshes by role ("fixed" and unset roles keep their own color). */
export function recolor(objs: THREE.Object3D[], colors: RoleColors): void {
  for (const root of objs) {
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const role = (mesh.userData.role ?? (o.parent?.userData.role as Role | undefined)) as Role | undefined;
      const c = role ? colors[role] : undefined;
      if (c) ((mesh.material as THREE.MeshStandardMaterial).color).copy(c);
    });
  }
}

// ---------------------------------------------------------------------------
// Procedural accessories
// ---------------------------------------------------------------------------

export type ProceduralKind = "round" | "locs" | "curls" | "braid" | "buzz";

/** Where the eyes are (model space): vertical center, front surface and outer-corner span. */
export interface EyeInfo {
  y: number;
  z: number;
  span: number;
}

const std = (role: Role, color = 0x222222, extra: THREE.MeshStandardMaterialParameters = {}): THREE.Mesh => {
  const mesh = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.0, ...extra })
  );
  mesh.userData.role = role;
  mesh.castShadow = true;
  return mesh;
};

function withGeo(m: THREE.Mesh, g: THREE.BufferGeometry, x = 0, y = 0, z = 0): THREE.Mesh {
  m.geometry = g;
  m.position.set(x, y, z);
  return m;
}

/**
 * Build a procedural accessory in the model's space. `head` is the head's skin bounding box,
 * `eye` the measured eye position (glasses are fitted to it), `bulk` is unused for glasses.
 */
export function buildProcedural(kind: ProceduralKind, head: THREE.Box3, bulk = 1, eye?: EyeInfo): THREE.Group {
  const size = head.getSize(new THREE.Vector3());
  const c = head.getCenter(new THREE.Vector3());
  const w = size.x;
  const d = size.z;
  const top = head.max.y;
  const g = new THREE.Group();
  if (kind === "locs") return buildLocs(head, g);
  if (kind === "curls") return buildCurls(head, g);
  if (kind === "braid") return buildBraid(head, g);
  if (kind === "buzz") return buildBuzz(head, g);

  // Round glasses: fitted to the measured eye position, the frame sits right against the face.
  const e = eye ?? { y: top - 0.58 * w, z: head.max.z - 0.06 * d, span: 0.55 * w };
  const gap = e.span * 0.36; // eye centre to face centre
  const lensR = e.span * 0.29;
  const t = e.span * 0.035;
  const zf = e.z + t * 0.1; // lens ring resting on the face
  for (const sx of [-1, 1]) {
    const cx = c.x + sx * gap;
    g.add(withGeo(std("accent"), new THREE.TorusGeometry(lensR, t, 8, 24), cx, e.y, zf));
    // temple arm: leaves the lens corner and runs straight back, hugging the side of the face
    const outer = gap + lensR + t;
    const side = outer + Math.max(0, w / 2 - outer) * 0.3;
    if (side > outer + t) {
      g.add(withGeo(std("accent"), new THREE.BoxGeometry(side - outer, t * 1.6, t * 1.6), c.x + (sx * (outer + side)) / 2, e.y, zf));
    }
    const armLen = Math.max(zf - c.z, 0) * 0.8;
    g.add(withGeo(std("accent"), new THREE.BoxGeometry(t * 1.6, t * 1.6, armLen), c.x + sx * side, e.y, zf - armLen / 2));
  }
  // bridge
  g.add(withGeo(std("accent"), new THREE.BoxGeometry(Math.max(gap * 2 - lensR * 2 - t, t), t * 1.6, t * 1.6), c.x, e.y + lensR * 0.25, zf));
  return g;
}

/**
 * Locs (dreadlocks): twisted ropes starting at the hairline, swept back over the crown and hanging down the back
 * of the head to below the jaw. Built in the model's space from the head's skin bounding box; colored as hair.
 */
function buildLocs(head: THREE.Box3, g: THREE.Group): THREE.Group {
  const size = head.getSize(new THREE.Vector3());
  const c = head.getCenter(new THREE.Vector3());
  const w = size.x;
  const top = head.max.y;
  const front = head.max.z;
  const back = head.min.z;
  const r = w * 0.055;
  const N = 11;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1) - 0.5; // -0.5 .. 0.5 across the head
    const jit = Math.sin(i * 12.9898) * 0.5 + 0.5; // stable per-loc variation
    const xTop = c.x + t * w * 0.72;
    const xHang = c.x + t * w * 1.0;
    const edge = Math.abs(t) * 2; // 0 in the middle, 1 at the sides
    const pts = [
      new THREE.Vector3(xTop, top - w * (0.28 + 0.12 * edge), front - w * (0.16 + 0.06 * edge)), // hairline
      new THREE.Vector3(xTop, top + w * (0.06 - 0.08 * edge), c.z + w * 0.12),
      new THREE.Vector3(xHang * 0.5 + xTop * 0.5, top - w * (0.06 + 0.1 * edge), back + w * 0.1),
      new THREE.Vector3(xHang, top - w * (0.45 + 0.05 * jit), back - w * 0.04),
      new THREE.Vector3(xHang + t * w * 0.1, top - w * (0.85 + 0.2 * jit), back + w * (0.02 + 0.08 * edge)),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.TubeGeometry(curve, 24, r * (0.85 + 0.3 * jit), 6, false);
    g.add(withGeo(std(i % 3 === 0 ? "hairDark" : "hair"), tube));
    // rounded tip
    const tip = new THREE.SphereGeometry(r * (0.85 + 0.3 * jit), 6, 5);
    const end = pts[pts.length - 1];
    g.add(withGeo(std("hair"), tip, end.x, end.y, end.z));
  }
  return g;
}

/**
 * Long curly hair: wavy ringlets falling from around the head (not in front of the face) past the shoulders,
 * fanning out a little as they go down. Goes over a long base hairstyle; colored as hair.
 */
function buildCurls(head: THREE.Box3, g: THREE.Group): THREE.Group {
  const size = head.getSize(new THREE.Vector3());
  const c = head.getCenter(new THREE.Vector3());
  const w = size.x;
  const d = size.z;
  const top = head.max.y;
  const N = 22;
  for (let i = 0; i < N; i++) {
    // around the head from one temple, behind, to the other temple (the face stays clear)
    const theta = -2.55 + (5.1 * i) / (N - 1);
    const jit = Math.sin(i * 12.9898 + 4.1) * 0.5 + 0.5;
    const front = Math.cos(theta) < -0.3; // strands framing the face (theta = 0 is the back of the head)
    const len = w * (front ? 1.45 : 1.75) + w * 0.25 * jit;
    const pts: THREE.Vector3[] = [];
    const S = 28;
    for (let s = 0; s <= S; s++) {
      const u = s / S;
      // fans out toward the ends, with tight waves in and out and side to side (curls)
      const spread = 0.58 + 0.24 * u + 0.07 * Math.sin(u * Math.PI * 7 + i * 1.7) * Math.min(1, u * 3);
      const wave = Math.sin(u * Math.PI * 7 + i) * 0.16 * Math.min(1, u * 3);
      const ang = theta + wave;
      pts.push(
        new THREE.Vector3(
          c.x + Math.sin(ang) * w * spread,
          top - w * 0.22 - len * u,
          c.z - Math.cos(ang) * d * spread * 0.95
        )
      );
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const r = w * (0.08 + 0.035 * jit);
    g.add(withGeo(std(i % 4 === 0 ? "hairDark" : "hair"), new THREE.TubeGeometry(curve, 72, r, 6, false)));
    const end = pts[pts.length - 1];
    g.add(withGeo(std("hair"), new THREE.SphereGeometry(r, 6, 5), end.x, end.y, end.z));
  }
  return g;
}

/**
 * One long braid: a plaited rope from the nape that comes forward over the right shoulder and down the chest
 * (goes with a slicked-back hairstyle). Colored as hair.
 */
function buildBraid(head: THREE.Box3, g: THREE.Group): THREE.Group {
  const size = head.getSize(new THREE.Vector3());
  const c = head.getCenter(new THREE.Vector3());
  const w = size.x;
  const d = size.z;
  const top = head.max.y;
  // the braid: nape -> behind the right ear -> over the right shoulder -> down the front
  const side = -1; // the character's right (the model faces +z)
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(c.x + side * w * 0.12, top - w * 0.72, head.min.z + d * 0.05),
    new THREE.Vector3(c.x + side * w * 0.42, top - w * 1.0, head.min.z + d * 0.12),
    new THREE.Vector3(c.x + side * w * 0.62, top - w * 1.3, c.z + d * 0.05),
    new THREE.Vector3(c.x + side * w * 0.6, top - w * 1.65, head.max.z + d * 0.18),
    new THREE.Vector3(c.x + side * w * 0.5, top - w * 2.15, head.max.z + d * 0.3),
    new THREE.Vector3(c.x + side * w * 0.45, top - w * 2.6, head.max.z + d * 0.3),
  ]);
  const links = 16;
  for (let i = 0; i < links; i++) {
    const u = (i + 0.5) / links;
    const p = curve.getPointAt(u);
    const tan = curve.getTangentAt(u);
    const r = w * (0.13 - 0.05 * u); // tapers toward the end
    const link = withGeo(std(i % 2 ? "hairDark" : "hair"), new THREE.SphereGeometry(1, 10, 8), p.x, p.y, p.z);
    link.scale.set(r, r * 1.5, r); // each plait is an oval along the braid
    link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
    // alternate the plaits left and right of the braid's line
    const off = new THREE.Vector3(1, 0, 0).applyQuaternion(link.quaternion).multiplyScalar(r * 0.35 * (i % 2 ? 1 : -1));
    link.position.add(off);
    g.add(link);
  }
  // hair tie and the loose tip
  const end = curve.getPointAt(1);
  g.add(withGeo(std("hairDark"), new THREE.CylinderGeometry(w * 0.06, w * 0.06, w * 0.05, 10), end.x, end.y + w * 0.04, end.z));
  const tip = withGeo(std("hair"), new THREE.ConeGeometry(w * 0.07, w * 0.22, 8), end.x, end.y - w * 0.1, end.z);
  tip.rotation.x = Math.PI;
  g.add(tip);
  return g;
}

/**
 * A very short fade / buzz cut: a thin dome of hair over the crown, with a crisp hairline high on the forehead and
 * lower at the back. Colored as hair. Use with noHair (no other hairstyle).
 */
function buildBuzz(head: THREE.Box3, g: THREE.Group): THREE.Group {
  const size = head.getSize(new THREE.Vector3());
  const c = head.getCenter(new THREE.Vector3());
  const w = size.x;
  const d = size.z;
  const top = head.max.y;
  const dome = new THREE.SphereGeometry(0.5, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5);
  // (the head's skin stops at the hairline: the skull above it is the model's own hair, hidden here)
  const m = withGeo(std("hair"), dome, c.x, top - w * 0.6, c.z + d * 0.06);
  m.scale.set(w * 1.14, w * 1.1, d * 1.32);
  m.rotation.x = -0.12; // hairline a little higher at the front than at the nape
  g.add(m);
  return g;
}
