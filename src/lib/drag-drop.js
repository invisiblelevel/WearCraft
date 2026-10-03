// Drag & drop PBR-карт из проводника на окно вьюпорта.
import { getCurrentWindow } from '@tauri-apps/api/window';
import { readDir } from '@tauri-apps/plugin-fs';
import { pbr, ui, pushLog, pushToast, hideProgress } from './stores.svelte.js';
import { loadTextureFor, applyPBR, computeSobelFromHeight, detectMapType } from './pbr-loader.js';

let canvasBoundsFn = null;
let unlistenFns = [];

export function registerDropZone(getBoundsFn) {
  canvasBoundsFn = getBoundsFn;
}

function isInsideCanvas(pos) {
  if (!canvasBoundsFn) return true;
  const b = canvasBoundsFn();
  if (!b) return true;
  return pos.x >= b.x && pos.x <= b.x + b.width && pos.y >= b.y && pos.y <= b.y + b.height;
}

function isImage(path) {
  return /\.(png|jpg|jpeg|webp|bmp|tga)$/i.test(path);
}

function basename(path) {
  return path.split(/[\\/]/).pop() || '';
}

async function expandPaths(paths) {
  const files = [];
  for (const p of paths) {
    const name = basename(p);
    if (isImage(p)) {
      files.push(p);
      continue;
    }
    try {
      const entries = await readDir(p);
      for (const entry of entries) {
        if (entry.isFile && isImage(entry.name)) {
          const full = p.endsWith('/') || p.endsWith('\\') ? p + entry.name : p + '/' + entry.name;
          files.push(full);
        }
      }
      pushLog(`[Drop] Папка ${name}: ${entries.length} файлов`);
    } catch (e) {
      pushLog(`[Drop] Пропущено: ${name} (${e.message || 'не файл/папка'})`);
    }
  }
  return files;
}

function groupByKind(files) {
  const groups = {};
  const unknown = [];
  for (const p of files) {
    const name = basename(p);
    const kind = detectMapType(name);
    if (!kind) {
      unknown.push(p);
      continue;
    }
    if (!groups[kind]) groups[kind] = [];
    groups[kind].push(p);
  }
  return { groups, unknown };
}

function resolveConflicts(groups) {
  return new Promise((resolve) => {
    const conflicts = {};
    let hasConflict = false;
    for (const [kind, paths] of Object.entries(groups)) {
      if (paths.length > 1) {
        conflicts[kind] = paths;
        hasConflict = true;
      }
    }
    if (!hasConflict) {
      resolve(groups);
      return;
    }
    ui.conflicts = conflicts;
    ui.conflictsResolve = (resolved) => {
      ui.conflicts = null;
      ui.conflictsResolve = null;
      if (!resolved) {
        resolve(null);
        return;
      }
      const merged = { ...groups, ...resolved };
      resolve(merged);
    };
  });
}

async function handleDrop(paths) {
  if (!paths || paths.length === 0) return;

  ui.busy = true;
  pushLog(`[Drop] Получено путей: ${paths.length}`);

  try {
    const files = await expandPaths(paths);
    pushLog(`[Drop] Файлов после развёртки: ${files.length}`);

    if (files.length === 0) {
      pushToast('Файлы не найдены (нет PNG/JPG)', 'warn');
      return;
    }

    const { groups, unknown } = groupByKind(files);
    if (unknown.length > 0) {
      pushLog(`[Drop] Не распознано: ${unknown.length}`);
    }

    const resolved = await resolveConflicts(groups);
    if (!resolved) {
      pushLog('[Drop] Отменено');
      return;
    }

    // НЕ сбрасываем старые карты — юзер догружает.
    for (const [kind, pathsList] of Object.entries(resolved)) {
      const path = pathsList[0];
      const name = basename(path);
      await loadTextureFor(kind, path, name);
    }

    // Sobel если height есть, а edge нет
    if (pbr.textures.height && !pbr.textures.edge && pbr.paths.height) {
      try {
        const { convertFileSrc } = await import('@tauri-apps/api/core');
        const heightUrl = convertFileSrc(pbr.paths.height) + '?t=' + Date.now();
        const sobelTex = await computeSobelFromHeight(heightUrl);
        pbr.textures = { ...pbr.textures, edge: sobelTex };
        pushLog('[Drop] Edge посчитан из height (Sobel)');
      } catch (e) {
        pushLog(`[Drop] Sobel ошибка: ${e.message}`);
      }
    }

    applyPBR();
    pushToast(`Загружено карт: ${Object.keys(pbr.textures).length}`, 'success');
  } catch (e) {
    console.error(e);
    pushLog(`[Drop] Ошибка: ${e.message || e}`);
    pushToast(`Ошибка: ${e.message || e}`, 'error');
  } finally {
    ui.busy = false;
    ui.dragOver = false;
    hideProgress(0);
  }
}

export async function initDragDrop() {
  const appWindow = getCurrentWindow();

  const unlisten = await appWindow.onDragDropEvent(async (event) => {
    const { type, paths, position } = event.payload;

    if (type === 'enter' || type === 'over') {
      if (isInsideCanvas(position)) {
        ui.dragOver = true;
      } else {
        ui.dragOver = false;
      }
    } else if (type === 'leave') {
      ui.dragOver = false;
    } else if (type === 'drop') {
      ui.dragOver = false;
      if (isInsideCanvas(position)) {
        await handleDrop(paths);
      } else {
        pushLog(`[Drop] Вне зоны вьюпорта`);
      }
    }
  });

  unlistenFns.push(unlisten);
  pushLog('[Drop] Drag & drop инициализирован');
}

export function destroyDragDrop() {
  for (const fn of unlistenFns) {
    try { fn(); } catch (e) {}
  }
  unlistenFns = [];
}