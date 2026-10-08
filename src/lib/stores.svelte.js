// Общее состояние приложения.

export const params = $state({
  preset: 'custom', variations: 5, warp: 20, amount: 50,
  seed: Math.floor(Math.random() * 1e9),
});

export const PRESET_DEFAULTS = {
  custom:    { warp: 0,  amount: 0  },
  scratches: { warp: 20, amount: 50 },
  streaks:   { warp: 40, amount: 90 },
  dirt:      { warp: 40, amount: 60 },
  rust:      { warp: 30, amount: 70 },
  decal:     { warp: 0,  amount: 100 },
};

export function setPreset(name) {
  if (!PRESET_DEFAULTS[name]) return;
  params.preset = name;
  params.warp = PRESET_DEFAULTS[name].warp;
  params.amount = PRESET_DEFAULTS[name].amount;
}

// Scratch
export const scratchParams = $state({
  procedural: true,
  density: 0.5, length: 0.15, thickness: 2.0,
  waviness: 0.35, branches: 0.1, clusters: 0.3,
  normalEnabled: true, depth: 0.8,
  realistic: true, rimHighlight: true,
  count: 3.0,
  maskScale: 1.0,
  deform: 0.3,
  threshold: 0.5,
  sharpness: 0.5,
  color: [95, 85, 75],
  maskThickness: 0.3,
  maskRimHighlight: true,
  maskNormalEnabled: true,
  disableTiling: false,
  posX: 0.0,
  posY: 0.0,
  rotation: 0.0,
  randomRotation: false,
});

export function resetScratchParams() {
  scratchParams.procedural = true;
  scratchParams.density = 0.5;
  scratchParams.length = 0.15;
  scratchParams.thickness = 2.0;
  scratchParams.waviness = 0.35;
  scratchParams.branches = 0.1;
  scratchParams.clusters = 0.3;
  scratchParams.normalEnabled = true;
  scratchParams.depth = 0.8;
  scratchParams.realistic = true;
  scratchParams.rimHighlight = true;
  scratchParams.count = 3.0;
  scratchParams.maskScale = 1.0;
  scratchParams.deform = 0.3;
  scratchParams.threshold = 0.5;
  scratchParams.sharpness = 0.5;
  scratchParams.color = [95, 85, 75];
  scratchParams.maskThickness = 0.3;
  scratchParams.maskRimHighlight = true;
  scratchParams.maskNormalEnabled = true;
  scratchParams.disableTiling = false;
  scratchParams.posX = 0.0;
  scratchParams.posY = 0.0;
  scratchParams.rotation = 0.0;
  scratchParams.randomRotation = false;
}

// Dirt
export const dirtParams = $state({
  count: 3.0,
  scale: 1.0,
  deform: 0.3,
  threshold: 0.5,
  sharpness: 0.5,
  color: [95, 85, 75],
  thickness: 0.5,
  rimHighlight: true,
  normalEnabled: true,
  posX: 0.0,
  posY: 0.0,
  rotation: 0.0,
  randomRotation: true,
  disableTiling: false,
});

export function resetDirtParams() {
  dirtParams.count = 3.0;
  dirtParams.scale = 1.0;
  dirtParams.deform = 0.3;
  dirtParams.threshold = 0.5;
  dirtParams.sharpness = 0.5;
  dirtParams.color = [95, 85, 75];
  dirtParams.thickness = 0.5;
  dirtParams.rimHighlight = true;
  dirtParams.normalEnabled = true;
  dirtParams.posX = 0.0;
  dirtParams.posY = 0.0;
  dirtParams.rotation = 0.0;
  dirtParams.randomRotation = true;
  dirtParams.disableTiling = false;
}

// Rust
export const rustParams = $state({
  count: 3.0,
  scale: 1.0,
  deform: 0.5,
  threshold: 0.5,
  sharpness: 0.5,
  volume: 0,
  rimHighlight: true,
  normalEnabled: true,
  posX: 0.0,
  posY: 0.0,
  rotation: 0.0,
  randomRotation: true,
  disableTiling: false,
});

export function resetRustParams() {
  rustParams.count = 3.0;
  rustParams.scale = 1.0;
  rustParams.deform = 0.5;
  rustParams.threshold = 0.5;
  rustParams.sharpness = 0.5;
  rustParams.volume = 0;
  rustParams.rimHighlight = true;
  rustParams.normalEnabled = true;
  rustParams.posX = 0.0;
  rustParams.posY = 0.0;
  rustParams.rotation = 0.0;
  rustParams.randomRotation = true;
  rustParams.disableTiling = false;
}

// Streaks
export const streakParams = $state({
  procedural: true,
  count: 28.0,
  threshold: 0.2,
  sharpness: 0.6,
  color: [95, 85, 75],
  thickness: 0.35,
  rimHighlight: true,
  normalEnabled: true,
  size: 0.015,
  stretch: 20.0,
  waviness: 0.0,
  posX: 0.0,
  posY: 0.0,
  rotation: 0.0,
  procScale: 1.0,
  maskScale: 1.0,
  deform: 0.3,
 maskThickness: 0.3,
  randomRotation: false,
  disableTiling: false,
});

export function resetStreakParams() {
  streakParams.procedural = true;
  streakParams.count = 28.0;
  streakParams.threshold = 0.2;
  streakParams.sharpness = 0.6;
  streakParams.color = [95, 85, 75];
  streakParams.thickness = 0.35;
  streakParams.rimHighlight = true;
  streakParams.normalEnabled = true;
  streakParams.size = 0.015;
  streakParams.stretch = 20.0;
  streakParams.waviness = 0.0;
  streakParams.posX = 0.0;
  streakParams.posY = 0.0;
  streakParams.rotation = 0.0;
  streakParams.procScale = 1.0;
  streakParams.maskScale = 1.0;
  streakParams.deform = 0.3;
  streakParams.maskThickness = 0.3;
  streakParams.randomRotation = false;
  streakParams.disableTiling = false;
}

// Custom Mask
export const maskParams = $state({
  enabled: false,
  path: '',
  kind: 'mono',
  posX: 0.0,
  posY: 0.0,
  scale: 1.0,
  rotation: 0.0,
  opacity: 1.0,
  color: [95, 85, 75],
  affectAlbedo: true,
  affectRoughness: false,
  affectNormal: false,
  texture: null,
  fileName: '',
});

export function resetMaskParams() {
  maskParams.enabled = false;
  maskParams.path = '';
  maskParams.kind = 'mono';
  maskParams.posX = 0.0;
  maskParams.posY = 0.0;
  maskParams.scale = 1.0;
  maskParams.rotation = 0.0;
  maskParams.opacity = 1.0;
  maskParams.color = [95, 85, 75];
  maskParams.affectAlbedo = true;
  maskParams.affectRoughness = false;
  maskParams.affectNormal = false;
  maskParams.texture = null;
  maskParams.fileName = '';
}

// DECAL
export const decalParams = $state({
  enabled: false,
  path: '',
  heightPath: '',
  fileName: '',
  heightFileName: '',
  posX: 0.0,
  posY: 0.0,
  scale: 1.0,
  rotation: 0.0,
  keepAspect: true,
  opacity: 1.0,
  randomPosition: false,
  randomRotation: false,
  tileEdge: false,
  affectAlbedo: true,
  affectRoughness: false,
  affectNormal: false,
  heightIntensity: 0.0,
  texture: null,
  heightTexture: null,
  aspectW: 1,
  aspectH: 1,
});

export function resetDecalParams() {
  decalParams.enabled = false;
  decalParams.path = '';
  decalParams.heightPath = '';
  decalParams.fileName = '';
  decalParams.heightFileName = '';
  decalParams.posX = 0.0;
  decalParams.posY = 0.0;
  decalParams.scale = 1.0;
  decalParams.rotation = 0.0;
  decalParams.keepAspect = true;
  decalParams.opacity = 1.0;
  decalParams.randomPosition = false;
  decalParams.randomRotation = false;
  decalParams.tileEdge = false;
  decalParams.affectAlbedo = true;
  decalParams.affectRoughness = false;
  decalParams.affectNormal = false;
  decalParams.heightIntensity = 0.0;
  decalParams.texture = null;
  decalParams.heightTexture = null;
  decalParams.aspectW = 1;
  decalParams.aspectH = 1;
}

const ALLOWED_DECAL_EXTS = ['png', 'jpg', 'jpeg'];

async function pickOneFile(filters) {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const picked = await open({ multiple: false, filters });
  if (!picked) return null;
  return Array.isArray(picked) ? picked[0] : picked;
}

export async function pickDecalImage() {
  const picked = await pickOneFile([
    { name: 'Images', extensions: ALLOWED_DECAL_EXTS },
  ]);
  if (!picked) return;

  const ext = picked.split('.').pop().toLowerCase();
  if (!ALLOWED_DECAL_EXTS.includes(ext)) {
    pushToast(`Формат .${ext} не поддерживается`, 'error');
    return;
  }

  const { loadDecalTexture } = await import('./decal-textures.js');
  const result = await loadDecalTexture(picked);
  if (!result) {
    pushToast('Не удалось загрузить картинку', 'error');
    return;
  }

  decalParams.path = picked;
  decalParams.fileName = getBasename(picked);
  decalParams.texture = result.texture;
  decalParams.aspectW = result.width;
  decalParams.aspectH = result.height;
  decalParams.enabled = true;

  pushLog(`[Decal] Картинка: ${decalParams.fileName} (${result.width}x${result.height}, alpha=${result.hasAlpha})`);
  pushToast(`Decal: ${decalParams.fileName}`, 'success');
}

export function clearDecalImage() {
  decalParams.path = '';
  decalParams.fileName = '';
  decalParams.texture = null;
  decalParams.enabled = false;
  pushLog('[Decal] Картинка сброшена');
}

export async function pickDecalHeight() {
  const picked = await pickOneFile([
    { name: 'Height map', extensions: ALLOWED_DECAL_EXTS },
  ]);
  if (!picked) return;

  const ext = picked.split('.').pop().toLowerCase();
  if (!ALLOWED_DECAL_EXTS.includes(ext)) {
    pushToast(`Формат .${ext} не поддерживается`, 'error');
    return;
  }

  const { loadHeightTexture } = await import('./decal-textures.js');
  const result = await loadHeightTexture(picked);
  if (!result) {
    pushToast('Не удалось загрузить height', 'error');
    return;
  }

  decalParams.heightPath = picked;
  decalParams.heightFileName = getBasename(picked);
  decalParams.heightTexture = result.texture;

  pushLog(`[Decal] Height: ${decalParams.heightFileName}`);
  pushToast(`Height: ${decalParams.heightFileName}`, 'success');
}

export function clearDecalHeight() {
  decalParams.heightPath = '';
  decalParams.heightFileName = '';
  decalParams.heightTexture = null;
  pushLog('[Decal] Height сброшен');
}

// Settings
function normalizePos(p) {
  return {
    offsetX: typeof p.offsetX === 'number' ? p.offsetX : 0,
    offsetY: typeof p.offsetY === 'number' ? p.offsetY : 0,
    rotation: typeof p.rotation === 'number' ? p.rotation : 0,
    scale: typeof p.scale === 'number' ? p.scale : 1,
  };
}

const DEFAULT_SETTINGS = {
  previewResolution: 2048,
  saveMode: 'ask',
  saveDir: '',
  userMaskRust: '',
  userMaskDirt: '',
  userMaskStreak: '',
  userMaskScratch: '',
  folderMaskNamesRust: [],
  folderMaskNamesDirt: [],
  folderMaskNamesStreak: [],
  folderMaskNamesScratch: [],
  userMaskRustPos: { offsetX: 0, offsetY: 0, rotation: 0, scale: 1 },
  userMaskDirtPos: { offsetX: 0, offsetY: 0, rotation: 0, scale: 1 },
  userMaskStreakPos: { offsetX: 0, offsetY: 0, rotation: 0, scale: 1 },
  userMaskScratchPos: { offsetX: 0, offsetY: 0, rotation: 0, scale: 1 },
  masksInfoShown: false,
  uiZoom: 1.0,
  environment: 'neutral',
  environmentIntensity: 0.85,
  showHdrBackground: false,
  groupOpen: {
    mask: true,
    decal: true,
    preset: true,
    presetSettings: true,
    generation: true,
    maps: false,
    geometryLimit: true,
  },
  geometryLimitEnabled: false,
  geometryLimitMode: 'sides',
  geometryLimitSoftness: 0.5,
  geometryLimitInvert: false,
  triplanarEnabled: false,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem('wearcraft.settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      const clean = { ...DEFAULT_SETTINGS };
      if (typeof parsed.previewResolution === 'number') clean.previewResolution = parsed.previewResolution;
      if (typeof parsed.saveMode === 'string') clean.saveMode = parsed.saveMode;
      if (typeof parsed.saveDir === 'string') clean.saveDir = parsed.saveDir;
      if (typeof parsed.userMaskRust === 'string') clean.userMaskRust = parsed.userMaskRust;
      if (typeof parsed.userMaskDirt === 'string') clean.userMaskDirt = parsed.userMaskDirt;
      if (typeof parsed.userMaskStreak === 'string') clean.userMaskStreak = parsed.userMaskStreak;
      if (typeof parsed.userMaskScratch === 'string') clean.userMaskScratch = parsed.userMaskScratch;
      if (Array.isArray(parsed.folderMaskNamesRust)) clean.folderMaskNamesRust = parsed.folderMaskNamesRust;
      if (Array.isArray(parsed.folderMaskNamesDirt)) clean.folderMaskNamesDirt = parsed.folderMaskNamesDirt;
      if (Array.isArray(parsed.folderMaskNamesStreak)) clean.folderMaskNamesStreak = parsed.folderMaskNamesStreak;
      if (Array.isArray(parsed.folderMaskNamesScratch)) clean.folderMaskNamesScratch = parsed.folderMaskNamesScratch;
      if (typeof parsed.masksInfoShown === 'boolean') clean.masksInfoShown = parsed.masksInfoShown;
      if (typeof parsed.uiZoom === 'number' && parsed.uiZoom >= 0.5 && parsed.uiZoom <= 3.0) {
        clean.uiZoom = parsed.uiZoom;
      }
      if (typeof parsed.environment === 'string') clean.environment = parsed.environment;
      if (typeof parsed.environmentIntensity === 'number' && parsed.environmentIntensity >= 0 && parsed.environmentIntensity <= 2.0) {
        clean.environmentIntensity = parsed.environmentIntensity;
      }
      if (typeof parsed.showHdrBackground === 'boolean') clean.showHdrBackground = parsed.showHdrBackground;
      if (parsed.userMaskRustPos) clean.userMaskRustPos = normalizePos(parsed.userMaskRustPos);
      if (parsed.userMaskDirtPos) clean.userMaskDirtPos = normalizePos(parsed.userMaskDirtPos);
      if (parsed.userMaskStreakPos) clean.userMaskStreakPos = normalizePos(parsed.userMaskStreakPos);
      if (parsed.userMaskScratchPos) clean.userMaskScratchPos = normalizePos(parsed.userMaskScratchPos);
      if (parsed.groupOpen && typeof parsed.groupOpen === 'object') {
        clean.groupOpen = { ...clean.groupOpen, ...parsed.groupOpen };
      }
      if (typeof parsed.geometryLimitEnabled === 'boolean') clean.geometryLimitEnabled = parsed.geometryLimitEnabled;
      if (typeof parsed.geometryLimitMode === 'string') clean.geometryLimitMode = parsed.geometryLimitMode;
      if (typeof parsed.geometryLimitSoftness === 'number') clean.geometryLimitSoftness = parsed.geometryLimitSoftness;
      if (typeof parsed.geometryLimitInvert === 'boolean') clean.geometryLimitInvert = parsed.geometryLimitInvert;
      if (typeof parsed.triplanarEnabled === 'boolean') clean.triplanarEnabled = parsed.triplanarEnabled;
      return clean;
    }
  } catch (e) {}
  return { ...DEFAULT_SETTINGS };
}

export const settings = $state(loadSettings());

export function saveSettings() {
  try {
    localStorage.setItem('wearcraft.settings', JSON.stringify({
      previewResolution: settings.previewResolution,
      saveMode: settings.saveMode,
      saveDir: settings.saveDir,
      userMaskRust: settings.userMaskRust,
      userMaskDirt: settings.userMaskDirt,
      userMaskStreak: settings.userMaskStreak,
      userMaskScratch: settings.userMaskScratch,
      folderMaskNamesRust: settings.folderMaskNamesRust,
      folderMaskNamesDirt: settings.folderMaskNamesDirt,
      folderMaskNamesStreak: settings.folderMaskNamesStreak,
      folderMaskNamesScratch: settings.folderMaskNamesScratch,
      userMaskRustPos: settings.userMaskRustPos,
      userMaskDirtPos: settings.userMaskDirtPos,
      userMaskStreakPos: settings.userMaskStreakPos,
      userMaskScratchPos: settings.userMaskScratchPos,
      masksInfoShown: settings.masksInfoShown,
      uiZoom: settings.uiZoom,
      environment: settings.environment,
      environmentIntensity: settings.environmentIntensity,
      showHdrBackground: settings.showHdrBackground,
      groupOpen: settings.groupOpen,
      geometryLimitEnabled: settings.geometryLimitEnabled,
      geometryLimitMode: settings.geometryLimitMode,
      geometryLimitSoftness: settings.geometryLimitSoftness,
      geometryLimitInvert: settings.geometryLimitInvert,
      triplanarEnabled: settings.triplanarEnabled,
    }));
  } catch (e) {}
}

export function resetSettings() {
  settings.previewResolution = DEFAULT_SETTINGS.previewResolution;
  settings.saveMode = DEFAULT_SETTINGS.saveMode;
  settings.saveDir = DEFAULT_SETTINGS.saveDir;
  settings.userMaskRust = '';
  settings.userMaskDirt = '';
  settings.userMaskStreak = '';
  settings.userMaskScratch = '';
  settings.folderMaskNamesRust = [];
  settings.folderMaskNamesDirt = [];
  settings.folderMaskNamesStreak = [];
  settings.folderMaskNamesScratch = [];
  settings.userMaskRustPos = { offsetX: 0, offsetY: 0, rotation: 0, scale: 1 };
  settings.userMaskDirtPos = { offsetX: 0, offsetY: 0, rotation: 0, scale: 1 };
  settings.userMaskStreakPos = { offsetX: 0, offsetY: 0, rotation: 0, scale: 1 };
  settings.userMaskScratchPos = { offsetX: 0, offsetY: 0, rotation: 0, scale: 1 };
  settings.uiZoom = 1.0;
  settings.environment = 'neutral';
  settings.environmentIntensity = 0.85;
  settings.showHdrBackground = false;
  settings.groupOpen = {
    mask: true,
    decal: true,
    preset: true,
    presetSettings: true,
    generation: true,
    maps: false,
    geometryLimit: true,
  };
  settings.geometryLimitEnabled = false;
  settings.geometryLimitMode = 'sides';
  settings.geometryLimitSoftness = 0.5;
  settings.geometryLimitInvert = false;
  saveSettings();
}

// PBR
export const pbr = $state({
  textures: {}, paths: {},
  active: { albedo: false, normal: false, roughness: false, metalness: false, ao: false, height: false },
  showEdgeMode: false, repeatX: 1.0, repeatY: 1.0, rotation: 0.0,
});

// Viewer
export const viewer = $state({ shape: 'sphere', hasModel: false, loadedModel: null, mesh: null });

// UI
export const ui = $state({
  busy: false,
  logOpen: false,
  infoOpen: false,
  settingsOpen: false,
  saveOpen: false,
  colorPickerOpen: false,
  maskColorPickerOpen: false,
  masksLibraryOpen: null,
  masksInfoOpen: false,
  pendingMasksLibrary: null,
  dragOver: false,
  previewBusy: false,
  conflicts: null,
  conflictsResolve: null,
  logLines: ['WearCraft ready.'],
  progress: { visible: false, value: 0, label: '' },
  saveProgress: { visible: false, value: 0, label: '' },
  toasts: [],
  generated: [],
  currentVariation: 0,
  generationTick: 0,
  zoom: 1.0,
  environment: 'neutral',
  environmentIntensity: 0.85,
  showHdrBackground: false,

  geoNormalPath: '',
  geoNormalReady: false,
  geoNormalTick: 0,
  geoNormalTexture: null,

  uvMaskPath: '',
  uvMaskReady: false,
  uvMaskTick: 0,
  uvMaskTexture: null,

  worldPosPath: '',
  worldPosReady: false,
  worldPosTick: 0,
  worldPosTexture: null,
  worldPosBounds: { min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },

  geometryLimitEnabled: false,
  geometryLimitMode: 'sides',
  geometryLimitSoftness: 0.5,
  geometryLimitInvert: false,

  triplanarEnabled: false,
});

ui.zoom = settings.uiZoom || 1.0;
ui.environment = settings.environment || 'neutral';
ui.environmentIntensity = settings.environmentIntensity ?? 0.85;
ui.showHdrBackground = settings.showHdrBackground ?? false;
ui.geometryLimitEnabled = settings.geometryLimitEnabled ?? false;
ui.geometryLimitMode = settings.geometryLimitMode ?? 'sides';
ui.geometryLimitSoftness = settings.geometryLimitSoftness ?? 0.5;
ui.geometryLimitInvert = settings.geometryLimitInvert ?? false;
ui.triplanarEnabled = settings.triplanarEnabled ?? false;

export function setEnvironment(id) {
  ui.environment = id;
  settings.environment = id;
  saveSettings();
}

export function setEnvironmentIntensity(v) {
  ui.environmentIntensity = v;
  settings.environmentIntensity = v;
  saveSettings();
}

export function setShowHdrBackground(v) {
  ui.showHdrBackground = v;
  settings.showHdrBackground = v;
  saveSettings();
}

let toastId = 0;
export function pushToast(message, type = 'info') {
  const id = ++toastId;
  ui.toasts = [...ui.toasts, { id, message, type }];
  setTimeout(() => { ui.toasts = ui.toasts.filter(t => t.id !== id); }, 3000);
}

export function pushLog(msg) { ui.logLines = [...ui.logLines, msg].slice(-200); }

let progressTimer = null;
export function showProgress(label, value = 0) {
  if (progressTimer) { clearTimeout(progressTimer); progressTimer = null; }
  ui.progress = { visible: true, value, label };
}
export function setProgress(value, label) {
  ui.progress = { ...ui.progress, value, label: label ?? ui.progress.label };
}
export function hideProgress(delay = 500) {
  progressTimer = setTimeout(() => {
    ui.progress = { ...ui.progress, visible: false };
    progressTimer = null;
  }, delay);
}

export function randomSeed() { params.seed = Math.floor(Math.random() * 1e9); }

// Логика масок
const ALLOWED_MASK_EXTS = ['png', 'jpg', 'jpeg'];

export function getBasename(p) {
  return p.split(/[\\/]/).pop() || p;
}

async function pickOneMaskFile() {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const picked = await open({
    multiple: false,
    filters: [{ name: 'Masks', extensions: ALLOWED_MASK_EXTS }],
  });
  if (!picked) return null;
  return Array.isArray(picked) ? picked[0] : picked;
}

export async function pickUserMask(preset) {
  const picked = await pickOneMaskFile();
  if (!picked) return;

  const ext = picked.split('.').pop().toLowerCase();
  if (!ALLOWED_MASK_EXTS.includes(ext)) {
    pushToast(`Формат .${ext} не поддерживается`, 'error');
    return;
  }

  if (preset === 'rust') {
    settings.userMaskRust = picked;
    settings.folderMaskNamesRust = [];
  } else if (preset === 'streaks') {
    settings.userMaskStreak = picked;
    settings.folderMaskNamesStreak = [];
  } else if (preset === 'scratches') {
    settings.userMaskScratch = picked;
    settings.folderMaskNamesScratch = [];
  } else {
    settings.userMaskDirt = picked;
    settings.folderMaskNamesDirt = [];
  }
  saveSettings();
  pushLog(`[${preset}] Своя маска: ${getBasename(picked)}`);
  pushToast(`Своя маска: ${getBasename(picked)}`, 'success');
}

export function clearUserMask(preset) {
  if (preset === 'rust') settings.userMaskRust = '';
  else if (preset === 'streaks') settings.userMaskStreak = '';
  else if (preset === 'scratches') settings.userMaskScratch = '';
  else settings.userMaskDirt = '';
  saveSettings();
  pushLog(`[${preset}] Своя маска очищена`);
}

export function getUserMask(preset) {
  if (preset === 'rust') return settings.userMaskRust;
  if (preset === 'streaks') return settings.userMaskStreak;
  if (preset === 'scratches') return settings.userMaskScratch;
  return settings.userMaskDirt;
}

export function getUserMaskBasename(preset) {
  const p = getUserMask(preset);
  return p ? getBasename(p) : '';
}

export function getUserMaskPos(preset) {
  if (preset === 'rust') return settings.userMaskRustPos;
  if (preset === 'streaks') return settings.userMaskStreakPos;
  if (preset === 'scratches') return settings.userMaskScratchPos;
  return settings.userMaskDirtPos;
}

export function resetUserMaskPos(preset) {
  const pos = getUserMaskPos(preset);
  pos.offsetX = 0;
  pos.offsetY = 0;
  pos.rotation = 0;
  pos.scale = 1;
  saveSettings();
}

export function getFolderMaskNames(preset) {
  if (preset === 'rust') return settings.folderMaskNamesRust;
  if (preset === 'streaks') return settings.folderMaskNamesStreak;
  if (preset === 'scratches') return settings.folderMaskNamesScratch;
  return settings.folderMaskNamesDirt;
}

function setFolderMaskNames(preset, names) {
  if (preset === 'rust') settings.folderMaskNamesRust = names;
  else if (preset === 'streaks') settings.folderMaskNamesStreak = names;
  else if (preset === 'scratches') settings.folderMaskNamesScratch = names;
  else settings.folderMaskNamesDirt = names;
  saveSettings();
}

export function toggleFolderMask(preset, name) {
  const current = getFolderMaskNames(preset);
  const next = current.includes(name)
    ? current.filter(n => n !== name)
    : [...current, name];
  setFolderMaskNames(preset, next);
}

export function clearFolderMasks(preset) {
  setFolderMaskNames(preset, []);
}

export function selectAllFolderMasks(preset, allNames) {
  setFolderMaskNames(preset, [...allNames]);
}

export function markMasksInfoShown() {
  if (!settings.masksInfoShown) {
    settings.masksInfoShown = true;
    saveSettings();
  }
}

// ═══ Geo-limit: поддерживается только для сферы и загруженной модели ═══
// Куб, цилиндр, торус — overlapping/неподходящая UV, geo-limit бесполезен.
export function isGeoLimitSupported() {
  if (viewer.loadedModel) return true;
  const shape = viewer.shape;
  return shape !== 'cube' && shape !== 'cylinder' && shape !== 'torus';
}

// ═══ UV-острова: только для загруженной модели ═══
// У примитивов (сфера, куб, цилиндр, торус) UV полная — обрезать нечего.
export function isUvMaskSupported() {
  return !!viewer.loadedModel;
}

// ═══ World-position: только для загруженной модели ═══
// Для примитивов bbox известен и triplanar не имеет смысла.
export function isWorldPosSupported() {
  return !!viewer.loadedModel;
}

// Decal — рандом позиции и поворота
export function randomDecalTransform(varSeed) {
  const rand = (seed, step) => {
    let s = seed >>> 0;
    for (let i = 0; i < step; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
    }
    return (s & 0xFFFFFF) / 16777216;
  };
  const r1 = rand(varSeed, 1);
  const r2 = rand(varSeed, 2);
  const r3 = rand(varSeed, 3);
  return {
    posX: (r1 - 0.5) * 0.6,
    posY: (r2 - 0.5) * 0.6,
    rotation: r3 * 360.0,
  };
}