pub mod api;
pub mod config;
pub mod contracts;
pub mod error;
pub mod inference;
pub mod orchestration;
pub mod preprocessing;

use std::sync::Arc;

use axum::Router;
use config::Config;
use inference::ModelRegistry;
use orchestration::llm::{DisabledLlm, LlmProvider};

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub models: Arc<ModelRegistry>,
    pub llm: Arc<dyn LlmProvider>,
}

pub async fn build_state(config: Config) -> anyhow::Result<AppState> {
    let models = Arc::new(ModelRegistry::load(&config).await?);
    let llm: Arc<dyn LlmProvider> = match config.llm.clone() {
        Some(llm) if llm.provider.eq_ignore_ascii_case("featherless") => Arc::new(
            orchestration::featherless::OpenAiCompatibleProvider::new(llm)?,
        ),
        _ => Arc::new(DisabledLlm),
    };
    Ok(AppState {
        config: Arc::new(config),
        models,
        llm,
    })
}

pub fn router(state: AppState) -> Router {
    api::router(state)
}
