// Чтение PNG/JPEG с диска → image::DynamicImage
use std::path::Path;

pub fn load_image(path: &str) -> Result<image::DynamicImage, String> {
    let p = Path::new(path);
    if !p.exists() {
        return Err(format!("file not found: {}", path));
    }
    image::open(p).map_err(|e| format!("open {}: {}", path, e))
}