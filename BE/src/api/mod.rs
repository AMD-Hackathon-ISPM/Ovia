pub mod analyze;

use axum::{
    Router,
    extract::DefaultBodyLimit,
    http::{HeaderName, HeaderValue, Method},
    routing::{get, post},
};
use tower_http::{
    cors::CorsLayer,
    request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer},
    trace::TraceLayer,
};

use crate::AppState;

pub fn router(state: AppState) -> Router {
    let origins = state
        .config
        .allowed_origins
        .iter()
        .filter_map(|s| s.parse::<HeaderValue>().ok())
        .collect::<Vec<_>>();
    let request_id = HeaderName::from_static("x-request-id");
    let schema_version = HeaderName::from_static("x-ovia-schema-version");
    let max_body = state.config.max_image_bytes.saturating_add(1024 * 1024);
    let cors = CorsLayer::new()
        .allow_origin(origins)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::ACCEPT,
            request_id.clone(),
            schema_version,
        ]);
    Router::new()
        .route("/api/v1/health", get(analyze::health))
        .route("/api/v1/models", get(analyze::models))
        .route("/api/v1/analyze", post(analyze::analyze))
        .route("/v1/screenings", post(analyze::analyze))
        .layer(DefaultBodyLimit::max(max_body))
        .layer(cors)
        .layer(PropagateRequestIdLayer::new(request_id.clone()))
        .layer(SetRequestIdLayer::new(request_id, MakeRequestUuid))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
