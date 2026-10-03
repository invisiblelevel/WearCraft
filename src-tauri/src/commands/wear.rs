// Главная команда генерации вариаций.
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use std::path::{Path, PathBuf};
use image::RgbImage;
use crate::core::noise::TilingNoise;
use crate::core::presets::{get_preset, ScratchParamsFromUI, DirtParamsFromUI, RustParamsFromUI};
use crate::core::pattern::MaskInstance;
use crate::core::pbr_ops::{MaskKind, MaskParams, apply_custom_mask_to_albedo, apply_custom_mask_to_roughness, apply_custom_mask_to_normal};
use crate::commands::pbr::{load_pbr_set, LoadedPbr};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WearParams {
    pub count: u32, pub warp: f32, pub amount: f32, pub seed: u32,
    pub preset: String, pub output_dir: String,
    pub albedo: Option<String>, pub normal: Option<String>, pub roughness: Option<String>,
    pub ao: Option<String>, pub height: Option<String>, pub metalness: Option<String>, pub edge: Option<String>,
    // Scratch
    pub scratch_density: Option<f32>, pub scratch_length: Option<f32>, pub scratch_thickness: Option<f32>,
    pub scratch_waviness: Option<f32>, pub scratch_branches: Option<f32>, pub scratch_clusters: Option<f32>,
    pub scratch_normal: Option<bool>, pub scratch_depth: Option<f32>,
    pub scratch_realistic: Option<bool>, pub scratch_rim: Option<bool>,
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
    // Instances: массив массивов, по одному на вариацию
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

/// Возвращает путь к папке масок в AppData: %APPDATA%/WearCraft/masks/{subfolder}/
/// Если папки нет — создаёт. Если пусто — копирует встроенные из bundle.
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

// ============ Tauri-команды для папки ============

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
    {
        std::process::Command::new("explorer")
            .arg(&path_str)
            .spawn()
            .map_err(|e| format!("explorer: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path_str)
            .spawn()
            .map_err(|e| format!("open: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path_str)
            .spawn()
            .map_err(|e| format!("xdg-open: {}", e))?;
    }
    Ok(())
}

// ============ Загрузка картинок ============

fn open_as_rgb(p: &Path) -> Option<RgbImage> {
    match image::open(p) {
        Ok(img) => {
            if img.width() == 0 || img.height() == 0 {
                println!("[wear] Пустая картинка: {:?}", p.file_name());
                return None;
            }
            let rgba = img.to_rgba8();
            let (mw, mh) = rgba.dimensions();

            let mut min_a: u8 = 255;
            let mut max_a: u8 = 0;
            for px in rgba.pixels() {
                let a = px.0[3];
                if a < min_a { min_a = a; }
                if a > max_a { max_a = a; }
            }
            let alpha_varies = max_a.saturating_sub(min_a) > 10;

            let mut rgb = RgbImage::new(mw, mh);
            for y in 0..mh {
                for x in 0..mw {
                    let px = rgba.get_pixel(x, y);
                    let [r, g, b, a] = px.0;
                    let v = if alpha_varies {
                        a
                    } else {
                        ((r as u16 + g as u16 + b as u16) / 3) as u8
                    };
                    rgb.put_pixel(x, y, image::Rgb([v, v, v]));
                }
            }
            Some(rgb)
        }
        Err(_) => None,
    }
}

fn load_single_mask(path: &str) -> Vec<RgbImage> {
    let p = Path::new(path);
    if !p.is_file() {
        println!("[wear] Файл не найден: {}", path);
        return Vec::new();
    }
    if let Some(ext) = p.extension() {
        let e = ext.to_string_lossy().to_lowercase();
        if !is_supported_ext(&e) {
            println!("[wear] Формат .{} не поддерживается", e);
            return Vec::new();
        }
    }
    match open_as_rgb(p) {
        Some(img) => vec![img],
        None => Vec::new(),
    }
}

// ============ Логика пула масок ============

/// 1. Если user_mask задан — используется ТОЛЬКО она.
/// 2. Иначе — берём из папки AppData только те, что в folder_mask_names.
///    Если folder_mask_names пуст или None — берём ВСЕ из папки.
fn resolve_mask_pool(
    app: &AppHandle,
    user_mask: Option<&str>,
    folder_mask_names: Option<&Vec<String>>,
    subfolder: &str,
) -> Vec<RgbImage> {
    if let Some(path) = user_mask.filter(|s| !s.is_empty()) {
        println!("[wear] Режим {}: одна юзерская маска \"{}\"", subfolder, path);
        return load_single_mask(path);
    }

    let dir = match user_masks_dir(app, subfolder) {
        Ok(d) => d,
        Err(e) => {
            println!("[wear] Не удалось получить папку масок: {}", e);
            return Vec::new();
        }
    };

    let all_files = scan_dir(&dir);
    if all_files.is_empty() {
        println!("[wear] Папка масок ({}) пуста", subfolder);
        return Vec::new();
    }

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
        Some(_) => Vec::new(),  // пустой список → ничего
        None => all_files,      // null → все (для случая когда JS не передал)
    };

    println!("[wear] Пул масок ({}): {} шт. из папки", subfolder, selected.len());

    let mut images = Vec::with_capacity(selected.len());
    for p in &selected {
        if let Some(img) = open_as_rgb(p) {
            images.push(img);
        }
    }
    images
}

// ============ Кастомная маска (custom preset) ============

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

    if let Some(ext) = p.extension() {
        let e = ext.to_string_lossy().to_lowercase();
        let allowed = ["png", "jpg", "jpeg", "bmp", "tga", "webp"];
        if !allowed.contains(&e.as_str()) {
            return Err(format!("Формат .{} не поддерживается", e));
        }
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
            let cr = (r as f32 * af) as u8;
            let cg = (g as f32 * af) as u8;
            let cb = (b as f32 * af) as u8;
            rgb.put_pixel(x, y, image::Rgb([cr, cg, cb]));
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
        if let Some(a) = out.albedo.as_ref() {
            out.albedo = Some(apply_custom_mask_to_albedo(a, mask, mp));
        }
    }
    if mp.affect_roughness {
        if let Some(r) = out.roughness.as_ref() {
            out.roughness = Some(apply_custom_mask_to_roughness(r, mask, mp));
        }
    }
    if mp.affect_normal {
        if let Some(n) = out.normal.as_ref() {
            out.normal = Some(apply_custom_mask_to_normal(n, mask, mp, 3.0));
        }
    }
    out
}

// ============ Параметры из UI ============

fn build_scratch_params(p: &WearParams) -> ScratchParamsFromUI {
    ScratchParamsFromUI {
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

    let mask_pool = if preset.name == "dirt" {
        resolve_mask_pool(
            &app,
            params.user_mask_dirt.as_deref(),
            params.folder_mask_names_dirt.as_ref(),
            "dirt",
        )
    } else if preset.name == "rust" {
        resolve_mask_pool(
            &app,
            params.user_mask_rust.as_deref(),
            params.folder_mask_names_rust.as_ref(),
            "rust",
        )
    } else {
        Vec::new()
    };

    let custom_mask = load_custom_mask(&params)?;
    let amount = (params.amount / 100.0).clamp(0.0, 1.0);
    let scratch_params = build_scratch_params(&params);
    let dirt_params = build_dirt_params(&params);
    let rust_params = build_rust_params(&params);

    // Последовательная генерация: emit из main thread доходит до фронта.
    // par_iter ломает прогресс — события копятся и уходят пачкой в конце.
    let mut variations: Vec<String> = Vec::with_capacity(params.count as usize);

    for i in 1..=params.count {
        let var_seed = params.seed.wrapping_add(i * 7919);
        let noise = TilingNoise::new(var_seed);

        let folder = format!("{}/wear_{:02}", params.output_dir, i);
        std::fs::create_dir_all(&folder)
            .map_err(|e| format!("create_dir_all {}: {}", folder, e))?;

        let empty_var: Vec<MaskInstance> = Vec::new();
        let instances_for_this = params.instances_per_variation
            .as_ref()
            .and_then(|v| v.get((i - 1) as usize))
            .unwrap_or(&empty_var);

        let warped = (preset.apply)(
            &set, &noise, amount,
            &scratch_params, &dirt_params, &rust_params,
            &mask_pool,
            instances_for_this,
        );

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
            current: i,
            total: params.count,
            stage: "generating".into(),
        });
    }

    let elapsed = start.elapsed().as_millis() as u64;
    let _ = app.emit("wear_progress", WearProgress {
        current: params.count,
        total: params.count,
        stage: "done".into(),
    });
    Ok(WearResult { variations, elapsed_ms: elapsed })
}

fn save_png(folder: &str, name: &str, img: &image::DynamicImage) -> Result<(), String> {
    let path = format!("{}/{}", folder, name);
    img.save_with_format(&path, image::ImageFormat::Png).map_err(|e| format!("save {}: {}", path, e))?;
    Ok(())
}