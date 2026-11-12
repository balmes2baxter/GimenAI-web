# 🤖 GimenAI — Showcase Web 3D Interactivo

Página web minimalista y ultra-interactiva en **3D (Three.js / WebGL)** que recrea fielmente a **Gimena (GimenAI)**: asistente robótica física de escritorio impresa en 3D con cerebro **ESP32 DevKit V1**, pantalla a color **TFT ST7789 2.4"**, audio digital **I2S (INMP441 + MAX98357A)**, inteligencia artificial **Gemini 3.5 Flash Lite**, control domótico **IoT + Tuya Cloud** y sistema inmortal de **respaldo automático en PC**.

---

## ✨ Características de la Experiencia Web 3D

1. **Gemelo Digital 3D Fiel a la Foto Real:**
   - Chasis impreso en 3D en **PLA negro brillante** con textura procedural de capas FDM (`0.2mm`), cabezal cúbico superior, pantalla TFT empotrada en formato `4:3`, ranura frontal inferior, orificio circular para el micrófono **INMP441**, torso con la **rejilla acústica circular de 19 perforaciones** (`1 + 6 + 12`), brazos laterales cortos, pies robustos y cable USB blanco trasero.
   - **Rostro Pixel-Art Kawaii (`UwU`) + Modo Retrato Anime:** Renderizado en tiempo real a 60 FPS en un `CanvasTexture` de `320×240` con seguimiento ocular al cursor, parpadeo natural, sincronización labial al hablar y 7 estados emocionales (`UwU Feliz`, `Amor`, `Sorpresa`, `Pensando`, `Música`, `Triste`, `Dormida`).
   - **Modos Rayos-X y Despiece 3D (Exploded View):** Permite transparentar y separar las piezas del chasis para inspeccionar el **ESP32 DevKit V1**, la pantalla **ST7789**, el amplificador **MAX98357A** y el micrófono **INMP441** con etiquetas interactivas en 3D.

2. **Conversación por Voz y Texto en Tiempo Real:**
   - Habla con Gimena mediante micrófono (`Web Speech Recognition`) o teclado y escúchala responder con voz sintetizada en español (`Web Speech Synthesis`) mientras emergen ondas sonoras 3D de su parlante frontal.

3. **Laboratorio Domótico IoT en Vivo:**
   - Controla la **Luz de la Sala (`GPIO 19`)**, **Luz de la Cocina (`GPIO 21`)**, **Ventilador (`GPIO 22`)** y **Enchufe Inteligente Tuya WiFi**, viendo cómo cambia la iluminación 3D de la escena, las partículas de viento y el monitor en tiempo real del bus ESP32.

4. **Simulador de Arquitectura de Respaldo Dual (ESP32 + Servidor PC):**
   - Prueba qué ocurre cuando falla la API de voz/transcripción en la nube y cómo el servidor FastAPI del PC toma el control automáticamente (`edge-tts` `es-CO-SalomeNeural` + `SpeechRecognition`) para que Gimena nunca se quede callada.

---

## 🚀 Cómo Ejecutar Localmente

Al estar construida con **ES Modules** nativos sin pasos complejos de compilación, puedes servir la carpeta con cualquier servidor estático:

```bash
python3 -m http.server 8080
```

Luego abre `http://localhost:8080` en tu navegador.
