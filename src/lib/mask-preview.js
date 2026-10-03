// Наложение кастомной маски на albedo в превью (Three.js).
// Использует offscreen canvas: albedo + маска с UV-трансформациями.
// Работает в реальном времени с throttling.

import * as THREE from 'three';
import { pbr, maskParams } from './stores.svelte.js';
import { convertFileSrc } from '@tauri-apps/api/core';

let currentScene = null;
let originalAlbedoTexture = null;   // что было в material.map ДО нас — для отката
let originalAlbedoCanvas = null;    // canvas с копией оригинала
let originalAlbedoSize = 0;
let maskImage = null;
let maskImagePath = '';
let currentPreviewTexture = null;

let rafId = null;
let lastUpdateTime = 0;
const THROTTLE_MS = 66;

export function setMaskPreviewScene(scene) {
  currentScene = scene;
}

function findMesh(scene) {
  if (!scene) return null;
  let found = null;
  scene.traverse((obj) => {
    if (found) return;
    if (obj.isMesh && obj.material && obj.material.map !== undefined) {
      found = obj;
    }
  });
  return found;
}

/**
 * Возвращает Image с albedo-текстурой.
 * Если texture.image — это <img> или <canvas>, берём его.
 */
function getAlbedoImage() {
  const tex = pbr.textures?.albedo;
  if (!tex || !tex.image) return null;
  const img = tex.image;
  if (img.width === 0 || img.height === 0) return null;
  return img;
}

/**
 * Сохраняет оригинальную albedo один раз.
 */
function ensureOriginalAlbedo() {
  if (originalAlbedoCanvas) return true;

  const img = getAlbedoImage();
  if (!img) return false;

  const size = Math.max(img.width, img.height);
  if (size === 0) return false;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);

  originalAlbedoCanvas = canvas;
  originalAlbedoSize = size;

  // Запоминаем, что было в material.map
  const mesh = findMesh(currentScene);
  if (mesh && mesh.material) {
    originalAlbedoTexture = mesh.material.map;
  }
  return true;
}

async function ensureMaskImage() {
  if (!maskParams.enabled || !maskParams.path) return false;
  if (maskImage && maskImagePath === maskParams.path) return true;

  return new Promise((resolve) => {
    const url = convertFileSrc(maskParams.path) + '?t=' + Date.now();
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (img.width === 0 || img.height === 0) {
        console.warn('[Mask Preview] Маска нулевого размера');
        resolve(false);
        return;
      }
      maskImage = img;
      maskImagePath = maskParams.path;
      resolve(true);
    };
    img.onerror = () => {
      console.warn('[Mask Preview] Не удалось загрузить маску:', maskParams.path);
      resolve(false);
    };
    img.src = url;
  });
}

function renderMaskedAlbedo() {
  if (!currentScene) return null;
  if (!ensureOriginalAlbedo()) return null;

  const mesh = findMesh(currentScene);
  if (!mesh || !mesh.material) return null;

  const size = originalAlbedoSize;
  if (size === 0) return null;

  let canvas = mesh.material.__maskCanvas;
  if (!canvas || canvas.width !== size) {
    canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    mesh.material.__maskCanvas = canvas;
  }
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(originalAlbedoCanvas, 0, 0, size, size);

  if (!maskImage || !maskParams.enabled) {
    return pushTexture(mesh.material, canvas);
  }

  let maskCanvas = mesh.material.__maskCanvas2;
  if (!maskCanvas || maskCanvas.width !== size) {
    maskCanvas = document.createElement('canvas');
    maskCanvas.width = size;
    maskCanvas.height = size;
    mesh.material.__maskCanvas2 = maskCanvas;
  }
  const mctx = maskCanvas.getContext('2d');
  mctx.clearRect(0, 0, size, size);

  mctx.save();
  mctx.translate(
    size * (0.5 + maskParams.posX * 0.5),
    size * (0.5 + maskParams.posY * 0.5)
  );
  mctx.rotate((maskParams.rotation * Math.PI) / 180);
  const drawSize = size * maskParams.scale;
  mctx.drawImage(maskImage, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
  mctx.restore();

  ctx.globalAlpha = maskParams.opacity;

  if (maskParams.kind === 'mono') {
    let tintCanvas = mesh.material.__maskCanvas3;
    if (!tintCanvas || tintCanvas.width !== size) {
      tintCanvas = document.createElement('canvas');
      tintCanvas.width = size;
      tintCanvas.height = size;
      mesh.material.__maskCanvas3 = tintCanvas;
    }
    const tctx = tintCanvas.getContext('2d');
    tctx.clearRect(0, 0, size, size);
    tctx.drawImage(maskCanvas, 0, 0);
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = `rgb(${maskParams.color[0]},${maskParams.color[1]},${maskParams.color[2]})`;
    tctx.fillRect(0, 0, size, size);
    tctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(tintCanvas, 0, 0);
  } else {
    ctx.drawImage(maskCanvas, 0, 0);
  }

  ctx.globalAlpha = 1;

  return pushTexture(mesh.material, canvas);
}

function pushTexture(material, canvas) {
  if (currentPreviewTexture) {
    currentPreviewTexture.dispose();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(pbr.repeatX || 1, pbr.repeatY || 1);
  tex.rotation = (pbr.rotation || 0) * Math.PI / 180;
  tex.needsUpdate = true;

  currentPreviewTexture = tex;
  material.map = tex;
  material.needsUpdate = true;
  return tex;
}

export async function applyMaskPreview(scene) {
  if (scene) currentScene = scene;
  if (!currentScene) return;

  // Проверка: есть ли вообще albedo
  const img = getAlbedoImage();
  if (!img) {
    console.warn('[Mask Preview] Нет albedo-текстуры — маска не применена');
    return;
  }

  if (!ensureOriginalAlbedo()) return;
  const ok = await ensureMaskImage();
  if (!ok) return;
  renderMaskedAlbedo();
}

export function removeMaskPreview() {
  const mesh = findMesh(currentScene);
  if (mesh && originalAlbedoTexture && mesh.material) {
    if (currentPreviewTexture) {
      currentPreviewTexture.dispose();
      currentPreviewTexture = null;
    }
    mesh.material.map = originalAlbedoTexture;
    mesh.material.needsUpdate = true;
  }
  originalAlbedoCanvas = null;
  originalAlbedoSize = 0;
}

export function scheduleMaskPreviewUpdate() {
  if (!maskParams.enabled) return;
  if (!currentScene) return;
  if (!originalAlbedoCanvas) {
    // Ещё не инициализированы — попробуем в следующий кадр
    return;
  }

  const now = performance.now();
  if (now - lastUpdateTime < THROTTLE_MS) {
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        scheduleMaskPreviewUpdate();
      });
    }
    return;
  }
  lastUpdateTime = now;
  renderMaskedAlbedo();
}

export function finalMaskPreviewUpdate() {
  if (!maskParams.enabled) return;
  if (!currentScene) return;
  if (!originalAlbedoCanvas) return;
  renderMaskedAlbedo();
}