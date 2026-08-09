use std::{
    env,
    net::{IpAddr, SocketAddr},
    path::PathBuf,
    time::Duration,
};

use serde::Serialize;

use crate::error::AppError;

#[derive(Clone, Debug)]
pub struct Config {
    pub host: IpAddr,
    pub port: u16,
    pub models_dir: PathBuf,
    pub execution_provider: ExecutionProviderPreference,
    pub allowed_origins: Vec<String>,
    pub max_image_bytes: usize,
    pub max_image_pixels: u64,
    pub inference: InferenceConfig,
    pub llm: Option<LlmConfig>,
}

#[derive(Clone, Debug)]
pub enum InferenceConfig {
    Local,
    Remote(RemoteInferenceConfig),
}

#[derive(Clone, Debug)]
pub struct RemoteInferenceConfig {
    pub biomedclip_url: String,
    pub convnext_url: String,
    pub xgboost_url: String,
    pub unet_url: String,
    pub timeout: Duration,
}

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ExecutionProviderPreference {
    Auto,
    Cuda,
    Cpu,
}

#[derive(Clone, Debug)]
pub struct LlmConfig {
    pub provider: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub timeout: Duration,
    pub temperature: f32,
    pub max_tokens: u32,
}

impl Config {
    pub fn from_env() -> Result<Self, AppError> {
        let host = value("OVIA_HOST", "0.0.0.0")
            .parse()
            .map_err(|_| AppError::config("OVIA_HOST is invalid"))?;
        let port = value("OVIA_PORT", "8080")
            .parse()
            .map_err(|_| AppError::config("OVIA_PORT is invalid"))?;
        let execution_provider = match value("ORT_EXECUTION_PROVIDER", "auto")
            .to_ascii_lowercase()
            .as_str()
        {
            "auto" => ExecutionProviderPreference::Auto,
            "cuda" => ExecutionProviderPreference::Cuda,
            "cpu" => ExecutionProviderPreference::Cpu,
            _ => {
                return Err(AppError::config(
                    "ORT_EXECUTION_PROVIDER must be auto, cuda, or cpu",
                ));
            }
        };
        let allowed_origins = value(
            "CORS_ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        )
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .collect();
        let llm = llm_from_env()?;
        let inference = match value("OVIA_INFERENCE_MODE", "local")
            .to_ascii_lowercase()
            .as_str()
        {
            "local" => InferenceConfig::Local,
            "remote" => InferenceConfig::Remote(RemoteInferenceConfig {
                biomedclip_url: value("BIOMEDCLIP_WORKER_URL", "http://model-biomedclip:8091"),
                convnext_url: value("CONVNEXT_WORKER_URL", "http://model-convnext:8092"),
                xgboost_url: value("XGBOOST_WORKER_URL", "http://model-xgboost:8093"),
                unet_url: value("UNETPP_WORKER_URL", "http://model-unetpp:8094"),
                timeout: Duration::from_secs(parse("MODEL_WORKER_TIMEOUT_SECONDS", 45)?),
            }),
            _ => {
                return Err(AppError::config(
                    "OVIA_INFERENCE_MODE must be local or remote",
                ));
            }
        };
        Ok(Self {
            host,
            port,
            execution_provider,
            allowed_origins,
            llm,
            inference,
            models_dir: PathBuf::from(value("OVIA_MODELS_DIR", "models")),
            max_image_bytes: parse("MAX_IMAGE_BYTES", 15 * 1024 * 1024)?,
            max_image_pixels: parse("MAX_IMAGE_PIXELS", 24_000_000)?,
        })
    }

    pub fn bind_address(&self) -> SocketAddr {
        SocketAddr::new(self.host, self.port)
    }

    #[cfg(test)]
    pub fn for_tests(models_dir: PathBuf) -> Self {
        Self {
            host: "127.0.0.1".parse().unwrap(),
            port: 0,
            models_dir,
            execution_provider: ExecutionProviderPreference::Cpu,
            allowed_origins: vec!["http://localhost:5173".into()],
            max_image_bytes: 2_000_000,
            max_image_pixels: 2_000_000,
            llm: None,
            inference: InferenceConfig::Local,
        }
    }
}

fn llm_from_env() -> Result<Option<LlmConfig>, AppError> {
    let provider = value("LLM_PROVIDER", "disabled");
    if provider.eq_ignore_ascii_case("disabled") {
        return Ok(None);
    }
    if !provider.eq_ignore_ascii_case("featherless") {
        return Err(AppError::config(
            "LLM_PROVIDER must be featherless or disabled",
        ));
    }
    let required =
        |name: &str| env::var(name).map_err(|_| AppError::config(format!("{name} is required")));
    Ok(Some(LlmConfig {
        provider,
        base_url: required("LLM_BASE_URL")?,
        api_key: required("LLM_API_KEY")?,
        model: required("LLM_MODEL")?,
        timeout: Duration::from_secs(parse("LLM_TIMEOUT_SECONDS", 30)?),
        temperature: parse("LLM_TEMPERATURE", 0.1)?,
        max_tokens: parse("LLM_MAX_TOKENS", 700)?,
    }))
}

fn value(name: &str, default: &str) -> String {
    env::var(name).unwrap_or_else(|_| default.to_owned())
}
fn parse<T: std::str::FromStr>(name: &str, default: T) -> Result<T, AppError> {
    match env::var(name) {
        Ok(raw) => raw
            .parse()
            .map_err(|_| AppError::config(format!("{name} is invalid"))),
        Err(_) => Ok(default),
    }
}
