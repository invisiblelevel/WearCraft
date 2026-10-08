// Единый источник путей к маскам — общий для шейдера (превью) и Rust (финал).
import { invoke } from '@tauri-apps/api/core';
import { settings, pushLog } from './stores.svelte.js';

/**
 * Возвращает массив полных путей к маскам для пресета.
 * Приоритеты:
 *   1. Своя маска (userMaskRust / userMaskDirt / userMaskStreak / userMaskScratch) — одна.
 *   2. Если выбраны галочки (folderMaskNames) — только они.
 *   3. Если folderMaskNames = [] — пустой пул.
 *   4. Если folderMaskNames = null — все.
 */
export async function resolveMaskPaths(preset) {
  const isRust = preset === 'rust';
  const isStreaks = preset === 'streaks';
  const isDirt = preset === 'dirt';
  const isScratch = preset === 'scratches';
  if (!isRust && !isStreaks && !isDirt && !isScratch) return [];

  // Своя маска — приоритет
  const userMask = isRust ? settings.userMaskRust
                 : isStreaks ? settings.userMaskStreak
                 : isScratch ? settings.userMaskScratch
                 : settings.userMaskDirt;
  if (userMask) {
    return [userMask];
  }

  const subfolder = preset;  // "rust" | "dirt" | "streaks" | "scratches"
  const selected = isRust ? settings.folderMaskNamesRust
                 : isStreaks ? settings.folderMaskNamesStreak
                 : isScratch ? settings.folderMaskNamesScratch
                 : settings.folderMaskNamesDirt;

  // Пустой список — пустой пул (не «все»)
  if (Array.isArray(selected) && selected.length === 0) {
    return [];
  }

  // Получаем папку
  let folderPath;
  try {
    folderPath = await invoke('get_user_masks_path', { subfolder });
  } catch (e) {
    pushLog(`[mask-source] Не удалось получить путь к папке ${subfolder}: ${e}`);
    return [];
  }

  // Получаем список файлов
  let files;
  try {
    files = await invoke('list_masks_in_folder', { subfolder });
  } catch (e) {
    pushLog(`[mask-source] Не удалось получить список файлов ${subfolder}: ${e}`);
    return [];
  }

  if (!Array.isArray(files)) return [];

  // Фильтр по галочкам, если выбраны
  const filtered = (Array.isArray(selected) && selected.length > 0)
    ? files.filter(f => selected.includes(f))
    : files;

  // Собираем полные пути
  const sep = folderPath.includes('\\') ? '\\' : '/';
  return filtered.map(f => `${folderPath}${sep}${f}`);
}

/**
 * Быстрый подсчёт масок без полной загрузки — для instances.
 */
export async function resolveMaskCount(preset) {
  const paths = await resolveMaskPaths(preset);
  return Math.max(1, paths.length);
}

/**
 * Ключ для кеширования текстур — если путь или список изменился, надо перезагружать.
 */
export function maskPathsKey(preset, paths) {
  return `${preset}::${paths.join('|')}`;
}