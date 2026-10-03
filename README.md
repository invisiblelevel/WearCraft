<div align="center">
WearCraft
Procedural wear generator for PBR textures

https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge
https://img.shields.io/badge/Tauri-2.x-FFC131?style=for-the-badge&logo=tauri&logoColor=black
https://img.shields.io/badge/Svelte-5-FF3E00?style=for-the-badge&logo=svelte&logoColor=white
https://img.shields.io/badge/Rust-1.80+-B7410E?style=for-the-badge&logo=rust&logoColor=white
https://img.shields.io/badge/Three.js-r180+-000000?style=for-the-badge&logo=three.js&logoColor=white

</div>
Concept
WearCraft is a desktop application for procedural wear generation on PBR texture sets.

Load a PBR set (albedo, normal, roughness, ao, height, metalness, edge) -> generate N unique wear variations -> export to game engines.

Built-in 3D viewer shows the result in real time. The preview fully matches the baked result — what you see is what you get.

Features
Feature	Description
Presets	Custom mask, procedural scratches, spots, rust
Masks	Own mask (single PNG) or library (folder-based, %APPDATA%)
Precise Positioning	Move, rotate, scale each spot. Tiling control per variation
Parallel Generation	Rayon-powered. N variations, each with unique seed
3D Preview	Sphere, cube, cylinder, torus, or your own .obj / .gltf model
Engine Export	Unreal Engine (ORM + DX normal), Unity (MetallicSmoothness, Built-in / URP)
i18n	Russian, English, Chinese
PBR Presets	All parameters tuned per material type
Quick Start
Requirements
Windows 10 / 11 (x64)

WebView2 (already installed on Win11, included in the installer for Win10)

Rust 1.80+ and Node.js 20+ (to build from source)

Run from source
git clone https://github.com/invisiblelevel/WearCraft.git
cd WearCraft
npm install
npm run tauri dev
npm run tauri build

Installer
Download WearCraft_1.0.0_x64-setup.exe from Releases and run. Fully offline installation — no internet required.

Screenshots
<div align="center">
Main UI	PBR Loaded	Spots + Position
https://src-tauri/assets/screenshots/main_ui.jpg	https://src-tauri/assets/screenshots/pbr_loading.jpg	https://src-tauri/assets/screenshots/user_mask_position.jpg
</div>
Tech Stack
Layer	Tech
Desktop	Tauri 2
Frontend	Svelte 5 (runes), Vite
3D	Three.js
Backend	Rust (image, noise, rand, rayon)
Build	cargo, npm
Documentation
User Manual — RU / EN / ZH

PROGRESS.md — development log

WEARCRAFT_CONTEXT.md — full project context

Roadmap
☑ PBR texture loading (albedo, normal, roughness, AO, height, metalness, edge)
☑ 3D model viewer (.obj / .gltf)
☑ Presets: Custom / Scratches / Spots / Rust
☑ User mask + library masks
☑ Position / Rotation / Scale for masks
☑ Parallel generation (rayon)
☑ Unreal / Unity export
☑ Preview = baked result (shader matches Rust)
☑ User manual (HTML, 3 languages)
□ GPU compute for generation
□ Light theme
□ Resizable panels
Contributing
Fork the repo

Create a feature branch (git checkout -b feature/amazing)

Commit (git commit -m 'Add amazing feature')

Push (git push origin feature/amazing)

Open a Pull Request

License
MIT License — free for commercial use.

<div align="center">
Made by INV.LVL · 2026

</div>