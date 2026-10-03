// Запись image::DynamicImage → PNG на диск
use std::path::Path;

pub fn save_png(path: &str, img: &image::DynamicImage) -> Result<(), String> {
    let p = Path::new(path);
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("create_dir_all: {}", e))?;
    }
    img.save_with_format(p, image::ImageFormat::Png)
        .map_err(|e| format!("save {}: {}", path, e))
}