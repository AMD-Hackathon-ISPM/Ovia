pub mod api;
pub mod config;
pub mod contracts;
pub mod error;
pub mod inference;
pub mod orchestration;
pub mod preprocessing;

use std::sync::Arc;

use axum::Router;
use config::{Config, InferenceConfig};
use inference::{LoadedModelInfo, ModelRegistry, remote::RemoteInference};
use orchestration::llm::{DisabledLlm, LlmProvider};

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub inference: InferenceBackend,
    pub llm: Arc<dyn LlmProvider>,
}

#[derive(Clone)]
pub enum InferenceBackend {
    Local(Arc<ModelRegistry>),
    Remote(Arc<RemoteInference>),
}

impl InferenceBackend {
    pub fn manifest_version(&self) -> &str {
        match self {
            Self::Local(models) => models.manifest_version(),
            Self::Remote(models) => models.manifest_version(),
        }
    }

    pub fn model_infos(&self) -> Vec<LoadedModelInfo> {
        match self {
            Self::Local(models) => models.model_infos(),
            Self::Remote(models) => models.model_infos(),
        }
    }

    pub fn model_version(&self, id: &str) -> String {
        match self {
            Self::Local(models) => models.model_version(id),
            Self::Remote(models) => models.model_version(id),
        }
    }
}

pub async fn build_state(config: Config) -> anyhow::Result<AppState> {
    let inference = match &config.inference {
        InferenceConfig::Local => {
            InferenceBackend::Local(Arc::new(ModelRegistry::load(&config).await?))
        }
        InferenceConfig::Remote(remote) => {
            InferenceBackend::Remote(Arc::new(RemoteInference::connect(remote).await?))
        }
    };
    let llm: Arc<dyn LlmProvider> = match config.llm.clone() {
        Some(llm) if llm.provider.eq_ignore_ascii_case("featherless") => Arc::new(
            orchestration::featherless::OpenAiCompatibleProvider::new(llm)?,
        ),
        _ => Arc::new(DisabledLlm),
    };
    Ok(AppState {
        config: Arc::new(config),
        inference,
        llm,
    })
}

pub fn router(state: AppState) -> Router {
    api::router(state)
}
