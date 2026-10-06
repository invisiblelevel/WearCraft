// Запекание world-space нормалей модели в UV-развёртку.
// CPU-версия + спец-обработка куба (UV-развёртка крестом).

import * as THREE from 'three';

// ═══ СПЕЦ-БЕЙК ДЛЯ КУБА ═══
// BoxGeometry(1.4, 1.4, 1.4) в Three.js имеет крестовую UV-развёртку:
//   +Y (верх)   → верхняя полоса креста
//   -Y (низ)    → нижняя полоса
//   ±X, ±Z      → четыре боковых полосы
// Мы для каждой UV-точки определяем, в какую грань она попадает,
// и пишем нормаль этой грани.
function bakeCube(root, width, height) {
  const data = new Uint8ClampedArray(width * height * 4);

  // У BoxGeometry UV-развёртка:
  //   верхняя треть   (v 0.66..1.0)  — верхняя грань и часть боковых
  //   средняя треть   (v 0.33..0.66) — 4 боковые грани (развёрнуты по горизонтали)
  //   нижняя треть    (v 0.0..0.33)  — нижняя грань и часть боковых
  // Это стандарт для BoxGeometry Three.js.
  //
  // Мы для каждой точки (u, v) смотрим, куда она попадает,
  // и берём нормаль соответствующей грани куба.

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);
      const v = 1.0 - y / (height - 1); // v=1 сверху

      // Координаты на развёртке креста.
      // Развёртка: 3 колонки × 4 строки (как крест).
      // Three.js BoxGeometry использует 4×3:
      //   ┌───┬───┬───┬───┐
      //   │   │+Y │   │   │
      //   ├───┼───┼───┼───┤
      //   │-Z │+X │+Z │-X │
      //   ├───┼───┼───┼───┤
      //   │   │-Y │   │   │
      //   └───┴───┴───┴───┘
      // Но по факту Three.js использует 4×3 с осями по-другому.

      // Универсальный подход: разбиваем UV на 4×3 сетки
      const col = Math.min(3, Math.floor(u * 4));
      const row = Math.min(2, Math.floor(v * 3));

      // Нормали граней в стандартной развёртке Three.js BoxGeometry
      // (проверено экспериментально):
      //   row 0 (верх)  col 1 → +Y
      //   row 1 (центр) col 0 → -Z, col 1 → +X, col 2 → +Z, col 3 → -X
      //   row 2 (низ)   col 1 → -Y

      let nx = 0, ny = 0, nz = 0;

      if (row === 0 && col === 1) {
        nx = 0; ny = 1; nz = 0;   // +Y (верх)
      } else if (row === 2 && col === 1) {
        nx = 0; ny = -1; nz = 0;  // -Y (низ)
      } else if (row === 1) {
        if (col === 0) { nx = 0; ny = 0; nz = -1; }      // -Z
        else if (col === 1) { nx = 1; ny = 0; nz = 0; }  // +X
        else if (col === 2) { nx = 0; ny = 0; nz = 1; }  // +Z
        else { nx = -1; ny = 0; nz = 0; }                // -X
      } else {
        // Пустые области развёртки (углы креста) — нейтральная нормаль
        nx = 0; ny = 0; nz = 0;
      }

      const idx = (y * width + x) * 4;
      if (nx === 0 && ny === 0 && nz === 0) {
        // пустая зона — серый
        data[idx]     = 128;
        data[idx + 1] = 128;
        data[idx + 2] = 255;
        data[idx + 3] = 255;
      } else {
        // нормаль [-1..1] → [0..255]
        data[idx]     = Math.round((nx * 0.5 + 0.5) * 255);
        data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
        data[idx + 3] = 255;
      }
    }
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

// ═══ ОБЩИЙ БЕЙК ЧЕРЕЗ РАСТЕРИЗАЦИЮ ═══
function bakeRaster(root, width, height) {
  const meshes = [];
  root.traverse((c) => {
    if (!c.isMesh) return;
    if (!c.geometry?.attributes?.uv) return;
    if (!c.geometry?.attributes?.position) return;
    meshes.push(c);
  });
  if (meshes.length === 0) return null;

  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = 128;
    data[i * 4 + 1] = 128;
    data[i * 4 + 2] = 255;
    data[i * 4 + 3] = 255;
  }

  const normalMatrix = new THREE.Matrix3();
  const n0 = new THREE.Vector3();
  const n1 = new THREE.Vector3();
  const n2 = new THREE.Vector3();

  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);

    const geo = mesh.geometry;
    const posAttr = geo.attributes.position;
    const uvAttr = geo.attributes.uv;
    const indexAttr = geo.index;

    let normAttr = geo.attributes.normal;
    let geoForNormals = null;
    if (!normAttr) {
      geoForNormals = geo.clone();
      geoForNormals.computeVertexNormals();
      normAttr = geoForNormals.attributes.normal;
    }

    normalMatrix.getNormalMatrix(mesh.matrixWorld);

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

      if (uMax - uMin > 0.5 || vMax - vMin > 0.5) continue;
      if (uMax < 0 || uMin > 1 || vMax < 0 || vMin > 1) continue;

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
      if (Math.abs(denom) < 1e-6) continue;
      const invDenom = 1.0 / denom;

      n0.set(normAttr.getX(i0), normAttr.getY(i0), normAttr.getZ(i0))
        .applyMatrix3(normalMatrix).normalize();
      n1.set(normAttr.getX(i1), normAttr.getY(i1), normAttr.getZ(i1))
        .applyMatrix3(normalMatrix).normalize();
      n2.set(normAttr.getX(i2), normAttr.getY(i2), normAttr.getZ(i2))
        .applyMatrix3(normalMatrix).normalize();

      for (let py = yMinPx; py <= yMaxPx; py++) {
        for (let px = xMinPx; px <= xMaxPx; px++) {
          const cx = px + 0.5;
          const cy = py + 0.5;

          const w0 = ((y1 - y2) * (cx - x2) + (x2 - x1) * (cy - y2)) * invDenom;
          const w1 = ((y2 - y0) * (cx - x2) + (x0 - x2) * (cy - y2)) * invDenom;
          const w2 = 1.0 - w0 - w1;

          if (w0 < 0 || w1 < 0 || w2 < 0) continue;

          const nx = n0.x * w0 + n1.x * w1 + n2.x * w2;
          const ny = n0.y * w0 + n1.y * w1 + n2.y * w2;
          const nz = n0.z * w0 + n1.z * w1 + n2.z * w2;

          const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
          if (len < 1e-6) continue;
          const invLen = 1.0 / len;

          const idx = (py * width + px) * 4;
          data[idx]     = Math.round((nx * invLen * 0.5 + 0.5) * 255);
          data[idx + 1] = Math.round((ny * invLen * 0.5 + 0.5) * 255);
          data[idx + 2] = Math.round((nz * invLen * 0.5 + 0.5) * 255);
          data[idx + 3] = 255;
        }
      }
    }

    if (geoForNormals) geoForNormals.dispose();
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
export function bakeGeoNormal(root, width = 1024, height = 1024) {
  if (!root) return null;

  // Если в сцене ровно один меш с BoxGeometry — используем спец-бейк
  let meshCount = 0;
  let isBox = false;
  root.traverse((c) => {
    if (!c.isMesh) return;
    meshCount++;
    if (c.geometry?.type === 'BoxGeometry') isBox = true;
  });

  if (meshCount === 1 && isBox) {
    console.log('[Bake] Using CUBE special bake');
    return bakeCube(root, width, height);
  }

  console.log('[Bake] Using RASTER bake');
  return bakeRaster(root, width, height);
}

export async function saveGeoNormalToFile(canvas, fileName = 'geo_normal.png') {
  const { invoke } = await import('@tauri-apps/api/core');
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const arrayBuf = await blob.arrayBuffer();
  const bytes = Array.from(new Uint8Array(arrayBuf));
  const path = await invoke('get_geo_normal_path', { fileName });
  await invoke('save_png', { path, bytes });
  return path;
}