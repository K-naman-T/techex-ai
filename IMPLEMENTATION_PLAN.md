# Implementation Plan: Ready Player Me 3D Viewer with TTS

This project aims to create a web-based 3D viewer for Ready Player Me avatars using Three.js, powered by Bun, with bilingual Text-to-Speech (TTS) capabilities.

## 1. Project Initialization & Setup
- [ ] Initialize Bun project (`bun init`).
- [ ] Install dependencies:
    - `three` (3D library)
    - `vite` (Build tool and dev server)
- [ ] Configure `vite.config.js` to serve assets and work with Bun.

## 2. Asset Management
- [x] Create `assets/models` directory.
- [x] Verified custom avatar exists: `assets/models/avatar.glb`.
- [ ] Ensure `assets` folder is exposed publicly for the web server.

## 3. Core Development
- [ ] **HTML Structure:** Create `index.html` with a container for the 3D canvas and UI controls for TTS.
- [ ] **3D Scene Setup (`src/main.js`):**
    - Initialize `THREE.Scene`, `THREE.PerspectiveCamera`, and `THREE.WebGLRenderer`.
    - Add Lighting: `AmbientLight` (soft global light) and `DirectionalLight` (key light/sun).
    - Add `OrbitControls` for user interaction (rotate, zoom, pan).
- [ ] **Model Loading:**
    - Implement `GLTFLoader` to load `assets/models/avatar.glb`.
    - Center and scale the model appropriately in the scene.
- [ ] **Responsiveness:** Handle window resize events to update camera aspect ratio and renderer size.

## 4. Text-to-Speech (TTS) Implementation
- [ ] **TTS Service Integration:**
    - Use the Web Speech API (`window.speechSynthesis`) as the primary zero-cost solution.
    - Implement a `TextToSpeech` class/module.
- [ ] **Language Support:**
    - Add language selection UI (English / Hindi).
    - Configure voices for `en-US` and `hi-IN` locales.
- [ ] **UI Integration:**
    - Add a text input field and a "Speak" button.
    - (Optional) Lip-sync hooks: Prepare structure to analyze audio frequency for potential mouth movement.

## 5. Verification
- [ ] Run local development server (`bun run dev`).
- [ ] Verify model renders correctly.
- [ ] Verify TTS works in both English and Hindi.
