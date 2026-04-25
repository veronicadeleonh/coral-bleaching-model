# 🪸 Coral Bleaching Monitor

An end-to-end data science project exploring global coral bleaching patterns from 1980 to 2020, including an interactive Streamlit dashboard with a live predictive model.

![Python](https://img.shields.io/badge/Python-3.10+-blue) ![Streamlit](https://img.shields.io/badge/Streamlit-1.35+-red) ![XGBoost](https://img.shields.io/badge/Model-XGBoost-orange)

---

## What it does

- **Explores** 23,203 coral bleaching observations across 5 ocean basins
- **Predicts** bleaching probability and severity from environmental conditions
- **Explains** predictions using SHAP feature importance
- **Visualises** everything in an interactive web dashboard

## Dashboard pages

| Page              | Description                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 🗺️ Global Map     | Interactive pydeck map coloured by bleaching %, SST anomaly, or DHW. Filter by year and ocean basin.                                                                                 |
| 📈 Exploration    | Temporal trends, El Niño events, DHW thresholds, depth effects, and ocean breakdowns.                                                                                                |
| 🔬 Live Predictor | Adjust environmental sliders and get an instant bleaching prediction with SHAP explanation. Load historical presets (El Niño 1998, 2016 Great Barrier Reef, Healthy reef, and more). |

## Model

Two-stage XGBoost pipeline trained on a temporal split (train: pre-2016, test: 2016–2020):

- **Stage 1 — Classifier:** predicts whether bleaching occurs (binary)
- **Stage 2 — Regressor:** predicts severity (%) on positive cases, using a log1p-transformed target

Key features: `ssta_dhw`, `ssta_frequency`, `ssta`, `sst`, `depth_m`, `bleaching_level`, `exposure`, `ocean`

## Project structure

```
├── data/
│   └── coral_clean.csv          # Cleaned dataset (23,203 rows)
├── models/
│   ├── clf_pipeline.joblib      # Stage 1 classifier + preprocessor
│   ├── reg_pipeline.joblib      # Stage 2 regressor + preprocessor
│   ├── explainer_clf.joblib     # SHAP explainer (classifier)
│   ├── explainer_reg.joblib     # SHAP explainer (regressor)
│   └── presets.joblib           # Historical scenario presets
├── coral_data_cleaning.ipynb    # Data cleaning pipeline
├── coral_eda.ipynb              # Exploratory data analysis
├── coral_model.ipynb            # Model training & evaluation
├── streamlit_app.py             # Dashboard
└── requirements.txt
```

## Run locally

```bash
git clone https://github.com/veronicadeleonh/coral-bleaching-model
cd coral-bleaching-model

pip install -r requirements.txt
streamlit run streamlit_app.py
```

> **Note:** if using Anaconda, install dependencies with `conda install -c conda-forge shap` and `pip install -r requirements.txt` inside your active environment.

## Data source

[Global Coral Reef Monitoring — Kaggle](https://www.kaggle.com/datasets/mehrdat/coral-reef-global-bleaching)

Observations span 1980–2020 across the Atlantic, Pacific, Indian Ocean, Red Sea, and Arabian Gulf.
