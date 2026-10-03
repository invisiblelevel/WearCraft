// Генераторы паттернов износа.
use image::{GrayImage, Luma, RgbImage};
use rand::{Rng, SeedableRng};
use rand::rngs::StdRng;
use rayon::prelude::*;
use super::noise::{TilingNoise, snoise2};
use super::pbr_ops::gaussian_blur;

#[inline]
pub fn smoothstep(edge0: f32, edge1: f32, x: f32) -> f32 {
    let t = ((x - edge0) / (edge1 - edge0)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

#[inline]
pub fn threshold(x: f32, low: f32, high: f32) -> f32 {
    smoothstep(low, high, x)
}

#[inline]
fn fbm01(noise: &TilingNoise, x: f32, y: f32, w: f32, h: f32, octaves: u32, persistence: f32, lacunarity: f32) -> f32 {
    let n = noise.fbm(x, y, w, h, octaves, persistence, lacunarity);
    (n + 1.0) * 0.5
}

// ============ Scratches ============

#[derive(Debug, Clone, Copy)]
pub struct ScratchParams {
    pub density: f32, pub length: f32, pub thickness: f32,
    pub waviness: f32, pub branches: f32, pub clusters: f32,
}

impl Default for ScratchParams {
    fn default() -> Self {
        Self { density: 0.5, length: 0.15, thickness: 2.0, waviness: 0.3, branches: 0.1, clusters: 0.3 }
    }
}

fn draw_scratch_curve(
    img: &mut GrayImage, rng: &mut StdRng, start: (f32, f32),
    angle: f32, length: f32, base_thickness: f32, waviness: f32,
    broken: bool, base_intensity: f32,
) -> (f32, f32) {
    let (w, h) = img.dimensions();
    let (sx, sy) = start;
    let ex = sx + angle.cos() * length;
    let ey = sy + angle.sin() * length;
    let mx = (sx + ex) * 0.5;
    let my = (sy + ey) * 0.5;
    let px = -(ey - sy) / length.max(0.001);
    let py = (ex - sx) / length.max(0.001);
    let wave_amp = rng.gen_range(-1.0..1.0_f32) * length * waviness * 0.4;
    let cx = mx + px * wave_amp;
    let cy = my + py * wave_amp;
    let steps = (length * 1.5) as i32;
    let break_count = if broken { rng.gen_range(1..=3) } else { 0 };
    let mut breaks: Vec<(f32, f32)> = Vec::new();
    for _ in 0..break_count {
        let start_b = rng.gen_range(0.05..0.95_f32);
        let len_b = rng.gen_range(0.03..0.12_f32);
        breaks.push((start_b, start_b + len_b));
    }
    let thick_peak = rng.gen_range(0.3..0.7_f32);
    let thick_max_mult = rng.gen_range(1.3..2.5_f32);
    let intensity = base_intensity * rng.gen_range(0.4..1.0_f32);
    for step in 0..=steps {
        let t = step as f32 / steps as f32;
        let mut in_break = false;
        for (bs, be) in &breaks { if t >= *bs && t < *be { in_break = true; break; } }
        if in_break { continue; }
        let omt = 1.0 - t;
        let bx = omt * omt * sx + 2.0 * omt * t * cx + t * t * ex;
        let by = omt * omt * sy + 2.0 * omt * t * cy + t * t * ey;
        let thick_factor = { let d = (t - thick_peak).abs(); let g = (-d * d * 20.0).exp(); 1.0 + (thick_max_mult - 1.0) * g };
        let thickness = (base_thickness * thick_factor).max(0.5);
        let end_fade = smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.92, t);
        let intensity_t = (intensity * end_fade).min(1.0);
        let dx = 2.0 * omt * (cx - sx) + 2.0 * t * (ex - cx);
        let dy = 2.0 * omt * (cy - sy) + 2.0 * t * (ey - cy);
        let dl = (dx * dx + dy * dy).sqrt().max(0.001);
        let nx = -dy / dl;
        let ny = dx / dl;
        let half = thickness * 0.5;
        let steps_th = (thickness * 2.0).ceil() as i32;
        for ti in 0..steps_th.max(1) {
            let toff = (ti as f32 / steps_th.max(1) as f32 - 0.5) * thickness;
            let tx = bx + nx * toff;
            let ty = by + ny * toff;
            let edge_fade = 1.0 - (toff.abs() / half).min(1.0) * 0.7;
            let v = (intensity_t * edge_fade).min(1.0);
            let xi = ((tx.round() as i32 % w as i32) + w as i32) % w as i32;
            let yi = ((ty.round() as i32 % h as i32) + h as i32) % h as i32;
            let old = img.get_pixel(xi as u32, yi as u32)[0] as f32 / 255.0;
            let new_v = old.max(v).min(1.0);
            img.put_pixel(xi as u32, yi as u32, Luma([(new_v * 255.0) as u8]));
        }
    }
    (ex, ey)
}

pub fn scratches_pattern(w: u32, h: u32, seed: u32, params: ScratchParams) -> GrayImage {
    let mut img = GrayImage::new(w, h);
    let mut rng = StdRng::seed_from_u64(seed as u64);
    let wf = w as f32;
    let hf = h as f32;
    let area = wf * hf;
    let max_count = (area / 1500.0) as u32;
    let count = ((max_count as f32) * params.density).max(10.0) as u32;
    let min_side = wf.min(hf);
    let avg_length = params.length * min_side;
    for _ in 0..count {
        let (sx, sy) = if rng.r#gen::<f32>() < params.clusters {
            let cx = wf * 0.5 + rng.gen_range(-0.3..0.3_f32) * wf;
            let cy = hf * 0.5 + rng.gen_range(-0.3..0.3_f32) * hf;
            (cx, cy)
        } else {
            (rng.gen_range(0.0..wf), rng.gen_range(0.0..hf))
        };
        let angle = rng.gen_range(0.0..(std::f32::consts::PI * 2.0));
        let length = avg_length * rng.gen_range(0.4..1.6);
        let th = params.thickness * rng.gen_range(0.5..1.5);
        let broken = rng.r#gen::<f32>() < 0.6;
        let end = draw_scratch_curve(&mut img, &mut rng, (sx, sy), angle, length, th, params.waviness, broken, 1.0);
        if rng.r#gen::<f32>() < params.branches {
            let ba = angle + rng.gen_range(-1.2..1.2_f32);
            let bl = length * rng.gen_range(0.2..0.5);
            draw_scratch_curve(&mut img, &mut rng, end, ba, bl, th * 0.7, params.waviness, false, 0.7);
        }
    }
    img
}

// ============ Mask-based pattern (shared by Dirt and Rust) ============

#[derive(Debug, Clone, Copy)]
pub struct MaskPatternParams {
    pub count: f32,
    pub scale: f32,
    pub deform: f32,
    pub threshold: f32,
    pub sharpness: f32,
}

pub struct MaskPatternMasks {
    pub core: GrayImage,
    pub body: GrayImage,
    pub edge: GrayImage,
    pub height: GrayImage,
}

fn default_tileable() -> bool { true }

#[derive(Debug, Clone, Copy, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MaskInstance {
    #[serde(default)]
    pub mask_idx: usize,
    pub offset_x: f32,
    pub offset_y: f32,
    pub scale: f32,
    pub rotation: f32,
    pub flip_x: f32,
    pub flip_y: f32,
    // Заход 23: юзерская маска — без тайлинга
    #[serde(default = "default_tileable")]
    pub tileable: bool,
}

/// Общая билинейная выборка. u, v ∈ [0, 1] (вызывающий сам гарантирует).
#[inline]
fn sample_mask_bilinear(mask: &RgbImage, u: f32, v: f32) -> f32 {
    let (mw, mh) = mask.dimensions();
    let x = u * mw as f32;
    let y = v * mh as f32;
    let x0 = x.floor() as u32;
    let y0 = y.floor() as u32;
    let x1 = (x0 + 1).min(mw - 1);
    let y1 = (y0 + 1).min(mh - 1);
    let fx = x - x0 as f32;
    let fy = y - y0 as f32;

    let p00 = mask.get_pixel(x0, y0)[0] as f32 / 255.0;
    let p10 = mask.get_pixel(x1, y0)[0] as f32 / 255.0;
    let p01 = mask.get_pixel(x0, y1)[0] as f32 / 255.0;
    let p11 = mask.get_pixel(x1, y1)[0] as f32 / 255.0;

    let top = p00 * (1.0 - fx) + p10 * fx;
    let bot = p01 * (1.0 - fx) + p11 * fx;
    top * (1.0 - fy) + bot * fy
}

/// Tileable-выборка: wrap по [0,1). Границы не обрываются.
/// КРИТИЧНО: rem_euclid — не менять. Иначе обрывы на границах.
#[inline]
fn sample_mask_wrapped(mask: &RgbImage, u: f32, v: f32) -> f32 {
    let (mw, mh) = mask.dimensions();
    if mw == 0 || mh == 0 { return 0.0; }
    let u = u.rem_euclid(1.0);
    let v = v.rem_euclid(1.0);
    sample_mask_bilinear(mask, u, v)
}

/// Заход 23: не-tileable выборка для юзерской маски.
/// Вне [0,1] → 0.0. Пятно не дублируется.
#[inline]
fn sample_mask_clamped(mask: &RgbImage, u: f32, v: f32) -> f32 {
    let (mw, mh) = mask.dimensions();
    if mw == 0 || mh == 0 { return 0.0; }
    if u < 0.0 || u > 1.0 || v < 0.0 || v > 1.0 { return 0.0; }
    sample_mask_bilinear(mask, u, v)
}

#[inline]
fn sample_instance(mask: &RgbImage, px: f32, py: f32, wf: f32, hf: f32, inst: &MaskInstance) -> f32 {
    let u = px / wf;
    let v = 1.0 - (py / hf);   // ← ИНВЕРСИЯ Y (Three.js Y-up vs image Y-down)

    let cu = u - 0.5 - inst.offset_x;
    let cv = v - 0.5 - inst.offset_y;

    let cos_a = (-inst.rotation).cos();
    let sin_a = (-inst.rotation).sin();
    let ru = cu * cos_a - cv * sin_a;
    let rv = cu * sin_a + cv * cos_a;

    let mut su = ru / inst.scale.max(0.001);
    let mut sv = rv / inst.scale.max(0.001);

    su *= inst.flip_x;
    sv *= inst.flip_y;

    let mu = su + 0.5;
    let mv = sv + 0.5;

    if inst.tileable {
        sample_mask_wrapped(mask, mu, mv)
    } else {
        sample_mask_clamped(mask, mu, mv)
    }
}

pub fn mask_pattern(
    w: u32, h: u32,
    noise: &TilingNoise,
    p: MaskPatternParams,
    mask_pool: &[RgbImage],
    instances_in: &[MaskInstance],
) -> MaskPatternMasks {
    let wf = w as f32;
    let hf = h as f32;

    if mask_pool.is_empty() {
        return MaskPatternMasks {
            core: GrayImage::new(w, h),
            body: GrayImage::new(w, h),
            edge: GrayImage::new(w, h),
            height: GrayImage::new(w, h),
        };
    }

    let instances: Vec<MaskInstance> = instances_in.iter().copied().collect();
    if instances.is_empty() {
        return MaskPatternMasks {
            core: GrayImage::new(w, h),
            body: GrayImage::new(w, h),
            edge: GrayImage::new(w, h),
            height: GrayImage::new(w, h),
        };
    }

    let deform_amt = p.deform.clamp(0.0, 1.0);
    let warp_scale = wf.min(hf) * 0.1;

    // Совпадение с шейдером: snoise2(uv * 3.0) — 3 цикла на тайл.
    // В шейдере uv ∈ [0..1], здесь — пиксели, переводим в UV делением на wf/hf.
    let deform_freq = 3.0;

    let threshold = p.threshold.clamp(0.0, 1.0);
    let sharpness = p.sharpness.clamp(0.0, 1.0);

    let body_data: Vec<u8> = (0..h).into_par_iter().flat_map(|y| {
        let mut row = Vec::with_capacity(w as usize);
        for x in 0..w {
            let px = x as f32;
            let py = y as f32;

            let (wx, wy) = if deform_amt > 0.01 {
                // UV [0..1]. vUv в Three.js Y-up, py в PNG Y-down.
                // Y-flip, иначе deform расходится с шейдером.
                let u = px / wf;
                let v = 1.0 - (py / hf);
                // Точный порт GLSL snoise2 — совпадает с шейдером
                let nx = snoise2(u * deform_freq, v * deform_freq);
                let ny = snoise2(u * deform_freq + 100.0, v * deform_freq + 100.0);
                // Сдвиг применяется в пикселях, Y-координата тоже инвертируется обратно
                (px + nx * warp_scale * deform_amt, py - ny * warp_scale * deform_amt)
            } else {
                (px, py)
            };

            let mut best: f32 = 0.0;
            for inst in &instances {
                let mask = &mask_pool[inst.mask_idx];
                let v = sample_instance(mask, wx, wy, wf, hf, inst);
                if v > best { best = v; }
            }

            let shifted = (best - threshold * 0.5).clamp(0.0, 1.0);
            let window = 0.5 - sharpness * 0.4;
            let v = smoothstep(0.5 - window * 0.5, 0.5 + window * 0.5, shifted);

            row.push((v.clamp(0.0, 1.0) * 255.0) as u8);
        }
        row
    }).collect();

    let mut body = GrayImage::new(w, h);
    body.copy_from_slice(&body_data);

    let core_data: Vec<u8> = (0..h).into_par_iter().flat_map(|y| {
        let mut row = Vec::with_capacity(w as usize);
        for x in 0..w {
            let v = body_data[(y * w + x) as usize] as f32 / 255.0;
            let core = smoothstep(0.7, 0.95, v);
            row.push((core * 255.0) as u8);
        }
        row
    }).collect();
    let mut core = GrayImage::new(w, h);
    core.copy_from_slice(&core_data);

    let blurred = gaussian_blur(&body, 2);
    let edge_data: Vec<u8> = (0..h).into_par_iter().flat_map(|y| {
        let mut row = Vec::with_capacity(w as usize);
        for x in 0..w {
            let idx = (y * w + x) as usize;
            let b = body_data[idx] as f32 / 255.0;
            let bl = blurred.as_raw()[idx] as f32 / 255.0;
            let e = (bl - b).max(0.0);
            row.push((e * 255.0) as u8);
        }
        row
    }).collect();
    let mut edge = GrayImage::new(w, h);
    edge.copy_from_slice(&edge_data);

    let height_data: Vec<u8> = (0..h).into_par_iter().flat_map(|y| {
        let mut row = Vec::with_capacity(w as usize);
        for x in 0..w {
            let idx = (y * w + x) as usize;
            let b = body_data[idx] as f32 / 255.0;
            if b < 0.05 { row.push(128); continue; }

            let px = x as f32;
            let py = y as f32;
            let micro = fbm01(noise, px * 0.6, py * 0.6, wf * 0.6, hf * 0.6, 3, 0.5, 2.0);
            let micro_v = (micro - 0.5) * 0.3;

            let h_val = (0.5 + b * 0.5 + micro_v * b).clamp(0.0, 1.0);
            row.push((h_val * 255.0) as u8);
        }
        row
    }).collect();
    let mut height = GrayImage::new(w, h);
    height.copy_from_slice(&height_data);

    MaskPatternMasks { core, body, edge, height }
}

// ============ Backward-compatible wrappers ============

#[derive(Debug, Clone, Copy)]
pub struct DirtParams {
    pub density: f32,
    pub scale: f32,
    pub sharpness: f32,
    pub detail: f32,
}

impl Default for DirtParams {
    fn default() -> Self {
        Self { density: 0.5, scale: 2.0, sharpness: 0.6, detail: 0.6 }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct RustParams {
    pub count: f32,
    pub scale: f32,
    pub deform: f32,
    pub threshold: f32,
    pub sharpness: f32,
}

impl Default for RustParams {
    fn default() -> Self {
        Self { count: 3.0, scale: 1.0, deform: 0.5, threshold: 0.5, sharpness: 0.5 }
    }
}

pub struct DirtMasks {
    pub flat: GrayImage,
    pub height: GrayImage,
}

pub struct RustMasks {
    pub core: GrayImage,
    pub body: GrayImage,
    pub edge: GrayImage,
    pub height: GrayImage,
}

pub fn dirt_pattern_from_masks(
    w: u32, h: u32,
    noise: &TilingNoise,
    p: MaskPatternParams,
    mask_pool: &[RgbImage],
    instances: &[MaskInstance],
) -> DirtMasks {
    let m = mask_pattern(w, h, noise, p, mask_pool, instances);
    DirtMasks { flat: m.body, height: m.height }
}

pub fn rust_pattern_from_masks(
    w: u32, h: u32,
    noise: &TilingNoise,
    p: MaskPatternParams,
    mask_pool: &[RgbImage],
    instances: &[MaskInstance],
) -> RustMasks {
    let m = mask_pattern(w, h, noise, p, mask_pool, instances);
    RustMasks { core: m.core, body: m.body, edge: m.edge, height: m.height }
}

// ============ Модуляция ============

pub fn modulate_by_placement(pattern: &GrayImage, placement: &GrayImage, bias: f32) -> GrayImage {
    let (w, h) = pattern.dimensions();
    if w != placement.width() || h != placement.height() { return pattern.clone(); }
    let b = bias.clamp(0.0, 1.0);
    let pat_raw = pattern.as_raw();
    let plc_raw = placement.as_raw();
    let out: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
        let y = yi as u32;
        let mut row = Vec::with_capacity(w as usize);
        for x in 0..w {
            let idx = (y * w + x) as usize;
            let p = pat_raw[idx] as f32 / 255.0;
            let pl = plc_raw[idx] as f32 / 255.0;
            let factor = b + (1.0 - b) * pl;
            row.push(((p * factor).clamp(0.0, 1.0) * 255.0) as u8);
        }
        row
    }).collect();
    let mut img = GrayImage::new(w, h);
    img.copy_from_slice(&out);
    img
}

pub fn max_gray(a: &GrayImage, b: &GrayImage) -> GrayImage {
    let (w, h) = a.dimensions();
    if w != b.width() || h != b.height() { return a.clone(); }
    let a_raw = a.as_raw();
    let b_raw = b.as_raw();
    let out: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
        let y = yi as u32;
        let mut row = Vec::with_capacity(w as usize);
        for x in 0..w {
            let idx = (y * w + x) as usize;
            row.push(a_raw[idx].max(b_raw[idx]));
        }
        row
    }).collect();
    let mut img = GrayImage::new(w, h);
    img.copy_from_slice(&out);
    img
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_smoothstep() {
        assert!((smoothstep(0.0, 1.0, -0.5) - 0.0).abs() < 0.001);
    }
}