use crate::{contracts::request::ClinicalInput, error::AppError};
use serde::Deserialize;
use std::{collections::BTreeMap, fs, path::Path};

#[derive(Clone)]
pub struct ClinicalPreprocessor {
    order: Vec<String>,
    medians: BTreeMap<String, f32>,
}
#[derive(Deserialize)]
struct Metadata {
    ordered_feature_list: Vec<String>,
    missing_value_behavior: Missing,
}
#[derive(Deserialize)]
struct Missing {
    medians: BTreeMap<String, f32>,
}

impl ClinicalPreprocessor {
    pub fn load(path: &Path) -> Result<Self, AppError> {
        let raw = fs::read_to_string(path).map_err(|e| AppError::startup(e.to_string()))?;
        let m: Metadata =
            serde_json::from_str(&raw).map_err(|e| AppError::startup(e.to_string()))?;
        if m.ordered_feature_list.len() != 68 {
            return Err(AppError::startup(
                "XGBoost feature contract must contain 68 ordered features",
            ));
        }
        Ok(Self {
            order: m.ordered_feature_list,
            medians: m.missing_value_behavior.medians,
        })
    }
    pub fn transform(&self, input: &ClinicalInput) -> Result<Vec<f32>, AppError> {
        let mut v = BTreeMap::<String, Option<f32>>::new();
        macro_rules! put {
            ($n:ident) => {
                v.insert(stringify!($n).into(), input.$n);
            };
        }
        put!(age_years);
        put!(weight_kg);
        put!(height_cm);
        put!(pulse_rate_bpm);
        put!(respiratory_rate_breaths_per_min);
        put!(hemoglobin_g_dl);
        put!(cycle_length_days);
        put!(pregnant_indicator_semantics_unconfirmed);
        put!(abortion_count);
        put!(fsh_miu_ml);
        put!(lh_miu_ml);
        put!(hip_in);
        put!(waist_in);
        put!(tsh_miu_l);
        put!(amh_ng_ml);
        put!(prolactin_ng_ml);
        put!(vitamin_d3_ng_ml);
        put!(progesterone_ng_ml);
        put!(random_blood_sugar_mg_dl);
        put!(weight_gain);
        put!(hair_growth);
        put!(skin_darkening);
        put!(hair_loss);
        put!(pimples);
        put!(fast_food);
        put!(regular_exercise);
        put!(systolic_bp_mmhg);
        put!(diastolic_bp_mmhg);
        outlier(&mut v, "pulse_rate_bpm", |x| x < 40.0);
        outlier(&mut v, "cycle_length_days", |x| x <= 0.0);
        outlier(&mut v, "fsh_miu_ml", |x| x > 100.0);
        outlier(&mut v, "lh_miu_ml", |x| x > 100.0);
        outlier(&mut v, "vitamin_d3_ng_ml", |x| x <= 0.0 || x > 200.0);
        outlier(&mut v, "systolic_bp_mmhg", |x| x < 70.0);
        outlier(&mut v, "diastolic_bp_mmhg", |x| x < 40.0);
        let cycle = input
            .cycle_regularity_code
            .filter(|x| *x == 2.0 || *x == 4.0);
        v.insert(
            "cycle_is_regular_2".into(),
            Some(if cycle == Some(2.0) { 1.0 } else { 0.0 }),
        );
        v.insert(
            "cycle_is_irregular_4".into(),
            Some(if cycle == Some(4.0) { 1.0 } else { 0.0 }),
        );
        v.insert(
            "cycle_is_unknown".into(),
            Some(if cycle.is_none() { 1.0 } else { 0.0 }),
        );
        derive(
            &mut v,
            "bmi",
            ratio(
                input.weight_kg,
                input.height_cm.map(|h| (h / 100.0).powi(2)),
            ),
        );
        let fsh_lh = ratio(v["fsh_miu_ml"], v["lh_miu_ml"]);
        derive(&mut v, "fsh_lh_ratio", fsh_lh);
        derive(
            &mut v,
            "waist_hip_ratio",
            ratio(input.waist_in, input.hip_in),
        );
        let base = &self.order[..34];
        let mut out = Vec::with_capacity(68);
        let mut missing = Vec::with_capacity(34);
        for name in base {
            let value = v.get(name).copied().flatten();
            missing.push(if value.is_none() { 1.0 } else { 0.0 });
            out.push(
                value.unwrap_or(
                    *self
                        .medians
                        .get(name)
                        .ok_or_else(|| AppError::startup(format!("missing median for {name}")))?,
                ),
            );
        }
        out.extend(missing);
        if out.len() != 68 {
            return Err(AppError::startup(
                "XGBoost preprocessing emitted incorrect feature count",
            ));
        }
        Ok(out)
    }
    pub fn order(&self) -> &[String] {
        &self.order
    }
}
fn outlier(map: &mut BTreeMap<String, Option<f32>>, name: &str, predicate: impl Fn(f32) -> bool) {
    if map.get(name).copied().flatten().is_some_and(predicate) {
        map.insert(name.into(), None);
    }
}
fn ratio(a: Option<f32>, b: Option<f32>) -> Option<f32> {
    match (a, b) {
        (Some(x), Some(y)) if y != 0.0 => Some(x / y),
        _ => None,
    }
}
fn derive(map: &mut BTreeMap<String, Option<f32>>, name: &str, value: Option<f32>) {
    map.insert(name.into(), value.filter(|x| x.is_finite()));
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn emits_exact_order_and_missing_indicators() {
        let p = ClinicalPreprocessor::load(Path::new("models/metadata/xgboost.json")).unwrap();
        let input = ClinicalInput {
            age_years: Some(30.0),
            weight_kg: Some(65.0),
            height_cm: Some(165.0),
            cycle_regularity_code: Some(4.0),
            ..Default::default()
        };
        let out = p.transform(&input).unwrap();
        assert_eq!(out.len(), 68);
        assert_eq!(p.order().len(), 68);
        assert_eq!(out[0], 30.0);
        assert_eq!(out[7], 0.0);
        assert_eq!(out[8], 1.0);
        assert_eq!(out[9], 0.0);
        assert_eq!(out[34], 0.0)
    }
    #[test]
    fn invalid_outlier_becomes_missing() {
        let p = ClinicalPreprocessor::load(Path::new("models/metadata/xgboost.json")).unwrap();
        let input = ClinicalInput {
            fsh_miu_ml: Some(101.0),
            ..Default::default()
        };
        let out = p.transform(&input).unwrap();
        assert_eq!(out[34 + 13], 1.0)
    }
}
