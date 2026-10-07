// Запекание world-position модели в UV-развёртку.
// RGB = XYZ, нормированные в [0,1] по bounding box модели.
// Возвращает { canvas, bounds: {min:[x,y,z], max:[x,y,z]} }.

import * as THREE from 'three';

function computeBounds(meshes) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  const v = new THREE.Vector3();

  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);
    const pos = mesh.geometry.attributes.position;
    const m = mesh.matrixWorld;

    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m);
      if (v.x < min[0]) min[0] = v.x;
      if (v.y < min[1]) min[1] = v.y;
      if (v.z < min[2]) min[2] = v.z;
      if (v.x > max[0]) max[0] = v.x;
      if (v.y > max[1]) max[1] = v.y;
      if (v.z > max[2]) max[2] = v.z;
    }
  }

  return { min, max };
}

function bakeRasterWorldPos(root, width, height) {
  const meshes = [];
  root.traverse((c) => {
    if (!c.isMesh) return;
    if (!c.geometry?.attributes?.uv) return;
    if (!c.geometry?.attributes?.position) return;
    meshes.push(c);
  });
  if (meshes.length === 0) return null;

  const bounds = computeBounds(meshes);
  const size = [
    Math.max(bounds.max[0] - bounds.min[0], 1e-6),
    Math.max(bounds.max[1] - bounds.min[1], 1e-6),
    Math.max(bounds.max[2] - bounds.min[2], 1e-6),
  ];

  // Чёрный фон (world-position = 0,0,0)
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4 + 3] = 255;
  }

  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();

  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);

    const geo = mesh.geometry;
    const posAttr = geo.attributes.position;
    const uvAttr = geo.attributes.uv;
    const indexAttr = geo.index;
    const m = mesh.matrixWorld;

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

      const u0 = uvAttr.getX(i0), v0uv = uvAttr.getY(i0);
      const u1 = uvAttr.getX(i1), v1uv = uvAttr.getY(i1);
      const u2 = uvAttr.getX(i2), v2uv = uvAttr.getY(i2);

      const uMin = Math.min(u0, u1, u2);
      const uMax = Math.max(u0, u1, u2);
      const vMin = Math.min(v0uv, v1uv, v2uv);
      const vMax = Math.max(v0uv, v1uv, v2uv);

      // Отсекаем огромные (битые UV) и полностью вне [0,1]
      if (uMax - uMin > 0.9 || vMax - vMin > 0.9) continue;
      if (uMax < 0 || uMin > 1 || vMax < 0 || vMin > 1) continue;

      // Y-flip как в geo-normal-bake
      const x0 = u0 * (width - 1);
      const x1 = u1 * (width - 1);
      const x2 = u2 * (width - 1);
      const y0 = (1 - v0uv) * (height - 1);
      const y1 = (1 - v1uv) * (height - 1);
      const y2 = (1 - v2uv) * (height - 1);

      const xMinPx = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
      const xMaxPx = Math.min(width - 1, Math.ceil(Math.max(x0, x1, x2)));
      const yMinPx = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
      const yMaxPx = Math.min(height - 1, Math.ceil(Math.max(y0, y1, y2)));

      if (xMinPx > xMaxPx || yMinPx > yMaxPx) continue;

      const denom = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
      if (Math.abs(denom) < 1e-9) continue;
      const invDenom = 1.0 / denom;

      // World-position вершин
      v0.set(posAttr.getX(i0), posAttr.getY(i0), posAttr.getZ(i0)).applyMatrix4(m);
      v1.set(posAttr.getX(i1), posAttr.getY(i1), posAttr.getZ(i1)).applyMatrix4(m);
      v2.set(posAttr.getX(i2), posAttr.getY(i2), posAttr.getZ(i2)).applyMatrix4(m);

      for (let py = yMinPx; py <= yMaxPx; py++) {
        for (let px = xMinPx; px <= xMaxPx; px++) {
          const cx = px + 0.5;
          const cy = py + 0.5;

          const w0 = ((y1 - y2) * (cx - x2) + (x2 - x1) * (cy - y2)) * invDenom;
          const w1 = ((y2 - y0) * (cx - x2) + (x0 - x2) * (cy - y2)) * invDenom;
          const w2 = 1.0 - w0 - w1;

          if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;

          // Интерполированная world-position
          const wx = v0.x * w0 + v1.x * w1 + v2.x * w2;
          const wy = v0.y * w0 + v1.y * w1 + v2.y * w2;
          const wz = v0.z * w0 + v1.z * w1 + v2.z * w2;

          // Нормализация в [0,1] по bounding box
          const nx = (wx - bounds.min[0]) / size[0];
          const ny = (wy - bounds.min[1]) / size[1];
          const nz = (wz - bounds.min[2]) / size[2];

          const idx = (py * width + px) * 4;
          data[idx]     = Math.round(nx * 255);
          data[idx + 1] = Math.round(ny * 255);
          data[idx + 2] = Math.round(nz * 255);
          data[idx + 3] = 255;
        }
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

  return { canvas, bounds };
}

// ═══ ПУБЛИЧНАЯ ФУНКЦИЯ ═══
export function bakeWorldPos(root, width = 1024, height = 1024) {
  if (!root) return null;
  return bakeRasterWorldPos(root, width, height);
}

// Сохранение PNG в tmp/ — использует ту же команду, что и geo_normal.
export async function saveWorldPosToFile(canvas, fileName = 'world_pos.png') {
  const { invoke } = await import('@tauri-apps/api/core');
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const arrayBuf = await blob.arrayBuffer();
  const bytes = Array.from(new Uint8Array(arrayBuf));
  const path = await invoke('get_geo_normal_path', { fileName });
  await invoke('save_png', { path, bytes });
  return path;
}