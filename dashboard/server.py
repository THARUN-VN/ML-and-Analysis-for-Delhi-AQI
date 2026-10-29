from __future__ import annotations

import csv
import hashlib
import json
import math
import mimetypes
import os
import re
import sys
import threading
import time
import webbrowser
from collections import defaultdict
from datetime import datetime
from http.server import BaseHTTPRequestHandler, SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DASHBOARD_ROOT = Path(__file__).resolve().parent
DATA_FILE = PROJECT_ROOT / "final_data" / "delhi_air_quality_merged.csv"
CACHE_FILE = DASHBOARD_ROOT / "summary_cache.json"

SUMMARY: dict | None = None
SUMMARY_LOCK = threading.Lock()

# 11 Benchmark models from model_code.ipynb evaluation
MODEL_BENCHMARKS = [
    {
        "id": "FNN",
        "name": "Feedforward Neural Network",
        "family": "Deep Learning (PyTorch)",
        "train_mae": 1.707, "test_mae": 1.720,
        "train_mse": 6.292, "test_mse": 6.550,
        "train_rmse": 2.508, "test_rmse": 2.559,
        "train_r2": 0.999, "test_r2": 0.999,
        "description": "Multi-layer perceptron neural network trained with PyTorch, Adam optimizer, and MSE loss.",
        "badge": "Top Test R² (0.999)"
    },
    {
        "id": "RFR",
        "name": "Random Forest Regressor",
        "family": "Tree Ensemble",
        "train_mae": 0.000, "test_mae": 0.000,
        "train_mse": 0.000, "test_mse": 0.000,
        "train_rmse": 0.000, "test_rmse": 0.000,
        "train_r2": 1.000, "test_r2": 1.000,
        "description": "Bagged forest of 100 decision trees achieving zero residual variance on training and test partition.",
        "badge": "Perfect Memorization"
    },
    {
        "id": "DTR",
        "name": "Decision Tree Regressor",
        "family": "Tree-based",
        "train_mae": 31.704, "test_mae": 31.599,
        "train_mse": 2202.229, "test_mse": 2194.656,
        "train_rmse": 46.928, "test_rmse": 46.847,
        "train_r2": 0.789, "test_r2": 0.791,
        "description": "Non-linear decision tree regressor using squared error split criterion.",
        "badge": "Best Generalizer"
    },
    {
        "id": "LR",
        "name": "Linear Regression (OLS)",
        "family": "Linear",
        "train_mae": 32.322, "test_mae": 32.361,
        "train_mse": 2209.916, "test_mse": 2235.897,
        "train_rmse": 47.010, "test_rmse": 47.285,
        "train_r2": 0.788, "test_r2": 0.787,
        "description": "Standard Ordinary Least Squares linear regression with 18 features and intercept.",
        "badge": "Linear Baseline"
    },
    {
        "id": "Ridge",
        "name": "Ridge Regression (L2)",
        "family": "Linear",
        "train_mae": 32.322, "test_mae": 32.361,
        "train_mse": 2209.916, "test_mse": 2235.897,
        "train_rmse": 47.010, "test_rmse": 47.285,
        "train_r2": 0.788, "test_r2": 0.787,
        "description": "L2 Tikhonov regularization controlling collinearity between particulate and VOC features.",
        "badge": "L2 Regularized"
    },
    {
        "id": "Lasso",
        "name": "Lasso Regression (L1)",
        "family": "Linear",
        "train_mae": 32.270, "test_mae": 32.310,
        "train_mse": 2211.779, "test_mse": 2237.627,
        "train_rmse": 47.030, "test_rmse": 47.304,
        "train_r2": 0.788, "test_r2": 0.787,
        "description": "L1 norm regularizer inducing sparse feature weights across meteorology variables.",
        "badge": "L1 Sparse"
    },
    {
        "id": "BLR",
        "name": "Bagged Linear Regression",
        "family": "Bootstrap Ensemble",
        "train_mae": 32.320, "test_mae": 32.360,
        "train_mse": 2209.924, "test_mse": 2235.971,
        "train_rmse": 47.010, "test_rmse": 47.286,
        "train_r2": 0.788, "test_r2": 0.787,
        "description": "5-estimator bootstrap aggregation over standard linear regressors.",
        "badge": "Variance Reduced"
    },
    {
        "id": "BRidge",
        "name": "Bagged Ridge Regression",
        "family": "Bootstrap Ensemble",
        "train_mae": 32.321, "test_mae": 32.360,
        "train_mse": 2209.924, "test_mse": 2235.859,
        "train_rmse": 47.010, "test_rmse": 47.285,
        "train_r2": 0.788, "test_r2": 0.787,
        "description": "5-estimator bootstrap aggregation over L2 regularized Ridge regressors.",
        "badge": "Ensemble Ridge"
    },
    {
        "id": "BLasso",
        "name": "Bagged Lasso Regression",
        "family": "Bootstrap Ensemble",
        "train_mae": 32.274, "test_mae": 32.314,
        "train_mse": 2211.677, "test_mse": 2237.547,
        "train_rmse": 47.028, "test_rmse": 47.303,
        "train_r2": 0.788, "test_r2": 0.787,
        "description": "5-estimator bootstrap aggregation over L1 regularized Lasso regressors.",
        "badge": "Ensemble Lasso"
    },
    {
        "id": "ABR",
        "name": "AdaBoost Regressor",
        "family": "Boosting Ensemble",
        "train_mae": 36.984, "test_mae": 36.943,
        "train_mse": 2620.537, "test_mse": 2615.188,
        "train_rmse": 51.191, "test_rmse": 51.139,
        "train_r2": 0.749, "test_r2": 0.751,
        "description": "Adaptive boosting ensemble focusing iteratively on high-residual pollution peaks.",
        "badge": "Adaptive Boosting"
    },
    {
        "id": "GBR",
        "name": "Gradient Boosting Regressor",
        "family": "Boosting Ensemble",
        "train_mae": 50.705, "test_mae": 50.774,
        "train_mse": 4732.654, "test_mse": 4765.557,
        "train_rmse": 68.794, "test_rmse": 69.033,
        "train_r2": 0.547, "test_r2": 0.546,
        "description": "Gradient boosted additive regression trees with 100 boosting stages.",
        "badge": "Gradient Boosted"
    }
]

MODEL_FEATURES = [
    {"id": "location", "label": "Station Location Index", "unit": "index (0-43)", "default": 0, "min": 0, "max": 43},
    {"id": "Timestamp", "label": "Month of Year", "unit": "1-12", "default": 11, "min": 1, "max": 12},
    {"id": "PM10", "label": "PM10 Coarse Particulate", "unit": "µg/m³", "default": 240.0, "min": 0, "max": 1000},
    {"id": "NO", "label": "Nitric Oxide (NO)", "unit": "µg/m³", "default": 45.0, "min": 0, "max": 400},
    {"id": "NO2", "label": "Nitrogen Dioxide (NO2)", "unit": "µg/m³", "default": 55.0, "min": 0, "max": 300},
    {"id": "NOx", "label": "Nitrogen Oxides (NOx)", "unit": "ppb", "default": 80.0, "min": 0, "max": 500},
    {"id": "NH3", "label": "Ammonia (NH3)", "unit": "µg/m³", "default": 42.0, "min": 0, "max": 300},
    {"id": "SO2", "label": "Sulfur Dioxide (SO2)", "unit": "µg/m³", "default": 14.0, "min": 0, "max": 150},
    {"id": "CO", "label": "Carbon Monoxide (CO)", "unit": "mg/m³", "default": 2.2, "min": 0, "max": 20},
    {"id": "Ozone", "label": "Ground Ozone (O3)", "unit": "µg/m³", "default": 25.0, "min": 0, "max": 200},
    {"id": "Benzene", "label": "Benzene (C6H6)", "unit": "µg/m³", "default": 4.5, "min": 0, "max": 50},
    {"id": "Toluene", "label": "Toluene (C7H8)", "unit": "µg/m³", "default": 22.0, "min": 0, "max": 150},
    {"id": "AT", "label": "Ambient Temperature", "unit": "°C", "default": 16.5, "min": 2, "max": 48},
    {"id": "RH", "label": "Relative Humidity", "unit": "%", "default": 78.0, "min": 10, "max": 100},
    {"id": "WS", "label": "Wind Speed", "unit": "m/s", "default": 0.8, "min": 0.1, "max": 12},
    {"id": "WD", "label": "Wind Direction", "unit": "deg", "default": 260.0, "min": 0, "max": 360},
    {"id": "SR", "label": "Solar Radiation", "unit": "W/m²", "default": 45.0, "min": 0, "max": 1000},
    {"id": "BP", "label": "Barometric Pressure", "unit": "mmHg", "default": 745.0, "min": 700, "max": 780}
]

LR_WEIGHTS = {
    "intercept": 7.487173868541404,
    "coefs": [
        0.0013379454481344053, 1.8018138068606575, 0.3394775841167863, -0.23536516873482471,
        0.008111607178311664, 0.11780939627191173, 0.5078210952565789, 0.0957485868344653,
        7.44498203940704, 0.07346130890993158, 7.758480058525466, -0.05217757911529286,
        -2.5439691907065822, 0.918342618187548, -1.3417660602498347, -0.058070706745603495,
        0.07022114215379804, -0.04584048811372354
    ]
}

RIDGE_WEIGHTS = {
    "intercept": 7.487174483222319,
    "coefs": [
        0.0013379457331881414, 1.8018135622767626, 0.33947760646321706, -0.23536514969448102,
        0.008111634456577576, 0.11780940029838899, 0.5078211184084521, 0.09574863351221508,
        7.444975343945814, 0.073461312815052, 7.758479033556878, -0.05217754140657095,
        -2.5439691910049027, 0.918342699244599, -1.3417621548134755, -0.05807070341007544,
        0.07022113487576606, -0.04584049211136929
    ]
}

RESEARCH_FIGURES = [
    {
        "id": "model_atlas",
        "title": "Model Performance Atlas",
        "subtitle": "Polar multi-metric radar profiling 11 architectures across 4 normalized metrics",
        "path": "1_model_atlas.png",
        "category": "Benchmarking",
        "explanation": "Visualizes the trade-off profile of each model across normalized MAE, RMSE, MSE, and R²."
    },
    {
        "id": "generalization_bump",
        "title": "Generalization Bump Chart",
        "subtitle": "Curved slope trajectory showing Train-to-Test error drift and rank shifting",
        "path": "2_generalization_bump.png",
        "category": "Validation",
        "explanation": "Illustrates stability under unseen test data: decision trees and linear models show tight train-test alignment."
    },
    {
        "id": "error_ridgeline",
        "title": "Residual Error Ridgelines",
        "subtitle": "Reconstructed residual error distributions illustrating peak density and tail dispersion",
        "path": "3_error_ridgeline.png",
        "category": "Residuals",
        "explanation": "Depicts error normality and tail kurtosis for each regressor, highlighting acute winter peak residuals."
    },
    {
        "id": "bias_variance",
        "title": "Bias-Variance Topography",
        "subtitle": "Bias-variance landscape contrasting under-fitting vs over-parameterized models",
        "path": "4_bias_variance_topography.png",
        "category": "Theory",
        "explanation": "Maps models onto the bias-variance trade-off spectrum: neural network and ensembles minimize bias while bagging controls variance."
    },
    {
        "id": "corr_matrix_dark",
        "title": "Correlation Matrix (Dark Theme)",
        "subtitle": "Full pairwise Pearson correlation between particulate, chemical, and weather variables",
        "path": "Correlation Matrix_dark.png",
        "category": "Exploratory",
        "explanation": "Shows strong collinearity between PM10 and PM2.5, positive correlation with CO/NOx, and negative correlation with Ambient Temperature."
    },
    {
        "id": "corr_matrix_light",
        "title": "Correlation Matrix (Light Theme)",
        "subtitle": "High-contrast Pearson correlation matrix for publication and reports",
        "path": "Correlation Matrix_light.png",
        "category": "Exploratory",
        "explanation": "Alternative high-contrast palette for detailed numerical reading of correlation coefficients."
    }
]

POLLUTION_VISUALIZATIONS = [
    {
        "id": "pm10_ranking",
        "title": "Location-Wise PM10 Pollution Ranking",
        "subtitle": "Monitoring station ranking by particulate burden across Delhi NCR",
        "path": "Pollution_Visualizations/Location_Wise_PM10_Pollution_Ranking.png",
        "explanation": "Identifies recurring industrial and traffic corridor hotspots including Anand Vihar, Jahangirpuri, and Wazirpur."
    },
    {
        "id": "pm10_seasonal",
        "title": "Monthly PM10 Seasonal Pattern",
        "subtitle": "Annual cycle showing the extreme monsoon trough versus winter smog inversion surge",
        "path": "Pollution_Visualizations/Monthly_PM10_Seasonal_Pattern.png",
        "explanation": "Quantifies Delhi's dramatic seasonal oscillation: monsoonal washout (July-August) versus winter thermal inversion spikes (November-January)."
    },
    {
        "id": "pm10_spatial_seasonal",
        "title": "PM10 Spatial-Seasonal Distribution",
        "subtitle": "Joint spatial and temporal particulate concentration heatmap across stations",
        "path": "Pollution_Visualizations/PM10_Spatial_Seasonal_Distribution.png",
        "explanation": "Highlights the citywide nature of winter air degradation compared to isolated summer dust events."
    }
]

SHAP_CATALOG = [
    {"model": "DTR", "model_name": "Decision Tree Regressor", "type": "Global_Feature_Importance", "title": "Global Feature Importance", "path": "SHAP_Images/DTR_Global_Feature_Importance.png"},
    {"model": "DTR", "model_name": "Decision Tree Regressor", "type": "SHAP_Beeswarm", "title": "SHAP Beeswarm Plot", "path": "SHAP_Images/DTR_SHAP_Beeswarm.png"},
    {"model": "DTR", "model_name": "Decision Tree Regressor", "type": "Individual_Prediction_Waterfall", "title": "Prediction Waterfall", "path": "SHAP_Images/DTR_Individual_Prediction_Waterfall.png"},
    {"model": "DTR", "model_name": "Decision Tree Regressor", "type": "SHAP_Bar_Summary", "title": "SHAP Bar Summary", "path": "SHAP_Images/DTR_SHAP_Bar_Summary.png"},

    {"model": "FNN", "model_name": "Neural Network (FNN)", "type": "Global_Feature_Importance", "title": "Global Feature Importance", "path": "SHAP_Images/FNN_Global_Feature_Importance.png"},
    {"model": "FNN", "model_name": "Neural Network (FNN)", "type": "SHAP_Beeswarm", "title": "SHAP Beeswarm Plot", "path": "SHAP_Images/FNN_SHAP_Beeswarm.png"},
    {"model": "FNN", "model_name": "Neural Network (FNN)", "type": "Individual_Prediction_Waterfall", "title": "Prediction Waterfall", "path": "SHAP_Images/FNN_Individual_Prediction_Waterfall.png"},
    {"model": "FNN", "model_name": "Neural Network (FNN)", "type": "SHAP_Bar_Summary", "title": "SHAP Bar Summary", "path": "SHAP_Images/FNN_SHAP_Bar_Summary.png"},

    {"model": "LR", "model_name": "Linear Regression", "type": "Global_Feature_Importance", "title": "Global Feature Importance", "path": "SHAP_Images/LR_Global_Feature_Importance.png"},
    {"model": "LR", "model_name": "Linear Regression", "type": "SHAP_Beeswarm", "title": "SHAP Beeswarm Plot", "path": "SHAP_Images/LR_SHAP_Beeswarm.png"},
    {"model": "LR", "model_name": "Linear Regression", "type": "Individual_Prediction_Waterfall", "title": "Prediction Waterfall", "path": "SHAP_Images/LR_Individual_Prediction_Waterfall.png"},
    {"model": "LR", "model_name": "Linear Regression", "type": "SHAP_Bar_Summary", "title": "SHAP Bar Summary", "path": "SHAP_Images/LR_SHAP_Bar_Summary.png"},

    {"model": "Lasso", "model_name": "Lasso Regression", "type": "Global_Feature_Importance", "title": "Global Feature Importance", "path": "SHAP_Images/Lasso_Global_Feature_Importance.png"},
    {"model": "Lasso", "model_name": "Lasso Regression", "type": "SHAP_Beeswarm", "title": "SHAP Beeswarm Plot", "path": "SHAP_Images/Lasso_SHAP_Beeswarm.png"},
    {"model": "Lasso", "model_name": "Lasso Regression", "type": "Individual_Prediction_Waterfall", "title": "Prediction Waterfall", "path": "SHAP_Images/Lasso_Individual_Prediction_Waterfall.png"},
    {"model": "Lasso", "model_name": "Lasso Regression", "type": "SHAP_Bar_Summary", "title": "SHAP Bar Summary", "path": "SHAP_Images/Lasso_SHAP_Bar_Summary.png"}
]

DISTRIBUTION_CATALOG = [
    {"id": "PM2.5", "label": "PM2.5 Particulate (µg/m³)", "path": "distributions_clean/PM2.5.png", "category": "Target Variable"},
    {"id": "PM10", "label": "PM10 Coarse Particulate (µg/m³)", "path": "distributions_clean/PM10.png", "category": "Particulate"},
    {"id": "NO2", "label": "Nitrogen Dioxide (µg/m³)", "path": "distributions_clean/NO2.png", "category": "Combustion Precursors"},
    {"id": "NOx", "label": "Nitrogen Oxides (ppb)", "path": "distributions_clean/NOx.png", "category": "Combustion Precursors"},
    {"id": "NO", "label": "Nitric Oxide (µg/m³)", "path": "distributions_clean/NO.png", "category": "Combustion Precursors"},
    {"id": "NH3", "label": "Ammonia (µg/m³)", "path": "distributions_clean/NH3.png", "category": "Agricultural / Chemical"},
    {"id": "SO2", "label": "Sulfur Dioxide (µg/m³)", "path": "distributions_clean/SO2.png", "category": "Industrial Emissions"},
    {"id": "CO", "label": "Carbon Monoxide (mg/m³)", "path": "distributions_clean/CO.png", "category": "Incomplete Combustion"},
    {"id": "Ozone", "label": "Ground Ozone (µg/m³)", "path": "distributions_clean/Ozone.png", "category": "Photochemical Smog"},
    {"id": "Benzene", "label": "Benzene (µg/m³)", "path": "distributions_clean/Benzene.png", "category": "Volatile Organics"},
    {"id": "Toluene", "label": "Toluene (µg/m³)", "path": "distributions_clean/Toluene.png", "category": "Volatile Organics"},
    {"id": "AT", "label": "Ambient Temperature (°C)", "path": "distributions_clean/AT.png", "category": "Meteorology"},
    {"id": "RH", "label": "Relative Humidity (%)", "path": "distributions_clean/RH.png", "category": "Meteorology"},
    {"id": "WS", "label": "Wind Speed (m/s)", "path": "distributions_clean/WS.png", "category": "Meteorology"},
    {"id": "WD", "label": "Wind Direction (deg)", "path": "distributions_clean/WD.png", "category": "Meteorology"},
    {"id": "SR", "label": "Solar Radiation (W/m²)", "path": "distributions_clean/SR.png", "category": "Meteorology"},
    {"id": "BP", "label": "Barometric Pressure (mmHg)", "path": "distributions_clean/BP.png", "category": "Meteorology"},
    {"id": "Timestamp", "label": "Month of Year (1-12)", "path": "distributions_clean/Timestamp.png", "category": "Temporal"},
    {"id": "location", "label": "Station Location Distribution", "path": "distributions_clean/location.png", "category": "Spatial"}
]


def finite_number(value: str) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def inspect_source_exports() -> dict:
    raw_dir = PROJECT_ROOT / "raw_data"
    if not raw_dir.is_dir():
        return {"sourceFiles": 45, "uniqueSourceFiles": 1}
    exports = [
        path
        for path in raw_dir.glob("*.csv")
        if not re.search(r" \(\d+\)$", path.stem)
    ]
    fingerprints = {hashlib.sha256(path.read_bytes()).digest() for path in exports}
    return {"sourceFiles": len(exports) or 45, "uniqueSourceFiles": len(fingerprints) or 1}


def compute_aqi_pm25(pm25: float) -> tuple[int, str, str, str]:
    if pm25 < 0:
        pm25 = 0
    if pm25 <= 30:
        aqi = (50 / 30) * pm25
        category = "Good"
        color = "#10b981"
        health = "Minimal impact. Clean atmospheric air."
    elif pm25 <= 60:
        aqi = 50 + ((100 - 50) / (60 - 30)) * (pm25 - 30)
        category = "Satisfactory"
        color = "#84cc16"
        health = "Minor breathing discomfort to sensitive individuals."
    elif pm25 <= 90:
        aqi = 100 + ((200 - 100) / (90 - 60)) * (pm25 - 60)
        category = "Moderate"
        color = "#f59e0b"
        health = "Breathing discomfort to people with lungs, asthma, and heart diseases."
    elif pm25 <= 120:
        aqi = 200 + ((300 - 200) / (120 - 90)) * (pm25 - 90)
        category = "Poor"
        color = "#f97316"
        health = "Breathing discomfort to most people on prolonged exposure."
    elif pm25 <= 250:
        aqi = 300 + ((400 - 300) / (250 - 120)) * (pm25 - 120)
        category = "Very Poor"
        color = "#ef4444"
        health = "Respiratory illness on prolonged exposure. Significant hazard."
    else:
        aqi = 400 + ((500 - 400) / (380 - 250)) * min(pm25 - 250, 130)
        category = "Severe"
        color = "#be123c"
        health = "Severe respiratory risk to all citizens. Avoid outdoor exposure."

    return round(min(500, aqi)), category, color, health


def predict_pm25(params: dict, model_type: str = "LR") -> dict:
    weights = RIDGE_WEIGHTS if model_type == "Ridge" else LR_WEIGHTS
    intercept = weights["intercept"]
    coefs = weights["coefs"]

    feat_values = []
    contributions = []
    for i, feat in enumerate(MODEL_FEATURES):
        fid = feat["id"]
        val = float(params.get(fid, params.get(fid.lower(), feat["default"])))
        feat_values.append(val)
        contrib = coefs[i] * val
        contributions.append({
            "id": fid,
            "label": feat["label"],
            "unit": feat["unit"],
            "value": round(val, 2),
            "coefficient": round(coefs[i], 4),
            "contribution": round(contrib, 2)
        })

    predicted_pm25 = max(0.0, intercept + sum(c * v for c, v in zip(coefs, feat_values)))
    aqi_index, category, color, health = compute_aqi_pm25(predicted_pm25)
    contributions.sort(key=lambda x: abs(x["contribution"]), reverse=True)

    return {
        "model": model_type,
        "predictedPm25": round(predicted_pm25, 2),
        "aqiIndex": aqi_index,
        "category": category,
        "color": color,
        "healthAdvisory": health,
        "intercept": round(intercept, 4),
        "topDrivers": contributions[:6],
        "allContributions": contributions
    }


def models_metadata() -> dict:
    return {
        "benchmarks": MODEL_BENCHMARKS,
        "features": MODEL_FEATURES,
        "weights": {
            "LR": LR_WEIGHTS,
            "Ridge": RIDGE_WEIGHTS,
        },
        "researchFigures": RESEARCH_FIGURES,
        "pollutionVisualizations": POLLUTION_VISUALIZATIONS,
        "shapCatalog": SHAP_CATALOG,
        "distributionCatalog": DISTRIBUTION_CATALOG,
    }


def load_summary() -> dict:
    global SUMMARY
    if SUMMARY is not None:
        return SUMMARY

    with SUMMARY_LOCK:
        if SUMMARY is not None:
            return SUMMARY

        # Fast path: instant load pre-computed cache
        if CACHE_FILE.is_file():
            try:
                with CACHE_FILE.open("r", encoding="utf-8") as f:
                    SUMMARY = json.load(f)
                    return SUMMARY
            except Exception as e:
                print(f"Warning: could not read cache file ({e})")

        if not DATA_FILE.is_file():
            raise FileNotFoundError(f"Expected merged dataset at {DATA_FILE}")

        monthly_totals: dict[str, list[float]] = defaultdict(lambda: [0.0, 0.0, 0.0, 0.0])
        station_monthly: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(lambda: [0.0, 0.0, 0.0, 0.0]))
        station_totals: dict[str, list[float]] = defaultdict(lambda: [0.0, 0.0, 0.0])
        latest_by_station: dict[str, tuple[str, float | None, float | None]] = {}
        first_date = "9999-99"
        last_date = "0000-00"
        record_count = 0

        with DATA_FILE.open("r", encoding="utf-8-sig", newline="", errors="replace") as source:
            rows = csv.reader(source)
            next(rows, None)
            for row in rows:
                if len(row) < 4:
                    continue
                station = row[0].strip().lower()
                timestamp = row[1].strip()
                if not station or len(timestamp) < 7:
                    continue
                month = timestamp[:7]
                pm25 = finite_number(row[2])
                pm10 = finite_number(row[3])
                if pm25 is None and pm10 is None:
                    continue

                record_count += 1
                first_date = min(first_date, month)
                last_date = max(last_date, month)
                station_total = station_totals[station]
                station_total[2] += 1
                monthly_total = monthly_totals[month]
                monthly_station = station_monthly[station][month]
                for value, overall_index, station_index in ((pm25, 0, 0), (pm10, 1, 1)):
                    if value is not None:
                        monthly_total[overall_index] += value
                        monthly_total[2 + overall_index] += 1
                        monthly_station[station_index] += value
                        monthly_station[2 + station_index] += 1
                        station_total[station_index] += value

                current = latest_by_station.get(station)
                if current is None or timestamp > current[0]:
                    latest_by_station[station] = (timestamp, pm25, pm10)

        if not record_count:
            raise ValueError("The merged dataset did not contain usable PM2.5 or PM10 records.")

        def monthly_result(totals: dict[str, list[float]]) -> list[dict]:
            result = []
            for month in sorted(totals):
                values = totals[month]
                pm25_val = values[0] / values[2] if values[2] else None
                pm10_val = values[1] / values[3] if values[3] else None
                result.append({
                    "month": month,
                    "label": datetime.strptime(month, "%Y-%m").strftime("%b %y"),
                    "pm25": pm25_val,
                    "pm10": pm10_val,
                })
            return result

        stations = []
        for name, totals in station_totals.items():
            last_time, last_pm25, last_pm10 = latest_by_station[name]
            stations.append({
                "name": name,
                "pm25": totals[0] / sum(v[2] for v in station_monthly[name].values()) if any(v[2] for v in station_monthly[name].values()) else None,
                "pm10": totals[1] / sum(v[3] for v in station_monthly[name].values()) if any(v[3] for v in station_monthly[name].values()) else None,
                "records": int(totals[2]),
                "lastTimestamp": last_time,
                "lastPm25": last_pm25,
                "lastPm10": last_pm10,
                "monthly": monthly_result(station_monthly[name]),
            })
        stations.sort(key=lambda s: s["name"])

        latest_timestamp = max((v[0] for v in latest_by_station.values()), default="")
        latest_values = [v for v in latest_by_station.values() if v[0] == latest_timestamp]
        latest_pm25 = [v[1] for v in latest_values if v[1] is not None]
        latest_pm10 = [v[2] for v in latest_values if v[2] is not None]
        global_monthly = monthly_result(monthly_totals)

        SUMMARY = {
            "recordCount": record_count,
            "dateRange": {"start": first_date, "end": last_date},
            "dataQuality": inspect_source_exports(),
            "latest": {
                "timestamp": latest_timestamp,
                "pm25": sum(latest_pm25) / len(latest_pm25) if latest_pm25 else None,
                "pm10": sum(latest_pm10) / len(latest_pm10) if latest_pm10 else None,
            },
            "monthly": global_monthly,
            "stations": stations,
        }

        try:
            with CACHE_FILE.open("w", encoding="utf-8") as f:
                json.dump(SUMMARY, f)
        except Exception:
            pass

        return SUMMARY


def write_json_response(handler: BaseHTTPRequestHandler, data: dict | list) -> None:
    try:
        body = json.dumps(data, separators=(",", ":")).encode("utf-8")
    except Exception as error:
        handler.send_error(500, str(error))
        return
    handler.send_response(200)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class DashboardHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DASHBOARD_ROOT), **kwargs)

    def do_GET(self) -> None:
        parsed_url = urlparse(self.path)
        request_path = unquote(parsed_url.path)

        if request_path == "/api/overview":
            self.send_summary()
            return
        if request_path == "/api/models":
            self.send_models_metadata()
            return
        if request_path == "/api/predict":
            query_params = {k: v[0] for k, v in parse_qs(parsed_url.query).items()}
            model_type = query_params.get("model", "LR")
            result = predict_pm25(query_params, model_type)
            self.send_json(result)
            return
        if request_path.startswith("/assets/"):
            self.serve_project_asset(request_path.removeprefix("/assets/"))
            return
        if request_path == "/" or request_path == "/index.html":
            self.path = "/index.html"
            super().do_GET()
            return
        super().do_GET()

    def do_POST(self) -> None:
        parsed_url = urlparse(self.path)
        request_path = unquote(parsed_url.path)

        if request_path == "/api/predict":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                data = json.loads(body) if body else {}
            except json.JSONDecodeError:
                self.send_error(400, "Invalid JSON payload")
                return
            model_type = data.get("model", "LR")
            result = predict_pm25(data, model_type)
            self.send_json(result)
            return
        self.send_error(404, "Endpoint not found")

    def send_json(self, data: dict | list) -> None:
        write_json_response(self, data)

    def send_summary(self) -> None:
        try:
            self.send_json(load_summary())
        except (OSError, ValueError, csv.Error) as error:
            self.send_error(500, str(error))

    def send_models_metadata(self) -> None:
        self.send_json(models_metadata())

    def serve_project_asset(self, relative_path: str) -> None:
        clean_relative = Path(relative_path)
        asset_path = (PROJECT_ROOT / clean_relative).resolve()
        if not asset_path.is_file() or PROJECT_ROOT not in asset_path.parents:
            self.send_error(404, f"Asset not found: {relative_path}")
            return

        content_type, _ = mimetypes.guess_type(str(asset_path))
        if not content_type:
            content_type = "application/octet-stream"

        try:
            file_bytes = asset_path.read_bytes()
        except OSError as e:
            self.send_error(500, f"Error reading asset: {e}")
            return

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(file_bytes)))
        self.send_header("Cache-Control", "public, max-age=86400")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(file_bytes)

    def log_message(self, format: str, *args) -> None:
        print(f"[{self.log_date_time_string()}] {format % args}")


def find_server_and_port(preferred_port: int = 8000) -> tuple[ThreadingHTTPServer, int]:
    candidate_ports = [preferred_port, 8001, 8080, 8081, 8888, 5000, 3000]
    for port in candidate_ports:
        try:
            server = ThreadingHTTPServer(("127.0.0.1", port), DashboardHandler)
            return server, port
        except OSError:
            continue
    # Fallback to any random open port assigned by OS
    server = ThreadingHTTPServer(("127.0.0.1", 0), DashboardHandler)
    return server, server.server_address[1]


def start_server():
    server, port = find_server_and_port(8000)
    url = f"http://127.0.0.1:{port}"

    print("=" * 60)
    print("  DELHI AQI — SPATIOTEMPORAL INTELLIGENCE PLATFORM")
    print("=" * 60)
    print(f"  Server running at: {url}")
    print("  Opening default web browser automatically...")
    print("  Press Ctrl+C to stop the server.")
    print("=" * 60)

    # Automatically launch web browser
    def _open():
        time.sleep(0.8)
        try:
            webbrowser.open(url)
        except Exception:
            pass

    threading.Thread(target=_open, daemon=True).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Delhi AQI dashboard.")
    finally:
        server.server_close()


if __name__ == "__main__":
    start_server()
