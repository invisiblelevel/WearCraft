// Глобальные хоткеи приложения.
import { ui, pushLog } from './stores.svelte.js';
import { onLoadPBR, onLoadMask, onGenerateWear } from './actions.svelte.js';

let listeners = [];

function isCtrl(e) {
  return e.ctrlKey || e.metaKey;
}

function isTypingInInput(e) {
  const el = e.target;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

function closeAnyModal() {
  if (ui.infoOpen) { ui.infoOpen = false; return true; }
  if (ui.settingsOpen) { ui.settingsOpen = false; return true; }
  if (ui.saveOpen) { ui.saveOpen = false; return true; }
  if (ui.colorPickerOpen) { ui.colorPickerOpen = false; return true; }
  if (ui.maskColorPickerOpen) { ui.maskColorPickerOpen = false; return true; }
  if (ui.conflicts) {
    if (ui.conflictsResolve) ui.conflictsResolve(null);
    return true;
  }
  return false;
}

// ═══ Зум UI — ступени ═══
const ZOOM_STEPS = [0.75, 0.90, 1.0, 1.10, 1.25, 1.50, 1.75, 2.0];

function zoomIn() {
  const cur = ui.zoom;
  const next = ZOOM_STEPS.find(s => s > cur + 0.001);
  if (next === undefined) return;
  ui.zoom = next;
}

function zoomOut() {
  const cur = ui.zoom;
  const prev = [...ZOOM_STEPS].reverse().find(s => s < cur - 0.001);
  if (prev === undefined) return;
  ui.zoom = prev;
}

function zoomReset() {
  ui.zoom = 1.0;
}

function onKeyDown(e) {
  // Escape — закрыть модалку
  if (e.code === 'Escape') {
    if (closeAnyModal()) {
      e.preventDefault();
      return;
    }
  }

  if (!isCtrl(e)) return;

  // Ctrl+Shift+O — загрузить маску
  if (e.shiftKey && e.code === 'KeyO') {
    e.preventDefault();
    pushLog('[Hotkey] Ctrl+Shift+O — маска');
    onLoadMask();
    return;
  }

  // Ctrl+O — загрузить PBR
  if (!e.shiftKey && e.code === 'KeyO') {
    e.preventDefault();
    pushLog('[Hotkey] Ctrl+O — PBR');
    onLoadPBR();
    return;
  }

  // Ctrl+G — Generate
  if (e.code === 'KeyG') {
    e.preventDefault();
    if (isTypingInInput(e)) return;
    pushLog('[Hotkey] Ctrl+G — Generate');
    onGenerateWear();
    return;
  }

  // Ctrl+S — Save
  if (e.code === 'KeyS') {
    e.preventDefault();
    pushLog('[Hotkey] Ctrl+S — Save');
    ui.saveOpen = true;
    return;
  }

  // Ctrl+= / Ctrl++ — зум вверх
  if (e.code === 'Equal' || e.code === 'NumpadAdd') {
    e.preventDefault();
    pushLog('[Hotkey] Zoom +');
    zoomIn();
    return;
  }

  // Ctrl+- — зум вниз
  if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
    e.preventDefault();
    pushLog('[Hotkey] Zoom −');
    zoomOut();
    return;
  }

  // Ctrl+0 — сброс зума
  if (e.code === 'Digit0' || e.code === 'Numpad0') {
    e.preventDefault();
    pushLog('[Hotkey] Zoom 100%');
    zoomReset();
    return;
  }
}

export function initHotkeys() {
  window.addEventListener('keydown', onKeyDown, true);
  listeners.push(() => window.removeEventListener('keydown', onKeyDown, true));
  pushLog('[Hotkey] Хоткеи активированы');
}

export function destroyHotkeys() {
  for (const fn of listeners) {
    try { fn(); } catch (e) {}
  }
  listeners = [];
}