use crate::orchestration::evidence::{ModelStatus, OviaEvidence};

pub fn apply(e: &mut OviaEvidence) {
    if !e.quality.image_supplied {
        e.warnings.push("Image evidence and lesion segmentation were not requested because no ultrasound was supplied.".into());
    }
    if e.quality.clinical_fields_supplied == 0 {
        e.warnings.push(
            "Clinical model unavailable because no supported clinical fields were supplied.".into(),
        );
    } else if e.quality.clinical_fields_supplied < 3 {
        e.warnings.push(
            "Clinical evidence uses very limited supplied data; missing fields remain explicit."
                .into(),
        );
    }
    if e.segmentation.status == ModelStatus::Success
        && e.segmentation.foreground_fraction == Some(0.0)
    {
        e.warnings.push("Segmentation produced no foreground region; this does not establish absence of a lesion.".into());
    }
    if e.image_models.convnext_tiny.status == ModelStatus::Success {
        if let Some(max) = e
            .image_models
            .convnext_tiny
            .class_probabilities
            .values()
            .copied()
            .reduce(f32::max)
        {
            if max < 0.6 {
                e.warnings.push(
                    "ConvNeXt appearance output is low-confidence across its verified classes."
                        .into(),
                );
            }
        }
    }
    if let (Some(image), Some(clinical)) = (
        e.image_models.biomedclip.threshold_met,
        e.clinical_model.screening_threshold_met,
    ) {
        if image != clinical {
            e.warnings.push("Image morphology evidence and structured clinical screening evidence are mixed; their probabilities are not combined.".into());
        }
    }
    for value in [
        &e.image_models.biomedclip.status,
        &e.image_models.convnext_tiny.status,
        &e.clinical_model.status,
        &e.segmentation.status,
    ] {
        if matches!(value, ModelStatus::InferenceError) {
            e.warnings.push(
                "At least one model failed independently; no substitute score was generated."
                    .into(),
            );
            break;
        }
    }
}
