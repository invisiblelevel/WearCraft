// Загрузка кастомной маски + автодетект цветности.
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import * as THREE from 'three';
import { maskParams, pushToast, pushLog } from './stores.svelte.js';

// Белый список расширений для масок
const ALLOWED_MASK_EXTS = ['png', 'jpg', 'jpeg', 'bmp', 'tga', 'webp'];

/**
 * Открывает диалог выбора PNG/JPG, загружает маску,
 * определяет её тип (mono/color), создаёт Three.js Texture.
 */
export async function loadMask() {
  try {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Images', extensions: ALLOWED_MASK_EXTS }],
    });
    if (!selected) return; // юзер отменил

    const path = typeof selected === 'string' ? selected : selected.path;
    if (!path) return;

    // ═══ ВАЛИДАЦИЯ 1: расширение ═══
    const ext = path.split('.').pop().toLowerCase();
    if (!ALLOWED_MASK_EXTS.includes(ext)) {
      pushLog(`[Mask] Отклонён формат: .${ext} (не в белом списке)`);
      pushToast(`Формат .${ext} не поддерживается`, 'error');
      return false;
    }

    // Создаём URL для WebView (обход кэша через ?t=)
    const url = convertFileSrc(path) + '?t=' + Date.now();

    // Загружаем картинку в Image, потом в canvas → ImageData
    const img = await loadImageElement(url);

    // ═══ ВАЛИДАЦИЯ 2: размер ═══
    if (img.width === 0 || img.height === 0) {
      pushLog('[Mask] Битый файл — 0×0');
      pushToast('Файл повреждён (0×0)', 'error');
      return false;
    }

    // Детект: цветная или чёрно-белая
    const kind = detectMaskKind(img);

    // Создаём Three.js Texture для превью
    const texture = new THREE.Texture(img);
    texture.needsUpdate = true;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;

    // Заполняем состояние
    maskParams.path = path;
    maskParams.kind = kind;
    maskParams.fileName = getFileName(path);
    maskParams.texture = texture;
    maskParams.enabled = true;

    pushLog(`[Mask] Загружена: ${maskParams.fileName} (${kind}, ${img.width}×${img.height})`);
    pushToast(`Маска: ${maskParams.fileName}`, 'success');

    return true;
  } catch (e) {
    console.error(e);
    pushLog(`[Mask] Ошибка: ${e}`);
    pushToast(`Ошибка загрузки маски: ${e}`, 'error');
    return false;
  }
}

/**
 * Создаёт Image и ждёт загрузки.
 */
function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Не удалось загрузить изображение'));
    img.src = url;
  });
}

/**
 * Определяет тип маски: mono или color.
 * Считает разброс каналов R, G, B по всем пикселям (прореженно).
 * Если средний разброс > 15 → color.
 */
function detectMaskKind(img) {
  const SAMPLE_SIZE = 200;
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

  const data = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;

  let totalSpread = 0;
  let samples = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const spread = max - min;

    totalSpread += spread;
    samples++;
  }

  const avgSpread = totalSpread / Math.max(samples, 1);
  return avgSpread > 15 ? 'color' : 'mono';
}

/**
 * Извлекает имя файла из полного пути (Windows/Unix).
 */
function getFileName(path) {
  if (!path) return '';
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || '';
}

/**
 * Сбрасывает маску — удаляет Texture из VRAM.
 */
export function clearMask() {
  if (maskParams.texture) {
    maskParams.texture.dispose();
    maskParams.texture = null;
  }
  maskParams.enabled = false;
  maskParams.path = '';
  maskParams.fileName = '';
  maskParams.kind = 'mono';
}