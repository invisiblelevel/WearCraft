// Реальные действия — обёртки над модулями
import { loadModel as loadModelImpl, setScene as setModelScene, setApplyPBRCallback } from './model-loader.js';
import { loadPBR as loadPBRImpl, clearPBR as clearPBRImpl, applyPBR } from './pbr-loader.js';
import {
  savePBR as savePBRImpl,
  saveZIP as saveZIPImpl,
  saveOBJ as saveOBJImpl,
  saveForUnreal as saveForUnrealImpl,
  saveForUnity as saveForUnityImpl,
} from './saver.js';
import { generateWear } from './generator.js';
import { loadMask as loadMaskImpl, clearMask as clearMaskImpl } from './mask-loader.js';
import { applyMaskPreview, removeMaskPreview, setMaskPreviewScene } from './mask-preview.js';

let sceneRef = null;

export function initActions(scene) {
  sceneRef = scene;
  setModelScene(scene);
  setApplyPBRCallback(applyPBR);
  setMaskPreviewScene(scene);
}

export async function onLoadModel() {
  await loadModelImpl();
}

export async function onLoadPBR() {
  await loadPBRImpl();
}

export function onClearPBR() {
  clearPBRImpl();
}

export async function onLoadMapFor(kind) {
  const { loadMapFor } = await import('./pbr-loader.js');
  await loadMapFor(kind);
}

export async function onSavePBR() {
  await savePBRImpl();
}

export async function onSaveZIP() {
  await saveZIPImpl();
}

export async function onSaveOBJ() {
  await saveOBJImpl();
}

export async function onSaveUnreal() {
  await saveForUnrealImpl();
}

export async function onSaveUnity(pipeline = 'builtin') {
  await saveForUnityImpl(pipeline);
}

export async function onGenerateWear() {
  await generateWear();
}

// ── Кастомная маска ──

export async function onLoadMask() {
  const ok = await loadMaskImpl();
  if (ok && sceneRef) {
    try {
      await applyMaskPreview(sceneRef);
    } catch (e) {
      console.warn('[Mask] applyMaskPreview не сработал:', e);
    }
  }
}

export function onClearMask() {
  removeMaskPreview();
  clearMaskImpl();
}