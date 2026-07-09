import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const container = document.getElementById("three-canvas-2");

// ---------- Scene ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020202);

// ---------- Camera ----------
const camera = new THREE.PerspectiveCamera(
  35,
  container.clientWidth / container.clientHeight,
  0.1,
  100
);

camera.position.set(0, 0.15, 8.2);
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

// ---------- Camera Controls ----------
// Fixed view: no orbit rotation, but zoom is allowed.
const controls = new OrbitControls(camera, renderer.domElement);

controls.enableDamping = true;
controls.dampingFactor = 0.08;

controls.enableRotate = false;
controls.enablePan = false;
controls.enableZoom = true;

controls.zoomSpeed = 0.7;
controls.minDistance = 5.2;
controls.maxDistance = 11;

controls.autoRotate = false;

controls.target.set(0, 0, 0);
controls.update();

// ---------- Lights ----------
const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 3.1);
keyLight.position.set(2.8, 4.2, 5);
keyLight.castShadow = true;
scene.add(keyLight);

const blueLight = new THREE.PointLight(0x4f7cff, 3.6, 10);
blueLight.position.set(-3.5, 1.2, 3.2);
scene.add(blueLight);

const pinkLight = new THREE.PointLight(0xff70bd, 2.2, 10);
pinkLight.position.set(3.2, -1.2, 3.5);
scene.add(pinkLight);

const cyanLight = new THREE.PointLight(0x38ffd6, 1.6, 8);
cyanLight.position.set(0, 2.6, 3.8);
scene.add(cyanLight);

// ---------- Materials ----------
function makeMaterial(hex) {
  return new THREE.MeshPhysicalMaterial({
    color: hex,
    roughness: 0.36,
    metalness: 0.02,
    clearcoat: 0.78,
    clearcoatRoughness: 0.2
  });
}

// front colors
const orangeMat = makeMaterial(0xff5a35);
const yellowMat = makeMaterial(0xffb65a);
const pinkMat = makeMaterial(0xe9a6bd);

// back tech colors
const cyanMat = makeMaterial(0x26f2d0);
const electricBlueMat = makeMaterial(0x2f7cff);
const neonGreenMat = makeMaterial(0x9cff5a);

const faceMat = new THREE.MeshBasicMaterial({
  color: 0x111111
});

// ---------- Clover Geometry ----------
const cloverGroup = new THREE.Group();
scene.add(cloverGroup);

const petalGeo = new THREE.SphereGeometry(0.31, 36, 24);
const centerGeo = new THREE.SphereGeometry(0.135, 24, 16);

function createSmile() {
  const group = new THREE.Group();

  // Eyes
  const eyeGeo = new THREE.SphereGeometry(0.024, 12, 8);

  const leftEye = new THREE.Mesh(eyeGeo, faceMat);
  leftEye.position.set(-0.075, 0.045, 0.325);
  group.add(leftEye);

  const rightEye = new THREE.Mesh(eyeGeo, faceMat);
  rightEye.position.set(0.075, 0.045, 0.325);
  group.add(rightEye);

  // Cute smile curve
  const points = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const x = -0.12 + t * 0.24;
    const y = -0.02 - Math.sin(t * Math.PI) * 0.055;
    points.push(new THREE.Vector3(x, y, 0.327));
  }

  const smileGeo = new THREE.BufferGeometry().setFromPoints(points);
  const smile = new THREE.Line(
    smileGeo,
    new THREE.LineBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.9
    })
  );

  group.add(smile);

  return group;
}

function createClover(frontMat, backMat, x, y, delay) {
  const root = new THREE.Group();
  root.position.set(x, y, 0);
  root.userData.delay = delay;

  const front = new THREE.Group();
  const back = new THREE.Group();

  const petalPositions = [
    [0, 0.23, 0],
    [0, -0.23, 0],
    [-0.23, 0, 0],
    [0.23, 0, 0]
  ];

  // Front petals
  petalPositions.forEach(([px, py, pz]) => {
    const petal = new THREE.Mesh(petalGeo, frontMat);
    petal.position.set(px, py, pz);
    petal.scale.set(1.05, 1.05, 0.24);
    petal.castShadow = true;
    petal.receiveShadow = true;
    front.add(petal);
  });

  const center = new THREE.Mesh(centerGeo, frontMat);
  center.scale.set(1, 1, 0.26);
  center.castShadow = true;
  front.add(center);

  const smile = createSmile();
  front.add(smile);

  // Back petals
  petalPositions.forEach(([px, py, pz]) => {
    const petal = new THREE.Mesh(petalGeo, backMat);
    petal.position.set(px, py, -0.08);
    petal.scale.set(1.05, 1.05, 0.24);
    petal.castShadow = true;
    petal.receiveShadow = true;
    back.add(petal);
  });

  const backCenter = new THREE.Mesh(centerGeo, backMat);
  backCenter.position.z = -0.08;
  backCenter.scale.set(1, 1, 0.26);
  back.add(backCenter);

  // The back side faces the opposite direction.
  back.rotation.y = Math.PI;

  root.add(front);
  root.add(back);

  cloverGroup.add(root);
  return root;
}

// ---------- Grid ----------
const clovers = [];

const cols = 6;
const rows = 5;

// Larger spacing than before
const spacingX = 1.26;
const spacingY = 1.16;

const frontMats = [orangeMat, yellowMat, pinkMat];
const backMats = [cyanMat, electricBlueMat, neonGreenMat];

for (let row = 0; row < rows; row++) {
  for (let col = 0; col < cols; col++) {
    const x = (col - (cols - 1) / 2) * spacingX;
    const y = ((rows - 1) / 2 - row) * spacingY;

    const frontMat = frontMats[row % frontMats.length];
    const backMat = backMats[(row + col) % backMats.length];

    // Column-based delay creates wave-like flipping.
    const delay = col * 0.24 + row * 0.08;

    const clover = createClover(frontMat, backMat, x, y, delay);
    clovers.push(clover);
  }
}

// Slight tilt so the flowers still feel 3D.
cloverGroup.rotation.x = -0.06;

// ---------- Decorative Black Dots ----------
const dotMat = new THREE.MeshBasicMaterial({
  color: 0x111111,
  transparent: true,
  opacity: 0.65
});

function addDot(x, y, z, r = 0.025) {
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(r, 10, 8),
    dotMat
  );
  dot.position.set(x, y, z);
  scene.add(dot);
}

for (let i = 0; i < 14; i++) {
  addDot(-3.75 + (i % 4) * 0.15, 2.2 - Math.floor(i / 4) * 0.15, 0.35);
}

for (let i = 0; i < 16; i++) {
  addDot(3.25 + (i % 4) * 0.15, -2.1 + Math.floor(i / 4) * 0.15, 0.35);
}

// ---------- Animation ----------
const clock = new THREE.Clock();

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();

  clovers.forEach((clover) => {
    const cycle = 4.8;
    const local = (elapsed + clover.userData.delay) % cycle;

    let targetRotation = 0;

    // Hold front
    if (local < 1.35) {
      targetRotation = 0;
    }
    // Flip to back
    else if (local < 2.25) {
      const t = (local - 1.35) / 0.9;
      targetRotation = easeInOutCubic(t) * Math.PI;
    }
    // Hold back
    else if (local < 3.45) {
      targetRotation = Math.PI;
    }
    // Flip back to front
    else {
      const t = (local - 3.45) / 1.35;
      targetRotation = Math.PI + easeInOutCubic(t) * Math.PI;
    }

    clover.rotation.y = targetRotation;

    // tiny floating motion
    clover.position.z =
      Math.sin(elapsed * 1.45 + clover.userData.delay * 2.0) * 0.028;
  });

  // Very subtle breathing, but camera stays fixed.
  cloverGroup.rotation.z = Math.sin(elapsed * 0.18) * 0.018;

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