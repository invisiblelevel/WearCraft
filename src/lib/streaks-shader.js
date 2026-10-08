// Шейдер для превью Streaks. Два режима: procedural (value_noise + fbm + stretch) и masks.
// + Ограничение по геометрии через vNormal.
// + UV-острова через uUvMask.
// + Triplanar projection через vWorldPos.
// + uDeform: деформация в mask-режиме.
// + uThickness: работает в обоих режимах (в procedural — градиент по телу).
// + uSeed: ОБЯЗАТЕЛЬНО передавать seed % 10000 (иначе float32 теряет точность).
import * as THREE from 'three';

export const MAX_MASKS = 8;

const VERT = /* glsl */`
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */`
  precision highp float;

  #define MAX_MASKS 8

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec2 vUv;

  uniform sampler2D uAlbedoTex;
  uniform sampler2D uNormalTex;
  uniform sampler2D uRoughTex;
  uniform bool uHasAlbedo;
  uniform bool uHasNormal;
  uniform bool uHasRough;

  uniform sampler2D uMask0;
  uniform sampler2D uMask1;
  uniform sampler2D uMask2;
  uniform sampler2D uMask3;
  uniform sampler2D uMask4;
  uniform sampler2D uMask5;
  uniform sampler2D uMask6;
  uniform sampler2D uMask7;
  uniform int uMaskCount;
  uniform int uInstanceCount;

  uniform vec4 uInstA[8];
  uniform vec4 uInstB[8];

  uniform bool uProcedural;
  uniform bool uShowProcedural;

  uniform float uThreshold;
  uniform float uSharpness;
  uniform float uThickness;
  uniform float uDeform;
  uniform float uAmount;
  uniform vec3  uColor;

  uniform float uCount;
  uniform float uSize;
  uniform float uStretch;
  uniform float uWaviness;
  uniform float uProcScale;
  uniform float uProcPosX;
  uniform float uProcPosY;
  uniform float uProcRotation;
  uniform bool  uTileable;
  uniform float uSeed;

  uniform vec2 uRepeat;
  uniform float uRotation;

  uniform vec3 uLightDir;
  uniform vec3 uCameraPos;

  uniform bool uGeoLimitEnabled;
  uniform int  uGeoLimitMode;
  uniform float uGeoLimitSoftness;
  uniform bool uGeoLimitInvert;

  uniform sampler2D uUvMask;
  uniform bool uUvMaskEnabled;

  uniform bool uTriplanarEnabled;
  uniform vec3 uModelMin;
  uniform vec3 uModelMax;
  uniform float uTriScale;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

  float snoise2(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                            + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  vec2 triplanarUV(vec3 worldPos, vec3 nrm, float scale) {
    vec3 p = worldPos * scale;
    vec3 n = normalize(nrm);
    vec3 w = vec3(abs(n.x), abs(n.y), abs(n.z));
    w = w * w * w * w;
    float sum = max(w.x + w.y + w.z, 1e-6);
    w /= sum;

    vec2 uv_x = p.yz;
    vec2 uv_y = p.xz;
    vec2 uv_z = p.xy;

    return uv_x * w.x + uv_y * w.y + uv_z * w.z;
  }

  vec2 triplanarMaskUV(vec2 triUV, vec2 repeat, float rotation) {
    vec2 t = triUV - 0.5;
    float cs = cos(-rotation);
    float sn = sin(-rotation);
    t = vec2(t.x * cs - t.y * sn, t.x * sn + t.y * cs);
    t = t * repeat + 0.5;
    return t;
  }

  float hash2i(int x, int y) {
    uint h = uint(x) * 374761393u + uint(y) * 668265263u;
    h = h * 1274126177u;
    h = h ^ (h >> 13u);
    h = h * 1274126177u;
    return float((h ^ (h >> 16u)) & 0xFFFFFFu) / 16777215.0;
  }

  float valueNoise(vec2 p) {
    int x0 = int(floor(p.x));
    int y0 = int(floor(p.y));
    float fx = p.x - float(x0);
    float fy = p.y - float(y0);
    float sx = fx * fx * (3.0 - 2.0 * fx);
    float sy = fy * fy * (3.0 - 2.0 * fy);

    float p00 = hash2i(x0, y0);
    float p10 = hash2i(x0 + 1, y0);
    float p01 = hash2i(x0, y0 + 1);
    float p11 = hash2i(x0 + 1, y0 + 1);

    float top = p00 * (1.0 - sx) + p10 * sx;
    float bot = p01 * (1.0 - sx) + p11 * sx;
    return top * (1.0 - sy) + bot * sy;
  }

  vec4 pickMask(int i, vec2 uv) {
    if (i == 0) return texture2D(uMask0, uv);
    else if (i == 1) return texture2D(uMask1, uv);
    else if (i == 2) return texture2D(uMask2, uv);
    else if (i == 3) return texture2D(uMask3, uv);
    else if (i == 4) return texture2D(uMask4, uv);
    else if (i == 5) return texture2D(uMask5, uv);
    else if (i == 6) return texture2D(uMask6, uv);
    else if (i == 7) return texture2D(uMask7, uv);
    else return vec4(0.0);
  }

  float sampleMask(int i, vec2 uv) {
    vec4 a = uInstA[i];
    vec4 b = uInstB[i];
    vec2 c = uv - 0.5 - vec2(a.x, a.y);
    float cs = cos(-a.w);
    float sn = sin(-a.w);
    vec2 r = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs);
    r /= max(a.z, 0.001);
    r.x *= b.x;
    r.y *= b.y;
    vec2 m = r + 0.5;
    if (b.z < 0.5) {
      if (m.x < 0.0 || m.x > 1.0 || m.y < 0.0 || m.y > 1.0) return 0.0;
      return pickMask(i, m).r;
    }
    m = fract(m);
    return pickMask(i, m).r;
  }

  float geoFactor() {
    if (!uGeoLimitEnabled) return 1.0;

    vec3 gn = normalize(vNormal);

    float base;
    if (uGeoLimitMode == 1) base = max(gn.y, 0.0);
    else if (uGeoLimitMode == 2) base = max(-gn.y, 0.0);
    else if (uGeoLimitMode == 3) base = abs(gn.y);
    else base = 1.0 - abs(gn.y);

    float edge = uGeoLimitSoftness * 0.5;
    float lo = 0.5 - edge;
    float hi = 0.5 + edge;
    float t = clamp((base - lo) / max(hi - lo, 1e-6), 0.0, 1.0);
    float f = t * t * (3.0 - 2.0 * t);
    if (uGeoLimitInvert) f = 1.0 - f;
    return f;
  }

  float proceduralStreaksBody(vec2 maskUv) {
    vec2 uvi = maskUv;

    uvi.x -= uProcPosX;
    uvi.y -= uProcPosY;

    float r = -uProcRotation * 3.14159265 / 180.0;
    float cs_r = cos(r);
    float sn_r = sin(r);
    vec2 c = uvi - 0.5;
    uvi = vec2(c.x * cs_r - c.y * sn_r, c.x * sn_r + c.y * cs_r) + 0.5;

    if (uTileable) {
      uvi.x = fract(uvi.x);
      uvi.y = fract(uvi.y);
    }

    float vi = mod(uSeed, 1000.0) / 1000.0;
    float freqScale = (0.3 + (uCount / 100.0) * 2.7) * (0.85 + vi * 0.30);
    float baseFreq = (1.0 / max(uSize, 0.001)) * 0.5 * freqScale;
    float octaves = 3.0 + min(uCount / 25.0, 5.0);
    float thrEff = uThreshold * 0.35 * (0.9 + vi * 0.2);

    float offx = mod(floor(uSeed), 100.0) * 0.1;
    float offy = mod(floor(uSeed / 100.0), 100.0) * 0.1;

    vec2 uv_s = vec2(uvi.x + offx, uvi.y / uStretch + offy);

    float sum = 0.0;
    float amp = 0.5;
    float freq = baseFreq / uProcScale;
    float totalAmp = 0.0;
    int oct = int(octaves);
    for (int i = 0; i < 8; i++) {
      if (i >= oct) break;
      float n = valueNoise(uv_s * freq);
      sum += n * amp;
      totalAmp += amp;
      amp *= 0.5;
      freq *= 2.0;
    }
    float nFinal = totalAmp > 0.0 ? sum / totalAmp : 0.0;

    float shifted = clamp(nFinal - thrEff, 0.0, 1.0);
    float window = 0.5 - uSharpness * 0.4;
    float e0 = 0.5 - window * 0.5;
    float e1 = 0.5 + window * 0.5;
    float tt = clamp((shifted - e0) / (e1 - e0), 0.0, 1.0);
    return tt * tt * (3.0 - 2.0 * tt);
  }

  void main() {
    vec2 tiledUv = vUv - 0.5;
    float cs = cos(-uRotation);
    float sn = sin(-uRotation);
    tiledUv = vec2(tiledUv.x * cs - tiledUv.y * sn, tiledUv.x * sn + tiledUv.y * cs);
    tiledUv = tiledUv * uRepeat + 0.5;

    vec2 uv = tiledUv;

    vec2 maskUv;
    if (uTriplanarEnabled) {
      vec3 p = (vWorldPos - uModelMin) / max(uModelMax - uModelMin, vec3(1e-6));
      vec2 tri = triplanarUV(p, vNormal, uTriScale);
      maskUv = triplanarMaskUV(tri, uRepeat, uRotation);
    } else {
      maskUv = uv;
    }

    vec2 warpedUv = maskUv;
    if (uDeform > 0.01 && !uProcedural) {
      float nx = snoise2(maskUv * 3.0);
      float ny = snoise2(maskUv * 3.0 + vec2(100.0, 100.0));
      warpedUv += vec2(nx, ny) * 0.1 * uDeform;
    }

    float body = 0.0;
    if (uProcedural && uShowProcedural) {
      body = proceduralStreaksBody(maskUv);
    } else if (!uProcedural) {
      float best = 0.0;
      for (int i = 0; i < MAX_MASKS; i++) {
        if (i >= uInstanceCount) break;
        float v = sampleMask(i, warpedUv);
        best = max(best, v);
      }

      float shifted = clamp(best - uThreshold * 0.5, 0.0, 1.0);
      float window = 0.5 - uSharpness * 0.4;
      body = smoothstep(0.5 - window * 0.5, 0.5 + window * 0.5, shifted);
    }

    float gf = geoFactor();
    body *= gf;

    float uv_m = 1.0;
    if (uUvMaskEnabled) {
      uv_m = texture2D(uUvMask, uv).r;
      body *= uv_m;
    }

    vec3 albedo = vec3(0.6, 0.6, 0.6);
    if (uHasAlbedo) albedo = texture2D(uAlbedoTex, uv).rgb;

    albedo = mix(albedo, uColor, body * uAmount);

    vec3 nrm = normalize(vNormal);
    if (uHasNormal) {
      vec3 texN = texture2D(uNormalTex, uv).rgb * 2.0 - 1.0;
      nrm = normalize(nrm + texN * 0.5);
    }

    // Толщина — работает и в procedural, и в mask
    if (abs(uThickness) > 0.01 && uAmount > 0.01) {
      float eps = 1.0 / 512.0;
      float bx1 = 0.0, bx2 = 0.0, by1 = 0.0, by2 = 0.0;

      if (uProcedural && uShowProcedural) {
        bx1 = proceduralStreaksBody(maskUv + vec2(eps, 0.0));
        bx2 = proceduralStreaksBody(maskUv - vec2(eps, 0.0));
        by1 = proceduralStreaksBody(maskUv + vec2(0.0, eps));
        by2 = proceduralStreaksBody(maskUv - vec2(0.0, eps));
      } else if (!uProcedural) {
        for (int i = 0; i < MAX_MASKS; i++) {
          if (i >= uInstanceCount) break;
          bx1 = max(bx1, sampleMask(i, warpedUv + vec2(eps, 0.0)));
          bx2 = max(bx2, sampleMask(i, warpedUv - vec2(eps, 0.0)));
          by1 = max(by1, sampleMask(i, warpedUv + vec2(0.0, eps)));
          by2 = max(by2, sampleMask(i, warpedUv - vec2(0.0, eps)));
        }
      }

      float gx = (bx1 - bx2) * 8.0 * uThickness * gf;
      float gy = (by1 - by2) * 8.0 * uThickness * gf;
      if (uUvMaskEnabled) {
        gx *= uv_m;
        gy *= uv_m;
      }
      vec3 tangent = normalize(cross(nrm, vec3(0.0, 0.0, 1.0)) + vec3(1e-5));
      vec3 bitangent = cross(nrm, tangent);
      nrm = normalize(nrm - tangent * gx - bitangent * gy);
    }

    vec3 N = normalize(nrm);
    vec3 L = normalize(uLightDir);
    vec3 V = normalize(uCameraPos - vWorldPos);
    vec3 H = normalize(L + V);

    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, H), 0.0), 32.0);

    float rough = 0.7;
    if (uHasRough) rough = texture2D(uRoughTex, uv).r;
    rough = clamp(rough + body * uAmount * 0.5, 0.0, 1.0);

    vec3 ambient = vec3(0.15);
    vec3 color = ambient * albedo + albedo * diff * 1.2 + vec3(spec) * (1.0 - rough);
    color = color / (color + vec3(1.0));
    color = pow(color, vec3(1.0 / 2.2));

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createStreaksMaterial(albedoTex, normalTex, roughTex) {
  const uniforms = {
    uAlbedoTex: { value: albedoTex || null },
    uNormalTex: { value: normalTex || null },
    uRoughTex:  { value: roughTex  || null },
    uHasAlbedo: { value: !!albedoTex },
    uHasNormal: { value: !!normalTex },
    uHasRough:  { value: !!roughTex  },

    uMask0: { value: null }, uMask1: { value: null },
    uMask2: { value: null }, uMask3: { value: null },
    uMask4: { value: null }, uMask5: { value: null },
    uMask6: { value: null }, uMask7: { value: null },
    uMaskCount:     { value: 0 },
    uInstanceCount: { value: 0 },

    uInstA: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
    uInstB: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },

    uProcedural: { value: true },
    uShowProcedural: { value: true },

    uThreshold: { value: 0.2 },
    uSharpness: { value: 0.6 },
    uThickness: { value: 0.35 },
    uDeform:    { value: 0.3 },
    uAmount:    { value: 0.9 },
    uColor:     { value: new THREE.Color(95/255, 85/255, 75/255) },

    uCount:      { value: 28.0 },
    uSize:       { value: 0.015 },
    uStretch:    { value: 20.0 },
    uWaviness:   { value: 0.0 },
    uProcScale:  { value: 1.0 },
    uProcPosX:   { value: 0.0 },
    uProcPosY:   { value: 0.0 },
    uProcRotation: { value: 0.0 },
    uTileable:   { value: true },
    uSeed:       { value: 1.0 },

    uRepeat:   { value: new THREE.Vector2(1.0, 1.0) },
    uRotation: { value: 0.0 },

    uLightDir:  { value: new THREE.Vector3(3.0, 4.0, 5.0).normalize() },
    uCameraPos: { value: new THREE.Vector3(0.0, 0.0, 3.0) },

    uGeoLimitEnabled:  { value: false },
    uGeoLimitMode:     { value: 0 },
    uGeoLimitSoftness: { value: 0.5 },
    uGeoLimitInvert:   { value: false },

    uUvMask:        { value: null },
    uUvMaskEnabled: { value: false },

    uTriplanarEnabled: { value: false },
    uModelMin:         { value: new THREE.Vector3(-0.5, -0.5, -0.5) },
    uModelMax:         { value: new THREE.Vector3(0.5, 0.5, 0.5) },
    uTriScale:         { value: 2.0 },
  };

  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
  });
}

export function updateStreaksUniforms(material, opts) {
  const u = material.uniforms;

  const masks = opts.masks || [];
  const instances = opts.transforms || opts.instances || [];
  const maskCount = Math.min(masks.length, MAX_MASKS);
  const instanceCount = Math.min(instances.length, MAX_MASKS);

  const slots = [u.uMask0, u.uMask1, u.uMask2, u.uMask3, u.uMask4, u.uMask5, u.uMask6, u.uMask7];
  for (let i = 0; i < MAX_MASKS; i++) {
    if (i < instanceCount && maskCount > 0) {
      slots[i].value = masks[i % maskCount];
    } else {
      slots[i].value = null;
    }
  }

  u.uMaskCount.value = maskCount;
  u.uInstanceCount.value = instanceCount;

  for (let i = 0; i < MAX_MASKS; i++) {
    const it = instances[i] || { offsetX: 0, offsetY: 0, scale: 1, rotation: 0, flipX: 1, flipY: 1, tileable: true };
    u.uInstA.value[i].set(it.offsetX, it.offsetY, it.scale, it.rotation);
    u.uInstB.value[i].set(it.flipX, it.flipY, (it.tileable === false) ? 0.0 : 1.0, 0);
  }

  if (opts.procedural !== undefined) u.uProcedural.value = !!opts.procedural;
  if (opts.showProcedural !== undefined) u.uShowProcedural.value = !!opts.showProcedural;

  u.uThreshold.value = opts.threshold ?? 0.2;
  u.uSharpness.value = opts.sharpness ?? 0.6;
  u.uThickness.value = opts.thickness ?? 0.35;
  u.uDeform.value    = opts.deform ?? 0.3;
  u.uAmount.value    = opts.amount ?? 0.9;

  if (opts.color) {
    u.uColor.value.setRGB(opts.color[0]/255, opts.color[1]/255, opts.color[2]/255);
  }

  if (opts.count !== undefined)     u.uCount.value = opts.count;
  if (opts.size !== undefined)      u.uSize.value = opts.size;
  if (opts.stretch !== undefined)   u.uStretch.value = opts.stretch;
  if (opts.waviness !== undefined)  u.uWaviness.value = opts.waviness;
  if (opts.procScale !== undefined) u.uProcScale.value = opts.procScale;
  if (opts.posX !== undefined)      u.uProcPosX.value = opts.posX;
  if (opts.posY !== undefined)      u.uProcPosY.value = opts.posY;
  if (opts.rotation !== undefined)  u.uProcRotation.value = opts.rotation;
  if (opts.disableTiling !== undefined) u.uTileable.value = !opts.disableTiling;
  if (opts.seed !== undefined)      u.uSeed.value = opts.seed;

  u.uRepeat.value.set(opts.repeatX ?? 1.0, opts.repeatY ?? 1.0);
  u.uRotation.value = (opts.rotationDeg ?? 0) * Math.PI / 180.0;

  if (opts.albedoTex !== undefined) {
    u.uAlbedoTex.value = opts.albedoTex;
    u.uHasAlbedo.value = !!opts.albedoTex;
  }
  if (opts.normalTex !== undefined) {
    u.uNormalTex.value = opts.normalTex;
    u.uHasNormal.value = !!opts.normalTex;
  }
  if (opts.roughTex !== undefined) {
    u.uRoughTex.value = opts.roughTex;
    u.uHasRough.value = !!opts.roughTex;
  }

  if (opts.geoLimitEnabled !== undefined) u.uGeoLimitEnabled.value = !!opts.geoLimitEnabled;
  if (opts.geoLimitMode !== undefined) u.uGeoLimitMode.value = opts.geoLimitMode;
  if (opts.geoLimitSoftness !== undefined) u.uGeoLimitSoftness.value = opts.geoLimitSoftness;
  if (opts.geoLimitInvert !== undefined) u.uGeoLimitInvert.value = !!opts.geoLimitInvert;

  if (opts.uvMask !== undefined) {
    u.uUvMask.value = opts.uvMask;
    u.uUvMaskEnabled.value = !!opts.uvMask;
  }

  if (opts.triplanarEnabled !== undefined) u.uTriplanarEnabled.value = !!opts.triplanarEnabled;
  if (opts.modelMin) u.uModelMin.value.set(opts.modelMin[0], opts.modelMin[1], opts.modelMin[2]);
  if (opts.modelMax) u.uModelMax.value.set(opts.modelMax[0], opts.modelMax[1], opts.modelMax[2]);
  if (opts.triScale !== undefined) u.uTriScale.value = opts.triScale;
}