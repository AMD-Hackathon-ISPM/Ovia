use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;
use serde_json::{Value, json};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("configuration error: {0}")]
    Config(String),
    #[error("invalid request: {0}")]
    InvalidRequest(String),
    #[error("invalid image: {0}")]
    InvalidImage(String),
    #[error("model startup failed: {0}")]
    ModelStartup(String),
    #[error("model inference failed: {0}")]
    Inference(String),
    #[error("internal error")]
    Internal,
}

#[derive(Serialize)]
struct ErrorEnvelope {
    error: ErrorBody,
}
#[derive(Serialize)]
struct ErrorBody {
    code: &'static str,
    message: String,
    details: Value,
}

impl AppError {
    pub fn config(value: impl Into<String>) -> Self {
        Self::Config(value.into())
    }
    pub fn startup(value: impl Into<String>) -> Self {
        Self::ModelStartup(value.into())
    }
    pub fn inference(value: impl Into<String>) -> Self {
        Self::Inference(value.into())
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code, public) = match &self {
            Self::InvalidRequest(message) if message == "schema_version_mismatch" => (
                StatusCode::CONFLICT,
                "schema_version_mismatch",
                self.to_string(),
            ),
            Self::InvalidRequest(_) => (
                StatusCode::BAD_REQUEST,
                "MISSING_REQUIRED_FIELD",
                self.to_string(),
            ),
            Self::InvalidImage(message) if message.contains("byte limit") => (
                StatusCode::PAYLOAD_TOO_LARGE,
                "IMAGE_TOO_LARGE",
                self.to_string(),
            ),
            Self::InvalidImage(message) if message.contains("dimensions") => (
                StatusCode::UNPROCESSABLE_ENTITY,
                "INVALID_IMAGE",
                self.to_string(),
            ),
            Self::InvalidImage(_) => (
                StatusCode::UNPROCESSABLE_ENTITY,
                "UNSUPPORTED_IMAGE_FORMAT",
                self.to_string(),
            ),
            Self::Inference(_) => (
                StatusCode::SERVICE_UNAVAILABLE,
                "MODEL_INFERENCE_FAILED",
                "A model could not complete inference".into(),
            ),
            Self::Config(_) | Self::ModelStartup(_) | Self::Internal => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "The service could not complete the request".into(),
            ),
        };
        (
            status,
            Json(ErrorEnvelope {
                error: ErrorBody {
                    code,
                    message: public,
                    details: json!({}),
                },
            }),
        )
            .into_response()
    }
}

impl From<std::io::Error> for AppError {
    fn from(_: std::io::Error) -> Self {
        Self::Internal
    }
}
impl From<serde_json::Error> for AppError {
    fn from(_: serde_json::Error) -> Self {
        Self::InvalidRequest("invalid JSON payload".into())
    }
}
