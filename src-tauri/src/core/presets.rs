// Пресеты износа.
use image::{GrayImage, Luma, RgbImage};
use rayon::prelude::*;
use crate::core::noise::TilingNoise;
use crate::core::sobel::sobel_edge;
use crate::core::pattern::{
    scratches_pattern, dirt_pattern_from_masks, rust_pattern_from_masks,
    modulate_by_placement, max_gray,
    ScratchParams, MaskPatternParams, MaskInstance,
};
use crate::core::pbr_ops::{
    apply_mask_to_normal, height_to_normal, darken_by_mask_sharp, scratch_roughness,
    add_rim_highlight, increase_roughness_by_mask, decrease_metalness_by_mask,
    blend_color_lerp, darken_ao_by_mask, gaussian_blur,
    blend_normals,
};
use crate::commands::pbr::LoadedPbr;

#[derive(Debug, Clone, Copy)]
pub struct ScratchParamsFromUI {
    pub density: f32, pub length: f32, pub thickness: f32,
    pub waviness: f32, pub branches: f32, pub clusters: f32,
    pub normal_enabled: bool, pub depth: f32,
    pub realistic: bool, pub rim_highlight: bool,
}

#[derive(Debug, Clone, Copy)]
pub struct DirtParamsFromUI {
    pub count: f32,
    pub scale: f32,
    pub deform: f32,
    pub threshold: f32,
    pub sharpness: f32,
    pub color: [u8; 3],
    pub thickness: f32,    // 0..1 — только вверх (объём)
    pub rim_highlight: bool,
    pub normal_enabled: bool,
}

#[derive(Debug, Clone, Copy)]
pub struct RustParamsFromUI {
    pub count: f32,
    pub scale: f32,
    pub deform: f32,
    pub threshold: f32,
    pub sharpness: f32,
    pub volume: f32,
    pub normal_enabled: bool,
    pub rim_highlight: bool,
}

pub struct Preset {
    pub name: &'static str,
    pub label_key: &'static str,
    pub default_warp: f32,
    pub default_amount: f32,
    pub apply: fn(
        &LoadedPbr, &TilingNoise, f32,
        &ScratchParamsFromUI, &DirtParamsFromUI, &RustParamsFromUI,
        &[RgbImage], &[MaskInstance],
    ) -> LoadedPbr,
}

pub fn get_all() -> Vec<Preset> {
    vec![
        Preset { name: "custom",    label_key: "preset.custom",    default_warp: 0.0,  default_amount: 0.0,  apply: apply_custom },
        Preset { name: "scratches", label_key: "preset.scratches", default_warp: 20.0, default_amount: 50.0, apply: apply_scratches },
        Preset { name: "dirt",      label_key: "preset.dirt",      default_warp: 40.0, default_amount: 60.0, apply: apply_dirt },
        Preset { name: "rust",      label_key: "preset.rust",      default_warp: 30.0, default_amount: 70.0, apply: apply_rust },
    ]
}

pub fn get_preset(name: &str) -> Option<Preset> {
    get_all().into_iter().find(|p| p.name == name)
}

// ==================== Custom ====================

fn apply_custom(
    set: &LoadedPbr, _noise: &TilingNoise, _amount: f32,
    _sp: &ScratchParamsFromUI, _dp: &DirtParamsFromUI, _rp: &RustParamsFromUI,
    _masks: &[RgbImage], _instances: &[MaskInstance],
) -> LoadedPbr {
    set.clone()
}

// ==================== Scratches ====================

fn apply_scratches(
    set: &LoadedPbr, noise: &TilingNoise, amount: f32,
    sp: &ScratchParamsFromUI, _dp: &DirtParamsFromUI, _rp: &RustParamsFromUI,
    _masks: &[RgbImage], _instances: &[MaskInstance],
) -> LoadedPbr {
    let (w, h) = (set.width(), set.height());
    if w == 0 || h == 0 { return set.clone(); }
    let params = ScratchParams {
        density: sp.density, length: sp.length, thickness: sp.thickness,
        waviness: sp.waviness, branches: sp.branches, clusters: sp.clusters,
    };
    let pattern = scratches_pattern(w, h, noise.seed(), params);
    let placement = match set.edge.as_ref() {
        Some(e) => e.clone(),
        None => match set.height.as_ref() { Some(h_img) => sobel_edge(h_img), None => return set.clone() },
    };
    let mask = modulate_by_placement(&pattern, &placement, 0.35);
    let mut new_albedo = if sp.realistic {
        set.albedo.as_ref().map(|a| darken_by_mask_sharp(a, &mask, amount * 1.5))
    } else {
        set.albedo.as_ref().map(|a| darken_by_mask_sharp(a, &mask, amount * 1.2))
    };
    if sp.rim_highlight {
        if let Some(a) = new_albedo.as_ref() { new_albedo = Some(add_rim_highlight(a, &mask, amount, false)); }
    }
    let new_roughness = if sp.realistic {
        set.roughness.as_ref().map(|r| scratch_roughness(r, &mask, amount * 0.6))
    } else {
        set.roughness.as_ref().map(|r| increase_roughness_by_mask(r, &mask, amount * 0.8))
    };
    let new_normal = if sp.normal_enabled {
        set.normal.as_ref().map(|n| apply_mask_to_normal(n, &mask, sp.depth * amount))
    } else { set.normal.clone() };
    LoadedPbr {
        albedo: new_albedo.or_else(|| set.albedo.clone()),
        normal: new_normal.or_else(|| set.normal.clone()),
        roughness: new_roughness.or_else(|| set.roughness.clone()),
        ao: set.ao.clone(), height: set.height.clone(),
        metalness: set.metalness.clone(), edge: set.edge.clone(),
    }
}

// ==================== Dirt (через маски) ====================

fn apply_dirt(
    set: &LoadedPbr, noise: &TilingNoise, amount: f32,
    _sp: &ScratchParamsFromUI, dp: &DirtParamsFromUI, _rp: &RustParamsFromUI,
    dirt_masks: &[RgbImage],
    instances: &[MaskInstance],
) -> LoadedPbr {
    let (w, h) = (set.width(), set.height());
    if w == 0 || h == 0 { return set.clone(); }

    if dirt_masks.is_empty() {
        println!("[dirt] Пул масок пуст — пятна пропущены");
        return set.clone();
    }

    let params = MaskPatternParams {
        count: dp.count,
        scale: dp.scale,
        deform: dp.deform,
        threshold: dp.threshold,
        sharpness: dp.sharpness,
    };

    let masks = dirt_pattern_from_masks(w, h, noise, params, dirt_masks, instances);

    let flat_mask = masks.flat.clone();
    let height_mask = masks.height.clone();

    // ═══ ALBEDO ═══
    let color = dp.color;
    let mut new_albedo = set.albedo.as_ref().map(|a| blend_color_lerp(a, &flat_mask, amount, color, color, 0.0));
    if dp.rim_highlight {
        if let Some(a) = new_albedo.as_ref() { new_albedo = Some(add_rim_highlight(a, &flat_mask, amount, false)); }
    }

    // ═══ NORMAL ═══
    let new_normal = if dp.normal_enabled {
        let dirt_normal = height_to_normal(&height_mask, amount * 4.0);
        if let Some(base_normal) = set.normal.as_ref() {
            Some(blend_normals(base_normal, &dirt_normal, &flat_mask))
        } else {
            Some(dirt_normal)
        }
    } else {
        set.normal.clone()
    };

    // ═══ HEIGHT — только вверх ═══
    let height_amt = amount * dp.thickness;
    let new_height = if let Some(orig_h) = set.height.as_ref() {
        let (hw, hh) = orig_h.dimensions();
        if hw != w || hh != h {
            orig_h.clone()
        } else {
            let h_raw = orig_h.as_raw();
            let m_raw = height_mask.as_raw();
            let flat: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
                let y = yi as u32;
                let mut row = Vec::with_capacity(w as usize);
                for x in 0..w {
                    let idx = (y * w + x) as usize;
                    let hval = h_raw[idx] as f32 / 255.0;
                    let m_signed = (m_raw[idx] as f32 / 255.0 - 0.5) * 2.0;
                    // Грязь — только вверх
                    let new_h = (hval + m_signed.max(0.0) * height_amt * 0.6).clamp(0.0, 1.0);
                    row.push((new_h * 255.0) as u8);
                }
                row
            }).collect();
            let mut img = GrayImage::new(w, h);
            img.copy_from_slice(&flat);
            img
        }
    } else {
        height_mask.clone()
    };

    // ═══ ROUGHNESS ═══
    let new_roughness = set.roughness.as_ref().map(|r| {
        let (rw, rh) = r.dimensions();
        let r_raw = r.as_raw();
        let m_raw = flat_mask.as_raw();
        let flat: Vec<u8> = (0..rh as usize).into_par_iter().flat_map(|yi| {
            let y = yi as u32;
            let mut row = Vec::with_capacity(rw as usize);
            for x in 0..rw {
                let idx = (y * rw + x) as usize;
                let m = m_raw[idx] as f32 / 255.0;
                let rv = r_raw[idx] as f32 / 255.0;
                let new_r = (rv + m * amount * 0.6).clamp(0.0, 1.0);
                row.push((new_r * 255.0) as u8);
            }
            row
        }).collect();
        let mut img = GrayImage::new(rw, rh);
        img.copy_from_slice(&flat);
        img
    });

    let new_metalness = set.metalness.as_ref().map(|m| decrease_metalness_by_mask(m, &flat_mask, amount * 0.8));

    // ═══ AO — тёмное по краям ═══
    let edge_only = {
        let blurred = gaussian_blur(&flat_mask, 3);
        let (mw2, mh2) = flat_mask.dimensions();
        let fm_raw = flat_mask.as_raw();
        let bl_raw = blurred.as_raw();
        let mut img = GrayImage::new(mw2, mh2);
        let flat: Vec<u8> = (0..mh2 as usize).into_par_iter().flat_map(|yi| {
            let y = yi as u32;
            let mut row = Vec::with_capacity(mw2 as usize);
            for x in 0..mw2 {
                let idx = (y * mw2 + x) as usize;
                let fm = fm_raw[idx] as f32 / 255.0;
                let bl = bl_raw[idx] as f32 / 255.0;
                let edge = (bl - fm).max(0.0);
                row.push((edge * 255.0) as u8);
            }
            row
        }).collect();
        img.copy_from_slice(&flat);
        img
    };
    let new_ao = set.ao.as_ref().map(|ao| darken_ao_by_mask(ao, &edge_only, amount * 0.6));

    LoadedPbr {
        albedo: new_albedo.or_else(|| set.albedo.clone()),
        normal: new_normal.or_else(|| set.normal.clone()),
        roughness: new_roughness.or_else(|| set.roughness.clone()),
        ao: new_ao.or_else(|| set.ao.clone()),
        height: Some(new_height),
        metalness: new_metalness.or_else(|| set.metalness.clone()),
        edge: set.edge.clone(),
    }
}

// ==================== Rust (через маски) ====================

fn apply_rust(
    set: &LoadedPbr, noise: &TilingNoise, amount: f32,
    _sp: &ScratchParamsFromUI, _dp: &DirtParamsFromUI, rp: &RustParamsFromUI,
    rust_masks: &[RgbImage],
    instances: &[MaskInstance],
) -> LoadedPbr {
    let (w, h) = (set.width(), set.height());
    if w == 0 || h == 0 { return set.clone(); }

    if rust_masks.is_empty() {
        println!("[rust] Пул масок пуст — ржавчина пропущена");
        return set.clone();
    }

    let params = MaskPatternParams {
        count: rp.count,
        scale: rp.scale,
        deform: rp.deform,
        threshold: rp.threshold,
        sharpness: rp.sharpness,
    };

    let masks = rust_pattern_from_masks(w, h, noise, params, rust_masks, instances);

    let color_core = [70u8, 35, 15];
    let color_body = [150u8, 75, 30];
    let color_edge = [205u8, 130, 65];

    let mut new_albedo = set.albedo.clone();
    if let Some(a) = new_albedo.as_ref() {
        let a1 = blend_color_lerp(a, &masks.body, amount, color_body, color_body, 0.0);
        let a2 = blend_color_lerp(&a1, &masks.core, amount * 0.9, color_core, color_core, 0.0);
        let a3 = blend_color_lerp(&a2, &masks.edge, amount * 0.55, color_edge, color_edge, 0.0);
        new_albedo = Some(a3);
    }
    if rp.rim_highlight {
        if let Some(a) = new_albedo.as_ref() {
            new_albedo = Some(add_rim_highlight(a, &masks.body, amount, true));
        }
    }

    // HEIGHT — знак управляется volume
    let volume_abs = rp.volume.abs();
    let volume_sign: f32 = if rp.volume >= 0.0 { 1.0 } else { -1.0 };
    let height_amt = amount * volume_abs;

    let new_height: Option<GrayImage> = if volume_abs < 0.01 {
        set.height.clone()
    } else if let Some(orig_h) = set.height.as_ref() {
        let (hw, hh) = orig_h.dimensions();
        if hw != w || hh != h {
            Some(orig_h.clone())
        } else {
            let h_raw = orig_h.as_raw();
            let m_raw = masks.height.as_raw();
            let flat: Vec<u8> = (0..h as usize).into_par_iter().flat_map(|yi| {
                let y = yi as u32;
                let mut row = Vec::with_capacity(w as usize);
                for x in 0..w {
                    let idx = (y * w + x) as usize;
                    let hval = h_raw[idx] as f32 / 255.0;
                    let m_signed = (m_raw[idx] as f32 / 255.0 - 0.5) * 2.0;
                    let new_h = (hval + m_signed * height_amt * volume_sign * 0.6).clamp(0.0, 1.0);
                    row.push((new_h * 255.0) as u8);
                }
                row
            }).collect();
            let mut img = GrayImage::new(w, h);
            img.copy_from_slice(&flat);
            Some(img)
        }
    } else {
        Some(masks.height.clone())
    };

    let new_normal = if rp.normal_enabled && volume_abs > 0.01 {
        let signed_height = if volume_sign > 0.0 {
            masks.height.clone()
        } else {
            invert_gray(&masks.height)
        };
        let rust_normal = height_to_normal(&signed_height, volume_abs * amount * 5.0);
        if let Some(base_normal) = set.normal.as_ref() {
            Some(blend_normals(base_normal, &rust_normal, &masks.body))
        } else {
            Some(rust_normal)
        }
    } else {
        set.normal.clone()
    };

    let new_roughness = set.roughness.as_ref().map(|r| {
        let rough_up = increase_roughness_by_mask(r, &masks.body, amount * 0.5);
        increase_roughness_by_mask(&rough_up, &masks.core, amount * 0.35)
    });

    let new_metalness = set.metalness.as_ref().map(|m| {
        let m1 = decrease_metalness_by_mask(m, &masks.body, amount * 0.8);
        decrease_metalness_by_mask(&m1, &masks.core, amount * 0.9)
    });

    let new_ao = set.ao.as_ref().map(|ao| {
        let ao1 = darken_ao_by_mask(ao, &masks.core, amount * 0.7);
        darken_ao_by_mask(&ao1, &masks.body, amount * 0.3)
    });

    LoadedPbr {
        albedo: new_albedo.or_else(|| set.albedo.clone()),
        normal: new_normal.or_else(|| set.normal.clone()),
        roughness: new_roughness.or_else(|| set.roughness.clone()),
        ao: new_ao.or_else(|| set.ao.clone()),
        height: new_height.or_else(|| set.height.clone()),
        metalness: new_metalness.or_else(|| set.metalness.clone()),
        edge: set.edge.clone(),
    }
}

fn invert_gray(img: &GrayImage) -> GrayImage {
    let (w, h) = img.dimensions();
    let mut out = GrayImage::new(w, h);
    for y in 0..h {
        for x in 0..w {
            out.put_pixel(x, y, Luma([255 - img.get_pixel(x, y)[0]]));
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_get_all() { assert_eq!(get_all().len(), 4); }
    #[test]
    fn test_invert_gray() {
        let img = GrayImage::from_pixel(4, 4, Luma([100]));
        assert_eq!(invert_gray(&img).get_pixel(0, 0)[0], 155);
    }
}