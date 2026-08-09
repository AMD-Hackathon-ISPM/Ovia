use ovia_backend::{
    config::{Config, ExecutionProviderPreference},
    contracts::request::ClinicalInput,
    inference::ModelRegistry,
    preprocessing::image::{biomedclip_tensor, convnext_tensor, decode, unet_tensor},
};
use serde::Serialize;
use std::{path::PathBuf, sync::Arc, time::Instant};

#[derive(Serialize)]
struct Stats {
    median_ms: f64,
    p95_ms: f64,
    samples: usize,
}
#[derive(Serialize)]
struct Report {
    mode: &'static str,
    warmup: usize,
    biomedclip: Stats,
    convnext_tiny: Stats,
    xgboost: Stats,
    unetpp: Stats,
    combined_sequential: Stats,
    combined_concurrent: Stats,
}
fn stats(mut values: Vec<f64>) -> Stats {
    values.sort_by(f64::total_cmp);
    let n = values.len();
    Stats {
        median_ms: values[n / 2],
        p95_ms: values[((n as f64 * 0.95).ceil() as usize)
            .saturating_sub(1)
            .min(n - 1)],
        samples: n,
    }
}
fn timed<T>(mut f: impl FnMut() -> T, n: usize) -> (Vec<f64>, T) {
    let mut values = Vec::with_capacity(n);
    let mut last = None;
    for _ in 0..n {
        let start = Instant::now();
        last = Some(f());
        values.push(start.elapsed().as_secs_f64() * 1000.0)
    }
    (values, last.unwrap())
}
fn config() -> Config {
    Config {
        host: "127.0.0.1".parse().unwrap(),
        port: 0,
        models_dir: PathBuf::from("models"),
        execution_provider: ExecutionProviderPreference::Cpu,
        allowed_origins: vec![],
        max_image_bytes: 2_000_000,
        max_image_pixels: 2_000_000,
        llm: None,
        inference: ovia_backend::config::InferenceConfig::Local,
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let iterations = std::env::var("BENCHMARK_ITERATIONS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(8);
    let warmup = 2;
    let models = Arc::new(ModelRegistry::load(&config()).await?);
    let bytes = std::fs::read("tests/fixtures/synthetic_ultrasound.png")?;
    let image = decode(&bytes, 2_000_000)?;
    let biomed = biomedclip_tensor(&image);
    let conv = convnext_tensor(&image);
    let (unet, _) = unet_tensor(&image);
    let clinical = ClinicalInput {
        age_years: Some(29.0),
        weight_kg: Some(68.0),
        height_cm: Some(163.0),
        cycle_regularity_code: Some(4.0),
        hair_growth: Some(1.0),
        ..Default::default()
    };
    let xgb = models.clinical_preprocessor.transform(&clinical)?;
    for _ in 0..warmup {
        models.run_biomedclip(biomed.clone())?;
        models.run_convnext(conv.clone())?;
        models.run_xgboost(xgb.clone())?;
        models.run_unet(unet.clone())?;
    }
    let (biomed_times, _) = timed(
        || models.run_biomedclip(biomed.clone()).unwrap(),
        iterations,
    );
    let (conv_times, _) = timed(|| models.run_convnext(conv.clone()).unwrap(), iterations);
    let (xgb_times, _) = timed(|| models.run_xgboost(xgb.clone()).unwrap(), iterations);
    let (unet_times, _) = timed(|| models.run_unet(unet.clone()).unwrap(), iterations);
    let (sequential, _) = timed(
        || {
            models.run_biomedclip(biomed.clone()).unwrap();
            models.run_convnext(conv.clone()).unwrap();
            models.run_xgboost(xgb.clone()).unwrap();
            models.run_unet(unet.clone()).unwrap()
        },
        iterations,
    );
    let mut concurrent = Vec::with_capacity(iterations);
    for _ in 0..iterations {
        let start = Instant::now();
        let (a, b, c, d) = (
            models.clone(),
            models.clone(),
            models.clone(),
            models.clone(),
        );
        let (i1, i2, i3, i4) = (biomed.clone(), conv.clone(), xgb.clone(), unet.clone());
        let (r1, r2, r3, r4) = tokio::join!(
            tokio::task::spawn_blocking(move || a.run_biomedclip(i1)),
            tokio::task::spawn_blocking(move || b.run_convnext(i2)),
            tokio::task::spawn_blocking(move || c.run_xgboost(i3)),
            tokio::task::spawn_blocking(move || d.run_unet(i4))
        );
        r1??;
        r2??;
        r3??;
        r4??;
        concurrent.push(start.elapsed().as_secs_f64() * 1000.0)
    }
    println!(
        "{}",
        serde_json::to_string_pretty(&Report {
            mode: "CPU, warm sessions, inference only",
            warmup,
            biomedclip: stats(biomed_times),
            convnext_tiny: stats(conv_times),
            xgboost: stats(xgb_times),
            unetpp: stats(unet_times),
            combined_sequential: stats(sequential),
            combined_concurrent: stats(concurrent)
        })?
    );
    Ok(())
}
