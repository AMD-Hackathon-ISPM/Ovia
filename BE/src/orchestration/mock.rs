use super::{
    evidence::OviaEvidence,
    llm::{
        DISCLAIMER, LlmError, LlmProvider, NarrativeDraft, OrchestrationResult,
        OrchestrationStatus, fallback, validate_draft,
    },
};
use async_trait::async_trait;
use std::{collections::VecDeque, sync::Mutex};

pub struct MockLlm {
    responses: Mutex<VecDeque<Result<NarrativeDraft, LlmError>>>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::orchestration::{evidence::*, llm::OrchestrationStatus};
    fn evidence() -> OviaEvidence {
        OviaEvidence {
            analysis_id: uuid::Uuid::new_v4(),
            image_models: ImageEvidence {
                biomedclip: ImageModelEvidence::unavailable(
                    "biomedclip_pcos_morphology",
                    "v".into(),
                    "task",
                    ModelStatus::Unavailable,
                    "missing".into(),
                ),
                convnext_tiny: ImageModelEvidence::unavailable(
                    "convnext_tiny_ovarian_appearance",
                    "v".into(),
                    "task",
                    ModelStatus::Unavailable,
                    "missing".into(),
                ),
            },
            clinical_model: ClinicalEvidence {
                model_id: "xgboost_clinical_fusion",
                model_version: "v".into(),
                task: "task",
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
                model_version: "v".into(),
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
                image_supplied: false,
                image_decoded: false,
                original_width: None,
                original_height: None,
                clinical_fields_supplied: 0,
            },
            warnings: vec![],
        }
    }
    #[tokio::test]
    async fn timeout_and_http_failure_use_deterministic_fallback() {
        for error in [
            LlmError::Unavailable("timeout".into()),
            LlmError::Unavailable("http failure".into()),
        ] {
            let mock = MockLlm::new(vec![Err(error)]);
            let result = mock.orchestrate(&evidence()).await.unwrap();
            assert_eq!(result.status, OrchestrationStatus::Unavailable);
            assert!(result.summary.is_none())
        }
    }
}
impl MockLlm {
    pub fn new(responses: Vec<Result<NarrativeDraft, LlmError>>) -> Self {
        Self {
            responses: Mutex::new(responses.into()),
        }
    }
}
#[async_trait]
impl LlmProvider for MockLlm {
    async fn orchestrate(&self, e: &OviaEvidence) -> Result<OrchestrationResult, LlmError> {
        let next = self
            .responses
            .lock()
            .unwrap()
            .pop_front()
            .unwrap_or_else(|| Err(LlmError::Unavailable("mock exhausted".into())));
        match next {
            Ok(d) => match validate_draft(&d, e) {
                Ok(()) => Ok(OrchestrationResult {
                    status: OrchestrationStatus::Success,
                    provider: "mock".into(),
                    model: Some("mock-structured".into()),
                    summary: Some(d.summary),
                    evidence: d.evidence,
                    agreement: d.agreement,
                    limitations: d.limitations,
                    recommended_next_step: d.recommended_next_step,
                    disclaimer: DISCLAIMER,
                    duration_ms: Some(0.0),
                    warnings: vec![],
                }),
                Err(err) => Ok(fallback(
                    e,
                    err.to_string(),
                    OrchestrationStatus::InvalidResponse,
                )),
            },
            Err(err) => Ok(fallback(
                e,
                err.to_string(),
                OrchestrationStatus::Unavailable,
            )),
        }
    }
    fn configured(&self) -> bool {
        true
    }
    fn provider_name(&self) -> &'static str {
        "mock"
    }
    fn model_name(&self) -> Option<&str> {
        Some("mock-structured")
    }
}
