// Загрузчик текстур Decal.
// decal: RGB + ALPHA (alpha = маска для шейдера).
// height: grayscale (если нет alpha) или alpha (если есть alpha-вариация).

import * as THREE from 'three';
import { convertFileSrc } from '@tauri-apps/api/core';
import { pushLog } from './stores.svelte.js';

const cache = new Map();  // path -> { texture, width, height, hasAlpha }

/**
 * Загружает decal-картинку как есть: RGB + alpha.
 * flipY=false (Rust читает PNG сверху вниз), SRGBColorSpace (это цвет).
 * Возвращает { texture, width, height, hasAlpha } или null.
 */
export async function loadDecalTexture(path) {
  if (cache.has(path)) return cache.get(path);

  return new Promise((resolve) => {
    const url = convertFileSrc(path) + '?t=' + Date.now();
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (img.width === 0 || img.height === 0) {
        pushLog(`[Decal] Пустая картинка: ${path}`);
        resolve(null);
        return;
      }

      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);

      // Проверяем, есть ли alpha-вариация
      const data = ctx.getImageData(0, 0, img.width, img.height).data;
      const total = img.width * img.height;
      let aMin = 255, aMax = 0;
      for (let i = 0; i < total; i++) {
        const a = data[i * 4 + 3];
        if (a < aMin) aMin = a;
        if (a > aMax) aMax = a;
        if (aMax - aMin > 10) break;   // рано выходим, вариация есть
      }
      const hasAlpha = (aMax - aMin) > 10;

      pushLog(`[Decal] ${path.split(/[\\/]/).pop()} ${img.width}x${img.height} hasAlpha=${hasAlpha}`);

      const tex = new THREE.Texture(c);
      tex.needsUpdate = true;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.flipY = false;
      tex.colorSpace = THREE.SRGBColorSpace;   // decal — это цвет
      tex.generateMipmaps = true;

      const result = {
        texture: tex,
        width: img.width,
        height: img.height,
        hasAlpha,
      };
      cache.set(path, result);
      resolve(result);
    };

    img.onerror = () => {
      pushLog(`[Decal] Ошибка загрузки: ${path}`);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Загружает height-карту.
 * Логика как в mask-textures: если в PNG есть alpha-вариация — берём alpha,
 * иначе — усреднённый RGB (grayscale).
 * flipY=false, NoColorSpace (это данные).
 * Возвращает { texture, width, height } или null.
 */
export async function loadHeightTexture(path) {
  if (cache.has(path)) return cache.get(path);

  return new Promise((resolve) => {
    const url = convertFileSrc(path) + '?t=' + Date.now();
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (img.width === 0 || img.height === 0) {
        pushLog(`[Decal] Пустая height: ${path}`);
        resolve(null);
        return;
      }

      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);

      const data = ctx.getImageData(0, 0, img.width, img.height).data;
      const total = img.width * img.height;

      // Определяем, есть ли alpha-вариация
      let aMin = 255, aMax = 0;
      let lumSum = 0;
      for (let i = 0; i < total; i++) {
        const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
        if (a < aMin) aMin = a;
        if (a > aMax) aMax = a;
        lumSum += Math.round((r + g + b) / 3);
      }
      const alphaRange = aMax - aMin;
      const useAlpha = alphaRange > 10;
      const lumMean = lumSum / total;
      const invertRgb = !useAlpha && lumMean > 127;

      pushLog(`[Decal/Height] ${path.split(/[\\/]/).pop()} alphaRange=${alphaRange} lumMean=${lumMean.toFixed(0)} useAlpha=${useAlpha} invertRgb=${invertRgb}`);

      for (let i = 0; i < total; i++) {
        let v;
        if (useAlpha) {
          v = data[i * 4 + 3];
        } else {
          v = Math.round((data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3);
          if (invertRgb) v = 255 - v;
        }
        data[i * 4] = v;
        data[i * 4 + 1] = v;
        data[i * 4 + 2] = v;
        data[i * 4 + 3] = 255;
      }
      ctx.putImageData(new ImageData(data, img.width, img.height), 0, 0);

      const tex = new THREE.Texture(c);
      tex.needsUpdate = true;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.flipY = false;
      tex.colorSpace = THREE.NoColorSpace;   // height — данные
      tex.generateMipmaps = true;

      const result = {
        texture: tex,
        width: img.width,
        height: img.height,
      };
      cache.set(path, result);
      resolve(result);
    };

    img.onerror = () => {
      pushLog(`[Decal] Ошибка загрузки height: ${path}`);
      resolve(null);
    };
    img.src = url;
  });
}

export function clearDecalTextureCache() {
  for (const entry of cache.values()) {
    entry.texture.dispose();
  }
  cache.clear();
}