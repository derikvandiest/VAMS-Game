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

export type ProceduralKind = "round" | "square" | "shades" | "beanie";

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
 * `eye` the measured eye position (glasses are fitted to it), `bulk` enlarges hats for fuller hair.
 */
export function buildProcedural(kind: ProceduralKind, head: THREE.Box3, bulk = 1, eye?: EyeInfo): THREE.Group {
  const size = head.getSize(new THREE.Vector3());
  const c = head.getCenter(new THREE.Vector3());
  const w = size.x;
  const d = size.z;
  const top = head.max.y;
  const g = new THREE.Group();

  if (kind !== "beanie") {
    const e = eye ?? { y: top - 0.58 * w, z: head.max.z - 0.06 * d, span: 0.55 * w };
    const gap = e.span * 0.36; // eye centre to face centre
    const lensR = e.span * 0.29;
    const t = e.span * 0.035;
    const zf = e.z + t * 2; // just in front of the eyes
    const hw = lensR * 1.05;
    const hh = lensR * (kind === "shades" ? 0.95 : 0.8);
    for (const sx of [-1, 1]) {
      const cx = c.x + sx * gap;
      if (kind === "round") {
        g.add(withGeo(std("accent"), new THREE.TorusGeometry(lensR, t, 8, 24), cx, e.y, zf));
      } else {
        if (kind === "shades") {
          g.add(withGeo(std("fixed", 0x0b0b10, { roughness: 0.2, metalness: 0.2 }), new THREE.BoxGeometry(hw * 2, hh * 2, t * 1.2), cx, e.y, zf));
        }
        const bars: Array<[number, number, number, number]> = [
          [0, hh, hw * 2 + t * 2, t * 2],
          [0, -hh, hw * 2 + t * 2, t * 2],
          [-hw, 0, t * 2, hh * 2],
          [hw, 0, t * 2, hh * 2],
        ];
        for (const [bx, by, bw, bh] of bars) {
          g.add(withGeo(std("accent"), new THREE.BoxGeometry(bw, bh, t * 1.6), cx + bx, e.y + by, zf));
        }
      }
      // temple arm: leaves the lens corner and runs straight back, hugging the side of the face
      const outer = gap + (kind === "round" ? lensR : hw) + t;
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

  // Beanie: a cap that hugs the skull. It reaches below the widest point so it grips the head,
  // with the rim just above the eyebrows, and a folded band along the rim.
  const alpha = 0.35; // how far the dome continues below its equator
  const rimY = top - 0.4 * w;
  const apexY = top + (0.14 + (bulk - 1)) * w; // clears the hair on top
  const ry = (apexY - rimY) / (1 + Math.sin(alpha));
  const cy = rimY + ry * Math.sin(alpha);
  const rx = 0.62 * w * bulk;
  const rz = 0.66 * d * bulk;
  const cz = c.z - 0.02 * d;
  const dome = std("accent", 0xcc3333);
  dome.geometry = new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2 + alpha);
  dome.scale.set(rx, ry, rz);
  dome.position.set(c.x, cy, cz);
  g.add(dome);
  const band = std("accent", 0xcc3333);
  band.geometry = new THREE.CylinderGeometry(1, 1, 0.13 * w, 28, 1, true);
  (band.material as THREE.Material).side = THREE.DoubleSide;
  const rimScale = Math.cos(alpha) * 1.03;
  band.scale.set(rx * rimScale, 1, rz * rimScale);
  band.position.set(c.x, rimY + 0.03 * w, cz);
  g.add(band);
  return g;
}
