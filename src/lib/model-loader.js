// Загрузка FBX/OBJ моделей
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { viewer, pbr, ui, pushLog, pushToast, showProgress, setProgress, hideProgress } from './stores.svelte.js';

// Ссылка на сцену — устанавливается извне (three-setup.js)
let sceneRef = null;
export function setScene(s) { sceneRef = s; }

// Ссылка на callback применения PBR — чтобы не тащить applyPBR сюда
let applyPBRCallback = null;
export function setApplyPBRCallback(fn) { applyPBRCallback = fn; }

export async function loadModel() {
  const filePath = await open({
    multiple: false,
    filters: [{ name: '3D Model', extensions: ['fbx', 'obj'] }]
  });
  if (!filePath) return;

  const assetUrl = convertFileSrc(filePath);
  const ext = filePath.split('.').pop().toLowerCase();
  const loader = ext === 'fbx' ? new FBXLoader() : new OBJLoader();

  ui.busy = true;
  showProgress(`Загрузка модели: ${filePath.split(/[\\/]/).pop()}`, 0);
  pushLog(`Loading: ${filePath.split(/[\\/]/).pop()}...`);

  loader.load(
    assetUrl,
    (object) => {
      // Удаляем старую модель
      if (viewer.loadedModel) {
        sceneRef.remove(viewer.loadedModel);
        disposeObject(viewer.loadedModel);
        viewer.loadedModel = null;
      }
      // Удаляем примитив
      if (viewer.mesh) {
        sceneRef.remove(viewer.mesh);
        viewer.mesh.geometry.dispose();
        viewer.mesh.material.dispose();
        viewer.mesh = null;
      }

      // Заменяем материалы на чистые
      object.traverse((child) => {
        if (child.isMesh) {
          if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
            else child.material.dispose();
          }
          child.material = new THREE.MeshStandardMaterial({
            color: 0x9a9a9a,
            roughness: 0.7,
            metalness: 0.05,
            side: THREE.DoubleSide,
          });
          child.userData.isModelMesh = true;
        }
      });

      object.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      if (!isFinite(maxDim) || maxDim <= 0) {
        pushLog('Ошибка: пустая геометрия');
        pushToast('Пустая геометрия', 'error');
        ui.busy = false;
        hideProgress();
        return;
      }

      const wrapper = new THREE.Group();
      object.position.set(-center.x, -center.y, -center.z);
      wrapper.add(object);
      wrapper.scale.setScalar(2 / maxDim);

      sceneRef.add(wrapper);
      viewer.loadedModel = wrapper;
      viewer.hasModel = true;

      // Если PBR загружен — применяем
      if (Object.keys(pbr.textures).length > 0 && applyPBRCallback) {
        applyPBRCallback();
      }

      pushLog(`Loaded: ${filePath.split(/[\\/]/).pop()}`);
      pushToast('Модель загружена', 'success');
      setProgress(1, 'Готово');
      hideProgress();
      ui.busy = false;
    },
    (e) => {
      if (e.total) {
        setProgress(e.loaded / e.total, `Загрузка: ${(e.loaded / 1024 / 1024).toFixed(1)} / ${(e.total / 1024 / 1024).toFixed(1)} MB`);
      }
    },
    (err) => {
      console.error(err);
      pushLog(`Ошибка: ${err?.message ?? err}`);
      pushToast(`Ошибка загрузки: ${err?.message ?? err}`, 'error');
      ui.busy = false;
      hideProgress();
    }
  );
}

export function disposeObject(obj) {
  obj.traverse((child) => {
    if (child.isMesh) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    }
  });
}