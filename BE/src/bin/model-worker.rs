use std::{env, sync::Arc};

use axum::{
    Json, Router,
    body::Bytes,
    extract::{DefaultBodyLimit, State},
    routing::{get, post},
};
use ovia_backend::{
    api::analyze::{ImageKind, worker_clinical_evidence, worker_image_evidence},
    config::Config,
    contracts::request::ClinicalInput,
    error::AppError,
    inference::{BIOMED_ID, CONVNEXT_ID, ModelRegistry, UNET_ID, XGBOOST_ID},
    preprocessing::image::decode,
};
use serde::Serialize;
use tower_http::trace::TraceLayer;
use tracing::info;

#[derive(Clone)]
struct WorkerState {
    model_id: String,
    models: Arc<ModelRegistry>,
    max_image_pixels: u64,
}

#[derive(Serialize)]
struct WorkerHealth {
    status: &'static str,
    service: &'static str,
    manifest_version: String,
    model: ovia_backend::inference::LoadedModelInfo,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();
    let config = Config::from_env()?;
    let model_id =
        env::var("MODEL_WORKER_ID").map_err(|_| anyhow::anyhow!("MODEL_WORKER_ID is required"))?;
    let address = config.bind_address();
    let max_body = config.max_image_bytes;
    let max_image_pixels = config.max_image_pixels;
    let models = Arc::new(ModelRegistry::load_one(&config, &model_id).await?);
    let state = WorkerState {
        model_id,
        models,
        max_image_pixels,
    };
    let app = Router::new()
        .route("/internal/health", get(health))
        .route("/internal/infer/image", post(infer_image))
        .route("/internal/infer/clinical", post(infer_clinical))
        .layer(DefaultBodyLimit::max(max_body))
        .layer(TraceLayer::new_for_http())
        .with_state(state);
    let listener = tokio::net::TcpListener::bind(address).await?;
    info!(%address, "isolated model worker listening");
    axum::serve(listener, app).await?;
    Ok(())
}

async fn health(State(state): State<WorkerState>) -> Result<Json<WorkerHealth>, AppError> {
    let model = state
        .models
        .model_infos()
        .into_iter()
        .next()
        .ok_or_else(|| AppError::inference("worker model is not loaded"))?;
    Ok(Json(WorkerHealth {
        status: "ok",
        service: "ovia-model-worker",
        manifest_version: state.models.manifest_version().into(),
        model,
    }))
}

async fn infer_image(
    State(state): State<WorkerState>,
    bytes: Bytes,
) -> Result<Json<serde_json::Value>, AppError> {
    let kind = match state.model_id.as_str() {
        BIOMED_ID => ImageKind::Biomed,
        CONVNEXT_ID => ImageKind::ConvNext,
        UNET_ID => ImageKind::Unet,
        _ => {
            return Err(AppError::InvalidRequest(
                "this worker accepts clinical inference only".into(),
            ));
        }
    };
    let image = decode(&bytes, state.max_image_pixels)?;
    Ok(Json(worker_image_evidence(&state.models, &image, kind)?))
}

async fn infer_clinical(
    State(state): State<WorkerState>,
    Json(input): Json<ClinicalInput>,
) -> Result<Json<ovia_backend::orchestration::evidence::ClinicalEvidence>, AppError> {
    if state.model_id != XGBOOST_ID {
        return Err(AppError::InvalidRequest(
            "this worker accepts image inference only".into(),
        ));
    }
    input.validate()?;
    Ok(Json(worker_clinical_evidence(&state.models, &input)))
}
