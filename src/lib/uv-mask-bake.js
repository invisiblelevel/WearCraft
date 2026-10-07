// Запекание UV-маски модели в UV-развёртку.
// Белым — где есть UV (треугольники покрывают пиксель),
// чёрным — где UV нет (пустые зоны развёртки).
// Плавное затухание на границах UV-островов через supersampling.

import * as THREE from 'three';

// ═══ РАСТЕРИЗАТОР ═══
// Для каждого пикселя считаем, сколько UV-треугольников его покрывают.
// Если покрытий ≥ 1 — пиксель белый.
// Если 0 — чёрный.
// На границах — антиалиасинг через 4 sub-sample'а на пиксель.

function bakeRasterUvMask(root, width, height) {
  const meshes = [];
  root.traverse((c) => {
    if (!c.isMesh) return;
    if (!c.geometry?.attributes?.uv) return;
    if (!c.geometry?.attributes?.position) return;
    meshes.push(c);
  });
  if (meshes.length === 0) return null;

  // Массив покрытий: float 0..N (сколько sub-sample'ов покрыто).
  // Всего 4 sub-sample на пиксель.
  const SUB = 2; // 2×2 = 4 sub-sample
  const SUB_TOTAL = SUB * SUB;
  const coverage = new Float32Array(width * height);

  for (const mesh of meshes) {
    const geo = mesh.geometry;
    const uvAttr = geo.attributes.uv;
    const posAttr = geo.attributes.position;
    const indexAttr = geo.index;

    const triCount = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;

    for (let t = 0; t < triCount; t++) {
      let i0, i1, i2;
      if (indexAttr) {
        i0 = indexAttr.getX(t * 3);
        i1 = indexAttr.getX(t * 3 + 1);
        i2 = indexAttr.getX(t * 3 + 2);
      } else {
        i0 = t * 3;
        i1 = t * 3 + 1;
        i2 = t * 3 + 2;
      }

      const u0 = uvAttr.getX(i0);
      const v0 = uvAttr.getY(i0);
      const u1 = uvAttr.getX(i1);
      const v1 = uvAttr.getY(i1);
      const u2 = uvAttr.getX(i2);
      const v2 = uvAttr.getY(i2);

      const uMin = Math.min(u0, u1, u2);
      const uMax = Math.max(u0, u1, u2);
      const vMin = Math.min(v0, v1, v2);
      const vMax = Math.max(v0, v1, v2);

      // Отсекаем огромные треугольники (битые UV) и полностью вне [0,1]
      if (uMax - uMin > 0.9 || vMax - vMin > 0.9) continue;
      if (uMax < 0 || uMin > 1 || vMax < 0 || vMin > 1) continue;

      // Y-flip как в bakeRaster: (1 - v) * (height - 1)
      const x0 = u0 * (width - 1);
      const x1 = u1 * (width - 1);
      const x2 = u2 * (width - 1);
      const y0 = (1 - v0) * (height - 1);
      const y1 = (1 - v1) * (height - 1);
      const y2 = (1 - v2) * (height - 1);

      const xMinPx = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
      const xMaxPx = Math.min(width - 1, Math.ceil(Math.max(x0, x1, x2)));
      const yMinPx = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
      const yMaxPx = Math.min(height - 1, Math.ceil(Math.max(y0, y1, y2)));

      if (xMinPx > xMaxPx || yMinPx > yMaxPx) continue;

      const denom = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
      if (Math.abs(denom) < 1e-9) continue;
      const invDenom = 1.0 / denom;

      for (let py = yMinPx; py <= yMaxPx; py++) {
        for (let px = xMinPx; px <= xMaxPx; px++) {
          let hits = 0;

          // 4 sub-sample внутри пикселя
          for (let sy = 0; sy < SUB; sy++) {
            for (let sx = 0; sx < SUB; sx++) {
              const cx = px + (sx + 0.5) / SUB;
              const cy = py + (sy + 0.5) / SUB;

              const w0 = ((y1 - y2) * (cx - x2) + (x2 - x1) * (cy - y2)) * invDenom;
              const w1 = ((y2 - y0) * (cx - x2) + (x0 - x2) * (cy - y2)) * invDenom;
              const w2 = 1.0 - w0 - w1;

              if (w0 >= -1e-6 && w1 >= -1e-6 && w2 >= -1e-6) hits++;
            }
          }

          if (hits > 0) {
            const idx = py * width + px;
            coverage[idx] = Math.min(coverage[idx] + hits / SUB_TOTAL, 1.0);
          }
        }
      }
    }
  }

  // Пишем в RGBA: R=G=B=coverage*255, A=255
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const v = Math.round(coverage[i] * 255);
    data[i * 4]     = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  imgData.data.set(data);
  ctx.putImageData(imgData, 0, 0);
  return { canvas };
}

// ═══ ПУБЛИЧНАЯ ФУНКЦИЯ ═══
export function bakeUvMask(root, width = 1024, height = 1024) {
  if (!root) return null;
  return bakeRasterUvMask(root, width, height);
}

// Сохранение в tmp/ через команду get_geo_normal_path (тот же путь, другое имя файла).
export async function saveUvMaskToFile(canvas, fileName = 'uv_mask.png') {
  const { invoke } = await import('@tauri-apps/api/core');
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const arrayBuf = await blob.arrayBuffer();
  const bytes = Array.from(new Uint8Array(arrayBuf));
  const path = await invoke('get_geo_normal_path', { fileName });
  await invoke('save_png', { path, bytes });
  return path;
}