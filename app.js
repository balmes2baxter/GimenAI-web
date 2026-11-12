import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ============================================================================
// ESTADO GLOBAL INTERACTIVO DE GIMENA
// ============================================================================
const state = {
  emotion: 'happy',        // happy | love | surprised | thinking | music | sad | sleepy
  faceStyle: 'pixel',      // 'pixel' (idéntico a la foto real) | 'anime' (retrato firmware)
  viewMode: 'normal',      // 'normal' | 'xray' | 'exploded'
  isSpeaking: false,
  mouthOpen: 0,
  blinkProgress: 0,
  nextBlinkTime: 2.2,
  lookTarget: new THREE.Vector2(0, 0),
  smoothLook: new THREE.Vector2(0, 0),
  pokeBounce: 0,
  cloudFallbackMode: false,
  devices: {
    sala: false,
    cocina: false,
    ventilador: false,
    tuya: false,
  },
};

const EMOTION_LABELS = {
  happy: 'FELIZ (UwU)',
  love: 'AMOR (CORAZONES)',
  surprised: 'SORPRENDIDA (!)',
  thinking: 'PENSANDO (?)',
  music: 'MODO MÚSICA (♪)',
  sad: 'TRISTE (LLUVIA)',
  sleepy: 'DORMIDA (Zzz)',
};

// ============================================================================
// GENERADOR DE TEXTURA DE CAPAS DE IMPRESIÓN 3D (PLA NEGRO BRILLANTE)
// ============================================================================
function create3DPrintLayerBumpTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Líneas horizontales finas de extrusión FDM (0.2mm layer height)
  for (let y = 0; y < canvas.height; y += 3) {
    const shade = 115 + Math.sin(y * 2.1) * 22 + (Math.random() - 0.5) * 10;
    ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
    ctx.fillRect(0, y, canvas.width, 1.5);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 4);
  return tex;
}

// ============================================================================
// MOTOR DE ROSTRO EN PANTALLA TFT 320x240 (PIXEL-ART FOTO REAL + MODO ANIME)
// ============================================================================
const tftCanvas = document.createElement('canvas');
tftCanvas.width = 320;
tftCanvas.height = 240;
const tftCtx = tftCanvas.getContext('2d');

const tftTexture = new THREE.CanvasTexture(tftCanvas);
tftTexture.colorSpace = THREE.SRGBColorSpace;
tftTexture.minFilter = THREE.LinearFilter;
tftTexture.magFilter = THREE.NearestFilter;

// Utilidad para dibujar píxeles grandes en cuadrícula 64x48 (escala 5x = 320x240)
const PIXEL_SCALE = 4; // 80x60 grilla para curvas pixel-art súper fieles a la foto
function pRect(px, py, pw, ph, color) {
  tftCtx.fillStyle = color;
  tftCtx.fillRect(
    Math.round(px) * PIXEL_SCALE,
    Math.round(py) * PIXEL_SCALE,
    Math.round(pw) * PIXEL_SCALE,
    Math.round(ph) * PIXEL_SCALE
  );
}

// Dibuja un ojo pixel-art redondo como el de la foto de Gimena
function drawPixelEye(centerPx, centerPy, lookX, lookY, emotion, blink) {
  const cx = Math.round(centerPx + lookX * 3.5);
  const cy = Math.round(centerPy + lookY * 2.5);

  if (blink > 0.65 || emotion === 'sleepy') {
    // Ojo cerrado feliz o dormido
    const navy = '#182868';
    for (let dx = -9; dx <= 9; dx++) {
      const dy = emotion === 'happy' || emotion === 'love'
        ? -Math.round((1 - (dx / 9) ** 2) * 3)
        : Math.round((1 - (dx / 9) ** 2) * 2);
      pRect(cx + dx, cy + dy, 1, 2, navy);
    }
    return;
  }

  // Radio del ojo según emoción
  const rx = emotion === 'surprised' ? 11 : 10;
  const ry = emotion === 'surprised' ? 12 : 11;

  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const norm = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
      if (norm > 1.0) continue;

      // Borde exterior azul marino oscuro (#162564)
      if (norm >= 0.72) {
        pRect(cx + dx, cy + dy, 1, 1, '#162564');
      } else {
        // Interior del ojo: azul real arriba, medialuna celeste brillante abajo
        const isLowerCrescent = dy > 2 && ((dx * dx) / ((rx - 2) ** 2) + ((dy - 1) * (dy - 1)) / ((ry - 2) ** 2) > 0.36);
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

  // Si está enamorada, corazón pixelado brillante en el centro de la pupila
  if (emotion === 'love') {
    const hc = '#ff4d94';
    pRect(cx - 3, cy - 2, 2, 2, hc);
    pRect(cx + 1, cy - 2, 2, 2, hc);
    pRect(cx - 4, cy - 1, 9, 2, hc);
    pRect(cx - 3, cy + 1, 7, 2, hc);
    pRect(cx - 1, cy + 3, 3, 2, hc);
  }

  // Brillo blanco grande superior-izquierdo (idéntico a la foto)
  pRect(cx - 5, cy - 5, 4, 4, '#ffffff');
  pRect(cx - 6, cy - 4, 1, 2, '#ffffff');
  pRect(cx - 4, cy - 6, 2, 1, '#ffffff');

  // Brillo blanco pequeño inferior-derecho
  pRect(cx + 3, cy + 3, 2, 2, '#ffffff');

  // Lágrima brillante si está triste
  if (emotion === 'sad') {
    const tearY = (Date.now() % 900) / 150;
    pRect(cx - 6, cy + 7 + tearY, 2, 3, '#5ce1ff');
  }
}

// Dibuja la boca pixel-art ('w' kawaii de la foto, o animada al hablar)
function drawPixelMouth(centerPx, centerPy, emotion, isSpeaking, mouthOpen) {
  const navy = '#162564';

  if (isSpeaking && mouthOpen > 0.18) {
    const h = Math.max(2, Math.round(mouthOpen * 6));
    pRect(centerPx - 5, centerPy - 1, 10, h + 2, navy);
    pRect(centerPx - 4, centerPy, 8, h, '#ff6b8b');
    return;
  }

  if (emotion === 'surprised') {
    // Boca 'o' sorprendida
    pRect(centerPx - 3, centerPy - 1, 6, 6, navy);
    pRect(centerPx - 2, centerPy, 4, 4, '#9fd6ff');
    return;
  }

  if (emotion === 'sad') {
    // Boca curva triste
    for (let dx = -6; dx <= 6; dx++) {
      const dy = Math.round((dx * dx) / 14);
      pRect(centerPx + dx, centerPy + dy, 1, 1, navy);
    }
    return;
  }

  if (emotion === 'thinking') {
    // Boca pensativa ladeada
    pRect(centerPx - 4, centerPy + 1, 8, 1, navy);
    pRect(centerPx + 4, centerPy, 2, 1, navy);
    return;
  }

  // Por defecto (happy / love / music / sleepy): Boca 'w' kawaii exacta de la foto
  // Dos arquitos unidos en el centro formando la 'w'
  const wOffsets = [
    [-7, -1], [-6, 0], [-5, 1], [-4, 2], [-3, 2], [-2, 1], [-1, 0],
    [0, -1],
    [1, 0], [2, 1], [3, 2], [4, 2], [5, 1], [6, 0], [7, -1],
  ];
  for (const [dx, dy] of wOffsets) {
    pRect(centerPx + dx, centerPy + dy, 1, 2, navy);
  }
}

// Renderiza un fotograma completo de la pantalla TFT 320x240
function renderTFTScreen(timeSec) {
  const emotion = state.emotion;
  const lx = state.smoothLook.x;
  const ly = state.smoothLook.y;

  if (state.faceStyle === 'pixel') {
    // 1. Fondo celeste brillante idéntico a la foto (#a2d8ff)
    let bgTop = '#9cd4ff';
    let bgBottom = '#b6e2ff';
    if (emotion === 'love') {
      bgTop = '#8fd0ff';
      bgBottom = '#c2e6ff';
    } else if (emotion === 'sad') {
      bgTop = '#7eb8e8';
      bgBottom = '#9ecdf2';
    } else if (emotion === 'sleepy') {
      bgTop = '#6aa6dc';
      bgBottom = '#8bc0ee';
    }

    const grad = tftCtx.createLinearGradient(0, 0, 0, 240);
    grad.addColorStop(0, bgTop);
    grad.addColorStop(1, bgBottom);
    tftCtx.fillStyle = grad;
    tftCtx.fillRect(0, 0, 320, 240);

    // 2. Efectos de partículas pixel-art según el estado de ánimo
    if (emotion === 'love') {
      for (let i = 0; i < 6; i++) {
        const hx = 8 + ((i * 13) % 70);
        const hy = 56 - Math.floor(((timeSec * 14 + i * 11) % 58));
        pRect(hx, hy, 2, 2, '#ff4d94');
        pRect(hx + 2, hy, 2, 2, '#ff4d94');
        pRect(hx, hy + 1, 4, 2, '#ff4d94');
        pRect(hx + 1, hy + 3, 2, 1, '#ff4d94');
      }
    } else if (emotion === 'happy') {
      // Destellos sutiles en las esquinas
      const pulse = Math.floor(timeSec * 4) % 2 === 0;
      if (pulse) {
        pRect(10, 12, 1, 3, '#ffffff');
        pRect(9, 13, 3, 1, '#ffffff');
        pRect(68, 14, 1, 3, '#ffffff');
        pRect(67, 15, 3, 1, '#ffffff');
      }
    } else if (emotion === 'thinking') {
      // Signo de interrogación y bombillo pixelado
      const bob = Math.round(Math.sin(timeSec * 4) * 2);
      pRect(64, 10 + bob, 5, 2, '#162564');
      pRect(67, 12 + bob, 2, 3, '#162564');
      pRect(65, 15 + bob, 2, 2, '#162564');
      pRect(65, 19 + bob, 2, 2, '#162564');
    } else if (emotion === 'music') {
      // Barras de ecualizador en la base de la pantalla
      for (let b = 0; b < 14; b++) {
        const bh = 2 + Math.round(Math.abs(Math.sin(timeSec * 7 + b * 0.7)) * 7);
        pRect(12 + b * 4, 56 - bh, 3, bh, b % 2 === 0 ? '#245be0' : '#00b8ff');
      }
    } else if (emotion === 'sleepy') {
      // Letras Zzz flotando
      const zOffset = Math.floor(timeSec * 6) % 12;
      pRect(60, 18 - zOffset, 5, 1, '#162564');
      pRect(62, 19 - zOffset, 2, 1, '#162564');
      pRect(60, 20 - zOffset, 5, 1, '#162564');
    }

    // 3. Rubor suave en las mejillas cuando está feliz o enamorada
    if (emotion === 'love' || state.pokeBounce > 0.05) {
      pRect(14, 34, 6, 3, '#ff9ebb');
      pRect(60, 34, 6, 3, '#ff9ebb');
    }

    // 4. Ojos grandes azules pixel-art (Posición exacta de la foto)
    drawPixelEye(25, 24, lx, ly, emotion, state.blinkProgress);
    drawPixelEye(55, 24, lx, ly, emotion, state.blinkProgress);

    // 5. Boca 'w' en el centro inferior (Posición exacta de la foto)
    drawPixelMouth(40, 43, emotion, state.isSpeaking, state.mouthOpen);
  } else {
    // MODO RETRATO ANIME (Inspirado en cara_tft.h del firmware)
    const skyGrad = tftCtx.createLinearGradient(0, 0, 0, 240);
    skyGrad.addColorStop(0, emotion === 'love' ? '#ffb2d0' : '#96c8fa');
    skyGrad.addColorStop(1, emotion === 'love' ? '#ffe6f0' : '#deefff');
    tftCtx.fillStyle = skyGrad;
    tftCtx.fillRect(0, 0, 320, 240);

    const sway = Math.sin(timeSec * 2.2) * 3;
    // Cabello trasero
    tftCtx.fillStyle = '#1e423c';
    tftCtx.beginPath();
    tftCtx.ellipse(160 + sway, 130, 88, 95, 0, 0, Math.PI * 2);
    tftCtx.fill();

    // Rostro piel
    tftCtx.fillStyle = '#ffe5d0';
    tftCtx.beginPath();
    tftCtx.ellipse(160, 128, 68, 64, 0, 0, Math.PI * 2);
    tftCtx.fill();

    // Flequillo anime
    tftCtx.fillStyle = '#1e423c';
    tftCtx.beginPath();
    tftCtx.arc(160, 92, 70, Math.PI, Math.PI * 2);
    tftCtx.fill();

    // Ojos anime
    [124, 196].forEach((ox) => {
      if (state.blinkProgress > 0.6 || emotion === 'sleepy') {
        tftCtx.strokeStyle = '#221822';
        tftCtx.lineWidth = 4;
        tftCtx.beginPath();
        tftCtx.arc(ox + lx * 8, 130 + ly * 6, 16, 0.2, Math.PI - 0.2);
        tftCtx.stroke();
      } else {
        tftCtx.fillStyle = '#ffffff';
        tftCtx.beginPath();
        tftCtx.ellipse(ox, 130, 20, 22, 0, 0, Math.PI * 2);
        tftCtx.fill();

        const ig = tftCtx.createLinearGradient(0, 110, 0, 150);
        ig.addColorStop(0, '#2a2884');
        ig.addColorStop(0.5, '#4e56ce');
        ig.addColorStop(1, '#7ab0ff');
        tftCtx.fillStyle = ig;
        tftCtx.beginPath();
        tftCtx.ellipse(ox + lx * 7, 131 + ly * 5, 14, 18, 0, 0, Math.PI * 2);
        tftCtx.fill();

        tftCtx.fillStyle = '#ffffff';
        tftCtx.beginPath();
        tftCtx.arc(ox - 5 + lx * 4, 122 + ly * 3, 5, 0, Math.PI * 2);
        tftCtx.fill();
      }
    });

    // Rubor y boca anime
    tftCtx.fillStyle = 'rgba(255, 140, 160, 0.55)';
    tftCtx.beginPath();
    tftCtx.ellipse(104, 152, 12, 6, 0, 0, Math.PI * 2);
    tftCtx.ellipse(216, 152, 12, 6, 0, 0, Math.PI * 2);
    tftCtx.fill();

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

  // 6. Sutil efecto de rejilla LCD TFT (subpíxeles reales)
  tftCtx.fillStyle = 'rgba(0, 18, 42, 0.055)';
  for (let y = 0; y < 240; y += 4) {
    tftCtx.fillRect(0, y, 320, 1);
  }

  tftTexture.needsUpdate = true;
}

// ============================================================================
// ESCENA 3D THREE.JS — CONSTRUCCIÓN FIEL DEL ROBOT GIMENA
// ============================================================================
const container = document.getElementById('canvasContainer');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  38,
  container.clientWidth / container.clientHeight,
  0.1,
  100
);
camera.position.set(0.35, 0.55, 7.6);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(0, 0.15, 0);
controls.minDistance = 4.2;
controls.maxDistance = 12.5;
controls.maxPolarAngle = Math.PI * 0.54;

// Iluminación de estudio + resplandor de la pantalla TFT + luces domóticas
const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.85);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(4.5, 6.8, 5.5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x60a5fa, 1.45);
rimLight.position.set(-5.0, 4.0, -4.5);
scene.add(rimLight);

// Luz frontal emitida por la propia pantalla TFT celeste de Gimena
const screenGlowLight = new THREE.PointLight(0x7cc9ff, 1.35, 4.5);
screenGlowLight.position.set(0, 0.95, 1.35);
scene.add(screenGlowLight);

// Luz cálida de simulación IoT (Sala / Cocina)
const roomSmartLight = new THREE.PointLight(0xfbbf24, 0, 12);
roomSmartLight.position.set(-3.2, 4.2, 3.2);
scene.add(roomSmartLight);

// Materiales compartidos
const layerBumpTex = create3DPrintLayerBumpTexture();

const blackPlaMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x12151b,
  roughness: 0.28,
  metalness: 0.08,
  clearcoat: 0.68,
  clearcoatRoughness: 0.22,
  bumpMap: layerBumpTex,
  bumpScale: 0.008,
  transparent: true,
  opacity: 1.0,
});

const darkCavityMaterial = new THREE.MeshStandardMaterial({
  color: 0x050608,
  roughness: 0.85,
  metalness: 0.1,
});

// ============================================================================
// ENSAMBLAJE DEL MODELO 3D DE GIMENA (FIEL A LA FOTO SUBIDA)
// ============================================================================
const gimenaRoot = new THREE.Group();
scene.add(gimenaRoot);

// 1. CABEZAL CÚBICO SUPERIOR (Con ventana biselada 4:3, ranura inferior e INMP441)
const headGroup = new THREE.Group();
headGroup.position.set(0, 1.02, 0);
gimenaRoot.add(headGroup);

const headShellGeo = new RoundedBoxGeometry(2.38, 2.24, 1.78, 5, 0.11);
const headShellMesh = new THREE.Mesh(headShellGeo, blackPlaMaterial);
headShellMesh.castShadow = true;
headShellMesh.receiveShadow = true;
headShellMesh.name = 'head';
headGroup.add(headShellMesh);

// Marco/bisel empotrado de la pantalla TFT 2.4"
const bezelRecessGeo = new RoundedBoxGeometry(1.66, 1.26, 0.12, 3, 0.03);
const bezelRecessMesh = new THREE.Mesh(bezelRecessGeo, darkCavityMaterial);
bezelRecessMesh.position.set(0, 0.12, 0.86);
headGroup.add(bezelRecessMesh);

// Superficie luminosa de la pantalla TFT 2.4" (4:3)
const tftPlaneGeo = new THREE.PlaneGeometry(1.56, 1.17);
const tftScreenMat = new THREE.MeshBasicMaterial({ map: tftTexture });
const tftScreenMesh = new THREE.Mesh(tftPlaneGeo, tftScreenMat);
tftScreenMesh.position.set(0, 0.12, 0.925);
tftScreenMesh.name = 'screen';
headGroup.add(tftScreenMesh);

// Cristal protector acrílico brillante sobre la TFT
const screenGlassMesh = new THREE.Mesh(
  tftPlaneGeo,
  new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.12,
    roughness: 0.05,
    clearcoat: 1.0,
  })
);
screenGlassMesh.position.set(0, 0.12, 0.928);
headGroup.add(screenGlassMesh);

// Detalle 1 bajo la pantalla (fiel a la foto): Ranura horizontal inferior izquierda/central
const frontSlotGeo = new RoundedBoxGeometry(1.06, 0.085, 0.08, 2, 0.02);
const frontSlotMesh = new THREE.Mesh(frontSlotGeo, darkCavityMaterial);
frontSlotMesh.position.set(-0.16, -0.76, 0.87);
headGroup.add(frontSlotMesh);

// Detalle 2 bajo la pantalla (fiel a la foto): Orificio circular derecho del micrófono INMP441
const micRimGeo = new THREE.RingGeometry(0.055, 0.085, 24);
const micRimMat = new THREE.MeshStandardMaterial({
  color: 0x28303d,
  roughness: 0.35,
  metalness: 0.6,
  side: THREE.DoubleSide,
});
const micRimMesh = new THREE.Mesh(micRimGeo, micRimMat);
micRimMesh.position.set(0.62, -0.76, 0.905);
headGroup.add(micRimMesh);

const micHoleGeo = new THREE.CircleGeometry(0.055, 24);
const micHoleMesh = new THREE.Mesh(micHoleGeo, darkCavityMaterial);
micHoleMesh.position.set(0.62, -0.76, 0.903);
micHoleMesh.name = 'mic';
headGroup.add(micHoleMesh);

// 2. TORSO HORIZONTAL MÁS ANCHO + REJILLA CIRCULAR DE 19 AGUJEROS
const torsoGroup = new THREE.Group();
torsoGroup.position.set(0, -0.82, 0);
gimenaRoot.add(torsoGroup);

const torsoShellGeo = new RoundedBoxGeometry(3.16, 1.52, 2.02, 5, 0.11);
const torsoShellMesh = new THREE.Mesh(torsoShellGeo, blackPlaMaterial);
torsoShellMesh.castShadow = true;
torsoShellMesh.receiveShadow = true;
torsoShellMesh.name = 'torso';
torsoGroup.add(torsoShellMesh);

// Cuello/reborde superior donde encaja la cabeza (visible en la foto)
const neckCollarGeo = new RoundedBoxGeometry(2.54, 0.14, 1.88, 4, 0.04);
const neckCollarMesh = new THREE.Mesh(neckCollarGeo, blackPlaMaterial);
neckCollarMesh.position.set(0, 0.78, 0);
torsoGroup.add(neckCollarMesh);

// Rejilla acústica circular de 19 perforaciones en el centro del pecho (1 + 6 + 12)
const speakerGrilleGroup = new THREE.Group();
speakerGrilleGroup.position.set(0, 0.06, 1.012);
torsoGroup.add(speakerGrilleGroup);

const holePositions = [[0, 0]]; // 1 agujero central
const innerRadius = 0.175;
for (let i = 0; i < 6; i++) {
  const angle = (i * Math.PI) / 3;
  holePositions.push([Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius]);
}
const outerRadius = 0.35;
for (let i = 0; i < 12; i++) {
  const angle = (i * Math.PI) / 6;
  holePositions.push([Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius]);
}

const grilleHoleGeo = new THREE.CircleGeometry(0.048, 20);
holePositions.forEach(([hx, hy]) => {
  const holeMesh = new THREE.Mesh(grilleHoleGeo, darkCavityMaterial);
  holeMesh.position.set(hx, hy, 0);
  holeMesh.name = 'speaker';
  speakerGrilleGroup.add(holeMesh);
});

// Anillos de ondas sonoras 3D que emergen del parlante al hablar
const soundWaveRings = [];
for (let i = 0; i < 3; i++) {
  const ringGeo = new THREE.RingGeometry(0.18, 0.21, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x68c8ff,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.position.set(0, 0.06, 1.04);
  torsoGroup.add(ringMesh);
  soundWaveRings.push(ringMesh);
}

// 3. BRAZOS LATERALES CORTOS (BLOQUES RECTANGULARES BISELADOS)
const armGeo = new RoundedBoxGeometry(0.46, 0.68, 0.88, 4, 0.09);

const leftArmGroup = new THREE.Group();
leftArmGroup.position.set(-1.74, -0.82, 0);
const leftArmMesh = new THREE.Mesh(armGeo, blackPlaMaterial);
leftArmMesh.castShadow = true;
leftArmGroup.add(leftArmMesh);
gimenaRoot.add(leftArmGroup);

const rightArmGroup = new THREE.Group();
rightArmGroup.position.set(1.74, -0.82, 0);
const rightArmMesh = new THREE.Mesh(armGeo, blackPlaMaterial);
rightArmMesh.castShadow = true;
rightArmGroup.add(rightArmMesh);
gimenaRoot.add(rightArmGroup);

// 4. PIES ROBUSTOS SOBRESALIENDO HACIA ADELANTE (COMO EN LA FOTO)
const feetGroup = new THREE.Group();
feetGroup.position.set(0, -1.78, 0.22);
gimenaRoot.add(feetGroup);

const footGeo = new RoundedBoxGeometry(0.92, 0.46, 1.54, 4, 0.09);
const leftFootMesh = new THREE.Mesh(footGeo, blackPlaMaterial);
leftFootMesh.position.set(-0.78, 0, 0);
leftFootMesh.castShadow = true;
leftFootMesh.receiveShadow = true;
feetGroup.add(leftFootMesh);

const rightFootMesh = new THREE.Mesh(footGeo, blackPlaMaterial);
rightFootMesh.position.set(0.78, 0, 0);
rightFootMesh.castShadow = true;
rightFootMesh.receiveShadow = true;
feetGroup.add(rightFootMesh);

// 5. CABLE USB BLANCO SALIENDO DESDE ATRÁS HACIA LA DERECHA (FIEL A LA FOTO)
const usbCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0.15, -1.25, -0.95),
  new THREE.Vector3(0.85, -1.72, -0.45),
  new THREE.Vector3(1.85, -1.94, 0.65),
  new THREE.Vector3(3.1, -1.97, 2.1),
]);
const usbGeo = new THREE.TubeGeometry(usbCurve, 36, 0.055, 16, false);
const usbMat = new THREE.MeshStandardMaterial({
  color: 0xf1f5f9,
  roughness: 0.35,
  metalness: 0.05,
});
const usbCableMesh = new THREE.Mesh(usbGeo, usbMat);
usbCableMesh.castShadow = true;
gimenaRoot.add(usbCableMesh);

// 6. COMPONENTES ELECTRÓNICOS INTERNOS (Visibles en modo Rayos-X y Despiece 3D)
const internalsGroup = new THREE.Group();
gimenaRoot.add(internalsGroup);

// Placa ESP32 DevKit V1 en el interior del torso
const esp32Group = new THREE.Group();
esp32Group.position.set(0, -0.82, -0.15);
internalsGroup.add(esp32Group);

const pcbMesh = new THREE.Mesh(
  new RoundedBoxGeometry(1.45, 0.1, 0.85, 2, 0.02),
  new THREE.MeshStandardMaterial({ color: 0x0f5132, roughness: 0.4, metalness: 0.3 })
);
esp32Group.add(pcbMesh);

const wifiShieldMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.58, 0.12, 0.52),
  new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.25, metalness: 0.85 })
);
wifiShieldMesh.position.set(-0.25, 0.08, 0);
esp32Group.add(wifiShieldMesh);

const espLedMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.04, 12, 12),
  new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
);
espLedMesh.position.set(0.52, 0.09, 0.22);
esp32Group.add(espLedMesh);

// Módulo interno del altavoz I2S + Amplificador MAX98357A detrás de la rejilla
const internalSpeakerGroup = new THREE.Group();
internalSpeakerGroup.position.set(0, -0.76, 0.58);
internalsGroup.add(internalSpeakerGroup);

const speakerMagnetMesh = new THREE.Mesh(
  new THREE.CylinderGeometry(0.42, 0.42, 0.28, 28),
  new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.75 })
);
speakerMagnetMesh.rotation.x = Math.PI / 2;
internalSpeakerGroup.add(speakerMagnetMesh);

// Módulo PCB rojo de la pantalla TFT ST7789 dentro del cabezal
const internalTftBoard = new THREE.Mesh(
  new RoundedBoxGeometry(1.72, 1.32, 0.08, 2, 0.02),
  new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.45, metalness: 0.25 })
);
internalTftBoard.position.set(0, 1.14, 0.72);
internalsGroup.add(internalTftBoard);

// Base / Mesa cálida estilizada con reflejo sutil
const floorGeo = new THREE.CylinderGeometry(3.8, 4.1, 0.16, 64);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x161b26,
  roughness: 0.45,
  metalness: 0.2,
});
const floorMesh = new THREE.Mesh(floorGeo, floorMat);
floorMesh.position.set(0, -2.09, 0);
floorMesh.receiveShadow = true;
scene.add(floorMesh);

// ============================================================================
// PARTÍCULAS 3D DE VIENTO (CUANDO EL VENTILADOR IOT ESTÁ ENCENDIDO)
// ============================================================================
const windParticlesGroup = new THREE.Group();
windParticlesGroup.visible = false;
scene.add(windParticlesGroup);

const windLines = [];
for (let i = 0; i < 18; i++) {
  const lineGeo = new THREE.BoxGeometry(0.55, 0.018, 0.018);
  const lineMat = new THREE.MeshBasicMaterial({
    color: 0x7cc9ff,
    transparent: true,
    opacity: 0.45,
  });
  const mesh = new THREE.Mesh(lineGeo, lineMat);
  mesh.position.set(
    (Math.random() - 0.5) * 5,
    -1.2 + Math.random() * 3.2,
    (Math.random() - 0.5) * 3
  );
  windParticlesGroup.add(mesh);
  windLines.push({ mesh, speed: 2.2 + Math.random() * 2.5 });
}

// ============================================================================
// ETIQUETAS 3D FLOTANTES (HOTSPOTS EN MODO RAYOS-X Y DESPIECE)
// ============================================================================
const hotspotsContainer = document.getElementById('hotspotsContainer');
const HOTSPOT_DEFS = [
  {
    id: 'hs-screen',
    label: 'Pantalla TFT 2.4" ST7789 (320×240)',
    anchor: new THREE.Vector3(0, 1.35, 1.05),
    speech: 'En mi pantalla TFT de 2.4 pulgadas muestro mis emociones pixel-art y muevo mi boquita al hablar.',
  },
  {
    id: 'hs-mic',
    label: 'Micrófono I2S INMP441',
    anchor: new THREE.Vector3(0.75, 0.26, 1.02),
    speech: 'Este pequeño orificio derecho aloja mi micrófono digital INMP441 para escuchar tu voz con claridad.',
  },
  {
    id: 'hs-speaker',
    label: 'Parlante + Amp I2S MAX98357A (19 perforaciones)',
    anchor: new THREE.Vector3(0, -0.76, 1.15),
    speech: 'Detrás de mis 19 agujeritos frontales está mi altavoz conectado al amplificador digital MAX98357A.',
  },
  {
    id: 'hs-esp32',
    label: 'Cerebro ESP32 DevKit V1 + WiFi',
    anchor: new THREE.Vector3(-0.95, -0.82, -0.15),
    speech: 'Dentro de mi torso vive el ESP32 que me conecta por WiFi con Gemini 3.5 Flash Lite y con el servidor de respaldo en tu PC.',
  },
];

const hotspotElements = HOTSPOT_DEFS.map((def) => {
  const el = document.createElement('button');
  el.className = 'hotspot-pin';
  el.textContent = def.label;
  el.style.display = 'none';
  el.addEventListener('click', () => {
    gimenaSpeak(def.speech, 'happy');
  });
  hotspotsContainer.appendChild(el);
  return { ...def, el };
});

function updateHotspotsProjection() {
  const showHotspots = state.viewMode === 'xray' || state.viewMode === 'exploded';
  const width = container.clientWidth;
  const height = container.clientHeight;

  hotspotElements.forEach((hs) => {
    if (!showHotspots) {
      hs.el.style.display = 'none';
      return;
    }
    const worldPos = hs.anchor.clone().applyMatrix4(gimenaRoot.matrixWorld);
    worldPos.project(camera);

    const x = (worldPos.x * 0.5 + 0.5) * width;
    const y = (-worldPos.y * 0.5 + 0.5) * height;

    if (worldPos.z < 1) {
      hs.el.style.display = 'block';
      hs.el.style.left = `${x}px`;
      hs.el.style.top = `${y}px`;
    } else {
      hs.el.style.display = 'none';
    }
  });
}

// ============================================================================
// SÍNTESIS DE VOZ EN TIEMPO REAL + ANIMACIÓN LABIAL + BITÁCORA
// ============================================================================
const speechCard = document.getElementById('speechCard');
const gimenaSpeechText = document.getElementById('gimenaSpeechText');
const voiceWaveIndicator = document.getElementById('voiceWaveIndicator');
const hudAudioState = document.getElementById('hudAudioState');
const hudEmotionState = document.getElementById('hudEmotionState');
const terminalLog = document.getElementById('terminalLog');

function appendTerminalLog(tag, message, type = 'normal') {
  const line = document.createElement('div');
  line.className = 'log-line';
  const timeStr = new Date().toLocaleTimeString('es-CO', { hour12: false });
  const colorClass = type === 'ok' ? 'log-ok' : type === 'warn' ? 'log-warn' : '';
  line.innerHTML = `<span class="log-time">[${timeStr} · ${tag}]</span> <span class="${colorClass}">${message}</span>`;
  terminalLog.appendChild(line);
  terminalLog.scrollTop = terminalLog.scrollHeight;
}

let speechTimer = null;

function setEmotion(emotionKey) {
  if (!EMOTION_LABELS[emotionKey]) return;
  state.emotion = emotionKey;
  hudEmotionState.textContent = EMOTION_LABELS[emotionKey];

  document.querySelectorAll('.expr-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.emotion === emotionKey);
  });
}

function gimenaSpeak(text, emotion = 'happy') {
  setEmotion(emotion);
  gimenaSpeechText.textContent = `«${text}»`;
  speechCard.classList.add('speaking');
  voiceWaveIndicator.classList.add('active');
  state.isSpeaking = true;

  const engineLabel = state.cloudFallbackMode
    ? 'PC Fallback (edge-tts SalomeNeural)'
    : 'I2S MAX98357A · Voz Activa';
  hudAudioState.textContent = state.cloudFallbackMode ? 'RESPALDO PC ACTIVO' : 'HABLANDO (I2S)';

  appendTerminalLog(
    state.cloudFallbackMode ? 'PC-TTS' : 'GEMINI-TTS',
    `Gimena (${emotion}): "${text}"`,
    state.cloudFallbackMode ? 'warn' : 'ok'
  );

  if (speechTimer) clearTimeout(speechTimer);

  // Intentar usar Web Speech API del navegador en español
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/UwU/gi, ''));
    utterance.lang = 'es-CO';
    utterance.pitch = 1.25;
    utterance.rate = 1.04;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) => v.lang.startsWith('es') && /salome|sabina|helena|paulina|google|natural|female/i.test(v.name)
    ) || voices.find((v) => v.lang.startsWith('es'));
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onend = () => stopSpeakingState();
    utterance.onerror = () => stopSpeakingState();
    window.speechSynthesis.speak(utterance);
  }

  // Temporizador de respaldo para la animación labial
  const estimatedMs = Math.min(9000, Math.max(2200, text.length * 58));
  speechTimer = setTimeout(() => {
    stopSpeakingState();
  }, estimatedMs);
}

function stopSpeakingState() {
  state.isSpeaking = false;
  state.mouthOpen = 0;
  speechCard.classList.remove('speaking');
  voiceWaveIndicator.classList.remove('active');
  hudAudioState.textContent = 'EN ESPERA';
}

// ============================================================================
// CONTROL DE MODOS DE VISTA 3D (NORMAL / RAYOS-X / DESPIECE 3D)
// ============================================================================
function setViewMode(mode) {
  state.viewMode = mode;
  document.querySelectorAll('.hud-btn[data-view]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === mode);
  });

  if (mode === 'normal') {
    blackPlaMaterial.opacity = 1.0;
    blackPlaMaterial.depthWrite = true;
  } else if (mode === 'xray') {
    blackPlaMaterial.opacity = 0.28;
    blackPlaMaterial.depthWrite = false;
  } else if (mode === 'exploded') {
    blackPlaMaterial.opacity = 0.72;
    blackPlaMaterial.depthWrite = true;
  }
}

// ============================================================================
// SIMULADOR DOMÓTICO IOT (LUCES, VENTILADOR Y ENCHUFE TUYA)
// ============================================================================
const DEVICE_NAMES = {
  sala: 'Luz de la Sala (GPIO 19)',
  cocina: 'Luz de la Cocina (GPIO 21)',
  ventilador: 'Ventilador Principal (GPIO 22)',
  tuya: 'Enchufe Inteligente Tuya WiFi',
};

function toggleIoTDevice(deviceKey, forceState = null, announce = true) {
  if (!(deviceKey in state.devices)) return;
  const nextVal = forceState !== null ? forceState : !state.devices[deviceKey];
  state.devices[deviceKey] = nextVal;

  // Actualizar UI de tarjeta IoT
  const card = document.querySelector(`.iot-device-card[data-device="${deviceKey}"]`);
  const statusEl = card?.querySelector('.iot-status-text');
  const btnEl = card?.querySelector('.iot-toggle-btn');

  if (card) card.classList.toggle('active', nextVal);
  if (statusEl) statusEl.textContent = nextVal ? 'Encendido · Activo' : 'Apagado';
  if (btnEl) btnEl.textContent = nextVal ? 'Apagar' : 'Encender';

  // Efectos visuales 3D en la escena
  const anyLightOn = state.devices.sala || state.devices.cocina || state.devices.tuya;
  document.body.classList.toggle('lights-on', anyLightOn);
  roomSmartLight.intensity = anyLightOn ? 2.6 : 0;
  windParticlesGroup.visible = state.devices.ventilador;

  appendTerminalLog(
    'IOT-BUS',
    `${DEVICE_NAMES[deviceKey]} -> ${nextVal ? 'ON (HIGH)' : 'OFF (LOW)'}`,
    'ok'
  );

  if (announce) {
    state.pokeBounce = 0.22;
    const actionWord = nextVal ? 'encendido' : 'apagado';
    gimenaSpeak(
      `¡Listo! He ${actionWord} ${DEVICE_NAMES[deviceKey].split(' (')[0].toLowerCase()}.`,
      nextVal ? 'happy' : 'thinking'
    );
  }
}

// ============================================================================
// PROCESADOR DE COMANDOS DE CHAT / VOZ DE GIMENA
// ============================================================================
function processUserPrompt(rawText) {
  const text = rawText.trim();
  if (!text) return;
  const lower = text.toLowerCase();

  appendTerminalLog('USER-STT', `"${text}"`);

  if (lower.includes('sala') || lower.includes('luces') || lower.includes('luz')) {
    const turnOff = lower.includes('apaga');
    toggleIoTDevice('sala', !turnOff, false);
    if (lower.includes('ventilador')) {
      toggleIoTDevice('ventilador', !turnOff, false);
      gimenaSpeak(
        turnOff
          ? 'He apagado la luz de la sala y el ventilador por ti.'
          : '¡Claro! Ya encendí la luz de la sala y puse a funcionar el ventilador UwU.',
        'happy'
      );
      return;
    }
    gimenaSpeak(
      turnOff
        ? 'Luz de la sala apagada. ¡Ahorrando energía!'
        : '¡Luz de la sala encendida! Mira cómo brilla el ambiente.',
      'happy'
    );
    return;
  }

  if (lower.includes('cocina')) {
    const turnOff = lower.includes('apaga');
    toggleIoTDevice('cocina', !turnOff, true);
    return;
  }

  if (lower.includes('ventilador') || lower.includes('calor')) {
    const turnOff = lower.includes('apaga') || lower.includes('frío');
    toggleIoTDevice('ventilador', !turnOff, true);
    return;
  }

  if (lower.includes('tuya') || lower.includes('enchufe')) {
    const turnOff = lower.includes('apaga');
    toggleIoTDevice('tuya', !turnOff, true);
    return;
  }

  if (lower.includes('respaldo') || lower.includes('falla') || lower.includes('pc') || lower.includes('api')) {
    activateFallbackSimulation(true);
    return;
  }

  if (lower.includes('interior') || lower.includes('rayos') || lower.includes('dentro') || lower.includes('componentes')) {
    setViewMode('exploded');
    gimenaSpeak(
      '¡Activando despiece 3D! Aquí puedes ver mi placa ESP32 DevKit V1, mi pantalla TFT ST7789, mi amplificador I2S MAX98357A y mi micrófono INMP441.',
      'surprised'
    );
    return;
  }

  if (lower.includes('amor') || lower.includes('quiero') || lower.includes('linda')) {
    gimenaSpeak(
      '¡Aww, muchas gracias! Eres mi persona favorita. Mira cuántos corazoncitos salen en mi pantalla TFT.',
      'love'
    );
    return;
  }

  if (lower.includes('chiste')) {
    gimenaSpeak(
      '¿Por qué el ESP32 fue al psicólogo? ¡Porque tenía demasiados pines de ansiedad, pero con mi respaldo en PC ya nunca pierdo la voz!',
      'happy'
    );
    return;
  }

  if (lower.includes('música') || lower.includes('baila') || lower.includes('canta')) {
    gimenaSpeak(
      '¡Activando modo fiesta en mi pantalla TFT y moviendo mis bracitos al ritmo del bus I2S!',
      'music'
    );
    return;
  }

  // Respuesta general explicando qué hace Gimena
  gimenaSpeak(
    'Soy Gimena, tu robot asistente de escritorio impresa en 3D. Escucho tu voz con mi micrófono INMP441, pienso con Gemini 3.5 Flash Lite, expreso emociones en mi pantalla TFT 2.4 pulgadas, controlo las luces y enchufes de tu casa, y tengo un servidor de respaldo en el PC para nunca quedarme callada.',
    'happy'
  );
}

// ============================================================================
// SIMULADOR DE RESPALDO DUAL (ESP32 CLOUD VS PC FALLBACK)
// ============================================================================
const btnCloudNormal = document.getElementById('btnCloudNormal');
const btnSimulateFail = document.getElementById('btnSimulateFail');
const activeTtsEngineBadge = document.getElementById('activeTtsEngineBadge');
const cloudApiStatusDesc = document.getElementById('cloudApiStatusDesc');
const nodeCloud = document.getElementById('nodeCloud');
const nodePc = document.getElementById('nodePc');

function activateFallbackSimulation(isFailing) {
  state.cloudFallbackMode = isFailing;
  btnCloudNormal.classList.toggle('active', !isFailing);
  btnSimulateFail.classList.toggle('active', isFailing);
  activeTtsEngineBadge.classList.toggle('fallback', isFailing);
  nodeCloud.classList.toggle('highlight', !isFailing);
  nodePc.classList.toggle('fallback-active', isFailing);

  if (isFailing) {
    activeTtsEngineBadge.textContent = 'Respaldo PC: edge-tts + STT Local';
    cloudApiStatusDesc.textContent =
      '¡Fallo detectado en API Cloud! El servidor FastAPI del PC intercepta la caída, transcribe el audio localmente y sintetiza la voz con es-CO-SalomeNeural hacia el parlante.';
    appendTerminalLog('WARN-API', 'Fallo/Cuota en API TTS/STT Cloud -> Conmutando automáticamente a Servidor PC (:8000)', 'warn');
    gimenaSpeak(
      '¡Atención! La API de voz en la nube falló, pero el servidor de tu PC entró al rescate automáticamente con síntesis neural local para que jamás me quede callada.',
      'surprised'
    );
  } else {
    activeTtsEngineBadge.textContent = 'Motor: Voz Cloud + I2S Activa';
    cloudApiStatusDesc.textContent =
      'Operación normal: el ESP32 se comunica directamente con Gemini 3.5 Flash Lite y sincroniza estados con el PC.';
    appendTerminalLog('CLOUD-OK', 'Conexión primaria con Gemini 3.5 Flash Lite restaurada', 'ok');
    gimenaSpeak(
      'Conexión directa en la nube restaurada. Mis dos cerebros, el ESP32 y tu PC, trabajan en equipo.',
      'happy'
    );
  }
}

// ============================================================================
// INTERACCIÓN DE PUNTERO, RAYCASTING (TOCAR A GIMENA EN 3D) Y EVENTOS DOM
// ============================================================================
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
let pointerDownPos = { x: 0, y: 0 };

window.addEventListener('pointermove', (e) => {
  const nx = (e.clientX / window.innerWidth) * 2 - 1;
  const ny = (e.clientY / window.innerHeight) * 2 - 1;
  state.lookTarget.set(
    THREE.MathUtils.clamp(nx, -1, 1),
    THREE.MathUtils.clamp(ny, -1, 1)
  );
});

renderer.domElement.addEventListener('pointerdown', (e) => {
  pointerDownPos = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('pointerup', (e) => {
  const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
  if (dist > 6) return; // Fue un giro de cámara con OrbitControls, no un clic

  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects(gimenaRoot.children, true);

  if (hits.length > 0) {
    state.pokeBounce = 0.35;
    const hitName = hits[0].object.name;
    if (hitName === 'screen') {
      gimenaSpeak('¡Jiji! Tocaste mi pantalla TFT de 2.4 pulgadas. ¡Me haces cosquillas en los píxeles!', 'love');
    } else if (hitName === 'speaker') {
      gimenaSpeak('¡Por estos 19 agujeritos de mi pecho sale mi voz digital I2S!', 'music');
    } else if (hitName === 'mic') {
      gimenaSpeak('¡Ese es mi micrófono digital INMP441! Siempre estoy atenta a lo que me digas.', 'surprised');
    } else {
      const reactions = [
        { text: '¡Jiji! Mi carcasa está impresa en 3D con PLA negro brillante. ¿Te gusta?', emo: 'happy' },
        { text: '¡Ay! ¡Me hiciste cosquillas en el chasis UwU!', emo: 'love' },
        { text: '¡Estoy lista! Pídeme que encienda la luz de la sala o el ventilador.', emo: 'surprised' },
      ];
      const pick = reactions[Math.floor(Math.random() * reactions.length)];
      gimenaSpeak(pick.text, pick.emo);
    }
  }
});

// Botones de expresiones TFT
document.querySelectorAll('.expr-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const emo = btn.dataset.emotion;
    setEmotion(emo);
    state.pokeBounce = 0.2;
  });
});

// Botones de vista 3D (Cubierta PLA / Rayos-X / Despiece 3D)
document.querySelectorAll('.hud-btn[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => {
    setViewMode(btn.dataset.view);
  });
});

// Alternar estilo de rostro (Pixel-Art Foto Real vs Anime Firmware)
const btnToggleFaceStyle = document.getElementById('btnToggleFaceStyle');
const faceStyleLabel = document.getElementById('faceStyleLabel');
btnToggleFaceStyle.addEventListener('click', () => {
  state.faceStyle = state.faceStyle === 'pixel' ? 'anime' : 'pixel';
  faceStyleLabel.textContent =
    state.faceStyle === 'pixel' ? 'Rostro: Pixel-Art' : 'Rostro: Anime TFT';
  btnToggleFaceStyle.classList.toggle('active', state.faceStyle === 'anime');
  gimenaSpeak(
    state.faceStyle === 'pixel'
      ? '¡Volví a mi rostro Pixel-Art celeste con boquita w, idéntico a mi foto real!'
      : '¡Cambié a mi modo retrato Anime a color del firmware TFT!',
    'happy'
  );
});

// Centrar cámara
document.getElementById('btnResetCamera').addEventListener('click', () => {
  camera.position.set(0.35, 0.55, 7.6);
  controls.target.set(0, 0.15, 0);
  controls.update();
});

// Saludo rápido en la barra superior
document.getElementById('btnQuickGreet').addEventListener('click', () => {
  state.pokeBounce = 0.3;
  gimenaSpeak(
    '¡Hola! Soy Gimena. Estoy conectada y lista para conversar contigo, animar mi pantalla TFT y controlar todos los dispositivos de tu casa.',
    'happy'
  );
});

// Formulario de chat y chips rápidos
document.getElementById('chatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('chatInput');
  processUserPrompt(input.value);
  input.value = '';
});

document.querySelectorAll('.chip-prompt').forEach((chip) => {
  chip.addEventListener('click', () => {
    processUserPrompt(chip.dataset.prompt);
  });
});

// Reconocimiento de voz del navegador (Micrófono en vivo)
const btnVoiceInput = document.getElementById('btnVoiceInput');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang = 'es-CO';
  recognition.interimResults = false;

  btnVoiceInput.addEventListener('click', () => {
    try {
      recognition.start();
      btnVoiceInput.classList.add('listening');
      hudAudioState.textContent = 'ESCUCHANDO MIC...';
    } catch {
      // Ya estaba activo
    }
  });

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    document.getElementById('chatInput').value = transcript;
    processUserPrompt(transcript);
  };

  recognition.onend = () => {
    btnVoiceInput.classList.remove('listening');
  };
} else {
  btnVoiceInput.addEventListener('click', () => {
    document.getElementById('chatInput').focus();
    gimenaSpeak('Escribe tu comando aquí abajo y lo ejecutaré enseguida.', 'happy');
  });
}

// Tarjetas de "¿Qué hace Gimena?"
document.querySelectorAll('.cap-card').forEach((card) => {
  card.addEventListener('click', () => {
    const demo = card.dataset.demo;
    document.getElementById('stage').scrollIntoView({ behavior: 'smooth' });

    if (demo === 'ai-conversation') {
      gimenaSpeak(
        'Con mi micrófono INMP441 escucho tu voz y consulto a Gemini 3.5 Flash Lite para responderte al instante con mucha personalidad.',
        'happy'
      );
    } else if (demo === 'smart-home') {
      toggleIoTDevice('sala', true, false);
      toggleIoTDevice('ventilador', true, false);
      gimenaSpeak(
        '¡Mira! Puedo encender las luces de la sala, la cocina, el ventilador y tus enchufes inteligentes Tuya con una sola frase.',
        'happy'
      );
    } else if (demo === 'tft-emotions') {
      const seq = ['love', 'surprised', 'thinking', 'music', 'sad', 'sleepy', 'happy'];
      seq.forEach((emo, idx) => {
        setTimeout(() => setEmotion(emo), idx * 650);
      });
      gimenaSpeak(
        'En mi pantalla TFT ST7789 de 320 por 240 píxeles cambio de expresión en tiempo real según lo que estamos hablando.',
        'love'
      );
    } else if (demo === 'pc-fallback') {
      activateFallbackSimulation(true);
    }
  });
});

// Botones del laboratorio IoT
document.querySelectorAll('[data-toggle-device]').forEach((btn) => {
  btn.addEventListener('click', () => {
    toggleIoTDevice(btn.dataset.toggleDevice);
  });
});

document.getElementById('btnClearLog').addEventListener('click', () => {
  terminalLog.innerHTML = '';
  appendTerminalLog('SYSTEM', 'Monitor limpiado. Gimena en línea.', 'ok');
});

// Botones del simulador de respaldo Cloud vs PC
btnCloudNormal.addEventListener('click', () => activateFallbackSimulation(false));
btnSimulateFail.addEventListener('click', () => activateFallbackSimulation(true));

// Tarjetas de Anatomía de Hardware (enfocan la pieza y activan Rayos-X)
document.querySelectorAll('.hw-card').forEach((card) => {
  card.addEventListener('click', () => {
    const part = card.dataset.focusPart;
    document.getElementById('stage').scrollIntoView({ behavior: 'smooth' });
    setViewMode('xray');

    if (part === 'screen') {
      camera.position.set(0, 1.15, 5.2);
      gimenaSpeak('Enfocando mi pantalla TFT ST7789 de 2.4 pulgadas conectada por bus SPI de alta velocidad.', 'happy');
    } else if (part === 'speaker') {
      camera.position.set(0, -0.65, 5.2);
      gimenaSpeak('Enfocando mi parlante frontal de 19 perforaciones impulsado por el amplificador digital I2S MAX98357A.', 'music');
    } else if (part === 'mic') {
      camera.position.set(0.85, 0.35, 4.9);
      gimenaSpeak('Enfocando mi micrófono omnidireccional INMP441 ubicado en la esquina inferior derecha de mi cabeza.', 'surprised');
    } else if (part === 'esp32') {
      setViewMode('exploded');
      camera.position.set(-1.6, 0.4, 6.2);
      gimenaSpeak('Enfocando mi placa ESP32 DevKit V1 dentro de mi chasis impreso en 3D.', 'thinking');
    }
  });
});

// Modal de comparación Foto Real vs 3D
const photoModal = document.getElementById('photoModal');
document.getElementById('btnComparePhoto').addEventListener('click', () => {
  photoModal.classList.remove('hidden');
});
document.getElementById('btnCloseModal').addEventListener('click', () => {
  photoModal.classList.add('hidden');
});
document.getElementById('btnCloseModalAndFocus').addEventListener('click', () => {
  photoModal.classList.add('hidden');
  setViewMode('normal');
  state.faceStyle = 'pixel';
  faceStyleLabel.textContent = 'Rostro: Pixel-Art';
});
photoModal.addEventListener('click', (e) => {
  if (e.target === photoModal) photoModal.classList.add('hidden');
});

// Responsividad del viewport 3D
window.addEventListener('resize', () => {
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});

// ============================================================================
// BUCLE PRINCIPAL DE ANIMACIÓN 60 FPS
// ============================================================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();
  const delta = Math.min(clock.getDelta(), 0.1);

  // 1. Suavizado de seguimiento ocular y de cabeza hacia el cursor
  state.smoothLook.lerp(state.lookTarget, 0.08);

  // 2. Parpadeo natural automático
  if (elapsed > state.nextBlinkTime) {
    const blinkPhase = (elapsed - state.nextBlinkTime) / 0.18;
    if (blinkPhase <= 1) {
      state.blinkProgress = Math.sin(blinkPhase * Math.PI);
    } else {
      state.blinkProgress = 0;
      state.nextBlinkTime = elapsed + 2.4 + Math.random() * 3.2;
    }
  }

  // 3. Apertura de la boca sincronizada cuando Gimena está hablando
  if (state.isSpeaking) {
    state.mouthOpen = 0.25 + 0.75 * Math.abs(Math.sin(elapsed * 15.5) * Math.cos(elapsed * 6.3));
  } else {
    state.mouthOpen = THREE.MathUtils.lerp(state.mouthOpen, 0, 0.2);
  }

  // 4. Actualizar textura dinámica de la pantalla TFT 2.4"
  renderTFTScreen(elapsed);

  // 5. Respiración sutil del cuerpo, seguimiento al cursor y rebote al tocarla
  state.pokeBounce = THREE.MathUtils.lerp(state.pokeBounce, 0, 0.08);
  const breathY = Math.sin(elapsed * 2.4) * 0.035;
  const bounceY = Math.sin(elapsed * 22) * state.pokeBounce;

  // Transición suave entre vista ensamblada y Despiece 3D (Exploded View)
  const explodeFactor = state.viewMode === 'exploded' ? 1 : 0;

  headGroup.position.y = THREE.MathUtils.lerp(
    headGroup.position.y,
    1.02 + breathY * 1.2 + explodeFactor * 0.75 + Math.abs(bounceY),
    0.1
  );
  headGroup.rotation.y = THREE.MathUtils.lerp(headGroup.rotation.y, state.smoothLook.x * 0.22, 0.08);
  headGroup.rotation.x = THREE.MathUtils.lerp(headGroup.rotation.x, state.smoothLook.y * 0.14, 0.08);

  torsoGroup.position.y = THREE.MathUtils.lerp(torsoGroup.position.y, -0.82 + breathY * 0.6, 0.1);
  torsoGroup.rotation.y = THREE.MathUtils.lerp(torsoGroup.rotation.y, state.smoothLook.x * 0.08, 0.06);

  // Movimiento de bracitos laterales
  const armWave = state.isSpeaking || state.emotion === 'music' || state.pokeBounce > 0.04
    ? Math.sin(elapsed * 10) * 0.28
    : Math.sin(elapsed * 2.4) * 0.04;

  leftArmGroup.position.x = THREE.MathUtils.lerp(leftArmGroup.position.x, -1.74 - explodeFactor * 0.65, 0.1);
  rightArmGroup.position.x = THREE.MathUtils.lerp(rightArmGroup.position.x, 1.74 + explodeFactor * 0.65, 0.1);
  leftArmGroup.rotation.z = armWave;
  rightArmGroup.rotation.z = -armWave;

  feetGroup.position.y = THREE.MathUtils.lerp(feetGroup.position.y, -1.78 - explodeFactor * 0.45, 0.1);

  // Ondas sonoras 3D saliendo de la rejilla de 19 perforaciones cuando habla
  soundWaveRings.forEach((ring, idx) => {
    if (state.isSpeaking || state.emotion === 'music') {
      const progress = ((elapsed * 1.6 + idx * 0.33) % 1);
      const scale = 1 + progress * 2.8;
      ring.scale.set(scale, scale, 1);
      ring.material.opacity = (1 - progress) * 0.55;
      ring.position.z = 1.04 + progress * 0.45;
    } else {
      ring.material.opacity = 0;
    }
  });

  // Animación de partículas de viento cuando el ventilador IoT está encendido
  if (windParticlesGroup.visible) {
    windLines.forEach((item) => {
      item.mesh.position.x += item.speed * 0.04;
      if (item.mesh.position.x > 3.2) {
        item.mesh.position.x = -3.2;
      }
    });
  }

  // Parpadeo del LED interno del ESP32
  espLedMesh.material.color.setHex(Math.floor(elapsed * 3) % 2 === 0 ? 0x38bdf8 : 0x0284c7);

  controls.update();
  updateHotspotsProjection();
  renderer.render(scene, camera);
}

animate();
