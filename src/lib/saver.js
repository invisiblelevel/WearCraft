// Сохранение PBR-сета, ZIP, OBJ и экспорт для движков
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { pbr, viewer, ui, settings, pushLog, pushToast } from './stores.svelte.js';

const MAP_ORDER = ['albedo', 'normal', 'roughness', 'ao', 'height', 'metalness', 'edge'];

// ============ Хелперы: текстура → PNG байты ============
async function dataTextureToPngBytes(texture) {
  const data = texture.image?.data;
  const w = texture.image?.width;
  const h = texture.image?.height;
  if (!data || !w || !h) throw new Error('DataTexture без data');

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(w, h);
  imgData.data.set(data);
  ctx.putImageData(imgData, 0, 0);

  return await new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      const buf = await blob.arrayBuffer();
      resolve(new Uint8Array(buf));
    }, 'image/png');
  });
}

async function textureToPngBytes(texture) {
  const image = texture.image;
  if (!image) throw new Error('текстура без image');

  const w = image.width;
  const h = image.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);

  return await new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      const buf = await blob.arrayBuffer();
      resolve(new Uint8Array(buf));
    }, 'image/png');
  });
}

async function anyTextureToPngBytes(texture) {
  if (texture.isDataTexture) return await dataTextureToPngBytes(texture);
  return await textureToPngBytes(texture);
}

async function collectMapBytes(onProgress) {
  const result = {};
  const toSave = MAP_ORDER.filter((k) => pbr.textures[k]);
  let i = 0;

  for (const kind of toSave) {
    if (onProgress) onProgress(i / toSave.length, kind);
    try {
      result[kind] = await anyTextureToPngBytes(pbr.textures[kind]);
      pushLog(`[Save] ${kind} → PNG (${(result[kind].length / 1024).toFixed(1)} KB)`);
    } catch (e) {
      pushLog(`[Save] Ошибка ${kind}: ${e.message}`);
      pushToast(`${kind}: ${e.message}`, 'error');
    }
    i++;
  }
  if (onProgress) onProgress(1, 'done');
  return result;
}

async function resolveOutputDir() {
  if (settings.saveMode === 'always' && settings.saveDir) {
    return settings.saveDir;
  }
  const picked = await open({ directory: true, multiple: false });
  if (!picked) return null;
  return picked;
}

// ============ Хелперы для движков ============
async function getTextureRGBA(texture) {
  if (!texture) return null;

  if (texture.isDataTexture) {
    const data = texture.image?.data;
    const w = texture.image?.width;
    const h = texture.image?.height;
    if (!data || !w || !h) return null;
    const len = data.length;
    const expectedRGBA = w * h * 4;
    const expectedRGB = w * h * 3;
    let rgba;
    if (len === expectedRGBA) {
      rgba = new Uint8ClampedArray(data);
    } else if (len === expectedRGB) {
      rgba = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < w * h; i++) {
        rgba[i * 4] = data[i * 3];
        rgba[i * 4 + 1] = data[i * 3 + 1];
        rgba[i * 4 + 2] = data[i * 3 + 2];
        rgba[i * 4 + 3] = 255;
      }
    } else {
      rgba = new Uint8ClampedArray(data);
    }
    return { data: rgba, width: w, height: h };
  }

  const image = texture.image;
  if (!image) return null;
  const w = image.width;
  const h = image.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const imgData = ctx.getImageData(0, 0, w, h);
  return { data: new Uint8ClampedArray(imgData.data), width: w, height: h };
}

async function rgbaToPngBytes(data, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imgData = new ImageData(new Uint8ClampedArray(data), width, height);
  ctx.putImageData(imgData, 0, 0);
  return await new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      const buf = await blob.arrayBuffer();
      resolve(new Uint8Array(buf));
    }, 'image/png');
  });
}

function flipNormalGreen(rgba) {
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i + 1] = 255 - rgba[i + 1];
  }
}

// ============ Save PBR PNG ============
export async function savePBR() {
  const mapKeys = MAP_ORDER.filter((k) => pbr.textures[k]);
  if (mapKeys.length === 0) {
    pushToast('Нет загруженных карт для сохранения', 'warn');
    return;
  }

  const outputDir = await resolveOutputDir();
  if (!outputDir) return;

  ui.busy = true;
  ui.saveProgress = { visible: true, value: 0, label: 'Подготовка...' };

  try {
    const mapBytes = await collectMapBytes((v, kind) => {
      ui.saveProgress = { visible: true, value: v * 0.6, label: `Кодирование: ${kind}` };
    });

    const entries = Object.entries(mapBytes);
    for (let i = 0; i < entries.length; i++) {
      const [kind, bytes] = entries[i];
      const path = `${outputDir}/source/${kind}.png`;
      ui.saveProgress = { visible: true, value: 0.6 + (i / entries.length) * 0.4, label: `Запись: ${kind}.png` };
      await invoke('save_png', { path, bytes: Array.from(bytes) });
    }

    pushLog(`[Save] PBR: ${outputDir}/source/`);
    pushToast(`Сохранено: ${entries.length} карт`, 'success');

    ui.saveProgress = { visible: true, value: 1, label: 'Готово' };
    setTimeout(() => {
      ui.saveProgress = { visible: false, value: 0, label: '' };
      ui.saveOpen = false;
    }, 400);
  } catch (e) {
    console.error(e);
    pushLog(`[Save] Ошибка: ${e}`);
    pushToast(`Ошибка сохранения: ${e}`, 'error');
    ui.saveProgress = { visible: false, value: 0, label: '' };
  } finally {
    ui.busy = false;
  }
}

// ============ Save ZIP ============
export async function saveZIP() {
  const mapKeys = MAP_ORDER.filter((k) => pbr.textures[k]);
  if (mapKeys.length === 0) {
    pushToast('Нет загруженных карт для сохранения', 'warn');
    return;
  }

  const outputDir = await resolveOutputDir();
  if (!outputDir) return;

  ui.busy = true;
  ui.saveProgress = { visible: true, value: 0, label: 'Подготовка ZIP...' };

  try {
    const mapBytes = {};
    const total = mapKeys.length;
    for (let i = 0; i < total; i++) {
      const kind = mapKeys[i];
      ui.saveProgress = { visible: true, value: (i / total) * 0.5, label: `Кодирование: ${kind}` };
      try {
        mapBytes[kind] = await anyTextureToPngBytes(pbr.textures[kind]);
      } catch (e) {
        pushLog(`[Save ZIP] ${kind}: ${e.message}`);
      }
    }

    ui.saveProgress = { visible: true, value: 0.55, label: 'Сериализация данных...' };
    const files = Object.entries(mapBytes).map(([kind, bytes]) => ({
      name: `source/${kind}.png`,
      bytes: Array.from(bytes),
    }));

    ui.saveProgress = { visible: true, value: 0.7, label: 'Упаковка ZIP (Rust)...' };
    const zipPath = `${outputDir}/wearcraft_pbr.zip`;
    await invoke('save_zip', { zipPath, files });

    pushLog(`[Save] ZIP: ${zipPath}`);
    pushToast(`Сохранено в ZIP`, 'success');

    ui.saveProgress = { visible: true, value: 1, label: 'Готово' };
    setTimeout(() => {
      ui.saveProgress = { visible: false, value: 0, label: '' };
      ui.saveOpen = false;
    }, 400);
  } catch (e) {
    console.error(e);
    pushLog(`[Save ZIP] Ошибка: ${e}`);
    pushToast(`Ошибка: ${e}`, 'error');
    ui.saveProgress = { visible: false, value: 0, label: '' };
  } finally {
    ui.busy = false;
  }
}

// ============ Save OBJ ============
export async function saveOBJ() {
  const targetObject = viewer.loadedModel || viewer.mesh;
  if (!targetObject) {
    pushToast('Нет объекта для экспорта', 'warn');
    return;
  }

  const outputDir = await resolveOutputDir();
  if (!outputDir) return;

  ui.busy = true;
  ui.saveProgress = { visible: true, value: 0, label: 'Экспорт OBJ...' };

  try {
    const exporter = new OBJExporter();
    ui.saveProgress = { visible: true, value: 0.15, label: 'Генерация геометрии...' };
    const objString = exporter.parse(targetObject);

    const mapKeys = MAP_ORDER.filter((k) => pbr.textures[k]);
    const textures = {};

    for (let i = 0; i < mapKeys.length; i++) {
      const kind = mapKeys[i];
      ui.saveProgress = { visible: true, value: 0.2 + (i / mapKeys.length) * 0.5, label: `Текстура: ${kind}` };
      try {
        textures[kind] = await anyTextureToPngBytes(pbr.textures[kind]);
      } catch (e) {
        pushLog(`[Save OBJ] ${kind} не сохранена: ${e.message}`);
      }
    }

    const mtl = buildMTL('material_0', textures);

    ui.saveProgress = { visible: true, value: 0.75, label: 'Запись OBJ...' };
    await invoke('save_text', {
      path: `${outputDir}/model.obj`,
      content: objString,
    });

    ui.saveProgress = { visible: true, value: 0.82, label: 'Запись MTL...' };
    await invoke('save_text', {
      path: `${outputDir}/model.mtl`,
      content: mtl,
    });

    const texEntries = Object.entries(textures);
    for (let i = 0; i < texEntries.length; i++) {
      const [kind, bytes] = texEntries[i];
      ui.saveProgress = { visible: true, value: 0.85 + (i / texEntries.length) * 0.15, label: `Запись: ${kind}.png` };
      await invoke('save_png', {
        path: `${outputDir}/${kind}.png`,
        bytes: Array.from(bytes),
      });
    }

    pushLog(`[Save OBJ] ${outputDir}/model.obj`);
    pushToast('OBJ + текстуры сохранены', 'success');

    ui.saveProgress = { visible: true, value: 1, label: 'Готово' };
    setTimeout(() => {
      ui.saveProgress = { visible: false, value: 0, label: '' };
      ui.saveOpen = false;
    }, 400);
  } catch (e) {
    console.error(e);
    pushLog(`[Save OBJ] Ошибка: ${e}`);
    pushToast(`Ошибка OBJ: ${e}`, 'error');
    ui.saveProgress = { visible: false, value: 0, label: '' };
  } finally {
    ui.busy = false;
  }
}

// ============ SAVE FOR UNREAL ============
export async function saveForUnreal() {
  const outputDir = await resolveOutputDir();
  if (!outputDir) return;

  const subDir = `${outputDir}/unreal`;
  ui.busy = true;
  ui.saveProgress = { visible: true, value: 0, label: 'Unreal: подготовка...' };

  try {
    if (pbr.textures.albedo) {
      ui.saveProgress = { visible: true, value: 0.1, label: 'Unreal: albedo' };
      const bytes = await anyTextureToPngBytes(pbr.textures.albedo);
      await invoke('save_png', { path: `${subDir}/albedo.png`, bytes: Array.from(bytes) });
    }

    if (pbr.textures.normal) {
      ui.saveProgress = { visible: true, value: 0.25, label: 'Unreal: normal (Y-flip)' };
      const rgba = await getTextureRGBA(pbr.textures.normal);
      if (rgba) {
        flipNormalGreen(rgba.data);
        const bytes = await rgbaToPngBytes(rgba.data, rgba.width, rgba.height);
        await invoke('save_png', { path: `${subDir}/normal.png`, bytes: Array.from(bytes) });
      }
    }

    if (pbr.textures.ao || pbr.textures.roughness || pbr.textures.metalness) {
      ui.saveProgress = { visible: true, value: 0.45, label: 'Unreal: ORM' };

      const ao = pbr.textures.ao ? await getTextureRGBA(pbr.textures.ao) : null;
      const rough = pbr.textures.roughness ? await getTextureRGBA(pbr.textures.roughness) : null;
      const metal = pbr.textures.metalness ? await getTextureRGBA(pbr.textures.metalness) : null;

      const w = ao?.width || rough?.width || metal?.width;
      const h = ao?.height || rough?.height || metal?.height;

      if (w && h) {
        const orm = new Uint8ClampedArray(w * h * 4);
        for (let i = 0; i < w * h; i++) {
          orm[i * 4]     = ao    ? ao.data[i * 4]     : 255;
          orm[i * 4 + 1] = rough ? rough.data[i * 4]  : 128;
          orm[i * 4 + 2] = metal ? metal.data[i * 4]  : 0;
          orm[i * 4 + 3] = 255;
        }
        const bytes = await rgbaToPngBytes(orm, w, h);
        await invoke('save_png', { path: `${subDir}/ORM.png`, bytes: Array.from(bytes) });
      }
    }

    if (pbr.textures.height) {
      ui.saveProgress = { visible: true, value: 0.7, label: 'Unreal: height' };
      const bytes = await anyTextureToPngBytes(pbr.textures.height);
      await invoke('save_png', { path: `${subDir}/height.png`, bytes: Array.from(bytes) });
    }

    ui.saveProgress = { visible: true, value: 0.85, label: 'Unreal: README' };
    const readme = `Unreal Engine PBR Set
========================
Generated by WearCraft

Files:
- albedo.png          — base color (sRGB)
- normal.png          — normal map (DX convention, Y flipped)
- ORM.png             — R=AO, G=Roughness, B=Metalness (linear)
- height.png          — height / displacement (linear)

Import settings in Unreal:
- albedo: sRGB = true
- normal: Normal Map = true, Flip Green Channel = false (already flipped)
- ORM: sRGB = false (linear)
- height: sRGB = false (linear)
`;
    await invoke('save_text', { path: `${subDir}/README.txt`, content: readme });

    pushLog(`[Save] Unreal → ${subDir}`);
    pushToast('Сохранено для Unreal', 'success');

    ui.saveProgress = { visible: true, value: 1, label: 'Готово' };
    setTimeout(() => {
      ui.saveProgress = { visible: false, value: 0, label: '' };
      ui.saveOpen = false;
    }, 600);
  } catch (e) {
    console.error(e);
    pushLog(`[Save Unreal] Ошибка: ${e}`);
    pushToast(`Ошибка: ${e}`, 'error');
    ui.saveProgress = { visible: false, value: 0, label: '' };
  } finally {
    ui.busy = false;
  }
}

// ============ SAVE FOR UNITY ============
export async function saveForUnity(pipeline = 'builtin') {
  const outputDir = await resolveOutputDir();
  if (!outputDir) return;

  const subDir = `${outputDir}/unity`;
  const isURP = pipeline === 'urp';

  ui.busy = true;
  ui.saveProgress = { visible: true, value: 0, label: `Unity (${isURP ? 'URP' : 'Built-in'}): подготовка...` };

  try {
    if (pbr.textures.albedo) {
      ui.saveProgress = { visible: true, value: 0.1, label: 'Unity: albedo' };
      const bytes = await anyTextureToPngBytes(pbr.textures.albedo);
      await invoke('save_png', { path: `${subDir}/albedo.png`, bytes: Array.from(bytes) });
    }

    if (pbr.textures.normal) {
      ui.saveProgress = { visible: true, value: 0.3, label: 'Unity: normal (Y-flip)' };
      const rgba = await getTextureRGBA(pbr.textures.normal);
      if (rgba) {
        flipNormalGreen(rgba.data);
        const bytes = await rgbaToPngBytes(rgba.data, rgba.width, rgba.height);
        await invoke('save_png', { path: `${subDir}/normal.png`, bytes: Array.from(bytes) });
      }
    }

    if (pbr.textures.metalness || pbr.textures.roughness) {
      ui.saveProgress = { visible: true, value: 0.5, label: 'Unity: MetallicSmoothness' };

      const metal = pbr.textures.metalness ? await getTextureRGBA(pbr.textures.metalness) : null;
      const rough = pbr.textures.roughness ? await getTextureRGBA(pbr.textures.roughness) : null;
      const ao = (!isURP && pbr.textures.ao) ? await getTextureRGBA(pbr.textures.ao) : null;

      const w = metal?.width || rough?.width || ao?.width;
      const h = metal?.height || rough?.height || ao?.height;

      if (w && h) {
        const ms = new Uint8ClampedArray(w * h * 4);
        for (let i = 0; i < w * h; i++) {
          const m = metal ? metal.data[i * 4] : 0;
          const r = rough ? rough.data[i * 4] : 128;
          const smoothness = 255 - r;
          ms[i * 4]     = m;
          ms[i * 4 + 1] = ao ? ao.data[i * 4] : 255;
          ms[i * 4 + 2] = 0;
          ms[i * 4 + 3] = smoothness;
        }
        const bytes = await rgbaToPngBytes(ms, w, h);
        await invoke('save_png', { path: `${subDir}/MetallicSmoothness.png`, bytes: Array.from(bytes) });
      }
    }

    if (isURP && pbr.textures.ao) {
      ui.saveProgress = { visible: true, value: 0.7, label: 'Unity URP: AO (отдельно)' };
      const bytes = await anyTextureToPngBytes(pbr.textures.ao);
      await invoke('save_png', { path: `${subDir}/AO.png`, bytes: Array.from(bytes) });
    }

    if (pbr.textures.height) {
      ui.saveProgress = { visible: true, value: 0.8, label: 'Unity: height' };
      const bytes = await anyTextureToPngBytes(pbr.textures.height);
      await invoke('save_png', { path: `${subDir}/height.png`, bytes: Array.from(bytes) });
    }

    ui.saveProgress = { visible: true, value: 0.9, label: 'Unity: README' };
    const readme = isURP
      ? `Unity URP PBR Set
========================
Generated by WearCraft

Files:
- albedo.png                — base color (sRGB)
- normal.png                — normal map (DX convention, Y flipped)
- MetallicSmoothness.png    — R=Metallic, A=Smoothness (linear)
- AO.png                    — ambient occlusion (linear, отдельная карта)
- height.png                — height (linear)

Import settings (URP Lit):
- albedo: sRGB = true
- normal: Normal Map = true, Flip Green Channel = false (already flipped)
- MetallicSmoothness: sRGB = false, Map: R=Metallic, A=Smoothness
- AO: sRGB = false, отдельный слот Occlusion
`
      : `Unity Built-in Standard PBR Set
========================
Generated by WearCraft

Files:
- albedo.png                — base color (sRGB)
- normal.png                — normal map (DX convention, Y flipped)
- MetallicSmoothness.png    — R=Metallic, G=AO, A=Smoothness (linear)
- height.png                — height (linear)

Import settings (Built-in Standard Shader):
- albedo: sRGB = true
- normal: Normal Map = true, Flip Green Channel = false (already flipped)
- MetallicSmoothness: sRGB = false, Map: R=Metallic, A=Smoothness, G=Occlusion
`;
    await invoke('save_text', { path: `${subDir}/README.txt`, content: readme });

    pushLog(`[Save] Unity (${isURP ? 'URP' : 'Built-in'}) → ${subDir}`);
    pushToast(`Сохранено для Unity (${isURP ? 'URP' : 'Built-in'})`, 'success');

    ui.saveProgress = { visible: true, value: 1, label: 'Готово' };
    setTimeout(() => {
      ui.saveProgress = { visible: false, value: 0, label: '' };
      ui.saveOpen = false;
    }, 600);
  } catch (e) {
    console.error(e);
    pushLog(`[Save Unity] Ошибка: ${e}`);
    pushToast(`Ошибка: ${e}`, 'error');
    ui.saveProgress = { visible: false, value: 0, label: '' };
  } finally {
    ui.busy = false;
  }
}

// ============ MTL генератор ============
function buildMTL(materialName, textures) {
  const lines = [];
  lines.push(`newmtl ${materialName}`);
  lines.push('Ka 1.000 1.000 1.000');
  lines.push('Kd 1.000 1.000 1.000');
  lines.push('Ks 0.000 0.000 0.000');
  lines.push('Ns 10.0');
  lines.push('d 1.0');
  lines.push('illum 2');

  if (textures.albedo)    lines.push(`map_Kd albedo.png`);
  if (textures.roughness) lines.push(`map_Ns roughness.png`);
  if (textures.normal)    lines.push(`bump normal.png`);

  return lines.join('\n') + '\n';
}