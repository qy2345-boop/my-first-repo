import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const container = document.getElementById("three-canvas-1");

// ---------- Scene ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9f2b8);

// ---------- Camera ----------
const camera = new THREE.PerspectiveCamera(
  35,
  container.clientWidth / container.clientHeight,
  0.1,
  100
);

camera.position.set(4.2, 3.4, 5.2);
camera.lookAt(0, 0, 0);

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true
});

renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// ---------- Orbit Controls ----------
const controls = new OrbitControls(camera, renderer.domElement);

controls.enableDamping = true;
controls.dampingFactor = 0.08;

controls.enableRotate = true;
controls.enableZoom = true;
controls.enablePan = true;

controls.autoRotate = true;
controls.autoRotateSpeed = 0.45;

controls.target.set(0, 0, 0);
controls.update();

// ---------- Lights ----------
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 3.4);
keyLight.position.set(4, 6, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
scene.add(keyLight);

const pinkLight = new THREE.PointLight(0xff66cc, 1.4, 8);
pinkLight.position.set(-3, 2.5, 3);
scene.add(pinkLight);

// ---------- Materials ----------
const blueMat = new THREE.MeshPhysicalMaterial({
  color: 0x1264ff,
  roughness: 0.25,
  metalness: 0.05,
  clearcoat: 0.85,
  clearcoatRoughness: 0.18
});

const blackMat = new THREE.MeshStandardMaterial({
  color: 0x050505,
  roughness: 0.42
});

const whiteMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.32
});

const edgeMat = new THREE.LineBasicMaterial({
  color: 0x0050ff,
  transparent: true,
  opacity: 0.75
});

// ---------- Cube setup ----------
const cubeGroup = new THREE.Group();
scene.add(cubeGroup);

const cubies = [];
const cubieSize = 0.72;
const gap = 0.08;
const step = cubieSize + gap;

function createSticker(colorMat, face, patternType = "solid") {
  const stickerGroup = new THREE.Group();

  const baseGeo = new THREE.PlaneGeometry(0.48, 0.48);
  const base = new THREE.Mesh(baseGeo, colorMat);
  stickerGroup.add(base);

  // Add simple graphic pattern on top of some stickers
  if (patternType !== "solid") {
    const shapeMat = colorMat === blackMat ? whiteMat : blackMat;

    if (patternType === "steps") {
      addMiniBlock(stickerGroup, shapeMat, -0.13, -0.13, 0.16, 0.08);
      addMiniBlock(stickerGroup, shapeMat, -0.05, -0.05, 0.16, 0.08);
      addMiniBlock(stickerGroup, shapeMat, 0.03, 0.03, 0.16, 0.08);
    }

    if (patternType === "cross") {
      addMiniBlock(stickerGroup, shapeMat, 0, 0, 0.08, 0.36);
      addMiniBlock(stickerGroup, shapeMat, 0, 0, 0.36, 0.08);
    }

    if (patternType === "zig") {
      addMiniBlock(stickerGroup, shapeMat, -0.14, 0.08, 0.14, 0.08);
      addMiniBlock(stickerGroup, shapeMat, -0.04, 0, 0.14, 0.08);
      addMiniBlock(stickerGroup, shapeMat, 0.06, -0.08, 0.14, 0.08);
    }
  }

  const offset = cubieSize / 2 + 0.006;

  if (face === "front") {
    stickerGroup.position.z = offset;
  }

  if (face === "back") {
    stickerGroup.position.z = -offset;
    stickerGroup.rotation.y = Math.PI;
  }

  if (face === "right") {
    stickerGroup.position.x = offset;
    stickerGroup.rotation.y = Math.PI / 2;
  }

  if (face === "left") {
    stickerGroup.position.x = -offset;
    stickerGroup.rotation.y = -Math.PI / 2;
  }

  if (face === "top") {
    stickerGroup.position.y = offset;
    stickerGroup.rotation.x = -Math.PI / 2;
  }

  if (face === "bottom") {
    stickerGroup.position.y = -offset;
    stickerGroup.rotation.x = Math.PI / 2;
  }

  return stickerGroup;
}

function addMiniBlock(parent, mat, x, y, w, h) {
  const geo = new THREE.PlaneGeometry(w, h);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, 0.006);
  parent.add(mesh);
}

function addEdges(mesh) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    edgeMat
  );
  edges.position.copy(mesh.position);
  edges.rotation.copy(mesh.rotation);
  edges.scale.copy(mesh.scale);
  mesh.add(edges);
}

function createCubie(ix, iy, iz) {
  const geo = new THREE.BoxGeometry(cubieSize, cubieSize, cubieSize);
  const mesh = new THREE.Mesh(geo, blueMat);

  mesh.position.set(ix * step, iy * step, iz * step);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Slightly bevel-like visual by blue edges
  addEdges(mesh);

  const patterns = ["solid", "steps", "cross", "zig"];

  if (iz === 1) {
    const mat = (ix + iy) % 2 === 0 ? whiteMat : blackMat;
    mesh.add(createSticker(mat, "front", patterns[Math.abs(ix + iy + 3) % patterns.length]));
  }

  if (ix === 1) {
    const mat = (iy + iz) % 2 === 0 ? blackMat : whiteMat;
    mesh.add(createSticker(mat, "right", patterns[Math.abs(iy + iz + 2) % patterns.length]));
  }

  if (iy === 1) {
    const mat = (ix + iz) % 2 === 0 ? whiteMat : blueMat;
    mesh.add(createSticker(mat, "top", patterns[Math.abs(ix + iz + 1) % patterns.length]));
  }

  if (ix === -1) {
    mesh.add(createSticker(blueMat, "left", "solid"));
  }

  if (iz === -1) {
    mesh.add(createSticker(blackMat, "back", "solid"));
  }

  if (iy === -1) {
    mesh.add(createSticker(blueMat, "bottom", "solid"));
  }

  mesh.userData.grid = { x: ix, y: iy, z: iz };
  cubies.push(mesh);
  cubeGroup.add(mesh);
}

for (let x = -1; x <= 1; x++) {
  for (let y = -1; y <= 1; y++) {
    for (let z = -1; z <= 1; z++) {
      createCubie(x, y, z);
    }
  }
}

// Rotate cube for poster-like view
cubeGroup.rotation.x = -0.25;
cubeGroup.rotation.y = -0.55;
cubeGroup.rotation.z = 0.08;

// ---------- Layer rotation animation ----------
let rotating = false;
let activeAxis = "y";
let activeLayer = 1;
let activeDirection = 1;
let rotationProgress = 0;
let rotationSpeed = 0.045;
let rotationGroup = null;
let waitTimer = 0;

const moves = [
  { axis: "y", layer: 1, direction: 1 },
  { axis: "x", layer: 1, direction: -1 },
  { axis: "z", layer: 1, direction: 1 },
  { axis: "y", layer: -1, direction: -1 }
];

let moveIndex = 0;

function startMove() {
  const move = moves[moveIndex % moves.length];
  moveIndex++;

  activeAxis = move.axis;
  activeLayer = move.layer;
  activeDirection = move.direction;
  rotationProgress = 0;
  rotating = true;

  rotationGroup = new THREE.Group();
  cubeGroup.add(rotationGroup);

  const selected = cubies.filter((cubie) => {
    const g = cubie.userData.grid;
    return g[activeAxis] === activeLayer;
  });

  selected.forEach((cubie) => {
    rotationGroup.attach(cubie);
  });
}

function finishMove() {
  const selected = [...rotationGroup.children];

  selected.forEach((cubie) => {
    cubeGroup.attach(cubie);

    // Snap positions back to grid visually
    cubie.position.x = Math.round(cubie.position.x / step) * step;
    cubie.position.y = Math.round(cubie.position.y / step) * step;
    cubie.position.z = Math.round(cubie.position.z / step) * step;
  });

  cubeGroup.remove(rotationGroup);
  rotationGroup = null;
  rotating = false;
  waitTimer = 55;

  // Recalculate grid coordinates from position
  cubies.forEach((cubie) => {
    cubie.userData.grid = {
      x: Math.round(cubie.position.x / step),
      y: Math.round(cubie.position.y / step),
      z: Math.round(cubie.position.z / step)
    };
  });
}

function updateLayerRotation() {
  if (!rotating) {
    waitTimer--;

    if (waitTimer <= 0) {
      startMove();
    }

    return;
  }

  const delta = Math.min(rotationSpeed, Math.PI / 2 - rotationProgress);
  rotationProgress += delta;

  if (activeAxis === "x") rotationGroup.rotation.x += delta * activeDirection;
  if (activeAxis === "y") rotationGroup.rotation.y += delta * activeDirection;
  if (activeAxis === "z") rotationGroup.rotation.z += delta * activeDirection;

  if (rotationProgress >= Math.PI / 2 - 0.0001) {
    finishMove();
  }
}

// ---------- Poster decoration ----------
function addDot(x, y, z, r = 0.025) {
  const geo = new THREE.SphereGeometry(r, 12, 8);
  const mat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const dot = new THREE.Mesh(geo, mat);
  dot.position.set(x, y, z);
  scene.add(dot);
}

for (let i = 0; i < 12; i++) {
  addDot(-2.2 + (i % 4) * 0.16, 1.65 - Math.floor(i / 4) * 0.16, -1.8, 0.025);
}

for (let i = 0; i < 9; i++) {
  addDot(2.05 + (i % 3) * 0.16, -1.35 + Math.floor(i / 3) * 0.16, -1.8, 0.025);
}

// ---------- Ground ----------
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(8, 6),
  new THREE.ShadowMaterial({
    color: 0x000000,
    opacity: 0.13
  })
);

ground.rotation.x = -Math.PI / 2;
ground.position.y = -1.55;
ground.receiveShadow = true;
scene.add(ground);

// ---------- Animation ----------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  updateLayerRotation();

  const elapsed = clock.getElapsedTime();

  // Gentle floating / presentation movement
  cubeGroup.rotation.y += 0.004;
  cubeGroup.position.y = Math.sin(elapsed * 1.1) * 0.03;

  controls.update();
  renderer.render(scene, camera);
}

animate();

// ---------- Resize ----------
window.addEventListener("resize", () => {
  const width = container.clientWidth;
  const height = container.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
});