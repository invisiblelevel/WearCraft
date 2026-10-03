// Чтение PBR-сета с диска.
// Используется внутри generate_wear — карты читаются как DynamicImage,
// конвертируются в GrayImage/RgbImage по необходимости.

use image::{DynamicImage, GrayImage, RgbImage};
use std::path::Path;

/// Одна карта PBR-сета на диске — путь + тип.
#[derive(Debug, Clone)]
pub struct PbrMap {
    pub kind: PbrMapKind,
    pub path: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PbrMapKind {
    Albedo,
    Normal,
    Roughness,
    Ao,
    Height,
    Metalness,
    Edge,
}

impl PbrMapKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            PbrMapKind::Albedo    => "albedo",
            PbrMapKind::Normal    => "normal",
            PbrMapKind::Roughness => "roughness",
            PbrMapKind::Ao        => "ao",
            PbrMapKind::Height    => "height",
            PbrMapKind::Metalness => "metalness",
            PbrMapKind::Edge      => "edge",
        }
    }
}

/// Загруженный PBR-сет: карты в виде изображений.
#[derive(Debug, Clone)]
pub struct LoadedPbr {
    pub albedo:    Option<RgbImage>,
    pub normal:    Option<RgbImage>,
    pub roughness: Option<GrayImage>,
    pub ao:        Option<GrayImage>,
    pub height:    Option<GrayImage>,
    pub metalness: Option<GrayImage>,
    pub edge:      Option<GrayImage>,
}

impl LoadedPbr {
    pub fn width(&self) -> u32 {
        self.reference_dim().0
    }
    pub fn height(&self) -> u32 {
        self.reference_dim().1
    }

    /// Размеры по любой загруженной карте — все должны быть одного размера.
    fn reference_dim(&self) -> (u32, u32) {
        if let Some(i) = self.albedo.as_ref()    { return (i.width(), i.height()); }
        if let Some(i) = self.normal.as_ref()    { return (i.width(), i.height()); }
        if let Some(i) = self.roughness.as_ref() { return (i.width(), i.height()); }
        if let Some(i) = self.ao.as_ref()        { return (i.width(), i.height()); }
        if let Some(i) = self.height.as_ref()    { return (i.width(), i.height()); }
        if let Some(i) = self.metalness.as_ref() { return (i.width(), i.height()); }
        if let Some(i) = self.edge.as_ref()      { return (i.width(), i.height()); }
        (0, 0)
    }
}

/// Читает одну карту с диска, приводит к нужному формату.
fn read_map(path: &str, kind: PbrMapKind) -> Result<DynamicImage, String> {
    let p = Path::new(path);
    if !p.exists() {
        return Err(format!("Файл не найден: {}", path));
    }
    image::open(p).map_err(|e| format!("Открытие {}: {}", path, e))
}

/// Читает весь PBR-сет с диска.
/// Возвращает LoadedPbr со всеми загруженными картами.
/// Если какая-то карта не указана — поле None.
pub fn load_pbr_set(
    albedo:    Option<&str>,
    normal:    Option<&str>,
    roughness: Option<&str>,
    ao:        Option<&str>,
    height:    Option<&str>,
    metalness: Option<&str>,
    edge:      Option<&str>,
) -> Result<LoadedPbr, String> {
    let mut set = LoadedPbr {
        albedo: None, normal: None, roughness: None,
        ao: None, height: None, metalness: None, edge: None,
    };

    if let Some(p) = albedo {
        let img = read_map(p, PbrMapKind::Albedo)?;
        set.albedo = Some(img.to_rgb8());
    }
    if let Some(p) = normal {
        let img = read_map(p, PbrMapKind::Normal)?;
        set.normal = Some(img.to_rgb8());
    }
    if let Some(p) = roughness {
        let img = read_map(p, PbrMapKind::Roughness)?;
        set.roughness = Some(img.to_luma8());
    }
    if let Some(p) = ao {
        let img = read_map(p, PbrMapKind::Ao)?;
        set.ao = Some(img.to_luma8());
    }
    if let Some(p) = height {
        let img = read_map(p, PbrMapKind::Height)?;
        set.height = Some(img.to_luma8());
    }
    if let Some(p) = metalness {
        let img = read_map(p, PbrMapKind::Metalness)?;
        set.metalness = Some(img.to_luma8());
    }
    if let Some(p) = edge {
        let img = read_map(p, PbrMapKind::Edge)?;
        set.edge = Some(img.to_luma8());
    }

    Ok(set)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_kind_as_str() {
        assert_eq!(PbrMapKind::Albedo.as_str(), "albedo");
        assert_eq!(PbrMapKind::Ao.as_str(), "ao");
    }

    #[test]
    fn test_empty_set() {
        let set = load_pbr_set(None, None, None, None, None, None, None).unwrap();
        assert!(set.albedo.is_none());
        assert_eq!(set.width(), 0);
    }
}