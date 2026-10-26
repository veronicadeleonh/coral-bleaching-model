"""Build the data file the Reef Pulse front end reads.

Inputs (produced by dev-notebooks/02 and 04):
  models/risk_model_v1.json      logistic model (coefficients, scaler, DHW percentiles)
  data/reefs_reefcheck.json      one row per ecoregion (ssta_sd, lat/lon, DHW p90, observed rate)
  data/coral_reefcheck.csv       one row per Reef Check survey

Output:
  client/src/reefpulse/data/reefPulse.json

Run from the project root:  python scripts/build_app_data.py
"""
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
THRESHOLD = 10  # % of corals bleached that counts as "noticeable bleaching"
MIN_SURVEYS = 5  # minimum surveys for a reef-year bar

model = json.loads((ROOT / "models/risk_model_v1.json").read_text())
reefs = json.loads((ROOT / "data/reefs_reefcheck.json").read_text())
surveys = pd.read_csv(ROOT / "data/coral_reefcheck.csv")
surveys = surveys[surveys["year"] >= 2003].copy()
surveys["noticeable"] = surveys["percent_bleaching"] > THRESHOLD


def share_by_year(df, min_n=1):
    out = {}
    for year, g in df.groupby("year"):
        if len(g) >= min_n:
            out[int(year)] = [round(float(g["noticeable"].mean()) * 100, 1), int(len(g))]
    return out


reef_rows = []
for i, r in enumerate(sorted(reefs, key=lambda r: r["ecoregion"])):
    sub = surveys[surveys["ecoregion"] == r["ecoregion"]]
    reef_rows.append({
        "id": i,
        "name": r["ecoregion"],
        "lat": round(r["lat"], 2),
        "lon": round(r["lon"], 2),
        "ocean": r["ocean"],
        "n": int(r["n"]),
        "ssta_sd": r["ssta_sd"],
        "dhw_p90": round(r["dhw_p90"], 1),
        "obs": round(r["observed_rate"] * 100, 1),
        "years": share_by_year(sub, MIN_SURVEYS),
    })

out = {
    "model": model,
    "threshold": THRESHOLD,
    "reefs": reef_rows,
    "global_years": share_by_year(surveys),
    "ssta_sd_quantiles": [round(float(q), 2) for q in surveys["ssta_sd"].quantile([0.1, 0.5, 0.9])],
}
dest = ROOT / "client/src/reefpulse/data/reefPulse.json"
dest.write_text(json.dumps(out, separators=(",", ":")))
print(f"Wrote {dest.relative_to(ROOT)}: {len(reef_rows)} reefs")
