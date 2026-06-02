export const PATIENT_PERSONA_MOCK = {
  "_meta": {
    "sync_status": "in_sync",
    "valid_until": 1780054621,
    "generated_at": 1779968221,
    "persona_hash": null,
    "last_synced_at": 1779968221,
    "schema_version": "2.0.0",
    "emergency_flags": {
      "overall": false,
      "bp_critical": false,
      "cgm_critical": false,
      "glucose_critical": false
    },
    "mongo_patient_id": "689ad162087edd817506da49",
    "feature_completeness": {
      "has_cgm": true,
      "has_meals": true,
      "has_activity": true,
      "has_symptoms": true,
      "has_face_scan": true,
      "has_healthkit": true,
      "has_glucometer": true,
      "has_lab_reports": true,
      "has_medications": true,
      "has_consultation": true,
      "has_prescription": true,
      "has_blood_pressure": true,
      "has_scale_parameters": true
    }
  },
  "identity": {
    "gender": "female",
    "locale": null,
    "language": "en",
    "timezone": "Asia/Kolkata",
    "age_years": 37,
    "last_name": "Aggarwal",
    "first_name": "Neha",
    "patient_id": "689ad162087edd817506da49",
    "country_code": "+91",
    "anthropometry": {
      "bmi": 24.9,
      "whr": 0,
      "bmr_kcal": 1312,
      "height_cm": 167.64,
      "weight_kg": 70,
      "bmi_category": "Normal",
      "last_weigh_in": 1760607835,
      "muscle_mass_kg": null,
      "body_fat_percent": 0,
      "maintenance_calories_kcal": 2034,
      "weight_loss_calories_kcal": 1534
    },
    "date_of_birth": "29/08/1989"
  },
  "care_team": {
    "assigned_doctor": {
      "name": "Samarth Gupta",
      "doctor_id": "6788b62688a19b5546fe8723",
      "contact_email": "gupta.samarth+prodyhealthdoctor@tftus.com",
      "specialization": "Endocrinologist",
      "hospital_affiliation": []
    },
    "current_program": {
      "tier": null,
      "program_id": "677f9c22b067a65fec4dea49",
      "expiry_date": 1786233600,
      "program_name": "Trial Program",
      "program_type": "trial",
      "days_remaining": null,
      "enrollment_date": 1778457600,
      "next_renewal_date": 1786233600,
      "program_description": "basic trial program"
    },
    "is_mrp_enrolled": false,
    "doctor_notes_latest": {
      "note": "consulatation is completed",
      "note_id": "69ccc8dac363ab4e34d06c88",
      "doctor_id": "6788b62688a19b5546fe8723",
      "timestamp": 1775028442
    },
    "consultation_history": {
      "total_count": 1,
      "pending_count": 1,
      "completed_count": 0,
      "last_completed_consultation": null,
      "latest_pending_consultation": {
        "priority": 1,
        "created_by": "User",
        "requested_at": 1765269329,
        "consultation_id": "6937df51d0e68648486e5df5"
      }
    },
    "prescription_on_file": {
      "file_name": "aryan hospital prescription",
      "uploaded_at": 1755499956,
      "uploaded_by": "patient",
      "prescription_id": "6a16a39de6b1680a51acd2e7"
    },
    "active_clinical_alerts": []
  },
  "engagement": {
    "registered_at": 1754976610.692,
    "last_active_at": 1777440089,
    "last_sync_error": null,
    "onboarding_completed": true,
    "app_version_installed": null,
    "first_report_uploaded": true,
    "days_since_last_active": 29,
    "first_facescan_completed": true,
    "notification_quiet_hours": null,
    "first_prescription_uploaded": true,
    "preferred_notification_categories": [
      "CGM",
      "Food",
      "Glucometer",
      "Medicine",
      "Activity"
    ]
  },
  "cgm_profile": {
    "trend": {
      "direction": null
    },
    "daily_stats": [],
    "active_sensor": {
      "device_id": "libre1",
      "is_active": true,
      "expires_at": 1761817945,
      "device_name": "Unknown",
      "glucose_unit": "mgdl",
      "installed_at": 1760608345,
      "days_remaining": null,
      "last_reading_at": 1760608345,
      "connection_status": "disconnected",
      "last_reading_mgdl": null
    },
    "rolling_7_day": {
      "mage_mgdl": null,
      "tir_percent": 81,
      "stability_score": null,
      "tar_level1_percent": 20,
      "tbr_level1_percent": 2,
      "average_glucose_mgdl": 136,
      "nocturnal_hypo_event_count": 0,
      "glucose_variability_cv_percent": null,
      "nocturnal_hypo_avg_duration_minutes": 0
    },
    "control_classification": null,
    "rolling_sensor_lifetime": {
      "tir_percent": 81,
      "reading_count": 465,
      "total_readings": 465,
      "tar_level1_percent": 20,
      "tbr_level1_percent": 2,
      "average_glucose_mgdl": 136
    },
    "recent_significant_events": []
  },
  "activity_profile": {
    "weekly_summary": {
      "session_count": 1,
      "total_minutes": 15,
      "most_frequent_activities": []
    },
    "healthkit_30_day": {
      "days_with_data": 1,
      "avg_daily_steps": null,
      "avg_daily_sleep_minutes": null,
      "avg_daily_active_calories_kcal": null
    },
    "healthkit_latest": {
      "steps": 830,
      "source": "apple_health",
      "synced_at": 1777440066,
      "date_epoch": 1777420800,
      "sleep_minutes": 0,
      "total_calories": 615
    }
  },
  "clinical_context": {
    "diagnoses": [
      {
        "status": "historical",
        "diagnosis": "Gestational Diabetes (prior pregnancy)"
      }
    ],
    "diet_type": [],
    "ethnicity": "Asian",
    "is_diabetic": true,
    "health_goals": [
      "Longevity & overall health",
      "Managing weight",
      "Improving Performance",
      "Managing a chronic condition"
    ],
    "primary_goal": "Longevity & overall health",
    "comorbidities": [
      "fatigue",
      "cough",
      "rash",
      "nausea",
      "dizziness",
      "pain"
    ],
    "exercise_detail": "Moderate ( exercise 4 or 5 times a week )",
    "is_hypertensive": false,
    "lifestyle_notes": null,
    "exercise_frequency": "MODERATE",
    "exercise_min_per_week": null,
    "allergies_and_restrictions": [
      {
        "allergen": "Drug Allergy",
        "reaction_severity": "unspecified",
        "avoidance_required": true
      }
    ]
  },
  "symptoms_profile": {
    "logs_30_day": 6,
    "latest_symptom_log": {
      "notes": "",
      "severity": 5,
      "symptoms": [
        "pain",
        "nausea",
        "fatigue",
        "cough",
        "dizziness",
        "rash"
      ],
      "logged_at": 1776921353
    },
    "avg_severity_30_day": 5.5,
    "has_active_symptoms": true,
    "max_severity_30_day": 10,
    "most_common_symptoms": [
      {
        "symptom": "pain",
        "occurrences": 3,
        "avg_severity": 5
      },
      {
        "symptom": "nausea",
        "occurrences": 3,
        "avg_severity": 5
      },
      {
        "symptom": "fatigue",
        "occurrences": 3,
        "avg_severity": 5
      },
      {
        "symptom": "cough",
        "occurrences": 3,
        "avg_severity": 5
      },
      {
        "symptom": "dizziness",
        "occurrences": 2,
        "avg_severity": 5
      },
      {
        "symptom": "rash",
        "occurrences": 4,
        "avg_severity": 5
      }
    ]
  },
  "face_scan_profile": {
    "trend": {
      "stress_direction": "worsening",
      "wellness_direction": "declining"
    },
    "latest_scan": {
      "scanned_at": 1761032264,
      "age_metrics": {
        "heart_age_years": ""
      },
      "app_version": "3.0.1",
      "hrv_metrics": {
        "prq": 6.1,
        "sd1": 14,
        "sd2": 38,
        "sdnn": 28,
        "rmssd": 25,
        "mean_rri": 636,
        "lf_hf_ratio": 0.815
      },
      "risk_scores": {
        "diabetes_risk": "Medium",
        "high_hba1c_risk": "low",
        "hypertension_risk": "Low",
        "low_hemoglobin_risk": "high",
        "high_blood_pressure_risk": "low",
        "high_fasting_glucose_risk": "high",
        "high_total_cholesterol_risk": "low"
      },
      "device_model": "iPhone 15",
      "lab_estimates": {
        "hba1c_percent": 5.72,
        "hemoglobin_gdl": 11.6
      },
      "stress_metrics": {
        "stress_index": 294,
        "stress_level": "mild"
      },
      "cardiac_metrics": {
        "pulse_pressure": 30,
        "cardiac_workload": 4.01,
        "body_tension_score": 0,
        "mean_arterial_pressure": 88
      },
      "wellness_metrics": {
        "wellness_index": 8,
        "wellness_level": "medium"
      },
      "autonomic_balance": {
        "pns_zone": "low",
        "sns_zone": "high",
        "pns_index": -1.8,
        "sns_index": 2.6
      },
      "vital_signs_extracted": {
        "pulse_rate_bpm": 95,
        "respiration_rate_rpm": 15,
        "oxygen_saturation_percent": 99
      }
    },
    "total_scans": 2,
    "previous_scan": {
      "scanned_at": 1754977297,
      "age_metrics": {
        "heart_age_years": ""
      },
      "app_version": null,
      "hrv_metrics": {
        "prq": 7,
        "sd1": 39,
        "sd2": 47,
        "sdnn": 43,
        "rmssd": 39,
        "mean_rri": 720,
        "lf_hf_ratio": 0.396
      },
      "risk_scores": {
        "diabetes_risk": "Low",
        "high_hba1c_risk": "low",
        "hypertension_risk": "Low",
        "low_hemoglobin_risk": "low",
        "high_blood_pressure_risk": "low",
        "high_fasting_glucose_risk": "low",
        "high_total_cholesterol_risk": "medium"
      },
      "device_model": null,
      "lab_estimates": {
        "hba1c_percent": 4.75,
        "hemoglobin_gdl": 13.3
      },
      "stress_metrics": {
        "stress_index": 140,
        "stress_level": "normal"
      },
      "cardiac_metrics": {
        "pulse_pressure": null,
        "cardiac_workload": null,
        "body_tension_score": null,
        "mean_arterial_pressure": null
      },
      "wellness_metrics": {
        "wellness_index": 9,
        "wellness_level": "low"
      },
      "autonomic_balance": {
        "pns_zone": "medium",
        "sns_zone": "medium",
        "pns_index": -0.6,
        "sns_index": 0.9
      },
      "vital_signs_extracted": {
        "pulse_rate_bpm": 86,
        "respiration_rate_rpm": 12,
        "oxygen_saturation_percent": 99
      }
    }
  },
  "narrative_summary": {
    "short_summary": "Patient Neha Aggarwal, a 37-year-old female, has a history of gestational diabetes. Current data shows stable weight, improved blood pressure (though still elevated), and a high fasting glucose risk. Recent face scan indicates a declining wellness trend and worsening stress. Lab results from March 2024 show elevated HbA1c, Vitamin D, and TSH levels, along with high cholesterol and triglycerides. She has reported recent symptoms including pain, nausea, fatigue, cough, dizziness, and rash, with an average severity of 5.5.",
    "detailed_summary": "Neha Aggarwal is a 37-year-old female with a history of gestational diabetes. Her primary goal is longevity and overall health, with secondary goals of managing weight, improving performance, and managing a chronic condition. She has comorbidities including fatigue, cough, rash, nausea, dizziness, and pain. She has a moderate exercise frequency, engaging in exercise 4-5 times a week.\n\nHer weight has been stable around 70kg, with a BMI of 24.9 (Normal). Her blood pressure readings show an elevated status with the latest reading at 120/80 mmHg, though the trend is not clearly defined due to limited data. Her glucometer readings show an average of 147.79 mg/dL with some flagged high readings post-lunch and post-dinner. Her CGM data indicates an average glucose of 136 mg/dL with 81% Time in Range (TIR).\n\nThe latest face scan on January 10, 2024, reveals a declining wellness trend (wellness index from 9 to 8) and worsening stress (stress index from 140 to 294). Vital signs extracted during this scan showed a pulse rate of 95 bpm, respiration rate of 15 rpm, and oxygen saturation of 99%. Lab estimates from the same scan estimated HbA1c at 5.72% and hemoglobin at 11.6 g/dL.\n\nHer lab results from March 13, 2024, show an elevated HbA1c of 5.7% (reference 4.00 - 5.60), Vitamin D at 27.64 nmol/L (reference 75.00 - 250.00), and a significantly elevated TSH of 371.2 µIU/mL (reference 0.27 - 4.20). Lipid profile indicates high total cholesterol at 338.86 mg/dL, high LDL cholesterol at 225.55 mg/dL, and high triglycerides at 274.27 mg/dL. Her fasting glucose was 94.56 mg/dL.\n\nIn the last 30 days, she has logged 6 symptom entries. The most common symptoms reported are pain, nausea, fatigue, cough, dizziness, and rash, all with an average severity of 5.0. The latest symptom log on February 20, 2024, included all these symptoms with a severity of 5.\n\nHer active medication is Gluxit Trio 500/5mg, taken twice daily. Adherence data shows 0% taken and 7 missed entries, indicating a significant adherence issue.\n\nOverall, the patient has a history of gestational diabetes, currently shows elevated HbA1c and thyroid-stimulating hormone (TSH), and high lipid levels. Her recent face scans indicate increasing stress and declining wellness. She is also experiencing multiple symptoms and has poor medication adherence. The patient's blood pressure is noted as elevated, and her fasting glucose risk is high."
  },
  "nutrition_profile": {
    "flagged_foods": [],
    "frequent_foods": [],
    "last_logged_meal": {
      "meal_id": "68f0c532750ecf22c7662f12",
      "logged_at": 1760609281,
      "meal_name": "Vegetable Besan Chilla, Beet Root/ Tomato/ Gooseberry/ Carrot Juice, Pomegranate Peeled, Matar Paneer (50 Gm) Bhurji",
      "meal_type": "breakfast",
      "quality_score": 6,
      "macronutrients": {
        "fat_g": 19.55,
        "carbs_g": 44.199999999999996,
        "fiber_g": 9.95,
        "calories": 437.44999999999993,
        "protein_g": 19.75
      },
      "glycemic_metrics": {
        "glycemic_load": 22.1,
        "glycemic_category": "high",
        "avg_glucose_peak_mgdl": 120
      }
    },
    "rolling_30_day_summary": {
      "calorie_goal_kcal": null,
      "total_meals_logged": 1,
      "logging_consistency_percent": null,
      "calorie_goal_compliance_percent": null
    },
    "rolling_7_day_averages": {
      "fat_g_per_day": null,
      "carbs_g_per_day": null,
      "fiber_g_per_day": null,
      "protein_g_per_day": null,
      "sodium_mg_per_day": null,
      "calories_kcal_per_day": null,
      "glycemic_load_per_day": null,
      "average_meal_quality_score": null
    }
  },
  "ai_copilot_context": {
    "response_guidance": {
      "tone": "Empathetic, supportive, and informative. Acknowledge the patient's efforts while clearly outlining concerns and recommendations.",
      "avoid_topics": [
        "Medical advice without a disclaimer. Always recommend consulting with their assigned doctor (Samarth Gupta, Endocrinologist).",
        "Making definitive diagnoses; instead, present findings as potential indicators requiring professional medical review.",
        "Overly technical jargon; simplify explanations for better understanding.",
        "Unsolicited opinions on lifestyle choices; focus on data-driven observations and collaborative goal-setting."
      ],
      "cultural_context": "India (based on timezone and name). Be mindful of potential cultural nuances regarding health, family, and dietary practices. Use clear, respectful language.",
      "language_preference": "English (en)"
    },
    "executive_summary_for_llm": "Patient Neha Aggarwal, 37, female, with a history of Gestational Diabetes, is presenting with several concerning clinical signals. Key issues include elevated HbA1c (5.7%) and fasting glucose (94.56 mg/dL), high cholesterol levels (LDL 225.55 mg/dL, Total Cholesterol 338.86 mg/dL, Triglycerides 274.27 mg/dL), and a potentially significant elevation in TSH (371.2 µIU/mL) with low T3/T4, suggestive of hypothyroidism. There's also a noted low hemoglobin (9.0 g/dL), indicating potential anemia. Medication adherence for 'Gluxit Trio 500/5mg' is reported as 0.0%. Recent face scans indicate declining wellness and worsening stress. On a positive note, blood pressure is within the elevated but acceptable range (120/80 mmHg), and BMI is normal (24.9). The patient's primary goal is Longevity & overall health, with other goals including managing weight, improving performance, and managing chronic conditions.",
    "conversation_starters_for_agent": [
      "I've noticed some recent lab results and health trends that I'd like to discuss with you. Would you be open to reviewing them together?",
      "We have some important updates regarding your health metrics, including your blood sugar levels, cholesterol, and thyroid function. Are you available to talk about these now?",
      "Your medication adherence and recent wellness trends from your face scan are areas we should focus on. Would you like to explore this further?",
      "Given your history of gestational diabetes and the recent lab findings, I'd like to discuss strategies to manage your blood sugar and cholesterol more effectively. Is this something you're ready to talk about?"
    ],
    "suitable_for_realtime_conversation": true,
    "contraindications_and_safety_alerts": [
      {
        "alert": "Potential Hypothyroidism",
        "context": "TSH is significantly elevated at 371.2 µIU/mL with low T3 and T4, strongly suggesting primary hypothyroidism. This requires urgent medical evaluation and management.",
        "severity": "high"
      },
      {
        "alert": "High Cardiovascular Risk",
        "context": "Patient presents with significantly elevated LDL cholesterol, total cholesterol, and triglycerides, indicating a high risk for cardiovascular disease.",
        "severity": "high"
      },
      {
        "alert": "Elevated HbA1c and Fasting Glucose",
        "context": "HbA1c is 5.7% and fasting glucose is 94.56 mg/dL, which, combined with a history of gestational diabetes, indicates a high risk for developing type 2 diabetes and suboptimal glycemic control.",
        "severity": "high"
      },
      {
        "alert": "Low Hemoglobin",
        "context": "Hemoglobin is 9.0 g/dL, which is below the normal range and suggests potential anemia, which can cause fatigue.",
        "severity": "moderate"
      },
      {
        "alert": "Zero Medication Adherence",
        "context": "Adherence rate for 'Gluxit Trio 500/5mg' is 0.0%, posing a significant risk to diabetes management.",
        "severity": "moderate"
      }
    ]
  },
  "glucometer_profile": {
    "device_name": "test",
    "is_connected": true,
    "last_reading": {
      "slot": "Pre Lunch",
      "timestamp": 1761207311,
      "value_mgdl": 140
    },
    "averages_mgdl": {
      "last_7_days": null,
      "last_14_days": null,
      "last_30_days": null,
      "all_available": 147.78571428571428
    },
    "readings_total": 14,
    "flagged_readings": [
      {
        "flag": "HIGH",
        "slot": "Post Lunch",
        "timestamp": 1729081800,
        "value_mgdl": 190
      },
      {
        "flag": "HIGH",
        "slot": "Post Lunch",
        "timestamp": 1760689800,
        "value_mgdl": 195
      },
      {
        "flag": "HIGH",
        "slot": "Post Dinner",
        "timestamp": 1760806800,
        "value_mgdl": 200
      },
      {
        "flag": "HIGH",
        "slot": "Post Dinner",
        "timestamp": 1760891400,
        "value_mgdl": 220
      },
      {
        "flag": "HIGH",
        "slot": "Post Lunch",
        "timestamp": 1761032700,
        "value_mgdl": 200
      }
    ],
    "glucose_target_range": "70-180",
    "previous_reading_same_slot": null,
    "slot_averages_all_time_mgdl": {
      "Fasting": 114.83333333333333,
      "Pre Lunch": 140,
      "Post Lunch": 195,
      "Post Dinner": 185,
      "Pre Breakfast": 100
    }
  },
  "lab_results_profile": {
    "latest_report": {
      "kidney": {
        "urea": {
          "ref": "15.00 - 40.00",
          "unit": "mg/dL",
          "value": 22.43,
          "status": "NORMAL"
        },
        "sodium": {
          "ref": "136.00 - 146.00",
          "unit": "mEq/L",
          "value": 135.66,
          "status": "NORMAL"
        },
        "albumin": {
          "ref": "3.50 - 5.20",
          "unit": "g/dL",
          "value": 4.25,
          "status": "NORMAL"
        },
        "chloride": {
          "ref": "101.00 - 109.00",
          "unit": "mEq/L",
          "value": 101.91,
          "status": "NORMAL"
        },
        "potassium": {
          "ref": "3.50 - 5.10",
          "unit": "mEq/L",
          "value": 4.32,
          "status": "NORMAL"
        },
        "uric_acid": {
          "ref": "2.60 - 6.00",
          "unit": "mg/dL",
          "value": 4.13,
          "status": "NORMAL"
        },
        "creatinine": {
          "ref": "0.51 - 0.95",
          "unit": "mg/dL",
          "value": 0.69,
          "status": "NORMAL"
        },
        "phosphorus": {
          "ref": "2.40 - 4.40",
          "unit": "mg/dL",
          "value": 3.02,
          "status": "NORMAL"
        },
        "a_to_g_ratio": {
          "ref": "NA",
          "unit": "NA",
          "value": 1.25,
          "status": "NORMAL"
        },
        "gfr_category": {
          "ref": "NA",
          "unit": "NA",
          "value": "G1",
          "status": "NORMAL"
        },
        "gfr_estimated": {
          "ref": ">59",
          "unit": "mL/min/1.73m2",
          "value": 114,
          "status": "NORMAL"
        },
        "total_protein": {
          "ref": "6.40 - 8.30",
          "unit": "g/dL",
          "value": 7.66,
          "status": "NORMAL"
        },
        "calcium,_total": {
          "ref": "8.60 - 10.30",
          "unit": "mg/dL",
          "value": 9.41,
          "status": "NORMAL"
        },
        "urea_nitrogen_blood": {
          "ref": "6.00 - 20.00",
          "unit": "mg/dL",
          "value": 10.47,
          "status": "NORMAL"
        },
        "bun/creatinine_ratio": {
          "ref": "NA",
          "unit": "NA",
          "value": 15,
          "status": "NORMAL"
        },
        "globulin_(calculated)": {
          "ref": "2.0 - 3.5",
          "unit": "gm/dL",
          "value": 3.41,
          "status": "NORMAL"
        }
      },
      "lipids": {
        "triglycerides": {
          "ref": "<150.00",
          "unit": "mg/dL",
          "value": 274.27,
          "status": "NORMAL"
        },
        "hdl_cholesterol": {
          "ref": ">50.00",
          "unit": "mg/dL",
          "value": 58.46,
          "status": "NORMAL"
        },
        "ldl_cholesterol": {
          "ref": "<100.00",
          "unit": "mg/dL",
          "value": 225.55,
          "status": "NORMAL"
        },
        "vldl_cholesterol": {
          "ref": "<30.00",
          "unit": "mg/dL",
          "value": 54.85,
          "status": "NORMAL"
        },
        "cholesterol_total": {
          "ref": "<200.00",
          "unit": "mg/dL",
          "value": 338.86,
          "status": "NORMAL"
        },
        "non_hdl_cholesterol": {
          "ref": "<130",
          "unit": "mg/dL",
          "value": 280,
          "status": "NORMAL"
        }
      },
      "glucose": {},
      "report_id": "6a16a2c8e6b1680a51acd2e2",
      "hematology": {
        "mch": {
          "ref": "27.00 - 32.00",
          "unit": "pg",
          "value": 26.4,
          "status": "NORMAL"
        },
        "mcv": {
          "ref": "83.00 - 101.00",
          "unit": "fL",
          "value": 83,
          "status": "NORMAL"
        },
        "rdw": {
          "ref": "11.60 - 14.00",
          "unit": "%",
          "value": 17.5,
          "status": "NORMAL"
        },
        "tsh": {
          "ref": "0.27 - 4.20",
          "unit": "µIU/mL",
          "value": 371.2,
          "status": "NORMAL"
        },
        "ggtp": {
          "ref": "<38",
          "unit": "U/L",
          "value": 17,
          "status": "NORMAL"
        },
        "iron": {
          "ref": "NA",
          "unit": "NA",
          "value": "NA",
          "status": "NORMAL"
        },
        "mchc": {
          "ref": "31.50 - 34.50",
          "unit": "g/dL",
          "value": 31.9,
          "status": "NORMAL"
        },
        "tibc": {
          "ref": "NA",
          "unit": "NA",
          "value": "NA",
          "status": "NORMAL"
        },
        "uibc": {
          "ref": "NA",
          "unit": "NA",
          "value": "NA",
          "status": "NORMAL"
        },
        "hba1c": {
          "ref": "4.00 - 5.60",
          "unit": "%",
          "value": 5.7,
          "status": "NORMAL"
        },
        "albumin": {
          "ref": "3.50 - 5.20",
          "unit": "g/dL",
          "value": 4.25,
          "status": "NORMAL"
        },
        "rbc_count": {
          "ref": "3.80 - 4.80",
          "unit": "mill/mm3",
          "value": 3.42,
          "status": "NORMAL"
        },
        "t3,_total": {
          "ref": "0.80 - 2.00",
          "unit": "ng/mL",
          "value": 0.59,
          "status": "NORMAL"
        },
        "t4,_total": {
          "ref": "5.10 - 14.10",
          "unit": "µg/dL",
          "value": 1.85,
          "status": "NORMAL"
        },
        "alt_(sgpt)": {
          "ref": "<35",
          "unit": "U/L",
          "value": 23.7,
          "status": "NORMAL"
        },
        "ast_(sgot)": {
          "ref": "<35",
          "unit": "U/L",
          "value": 42.5,
          "status": "NORMAL"
        },
        "vitamin_b12": {
          "ref": "211.00 - 946.00",
          "unit": "pg/mL",
          "value": 213.8,
          "status": "NORMAL"
        },
        "a_to_g_ratio": {
          "ref": "NA",
          "unit": "NA",
          "value": 1.25,
          "status": "NORMAL"
        },
        "total_protein": {
          "ref": "6.40 - 8.30",
          "unit": "g/dL",
          "value": 7.66,
          "status": "NORMAL"
        },
        "platelet_count": {
          "ref": "150.00 - 410.00",
          "unit": "thou/mm3",
          "value": 180,
          "status": "NORMAL"
        },
        "bilirubin_total": {
          "ref": "0.30 - 1.20",
          "unit": "mg/dL",
          "value": 0.4,
          "status": "NORMAL"
        },
        "glucose_fasting": {
          "ref": "70.00 - 100.00",
          "unit": "mg/dL",
          "value": 94.56,
          "status": "NORMAL"
        },
        "hemoglobin_(hb)": {
          "ref": "12.00 - 15.00",
          "unit": "g/dL",
          "value": 9,
          "status": "NORMAL"
        },
        "bilirubin_direct": {
          "ref": "<0.2",
          "unit": "mg/dL",
          "value": 0.07,
          "status": "NORMAL"
        },
        "bilirubin_indirect": {
          "ref": "<1.10",
          "unit": "mg/dL",
          "value": 0.33,
          "status": "NORMAL"
        },
        "vitamin_d,_25_hydroxy": {
          "ref": "75.00 - 250.00",
          "unit": "nmol/L",
          "value": 27.64,
          "status": "NORMAL"
        },
        "transferrin_saturation": {
          "ref": "NA",
          "unit": "NA",
          "value": "NA",
          "status": "NORMAL"
        },
        "alkaline_phosphatase_(alp)": {
          "ref": "30 - 120",
          "unit": "U/L",
          "value": 58.73,
          "status": "NORMAL"
        }
      },
      "report_date": "13-03-2024",
      "report_name": "report 1",
      "uploaded_at": 1738301650,
      "electrolytes": {},
      "critical_flags": [],
      "report_summary": null,
      "has_critical_values": false
    },
    "total_uploaded": 1,
    "previous_report_comparison": null
  },
  "medications_profile": {
    "adherence_trend": "stable",
    "active_medications": [
      {
        "name": "Gluxit Trio 500/5mg",
        "added_by": "patient",
        "frequency": "everyday",
        "intake_times": [
          "08:00 AM",
          "08:00 PM"
        ],
        "medication_id": "689ad2ee0b470a07aef0a3af",
        "last_taken_epoch": null,
        "start_date_epoch": 1754976949
      }
    ],
    "adherence_all_time": {
      "taken": 0,
      "missed": 7,
      "total_history_entries": 7,
      "adherence_rate_percent": 0
    },
    "inactive_medications": [
      {
        "name": "Gluxit Trio 500M",
        "added_by": "patient",
        "frequency": "everyday",
        "intake_times": [
          "08:00 AM",
          "08:00 PM"
        ],
        "medication_id": "689ad292087edd817506e8cc",
        "reason_inactive": "deactivated by patient",
        "deactivated_epoch": 1754976948
      }
    ]
  },
  "blood_pressure_profile": {
    "trend": null,
    "averages": {
      "last_7_days": {
        "systolic": null,
        "diastolic": null
      },
      "last_30_days": {
        "systolic": null,
        "diastolic": null
      }
    },
    "target_range": "< 130/80 mmHg",
    "emergency_flag": false,
    "data_quality_note": null,
    "last_valid_reading": {
      "status": "ELEVATED",
      "added_by": "patient",
      "systolic": 120,
      "diastolic": 80,
      "timestamp": 1776921760,
      "bp_validated": true
    },
    "total_valid_readings": 5,
    "previous_valid_reading": {
      "systolic": 22,
      "diastolic": 3,
      "timestamp": 1776835412
    },
    "total_readings_available": 5,
    "invalid_readings_discarded": 0
  },
  "derived_health_signals": {
    "clinical_insights": {
      "recent_wins": [
        {
          "achievement": "Blood Pressure within Normal Limits",
          "description": "The patient's last recorded blood pressure reading was 120/80 mmHg, which is within the target range (< 130/80 mmHg) and categorized as 'ELEVATED' but not hypertensive."
        },
        {
          "achievement": "Normal BMI Category",
          "description": "The patient's BMI is 24.9, which falls within the 'Normal' category (18.5 - 24.9)."
        }
      ],
      "key_concerns": [
        {
          "title": "Elevated HbA1c and Fasting Glucose",
          "severity": "high",
          "description": "The patient's HbA1c is 5.7%, which is slightly above the normal range (4.00 - 5.60%). Additionally, the fasting glucose of 94.56 mg/dL is at the upper limit of the normal range (70.00 - 100.00 mg/dL). Given a history of Gestational Diabetes, these values indicate a potential risk for developing type 2 diabetes or poor glycemic control."
        },
        {
          "title": "High Cholesterol Levels",
          "severity": "high",
          "description": "The patient has significantly elevated LDL cholesterol (225.55 mg/dL), total cholesterol (338.86 mg/dL), triglycerides (274.27 mg/dL), and VLDL cholesterol (54.85 mg/dL), all exceeding their respective reference ranges. This puts the patient at a high risk for cardiovascular disease."
        },
        {
          "title": "Low Hemoglobin",
          "severity": "moderate",
          "description": "The patient's hemoglobin level is 9.0 g/dL, which is below the normal range (12.00 - 15.00 g/dL). While not critically low, it suggests a potential for anemia, which can lead to fatigue and other health issues."
        },
        {
          "title": "Potential Thyroid Dysfunction",
          "severity": "moderate",
          "description": "TSH levels are significantly elevated at 371.2 µIU/mL, and T3 and T4 levels are low. This pattern is highly suggestive of primary hypothyroidism, which requires further investigation and management."
        },
        {
          "title": "Inconsistent Medication Adherence",
          "severity": "moderate",
          "description": "The adherence rate for the 'Gluxit Trio 500/5mg' medication is 0.0%, indicating that the medication has not been taken as prescribed. This is concerning, especially given the history of gestational diabetes and potential for developing type 2 diabetes."
        },
        {
          "title": "Recent Declining Wellness and Worsening Stress",
          "severity": "moderate",
          "description": "The face scan data shows a declining wellness trend and worsening stress levels between the two scans, suggesting potential impact on overall health and well-being."
        }
      ],
      "behavioral_flags": [
        {
          "behavior": "Inconsistent Glucose Monitoring",
          "recommendation": "Consider increasing the frequency of blood glucose monitoring, especially before and after meals, to better understand glucose fluctuations and their correlation with diet and activity. Ensure all readings are logged."
        },
        {
          "behavior": "Potential Dietary Impact on Glucose and Lipids",
          "recommendation": "Review dietary logs for high-glycemic foods and saturated/trans fats, which may be contributing to elevated glucose and lipid levels. Focus on a balanced diet rich in fiber, lean proteins, and healthy fats."
        },
        {
          "behavior": "Inconsistent Medication Intake",
          "recommendation": "Emphasize the importance of adhering to prescribed medication schedules for diabetes management. Explore potential barriers to adherence and discuss strategies with the care team."
        },
        {
          "behavior": "Managing Stress and Wellness",
          "recommendation": "Incorporate stress-management techniques and ensure adequate sleep to improve wellness and autonomic balance, as indicated by the face scan trends."
        }
      ]
    },
    "metabolic_health_scores": {
      "anaemia_risk": "low",
      "diabetes_control": "poor",
      "cardiovascular_risk": "high",
      "metabolic_health_score": 45,
      "lifestyle_quality_score": 40
    }
  },
  "weight_and_composition_profile": {
    "trend_available": {
      "note": null,
      "trend": "decreasing",
      "weight_change_kg": -3,
      "body_fat_change_percent": null
    },
    "all_measurements": [
      {
        "bmi": 24.9,
        "whr": 0,
        "timestamp": 1754977138,
        "weight_kg": 70,
        "muscle_mass_kg": null,
        "body_fat_percent": 0
      },
      {
        "bmi": 24.9,
        "whr": 0,
        "timestamp": 1760607519,
        "weight_kg": 70,
        "muscle_mass_kg": null,
        "body_fat_percent": 0
      },
      {
        "bmi": 26.1,
        "whr": 0.93,
        "timestamp": 1760607720,
        "weight_kg": 73,
        "muscle_mass_kg": 45.8,
        "body_fat_percent": 32.5
      },
      {
        "bmi": 26,
        "whr": 0,
        "timestamp": 1760607795,
        "weight_kg": 73,
        "muscle_mass_kg": null,
        "body_fat_percent": 0
      },
      {
        "bmi": 24.9,
        "whr": 0,
        "timestamp": 1760607835,
        "weight_kg": 70,
        "muscle_mass_kg": null,
        "body_fat_percent": 0
      }
    ],
    "latest_measurement": {
      "bmi": 24.9,
      "whr": 0,
      "bmr_kcal": 0,
      "weight_kg": 70,
      "measured_at": 1760607835,
      "bmi_category": "Normal",
      "muscle_mass_kg": null,
      "body_fat_percent": 0
    }
  }
};
