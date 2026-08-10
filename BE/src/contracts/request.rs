use serde::Deserialize;
use uuid::Uuid;

use crate::error::AppError;

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ClinicalInput {
    pub age_years: Option<f32>,
    pub weight_kg: Option<f32>,
    pub height_cm: Option<f32>,
    pub pulse_rate_bpm: Option<f32>,
    pub respiratory_rate_breaths_per_min: Option<f32>,
    pub hemoglobin_g_dl: Option<f32>,
    pub cycle_regularity_code: Option<f32>,
    pub cycle_length_days: Option<f32>,
    pub pregnant_indicator_semantics_unconfirmed: Option<f32>,
    pub abortion_count: Option<f32>,
    pub fsh_miu_ml: Option<f32>,
    pub lh_miu_ml: Option<f32>,
    pub hip_in: Option<f32>,
    pub waist_in: Option<f32>,
    pub tsh_miu_l: Option<f32>,
    pub amh_ng_ml: Option<f32>,
    pub prolactin_ng_ml: Option<f32>,
    pub vitamin_d3_ng_ml: Option<f32>,
    pub progesterone_ng_ml: Option<f32>,
    pub random_blood_sugar_mg_dl: Option<f32>,
    pub weight_gain: Option<f32>,
    pub hair_growth: Option<f32>,
    pub skin_darkening: Option<f32>,
    pub hair_loss: Option<f32>,
    pub pimples: Option<f32>,
    pub fast_food: Option<f32>,
    pub regular_exercise: Option<f32>,
    pub systolic_bp_mmhg: Option<f32>,
    pub diastolic_bp_mmhg: Option<f32>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SubmitPayload {
    pub schema_version: String,
    pub request_id: String,
    #[serde(default)]
    pub answers: ClinicalInput,
    pub image_attached: bool,
}

impl SubmitPayload {
    pub fn validate(&self) -> Result<(), AppError> {
        if self.schema_version != "ovia-v1" {
            return Err(AppError::InvalidRequest("schema_version_mismatch".into()));
        }
        Uuid::parse_str(&self.request_id)
            .map_err(|_| AppError::InvalidRequest("request_id must be a UUID".into()))?;
        self.answers.validate()
    }
}

impl ClinicalInput {
    pub fn validate(&self) -> Result<(), AppError> {
        for (name, value) in [
            ("weight_gain", self.weight_gain),
            ("hair_growth", self.hair_growth),
            ("skin_darkening", self.skin_darkening),
            ("hair_loss", self.hair_loss),
            ("pimples", self.pimples),
            ("fast_food", self.fast_food),
            ("regular_exercise", self.regular_exercise),
            (
                "pregnant_indicator_semantics_unconfirmed",
                self.pregnant_indicator_semantics_unconfirmed,
            ),
        ] {
            if value.is_some_and(|v| v != 0.0 && v != 1.0) {
                return Err(AppError::InvalidRequest(format!("{name} must be 0 or 1")));
            }
        }
        if self
            .cycle_regularity_code
            .is_some_and(|v| v != 2.0 && v != 4.0)
        {
            return Err(AppError::InvalidRequest(
                "cycle_regularity_code must be 2, 4, or omitted".into(),
            ));
        }
        Ok(())
    }

    pub fn supplied_count(&self) -> usize {
        let value = serde_json::to_value(self).unwrap_or_default();
        value
            .as_object()
            .map_or(0, |map| map.values().filter(|v| !v.is_null()).count())
    }
}

impl serde::Serialize for ClinicalInput {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeMap;
        let mut map = serializer.serialize_map(None)?;
        macro_rules! field {
            ($name:ident) => {
                if let Some(v) = self.$name {
                    map.serialize_entry(stringify!($name), &v)?;
                }
            };
        }
        field!(age_years);
        field!(weight_kg);
        field!(height_cm);
        field!(pulse_rate_bpm);
        field!(respiratory_rate_breaths_per_min);
        field!(hemoglobin_g_dl);
        field!(cycle_regularity_code);
        field!(cycle_length_days);
        field!(pregnant_indicator_semantics_unconfirmed);
        field!(abortion_count);
        field!(fsh_miu_ml);
        field!(lh_miu_ml);
        field!(hip_in);
        field!(waist_in);
        field!(tsh_miu_l);
        field!(amh_ng_ml);
        field!(prolactin_ng_ml);
        field!(vitamin_d3_ng_ml);
        field!(progesterone_ng_ml);
        field!(random_blood_sugar_mg_dl);
        field!(weight_gain);
        field!(hair_growth);
        field!(skin_darkening);
        field!(hair_loss);
        field!(pimples);
        field!(fast_food);
        field!(regular_exercise);
        field!(systolic_bp_mmhg);
        field!(diastolic_bp_mmhg);
        map.end()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn validates_contract_version_and_uuid() {
        let p = SubmitPayload {
            schema_version: "ovia-v1".into(),
            request_id: Uuid::new_v4().to_string(),
            answers: ClinicalInput::default(),
            image_attached: false,
        };
        assert!(p.validate().is_ok())
    }
    #[test]
    fn rejects_invalid_binary_and_cycle() {
        let mut c = ClinicalInput::default();
        c.hair_growth = Some(2.0);
        assert!(c.validate().is_err());
        c.hair_growth = None;
        c.cycle_regularity_code = Some(3.0);
        assert!(c.validate().is_err())
    }
}
