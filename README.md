# 🪸 Coral Bleaching Monitor

Coral bleaching is one of the most visible consequences of ocean warming — but the data behind it is rarely accessible to non-scientists. This project turns 40 years of global observations into an interactive web app where anyone can explore how rising temperatures affect coral reefs around the world.

![Python](https://img.shields.io/badge/Python-3.10+-blue) ![Flask](https://img.shields.io/badge/Flask-3.0+-lightgrey) ![React](https://img.shields.io/badge/React-18-61dafb) ![XGBoost](https://img.shields.io/badge/Model-XGBoost-orange)

---

## What it does

Select a reef, adjust environmental conditions, and see the predicted impact on coral bleaching in real time — or load a historical event like the 1998 El Niño to explore what actually happened.

| Page              | Description                                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| 🌊 Explore Reefs  | Interactive world map + sliders to ask _what if_ — what happens if the ocean warms by 2°C? If thermal stress doubles? |
| 📊 Data & Science | 40 years of bleaching trends, the science behind thermal stress, and how the prediction model works.                  |

---

## Run locally

**Terminal 1 — API:**

```bash
cd api
pip install -r requirements.txt
python app.py
```

**Terminal 2 — Frontend:**

```bash
cd client
npm install
npm start
```

Open `http://localhost:3000`. The React app proxies all `/api/*` calls to Flask on port 5001.

---

## For the curious — how it's built

**Data:** 23,203 coral bleaching observations (1980–2020) across the Atlantic, Pacific, Indian Ocean, Red Sea, and Arabian Gulf, sourced from the [Global Coral Reef Monitoring Network](https://www.kaggle.com/datasets/mehrdat/coral-reef-global-bleaching).

**Model:** A two-stage XGBoost pipeline — first predicting whether bleaching occurs (classifier), then estimating severity (regressor). Trained on pre-2016 data, evaluated on 2016–2020. The strongest predictors are Degree Heating Weeks (DHW) and sea surface temperature anomaly (SSTA) — consistent with 40 years of marine biology research.

**Stack:** Flask API · React + Recharts + Leaflet · scikit-learn · XGBoost · SHAP

```
├── dev-notebooks/          # Data cleaning, EDA, model training
├── data/                   # Cleaned dataset (23,203 rows)
├── models/                 # Serialized XGBoost pipelines + SHAP explainers
├── api/                    # Flask REST API
└── client/                 # React frontend
```

---

_Built to make climate science accessible — you don't need to be a marine biologist to understand what's happening to coral reefs._
