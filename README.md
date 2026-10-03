# WearCraft

**Procedural wear generator for PBR textures**

![Version](https://img.shields.io/badge/version-1.0.0-orange)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey)
![License](https://img.shields.io/badge/license-MIT-green)
![Tauri](https://img.shields.io/badge/Tauri-2.x-FFC131)
![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00)
![Rust](https://img.shields.io/badge/Rust-1.80%2B-B7410E)

---

## What is it

**WearCraft** is a desktop application for procedural wear generation on PBR texture sets. Load a PBR set (albedo, normal, roughness, ao, height, metalness, edge), generate N unique wear variations, and export to game engines.

The built-in 3D viewer shows the result in real time. **The preview fully matches the baked result** — what you see is what you get.

---

## Features

- **Presets:** Custom mask, procedural scratches, spots, rust
- **Masks:** Own mask (single PNG) or library (folder-based, %APPDATA%)
- **Positioning:** Move, rotate, scale each spot. Tiling control per variation
- **Generation:** Parallel (rayon), N variations, each with unique seed
- **3D Preview:** Sphere, cube, cylinder, torus, or your own .obj / .gltf model
- **Engine Export:** Unreal Engine (ORM + DX normal), Unity (MetallicSmoothness, Built-in / URP)
- **i18n:** Russian, English, Chinese
- **PBR Presets:** All parameters tuned per material type

---

## Requirements

- Windows 10 / 11 (x64)
- WebView2 (included in the installer)
- Rust 1.80+ and Node.js 20+ (to build from source)

---

## Run from source

    git clone https://github.com/invisiblelevel/WearCraft.git
    cd WearCraft
    npm install
    npm run tauri dev

Build release:

    npm run tauri build

---

## Installer

Download the installer from Releases and run it. Fully offline installation — no internet required.

---

## Screenshots

![Main UI](src-tauri/assets/screenshots/main_ui.jpg)

![PBR Loading](src-tauri/assets/screenshots/pbr_loading.jpg)

![Spots + Position](src-tauri/assets/screenshots/user_mask_position.jpg)

---

## Tech Stack

- **Desktop:** Tauri 2
- **Frontend:** Svelte 5 (runes), Vite
- **3D:** Three.js
- **Backend:** Rust (image, noise, rand, rayon)

---

## System Requirements

Minimum:
OS: Windows 10 / 11 (64-bit)
Processor: Quad-core 2.0 GHz (Intel i5 / AMD Ryzen 5 or equivalent)
Memory: 8 GB RAM
Graphics: Integrated GPU (Intel UHD 620 / AMD Vega 8) or better
DirectX: Version 11
Storage: 2 GB available space

Recommended:
OS: Windows 11 (64-bit)
Processor: Hexa-core 3.0 GHz (Intel i7 / AMD Ryzen 7 or equivalent)
Memory: 16 GB RAM
Graphics: NVIDIA GTX 1650 / AMD RX 5700 or better (for smooth 3D preview with 4K/8K textures)
DirectX: Version 12
Storage: 8 GB SSD


---

## Roadmap

- [x] PBR texture loading
- [x] 3D model viewer (.obj / .gltf)
- [x] Presets: Custom / Scratches / Spots / Rust
- [x] User mask + library masks
- [x] Position / Rotation / Scale for masks
- [x] Parallel generation (rayon)
- [x] Unreal / Unity export
- [x] Preview = baked result
- [x] User manual (HTML, 3 languages)
- [ ] GPU compute for generation
- [ ] Light theme
- [ ] Resizable panels

---

## License

MIT License — free for commercial use.

---

**Author:** INV.LVL
**Version:** 1.0.0
**Date:** 2026

---