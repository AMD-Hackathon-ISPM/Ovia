use crate::orchestration::evidence::OviaEvidence;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

pub const DISCLAIMER: &str = "Investigational screening support only; not a diagnosis. Model evidence requires clinician review.";

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct NarrativeEvidence {
    pub source: String,
    pub finding: String,
    pub importance: String,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Agreement {
    pub status: AgreementStatus,
    pub explanation: String,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AgreementStatus {
    Concordant,
    Mixed,
    Insufficient,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NarrativeDraft {
    pub summary: String,
    pub evidence: Vec<NarrativeEvidence>,
    pub agreement: Agreement,
    pub limitations: Vec<String>,
    pub recommended_next_step: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct OrchestrationResult {
    pub status: OrchestrationStatus,
    pub provider: String,
    pub model: Option<String>,
    pub summary: Option<String>,
    pub evidence: Vec<NarrativeEvidence>,
    pub agreement: Agreement,
    pub limitations: Vec<String>,
    pub recommended_next_step: String,
    pub disclaimer: &'static str,
    pub duration_ms: Option<f64>,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OrchestrationStatus {
    Success,
    Unavailable,
    InvalidResponse,
}

#[derive(Debug, thiserror::Error)]
pub enum LlmError {
    #[error("provider unavailable: {0}")]
    Unavailable(String),
    #[error("invalid response: {0}")]
    Invalid(String),
}

#[async_trait]
pub trait LlmProvider: Send + Sync {
    async fn orchestrate(&self, evidence: &OviaEvidence) -> Result<OrchestrationResult, LlmError>;
    fn configured(&self) -> bool;
    fn provider_name(&self) -> &'static str;
    fn model_name(&self) -> Option<&str>;
}

pub struct DisabledLlm;
#[async_trait]
impl LlmProvider for DisabledLlm {
    async fn orchestrate(&self, evidence: &OviaEvidence) -> Result<OrchestrationResult, LlmError> {
        Ok(fallback(
            evidence,
            "LLM orchestration is not configured".into(),
            OrchestrationStatus::Unavailable,
        ))
    }
    fn configured(&self) -> bool {
        false
    }
    fn provider_name(&self) -> &'static str {
        "disabled"
    }
    fn model_name(&self) -> Option<&str> {
        None
    }
}

pub fn fallback(
    evidence: &OviaEvidence,
    warning: String,
    status: OrchestrationStatus,
) -> OrchestrationResult {
    let available = available_sources(evidence);
    OrchestrationResult {
        status,
        provider: "deterministic_fallback".into(),
        model: None,
        summary: None,
        evidence: vec![],
        agreement: Agreement {
            status: if available.len() < 2 {
                AgreementStatus::Insufficient
            } else {
                AgreementStatus::Mixed
            },
            explanation: "Deterministic evidence is returned without LLM interpretation.".into(),
        },
        limitations: vec![
            "Narrative orchestration is unavailable; model evidence remains authoritative.".into(),
        ],
        recommended_next_step: "Review these screening-support outputs with a qualified clinician."
            .into(),
        disclaimer: DISCLAIMER,
        duration_ms: None,
        warnings: vec![warning],
    }
}

pub fn available_sources(e: &OviaEvidence) -> Vec<&'static str> {
    use super::evidence::ModelStatus::Success;
    let mut v = vec![];
    if e.image_models.biomedclip.status == Success {
        v.push("biomedclip_pcos_morphology")
    }
    if e.image_models.convnext_tiny.status == Success {
        v.push("convnext_tiny_ovarian_appearance")
    }
    if e.clinical_model.status == Success {
        v.push("xgboost_clinical_fusion")
    }
    if e.segmentation.status == Success {
        v.push("unetpp_ovarian_lesion_segmentation")
    }
    v
}

pub fn validate_draft(draft: &NarrativeDraft, evidence: &OviaEvidence) -> Result<(), LlmError> {
    let allowed = available_sources(evidence);
    for item in &draft.evidence {
        if !allowed.contains(&item.source.as_str()) {
            return Err(LlmError::Invalid(format!(
                "unavailable or unknown source {}",
                item.source
            )));
        }
    }
    let text = std::iter::once(draft.summary.as_str())
        .chain(
            draft
                .evidence
                .iter()
                .flat_map(|x| [x.finding.as_str(), x.importance.as_str()]),
        )
        .chain(std::iter::once(draft.agreement.explanation.as_str()))
        .chain(draft.limitations.iter().map(String::as_str))
        .chain(std::iter::once(draft.recommended_next_step.as_str()));
    for value in text {
        let lower = value.to_ascii_lowercase();
        if value.chars().any(|c| c.is_ascii_digit()) {
            return Err(LlmError::Invalid(
                "LLM narrative must not generate numeric values".into(),
            ));
        }
        if [
            "histopatholog",
            "confirmed cancer",
            "cancer region",
            "o-rads",
        ]
        .iter()
        .any(|p| lower.contains(p))
        {
            return Err(LlmError::Invalid("prohibited clinical claim".into()));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::orchestration::evidence::*;
    use std::collections::BTreeMap;

    fn evidence() -> OviaEvidence {
        OviaEvidence {
            analysis_id: uuid::Uuid::new_v4(),
            image_models: ImageEvidence {
                biomedclip: ImageModelEvidence {
                    model_id: "biomedclip_pcos_morphology",
                    model_version: "test".into(),
                    task: "morphology",
                    status: ModelStatus::Success,
                    duration_ms: None,
                    raw_logit: Some(0.0),
                    probability: Some(0.5),
                    decision_threshold: Some(0.1),
                    threshold_met: Some(true),
                    predicted_label: Some("VISIBLE".into()),
                    class_probabilities: BTreeMap::new(),
                    warnings: vec![],
                },
                convnext_tiny: ImageModelEvidence::unavailable(
                    "convnext_tiny_ovarian_appearance",
                    "test".into(),
                    "appearance",
                    ModelStatus::Unavailable,
                    "missing".into(),
                ),
            },
            clinical_model: ClinicalEvidence {
                model_id: "xgboost_clinical_fusion",
                model_version: "test".into(),
                task: "clinical",
                status: ModelStatus::Unavailable,
                duration_ms: None,
                supplied_feature_count: 0,
                raw_probability: None,
                calibrated_probability: None,
                screening_threshold: 0.1,
                screening_threshold_met: None,
                warnings: vec![],
            },
            segmentation: SegmentationEvidence {
                model_id: "unetpp_ovarian_lesion_segmentation",
                model_version: "test".into(),
                status: ModelStatus::Unavailable,
                duration_ms: None,
                segmentation_available: false,
                mask_width: None,
                mask_height: None,
                foreground_fraction: None,
                bounding_box: None,
                connected_component_count: None,
                mask_png_data_url: None,
                threshold: 0.3,
                warnings: vec![],
            },
            quality: QualityEvidence {
                image_supplied: true,
                image_decoded: true,
                original_width: Some(20),
                original_height: Some(10),
                clinical_fields_supplied: 0,
            },
            warnings: vec![],
        }
    }
    fn draft(source: &str) -> NarrativeDraft {
        NarrativeDraft {
            summary: "Image morphology evidence is available.".into(),
            evidence: vec![NarrativeEvidence {
                source: source.into(),
                finding: "The morphology signal crossed its configured screening threshold.".into(),
                importance:
                    "A clinician should interpret this alongside history and imaging quality."
                        .into(),
            }],
            agreement: Agreement {
                status: AgreementStatus::Insufficient,
                explanation: "Only one relevant source is available.".into(),
            },
            limitations: vec!["Other evidence sources are unavailable.".into()],
            recommended_next_step: "Review the screening output with a qualified clinician.".into(),
        }
    }

    #[test]
    fn accepts_available_source() {
        assert!(validate_draft(&draft("biomedclip_pcos_morphology"), &evidence()).is_ok())
    }
    #[test]
    fn rejects_unavailable_or_invented_source() {
        assert!(validate_draft(&draft("convnext_tiny_ovarian_appearance"), &evidence()).is_err());
        assert!(validate_draft(&draft("invented_model"), &evidence()).is_err())
    }
    #[test]
    fn rejects_numeric_and_prohibited_claims() {
        let mut d = draft("biomedclip_pcos_morphology");
        d.summary = "Probability is 50 percent.".into();
        assert!(validate_draft(&d, &evidence()).is_err());
        let mut d = draft("biomedclip_pcos_morphology");
        d.summary = "This is confirmed cancer.".into();
        assert!(validate_draft(&d, &evidence()).is_err())
    }
    #[test]
    fn malformed_json_never_becomes_a_draft() {
        assert!(serde_json::from_str::<NarrativeDraft>("not json").is_err());
        assert!(serde_json::from_str::<NarrativeDraft>("{\"summary\":\"partial\"}").is_err())
    }
}
