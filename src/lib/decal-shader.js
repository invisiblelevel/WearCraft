// Шейдер Decal (одна текстура + опциональный height).
// Не пул как в dirt/rust/streaks — одна проекция UV.
import * as THREE from 'three';

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

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec2 vUv;

  uniform sampler2D uAlbedoTex;
  uniform sampler2D uNormalTex;
  uniform sampler2D uRoughTex;
  uniform bool uHasAlbedo;
  uniform bool uHasNormal;
  uniform bool uHasRough;

  uniform sampler2D uDecalTex;
  uniform sampler2D uHeightTex;
  uniform bool uHasDecal;
  uniform bool uHasHeight;

  uniform float uPosX;
  uniform float uPosY;
  uniform float uScale;
  uniform float uScaleY;
  uniform float uRotation;
  uniform float uOpacity;
  uniform float uAmountAlbedo;
  uniform float uAmountRough;
  uniform float uAmountNormal;
  uniform float uHeightIntensity;
  uniform bool  uTileEdge;

  uniform vec3 uLightDir;
  uniform vec3 uCameraPos;

  void main() {
    vec2 uv = vUv;

    // ── Базовая модель PBR ──
    vec3 albedo = vec3(0.6);
    if (uHasAlbedo) albedo = texture2D(uAlbedoTex, uv).rgb;

    float rough = 0.7;
    if (uHasRough) rough = texture2D(uRoughTex, uv).r;

    vec3 nrm = normalize(vNormal);
    if (uHasNormal) {
      vec3 texN = texture2D(uNormalTex, uv).rgb * 2.0 - 1.0;
      nrm = normalize(nrm + texN * 0.5);
    }

    // ── Decal ──
    if (uHasDecal) {
      vec2 c = uv - 0.5 - vec2(uPosX, uPosY);
      float cs = cos(-uRotation);
      float sn = sin(-uRotation);
      vec2 r = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs);
      r /= vec2(max(uScale, 0.001), max(uScaleY, 0.001));
      vec2 decalUv = r + 0.5;

      bool inRange = true;
      if (uTileEdge) {
        decalUv = fract(decalUv);
      } else {
        inRange = (decalUv.x >= 0.0 && decalUv.x <= 1.0 &&
                   decalUv.y >= 0.0 && decalUv.y <= 1.0);
      }

      if (inRange) {
        vec4 decal = texture2D(uDecalTex, decalUv);
        float mask = decal.a * uOpacity;

        if (uAmountAlbedo > 0.001) {
          albedo = mix(albedo, decal.rgb, mask * uAmountAlbedo);
        }

        if (uAmountRough > 0.001) {
          rough = clamp(rough + mask * uAmountRough, 0.0, 1.0);
        }

        // Height → нормали (Sobel).
        // Если height-карты нет — яркость самой decal-картинки.
        if (abs(uHeightIntensity) > 0.001 && uAmountNormal > 0.001) {
          float eps = 1.0 / 512.0;
          float hL, hR, hD, hU;
          if (uHasHeight) {
            hL = texture2D(uHeightTex, decalUv - vec2(eps, 0.0)).r;
            hR = texture2D(uHeightTex, decalUv + vec2(eps, 0.0)).r;
            hD = texture2D(uHeightTex, decalUv - vec2(0.0, eps)).r;
            hU = texture2D(uHeightTex, decalUv + vec2(0.0, eps)).r;
          } else {
            vec3 cL = texture2D(uDecalTex, decalUv - vec2(eps, 0.0)).rgb;
            vec3 cR = texture2D(uDecalTex, decalUv + vec2(eps, 0.0)).rgb;
            vec3 cD = texture2D(uDecalTex, decalUv - vec2(0.0, eps)).rgb;
            vec3 cU = texture2D(uDecalTex, decalUv + vec2(0.0, eps)).rgb;
            hL = (cL.r + cL.g + cL.b) * 0.3333;
            hR = (cR.r + cR.g + cR.b) * 0.3333;
            hD = (cD.r + cD.g + cD.b) * 0.3333;
            hU = (cU.r + cU.g + cU.b) * 0.3333;
          }
          float gx = (hR - hL) * uHeightIntensity;
          float gy = (hU - hD) * uHeightIntensity;
          vec3 tangent = normalize(cross(nrm, vec3(0.0, 0.0, 1.0)) + vec3(1e-5));
          vec3 bitangent = cross(nrm, tangent);
          nrm = normalize(nrm - tangent * gx * 4.0 - bitangent * gy * 4.0);
        }
      }
    }

    // ── Свет ──
    vec3 N = normalize(nrm);
    vec3 L = normalize(uLightDir);
    vec3 V = normalize(uCameraPos - vWorldPos);
    vec3 H = normalize(L + V);

    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, H), 0.0), 32.0);

    vec3 ambient = vec3(0.15);
    vec3 color = ambient * albedo + albedo * diff * 1.2 + vec3(spec) * (1.0 - rough);
    color = color / (color + vec3(1.0));
    color = pow(color, vec3(1.0 / 2.2));

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createDecalMaterial(albedoTex, normalTex, roughTex) {
  const uniforms = {
    uAlbedoTex: { value: albedoTex || null },
    uNormalTex: { value: normalTex || null },
    uRoughTex:  { value: roughTex  || null },
    uHasAlbedo: { value: !!albedoTex },
    uHasNormal: { value: !!normalTex },
    uHasRough:  { value: !!roughTex  },

    uDecalTex:  { value: null },
    uHeightTex: { value: null },
    uHasDecal:  { value: false },
    uHasHeight: { value: false },

    uPosX:           { value: 0.0 },
    uPosY:           { value: 0.0 },
    uScale:          { value: 1.0 },
    uScaleY:         { value: 1.0 },
    uRotation:       { value: 0.0 },
    uOpacity:        { value: 1.0 },
    uAmountAlbedo:   { value: 1.0 },
    uAmountRough:    { value: 0.0 },
    uAmountNormal:   { value: 0.0 },
    uHeightIntensity:{ value: 0.0 },
    uTileEdge:       { value: false },

    uLightDir:  { value: new THREE.Vector3(3.0, 4.0, 5.0).normalize() },
    uCameraPos: { value: new THREE.Vector3(0.0, 0.0, 3.0) },
  };

  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
  });
}

export function updateDecalUniforms(material, opts) {
  const u = material.uniforms;

  if (opts.decalTex !== undefined) {
    u.uDecalTex.value = opts.decalTex;
    u.uHasDecal.value = !!opts.decalTex;
  }
  if (opts.heightTex !== undefined) {
    u.uHeightTex.value = opts.heightTex;
    u.uHasHeight.value = !!opts.heightTex;
  }

  u.uPosX.value     = opts.posX ?? 0.0;
  u.uPosY.value     = opts.posY ?? 0.0;
  u.uScale.value    = opts.scale ?? 1.0;
  u.uScaleY.value   = opts.scaleY ?? opts.scale ?? 1.0;
  u.uRotation.value = (opts.rotationDeg ?? 0) * Math.PI / 180.0;
  u.uOpacity.value  = opts.opacity ?? 1.0;

  u.uAmountAlbedo.value    = opts.amountAlbedo ?? 1.0;
  u.uAmountRough.value     = opts.amountRough  ?? 0.0;
  u.uAmountNormal.value    = opts.amountNormal ?? 0.0;
  u.uHeightIntensity.value = opts.heightIntensity ?? 0.0;
  u.uTileEdge.value        = opts.tileEdge ?? false;

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