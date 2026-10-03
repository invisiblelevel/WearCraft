// Sobel edge из height-карты.
// Порт JS-версии из pbr-loader.js, но на Rust — быстрее.

use image::GrayImage;

/// Считает edge-карту через оператор Собеля.
/// Возвращает изображение, где яркость = магнитуда градиента.
pub fn sobel_edge(height: &GrayImage) -> GrayImage {
    let (w, h) = height.dimensions();
    let mut out = GrayImage::new(w, h);

    if w < 3 || h < 3 {
        return out;
    }

    // Sobel-ядра
    let gx_k: [i32; 9] = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    let gy_k: [i32; 9] = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for y in 1..(h - 1) {
        for x in 1..(w - 1) {
            let mut gx: i32 = 0;
            let mut gy: i32 = 0;
            let mut k = 0;

            for dy in -1_i32..=1 {
                for dx in -1_i32..=1 {
                    let px = height.get_pixel(
                        (x as i32 + dx) as u32,
                        (y as i32 + dy) as u32,
                    )[0] as i32;
                    gx += px * gx_k[k];
                    gy += px * gy_k[k];
                    k += 1;
                }
            }

            let mag = ((gx * gx + gy * gy) as f32).sqrt();
            let val = (mag * 2.0).min(255.0) as u8;
            out.put_pixel(x, y, image::Luma([val]));
        }
    }

    // Границы оставляем чёрными (как в JS-версии)
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::Luma;

    #[test]
    fn test_flat_is_black() {
        // Плоская карта → нет градиентов → выход чёрный
        let img = GrayImage::from_pixel(16, 16, Luma([128]));
        let out = sobel_edge(&img);
        // Внутренняя часть должна быть чёрной
        for y in 1..15 {
            for x in 1..15 {
                assert_eq!(out.get_pixel(x, y)[0], 0, "flat не дал 0 в ({}, {})", x, y);
            }
        }
    }

    #[test]
    fn test_gradient_has_edges() {
        // Вертикальный градиент → границы должны давать ненулевой edge
        let mut img = GrayImage::new(16, 16);
        for y in 0..16 {
            for x in 0..16 {
                img.put_pixel(x, y, Luma([(x * 16) as u8]));
            }
        }
        let out = sobel_edge(&img);
        // Хотя бы несколько пикселей должны быть > 0
        let nonzero = out.pixels().filter(|p| p[0] > 0).count();
        assert!(nonzero > 50, "gradient дал слишком мало границ: {}", nonzero);
    }

    #[test]
    fn test_size_unchanged() {
        let img = GrayImage::new(32, 24);
        let out = sobel_edge(&img);
        assert_eq!(out.dimensions(), (32, 24));
    }
}