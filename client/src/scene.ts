import * as THREE from "three";

/**
 * Milestone 1 placeholder scene (PROJECT.md section 14, milestone 1).
 *
 * A simple low-poly "school" block viewed from a fixed isometric-style angle
 * with a very slow drift, soft shadows, and daylight lighting. It exists to
 * prove that Three.js renders correctly in the browser.
 *
 * Milestone 2 replaces this with the real placeholder campus (hallways,
 * 20 doors, parking lot) and the player character.
 */
export function startPlaceholderScene(container: HTMLElement): void {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9ec7e8); // soft sky
  scene.fog = new THREE.Fog(0x9ec7e8, 55, 110);

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
  sun.position.set(14, 22, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);

  // --- Ground --------------------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 90),
    new THREE.MeshStandardMaterial({ color: 0x7fae6b, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // --- Placeholder "school" (an obvious stand-in block — real campus in M2)
  const school = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(16, 6, 10),
    new THREE.MeshStandardMaterial({ color: 0xe8e0d2, roughness: 0.9 })
  );
  body.position.y = 3;
  body.castShadow = true;
  body.receiveShadow = true;

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(17, 1, 11),
    new THREE.MeshStandardMaterial({ color: 0xb85c4a, roughness: 0.9 })
  );
  roof.position.y = 6.5;
  roof.castShadow = true;

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 3.4, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x6b4f3a, roughness: 0.8 })
  );
  door.position.set(0, 1.7, 5.15);

  school.add(body, roof, door);
  scene.add(school);

  // A few placeholder bushes so shadows are obviously working.
  const bushMaterial = new THREE.MeshStandardMaterial({ color: 0x4f8f4f, roughness: 1 });
  for (const [x, z] of [
    [-13, 8],
    [13, 8],
    [-15, -11],
    [15, -11],
  ]) {
    const bush = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 12), bushMaterial);
    bush.position.set(x, 1.4, z);
    bush.castShadow = true;
    scene.add(bush);
  }

  // --- Camera: fixed isometric-style view with a very slow drift -----------
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 220);
  const radius = 28;
  const height = 22;
  let angle = Math.PI / 4;

  function resize(): void {
    const width = container.clientWidth || window.innerWidth;
    const heightPx = container.clientHeight || window.innerHeight;
    renderer.setSize(width, heightPx);
    camera.aspect = width / heightPx;
    camera.updateProjectionMatrix();
  }

  window.addEventListener("resize", resize);
  resize();

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    angle += clock.getDelta() * 0.05; // slow drift so it is visibly "alive"
    camera.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
    camera.lookAt(0, 2, 0);
    renderer.render(scene, camera);
  });
}
