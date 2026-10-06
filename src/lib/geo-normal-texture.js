// Загрузка PNG geo-normal с диска в Three.js-текстуру для превью.
import * as THREE from 'three';
import { readFile } from '@tauri-apps/plugin-fs';

let cachedTexture = null;
let cachedPath = '';

export async function loadGeoNormalTexture(path) {
	console.log('[GeoNormalTexture] CALLED with path:', path);
  if (!path) {
    if (cachedTexture) {
      cachedTexture.dispose();
      cachedTexture = null;
      cachedPath = '';
    }
    return null;
  }

  if (cachedTexture && cachedPath === path) {
    return cachedTexture;
  }

  if (cachedTexture) {
    cachedTexture.dispose();
    cachedTexture = null;
  }

  try {
    const bytes = await readFile(path);
	console.log('[GeoNormalTexture] bytes read:', bytes?.length);
    const blob = new Blob([bytes], { type: 'image/png' });
    const url = URL.createObjectURL(blob);

    const texture = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const tex = new THREE.Texture(img);
        tex.flipY = false;
        tex.colorSpace = THREE.NoColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.needsUpdate = true;
        resolve(tex);
      };
      img.onerror = reject;
      img.src = url;
    });

    URL.revokeObjectURL(url);

    cachedTexture = texture;
    cachedPath = path;
    return texture;
  } catch (e) {
    console.error('[GeoNormalTexture] Ошибка загрузки:', e);
    console.error('[GeoNormalTexture] Path:', path);
    console.error('[GeoNormalTexture] Stack:', e?.stack);
    return null;
  }
}

export function clearGeoNormalTexture() {
  if (cachedTexture) {
    cachedTexture.dispose();
    cachedTexture = null;
    cachedPath = '';
  }
}