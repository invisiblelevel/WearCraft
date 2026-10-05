**Procedural wear generator for PBR textures**

![Version](https://img.shields.io/badge/version-1.1.0-orange)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey)
![License](https://img.shields.io/badge/license-MIT-green)
![Tauri](https://img.shields.io/badge/Tauri-2.x-FFC131)
![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00)
![Rust](https://img.shields.io/badge/Rust-1.80%2B-B7410E)

**Languages:** [English](#english) · [Русский](#russian) · [中文](#chinese)

---

<a name="english"></a>
## 🇬🇧 English

### What is it

**WearCraft** is a desktop application for procedural wear generation on PBR texture sets. Load a PBR set (albedo, normal, roughness, ao, height, metalness, edge), generate N unique wear variations, and export to game engines.

The built-in 3D viewer shows the result in real time. **The preview fully matches the baked result** — what you see is what you get.

### Features

- **Presets:** Custom mask, procedural scratches, streaks (drips), spots, rust, decal
- **Decal:** Project any PNG/JPG onto the model like a sticker — position, scale, rotation, opacity, aspect ratio, tiling, height-based bump
- **Masks:** Own mask (single PNG) or library (folder-based, %APPDATA%)
- **Positioning:** Move, rotate, scale each spot. Tiling control per variation
- **Generation:** Parallel (rayon), N variations, each with unique seed
- **3D Preview:** Sphere, cube, cylinder, torus, or your own .obj / .gltf model
- **HDR Environment:** 5 lighting presets (Neutral / Warm / Cool / White / Night) + intensity slider
- **UI Zoom:** Ctrl+= / Ctrl+− / Ctrl+0, steps 75%–200%
- **Engine Export:** Unreal Engine (ORM + DX normal), Unity (MetallicSmoothness, Built-in / URP)
- **i18n:** Russian, English, Chinese
- **PBR Presets:** All parameters tuned per material type

### What's new in 1.1.0

- **Decal** — separate mode: project any image (PNG/JPG) onto the model like a sticker. Real-time preview, opacity, affect albedo / roughness / normal, height-based bump (or use image brightness), random position / rotation per variation, tile edges.
- **HDR Environment** — 5 presets via Settings → Environment tab. Intensity 0–200%. Optional HDR backdrop.
- **UI Zoom** — Ctrl+= / Ctrl+− / Ctrl+0. Steps 75%–200%. Saved in localStorage.
- **Streaks (procedural)** — new formula (value_noise + fbm + vertical stretch). Now reads as actual drips, not spikes.
- **Scratches** — two modes: procedural (Bezier) + mask-based (real-time preview).
- **"Generate" button** moved to the viewport (top-right, accent pill).
- **Variations** block reworked — slider 1..50 + input field.

Full changelog: [Releases](https://github.com/invisiblelevel/WearCraft/releases)

### Requirements

- Windows 10 / 11 (x64)
- WebView2 (included in the installer)
- Rust 1.80+ and Node.js 20+ (to build from source)

### Run from source

    git clone https://github.com/invisiblelevel/WearCraft.git
    cd WearCraft
    npm install
    npm run tauri dev

Build release:

    npm run tauri build

### Installer

Download the installer from Releases and run it. Fully offline installation — no internet required.

### Screenshots

![Main UI](src-tauri/assets/screenshots/main_ui.jpg)

![PBR Loading](src-tauri/assets/screenshots/pbr_loading.jpg)

![Spots + Position](src-tauri/assets/screenshots/user_mask_position.jpg)

### Tech Stack

- **Desktop:** Tauri 2
- **Frontend:** Svelte 5 (runes), Vite
- **3D:** Three.js
- **Backend:** Rust (image, noise, rand, rayon)

### System Requirements

**Minimum:**
- OS: Windows 10 / 11 (64-bit)
- Processor: Quad-core 2.0 GHz (Intel i5 / AMD Ryzen 5 or equivalent)
- Memory: 8 GB RAM
- Graphics: Integrated GPU (Intel UHD 620 / AMD Vega 8) or better
- DirectX: Version 11
- Storage: 2 GB available space

**Recommended:**
- OS: Windows 11 (64-bit)
- Processor: Hexa-core 3.0 GHz (Intel i7 / AMD Ryzen 7 or equivalent)
- Memory: 16 GB RAM
- Graphics: NVIDIA GTX 1650 / AMD RX 5700 or better
- DirectX: Version 12
- Storage: 8 GB SSD

### Roadmap

- [x] PBR texture loading
- [x] 3D model viewer (.obj / .gltf)
- [x] Presets: Custom / Scratches / Streaks / Spots / Rust / Decal
- [x] User mask + library masks
- [x] Position / Rotation / Scale for masks
- [x] Parallel generation (rayon)
- [x] Unreal / Unity export
- [x] Preview = baked result
- [x] User manual (HTML, 3 languages)
- [x] HDR environment (5 presets + intensity)
- [x] UI zoom (Ctrl+= / Ctrl+− / Ctrl+0)
- [x] Decal (image projection with height)
- [ ] GPU compute for generation
- [ ] Light theme
- [ ] Resizable panels

### License

MIT License — free for commercial use.

---

<a name="russian"></a>
## 🇷🇺 Русский

### Что это

**WearCraft** — десктопное приложение для процедурной генерации износа PBR-текстур. Загружаешь PBR-сет (albedo, normal, roughness, ao, height, metalness, edge), генерируешь N уникальных вариаций износа и экспортируешь в игровые движки.

Встроенный 3D-вьюер показывает результат в реальном времени. **Превью полностью совпадает с запечённым результатом** — что видишь, то и получишь.

### Возможности

- **Пресеты:** Своя маска, процедурные царапины, потёки, пятна, ржавчина, декаль
- **Decal (наклейка):** Наложение любой картинки PNG/JPG на модель как стикера — позиция, масштаб, поворот, прозрачность, пропорции, тайлинг, объём от height-карты
- **Маски:** Своя маска (один PNG) или библиотека (папка в %APPDATA%)
- **Позиционирование:** Движение, поворот, масштаб каждого пятна. Управление тайлингом на вариацию
- **Генерация:** Параллельная (rayon), N вариаций, каждая со своим seed
- **3D-превью:** Сфера, куб, цилиндр, тор, или своя .obj / .gltf модель
- **HDR-окружение:** 5 пресетов освещения (Neutral / Warm / Cool / White / Night) + слайдер интенсивности
- **Зум UI:** Ctrl+= / Ctrl+− / Ctrl+0, ступени 75%–200%
- **Экспорт в движки:** Unreal Engine (ORM + DX normal), Unity (MetallicSmoothness, Built-in / URP)
- **i18n:** Русский, английский, китайский
- **PBR-пресеты:** Все параметры настроены под тип материала

### Что нового в 1.1.0

- **Decal** — отдельный режим: наложение любой картинки (PNG/JPG) на модель как стикера. Real-time превью, прозрачность, влияние на albedo / roughness / normal, объём от height-карты (или яркость картинки), случайная позиция / поворот для каждой вариации, тайлинг по краям.
- **HDR-окружение** — 5 пресетов через Settings → вкладка «Окружение». Интенсивность 0–200%. Опциональный HDR-фон.
- **Зум UI** — Ctrl+= / Ctrl+− / Ctrl+0. Ступени 75%–200%. Сохраняется в localStorage.
- **Streaks (процедурный)** — новая формула (value_noise + fbm + вертикальный stretch). Теперь выглядит как настоящие потёки, а не штыри.
- **Scratches** — два режима: процедурно (Bezier) + через маски (real-time превью).
- **Кнопка «Генерировать»** переехала во viewport (top-right, accent pill).
- **Блок «Вариации»** переработан — слайдер 1..50 + поле ввода.

Полный changelog: [Releases](https://github.com/invisiblelevel/WearCraft/releases)

### Требования

- Windows 10 / 11 (x64)
- WebView2 (входит в установщик)
- Rust 1.80+ и Node.js 20+ (для сборки из исходников)

### Запуск из исходников

    git clone https://github.com/invisiblelevel/WearCraft.git
    cd WearCraft
    npm install
    npm run tauri dev

Сборка релиза:

    npm run tauri build

### Установщик

Скачай установщик из раздела Releases и запусти. Полностью офлайн-установка — интернет не нужен.

### Скриншоты

![Main UI](src-tauri/assets/screenshots/main_ui.jpg)

![PBR Loading](src-tauri/assets/screenshots/pbr_loading.jpg)

![Spots + Position](src-tauri/assets/screenshots/user_mask_position.jpg)

### Технологии

- **Desktop:** Tauri 2
- **Frontend:** Svelte 5 (runes), Vite
- **3D:** Three.js
- **Backend:** Rust (image, noise, rand, rayon)

### Системные требования

**Минимальные:**
- ОС: Windows 10 / 11 (64-bit)
- Процессор: 4 ядра 2.0 ГГц (Intel i5 / AMD Ryzen 5 или аналогичный)
- Память: 8 ГБ RAM
- Графика: Встроенная GPU (Intel UHD 620 / AMD Vega 8) или лучше
- DirectX: версия 11
- Место: 2 ГБ свободно

**Рекомендуемые:**
- ОС: Windows 11 (64-bit)
- Процессор: 6 ядер 3.0 ГГц (Intel i7 / AMD Ryzen 7 или аналогичный)
- Память: 16 ГБ RAM
- Графика: NVIDIA GTX 1650 / AMD RX 5700 или лучше
- DirectX: версия 12
- Место: 8 ГБ SSD

### План развития

- [x] Загрузка PBR-текстур
- [x] 3D-вьюер (.obj / .gltf)
- [x] Пресеты: Своя маска / Царапины / Потёки / Пятна / Ржавчина / Decal
- [x] Своя маска + библиотека масок
- [x] Позиция / Поворот / Масштаб для масок
- [x] Параллельная генерация (rayon)
- [x] Экспорт в Unreal / Unity
- [x] Превью = запечённый результат
- [x] Руководство пользователя (HTML, 3 языка)
- [x] HDR-окружение (5 пресетов + интенсивность)
- [x] Зум UI (Ctrl+= / Ctrl+− / Ctrl+0)
- [x] Decal (проекция картинки с объёмом)
- [ ] GPU compute для генерации
- [ ] Светлая тема
- [ ] Ресайз панелей

### Лицензия

MIT License — бесплатно для коммерческого использования.

---

<a name="chinese"></a>
## 🇨🇳 中文

### 这是什么

**WearCraft** 是一款用于 PBR 贴图集程序化磨损生成的桌面应用程序。加载 PBR 集（反照率、法线、粗糙度、环境光遮蔽、高度、金属度、边缘），生成 N 个独特的磨损变体，并导出到游戏引擎。

内置 3D 查看器实时显示结果。**预览与烘焙结果完全一致**——所见即所得。

### 功能

- **预设：** 自定义遮罩、程序化划痕、流痕、斑点、锈蚀、贴花
- **贴花：** 将任意 PNG/JPG 图像像贴纸一样投射到模型上——位置、缩放、旋转、不透明度、宽高比、平铺、基于高度的凹凸
- **遮罩：** 自定义遮罩（单个 PNG）或库（基于文件夹，%APPDATA%）
- **定位：** 移动、旋转、缩放每个斑点。每个变体的平铺控制
- **生成：** 并行（rayon），N 个变体，每个都有唯一的种子
- **3D 预览：** 球体、立方体、圆柱体、圆环，或您自己的 .obj / .gltf 模型
- **HDR 环境：** 5 个光照预设（Neutral / Warm / Cool / White / Night）+ 强度滑块
- **UI 缩放：** Ctrl+= / Ctrl+− / Ctrl+0，步长 75%–200%
- **引擎导出：** Unreal Engine（ORM + DX 法线），Unity（MetallicSmoothness，Built-in / URP）
- **国际化：** 俄语、英语、中文
- **PBR 预设：** 所有参数按材质类型调整

### 1.1.0 更新内容

- **贴花** — 独立模式：将任意图像（PNG/JPG）像贴纸一样投射到模型上。实时预览、不透明度、影响反照率 / 粗糙度 / 法线、基于高度的凹凸（或使用图像亮度）、每个变体的随机位置 / 旋转、边缘平铺。
- **HDR 环境** — 通过 Settings → 环境标签页访问 5 个预设。强度 0–200%。可选 HDR 背景。
- **UI 缩放** — Ctrl+= / Ctrl+− / Ctrl+0。步长 75%–200%。保存在 localStorage 中。
- **流痕（程序化）** — 新公式（value_noise + fbm + 垂直拉伸）。现在看起来像真正的流痕，而不是尖刺。
- **划痕** — 两种模式：程序化（Bezier）+ 基于遮罩（实时预览）。
- **"生成" 按钮** 移至视口（右上角，强调色胶囊）。
- **"变体" 区块** 重新设计 — 滑块 1..50 + 输入字段。

完整更新日志：[Releases](https://github.com/invisiblelevel/WearCraft/releases)

### 系统要求

- Windows 10 / 11（x64）
- WebView2（安装程序中包含）
- Rust 1.80+ 和 Node.js 20+（从源代码构建）

### 从源代码运行

    git clone https://github.com/invisiblelevel/WearCraft.git
    cd WearCraft
    npm install
    npm run tauri dev

构建发布版：

    npm run tauri build

### 安装程序

从 Releases 下载安装程序并运行。完全离线安装——无需互联网。

### 截图

![Main UI](src-tauri/assets/screenshots/main_ui.jpg)

![PBR Loading](src-tauri/assets/screenshots/pbr_loading.jpg)

![Spots + Position](src-tauri/assets/screenshots/user_mask_position.jpg)

### 技术栈

- **桌面：** Tauri 2
- **前端：** Svelte 5（runes）、Vite
- **3D：** Three.js
- **后端：** Rust（image、noise、rand、rayon）

### 系统配置

**最低配置：**
- 操作系统：Windows 10 / 11（64 位）
- 处理器：四核 2.0 GHz（Intel i5 / AMD Ryzen 5 或同等）
- 内存：8 GB RAM
- 显卡：集成显卡（Intel UHD 620 / AMD Vega 8）或更好
- DirectX：版本 11
- 存储：2 GB 可用空间

**推荐配置：**
- 操作系统：Windows 11（64 位）
- 处理器：六核 3.0 GHz（Intel i7 / AMD Ryzen 7 或同等）
- 内存：16 GB RAM
- 显卡：NVIDIA GTX 1650 / AMD RX 5700 或更好
- DirectX：版本 12
- 存储：8 GB SSD

### 路线图

- [x] PBR 贴图加载
- [x] 3D 模型查看器（.obj / .gltf）
- [x] 预设：自定义 / 划痕 / 流痕 / 斑点 / 锈蚀 / 贴花
- [x] 自定义遮罩 + 遮罩库
- [x] 遮罩的位置 / 旋转 / 缩放
- [x] 并行生成（rayon）
- [x] Unreal / Unity 导出
- [x] 预览 = 烘焙结果
- [x] 用户手册（HTML，3 种语言）
- [x] HDR 环境（5 个预设 + 强度）
- [x] UI 缩放（Ctrl+= / Ctrl+− / Ctrl+0）
- [x] 贴花（带高度的图像投射）
- [ ] 用于生成的 GPU 计算
- [ ] 浅色主题
- [ ] 可调整大小的面板

### 许可证

MIT 许可证——可免费用于商业用途。

---

**Author:** INV.LVL
**Version:** 1.1.0
**Date:** 2026