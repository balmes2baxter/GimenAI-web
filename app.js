import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const isMobileScreen = () => window.innerWidth < 860;

// ============================================================================
// ESTADO GLOBAL LIGERO
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
  devices: {
    sala: false,
    cocina: false,
    ventilador: false,
    tuya: false,
  },
};

// Cargar QR oficial para dibujarlo en la pantalla TFT 3D
const qrImage = new Image();
qrImage.crossOrigin = 'anonymous';
qrImage.src = 'assets/qr-gimenai-web.png';
let qrImageLoaded = false;
qrImage.onload = () => {
  qrImageLoaded = true;
};

// Capítulos del Scroll con encuadre dedicado para Móvil (robot en la mitad superior) y Desktop
const SCROLL_CHAPTERS = [
  {
    step: 0,
    counter: '01/08',
    beaconLabel: 'Gimena · IA Física',
    camPos: new THREE.Vector3(-1.25, 0.35, 7.0),
    camTarget: new THREE.Vector3(-1.0, 0.0, 0),
    mobilePos: new THREE.Vector3(0, 0.15, 7.9),
    mobileTarget: new THREE.Vector3(0, -0.75, 0),
    robotRotY: -0.15,
    viewMode: 'normal',
    anchorLocal: new THREE.Vector3(0, 1.05, 0.94),
    showPointer: false,
  },
  {
    step: 1,
    counter: '02/08',
    beaconLabel: 'Pantalla TFT 2.4" ST7789',
    camPos: new THREE.Vector3(-0.9, 0.88, 4.7),
    camTarget: new THREE.Vector3(-0.8, 0.72, 0),
    mobilePos: new THREE.Vector3(0, 0.78, 5.4),
    mobileTarget: new THREE.Vector3(0, 0.22, 0),
    robotRotY: -0.08,
    viewMode: 'normal',
    anchorLocal: new THREE.Vector3(0, 1.12, 0.94),
    showPointer: true,
  },
  {
    step: 2,
    counter: '03/08',
    beaconLabel: 'Micrófono Digital INMP441',
    camPos: new THREE.Vector3(-0.7, 0.25, 4.3),
    camTarget: new THREE.Vector3(-0.6, 0.18, 0),
    mobilePos: new THREE.Vector3(0.25, 0.25, 4.9),
    mobileTarget: new THREE.Vector3(0.15, -0.25, 0),
    robotRotY: -0.22,
    viewMode: 'normal',
    anchorLocal: new THREE.Vector3(0.62, 0.26, 0.92),
    showPointer: true,
  },
  {
    step: 3,
    counter: '04/08',
    beaconLabel: '19 Perforaciones + Parlante I2S',
    camPos: new THREE.Vector3(-0.9, -0.55, 4.8),
    camTarget: new THREE.Vector3(-0.8, -0.65, 0),
    mobilePos: new THREE.Vector3(0, -0.35, 5.5),
    mobileTarget: new THREE.Vector3(0, -1.05, 0),
    robotRotY: -0.08,
    viewMode: 'normal',
    anchorLocal: new THREE.Vector3(0, -0.76, 1.03),
    showPointer: true,
  },
  {
    step: 4,
    counter: '05/08',
    beaconLabel: 'Unión 2 Mitades PLA + Brazo',
    camPos: new THREE.Vector3(-1.1, 0.1, 6.2),
    camTarget: new THREE.Vector3(-0.95, -0.15, 0),
    mobilePos: new THREE.Vector3(0, 0.1, 7.2),
    mobileTarget: new THREE.Vector3(0, -0.78, 0),
    robotRotY: Math.PI * 0.48,
    viewMode: 'normal',
    anchorLocal: new THREE.Vector3(-1.62, -0.72, 0.25),
    showPointer: true,
  },
  {
    step: 5,
    counter: '06/08',
    beaconLabel: '5 Ranuras + Grabado "Gimena" + USB',
    camPos: new THREE.Vector3(-1.0, 0.15, 5.8),
    camTarget: new THREE.Vector3(-0.9, -0.05, 0),
    mobilePos: new THREE.Vector3(0, 0.15, 6.8),
    mobileTarget: new THREE.Vector3(0, -0.72, 0),
    robotRotY: Math.PI * 0.96,
    viewMode: 'normal',
    anchorLocal: new THREE.Vector3(0, 0.72, -0.92),
    showPointer: true,
  },
  {
    step: 6,
    counter: '07/08',
    beaconLabel: 'Cerebro ESP32 + Partes Internas',
    camPos: new THREE.Vector3(-1.15, 0.25, 6.6),
    camTarget: new THREE.Vector3(-0.95, -0.1, 0),
    mobilePos: new THREE.Vector3(0, 0.2, 7.6),
    mobileTarget: new THREE.Vector3(0, -0.75, 0),
    robotRotY: -0.32,
    viewMode: 'exploded',
    anchorLocal: new THREE.Vector3(0, -0.82, 0),
    showPointer: true,
  },
  {
    step: 7,
    counter: '08/08',
    beaconLabel: '📲 ¡Escanea el QR en mi TFT!',
    camPos: new THREE.Vector3(-0.6, 1.08, 3.55),
    camTarget: new THREE.Vector3(-0.52, 1.05, 0),
    mobilePos: new THREE.Vector3(0, 0.95, 4.25),
    mobileTarget: new THREE.Vector3(0, 0.52, 0),
    robotRotY: 0,
    viewMode: 'normal',
    anchorLocal: new THREE.Vector3(0.15, 1.12, 0.94),
    showPointer: true,
  },
];

// ============================================================================
// TEXTURAS LIGERAS: CAPAS PLA + GRABADO TRASERO "GIMENA" + SOMBRA SUAVE
// ============================================================================
function create3DPrintLayerBumpTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 128, 256);
  for (let y = 0; y < 256; y += 2) {
    const v = 118 + Math.sin(y * 2.2) * 18;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, y, 128, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 4);
  return tex;
}

function createEngravedGimenaTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.font = '700 84px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(180, 205, 240, 0.28)';
  ctx.strokeText('Gimena', 256, 84);
  ctx.fillStyle = '#040507';
  ctx.fillText('Gimena', 256, 80);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSoftShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  g.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

// ============================================================================
// PANTALLA TFT 320x240 EN VIVO
// ============================================================================
const tftCanvas = document.createElement('canvas');
tftCanvas.width = 320;
tftCanvas.height = 240;
const tftCtx = tftCanvas.getContext('2d');

const tftTexture = new THREE.CanvasTexture(tftCanvas);
tftTexture.colorSpace = THREE.SRGBColorSpace;
tftTexture.minFilter = THREE.LinearFilter;
tftTexture.magFilter = THREE.NearestFilter;

const P_SCALE = 4;
function pRect(px, py, pw, ph, color) {
  tftCtx.fillStyle = color;
  tftCtx.fillRect(
    Math.round(px) * P_SCALE,
    Math.round(py) * P_SCALE,
    Math.round(pw) * P_SCALE,
    Math.round(ph) * P_SCALE
  );
}

function drawPixelEye(centerPx, centerPy, lookX, lookY, emotion, blink, radiusScale = 1) {
  const cx = Math.round(centerPx + lookX * 3.2);
  const cy = Math.round(centerPy + lookY * 2.2);

  if (blink > 0.65 || emotion === 'sleepy') {
    const navy = '#182868';
    const span = Math.round(9 * radiusScale);
    for (let dx = -span; dx <= span; dx++) {
      const dy =
        emotion === 'happy' || emotion === 'love'
          ? -Math.round((1 - (dx / span) ** 2) * 3)
          : Math.round((1 - (dx / span) ** 2) * 2);
      pRect(cx + dx, cy + dy, 1, 2, navy);
    }
    return;
  }

  const rx = Math.round((emotion === 'surprised' ? 11 : 10) * radiusScale);
  const ry = Math.round((emotion === 'surprised' ? 12 : 11) * radiusScale);

  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const norm = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
      if (norm > 1.0) continue;
      if (norm >= 0.72) {
        pRect(cx + dx, cy + dy, 1, 1, '#162564');
      } else {
        const isLowerCrescent =
          dy > 1 &&
          (dx * dx) / ((rx - 1.5) ** 2) + ((dy - 1) * (dy - 1)) / ((ry - 1.5) ** 2) > 0.35;
        pRect(cx + dx, cy + dy, 1, 1, isLowerCrescent ? '#00d8ff' : dy < -2 ? '#1c42b8' : '#245be0');
      }
    }
  }

  if (emotion === 'love') {
    const hc = '#ff4d94';
    pRect(cx - 2, cy - 2, 2, 2, hc);
    pRect(cx + 1, cy - 2, 2, 2, hc);
    pRect(cx - 3, cy - 1, 7, 2, hc);
    pRect(cx - 2, cy + 1, 5, 2, hc);
  }

  const hlSize = Math.max(2, Math.round(4 * radiusScale));
  pRect(cx - Math.round(4 * radiusScale), cy - Math.round(4 * radiusScale), hlSize, hlSize, '#ffffff');
  pRect(cx + Math.round(2 * radiusScale), cy + Math.round(2 * radiusScale), 2, 2, '#ffffff');
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
    for (let dx = -6; dx <= 6; dx++) {
      pRect(centerPx + dx, centerPy + Math.round((dx * dx) / 14), 1, 1, navy);
    }
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

  drawPixelEye(12, 20, lx * 0.5, ly * 0.5, 'happy', state.blinkProgress, 0.62);
  drawPixelEye(27, 20, lx * 0.5, ly * 0.5, 'happy', state.blinkProgress, 0.62);
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
      for (let i = 0; i < 5; i++) {
        const hx = 10 + ((i * 14) % 66);
        const hy = 56 - Math.floor((timeSec * 14 + i * 11) % 56);
        pRect(hx, hy, 3, 3, '#ff4d94');
      }
    } else if (emotion === 'music') {
      for (let b = 0; b < 14; b++) {
        const bh = 2 + Math.round(Math.abs(Math.sin(timeSec * 7 + b * 0.7)) * 7);
        pRect(12 + b * 4, 56 - bh, 3, bh, b % 2 === 0 ? '#245be0' : '#00b8ff');
      }
    }

    if (emotion === 'love' || state.pokeBounce > 0.05) {
      pRect(14, 34, 6, 3, '#ff9ebb');
      pRect(60, 34, 6, 3, '#ff9ebb');
    }

    drawPixelEye(25, 24, lx, ly, emotion, state.blinkProgress);
    drawPixelEye(55, 24, lx, ly, emotion, state.blinkProgress);
    drawPixelMouth(40, 43, emotion, state.isSpeaking, state.mouthOpen);
  } else {
    // Modo Anime ligero
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
// ESCENA THREE.JS ULTRALIGERA (OPTIMIZADA PARA MÓVILES)
// ============================================================================
const container = document.getElementById('canvasContainer');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.1, 60);
camera.position.copy(isMobileScreen() ? SCROLL_CHAPTERS[0].mobilePos : SCROLL_CHAPTERS[0].camPos);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobileScreen() ? 1.5 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.enableZoom = false;
controls.enablePan = false;
controls.target.copy(isMobileScreen() ? SCROLL_CHAPTERS[0].mobileTarget : SCROLL_CHAPTERS[0].camTarget);

// En móvil permitimos que el scroll vertical de 1 dedo baje por la página sin bloquearse
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
  }, 1500);
});

scene.add(new THREE.AmbientLight(0xdbeafe, 1.05));

const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(4, 6, 5);
scene.add(keyLight);

const backLight = new THREE.DirectionalLight(0x93c5fd, 1.75);
backLight.position.set(-3.5, 4, -5.5);
scene.add(backLight);

const roomSmartLight = new THREE.PointLight(0xfbbf24, 0, 11);
roomSmartLight.position.set(-2, 3.5, 3);
scene.add(roomSmartLight);

const layerBumpTex = create3DPrintLayerBumpTexture();

const blackPlaMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x13171f,
  roughness: 0.27,
  metalness: 0.09,
  clearcoat: 0.68,
  clearcoatRoughness: 0.22,
  bumpMap: layerBumpTex,
  bumpScale: 0.007,
  transparent: true,
  opacity: 1.0,
});

const darkCavityMaterial = new THREE.MeshBasicMaterial({ color: 0x040508 });
const seamLineMaterial = new THREE.MeshBasicMaterial({ color: 0x05070b });

// ============================================================================
// CONSTRUCCIÓN DE GIMENA 3D + PARTES INTERNAS DETALLADAS
// ============================================================================
const gimenaRoot = new THREE.Group();
scene.add(gimenaRoot);

// Sombra de contacto ultraligera bajo los pies (sin costo de GPU en móviles)
const shadowPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(4.6, 4.6),
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

headGroup.add(new THREE.Mesh(new RoundedBoxGeometry(2.38, 2.24, 1.78, 4, 0.11), blackPlaMaterial));
headGroup.add(new THREE.Mesh(new THREE.BoxGeometry(2.405, 2.25, 0.026), seamLineMaterial));

const bezelRecessMesh = new THREE.Mesh(new RoundedBoxGeometry(1.66, 1.26, 0.12, 2, 0.03), darkCavityMaterial);
bezelRecessMesh.position.set(0, 0.12, 0.86);
headGroup.add(bezelRecessMesh);

const tftScreenMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(1.56, 1.17),
  new THREE.MeshBasicMaterial({ map: tftTexture })
);
tftScreenMesh.position.set(0, 0.12, 0.925);
tftScreenMesh.name = 'screen';
headGroup.add(tftScreenMesh);

const frontSlotMesh = new THREE.Mesh(new RoundedBoxGeometry(1.06, 0.085, 0.08, 2, 0.02), darkCavityMaterial);
frontSlotMesh.position.set(-0.16, -0.76, 0.87);
headGroup.add(frontSlotMesh);

const micRimMesh = new THREE.Mesh(
  new THREE.RingGeometry(0.055, 0.088, 20),
  new THREE.MeshBasicMaterial({ color: 0x475569, side: THREE.DoubleSide })
);
micRimMesh.position.set(0.62, -0.76, 0.906);
headGroup.add(micRimMesh);

const micHoleMesh = new THREE.Mesh(new THREE.CircleGeometry(0.055, 20), darkCavityMaterial);
micHoleMesh.position.set(0.62, -0.76, 0.904);
micHoleMesh.name = 'mic';
headGroup.add(micHoleMesh);

// Espalda: 5 ranuras verticales + Grabado "Gimena"
const backVentGroup = new THREE.Group();
backVentGroup.position.set(0, 0.36, -0.892);
headGroup.add(backVentGroup);
for (let i = -2; i <= 2; i++) {
  const slot = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.42, 0.06, 2, 0.015), darkCavityMaterial);
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

torsoGroup.add(new THREE.Mesh(new RoundedBoxGeometry(3.16, 1.52, 2.02, 4, 0.11), blackPlaMaterial));
torsoGroup.add(new THREE.Mesh(new THREE.BoxGeometry(3.185, 1.53, 0.026), seamLineMaterial));

const neckCollarMesh = new THREE.Mesh(new RoundedBoxGeometry(2.54, 0.14, 1.88, 3, 0.04), blackPlaMaterial);
neckCollarMesh.position.set(0, 0.78, 0);
torsoGroup.add(neckCollarMesh);

// 19 perforaciones del parlante
const speakerGrilleGroup = new THREE.Group();
speakerGrilleGroup.position.set(0, 0.06, 1.012);
torsoGroup.add(speakerGrilleGroup);

const holeCoords = [[0, 0]];
for (let i = 0; i < 6; i++) {
  const a = (i * Math.PI) / 3;
  holeCoords.push([Math.cos(a) * 0.175, Math.sin(a) * 0.175]);
}
for (let i = 0; i < 12; i++) {
  const a = (i * Math.PI) / 6;
  holeCoords.push([Math.cos(a) * 0.35, Math.sin(a) * 0.35]);
}
const holeGeo = new THREE.CircleGeometry(0.048, 16);
holeCoords.forEach(([hx, hy]) => {
  const m = new THREE.Mesh(holeGeo, darkCavityMaterial);
  m.position.set(hx, hy, 0);
  m.name = 'speaker';
  speakerGrilleGroup.add(m);
});

const soundWaveRings = [];
for (let i = 0; i < 3; i++) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.21, 24),
    new THREE.MeshBasicMaterial({ color: 0x00d8ff, transparent: true, opacity: 0, side: THREE.DoubleSide })
  );
  ring.position.set(0, 0.06, 1.04);
  torsoGroup.add(ring);
  soundWaveRings.push(ring);
}

const usbPortCutoutMesh = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.26, 0.14, 2, 0.02), darkCavityMaterial);
usbPortCutoutMesh.position.set(0, -0.42, -0.98);
torsoGroup.add(usbPortCutoutMesh);

// 3. BRAZOS LATERALES
function createSideArm(isLeft) {
  const group = new THREE.Group();
  const sign = isLeft ? -1 : 1;
  group.position.set(sign * 1.62, -0.86, 0.36);

  const shoulderPeg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 18), blackPlaMaterial);
  shoulderPeg.rotation.z = Math.PI / 2;
  group.add(shoulderPeg);

  const armBlock = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.68, 0.38, 3, 0.08), blackPlaMaterial);
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
  const foot = new THREE.Mesh(new RoundedBoxGeometry(0.92, 0.46, 1.62, 3, 0.08), blackPlaMaterial);
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
    new THREE.TubeGeometry(usbCurve, 24, 0.055, 12, false),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
  )
);

// 6. PARTES INTERNAS DETALLADAS (VISIBLES CON RAYOS-X Y FLECHAS INTERNAS)
const internalsGroup = new THREE.Group();
gimenaRoot.add(internalsGroup);

// 6a. PCB Roja de la Pantalla TFT ST7789 (Dentro de la cabeza)
const internalTftPcb = new THREE.Mesh(
  new RoundedBoxGeometry(1.62, 1.22, 0.07, 2, 0.02),
  new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4, metalness: 0.3 })
);
internalTftPcb.position.set(0, 1.14, 0.65);
internalsGroup.add(internalTftPcb);

// 6b. Módulo Micrófono INMP441 (Placa morada/azul en esquina inferior derecha de la cabeza)
const internalMicPcb = new THREE.Mesh(
  new CylinderGeometryOrBox(),
  new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.35, metalness: 0.4 })
);
function CylinderGeometryOrBox() {
  return new THREE.CylinderGeometry(0.16, 0.16, 0.06, 18);
}
internalMicPcb.rotation.x = Math.PI / 2;
internalMicPcb.position.set(0.62, 0.26, 0.72);
internalsGroup.add(internalMicPcb);

// 6c. Altavoz + Amplificador I2S MAX98357A (En el pecho)
const internalSpeakerGroup = new THREE.Group();
internalSpeakerGroup.position.set(0, -0.76, 0.58);
internalsGroup.add(internalSpeakerGroup);

const speakerCone = new THREE.Mesh(
  new THREE.CylinderGeometry(0.42, 0.28, 0.26, 24),
  new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.35, metalness: 0.65 })
);
speakerCone.rotation.x = Math.PI / 2;
internalSpeakerGroup.add(speakerCone);

// 6d. Placa ESP32 DevKit V1 + Antena WiFi + LED (En la base del torso)
const esp32Group = new THREE.Group();
esp32Group.position.set(0, -0.92, -0.18);
internalsGroup.add(esp32Group);

esp32Group.add(
  new THREE.Mesh(
    new RoundedBoxGeometry(1.5, 0.1, 0.88, 2, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.35, metalness: 0.35 })
  )
);
const wifiShield = new THREE.Mesh(
  new THREE.BoxGeometry(0.58, 0.12, 0.52),
  new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.85 })
);
wifiShield.position.set(-0.25, 0.08, 0);
esp32Group.add(wifiShield);

const espLedMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.05, 10, 10),
  new THREE.MeshBasicMaterial({ color: 0x00d8ff })
);
espLedMesh.position.set(0.52, 0.09, 0.22);
esp32Group.add(espLedMesh);

// ============================================================================
// FLECHAS DE PARTES INTERNAS (PINS INTERACTIVOS EN MODO RAYOS-X / PASO 7)
// ============================================================================
const internalPinsLayer = document.getElementById('internalPinsLayer');
const INTERNAL_PARTS_DEFS = [
  {
    label: 'PCB TFT ST7789 (SPI)',
    pos: new THREE.Vector3(-0.35, 1.35, 0.65),
    info: 'Placa controladora SPI de la pantalla TFT 2.4 pulgadas (320×240 px).',
  },
  {
    label: 'Chip Mic INMP441 (I2S)',
    pos: new THREE.Vector3(0.68, 0.26, 0.72),
    info: 'Sensor MEMS digital omnidireccional de 24-bit para escuchar tu voz.',
  },
  {
    label: 'Amp MAX98357A + Cono',
    pos: new THREE.Vector3(0.45, -0.62, 0.58),
    info: 'Amplificador clase D I2S conectado al altavoz detrás de las 19 perforaciones.',
  },
  {
    label: 'ESP32 Dual-Core + WiFi',
    pos: new THREE.Vector3(-0.45, -1.05, -0.18),
    info: 'Cerebro principal a 240 MHz conectado a Gemini 3.5, relés IoT y servidor PC.',
  },
];

const internalPinNodes = INTERNAL_PARTS_DEFS.map((item) => {
  const btn = document.createElement('button');
  btn.className = 'internal-pin';
  btn.textContent = item.label;
  btn.style.display = 'none';
  btn.addEventListener('click', () => {
    state.pokeBounce = 0.25;
    gimenaSpeak(item.info, 'surprised');
  });
  internalPinsLayer.appendChild(btn);
  return { ...item, el: btn };
});

function updateInternalPins() {
  const showInternals = state.viewMode === 'xray' || state.viewMode === 'exploded';
  internalPinNodes.forEach((p) => {
    if (!showInternals) {
      p.el.style.display = 'none';
      return;
    }
    const v = p.pos.clone().applyMatrix4(gimenaRoot.matrixWorld).project(camera);
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    p.el.style.display = 'inline-flex';
    p.el.style.left = `${x}px`;
    p.el.style.top = `${y}px`;
  });
}

// ============================================================================
// FLECHA SVG DINÁMICA VISIBLE EN MÓVIL Y EN ESCRITORIO
// ============================================================================
const pointerPath = document.getElementById('pointerPath');
const targetBeacon = document.getElementById('targetBeacon');
const beaconTag = document.getElementById('beaconTag');
const activeStepIndicator = document.getElementById('activeStepIndicator');

function updatePointerLine() {
  const chapter = SCROLL_CHAPTERS[state.activeStep] || SCROLL_CHAPTERS[0];

  if (!chapter.showPointer) {
    targetBeacon.style.opacity = '0';
    pointerPath.setAttribute('d', '');
    return;
  }

  const worldTarget = chapter.anchorLocal.clone().applyMatrix4(gimenaRoot.matrixWorld);
  worldTarget.project(camera);

  const tx = (worldTarget.x * 0.5 + 0.5) * window.innerWidth;
  const ty = (-worldTarget.y * 0.5 + 0.5) * window.innerHeight;

  targetBeacon.style.opacity = '1';
  targetBeacon.style.left = `${tx}px`;
  targetBeacon.style.top = `${ty}px`;
  beaconTag.textContent = chapter.beaconLabel;

  const activeCardEl = document.querySelector(`.scroll-step[data-step="${state.activeStep}"] .mini-card`);
  if (!activeCardEl) return;

  const rect = activeCardEl.getBoundingClientRect();

  if (isMobileScreen()) {
    // En móvil: la flecha nace en el borde superior de la tarjeta inferior y sube hacia la pieza 3D
    const sx = rect.left + rect.width * 0.5;
    const sy = rect.top;
    const cy1 = sy - (sy - ty) * 0.45;
    const cy2 = ty + (sy - ty) * 0.25;
    pointerPath.setAttribute('d', `M ${sx} ${sy} C ${sx} ${cy1}, ${tx} ${cy2}, ${tx} ${ty + 10}`);
  } else {
    // En desktop: la flecha nace a la derecha de la tarjeta y apunta al modelo 3D
    const sx = rect.right;
    const sy = rect.top + rect.height * 0.45;
    const cx1 = sx + (tx - sx) * 0.45;
    const cx2 = sx + (tx - sx) * 0.65;
    pointerPath.setAttribute('d', `M ${sx} ${sy} C ${cx1} ${sy}, ${cx2} ${ty}, ${tx - 10} ${ty}`);
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
    blackPlaMaterial.opacity = 0.35;
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
    u.rate = 1.06;
    const voices = window.speechSynthesis.getVoices();
    const v =
      voices.find((x) => x.lang.startsWith('es') && /salome|sabina|helena|paulina|google|natural/i.test(x.name)) ||
      voices.find((x) => x.lang.startsWith('es'));
    if (v) u.voice = v;
    u.onend = () => {
      state.isSpeaking = false;
      waveDots.classList.remove('active');
    };
    window.speechSynthesis.speak(u);
  }

  speechTimer = setTimeout(() => {
    state.isSpeaking = false;
    waveDots.classList.remove('active');
  }, Math.min(7500, Math.max(1800, text.length * 52)));
}

// ============================================================================
// DETECCIÓN DE SCROLL (INTERSECTION OBSERVER)
// ============================================================================
const stepElements = document.querySelectorAll('.scroll-step');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const idx = Number(entry.target.dataset.step);
        state.activeStep = idx;

        stepElements.forEach((el) => el.classList.toggle('active', Number(el.dataset.step) === idx));

        const chapter = SCROLL_CHAPTERS[idx];
        if (chapter) {
          activeStepIndicator.textContent = chapter.counter;
          setViewMode(chapter.viewMode);
          btnToggleQrOnTft.classList.toggle('active', idx === 7 || state.qrOnTftForced);
        }
      }
    });
  },
  { threshold: 0.48 }
);

stepElements.forEach((el) => observer.observe(el));

// ============================================================================
// EVENTOS DE BOTONES
// ============================================================================
document.getElementById('btnHeroSpeak').addEventListener('click', () => {
  state.pokeBounce = 0.25;
  gimenaSpeak('¡Hola! Desliza con tu dedo para ver cada parte señalada con flechas y mi interior en Rayos X.', 'happy');
});

btnToggleQrOnTft.addEventListener('click', () => {
  state.qrOnTftForced = !state.qrOnTftForced;
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
      document.getElementById('stepQrSection').scrollIntoView({ behavior: 'smooth' });
      gimenaSpeak('¡Apunta con tu cámara a mi pantalla TFT 3D!', 'qr');
    } else if (t === 'jump-internals') {
      document.getElementById('stepInternalsSection').scrollIntoView({ behavior: 'smooth' });
      setViewMode('exploded');
      gimenaSpeak('¡Mostrando mis partes internas con flechas! Toca cualquier chip para conocerlo.', 'surprised');
    } else if (t === 'cycle-emotions') {
      state.qrOnTftForced = false;
      ['love', 'surprised', 'thinking', 'music', 'sad', 'sleepy', 'happy'].forEach((emo, i) => {
        setTimeout(() => setEmotion(emo), i * 500);
      });
      gimenaSpeak('¡Desfilando mis 7 emociones en la pantalla TFT!', 'love');
    } else if (t === 'swap-face') {
      state.qrOnTftForced = false;
      state.faceStyle = state.faceStyle === 'pixel' ? 'anime' : 'pixel';
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

// Modales
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
});

renderer.domElement.addEventListener('pointerdown', (e) => {
  downPos = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 8) return;
  pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects(gimenaRoot.children, true);
  if (hits.length > 0) {
    state.pokeBounce = 0.28;
    if (hits[0].object.name === 'screen') {
      state.qrOnTftForced = !state.qrOnTftForced;
      gimenaSpeak(state.qrOnTftForced ? '¡QR en mi pantalla TFT activado!' : '¡Jiji! Rostro UwU activado.', state.qrOnTftForced ? 'qr' : 'love');
    } else {
      gimenaSpeak('¡Jiji! Me hiciste cosquillas UwU', 'love');
    }
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================================
// BUCLE PRINCIPAL 60 FPS LIGERO
// ============================================================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();

  state.smoothLook.lerp(state.lookTarget, 0.08);

  if (elapsed > state.nextBlinkTime) {
    const p = (elapsed - state.nextBlinkTime) / 0.16;
    if (p <= 1) {
      state.blinkProgress = Math.sin(p * Math.PI);
    } else {
      state.blinkProgress = 0;
      state.nextBlinkTime = elapsed + 2.5 + Math.random() * 2.8;
    }
  }

  state.mouthOpen = state.isSpeaking
    ? 0.25 + 0.75 * Math.abs(Math.sin(elapsed * 15.5) * Math.cos(elapsed * 6.3))
    : THREE.MathUtils.lerp(state.mouthOpen, 0, 0.2);

  renderTFTScreen(elapsed);

  const chapter = SCROLL_CHAPTERS[state.activeStep] || SCROLL_CHAPTERS[0];
  const mobile = isMobileScreen();

  if (!state.userOrbiting) {
    camera.position.lerp(mobile ? chapter.mobilePos : chapter.camPos, 0.07);
    controls.target.lerp(mobile ? chapter.mobileTarget : chapter.camTarget, 0.07);
  }

  const targetRotY = chapter.robotRotY + state.smoothLook.x * (state.activeStep === 7 ? 0.02 : 0.1);
  gimenaRoot.rotation.y = THREE.MathUtils.lerp(gimenaRoot.rotation.y, targetRotY, 0.07);

  state.pokeBounce = THREE.MathUtils.lerp(state.pokeBounce, 0, 0.09);
  const breathY = Math.sin(elapsed * 2.4) * 0.025;
  const explode = state.viewMode === 'exploded' ? 1 : 0;

  headGroup.position.y = THREE.MathUtils.lerp(
    headGroup.position.y,
    1.02 + breathY + explode * 0.68 + Math.abs(Math.sin(elapsed * 20)) * state.pokeBounce,
    0.1
  );
  leftArmGroup.position.x = THREE.MathUtils.lerp(leftArmGroup.position.x, -1.62 - explode * 0.55, 0.1);
  rightArmGroup.position.x = THREE.MathUtils.lerp(rightArmGroup.position.x, 1.62 + explode * 0.55, 0.1);
  feetGroup.position.y = THREE.MathUtils.lerp(feetGroup.position.y, -1.78 - explode * 0.38, 0.1);

  soundWaveRings.forEach((ring, idx) => {
    if (state.isSpeaking || state.emotion === 'music' || state.activeStep === 3) {
      const pr = (elapsed * 1.5 + idx * 0.33) % 1;
      const sc = 1 + pr * 2.4;
      ring.scale.set(sc, sc, 1);
      ring.material.opacity = (1 - pr) * 0.55;
      ring.position.z = 1.03 + pr * 0.38;
    } else {
      ring.material.opacity = 0;
    }
  });

  espLedMesh.material.color.setHex(Math.floor(elapsed * 3) % 2 === 0 ? 0x00d8ff : 0x0284c7);

  controls.update();
  renderer.render(scene, camera);
  updatePointerLine();
  updateInternalPins();
}

animate();
