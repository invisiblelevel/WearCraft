// Вызов Rust-команды генерации вариаций
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import {
  pbr, params, scratchParams, dirtParams, rustParams, streakParams, maskParams,
  decalParams,
  ui, settings, pushLog, pushToast, showProgress, setProgress, hideProgress
} from './stores.svelte.js';
import { clearVariationCache, loadVariation } from './variation-loader.js';
import { generateInstances, generateFixedInstance, instancesForRust } from './instances.js';
import { resolveMaskCount } from './mask-source.js';

function seedAngle(varSeed) {
  let s = varSeed >>> 0;
  s = (s * 1664525 + 1013904223) >>> 0;
  return ((s & 0xFFFFFF) / 16777216) * Math.PI * 2;
}

async function resolveOutputDir() {
  if (settings.saveMode === 'always' && settings.saveDir) return settings.saveDir;
  const picked = await open({ directory: true, multiple: false });
  if (!picked) return null;
  return picked;
}

async function buildInstancesPerVariation() {
  const isRust = params.preset === 'rust';
  const isDirt = params.preset === 'dirt';
  const isStreaks = params.preset === 'streaks';
  const isScratch = params.preset === 'scratches';

  if (isStreaks && streakParams.procedural) return [];
  if (isScratch && scratchParams.procedural) return [];
  if (params.preset === 'decal') return [];
  if (!isRust && !isDirt && !isStreaks && !isScratch) return [];

  const totalVariations = params.variations;

  let p;
  if (isRust) p = rustParams;
  else if (isDirt) p = dirtParams;
  else if (isStreaks) p = streakParams;
  else p = scratchParams;

  const count = p.count || 3;

  let scale;
  if (isStreaks) scale = streakParams.maskScale || 1;
  else if (isScratch) scale = scratchParams.maskScale || 1;
  else scale = p.scale || 1;

  let userMask;
  if (isRust) userMask = settings.userMaskRust;
  else if (isStreaks) userMask = settings.userMaskStreak;
  else if (isScratch) userMask = settings.userMaskScratch;
  else userMask = settings.userMaskDirt;

  const result = [];
  for (let i = 1; i <= totalVariations; i++) {
    const varSeed = (params.seed + i * 7919) >>> 0;

    let inst;
    if (userMask && i === 1) {
      const pos = isRust ? settings.userMaskRustPos
                : isStreaks ? settings.userMaskStreakPos
                : isScratch ? settings.userMaskScratchPos
                : settings.userMaskDirtPos;
      inst = [generateFixedInstance(pos)];
    } else if (userMask) {
      let useRandomRot = p.randomRotation;
      let globalRot = p.rotation * Math.PI / 180;
      if (isStreaks) {
        useRandomRot = false;
        globalRot = p.randomRotation ? seedAngle(varSeed) : p.rotation * Math.PI / 180;
      }
      inst = generateInstances(varSeed, count, scale, 1, {
        globalPosX: p.posX,
        globalPosY: p.posY,
        globalRotation: globalRot,
        randomRotation: useRandomRot,
        randomFlip: isStreaks ? false : true,
      });
    } else {
      const maskCount = await resolveMaskCount(params.preset);
      let useRandomRot = p.randomRotation;
      let globalRot = p.rotation * Math.PI / 180;
      if (isStreaks) {
        useRandomRot = false;
        globalRot = p.randomRotation ? seedAngle(varSeed) : p.rotation * Math.PI / 180;
      }
      inst = generateInstances(varSeed, count, scale, maskCount, {
        globalPosX: p.posX,
        globalPosY: p.posY,
        globalRotation: globalRot,
        randomRotation: useRandomRot,
        randomFlip: isStreaks ? false : true,
        tileable: !p.disableTiling,
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

        // Scratches
        scratchProcedural: scratchParams.procedural,
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
        scratchCount:      scratchParams.count,
        scratchMaskScale:  scratchParams.maskScale,
        scratchDeform:     scratchParams.deform,
        scratchThreshold:  scratchParams.threshold,
        scratchSharpness:  scratchParams.sharpness,
        scratchColor:      scratchParams.color,
        scratchMaskThickness: scratchParams.maskThickness,
        scratchMaskRim:    scratchParams.maskRimHighlight,
        scratchMaskNormal: scratchParams.maskNormalEnabled,
        scratchDisableTiling: scratchParams.disableTiling,
        scratchPosX:       scratchParams.posX,
        scratchPosY:       scratchParams.posY,
        scratchRotation:   scratchParams.rotation,
        scratchRandomRotation: scratchParams.randomRotation,
        userMaskScratch:   settings.userMaskScratch || null,
        folderMaskNamesScratch: settings.folderMaskNamesScratch || [],

        // Dirt
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

        // Rust
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

        // Streaks
        streakProcedural: streakParams.procedural,
        streakCount:      streakParams.count,
        streakThreshold:  streakParams.threshold,
        streakSharpness:  streakParams.sharpness,
        streakColor:      streakParams.color,
        streakThickness:  streakParams.thickness,
        streakRim:        streakParams.rimHighlight,
        streakNormal:     streakParams.normalEnabled,
        streakSize:       streakParams.size,
        streakStretch:    streakParams.stretch,
        streakWaviness:   streakParams.waviness,
        streakPosX:       streakParams.posX,
        streakPosY:       streakParams.posY,
        streakRotation:   streakParams.rotation,
        streakProcScale:  streakParams.procScale,
        streakMaskScale:  streakParams.maskScale,
        streakDeform:     streakParams.deform,
        streakDisableTiling: streakParams.disableTiling,
        userMaskStreak:   settings.userMaskStreak || null,
        folderMaskNamesStreak: settings.folderMaskNamesStreak || [],

        // Custom mask
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

        // Decal
        decalPath:            decalParams.path || null,
        decalHeightPath:      decalParams.heightPath || null,
        decalPosX:            decalParams.posX,
        decalPosY:            decalParams.posY,
        decalScale:           decalParams.scale,
        decalRotation:        decalParams.rotation,
        decalKeepAspect:      decalParams.keepAspect,
        decalOpacity:         decalParams.opacity,
        decalAffectAlbedo:    decalParams.affectAlbedo,
        decalAffectRoughness: decalParams.affectRoughness,
        decalAffectNormal:    decalParams.affectNormal,
        decalHeightIntensity: decalParams.heightIntensity,
        decalRandomPosition:  decalParams.randomPosition,
        decalRandomRotation:  decalParams.randomRotation,
        decalTileEdge:        decalParams.tileEdge,

        // Geo-normal (ограничение по геометрии)
        geoNormalPath:        ui.geoNormalReady ? ui.geoNormalPath : null,
        geoLimitEnabled:      ui.geometryLimitEnabled,
        geoLimitMode:         ui.geometryLimitMode,
        geoLimitSoftness:     ui.geometryLimitSoftness,
        geoLimitInvert:       ui.geometryLimitInvert,
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