use reqwest::Client;
use serde::Deserialize;

use crate::{
    config::RemoteInferenceConfig,
    contracts::request::ClinicalInput,
    error::AppError,
    inference::{BIOMED_ID, CONVNEXT_ID, LoadedModelInfo, UNET_ID, XGBOOST_ID},
    orchestration::evidence::{ClinicalEvidence, ImageModelEvidence, SegmentationEvidence},
};

#[derive(Debug, Deserialize)]
struct WorkerHealth {
    manifest_version: String,
    model: LoadedModelInfo,
}

pub struct RemoteInference {
    client: Client,
    biomedclip_url: String,
    convnext_url: String,
    xgboost_url: String,
    unet_url: String,
    manifest_version: String,
    models: Vec<LoadedModelInfo>,
}

impl RemoteInference {
    pub async fn connect(config: &RemoteInferenceConfig) -> anyhow::Result<Self> {
        let client = Client::builder()
            .connect_timeout(std::time::Duration::from_secs(5))
            .timeout(config.timeout)
            .build()?;
        let urls = [
            (BIOMED_ID, normalize(&config.biomedclip_url)),
            (CONVNEXT_ID, normalize(&config.convnext_url)),
            (XGBOOST_ID, normalize(&config.xgboost_url)),
            (UNET_ID, normalize(&config.unet_url)),
        ];
        let mut models = Vec::with_capacity(urls.len());
        let mut manifest_version = None;
        for (expected_id, url) in &urls {
            let health = client
                .get(format!("{url}/internal/health"))
                .send()
                .await?
                .error_for_status()?
                .json::<WorkerHealth>()
                .await?;
            if health.model.model_id != *expected_id {
                anyhow::bail!(
                    "worker at {url} serves {}, expected {expected_id}",
                    health.model.model_id
                );
            }
            if manifest_version
                .as_ref()
                .is_some_and(|version| version != &health.manifest_version)
            {
                anyhow::bail!("model workers use different manifest versions");
            }
            manifest_version = Some(health.manifest_version);
            models.push(health.model);
        }
        tracing::info!(workers = models.len(), "remote inference workers connected");
        Ok(Self {
            client,
            biomedclip_url: urls[0].1.clone(),
            convnext_url: urls[1].1.clone(),
            xgboost_url: urls[2].1.clone(),
            unet_url: urls[3].1.clone(),
            manifest_version: manifest_version.unwrap_or_else(|| "unavailable".into()),
            models,
        })
    }

    pub fn manifest_version(&self) -> &str {
        &self.manifest_version
    }

    pub fn model_infos(&self) -> Vec<LoadedModelInfo> {
        self.models.clone()
    }

    pub fn model_version(&self, id: &str) -> String {
        self.models
            .iter()
            .find(|model| model.model_id == id)
            .map(|model| model.model_version.clone())
            .unwrap_or_else(|| "unavailable".into())
    }

    pub async fn biomedclip(&self, image: Vec<u8>) -> Result<ImageModelEvidence, AppError> {
        self.post_image(&self.biomedclip_url, image).await
    }

    pub async fn convnext(&self, image: Vec<u8>) -> Result<ImageModelEvidence, AppError> {
        self.post_image(&self.convnext_url, image).await
    }

    pub async fn unet(&self, image: Vec<u8>) -> Result<SegmentationEvidence, AppError> {
        self.post_image(&self.unet_url, image).await
    }

    pub async fn xgboost(&self, input: ClinicalInput) -> Result<ClinicalEvidence, AppError> {
        self.client
            .post(format!("{}/internal/infer/clinical", self.xgboost_url))
            .json(&input)
            .send()
            .await
            .map_err(remote_error)?
            .error_for_status()
            .map_err(remote_error)?
            .json()
            .await
            .map_err(remote_error)
    }

    async fn post_image<T: serde::de::DeserializeOwned>(
        &self,
        url: &str,
        image: Vec<u8>,
    ) -> Result<T, AppError> {
        self.client
            .post(format!("{url}/internal/infer/image"))
            .header(reqwest::header::CONTENT_TYPE, "application/octet-stream")
            .body(image)
            .send()
            .await
            .map_err(remote_error)?
            .error_for_status()
            .map_err(remote_error)?
            .json()
            .await
            .map_err(remote_error)
    }
}

fn normalize(url: &str) -> String {
    url.trim_end_matches('/').to_owned()
}

fn remote_error(error: reqwest::Error) -> AppError {
    tracing::warn!(%error, "model worker request failed");
    AppError::inference("isolated model worker was unavailable or timed out")
}
