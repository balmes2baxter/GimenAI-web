import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const isMobileScreen = () => window.innerWidth < 860;

// ============================================================================
// ESTADO GLOBAL
// ============================================================================
const state = {
  activeStep: 0,
  emotion: 'happy',
  faceStyle: 'pixel',
  viewMode: 'normal', // 'normal' | 'xray' | 'exploded'
  qrOnTftForced: false,
  isSpeaking: false,
  mouthOpen: 0,
  blinkProgress: 0,
  nextBlinkTime: 2.0,
  lookTarget: new THREE.Vector2(0, 0),
  smoothLook: new THREE.Vector2(0, 0),
  pokeBounce: 0,
  cloudFallbackMode: false,
  userOrbiting: false,
  tftDirty: true,
  lastTftUpdate: 0,
  devices: {
    sala: false,
    cocina: false,
    ventilador: false,
    tuya: false,
  },
};

const qrImage = new Image();
qrImage.crossOrigin = 'anonymous';
qrImage.src = 'assets/qr-gimenai-web.png';
let qrImageLoaded = false;
qrImage.onload = () => {
  qrImageLoaded = true;
  state.tftDirty = true;
};

// ============================================================================
// CAPÍTULOS CON ENCUADRE POR PIEZA (TRANSICIONES ÁGILES)
// ============================================================================
const SCROLL_CHAPTERS = [
  {
    step: 0,
    counter: '01/08',
    beaconLabel: 'Gimena · Vista General',
    mobileScale: 0.44,
    mobileFocusY: 0.05,
    mobileCamZ: 8.6,
    desktopScale: 0.78,
    camPos: new THREE.Vector3(-1.25, 0.25, 7.6),
    camTarget: new THREE.Vector3(-0.95, -0.05, 0),
    robotRotY: -0.16,
    viewMode: 'normal',
    anchorLocal: new THREE.Vector3(0, 1.05, 0.94),
    highlightRadius: 0,
    showPointer: false,
  },
  {
    step: 1,
    counter: '02/08',
    beaconLabel: 'Pantalla TFT 2.4" (320×240)',
    mobileScale: 0.58,
    mobileFocusY: 1.08,
    mobileCamZ: 6.4,
    desktopScale: 0.85,
    camPos: new THREE.Vector3(-0.9, 0.85, 5.2),
    camTarget: new THREE.Vector3(-0.8, 0.7, 0),
    robotRotY: -0.06,
    viewMode: 'normal',
    anchorLocal: new THREE.Vector3(0, 1.14, 0.94),
    highlightRadius: 0.88,
    showPointer: true,
  },
  {
    step: 2,
    counter: '03/08',
    beaconLabel: 'Micrófono Digital INMP441',
    mobileScale: 0.64,
    mobileFocusY: 0.32,
    mobileCamZ: 5.8,
    desktopScale: 0.88,
    camPos: new THREE.Vector3(-0.65, 0.25, 4.8),
    camTarget: new THREE.Vector3(-0.55, 0.18, 0),
    robotRotY: -0.24,
    viewMode: 'normal',
    anchorLocal: new THREE.Vector3(0.62, 0.26, 0.92),
    highlightRadius: 0.22,
    showPointer: true,
  },
  {
    step: 3,
    counter: '04/08',
    beaconLabel: '19 Perforaciones + Parlante I2S',
    mobileScale: 0.58,
    mobileFocusY: -0.72,
    mobileCamZ: 6.3,
    desktopScale: 0.85,
    camPos: new THREE.Vector3(-0.9, -0.55, 5.3),
    camTarget: new THREE.Vector3(-0.8, -0.65, 0),
    robotRotY: -0.08,
    viewMode: 'normal',
    anchorLocal: new THREE.Vector3(0, -0.76, 1.03),
    highlightRadius: 0.48,
    showPointer: true,
  },
  {
    step: 4,
    counter: '05/08',
    beaconLabel: 'Unión 2 Mitades PLA + Brazo',
    mobileScale: 0.48,
    mobileFocusY: -0.35,
    mobileCamZ: 7.8,
    desktopScale: 0.8,
    camPos: new THREE.Vector3(-1.1, 0.05, 6.8),
    camTarget: new THREE.Vector3(-0.95, -0.15, 0),
    robotRotY: Math.PI * 0.48,
    viewMode: 'normal',
    anchorLocal: new THREE.Vector3(-1.62, -0.78, 0.32),
    highlightRadius: 0.52,
    showPointer: true,
  },
  {
    step: 5,
    counter: '06/08',
    beaconLabel: '5 Ranuras + Grabado "Gimena"',
    mobileScale: 0.54,
    mobileFocusY: 0.55,
    mobileCamZ: 6.8,
    desktopScale: 0.82,
    camPos: new THREE.Vector3(-1.0, 0.15, 6.2),
    camTarget: new THREE.Vector3(-0.9, -0.05, 0),
    robotRotY: Math.PI * 0.96,
    viewMode: 'normal',
    anchorLocal: new THREE.Vector3(0, 0.72, -0.92),
    highlightRadius: 0.78,
    showPointer: true,
  },
  {
    step: 6,
    counter: '07/08',
    beaconLabel: 'Interior Rayos-X + ESP32',
    mobileScale: 0.44,
    mobileFocusY: -0.1,
    mobileCamZ: 8.6,
    desktopScale: 0.76,
    camPos: new THREE.Vector3(-1.15, 0.2, 7.4),
    camTarget: new THREE.Vector3(-0.95, -0.1, 0),
    robotRotY: -0.32,
    viewMode: 'exploded',
    anchorLocal: new THREE.Vector3(0, -0.92, -0.18),
    highlightRadius: 0.65,
    showPointer: true,
  },
  {
    step: 7,
    counter: '08/08',
    beaconLabel: '📲 ¡Escanea el QR en mi TFT!',
    mobileScale: 0.66,
    mobileFocusY: 1.12,
    mobileCamZ: 5.5,
    desktopScale: 0.9,
    camPos: new THREE.Vector3(-0.65, 1.05, 4.2),
    camTarget: new THREE.Vector3(-0.55, 1.02, 0),
    robotRotY: 0,
    viewMode: 'normal',
    anchorLocal: new THREE.Vector3(0.18, 1.12, 0.94),
    highlightRadius: 0.85,
    showPointer: true,
  },
];

// ============================================================================
// PRE-CACHÉ DE SPRITES DE OJOS PIXEL-ART (CERO BUCLES PESADOS EN CADA FRAME)
// ============================================================================
const P_SCALE = 4;

function buildEyeSprite(withHeart = false) {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 96;
  const ctx = c.getContext('2d');
  const cx = 12;
  const cy = 12;
  const rx = 10;
  const ry = 11;

  const p = (x, y, w, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(x * P_SCALE, y * P_SCALE, w * P_SCALE, h * P_SCALE);
  };

  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const norm = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
      if (norm > 1.0) continue;
      if (norm >= 0.72) {
        p(cx + dx, cy + dy, 1, 1, '#162564');
      } else {
        const isLower =
          dy > 1 &&
          (dx * dx) / ((rx - 1.5) ** 2) + ((dy - 1) * (dy - 1)) / ((ry - 1.5) ** 2) > 0.35;
        p(cx + dx, cy + dy, 1, 1, isLower ? '#00d8ff' : dy < -2 ? '#1c42b8' : '#245be0');
      }
    }
  }

  if (withHeart) {
    const hc = '#ff4d94';
    p(cx - 2, cy - 2, 2, 2, hc);
    p(cx + 1, cy - 2, 2, 2, hc);
    p(cx - 3, cy - 1, 7, 2, hc);
    p(cx - 2, cy + 1, 5, 2, hc);
  }

  p(cx - 4, cy - 4, 4, 4, '#ffffff');
  p(cx + 2, cy + 2, 2, 2, '#ffffff');
  return c;
}

const eyeSpriteNormal = buildEyeSprite(false);
const eyeSpriteLove = buildEyeSprite(true);

function createEngravedGimenaTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  ctx.font = '700 42px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(180, 205, 240, 0.28)';
  ctx.strokeText('Gimena', 128, 42);
  ctx.fillStyle = '#040507';
  ctx.fillText('Gimena', 128, 40);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSoftShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  g.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

// ============================================================================
// PANTALLA TFT 320x240 ULTRARRÁPIDA (CON SPRITES PRE-CACHEADOS)
// ============================================================================
const tftCanvas = document.createElement('canvas');
tftCanvas.width = 320;
tftCanvas.height = 240;
const tftCtx = tftCanvas.getContext('2d');

const tftTexture = new THREE.CanvasTexture(tftCanvas);
tftTexture.colorSpace = THREE.SRGBColorSpace;
tftTexture.minFilter = THREE.LinearFilter;
tftTexture.magFilter = THREE.NearestFilter;

function pRect(px, py, pw, ph, color) {
  tftCtx.fillStyle = color;
  tftCtx.fillRect(
    Math.round(px) * P_SCALE,
    Math.round(py) * P_SCALE,
    Math.round(pw) * P_SCALE,
    Math.round(ph) * P_SCALE
  );
}

function drawFastEye(centerPx, centerPy, lookX, lookY, emotion, blink, scale = 1) {
  const cx = Math.round(centerPx + lookX * 3.0);
  const cy = Math.round(centerPy + lookY * 2.0);

  if (blink > 0.55 || emotion === 'sleepy') {
    pRect(cx - 8, cy, 16, 2, '#182868');
    return;
  }

  const sprite = emotion === 'love' ? eyeSpriteLove : eyeSpriteNormal;
  const size = Math.round(96 * scale);
  tftCtx.drawImage(sprite, cx * P_SCALE - size * 0.5, cy * P_SCALE - size * 0.5, size, size);
}

function drawPixelMouth(centerPx, centerPy, emotion, isSpeaking, mouthOpen) {
  const navy = '#162564';
  if (isSpeaking && mouthOpen > 0.18) {
    const h = Math.max(2, Math.round(mouthOpen * 6));
    pRect(centerPx - 5, centerPy - 1, 10, h + 2, navy);
    pRect(centerPx - 4, centerPy, 8, h, '#ff6b8b');
    return;
  }
  if (emotion === 'surprised') {
    pRect(centerPx - 3, centerPy - 1, 6, 6, navy);
    pRect(centerPx - 2, centerPy, 4, 4, '#9fd6ff');
    return;
  }
  if (emotion === 'sad') {
    pRect(centerPx - 5, centerPy + 1, 10, 2, navy);
    return;
  }
  const wOffsets = [
    [-7, -1], [-6, 0], [-5, 1], [-4, 2], [-3, 2], [-2, 1], [-1, 0],
    [0, -1],
    [1, 0], [2, 1], [3, 2], [4, 2], [5, 1], [6, 0], [7, -1],
  ];
  for (const [dx, dy] of wOffsets) {
    pRect(centerPx + dx, centerPy + dy, 1, 2, navy);
  }
}

function renderQrModeOnTft(timeSec, lx, ly) {
  tftCtx.fillStyle = '#9cd4ff';
  tftCtx.fillRect(0, 0, 320, 240);

  drawFastEye(12, 20, lx * 0.5, ly * 0.5, 'happy', state.blinkProgress, 0.62);
  drawFastEye(27, 20, lx * 0.5, ly * 0.5, 'happy', state.blinkProgress, 0.62);
  pRect(7, 28, 4, 2, '#ff9ebb');
  pRect(28, 28, 4, 2, '#ff9ebb');
  drawPixelMouth(19, 32, 'happy', state.isSpeaking, state.mouthOpen);

  tftCtx.fillStyle = '#162564';
  tftCtx.font = '700 12px "JetBrains Mono", monospace';
  tftCtx.fillText('ESCANÉAME', 12, 174);
  tftCtx.fillText('EN VIVO >>', 12, 192);

  const qrBoxX = 114;
  const qrBoxY = 18;
  const qrBoxSize = 194;
  tftCtx.fillStyle = '#162564';
  tftCtx.fillRect(qrBoxX - 3, qrBoxY - 3, qrBoxSize + 6, qrBoxSize + 6);
  tftCtx.fillStyle = '#ffffff';
  tftCtx.fillRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);

  if (qrImageLoaded) {
    tftCtx.imageSmoothingEnabled = false;
    tftCtx.drawImage(qrImage, qrBoxX + 5, qrBoxY + 5, qrBoxSize - 10, qrBoxSize - 10);
  }

  const laserY = qrBoxY + 6 + (Math.sin(timeSec * 3.2) * 0.5 + 0.5) * (qrBoxSize - 12);
  tftCtx.fillStyle = 'rgba(0, 216, 255, 0.35)';
  tftCtx.fillRect(qrBoxX + 2, laserY, qrBoxSize - 4, 3);
}

function renderTFTScreen(timeSec) {
  // Limitar actualización del canvas TFT a ~22 FPS para máxima agilidad en móvil
  if (!state.tftDirty && timeSec - state.lastTftUpdate < 0.045) return;
  state.lastTftUpdate = timeSec;
  state.tftDirty = false;

  const emotion = state.emotion;
  const lx = state.smoothLook.x;
  const ly = state.smoothLook.y;

  if (emotion === 'qr' || state.activeStep === 7 || state.qrOnTftForced) {
    renderQrModeOnTft(timeSec, lx, ly);
    tftTexture.needsUpdate = true;
    return;
  }

  if (state.faceStyle === 'pixel') {
    tftCtx.fillStyle = '#a2d8ff';
    tftCtx.fillRect(0, 0, 320, 240);

    if (emotion === 'love') {
      for (let i = 0; i < 4; i++) {
        const hx = 12 + ((i * 16) % 62);
        const hy = 56 - Math.floor((timeSec * 14 + i * 11) % 54);
        pRect(hx, hy, 3, 3, '#ff4d94');
      }
    } else if (emotion === 'music') {
      for (let b = 0; b < 12; b++) {
        const bh = 2 + Math.round(Math.abs(Math.sin(timeSec * 7 + b * 0.7)) * 6);
        pRect(14 + b * 4.5, 56 - bh, 3, bh, '#245be0');
      }
    }

    if (emotion === 'love' || state.pokeBounce > 0.05) {
      pRect(14, 34, 6, 3, '#ff9ebb');
      pRect(60, 34, 6, 3, '#ff9ebb');
    }

    drawFastEye(25, 24, lx, ly, emotion, state.blinkProgress);
    drawFastEye(55, 24, lx, ly, emotion, state.blinkProgress);
    drawPixelMouth(40, 43, emotion, state.isSpeaking, state.mouthOpen);
  } else {
    tftCtx.fillStyle = '#a8d8ff';
    tftCtx.fillRect(0, 0, 320, 240);
    tftCtx.fillStyle = '#1e423c';
    tftCtx.beginPath();
    tftCtx.ellipse(160, 130, 86, 92, 0, 0, Math.PI * 2);
    tftCtx.fill();
    tftCtx.fillStyle = '#ffe5d0';
    tftCtx.beginPath();
    tftCtx.ellipse(160, 128, 66, 62, 0, 0, Math.PI * 2);
    tftCtx.fill();
    [124, 196].forEach((ox) => {
      tftCtx.fillStyle = '#ffffff';
      tftCtx.beginPath();
      tftCtx.ellipse(ox, 130, 19, 21, 0, 0, Math.PI * 2);
      tftCtx.fill();
      tftCtx.fillStyle = '#3b5bdb';
      tftCtx.beginPath();
      tftCtx.ellipse(ox + lx * 6, 131 + ly * 4, 13, 17, 0, 0, Math.PI * 2);
      tftCtx.fill();
    });
  }

  tftTexture.needsUpdate = true;
}

// ============================================================================
// ESCENA THREE.JS ULTRALIGERA
// ============================================================================
const container = document.getElementById('canvasContainer');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.1, 50);

const renderer = new THREE.WebGLRenderer({
  antialias: !isMobileScreen(),
  alpha: true,
  powerPreference: 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobileScreen() ? 1.25 : 1.75));
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.enableZoom = false;
controls.enablePan = false;

if (isMobileScreen()) {
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
  };
}

controls.addEventListener('start', () => {
  state.userOrbiting = true;
});
controls.addEventListener('end', () => {
  setTimeout(() => {
    state.userOrbiting = false;
  }, 1000);
});

scene.add(new THREE.AmbientLight(0xdbeafe, 1.25));

const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
keyLight.position.set(4, 6, 5);
scene.add(keyLight);

const backLight = new THREE.DirectionalLight(0x93c5fd, 1.6);
backLight.position.set(-3.5, 4, -5.5);
scene.add(backLight);

const roomSmartLight = new THREE.PointLight(0xfbbf24, 0, 11);
roomSmartLight.position.set(-2, 3.5, 3);
scene.add(roomSmartLight);

// Material ligero MeshStandardMaterial en lugar de PhysicalMaterial pesado
const blackPlaMaterial = new THREE.MeshStandardMaterial({
  color: 0x141821,
  roughness: 0.25,
  metalness: 0.14,
  transparent: true,
  opacity: 1.0,
});

const darkCavityMaterial = new THREE.MeshBasicMaterial({ color: 0x040508 });
const seamLineMaterial = new THREE.MeshBasicMaterial({ color: 0x05070b });

// ============================================================================
// CONSTRUCCIÓN DE GIMENA 3D (GEOMETRÍA OPTIMIZADA DE BAJOS POLÍGONOS)
// ============================================================================
const gimenaRoot = new THREE.Group();
const initialScale = isMobileScreen() ? SCROLL_CHAPTERS[0].mobileScale : SCROLL_CHAPTERS[0].desktopScale;
gimenaRoot.scale.setScalar(initialScale);
scene.add(gimenaRoot);

const focusRingGeo = new THREE.RingGeometry(0.88, 0.94, 32);
const focusRingMat = new THREE.MeshBasicMaterial({
  color: 0x00d8ff,
  transparent: true,
  opacity: 0,
  side: THREE.DoubleSide,
  depthTest: false,
});
const partFocusRing3D = new THREE.Mesh(focusRingGeo, focusRingMat);
gimenaRoot.add(partFocusRing3D);

const shadowPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(4.4, 4.4),
  new THREE.MeshBasicMaterial({
    map: createSoftShadowTexture(),
    transparent: true,
    depthWrite: false,
  })
);
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.position.y = -2.02;
gimenaRoot.add(shadowPlane);

// 1. CABEZA
const headGroup = new THREE.Group();
headGroup.position.set(0, 1.02, 0);
gimenaRoot.add(headGroup);

headGroup.add(new THREE.Mesh(new RoundedBoxGeometry(2.38, 2.24, 1.78, 2, 0.11), blackPlaMaterial));
headGroup.add(new THREE.Mesh(new THREE.BoxGeometry(2.405, 2.25, 0.026), seamLineMaterial));

const bezelRecessMesh = new THREE.Mesh(new THREE.BoxGeometry(1.66, 1.26, 0.1), darkCavityMaterial);
bezelRecessMesh.position.set(0, 0.12, 0.86);
headGroup.add(bezelRecessMesh);

const tftScreenMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(1.56, 1.17),
  new THREE.MeshBasicMaterial({ map: tftTexture })
);
tftScreenMesh.position.set(0, 0.12, 0.925);
tftScreenMesh.name = 'screen';
headGroup.add(tftScreenMesh);

const frontSlotMesh = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.085, 0.06), darkCavityMaterial);
frontSlotMesh.position.set(-0.16, -0.76, 0.87);
headGroup.add(frontSlotMesh);

const micRimMesh = new THREE.Mesh(
  new THREE.RingGeometry(0.055, 0.088, 16),
  new THREE.MeshBasicMaterial({ color: 0x475569, side: THREE.DoubleSide })
);
micRimMesh.position.set(0.62, -0.76, 0.906);
headGroup.add(micRimMesh);

const micHoleMesh = new THREE.Mesh(new THREE.CircleGeometry(0.055, 16), darkCavityMaterial);
micHoleMesh.position.set(0.62, -0.76, 0.904);
micHoleMesh.name = 'mic';
headGroup.add(micHoleMesh);

// Espalda: 5 ranuras verticales + Grabado "Gimena"
const backVentGroup = new THREE.Group();
backVentGroup.position.set(0, 0.36, -0.892);
headGroup.add(backVentGroup);
const slotGeo = new THREE.BoxGeometry(0.11, 0.42, 0.05);
for (let i = -2; i <= 2; i++) {
  const slot = new THREE.Mesh(slotGeo, darkCavityMaterial);
  slot.position.set(i * 0.27, 0, 0);
  backVentGroup.add(slot);
}

const gimenaLogoPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(1.55, 0.48),
  new THREE.MeshBasicMaterial({ map: createEngravedGimenaTexture(), transparent: true })
);
gimenaLogoPlane.position.set(0, -0.42, -0.895);
gimenaLogoPlane.rotation.y = Math.PI;
headGroup.add(gimenaLogoPlane);

// 2. TORSO
const torsoGroup = new THREE.Group();
torsoGroup.position.set(0, -0.82, 0);
gimenaRoot.add(torsoGroup);

torsoGroup.add(new THREE.Mesh(new RoundedBoxGeometry(3.16, 1.52, 2.02, 2, 0.11), blackPlaMaterial));
torsoGroup.add(new THREE.Mesh(new THREE.BoxGeometry(3.185, 1.53, 0.026), seamLineMaterial));

const neckCollarMesh = new THREE.Mesh(new THREE.BoxGeometry(2.54, 0.14, 1.88), blackPlaMaterial);
neckCollarMesh.position.set(0, 0.78, 0);
torsoGroup.add(neckCollarMesh);

// 19 perforaciones del parlante en 1 sola llamada de dibujo (InstancedMesh)
const holeCoords = [[0, 0]];
for (let i = 0; i < 6; i++) {
  const a = (i * Math.PI) / 3;
  holeCoords.push([Math.cos(a) * 0.175, Math.sin(a) * 0.175]);
}
for (let i = 0; i < 12; i++) {
  const a = (i * Math.PI) / 6;
  holeCoords.push([Math.cos(a) * 0.35, Math.sin(a) * 0.35]);
}
const holeInstanced = new THREE.InstancedMesh(
  new THREE.CircleGeometry(0.048, 12),
  darkCavityMaterial,
  holeCoords.length
);
const dummy = new THREE.Object3D();
holeCoords.forEach(([hx, hy], idx) => {
  dummy.position.set(hx, hy + 0.06, 1.012);
  dummy.updateMatrix();
  holeInstanced.setMatrixAt(idx, dummy.matrix);
});
torsoGroup.add(holeInstanced);

const soundWaveRings = [];
for (let i = 0; i < 2; i++) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.21, 20),
    new THREE.MeshBasicMaterial({ color: 0x00d8ff, transparent: true, opacity: 0, side: THREE.DoubleSide })
  );
  ring.position.set(0, 0.06, 1.04);
  torsoGroup.add(ring);
  soundWaveRings.push(ring);
}

const usbPortCutoutMesh = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.12), darkCavityMaterial);
usbPortCutoutMesh.position.set(0, -0.42, -0.98);
torsoGroup.add(usbPortCutoutMesh);

// 3. BRAZOS LATERALES
function createSideArm(isLeft) {
  const group = new THREE.Group();
  const sign = isLeft ? -1 : 1;
  group.position.set(sign * 1.62, -0.86, 0.36);

  const shoulderPeg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 12), blackPlaMaterial);
  shoulderPeg.rotation.z = Math.PI / 2;
  group.add(shoulderPeg);

  const armBlock = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.68, 0.38, 2, 0.08), blackPlaMaterial);
  armBlock.position.set(sign * 0.16, -0.04, 0);
  group.add(armBlock);
  return group;
}

const leftArmGroup = createSideArm(true);
const rightArmGroup = createSideArm(false);
gimenaRoot.add(leftArmGroup);
gimenaRoot.add(rightArmGroup);

// 4. PIES
const feetGroup = new THREE.Group();
feetGroup.position.set(0, -1.78, 0.14);
gimenaRoot.add(feetGroup);

[-0.78, 0.78].forEach((fx) => {
  const foot = new THREE.Mesh(new RoundedBoxGeometry(0.92, 0.46, 1.62, 2, 0.08), blackPlaMaterial);
  foot.position.set(fx, 0, 0);
  feetGroup.add(foot);

  const footSeam = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.47, 0.026), seamLineMaterial);
  footSeam.position.set(fx, 0, -0.14);
  feetGroup.add(footSeam);
});

// 5. CABLE USB BLANCO TRASERO
const usbCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0.0, -1.24, -0.96),
  new THREE.Vector3(0.18, -1.55, -1.45),
  new THREE.Vector3(0.65, -1.88, -2.05),
  new THREE.Vector3(1.45, -1.96, -2.85),
]);
gimenaRoot.add(
  new THREE.Mesh(
    new THREE.TubeGeometry(usbCurve, 16, 0.055, 8, false),
    new THREE.MeshBasicMaterial({ color: 0xf1f5f9 })
  )
);

// 6. PARTES INTERNAS DETALLADAS
const internalsGroup = new THREE.Group();
gimenaRoot.add(internalsGroup);

const internalTftPcb = new THREE.Mesh(
  new THREE.BoxGeometry(1.62, 1.22, 0.07),
  new THREE.MeshBasicMaterial({ color: 0xdc2626 })
);
internalTftPcb.position.set(0, 1.14, 0.65);
internalsGroup.add(internalTftPcb);

const internalMicPcb = new THREE.Mesh(
  new THREE.CylinderGeometry(0.16, 0.16, 0.06, 12),
  new THREE.MeshBasicMaterial({ color: 0x8b5cf6 })
);
internalMicPcb.rotation.x = Math.PI / 2;
internalMicPcb.position.set(0.62, 0.26, 0.72);
internalsGroup.add(internalMicPcb);

const speakerCone = new THREE.Mesh(
  new THREE.CylinderGeometry(0.42, 0.28, 0.26, 16),
  new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
);
speakerCone.rotation.x = Math.PI / 2;
speakerCone.position.set(0, -0.76, 0.58);
internalsGroup.add(speakerCone);

const esp32Group = new THREE.Group();
esp32Group.position.set(0, -0.92, -0.18);
internalsGroup.add(esp32Group);

esp32Group.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.88), new THREE.MeshBasicMaterial({ color: 0x10b981 })));
const wifiShield = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.12, 0.52), new THREE.MeshBasicMaterial({ color: 0xe2e8f0 }));
wifiShield.position.set(-0.25, 0.08, 0);
esp32Group.add(wifiShield);

const espLedMesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({ color: 0x00d8ff }));
espLedMesh.position.set(0.52, 0.09, 0.22);
esp32Group.add(espLedMesh);

// ============================================================================
// FLECHAS DE PARTES INTERNAS (CON TRANSLATE3D ACELERADO POR GPU)
// ============================================================================
const internalPinsLayer = document.getElementById('internalPinsLayer');
const INTERNAL_PARTS_DEFS = [
  {
    label: 'PCB TFT ST7789',
    pos: new THREE.Vector3(-0.45, 1.35, 0.65),
    info: 'Placa controladora SPI de la pantalla TFT 2.4 pulgadas (320×240 px).',
  },
  {
    label: 'Chip Mic INMP441',
    pos: new THREE.Vector3(0.68, 0.26, 0.72),
    info: 'Sensor MEMS digital omnidireccional de 24-bit para escuchar tu voz.',
  },
  {
    label: 'Amp MAX98357A',
    pos: new THREE.Vector3(0.55, -0.62, 0.58),
    info: 'Amplificador clase D I2S conectado al altavoz detrás de las 19 perforaciones.',
  },
  {
    label: 'ESP32 Dual-Core',
    pos: new THREE.Vector3(-0.55, -1.08, -0.18),
    info: 'Cerebro principal a 240 MHz conectado a Gemini 3.5, relés IoT y servidor PC.',
  },
];

const internalPinNodes = INTERNAL_PARTS_DEFS.map((item) => {
  const btn = document.createElement('button');
  btn.className = 'internal-pin';
  btn.textContent = item.label;
  btn.style.display = 'none';
  btn.addEventListener('click', () => {
    state.pokeBounce = 0.22;
    gimenaSpeak(item.info, 'surprised');
  });
  internalPinsLayer.appendChild(btn);
  return { ...item, el: btn };
});

const tempVec = new THREE.Vector3();

function updateInternalPins() {
  const showInternals = state.viewMode === 'xray' || state.viewMode === 'exploded';
  const w = window.innerWidth;
  const h = window.innerHeight;

  internalPinNodes.forEach((p) => {
    if (!showInternals) {
      if (p.el.style.display !== 'none') p.el.style.display = 'none';
      return;
    }
    tempVec.copy(p.pos).applyMatrix4(gimenaRoot.matrixWorld).project(camera);
    const x = (tempVec.x * 0.5 + 0.5) * w;
    const y = (-tempVec.y * 0.5 + 0.5) * h;
    if (p.el.style.display !== 'inline-flex') p.el.style.display = 'inline-flex';
    p.el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
  });
}

// ============================================================================
// FLECHA SVG DINÁMICA (ACELERADA POR GPU SIN REFLOW)
// ============================================================================
const pointerPath = document.getElementById('pointerPath');
const targetBeacon = document.getElementById('targetBeacon');
const beaconTag = document.getElementById('beaconTag');
const activeStepIndicator = document.getElementById('activeStepIndicator');
let activeCardElement = document.querySelector('.scroll-step[data-step="0"] .mini-card');

function updatePointerLine() {
  const chapter = SCROLL_CHAPTERS[state.activeStep] || SCROLL_CHAPTERS[0];

  if (!chapter.showPointer || !activeCardElement) {
    targetBeacon.style.opacity = '0';
    pointerPath.setAttribute('d', '');
    return;
  }

  tempVec.copy(chapter.anchorLocal).applyMatrix4(gimenaRoot.matrixWorld).project(camera);

  const w = window.innerWidth;
  const h = window.innerHeight;
  const tx = THREE.MathUtils.clamp((tempVec.x * 0.5 + 0.5) * w, 45, w - 45);
  const ty = THREE.MathUtils.clamp((-tempVec.y * 0.5 + 0.5) * h, 48, h * 0.56);

  targetBeacon.style.opacity = '1';
  targetBeacon.style.transform = `translate3d(${tx}px, ${ty}px, 0) translate(-50%, -50%)`;

  const rect = activeCardElement.getBoundingClientRect();

  if (isMobileScreen()) {
    const sx = rect.left + rect.width * 0.5;
    const sy = rect.top;
    const cy1 = sy - (sy - ty) * 0.45;
    const cy2 = ty + (sy - ty) * 0.25;
    pointerPath.setAttribute('d', `M ${sx} ${sy} C ${sx} ${cy1}, ${tx} ${cy2}, ${tx} ${ty + 9}`);
  } else {
    const sx = rect.right;
    const sy = rect.top + rect.height * 0.45;
    const cx1 = sx + (tx - sx) * 0.45;
    const cx2 = sx + (tx - sx) * 0.65;
    pointerPath.setAttribute('d', `M ${sx} ${sy} C ${cx1} ${sy}, ${cx2} ${ty}, ${tx - 9} ${ty}`);
  }
}

// ============================================================================
// VOZ Y CONTROLES INTERACTIVOS
// ============================================================================
const speechText = document.getElementById('speechText');
const waveDots = document.getElementById('waveDots');
const btnToggleQrOnTft = document.getElementById('btnToggleQrOnTft');
let speechTimer = null;

function setEmotion(emo) {
  state.emotion = emo;
  state.tftDirty = true;
  document.querySelectorAll('.emo-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.emotion === emo);
  });
  btnToggleQrOnTft.classList.toggle('active', emo === 'qr' || state.qrOnTftForced);
}

function setViewMode(mode) {
  state.viewMode = mode;
  document.querySelectorAll('.pill-btn[data-view]').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === mode);
  });
  if (mode === 'normal') {
    blackPlaMaterial.opacity = 1.0;
    blackPlaMaterial.depthWrite = true;
  } else if (mode === 'xray') {
    blackPlaMaterial.opacity = 0.24;
    blackPlaMaterial.depthWrite = false;
  } else if (mode === 'exploded') {
    blackPlaMaterial.opacity = 0.32;
    blackPlaMaterial.depthWrite = false;
  }
}

function gimenaSpeak(text, emotion = state.emotion) {
  setEmotion(emotion);
  speechText.textContent = text;
  waveDots.classList.add('active');
  state.isSpeaking = true;

  if (speechTimer) clearTimeout(speechTimer);

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/UwU/gi, ''));
    u.lang = 'es-CO';
    u.pitch = 1.24;
    u.rate = 1.08;
    const voices = window.speechSynthesis.getVoices();
    const v =
      voices.find((x) => x.lang.startsWith('es') && /salome|sabina|helena|paulina|google|natural/i.test(x.name)) ||
      voices.find((x) => x.lang.startsWith('es'));
    if (v) u.voice = v;
    u.onend = () => {
      state.isSpeaking = false;
      state.tftDirty = true;
      waveDots.classList.remove('active');
    };
    window.speechSynthesis.speak(u);
  }

  speechTimer = setTimeout(() => {
    state.isSpeaking = false;
    state.tftDirty = true;
    waveDots.classList.remove('active');
  }, Math.min(7000, Math.max(1600, text.length * 48)));
}

// ============================================================================
// DETECCIÓN DE SCROLL SÚPER ÁGIL
// ============================================================================
const stepElements = document.querySelectorAll('.scroll-step');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const idx = Number(entry.target.dataset.step);
        state.activeStep = idx;
        state.tftDirty = true;
        activeCardElement = entry.target.querySelector('.mini-card');

        stepElements.forEach((el) => el.classList.toggle('active', Number(el.dataset.step) === idx));

        const chapter = SCROLL_CHAPTERS[idx];
        if (chapter) {
          activeStepIndicator.textContent = chapter.counter;
          beaconTag.textContent = chapter.beaconLabel;
          setViewMode(chapter.viewMode);
          btnToggleQrOnTft.classList.toggle('active', idx === 7 || state.qrOnTftForced);
        }
      }
    });
  },
  { threshold: 0.35 }
);

stepElements.forEach((el) => observer.observe(el));

// ============================================================================
// EVENTOS DE BOTONES
// ============================================================================
document.getElementById('btnHeroSpeak').addEventListener('click', () => {
  state.pokeBounce = 0.25;
  gimenaSpeak('¡Hola! Desliza hacia abajo y verás cómo me ajusto al instante para mostrarte cada parte.', 'happy');
});

btnToggleQrOnTft.addEventListener('click', () => {
  state.qrOnTftForced = !state.qrOnTftForced;
  state.tftDirty = true;
  if (state.qrOnTftForced) {
    document.getElementById('stepQrSection').scrollIntoView({ behavior: 'smooth' });
    gimenaSpeak('¡Mostrando mi QR en la pantalla TFT 3D!', 'qr');
  } else {
    setEmotion('happy');
  }
});

document.querySelectorAll('[data-trigger]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const t = btn.dataset.trigger;
    if (t === 'jump-qr') {
      state.qrOnTftForced = true;
      state.tftDirty = true;
      document.getElementById('stepQrSection').scrollIntoView({ behavior: 'smooth' });
      gimenaSpeak('¡Apunta con tu cámara a mi pantalla TFT 3D!', 'qr');
    } else if (t === 'jump-internals') {
      document.getElementById('stepInternalsSection').scrollIntoView({ behavior: 'smooth' });
      setViewMode('exploded');
      gimenaSpeak('¡Mostrando mis partes internas con flechas!', 'surprised');
    } else if (t === 'cycle-emotions') {
      state.qrOnTftForced = false;
      ['love', 'surprised', 'thinking', 'music', 'sad', 'sleepy', 'happy'].forEach((emo, i) => {
        setTimeout(() => setEmotion(emo), i * 420);
      });
      gimenaSpeak('¡Desfilando mis 7 emociones en la pantalla TFT!', 'love');
    } else if (t === 'swap-face') {
      state.qrOnTftForced = false;
      state.faceStyle = state.faceStyle === 'pixel' ? 'anime' : 'pixel';
      state.tftDirty = true;
      gimenaSpeak(
        state.faceStyle === 'pixel' ? 'Rostro Pixel-Art activado.' : 'Rostro Anime TFT activado.',
        'happy'
      );
    } else if (t === 'test-mic') {
      gimenaSpeak('¡Escucho tu voz por mi micrófono digital INMP441 de 24 bits!', 'surprised');
    } else if (t === 'test-speaker') {
      gimenaSpeak('¡Emitiendo ondas de sonido 3D desde mis 19 perforaciones frontales!', 'music');
    } else if (t === 'toggle-exploded') {
      setViewMode(state.viewMode === 'exploded' ? 'normal' : 'exploded');
    }
  });
});

document.querySelectorAll('.iot-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    const dev = chip.dataset.device;
    state.devices[dev] = !state.devices[dev];
    const on = state.devices[dev];
    chip.classList.toggle('active', on);
    chip.querySelector('b').textContent = on ? 'ON' : 'OFF';

    const anyLight = state.devices.sala || state.devices.cocina || state.devices.tuya;
    document.body.classList.toggle('lights-on', anyLight);
    roomSmartLight.intensity = anyLight ? 2.5 : 0;

    gimenaSpeak(`${dev.toUpperCase()} ${on ? 'encendido' : 'apagado'}.`, on ? 'happy' : 'thinking');
  });
});

document.getElementById('btnSimulateFallback').addEventListener('click', () => {
  state.cloudFallbackMode = !state.cloudFallbackMode;
  gimenaSpeak(
    state.cloudFallbackMode
      ? '¡Rescate PC activado! Si cae la nube, tu PC sintetiza mi voz localmente.'
      : '¡Conexión primaria en la nube activa!',
    'surprised'
  );
});

document.querySelectorAll('.pill-btn[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => setViewMode(btn.dataset.view));
});

document.querySelectorAll('.emo-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const emo = btn.dataset.emotion;
    state.qrOnTftForced = emo === 'qr';
    setEmotion(emo);
    state.pokeBounce = 0.2;
  });
});

document.getElementById('chatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  const lower = text.toLowerCase();
  if (lower.includes('qr')) {
    state.qrOnTftForced = true;
    state.tftDirty = true;
    document.getElementById('stepQrSection').scrollIntoView({ behavior: 'smooth' });
    gimenaSpeak('¡Aquí tienes mi QR en la pantalla TFT!', 'qr');
  } else if (lower.includes('sala')) {
    document.querySelector('.iot-chip[data-device="sala"]').click();
  } else if (lower.includes('ventilador')) {
    document.querySelector('.iot-chip[data-device="ventilador"]').click();
  } else {
    gimenaSpeak('¡Hola! Soy Gimena, lista para ayudarte en casa.', 'happy');
  }
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  const rec = new SpeechRecognition();
  rec.lang = 'es-CO';
  document.getElementById('btnVoiceInput').addEventListener('click', () => {
    try {
      rec.start();
      speechText.textContent = 'Escuchando...';
    } catch {}
  });
  rec.onresult = (ev) => {
    document.getElementById('chatInput').value = ev.results[0][0].transcript;
    document.getElementById('chatForm').requestSubmit();
  };
}

const qrKioskModal = document.getElementById('qrKioskModal');
document.getElementById('btnOpenQrModal').addEventListener('click', () => qrKioskModal.classList.remove('hidden'));
document.getElementById('btnCloseQrModal').addEventListener('click', () => qrKioskModal.classList.add('hidden'));
qrKioskModal.addEventListener('click', (e) => {
  if (e.target === qrKioskModal) qrKioskModal.classList.add('hidden');
});

const galleryModal = document.getElementById('galleryModal');
document.getElementById('btnOpenGallery').addEventListener('click', () => galleryModal.classList.remove('hidden'));
document.getElementById('btnCloseGallery').addEventListener('click', () => galleryModal.classList.add('hidden'));
galleryModal.addEventListener('click', (e) => {
  if (e.target === galleryModal) galleryModal.classList.add('hidden');
});

// Tocar a Gimena en 3D
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
let downPos = { x: 0, y: 0 };

window.addEventListener('pointermove', (e) => {
  state.lookTarget.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
}, { passive: true });

renderer.domElement.addEventListener('pointerdown', (e) => {
  downPos = { x: e.clientX, y: e.clientY };
}, { passive: true });

renderer.domElement.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 8) return;
  pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects(gimenaRoot.children, true);
  if (hits.length > 0) {
    state.pokeBounce = 0.25;
    if (hits[0].object.name === 'screen') {
      state.qrOnTftForced = !state.qrOnTftForced;
      state.tftDirty = true;
      gimenaSpeak(state.qrOnTftForced ? '¡QR en mi pantalla TFT activado!' : '¡Jiji! Rostro UwU activado.', state.qrOnTftForced ? 'qr' : 'love');
    } else {
      gimenaSpeak('¡Jiji! Me hiciste cosquillas UwU', 'love');
    }
  }
}, { passive: true });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}, { passive: true });

// ============================================================================
// BUCLE PRINCIPAL SÚPER ÁGIL (RESPUESTA INMEDIATA AL SCROLL)
// ============================================================================
const clock = new THREE.Clock();
const desiredCamVec = new THREE.Vector3();
const desiredTargetVec = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();

  state.smoothLook.lerp(state.lookTarget, 0.14);

  if (elapsed > state.nextBlinkTime) {
    const p = (elapsed - state.nextBlinkTime) / 0.15;
    if (p <= 1) {
      state.blinkProgress = Math.sin(p * Math.PI);
      state.tftDirty = true;
    } else {
      state.blinkProgress = 0;
      state.nextBlinkTime = elapsed + 2.6 + Math.random() * 2.5;
      state.tftDirty = true;
    }
  }

  if (state.isSpeaking) {
    state.mouthOpen = 0.25 + 0.75 * Math.abs(Math.sin(elapsed * 15.5) * Math.cos(elapsed * 6.3));
    state.tftDirty = true;
  } else if (state.mouthOpen > 0.01) {
    state.mouthOpen = THREE.MathUtils.lerp(state.mouthOpen, 0, 0.25);
    state.tftDirty = true;
  }

  renderTFTScreen(elapsed);

  const chapter = SCROLL_CHAPTERS[state.activeStep] || SCROLL_CHAPTERS[0];
  const mobile = isMobileScreen();
  const aspect = window.innerWidth / Math.max(window.innerHeight, 1);

  // Interpolación más rápida (0.16) para que el cambio de paso se sienta instantáneo y ágil
  const aspectScaleFactor = mobile ? Math.min(1, aspect / 0.52) : 1;
  const targetScale = (mobile ? chapter.mobileScale : chapter.desktopScale) * aspectScaleFactor;
  const nextScale = THREE.MathUtils.lerp(gimenaRoot.scale.x, targetScale, 0.16);
  gimenaRoot.scale.setScalar(nextScale);

  if (!state.userOrbiting) {
    if (mobile) {
      const focusY = chapter.mobileFocusY * nextScale;
      const verticalOffset = 0.52;
      desiredCamVec.set(0, focusY - verticalOffset * 0.35, chapter.mobileCamZ);
      desiredTargetVec.set(0, focusY - verticalOffset, 0);
      camera.position.lerp(desiredCamVec, 0.16);
      controls.target.lerp(desiredTargetVec, 0.16);
    } else {
      camera.position.lerp(chapter.camPos, 0.15);
      controls.target.lerp(chapter.camTarget, 0.15);
    }
  }

  if (chapter.highlightRadius > 0) {
    partFocusRing3D.position.lerp(chapter.anchorLocal, 0.2);
    const pulseScale = chapter.highlightRadius * (1 + Math.sin(elapsed * 4.5) * 0.05);
    partFocusRing3D.scale.setScalar(pulseScale);
    partFocusRing3D.lookAt(camera.position);
    focusRingMat.opacity = THREE.MathUtils.lerp(focusRingMat.opacity, 0.6, 0.18);
  } else {
    focusRingMat.opacity = THREE.MathUtils.lerp(focusRingMat.opacity, 0, 0.2);
  }

  const targetRotY = chapter.robotRotY + state.smoothLook.x * (state.activeStep === 7 ? 0.02 : 0.08);
  gimenaRoot.rotation.y = THREE.MathUtils.lerp(gimenaRoot.rotation.y, targetRotY, 0.16);

  state.pokeBounce = THREE.MathUtils.lerp(state.pokeBounce, 0, 0.12);
  const breathY = Math.sin(elapsed * 2.4) * 0.022;
  const explode = state.viewMode === 'exploded' ? 1 : 0;

  headGroup.position.y = THREE.MathUtils.lerp(
    headGroup.position.y,
    1.02 + breathY + explode * 0.62 + Math.abs(Math.sin(elapsed * 20)) * state.pokeBounce,
    0.16
  );
  leftArmGroup.position.x = THREE.MathUtils.lerp(leftArmGroup.position.x, -1.62 - explode * 0.5, 0.16);
  rightArmGroup.position.x = THREE.MathUtils.lerp(rightArmGroup.position.x, 1.62 + explode * 0.5, 0.16);
  feetGroup.position.y = THREE.MathUtils.lerp(feetGroup.position.y, -1.78 - explode * 0.35, 0.16);

  soundWaveRings.forEach((ring, idx) => {
    if (state.isSpeaking || state.emotion === 'music' || state.activeStep === 3) {
      const pr = (elapsed * 1.6 + idx * 0.5) % 1;
      const sc = 1 + pr * 2.2;
      ring.scale.set(sc, sc, 1);
      ring.material.opacity = (1 - pr) * 0.55;
      ring.position.z = 1.03 + pr * 0.35;
    } else {
      ring.material.opacity = 0;
    }
  });

  controls.update();
  renderer.render(scene, camera);
  updatePointerLine();
  updateInternalPins();
}

animate();
