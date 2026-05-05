from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import numpy as np
import joblib
import os

app = Flask(__name__)
CORS(app)  # allow React dev server on :3000

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH   = os.path.join(BASE, "data", "coral_clean.csv")
MODELS_PATH = os.path.join(BASE, "models")

# ── Load once at startup ───────────────────────────────────────────────────────
print("Loading data...")
df = pd.read_csv(DATA_PATH, parse_dates=["date"])

print("Loading models...")
clf_pipeline   = joblib.load(os.path.join(MODELS_PATH, "clf_pipeline.joblib"))
reg_pipeline   = joblib.load(os.path.join(MODELS_PATH, "reg_pipeline.joblib"))
PRESETS        = joblib.load(os.path.join(MODELS_PATH, "presets.joblib"))
explainer_clf  = joblib.load(os.path.join(MODELS_PATH, "explainer_clf.joblib"))
FEAT_NAMES     = joblib.load(os.path.join(MODELS_PATH, "feature_names.joblib"))

FEATURES = ["ssta_dhw","ssta_frequency","ssta","sst","depth_m",
            "bleaching_level","exposure","ocean"]

# ── Pre-compute static data ───────────────────────────────────────────────────
eco_stats = (
    df.groupby("ecoregion").agg(
        n               = ("percent_bleaching", "count"),
        avg_bleaching   = ("percent_bleaching", "mean"),
        avg_dhw         = ("ssta_dhw",          "mean"),
        avg_ssta        = ("ssta",              "mean"),
        avg_sst         = ("sst",               "mean"),
        avg_depth       = ("depth_m",           "mean"),
        avg_freq        = ("ssta_frequency",    "mean"),
        peak_pct        = ("percent_bleaching", "max"),
        lat             = ("latitude",          "mean"),
        lon             = ("longitude",         "mean"),
        ocean           = ("ocean",   lambda x: x.mode()[0]),
        realm           = ("realm",   lambda x: x.mode()[0]),
        exposure        = ("exposure",lambda x: x.mode()[0]),
    )
    .query("n >= 20")
    .reset_index()
    .round(2)
)

yearly = (
    df.groupby("year").agg(
        avg_bleaching = ("percent_bleaching", "mean"),
        avg_dhw       = ("ssta_dhw",          "mean"),
        avg_ssta      = ("ssta",              "mean"),
        n             = ("percent_bleaching", "count"),
    )
    .reset_index()
    .round(3)
)

print(f"Ready — {len(eco_stats)} reefs, {len(df):,} observations")

# ── Helpers ───────────────────────────────────────────────────────────────────
def predict(vals: dict) -> dict:
    X    = pd.DataFrame([vals])[FEATURES]
    prob = float(clf_pipeline.predict_proba(X)[:, 1][0])
    if prob >= 0.5:
        severity = float(np.expm1(reg_pipeline.predict(X)[0]).clip(0, 100))
    else:
        severity = 0.0
    return {"probability": round(prob, 3), "severity": round(severity, 1)}

def get_severity_level(pct: float) -> dict:
    levels = [
        (0,  10,  "healthy",   "🟢", "Healthy",
         "Coral is thriving. Temperatures are within normal range."),
        (10, 25,  "stressed",  "🟡", "Stressed",
         "Coral is under mild heat stress. Early bleaching signs may appear."),
        (25, 50,  "bleaching", "🟠", "Bleaching",
         "Active bleaching. Corals are expelling their symbiotic algae."),
        (50, 80,  "severe",    "🔴", "Severe",
         "Severe bleaching. Prolonged stress at this level leads to coral death."),
        (80, 101, "critical",  "⚫", "Critical",
         "Widespread coral mortality expected if stress continues."),
    ]
    for lo, hi, key, icon, label, desc in levels:
        if lo <= pct < hi:
            return {"key": key, "icon": icon, "label": label, "description": desc}
    return {"key": "critical", "icon": "⚫", "label": "Critical",
            "description": levels[-1][5]}

# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/api/reefs")
def get_reefs():
    """All ecoregions with their average conditions — for dropdown + map."""
    return jsonify(eco_stats.to_dict(orient="records"))


@app.route("/api/timeseries")
def get_timeseries():
    """Yearly averages for the temporal chart."""
    return jsonify(yearly.to_dict(orient="records"))


@app.route("/api/presets")
# Note: no longer consumed by the frontend Explorer panel — presets are now
# displayed as static "Key moments" cards on the Science page.
def get_presets():
    """Historical scenario presets with descriptions."""
    descriptions = {
        "El Niño 1998 (Indian Ocean)":
            "The most devastating bleaching event in recorded history — 16% of the world's corals died.",
        "El Niño 2016 (Great Barrier Reef)":
            "The second mass bleaching in two years. Two-thirds of shallow corals in the northern GBR died.",
        "Healthy reef":
            "Normal conditions in a healthy, well-protected reef. What the ocean used to look like.",
        "Red Sea (resilient)":
            "The Red Sea hosts unusually heat-tolerant corals that survive conditions that kill others.",
        "Caribbean 2005 event":
            "Record temperatures bleached over 80% of corals across the Caribbean in a single season.",
    }
    result = []
    for name, vals in PRESETS.items():
        pred = predict(vals)
        result.append({
            "name":        name,
            "description": descriptions.get(name, ""),
            "values":      vals,
            "prediction":  pred,
            "severity":    get_severity_level(pred["severity"]),
        })
    return jsonify(result)


@app.route("/api/predict", methods=["POST"])
def api_predict():
    """
    POST { ssta_dhw, ssta_frequency, ssta, sst, depth_m,
           bleaching_level, exposure, ocean }
    → { probability, severity, severity_level, plain_text, historical_context }
    """
    body = request.get_json(force=True)

    # Validate required fields
    missing = [f for f in FEATURES if f not in body]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    try:
        vals = {f: body[f] for f in FEATURES}
        pred = predict(vals)
        pct  = pred["severity"]

        # Historical context — observations in same ocean with similar DHW
        dhw   = float(body["ssta_dhw"])
        ocean = str(body["ocean"])
        similar = df[
            df["ssta_dhw"].between(max(0, dhw - 1.5), dhw + 1.5) &
            (df["ocean"] == ocean)
        ]
        historical = None
        if len(similar) >= 10:
            historical = {
                "n":       int(len(similar)),
                "ocean":   ocean,
                "avg_pct": round(float(similar["percent_bleaching"].mean()), 1),
            }

        # Plain-English sentence
        if pct == 0:
            plain = "Under these conditions, bleaching is unlikely."
        elif pct < 10:
            plain = f"About 1 in {max(2, int(100 / max(pct, 1)))} corals would show early bleaching signs."
        elif pct < 50:
            plain = f"Roughly {pct:.0f}% of corals in this area would bleach — a significant event."
        else:
            plain = f"Over half the corals ({pct:.0f}%) would bleach — a mass bleaching event."

        return jsonify({
            **pred,
            "severity_level":     get_severity_level(pct),
            "plain_text":         plain,
            "historical_context": historical,
            "dhw_context": (
                "Minimal thermal stress — healthy conditions expected."       if dhw < 1 else
                "Mild stress — watch for early bleaching signs."               if dhw < 4 else
                "Bleaching threshold exceeded — significant bleaching likely." if dhw < 8 else
                "Mortality threshold — severe bleaching and coral death likely."
            ),
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/shap", methods=["POST"])
def api_shap():
    body = request.get_json(force=True)
    try:
        X    = pd.DataFrame([{f: body[f] for f in FEATURES}])[FEATURES]
        pre  = clf_pipeline.named_steps["pre"]
        X_t  = pre.transform(X)
        shap_vals = explainer_clf.shap_values(X_t)[0]
        abs_vals  = np.abs(shap_vals)
        max_val   = abs_vals.max() if abs_vals.max() > 0 else 1
        normalized = (abs_vals / max_val).tolist()
        return jsonify({"importance": dict(zip(FEAT_NAMES, normalized))})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "reefs": len(eco_stats), "observations": len(df)})


if __name__ == "__main__":
    app.run(debug=True, port=5001)
