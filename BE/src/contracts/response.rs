use crate::orchestration::{evidence::OviaEvidence, llm::OrchestrationResult};
use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
pub struct AnalyzeResponse {
    pub contract_version: &'static str,
    pub request_id: String,
    pub analysis_id: uuid::Uuid,
    pub panels: Panels,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub inspection: Vec<InspectionRegion>,
    pub evidence: OviaEvidence,
    pub orchestration: OrchestrationResult,
}

#[derive(Clone, Debug, Serialize)]
pub struct Panels {
    pub pcos: Panel,
    pub ovarian_cyst: Panel,
    pub ovarian_tumor: Panel,
}

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum Panel {
    Success { result: ConditionResult },
    NotScreened { reason: &'static str },
    Unavailable { code: &'static str },
}

#[derive(Clone, Debug, Serialize)]
pub struct ConditionResult {
    pub condition: &'static str,
    pub signal_source: &'static str,
    pub band: Option<&'static str>,
    pub value: Option<f32>,
    pub model_version: String,
    pub calibration_status: &'static str,
}

#[derive(Clone, Debug, Serialize)]
pub struct InspectionRegion {
    pub id: String,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}
