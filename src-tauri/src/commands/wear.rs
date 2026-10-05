// Главная команда генерации вариаций.
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use std::path::{Path, PathBuf};
use image::{GrayImage, RgbImage};
use crate::core::noise::TilingNoise;
use crate::core::presets::{
    get_preset,
    ScratchParamsFromUI, DirtParamsFromUI, RustParamsFromUI, StreakParamsFromUI,
};
use crate::core::pbr_ops::DecalParamsFromUI;
use crate::core::pattern::MaskInstance;
use crate::core::pbr_ops::{
    MaskKind, MaskParams,
    apply_custom_mask_to_albedo, apply_custom_mask_to_roughness, apply_custom_mask_to_normal,
};
use crate::commands::pbr::{load_pbr_set, LoadedPbr};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WearParams {
    pub count: u32, pub warp: f32, pub amount: f32, pub seed: u32,
    pub preset: String, pub output_dir: String,
    pub albedo: Option<String>, pub normal: Option<String>, pub roughness: Option<String>,
    pub ao: Option<String>, pub height: Option<String>, pub metalness: Option<String>, pub edge: Option<String>,
    // Scratch
    pub scratch_procedural: Option<bool>,
    pub scratch_density: Option<f32>, pub scratch_length: Option<f32>, pub scratch_thickness: Option<f32>,
    pub scratch_waviness: Option<f32>, pub scratch_branches: Option<f32>, pub scratch_clusters: Option<f32>,
    pub scratch_normal: Option<bool>, pub scratch_depth: Option<f32>,
    pub scratch_realistic: Option<bool>, pub scratch_rim: Option<bool>,
    pub scratch_count: Option<f32>,
    pub scratch_mask_scale: Option<f32>,
    pub scratch_deform: Option<f32>,
    pub scratch_threshold: Option<f32>,
    pub scratch_sharpness: Option<f32>,
    pub scratch_color: Option<[u8; 3]>,
    pub scratch_mask_thickness: Option<f32>,
    pub scratch_mask_rim: Option<bool>,
    pub scratch_mask_normal: Option<bool>,
    pub scratch_disable_tiling: Option<bool>,
    pub scratch_pos_x: Option<f32>,
    pub scratch_pos_y: Option<f32>,
    pub scratch_rotation: Option<f32>,
    pub scratch_random_rotation: Option<bool>,
    pub user_mask_scratch: Option<String>,
    pub folder_mask_names_scratch: Option<Vec<String>>,
    // Dirt
    pub dirt_count: Option<f32>,
    pub dirt_scale: Option<f32>,
    pub dirt_deform: Option<f32>,
    pub dirt_threshold: Option<f32>,
    pub dirt_sharpness: Option<f32>,
    pub dirt_color: Option<[u8; 3]>,
    pub dirt_thickness: Option<f32>,
    pub dirt_rim: Option<bool>,
    pub dirt_normal: Option<bool>,
    pub user_mask_dirt: Option<String>,
    pub folder_mask_names_dirt: Option<Vec<String>>,
    // Rust
    pub rust_count: Option<f32>,
    pub rust_scale: Option<f32>,
    pub rust_deform: Option<f32>,
    pub rust_threshold: Option<f32>,
    pub rust_sharpness: Option<f32>,
    pub rust_volume: Option<f32>,
    pub rust_normal: Option<bool>,
    pub rust_rim: Option<bool>,
    pub user_mask_rust: Option<String>,
    pub folder_mask_names_rust: Option<Vec<String>>,
    // Streaks
    pub streak_procedural: Option<bool>,
    pub streak_count: Option<f32>,
    pub streak_threshold: Option<f32>,
    pub streak_sharpness: Option<f32>,
    pub streak_color: Option<[u8; 3]>,
    pub streak_thickness: Option<f32>,
    pub streak_rim: Option<bool>,
    pub streak_normal: Option<bool>,
    pub streak_size: Option<f32>,
    pub streak_stretch: Option<f32>,
    pub streak_waviness: Option<f32>,
    pub streak_pos_x: Option<f32>,
    pub streak_pos_y: Option<f32>,
    pub streak_rotation: Option<f32>,
    pub streak_proc_scale: Option<f32>,
    pub streak_mask_scale: Option<f32>,
    pub streak_deform: Option<f32>,
    pub streak_disable_tiling: Option<bool>,
    pub user_mask_streak: Option<String>,
    pub folder_mask_names_streak: Option<Vec<String>>,
    // Instances
    pub instances_per_variation: Option<Vec<Vec<MaskInstance>>>,
    // Custom mask
    pub mask_enabled: Option<bool>,
    pub mask_path: Option<String>,
    pub mask_kind: Option<String>,
    pub mask_pos_x: Option<f32>,
    pub mask_pos_y: Option<f32>,
    pub mask_scale: Option<f32>,
    pub mask_rotation: Option<f32>,
    pub mask_opacity: Option<f32>,
    pub mask_color: Option<[u8; 3]>,
    pub mask_affect_albedo: Option<bool>,
    pub mask_affect_roughness: Option<bool>,
    pub mask_affect_normal: Option<bool>,
    // Decal
    pub decal_path: Option<String>,
    pub decal_height_path: Option<String>,
    pub decal_pos_x: Option<f32>,
    pub decal_pos_y: Option<f32>,
    pub decal_scale: Option<f32>,
    pub decal_rotation: Option<f32>,
    pub decal_keep_aspect: Option<bool>,
    pub decal_opacity: Option<f32>,
    pub decal_affect_albedo: Option<bool>,
    pub decal_affect_roughness: Option<bool>,
    pub decal_affect_normal: Option<bool>,
    pub decal_height_intensity: Option<f32>,
    pub decal_random_position: Option<bool>,
    pub decal_random_rotation: Option<bool>,
    pub decal_tile_edge: Option<bool>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WearProgress {
    pub current: u32, pub total: u32, pub stage: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WearResult {
    pub variations: Vec<String>,
    pub elapsed_ms: u64,
}

// ============ Сканирование ============

fn is_supported_ext(ext: &str) -> bool {
    matches!(ext, "png" | "jpg" | "jpeg")
}

fn scan_dir(dir: &Path) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    let e = ext.to_string_lossy().to_lowercase();
                    if is_supported_ext(&e) {
                        paths.push(path);
                    }
                }
            }
        }
    }
    paths.sort();
    paths
}

// ============ Папка масок в AppData ============

fn user_masks_dir(app: &AppHandle, subfolder: &str) -> Result<PathBuf, String> {
    let base = app.path().app_data_dir()
        .map_err(|e| format!("app_data_dir: {}", e))?;
    let dir = base.join("masks").join(subfolder);

    if !dir.is_dir() {
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("create_dir_all {}: {}", dir.display(), e))?;
    }

    let is_empty = std::fs::read_dir(&dir)
        .map(|it| it.flatten().count() == 0)
        .unwrap_or(true);

    if is_empty {
        copy_builtin_to(app, subfolder, &dir);
    }

    Ok(dir)
}

fn copy_builtin_to(app: &AppHandle, subfolder: &str, dest: &Path) {
    let mut sources: Vec<PathBuf> = Vec::new();

    if let Ok(res_dir) = app.path().resource_dir() {
        sources.push(res_dir.join("assets").join(subfolder));
        sources.push(res_dir.join("_up_").join("assets").join(subfolder));
    }
    sources.push(PathBuf::from("assets").join(subfolder));
    sources.push(PathBuf::from("src-tauri").join("assets").join(subfolder));

    for src in &sources {
        if !src.is_dir() { continue; }
        let paths = scan_dir(src);
        if paths.is_empty() { continue; }

        for p in &paths {
            if let Some(name) = p.file_name() {
                let target = dest.join(name);
                if target.exists() { continue; }
                if let Err(e) = std::fs::copy(p, &target) {
                    println!("[wear] Не удалось скопировать {:?}: {}", p, e);
                }
            }
        }
        return;
    }
    println!("[wear] Встроенные маски ({}) не найдены для копирования", subfolder);
}

fn list_masks_in_dir(dir: &Path) -> Vec<String> {
    scan_dir(dir)
        .into_iter()
        .filter_map(|p| p.file_name().map(|n| n.to_string_lossy().to_string()))
        .collect()
}

// ============ Tauri-команды ============

#[tauri::command]
pub fn list_masks_in_folder(app: AppHandle, subfolder: String) -> Result<Vec<String>, String> {
    let dir = user_masks_dir(&app, &subfolder)?;
    Ok(list_masks_in_dir(&dir))
}

#[tauri::command]
pub fn get_user_masks_path(app: AppHandle, subfolder: String) -> Result<String, String> {
    let dir = user_masks_dir(&app, &subfolder)?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_user_masks_folder(app: AppHandle, subfolder: String) -> Result<(), String> {
    let dir = user_masks_dir(&app, &subfolder)?;
    let path_str = dir.to_string_lossy().to_string();

    #[cfg(target_os = "windows")]
    { std::process::Command::new("explorer").arg(&path_str).spawn().map_err(|e| format!("explorer: {}", e))?; }
    #[cfg(target_os = "macos")]
    { std::process::Command::new("open").arg(&path_str).spawn().map_err(|e| format!("open: {}", e))?; }
    #[cfg(target_os = "linux")]
    { std::process::Command::new("xdg-open").arg(&path_str).spawn().map_err(|e| format!("xdg-open: {}", e))?; }
    Ok(())
}

// ============ Загрузка картинок ============

fn open_as_rgb(p: &Path) -> Option<RgbImage> {
    match image::open(p) {
        Ok(img) => {
            if img.width() == 0 || img.height() == 0 { return None; }
            let rgba = img.to_rgba8();
            let (mw, mh) = rgba.dimensions();

            let mut rgb_min: u8 = 255;
            let mut rgb_max: u8 = 0;
            let mut a_min: u8 = 255;
            let mut a_max: u8 = 0;
            let mut lum_sum: u64 = 0;
            for px in rgba.pixels() {
                let [r, g, b, a] = px.0;
                let lum = ((r as u16 + g as u16 + b as u16) / 3) as u8;
                if lum < rgb_min { rgb_min = lum; }
                if lum > rgb_max { rgb_max = lum; }
                if a < a_min { a_min = a; }
                if a > a_max { a_max = a; }
                lum_sum += lum as u64;
            }
            let _rgb_range = rgb_max.saturating_sub(rgb_min);
            let alpha_range = a_max.saturating_sub(a_min);
            let total = (mw as u64) * (mh as u64);
            let lum_mean = if total > 0 { (lum_sum / total) as u8 } else { 0 };

            let use_alpha = alpha_range > 10;
            let invert_rgb = !use_alpha && lum_mean > 127;

            let mut rgb = RgbImage::new(mw, mh);
            for y in 0..mh {
                for x in 0..mw {
                    let px = rgba.get_pixel(x, y);
                    let [r, g, b, a] = px.0;
                    let v = if use_alpha {
                        a
                    } else {
                        let lum = ((r as u16 + g as u16 + b as u16) / 3) as u8;
                        if invert_rgb { 255 - lum } else { lum }
                    };
                    rgb.put_pixel(x, y, image::Rgb([v, v, v]));
                }
            }
            Some(rgb)
        }
        Err(_) => None,
    }
}

fn open_decal_rgba(p: &Path) -> Option<(image::RgbaImage, bool)> {
    match image::open(p) {
        Ok(img) => {
            let rgba = img.to_rgba8();
            let (mw, mh) = rgba.dimensions();
            if mw == 0 || mh == 0 { return None; }

            let mut a_min: u8 = 255;
            let mut a_max: u8 = 0;
            for px in rgba.pixels() {
                let a = px.0[3];
                if a < a_min { a_min = a; }
                if a > a_max { a_max = a; }
            }
            let alpha_range = a_max.saturating_sub(a_min);
            let has_alpha = alpha_range > 10;

            Some((rgba, has_alpha))
        }
        Err(_) => None,
    }
}

fn open_height_gray(p: &Path) -> Option<GrayImage> {
    match image::open(p) {
        Ok(img) => {
            let rgba = img.to_rgba8();
            let (mw, mh) = rgba.dimensions();
            if mw == 0 || mh == 0 { return None; }

            let mut a_min: u8 = 255;
            let mut a_max: u8 = 0;
            let mut lum_sum: u64 = 0;
            for px in rgba.pixels() {
                let [r, g, b, a] = px.0;
                let lum = ((r as u16 + g as u16 + b as u16) / 3) as u8;
                if a < a_min { a_min = a; }
                if a > a_max { a_max = a; }
                lum_sum += lum as u64;
            }
            let alpha_range = a_max.saturating_sub(a_min);
            let use_alpha = alpha_range > 10;
            let total = (mw as u64) * (mh as u64);
            let lum_mean = if total > 0 { (lum_sum / total) as u8 } else { 0 };
            let invert_rgb = !use_alpha && lum_mean > 127;

            let mut out = GrayImage::new(mw, mh);
            for y in 0..mh {
                for x in 0..mw {
                    let px = rgba.get_pixel(x, y);
                    let [r, g, b, a] = px.0;
                    let v = if use_alpha {
                        a
                    } else {
                        let lum = ((r as u16 + g as u16 + b as u16) / 3) as u8;
                        if invert_rgb { 255 - lum } else { lum }
                    };
                    out.put_pixel(x, y, image::Luma([v]));
                }
            }
            Some(out)
        }
        Err(_) => None,
    }
}

fn load_single_mask(path: &str) -> Vec<RgbImage> {
    let p = Path::new(path);
    if !p.is_file() { return Vec::new(); }
    if let Some(ext) = p.extension() {
        let e = ext.to_string_lossy().to_lowercase();
        if !is_supported_ext(&e) { return Vec::new(); }
    }
    match open_as_rgb(p) {
        Some(img) => vec![img],
        None => Vec::new(),
    }
}

// ============ Пул масок ============

fn resolve_mask_pool(
    app: &AppHandle,
    user_mask: Option<&str>,
    folder_mask_names: Option<&Vec<String>>,
    subfolder: &str,
) -> Vec<RgbImage> {
    if let Some(path) = user_mask.filter(|s| !s.is_empty()) {
        return load_single_mask(path);
    }

    let dir = match user_masks_dir(app, subfolder) {
        Ok(d) => d,
        Err(_) => return Vec::new(),
    };

    let all_files = scan_dir(&dir);
    if all_files.is_empty() { return Vec::new(); }

    let selected: Vec<PathBuf> = match folder_mask_names {
        Some(names) if !names.is_empty() => {
            all_files.into_iter()
                .filter(|p| {
                    p.file_name()
                        .map(|n| names.iter().any(|s| s == &n.to_string_lossy().to_string()))
                        .unwrap_or(false)
                })
                .collect()
        }
        Some(_) => Vec::new(),
        None => all_files,
    };

    let mut images = Vec::with_capacity(selected.len());
    for p in &selected {
        if let Some(img) = open_as_rgb(p) {
            images.push(img);
        }
    }
    images
}

// ============ Кастомная маска ============

fn load_custom_mask(params: &WearParams) -> Result<Option<(RgbImage, MaskParams)>, String> {
    let enabled = params.mask_enabled.unwrap_or(false);
    if !enabled { return Ok(None); }

    let path = match params.mask_path.as_ref() {
        Some(p) if !p.is_empty() => p,
        _ => return Ok(None),
    };

    let p = Path::new(path);
    if !p.exists() {
        return Err(format!("Файл маски не найден: {}", path));
    }

    let img = image::open(p).map_err(|e| format!("Открытие маски {}: {}", path, e))?;
    if img.width() == 0 || img.height() == 0 {
        return Err("Маска пустая (0×0)".to_string());
    }

    let rgba = img.to_rgba8();
    let (mw, mh) = rgba.dimensions();
    let mut rgb = RgbImage::new(mw, mh);
    for y in 0..mh {
        for x in 0..mw {
            let px = rgba.get_pixel(x, y);
            let [r, g, b, a] = px.0;
            let af = a as f32 / 255.0;
            rgb.put_pixel(x, y, image::Rgb([(r as f32 * af) as u8, (g as f32 * af) as u8, (b as f32 * af) as u8]));
        }
    }

    let kind_str = params.mask_kind.as_deref().unwrap_or("mono");
    let kind = match kind_str {
        "color" => MaskKind::Color,
        _ => MaskKind::Mono,
    };

    let mp = MaskParams {
        kind,
        pos_x: params.mask_pos_x.unwrap_or(0.0),
        pos_y: params.mask_pos_y.unwrap_or(0.0),
        scale: params.mask_scale.unwrap_or(1.0),
        rotation: params.mask_rotation.unwrap_or(0.0),
        opacity: params.mask_opacity.unwrap_or(1.0),
        color: params.mask_color.unwrap_or([95, 85, 75]),
        affect_albedo: params.mask_affect_albedo.unwrap_or(true),
        affect_roughness: params.mask_affect_roughness.unwrap_or(false),
        affect_normal: params.mask_affect_normal.unwrap_or(false),
    };

    Ok(Some((rgb, mp)))
}

fn apply_mask_to_set(set: &LoadedPbr, mask: &RgbImage, mp: &MaskParams) -> LoadedPbr {
    let mut out = set.clone();
    if mp.affect_albedo {
        if let Some(a) = out.albedo.as_ref() { out.albedo = Some(apply_custom_mask_to_albedo(a, mask, mp)); }
    }
    if mp.affect_roughness {
        if let Some(r) = out.roughness.as_ref() { out.roughness = Some(apply_custom_mask_to_roughness(r, mask, mp)); }
    }
    if mp.affect_normal {
        if let Some(n) = out.normal.as_ref() { out.normal = Some(apply_custom_mask_to_normal(n, mask, mp, 3.0)); }
    }
    out
}

// ============ Decal ============

fn load_decal(params: &WearParams) -> Result<Option<(image::RgbaImage, Option<GrayImage>, DecalParamsFromUI)>, String> {
    let path = match params.decal_path.as_ref() {
        Some(p) if !p.is_empty() => p,
        _ => return Ok(None),
    };

    let p = Path::new(path);
    if !p.is_file() {
        return Err(format!("Файл decal не найден: {}", path));
    }

    let (rgba, _has_alpha) = open_decal_rgba(p)
        .ok_or_else(|| format!("Не удалось открыть decal: {}", path))?;

    let height = match params.decal_height_path.as_ref() {
        Some(hp) if !hp.is_empty() => {
            let hp_path = Path::new(hp);
            if hp_path.is_file() {
                open_height_gray(hp_path)
            } else {
                None
            }
        }
        _ => None,
    };

    let dp = DecalParamsFromUI {
        pos_x: params.decal_pos_x.unwrap_or(0.0),
        pos_y: params.decal_pos_y.unwrap_or(0.0),
        scale: params.decal_scale.unwrap_or(1.0),
        rotation_deg: params.decal_rotation.unwrap_or(0.0),
        keep_aspect: params.decal_keep_aspect.unwrap_or(true),
        opacity: params.decal_opacity.unwrap_or(1.0),
        affect_albedo: params.decal_affect_albedo.unwrap_or(true),
        affect_roughness: params.decal_affect_roughness.unwrap_or(false),
        affect_normal: params.decal_affect_normal.unwrap_or(false),
        height_intensity: params.decal_height_intensity.unwrap_or(0.0),
        random_position: params.decal_random_position.unwrap_or(false),
        random_rotation: params.decal_random_rotation.unwrap_or(false),
        tile_edge: params.decal_tile_edge.unwrap_or(false),
    };

    Ok(Some((rgba, height, dp)))
}

// ============ Параметры из UI ============

fn build_scratch_params(p: &WearParams) -> ScratchParamsFromUI {
    ScratchParamsFromUI {
        procedural: p.scratch_procedural.unwrap_or(true),
        density: p.scratch_density.unwrap_or(0.5),
        length: p.scratch_length.unwrap_or(0.15),
        thickness: p.scratch_thickness.unwrap_or(2.0),
        waviness: p.scratch_waviness.unwrap_or(0.35),
        branches: p.scratch_branches.unwrap_or(0.1),
        clusters: p.scratch_clusters.unwrap_or(0.3),
        normal_enabled: p.scratch_normal.unwrap_or(true),
        depth: p.scratch_depth.unwrap_or(0.8),
        realistic: p.scratch_realistic.unwrap_or(true),
        rim_highlight: p.scratch_rim.unwrap_or(true),
        count: p.scratch_count.unwrap_or(3.0),
        mask_scale: p.scratch_mask_scale.unwrap_or(1.0),
        deform: p.scratch_deform.unwrap_or(0.3),
        threshold: p.scratch_threshold.unwrap_or(0.5),
        sharpness: p.scratch_sharpness.unwrap_or(0.5),
        color: p.scratch_color.unwrap_or([95, 85, 75]),
        mask_thickness: p.scratch_mask_thickness.unwrap_or(-0.3),
        mask_rim: p.scratch_mask_rim.unwrap_or(true),
        mask_normal: p.scratch_mask_normal.unwrap_or(true),
        disable_tiling: p.scratch_disable_tiling.unwrap_or(false),
        pos_x: p.scratch_pos_x.unwrap_or(0.0),
        pos_y: p.scratch_pos_y.unwrap_or(0.0),
        rotation_deg: p.scratch_rotation.unwrap_or(0.0),
        random_rotation: p.scratch_random_rotation.unwrap_or(false),
    }
}

fn build_dirt_params(p: &WearParams) -> DirtParamsFromUI {
    DirtParamsFromUI {
        count: p.dirt_count.unwrap_or(3.0),
        scale: p.dirt_scale.unwrap_or(1.0),
        deform: p.dirt_deform.unwrap_or(0.3),
        threshold: p.dirt_threshold.unwrap_or(0.5),
        sharpness: p.dirt_sharpness.unwrap_or(0.5),
        color: p.dirt_color.unwrap_or([95, 85, 75]),
        thickness: p.dirt_thickness.unwrap_or(0.5),
        rim_highlight: p.dirt_rim.unwrap_or(true),
        normal_enabled: p.dirt_normal.unwrap_or(true),
    }
}

fn build_rust_params(p: &WearParams) -> RustParamsFromUI {
    RustParamsFromUI {
        count: p.rust_count.unwrap_or(3.0),
        scale: p.rust_scale.unwrap_or(1.0),
        deform: p.rust_deform.unwrap_or(0.5),
        threshold: p.rust_threshold.unwrap_or(0.5),
        sharpness: p.rust_sharpness.unwrap_or(0.5),
        volume: p.rust_volume.unwrap_or(0.0),
        normal_enabled: p.rust_normal.unwrap_or(true),
        rim_highlight: p.rust_rim.unwrap_or(true),
    }
}

fn build_streak_params(p: &WearParams) -> StreakParamsFromUI {
    StreakParamsFromUI {
        procedural: p.streak_procedural.unwrap_or(true),
        count: p.streak_count.unwrap_or(25.0),
        threshold: p.streak_threshold.unwrap_or(0.5),
        sharpness: p.streak_sharpness.unwrap_or(0.5),
        color: p.streak_color.unwrap_or([95, 85, 75]),
        thickness: p.streak_thickness.unwrap_or(0.5),
        rim_highlight: p.streak_rim.unwrap_or(true),
        normal_enabled: p.streak_normal.unwrap_or(true),
        size: p.streak_size.unwrap_or(0.04),
        stretch: p.streak_stretch.unwrap_or(1.0),
        waviness: p.streak_waviness.unwrap_or(0.25),
        pos_x: p.streak_pos_x.unwrap_or(0.0),
        pos_y: p.streak_pos_y.unwrap_or(0.0),
        rotation_deg: p.streak_rotation.unwrap_or(0.0),
        proc_scale: p.streak_proc_scale.unwrap_or(1.0),
        mask_scale: p.streak_mask_scale.unwrap_or(1.0),
        deform: p.streak_deform.unwrap_or(0.3),
        disable_tiling: p.streak_disable_tiling.unwrap_or(false),
    }
}

// ═══ Decal random transform — 1-в-1 с JS ═══
fn rand_from_seed(seed: u32, step: u32) -> f32 {
    let mut s = seed;
    for _ in 0..step {
        s = s.wrapping_mul(1664525).wrapping_add(1013904223);
    }
    ((s & 0xFFFFFF) as f32) / 16777216.0
}

fn random_decal_transform(var_seed: u32) -> (f32, f32, f32) {
    let r1 = rand_from_seed(var_seed, 1);
    let r2 = rand_from_seed(var_seed, 2);
    let r3 = rand_from_seed(var_seed, 3);
    ((r1 - 0.5) * 0.6, (r2 - 0.5) * 0.6, r3 * 360.0)
}

// ============ Главная команда ============

#[tauri::command]
pub async fn generate_wear(app: AppHandle, params: WearParams) -> Result<WearResult, String> {
    let start = std::time::Instant::now();
    let _ = app.emit("wear_progress", WearProgress { current: 0, total: params.count, stage: "loading".into() });

    let set = load_pbr_set(
        params.albedo.as_deref(), params.normal.as_deref(), params.roughness.as_deref(),
        params.ao.as_deref(), params.height.as_deref(), params.metalness.as_deref(), params.edge.as_deref(),
    )?;

    let preset = get_preset(&params.preset).ok_or_else(|| format!("Неизвестный пресет: {}", params.preset))?;

    let mask_pool = if preset.name == "scratches" {
        resolve_mask_pool(&app, params.user_mask_scratch.as_deref(), params.folder_mask_names_scratch.as_ref(), "scratches")
    } else if preset.name == "dirt" {
        resolve_mask_pool(&app, params.user_mask_dirt.as_deref(), params.folder_mask_names_dirt.as_ref(), "dirt")
    } else if preset.name == "rust" {
        resolve_mask_pool(&app, params.user_mask_rust.as_deref(), params.folder_mask_names_rust.as_ref(), "rust")
    } else if preset.name == "streaks" {
        resolve_mask_pool(&app, params.user_mask_streak.as_deref(), params.folder_mask_names_streak.as_ref(), "streaks")
    } else {
        Vec::new()
    };

    let custom_mask = load_custom_mask(&params)?;
    let amount = (params.amount / 100.0).clamp(0.0, 1.0);
    let scratch_params = build_scratch_params(&params);
    let dirt_params = build_dirt_params(&params);
    let rust_params = build_rust_params(&params);
    let streak_params = build_streak_params(&params);

    let decal_data = if preset.name == "decal" {
        load_decal(&params)?
    } else {
        None
    };

    let mut variations: Vec<String> = Vec::with_capacity(params.count as usize);

    for i in 1..=params.count {
        let var_seed = params.seed.wrapping_add(i.wrapping_mul(7919));
        let noise = TilingNoise::new(var_seed);

        let folder = format!("{}/wear_{:02}", params.output_dir, i);
        std::fs::create_dir_all(&folder).map_err(|e| format!("create_dir_all {}: {}", folder, e))?;

        let empty_var: Vec<MaskInstance> = Vec::new();
        let instances_for_this = params.instances_per_variation
            .as_ref()
            .and_then(|v| v.get((i - 1) as usize))
            .unwrap_or(&empty_var);

        let warped = if preset.name == "decal" {
            if let Some((ref rgba, ref height_opt, ref dp)) = decal_data {
                let use_random = i > 1 && (dp.random_position || dp.random_rotation);
                let dp_final = if use_random {
                    let (rx, ry, rr) = random_decal_transform(var_seed);
                    let mut dp2 = *dp;
                    if dp.random_position {
                        dp2.pos_x = rx;
                        dp2.pos_y = ry;
                    }
                    if dp.random_rotation {
                        dp2.rotation_deg = rr;
                    }
                    dp2
                } else {
                    *dp
                };
                crate::core::pbr_ops::apply_decal_to_set(&set, rgba, height_opt.as_ref(), &dp_final)
            } else {
                set.clone()
            }
        } else {
            (preset.apply)(
                &set, &noise, amount,
                &scratch_params, &dirt_params, &rust_params, &streak_params,
                &mask_pool,
                instances_for_this,
            )
        };

        let final_set = if let Some((ref mask_img, ref mp)) = custom_mask {
            apply_mask_to_set(&warped, mask_img, mp)
        } else {
            warped
        };

        if let Some(img) = final_set.albedo.as_ref() {
            save_png(&folder, "albedo.png", &image::DynamicImage::ImageRgb8(img.clone()))?;
        }
        if let Some(img) = final_set.normal.as_ref() {
            save_png(&folder, "normal.png", &image::DynamicImage::ImageRgb8(img.clone()))?;
        }
        if let Some(img) = final_set.roughness.as_ref() {
            save_png(&folder, "roughness.png", &image::DynamicImage::ImageLuma8(img.clone()))?;
        }
        if let Some(img) = final_set.ao.as_ref() {
            save_png(&folder, "ao.png", &image::DynamicImage::ImageLuma8(img.clone()))?;
        }
        if let Some(img) = final_set.height.as_ref() {
            save_png(&folder, "height.png", &image::DynamicImage::ImageLuma8(img.clone()))?;
        }
        if let Some(img) = final_set.metalness.as_ref() {
            save_png(&folder, "metalness.png", &image::DynamicImage::ImageLuma8(img.clone()))?;
        }
        if let Some(img) = final_set.edge.as_ref() {
            save_png(&folder, "edge.png", &image::DynamicImage::ImageLuma8(img.clone()))?;
        }

        variations.push(folder);

        let _ = app.emit("wear_progress", WearProgress {
            current: i, total: params.count, stage: "generating".into(),
        });
    }

    let elapsed = start.elapsed().as_millis() as u64;
    let _ = app.emit("wear_progress", WearProgress {
        current: params.count, total: params.count, stage: "done".into(),
    });
    Ok(WearResult { variations, elapsed_ms: elapsed })
}

fn save_png(folder: &str, name: &str, img: &image::DynamicImage) -> Result<(), String> {
    let path = format!("{}/{}", folder, name);
    img.save_with_format(&path, image::ImageFormat::Png).map_err(|e| format!("save {}: {}", path, e))?;
    Ok(())
}