use ovia_backend::{build_state, config::Config, router};
use tracing::info;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();
    let config = Config::from_env()?;
    let address = config.bind_address();
    let state = build_state(config).await?;
    let listener = tokio::net::TcpListener::bind(address).await?;
    info!(%address, "Ovia backend listening");
    axum::serve(listener, router(state)).await?;
    Ok(())
}
