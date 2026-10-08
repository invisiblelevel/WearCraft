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

// ============ UV-MASK ============

fn apply_uv_mask_gray(img: &mut GrayImage, uv_mask: &GrayImage) {
    let (w, h) = img.dimensions();
    if w == 0 || h == 0 { return; }

    let mask_owned;
    let mask_ref = if uv_mask.width() != w || uv_mask.height() != h {
        mask_owned = image::imageops::resize(uv_mask, w, h, image::imageops::FilterType::Lanczos3);
        &mask_owned
    } else {
        uv_mask
    };

    let raw = img.as_raw();
    let m_raw = mask_ref.as_raw();
    let out: Vec<u8> = (0..(w * h) as usize).into_par_iter().map(|i| {
        let v = raw[i] as f32 / 255.0;
        let m = m_raw[i] as f32 / 255.0;
        ((v * m).clamp(0.0, 1.0) * 255.0) as u8
    }).collect();
    img.copy_from_slice(&out);
}

// ============ TRIPLANAR ============

#[inline]
pub fn triplanar_uv(world_pos: [f32; 3], normal: [f32; 3], scale: f32, blend_sharpness: f32) -> [f32; 2] {
    let p = [world_pos[0] * scale, world_pos[1] * scale, world_pos[2] * scale];

    let n = {
        let len = (normal[0]*normal[0] + normal[1]*normal[1] + normal[2]*normal[2]).sqrt().max(1e-6);
        [normal[0]/len, normal[1]/len, normal[2]/len]
    };

    let p_exp = blend_sharpness.clamp(0.5, 32.0);

    let mut w = [n[0].abs(), n[1].abs(), n[2].abs()];
    w[0] = w[0].powf(p_exp);
    w[1] = w[1].powf(p_exp);
    w[2] = w[2].powf(p_exp);
    let sum = (w[0] + w[1] + w[2]).max(1e-6);
    w[0] /= sum;
    w[1] /= sum;
    w[2] /= sum;

    let uv_x = [p[1], p[2]];  // YZ
    let uv_y = [p[0], p[2]];  // XZ
    let uv_z = [p[0], p[1]];  // XY

    [
        uv_x[0] * w[0] + uv_y[0] * w[1] + uv_z[0] * w[2],
        uv_x[1] * w[0] + uv_y[1] * w[1] + uv_z[1] * w[2],
    ]
}

#[inline]
fn sample_world_pos(wp: &RgbImage, x: u32, y: u32) -> [f32; 3] {
    let p = wp.get_pixel(x, y);
    [p[0] as f32 / 255.0, p[1] as f32 / 255.0, p[2] as f32 / 255.0]
}

#[inline]
fn normal_from_world_pos(wp: &RgbImage, x: u32, y: u32) -> [f32; 3] {
    let (w, h) = wp.dimensions();
    let xl = if x == 0 { 0 } else { x - 1 };
    let xr = if x + 1 >= w { w - 1 } else { x + 1 };
    let yu = if y == 0 { 0 } else { y - 1 };
    let yd = if y + 1 >= h { h - 1 } else { y + 1 };

    let pl = wp.get_pixel(xl, y);
    let pr = wp.get_pixel(xr, y);
    let pu = wp.get_pixel(x, yu);
    let pd = wp.get_pixel(x, yd);

    let dux = (pr[0] as f32 - pl[0] as f32) / 255.0;
    let duy = (pr[1] as f32 - pl[1] as f32) / 255.0;
    let duz = (pr[2] as f32 - pl[2] as f32) / 255.0;

    let dvx = (pd[0] as f32 - pu[0] as f32) / 255.0;
    let dvy = (pd[1] as f32 - pu[1] as f32) / 255.0;
    let dvz = (pd[2] as f32 - pu[2] as f32) / 255.0;

    let nx = duy * dvz - duz * dvy;
    let ny = duz * dvx - dux * dvz;
    let nz = dux * dvy - duy * dvx;

    let len = (nx*nx + ny*ny + nz*nz).sqrt();
    if len < 1e-6 {
        [0.0, 0.0, 1.0]
    } else {
        [nx / len, ny / len, nz / len]
    }
}

// ============ Scratches ============

#[derive(Debug, Clone, Copy)]
pub struct ScratchParams {
    pub density: f32, pub length: f32, pub thickness: f32,
    pub waviness: f32, pub branches: f32, pub clusters: f32,
    pub pos_x: f32, pub pos_y: f32,
}

impl Default for ScratchParams {
    fn default() -> Self {
        Self {
            density: 0.5, length: 0.15, thickness: 2.0,
            waviness: 0.3, branches: 0.1, clusters: 0.3,
            pos_x: 0.0, pos_y: 0.0,
        }
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
    let intensity = (base_intensity * rng.gen_range(0.85..1.0_f32)).min(1.0);
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
        let end_fade = smoothstep(0.0, 0.05, t) * smoothstep(1.0, 0.95, t);
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
            let rel = (toff.abs() / half).min(1.0);
            let edge_fade = if rel < 0.85 { 1.0 } else { 1.0 - (rel - 0.85) / 0.15 * 0.6 };
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

pub fn scratches_pattern(
    w: u32, h: u32, seed: u32, params: ScratchParams,
    uv_mask: Option<&GrayImage>,
    world_pos: Option<&RgbImage>,
    tri_scale: f32,
    tri_blend_sharpness: f32,
) -> GrayImage {
    let mut img = GrayImage::new(w, h);
    let mut rng = StdRng::seed_from_u64(seed as u64);
    let wf = w as f32;
    let hf = h as f32;

    // Triplanar: если world_pos есть — рисование идёт в 3D-пространстве.
    let wp_owned;
    let wp_ref: Option<&RgbImage> = if let Some(wp) = world_pos {
        if wp.width() != w || wp.height() != h {
            wp_owned = image::imageops::resize(wp, w, h, image::imageops::FilterType::Lanczos3);
            Some(&wp_owned)
        } else {
            Some(wp)
        }
    } else {
        wp_owned = RgbImage::new(0, 0);
        None
    };
    let use_triplanar = wp_ref.is_some();

    let density = params.density.clamp(0.1, 1.0);
    let base_count = (20.0 + density * 180.0) as u32;

    let clusters = params.clusters.clamp(0.0, 1.0);
    let cluster_count = if clusters > 0.05 {
        (1.0 + clusters * 5.0) as u32
    } else {
        0
    };

    let base_len = (params.length.clamp(0.02, 0.4) * wf).max(5.0);
    let base_thick = params.thickness.clamp(0.5, 6.0);
    let waviness = params.waviness.clamp(0.0, 1.0);
    let branches = params.branches.clamp(0.0, 0.5);

    let cluster_centers: Vec<(f32, f32)> = (0..cluster_count)
        .map(|_| {
            let cx = rng.gen_range(0.0..wf);
            let cy = rng.gen_range(0.0..hf);
            (cx, cy)
        })
        .collect();
    let cluster_radius = wf.min(hf) * 0.25;

    for _ in 0..base_count {
        let (mut sx, mut sy) = if cluster_count > 0 && rng.gen::<f32>() < 0.7 {
            let (cx, cy) = cluster_centers[rng.gen_range(0..cluster_centers.len())];
            let a = rng.gen_range(0.0..std::f32::consts::TAU);
            let r = rng.gen_range(0.0..cluster_radius);
            (cx + a.cos() * r, cy + a.sin() * r)
        } else {
            (rng.gen_range(0.0..wf), rng.gen_range(0.0..hf))
        };

        // Triplanar: если используется world_pos — sx/sy в нём уже посчитаны.
        // В procedural-scratches триplanar через UV, но с маппингом через world_pos.
        // На практике: если модель без triplanar — sx/sy остаются как есть.
        // Если triplanar — пересчитываем seed позиции через UV world-space.
        if use_triplanar {
            // Ничего не делаем — sx/sy остаются в UV-пространстве.
            // Для тонких царапин triplanar по UV сохраняет их цельность.
        }

        let base_angle = rng.gen_range(-std::f32::consts::FRAC_PI_2..std::f32::consts::FRAC_PI_2);
        let angle = base_angle + rng.gen_range(-0.5..0.5);

        let len = base_len * rng.gen_range(0.3..1.3);
        let thick = base_thick * rng.gen_range(0.6..1.4);
        let intensity = rng.gen_range(0.75..1.0);
        let broken = rng.gen::<f32>() < 0.3;

        let (ex, ey) = draw_scratch_curve(
            &mut img, &mut rng, (sx, sy), angle, len, thick, waviness, broken, intensity,
        );

        if branches > 0.01 && rng.gen::<f32>() < branches * 2.0 {
            let branch_angle = angle + rng.gen_range(-0.8..0.8);
            let branch_len = len * rng.gen_range(0.3..0.7);
            let branch_thick = thick * rng.gen_range(0.4..0.8);
            let t_on_main = rng.gen_range(0.2..0.8);
            let bx = sx + (ex - sx) * t_on_main;
            let by = sy + (ey - sy) * t_on_main;
            draw_scratch_curve(
                &mut img, &mut rng, (bx, by), branch_angle, branch_len, branch_thick, waviness, false, intensity * 0.8,
            );
        }
    }

    let px = params.pos_x * wf;
    let py = params.pos_y * hf;
    if px.abs() > 0.5 || py.abs() > 0.5 {
        let raw = img.as_raw();
        let mut shifted: Vec<u8> = vec![0; (w * h) as usize];
        for y in 0..h {
            for x in 0..w {
                let sx = ((x as f32 - px).rem_euclid(wf)) as u32;
                let sy = ((y as f32 - py).rem_euclid(hf)) as u32;
                let src = (sy * w + sx) as usize;
                let dst = (y * w + x) as usize;
                shifted[dst] = raw[src];
            }
        }
        img.copy_from_slice(&shifted);
    }

    if let Some(uv) = uv_mask {
        apply_uv_mask_gray(&mut img, uv);
    }

    img
}

// ============ Mask-based pattern ============

#[derive(Debug, Clone, Copy)]
pub struct MaskPatternParams {
    pub count: f32,
    pub scale: f32,
    pub deform: f32,
    pub threshold: f32,
    pub sharpness: f32,
    pub tri_blend_sharpness: f32,
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
    #[serde(default = "default_tileable")]
    pub tileable: bool,
}

#[inline]
fn sample_mask_bilinear(mask: &RgbImage, u: f32, v: f32) -> f32 {
    let (mw, mh) = mask.dimensions();
    if mw == 0 || mh == 0 { return 0.0; }
    let x = u * mw as f32;
    let y = v * mh as f32;
    let x0 = (x.floor() as u32).min(mw - 1);
    let y0 = (y.floor() as u32).min(mh - 1);
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

#[inline]
fn sample_mask_wrapped(mask: &RgbImage, u: f32, v: f32) -> f32 {
    let (mw, mh) = mask.dimensions();
    if mw == 0 || mh == 0 { return 0.0; }
    let u = u.rem_euclid(1.0);
    let v = v.rem_euclid(1.0);
    sample_mask_bilinear(mask, u, v)
}

#[inline]
fn sample_mask_clamped(mask: &RgbImage, u: f32, v: f32) -> f32 {
    let (mw, mh) = mask.dimensions();
    if mw == 0 || mh == 0 { return 0.0; }
    if u < 0.0 || u > 1.0 || v < 0.0 || v > 1.0 { return 0.0; }
    sample_mask_bilinear(mask, u, v)
}

#[inline]
fn sample_instance(mask: &RgbImage, px: f32, py: f32, wf: f32, hf: f32, inst: &MaskInstance, triplanar: bool) -> f32 {
    let u = px / wf;
    let v = 1.0 - (py / hf);

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
    } else if triplanar {
        sample_mask_bilinear(mask, mu.clamp(0.0, 1.0), mv.clamp(0.0, 1.0))
    } else {
        sample_mask_clamped(mask, mu, mv)
    }
}

// ============ ОБЩИЕ АТОМЫ ДЛЯ 4 ПРЕСЕТОВ ============

#[inline]
fn mask_uv_no_triplanar(px: f32, py: f32, hf: f32) -> (f32, f32) {
    (px, hf - py)
}

#[inline]
fn mask_uv_triplanar(wp: &RgbImage, x: u32, y: u32, wf: f32, hf: f32, tri_scale: f32, tri_blend_sharpness: f32) -> (f32, f32) {
    let wp_px = sample_world_pos(wp, x, y);
    let nrm = normal_from_world_pos(wp, x, y);
    let uv_tri = triplanar_uv(wp_px, nrm, tri_scale, tri_blend_sharpness);
    let u_t = uv_tri[0].rem_euclid(1.0);
    let v_t = uv_tri[1].rem_euclid(1.0);
    (u_t * wf, (1.0 - v_t) * hf)
}

#[inline]
fn mask_deform_offset(px: f32, py: f32, wf: f32, hf: f32, deform_amt: f32) -> (f32, f32) {
    if deform_amt <= 0.01 { return (0.0, 0.0); }
    let warp_scale = wf.min(hf) * 0.1;
    let deform_freq = 3.0;
    let u = px / wf;
    let v = 1.0 - (py / hf);
    let nx = snoise2(u * deform_freq, v * deform_freq);
    let ny = snoise2(u * deform_freq + 100.0, v * deform_freq + 100.0);
    (nx * warp_scale * deform_amt, -ny * warp_scale * deform_amt)
}

#[inline]
fn accumulate_best_at(
    instances: &[MaskInstance],
    mask_pool: &[RgbImage],
    wp_ref: Option<&RgbImage>,
    x: u32, y: u32,
    wf: f32, hf: f32,
    deform_amt: f32,
    tri_scale: f32,
    tri_blend_sharpness: f32,
) -> f32 {
    let use_triplanar = wp_ref.is_some();
    let (mut px, mut py) = if let Some(wp) = wp_ref {
        mask_uv_triplanar(wp, x, y, wf, hf, tri_scale, tri_blend_sharpness)
    } else {
        mask_uv_no_triplanar(x as f32, y as f32, hf)
    };

    let (dx, dy) = mask_deform_offset(px, py, wf, hf, deform_amt);
    px += dx;
    py += dy;

    let mut best: f32 = 0.0;
    for inst in instances {
        let mask = &mask_pool[inst.mask_idx];
        let v = sample_instance(mask, px, py, wf, hf, inst, use_triplanar);
        if v > best { best = v; }
    }
    best
}

fn compute_body_data(
    w: u32, h: u32,
    instances: &[MaskInstance],
    mask_pool: &[RgbImage],
    wp_ref: Option<&RgbImage>,
    deform_amt: f32, tri_scale: f32,
    threshold: f32, sharpness: f32,
    tri_blend_sharpness: f32,
) -> Vec<u8> {
    let wf = w as f32;
    let hf = h as f32;
    (0..h).into_par_iter().flat_map(|y| {
        let mut row = Vec::with_capacity(w as usize);
        for x in 0..w {
            let best = accumulate_best_at(
                instances, mask_pool, wp_ref, x, y, wf, hf, deform_amt, tri_scale, tri_blend_sharpness,
            );
            let shifted = (best - threshold * 0.5).clamp(0.0, 1.0);
            let window = 0.5 - sharpness * 0.4;
            let v = smoothstep(0.5 - window * 0.5, 0.5 + window * 0.5, shifted);
            row.push((v.clamp(0.0, 1.0) * 255.0) as u8);
        }
        row
    }).collect()
}

fn flip_y_data(w: u32, h: u32, data: &[u8]) -> Vec<u8> {
    let mut out: Vec<u8> = Vec::with_capacity((w * h) as usize);
    for y in (0..h).rev() {
        let start = (y * w) as usize;
        let end = start + w as usize;
        out.extend_from_slice(&data[start..end]);
    }
    out
}

fn compute_core_from_flipped(w: u32, h: u32, body_flipped: &[u8]) -> GrayImage {
    let data: Vec<u8> = (0..h).into_par_iter().flat_map(|y| {
        let mut row = Vec::with_capacity(w as usize);
        for x in 0..w {
            let v = body_flipped[(y * w + x) as usize] as f32 / 255.0;
            let core = smoothstep(0.7, 0.95, v);
            row.push((core * 255.0) as u8);
        }
        row
    }).collect();
    let mut img = GrayImage::new(w, h);
    img.copy_from_slice(&data);
    img
}

fn compute_edge_from_flipped(w: u32, h: u32, body_flipped: &GrayImage) -> GrayImage {
    let blurred = gaussian_blur(body_flipped, 2);
    let body_raw = body_flipped.as_raw();
    let bl_raw = blurred.as_raw();
    let data: Vec<u8> = (0..h).into_par_iter().flat_map(|y| {
        let mut row = Vec::with_capacity(w as usize);
        for x in 0..w {
            let idx = (y * w + x) as usize;
            let b = body_raw[idx] as f32 / 255.0;
            let bl = bl_raw[idx] as f32 / 255.0;
            let e = (bl - b).max(0.0);
            row.push((e * 255.0) as u8);
        }
        row
    }).collect();
    let mut img = GrayImage::new(w, h);
    img.copy_from_slice(&data);
    img
}

fn compute_height_from_flipped(
    w: u32, h: u32,
    body_flipped: &GrayImage,
    noise: &TilingNoise,
) -> GrayImage {
    let wf = w as f32;
    let hf = h as f32;
    let body_raw = body_flipped.as_raw();
    let data: Vec<u8> = (0..h).into_par_iter().flat_map(|y| {
        let mut row = Vec::with_capacity(w as usize);
        for x in 0..w {
            let idx = (y * w + x) as usize;
            let b = body_raw[idx] as f32 / 255.0;
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
    let mut img = GrayImage::new(w, h);
    img.copy_from_slice(&data);
    img
}

fn prepare_world_pos(
    w: u32, h: u32,
    world_pos: Option<&RgbImage>,
) -> (Option<RgbImage>, bool) {
    if let Some(wp) = world_pos {
        if wp.width() != w || wp.height() != h {
            let resized = image::imageops::resize(wp, w, h, image::imageops::FilterType::Lanczos3);
            (Some(resized), true)
        } else {
            (None, true)
        }
    } else {
        (None, false)
    }
}

// ============ 4 НЕЗАВИСИМЫЕ ФУНКЦИИ ПРЕСЕТОВ ============

// ─── DIRT ───
pub struct DirtMasks {
    pub flat: GrayImage,
    pub height: GrayImage,
}

pub fn dirt_pattern_masks(
    w: u32, h: u32,
    noise: &TilingNoise,
    p: MaskPatternParams,
    mask_pool: &[RgbImage],
    instances: &[MaskInstance],
    uv_mask: Option<&GrayImage>,
    world_pos: Option<&RgbImage>,
    tri_scale: f32,
) -> DirtMasks {
    if mask_pool.is_empty() || instances.is_empty() {
        return DirtMasks {
            flat: GrayImage::new(w, h),
            height: GrayImage::new(w, h),
        };
    }

    let (wp_owned, use_tri) = prepare_world_pos(w, h, world_pos);
    let wp_ref = if use_tri { wp_owned.as_ref().or(world_pos) } else { None };

    let deform_amt = p.deform.clamp(0.0, 1.0);
    let threshold = p.threshold.clamp(0.0, 1.0);
    let sharpness = p.sharpness.clamp(0.0, 1.0);

    let body_data = compute_body_data(
        w, h, instances, mask_pool, wp_ref,
        deform_amt, tri_scale, threshold, sharpness,
        p.tri_blend_sharpness,
    );

    let flipped = flip_y_data(w, h, &body_data);
    let mut flat = GrayImage::new(w, h);
    flat.copy_from_slice(&flipped);

    let mut height = compute_height_from_flipped(w, h, &flat, noise);

    if let Some(uv) = uv_mask {
        if !use_tri {
            apply_uv_mask_gray(&mut flat, uv);
            apply_uv_mask_gray(&mut height, uv);
        }
    }

    DirtMasks { flat, height }
}

// ─── RUST ───
pub struct RustMasks {
    pub core: GrayImage,
    pub body: GrayImage,
    pub edge: GrayImage,
    pub height: GrayImage,
}

pub fn rust_pattern_masks(
    w: u32, h: u32,
    noise: &TilingNoise,
    p: MaskPatternParams,
    mask_pool: &[RgbImage],
    instances: &[MaskInstance],
    uv_mask: Option<&GrayImage>,
    world_pos: Option<&RgbImage>,
    tri_scale: f32,
) -> RustMasks {
    if mask_pool.is_empty() || instances.is_empty() {
        return RustMasks {
            core: GrayImage::new(w, h),
            body: GrayImage::new(w, h),
            edge: GrayImage::new(w, h),
            height: GrayImage::new(w, h),
        };
    }

    let (wp_owned, use_tri) = prepare_world_pos(w, h, world_pos);
    let wp_ref = if use_tri { wp_owned.as_ref().or(world_pos) } else { None };

    let deform_amt = p.deform.clamp(0.0, 1.0);
    let threshold = p.threshold.clamp(0.0, 1.0);
    let sharpness = p.sharpness.clamp(0.0, 1.0);

    let body_data = compute_body_data(
        w, h, instances, mask_pool, wp_ref,
        deform_amt, tri_scale, threshold, sharpness,
        p.tri_blend_sharpness,
    );

    let flipped = flip_y_data(w, h, &body_data);
    let mut body = GrayImage::new(w, h);
    body.copy_from_slice(&flipped);

    let mut core = compute_core_from_flipped(w, h, &flipped);
    let mut edge = compute_edge_from_flipped(w, h, &body);
    let mut height = compute_height_from_flipped(w, h, &body, noise);

    if let Some(uv) = uv_mask {
        if !use_tri {
            apply_uv_mask_gray(&mut core, uv);
            apply_uv_mask_gray(&mut body, uv);
            apply_uv_mask_gray(&mut edge, uv);
        }
    }

    RustMasks { core, body, edge, height }
}

// ─── STREAKS (mask-режим) ───
pub struct StreaksMaskMasks {
    pub flat: GrayImage,
    pub height: GrayImage,
}

pub fn streaks_mask_pattern(
    w: u32, h: u32,
    noise: &TilingNoise,
    p: MaskPatternParams,
    mask_pool: &[RgbImage],
    instances: &[MaskInstance],
    uv_mask: Option<&GrayImage>,
    world_pos: Option<&RgbImage>,
    tri_scale: f32,
) -> StreaksMaskMasks {
    if mask_pool.is_empty() || instances.is_empty() {
        return StreaksMaskMasks {
            flat: GrayImage::new(w, h),
            height: GrayImage::new(w, h),
        };
    }

    let (wp_owned, use_tri) = prepare_world_pos(w, h, world_pos);
    let wp_ref = if use_tri { wp_owned.as_ref().or(world_pos) } else { None };

    let deform_amt = p.deform.clamp(0.0, 1.0);
    let threshold = p.threshold.clamp(0.0, 1.0);
    let sharpness = p.sharpness.clamp(0.0, 1.0);

    let body_data = compute_body_data(
        w, h, instances, mask_pool, wp_ref,
        deform_amt, tri_scale, threshold, sharpness,
        p.tri_blend_sharpness,
    );

    let flipped = flip_y_data(w, h, &body_data);
    let mut flat = GrayImage::new(w, h);
    flat.copy_from_slice(&flipped);

    let mut height = compute_height_from_flipped(w, h, &flat, noise);

    if let Some(uv) = uv_mask {
        if !use_tri {
            apply_uv_mask_gray(&mut flat, uv);
            apply_uv_mask_gray(&mut height, uv);
        }
    }

    StreaksMaskMasks { flat, height }
}

// ─── SCRATCHES (mask-режим) ───
pub struct ScratchesMaskMasks {
    pub flat: GrayImage,
    pub height: GrayImage,
}

pub fn scratches_mask_pattern(
    w: u32, h: u32,
    noise: &TilingNoise,
    p: MaskPatternParams,
    mask_pool: &[RgbImage],
    instances: &[MaskInstance],
    uv_mask: Option<&GrayImage>,
    world_pos: Option<&RgbImage>,
    tri_scale: f32,
) -> ScratchesMaskMasks {
    if mask_pool.is_empty() || instances.is_empty() {
        return ScratchesMaskMasks {
            flat: GrayImage::new(w, h),
            height: GrayImage::new(w, h),
        };
    }

    let (wp_owned, use_tri) = prepare_world_pos(w, h, world_pos);
    let wp_ref = if use_tri { wp_owned.as_ref().or(world_pos) } else { None };

    let deform_amt = p.deform.clamp(0.0, 1.0);
    let threshold = p.threshold.clamp(0.0, 1.0);
    let sharpness = p.sharpness.clamp(0.0, 1.0);

    let body_data = compute_body_data(
        w, h, instances, mask_pool, wp_ref,
        deform_amt, tri_scale, threshold, sharpness,
        p.tri_blend_sharpness,
    );

    let flipped = flip_y_data(w, h, &body_data);
    let mut flat = GrayImage::new(w, h);
    flat.copy_from_slice(&flipped);

    let mut height = compute_height_from_flipped(w, h, &flat, noise);

    if let Some(uv) = uv_mask {
        if !use_tri {
            apply_uv_mask_gray(&mut flat, uv);
            apply_uv_mask_gray(&mut height, uv);
        }
    }

    ScratchesMaskMasks { flat, height }
}

// ============ Streaks procedural ============

#[derive(Debug, Clone, Copy)]
pub struct StreaksProceduralParams {
    pub count: f32,
    pub size: f32,
    pub stretch: f32,
    pub threshold: f32,
    pub sharpness: f32,
    pub waviness: f32,
    pub pos_x: f32,
    pub pos_y: f32,
    pub rotation: f32,
    pub scale: f32,
    pub tileable: bool,
}

impl Default for StreaksProceduralParams {
    fn default() -> Self {
        Self {
            count: 25.0,
            size: 0.08,
            stretch: 1.0,
            threshold: 0.5,
            sharpness: 0.5,
            waviness: 0.25,
            pos_x: 0.0,
            pos_y: 0.0,
            rotation: 0.0,
            scale: 1.0,
            tileable: true,
        }
    }
}

pub struct StreaksProceduralMasks {
    pub body: GrayImage,
    pub height: GrayImage,
}

#[inline]
fn lcg_splat(s: &mut u32) -> f32 {
    *s = s.wrapping_mul(1664525).wrapping_add(1013904223);
    ((*s >> 8) & 0xFFFFFF) as f32 / 16777215.0
}

#[inline]
fn sd_segment(px: f32, py: f32, ax: f32, ay: f32, bx: f32, by: f32) -> f32 {
    let pax = px - ax;
    let pay = py - ay;
    let bax = bx - ax;
    let bay = by - ay;
    let h = ((pax * bax + pay * bay) / (bax * bax + bay * bay).max(0.0001)).clamp(0.0, 1.0);
    let dx = pax - bax * h;
    let dy = pay - bay * h;
    (dx * dx + dy * dy).sqrt()
}

#[inline]
fn drip_radius(head_r: f32, tail_r: f32, t: f32) -> f32 {
    let t1 = 0.15_f32;
    let t2 = 0.85_f32;
    if t < t1 {
        let k = t / t1;
        head_r * (1.0 - k) + (head_r * 0.55) * k
    } else if t < t2 {
        let k = (t - t1) / (t2 - t1);
        (head_r * 0.55) * (1.0 - k) + (head_r * 0.48) * k
    } else {
        let k = (t - t2) / (1.0 - t2);
        (head_r * 0.48) * (1.0 - k) + tail_r * k
    }
}

#[inline]
fn hash2i_streaks(x: i32, y: i32) -> f32 {
    let xu = x as u32;
    let yu = y as u32;
    let mut h = xu.wrapping_mul(374761393).wrapping_add(yu.wrapping_mul(668265263));
    h = h.wrapping_mul(1274126177);
    h = h ^ (h >> 13);
    h = h.wrapping_mul(1274126177);
    ((h ^ (h >> 16)) & 0xFFFFFF) as f32 / 16777215.0
}

#[inline]
fn value_noise_streaks(x: f32, y: f32) -> f32 {
    let x0 = x.floor() as i32;
    let y0 = y.floor() as i32;
    let fx = x - x0 as f32;
    let fy = y - y0 as f32;
    let sx = fx * fx * (3.0 - 2.0 * fx);
    let sy = fy * fy * (3.0 - 2.0 * fy);

    let p00 = hash2i_streaks(x0, y0);
    let p10 = hash2i_streaks(x0 + 1, y0);
    let p01 = hash2i_streaks(x0, y0 + 1);
    let p11 = hash2i_streaks(x0 + 1, y0 + 1);

    let top = p00 * (1.0 - sx) + p10 * sx;
    let bot = p01 * (1.0 - sx) + p11 * sx;
    top * (1.0 - sy) + bot * sy
}

#[inline]
fn drip_profile(head_r: f32, tail_r: f32, t: f32) -> f32 {
    let t = t.clamp(0.0, 1.0);
    let r_head = head_r;
    let r_neck = head_r * 0.75;
    let r_mid  = head_r * 0.55;
    let r_tail = tail_r;
    if t < 0.20 {
        let k = smoothstep(0.0, 0.20, t);
        r_head + (r_neck - r_head) * k
    } else if t < 0.60 {
        let k = smoothstep(0.20, 0.60, t);
        r_neck + (r_mid - r_neck) * k
    } else {
        let k = smoothstep(0.60, 1.0, t);
        r_mid + (r_tail - r_mid) * k
    }
}

#[inline]
fn value_noise(u: f32, v: f32, grid: f32, seed: u32) -> f32 {
    let x = u * grid;
    let y = v * grid;
    let x0 = x.floor() as i32;
    let y0 = y.floor() as i32;
    let fx = x - x0 as f32;
    let fy = y - y0 as f32;

    let get = |ix: i32, iy: i32| -> f32 {
        let mut s = seed
            .wrapping_add((ix as u32).wrapping_mul(73856093))
            .wrapping_add((iy as u32).wrapping_mul(19349663));
        lcg_splat(&mut s)
    };

    let p00 = get(x0, y0);
    let p10 = get(x0 + 1, y0);
    let p01 = get(x0, y0 + 1);
    let p11 = get(x0 + 1, y0 + 1);

    let sx = fx * fx * (3.0 - 2.0 * fx);
    let sy = fy * fy * (3.0 - 2.0 * fy);

    let top = p00 * (1.0 - sx) + p10 * sx;
    let bot = p01 * (1.0 - sx) + p11 * sx;
    top * (1.0 - sy) + bot * sy
}

pub fn streaks_procedural_pattern(
    w: u32, h: u32, var_seed: u32, p: StreaksProceduralParams,
    uv_mask: Option<&GrayImage>,
    world_pos: Option<&RgbImage>,
    tri_scale: f32,
) -> StreaksProceduralMasks {
    let wf = w as f32;
    let hf = h as f32;

    let count = p.count.clamp(5.0, 100.0);
    let size = p.size.clamp(0.001, 0.10);
    let stretch = p.stretch.clamp(1.0, 20.0);
    let threshold = p.threshold.clamp(-0.1, 1.0);
    let sharpness = p.sharpness.clamp(-1.0, 1.0);
    let scale = p.scale.clamp(0.1, 5.0);
    let tileable = p.tileable;

    let rot_rad = p.rotation.to_radians();
    let cos_r = (-rot_rad).cos();
    let sin_r = (-rot_rad).sin();

    let vi = (var_seed % 1000) as f32 * 0.001;

    let freq_scale = (0.3 + (count / 100.0) * 2.7) * (0.85 + vi * 0.30);
    let base_freq = (1.0 / size.max(0.001)) * 0.5 * freq_scale;
    let octaves = (3.0 + (count / 25.0).min(5.0)) as u32;
    let thr_eff = threshold * 0.35 * (0.9 + vi * 0.2);

    let offx = ((var_seed % 100) as f32) * 0.1;
    let offy = (((var_seed / 100) % 100) as f32) * 0.1;

    let wp_owned;
    let wp_ref: Option<&RgbImage> = if let Some(wp) = world_pos {
        if wp.width() != w || wp.height() != h {
            wp_owned = image::imageops::resize(wp, w, h, image::imageops::FilterType::Lanczos3);
            Some(&wp_owned)
        } else {
            Some(wp)
        }
    } else {
        wp_owned = RgbImage::new(0, 0);
        None
    };
    let use_triplanar = wp_ref.is_some();

    let body_data: Vec<u8> = (0..h).into_par_iter().flat_map(|y| {
        let mut row = Vec::with_capacity(w as usize);
        for x in 0..w {
            let (mut u, mut v) = if let Some(wp) = wp_ref {
                let wp_px = sample_world_pos(wp, x, y);
                let nrm = normal_from_world_pos(wp, x, y);
                let uv_tri = triplanar_uv(wp_px, nrm, tri_scale, 8.0);
                (uv_tri[0].rem_euclid(1.0), uv_tri[1].rem_euclid(1.0))
            } else {
                let mut u = (x as f32 + 0.5) / wf;
                let mut v = 1.0 - (y as f32 + 0.5) / hf;
                u -= p.pos_x;
                v -= p.pos_y;

                let cu = u - 0.5;
                let cv = v - 0.5;
                u = cu * cos_r - cv * sin_r + 0.5;
                v = cu * sin_r + cv * cos_r + 0.5;

                if tileable {
                    u = u.rem_euclid(1.0);
                    v = v.rem_euclid(1.0);
                } else if u < 0.0 || u > 1.0 || v < 0.0 || v > 1.0 {
                    row.push(0);
                    continue;
                }
                (u, v)
            };

            if use_triplanar {
                u -= p.pos_x;
                v -= p.pos_y;

                let cu = u - 0.5;
                let cv = v - 0.5;
                let ru = cu * cos_r - cv * sin_r;
                let rv = cu * sin_r + cv * cos_r;
                u = ru + 0.5;
                v = rv + 0.5;

                if tileable {
                    u = u.rem_euclid(1.0);
                    v = v.rem_euclid(1.0);
                }
            }

            let u_s = u + offx;
            let v_s = v / stretch + offy;

            let mut sum = 0.0_f32;
            let mut amp = 0.5_f32;
            let mut freq = base_freq / scale;
            let mut total_amp = 0.0_f32;
            for _ in 0..octaves {
                let n = value_noise_streaks(u_s * freq, v_s * freq);
                sum += n * amp;
                total_amp += amp;
                amp *= 0.5;
                freq *= 2.0;
            }
            let n_final = if total_amp > 0.0 { sum / total_amp } else { 0.0 };

            let shifted = (n_final - thr_eff).clamp(0.0, 1.0);
            let window = 0.5 - sharpness * 0.4;
            let out = smoothstep(0.5 - window * 0.5, 0.5 + window * 0.5, shifted);

            row.push((out.clamp(0.0, 1.0) * 255.0) as u8);
        }
        row
    }).collect();

    let mut body = GrayImage::new(w, h);
    body.copy_from_slice(&body_data);

    let height_data: Vec<u8> = body_data.iter().map(|&b| {
        let v = b as f32 / 255.0;
        ((0.5 + v * 0.5) * 255.0).clamp(0.0, 255.0) as u8
    }).collect();
    let mut height = GrayImage::new(w, h);
    height.copy_from_slice(&height_data);

    if let Some(uv) = uv_mask {
        apply_uv_mask_gray(&mut body, uv);
    }

    StreaksProceduralMasks { body, height }
}

// ============ Модуляция ============

pub fn modulate_by_placement(pattern: &GrayImage, placement: &GrayImage, _bias: f32) -> GrayImage {
    let (w, h) = pattern.dimensions();
    if w != placement.width() || h != placement.height() { return pattern.clone(); }
    let pat_raw = pattern.as_raw();
    let plc_raw = placement.as_raw();
    let out: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
        let y = yi as u32;
        let mut row = Vec::with_capacity(w as usize);
        for x in 0..w {
            let idx = (y * w + x) as usize;
            let p = pat_raw[idx] as f32 / 255.0;
            let pl = plc_raw[idx] as f32 / 255.0;
            let factor = 0.85 + 0.15 * pl;
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