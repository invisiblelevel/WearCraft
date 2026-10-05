// Шейдер для превью Streaks. Процедурно (fbm + vertical stretch) ИЛИ маски.
import * as THREE from 'three';

export const MAX_MASKS = 8;

const VERT = /* glsl */`
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */`
  precision highp float;
  precision highp int;

  #define MAX_MASKS 8
  #define PI 3.14159265359
  #define TAU 6.28318530718

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

  uniform float uProcedural;

  uniform float uCount;
  uniform float uSize;
  uniform float uStretch;
  uniform float uWaviness;
  uniform float uProcScale;
  uniform float uProcPosX;
  uniform float uProcPosY;
  uniform float uProcRotation;
  uniform float uTileable;

  uniform float uThreshold;
  uniform float uSharpness;
  uniform float uDeform;
  uniform float uThickness;
  uniform float uAmount;
  uniform vec3  uColor;

  uniform uint uSeed;

  uniform vec2 uRepeat;
  uniform float uRotation;

  uniform vec3 uLightDir;
  uniform vec3 uCameraPos;

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

  // Рабочий хэш — тот, что давал потёки. БЕЗ seed.
  float hash2i(ivec2 p) {
    uint h = uint(p.x) * 374761393u + uint(p.y) * 668265263u;
    h = (h ^ (h >> 13u)) * 1274126177u;
    return float((h ^ (h >> 16u)) & 0xFFFFFFu) / 16777215.0;
  }

  // Value noise — рабочий. БЕЗ seed.
  float value_noise(vec2 p) {
    vec2 p0 = floor(p);
    ivec2 i0 = ivec2(p0);
    vec2 f = p - p0;
    vec2 s = f * f * (3.0 - 2.0 * f);

    float p00 = hash2i(i0);
    float p10 = hash2i(i0 + ivec2(1, 0));
    float p01 = hash2i(i0 + ivec2(0, 1));
    float p11 = hash2i(i0 + ivec2(1, 1));

    float top = mix(p00, p10, s.x);
    float bot = mix(p01, p11, s.x);
    return mix(top, bot, s.y);
  }

  // ═══ Основная функция: fbm + вертикальный stretch ═══
  float proceduralBodyLimit(vec2 uv, int max_octaves) {
    if (uTileable < 0.5) {
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
    }

    float count = clamp(uCount, 5.0, 100.0);
    float size = clamp(uSize, 0.001, 0.10);
    float stretch = clamp(uStretch, 1.0, 20.0);
    float scale = clamp(uProcScale, 0.1, 5.0);

    // ─── Per-variation модуляция (форма та же, узор другой) ───
    float vi = float(uSeed % 1000u) * 0.001;   // 0..1, разное для каждой вариации

    // Частота: ±15%
    float freq_scale = (0.3 + (count / 100.0) * 2.7) * (0.85 + vi * 0.30);
    float base_freq = (1.0 / max(size, 0.001)) * 0.5 * freq_scale;
    int octaves = int(3.0 + min(count / 25.0, 5.0));
    if (octaves > max_octaves) octaves = max_octaves;

    // Растяжение по Y.
    vec2 uv_s = vec2(uv.x, uv.y / stretch);

    // Сдвиг UV: 0..10 единиц. Маленький — форма сохраняется.
    float offx = float(uSeed % 100u) * 0.1;
    float offy = float((uSeed / 100u) % 100u) * 0.1;
    uv_s += vec2(offx, offy);

    float sum = 0.0;
    float amp = 0.5;
    float freq = base_freq / scale;
    float total_amp = 0.0;
    for (int i = 0; i < 8; i++) {
      if (i >= octaves) break;
      float n = value_noise(uv_s * freq);
      sum += n * amp;
      total_amp += amp;
      amp *= 0.5;
      freq *= 2.0;
    }
    float n_final = total_amp > 0.0 ? sum / total_amp : 0.0;

    float thr_eff = uThreshold * 0.35 * (0.9 + vi * 0.2);   // Порог: ±10%
    float shifted = clamp(n_final - thr_eff, 0.0, 1.0);
    float window = 0.5 - uSharpness * 0.4;
    return smoothstep(0.5 - window * 0.5, 0.5 + window * 0.5, shifted);
  }

  float proceduralBody(vec2 uv) {
    return proceduralBodyLimit(uv, 8);
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
    float offsetX = a.x;
    float offsetY = a.y;
    float scale   = a.z;
    float rot     = a.w;
    float flipX   = b.x;
    float flipY   = b.y;
    float tileable = b.z;

    vec2 c = uv - 0.5 - vec2(offsetX, offsetY);
    float cs = cos(-rot);
    float sn = sin(-rot);
    vec2 r = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs);
    r /= max(scale, 0.001);
    r.x *= flipX;
    r.y *= flipY;
    vec2 m = r + 0.5;

    if (tileable < 0.5) {
      if (m.x < 0.0 || m.x > 1.0 || m.y < 0.0 || m.y > 1.0) return 0.0;
      return pickMask(i, m).r;
    }

    m = fract(m);
    return pickMask(i, m).r;
  }

  float maskBody(vec2 warpedUv) {
    float best = 0.0;
    for (int i = 0; i < MAX_MASKS; i++) {
      if (i >= uInstanceCount) break;
      float v = sampleMask(i, warpedUv);
      best = max(best, v);
    }
    float shifted = clamp(best - uThreshold * 0.5, 0.0, 1.0);
    float window = 0.5 - uSharpness * 0.4;
    return smoothstep(0.5 - window * 0.5, 0.5 + window * 0.5, shifted);
  }

  void main() {
    vec2 tiledUv = vUv - 0.5;
    float cs = cos(-uRotation);
    float sn = sin(-uRotation);
    tiledUv = vec2(tiledUv.x * cs - tiledUv.y * sn, tiledUv.x * sn + tiledUv.y * cs);
    tiledUv = tiledUv * uRepeat + 0.5;

    float body;

    if (uProcedural > 0.5) {
      vec2 uv = tiledUv;
      float csp = cos(-uProcRotation);
      float snp = sin(-uProcRotation);
      vec2 c = uv - 0.5 - vec2(uProcPosX, uProcPosY);
      uv = vec2(c.x * csp - c.y * snp + 0.5, c.x * snp + c.y * csp + 0.5);
      if (uTileable > 0.5) {
        uv = fract(uv);
      }
      body = proceduralBody(uv);
    } else {
      vec2 uv = tiledUv;
      vec2 warpedUv = uv;
      if (uDeform > 0.01) {
        float nx = snoise2(uv * 3.0);
        float ny = snoise2(uv * 3.0 + vec2(100.0, 100.0));
        warpedUv += vec2(nx, ny) * 0.1 * uDeform;
      }
      body = maskBody(warpedUv);
    }

    vec3 albedo = vec3(0.6, 0.6, 0.6);
    if (uHasAlbedo) albedo = texture2D(uAlbedoTex, tiledUv).rgb;

    albedo = mix(albedo, uColor, body * uAmount);

    vec3 nrm = normalize(vNormal);
    if (uHasNormal) {
      vec3 texN = texture2D(uNormalTex, tiledUv).rgb * 2.0 - 1.0;
      nrm = normalize(nrm + texN * 0.5);
    }

    if (uThickness > 0.01 && uAmount > 0.01 && body > 0.02 && body < 0.98) {
      float eps = 1.0 / 512.0;
      float bx1, bx2, by1, by2;

      if (uProcedural > 0.5) {
        const int SOBEL_OCT = 6;
        vec2 uv = tiledUv;
        float csp = cos(-uProcRotation);
        float snp = sin(-uProcRotation);
        vec2 c = uv - 0.5 - vec2(uProcPosX, uProcPosY);
        uv = vec2(c.x * csp - c.y * snp + 0.5, c.x * snp + c.y * csp + 0.5);
        if (uTileable > 0.5) uv = fract(uv);
        bx1 = proceduralBodyLimit(uv + vec2(eps, 0.0), SOBEL_OCT);
        bx2 = proceduralBodyLimit(uv - vec2(eps, 0.0), SOBEL_OCT);
        by1 = proceduralBodyLimit(uv + vec2(0.0, eps), SOBEL_OCT);
        by2 = proceduralBodyLimit(uv - vec2(0.0, eps), SOBEL_OCT);
      } else {
        vec2 uv = tiledUv;
        vec2 wuv = uv;
        if (uDeform > 0.01) {
          float nx = snoise2(uv * 3.0);
          float ny = snoise2(uv * 3.0 + vec2(100.0, 100.0));
          wuv += vec2(nx, ny) * 0.1 * uDeform;
        }
        bx1 = maskBody(wuv + vec2(eps, 0.0));
        bx2 = maskBody(wuv - vec2(eps, 0.0));
        by1 = maskBody(wuv + vec2(0.0, eps));
        by2 = maskBody(wuv - vec2(0.0, eps));
      }

      float gx = (bx1 - bx2) * 8.0 * uThickness;
      float gy = (by1 - by2) * 8.0 * uThickness;
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
    if (uHasRough) rough = texture2D(uRoughTex, tiledUv).r;
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

    uProcedural: { value: 1.0 },

    uCount:        { value: 28.0 },
    uSize:         { value: 0.015 },
    uStretch:      { value: 20.0 },
    uWaviness:     { value: 0.0 },
    uProcScale:    { value: 1.0 },
    uProcPosX:     { value: 0.0 },
    uProcPosY:     { value: 0.0 },
    uProcRotation: { value: 0.0 },
    uTileable:     { value: 1.0 },

    uThreshold: { value: 0.2 },
    uSharpness: { value: 0.6 },
    uDeform:    { value: 0.3 },
    uThickness: { value: 0.35 },
    uAmount:    { value: 0.9 },
    uColor:     { value: new THREE.Color(95/255, 85/255, 75/255) },

    uSeed:     { value: 0 },

    uRepeat:   { value: new THREE.Vector2(1.0, 1.0) },
    uRotation: { value: 0.0 },

    uLightDir:  { value: new THREE.Vector3(3.0, 4.0, 5.0).normalize() },
    uCameraPos: { value: new THREE.Vector3(0.0, 0.0, 3.0) },
  };

  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
  });
}

export function updateStreaksUniforms(material, opts) {
  const u = material.uniforms;

  u.uProcedural.value = opts.procedural ? 1.0 : 0.0;

  u.uThreshold.value = opts.threshold ?? 0.2;
  u.uSharpness.value = opts.sharpness ?? 0.6;
  u.uThickness.value = opts.thickness ?? 0.35;
  u.uAmount.value    = opts.amount ?? 0.9;

  if (opts.color) {
    u.uColor.value.setRGB(opts.color[0]/255, opts.color[1]/255, opts.color[2]/255);
  }

  if (opts.procedural) {
    u.uCount.value        = opts.count ?? 28.0;
    u.uSize.value         = opts.size ?? 0.015;
    u.uStretch.value      = opts.stretch ?? 20.0;
    u.uWaviness.value     = opts.waviness ?? 0.0;
    u.uProcScale.value    = opts.procScale ?? 1.0;
    u.uProcPosX.value     = opts.posX ?? 0.0;
    u.uProcPosY.value     = opts.posY ?? 0.0;
    u.uProcRotation.value = (opts.rotation ?? 0.0) * Math.PI / 180.0;
    u.uTileable.value     = (opts.disableTiling === true) ? 0.0 : 1.0;

    const varSeed = ((opts.seed ?? 0) + 7919) >>> 0;
    u.uSeed.value = varSeed;
  } else {
    u.uDeform.value = opts.deform ?? 0.3;

    const masks = opts.masks || [];
    const instances = opts.transforms || [];
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
  }

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
}