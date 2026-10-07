// Загрузка вариаций сгенерированных PNG в Three.js-материал
import * as THREE from 'three';
import { convertFileSrc } from '@tauri-apps/api/core';
import { viewer, pbr, ui, settings, params, showProgress, hideProgress } from './stores.svelte.js';
import { applyPBR } from './pbr-loader.js';

const cache = new Map();
const MAX_CACHE_SIZE = 150;

async function downsample(url, maxRes) {
  if (maxRes === 0) {
    return await new THREE.TextureLoader().loadAsync(url);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.width, h = img.height;
      const maxSide = Math.max(w, h);
      if (maxSide <= maxRes) {
        const tex = new THREE.Texture(img);
        tex.needsUpdate = true;
        resolve(tex);
        return;
      }
      const scale = maxRes / maxSide;
      const nw = Math.round(w * scale);
      const nh = Math.round(h * scale);
      const canvas = document.createElement('canvas');
      canvas.width = nw; canvas.height = nh;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, nw, nh);
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      resolve(tex);
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function loadTexture(path, colorSpace = false) {
  const key = `${path}|${settings.previewResolution}|${ui.generationTick}`;
  if (cache.has(key)) return cache.get(key);
  const url = convertFileSrc(path) + `?t=${ui.generationTick}`;
  const tex = await downsample(url, settings.previewResolution);
  tex.colorSpace = colorSpace ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  cache.set(key, tex);

  if (cache.size > MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    const oldTex = cache.get(firstKey);
    if (oldTex && oldTex.dispose) oldTex.dispose();
    cache.delete(firstKey);
  }

  return tex;
}

function applyTiling(tex) {
  if (!tex) return;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(pbr.repeatX, pbr.repeatY);
  tex.rotation = (pbr.rotation * Math.PI) / 180;
  tex.center.set(0.5, 0.5);
  tex.needsUpdate = true;
}

// ═══ Обновление instances у ShaderMaterial для конкретной вариации ═══
async function updateShaderInstances(mat, index) {
  const { params: p, scratchParams, dirtParams, rustParams, streakParams, settings: s } = await import('./stores.svelte.js');
  const { generateInstances, generateFixedInstance } = await import('./instances.js');
  const { resolveMaskPaths } = await import('./mask-source.js');

  const preset = p.preset;

  const isRust = preset === 'rust';
  const isDirt = preset === 'dirt';
  const isStreaks = preset === 'streaks';
  const isScratch = preset === 'scratches';

  if (!isRust && !isDirt && !isStreaks && !isScratch) return;

  if (isStreaks && streakParams.procedural) return;
  if (isScratch && scratchParams.procedural) return;

  let pr;
  if (isRust) pr = rustParams;
  else if (isDirt) pr = dirtParams;
  else if (isStreaks) pr = streakParams;
  else pr = scratchParams;

  const count = Math.min(Math.round(pr.count || 3), 8);

  let scale;
  if (isStreaks) scale = streakParams.maskScale || 1;
  else if (isScratch) scale = scratchParams.maskScale || 1;
  else scale = pr.scale || 1;

  let userMask;
  if (isRust) userMask = s.userMaskRust;
  else if (isStreaks) userMask = s.userMaskStreak;
  else if (isScratch) userMask = s.userMaskScratch;
  else userMask = s.userMaskDirt;

  const varSeed = (p.seed + index * 7919) >>> 0;

  let transforms;

  if (userMask) {
    if (index === 1) {
      const pos = isRust ? s.userMaskRustPos
                : isStreaks ? s.userMaskStreakPos
                : isScratch ? s.userMaskScratchPos
                : s.userMaskDirtPos;
      transforms = [generateFixedInstance(pos)];
    } else {
      let useRandomRot = pr.randomRotation;
      let globalRot = pr.rotation * Math.PI / 180;
      if (isStreaks) {
        useRandomRot = false;
        globalRot = pr.randomRotation ? seedAngleLocal(varSeed) : pr.rotation * Math.PI / 180;
      }
      transforms = generateInstances(varSeed, count, scale, 1, {
        globalPosX: pr.posX,
        globalPosY: pr.posY,
        globalRotation: globalRot,
        randomRotation: useRandomRot,
        randomFlip: isStreaks ? false : true,
      });
    }
  } else {
    const paths = await resolveMaskPaths(preset);
    const maskCount = Math.max(1, paths.length);

    let useRandomRot = pr.randomRotation;
    let globalRot = pr.rotation * Math.PI / 180;
    if (isStreaks) {
      useRandomRot = false;
      globalRot = pr.randomRotation ? seedAngleLocal(varSeed) : pr.rotation * Math.PI / 180;
    }

    transforms = generateInstances(varSeed, count, scale, maskCount, {
      globalPosX: pr.posX,
      globalPosY: pr.posY,
      globalRotation: globalRot,
      randomRotation: useRandomRot,
      randomFlip: isStreaks ? false : true,
      tileable: !pr.disableTiling,
    });
  }

  const instanceCount = Math.min(transforms.length, 8);
  for (let i = 0; i < 8; i++) {
    const it = transforms[i] || { offsetX: 0, offsetY: 0, scale: 1, rotation: 0, flipX: 1, flipY: 1, tileable: true };
    mat.uniforms.uInstA.value[i].set(it.offsetX, it.offsetY, it.scale, it.rotation);
    mat.uniforms.uInstB.value[i].set(it.flipX, it.flipY, (it.tileable === false) ? 0.0 : 1.0, 0);
  }
  mat.uniforms.uInstanceCount.value = instanceCount;
}

// Локальная копия seedAngle (чтобы не тянуть из Preview3D)
function seedAngleLocal(varSeed) {
  let s = varSeed >>> 0;
  s = (s * 1664525 + 1013904223) >>> 0;
  return ((s & 0xFFFFFF) / 16777216) * Math.PI * 2;
}

export async function loadVariation(index) {
  if (index === 0) {
    applyPBR();
    return;
  }

  const folder = ui.generated[index - 1];
  if (!folder) return;

  showProgress(`Загрузка вариации ${index}...`, 0);

  try {
    const sep = folder.includes('\\') ? '\\' : '/';
    const p = (name) => `${folder}${sep}${name}`;

    const hasAlbedo    = !!pbr.textures.albedo;
    const hasNormal    = !!pbr.textures.normal;
    const hasRoughness = !!pbr.textures.roughness;
    const hasAo        = !!pbr.textures.ao;
    const hasHeight    = !!pbr.textures.height;
    const hasMetalness = !!pbr.textures.metalness;
    const hasEdge      = !!pbr.textures.edge;

    const [albedo, normal, roughness, ao, height, metalness, edge] = await Promise.all([
      hasAlbedo    ? loadTexture(p('albedo.png'), true).catch(() => null)    : null,
      hasNormal    ? loadTexture(p('normal.png')).catch(() => null)          : null,
      hasRoughness ? loadTexture(p('roughness.png')).catch(() => null)       : null,
      hasAo        ? loadTexture(p('ao.png')).catch(() => null)              : null,
      hasHeight    ? loadTexture(p('height.png')).catch(() => null)          : null,
      hasMetalness ? loadTexture(p('metalness.png')).catch(() => null)       : null,
      hasEdge      ? loadTexture(p('edge.png')).catch(() => null)            : null,
    ]);

    const targets = [];
    if (viewer.loadedModel) viewer.loadedModel.traverse(c => { if (c.isMesh) targets.push(c); });
    else if (viewer.mesh) targets.push(viewer.mesh);

    for (const target of targets) {
      let mat = target.material;
      if (!mat || Array.isArray(mat)) {
        mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        target.material = mat;
      }

      // ═══ ShaderMaterial (rust/dirt/streaks/scratches) — обновляем uniforms ═══
      if (mat.uniforms && mat.uniforms.uAlbedoTex) {
        if (mat.uniforms.uAlbedoTex) {
          mat.uniforms.uAlbedoTex.value = albedo;
          mat.uniforms.uHasAlbedo.value = !!albedo;
        }
        if (mat.uniforms.uNormalTex) {
          mat.uniforms.uNormalTex.value = normal;
          mat.uniforms.uHasNormal.value = !!normal;
        }
        if (mat.uniforms.uRoughTex) {
          mat.uniforms.uRoughTex.value = roughness;
          mat.uniforms.uHasRough.value = !!roughness;
        }

        // Procedural streaks — обновляем seed вариации (полный varSeed, не % 1000)
        if (mat.uniforms.uSeed && mat.uniforms.uProcedural && mat.uniforms.uProcedural.value === true) {
          const varSeed = (params.seed + index * 7919) >>> 0;
          mat.uniforms.uSeed.value = varSeed;
        }

        // Instances для не-procedural (dirt/rust/streaks-mask/scratches-mask)
        await updateShaderInstances(mat, index);

        mat.needsUpdate = true;
        continue;
      }

      if (pbr.showEdgeMode && edge) {
        mat.map = edge;
        mat.color.set(0xffffff);
      } else if (pbr.active.albedo && albedo) {
        mat.map = albedo;
        mat.color.set(0xffffff);
      } else {
        mat.map = null;
        mat.color.set(0x9a9a9a);
      }

      if (pbr.active.normal && normal) {
        mat.normalMap = normal;
        mat.normalScale = new THREE.Vector2(1, 1);
      } else {
        mat.normalMap = null;
      }

      if (pbr.active.roughness && roughness) {
        mat.roughnessMap = roughness;
        mat.roughness = 1.0;
      } else {
        mat.roughnessMap = null;
        mat.roughness = 0.7;
      }

      if (pbr.active.metalness && metalness) {
        mat.metalnessMap = metalness;
        mat.metalness = 1.0;
      } else {
        mat.metalnessMap = null;
        mat.metalness = 0.05;
      }

      if (pbr.active.ao && ao) {
        if (!target.geometry.attributes.uv2 && target.geometry.attributes.uv) {
          target.geometry.setAttribute('uv2', target.geometry.attributes.uv);
        }
        mat.aoMap = ao;
      } else {
        mat.aoMap = null;
      }

      if (pbr.active.height && height) {
        mat.displacementMap = height;
        mat.displacementScale = 0.02;
        mat.displacementBias = -0.01;
      } else {
        mat.displacementMap = null;
        mat.displacementScale = 0;
      }

      applyTiling(mat.map);
      applyTiling(mat.normalMap);
      applyTiling(mat.roughnessMap);
      applyTiling(mat.metalnessMap);
      applyTiling(mat.aoMap);
      applyTiling(mat.displacementMap);

      mat.needsUpdate = true;
    }

    hideProgress();
  } catch (e) {
    hideProgress();
  }
}

export function clearVariationCache() {
  for (const tex of cache.values()) {
    if (tex && tex.dispose) {
      try { tex.dispose(); } catch (e) { /* ignore */ }
    }
  }
  cache.clear();
}