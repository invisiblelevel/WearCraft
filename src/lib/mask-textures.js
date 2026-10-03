// Загрузчик текстур масок для шейдера (Rust и Dirt).
import * as THREE from 'three';
import { convertFileSrc } from '@tauri-apps/api/core';
import { pushLog } from './stores.svelte.js';

const cache = new Map();  // path -> THREE.Texture

export async function loadMaskTexture(path) {
  if (cache.has(path)) return cache.get(path);

  return new Promise((resolve) => {
    const url = convertFileSrc(path) + '?t=' + Date.now();
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, img.width, img.height).data;
      const total = img.width * img.height;

      // Считаем статистику: RGB-яркость и альфу
      let rgbMin = 255, rgbMax = 0, aMin = 255, aMax = 0;
      for (let i = 0; i < total; i++) {
        const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
        const lum = Math.round((r + g + b) / 3);
        if (lum < rgbMin) rgbMin = lum;
        if (lum > rgbMax) rgbMax = lum;
        if (a < aMin) aMin = a;
        if (a > aMax) aMax = a;
      }
      const rgbRange = rgbMax - rgbMin;
      const alphaRange = aMax - aMin;

      // Берём тот канал, где БОЛЬШЕ вариация.
      // Если оба однотонные — берём RGB (не важно, что).
      const useAlpha = alphaRange > rgbRange && alphaRange > 10;

      pushLog(`[Mask] ${path.split(/[\\/]/).pop()} rgbRange=${rgbRange} alphaRange=${alphaRange} → useAlpha=${useAlpha}`);

      // Пишем выбранный канал в RGB, альфу = 255
      for (let i = 0; i < total; i++) {
        let v;
        if (useAlpha) {
          v = data[i * 4 + 3];
        } else {
          v = Math.round((data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3);
        }
        data[i * 4] = v;
        data[i * 4 + 1] = v;
        data[i * 4 + 2] = v;
        data[i * 4 + 3] = 255;
      }
      ctx.putImageData(new ImageData(data, img.width, img.height), 0, 0);

      const tex = new THREE.Texture(c);
      tex.needsUpdate = true;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      // КРИТИЧНО: без этого шейдер зеркалит маску по Y относительно Rust.
      // Rust читает PNG сверху вниз (Y-down), Three.js по умолчанию — наоборот.
      tex.flipY = false;
      // КРИТИЧНО: маска — это данные, не цвет. Без этого Three гамма-корректирует её.
      tex.colorSpace = THREE.NoColorSpace;
      cache.set(path, tex);
      resolve(tex);
    };
    img.onerror = () => {
      pushLog(`[Shader] Ошибка загрузки маски: ${path}`);
      resolve(null);
    };
    img.src = url;
  });
}

export async function loadAllMaskTextures(paths) {
  const results = await Promise.all(paths.map(loadMaskTexture));
  return results.filter(t => t !== null);
}

export function clearMaskTextureCache() {
  for (const tex of cache.values()) {
    tex.dispose();
  }
  cache.clear();
}