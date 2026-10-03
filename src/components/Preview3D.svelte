<script>
  import { onMount, onDestroy } from 'svelte';
  import * as THREE from 'three';
  import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
  import {
    Circle, Square, Cylinder, Torus, ChevronLeft, ChevronRight, Loader2, X,
    Move3d, RotateCcw
  } from '@lucide/svelte';
  import { t } from '../i18n.svelte.js';
  import {
    viewer, pbr, ui, params, maskParams,
    scratchParams, dirtParams, rustParams, settings,
    pushLog, pushToast
  } from '../lib/stores.svelte.js';
  import { applyPBR } from '../lib/pbr-loader.js';
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
  import { loadAllMaskTextures } from '../lib/mask-textures.js';
  import { generateInstances, generateFixedInstance } from '../lib/instances.js';
  import { resolveMaskPaths, maskPathsKey } from '../lib/mask-source.js';

  let canvasEl = $state();
  let renderer, scene, camera, mesh, raf;
  let isDragging = false;
  let lastX = 0, lastY = 0;
  let rotX = 0.3, rotY = 0.6;
  let camDist = 2.6;

  let showTiling = $state(false);

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
      if (params.preset === 'rust' || params.preset === 'dirt') {
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

  function initThree() {
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

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    const envMap = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envMap.texture;
    scene.environmentIntensity = 0.85;
    pmrem.dispose();

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
  }

  function createGeometry(kind) {
    switch (kind) {
      case 'cube':     return new THREE.BoxGeometry(1.4, 1.4, 1.4, 32, 32, 32);
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

  $effect(() => {
    pbr.active.albedo; pbr.active.normal; pbr.active.roughness;
    pbr.active.metalness; pbr.active.ao; pbr.active.height;
    pbr.showEdgeMode; pbr.repeatX; pbr.repeatY; pbr.rotation;
    const v = ui.currentVariation;
    if (!renderer) return;
    if (v === 0 && params.preset !== 'rust' && params.preset !== 'dirt') applyPBR();
    if (maskParams.enabled && pbr.textures?.albedo) {
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
    if (!path) return;
    if (!maskParams.enabled) return;
    if (ui.currentVariation !== 0) return;
    if (!pbr.textures?.albedo) return;

    queueMicrotask(async () => {
      await applyMaskPreview(scene);
      finalMaskPreviewUpdate();
    });
  });

  let shaderMaterial = null;
  let loadedMaskTextures = [];
  let lastMaskPathsKey = '';
  let lastPresetKey = '';

  async function applyShaderMaterial() {
    if (ui.currentVariation !== 0) return;

    const targets = getActiveMeshes();
    if (targets.length === 0) return;

    const preset = params.preset;
    if (preset !== 'rust' && preset !== 'dirt') return;

    const paths = await resolveMaskPaths(preset);
    const pathsKey = maskPathsKey(preset, paths);

    if (!shaderMaterial || lastPresetKey !== preset) {
      const createFn = preset === 'rust' ? createRustMaterial : createDirtMaterial;
      shaderMaterial = createFn(
        pbr.textures.albedo || null,
        pbr.textures.normal || null,
        pbr.textures.roughness || null
      );
      for (const t of targets) t.material = shaderMaterial;
      lastPresetKey = preset;
      loadedMaskTextures = [];
      lastMaskPathsKey = '';
    } else {
      for (const t of targets) {
        if (t.material !== shaderMaterial) t.material = shaderMaterial;
      }
    }

    if (pathsKey !== lastMaskPathsKey) {
      lastMaskPathsKey = pathsKey;
      loadedMaskTextures = await loadAllMaskTextures(paths);
    }

    const isRust = preset === 'rust';
    const userMask = isRust ? settings.userMaskRust : settings.userMaskDirt;
    let transforms;

    if (userMask) {
      // Заход 23: юзерская маска — фиксированный instance из UI
      const pos = isRust ? settings.userMaskRustPos : settings.userMaskDirtPos;
      transforms = [generateFixedInstance(pos)];
    } else {
      const count = Math.min(Math.round(isRust ? (rustParams.count || 3) : (dirtParams.count || 3)), 8);
      const scale = isRust ? (rustParams.scale || 1) : (dirtParams.scale || 1);
      const previewVarSeed = ((params.seed || 1) + 1 * 7919) >>> 0;
      const maskCount = Math.max(1, paths.length);
      const p = isRust ? rustParams : dirtParams;
      transforms = generateInstances(previewVarSeed, count, scale, maskCount, {
        globalPosX: p.posX,
        globalPosY: p.posY,
        globalRotation: p.rotation * Math.PI / 180,
        randomRotation: p.randomRotation,
      });
    }

    if (isRust) {
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
      });
    }
  }

  function revertToStandardMaterial() {
    const targets = getActiveMeshes();
    if (targets.length === 0) return;

    let reverted = false;
    for (const t of targets) {
      if (t.material === shaderMaterial) {
        t.material = new THREE.MeshStandardMaterial({
          color: 0x9a9a9a, roughness: 0.7, metalness: 0.05,
        });
        reverted = true;
      }
    }
    if (reverted) {
      shaderMaterial = null;
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

    if (preset === 'rust' || preset === 'dirt') {
      queueMicrotask(() => applyShaderMaterial());
    } else {
      queueMicrotask(() => revertToStandardMaterial());
    }
  });

  $effect(() => {
    params.preset;
    params.amount; params.seed;

    rustParams.count; rustParams.scale; rustParams.deform;
    rustParams.threshold; rustParams.sharpness; rustParams.volume;
    rustParams.posX; rustParams.posY; rustParams.rotation; rustParams.randomRotation;
    settings.userMaskRust;
    settings.folderMaskNamesRust.length;
    settings.folderMaskNamesRust.join(',');
    // Заход 23: позиция юзерской маски
    settings.userMaskRustPos.offsetX;
    settings.userMaskRustPos.offsetY;
    settings.userMaskRustPos.rotation;
    settings.userMaskRustPos.scale;

    dirtParams.count; dirtParams.scale; dirtParams.deform;
    dirtParams.threshold; dirtParams.sharpness; dirtParams.thickness;
    dirtParams.color[0]; dirtParams.color[1]; dirtParams.color[2];
    dirtParams.posX; dirtParams.posY; dirtParams.rotation; dirtParams.randomRotation;
    settings.userMaskDirt;
    settings.folderMaskNamesDirt.length;
    settings.folderMaskNamesDirt.join(',');
    settings.userMaskDirtPos.offsetX;
    settings.userMaskDirtPos.offsetY;
    settings.userMaskDirtPos.rotation;
    settings.userMaskDirtPos.scale;

    pbr.repeatX; pbr.repeatY; pbr.rotation;
    pbr.textures.albedo; pbr.textures.normal; pbr.textures.roughness;

    if (!renderer) return;
    if (ui.currentVariation !== 0) return;

    const preset = params.preset;
    if (preset !== 'rust' && preset !== 'dirt') return;
    if (!shaderMaterial) return;

    queueMicrotask(() => applyShaderMaterial());
  });

</script>

<section class="preview">
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
        <button class:active={viewer.shape === 'sphere'}   disabled={!!viewer.loadedModel} onclick={() => setShape('sphere')}   title="Sphere"><Circle size={16} /></button>
        <button class:active={viewer.shape === 'cube'}     disabled={!!viewer.loadedModel} onclick={() => setShape('cube')}     title="Cube"><Square size={16} /></button>
        <button class:active={viewer.shape === 'cylinder'} disabled={!!viewer.loadedModel} onclick={() => setShape('cylinder')} title="Cylinder"><Cylinder size={16} /></button>
        <button class:active={viewer.shape === 'torus'}    disabled={!!viewer.loadedModel} onclick={() => setShape('torus')}    title="Torus"><Torus size={16} /></button>
        {#if viewer.loadedModel}
          <button class="reset-btn" onclick={resetModel} title="Сбросить модель"><X size={16} /></button>
        {/if}
      </div>

      <button
        class="tiling-toggle"
        class:active={showTiling}
        onclick={() => showTiling = !showTiling}
        title="Tiling"
      >
        <Move3d size={16} />
      </button>
    </div>

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
        <button class="tiling-reset" onclick={resetTiling}>
          <RotateCcw size={12} /> Reset
        </button>
      </div>
    {/if}

    <div class="var-nav">
      <button onclick={prevVariation} title={t('preview.prev')}>
        <ChevronLeft size={16} />
      </button>
      <span class="var-count">
        {#if ui.currentVariation === 0}
          {t('preview.source')}
        {:else}
          {ui.currentVariation} / {ui.generated.length || params.variations}
        {/if}
      </span>
      <button onclick={nextVariation} title={t('preview.next')}>
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