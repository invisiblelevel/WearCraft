// Шейдер для превью Rust. Instances передаются снаружи (см. instances.js).
// + Ограничение по геометрии через vNormal.
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

  uniform float uThreshold;
  uniform float uSharpness;
  uniform float uDeform;
  uniform float uVolume;
  uniform float uAmount;

  uniform vec2 uRepeat;
  uniform float uRotation;

  uniform vec3 uLightDir;
  uniform vec3 uCameraPos;

  uniform bool uGeoLimitEnabled;
  uniform int  uGeoLimitMode;
  uniform float uGeoLimitSoftness;
  uniform bool uGeoLimitInvert;

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

  void main() {
    vec2 tiledUv = vUv - 0.5;
    float cs = cos(-uRotation);
    float sn = sin(-uRotation);
    tiledUv = vec2(tiledUv.x * cs - tiledUv.y * sn, tiledUv.x * sn + tiledUv.y * cs);
    tiledUv = tiledUv * uRepeat + 0.5;

    vec2 uv = tiledUv;

    vec2 warpedUv = uv;
    if (uDeform > 0.01) {
      float nx = snoise2(uv * 3.0);
      float ny = snoise2(uv * 3.0 + vec2(100.0, 100.0));
      warpedUv += vec2(nx, ny) * 0.1 * uDeform;
    }

    float best = 0.0;
    for (int i = 0; i < MAX_MASKS; i++) {
      if (i >= uInstanceCount) break;
      float v = sampleMask(i, warpedUv);
      best = max(best, v);
    }

    float shifted = clamp(best - uThreshold * 0.5, 0.0, 1.0);
    float window = 0.5 - uSharpness * 0.4;
    float body = smoothstep(0.5 - window * 0.5, 0.5 + window * 0.5, shifted);

    float gf = geoFactor();
    body *= gf;

    float core = smoothstep(0.7, 0.95, body);
    float edge = smoothstep(0.0, 0.5, body - 0.3) * (1.0 - smoothstep(0.7, 0.95, body));

    vec3 colCore = vec3(70.0, 35.0, 15.0) / 255.0;
    vec3 colBody = vec3(150.0, 75.0, 30.0) / 255.0;
    vec3 colEdge = vec3(205.0, 130.0, 65.0) / 255.0;

    vec3 albedo = vec3(0.6, 0.6, 0.6);
    if (uHasAlbedo) albedo = texture2D(uAlbedoTex, uv).rgb;

    albedo = mix(albedo, colEdge, edge * uAmount * 0.55);
    albedo = mix(albedo, colBody, body * uAmount);
    albedo = mix(albedo, colCore, core * uAmount * 0.9);

    vec3 nrm = normalize(vNormal);
    if (uHasNormal) {
      vec3 texN = texture2D(uNormalTex, uv).rgb * 2.0 - 1.0;
      nrm = normalize(nrm + texN * 0.5);
    }

    if (abs(uVolume) > 0.01 && uAmount > 0.01) {
      float eps = 1.0 / 512.0;
      float bx1 = 0.0, bx2 = 0.0, by1 = 0.0, by2 = 0.0;
      for (int i = 0; i < MAX_MASKS; i++) {
        if (i >= uInstanceCount) break;
        bx1 = max(bx1, sampleMask(i, warpedUv + vec2(eps, 0.0)));
        bx2 = max(bx2, sampleMask(i, warpedUv - vec2(eps, 0.0)));
        by1 = max(by1, sampleMask(i, warpedUv + vec2(0.0, eps)));
        by2 = max(by2, sampleMask(i, warpedUv - vec2(0.0, eps)));
      }
      float gx = (bx1 - bx2) * 8.0 * uVolume * gf;
      float gy = (by1 - by2) * 8.0 * uVolume * gf;
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

    float roughBoost = body * uAmount * 0.5 + core * uAmount * 0.35;
    rough = clamp(rough + roughBoost, 0.0, 1.0);

    vec3 ambient = vec3(0.15);
    vec3 color = ambient * albedo + albedo * diff * 1.2 + vec3(spec) * (1.0 - rough);
    color = color / (color + vec3(1.0));
    color = pow(color, vec3(1.0 / 2.2));

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createRustMaterial(albedoTex, normalTex, roughTex) {
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

    uThreshold: { value: 0.5 },
    uSharpness: { value: 0.5 },
    uDeform:    { value: 0.5 },
    uVolume:    { value: 0.0 },
    uAmount:    { value: 0.7 },

    uRepeat:   { value: new THREE.Vector2(1.0, 1.0) },
    uRotation: { value: 0.0 },

    uLightDir:  { value: new THREE.Vector3(3.0, 4.0, 5.0).normalize() },
    uCameraPos: { value: new THREE.Vector3(0.0, 0.0, 3.0) },

    uGeoLimitEnabled:  { value: false },
    uGeoLimitMode:     { value: 0 },
    uGeoLimitSoftness: { value: 0.5 },
    uGeoLimitInvert:   { value: false },
  };

  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
  });
}

export function updateRustUniforms(material, opts) {
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

  u.uThreshold.value = opts.threshold ?? 0.5;
  u.uSharpness.value = opts.sharpness ?? 0.5;
  u.uDeform.value    = opts.deform ?? 0.5;
  u.uVolume.value    = opts.volume ?? 0.0;
  u.uAmount.value    = opts.amount ?? 0.7;

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
}