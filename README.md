# GimenAI — Showcase Web 3D Interactivo

Aplicación web minimalista e interactiva en **3D (Three.js / WebGL)** que recrea a **Gimena (GimenAI)**: asistente robótica física de escritorio impresa en 3D con cerebro **ESP32 DevKit V1**, pantalla a color **TFT ST7789 2.4"**, audio digital **I2S (INMP441 + MAX98357A)**, inteligencia artificial **Gemini 3.5 Flash Lite**, control domótico **IoT + Tuya Cloud** y sistema de **respaldo automático en PC**.

---

## Características Principales

1. **Gemelo Digital 3D Optimizado:**
   - Chasis en **PLA negro brillante**, cabezal cúbico superior, pantalla TFT empotrada en formato `4:3`, ranura frontal inferior, micrófono **INMP441**, torso con **rejilla acústica de 19 perforaciones** (`InstancedMesh`), perfil lateral de dos mitades ensambladas, espalda con **5 ranuras verticales**, grabado **«Gimena»** y puerto USB trasero.
   - **Rostro Pixel-Art + Modo Retrato Anime + Proyección QR:** Renderizado en un `CanvasTexture` de `320×240` con sprites pre-cacheados, seguimiento al puntero, parpadeo natural, sincronización labial y proyección de código QR directamente sobre la pantalla TFT 3D.
   - **Modos Rayos-X y Despiece 3D:** Permite inspeccionar el **ESP32 DevKit V1**, la placa **ST7789**, el amplificador **MAX98357A** y el micrófono **INMP441** con etiquetas interactivas aceleradas por GPU (`translate3d`).

2. **Optimización Multiplataforma (Móvil, Tablet y Desktop):**
   - Geometría de bajo poligonaje con `matrixAutoUpdate = false` para mallas estáticas e `InstancedMesh` para perforaciones y rejillas.
   - Caché de rectángulos DOM fuera del bucle `requestAnimationFrame` para eliminar *layout thrashing* durante el scroll.
   - Pausa automática del bucle de renderizado WebGL cuando la pestaña pasa a segundo plano (`visibilitychange`).

---

## Ejecución Local

```bash
python3 -m http.server 8090
```

URL en producción (GitHub Pages): `https://balmes2baxter.github.io/GimenAI-web/`
