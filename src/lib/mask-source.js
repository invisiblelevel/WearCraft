// Единый источник путей к маскам для пресетов rust/dirt.
// Используется и Preview3D (для шейдера), и generator.js (для Rust).
import { invoke } from '@tauri-apps/api/core';
import { settings } from './stores.svelte.js';

/**
 * Возвращает список полных путей к маскам для указанного пресета.
 *
 * Логика:
 *  1. Если userMask задан — ТОЛЬКО он.
 *  2. Иначе — только выбранные из папки.
 *     Если галочек нет — НИЧЕГО (не «все»!).
 */
export async function resolveMaskPaths(preset) {
  const userMask = preset === 'rust' ? settings.userMaskRust : settings.userMaskDirt;

  // 1. Одна юзерская маска
  if (userMask) {
    return [userMask];
  }

  // 2. Из папки — только выбранные
  let folderNames = [];
  try {
    folderNames = await invoke('list_masks_in_folder', { subfolder: preset });
  } catch (e) {
    console.warn('[mask-source] list_masks_in_folder:', e);
    return [];
  }

  if (folderNames.length === 0) return [];

  const selectedNames = preset === 'rust'
    ? (settings.folderMaskNamesRust || [])
    : (settings.folderMaskNamesDirt || []);

  // Если галочек нет — ничего не возвращаем
  if (selectedNames.length === 0) return [];

  const namesToUse = selectedNames.filter(n => folderNames.includes(n));
  if (namesToUse.length === 0) return [];

  let folderPath = '';
  try {
    folderPath = await invoke('get_user_masks_path', { subfolder: preset });
  } catch (e) {
    console.warn('[mask-source] get_user_masks_path:', e);
    return [];
  }

  const sep = folderPath.includes('\\') ? '\\' : '/';
  return namesToUse.map(n => `${folderPath}${sep}${n}`);
}

export async function resolveMaskCount(preset) {
  const paths = await resolveMaskPaths(preset);
  return Math.max(1, paths.length);
}

export function maskPathsKey(preset, paths) {
  return `${preset}|${paths.join('|')}`;
}