// Загрузка, распознавание и применение PBR-карт
import * as THREE from 'three';

// Максимальная анизотропия, которую поддерживает GPU (кешируется)
let _maxAniso = null;
function getMaxAniso(renderer) {
  if (_maxAniso === null) {
    const r = renderer || (typeof window !== 'undefined' && window.__wearcraftRenderer);
    _maxAniso = r ? r.capabilities.getMaxAnisotropy() : 16;
  }
  return _maxAniso;
}
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { pbr, viewer, ui, settings, params, pushLog, pushToast, showProgress, setProgress, hideProgress } from './stores.svelte.js';

// ============ Детект типа карты ============
const HARD_WORDS = {
  albedo:    ['albedo', 'basecolor', 'base_color', 'diffuse', 'alb'],
  normal:    ['normalgl', 'normaldx', 'normal', 'nor', 'nrm'],
  roughness: ['roughness', 'rgh'],
  height:    ['displacement', 'height', 'disp'],
  ao:        ['occlusion'],
  orm:       ['orm', 'arm', 'mrao'],
  edge:      ['edge'],
  gloss:     ['glossiness', 'gloss', 'gls'],
};

const SOFT_WORDS = {
  metalness: ['metallic', 'metalness', 'metal', 'mtl'],
  roughness: ['rough'],
  ao:        ['ao', 'ambient', 'amb'],
  height:    ['bump'],
  albedo:    ['color', 'col', 'diff'],
};

export function detectMapType(filename) {
  const base = filename.toLowerCase().replace(/\.[^.]+$/, '');
  const parts = base.split(/[_\-\.]+/).filter(p => p.length > 0);
  const nonNumeric = parts.filter(p => !/^\d+k?$/.test(p));

  if (nonNumeric.length === 0) return null;

  // ПРИОРИТЕТ 1: HARD WORDS
  for (const word of nonNumeric) {
    for (const [kind, list] of Object.entries(HARD_WORDS)) {
      if (list.includes(word)) return kind;
    }
  }

  // ПРИОРИТЕТ 2: SOFT WORDS (последние 2 значимых слова)
  const lastTwo = nonNumeric.slice(-2);
  for (let i = lastTwo.length - 1; i >= 0; i--) {
    const word = lastTwo[i];
    for (const [kind, list] of Object.entries(SOFT_WORDS)) {
      if (list.includes(word)) return kind;
    }
  }

  return null;
}

// ============ Downsample ============
async function downsampleTexture(url, maxRes) {
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
        tex.anisotropy = getMaxAniso();
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
      tex.anisotropy = getMaxAniso();
      tex.needsUpdate = true;
      resolve(tex);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function applyTiling(tex) {
  if (!tex) return;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(pbr.repeatX, pbr.repeatY);
  tex.rotation = (pbr.rotation * Math.PI) / 180;
  tex.center.set(0.5, 0.5);
  tex.needsUpdate = true;
}

// ============ ORM ============
export async function unpackORM(url, onProgress) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        const w = img.width, h = img.height;
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const src = ctx.getImageData(0, 0, w, h).data;

        const aoData = new Uint8Array(w * h * 4);
        const roughData = new Uint8Array(w * h * 4);
        const metalData = new Uint8Array(w * h * 4);

        for (let i = 0; i < w * h; i++) {
          const r = src[i * 4 + 0], g = src[i * 4 + 1], b = src[i * 4 + 2];
          aoData[i * 4 + 0] = r; aoData[i * 4 + 1] = r; aoData[i * 4 + 2] = r; aoData[i * 4 + 3] = 255;
          roughData[i * 4 + 0] = g; roughData[i * 4 + 1] = g; roughData[i * 4 + 2] = g; roughData[i * 4 + 3] = 255;
          metalData[i * 4 + 0] = b; metalData[i * 4 + 1] = b; metalData[i * 4 + 2] = b; metalData[i * 4 + 3] = 255;
          if (i % 100000 === 0 && onProgress) onProgress(i / (w * h));
        }
        if (onProgress) onProgress(1);

        const aoTex = new THREE.DataTexture(aoData, w, h, THREE.RGBAFormat);
        const roughTex = new THREE.DataTexture(roughData, w, h, THREE.RGBAFormat);
        const metalTex = new THREE.DataTexture(metalData, w, h, THREE.RGBAFormat);
        aoTex.anisotropy = getMaxAniso();
        roughTex.anisotropy = getMaxAniso();
        metalTex.anisotropy = getMaxAniso();
        aoTex.needsUpdate = roughTex.needsUpdate = metalTex.needsUpdate = true;
        aoTex.wrapS = aoTex.wrapT = THREE.RepeatWrapping;
        roughTex.wrapS = roughTex.wrapT = THREE.RepeatWrapping;
        metalTex.wrapS = metalTex.wrapT = THREE.RepeatWrapping;

        resolve({ ao: aoTex, roughness: roughTex, metalness: metalTex });
      } catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ============ Sobel ============
export async function computeSobelFromHeight(heightUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.width, h = img.height;
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const src = ctx.getImageData(0, 0, w, h).data;
        const lum = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) lum[i] = src[i * 4] / 255;

        const out = new Uint8Array(w * h * 4);
        const gxK = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
        const gyK = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            let gx = 0, gy = 0, k = 0;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const v = lum[(y + dy) * w + (x + dx)];
                gx += v * gxK[k]; gy += v * gyK[k];
                k++;
              }
            }
            const m = Math.min(255, Math.sqrt(gx * gx + gy * gy) * 255 * 2);
            const idx = (y * w + x) * 4;
            out[idx] = m; out[idx + 1] = m; out[idx + 2] = m; out[idx + 3] = 255;
          }
        }
        const tex = new THREE.DataTexture(out, w, h, THREE.RGBAFormat);
        tex.anisotropy = getMaxAniso();
        tex.needsUpdate = true;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        resolve(tex);;
      } catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = heightUrl;
  });
}

// ============ Загрузка текстуры в слот ============
export async function loadTextureFor(kind, path, name) {
  const url = convertFileSrc(path) + '?t=' + Date.now();

  if (kind === 'orm') {
    try {
      showProgress(`Распаковка ORM: ${name}`, 0.3);
      const unpacked = await unpackORM(url, (v) => setProgress(0.3 + v * 0.6, `Распаковка ORM: ${name}`));
      pbr.textures = { ...pbr.textures, ao: unpacked.ao, roughness: unpacked.roughness, metalness: unpacked.metalness };
      pbr.paths = { ...pbr.paths, ao: path, roughness: path, metalness: path };
      pbr.active = { ...pbr.active, ao: true, roughness: true, metalness: true };
      pushLog(`[PBR] ORM распакован: ${name}`);
      pushToast('ORM распакован в AO/Rough/Metal', 'success');
    } catch (e) {
      pushLog(`[PBR] Ошибка ORM: ${e.message}`);
      pushToast(`ORM ошибка: ${e.message}`, 'error');
    }
    return;
  }

  if (kind === 'edge') {
    try {
      showProgress(`Загрузка Edge: ${name}`, 0.5);
      const tex = await downsampleTexture(url, settings.previewResolution);
      tex.anisotropy = getMaxAniso();
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      pbr.textures = { ...pbr.textures, edge: tex };
      pbr.paths = { ...pbr.paths, edge: path };
      pushLog(`[PBR] edge: ${name}`);
    } catch (e) {
      pushLog(`[PBR] Ошибка edge: ${e.message}`);
    }
    return;
  }

  try {
    showProgress(`Загрузка ${kind}: ${name}`, 0.5);
    const tex = await downsampleTexture(url, settings.previewResolution);
    tex.colorSpace = (kind === 'albedo') ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = getMaxAniso();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    pbr.textures = { ...pbr.textures, [kind]: tex };
    pbr.paths = { ...pbr.paths, [kind]: path };
    if (kind in pbr.active) pbr.active = { ...pbr.active, [kind]: true };
    pushLog(`[PBR] ${kind}: ${name}`);

    if (kind === 'height' && !pbr.textures.edge) {
      try {
        showProgress('Sobel edge...', 0.7);
        const sobelTex = await computeSobelFromHeight(url);
        pbr.textures = { ...pbr.textures, edge: sobelTex };
        pushLog('[PBR] Edge посчитан из height (Sobel)');
      } catch (e) {
        pushLog(`[PBR] Sobel ошибка: ${e.message}`);
      }
    }
  } catch (e) {
    pushLog(`[PBR] Ошибка ${kind}: ${e.message}`);
    pushToast(`${kind} ошибка: ${e.message}`, 'error');
  }
}

// ============ Массовая загрузка ============
export async function loadPBR() {
  const paths = await open({
    multiple: true,
    filters: [{ name: 'PBR textures', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  });
  if (!paths || paths.length === 0) return;

  const arr = Array.isArray(paths) ? paths : [paths];
  ui.busy = true;
  showProgress('Загрузка текстур...', 0);

  Object.values(pbr.textures).forEach((tex) => {
    if (tex && tex.dispose) {
      try { tex.dispose(); } catch (e) { /* ignore */ }
    }
  });
  pbr.textures = {};
  pbr.paths = {};
  pbr.active = {
    albedo: false, normal: false, roughness: false, metalness: false, ao: false, height: false,
  };

  ui.generated = [];
  ui.currentVariation = 0;
  ui.generationTick++;

  for (let i = 0; i < arr.length; i++) {
    const p = arr[i];
    const name = p.split(/[\\/]/).pop();
    const kind = detectMapType(name);

    if (!kind) {
      pushLog(`[PBR] ${name} — не распознано, загрузи вручную через 📁`);
      pushToast(`${name}: не распознано`, 'warn');
      continue;
    }

    setProgress(i / arr.length, `Загрузка: ${name}`);
    await loadTextureFor(kind, p, name);
  }

  // Если height есть, а edge нет — считаем Sobel
  if (pbr.textures.height && !pbr.textures.edge && pbr.paths.height) {
    try {
      setProgress(0.95, 'Sobel edge...');
      const heightUrl = convertFileSrc(pbr.paths.height) + '?t=' + Date.now();
      const sobelTex = await computeSobelFromHeight(heightUrl);
      pbr.textures = { ...pbr.textures, edge: sobelTex };
      pushLog('[PBR] Edge посчитан из height (Sobel)');
    } catch (e) {
      pushLog(`[PBR] Sobel ошибка: ${e.message}`);
    }
  }

  applyPBR();
  setProgress(1, 'Готово');
  hideProgress();
  ui.busy = false;
  pushToast(`Загружено карт: ${Object.keys(pbr.textures).length}`, 'success');
  if (params.preset === 'rust' || params.preset === 'dirt') {
    window.dispatchEvent(new CustomEvent('wearcraft:rebuild-shader'));
  }
}



// ============ Ручная загрузка ============
export async function loadMapFor(kind) {
  const paths = await open({
    multiple: false,
    filters: [{ name: 'Texture', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  });
  if (!paths) return;
  const p = Array.isArray(paths) ? paths[0] : paths;
  const name = p.split(/[\\/]/).pop();

  const detected = detectMapType(name);
  if (detected && detected !== kind && kind !== 'orm') {
    pushLog(`[PBR] Внимание: "${name}" похоже на ${detected.toUpperCase()}, но применено как ${kind.toUpperCase()}`);
    pushToast(`Файл похож на ${detected.toUpperCase()}, применён как ${kind.toUpperCase()}`, 'warn');
  }

  ui.busy = true;
  showProgress(`Загрузка ${kind}...`, 0);
  await loadTextureFor(kind, p, name);

  // Если height есть, а edge нет — считаем Sobel
  if (pbr.textures.height && !pbr.textures.edge && pbr.paths.height) {
    try {
      setProgress(0.9, 'Sobel edge...');
      const heightUrl = convertFileSrc(pbr.paths.height) + '?t=' + Date.now();
      const sobelTex = await computeSobelFromHeight(heightUrl);
      pbr.textures = { ...pbr.textures, edge: sobelTex };
      pushLog('[PBR] Edge посчитан из height (Sobel)');
    } catch (e) {
      pushLog(`[PBR] Sobel ошибка: ${e.message}`);
    }
  }

  ui.generated = [];
  ui.currentVariation = 0;
  ui.generationTick++;

  applyPBR();
  setProgress(1, 'Готово');
  hideProgress();
  ui.busy = false;
  pushToast(`${kind} загружен`, 'success');
}

// ============ Применение ============
export function applyPBR() {
  const targets = [];
  if (viewer.loadedModel) viewer.loadedModel.traverse((c) => { if (c.isMesh) targets.push(c); });
  else if (viewer.mesh) targets.push(viewer.mesh);
  if (targets.length === 0) return;

  const tex = pbr.textures;

  for (const target of targets) {
    let mat = target.material;
    if (!mat || Array.isArray(mat)) {
      mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
      target.material = mat;
    }

    // ═══ Если это ShaderMaterial (rust/dirt) — обновляем ТОЛЬКО uniforms ═══
    if (mat.uniforms && mat.uniforms.uAlbedoTex) {
      if (mat.uniforms.uAlbedoTex) {
        mat.uniforms.uAlbedoTex.value = tex.albedo || null;
        mat.uniforms.uHasAlbedo.value = !!tex.albedo;
      }
      if (mat.uniforms.uNormalTex) {
        mat.uniforms.uNormalTex.value = tex.normal || null;
        mat.uniforms.uHasNormal.value = !!tex.normal;
      }
      if (mat.uniforms.uRoughTex) {
        mat.uniforms.uRoughTex.value = tex.roughness || null;
        mat.uniforms.uHasRough.value = !!tex.roughness;
      }
      continue;
    }

    // ═══ Обычный MeshStandardMaterial ═══
    if (pbr.showEdgeMode && tex.edge) {
      mat.map = tex.edge;
      mat.color.set(0xffffff);
    } else if (pbr.active.albedo && tex.albedo) {
      mat.map = tex.albedo;
      mat.color.set(0xffffff);
    } else {
      mat.map = null;
      mat.color.set(0x9a9a9a);
    }

    mat.normalMap = (pbr.active.normal && tex.normal) ? tex.normal : null;
    if (mat.normalMap) mat.normalScale = new THREE.Vector2(1, 1);

    mat.roughnessMap = (pbr.active.roughness && tex.roughness) ? tex.roughness : null;
    mat.roughness = mat.roughnessMap ? 1.0 : 0.7;

    mat.metalnessMap = (pbr.active.metalness && tex.metalness) ? tex.metalness : null;
    mat.metalness = mat.metalnessMap ? 1.0 : 0.05;

    if (pbr.active.ao && tex.ao) {
      if (!target.geometry.attributes.uv2 && target.geometry.attributes.uv) {
        target.geometry.setAttribute('uv2', target.geometry.attributes.uv);
      }
      mat.aoMap = tex.ao;
      mat.aoMapIntensity = 1.0;
    } else {
      mat.aoMap = null;
    }

    if (pbr.active.height && tex.height) {
      mat.displacementMap = tex.height;
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
}

// ============ Очистка ============
export function clearPBR() {
  const targets = [];
  if (viewer.loadedModel) viewer.loadedModel.traverse((c) => { if (c.isMesh) targets.push(c); });
  else if (viewer.mesh) targets.push(viewer.mesh);

  for (const target of targets) {
    const mat = target.material;
    if (!mat || Array.isArray(mat)) continue;

    // ShaderMaterial — не трогаем поля, которых нет
    if (mat.uniforms && mat.uniforms.uAlbedoTex) continue;

    ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'displacementMap'].forEach((k) => {
      if (mat[k]) { mat[k].dispose(); mat[k] = null; }
    });
    mat.color.set(0x9a9a9a);
    mat.roughness = 0.7;
    mat.metalness = 0.05;
    mat.displacementScale = 0;
    mat.needsUpdate = true;
  }

  Object.values(pbr.textures).forEach((tex) => { if (tex && tex.dispose) tex.dispose(); });
  pbr.textures = {};
  pbr.paths = {};
  pbr.active = { albedo: false, normal: false, roughness: false, metalness: false, ao: false, height: false };
  pbr.showEdgeMode = false;

  ui.generated = [];
  ui.currentVariation = 0;
  ui.generationTick++;

  pushLog('[PBR] Все текстуры сброшены');
  pushToast('Текстуры сброшены', 'info');
}