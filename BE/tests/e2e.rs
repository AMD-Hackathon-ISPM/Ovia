use axum::{
    body::{Body, to_bytes},
    http::{Request, StatusCode},
};
use ovia_backend::{
    AppState,
    config::{Config, ExecutionProviderPreference},
    inference::ModelRegistry,
    orchestration::{
        llm::{Agreement, AgreementStatus, NarrativeDraft, NarrativeEvidence},
        mock::MockLlm,
    },
    router,
};
use std::{path::PathBuf, sync::Arc};
use tower::ServiceExt;

fn configure_windows_runtime() {
    #[cfg(windows)]
    if std::env::var_os("ORT_DYLIB_PATH").is_none() {
        let path=PathBuf::from(std::env::var("LOCALAPPDATA").unwrap()).join("Packages/PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0/LocalCache/local-packages/Python313/site-packages/onnxruntime/capi/onnxruntime.dll");
        if path.is_file() {
            unsafe { std::env::set_var("ORT_DYLIB_PATH", path) }
        }
    }
}

fn config() -> Config {
    Config {
        host: "127.0.0.1".parse().unwrap(),
        port: 0,
        models_dir: PathBuf::from("models"),
        execution_provider: ExecutionProviderPreference::Cpu,
        allowed_origins: vec!["http://localhost:5173".into()],
        max_image_bytes: 2_000_000,
        max_image_pixels: 2_000_000,
        llm: None,
    }
}

#[tokio::test]
async fn representative_image_and_clinical_request_runs_all_onnx_and_mock_llm() {
    configure_windows_runtime();
    let config = config();
    let models = Arc::new(ModelRegistry::load(&config).await.unwrap());
    assert_eq!(models.model_infos().len(), 4);
    let draft = NarrativeDraft {
        summary: "The available screening evidence should be reviewed together.".into(),
        evidence: vec![NarrativeEvidence {
            source: "biomedclip_pcos_morphology".into(),
            finding: "Morphology evidence is available.".into(),
            importance: "It is one independent screening signal.".into(),
        }],
        agreement: Agreement {
            status: AgreementStatus::Mixed,
            explanation: "The model outputs have distinct tasks and are not combined.".into(),
        },
        limitations: vec!["This prototype is not clinically validated.".into()],
        recommended_next_step: "Review all outputs with a qualified clinician.".into(),
    };
    let state = AppState {
        config: Arc::new(config),
        models,
        llm: Arc::new(MockLlm::new(vec![Ok(draft)])),
    };
    let health = router(state.clone())
        .oneshot(
            Request::builder()
                .uri("/api/v1/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(health.status(), StatusCode::OK);
    let health_text = String::from_utf8(
        to_bytes(health.into_body(), 100_000)
            .await
            .unwrap()
            .to_vec(),
    )
    .unwrap();
    assert!(health_text.contains("\"models_ready\":4"));
    assert!(!health_text.to_ascii_lowercase().contains("api_key"));
    let payload = r#"{"schema_version":"ovia-v1","request_id":"50c82684-14ea-4d09-91cb-102dfb14f608","image_attached":true,"answers":{"age_years":29,"weight_kg":68,"height_cm":163,"cycle_regularity_code":4,"hair_growth":1}}"#;
    let image = std::fs::read("tests/fixtures/synthetic_ultrasound.png").unwrap();
    let boundary = "ovia-e2e-boundary";
    let mut body = Vec::new();
    body.extend_from_slice(format!("--{boundary}\r\nContent-Disposition: form-data; name=\"payload\"\r\nContent-Type: application/json\r\n\r\n{payload}\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"ultrasound\"\r\nContent-Type: image/png\r\n\r\n").as_bytes());
    body.extend_from_slice(&image);
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    let response = router(state)
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/analyze")
                .header(
                    "content-type",
                    format!("multipart/form-data; boundary={boundary}"),
                )
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let json: serde_json::Value =
        serde_json::from_slice(&to_bytes(response.into_body(), 20_000_000).await.unwrap()).unwrap();
    assert_eq!(
        json["evidence"]["image_models"]["biomedclip"]["status"],
        "success"
    );
    assert_eq!(
        json["evidence"]["image_models"]["convnext_tiny"]["status"],
        "success"
    );
    assert_eq!(json["evidence"]["clinical_model"]["status"], "success");
    assert_eq!(json["evidence"]["segmentation"]["status"], "success");
    assert_eq!(json["evidence"]["segmentation"]["mask_width"], 640);
    assert_eq!(json["evidence"]["segmentation"]["mask_height"], 480);
    assert_eq!(json["orchestration"]["provider"], "mock");
    assert!(
        json["evidence"]["segmentation"]["mask_png_data_url"]
            .as_str()
            .unwrap()
            .len()
            < 100_000
    );
    let golden: serde_json::Value =
        serde_json::from_slice(&std::fs::read("tests/fixtures/python_golden.json").unwrap())
            .unwrap();
    let difference = |a: &serde_json::Value, b: &serde_json::Value| {
        (a.as_f64().unwrap() - b.as_f64().unwrap()).abs()
    };
    assert!(
        difference(
            &json["evidence"]["image_models"]["biomedclip"]["raw_logit"],
            &golden["biomedclip"]["logit"]
        ) < 0.005
    );
    assert!(
        difference(
            &json["evidence"]["clinical_model"]["raw_probability"],
            &golden["xgboost"]["raw_probability"]
        ) < 1e-6
    );
    for (index, name) in [
        "HEALTHY",
        "DOMINANT_FOLLICLE",
        "POLYCYSTIC_OVARY",
        "SIMPLE_CYST",
        "COMPLEX_CYST",
    ]
    .iter()
    .enumerate()
    {
        assert!(
            difference(
                &json["evidence"]["image_models"]["convnext_tiny"]["class_probabilities"][name],
                &golden["convnext"]["probabilities"][index]
            ) < 0.003
        );
    }
    assert!(
        difference(
            &json["evidence"]["clinical_model"]["calibrated_probability"],
            &golden["xgboost"]["calibrated_probability"]
        ) < 1e-6
    );
    assert!(
        difference(
            &json["evidence"]["segmentation"]["foreground_fraction"],
            &golden["unetpp"]["foreground_fraction"]
        ) < 0.01
    );
}
