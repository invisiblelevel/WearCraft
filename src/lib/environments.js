// Загрузчик HDR-окружений для 3D-вьюера.
// 5 пресетов, PMREM через Three.js RGBELoader.
// Первый (neutral) — грузится сразу, остальные — фоном.

import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// ═══ Список пресетов ═══
export const ENVIRONMENT_PRESETS = [
  { id: 'neutral', file: 'neutral.hdr', labelKey: 'env.neutral' },
  { id: 'warm',    file: 'warm.hdr',    labelKey: 'env.warm'    },
  { id: 'cool',    file: 'cool.hdr',    labelKey: 'env.cool'    },
  { id: 'white',   file: 'white.hdr',   labelKey: 'env.white'   },
  { id: 'night',   file: 'night.hdr',   labelKey: 'env.night'   },
];

// ═══ Кэш ═══
// Map<id, THREE.Texture> — env map после PMREM.
const cache = new Map();
// Map<id, Promise> — в полёте, чтобы не грузить дважды.
const pending = new Map();

let pmremGenerator = null;

function getPmremGenerator(renderer) {
  if (!pmremGenerator) {
    pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
  }
  return pmremGenerator;
}

/**
 * Загружает HDR-файл и возвращает PMREM-текстуру.
 * Кэширует.
 */
export async function loadEnvironment(renderer, id) {
  if (cache.has(id)) return cache.get(id);
  if (pending.has(id)) return pending.get(id);

  const preset = ENVIRONMENT_PRESETS.find(p => p.id === id);
  if (!preset) {
    console.warn(`[Env] Неизвестный пресет: ${id}`);
    return null;
  }

  const promise = (async () => {
    const loader = new RGBELoader();
    // Загружаем из /envs/<file>.hdr — Vite отдаёт из public/
    const url = `/envs/${preset.file}`;
    const hdr = await loader.loadAsync(url);

    const pmrem = getPmremGenerator(renderer);
    const envMap = pmrem.fromEquirectangular(hdr).texture;

    hdr.dispose();
    cache.set(id, envMap);
    pending.delete(id);
    return envMap;
  })();

  pending.set(id, promise);
  return promise;
}

/**
 * Применяет окружение к сцене.
 * @param renderer — WebGLRenderer
 * @param scene — THREE.Scene
 * @param id — id пресета ('neutral' | 'warm' | ...)
 * @param intensity — 0..2 (множитель)
 * @param showAsBackground — true: показать HDR как фон
 */
export async function applyEnvironment(renderer, scene, id, intensity = 0.85, showAsBackground = false) {
  const envMap = await loadEnvironment(renderer, id);
  if (!envMap) return false;

  scene.environment = envMap;
  scene.environmentIntensity = Math.max(0, Math.min(2.0, intensity));

  if (showAsBackground) {
    scene.background = envMap;
    scene.backgroundIntensity = 1.0;
  } else {
    scene.background = new THREE.Color(0x1a1a1a);
  }

  return true;
}

/**
 * Прогрев — загружает в фоне остальные пресеты.
 * Вызывать через setTimeout после первого рендера.
 */
export function preloadRest(renderer, currentId) {
  const others = ENVIRONMENT_PRESETS.filter(p => p.id !== currentId);
  // Последовательно, чтобы не забить CPU
  let i = 0;
  const loadNext = () => {
    if (i >= others.length) return;
    const preset = others[i++];
    loadEnvironment(renderer, preset.id).finally(() => {
      // следующая через 200мс, чтобы не мешать
      setTimeout(loadNext, 200);
    });
  };
  setTimeout(loadNext, 500);
}

export function clearEnvironmentCache() {
  for (const tex of cache.values()) {
    try { tex.dispose(); } catch (e) {}
  }
  cache.clear();
  pending.clear();
}