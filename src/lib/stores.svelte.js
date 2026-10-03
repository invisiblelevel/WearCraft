// Общее состояние приложения.

export const params = $state({
  preset: 'custom', variations: 5, warp: 20, amount: 50,
  seed: Math.floor(Math.random() * 1e9),
});

export const PRESET_DEFAULTS = {
  custom:    { warp: 0,  amount: 0  },
  scratches: { warp: 20, amount: 50 },
  dirt:      { warp: 40, amount: 60 },
  rust:      { warp: 30, amount: 70 },
};

export function setPreset(name) {
  if (!PRESET_DEFAULTS[name]) return;
  params.preset = name;
  params.warp = PRESET_DEFAULTS[name].warp;
  params.amount = PRESET_DEFAULTS[name].amount;
}

// Scratch
export const scratchParams = $state({
  density: 0.5, length: 0.15, thickness: 2.0,
  waviness: 0.35, branches: 0.1, clusters: 0.3,
  normalEnabled: true, depth: 0.8,
  realistic: true, rimHighlight: true,
});

export function resetScratchParams() {
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
}

// Dirt (через маски)
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
  // Заход 23+: ручное управление тайлингом библиотеки
  posX: 0.0,
  posY: 0.0,
  rotation: 0.0,
  randomRotation: true,
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
}

// Rust (через маски)
export const rustParams = $state({
  count: 3.0,
  scale: 1.0,
  deform: 0.5,
  threshold: 0.5,
  sharpness: 0.5,
  volume: 0,
  rimHighlight: true,
  normalEnabled: true,
  // Заход 23+: ручное управление тайлингом библиотеки
  posX: 0.0,
  posY: 0.0,
  rotation: 0.0,
  randomRotation: true,
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
}

// Custom Mask (общая, для пресета custom)
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

// ─── Settings ───

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

  // Маски: одна юзерская маска (приоритет) ИЛИ набор из папки
  userMaskRust: '',
  userMaskDirt: '',
  folderMaskNamesRust: [],
  folderMaskNamesDirt: [],

  // Заход 23: позиция юзерской маски (точечное размещение, без тайлинга)
  userMaskRustPos: { offsetX: 0, offsetY: 0, rotation: 0, scale: 1 },
  userMaskDirtPos: { offsetX: 0, offsetY: 0, rotation: 0, scale: 1 },

  masksInfoShown: false,
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
      if (Array.isArray(parsed.folderMaskNamesRust)) clean.folderMaskNamesRust = parsed.folderMaskNamesRust;
      if (Array.isArray(parsed.folderMaskNamesDirt)) clean.folderMaskNamesDirt = parsed.folderMaskNamesDirt;
      if (typeof parsed.masksInfoShown === 'boolean') clean.masksInfoShown = parsed.masksInfoShown;
      if (parsed.userMaskRustPos && typeof parsed.userMaskRustPos === 'object') {
        clean.userMaskRustPos = normalizePos(parsed.userMaskRustPos);
      }
      if (parsed.userMaskDirtPos && typeof parsed.userMaskDirtPos === 'object') {
        clean.userMaskDirtPos = normalizePos(parsed.userMaskDirtPos);
      }
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
      folderMaskNamesRust: settings.folderMaskNamesRust,
      folderMaskNamesDirt: settings.folderMaskNamesDirt,
      userMaskRustPos: settings.userMaskRustPos,
      userMaskDirtPos: settings.userMaskDirtPos,
      masksInfoShown: settings.masksInfoShown,
    }));
  } catch (e) {}
}

export function resetSettings() {
  settings.previewResolution = DEFAULT_SETTINGS.previewResolution;
  settings.saveMode = DEFAULT_SETTINGS.saveMode;
  settings.saveDir = DEFAULT_SETTINGS.saveDir;
  settings.userMaskRust = '';
  settings.userMaskDirt = '';
  settings.folderMaskNamesRust = [];
  settings.folderMaskNamesDirt = [];
  settings.userMaskRustPos = { offsetX: 0, offsetY: 0, rotation: 0, scale: 1 };
  settings.userMaskDirtPos = { offsetX: 0, offsetY: 0, rotation: 0, scale: 1 };
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
});

// Helpers
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

// ═══ Логика масок (Rust и Dirt) ═══

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

// ─── User mask (одна, приоритетная) ───

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
  } else {
    settings.userMaskDirt = picked;
    settings.folderMaskNamesDirt = [];
  }
  saveSettings();
  pushLog(`[${preset}] Своя маска: ${getBasename(picked)}`);
  pushToast(`Своя маска: ${getBasename(picked)}`, 'success');
}

export function clearUserMask(preset) {
  if (preset === 'rust') {
    settings.userMaskRust = '';
  } else {
    settings.userMaskDirt = '';
  }
  saveSettings();
  pushLog(`[${preset}] Своя маска очищена`);
}

export function getUserMask(preset) {
  return preset === 'rust' ? settings.userMaskRust : settings.userMaskDirt;
}

export function getUserMaskBasename(preset) {
  const p = getUserMask(preset);
  return p ? getBasename(p) : '';
}

// Заход 23: позиция юзерской маски
export function getUserMaskPos(preset) {
  return preset === 'rust' ? settings.userMaskRustPos : settings.userMaskDirtPos;
}

export function resetUserMaskPos(preset) {
  const pos = getUserMaskPos(preset);
  pos.offsetX = 0;
  pos.offsetY = 0;
  pos.rotation = 0;
  pos.scale = 1;
  saveSettings();
}

// ─── Folder masks (галочки из папки) ───

export function getFolderMaskNames(preset) {
  return preset === 'rust' ? settings.folderMaskNamesRust : settings.folderMaskNamesDirt;
}

function setFolderMaskNames(preset, names) {
  if (preset === 'rust') {
    settings.folderMaskNamesRust = names;
  } else {
    settings.folderMaskNamesDirt = names;
  }
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

// ─── Info-модалка ───

export function markMasksInfoShown() {
  if (!settings.masksInfoShown) {
    settings.masksInfoShown = true;
    saveSettings();
  }
}