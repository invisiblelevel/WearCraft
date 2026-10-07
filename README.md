**Procedural wear generator for PBR textures**

![Version](https://img.shields.io/badge/version-1.2.0-orange)
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
- **Triplanar projection:** Patterns generated in world-space, so they don't deform on complex models (weapons, canisters, equipment). Requires loading a 3D model — for primitives (sphere / cube / cylinder / torus) UV mapping is used.
- **UV Islands:** Patterns are clipped to the model's UV layout, no more pattern bleeding outside unwrapped areas.
- **Geometry Limit:** Apply wear only to top / bottom / sides of a surface (based on normals). Sphere + loaded model only.
- **Decal:** Project any PNG/JPG onto the model like a sticker — position, scale, rotation, opacity, aspect ratio, tiling, height-based bump
- **Masks:** Own mask (single PNG) or library (folder-based, %APPDATA%)
- **Positioning:** Move, rotate, scale each spot. Tiling control per variation
- **Generation:** Parallel (rayon), N variations, each with unique seed
- **3D Preview:** Sphere, cube, cylinder, torus, or your own .obj / .gltf model
- **HDR Environment:** 5 lighting presets (Neutral / Warm / Cool / White / Night) + intensity slider
- **UI Zoom:** Ctrl+= / Ctrl+− / Ctrl+0, steps 75%–200%
- **Engine Export:** Unreal Engine (ORM + DX normal), Unity (MetallicSmoothness, Built-in / URP)
- **i18n:** Russian, English, Chinese

### What's new in 1.2.0

- **Triplanar projection** — patterns are now generated in world-space instead of UV-space. On complex models (weapons, canisters, equipment), wear patterns no longer deform or stretch depending on UV density. Uses the same physical size across the whole model.
- **UV Islands** — patterns are clipped to the model's UV islands. No more abrupt pattern cutoffs at unwrapped boundaries. Works automatically on any loaded model.
- **Geometry Limit** — new feature: restrict the effect to top / bottom / sides of a surface, based on the model's normals. Smoothness slider, invert option. Sphere + loaded 3D model only.
- **Params Panel refactored** — the 1800-line `ParamsPanel.svelte` was split into 12 files. Much easier to maintain and extend.
- **Fixed:** pattern position now correctly updates when switching between variations in the preview.
- **Fixed:** mask preview no longer stays on top of generated variations.
- **Fixed:** variation cache is cleared before each new generation.
- **Streaks (procedural)** — procedural preview is disabled. As with procedural scratches, this preset generates only after pressing Generate (preview during setup isn't shown due to performance). Streaks via masks still have real-time preview.

Full changelog: [Releases](https://github.com/invisiblelevel/WearCraft/releases)

### What was in 1.1.0

- **Decal** — separate mode: project any image (PNG/JPG) onto the model like a sticker. Real-time preview, opacity, affect albedo / roughness / normal, height-based bump.
- **HDR Environment** — 5 presets via Settings → Environment tab. Intensity 0–200%. Optional HDR backdrop.
- **UI Zoom** — Ctrl+= / Ctrl+− / Ctrl+0. Steps 75%–200%.
- **Streaks (procedural)** — value_noise + fbm + vertical stretch.
- **Scratches** — two modes: procedural (Bezier) + mask-based (real-time preview).

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
- [x] Triplanar projection (world-space wear)
- [x] UV islands (clipping to model layout)
- [x] Geometry limit (normals-based restriction)
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
- **Triplanar-проекция:** Паттерны генерируются в world-space, не деформируются на сложных моделях (оружие, канистры, техника). Требует загрузки 3D-модели — для примитивов (сфера / куб / цилиндр / торус) используется UV-развёртка.
- **UV-острова:** Паттерны обрезаются по UV-развёртке модели — больше нет «обрывов» за пределами развёрнутых зон.
- **Ограничение по геометрии:** Наложение износа только на верх / низ / бока поверхности (по нормалям). Только сфера и загруженная модель.
- **Decal (наклейка):** Наложение любой картинки PNG/JPG на модель как стикера — позиция, масштаб, поворот, прозрачность, пропорции, тайлинг, объём от height-карты
- **Маски:** Своя маска (один PNG) или библиотека (папка в %APPDATA%)
- **Позиционирование:** Движение, поворот, масштаб каждого пятна. Управление тайлингом на вариацию
- **Генерация:** Параллельная (rayon), N вариаций, каждая со своим seed
- **3D-превью:** Сфера, куб, цилиндр, тор, или своя .obj / .gltf модель
- **HDR-окружение:** 5 пресетов освещения (Neutral / Warm / Cool / White / Night) + слайдер интенсивности
- **Зум UI:** Ctrl+= / Ctrl+− / Ctrl+0, ступени 75%–200%
- **Экспорт в движки:** Unreal Engine (ORM + DX normal), Unity (MetallicSmoothness, Built-in / URP)
- **i18n:** Русский, английский, китайский

### Что нового в 1.2.0

- **Triplanar-проекция** — паттерны теперь генерируются в world-space вместо UV-пространства. На сложных моделях (оружие, канистры, техника) паттерн износа больше не деформируется и не растягивается в зависимости от UV-плотности. Использует единый физический размер на всей модели.
- **UV-острова** — паттерны обрезаются по UV-островам модели. Больше нет резких обрывов паттерна на границах развёртки. Работает автоматически на любой загруженной модели.
- **Ограничение по геометрии** — новая функция: ограничить эффект верхом / низом / боками поверхности на основе нормалей модели. Слайдер мягкости, инвертирование. Только сфера + загруженная 3D-модель.
- **ParamsPanel отрефакторен** — 1800-строчный `ParamsPanel.svelte` разбит на 12 файлов. Значительно проще поддерживать и расширять.
- **Фикс:** позиция паттерна теперь корректно обновляется при переключении между вариациями в превью.
- **Фикс:** mask-preview больше не висит поверх сгенерированных вариаций.
- **Фикс:** кэш вариаций очищается перед каждой новой генерацией.
- **Streaks (процедурный)** — процедурное превью отключено. Как и с процедурными царапинами, этот пресет генерируется только после нажатия кнопки «Генерировать» (превью при настройке не показывается из-за производительности). Streaks через маски — real-time превью работает.

Полный changelog: [Releases](https://github.com/invisiblelevel/WearCraft/releases)

### Что было в 1.1.0

- **Decal** — отдельный режим: наложение любой картинки (PNG/JPG) на модель как стикера.
- **HDR-окружение** — 5 пресетов через Settings → вкладка «Окружение».
- **Зум UI** — Ctrl+= / Ctrl+− / Ctrl+0.
- **Streaks (процедурный)** — value_noise + fbm + вертикальный stretch.
- **Scratches** — два режима: процедурно (Bezier) + через маски (real-time превью).

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
- Процессор: 4 ядра 2.0 ГГц
- Память: 8 ГБ RAM
- Графика: Встроенная GPU или лучше
- DirectX: 11
- Место: 2 ГБ

**Рекомендуемые:**
- ОС: Windows 11 (64-bit)
- Процессор: 6 ядер 3.0 ГГц
- Память: 16 ГБ RAM
- Графика: NVIDIA GTX 1650 / AMD RX 5700 или лучше
- DirectX: 12
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
- [x] Triplanar-проекция (world-space износ)
- [x] UV-острова (обрезка по развёртке)
- [x] Ограничение по геометрии (по нормалям)
- [ ] GPU compute для генерации
- [ ] Светлая тема
- [ ] Ресайз панелей

### Лицензия

MIT License — бесплатно для коммерческого использования.

---

<a name="chinese"></a>
## 🇨🇳 中文

### 这是什么

**WearCraft** 是一款用于 PBR 贴图集程序化磨损生成的桌面应用程序。加载 PBR 集，生成 N 个独特的磨损变体，并导出到游戏引擎。

内置 3D 查看器实时显示结果。**预览与烘焙结果完全一致**——所见即所得。

### 功能

- **预设：** 自定义遮罩、程序化划痕、流痕、斑点、锈蚀、贴花
- **Triplanar 投影：** 图案在世界空间中生成，不会在复杂模型上变形（武器、罐、设备）。需要加载 3D 模型——对于基本体（球体 / 立方体 / 圆柱体 / 圆环）使用 UV 映射。
- **UV 岛屿：** 图案按模型的 UV 布局进行裁剪——不再出现 UV 展开区域外的图案溢出。
- **几何限制：** 仅将磨损应用于表面的顶部 / 底部 / 侧面（基于法线）。仅球体和加载的模型。
- **贴花：** 将任意 PNG/JPG 图像像贴纸一样投射到模型上——位置、缩放、旋转、不透明度、宽高比、平铺、基于高度的凹凸
- **遮罩：** 自定义遮罩（单个 PNG）或库（基于文件夹，%APPDATA%）
- **定位：** 移动、旋转、缩放每个斑点。每个变体的平铺控制
- **生成：** 并行（rayon），N 个变体，每个都有唯一的种子
- **3D 预览：** 球体、立方体、圆柱体、圆环，或您自己的 .obj / .gltf 模型
- **HDR 环境：** 5 个光照预设（Neutral / Warm / Cool / White / Night）+ 强度滑块
- **UI 缩放：** Ctrl+= / Ctrl+− / Ctrl+0，步长 75%–200%
- **引擎导出：** Unreal Engine（ORM + DX 法线），Unity（MetallicSmoothness，Built-in / URP）
- **国际化：** 俄语、英语、中文

### 1.2.0 更新内容

- **Triplanar 投影** — 图案现在在世界空间中生成，而不是在 UV 空间中。在复杂模型（武器、罐、设备）上，磨损图案不再根据 UV 密度变形或拉伸。整个模型上使用相同的物理尺寸。
- **UV 岛屿** — 图案按模型的 UV 岛屿裁剪。UV 展开边界处不再出现突然的图案切断。在任何已加载模型上自动生效。
- **几何限制** — 新功能：基于模型的法线，将效果限制在表面的顶部 / 底部 / 侧面。平滑度滑块、反转选项。仅球体 + 加载的 3D 模型。
- **参数面板重构** — 1800 行的 `ParamsPanel.svelte` 拆分为 12 个文件。更易于维护和扩展。
- **修复：** 在预览中切换变体时，图案位置现在正确更新。
- **修复：** 遮罩预览不再停留在生成的变体之上。
- **修复：** 每次新生成前清空变体缓存。
- **流痕（程序化）** — 程序化预览已禁用。与程序化划痕一样，此预设仅在按下生成按钮后生成。通过遮罩的流痕仍可实时预览。

完整更新日志：[Releases](https://github.com/invisiblelevel/WearCraft/releases)

### 1.1.0 更新内容

- **贴花** — 独立模式：将任意图像（PNG/JPG）像贴纸一样投射到模型上。
- **HDR 环境** — 通过 Settings → 环境标签页访问 5 个预设。
- **UI 缩放** — Ctrl+= / Ctrl+− / Ctrl+0。
- **流痕（程序化）** — value_noise + fbm + 垂直拉伸。
- **划痕** — 两种模式：程序化（Bezier）+ 基于遮罩（实时预览）。

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
- 处理器：四核 2.0 GHz
- 内存：8 GB RAM
- 显卡：集成显卡或更好
- DirectX：版本 11
- 存储：2 GB 可用空间

**推荐配置：**
- 操作系统：Windows 11（64 位）
- 处理器：六核 3.0 GHz
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
- [x] Triplanar 投影（世界空间磨损）
- [x] UV 岛屿（按布局裁剪）
- [x] 几何限制（基于法线）
- [ ] 用于生成的 GPU 计算
- [ ] 浅色主题
- [ ] 可调整大小的面板

### 许可证

MIT 许可证——可免费用于商业用途。

---

**Author:** INV.LVL
**Version:** 1.2.0
**Date:** 2026