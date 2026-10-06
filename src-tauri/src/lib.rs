mod commands;
mod core;

use tauri::Manager;

#[tauri::command]
fn open_manual(app: tauri::AppHandle) -> Result<(), String> {
    let mut tried: Vec<String> = Vec::new();

    if let Ok(res_dir) = app.path().resource_dir() {
        let p = res_dir.join("assets").join("manual.html");
        tried.push(p.to_string_lossy().to_string());
        if p.is_file() {
            return open_path(&p);
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let p = dir.join("assets").join("manual.html");
            tried.push(p.to_string_lossy().to_string());
            if p.is_file() {
                return open_path(&p);
            }
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let p = dir.join("..").join("..").join("assets").join("manual.html");
            let p = p.canonicalize().unwrap_or(p);
            tried.push(p.to_string_lossy().to_string());
            if p.is_file() {
                return open_path(&p);
            }
        }
    }

    Err(format!("manual.html не найден. Пробовали:\n{}", tried.join("\n")))
}

fn open_path(path: &std::path::Path) -> Result<(), String> {
    let path_str = path.to_string_lossy().to_string();

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &path_str])
            .spawn()
            .map_err(|e| format!("cmd start: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(&path_str)
            .spawn().map_err(|e| format!("open: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open").arg(&path_str)
            .spawn().map_err(|e| format!("xdg-open: {}", e))?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::save::save_png,
            commands::save::save_text,
            commands::save::save_zip,
            commands::wear::generate_wear,
            commands::wear::list_masks_in_folder,
            commands::wear::get_user_masks_path,
            commands::wear::open_user_masks_folder,
			commands::wear::get_geo_normal_path,
            open_manual,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}