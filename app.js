import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ============================================================================
// ESTADO GLOBAL DE GIMENA 3D + SCROLLYTELLING
// ============================================================================
const state = {
  activeStep: 0,
  emotion: 'happy',
  faceStyle: 'pixel', // 'pixel' (foto real) | 'anime' (firmware)
  viewMode: 'normal', // 'normal' | 'xray' | 'exploded'
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

// Configuración de cada capítulo del Scroll (Cámara + Rotación del Robot + Punto 3D señalado)
const SCROLL_CHAPTERS = [
  {
    step: 0,
    title: '01 / 07 · Vista Frontal',
    beaconLabel: 'Gimena · Robot IA',
    camPos: new THREE.Vector3(-1.35, 0.35, 7.2),
    camTarget: new THREE.Vector3(-1.1, 0.0, 0),
    robotRotY: -0.18,
    viewMode: 'normal',
    anchorLocal: new THREE.Vector3(0, 1.05, 0.94),
    showPointer: false,
  },
  {
    step: 1,
    title: '02 / 07 · Pantalla TFT 2.4"',
    beaconLabel: 'Pantalla TFT ST7789 (320×240)',
    camPos: new THREE.Vector3(-0.95, 0.88, 4.75),
    camPosMobile: new THREE.Vector3(0, 0.85, 5.6),
    camTarget: new THREE.Vector3(-0.85, 0.72, 0),
    robotRotY: -0.12,
    viewMode: 'normal',
    anchorLocal: new THREE.Vector3(-0.15, 1.14, 0.94),
    showPointer: true,
  },
  {
    step: 2,
    title: '03 / 07 · Micrófono INMP441',
    beaconLabel: 'Micrófono Digital INMP441 + Ranura',
    camPos: new THREE.Vector3(-0.75, 0.25, 4.35),
    camTarget: new THREE.Vector3(-0.65, 0.18, 0),
    robotRotY: -0.24,
    viewMode: 'normal',
    anchorLocal: new THREE.Vector3(0.62, 0.26, 0.92),
    showPointer: true,
  },
  {
    step: 3,
    title: '04 / 07 · Parlante I2S (19 agujeros)',
    beaconLabel: 'Rejilla de 19 Perforaciones + Amp I2S',
    camPos: new THREE.Vector3(-0.95, -0.55, 4.85),
    camTarget: new THREE.Vector3(-0.85, -0.65, 0),
    robotRotY: -0.1,
    viewMode: 'normal',
    anchorLocal: new THREE.Vector3(0, -0.76, 1.03),
    showPointer: true,
  },
  {
    step: 4,
    title: '05 / 07 · Perfil Lateral (2 Mitades PLA)',
    beaconLabel: 'Unión de 2 Mitades 3D + Brazo Lateral',
    camPos: new THREE.Vector3(-1.15, 0.1, 6.2),
    camTarget: new THREE.Vector3(-1.0, -0.15, 0),
    robotRotY: Math.PI * 0.48, // Giro 90° mostrando el perfil lateral idéntico a la foto 2
    viewMode: 'normal',
    anchorLocal: new THREE.Vector3(-1.62, -0.65, 0.15),
    showPointer: true,
  },
  {
    step: 5,
    title: '06 / 07 · Espalda: Grabado "Gimena" & USB',
    beaconLabel: '5 Ranuras + Grabado "Gimena" + USB',
    camPos: new THREE.Vector3(-1.05, 0.15, 5.8),
    camTarget: new THREE.Vector3(-0.95, -0.05, 0),
    robotRotY: Math.PI * 0.96, // Giro 180° mostrando la espalda idéntica a la foto 3
    viewMode: 'normal',
    anchorLocal: new THREE.Vector3(0, 0.92, -0.92),
    showPointer: true,
  },
  {
    step: 6,
    title: '07 / 07 · Interior Rayos-X + Domótica',
    beaconLabel: 'Placa ESP32 DevKit V1 + Relés IoT',
    camPos: new THREE.Vector3(-1.2, 0.25, 6.8),
    camTarget: new THREE.Vector3(-1.0, -0.1, 0),
    robotRotY: -0.35,
    viewMode: 'xray',
    anchorLocal: new THREE.Vector3(0, -0.82, 0),
    showPointer: true,
  },
];

// ============================================================================
// TEXTURAS PROCEDURALES: CAPAS PLA 3D + GRABADO TRASERO "GIMENA"
// ============================================================================
function create3DPrintLayerBumpTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 512);

  for (let y = 0; y < 512; y += 3) {
    const v = 116 + Math.sin(y * 2.0) * 20;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, y, 256, 1.5);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 4);
  return tex;
}

// Placa con el grabado "Gimena" en bajo relieve para la espalda (fiel a la foto 3)
function createEngravedGimenaTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Sombra interior del grabado en el PLA negro
  ctx.font = '700 86px "Space Grotesk", "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Borde biselado claro inferior para simular relieve impreso en 3D
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(180, 205, 240, 0.28)';
  ctx.strokeText('Gimena', 256, 84);

  // Cavidad oscura del texto grabado
  ctx.fillStyle = '#040507';
  ctx.fillText('Gimena', 256, 80);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ============================================================================
// PANTALLA TFT 320x240 EN VIVO (PIXEL-ART FOTO REAL + ANIME)
// ============================================================================
const tftCanvas = document.createElement('canvas');
tftCanvas.width = 320;
tftCanvas.height = 240;
const tftCtx = tftCanvas.getContext('2d');

const tftTexture = new THREE.CanvasTexture(tftCanvas);
tftTexture.colorSpace = THREE.SRGBColorSpace;
tftTexture.minFilter = THREE.LinearFilter;
tftTexture.magFilter = THREE.NearestFilter;

const P_SCALE = 4; // 80x60 grilla pixel-art
function pRect(px, py, pw, ph, color) {
  tftCtx.fillStyle = color;
  tftCtx.fillRect(
    Math.round(px) * P_SCALE,
    Math.round(py) * P_SCALE,
    Math.round(pw) * P_SCALE,
    Math.round(ph) * P_SCALE
  );
}

function drawPixelEye(centerPx, centerPy, lookX, lookY, emotion, blink) {
  const cx = Math.round(centerPx + lookX * 3.5);
  const cy = Math.round(centerPy + lookY * 2.5);

  if (blink > 0.65 || emotion === 'sleepy') {
    const navy = '#182868';
    for (let dx = -9; dx <= 9; dx++) {
      const dy = emotion === 'happy' || emotion === 'love'
        ? -Math.round((1 - (dx / 9) ** 2) * 3)
        : Math.round((1 - (dx / 9) ** 2) * 2);
      pRect(cx + dx, cy + dy, 1, 2, navy);
    }
    return;
  }

  const rx = emotion === 'surprised' ? 11 : 10;
  const ry = emotion === 'surprised' ? 12 : 11;

  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const norm = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
      if (norm > 1.0) continue;

      if (norm >= 0.72) {
        pRect(cx + dx, cy + dy, 1, 1, '#162564');
      } else {
        const isLowerCrescent =
          dy > 2 &&
          (dx * dx) / ((rx - 2) ** 2) + ((dy - 1) * (dy - 1)) / ((ry - 2) ** 2) > 0.36;
        if (isLowerCrescent) {
          pRect(cx + dx, cy + dy, 1, 1, '#00d8ff');
        } else if (dy < -3) {
          pRect(cx + dx, cy + dy, 1, 1, '#1c42b8');
        } else {
          pRect(cx + dx, cy + dy, 1, 1, '#245be0');
        }
      }
    }
  }

  if (emotion === 'love') {
    const hc = '#ff4d94';
    pRect(cx - 3, cy - 2, 2, 2, hc);
    pRect(cx + 1, cy - 2, 2, 2, hc);
    pRect(cx - 4, cy - 1, 9, 2, hc);
    pRect(cx - 3, cy + 1, 7, 2, hc);
    pRect(cx - 1, cy + 3, 3, 2, hc);
  }

  // Doble brillo blanco idéntico a la foto 1
  pRect(cx - 5, cy - 5, 4, 4, '#ffffff');
  pRect(cx - 6, cy - 4, 1, 2, '#ffffff');
  pRect(cx - 4, cy - 6, 2, 1, '#ffffff');
  pRect(cx + 3, cy + 3, 2, 2, '#ffffff');

  if (emotion === 'sad') {
    const tearY = (Date.now() % 900) / 150;
    pRect(cx - 6, cy + 7 + tearY, 2, 3, '#5ce1ff');
  }
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
  if (emotion === 'thinking') {
    pRect(centerPx - 4, centerPy + 1, 8, 1, navy);
    pRect(centerPx + 4, centerPy, 2, 1, navy);
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

function renderTFTScreen(timeSec) {
  const emotion = state.emotion;
  const lx = state.smoothLook.x;
  const ly = state.smoothLook.y;

  if (state.faceStyle === 'pixel') {
    const grad = tftCtx.createLinearGradient(0, 0, 0, 240);
    grad.addColorStop(0, emotion === 'sleepy' ? '#6aa6dc' : '#9cd4ff');
    grad.addColorStop(1, emotion === 'sleepy' ? '#8bc0ee' : '#b6e2ff');
    tftCtx.fillStyle = grad;
    tftCtx.fillRect(0, 0, 320, 240);

    if (emotion === 'love') {
      for (let i = 0; i < 6; i++) {
        const hx = 8 + ((i * 13) % 70);
        const hy = 56 - Math.floor((timeSec * 14 + i * 11) % 58);
        pRect(hx, hy, 2, 2, '#ff4d94');
        pRect(hx + 2, hy, 2, 2, '#ff4d94');
        pRect(hx, hy + 1, 4, 2, '#ff4d94');
        pRect(hx + 1, hy + 3, 2, 1, '#ff4d94');
      }
    } else if (emotion === 'music') {
      for (let b = 0; b < 14; b++) {
        const bh = 2 + Math.round(Math.abs(Math.sin(timeSec * 7 + b * 0.7)) * 7);
        pRect(12 + b * 4, 56 - bh, 3, bh, b % 2 === 0 ? '#245be0' : '#00b8ff');
      }
    } else if (emotion === 'thinking') {
      const bob = Math.round(Math.sin(timeSec * 4) * 2);
      pRect(64, 10 + bob, 5, 2, '#162564');
      pRect(67, 12 + bob, 2, 3, '#162564');
      pRect(65, 15 + bob, 2, 2, '#162564');
      pRect(65, 19 + bob, 2, 2, '#162564');
    }

    if (emotion === 'love' || state.pokeBounce > 0.05) {
      pRect(14, 34, 6, 3, '#ff9ebb');
      pRect(60, 34, 6, 3, '#ff9ebb');
    }

    drawPixelEye(25, 24, lx, ly, emotion, state.blinkProgress);
    drawPixelEye(55, 24, lx, ly, emotion, state.blinkProgress);
    drawPixelMouth(40, 43, emotion, state.isSpeaking, state.mouthOpen);
  } else {
    // Modo Retrato Anime del firmware
    const skyGrad = tftCtx.createLinearGradient(0, 0, 0, 240);
    skyGrad.addColorStop(0, emotion === 'love' ? '#ffb2d0' : '#96c8fa');
    skyGrad.addColorStop(1, '#deefff');
    tftCtx.fillStyle = skyGrad;
    tftCtx.fillRect(0, 0, 320, 240);

    tftCtx.fillStyle = '#1e423c';
    tftCtx.beginPath();
    tftCtx.ellipse(160, 130, 88, 95, 0, 0, Math.PI * 2);
    tftCtx.fill();

    tftCtx.fillStyle = '#ffe5d0';
    tftCtx.beginPath();
    tftCtx.ellipse(160, 128, 68, 64, 0, 0, Math.PI * 2);
    tftCtx.fill();

    tftCtx.fillStyle = '#1e423c';
    tftCtx.beginPath();
    tftCtx.arc(160, 92, 70, Math.PI, Math.PI * 2);
    tftCtx.fill();

    [124, 196].forEach((ox) => {
      tftCtx.fillStyle = '#ffffff';
      tftCtx.beginPath();
      tftCtx.ellipse(ox, 130, 20, 22, 0, 0, Math.PI * 2);
      tftCtx.fill();

      tftCtx.fillStyle = '#3b5bdb';
      tftCtx.beginPath();
      tftCtx.ellipse(ox + lx * 7, 131 + ly * 5, 14, 18, 0, 0, Math.PI * 2);
      tftCtx.fill();

      tftCtx.fillStyle = '#ffffff';
      tftCtx.beginPath();
      tftCtx.arc(ox - 5 + lx * 4, 122 + ly * 3, 5, 0, Math.PI * 2);
      tftCtx.fill();
    });

    tftCtx.strokeStyle = '#7a2c38';
    tftCtx.lineWidth = 3;
    tftCtx.beginPath();
    if (state.isSpeaking && state.mouthOpen > 0.2) {
      tftCtx.fillStyle = '#9c2e42';
      tftCtx.ellipse(160, 166, 9, 4 + state.mouthOpen * 8, 0, 0, Math.PI * 2);
      tftCtx.fill();
    } else {
      tftCtx.arc(154, 164, 6, 0, Math.PI);
      tftCtx.arc(166, 164, 6, 0, Math.PI);
      tftCtx.stroke();
    }
  }

  tftCtx.fillStyle = 'rgba(0, 18, 42, 0.05)';
  for (let y = 0; y < 240; y += 4) {
    tftCtx.fillRect(0, y, 320, 1);
  }
  tftTexture.needsUpdate = true;
}

// ============================================================================
// ESCENA THREE.JS Y CONSTRUCCIÓN COMPLETA DE GIMENA (FRENTE + LADO + ESPALDA)
// ============================================================================
const container = document.getElementById('canvasContainer');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  36,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.copy(SCROLL_CHAPTERS[0].camPos);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enableZoom = false; // Para que la rueda del ratón haga scroll por la historia fluida
controls.target.copy(SCROLL_CHAPTERS[0].camTarget);

controls.addEventListener('start', () => {
  state.userOrbiting = true;
});
controls.addEventListener('end', () => {
  setTimeout(() => {
    state.userOrbiting = false;
  }, 1800);
});

// Luces de estudio (frontal, contra-luz para ver la espalda y las 5 ranuras, y luz IoT)
const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.95);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.3);
keyLight.position.set(4.5, 6.5, 5.5);
keyLight.castShadow = true;
scene.add(keyLight);

const backLight = new THREE.DirectionalLight(0x93c5fd, 1.85);
backLight.position.set(-3.5, 4.5, -6.0);
scene.add(backLight);

const screenGlowLight = new THREE.PointLight(0x7cc9ff, 1.3, 4.5);
screenGlowLight.position.set(0, 0.95, 1.35);
scene.add(screenGlowLight);

const roomSmartLight = new THREE.PointLight(0xfbbf24, 0, 12);
roomSmartLight.position.set(-2.5, 4.0, 3.5);
scene.add(roomSmartLight);

const layerBumpTex = create3DPrintLayerBumpTexture();

const blackPlaMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x13171f,
  roughness: 0.27,
  metalness: 0.09,
  clearcoat: 0.72,
  clearcoatRoughness: 0.2,
  bumpMap: layerBumpTex,
  bumpScale: 0.008,
  transparent: true,
  opacity: 1.0,
});

const darkCavityMaterial = new THREE.MeshStandardMaterial({
  color: 0x040507,
  roughness: 0.88,
  metalness: 0.1,
});

const seamLineMaterial = new THREE.MeshStandardMaterial({
  color: 0x05070a,
  roughness: 0.9,
});

// ============================================================================
// MODELO 3D DE GIMENA CON LOS DETALLES DE LAS 3 FOTOS REALES
// ============================================================================
const gimenaRoot = new THREE.Group();
scene.add(gimenaRoot);

// 1. CABEZA (Frente: Pantalla + Ranura + Mic INMP441 | Lado: Unión 2 mitades | Espalda: 5 Ranuras + Grabado "Gimena")
const headGroup = new THREE.Group();
headGroup.position.set(0, 1.02, 0);
gimenaRoot.add(headGroup);

const headShellMesh = new THREE.Mesh(
  new RoundedBoxGeometry(2.38, 2.24, 1.78, 5, 0.11),
  blackPlaMaterial
);
headShellMesh.castShadow = true;
headShellMesh.receiveShadow = true;
headGroup.add(headShellMesh);

// Costura vertical lateral de unión de las 2 mitades impresas en 3D (vista en Foto 2)
const headSeamRing = new THREE.Mesh(
  new THREE.BoxGeometry(2.405, 2.25, 0.028),
  seamLineMaterial
);
headGroup.add(headSeamRing);

// Pantalla TFT 2.4" frontal empotrada
const bezelRecessMesh = new THREE.Mesh(
  new RoundedBoxGeometry(1.66, 1.26, 0.12, 3, 0.03),
  darkCavityMaterial
);
bezelRecessMesh.position.set(0, 0.12, 0.86);
headGroup.add(bezelRecessMesh);

const tftScreenMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(1.56, 1.17),
  new THREE.MeshBasicMaterial({ map: tftTexture })
);
tftScreenMesh.position.set(0, 0.12, 0.925);
tftScreenMesh.name = 'screen';
headGroup.add(tftScreenMesh);

// Ranura inferior frontal + Micrófono circular derecho INMP441 (Foto 1)
const frontSlotMesh = new THREE.Mesh(
  new RoundedBoxGeometry(1.06, 0.085, 0.08, 2, 0.02),
  darkCavityMaterial
);
frontSlotMesh.position.set(-0.16, -0.76, 0.87);
headGroup.add(frontSlotMesh);

const micRimMesh = new THREE.Mesh(
  new THREE.RingGeometry(0.055, 0.088, 24),
  new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.3, metalness: 0.7, side: THREE.DoubleSide })
);
micRimMesh.position.set(0.62, -0.76, 0.906);
headGroup.add(micRimMesh);

const micHoleMesh = new THREE.Mesh(
  new THREE.CircleGeometry(0.055, 24),
  darkCavityMaterial
);
micHoleMesh.position.set(0.62, -0.76, 0.904);
micHoleMesh.name = 'mic';
headGroup.add(micHoleMesh);

// ESPALDA DE LA CABEZA (Foto 3): 5 Ranuras verticales de ventilación + Grabado "Gimena"
const backVentGroup = new THREE.Group();
backVentGroup.position.set(0, 0.36, -0.892);
headGroup.add(backVentGroup);

for (let i = -2; i <= 2; i++) {
  // Hueco de cada una de las 5 ranuras verticales
  const slotMesh = new THREE.Mesh(
    new RoundedBoxGeometry(0.11, 0.42, 0.06, 2, 0.015),
    darkCavityMaterial
  );
  slotMesh.position.set(i * 0.27, 0, 0);
  backVentGroup.add(slotMesh);
}

// Grabado "Gimena" debajo de las 5 ranuras verticales (Foto 3)
const gimenaLogoPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(1.55, 0.48),
  new THREE.MeshBasicMaterial({
    map: createEngravedGimenaTexture(),
    transparent: true,
  })
);
gimenaLogoPlane.position.set(0, -0.42, -0.895);
gimenaLogoPlane.rotation.y = Math.PI;
headGroup.add(gimenaLogoPlane);

// Banda negra mate en la unión trasera del cuello (visible en Foto 3)
const backTapeMesh = new THREE.Mesh(
  new THREE.BoxGeometry(2.15, 0.46, 0.04),
  new THREE.MeshStandardMaterial({ color: 0x181b22, roughness: 0.78, metalness: 0.05 })
);
backTapeMesh.position.set(0, -0.92, -0.89);
headGroup.add(backTapeMesh);

// 2. TORSO (Frente: 19 agujeros del parlante | Lado: costura 2 mitades + brazos | Espalda: Puerto USB inferior)
const torsoGroup = new THREE.Group();
torsoGroup.position.set(0, -0.82, 0);
gimenaRoot.add(torsoGroup);

const torsoShellMesh = new THREE.Mesh(
  new RoundedBoxGeometry(3.16, 1.52, 2.02, 5, 0.11),
  blackPlaMaterial
);
torsoShellMesh.castShadow = true;
torsoShellMesh.receiveShadow = true;
torsoGroup.add(torsoShellMesh);

// Costura vertical lateral del torso (unión de las 2 mitades en Foto 2)
const torsoSeamRing = new THREE.Mesh(
  new THREE.BoxGeometry(3.185, 1.53, 0.028),
  seamLineMaterial
);
torsoGroup.add(torsoSeamRing);

const neckCollarMesh = new THREE.Mesh(
  new RoundedBoxGeometry(2.54, 0.14, 1.88, 4, 0.04),
  blackPlaMaterial
);
neckCollarMesh.position.set(0, 0.78, 0);
torsoGroup.add(neckCollarMesh);

// Rejilla circular frontal de 19 perforaciones (1 + 6 + 12)
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
const holeGeo = new THREE.CircleGeometry(0.048, 20);
holeCoords.forEach(([hx, hy]) => {
  const m = new THREE.Mesh(holeGeo, darkCavityMaterial);
  m.position.set(hx, hy, 0);
  m.name = 'speaker';
  speakerGrilleGroup.add(m);
});

// Anillos de ondas sonoras 3D
const soundWaveRings = [];
for (let i = 0; i < 3; i++) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.21, 32),
    new THREE.MeshBasicMaterial({
      color: 0x00d8ff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    })
  );
  ring.position.set(0, 0.06, 1.04);
  torsoGroup.add(ring);
  soundWaveRings.push(ring);
}

// Hueco rectangular trasero inferior para la salida del cable USB (Foto 3)
const usbPortCutoutMesh = new THREE.Mesh(
  new RoundedBoxGeometry(0.36, 0.26, 0.14, 2, 0.02),
  darkCavityMaterial
);
usbPortCutoutMesh.position.set(0, -0.42, -0.98);
torsoGroup.add(usbPortCutoutMesh);

// 3. BRAZOS LATERALES CON BASE CILÍNDRICA EN LA MITAD FRONTAL (Foto 2)
function createSideArm(isLeft) {
  const group = new THREE.Group();
  const sign = isLeft ? -1 : 1;
  // Ubicado en la mitad delantera del lateral, exactamente como en la foto 2
  group.position.set(sign * 1.62, -0.86, 0.36);

  // Base cilíndrica de hombro
  const shoulderPeg = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.18, 24),
    blackPlaMaterial
  );
  shoulderPeg.rotation.z = Math.PI / 2;
  group.add(shoulderPeg);

  // Bloque vertical redondeado del brazo
  const armBlock = new THREE.Mesh(
    new RoundedBoxGeometry(0.36, 0.68, 0.38, 4, 0.08),
    blackPlaMaterial
  );
  armBlock.position.set(sign * 0.16, -0.04, 0);
  armBlock.castShadow = true;
  group.add(armBlock);

  return group;
}

const leftArmGroup = createSideArm(true);
const rightArmGroup = createSideArm(false);
gimenaRoot.add(leftArmGroup);
gimenaRoot.add(rightArmGroup);

// 4. PIES CON UNIÓN CENTRAL DE LAS 2 MITADES (Foto 2 y 3)
const feetGroup = new THREE.Group();
feetGroup.position.set(0, -1.78, 0.14);
gimenaRoot.add(feetGroup);

[-0.78, 0.78].forEach((fx) => {
  const foot = new THREE.Mesh(
    new RoundedBoxGeometry(0.92, 0.46, 1.62, 4, 0.08),
    blackPlaMaterial
  );
  foot.position.set(fx, 0, 0);
  foot.castShadow = true;
  feetGroup.add(foot);

  // Línea de unión de las 2 mitades en los pies (Foto 2)
  const footSeam = new THREE.Mesh(
    new THREE.BoxGeometry(0.94, 0.47, 0.028),
    seamLineMaterial
  );
  footSeam.position.set(fx, 0, -0.14);
  feetGroup.add(footSeam);
});

// 5. CABLE USB BLANCO SALIENDO DEL HUECO RECTANGULAR TRASERO (Foto 3)
const usbCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0.0, -1.24, -0.96),
  new THREE.Vector3(0.18, -1.55, -1.45),
  new THREE.Vector3(0.65, -1.88, -2.05),
  new THREE.Vector3(1.45, -1.96, -2.85),
]);
const usbCableMesh = new THREE.Mesh(
  new THREE.TubeGeometry(usbCurve, 36, 0.055, 16, false),
  new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
);
gimenaRoot.add(usbCableMesh);

// 6. COMPONENTES INTERNOS (ESP32 + TFT PCB + SPEAKER I2S) PARA EL PASO 7 (RAYOS-X)
const internalsGroup = new THREE.Group();
gimenaRoot.add(internalsGroup);

const esp32Group = new THREE.Group();
esp32Group.position.set(0, -0.82, -0.15);
internalsGroup.add(esp32Group);

const pcbMesh = new THREE.Mesh(
  new RoundedBoxGeometry(1.45, 0.1, 0.85, 2, 0.02),
  new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.35, metalness: 0.3 })
);
esp32Group.add(pcbMesh);

const wifiShieldMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.58, 0.12, 0.52),
  new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.85 })
);
wifiShieldMesh.position.set(-0.25, 0.08, 0);
esp32Group.add(wifiShieldMesh);

const espLedMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.045, 12, 12),
  new THREE.MeshBasicMaterial({ color: 0x00d8ff })
);
espLedMesh.position.set(0.52, 0.09, 0.22);
esp32Group.add(espLedMesh);

const internalSpeakerMesh = new THREE.Mesh(
  new THREE.CylinderGeometry(0.42, 0.42, 0.28, 28),
  new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.35, metalness: 0.7 })
);
internalSpeakerMesh.rotation.x = Math.PI / 2;
internalSpeakerMesh.position.set(0, -0.76, 0.58);
internalsGroup.add(internalSpeakerMesh);

// Partículas de viento 3D para el ventilador IoT
const windParticlesGroup = new THREE.Group();
windParticlesGroup.visible = false;
scene.add(windParticlesGroup);
const windLines = [];
for (let i = 0; i < 16; i++) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.02, 0.02),
    new THREE.MeshBasicMaterial({ color: 0x7cc9ff, transparent: true, opacity: 0.5 })
  );
  m.position.set((Math.random() - 0.5) * 5, -1.2 + Math.random() * 3.0, (Math.random() - 0.5) * 3);
  windParticlesGroup.add(m);
  windLines.push({ mesh: m, speed: 2.4 + Math.random() * 2.2 });
}

// ============================================================================
// PUNTERO SVG DINÁMICO + ANILLO SEÑALADOR 3D
// ============================================================================
const pointerPath = document.getElementById('pointerPath');
const targetBeacon = document.getElementById('targetBeacon');
const beaconTag = document.getElementById('beaconTag');
const activeStepIndicator = document.getElementById('activeStepIndicator');

function updatePointerLine() {
  const chapter = SCROLL_CHAPTERS[state.activeStep] || SCROLL_CHAPTERS[0];

  if (!chapter.showPointer || window.innerWidth < 860) {
    targetBeacon.style.opacity = '0';
    pointerPath.setAttribute('d', '');
    return;
  }

  // Proyectar coordenada 3D de la parte activa a pantalla 2D
  const worldTarget = chapter.anchorLocal.clone().applyMatrix4(gimenaRoot.matrixWorld);
  worldTarget.project(camera);

  const tx = (worldTarget.x * 0.5 + 0.5) * window.innerWidth;
  const ty = (-worldTarget.y * 0.5 + 0.5) * window.innerHeight;

  targetBeacon.style.opacity = '1';
  targetBeacon.style.left = `${tx}px`;
  targetBeacon.style.top = `${ty}px`;
  beaconTag.textContent = chapter.beaconLabel;

  // Conectar desde el borde derecho de la tarjeta activa hasta el punto 3D
  const activeCardEl = document.querySelector(`.scroll-step[data-step="${state.activeStep}"] .step-card`);
  if (!activeCardEl) return;

  const rect = activeCardEl.getBoundingClientRect();
  const sx = rect.right;
  const sy = rect.top + rect.height * 0.45;

  const cx1 = sx + (tx - sx) * 0.45;
  const cy1 = sy;
  const cx2 = sx + (tx - sx) * 0.65;
  const cy2 = ty;

  pointerPath.setAttribute('d', `M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`);
}

// ============================================================================
// SÍNTESIS DE VOZ Y ACCIONES INTERACTIVAS
// ============================================================================
const speechText = document.getElementById('speechText');
const waveDots = document.getElementById('waveDots');
let speechTimer = null;

function setEmotion(emo) {
  state.emotion = emo;
  document.querySelectorAll('.emo-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.emotion === emo);
  });
}

function setViewMode(mode) {
  state.viewMode = mode;
  document.querySelectorAll('.hud-chip[data-view]').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === mode);
  });

  if (mode === 'normal') {
    blackPlaMaterial.opacity = 1.0;
    blackPlaMaterial.depthWrite = true;
  } else if (mode === 'xray') {
    blackPlaMaterial.opacity = 0.26;
    blackPlaMaterial.depthWrite = false;
  } else if (mode === 'exploded') {
    blackPlaMaterial.opacity = 0.68;
    blackPlaMaterial.depthWrite = true;
  }
}

function gimenaSpeak(text, emotion = 'happy') {
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
    u.rate = 1.05;
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
  }, Math.min(8000, Math.max(2000, text.length * 55)));
}

// ============================================================================
// DETECCIÓN DE SCROLL (INTERSECTION OBSERVER) PARA GIRAR Y SEÑALAR PARTES
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
          activeStepIndicator.textContent = chapter.title;
          setViewMode(chapter.viewMode);
        }
      }
    });
  },
  { threshold: 0.52 }
);

stepElements.forEach((el) => observer.observe(el));

// ============================================================================
// EVENTOS DE BOTONES, CLIC 3D Y CHAT
// ============================================================================
document.getElementById('btnHeroSpeak').addEventListener('click', () => {
  state.pokeBounce = 0.28;
  gimenaSpeak(
    '¡Hola! Haz scroll hacia abajo y te iré mostrando mi pantalla TFT, mi micrófono, mi parlante, mi espalda grabada y mi cerebro ESP32.',
    'happy'
  );
});

document.querySelectorAll('[data-trigger]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const t = btn.dataset.trigger;
    if (t === 'cycle-emotions') {
      ['love', 'surprised', 'thinking', 'music', 'sad', 'sleepy', 'happy'].forEach((emo, i) => {
        setTimeout(() => setEmotion(emo), i * 550);
      });
      gimenaSpeak('¡Mira mis 7 expresiones en la pantalla TFT de 2.4 pulgadas!', 'love');
    } else if (t === 'swap-face') {
      state.faceStyle = state.faceStyle === 'pixel' ? 'anime' : 'pixel';
      document.getElementById('btnToggleFaceStyle').textContent =
        state.faceStyle === 'pixel' ? 'Pixel-Art' : 'Anime TFT';
      gimenaSpeak(
        state.faceStyle === 'pixel'
          ? '¡Rostro Pixel-Art celeste UwU activado!'
          : '¡Rostro Anime del firmware activado!',
        'happy'
      );
    } else if (t === 'test-mic') {
      gimenaSpeak(
        '¡Te escucho fuerte y claro por mi micrófono digital INMP441! Y si falla la nube, tu PC traduce el audio por mí.',
        'surprised'
      );
    } else if (t === 'test-speaker') {
      gimenaSpeak(
        '¡Mira cómo salen las ondas de sonido 3D por mis 19 agujeritos frontales con el amplificador MAX98357A!',
        'music'
      );
    } else if (t === 'toggle-exploded') {
      setViewMode(state.viewMode === 'exploded' ? 'xray' : 'exploded');
      gimenaSpeak('¡Separando mis piezas en 3D para que veas mi interior!', 'surprised');
    }
  });
});

// Controles IoT en el paso 7
document.querySelectorAll('.iot-pill').forEach((pill) => {
  pill.addEventListener('click', () => {
    const dev = pill.dataset.device;
    state.devices[dev] = !state.devices[dev];
    const on = state.devices[dev];
    pill.classList.toggle('active', on);
    pill.querySelector('span').textContent = on ? 'ON' : 'OFF';

    const anyLight = state.devices.sala || state.devices.cocina || state.devices.tuya;
    document.body.classList.toggle('lights-on', anyLight);
    roomSmartLight.intensity = anyLight ? 2.6 : 0;
    windParticlesGroup.visible = state.devices.ventilador;

    gimenaSpeak(
      `¡He ${on ? 'encendido' : 'apagado'} ${dev === 'tuya' ? 'el enchufe Tuya' : 'el dispositivo ' + dev}!`,
      on ? 'happy' : 'thinking'
    );
  });
});

document.getElementById('btnSimulateFallback').addEventListener('click', () => {
  state.cloudFallbackMode = !state.cloudFallbackMode;
  gimenaSpeak(
    state.cloudFallbackMode
      ? '¡Simulando caída de API Cloud! Mi servidor en el PC acaba de tomar el control con voz local SalomeNeural para que jamás me quede muda.'
      : '¡Conexión directa en la nube restaurada con Gemini 3.5 Flash Lite!',
    'surprised'
  );
});

// Botones de la barra superior y dock inferior
document.querySelectorAll('.hud-chip[data-view]').forEach((chip) => {
  chip.addEventListener('click', () => setViewMode(chip.dataset.view));
});

document.getElementById('btnToggleFaceStyle').addEventListener('click', (e) => {
  state.faceStyle = state.faceStyle === 'pixel' ? 'anime' : 'pixel';
  e.currentTarget.textContent = state.faceStyle === 'pixel' ? 'Pixel-Art' : 'Anime TFT';
});

document.querySelectorAll('.emo-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    setEmotion(btn.dataset.emotion);
    state.pokeBounce = 0.2;
  });
});

// Chat / Micrófono en el dock inferior
document.getElementById('chatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  const lower = text.toLowerCase();
  if (lower.includes('sala')) {
    document.querySelector('.iot-pill[data-device="sala"]').click();
  } else if (lower.includes('ventilador')) {
    document.querySelector('.iot-pill[data-device="ventilador"]').click();
  } else if (lower.includes('espalda') || lower.includes('atrás')) {
    document.querySelector('.scroll-step[data-step="5"]').scrollIntoView({ behavior: 'smooth' });
    gimenaSpeak('¡Mira mi espalda! Tengo 5 ranuras de ventilación, mi nombre Gimena grabado y mi cable USB blanco.', 'happy');
  } else {
    gimenaSpeak('¡Recibido! Soy Gimena, tu asistente con cerebro Gemini 3.5, pantalla TFT y respaldo automático en PC.', 'happy');
  }
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  const rec = new SpeechRecognition();
  rec.lang = 'es-CO';
  document.getElementById('btnVoiceInput').addEventListener('click', () => {
    try {
      rec.start();
      speechText.textContent = 'Escuchando tu voz...';
    } catch {}
  });
  rec.onresult = (ev) => {
    const t = ev.results[0][0].transcript;
    document.getElementById('chatInput').value = t;
    document.getElementById('chatForm').requestSubmit();
  };
}

// Modal de las 3 Fotos Reales
const galleryModal = document.getElementById('galleryModal');
document.getElementById('btnOpenGallery').addEventListener('click', () => {
  galleryModal.classList.remove('hidden');
});
document.getElementById('btnCloseGallery').addEventListener('click', () => {
  galleryModal.classList.add('hidden');
});
galleryModal.addEventListener('click', (e) => {
  if (e.target === galleryModal) galleryModal.classList.add('hidden');
});

// Seguimiento del cursor y clic directo sobre el modelo 3D
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
let downPos = { x: 0, y: 0 };

window.addEventListener('pointermove', (e) => {
  state.lookTarget.set(
    (e.clientX / window.innerWidth) * 2 - 1,
    (e.clientY / window.innerHeight) * 2 - 1
  );
});

renderer.domElement.addEventListener('pointerdown', (e) => {
  downPos = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6) return;
  pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects(gimenaRoot.children, true);
  if (hits.length > 0) {
    state.pokeBounce = 0.32;
    gimenaSpeak('¡Jiji! Me hiciste cosquillas en mi chasis impreso en 3D UwU', 'love');
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================================
// BUCLE PRINCIPAL DE ANIMACIÓN 60 FPS (INTERPOLACIÓN SUAVE CON EL SCROLL)
// ============================================================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();

  state.smoothLook.lerp(state.lookTarget, 0.08);

  // Parpadeo automático
  if (elapsed > state.nextBlinkTime) {
    const p = (elapsed - state.nextBlinkTime) / 0.18;
    if (p <= 1) {
      state.blinkProgress = Math.sin(p * Math.PI);
    } else {
      state.blinkProgress = 0;
      state.nextBlinkTime = elapsed + 2.4 + Math.random() * 3.0;
    }
  }

  // Movimiento labial al hablar
  if (state.isSpeaking) {
    state.mouthOpen = 0.25 + 0.75 * Math.abs(Math.sin(elapsed * 15.5) * Math.cos(elapsed * 6.3));
  } else {
    state.mouthOpen = THREE.MathUtils.lerp(state.mouthOpen, 0, 0.2);
  }

  renderTFTScreen(elapsed);

  // Interpolación suave de la cámara y rotación del robot según el paso del Scroll
  const chapter = SCROLL_CHAPTERS[state.activeStep] || SCROLL_CHAPTERS[0];
  const isMobile = window.innerWidth < 860;

  if (!state.userOrbiting) {
    const desiredCamPos = isMobile
      ? new THREE.Vector3(0, chapter.camPos.y, chapter.camPos.z + 1.2)
      : chapter.camPos;
    const desiredTarget = isMobile
      ? new THREE.Vector3(0, chapter.camTarget.y, 0)
      : chapter.camTarget;

    camera.position.lerp(desiredCamPos, 0.06);
    controls.target.lerp(desiredTarget, 0.06);
  }

  // Rotación del robot hacia el ángulo del capítulo activo + sutil seguimiento al mouse
  const targetRotY = chapter.robotRotY + state.smoothLook.x * 0.12;
  gimenaRoot.rotation.y = THREE.MathUtils.lerp(gimenaRoot.rotation.y, targetRotY, 0.065);

  // Respiración y despiece 3D
  state.pokeBounce = THREE.MathUtils.lerp(state.pokeBounce, 0, 0.08);
  const breathY = Math.sin(elapsed * 2.4) * 0.03;
  const explode = state.viewMode === 'exploded' ? 1 : 0;

  headGroup.position.y = THREE.MathUtils.lerp(
    headGroup.position.y,
    1.02 + breathY + explode * 0.7 + Math.abs(Math.sin(elapsed * 20)) * state.pokeBounce,
    0.1
  );
  headGroup.rotation.x = THREE.MathUtils.lerp(headGroup.rotation.x, state.smoothLook.y * 0.1, 0.08);

  leftArmGroup.position.x = THREE.MathUtils.lerp(leftArmGroup.position.x, -1.62 - explode * 0.55, 0.1);
  rightArmGroup.position.x = THREE.MathUtils.lerp(rightArmGroup.position.x, 1.62 + explode * 0.55, 0.1);

  const armWave = state.isSpeaking || state.emotion === 'music' ? Math.sin(elapsed * 10) * 0.25 : 0;
  leftArmGroup.rotation.x = armWave;
  rightArmGroup.rotation.x = -armWave;

  feetGroup.position.y = THREE.MathUtils.lerp(feetGroup.position.y, -1.78 - explode * 0.4, 0.1);

  // Ondas de sonido 3D saliendo de los 19 agujeros del parlante
  soundWaveRings.forEach((ring, idx) => {
    if (state.isSpeaking || state.emotion === 'music' || state.activeStep === 3) {
      const pr = (elapsed * 1.5 + idx * 0.33) % 1;
      const sc = 1 + pr * 2.6;
      ring.scale.set(sc, sc, 1);
      ring.material.opacity = (1 - pr) * (state.isSpeaking ? 0.65 : 0.28);
      ring.position.z = 1.03 + pr * 0.4;
    } else {
      ring.material.opacity = 0;
    }
  });

  if (windParticlesGroup.visible) {
    windLines.forEach((item) => {
      item.mesh.position.x += item.speed * 0.04;
      if (item.mesh.position.x > 3.2) item.mesh.position.x = -3.2;
    });
  }

  espLedMesh.material.color.setHex(Math.floor(elapsed * 3) % 2 === 0 ? 0x00d8ff : 0x0284c7);

  controls.update();
  renderer.render(scene, camera);
  updatePointerLine();
}

animate();
