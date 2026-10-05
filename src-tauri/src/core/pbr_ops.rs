// Операции над PBR-картами и фильтры для масок.
use image::{GrayImage, RgbImage, Rgb};
use rayon::prelude::*;
use super::noise::TilingNoise;
use crate::commands::pbr::LoadedPbr;

// ============ Height → Normal ============

pub fn height_to_normal(height: &GrayImage, strength: f32) -> RgbImage {
    let (w, h) = height.dimensions();
    let mut out = RgbImage::new(w, h);
    if w < 3 || h < 3 {
        for y in 0..h { for x in 0..w { out.put_pixel(x, y, Rgb([128, 128, 255])); } }
        return out;
    }
    let s = strength.max(0.01);
    let h_raw = height.as_raw();
    let flat: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
        let y = yi as u32;
        let mut row = Vec::with_capacity((w * 3) as usize);
        for x in 0..w {
            let xl = if x == 0 { w - 1 } else { x - 1 };
            let xr = if x == w - 1 { 0 } else { x + 1 };
            let yu = if y == 0 { h - 1 } else { y - 1 };
            let yd = if y == h - 1 { 0 } else { y + 1 };
            let hl = h_raw[(y * w + xl) as usize] as f32 / 255.0;
            let hr = h_raw[(y * w + xr) as usize] as f32 / 255.0;
            let hu = h_raw[(yu * w + x) as usize] as f32 / 255.0;
            let hd = h_raw[(yd * w + x) as usize] as f32 / 255.0;
            let dx = (hr - hl) * s;
            let dy = (hd - hu) * s;
            let nx = -dx; let ny = -dy; let nz = 1.0;
            let len = (nx * nx + ny * ny + nz * nz).sqrt().max(1e-6);
            row.push((((nx / len) * 0.5 + 0.5) * 255.0).clamp(0.0, 255.0) as u8);
            row.push((((ny / len) * 0.5 + 0.5) * 255.0).clamp(0.0, 255.0) as u8);
            row.push((((nz / len) * 0.5 + 0.5) * 255.0).clamp(0.0, 255.0) as u8);
        }
        row
    }).collect();
    out.copy_from_slice(&flat);
    out
}

pub fn blend_normals(base: &RgbImage, dirt: &RgbImage, mask: &GrayImage) -> RgbImage {
    let (w, h) = base.dimensions();
    if w != dirt.width() || h != dirt.height() || w != mask.width() || h != mask.height() {
        return base.clone();
    }
    let b_raw = base.as_raw();
    let d_raw = dirt.as_raw();
    let m_raw = mask.as_raw();
    let flat: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
        let y = yi as u32;
        let mut row = Vec::with_capacity((w * 3) as usize);
        for x in 0..w {
            let idx = (y * w + x) as usize;
            let m = m_raw[idx] as f32 / 255.0;
            if m < 0.01 {
                row.push(b_raw[idx * 3]);
                row.push(b_raw[idx * 3 + 1]);
                row.push(b_raw[idx * 3 + 2]);
                continue;
            }
            if m > 0.99 {
                row.push(d_raw[idx * 3]);
                row.push(d_raw[idx * 3 + 1]);
                row.push(d_raw[idx * 3 + 2]);
                continue;
            }
            let bnx = (b_raw[idx * 3] as f32 / 255.0) * 2.0 - 1.0;
            let bny = (b_raw[idx * 3 + 1] as f32 / 255.0) * 2.0 - 1.0;
            let bnz = (b_raw[idx * 3 + 2] as f32 / 255.0) * 2.0 - 1.0;
            let dnx = (d_raw[idx * 3] as f32 / 255.0) * 2.0 - 1.0;
            let dny = (d_raw[idx * 3 + 1] as f32 / 255.0) * 2.0 - 1.0;
            let dnz = (d_raw[idx * 3 + 2] as f32 / 255.0) * 2.0 - 1.0;
            let nx = bnx * (1.0 - m) + dnx * m;
            let ny = bny * (1.0 - m) + dny * m;
            let nz = bnz * (1.0 - m) + dnz * m;
            let len = (nx * nx + ny * ny + nz * nz).sqrt().max(1e-6);
            row.push((((nx / len) * 0.5 + 0.5) * 255.0).clamp(0.0, 255.0) as u8);
            row.push((((ny / len) * 0.5 + 0.5) * 255.0).clamp(0.0, 255.0) as u8);
            row.push((((nz / len) * 0.5 + 0.5) * 255.0).clamp(0.0, 255.0) as u8);
        }
        row
    }).collect();
    let mut out = RgbImage::new(w, h);
    out.copy_from_slice(&flat);
    out
}

// ============ Curvature ============

pub fn curvature_from_height(height: &GrayImage) -> GrayImage {
    let (w, h) = height.dimensions();
    let mut out = GrayImage::new(w, h);
    if w < 3 || h < 3 { return out; }
    let h_raw = height.as_raw();
    let flat: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
        let y = yi as u32;
        let mut row = Vec::with_capacity(w as usize);
        for x in 0..w {
            let xl = if x == 0 { w - 1 } else { x - 1 };
            let xr = if x == w - 1 { 0 } else { x + 1 };
            let yu = if y == 0 { h - 1 } else { y - 1 };
            let yd = if y == h - 1 { 0 } else { y + 1 };
            let hl = h_raw[(y * w + xl) as usize] as f32 / 255.0;
            let hr = h_raw[(y * w + xr) as usize] as f32 / 255.0;
            let hu = h_raw[(yu * w + x) as usize] as f32 / 255.0;
            let hd = h_raw[(yd * w + x) as usize] as f32 / 255.0;
            let hc = h_raw[(y * w + x) as usize] as f32 / 255.0;
            let lap = (hl + hr + hu + hd) * 0.25 - hc;
            let v = (lap * 4.0 * 0.5 + 0.5).clamp(0.0, 1.0);
            row.push((v * 255.0) as u8);
        }
        row
    }).collect();
    out.copy_from_slice(&flat);
    out
}

// ============ Фильтры ============

pub fn gaussian_blur(img: &GrayImage, radius: u32) -> GrayImage {
    if radius == 0 { return img.clone(); }
    let (w, h) = img.dimensions();
    if w < 2 || h < 2 { return img.clone(); }
    let r = radius as i32;
    let sigma = (radius as f32) / 2.0;
    let sigma2 = sigma * sigma * 2.0;
    let mut kernel: Vec<f32> = Vec::with_capacity((2 * r + 1) as usize);
    let mut sum = 0.0;
    for i in -r..=r {
        let v = (-(i as f32 * i as f32) / sigma2).exp();
        kernel.push(v);
        sum += v;
    }
    for k in kernel.iter_mut() { *k /= sum; }

    let raw = img.as_raw();
    let pass1: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
        let y = yi as u32;
        let mut row = Vec::with_capacity(w as usize);
        for x in 0..w {
            let mut acc = 0.0;
            for (ki, &kv) in kernel.iter().enumerate() {
                let dx = ki as i32 - r;
                let nx = ((x as i32 + dx).rem_euclid(w as i32)) as u32;
                acc += raw[(y * w + nx) as usize] as f32 * kv;
            }
            row.push(acc.clamp(0.0, 255.0) as u8);
        }
        row
    }).collect();

    let pass2: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
        let y = yi as u32;
        let mut row = Vec::with_capacity(w as usize);
        for x in 0..w {
            let mut acc = 0.0;
            for (ki, &kv) in kernel.iter().enumerate() {
                let dy = ki as i32 - r;
                let ny = ((y as i32 + dy).rem_euclid(h as i32)) as u32;
                acc += pass1[(ny * w + x) as usize] as f32 * kv;
            }
            row.push(acc.clamp(0.0, 255.0) as u8);
        }
        row
    }).collect();

    let mut out = GrayImage::new(w, h);
    out.copy_from_slice(&pass2);
    out
}

pub fn levels_mask(img: &GrayImage, in_black: f32, in_white: f32) -> GrayImage {
    let (w, h) = img.dimensions();
    let range = (in_white - in_black).max(0.001);
    let raw = img.as_raw();
    let flat: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
        let y = yi as u32;
        let mut row = Vec::with_capacity(w as usize);
        for x in 0..w {
            let v = raw[(y * w + x) as usize] as f32 / 255.0;
            let out = ((v - in_black) / range).clamp(0.0, 1.0);
            row.push((out * 255.0) as u8);
        }
        row
    }).collect();
    let mut out = GrayImage::new(w, h);
    out.copy_from_slice(&flat);
    out
}

pub fn warp_mask(mask: &GrayImage, noise: &TilingNoise, amount: f32) -> GrayImage {
    let (w, h) = mask.dimensions();
    if amount <= 0.0 { return mask.clone(); }
    let wf = w as f32;
    let hf = h as f32;
    let raw = mask.as_raw();
    let flat: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
        let y = yi as u32;
        let mut row = Vec::with_capacity(w as usize);
        for x in 0..w {
            let xf = x as f32;
            let yf = y as f32;
            let wx = noise.fbm(xf, yf, wf, hf, 3, 0.5, 2.0) * amount * wf;
            let wy = noise.fbm(xf + 500.0, yf + 500.0, wf, hf, 3, 0.5, 2.0) * amount * hf;
            let sx = ((xf + wx).rem_euclid(wf)) as u32;
            let sy = ((yf + wy).rem_euclid(hf)) as u32;
            row.push(raw[(sy * w + sx) as usize]);
        }
        row
    }).collect();
    let mut out = GrayImage::new(w, h);
    out.copy_from_slice(&flat);
    out
}

pub fn sharpen_mask(img: &GrayImage, amount: f32) -> GrayImage {
    if amount <= 0.0 { return img.clone(); }
    let blurred = gaussian_blur(img, 1);
    let (w, h) = img.dimensions();
    let raw = img.as_raw();
    let blur_raw = blurred.as_raw();
    let flat: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
        let y = yi as u32;
        let mut row = Vec::with_capacity(w as usize);
        for x in 0..w {
            let idx = (y * w + x) as usize;
            let orig = raw[idx] as f32;
            let blur = blur_raw[idx] as f32;
            let v = (orig + amount * (orig - blur)).clamp(0.0, 255.0);
            row.push(v as u8);
        }
        row
    }).collect();
    let mut out = GrayImage::new(w, h);
    out.copy_from_slice(&flat);
    out
}

pub fn threshold_sharp(img: &GrayImage, low: f32, high: f32) -> GrayImage {
    let (w, h) = img.dimensions();
    let raw = img.as_raw();
    let range = (high - low).max(0.001);
    let flat: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
        let y = yi as u32;
        let mut row = Vec::with_capacity(w as usize);
        for x in 0..w {
            let v = raw[(y * w + x) as usize] as f32 / 255.0;
            let t = ((v - low) / range).clamp(0.0, 1.0);
            let out = t * t * (3.0 - 2.0 * t);
            row.push((out * 255.0) as u8);
        }
        row
    }).collect();
    let mut out = GrayImage::new(w, h);
    out.copy_from_slice(&flat);
    out
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

// ============ Операции применения ============

pub fn apply_mask_to_normal(original: &RgbImage, mask: &GrayImage, depth: f32) -> RgbImage {
    let (w, h) = original.dimensions();
    if w != mask.width() || h != mask.height() || depth <= 0.0 { return original.clone(); }
    let orig_raw = original.as_raw();
    let mask_raw = mask.as_raw();
    let flat: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
        let y = yi as u32;
        let mut row = Vec::with_capacity((w * 3) as usize);
        for x in 0..w {
            let idx_m = (y * w + x) as usize;
            let m = mask_raw[idx_m] as f32 / 255.0;
            let idx = idx_m * 3;
            if m < 0.01 {
                row.push(orig_raw[idx]);
                row.push(orig_raw[idx + 1]);
                row.push(orig_raw[idx + 2]);
                continue;
            }
            let xl = if x == 0 { w - 1 } else { x - 1 };
            let xr = if x == w - 1 { 0 } else { x + 1 };
            let yu = if y == 0 { h - 1 } else { y - 1 };
            let yd = if y == h - 1 { 0 } else { y + 1 };
            let ml = mask_raw[(y * w + xl) as usize] as f32 / 255.0;
            let mr = mask_raw[(y * w + xr) as usize] as f32 / 255.0;
            let mu = mask_raw[(yu * w + x) as usize] as f32 / 255.0;
            let md = mask_raw[(yd * w + x) as usize] as f32 / 255.0;
            let gx = (mr - ml) * depth * 2.0;
            let gy = (md - mu) * depth * 2.0;
            let nx = (orig_raw[idx] as f32 / 255.0 - 0.5) * 2.0;
            let ny = (orig_raw[idx + 1] as f32 / 255.0 - 0.5) * 2.0;
            let nz = (orig_raw[idx + 2] as f32 / 255.0) * 2.0 - 1.0;
            let new_nx = (nx - gx).clamp(-1.0, 1.0);
            let new_ny = (ny - gy).clamp(-1.0, 1.0);
            let len = (new_nx * new_nx + new_ny * new_ny + nz * nz).sqrt().max(1e-6);
            row.push((((new_nx / len) * 0.5 + 0.5) * 255.0).clamp(0.0, 255.0) as u8);
            row.push((((new_ny / len) * 0.5 + 0.5) * 255.0).clamp(0.0, 255.0) as u8);
            row.push((((nz / len) * 0.5 + 0.5) * 255.0).clamp(0.0, 255.0) as u8);
        }
        row
    }).collect();
    let mut out = RgbImage::new(w, h);
    out.copy_from_slice(&flat);
    out
}

pub fn darken_by_mask_sharp(albedo: &RgbImage, mask: &GrayImage, amount: f32) -> RgbImage {
    let (w, h) = albedo.dimensions();
    if w != mask.width() || h != mask.height() { return albedo.clone(); }
    let a_raw = albedo.as_raw();
    let m_raw = mask.as_raw();
    let flat: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
        let y = yi as u32;
        let mut row = Vec::with_capacity((w * 3) as usize);
        for x in 0..w {
            let idx_m = (y * w + x) as usize;
            let m = m_raw[idx_m] as f32 / 255.0;
            let factor = 1.0 - amount * m;
            let idx = idx_m * 3;
            row.push((a_raw[idx] as f32 * factor).clamp(0.0, 255.0) as u8);
            row.push((a_raw[idx + 1] as f32 * factor).clamp(0.0, 255.0) as u8);
            row.push((a_raw[idx + 2] as f32 * factor).clamp(0.0, 255.0) as u8);
        }
        row
    }).collect();
    let mut out = RgbImage::new(w, h);
    out.copy_from_slice(&flat);
    out
}

pub fn blend_color_lerp(
    albedo: &RgbImage, mask: &GrayImage, amount: f32,
    color_lo: [u8; 3], color_hi: [u8; 3], tint: f32,
) -> RgbImage {
    let (w, h) = albedo.dimensions();
    if w != mask.width() || h != mask.height() { return albedo.clone(); }
    let color = [
        (color_lo[0] as f32 * (1.0 - tint) + color_hi[0] as f32 * tint) as u8,
        (color_lo[1] as f32 * (1.0 - tint) + color_hi[1] as f32 * tint) as u8,
        (color_lo[2] as f32 * (1.0 - tint) + color_hi[2] as f32 * tint) as u8,
    ];
    let a_raw = albedo.as_raw();
    let m_raw = mask.as_raw();
    let flat: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
        let y = yi as u32;
        let mut row = Vec::with_capacity((w * 3) as usize);
        for x in 0..w {
            let idx_m = (y * w + x) as usize;
            let m = m_raw[idx_m] as f32 / 255.0;
            let t = (amount * m).clamp(0.0, 1.0);
            let idx = idx_m * 3;
            row.push((a_raw[idx] as f32 * (1.0 - t) + color[0] as f32 * t).clamp(0.0, 255.0) as u8);
            row.push((a_raw[idx + 1] as f32 * (1.0 - t) + color[1] as f32 * t).clamp(0.0, 255.0) as u8);
            row.push((a_raw[idx + 2] as f32 * (1.0 - t) + color[2] as f32 * t).clamp(0.0, 255.0) as u8);
        }
        row
    }).collect();
    let mut out = RgbImage::new(w, h);
    out.copy_from_slice(&flat);
    out
}

pub fn darken_ao_by_mask(ao: &GrayImage, mask: &GrayImage, amount: f32) -> GrayImage {
    let (w, h) = ao.dimensions();
    if w != mask.width() || h != mask.height() { return ao.clone(); }
    let ao_raw = ao.as_raw();
    let m_raw = mask.as_raw();
    let flat: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
        let y = yi as u32;
        let mut row = Vec::with_capacity(w as usize);
        for x in 0..w {
            let idx = (y * w + x) as usize;
            let m = m_raw[idx] as f32 / 255.0;
            let a = ao_raw[idx] as f32 / 255.0;
            let new_a = (a * (1.0 - amount * m)).clamp(0.0, 1.0);
            row.push((new_a * 255.0) as u8);
        }
        row
    }).collect();
    let mut out = GrayImage::new(w, h);
    out.copy_from_slice(&flat);
    out
}

pub fn scratch_roughness(roughness: &GrayImage, mask: &GrayImage, amount: f32) -> GrayImage {
    let (w, h) = roughness.dimensions();
    if w != mask.width() || h != mask.height() { return roughness.clone(); }
    let r_raw = roughness.as_raw();
    let m_raw = mask.as_raw();
    let flat: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
        let y = yi as u32;
        let mut row = Vec::with_capacity(w as usize);
        for x in 0..w {
            let idx = (y * w + x) as usize;
            let m = m_raw[idx] as f32 / 255.0;
            let r = r_raw[idx] as f32 / 255.0;
            let center_polish = -m.powf(2.0) * amount * 0.4;
            let edge_rough = m * (1.0 - m) * amount * 1.2;
            let new_r = (r + center_polish + edge_rough).clamp(0.0, 1.0);
            row.push((new_r * 255.0) as u8);
        }
        row
    }).collect();
    let mut out = GrayImage::new(w, h);
    out.copy_from_slice(&flat);
    out
}

pub fn increase_roughness_by_mask(roughness: &GrayImage, mask: &GrayImage, amount: f32) -> GrayImage {
    let (w, h) = roughness.dimensions();
    if w != mask.width() || h != mask.height() { return roughness.clone(); }
    let r_raw = roughness.as_raw();
    let m_raw = mask.as_raw();
    let flat: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
        let y = yi as u32;
        let mut row = Vec::with_capacity(w as usize);
        for x in 0..w {
            let idx = (y * w + x) as usize;
            let m = m_raw[idx] as f32 / 255.0;
            let r = r_raw[idx] as f32 / 255.0;
            let new_r = (r + amount * m).clamp(0.0, 1.0);
            row.push((new_r * 255.0) as u8);
        }
        row
    }).collect();
    let mut out = GrayImage::new(w, h);
    out.copy_from_slice(&flat);
    out
}

pub fn decrease_metalness_by_mask(m: &GrayImage, mask: &GrayImage, amount: f32) -> GrayImage {
    let (w, h) = m.dimensions();
    if w != mask.width() || h != mask.height() { return m.clone(); }
    let m_raw = m.as_raw();
    let mk_raw = mask.as_raw();
    let flat: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
        let y = yi as u32;
        let mut row = Vec::with_capacity(w as usize);
        for x in 0..w {
            let idx = (y * w + x) as usize;
            let mv = mk_raw[idx] as f32 / 255.0;
            let v = m_raw[idx] as f32 / 255.0;
            let new_v = (v * (1.0 - amount * mv)).clamp(0.0, 1.0);
            row.push((new_v * 255.0) as u8);
        }
        row
    }).collect();
    let mut out = GrayImage::new(w, h);
    out.copy_from_slice(&flat);
    out
}

pub fn add_rim_highlight(albedo: &RgbImage, mask: &GrayImage, amount: f32, dark: bool) -> RgbImage {
    let (w, h) = albedo.dimensions();
    if w != mask.width() || h != mask.height() || amount <= 0.0 { return albedo.clone(); }
    let blurred = gaussian_blur(mask, 2);
    let a_raw = albedo.as_raw();
    let m_raw = mask.as_raw();
    let b_raw = blurred.as_raw();
    let flat: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
        let y = yi as u32;
        let mut row = Vec::with_capacity((w * 3) as usize);
        for x in 0..w {
            let idx_m = (y * w + x) as usize;
            let m = m_raw[idx_m] as f32 / 255.0;
            let b = b_raw[idx_m] as f32 / 255.0;
            let rim = (b - m).max(0.0);
            let factor = if dark { 1.0 - rim * amount * 0.5 } else { 1.0 + rim * amount * 0.8 };
            let idx = idx_m * 3;
            row.push((a_raw[idx] as f32 * factor).clamp(0.0, 255.0) as u8);
            row.push((a_raw[idx + 1] as f32 * factor).clamp(0.0, 255.0) as u8);
            row.push((a_raw[idx + 2] as f32 * factor).clamp(0.0, 255.0) as u8);
        }
        row
    }).collect();
    let mut out = RgbImage::new(w, h);
    out.copy_from_slice(&flat);
    out
}

// ============ CUSTOM MASKS ============

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MaskKind {
    Mono,
    Color,
}

#[derive(Debug, Clone, Copy)]
pub struct MaskParams {
    pub kind: MaskKind,
    pub pos_x: f32,
    pub pos_y: f32,
    pub scale: f32,
    pub rotation: f32,
    pub opacity: f32,
    pub color: [u8; 3],
    pub affect_albedo: bool,
    pub affect_roughness: bool,
    pub affect_normal: bool,
}

impl Default for MaskParams {
    fn default() -> Self {
        Self {
            kind: MaskKind::Mono,
            pos_x: 0.0,
            pos_y: 0.0,
            scale: 1.0,
            rotation: 0.0,
            opacity: 1.0,
            color: [95, 85, 75],
            affect_albedo: true,
            affect_roughness: false,
            affect_normal: false,
        }
    }
}

#[inline]
fn transform_uv(x: u32, y: u32, w: u32, h: u32, p: &MaskParams) -> Option<(f32, f32)> {
    let wf = w as f32;
    let hf = h as f32;
    let u = x as f32 / wf;
    let v = y as f32 / hf;
    let mut cu = u - 0.5;
    let mut cv = v - 0.5;
    cu -= p.pos_x * 0.5;
    cv -= p.pos_y * 0.5;
    let angle = -p.rotation.to_radians();
    let cos_a = angle.cos();
    let sin_a = angle.sin();
    let ru = cu * cos_a - cv * sin_a;
    let rv = cu * sin_a + cv * cos_a;
    let su = ru / p.scale.max(0.001);
    let sv = rv / p.scale.max(0.001);
    let mu = su + 0.5;
    let mv = sv + 0.5;
    if mu < 0.0 || mu > 1.0 || mv < 0.0 || mv > 1.0 {
        return None;
    }
    Some((mu, mv))
}

#[inline]
fn sample_rgb_bilinear(img: &RgbImage, u: f32, v: f32) -> [f32; 3] {
    let (w, h) = img.dimensions();
    if w == 0 || h == 0 { return [0.0, 0.0, 0.0]; }
    let x = (u * (w as f32 - 1.0)).clamp(0.0, w as f32 - 1.0);
    let y = (v * (h as f32 - 1.0)).clamp(0.0, h as f32 - 1.0);
    let x0 = x.floor() as u32;
    let y0 = y.floor() as u32;
    let x1 = (x0 + 1).min(w - 1);
    let y1 = (y0 + 1).min(h - 1);
    let fx = x - x0 as f32;
    let fy = y - y0 as f32;
    let p00 = img.get_pixel(x0, y0);
    let p10 = img.get_pixel(x1, y0);
    let p01 = img.get_pixel(x0, y1);
    let p11 = img.get_pixel(x1, y1);
    let mut out = [0.0f32; 3];
    for c in 0..3 {
        let v00 = p00[c] as f32;
        let v10 = p10[c] as f32;
        let v01 = p01[c] as f32;
        let v11 = p11[c] as f32;
        let top = v00 * (1.0 - fx) + v10 * fx;
        let bot = v01 * (1.0 - fx) + v11 * fx;
        out[c] = top * (1.0 - fy) + bot * fy;
    }
    out
}

#[inline]
fn sample_mask(img: &RgbImage, u: f32, v: f32, p: &MaskParams) -> (f32, [u8; 3]) {
    let rgb = sample_rgb_bilinear(img, u, v);
    let lum = (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) / 255.0;
    let coverage = lum.clamp(0.0, 1.0) * p.opacity;
    let color = match p.kind {
        MaskKind::Mono => p.color,
        MaskKind::Color => [
            rgb[0].clamp(0.0, 255.0) as u8,
            rgb[1].clamp(0.0, 255.0) as u8,
            rgb[2].clamp(0.0, 255.0) as u8,
        ],
    };
    (coverage, color)
}

pub fn apply_custom_mask_to_albedo(albedo: &RgbImage, mask: &RgbImage, p: &MaskParams) -> RgbImage {
    let (w, h) = albedo.dimensions();
    if !p.affect_albedo || p.opacity <= 0.001 {
        return albedo.clone();
    }
    let mask_owned;
    let mask_ref = if w != mask.width() || h != mask.height() {
        mask_owned = image::imageops::resize(mask, w, h, image::imageops::FilterType::Nearest);
        &mask_owned
    } else {
        mask
    };

    let a_raw = albedo.as_raw();
    let m_raw = mask_ref.as_raw();

    let flat: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
        let y = yi as u32;
        let mut row = Vec::with_capacity((w * 3) as usize);
        for x in 0..w {
            let idx = (y * w + x) as usize;
            match transform_uv(x, y, w, h, p) {
                Some((mu, mv)) => {
                    let mx = (mu * (w as f32 - 1.0)).clamp(0.0, w as f32 - 1.0);
                    let my = (mv * (h as f32 - 1.0)).clamp(0.0, h as f32 - 1.0);
                    let x0 = mx.floor() as u32;
                    let y0 = my.floor() as u32;
                    let x1 = (x0 + 1).min(w - 1);
                    let y1 = (y0 + 1).min(h - 1);
                    let fx = mx - x0 as f32;
                    let fy = my - y0 as f32;

                    let mut rgb = [0.0f32; 3];
                    for c in 0..3 {
                        let i00 = ((y0 * w + x0) * 3 + c as u32) as usize;
                        let i10 = ((y0 * w + x1) * 3 + c as u32) as usize;
                        let i01 = ((y1 * w + x0) * 3 + c as u32) as usize;
                        let i11 = ((y1 * w + x1) * 3 + c as u32) as usize;
                        let v00 = m_raw[i00] as f32;
                        let v10 = m_raw[i10] as f32;
                        let v01 = m_raw[i01] as f32;
                        let v11 = m_raw[i11] as f32;
                        let top = v00 * (1.0 - fx) + v10 * fx;
                        let bot = v01 * (1.0 - fx) + v11 * fx;
                        rgb[c] = top * (1.0 - fy) + bot * fy;
                    }

                    let lum = (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) / 255.0;
                    let coverage = lum.clamp(0.0, 1.0) * p.opacity;

                    let color = match p.kind {
                        MaskKind::Mono => [
                            p.color[0] as f32,
                            p.color[1] as f32,
                            p.color[2] as f32,
                        ],
                        MaskKind::Color => [rgb[0], rgb[1], rgb[2]],
                    };

                    let a0 = a_raw[idx * 3] as f32;
                    let a1 = a_raw[idx * 3 + 1] as f32;
                    let a2 = a_raw[idx * 3 + 2] as f32;

                    row.push((a0 * (1.0 - coverage) + color[0] * coverage).clamp(0.0, 255.0) as u8);
                    row.push((a1 * (1.0 - coverage) + color[1] * coverage).clamp(0.0, 255.0) as u8);
                    row.push((a2 * (1.0 - coverage) + color[2] * coverage).clamp(0.0, 255.0) as u8);
                }
                None => {
                    row.push(a_raw[idx * 3]);
                    row.push(a_raw[idx * 3 + 1]);
                    row.push(a_raw[idx * 3 + 2]);
                }
            }
        }
        row
    }).collect();

    let mut out = RgbImage::new(w, h);
    out.copy_from_slice(&flat);
    out
}

pub fn apply_custom_mask_to_roughness(rough: &GrayImage, mask: &RgbImage, p: &MaskParams) -> GrayImage {
    let (w, h) = rough.dimensions();
    if w != mask.width() || h != mask.height() || !p.affect_roughness || p.opacity <= 0.001 {
        return rough.clone();
    }

    let r_raw = rough.as_raw();
    let m_raw = mask.as_raw();
    let new_rough: f32 = 0.9;

    let flat: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
        let y = yi as u32;
        let mut row = Vec::with_capacity(w as usize);
        for x in 0..w {
            let idx = (y * w + x) as usize;
            match transform_uv(x, y, w, h, p) {
                Some((mu, mv)) => {
                    let mx = (mu * (w as f32 - 1.0)).clamp(0.0, w as f32 - 1.0);
                    let my = (mv * (h as f32 - 1.0)).clamp(0.0, h as f32 - 1.0);
                    let x0 = mx.floor() as u32;
                    let y0 = my.floor() as u32;
                    let x1 = (x0 + 1).min(w - 1);
                    let y1 = (y0 + 1).min(h - 1);
                    let fx = mx - x0 as f32;
                    let fy = my - y0 as f32;

                    let mut lum = 0.0f32;
                    for c in 0..3 {
                        let i00 = ((y0 * w + x0) * 3 + c as u32) as usize;
                        let i10 = ((y0 * w + x1) * 3 + c as u32) as usize;
                        let i01 = ((y1 * w + x0) * 3 + c as u32) as usize;
                        let i11 = ((y1 * w + x1) * 3 + c as u32) as usize;
                        let v00 = m_raw[i00] as f32;
                        let v10 = m_raw[i10] as f32;
                        let v01 = m_raw[i01] as f32;
                        let v11 = m_raw[i11] as f32;
                        let top = v00 * (1.0 - fx) + v10 * fx;
                        let bot = v01 * (1.0 - fx) + v11 * fx;
                        let v = top * (1.0 - fy) + bot * fy;
                        let coeff = match c { 0 => 0.299, 1 => 0.587, _ => 0.114 };
                        lum += v * coeff;
                    }
                    lum /= 255.0;
                    let coverage = lum.clamp(0.0, 1.0) * p.opacity;

                    let r = r_raw[idx] as f32 / 255.0;
                    let new_r = (r * (1.0 - coverage) + new_rough * coverage).clamp(0.0, 1.0);
                    row.push((new_r * 255.0) as u8);
                }
                None => row.push(r_raw[idx]),
            }
        }
        row
    }).collect();

    let mut out = GrayImage::new(w, h);
    out.copy_from_slice(&flat);
    out
}

pub fn apply_custom_mask_to_normal(normal: &RgbImage, mask: &RgbImage, p: &MaskParams, depth: f32) -> RgbImage {
    let (w, h) = normal.dimensions();
    if w != mask.width() || h != mask.height() || !p.affect_normal || p.opacity <= 0.001 {
        return normal.clone();
    }
    if depth <= 0.0 { return normal.clone(); }

    let n_raw = normal.as_raw();
    let m_raw = mask.as_raw();

    let lum_map: Vec<f32> = (0..(w * h) as usize).into_par_iter().map(|i| {
        let r = m_raw[i * 3] as f32;
        let g = m_raw[i * 3 + 1] as f32;
        let b = m_raw[i * 3 + 2] as f32;
        (r * 0.299 + g * 0.587 + b * 0.114) / 255.0
    }).collect();

    let flat: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
        let y = yi as u32;
        let mut row = Vec::with_capacity((w * 3) as usize);
        for x in 0..w {
            let idx = (y * w + x) as usize;
            match transform_uv(x, y, w, h, p) {
                Some((mu, mv)) => {
                    let mx = (mu * (w as f32 - 1.0)).clamp(0.0, w as f32 - 1.0);
                    let my = (mv * (h as f32 - 1.0)).clamp(0.0, h as f32 - 1.0);
                    let xi = mx.round() as i32;
                    let yi_ = my.round() as i32;
                    let xl = (xi - 1).clamp(0, w as i32 - 1) as usize;
                    let xr = (xi + 1).clamp(0, w as i32 - 1) as usize;
                    let yu = (yi_ - 1).clamp(0, h as i32 - 1) as usize;
                    let yd = (yi_ + 1).clamp(0, h as i32 - 1) as usize;
                    let yc = yi_.clamp(0, h as i32 - 1) as usize;
                    let xc = xi.clamp(0, w as i32 - 1) as usize;

                    let l = lum_map[yc * w as usize + xl];
                    let r = lum_map[yc * w as usize + xr];
                    let u_ = lum_map[yu * w as usize + xc];
                    let d = lum_map[yd * w as usize + xc];

                    let gx = (r - l) * depth * p.opacity;
                    let gy = (d - u_) * depth * p.opacity;

                    let nx = (n_raw[idx * 3] as f32 / 255.0 - 0.5) * 2.0;
                    let ny = (n_raw[idx * 3 + 1] as f32 / 255.0 - 0.5) * 2.0;
                    let nz = (n_raw[idx * 3 + 2] as f32 / 255.0) * 2.0 - 1.0;

                    let new_nx = (nx - gx).clamp(-1.0, 1.0);
                    let new_ny = (ny - gy).clamp(-1.0, 1.0);

                    let len = (new_nx * new_nx + new_ny * new_ny + nz * nz).sqrt().max(1e-6);
                    row.push((((new_nx / len) * 0.5 + 0.5) * 255.0).clamp(0.0, 255.0) as u8);
                    row.push((((new_ny / len) * 0.5 + 0.5) * 255.0).clamp(0.0, 255.0) as u8);
                    row.push((((nz / len) * 0.5 + 0.5) * 255.0).clamp(0.0, 255.0) as u8);
                }
                None => {
                    row.push(n_raw[idx * 3]);
                    row.push(n_raw[idx * 3 + 1]);
                    row.push(n_raw[idx * 3 + 2]);
                }
            }
        }
        row
    }).collect();

    let mut out = RgbImage::new(w, h);
    out.copy_from_slice(&flat);
    out
}

// ═══════════════════════════════════════════════════════════
// DECAL
// ═══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Copy)]
pub struct DecalParamsFromUI {
    pub pos_x: f32,
    pub pos_y: f32,
    pub scale: f32,
    pub rotation_deg: f32,
    pub keep_aspect: bool,
    pub opacity: f32,
    pub affect_albedo: bool,
    pub affect_roughness: bool,
    pub affect_normal: bool,
    pub height_intensity: f32,
    pub random_position: bool,
    pub random_rotation: bool,
    pub tile_edge: bool,
}

impl Default for DecalParamsFromUI {
    fn default() -> Self {
        Self {
            pos_x: 0.0,
            pos_y: 0.0,
            scale: 1.0,
            rotation_deg: 0.0,
            keep_aspect: true,
            opacity: 1.0,
            affect_albedo: true,
            affect_roughness: false,
            affect_normal: false,
            height_intensity: 0.0,
            random_position: false,
            random_rotation: false,
            tile_edge: false,
        }
    }
}

#[inline]
fn sample_rgba_bilinear(img: &image::RgbaImage, u: f32, v: f32) -> [f32; 4] {
    let (w, h) = img.dimensions();
    if w == 0 || h == 0 { return [0.0, 0.0, 0.0, 0.0]; }

    let x = (u * (w as f32 - 1.0)).clamp(0.0, w as f32 - 1.0);
    let y = (v * (h as f32 - 1.0)).clamp(0.0, h as f32 - 1.0);
    let x0 = x.floor() as u32;
    let y0 = y.floor() as u32;
    let x1 = (x0 + 1).min(w - 1);
    let y1 = (y0 + 1).min(h - 1);
    let fx = x - x0 as f32;
    let fy = y - y0 as f32;

    let p00 = img.get_pixel(x0, y0).0;
    let p10 = img.get_pixel(x1, y0).0;
    let p01 = img.get_pixel(x0, y1).0;
    let p11 = img.get_pixel(x1, y1).0;

    let mut out = [0.0f32; 4];
    for c in 0..4 {
        let v00 = p00[c] as f32;
        let v10 = p10[c] as f32;
        let v01 = p01[c] as f32;
        let v11 = p11[c] as f32;
        let top = v00 * (1.0 - fx) + v10 * fx;
        let bot = v01 * (1.0 - fx) + v11 * fx;
        out[c] = top * (1.0 - fy) + bot * fy;
    }
    out
}

#[inline]
fn sample_gray_bilinear(img: &GrayImage, u: f32, v: f32) -> f32 {
    let (w, h) = img.dimensions();
    if w == 0 || h == 0 { return 0.0; }
    let x = (u * (w as f32 - 1.0)).clamp(0.0, w as f32 - 1.0);
    let y = (v * (h as f32 - 1.0)).clamp(0.0, h as f32 - 1.0);
    let x0 = x.floor() as u32;
    let y0 = y.floor() as u32;
    let x1 = (x0 + 1).min(w - 1);
    let y1 = (y0 + 1).min(h - 1);
    let fx = x - x0 as f32;
    let fy = y - y0 as f32;

    let v00 = img.get_pixel(x0, y0).0[0] as f32;
    let v10 = img.get_pixel(x1, y0).0[0] as f32;
    let v01 = img.get_pixel(x0, y1).0[0] as f32;
    let v11 = img.get_pixel(x1, y1).0[0] as f32;

    let top = v00 * (1.0 - fx) + v10 * fx;
    let bot = v01 * (1.0 - fx) + v11 * fx;
    top * (1.0 - fy) + bot * fy
}

/// Наложение Decal на PBR-сет.
/// Формула 1-в-1 с decal-shader.js (GLSL).
pub fn apply_decal_to_set(
    set: &LoadedPbr,
    decal: &image::RgbaImage,
    height: Option<&GrayImage>,
    p: &DecalParamsFromUI,
) -> LoadedPbr {
    let (w, h) = (set.width(), set.height());
    if w == 0 || h == 0 { return set.clone(); }

    let (dw, dh) = decal.dimensions();
    if dw == 0 || dh == 0 { return set.clone(); }

    let aspect_w = dw as f32;
    let aspect_h = dh as f32;
    let scale_x = p.scale.max(0.001);
    let scale_y = if p.keep_aspect && aspect_w > 0.0 {
        p.scale * (aspect_h / aspect_w)
    } else {
        p.scale
    }.max(0.001);

    let rot_rad = -p.rotation_deg.to_radians();
    let cos_r = rot_rad.cos();
    let sin_r = rot_rad.sin();

    let opacity = p.opacity.clamp(0.0, 1.0);
    let amount_albedo = if p.affect_albedo { 1.0f32 } else { 0.0 };
    let amount_rough  = if p.affect_roughness { 1.0f32 } else { 0.0 };
    let amount_normal = if p.affect_normal { 1.0f32 } else { 0.0 };
    let height_intensity = p.height_intensity;

    let wf = w as f32;
    let hf = h as f32;
    let eps = 1.0f32 / 512.0;

    let n_px = (w * h) as usize;
    let decal_uvs: Vec<Option<(f32, f32)>> = (0..n_px).into_par_iter().map(|i| {
        let x = (i as u32) % w;
        let y = (i as u32) / w;
        let u = x as f32 / wf;
        let v = y as f32 / hf;

        let cx = u - 0.5 - p.pos_x;
        let cy = v - 0.5 - p.pos_y;
        let rx = cx * cos_r - cy * sin_r;
        let ry = cx * sin_r + cy * cos_r;
        let du = rx / scale_x;
        let dv = ry / scale_y;
        let mu = du + 0.5;
        let mv = dv + 0.5;

        if p.tile_edge {
            Some((mu.rem_euclid(1.0), mv.rem_euclid(1.0)))
        } else {
            if mu < 0.0 || mu > 1.0 || mv < 0.0 || mv > 1.0 {
                None
            } else {
                Some((mu, mv))
            }
        }
    }).collect();

    // ═══ ALBEDO ═══
    let new_albedo = set.albedo.as_ref().map(|albedo| {
        let a_raw = albedo.as_raw();
        let flat: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
            let y = yi as u32;
            let mut row = Vec::with_capacity((w * 3) as usize);
            for x in 0..w {
                let idx = (y * w + x) as usize;
                let a0 = a_raw[idx * 3] as f32;
                let a1 = a_raw[idx * 3 + 1] as f32;
                let a2 = a_raw[idx * 3 + 2] as f32;

                match decal_uvs[idx] {
                    Some((mu, mv)) => {
                        let d = sample_rgba_bilinear(decal, mu, mv);
                        let mask = (d[3] / 255.0) * opacity;
                        if mask < 0.001 || amount_albedo < 0.001 {
                            row.push(a0 as u8);
                            row.push(a1 as u8);
                            row.push(a2 as u8);
                        } else {
                            let t = (mask * amount_albedo).clamp(0.0, 1.0);
                            row.push((a0 * (1.0 - t) + d[0] * t).clamp(0.0, 255.0) as u8);
                            row.push((a1 * (1.0 - t) + d[1] * t).clamp(0.0, 255.0) as u8);
                            row.push((a2 * (1.0 - t) + d[2] * t).clamp(0.0, 255.0) as u8);
                        }
                    }
                    None => {
                        row.push(a0 as u8);
                        row.push(a1 as u8);
                        row.push(a2 as u8);
                    }
                }
            }
            row
        }).collect();
        let mut img = RgbImage::new(w, h);
        img.copy_from_slice(&flat);
        img
    });

    // ═══ ROUGHNESS ═══
    let new_roughness = set.roughness.as_ref().map(|rough| {
        let r_raw = rough.as_raw();
        let flat: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
            let y = yi as u32;
            let mut row = Vec::with_capacity(w as usize);
            for x in 0..w {
                let idx = (y * w + x) as usize;
                let rv = r_raw[idx] as f32 / 255.0;
                match decal_uvs[idx] {
                    Some((mu, mv)) => {
                        let d = sample_rgba_bilinear(decal, mu, mv);
                        let mask = (d[3] / 255.0) * opacity;
                        if mask < 0.001 || amount_rough < 0.001 {
                            row.push(r_raw[idx]);
                        } else {
                            let new_r = (rv + mask * amount_rough).clamp(0.0, 1.0);
                            row.push((new_r * 255.0) as u8);
                        }
                    }
                    None => row.push(r_raw[idx]),
                }
            }
            row
        }).collect();
        let mut img = GrayImage::new(w, h);
        img.copy_from_slice(&flat);
        img
    });

    // ═══ HEIGHT (для normal) ═══
    let new_normal = if amount_normal > 0.001 && height_intensity.abs() > 0.001 {
        set.normal.as_ref().map(|normal| {
            let n_raw = normal.as_raw();

            let flat: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
                let y = yi as u32;
                let mut row = Vec::with_capacity((w * 3) as usize);
                for x in 0..w {
                    let idx = (y * w + x) as usize;

                    let n0 = n_raw[idx * 3] as f32 / 255.0 * 2.0 - 1.0;
                    let n1 = n_raw[idx * 3 + 1] as f32 / 255.0 * 2.0 - 1.0;
                    let n2 = n_raw[idx * 3 + 2] as f32 / 255.0 * 2.0 - 1.0;

                    let uv = match decal_uvs[idx] {
                        Some(uv) => uv,
                        None => {
                            row.push(n_raw[idx * 3]);
                            row.push(n_raw[idx * 3 + 1]);
                            row.push(n_raw[idx * 3 + 2]);
                            continue;
                        }
                    };

                    let h_l = sample_height_at(uv.0 - eps, uv.1, decal, height);
                    let h_r = sample_height_at(uv.0 + eps, uv.1, decal, height);
                    let h_d = sample_height_at(uv.0, uv.1 - eps, decal, height);
                    let h_u = sample_height_at(uv.0, uv.1 + eps, decal, height);

                    let gx = (h_r - h_l) * height_intensity;
                    let gy = (h_u - h_d) * height_intensity;

                    let new_nx = (n0 - gx * 4.0).clamp(-1.0, 1.0);
                    let new_ny = (n1 - gy * 4.0).clamp(-1.0, 1.0);

                    let len = (new_nx * new_nx + new_ny * new_ny + n2 * n2).sqrt().max(1e-6);
                    row.push((((new_nx / len) * 0.5 + 0.5) * 255.0).clamp(0.0, 255.0) as u8);
                    row.push((((new_ny / len) * 0.5 + 0.5) * 255.0).clamp(0.0, 255.0) as u8);
                    row.push((((n2 / len) * 0.5 + 0.5) * 255.0).clamp(0.0, 255.0) as u8);
                }
                row
            }).collect();
            let mut img = RgbImage::new(w, h);
            img.copy_from_slice(&flat);
            img
        })
    } else {
        set.normal.clone()
    };

    LoadedPbr {
        albedo: new_albedo.or_else(|| set.albedo.clone()),
        normal: new_normal.or_else(|| set.normal.clone()),
        roughness: new_roughness.or_else(|| set.roughness.clone()),
        ao: set.ao.clone(),
        height: set.height.clone(),
        metalness: set.metalness.clone(),
        edge: set.edge.clone(),
    }
}

#[inline]
fn sample_height_at(
    u: f32, v: f32,
    decal: &image::RgbaImage,
    height: Option<&GrayImage>,
) -> f32 {
    if let Some(h) = height {
        sample_gray_bilinear(h, u, v) / 255.0
    } else {
        let d = sample_rgba_bilinear(decal, u, v);
        (d[0] + d[1] + d[2]) / 3.0 / 255.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_normal_flat() {
        let height = GrayImage::from_pixel(8, 8, image::Luma([128]));
        let normal = height_to_normal(&height, 1.0);
        for y in 0..8 {
            for x in 0..8 {
                let p = normal.get_pixel(x, y);
                assert!((p[0] as i32 - 128).abs() <= 2);
            }
        }
    }
    #[test]
    fn test_blur() {
        let img = GrayImage::from_pixel(8, 8, image::Luma([100]));
        let blurred = gaussian_blur(&img, 2);
        assert_eq!(blurred.get_pixel(4, 4)[0], 100);
    }
    #[test]
    fn test_blend_normals() {
        let base = RgbImage::from_pixel(4, 4, Rgb([128, 128, 255]));
        let dirt = RgbImage::from_pixel(4, 4, Rgb([128, 128, 255]));
        let mask = GrayImage::from_pixel(4, 4, image::Luma([128]));
        let out = blend_normals(&base, &dirt, &mask);
        assert_eq!(out.dimensions(), (4, 4));
    }
}