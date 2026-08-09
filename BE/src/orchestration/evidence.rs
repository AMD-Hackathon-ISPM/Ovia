use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use uuid::Uuid;

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ModelStatus {
    Success,
    Unavailable,
    InvalidInput,
    InferenceError,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct OviaEvidence {
    pub analysis_id: Uuid,
    pub image_models: ImageEvidence,
    pub clinical_model: ClinicalEvidence,
    pub segmentation: SegmentationEvidence,
    pub quality: QualityEvidence,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ImageEvidence {
    pub biomedclip: ImageModelEvidence,
    pub convnext_tiny: ImageModelEvidence,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ImageModelEvidence {
    pub model_id: String,
    pub model_version: String,
    pub task: String,
    pub status: ModelStatus,
    pub duration_ms: Option<f64>,
    pub raw_logit: Option<f32>,
    pub probability: Option<f32>,
    pub decision_threshold: Option<f32>,
    pub threshold_met: Option<bool>,
    pub predicted_label: Option<String>,
    pub class_probabilities: BTreeMap<String, f32>,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ClinicalEvidence {
    pub model_id: String,
    pub model_version: String,
    pub task: String,
    pub status: ModelStatus,
    pub duration_ms: Option<f64>,
    pub supplied_feature_count: usize,
    pub raw_probability: Option<f32>,
    pub calibrated_probability: Option<f32>,
    pub screening_threshold: f32,
    pub screening_threshold_met: Option<bool>,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct BoundingBox {
    pub x_min: u32,
    pub y_min: u32,
    pub x_max: u32,
    pub y_max: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct SegmentationEvidence {
    pub model_id: String,
    pub model_version: String,
    pub status: ModelStatus,
    pub duration_ms: Option<f64>,
    pub segmentation_available: bool,
    pub mask_width: Option<u32>,
    pub mask_height: Option<u32>,
    pub foreground_fraction: Option<f32>,
    pub bounding_box: Option<BoundingBox>,
    pub connected_component_count: Option<u32>,
    pub mask_png_data_url: Option<String>,
    pub threshold: f32,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct QualityEvidence {
    pub image_supplied: bool,
    pub image_decoded: bool,
    pub original_width: Option<u32>,
    pub original_height: Option<u32>,
    pub clinical_fields_supplied: usize,
}

impl ImageModelEvidence {
    pub fn unavailable(
        model_id: impl Into<String>,
        version: String,
        task: impl Into<String>,
        status: ModelStatus,
        warning: String,
    ) -> Self {
        Self {
            model_id: model_id.into(),
            model_version: version,
            task: task.into(),
            status,
            duration_ms: None,
            raw_logit: None,
            probability: None,
            decision_threshold: None,
            threshold_met: None,
            predicted_label: None,
            class_probabilities: BTreeMap::new(),
            warnings: vec![warning],
        }
    }
}
