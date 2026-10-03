// Тайлящийся Simplex шум для domain warping.
use noise::{NoiseFn, OpenSimplex};

pub struct TilingNoise {
    noise: OpenSimplex,
    seed: u32,
    /// Радиус тора — влияет на «частоту» шума.
    scale: f64,
}

impl TilingNoise {
    pub fn new(seed: u32) -> Self {
        Self {
            noise: OpenSimplex::new(seed),
            seed,
            scale: 1.0,
        }
    }

    /// Тайлящийся 4D-шум. Значение в диапазоне примерно [-1, 1].
    pub fn sample(&self, x: f32, y: f32, w: f32, h: f32) -> f32 {
        if w == 0.0 || h == 0.0 {
            return 0.0;
        }
        let two_pi = std::f64::consts::TAU;
        let nx = (x as f64) / (w as f64);
        let ny = (y as f64) / (h as f64);
        let ax = nx * two_pi;
        let ay = ny * two_pi;
        let r = self.scale;
        let x4 = ax.cos() * r;
        let y4 = ax.sin() * r;
        let z4 = ay.cos() * r;
        let w4 = ay.sin() * r;
        self.noise.get([x4, y4, z4, w4]) as f32
    }

    /// Фрактальный шум (fBm).
    pub fn fbm(&self, x: f32, y: f32, w: f32, h: f32, octaves: u32, persistence: f32, lacunarity: f32) -> f32 {
        let mut sum = 0.0_f32;
        let mut amplitude = 1.0_f32;
        let mut frequency = 1.0_f32;
        let mut max_value = 0.0_f32;
        for _ in 0..octaves {
            let v = self.sample(x * frequency, y * frequency, w * frequency, h * frequency);
            sum += v * amplitude;
            max_value += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }
        if max_value == 0.0 { 0.0 } else { sum / max_value }
    }

    /// Worley edge noise — БЕЗ тайлинга (для совместимости).
    pub fn worley_edge(&self, x: f32, y: f32, cell_size: f32, seed_offset: u32) -> f32 {
        if cell_size <= 0.0 { return 0.0; }
        let xi = (x / cell_size).floor();
        let yi = (y / cell_size).floor();
        let mut f1 = f32::MAX;
        let mut f2 = f32::MAX;
        for dy in -1..=1_i32 {
            for dx in -1..=1_i32 {
                let cx = xi + dx as f32;
                let cy = yi + dy as f32;
                let hx = (cx as i32 as u32).wrapping_mul(73856093);
                let hy = (cy as i32 as u32).wrapping_mul(19349663);
                let mut h = hx ^ hy ^ seed_offset ^ self.seed;
                h = h.wrapping_mul(83492791);
                h ^= h >> 13;
                h = h.wrapping_mul(1274126177);
                h ^= h >> 16;
                let rx = (h & 0xffff) as f32 / 65535.0;
                let ry = ((h >> 16) & 0xffff) as f32 / 65535.0;
                let px = (cx + rx) * cell_size;
                let py = (cy + ry) * cell_size;
                let ddx = x - px;
                let ddy = y - py;
                let d = (ddx * ddx + ddy * ddy).sqrt();
                if d < f1 { f2 = f1; f1 = d; }
                else if d < f2 { f2 = d; }
            }
        }
        let edge_dist = (f2 - f1) / cell_size;
        edge_dist.clamp(0.0, 1.0)
    }

    /// ТАЙЛЯЩИЙСЯ worley edge noise.
    pub fn worley_edge_tiled(
        &self,
        x: f32, y: f32,
        w: f32, h: f32,
        tiles_x: i32, tiles_y: i32,
        seed_offset: u32,
    ) -> f32 {
        if tiles_x <= 0 || tiles_y <= 0 || w <= 0.0 || h <= 0.0 { return 0.0; }
        let cell_w = w / tiles_x as f32;
        let cell_h = h / tiles_y as f32;
        let xi = (x / cell_w).floor() as i32;
        let yi = (y / cell_h).floor() as i32;
        let mut f1 = f32::MAX;
        let mut f2 = f32::MAX;
        for dy in -1..=1_i32 {
            for dx in -1..=1_i32 {
                let cx = ((xi + dx).rem_euclid(tiles_x)) as u32;
                let cy = ((yi + dy).rem_euclid(tiles_y)) as u32;
                let hx = cx.wrapping_mul(73856093);
                let hy = cy.wrapping_mul(19349663);
                let mut hh = hx ^ hy ^ seed_offset ^ self.seed;
                hh = hh.wrapping_mul(83492791);
                hh ^= hh >> 13;
                hh = hh.wrapping_mul(1274126177);
                hh ^= hh >> 16;
                let rx = (hh & 0xffff) as f32 / 65535.0;
                let ry = ((hh >> 16) & 0xffff) as f32 / 65535.0;
                let px = (cx as f32 + rx) * cell_w;
                let py = (cy as f32 + ry) * cell_h;
                let mut best_d = f32::MAX;
                for ox in -1..=1_i32 {
                    for oy in -1..=1_i32 {
                        let px_off = px + ox as f32 * w;
                        let py_off = py + oy as f32 * h;
                        let ddx = x - px_off;
                        let ddy = y - py_off;
                        let d = (ddx * ddx + ddy * ddy).sqrt();
                        if d < best_d { best_d = d; }
                    }
                }
                let d = best_d;
                if d < f1 { f2 = f1; f1 = d; }
                else if d < f2 { f2 = d; }
            }
        }
        let cell_avg = (cell_w + cell_h) * 0.5;
        let edge_dist = (f2 - f1) / cell_avg;
        edge_dist.clamp(0.0, 1.0)
    }

    /// Domain warping — искажает UV-координаты через шум для рваных краёв.
    pub fn warp(
        &self,
        x: f32, y: f32,
        w: f32, h: f32,
        strength: f32,
        seed_offset: f32,
    ) -> (f32, f32) {
        let qx = self.fbm(x + seed_offset, y + seed_offset, w, h, 3, 0.5, 2.0);
        let qy = self.fbm(x + 53.7 + seed_offset, y + 91.1 + seed_offset, w, h, 3, 0.5, 2.0);
        let wx = x + qx * strength;
        let wy = y + qy * strength;
        let wx = ((wx % w) + w) % w;
        let wy = ((wy % h) + h) % h;
        (wx, wy)
    }

    pub fn seed(&self) -> u32 {
        self.seed
    }
}

// ═══════════════════════════════════════════════════════════════
// snoise2 — точный порт GLSL-функции из rust-shader.js / dirt-shader.js.
// Используется для deform, чтобы превью и финал совпадали.
// Без seed: у GLSL-версии его тоже нет — карта шума одна для всех.
// ═══════════════════════════════════════════════════════════════

#[inline]
fn mod289_3(x: [f32; 3]) -> [f32; 3] {
    let mut out = [0.0f32; 3];
    for i in 0..3 {
        out[i] = x[i] - (x[i] * (1.0 / 289.0)).floor() * 289.0;
    }
    out
}

#[inline]
fn mod289_2(x: [f32; 2]) -> [f32; 2] {
    let mut out = [0.0f32; 2];
    for i in 0..2 {
        out[i] = x[i] - (x[i] * (1.0 / 289.0)).floor() * 289.0;
    }
    out
}

#[inline]
fn permute_3(x: [f32; 3]) -> [f32; 3] {
    let a = [
        (x[0] * 34.0) + 1.0,
        (x[1] * 34.0) + 1.0,
        (x[2] * 34.0) + 1.0,
    ];
    let m = [
        a[0] * x[0],
        a[1] * x[1],
        a[2] * x[2],
    ];
    mod289_3(m)
}

/// Порт GLSL snoise2(vec2). Возвращает примерно [-1, 1].
pub fn snoise2(vx: f32, vy: f32) -> f32 {
    const C0: f32 = 0.211324865405187;
    const C1: f32 = 0.366025403784439;
    const C2: f32 = -0.577350269189626;
    const C3: f32 = 0.024390243902439;

    // vec2 i = floor(v + dot(v, C.yy))
    let dot_v_yy = vx * C1 + vy * C1;
    let ix = (vx + dot_v_yy).floor();
    let iy = (vy + dot_v_yy).floor();

    // vec2 x0 = v - i + dot(i, C.xx)
    let dot_i_xx = ix * C0 + iy * C0;
    let x0x = vx - ix + dot_i_xx;
    let x0y = vy - iy + dot_i_xx;

    // vec2 i1 = (x0.x > x0.y) ? vec2(1,0) : vec2(0,1)
    let (i1x, i1y) = if x0x > x0y { (1.0f32, 0.0f32) } else { (0.0f32, 1.0f32) };

    // vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1
    let c_xxzz = [C0, C0, C2, C2];
    let x12x = x0x + c_xxzz[0] - i1x;
    let x12y = x0y + c_xxzz[1] - i1y;
    let x12z = x0x + c_xxzz[2];
    let x12w = x0y + c_xxzz[3];

    // i = mod289(i)
    let i_mod = mod289_2([ix, iy]);

    // vec3 p = permute(permute(i.y + vec3(0, i1.y, 1)) + i.x + vec3(0, i1.x, 1))
    let p_inner = [
        i_mod[1] + 0.0,
        i_mod[1] + i1y,
        i_mod[1] + 1.0,
    ];
    let p_perm = permute_3(p_inner);
    let p = permute_3([
        p_perm[0] + i_mod[0] + 0.0,
        p_perm[1] + i_mod[0] + i1x,
        p_perm[2] + i_mod[0] + 1.0,
    ]);

    // vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0)
    let d0 = x0x * x0x + x0y * x0y;
    let d1 = x12x * x12x + x12y * x12y;
    let d2 = x12z * x12z + x12w * x12w;
    let mut m = [
        (0.5 - d0).max(0.0),
        (0.5 - d1).max(0.0),
        (0.5 - d2).max(0.0),
    ];

    // m = m * m; m = m * m
    for i in 0..3 { m[i] = m[i] * m[i]; }
    for i in 0..3 { m[i] = m[i] * m[i]; }

    // vec3 x = 2.0 * fract(p * C.www) - 1.0
    let fract = |v: f32| v - v.floor();
    let xx = 2.0 * fract(p[0] * C3) - 1.0;
    let xy = 2.0 * fract(p[1] * C3) - 1.0;
    let xz = 2.0 * fract(p[2] * C3) - 1.0;

    // vec3 h = abs(x) - 0.5
    let hx = xx.abs() - 0.5;
    let hy = xy.abs() - 0.5;
    let hz = xz.abs() - 0.5;

    // vec3 ox = floor(x + 0.5)
    let oxx = (xx + 0.5).floor();
    let oxy = (xy + 0.5).floor();
    let oxz = (xz + 0.5).floor();

    // vec3 a0 = x - ox
    let a0x = xx - oxx;
    let a0y = xy - oxy;
    let a0z = xz - oxz;

    // m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h)
    let k1 = 1.79284291400159f32;
    let k2 = 0.85373472095314f32;
    m[0] *= k1 - k2 * (a0x * a0x + hx * hx);
    m[1] *= k1 - k2 * (a0y * a0y + hy * hy);
    m[2] *= k1 - k2 * (a0z * a0z + hz * hz);

    // vec3 g;
    // g.x = a0.x * x0.x + h.x * x0.y;
    // g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    let gx = a0x * x0x + hx * x0y;
    let gy = a0y * x12x + hy * x12y;
    let gz = a0z * x12z + hz * x12w;

    // return 130.0 * dot(m, g)
    130.0 * (m[0] * gx + m[1] * gy + m[2] * gz)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tiling_seamless() {
        let n = TilingNoise::new(42);
        let w = 256.0_f32;
        let h = 256.0_f32;
        let v00 = n.sample(0.0, 0.0, w, h);
        let vww = n.sample(w, h, w, h);
        assert!((v00 - vww).abs() < 0.001);
    }

    #[test]
    fn test_range() {
        let n = TilingNoise::new(123);
        let w = 64.0_f32;
        let h = 64.0_f32;
        let mut min = f32::MAX;
        let mut max = f32::MIN;
        for y in 0..64 {
            for x in 0..64 {
                let v = n.sample(x as f32, y as f32, w, h);
                if v < min { min = v; }
                if v > max { max = v; }
            }
        }
        assert!(min > -1.5 && min < 0.5);
        assert!(max < 1.5 && max > -0.5);
    }

    #[test]
    fn test_fbm() {
        let n = TilingNoise::new(7);
        let v = n.fbm(10.0, 20.0, 256.0, 256.0, 4, 0.5, 2.0);
        assert!(v.is_finite());
    }

    #[test]
    fn test_snoise2_range() {
        // Просто проверяем что функция не паникует и возвращает разумные значения
        let v = snoise2(0.5, 0.5);
        assert!(v.is_finite());
        assert!(v.abs() < 2.0);
        let v2 = snoise2(1.0, 2.0);
        assert!(v2.is_finite());
    }
}