<script>
  import { onMount, onDestroy } from 'svelte';
  import * as THREE from 'three';
  import { convertFileSrc } from '@tauri-apps/api/core';
  import {
    Circle, Square, Cylinder, Torus, ChevronLeft, ChevronRight, Loader2, X,
    Move3d, RotateCcw, Dices
  } from '@lucide/svelte';
  import { t } from '../i18n.svelte.js';
  import {
    viewer, pbr, ui, params, maskParams,
    scratchParams, dirtParams, rustParams, streakParams,
    decalParams,
    settings,
    isGeoLimitSupported,
    isUvMaskSupported,
    isWorldPosSupported,
    pushLog, pushToast
  } from '../lib/stores.svelte.js';
  import { applyPBR } from '../lib/pbr-loader.js';
  import { onGenerateWear } from '../lib/actions.svelte.js';
  import { loadVariation } from '../lib/variation-loader.js';
  import {
    applyMaskPreview,
    removeMaskPreview,
    scheduleMaskPreviewUpdate,
    finalMaskPreviewUpdate,
    setMaskPreviewScene
  } from '../lib/mask-preview.js';
  import { registerDropZone } from '../lib/drag-drop.js';
  import { createRustMaterial, updateRustUniforms } from '../lib/rust-shader.js';
  import { createDirtMaterial, updateDirtUniforms } from '../lib/dirt-shader.js';
  import { createStreaksMaterial, updateStreaksUniforms } from '../lib/streaks-shader.js';
  import { createScratchesMaterial, updateScratchesUniforms } from '../lib/scratches-shader.js';
  import { createDecalMaterial, updateDecalUniforms } from '../lib/decal-shader.js';
  import { loadAllMaskTextures } from '../lib/mask-textures.js';
  import { generateInstances, generateFixedInstance } from '../lib/instances.js';
  import { resolveMaskPaths, maskPathsKey } from '../lib/mask-source.js';
  import { applyEnvironment, preloadRest } from '../lib/environments.js';
  import { bakeGeoNormal, saveGeoNormalToFile } from '../lib/geo-normal-bake.js';
  import { bakeUvMask, saveUvMaskToFile } from '../lib/uv-mask-bake.js';
  import { bakeWorldPos, saveWorldPosToFile } from '../lib/world-pos-bake.js';

  function seedAngle(varSeed) {
    let s = varSeed >>> 0;
    s = (s * 1664525 + 1013904223) >>> 0;
    return ((s & 0xFFFFFF) / 16777216) * Math.PI * 2;
  }

  let canvasEl = $state();
  let renderer, scene, camera, mesh, raf;
  let isDragging = false;
  let lastX = 0, lastY = 0;
  let rotX = 0.3, rotY = 0.6;
  let camDist = 2.6;

  let showTiling = $state(false);
  let hasPbr = $derived(Object.keys(pbr.textures).length > 0);

  let canGenerate = $derived(
    hasPbr && (
      (params.preset === 'custom' && maskParams.enabled) ||
      (params.preset === 'decal' && decalParams.enabled) ||
      (params.preset !== 'custom' && params.preset !== 'decal')
    )
  );

  let generateLabel = $derived(
    !hasPbr ? t('rail.loadpbr') :
    (params.preset === 'custom' && !maskParams.enabled) ? t('rail.generate_need_mask') :
    (params.preset === 'decal' && !decalParams.enabled) ? t('rail.generate_need_decal') :
    t('rail.generate')
  );

  function resetTiling() {
    pbr.repeatX = 1.0;
    pbr.repeatY = 1.0;
    pbr.rotation = 0.0;
  }

  onMount(() => {
    initThree();

    const onRebuildShader = () => {
      if (shaderMaterial) {
        shaderMaterial = null;
        lastPresetKey = '';
      }
      if (decalMaterial) {
        decalMaterial = null;
      }
      if (params.preset === 'decal') {
        queueMicrotask(() => applyDecalMaterial());
      } else if (params.preset === 'rust' || params.preset === 'dirt' || params.preset === 'streaks' || params.preset === 'scratches') {
        queueMicrotask(() => applyShaderMaterial());
      }
    };
    window.addEventListener('wearcraft:rebuild-shader', onRebuildShader);
    canvasEl._rebuildListener = onRebuildShader;
  });

  onDestroy(() => {
    if (canvasEl && canvasEl._rebuildListener) {
      window.removeEventListener('wearcraft:rebuild-shader', canvasEl._rebuildListener);
    }
    cleanupThree();
  });

  async function initThree() {
    if (!canvasEl) return;
    const w = canvasEl.clientWidth;
    const h = canvasEl.clientHeight;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio * 2.0, 3.0));
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x1a1a1a, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.AgXToneMapping ?? THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    window.__wearcraftRenderer = renderer;
    canvasEl.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    window.__wearcraftScene = scene;
    scene.background = new THREE.Color(0x1a1a1a);

    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    updateCamera();

    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(3, 4, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -2;
    key.shadow.camera.right = 2;
    key.shadow.camera.top = 2;
    key.shadow.camera.bottom = -2;
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 20;
    key.shadow.bias = -0.0005;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x88aaff, 0.4);
    fill.position.set(-4, -2, -3);
    scene.add(fill);

    const mat = new THREE.MeshStandardMaterial({
      color: 0x9a9a9a, roughness: 0.7, metalness: 0.05,
    });
    mesh = new THREE.Mesh(createGeometry(viewer.shape), mat);
    scene.add(mesh);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    viewer.mesh = mesh;

    setMaskPreviewScene(scene);

    registerDropZone(() => {
      if (!canvasEl) return null;
      const rect = canvasEl.getBoundingClientRect();
      return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    });

    window.dispatchEvent(new CustomEvent('wearcraft:scene-ready', { detail: { scene } }));

    const ro = new ResizeObserver(() => {
      if (!canvasEl) return;
      const w2 = canvasEl.clientWidth;
      const h2 = canvasEl.clientHeight;
      if (w2 === 0 || h2 === 0) return;
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
      renderer.setSize(w2, h2, true);
    });
    ro.observe(canvasEl);
    canvasEl._ro = ro;

    animate();

    queueMicrotask(() => bakeGeoNormalForCurrentModel());
    queueMicrotask(() => bakeUvMaskForCurrentModel());
    queueMicrotask(() => bakeWorldPosForCurrentModel());

    try {
      await applyEnvironment(
        renderer, scene,
        ui.environment || 'neutral',
        ui.environmentIntensity ?? 0.85,
        ui.showHdrBackground ?? false
      );
      pushLog(`[Env] Окружение: ${ui.environment}`);
      preloadRest(renderer, ui.environment || 'neutral');
    } catch (e) {
      console.error('[Env] Ошибка загрузки HDR:', e);
      pushLog(`[Env] Не удалось загрузить окружение: ${e}`);
    }
  }

  function createGeometry(kind) {
    switch (kind) {
      case 'cube':     return new THREE.BoxGeometry(1.4, 1.4, 1.4);
      case 'cylinder': return new THREE.CylinderGeometry(0.7, 0.7, 1.8, 64, 32);
      case 'torus':    return new THREE.TorusGeometry(0.9, 0.35, 48, 96);
      case 'sphere':
      default:         return new THREE.SphereGeometry(1, 96, 96);
    }
  }

  function setShape(kind) {
    viewer.shape = kind;
    if (viewer.loadedModel) return;
    if (!mesh) return;
    const oldGeo = mesh.geometry;
    mesh.geometry = createGeometry(kind);
    oldGeo.dispose();
    queueMicrotask(() => bakeGeoNormalForCurrentModel());
    queueMicrotask(() => bakeUvMaskForCurrentModel());
    queueMicrotask(() => bakeWorldPosForCurrentModel());
  }

  function resetModel() {
    if (!viewer.loadedModel) return;
    scene.remove(viewer.loadedModel);
    disposeModel(viewer.loadedModel);
    viewer.loadedModel = null;
    viewer.hasModel = false;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x9a9a9a, roughness: 0.7, metalness: 0.05,
    });
    mesh = new THREE.Mesh(createGeometry(viewer.shape), mat);
    scene.add(mesh);
    viewer.mesh = mesh;
    setMaskPreviewScene(scene);
    if (Object.keys(pbr.textures).length > 0) applyPBR();
    pushLog('Модель сброшена');
    pushToast('Модель сброшена', 'info');
    queueMicrotask(() => bakeGeoNormalForCurrentModel());
    queueMicrotask(() => bakeUvMaskForCurrentModel());
    queueMicrotask(() => bakeWorldPosForCurrentModel());
  }

  function disposeModel(obj) {
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

  // ═══ GEO-NORMAL BAKE ═══
  let geoNormalBusy = false;
  let lastBakedKey = '';

  async function bakeGeoNormalForCurrentModel() {
    if (geoNormalBusy) return;

    if (!viewer.loadedModel && !isGeoLimitSupported()) {
      ui.geoNormalReady = false;
      ui.geoNormalPath = '';
      pushLog(`[GeoNormal] ${viewer.shape} — ограничение по геометрии недоступно`);
      return;
    }

    const target = viewer.loadedModel || mesh;
    if (!target) {
      ui.geoNormalReady = false;
      return;
    }

    let triCount = 0;
    target.traverse((c) => {
      if (c.isMesh && c.geometry?.index) triCount += c.geometry.index.count / 3;
      else if (c.isMesh && c.geometry?.attributes?.position) triCount += c.geometry.attributes.position.count / 3;
    });
    const key = `${viewer.loadedModel ? 'model' : viewer.shape}_${triCount}`;

    if (key === lastBakedKey && ui.geoNormalReady) return;

    geoNormalBusy = true;
    try {
      let hasUV = false;
      target.traverse((c) => {
        if (c.isMesh && c.geometry?.attributes?.uv) hasUV = true;
      });

      if (!hasUV) {
        pushLog('[GeoNormal] Модель без UV — ограничение по геометрии недоступно');
        pushToast('У модели нет UV — ограничение по геометрии недоступно', 'warn');
        ui.geoNormalReady = false;
        ui.geoNormalPath = '';
        return;
      }

      pushLog('[GeoNormal] Запекание...');
      const res = bakeGeoNormal(target, 1024, 1024);
      if (!res) {
        pushLog('[GeoNormal] Не удалось запечь');
        ui.geoNormalReady = false;
        return;
      }

      const path = await saveGeoNormalToFile(res.canvas, 'geo_normal.png');
      ui.geoNormalPath = path;
      ui.geoNormalReady = true;
      ui.geoNormalTick = (ui.geoNormalTick || 0) + 1;
      lastBakedKey = key;
      pushLog(`[GeoNormal] Готово: ${path}`);
    } catch (e) {
      console.error('[GeoNormal] Ошибка:', e);
      pushLog(`[GeoNormal] Ошибка: ${e}`);
      ui.geoNormalReady = false;
    } finally {
      geoNormalBusy = false;
    }
  }

  // ═══ UV-MASK BAKE ═══
  let uvMaskBusy = false;
  let lastUvMaskKey = '';

  async function bakeUvMaskForCurrentModel() {
    if (uvMaskBusy) return;

    if (!isUvMaskSupported()) {
      ui.uvMaskReady = false;
      ui.uvMaskPath = '';
      return;
    }

    const target = viewer.loadedModel;
    if (!target) {
      ui.uvMaskReady = false;
      return;
    }

    let triCount = 0;
    target.traverse((c) => {
      if (c.isMesh && c.geometry?.index) triCount += c.geometry.index.count / 3;
      else if (c.isMesh && c.geometry?.attributes?.position) triCount += c.geometry.attributes.position.count / 3;
    });
    const key = `model_uv_${triCount}`;

    if (key === lastUvMaskKey && ui.uvMaskReady) return;

    uvMaskBusy = true;
    try {
      let hasUV = false;
      target.traverse((c) => {
        if (c.isMesh && c.geometry?.attributes?.uv) hasUV = true;
      });

      if (!hasUV) {
        pushLog('[UvMask] Модель без UV');
        ui.uvMaskReady = false;
        ui.uvMaskPath = '';
        return;
      }

      pushLog('[UvMask] Запекание...');
      const res = bakeUvMask(target, 1024, 1024);
      if (!res) {
        pushLog('[UvMask] Не удалось запечь');
        ui.uvMaskReady = false;
        return;
      }

      const path = await saveUvMaskToFile(res.canvas, 'uv_mask.png');
      ui.uvMaskPath = path;
      ui.uvMaskReady = true;
      ui.uvMaskTick = (ui.uvMaskTick || 0) + 1;
      lastUvMaskKey = key;
      pushLog(`[UvMask] Готово: ${path}`);
    } catch (e) {
      console.error('[UvMask] Ошибка:', e);
      pushLog(`[UvMask] Ошибка: ${e}`);
      ui.uvMaskReady = false;
    } finally {
      uvMaskBusy = false;
    }
  }

  // ═══ WORLD-POS BAKE ═══
  let worldPosBusy = false;
  let lastWorldPosKey = '';

  async function bakeWorldPosForCurrentModel() {
    if (worldPosBusy) return;

    if (!isWorldPosSupported()) {
      ui.worldPosReady = false;
      ui.worldPosPath = '';
      return;
    }

    const target = viewer.loadedModel;
    if (!target) {
      ui.worldPosReady = false;
      return;
    }

    let triCount = 0;
    target.traverse((c) => {
      if (c.isMesh && c.geometry?.index) triCount += c.geometry.index.count / 3;
      else if (c.isMesh && c.geometry?.attributes?.position) triCount += c.geometry.attributes.position.count / 3;
    });
    const key = `model_wp_${triCount}`;

    if (key === lastWorldPosKey && ui.worldPosReady) return;

    worldPosBusy = true;
    try {
      let hasUV = false;
      target.traverse((c) => {
        if (c.isMesh && c.geometry?.attributes?.uv) hasUV = true;
      });

      if (!hasUV) {
        pushLog('[WorldPos] Модель без UV');
        ui.worldPosReady = false;
        ui.worldPosPath = '';
        return;
      }

      pushLog('[WorldPos] Запекание...');
      const res = bakeWorldPos(target, 1024, 1024);
      if (!res) {
        pushLog('[WorldPos] Не удалось запечь');
        ui.worldPosReady = false;
        return;
      }

      const path = await saveWorldPosToFile(res.canvas, 'world_pos.png');
      ui.worldPosPath = path;
      ui.worldPosReady = true;
      ui.worldPosTick = (ui.worldPosTick || 0) + 1;
      ui.worldPosBounds = res.bounds;
      lastWorldPosKey = key;
      pushLog(`[WorldPos] Готово: ${path} bounds=[${res.bounds.min.map(v=>v.toFixed(2))}]..[${res.bounds.max.map(v=>v.toFixed(2))}]`);
    } catch (e) {
      console.error('[WorldPos] Ошибка:', e);
      pushLog(`[WorldPos] Ошибка: ${e}`);
      ui.worldPosReady = false;
    } finally {
      worldPosBusy = false;
    }
  }

  // ═══ UV-маска как THREE.Texture ═══
  let uvMaskTexture = null;
  let uvMaskTexturePath = '';

  async function getUvMaskTexture() {
    if (!ui.uvMaskReady || !ui.uvMaskPath) return null;
    if (uvMaskTexturePath === ui.uvMaskPath && uvMaskTexture) return uvMaskTexture;

    if (uvMaskTexture) {
      uvMaskTexture.dispose();
      uvMaskTexture = null;
    }

    try {
      const tex = await new Promise((resolve, reject) => {
        const loader = new THREE.TextureLoader();
        const src = convertFileSrc(ui.uvMaskPath) + '?t=' + Date.now();
        loader.load(src, resolve, undefined, reject);
      });
      tex.flipY = false;
      tex.colorSpace = THREE.NoColorSpace;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
      uvMaskTexture = tex;
      uvMaskTexturePath = ui.uvMaskPath;
      ui.uvMaskTexture = tex;
      return tex;
    } catch (e) {
      console.error('[UvMask] Не удалось загрузить текстуру:', e);
      return null;
    }
  }

  function updateCamera() {
    camera.position.set(
      Math.sin(rotY) * Math.cos(rotX) * camDist,
      Math.sin(rotX) * camDist,
      Math.cos(rotY) * Math.cos(rotX) * camDist
    );
    camera.lookAt(0, 0, 0);
  }

  function animate() {
    raf = requestAnimationFrame(animate);

    const targets = getActiveMeshes();
    for (const t of targets) {
      if (t.material && t.material.uniforms && t.material.uniforms.uCameraPos) {
        t.material.uniforms.uCameraPos.value.copy(camera.position);
      }
    }

    renderer.render(scene, camera);
  }

  function cleanupThree() {
    cancelAnimationFrame(raf);
    if (canvasEl && canvasEl._ro) canvasEl._ro.disconnect();
    if (uvMaskTexture) {
      uvMaskTexture.dispose();
      uvMaskTexture = null;
    }
    if (renderer) {
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  }

  function onPointerDown(e) {
    isDragging = true; lastX = e.clientX; lastY = e.clientY;
    canvasEl.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (!isDragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    rotY -= dx * 0.008; rotX += dy * 0.008;
    rotX = Math.max(-1.5, Math.min(1.5, rotX));
    updateCamera();
  }
  function onPointerUp(e) {
    isDragging = false;
    if (canvasEl.hasPointerCapture(e.pointerId)) canvasEl.releasePointerCapture(e.pointerId);
  }
  function onWheel(e) {
    e.preventDefault();
    camDist *= (1 + Math.sign(e.deltaY) * 0.1);
    camDist = Math.max(1.4, Math.min(20, camDist));
    updateCamera();
  }

  function prevVariation() { ui.currentVariation = Math.max(0, ui.currentVariation - 1); }
  function nextVariation() {
    const max = ui.generated.length || params.variations;
    ui.currentVariation = Math.min(max, ui.currentVariation + 1);
  }

  function getActiveMeshes() {
    const targets = [];
    if (viewer.loadedModel) {
      viewer.loadedModel.traverse((c) => { if (c.isMesh) targets.push(c); });
    } else if (mesh) {
      targets.push(mesh);
    }
    return targets;
  }
  
  // ═══ Bake geo-normal / uv-mask / world-pos при загрузке модели ═══
  $effect(() => {
    const m = viewer.loadedModel;
    if (!m) return;
    queueMicrotask(() => bakeGeoNormalForCurrentModel());
    queueMicrotask(() => bakeUvMaskForCurrentModel());
    queueMicrotask(() => bakeWorldPosForCurrentModel());
  });

  $effect(() => {
    pbr.active.albedo; pbr.active.normal; pbr.active.roughness;
    pbr.active.metalness; pbr.active.ao; pbr.active.height;
    pbr.showEdgeMode; pbr.repeatX; pbr.repeatY; pbr.rotation;
    const v = ui.currentVariation;
    if (!renderer) return;

    if (v > 0) {
      removeMaskPreview();
    }

    if (v === 0 && params.preset === 'custom') applyPBR();
    if (v === 0 && params.preset === 'custom' && maskParams.enabled && pbr.textures?.albedo) {
      queueMicrotask(() => applyMaskPreview(scene));
    }
  });

  $effect(() => {
    const v = ui.currentVariation;
    const tick = ui.generationTick;
    const genLen = ui.generated.length;
    if (!renderer || v === 0 || genLen === 0) return;
    queueMicrotask(() => loadVariation(v));
  });

  $effect(() => {
    maskParams.enabled;
    maskParams.posX;
    maskParams.posY;
    maskParams.scale;
    maskParams.rotation;
    maskParams.opacity;
    maskParams.color[0]; maskParams.color[1]; maskParams.color[2];
    maskParams.kind;

    if (!renderer) return;
    if (params.preset !== 'custom') return;
    if (!maskParams.enabled) return;
    if (ui.currentVariation !== 0) return;
    if (!pbr.textures?.albedo) return;

    queueMicrotask(() => {
      if (!maskParams.enabled) return;
      applyMaskPreview(scene).then(() => {
        scheduleMaskPreviewUpdate();
      });
    });
  });

  $effect(() => {
    const path = maskParams.path;
    if (!renderer) return;
    if (params.preset !== 'custom') return;
    if (!path) return;
    if (!maskParams.enabled) return;
    if (ui.currentVariation !== 0) return;
    if (!pbr.textures?.albedo) return;

    queueMicrotask(async () => {
      await applyMaskPreview(scene);
      finalMaskPreviewUpdate();
    });
  });

  $effect(() => {
    const id = ui.environment;
    const intensity = ui.environmentIntensity;
    const bg = ui.showHdrBackground;

    if (!renderer || !scene) return;

    queueMicrotask(async () => {
      try {
        await applyEnvironment(renderer, scene, id, intensity, bg);
        pushLog(`[Env] Окружение: ${id}, интенсивность: ${(intensity * 100).toFixed(0)}%${bg ? ' + фон' : ''}`);
      } catch (e) {
        console.error('[Env] Ошибка:', e);
      }
    });
  });

  // ═══ Shader material (rust/dirt/streaks/scratches) ═══
  let shaderMaterial = null;
  let loadedMaskTextures = [];
  let lastMaskPathsKey = '';
  let lastPresetKey = '';

  async function applyShaderMaterial() {
    if (ui.currentVariation !== 0) return;

    const targets = getActiveMeshes();
    if (targets.length === 0) return;

    const preset = params.preset;
    if (preset !== 'rust' && preset !== 'dirt' && preset !== 'streaks' && preset !== 'scratches') return;

    const scratchesProcedural = (preset === 'scratches' && scratchParams.procedural);
    const streaksProcedural = (preset === 'streaks' && streakParams.procedural);

    // Procedural scratches — без real-time превью (по решению захода 38).
    // Но если включён triplanar — показываем как procedural-шум.
    if (scratchesProcedural && !settings.triplanarEnabled) return;

    let paths = [];
    let pathsKey = '';
    if (!streaksProcedural) {
      paths = await resolveMaskPaths(preset);
      pathsKey = maskPathsKey(preset, paths);
    }

    const presetKey = `${preset}${streaksProcedural ? '_proc' : '_mask'}`;
    if (!shaderMaterial || lastPresetKey !== presetKey) {
      let createFn;
      if (preset === 'streaks') createFn = createStreaksMaterial;
      else if (preset === 'scratches') createFn = createScratchesMaterial;
      else if (preset === 'rust') createFn = createRustMaterial;
      else createFn = createDirtMaterial;

      shaderMaterial = createFn(
        pbr.textures.albedo || null,
        pbr.textures.normal || null,
        pbr.textures.roughness || null
      );
      for (const t of targets) t.material = shaderMaterial;
      lastPresetKey = presetKey;
      loadedMaskTextures = [];
      lastMaskPathsKey = '';
    } else {
      for (const t of targets) {
        if (t.material !== shaderMaterial) t.material = shaderMaterial;
      }
    }

    let transforms = [];
    if (!streaksProcedural) {
      if (pathsKey !== lastMaskPathsKey) {
        lastMaskPathsKey = pathsKey;
        loadedMaskTextures = await loadAllMaskTextures(paths);
      }

      const isRust = preset === 'rust';
      const isScratch = preset === 'scratches';
      const userMask = isRust ? settings.userMaskRust
                     : (preset === 'streaks') ? settings.userMaskStreak
                     : isScratch ? settings.userMaskScratch
                     : settings.userMaskDirt;

      if (userMask) {
        const pos = isRust ? settings.userMaskRustPos
                  : (preset === 'streaks') ? settings.userMaskStreakPos
                  : isScratch ? settings.userMaskScratchPos
                  : settings.userMaskDirtPos;
        transforms = [generateFixedInstance(pos)];
      } else {
        const p = isRust ? rustParams
                : (preset === 'streaks') ? streakParams
                : isScratch ? scratchParams
                : dirtParams;
        const count = Math.min(Math.round(p.count || 3), 8);
        const scale = (preset === 'streaks') ? (p.maskScale || 1)
                    : isScratch ? (p.maskScale || 1)
                    : (p.scale || 1);
        const previewVarSeed = ((params.seed || 1) + 1 * 7919) >>> 0;
        const maskCount = Math.max(1, paths.length);

        let useRandomRot = p.randomRotation;
        let globalRot = p.rotation * Math.PI / 180;
        if (preset === 'streaks') {
          useRandomRot = false;
          globalRot = p.randomRotation ? seedAngle(previewVarSeed) : p.rotation * Math.PI / 180;
        }

        transforms = generateInstances(previewVarSeed, count, scale, maskCount, {
          globalPosX: p.posX,
          globalPosY: p.posY,
          globalRotation: globalRot,
          randomRotation: useRandomRot,
          randomFlip: (preset === 'streaks') ? false : true,
          tileable: !p.disableTiling,
        });
      }
    }

    // UV-маска
    const uvMaskTex = await getUvMaskTexture();

    // Triplanar — только для procedural-режимов и только если юзер включил чекбокс.
    // Для масок triplanar всегда выключен (UV-проекция, одно пятно).
    const triSupported = isWorldPosSupported() && ui.worldPosReady;
    const triAllowedForPreset = (preset === 'streaks' || preset === 'scratches');
    const triEnabled = triSupported && triAllowedForPreset && settings.triplanarEnabled;
    const triScale = 2.0;
    const modelMin = ui.worldPosBounds?.min ?? [-0.5, -0.5, -0.5];
    const modelMax = ui.worldPosBounds?.max ?? [0.5, 0.5, 0.5];

    if (preset === 'rust') {
      updateRustUniforms(shaderMaterial, {
        masks: loadedMaskTextures,
        transforms,
        threshold: rustParams.threshold,
        sharpness: rustParams.sharpness,
        deform:    rustParams.deform,
        volume:    rustParams.volume,
        amount:    (params.amount || 70) / 100.0,
        repeatX:   pbr.repeatX,
        repeatY:   pbr.repeatY,
        rotationDeg: pbr.rotation,
        albedoTex:  pbr.textures.albedo || null,
        normalTex:  pbr.textures.normal || null,
        roughTex:   pbr.textures.roughness || null,
        uvMask:     uvMaskTex,
        triplanarEnabled: triEnabled,
        modelMin, modelMax, triScale,
      });
    } else if (preset === 'streaks') {
      updateStreaksUniforms(shaderMaterial, {
        procedural: streakParams.procedural,
        threshold: streakParams.threshold,
        sharpness: streakParams.sharpness,
        thickness: streakParams.procedural ? streakParams.thickness : streakParams.maskThickness,
        amount:    (params.amount || 65) / 100.0,
        color:     streakParams.color,
        count:     streakParams.count,
        size:      streakParams.size,
        stretch:   streakParams.stretch,
        waviness:  streakParams.waviness,
        procScale: streakParams.procScale,
        posX:      streakParams.posX,
        posY:      streakParams.posY,
        rotation:  streakParams.rotation,
        seed:      ((params.seed + 1 * 7919) >>> 0) % 10000,
        disableTiling: streakParams.disableTiling,
        masks:     loadedMaskTextures,
        transforms,
        deform:    streakParams.deform,
        repeatX:   pbr.repeatX,
        repeatY:   pbr.repeatY,
        rotationDeg: pbr.rotation,
        albedoTex:  pbr.textures.albedo || null,
        normalTex:  pbr.textures.normal || null,
        roughTex:   pbr.textures.roughness || null,
        uvMask:     uvMaskTex,
        triplanarEnabled: triEnabled,
        modelMin, modelMax, triScale,
      });
    } else if (preset === 'scratches') {
      updateScratchesUniforms(shaderMaterial, {
        masks: loadedMaskTextures,
        transforms,
        threshold: scratchParams.threshold,
        sharpness: scratchParams.sharpness,
        deform:    scratchParams.deform,
        thickness: scratchParams.maskThickness,
        amount:    (params.amount || 50) / 100.0,
        color:     scratchParams.color,
        repeatX:   pbr.repeatX,
        repeatY:   pbr.repeatY,
        rotationDeg: pbr.rotation,
        albedoTex:  pbr.textures.albedo || null,
        normalTex:  pbr.textures.normal || null,
        roughTex:   pbr.textures.roughness || null,
        uvMask:     uvMaskTex,
        triplanarEnabled: triEnabled,
        modelMin, modelMax, triScale,
      });
    } else {
      updateDirtUniforms(shaderMaterial, {
        masks: loadedMaskTextures,
        transforms,
        threshold: dirtParams.threshold,
        sharpness: dirtParams.sharpness,
        deform:    dirtParams.deform,
        thickness: dirtParams.thickness,
        amount:    (params.amount || 70) / 100.0,
        color:     dirtParams.color,
        repeatX:   pbr.repeatX,
        repeatY:   pbr.repeatY,
        rotationDeg: pbr.rotation,
        albedoTex:  pbr.textures.albedo || null,
        normalTex:  pbr.textures.normal || null,
        roughTex:   pbr.textures.roughness || null,
        uvMask:     uvMaskTex,
        triplanarEnabled: triEnabled,
        modelMin, modelMax, triScale,
      });
    }

    const geoOk = isGeoLimitSupported();
    const modeNum = { sides: 0, top: 1, bottom: 2, top_bottom: 3 }[ui.geometryLimitMode] ?? 0;

    shaderMaterial.uniforms.uGeoLimitEnabled.value = geoOk && ui.geometryLimitEnabled;
    shaderMaterial.uniforms.uGeoLimitMode.value = modeNum;
    shaderMaterial.uniforms.uGeoLimitSoftness.value = ui.geometryLimitSoftness;
    shaderMaterial.uniforms.uGeoLimitInvert.value = ui.geometryLimitInvert;
  }

  // ═══ Decal material ═══
  let decalMaterial = null;

  function applyDecalMaterial() {
    if (ui.currentVariation !== 0) return;
    if (params.preset !== 'decal') return;

    const targets = getActiveMeshes();
    if (targets.length === 0) return;

    if (!decalMaterial) {
      decalMaterial = createDecalMaterial(
        pbr.textures.albedo || null,
        pbr.textures.normal || null,
        pbr.textures.roughness || null
      );
      shaderMaterial = null;
      lastPresetKey = '';
    }
    for (const t of targets) {
      if (t.material !== decalMaterial) t.material = decalMaterial;
    }

    let scaleY = decalParams.scale;
    if (decalParams.keepAspect && decalParams.aspectW > 0) {
      scaleY = decalParams.scale * (decalParams.aspectH / decalParams.aspectW);
    }

    updateDecalUniforms(decalMaterial, {
      decalTex:  decalParams.texture,
      heightTex: decalParams.heightTexture,
      posX:      decalParams.posX,
      posY:      decalParams.posY,
      scale:     decalParams.scale,
      scaleY,
      rotationDeg: decalParams.rotation,
      opacity:   decalParams.opacity,
      amountAlbedo:    decalParams.affectAlbedo    ? 1.0 : 0.0,
      amountRough:     decalParams.affectRoughness ? 1.0 : 0.0,
      amountNormal:    decalParams.affectNormal    ? 1.0 : 0.0,
      heightIntensity: decalParams.heightIntensity,
      tileEdge:        decalParams.tileEdge,
      albedoTex:  pbr.textures.albedo || null,
      normalTex:  pbr.textures.normal || null,
      roughTex:   pbr.textures.roughness || null,
    });
  }

  function revertToStandardMaterial() {
    const targets = getActiveMeshes();
    if (targets.length === 0) return;

    let reverted = false;
    for (const t of targets) {
      if (t.material === shaderMaterial || t.material === decalMaterial) {
        t.material = new THREE.MeshStandardMaterial({
          color: 0x9a9a9a, roughness: 0.7, metalness: 0.05,
        });
        reverted = true;
      }
    }
    if (reverted) {
      shaderMaterial = null;
      decalMaterial = null;
      lastPresetKey = '';
      if (Object.keys(pbr.textures).length > 0) applyPBR();
    }
  }

  $effect(() => {
    const preset = params.preset;
    const v = ui.currentVariation;

    if (!renderer) return;
    if (v !== 0) return;
    if (Object.keys(pbr.textures).length === 0) return;

    if (preset === 'decal') {
      queueMicrotask(() => applyDecalMaterial());
    } else if (preset === 'rust' || preset === 'dirt' || preset === 'streaks' || preset === 'scratches') {
      queueMicrotask(() => applyShaderMaterial());
    } else {
      queueMicrotask(() => revertToStandardMaterial());
    }
  });

  $effect(() => {
    decalParams.enabled;
    decalParams.path;
    decalParams.heightPath;
    decalParams.posX;
    decalParams.posY;
    decalParams.scale;
    decalParams.rotation;
    decalParams.keepAspect;
    decalParams.opacity;
    decalParams.randomPosition;
    decalParams.randomRotation;
    decalParams.tileEdge;
    decalParams.affectAlbedo;
    decalParams.affectRoughness;
    decalParams.affectNormal;
    decalParams.heightIntensity;
    decalParams.aspectW;
    decalParams.aspectH;
    pbr.textures.albedo; pbr.textures.normal; pbr.textures.roughness;

    if (!renderer) return;
    if (params.preset !== 'decal') return;
    if (ui.currentVariation !== 0) return;
    if (Object.keys(pbr.textures).length === 0) return;

    queueMicrotask(() => applyDecalMaterial());
  });

  $effect(() => {
    params.preset;
    params.amount; params.seed;

    scratchParams.procedural;
    scratchParams.density; scratchParams.length; scratchParams.thickness;
    scratchParams.waviness; scratchParams.branches; scratchParams.clusters;
    scratchParams.normalEnabled; scratchParams.depth;
    scratchParams.realistic; scratchParams.rimHighlight;
    scratchParams.count; scratchParams.maskScale; scratchParams.deform;
    scratchParams.threshold; scratchParams.sharpness;
    scratchParams.color[0]; scratchParams.color[1]; scratchParams.color[2];
    scratchParams.maskThickness; scratchParams.maskRimHighlight; scratchParams.maskNormalEnabled;
    scratchParams.disableTiling;
    scratchParams.posX; scratchParams.posY; scratchParams.rotation; scratchParams.randomRotation;
    settings.userMaskScratch;
    settings.folderMaskNamesScratch.length;
    settings.folderMaskNamesScratch.join(',');
    settings.userMaskScratchPos.offsetX;
    settings.userMaskScratchPos.offsetY;
    settings.userMaskScratchPos.rotation;
    settings.userMaskScratchPos.scale;

    rustParams.count; rustParams.scale; rustParams.deform;
    rustParams.threshold; rustParams.sharpness; rustParams.volume;
    rustParams.posX; rustParams.posY; rustParams.rotation; rustParams.randomRotation;
    rustParams.disableTiling;
    settings.userMaskRust;
    settings.folderMaskNamesRust.length;
    settings.folderMaskNamesRust.join(',');
    settings.userMaskRustPos.offsetX;
    settings.userMaskRustPos.offsetY;
    settings.userMaskRustPos.rotation;
    settings.userMaskRustPos.scale;

    dirtParams.count; dirtParams.scale; dirtParams.deform;
    dirtParams.threshold; dirtParams.sharpness; dirtParams.thickness;
    dirtParams.color[0]; dirtParams.color[1]; dirtParams.color[2];
    dirtParams.posX; dirtParams.posY; dirtParams.rotation; dirtParams.randomRotation;
    dirtParams.disableTiling;
    settings.userMaskDirt;
    settings.folderMaskNamesDirt.length;
    settings.folderMaskNamesDirt.join(',');
    settings.userMaskDirtPos.offsetX;
    settings.userMaskDirtPos.offsetY;
    settings.userMaskDirtPos.rotation;
    settings.userMaskDirtPos.scale;

    streakParams.procedural;
    streakParams.count;
    streakParams.threshold; streakParams.sharpness; streakParams.thickness;
    streakParams.maskThickness;
    streakParams.color[0]; streakParams.color[1]; streakParams.color[2];
    streakParams.size; streakParams.stretch;
    streakParams.waviness;
    streakParams.posX; streakParams.posY; streakParams.rotation;
    streakParams.procScale;
    streakParams.maskScale; streakParams.deform;
    streakParams.randomRotation;
    streakParams.disableTiling;
    settings.userMaskStreak;
    settings.folderMaskNamesStreak.length;
    settings.folderMaskNamesStreak.join(',');
    settings.userMaskStreakPos.offsetX;
    settings.userMaskStreakPos.offsetY;
    settings.userMaskStreakPos.rotation;
    settings.userMaskStreakPos.scale;

    pbr.repeatX; pbr.repeatY; pbr.rotation;
    pbr.textures.albedo; pbr.textures.normal; pbr.textures.roughness;

    if (!renderer) return;
    if (ui.currentVariation !== 0) return;

    const preset = params.preset;
    if (preset !== 'rust' && preset !== 'dirt' && preset !== 'streaks' && preset !== 'scratches') return;
    if (!shaderMaterial) return;

    queueMicrotask(() => applyShaderMaterial());
  });

  $effect(() => {
    ui.geometryLimitEnabled;
    ui.geometryLimitMode;
    ui.geometryLimitSoftness;
    ui.geometryLimitInvert;
    ui.geoNormalReady;
    ui.geoNormalPath;
    viewer.shape;
    viewer.loadedModel;
    ui.triplanarEnabled;
    settings.triplanarEnabled;

    if (!renderer) return;
    if (ui.currentVariation !== 0) return;

    const preset = params.preset;
    if (preset !== 'rust' && preset !== 'dirt' && preset !== 'streaks' && preset !== 'scratches') return;
    if (!shaderMaterial) return;

    queueMicrotask(() => applyShaderMaterial());
  });

  $effect(() => {
    ui.uvMaskReady;
    ui.uvMaskPath;
    viewer.loadedModel;
    viewer.shape;

    if (!renderer) return;
    if (ui.currentVariation !== 0) return;

    const preset = params.preset;
    if (preset !== 'rust' && preset !== 'dirt' && preset !== 'streaks' && preset !== 'scratches') return;
    if (!shaderMaterial) return;

    queueMicrotask(() => applyShaderMaterial());
  });

  $effect(() => {
    ui.worldPosReady;
    ui.worldPosPath;
    viewer.loadedModel;
    viewer.shape;

    if (!renderer) return;
    if (ui.currentVariation !== 0) return;

    const preset = params.preset;
    if (preset !== 'rust' && preset !== 'dirt' && preset !== 'streaks' && preset !== 'scratches') return;
    if (!shaderMaterial) return;

    queueMicrotask(() => applyShaderMaterial());
  });

</script>

<section class="preview" oncontextmenu={(e) => e.preventDefault()}>
  <div
    class="canvas-wrap"
    role="application"
    aria-label="3D preview"
    bind:this={canvasEl}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
    onwheel={onWheel}
  ></div>

  {#if ui.dragOver}
    <div class="drop-overlay">
      <div class="drop-message">
        <div class="drop-icon">📥</div>
        <div class="drop-text">Drop PBR here</div>
      </div>
    </div>
  {/if}

  {#if ui.busy}
    <div class="preview-spinner">
      <Loader2 size={32} class="spin" />
    </div>
  {/if}

  <div class="preview-overlay">
    <div class="top-left-controls">
      <div class="shape-switch" class:disabled={!!viewer.loadedModel}>
        <button type="button" class:active={viewer.shape === 'sphere'}   disabled={!!viewer.loadedModel} onclick={() => setShape('sphere')}   title="Sphere"><Circle size={16} /></button>
        <button type="button" class:active={viewer.shape === 'cube'}     disabled={!!viewer.loadedModel} onclick={() => setShape('cube')}     title="Cube"><Square size={16} /></button>
        <button type="button" class:active={viewer.shape === 'cylinder'} disabled={!!viewer.loadedModel} onclick={() => setShape('cylinder')} title="Cylinder"><Cylinder size={16} /></button>
        <button type="button" class:active={viewer.shape === 'torus'}    disabled={!!viewer.loadedModel} onclick={() => setShape('torus')}    title="Torus"><Torus size={16} /></button>
        {#if viewer.loadedModel}
          <button type="button" class="reset-btn" onclick={resetModel} title="Сбросить модель"><X size={16} /></button>
        {/if}
      </div>

      <button type="button"
        class="tiling-toggle"
        class:active={showTiling}
        onclick={() => showTiling = !showTiling}
        title="Tiling"
      >
        <Move3d size={16} />
      </button>
    </div>

    <button type="button"
      class="generate-btn"
      disabled={ui.busy || !canGenerate}
      onclick={onGenerateWear}
      title={generateLabel}
    >
      <Dices size={16} />
      <span>{generateLabel}</span>
    </button>

    {#if showTiling}
      <div class="tiling-panel">
        <div class="tiling-row">
          <span class="tiling-label">Repeat X</span>
          <input type="range" min="0.1" max="10" step="0.1" bind:value={pbr.repeatX} />
          <span class="tiling-value">{pbr.repeatX.toFixed(1)}</span>
        </div>
        <div class="tiling-row">
          <span class="tiling-label">Repeat Y</span>
          <input type="range" min="0.1" max="10" step="0.1" bind:value={pbr.repeatY} />
          <span class="tiling-value">{pbr.repeatY.toFixed(1)}</span>
        </div>
        <div class="tiling-row">
          <span class="tiling-label">Rotation</span>
          <input type="range" min="-180" max="180" step="1" bind:value={pbr.rotation} />
          <span class="tiling-value">{pbr.rotation.toFixed(0)}°</span>
        </div>
        <button type="button" class="tiling-reset" onclick={resetTiling}>
          <RotateCcw size={12} /> Reset
        </button>
      </div>
    {/if}

    <div class="var-nav">
      <button type="button" onclick={prevVariation} title={t('preview.prev')}>
        <ChevronLeft size={16} />
      </button>
      <span class="var-count">
        {#if ui.currentVariation === 0}
          {t('preview.source')}
        {:else}
          {ui.currentVariation} / {ui.generated.length || params.variations}
        {/if}
      </span>
      <button type="button" onclick={nextVariation} title={t('preview.next')}>
        <ChevronRight size={16} />
      </button>
    </div>
    <div class="hint">{t('preview.hint')}</div>
  </div>
</section>

<style>
  .preview { position: relative; background: var(--bg-0); min-width: 0; min-height: 0; overflow: hidden; width: 100%; height: 100%; }
  .canvas-wrap { position: absolute; inset: 0; cursor: grab; overflow: hidden; }
  .canvas-wrap canvas { display: block !important; width: 100% !important; height: 100% !important; max-width: 100% !important; max-height: 100% !important; }
  .canvas-wrap:active { cursor: grabbing; }
  .preview-spinner { position: absolute; top: 12px; right: 12px; background: rgba(20,20,20,0.85); border: 1px solid var(--border); border-radius: 50%; padding: 10px; color: var(--accent); display: flex; align-items: center; justify-content: center; z-index: 5; }
  :global(.spin) { animation: spin 1s linear infinite; }
  @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
  .preview-overlay { position: absolute; inset: 0; pointer-events: none; display: flex; flex-direction: column; padding: 12px; }
  .preview-overlay .var-nav { margin-top: auto; }
  .top-left-controls { display: flex; gap: 6px; align-self: flex-start; pointer-events: auto; }
  .var-nav { display: flex; align-items: center; gap: 8px; align-self: center; pointer-events: auto; background: rgba(20,20,20,0.75); border: 1px solid var(--border); border-radius: 6px; padding: 4px 6px; backdrop-filter: blur(6px); }
  .var-nav button { background: transparent; border: none; color: var(--fg-1); cursor: pointer; padding: 2px 8px; display: flex; align-items: center; }
  .var-nav button:hover { color: var(--accent); }
  .var-count { font-size: 12px; color: var(--fg-0); min-width: 80px; text-align: center; }
  .hint { align-self: flex-end; font-size: 11px; color: var(--fg-2); background: rgba(20,20,20,0.6); padding: 3px 8px; border-radius: 4px; }
  .shape-switch { display: flex; gap: 2px; background: rgba(20,20,20,0.75); border: 1px solid var(--border); border-radius: 6px; padding: 3px; backdrop-filter: blur(6px); }
  .shape-switch button { background: transparent; border: none; color: var(--fg-1); cursor: pointer; padding: 5px 8px; border-radius: 4px; display: flex; align-items: center; justify-content: center; }
  .shape-switch button:hover:not(:disabled) { color: var(--fg-0); }
  .shape-switch button.active { background: var(--accent); color: #141414; }
  .shape-switch button:disabled { opacity: 0.3; cursor: not-allowed; }
  .shape-switch button:disabled:hover { color: var(--fg-1); }
  .shape-switch .reset-btn { color: var(--danger); margin-left: 4px; border-left: 1px solid var(--border); border-radius: 0; padding-left: 10px; }
  .shape-switch .reset-btn:hover { color: #ff6060; background: transparent; }
  .tiling-toggle { background: rgba(20,20,20,0.75); border: 1px solid var(--border); color: var(--fg-1); padding: 5px 8px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(6px); }
  .tiling-toggle:hover { color: var(--accent); border-color: var(--accent); }
  .tiling-toggle.active { background: var(--accent); color: #141414; border-color: var(--accent); }
  .generate-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--accent);
    color: #141414;
    border: 1px solid var(--accent);
    border-radius: 6px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    backdrop-filter: blur(6px);
    box-shadow: 0 4px 16px rgba(240, 160, 32, 0.25);
    transition: filter 0.15s, box-shadow 0.15s, opacity 0.15s;
  }
  .generate-btn:hover:not(:disabled) {
    filter: brightness(1.1);
    box-shadow: 0 6px 20px rgba(240, 160, 32, 0.4);
  }
  .generate-btn:active:not(:disabled) { filter: brightness(0.95); }
  .generate-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    box-shadow: none;
  }
  .tiling-panel { align-self: flex-start; pointer-events: auto; background: rgba(20,20,20,0.92); border: 1px solid var(--border); border-radius: 6px; padding: 10px 12px; backdrop-filter: blur(8px); display: flex; flex-direction: column; gap: 8px; min-width: 260px; margin-top: 6px; }
  .tiling-row { display: grid; grid-template-columns: 70px 1fr 45px; align-items: center; gap: 8px; }
  .tiling-label { color: var(--fg-2); font-size: 11px; }
  .tiling-value { color: var(--accent); font-size: 11px; font-weight: 600; text-align: right; }
  .tiling-row input[type="range"] { width: 100%; accent-color: var(--accent); }
  .tiling-reset { background: var(--bg-2); border: 1px solid var(--border); color: var(--fg-1); padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 4px; }
  .tiling-reset:hover { color: var(--accent); border-color: var(--accent); }

  .drop-overlay {
    position: absolute; inset: 0; z-index: 50;
    background: rgba(240, 160, 32, 0.15);
    border: 3px dashed var(--accent);
    display: flex; align-items: center; justify-content: center;
    pointer-events: none;
    animation: dropPulse 1.2s ease-in-out infinite;
  }
  @keyframes dropPulse {
    0%, 100% { background: rgba(240, 160, 32, 0.15); }
    50% { background: rgba(240, 160, 32, 0.25); }
  }
  .drop-message { display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .drop-icon { font-size: 48px; }
  .drop-text {
    font-size: 18px; color: var(--accent); font-weight: 600;
    text-shadow: 0 2px 8px rgba(0,0,0,0.8);
  }
</style>