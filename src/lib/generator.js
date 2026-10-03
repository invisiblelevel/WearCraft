// Вызов Rust-команды генерации вариаций
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import {
  pbr, params, scratchParams, dirtParams, rustParams, maskParams,
  ui, settings, pushLog, pushToast, showProgress, setProgress, hideProgress
} from './stores.svelte.js';
import { clearVariationCache, loadVariation } from './variation-loader.js';
import { generateInstances, generateFixedInstance, instancesForRust } from './instances.js';
import { resolveMaskCount } from './mask-source.js';

async function resolveOutputDir() {
  if (settings.saveMode === 'always' && settings.saveDir) return settings.saveDir;
  const picked = await open({ directory: true, multiple: false });
  if (!picked) return null;
  return picked;
}

/**
 * Instances для всех вариаций.
 * Юзерская маска → вариация 1 = фиксированный instance, 2..N = рандом с пулом 1.
 * Библиотека → рандом с глобальными posX/posY/rotation от юзера.
 */
async function buildInstancesPerVariation() {
  const isRust = params.preset === 'rust';
  const isDirt = params.preset === 'dirt';
  if (!isRust && !isDirt) return [];

  const totalVariations = params.variations;
  const count = isRust ? (rustParams.count || 3) : (dirtParams.count || 3);
  const scale = isRust ? (rustParams.scale || 1) : (dirtParams.scale || 1);
  const p = isRust ? rustParams : dirtParams;
  const userMask = isRust ? settings.userMaskRust : settings.userMaskDirt;

  const result = [];
  for (let i = 1; i <= totalVariations; i++) {
    const varSeed = (params.seed + i * 7919) >>> 0;

    let inst;
    if (userMask && i === 1) {
      // Вариация 1 — фиксированная позиция из UI (то, что видно в превью)
      const pos = isRust ? settings.userMaskRustPos : settings.userMaskDirtPos;
      inst = [generateFixedInstance(pos)];
    } else if (userMask) {
      // Вариации 2..N — рандом, пул масок = 1 (юзерская)
      inst = generateInstances(varSeed, count, scale, 1, {
        globalPosX: p.posX,
        globalPosY: p.posY,
        globalRotation: p.rotation * Math.PI / 180,
        randomRotation: p.randomRotation,
      });
    } else {
      // Библиотека масок — рандом + глобальные posX/posY/rotation
      const maskCount = await resolveMaskCount(params.preset);
      inst = generateInstances(varSeed, count, scale, maskCount, {
        globalPosX: p.posX,
        globalPosY: p.posY,
        globalRotation: p.rotation * Math.PI / 180,
        randomRotation: p.randomRotation,
      });
    }

    result.push(instancesForRust(inst));
  }
  return result;
}

export async function generateWear() {
  if (Object.keys(pbr.textures).length === 0) {
    pushToast('Сначала загрузи PBR-карты', 'warn');
    return;
  }

  const outputDir = await resolveOutputDir();
  if (!outputDir) return;

  ui.busy = true;
  showProgress('Генерация вариаций...', 0);
  pushLog(`[Generate] Запуск: пресет=${params.preset}, ${params.variations} вариаций, seed=${params.seed}`);

  const instancesPerVariation = await buildInstancesPerVariation();

  const unlisten = await listen('wear_progress', (event) => {
    const { current, total, stage } = event.payload;
    if (total > 0) {
      let label = '';
      if (stage === 'loading') label = 'Загрузка PBR...';
      else if (stage === 'generating') label = `Вариация ${current}/${total}`;
      else if (stage === 'done') label = 'Готово';
      else label = `${current}/${total}`;
      setProgress(current / total, label);
    }
  });

  try {
    const result = await invoke('generate_wear', {
      params: {
        count: params.variations, warp: params.warp, amount: params.amount,
        seed: params.seed, preset: params.preset, outputDir,
        albedo:    pbr.paths.albedo    ?? null,
        normal:    pbr.paths.normal    ?? null,
        roughness: pbr.paths.roughness ?? null,
        ao:        pbr.paths.ao        ?? null,
        height:    pbr.paths.height    ?? null,
        metalness: pbr.paths.metalness ?? null,
        edge:      pbr.paths.edge      ?? null,

        instancesPerVariation,

        scratchDensity:    scratchParams.density,
        scratchLength:     scratchParams.length,
        scratchThickness:  scratchParams.thickness,
        scratchWaviness:   scratchParams.waviness,
        scratchBranches:   scratchParams.branches,
        scratchClusters:   scratchParams.clusters,
        scratchNormal:     scratchParams.normalEnabled,
        scratchDepth:      scratchParams.depth,
        scratchRealistic:  scratchParams.realistic,
        scratchRim:        scratchParams.rimHighlight,

        dirtCount:      dirtParams.count,
        dirtScale:      dirtParams.scale,
        dirtDeform:     dirtParams.deform,
        dirtThreshold:  dirtParams.threshold,
        dirtSharpness:  dirtParams.sharpness,
        dirtColor:      dirtParams.color,
        dirtThickness:  dirtParams.thickness,
        dirtRim:        dirtParams.rimHighlight,
        dirtNormal:     dirtParams.normalEnabled,
        userMaskDirt:   settings.userMaskDirt || null,
        folderMaskNamesDirt: settings.folderMaskNamesDirt || [],

        rustCount:      rustParams.count,
        rustScale:      rustParams.scale,
        rustDeform:     rustParams.deform,
        rustThreshold:  rustParams.threshold,
        rustSharpness:  rustParams.sharpness,
        rustVolume:     rustParams.volume,
        rustRim:        rustParams.rimHighlight,
        rustNormal:     rustParams.normalEnabled,
        userMaskRust:   settings.userMaskRust || null,
        folderMaskNamesRust: settings.folderMaskNamesRust || [],

        maskEnabled:         maskParams.enabled,
        maskPath:            maskParams.path || null,
        maskKind:            maskParams.kind,
        maskPosX:            maskParams.posX,
        maskPosY:            maskParams.posY,
        maskScale:           maskParams.scale,
        maskRotation:        maskParams.rotation,
        maskOpacity:         maskParams.opacity,
        maskColor:           maskParams.color,
        maskAffectAlbedo:    maskParams.affectAlbedo,
        maskAffectRoughness: maskParams.affectRoughness,
        maskAffectNormal:    maskParams.affectNormal,
      }
    });

    ui.generationTick++;
    clearVariationCache();
    ui.generated = result.variations;
    ui.currentVariation = 1;
    await loadVariation(1);

    pushLog(`[Generate] Готово за ${result.elapsedMs} мс`);
    pushToast(`Готово: ${result.variations.length} вариаций`, 'success');
    setProgress(1, 'Готово');
    hideProgress();
  } catch (e) {
    console.error(e);
    pushLog(`[Generate] Ошибка: ${e}`);
    pushToast(`Ошибка генерации: ${e}`, 'error');
  } finally {
    unlisten();
    ui.busy = false;
  }
}