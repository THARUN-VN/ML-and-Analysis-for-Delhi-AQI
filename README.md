# Delhi AQI — Spatiotemporal Intelligence & Machine Learning Platform

An environmental data intelligence and machine learning platform analyzing **2,049,930 hourly records** across **44 air quality monitoring stations** in the Delhi National Capital Region (NCR) from **2021 through 2026**.

The platform provides a **3D Spatiotemporal Digital Twin**, an **interactive PM2.5 live simulator**, an **11-model regression benchmark**, a **SHAP explainability lab**, and **environmental distribution diagnostics**.

---

## 🚀 Quick Start

Start the local server with standard Python (no external dependencies required):

```bash
python dashboard/server.py
```

Open your browser at:
```
http://127.0.0.1:8000
```

> **Instant Cold Start**: The platform includes a pre-warmed summary cache (`dashboard/summary_cache.json`). The server and UI initialize in **~30 milliseconds** rather than re-streaming the 295 MB CSV.

## Deploy to Vercel

Import this repository in Vercel with the project root set to the repository root and the framework preset set to **Other**. No build command or environment variables are required. Vercel serves the dashboard and visualization assets statically and runs the overview, model metadata, and prediction endpoints as Python serverless functions. The large source datasets and saved model files are excluded from deployment; the dashboard uses its included summary cache and prediction coefficients.

---

## 🏛️ Platform Architecture & Pages

### 1. 🛰️ Executive Air Intelligence Overview
- **Live CPCB Air Quality Index (NAQI)** meter with official breakpoint classification:
  - 🟢 **Good** (0–30 µg/m³ PM2.5 / AQI 0–50)
  - 🟡 **Satisfactory** (31–60 µg/m³ / AQI 51–100)
  - 🟠 **Moderate** (61–90 µg/m³ / AQI 101–200)
  - 🔴 **Poor** (91–120 µg/m³ / AQI 201–300)
  - 🟣 **Very Poor** (121–250 µg/m³ / AQI 301–400)
  - 🟤 **Severe** (>250 µg/m³ / AQI 401–500+)
- **Interactive Multi-Pollutant Trend Trajectory**: High-precision SVG visualization supporting PM2.5, PM10, multi-year zoom (6M, 12M, 24M, All), and NAAQS safe threshold lines.
- **Hotspot Stations Leaderboard**: Ranked Delhi monitoring stations (Anand Vihar, Jahangirpuri, Wazirpur, Bawana, etc.) with progress indicators and sample coverage.
- **Meteorological Inversion Dynamics**: Scientific breakdown of how boundary layer collapse, calm wind speed (<1 m/s), and high nighttime relative humidity catalyze Delhi's winter smog.

### 2. 🌐 3D Spatiotemporal Digital Twin (Revamped 3D Model)
- **Dual Visual Modes**:
  - **Volumetric Columns**: Beveled towers mapped to particulate concentration with official CPCB color gradient and emissive hazard glow.
  - **Pollution Surface Topography**: Displaced 3D continuous landscape mesh illustrating spatial-temporal pollution waves flowing across Delhi NCR.
- **Camera Presets & Smooth Orbit**:
  - `3D Angle` (Isometric perspective)
  - `Top-Down` (Matrix heatmap)
  - `Side Profile` (Temporal progression)
  - `Front` (Cross-station comparison)
- **Chronological Time Scanner & Timeline Player**:
  - Interactive playback stepping through the seasons.
  - Visualizes the severe winter spike (October–January) versus the monsoonal washout (July–August).
- **Holographic 3D HUD Tooltip**: Raycasted real-time inspection showing station name, month, PM2.5, AQI hazard grade, and observed vs baseline seasonal forecast.

### 3. 🧪 Regression Benchmark & Model Hub
Comprehensive evaluation matrix across **11 architectures** trained on the Delhi dataset:

| Model Architecture | Model Family | Test R² | Test MAE | Test RMSE | Train R² | Key Characteristic |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Feedforward Neural Network (FNN)** | Deep Learning (PyTorch) | **0.999** | **1.72 µg/m³** | **2.56** | 0.999 | Multi-layer perceptron with Adam optimizer |
| **Random Forest Regressor (RFR)** | Tree Ensemble | **1.000** | **0.00 µg/m³** | **0.00** | 1.000 | 100 bagged trees with full feature coverage |
| **Decision Tree Regressor (DTR)** | Tree-based | **0.791** | **31.60 µg/m³** | **46.85** | 0.789 | Best generalizer (tight train-test alignment) |
| **Linear Regression (OLS)** | Linear | **0.787** | **32.36 µg/m³** | **47.28** | 0.788 | Standard baseline with 18 environmental features |
| **Ridge Regression (L2)** | Linear Regularized | **0.787** | **32.36 µg/m³** | **47.28** | 0.788 | Controls particulate & precursor collinearity |
| **Lasso Regression (L1)** | Linear Sparse | **0.787** | **32.31 µg/m³** | **47.30** | 0.788 | Sparse feature attribution |
| **Bagged Linear Regression (BLR)** | Bootstrap Ensemble | **0.787** | **32.36 µg/m³** | **47.29** | 0.788 | 5-estimator variance reduction |
| **Bagged Ridge Regression** | Bootstrap Ensemble | **0.787** | **32.36 µg/m³** | **47.28** | 0.788 | Bootstrap aggregation over L2 estimators |
| **Bagged Lasso Regression** | Bootstrap Ensemble | **0.787** | **32.31 µg/m³** | **47.30** | 0.788 | Bootstrap aggregation over L1 estimators |
| **AdaBoost Regressor (ABR)** | Boosting Ensemble | **0.751** | **36.94 µg/m³** | **51.14** | 0.749 | Adaptive sequential error boosting |
| **Gradient Boosting Regressor (GBR)** | Boosting Ensemble | **0.546** | **50.77 µg/m³** | **69.03** | 0.547 | 100 stage additive boosted trees |

- **Publication Figures Gallery**: Interactive modal view of `1_model_atlas.png`, `2_generalization_bump.png`, `3_error_ridgeline.png`, and `4_bias_variance_topography.png`.

### 4. 🎛️ Live PM2.5 Simulator & AQI Forecaster
- Interactive real-time sliders for all 18 parameters (PM10, CO, NO2, NOx, NH3, SO2, Ozone, Benzene, Toluene, Temperature, Humidity, Wind Speed, Solar Radiation, Month).
- One-click scenario presets:
  - 💥 *Delhi Winter Smog Peak (Nov/Dec)*: PM10=420, Temp=9.5°C, RH=92%, Wind=0.3 m/s -> Severe Grade
  - 🌧️ *Monsoon Wash (July/Aug)*: PM10=55, Temp=32°C, RH=75%, Wind=4.2 m/s -> Satisfactory Grade
  - 🌸 *Spring Baseline (March)*: Moderate AQI
  - 🚗 *Heavy Ring-Road Rush Hour*: High NO2, CO, Benzene, PM10
- Dynamic calculation of top contributing drivers and health advisory warnings.

### 5. 🔍 Explainability & SHAP Analysis Lab
- Multi-model inspection across **Linear Regression**, **Lasso**, **Decision Tree (DTR)**, and **PyTorch Neural Network (FNN)**.
- 4 SHAP diagnostic views:
  - **Global Feature Importance**: Macro-level impact ranking
  - **SHAP Beeswarm Distribution**: Directionality (high vs low feature impact)
  - **Individual Prediction Waterfall**: Step-by-step feature addition
  - **SHAP Bar Summary**: Mean absolute SHAP impact
- Analytical findings on PM10 mechanical collinearity, temperature inversion suppression, and VOC proxies (CO, Benzene).

### 6. 📊 Spatial & Seasonal Pattern Observatory
- **Spatial PM10 Hotspots**: Location rankings and spatial seasonal maps.
- **Multivariate Pearson Correlation Heatmap**: Dark and light theme matrix explorer.
- **19-Feature Empirical Distribution Gallery**: Histograms and Kernel Density Estimation (KDE) plots for all monitoring parameters.

---

## 📁 Repository Structure

```
ML and Analysis for Delhi AQI/
├── dashboard/
│   ├── app.jsx                 # Full React 18 UI with 6 interactive pages & 3D Twin
│   ├── index.html              # HTML shell loading Three.js, Lucide, Babel, Fonts
│   ├── server.py               # Multi-threaded Python server with API endpoints
│   ├── styles.css              # Cyber-environmental dark design system
│   └── summary_cache.json      # Pre-computed summary cache for 30ms startup
├── distributions_clean/        # Normalized clean copies of all 19 feature distribution plots
├── final_data/
│   └── delhi_air_quality_merged.csv  # 295 MB merged dataset (2,049,930 records)
├── models/                     # Saved scikit-learn models (LR, Ridge, Lasso, DTR, RFR, etc.)
├── Pollution_Visualizations/   # PM10 ranking, seasonal pattern, and spatial distribution plots
├── raw_data/                   # Source station CSV exports from DPCC / CPCB / IITM
├── SHAP_Images/                # 16 SHAP explainability plots for DTR, FNN, Lasso, LR
├── 1_model_atlas.png           # Polar radar multi-metric atlas
├── 2_generalization_bump.png   # Train-to-test error drift bump chart
├── 3_error_ridgeline.png       # Residual error distribution ridgelines
├── 4_bias_variance_topography.png # Bias-variance trade-off landscape
├── Correlation Matrix_dark.png # Pearson correlation heatmap (dark)
├── Correlation Matrix_light.png# Pearson correlation heatmap (light)
├── model_code.ipynb            # Jupyter research notebook containing ML pipeline & evaluation
└── README.md                   # Project documentation
```

---

## 🛠️ API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/overview` | Returns station summaries, monthly aggregates, latest readings, and source file metrics |
| `GET` | `/api/models` | Returns 11-model benchmark matrix, weights, SHAP catalog, and visualization paths |
| `GET / POST` | `/api/predict` | Computes PM2.5 prediction, CPCB AQI sub-index, and feature contribution drivers |
| `GET` | `/assets/<path>` | Safely serves project images and artifacts with proper MIME types and caching |
