use std::{collections::BTreeMap, sync::Arc, time::Instant};

use axum::{
    Json,
    extract::{Multipart, State},
};
use serde::Serialize;
use uuid::Uuid;

use crate::{
    AppState,
    contracts::{
        request::SubmitPayload,
        response::{AnalyzeResponse, ConditionResult, InspectionRegion, Panel, Panels},
    },
    error::AppError,
    inference::{BIOMED_ID, CONVNEXT_ID, ModelRegistry, UNET_ID, XGBOOST_ID},
    orchestration::{
        evidence::{
            ClinicalEvidence, ImageEvidence, ImageModelEvidence, ModelStatus, OviaEvidence,
            QualityEvidence, SegmentationEvidence,
        },
        llm::{OrchestrationStatus, fallback},
        rules,
    },
    preprocessing::image::{
        DecodedImage, biomedclip_tensor, convnext_tensor, decode, reconstruct, unet_tensor,
    },
};

const BIOMED_THRESHOLD: f32 = 0.168_856_95;
const CONVNEXT_TEMPERATURE: f32 = 0.808_720_6;
const XGBOOST_THRESHOLD: f32 = 0.146_921_86;
const XGBOOST_PLATT_COEFFICIENT: f32 = 1.287_716_2;
const XGBOOST_PLATT_INTERCEPT: f32 = -0.467_193_04;
const UNET_THRESHOLD: f32 = 0.30;
const CLASS_NAMES: [&str; 5] = [
    "HEALTHY",
    "DOMINANT_FOLLICLE",
    "POLYCYSTIC_OVARY",
    "SIMPLE_CYST",
    "COMPLEX_CYST",
];

#[derive(Serialize)]
pub struct HealthResponse {
    status: &'static str,
    service: &'static str,
    contract_version: &'static str,
    manifest_version: String,
    models_ready: usize,
    onnxruntime_api: String,
    execution_providers: Vec<String>,
    llm_configured: bool,
}

pub async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    let infos = state.models.model_infos();
    let mut providers = infos
        .iter()
        .map(|model| model.execution_provider.clone())
        .collect::<Vec<_>>();
    providers.sort();
    providers.dedup();
    Json(HealthResponse {
        status: "ok",
        service: "ovia-backend",
        contract_version: "ovia-v1",
        manifest_version: state.models.manifest_version().into(),
        models_ready: infos.len(),
        onnxruntime_api: format!("1.{}.x (ort 2.0.0-rc.13)", ort::MINOR_VERSION),
        execution_providers: providers,
        llm_configured: state.llm.configured(),
    })
}

#[derive(Serialize)]
pub struct ModelsResponse {
    manifest_version: String,
    models: Vec<crate::inference::LoadedModelInfo>,
    llm: LlmInfo,
}
#[derive(Serialize)]
pub struct LlmInfo {
    configured: bool,
    provider: &'static str,
    model: Option<String>,
}
pub async fn models(State(state): State<AppState>) -> Json<ModelsResponse> {
    Json(ModelsResponse {
        manifest_version: state.models.manifest_version().into(),
        models: state.models.model_infos(),
        llm: LlmInfo {
            configured: state.llm.configured(),
            provider: state.llm.provider_name(),
            model: state.llm.model_name().map(str::to_owned),
        },
    })
}

pub async fn analyze(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Json<AnalyzeResponse>, AppError> {
    let request_started = Instant::now();
    let mut raw_payload = None;
    let mut image_bytes = None;
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| AppError::InvalidRequest("invalid multipart body".into()))?
    {
        match field.name() {
            Some("payload") => {
                if raw_payload.is_some() {
                    return Err(AppError::InvalidRequest(
                        "payload must be provided once".into(),
                    ));
                }
                raw_payload = Some(
                    field
                        .bytes()
                        .await
                        .map_err(|_| AppError::InvalidRequest("payload could not be read".into()))?
                        .to_vec(),
                );
            }
            Some("image") => {
                if image_bytes.is_some() {
                    return Err(AppError::InvalidRequest(
                        "image must be provided once".into(),
                    ));
                }
                let bytes = field
                    .bytes()
                    .await
                    .map_err(|_| AppError::InvalidRequest("image could not be read".into()))?;
                if bytes.len() > state.config.max_image_bytes {
                    return Err(AppError::InvalidImage(
                        "image exceeds the configured byte limit".into(),
                    ));
                }
                image_bytes = Some(bytes.to_vec());
            }
            _ => {
                return Err(AppError::InvalidRequest(
                    "multipart parts must be named payload or image".into(),
                ));
            }
        }
    }
    let payload: SubmitPayload = serde_json::from_slice(
        &raw_payload.ok_or_else(|| AppError::InvalidRequest("payload is required".into()))?,
    )?;
    payload.validate()?;
    if payload.image_attached != image_bytes.is_some() {
        return Err(AppError::InvalidRequest(
            "image_attached does not match the multipart image part".into(),
        ));
    }
    let analysis_id = Uuid::new_v4();
    let supplied = payload.answers.supplied_count();
    let decoded = match image_bytes.as_deref() {
        Some(bytes) => Some(decode(bytes, state.config.max_image_pixels)?),
        None => None,
    };

    let biomed_task = spawn_image_biomed(state.models.clone(), decoded.clone());
    let convnext_task = spawn_image_convnext(state.models.clone(), decoded.clone());
    let unet_task = spawn_image_unet(state.models.clone(), decoded.clone());
    let clinical_task = spawn_clinical(state.models.clone(), payload.answers.clone(), supplied);
    let (biomed, convnext, segmentation, clinical) =
        tokio::join!(biomed_task, convnext_task, unet_task, clinical_task);
    let mut evidence = OviaEvidence {
        analysis_id,
        image_models: ImageEvidence {
            biomedclip: biomed,
            convnext_tiny: convnext,
        },
        clinical_model: clinical,
        segmentation,
        quality: QualityEvidence {
            image_supplied: image_bytes.is_some(),
            image_decoded: decoded.is_some(),
            original_width: decoded.as_ref().map(|x| x.width),
            original_height: decoded.as_ref().map(|x| x.height),
            clinical_fields_supplied: supplied,
        },
        warnings: vec![],
    };
    rules::apply(&mut evidence);
    let orchestration = match state.llm.orchestrate(&evidence).await {
        Ok(value) => value,
        Err(error) => fallback(
            &evidence,
            error.to_string(),
            OrchestrationStatus::Unavailable,
        ),
    };
    let panels = legacy_panels(&evidence);
    let inspection = inspection_regions(&evidence);
    tracing::info!(%analysis_id,client_request_id=%payload.request_id,duration_ms=request_started.elapsed().as_secs_f64()*1000.0,image_supplied=evidence.quality.image_supplied,clinical_fields=supplied,"analysis completed");
    Ok(Json(AnalyzeResponse {
        contract_version: "ovia-v1",
        request_id: payload.request_id,
        analysis_id,
        panels,
        inspection,
        evidence,
        orchestration,
    }))
}

#[derive(Clone, Copy)]
enum ImageKind {
    Biomed,
    ConvNext,
    Unet,
}

async fn spawn_image(
    models: Arc<ModelRegistry>,
    decoded: Option<DecodedImage>,
    kind: ImageKind,
) -> ImageTaskOutput {
    let version = match kind {
        ImageKind::Biomed => models.model_version(BIOMED_ID),
        ImageKind::ConvNext => models.model_version(CONVNEXT_ID),
        ImageKind::Unet => models.model_version(UNET_ID),
    };
    let Some(image) = decoded else {
        return match kind {
            ImageKind::Biomed => ImageTaskOutput::Biomed(ImageModelEvidence::unavailable(
                BIOMED_ID,
                version,
                "ultrasound morphology screening",
                ModelStatus::Unavailable,
                "No ultrasound image was supplied.".into(),
            )),
            ImageKind::ConvNext => ImageTaskOutput::ConvNext(ImageModelEvidence::unavailable(
                CONVNEXT_ID,
                version,
                "ovarian ultrasound appearance classification",
                ModelStatus::Unavailable,
                "No ultrasound image was supplied.".into(),
            )),
            ImageKind::Unet => ImageTaskOutput::Unet(empty_segmentation(
                version,
                ModelStatus::Unavailable,
                "No ultrasound image was supplied.",
            )),
        };
    };
    let fallback_version = version.clone();
    match tokio::task::spawn_blocking(move || run_image(&models, &image, kind, version)).await {
        Ok(value) => value,
        Err(_) => {
            ImageTaskOutput::failed(kind, fallback_version, "inference worker did not complete")
        }
    }
}

enum ImageTaskOutput {
    Biomed(ImageModelEvidence),
    ConvNext(ImageModelEvidence),
    Unet(SegmentationEvidence),
}
impl ImageTaskOutput {
    fn failed(kind: ImageKind, version: String, reason: &str) -> Self {
        match kind {
            ImageKind::Biomed => Self::Biomed(ImageModelEvidence::unavailable(
                BIOMED_ID,
                version,
                "ultrasound morphology screening",
                ModelStatus::InferenceError,
                reason.into(),
            )),
            ImageKind::ConvNext => Self::ConvNext(ImageModelEvidence::unavailable(
                CONVNEXT_ID,
                version,
                "ovarian ultrasound appearance classification",
                ModelStatus::InferenceError,
                reason.into(),
            )),
            ImageKind::Unet => Self::Unet(empty_segmentation(
                version,
                ModelStatus::InferenceError,
                reason,
            )),
        }
    }
}

fn run_image(
    models: &ModelRegistry,
    image: &DecodedImage,
    kind: ImageKind,
    version: String,
) -> ImageTaskOutput {
    let started = Instant::now();
    match kind {
        ImageKind::Biomed => match models.run_biomedclip(biomedclip_tensor(image)) {
            Ok(logit) => {
                let probability = sigmoid(logit);
                ImageTaskOutput::Biomed(ImageModelEvidence {
                    model_id: BIOMED_ID,
                    model_version: version,
                    task: "ultrasound morphology screening",
                    status: ModelStatus::Success,
                    duration_ms: Some(elapsed(started)),
                    raw_logit: Some(logit),
                    probability: Some(probability),
                    decision_threshold: Some(BIOMED_THRESHOLD),
                    threshold_met: Some(probability >= BIOMED_THRESHOLD),
                    predicted_label: Some(
                        if probability >= BIOMED_THRESHOLD {
                            "POLYCYSTIC_OVARIAN_MORPHOLOGY_VISIBLE"
                        } else {
                            "POLYCYSTIC_OVARIAN_MORPHOLOGY_NOT_VISIBLE"
                        }
                        .into(),
                    ),
                    class_probabilities: BTreeMap::new(),
                    warnings: vec![],
                })
            }
            Err(_) => ImageTaskOutput::Biomed(ImageModelEvidence::unavailable(
                BIOMED_ID,
                version,
                "ultrasound morphology screening",
                ModelStatus::InferenceError,
                "BiomedCLIP inference was unavailable.".into(),
            )),
        },
        ImageKind::ConvNext => match models.run_convnext(convnext_tensor(image)) {
            Ok(logits) => {
                let probabilities = softmax_temperature(&logits, CONVNEXT_TEMPERATURE);
                let class_probabilities = CLASS_NAMES
                    .iter()
                    .zip(probabilities.iter())
                    .map(|(k, v)| (k.to_string(), *v))
                    .collect();
                let index = probabilities
                    .iter()
                    .enumerate()
                    .max_by(|a, b| a.1.total_cmp(b.1))
                    .map(|x| x.0)
                    .unwrap_or(0);
                ImageTaskOutput::ConvNext(ImageModelEvidence {
                    model_id: CONVNEXT_ID,
                    model_version: version,
                    task: "ovarian ultrasound appearance classification",
                    status: ModelStatus::Success,
                    duration_ms: Some(elapsed(started)),
                    raw_logit: None,
                    probability: Some(probabilities[index]),
                    decision_threshold: None,
                    threshold_met: None,
                    predicted_label: Some(CLASS_NAMES[index].into()),
                    class_probabilities,
                    warnings: vec![
                        "Appearance classes are research labels and are not a diagnosis.".into(),
                    ],
                })
            }
            Err(_) => ImageTaskOutput::ConvNext(ImageModelEvidence::unavailable(
                CONVNEXT_ID,
                version,
                "ovarian ultrasound appearance classification",
                ModelStatus::InferenceError,
                "ConvNeXt inference was unavailable.".into(),
            )),
        },
        ImageKind::Unet => {
            let (tensor, meta) = unet_tensor(image);
            match models.run_unet(tensor).and_then(|logits|reconstruct(&logits,meta,UNET_THRESHOLD)){
                Ok(mask)=>ImageTaskOutput::Unet(SegmentationEvidence{model_id:UNET_ID,model_version:version,status:ModelStatus::Success,duration_ms:Some(elapsed(started)),segmentation_available:true,mask_width:Some(mask.mask.width()),mask_height:Some(mask.mask.height()),foreground_fraction:Some(mask.foreground_fraction),bounding_box:mask.bounding_box,connected_component_count:Some(mask.connected_components),mask_png_data_url:Some(mask.png_data_url),threshold:UNET_THRESHOLD,warnings:vec!["The highlighted region is a model segmentation, not a pathology or malignancy finding.".into()]}),
                Err(_)=>ImageTaskOutput::Unet(empty_segmentation(version,ModelStatus::InferenceError,"U-Net++ inference was unavailable.")),
            }
        }
    }
}

async fn spawn_clinical(
    models: Arc<ModelRegistry>,
    input: crate::contracts::request::ClinicalInput,
    supplied: usize,
) -> ClinicalEvidence {
    let version = models.model_version(XGBOOST_ID);
    if supplied == 0 {
        return empty_clinical(
            version,
            ModelStatus::Unavailable,
            supplied,
            "No supported clinical fields were supplied.",
        );
    }
    match tokio::task::spawn_blocking(move || {
        let started = Instant::now();
        let features = models.clinical_preprocessor.transform(&input)?;
        let raw = models.run_xgboost(features)?;
        Ok::<_, AppError>((raw, elapsed(started)))
    })
    .await
    {
        Ok(Ok((raw, duration))) => {
            let p = raw.clamp(0.000_000_1, 0.999_999_9);
            let calibrated =
                sigmoid(XGBOOST_PLATT_COEFFICIENT * (p / (1.0 - p)).ln() + XGBOOST_PLATT_INTERCEPT);
            ClinicalEvidence {
                model_id: XGBOOST_ID,
                model_version: version,
                task: "structured clinical PCOS screening",
                status: ModelStatus::Success,
                duration_ms: Some(duration),
                supplied_feature_count: supplied,
                raw_probability: Some(raw),
                calibrated_probability: Some(calibrated),
                screening_threshold: XGBOOST_THRESHOLD,
                screening_threshold_met: Some(calibrated >= XGBOOST_THRESHOLD),
                warnings: vec!["This research screening signal is not a PCOS diagnosis.".into()],
            }
        }
        _ => empty_clinical(
            version,
            ModelStatus::InferenceError,
            supplied,
            "XGBoost inference was unavailable.",
        ),
    }
}

trait IntoOutput {
    fn into_biomed(self) -> ImageModelEvidence;
    fn into_convnext(self) -> ImageModelEvidence;
    fn into_unet(self) -> SegmentationEvidence;
}
impl IntoOutput for ImageTaskOutput {
    fn into_biomed(self) -> ImageModelEvidence {
        if let Self::Biomed(x) = self {
            x
        } else {
            unreachable!()
        }
    }
    fn into_convnext(self) -> ImageModelEvidence {
        if let Self::ConvNext(x) = self {
            x
        } else {
            unreachable!()
        }
    }
    fn into_unet(self) -> SegmentationEvidence {
        if let Self::Unet(x) = self {
            x
        } else {
            unreachable!()
        }
    }
}

async fn spawn_image_biomed(
    models: Arc<ModelRegistry>,
    decoded: Option<DecodedImage>,
) -> ImageModelEvidence {
    spawn_image(models, decoded, ImageKind::Biomed)
        .await
        .into_biomed()
}
async fn spawn_image_convnext(
    models: Arc<ModelRegistry>,
    decoded: Option<DecodedImage>,
) -> ImageModelEvidence {
    spawn_image(models, decoded, ImageKind::ConvNext)
        .await
        .into_convnext()
}
async fn spawn_image_unet(
    models: Arc<ModelRegistry>,
    decoded: Option<DecodedImage>,
) -> SegmentationEvidence {
    spawn_image(models, decoded, ImageKind::Unet)
        .await
        .into_unet()
}

fn empty_clinical(
    version: String,
    status: ModelStatus,
    supplied: usize,
    warning: &str,
) -> ClinicalEvidence {
    ClinicalEvidence {
        model_id: XGBOOST_ID,
        model_version: version,
        task: "structured clinical PCOS screening",
        status,
        duration_ms: None,
        supplied_feature_count: supplied,
        raw_probability: None,
        calibrated_probability: None,
        screening_threshold: XGBOOST_THRESHOLD,
        screening_threshold_met: None,
        warnings: vec![warning.into()],
    }
}
fn empty_segmentation(version: String, status: ModelStatus, warning: &str) -> SegmentationEvidence {
    SegmentationEvidence {
        model_id: UNET_ID,
        model_version: version,
        status,
        duration_ms: None,
        segmentation_available: false,
        mask_width: None,
        mask_height: None,
        foreground_fraction: None,
        bounding_box: None,
        connected_component_count: None,
        mask_png_data_url: None,
        threshold: UNET_THRESHOLD,
        warnings: vec![warning.into()],
    }
}
fn elapsed(started: Instant) -> f64 {
    started.elapsed().as_secs_f64() * 1000.0
}
fn sigmoid(x: f32) -> f32 {
    if x >= 0.0 {
        1.0 / (1.0 + (-x).exp())
    } else {
        let e = x.exp();
        e / (1.0 + e)
    }
}
fn softmax_temperature(logits: &[f32], temperature: f32) -> Vec<f32> {
    let maximum = logits.iter().copied().reduce(f32::max).unwrap_or(0.0);
    let values = logits
        .iter()
        .map(|x| ((x - maximum) / temperature).exp())
        .collect::<Vec<_>>();
    let sum = values.iter().sum::<f32>();
    values.into_iter().map(|x| x / sum).collect()
}

fn legacy_panels(e: &OviaEvidence) -> Panels {
    let pcos = if e.clinical_model.status == ModelStatus::Success {
        Panel::Success {
            result: ConditionResult {
                condition: "PCOS clinical screening",
                signal_source: "questionnaire",
                band: None,
                value: e.clinical_model.calibrated_probability,
                model_version: e.clinical_model.model_version.clone(),
                calibration_status: "calibrated",
            },
        }
    } else {
        Panel::NotScreened {
            reason: "no_image_submitted",
        }
    };
    let ovarian_cyst = if e.image_models.convnext_tiny.status == ModelStatus::Success {
        Panel::Success {
            result: ConditionResult {
                condition: "Ovarian ultrasound appearance",
                signal_source: "image",
                band: None,
                value: e.image_models.convnext_tiny.probability,
                model_version: e.image_models.convnext_tiny.model_version.clone(),
                calibration_status: "calibrated",
            },
        }
    } else {
        Panel::NotScreened {
            reason: "no_image_submitted",
        }
    };
    let ovarian_tumor = if e.quality.image_supplied {
        Panel::Unavailable {
            code: "signal_unusable",
        }
    } else {
        Panel::NotScreened {
            reason: "no_image_submitted",
        }
    };
    Panels {
        pcos,
        ovarian_cyst,
        ovarian_tumor,
    }
}
fn inspection_regions(e: &OviaEvidence) -> Vec<InspectionRegion> {
    match (
        &e.segmentation.bounding_box,
        e.quality.original_width,
        e.quality.original_height,
    ) {
        (Some(b), Some(w), Some(h)) => vec![InspectionRegion {
            id: "unetpp-segmented-region".into(),
            x: b.x_min as f32 / w as f32,
            y: b.y_min as f32 / h as f32,
            width: (b.x_max - b.x_min + 1) as f32 / w as f32,
            height: (b.y_max - b.y_min + 1) as f32 / h as f32,
        }],
        _ => vec![],
    }
}
