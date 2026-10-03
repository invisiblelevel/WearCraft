use serde::Deserialize;
use std::fs;
use std::io::Write;
use std::path::Path;

#[tauri::command]
pub async fn save_png(path: String, bytes: Vec<u8>) -> Result<(), String> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create_dir_all: {}", e))?;
    }
    fs::write(p, &bytes).map_err(|e| format!("write: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn save_text(path: String, content: String) -> Result<(), String> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create_dir_all: {}", e))?;
    }
    fs::write(p, content.as_bytes()).map_err(|e| format!("write: {}", e))?;
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct ZipFileEntry {
    pub name: String,
    pub bytes: Vec<u8>,
}

#[tauri::command]
pub async fn save_zip(zip_path: String, files: Vec<ZipFileEntry>) -> Result<(), String> {
    let p = Path::new(&zip_path);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create_dir_all: {}", e))?;
    }

    let file = fs::File::create(p).map_err(|e| format!("create: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);
    let options: zip::write::FileOptions<()> = zip::write::FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);

    for entry in files {
        zip.start_file(&entry.name, options)
            .map_err(|e| format!("start_file {}: {}", entry.name, e))?;
        zip.write_all(&entry.bytes)
            .map_err(|e| format!("write_all {}: {}", entry.name, e))?;
    }

    zip.finish().map_err(|e| format!("finish: {}", e))?;
    Ok(())
}