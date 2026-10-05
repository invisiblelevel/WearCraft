// Генератор instances масок — общий для шейдера (превью) и Rust (финал).

function makeRng(seed) {
  let s = seed >>> 0;
  if (s === 0) s = 1;
  return function rnd() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * @param {number} seed
 * @param {number} count      — сколько instances (1..8)
 * @param {number} scale
 * @param {number} maskCount  — размер пула
 * @param {object} opts       — глобальные posX/posY/rotation + randomRotation + tileable
 */
export function generateInstances(seed, count, scale, maskCount, opts = {}) {
  const {
    globalPosX = 0,
    globalPosY = 0,
    globalRotation = 0,
    randomRotation = true,
    randomFlip = true,
    tileable = true,
  } = opts;

  const c = Math.max(1, Math.min(8, Math.round(count)));
  const mc = Math.max(1, Math.floor(maskCount));
  const rnd = makeRng(seed | 0);

  const out = [];
  for (let i = 0; i < c; i++) {
    const maskIdx = i % mc;
    const offsetX = rnd() - 0.5 + globalPosX;
    const offsetY = rnd() - 0.5 + globalPosY;
    const s = (0.5 + (rnd() - 0.3) * 0.8) * scale;
    const randomRot = randomRotation ? rnd() * Math.PI * 2 : 0;
    const rotation = randomRot + globalRotation;
    // flip только если разрешено. Для streaks передаём randomFlip: false.
    const flipX = randomFlip ? (rnd() > 0.5 ? 1 : -1) : 1;
    const flipY = randomFlip ? (rnd() > 0.5 ? 1 : -1) : 1;
    out.push({ maskIdx, offsetX, offsetY, scale: s, rotation, flipX, flipY, tileable });
  }
  return out;
}

/**
 * Заход 23: фиксированный instance для юзерской маски.
 * Позиция/поворот/масштаб из UI. tileable = false (без дублирования).
 * UI хранит rotation в градусах — здесь переводим в радианы.
 */
export function generateFixedInstance(pos) {
  return {
    maskIdx: 0,
    offsetX: pos.offsetX ?? 0,
    offsetY: pos.offsetY ?? 0,
    scale: pos.scale ?? 1,
    rotation: ((pos.rotation ?? 0) * Math.PI) / 180.0,
    flipX: 1,
    flipY: 1,
    tileable: false,
  };
}

export function instancesForRust(instances) {
  return instances.map((it) => ({
    maskIdx: it.maskIdx,
    offsetX: it.offsetX,
    offsetY: it.offsetY,
    scale: it.scale,
    rotation: it.rotation,
    flipX: it.flipX,
    flipY: it.flipY,
    tileable: it.tileable !== false,
  }));
}