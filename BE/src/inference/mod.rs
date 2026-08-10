use std::{
    collections::BTreeMap,
    fs,
    path::{Component, Path, PathBuf},
    sync::Mutex,
};

#[cfg(feature = "cuda")]
use ort::ep;
use ort::{
    session::Session,
    value::{Outlet, Tensor, TensorElementType},
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::{
    config::{Config, ExecutionProviderPreference},
    error::AppError,
    preprocessing::clinical::ClinicalPreprocessor,
};

pub const BIOMED_ID: &str = "biomedclip_pcos_morphology";
pub const CONVNEXT_ID: &str = "convnext_tiny_ovarian_appearance";
pub const XGBOOST_ID: &str = "xgboost_clinical_fusion";
pub const UNET_ID: &str = "unetpp_ovarian_lesion_segmentation";

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ModelManifest {
    pub manifest_version: String,
    pub models: Vec<ModelEntry>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ModelEntry {
    pub model_id: String,
    pub model_family: String,
    pub filename: String,
    pub sha256: String,
    pub task: String,
    pub model_version: String,
    pub source_pipeline: String,
    pub metadata_file: String,
    pub input_contract: serde_json::Value,
    pub output_contract: serde_json::Value,
}

#[derive(Clone, Debug, Serialize)]
pub struct LoadedModelInfo {
    pub model_id: String,
    pub model_family: String,
    pub model_version: String,
    pub task: String,
    pub sha256: String,
    pub execution_provider: String,
    pub input_names: Vec<String>,
    pub output_names: Vec<String>,
    pub ready: bool,
}

struct ModelSession {
    entry: ModelEntry,
    session: Mutex<Session>,
    provider: String,
    input_names: Vec<String>,
    output_names: Vec<String>,
}

pub struct ModelRegistry {
    manifest_version: String,
    sessions: BTreeMap<String, ModelSession>,
    pub clinical_preprocessor: ClinicalPreprocessor,
}

impl ModelRegistry {
    pub async fn load(config: &Config) -> anyhow::Result<Self> {
        let manifest_path = config.models_dir.join("manifest.json");
        let manifest: ModelManifest = serde_json::from_slice(&fs::read(&manifest_path)?)?;
        validate_manifest(&manifest, &config.models_dir)?;

        let mut sessions = BTreeMap::new();
        for entry in &manifest.models {
            let path = safe_child(&config.models_dir, &entry.filename)?;
            let (session, provider) = create_session(
                &path,
                config.execution_provider,
                entry.model_id != XGBOOST_ID,
            )?;
            let input_names = session
                .inputs()
                .iter()
                .map(|v| v.name().to_owned())
                .collect::<Vec<_>>();
            let output_names = session
                .outputs()
                .iter()
                .map(|v| v.name().to_owned())
                .collect::<Vec<_>>();
            validate_signature(entry, session.inputs(), session.outputs())?;
            tracing::info!(model_id=%entry.model_id, model_version=%entry.model_version, execution_provider=%provider, "model loaded");
            sessions.insert(
                entry.model_id.clone(),
                ModelSession {
                    entry: entry.clone(),
                    session: Mutex::new(session),
                    provider,
                    input_names,
                    output_names,
                },
            );
        }
        let clinical_preprocessor =
            ClinicalPreprocessor::load(&config.models_dir.join("metadata/xgboost.json"))?;
        let registry = Self {
            manifest_version: manifest.manifest_version,
            sessions,
            clinical_preprocessor,
        };
        registry.warm()?;
        Ok(registry)
    }

    pub fn manifest_version(&self) -> &str {
        &self.manifest_version
    }

    pub fn model_version(&self, id: &str) -> String {
        self.sessions
            .get(id)
            .map(|m| m.entry.model_version.clone())
            .unwrap_or_else(|| "unavailable".into())
    }

    pub fn model_infos(&self) -> Vec<LoadedModelInfo> {
        self.sessions
            .values()
            .map(|m| LoadedModelInfo {
                model_id: m.entry.model_id.clone(),
                model_family: m.entry.model_family.clone(),
                model_version: m.entry.model_version.clone(),
                task: m.entry.task.clone(),
                sha256: m.entry.sha256.clone(),
                execution_provider: m.provider.clone(),
                input_names: m.input_names.clone(),
                output_names: m.output_names.clone(),
                ready: true,
            })
            .collect()
    }

    fn warm(&self) -> Result<(), AppError> {
        self.run_biomedclip(vec![0.0; 3 * 224 * 224])?;
        self.run_convnext(vec![0.0; 3 * 224 * 224])?;
        self.run_xgboost(vec![0.0; 68])?;
        self.run_unet(vec![0.0; 3 * 512 * 512])?;
        tracing::info!(models = 4, "model warmup completed");
        Ok(())
    }

    pub fn run_biomedclip(&self, input: Vec<f32>) -> Result<f32, AppError> {
        let out = self.run(BIOMED_ID, "image", vec![1, 3, 224, 224], input, "logit")?;
        out.first()
            .copied()
            .ok_or_else(|| AppError::inference("BiomedCLIP returned an empty tensor"))
    }

    pub fn run_convnext(&self, input: Vec<f32>) -> Result<Vec<f32>, AppError> {
        let out = self.run(CONVNEXT_ID, "image", vec![1, 3, 224, 224], input, "logits")?;
        if out.len() != 5 {
            return Err(AppError::inference(
                "ConvNeXt returned an unexpected tensor length",
            ));
        }
        Ok(out)
    }

    pub fn run_xgboost(&self, input: Vec<f32>) -> Result<f32, AppError> {
        if input.len() != 68 {
            return Err(AppError::inference("XGBoost requires exactly 68 features"));
        }
        let out = self.run(XGBOOST_ID, "features", vec![1, 68], input, "probabilities")?;
        out.get(1)
            .copied()
            .ok_or_else(|| AppError::inference("XGBoost returned an invalid probability tensor"))
    }

    pub fn run_unet(&self, input: Vec<f32>) -> Result<Vec<f32>, AppError> {
        let out = self.run(UNET_ID, "image", vec![1, 3, 512, 512], input, "logits")?;
        if out.len() != 512 * 512 {
            return Err(AppError::inference(
                "U-Net++ returned an unexpected tensor length",
            ));
        }
        Ok(out)
    }

    fn run(
        &self,
        model_id: &str,
        input_name: &str,
        shape: Vec<i64>,
        data: Vec<f32>,
        output_name: &str,
    ) -> Result<Vec<f32>, AppError> {
        let model = self
            .sessions
            .get(model_id)
            .ok_or_else(|| AppError::inference(format!("model {model_id} is not loaded")))?;
        let tensor = Tensor::<f32>::from_array((shape, data))
            .map_err(|e| AppError::inference(format!("tensor creation failed: {e}")))?;
        let mut session = model
            .session
            .lock()
            .map_err(|_| AppError::inference("model session lock was poisoned"))?;
        let outputs = session
            .run(ort::inputs![input_name => tensor])
            .map_err(|e| AppError::inference(format!("{model_id} inference failed: {e}")))?;
        let (_, values) = outputs[output_name]
            .try_extract_tensor::<f32>()
            .map_err(|e| {
                AppError::inference(format!("{model_id} output extraction failed: {e}"))
            })?;
        Ok(values.to_vec())
    }
}

fn validate_manifest(manifest: &ModelManifest, models_dir: &Path) -> anyhow::Result<()> {
    if manifest.models.len() != 4 {
        anyhow::bail!("model manifest must contain exactly four models");
    }
    for id in [BIOMED_ID, CONVNEXT_ID, XGBOOST_ID, UNET_ID] {
        if manifest.models.iter().filter(|m| m.model_id == id).count() != 1 {
            anyhow::bail!("manifest must contain model {id} exactly once");
        }
    }
    for model in &manifest.models {
        let path = safe_child(models_dir, &model.filename)?;
        let actual = sha256_file(&path)?;
        if !actual.eq_ignore_ascii_case(&model.sha256) {
            anyhow::bail!(
                "SHA-256 mismatch for {}: expected {}, received {}",
                model.model_id,
                model.sha256,
                actual
            );
        }
        let metadata = safe_child(models_dir, &model.metadata_file)?;
        if !metadata.is_file() {
            anyhow::bail!("metadata missing for {}", model.model_id);
        }
    }
    Ok(())
}

fn safe_child(root: &Path, relative: &str) -> anyhow::Result<PathBuf> {
    let rel = Path::new(relative);
    if rel.is_absolute() || rel.components().any(|c| !matches!(c, Component::Normal(_))) {
        anyhow::bail!("manifest path is not a safe relative path: {relative}");
    }
    Ok(root.join(rel))
}

fn sha256_file(path: &Path) -> anyhow::Result<String> {
    let mut hasher = Sha256::new();
    let mut file = fs::File::open(path)?;
    std::io::copy(&mut file, &mut hasher)?;
    Ok(hex::encode(hasher.finalize()))
}

fn create_session(
    path: &Path,
    preference: ExecutionProviderPreference,
    allow_cuda: bool,
) -> anyhow::Result<(Session, String)> {
    if allow_cuda && preference != ExecutionProviderPreference::Cpu {
        #[cfg(feature = "cuda")]
        {
            let attempted = Session::builder().and_then(|mut builder| {
                builder = builder
                    .with_execution_providers([ep::CUDA::default().build().error_on_failure()])?;
                builder.commit_from_file(path)
            });
            match attempted {
                Ok(session) => return Ok((session, "cuda".into())),
                Err(error) if preference == ExecutionProviderPreference::Cuda => anyhow::bail!(
                    "CUDA was required but model {} could not load: {error}",
                    path.display()
                ),
                Err(error) => {
                    tracing::warn!(model=%path.display(), %error, "CUDA unavailable; using CPU")
                }
            }
        }
        #[cfg(not(feature = "cuda"))]
        {
            if preference == ExecutionProviderPreference::Cuda {
                anyhow::bail!(
                    "CUDA was required, but this binary was built without the cuda Cargo feature"
                );
            }
            tracing::info!(model=%path.display(), "CUDA support is not compiled in; using CPU");
        }
    }
    Ok((Session::builder()?.commit_from_file(path)?, "cpu".into()))
}

fn validate_signature(
    entry: &ModelEntry,
    inputs: &[Outlet],
    outputs: &[Outlet],
) -> anyhow::Result<()> {
    let expected_input = entry
        .input_contract
        .get("name")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| anyhow::anyhow!("input name missing in manifest"))?;
    let input = inputs.iter().find(|outlet| outlet.name() == expected_input);
    if input.is_none() {
        anyhow::bail!("{} is missing input {expected_input}", entry.model_id);
    }
    let input = input.unwrap();
    if entry
        .input_contract
        .get("dtype")
        .and_then(serde_json::Value::as_str)
        == Some("float32")
        && input.dtype().tensor_type() != Some(TensorElementType::Float32)
    {
        anyhow::bail!("{} input {expected_input} is not float32", entry.model_id)
    }
    validate_shape(
        &entry.model_id,
        expected_input,
        input,
        &entry.input_contract["shape"],
    )?;
    let expected = entry
        .output_contract
        .get("name")
        .and_then(serde_json::Value::as_str)
        .map(|s| vec![s])
        .or_else(|| {
            entry
                .output_contract
                .get("names")
                .and_then(serde_json::Value::as_array)
                .map(|a| a.iter().filter_map(serde_json::Value::as_str).collect())
        })
        .unwrap_or_default();
    for name in expected {
        let Some(output) = outputs.iter().find(|outlet| outlet.name() == name) else {
            anyhow::bail!("{} is missing output {name}", entry.model_id);
        };
        let shape = if name == "probabilities" {
            entry.output_contract.get("probabilities_shape")
        } else {
            entry.output_contract.get("shape")
        };
        if let Some(shape) = shape {
            validate_shape(&entry.model_id, name, output, shape)?;
        }
        if name != "label" && output.dtype().tensor_type() != Some(TensorElementType::Float32) {
            anyhow::bail!("{} output {name} is not float32", entry.model_id);
        }
    }
    Ok(())
}

fn validate_shape(
    model_id: &str,
    name: &str,
    outlet: &Outlet,
    expected: &serde_json::Value,
) -> anyhow::Result<()> {
    let declared = expected
        .as_array()
        .ok_or_else(|| anyhow::anyhow!("{model_id} {name} shape missing from manifest"))?;
    let actual = outlet
        .dtype()
        .tensor_shape()
        .ok_or_else(|| anyhow::anyhow!("{model_id} {name} is not a tensor"))?;
    if actual.len() != declared.len() {
        anyhow::bail!(
            "{model_id} {name} rank mismatch: declared {}, actual {}",
            declared.len(),
            actual.len()
        )
    }
    for (index, (want, got)) in declared.iter().zip(actual.iter()).enumerate() {
        if let Some(want) = want.as_i64() {
            if want != *got {
                anyhow::bail!(
                    "{model_id} {name} dimension {index} mismatch: declared {want}, actual {got}"
                )
            }
        } else if !want.is_string() {
            anyhow::bail!("{model_id} {name} dimension {index} is invalid in manifest")
        }
    }
    Ok(())
}
