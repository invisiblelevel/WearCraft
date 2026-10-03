// Domain warping height-карты через тайлящийся шум.
//
// Для каждого пикселя (x, y) считаем смещение через шум:
//   dx = noise1(x, y) * amount * w
//   dy = noise2(x, y) * amount * h
// И читаем исходный пиксель из (x + dx, y + dy) с wrap-around.
//
// Результат: карта «плывёт», паттерн износа смещается, но не теряется.

use image::GrayImage;
use super::noise::TilingNoise;

/// Сдвигает пиксели height-карты на величину, зависящую от шума.
///
/// `amount` — 0.0 .. 1.0, амплитуда смещения в долях размера текстуры.
///           0.0 = без изменений, 1.0 = очень сильное искажение.
pub fn warp_height(
    height: &GrayImage,
    noise: &TilingNoise,
    amount: f32,
) -> GrayImage {
    let (w, h) = height.dimensions();
    let wf = w as f32;
    let hf = h as f32;

    if amount <= 0.0 || w == 0 || h == 0 {
        return height.clone();
    }

    let mut out = GrayImage::new(w, h);
    let amount_px_x = amount * wf;
    let amount_px_y = amount * hf;

    // Разные «каналы» шума — сдвигаем координаты, чтоб получить независимые поля
    let noise_offset_x = 17.3;
    let noise_offset_y = 43.7;

    for y in 0..h {
        for x in 0..w {
            let xf = x as f32;
            let yf = y as f32;

            // Смещение по X — через один срез шума
            let n1 = noise.fbm(
                xf + noise_offset_x,
                yf + noise_offset_x,
                wf,
                hf,
                3,     // octaves
                0.5,   // persistence
                2.0,   // lacunarity
            );
            // Смещение по Y — через другой срез шума
            let n2 = noise.fbm(
                xf + noise_offset_y,
                yf + noise_offset_y,
                wf,
                hf,
                3,
                0.5,
                2.0,
            );

            let dx = n1 * amount_px_x;
            let dy = n2 * amount_px_y;

            // Куда читать (с wrap-around)
            let sx = wrap_index(xf + dx, wf);
            let sy = wrap_index(yf + dy, hf);

            let px = height.get_pixel(sx, sy);
            out.put_pixel(x, y, *px);
        }
    }

    out
}

/// Округляет и заворачивает координату в [0, size).
fn wrap_index(v: f32, size: f32) -> u32 {
    let mut i = v.round() as i32;
    let s = size as i32;
    i = ((i % s) + s) % s;  // положительный modulo
    i as u32
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::Luma;

    fn make_gradient(w: u32, h: u32) -> GrayImage {
        let mut img = GrayImage::new(w, h);
        for y in 0..h {
            for x in 0..w {
                let v = ((x * 255) / w.max(1)) as u8;
                img.put_pixel(x, y, Luma([v]));
            }
        }
        img
    }

    #[test]
    fn test_size_unchanged() {
        let img = make_gradient(64, 64);
        let noise = TilingNoise::new(1);
        let out = warp_height(&img, &noise, 0.5);
        assert_eq!(out.dimensions(), (64, 64));
    }

    #[test]
    fn test_amount_zero_identity() {
        let img = make_gradient(32, 32);
        let noise = TilingNoise::new(2);
        let out = warp_height(&img, &noise, 0.0);
        assert_eq!(out.as_raw(), img.as_raw());
    }

    #[test]
    fn test_amount_positive_changes() {
        let img = make_gradient(64, 64);
        let noise = TilingNoise::new(3);
        let out = warp_height(&img, &noise, 0.5);
        // Хотя бы часть пикселей должна отличаться
        let mut diff_count = 0;
        for (a, b) in img.pixels().zip(out.pixels()) {
            if a != b {
                diff_count += 1;
            }
        }
        assert!(diff_count > 100, "Warp не изменил картинку: {} различий", diff_count);
    }

    #[test]
    fn test_wrap_index() {
        assert_eq!(wrap_index(5.0, 10.0), 5);
        assert_eq!(wrap_index(10.0, 10.0), 0);
        assert_eq!(wrap_index(12.0, 10.0), 2);
        assert_eq!(wrap_index(-1.0, 10.0), 9);
        assert_eq!(wrap_index(-12.0, 10.0), 8);
    }
}