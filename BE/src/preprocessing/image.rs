use base64::{Engine, engine::general_purpose::STANDARD};
use image::{
    DynamicImage, GenericImageView, GrayImage, ImageFormat, Luma, RgbImage, Rgba, RgbaImage,
    imageops::FilterType,
};
use std::io::Cursor;

use crate::{error::AppError, orchestration::evidence::BoundingBox};

#[derive(Clone)]
pub struct DecodedImage {
    pub image: DynamicImage,
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct LetterboxMeta {
    pub original_width: u32,
    pub original_height: u32,
    pub scale: f64,
    pub resized_width: u32,
    pub resized_height: u32,
    pub pad_left: u32,
    pub pad_right: u32,
    pub pad_top: u32,
    pub pad_bottom: u32,
    pub target_size: u32,
}

pub struct ReconstructedMask {
    pub mask: GrayImage,
    pub foreground_fraction: f32,
    pub bounding_box: Option<BoundingBox>,
    pub connected_components: u32,
    pub png_data_url: String,
}

pub fn decode(bytes: &[u8], max_pixels: u64) -> Result<DecodedImage, AppError> {
    let image = image::load_from_memory(bytes).map_err(|_| {
        AppError::InvalidImage("image bytes could not be decoded as PNG, JPEG, or WebP".into())
    })?;
    let (width, height) = image.dimensions();
    if width == 0 || height == 0 || u64::from(width) * u64::from(height) > max_pixels {
        return Err(AppError::InvalidImage(
            "image dimensions exceed the configured limit".into(),
        ));
    }
    Ok(DecodedImage {
        image: image.to_rgb8().into(),
        width,
        height,
    })
}

pub fn biomedclip_tensor(decoded: &DecodedImage) -> Vec<f32> {
    let rgb = decoded.image.to_rgb8();
    let (w, h) = rgb.dimensions();
    let (rw, rh) = if w <= h {
        (224, ((h as u64 * 224) / w as u64) as u32)
    } else {
        (((w as u64 * 224) / h as u64) as u32, 224)
    };
    let resized = image::imageops::resize(&rgb, rw.max(224), rh.max(224), FilterType::CatmullRom);
    let left = (resized.width() - 224) / 2;
    let top = (resized.height() - 224) / 2;
    let crop = image::imageops::crop_imm(&resized, left, top, 224, 224).to_image();
    normalized_nchw(
        &crop,
        [0.48145466, 0.4578275, 0.40821073],
        [0.26862954, 0.26130258, 0.27577711],
    )
}

pub fn convnext_tensor(decoded: &DecodedImage) -> Vec<f32> {
    let rgb = decoded.image.to_rgb8();
    let (width, height) = rgb.dimensions();
    let dark = |x: u32, y: u32| {
        let p = rgb.get_pixel(x, y).0;
        ((77 * u16::from(p[0]) + 150 * u16::from(p[1]) + 29 * u16::from(p[2])) >> 8) <= 8
    };
    let cap_y = ((height as f64 * 0.08).floor() as u32).max(1);
    let cap_x = ((width as f64 * 0.08).floor() as u32).max(1);
    let mut top = 0;
    for y in 0..cap_y {
        let n = (0..width).filter(|&x| dark(x, y)).count() as u64;
        if n * 1000 < (width as u64) * 995 {
            break;
        }
        top += 1
    }
    let mut bottom = 0;
    for d in 0..cap_y {
        let y = height - 1 - d;
        let n = (0..width).filter(|&x| dark(x, y)).count() as u64;
        if n * 1000 < (width as u64) * 995 {
            break;
        }
        bottom += 1
    }
    let mut left = 0;
    for x in 0..cap_x {
        let n = (0..height).filter(|&y| dark(x, y)).count() as u64;
        if n * 1000 < (height as u64) * 995 {
            break;
        }
        left += 1
    }
    let mut right = 0;
    for d in 0..cap_x {
        let x = width - 1 - d;
        let n = (0..height).filter(|&y| dark(x, y)).count() as u64;
        if n * 1000 < (height as u64) * 995 {
            break;
        }
        right += 1
    }
    if width - left - right < 64 || height - top - bottom < 64 {
        top = 0;
        bottom = 0;
        left = 0;
        right = 0
    }
    let mut trimmed =
        image::imageops::crop_imm(&rgb, left, top, width - left - right, height - top - bottom)
            .to_image();
    let short = trimmed.width().min(trimmed.height());
    let margin = (f64::from(short) * 0.02).round_ties_even() as u32;
    if short.saturating_sub(2 * margin) >= 64 {
        trimmed = image::imageops::crop_imm(
            &trimmed,
            margin,
            margin,
            trimmed.width() - 2 * margin,
            trimmed.height() - 2 * margin,
        )
        .to_image()
    }
    let side = trimmed.width().min(trimmed.height());
    let x0 = (trimmed.width() - side) / 2;
    let y0 = (trimmed.height() - side) / 2;
    let square = image::imageops::crop_imm(&trimmed, x0, y0, side, side).to_image();
    let standard = image::imageops::resize(&square, 256, 256, FilterType::CatmullRom);
    let crop = image::imageops::crop_imm(&standard, 16, 16, 224, 224).to_image();
    normalized_nchw(&crop, [0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
}

pub fn letterbox_meta(width: u32, height: u32, target: u32) -> LetterboxMeta {
    let scale = (f64::from(target) / f64::from(width)).min(f64::from(target) / f64::from(height));
    let rw = (f64::from(width) * scale + 0.5).floor() as u32;
    let rh = (f64::from(height) * scale + 0.5).floor() as u32;
    let px = target - rw;
    let py = target - rh;
    let left = px / 2;
    let top = py / 2;
    LetterboxMeta {
        original_width: width,
        original_height: height,
        scale,
        resized_width: rw,
        resized_height: rh,
        pad_left: left,
        pad_right: px - left,
        pad_top: top,
        pad_bottom: py - top,
        target_size: target,
    }
}

pub fn unet_tensor(decoded: &DecodedImage) -> (Vec<f32>, LetterboxMeta) {
    let meta = letterbox_meta(decoded.width, decoded.height, 512);
    let rgb = decoded.image.to_rgb8();
    let resized = resize_bilinear_half_pixel(&rgb, meta.resized_width, meta.resized_height);
    let mut canvas = RgbImage::new(512, 512);
    image::imageops::replace(
        &mut canvas,
        &resized,
        i64::from(meta.pad_left),
        i64::from(meta.pad_top),
    );
    (
        normalized_nchw(&canvas, [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        meta,
    )
}

pub fn reconstruct(
    logits: &[f32],
    meta: LetterboxMeta,
    threshold: f32,
) -> Result<ReconstructedMask, AppError> {
    if logits.len() != 512 * 512 {
        return Err(AppError::inference("U-Net++ output has unexpected length"));
    }
    let mut cropped = GrayImage::new(meta.resized_width, meta.resized_height);
    for y in 0..meta.resized_height {
        for x in 0..meta.resized_width {
            let i = ((y + meta.pad_top) * 512 + x + meta.pad_left) as usize;
            let p = 1.0 / (1.0 + (-logits[i]).exp());
            cropped.put_pixel(x, y, Luma([if p >= threshold { 255 } else { 0 }]))
        }
    }
    let mask = image::imageops::resize(
        &cropped,
        meta.original_width,
        meta.original_height,
        FilterType::Nearest,
    );
    let mut count = 0u64;
    let mut min_x = u32::MAX;
    let mut min_y = u32::MAX;
    let mut max_x = 0;
    let mut max_y = 0;
    for (x, y, p) in mask.enumerate_pixels() {
        if p[0] > 0 {
            count += 1;
            min_x = min_x.min(x);
            min_y = min_y.min(y);
            max_x = max_x.max(x);
            max_y = max_y.max(y)
        }
    }
    let bounding_box = (count > 0).then_some(BoundingBox {
        x_min: min_x,
        y_min: min_y,
        x_max: max_x,
        y_max: max_y,
    });
    let connected_components = component_count(&mask);
    let mut bytes = Vec::new();
    let mut overlay = RgbaImage::new(meta.original_width, meta.original_height);
    for (x, y, pixel) in mask.enumerate_pixels() {
        overlay.put_pixel(
            x,
            y,
            if pixel[0] > 0 {
                Rgba([214, 105, 124, 170])
            } else {
                Rgba([0, 0, 0, 0])
            },
        );
    }
    DynamicImage::ImageRgba8(overlay)
        .write_to(&mut Cursor::new(&mut bytes), ImageFormat::Png)
        .map_err(|_| AppError::Internal)?;
    Ok(ReconstructedMask {
        foreground_fraction: count as f32
            / (u64::from(meta.original_width) * u64::from(meta.original_height)) as f32,
        bounding_box,
        connected_components,
        mask,
        png_data_url: format!("data:image/png;base64,{}", STANDARD.encode(bytes)),
    })
}

fn normalized_nchw(image: &RgbImage, mean: [f32; 3], std: [f32; 3]) -> Vec<f32> {
    let plane = (image.width() * image.height()) as usize;
    let mut out = vec![0.0; plane * 3];
    for (x, y, p) in image.enumerate_pixels() {
        let i = (y * image.width() + x) as usize;
        for c in 0..3 {
            out[c * plane + i] = (f32::from(p[c]) / 255.0 - mean[c]) / std[c]
        }
    }
    out
}

/// OpenCV-style half-pixel bilinear geometry used by the source U-Net pipeline.
fn resize_bilinear_half_pixel(source: &RgbImage, width: u32, height: u32) -> RgbImage {
    let (sw, sh) = source.dimensions();
    let mut output = RgbImage::new(width, height);
    for y in 0..height {
        let fy = (f64::from(y) + 0.5) * f64::from(sh) / f64::from(height) - 0.5;
        let mut y0 = fy.floor() as i64;
        let mut wy = fy - y0 as f64;
        if y0 < 0 {
            y0 = 0;
            wy = 0.0
        } else if y0 >= i64::from(sh) - 1 {
            y0 = i64::from(sh) - 1;
            wy = 0.0
        }
        let y1 = (y0 + 1).min(i64::from(sh) - 1) as u32;
        for x in 0..width {
            let fx = (f64::from(x) + 0.5) * f64::from(sw) / f64::from(width) - 0.5;
            let mut x0 = fx.floor() as i64;
            let mut wx = fx - x0 as f64;
            if x0 < 0 {
                x0 = 0;
                wx = 0.0
            } else if x0 >= i64::from(sw) - 1 {
                x0 = i64::from(sw) - 1;
                wx = 0.0
            }
            let x1 = (x0 + 1).min(i64::from(sw) - 1) as u32;
            let p00 = source.get_pixel(x0 as u32, y0 as u32);
            let p01 = source.get_pixel(x1, y0 as u32);
            let p10 = source.get_pixel(x0 as u32, y1);
            let p11 = source.get_pixel(x1, y1);
            let mut pixel = [0u8; 3];
            for c in 0..3 {
                let top = f64::from(p00[c]) * (1.0 - wx) + f64::from(p01[c]) * wx;
                let bottom = f64::from(p10[c]) * (1.0 - wx) + f64::from(p11[c]) * wx;
                pixel[c] = (top * (1.0 - wy) + bottom * wy).round().clamp(0.0, 255.0) as u8
            }
            output.put_pixel(x, y, image::Rgb(pixel));
        }
    }
    output
}

fn component_count(mask: &GrayImage) -> u32 {
    let w = mask.width();
    let h = mask.height();
    let mut seen = vec![false; (w * h) as usize];
    let mut total = 0;
    for y in 0..h {
        for x in 0..w {
            let idx = (y * w + x) as usize;
            if mask.get_pixel(x, y)[0] == 0 || seen[idx] {
                continue;
            }
            total += 1;
            seen[idx] = true;
            let mut stack = vec![(x, y)];
            while let Some((cx, cy)) = stack.pop() {
                for dy in -1i32..=1 {
                    for dx in -1i32..=1 {
                        if dx == 0 && dy == 0 {
                            continue;
                        }
                        let nx = cx as i32 + dx;
                        let ny = cy as i32 + dy;
                        if nx < 0 || ny < 0 || nx >= w as i32 || ny >= h as i32 {
                            continue;
                        }
                        let ni = ny as u32 * w + nx as u32;
                        if !seen[ni as usize] && mask.get_pixel(nx as u32, ny as u32)[0] > 0 {
                            seen[ni as usize] = true;
                            stack.push((nx as u32, ny as u32))
                        }
                    }
                }
            }
        }
    }
    total
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_relative_eq;

    #[test]
    fn inverse_fixture_geometry_matches_source_contract() {
        let meta = letterbox_meta(959, 537, 512);
        assert_eq!((meta.resized_width, meta.resized_height), (512, 287));
        assert_eq!(
            (meta.pad_left, meta.pad_right, meta.pad_top, meta.pad_bottom),
            (0, 0, 112, 113)
        );
        assert_relative_eq!(meta.scale, 0.5338894681960376, epsilon = 1e-12);
    }

    #[test]
    fn reconstructs_original_dimensions_bbox_and_components() {
        let meta = letterbox_meta(959, 537, 512);
        let mut logits = vec![-100.0; 512 * 512];
        for y in 140..200 {
            for x in 100..180 {
                logits[y * 512 + x] = 100.0;
            }
        }
        let restored = reconstruct(&logits, meta, 0.30).unwrap();
        assert_eq!(restored.mask.dimensions(), (959, 537));
        assert_eq!(restored.connected_components, 1);
        assert!(restored.bounding_box.is_some());
        assert!(restored.png_data_url.starts_with("data:image/png;base64,"));
    }

    #[test]
    fn preprocessing_shapes_and_black_normalization_are_stable() {
        let decoded = DecodedImage {
            image: DynamicImage::ImageRgb8(RgbImage::new(320, 240)),
            width: 320,
            height: 240,
        };
        let biomed = biomedclip_tensor(&decoded);
        let conv = convnext_tensor(&decoded);
        let (unet, meta) = unet_tensor(&decoded);
        assert_eq!(biomed.len(), 3 * 224 * 224);
        assert_eq!(conv.len(), 3 * 224 * 224);
        assert_eq!(unet.len(), 3 * 512 * 512);
        assert_relative_eq!(biomed[0], -0.48145466 / 0.26862954, epsilon = 1e-6);
        assert_eq!(
            (meta.resized_width, meta.resized_height, meta.pad_top),
            (512, 384, 64)
        );
    }

    #[test]
    fn decode_rejects_malformed_input() {
        assert!(decode(b"not-an-image", 100).is_err())
    }
}
