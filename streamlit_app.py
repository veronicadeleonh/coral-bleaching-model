import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
import joblib
import pydeck as pdk
import warnings
warnings.filterwarnings("ignore")

# ── Page config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Coral Bleaching Monitor",
    page_icon="🪸",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ── Custom CSS ────────────────────────────────────────────────────────────────
st.markdown("""
<style>
    .block-container { padding-top: 1.5rem; padding-bottom: 1rem; }
    h1 { font-size: 1.6rem !important; font-weight: 600 !important; }
    h2 { font-size: 1.15rem !important; font-weight: 600 !important; margin-top: 1.2rem !important; }
    h3 { font-size: 1rem !important; font-weight: 600 !important; }
    .metric-card {
        background: #f8f9fa; border-radius: 10px;
        padding: 14px 18px; margin-bottom: 8px;
        border: 1px solid #e9ecef;
    }
    .stTabs [data-baseweb="tab"] { font-size: 0.9rem; font-weight: 500; }
    .severity-badge {
        display: inline-block; padding: 6px 16px;
        border-radius: 20px; font-weight: 600;
        font-size: 1rem; margin-bottom: 8px;
    }
    .sev-none    { background: #d4edda; color: #155724; }
    .sev-low     { background: #fff3cd; color: #856404; }
    .sev-medium  { background: #fde8d8; color: #8a3a00; }
    .sev-high    { background: #f8d7da; color: #721c24; }
    .sev-severe  { background: #c0392b; color: #fff; }
    .preset-pill {
        display: inline-block; cursor: pointer;
        border: 1px solid #dee2e6; border-radius: 20px;
        padding: 4px 12px; font-size: 0.82rem;
        margin: 3px; background: #fff;
        transition: all 0.2s;
    }
</style>
""", unsafe_allow_html=True)

# ── Load data & models ────────────────────────────────────────────────────────
@st.cache_data
def load_data():
    df = pd.read_csv("data/coral_clean.csv", parse_dates=["date"])
    return df

@st.cache_resource
def load_models():
    clf = joblib.load("models/clf_pipeline.joblib")
    reg = joblib.load("models/reg_pipeline.joblib")
    pre = joblib.load("models/presets.joblib")
    # SHAP explainers require the shap package — load lazily so the rest
    # of the app works even if shap isn't installed in this environment.
    try:
        import shap  # noqa: F401  (just verify it's importable)
        e_c = joblib.load("models/explainer_clf.joblib")
        e_r = joblib.load("models/explainer_reg.joblib")
    except (ImportError, Exception):
        e_c, e_r = None, None
    return clf, reg, e_c, e_r, pre

df = load_data()
clf_pipeline, reg_pipeline, explainer_clf, explainer_reg, PRESETS = load_models()

FEATURES   = ["ssta_dhw","ssta_frequency","ssta","sst","depth_m","bleaching_level","exposure","ocean"]
NUM_FEATS  = ["ssta_dhw","ssta_frequency","ssta","sst","depth_m"]
CAT_FEATS  = ["bleaching_level","exposure","ocean"]
FEAT_NAMES = NUM_FEATS + CAT_FEATS

FEAT_LABELS = {
    "ssta_dhw":        "Degree Heating Weeks (DHW)",
    "ssta_frequency":  "SSTA frequency",
    "ssta":            "SST anomaly (°C)",
    "sst":             "Sea surface temp (°C)",
    "depth_m":         "Depth (m)",
    "bleaching_level": "Measurement level",
    "exposure":        "Reef exposure",
    "ocean":           "Ocean basin",
}

def predict_bleaching(X_input: pd.DataFrame) -> dict:
    X    = X_input.reset_index(drop=True)
    prob = clf_pipeline.predict_proba(X)[:, 1]
    blch = prob >= 0.5
    sev  = np.full(len(X), np.nan)
    if blch.any():
        sev[blch] = np.expm1(reg_pipeline.predict(X[blch])).clip(0, 100)
    return {
        "bleached":    blch,
        "probability": prob,
        "severity":    sev,
        "final":       np.where(blch, sev, 0.0)
    }

def severity_label(pct):
    if pct == 0:   return "No bleaching", "sev-none"
    if pct < 10:   return "Low",          "sev-low"
    if pct < 30:   return "Moderate",     "sev-medium"
    if pct < 60:   return "High",         "sev-high"
    return             "Severe",           "sev-severe"

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("## 🪸 Coral Bleaching Monitor")
    st.markdown("---")
    page = st.radio(
        "Navigation",
        ["🗺️ Global Map", "📈 Exploration", "🔬 Live Predictor"],
        label_visibility="collapsed"
    )
    st.markdown("---")
    st.markdown(
        "**Dataset:** 23,203 observations · 1980–2020 · "
        "5 ocean basins\n\n"
        "**Model:** XGBoost two-stage pipeline\n"
        "Stage 1: bleaching classifier\n"
        "Stage 2: severity regressor"
    )
    st.markdown("---")
    st.caption("Built with Streamlit · Data: Global Coral Reef Monitoring")

# ═══════════════════════════════════════════════════════════════════════════════
# PAGE 1 — GLOBAL MAP
# ═══════════════════════════════════════════════════════════════════════════════
if page == "🗺️ Global Map":
    st.title("Global Coral Bleaching Distribution")

    # ── Filters
    col1, col2, col3 = st.columns([2, 2, 2])
    with col1:
        year_range = st.slider(
            "Year range", int(df.year.min()), int(df.year.max()),
            (1990, 2020), step=1
        )
    with col2:
        oceans = st.multiselect(
            "Ocean basins", sorted(df.ocean.unique()),
            default=sorted(df.ocean.unique())
        )
    with col3:
        color_by = st.selectbox(
            "Color points by",
            ["% Bleaching", "SST anomaly (SSTA)", "Degree Heating Weeks"]
        )

    col_map = {"% Bleaching": "percent_bleaching",
               "SST anomaly (SSTA)": "ssta",
               "Degree Heating Weeks": "ssta_dhw"}
    col = col_map[color_by]

    filtered = df[
        (df.year >= year_range[0]) &
        (df.year <= year_range[1]) &
        (df.ocean.isin(oceans))
    ].copy()

    # Normalise 0-255 for pydeck color
    vmin, vmax = filtered[col].quantile(0.02), filtered[col].quantile(0.98)
    def to_rgb(val):
        t = np.clip((val - vmin) / max(vmax - vmin, 0.001), 0, 1)
        r = int(59  + t*(239 - 59))
        g = int(130 + t*(68  - 130))
        b = int(246 + t*(68  - 246))
        return [r, g, b, 180]

    filtered["color"] = filtered[col].apply(to_rgb)
    map_data = filtered[["latitude","longitude","percent_bleaching",
                          "ssta","ssta_dhw","ocean","year","depth_m","color"]].copy()

    # ── KPI row
    k1, k2, k3, k4 = st.columns(4)
    k1.metric("Observations", f"{len(filtered):,}")
    k2.metric("Avg bleaching", f"{filtered.percent_bleaching.mean():.1f}%")
    k3.metric("Peak year", str(filtered.groupby('year')['percent_bleaching'].mean().idxmax()))
    k4.metric("Severely bleached", f"{(filtered.percent_bleaching > 50).mean():.1%}")

    # ── Map
    layer = pdk.Layer(
        "ScatterplotLayer",
        data=map_data,
        get_position=["longitude","latitude"],
        get_fill_color="color",
        get_radius=40000,
        radius_min_pixels=3,
        radius_max_pixels=12,
        pickable=True,
    )
    view = pdk.ViewState(latitude=5, longitude=20, zoom=1.4, pitch=0)
    tooltip = {
        "html": "<b>{ocean}</b><br/>Year: {year}<br/>"
                "Bleaching: {percent_bleaching}%<br/>"
                "SSTA: {ssta}°C<br/>DHW: {ssta_dhw}<br/>Depth: {depth_m}m",
        "style": {"background":"white","padding":"8px","border-radius":"6px","font-size":"12px"}
    }
    st.pydeck_chart(pdk.Deck(
        layers=[layer], initial_view_state=view, tooltip=tooltip,
        map_style="mapbox://styles/mapbox/light-v10"
    ))

    # ── Legend
    lc1, lc2 = st.columns([1, 3])
    with lc1:
        st.markdown(f"**Low** → **High** `{color_by}`")
        st.markdown(
            '<div style="height:12px;width:200px;border-radius:6px;'
            'background:linear-gradient(to right,#3b82f6,#f59e0b,#ef4444)"></div>',
            unsafe_allow_html=True
        )

    # ── Ocean breakdown table
    st.markdown("### Average bleaching by ocean basin")
    ocean_stats = (
        filtered.groupby("ocean")["percent_bleaching"]
        .agg(["mean","median","count"])
        .round(2)
        .rename(columns={"mean":"Avg %","median":"Median %","count":"Observations"})
        .sort_values("Avg %", ascending=False)
        .reset_index()
    )
    st.dataframe(ocean_stats, use_container_width=True, hide_index=True)


# ═══════════════════════════════════════════════════════════════════════════════
# PAGE 2 — EXPLORATION
# ═══════════════════════════════════════════════════════════════════════════════
elif page == "📈 Exploration":
    st.title("Data Exploration")
    tab1, tab2, tab3 = st.tabs(["Temporal trends", "Environmental drivers", "Distributions"])

    # ── Tab 1: Temporal
    with tab1:
        yearly = df.groupby("year").agg(
            avg_bleaching=("percent_bleaching","mean"),
            avg_ssta=("ssta","mean"),
            avg_dhw=("ssta_dhw","mean"),
            n=("percent_bleaching","count")
        ).reset_index()

        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=yearly.year, y=yearly.avg_bleaching,
            name="Avg % bleaching", fill="tozeroy",
            line=dict(color="#D85A30", width=2),
            fillcolor="rgba(216,90,48,0.15)"
        ))
        for yr, label in [(1998,"El Niño 1998"),(2016,"El Niño 2016")]:
            fig.add_vline(x=yr, line_dash="dash", line_color="#888780",
                          annotation_text=label, annotation_position="top right")
        fig.update_layout(
            title="Average bleaching % over time",
            xaxis_title="Year", yaxis_title="Avg % bleaching",
            hovermode="x unified", height=350
        )
        st.plotly_chart(fig, use_container_width=True)

        col1, col2 = st.columns(2)
        with col1:
            fig2 = px.line(yearly, x="year", y="avg_ssta", color_discrete_sequence=["#1192e8"],
                           title="Average SST anomaly (SSTA) per year")
            fig2.add_hline(y=0, line_dash="dot", line_color="#888")
            fig2.update_layout(height=280)
            st.plotly_chart(fig2, use_container_width=True)
        with col2:
            fig3 = px.bar(yearly, x="year", y="n", color_discrete_sequence=["#a56eff"],
                          title="Observations per year")
            fig3.update_layout(height=280)
            st.plotly_chart(fig3, use_container_width=True)

        st.info(
            "⚠️ **Sampling note:** data collection grew dramatically after 1998. "
            "Pre-1998 averages are based on very few observations — interpret with caution."
        )

    # ── Tab 2: Drivers
    with tab2:
        col1, col2 = st.columns(2)
        with col1:
            # DHW bins
            df["dhw_bin"] = pd.cut(
                df["ssta_dhw"],
                bins=[-0.1,0,4,8,12,60],
                labels=["0 (no stress)","0–4 DHW","4–8 DHW","8–12 DHW",">12 DHW"]
            )
            dhw_stats = df.groupby("dhw_bin", observed=True)["percent_bleaching"].mean().reset_index()
            fig = px.bar(dhw_stats, x="dhw_bin", y="percent_bleaching",
                         color_discrete_sequence=["#BA7517"],
                         title="Mean bleaching by Degree Heating Weeks threshold",
                         labels={"dhw_bin":"DHW threshold","percent_bleaching":"Mean % bleaching"})
            fig.add_hline(y=4, line_dash="dash", line_color="#D85A30",
                          annotation_text="DHW=4 bleaching threshold")
            fig.update_layout(height=340)
            st.plotly_chart(fig, use_container_width=True)

        with col2:
            # Depth bins
            df["depth_bucket"] = pd.cut(
                df["depth_m"], bins=[0,5,10,20,50],
                labels=["0–5m","5–10m","10–20m","20–50m"]
            )
            dep_stats = df.groupby("depth_bucket", observed=True)["percent_bleaching"].mean().reset_index()
            fig = px.bar(dep_stats, x="depth_bucket", y="percent_bleaching",
                         color_discrete_sequence=["#1D9E75"],
                         title="Mean bleaching by depth",
                         labels={"depth_bucket":"Depth","percent_bleaching":"Mean % bleaching"})
            fig.update_layout(height=340)
            st.plotly_chart(fig, use_container_width=True)

        # Scatter DHW vs bleaching
        sample = df.sample(4000, random_state=42)
        fig = px.scatter(
            sample, x="ssta_dhw", y="percent_bleaching", color="ocean",
            opacity=0.4, trendline="lowess",
            title="DHW vs % bleaching (sample n=4,000)",
            labels={"ssta_dhw":"Degree Heating Weeks","percent_bleaching":"% bleaching"}
        )
        fig.add_vline(x=4, line_dash="dash", line_color="orange",
                      annotation_text="DHW=4 (bleaching threshold)")
        fig.add_vline(x=8, line_dash="dash", line_color="red",
                      annotation_text="DHW=8 (mortality threshold)")
        fig.update_layout(height=380)
        st.plotly_chart(fig, use_container_width=True)

    # ── Tab 3: Distributions
    with tab3:
        col1, col2 = st.columns(2)
        with col1:
            fig = px.histogram(df, x="percent_bleaching", nbins=60,
                               color_discrete_sequence=["#D85A30"],
                               title="Distribution of % bleaching",
                               labels={"percent_bleaching":"% bleaching"})
            fig.update_layout(height=300)
            st.plotly_chart(fig, use_container_width=True)

        with col2:
            ocean_order = df.groupby("ocean")["percent_bleaching"].mean().sort_values(ascending=False).index
            fig = px.box(df, x="ocean", y="percent_bleaching",
                         category_orders={"ocean": list(ocean_order)},
                         color="ocean", title="Bleaching distribution by ocean",
                         labels={"percent_bleaching":"% bleaching","ocean":"Ocean"})
            fig.update_layout(height=300, showlegend=False)
            st.plotly_chart(fig, use_container_width=True)

        fig = px.box(df, x="exposure", y="percent_bleaching", color="bleaching_level",
                     title="Bleaching by exposure and measurement level",
                     labels={"percent_bleaching":"% bleaching","exposure":"Exposure"})
        fig.update_layout(height=340)
        st.plotly_chart(fig, use_container_width=True)


# ═══════════════════════════════════════════════════════════════════════════════
# PAGE 3 — LIVE PREDICTOR
# ═══════════════════════════════════════════════════════════════════════════════
elif page == "🔬 Live Predictor":
    st.title("Live Bleaching Predictor")
    st.markdown(
        "Adjust the environmental conditions using the sliders below, "
        "or load a **historical scenario** to see how the model responds. "
        "The SHAP chart explains *why* the model makes each prediction."
    )

    # ── Presets
    st.markdown("**Historical scenarios:**")
    preset_cols = st.columns(len(PRESETS))
    selected_preset = None
    for i, (name, vals) in enumerate(PRESETS.items()):
        with preset_cols[i]:
            if st.button(name, key=f"preset_{i}", use_container_width=True):
                selected_preset = vals

    st.markdown("---")

    # ── Sliders — initialise from preset or defaults
    defaults = selected_preset or {
        "ssta_dhw": 2.0, "ssta_frequency": 3.0, "ssta": 0.3,
        "sst": 28.0, "depth_m": 8.0,
        "bleaching_level": "Colony", "exposure": "Exposed", "ocean": "Atlantic"
    }
    if selected_preset:
        for k, v in selected_preset.items():
            st.session_state[f"slider_{k}"] = v

    left, right = st.columns([1, 1])

    with left:
        st.markdown("### Environmental conditions")
        ssta_dhw = st.slider(
            "🌡️ Degree Heating Weeks (DHW)",
            0.0, 20.0, float(defaults["ssta_dhw"]), 0.1,
            key="slider_ssta_dhw",
            help="Accumulated thermal stress above the bleaching threshold. DHW ≥ 4 triggers bleaching; DHW ≥ 8 can cause mortality."
        )
        ssta = st.slider(
            "🌊 SST Anomaly — SSTA (°C)",
            -3.0, 5.0, float(defaults["ssta"]), 0.1,
            key="slider_ssta",
            help="How many degrees above the long-term average is the sea surface temperature."
        )
        sst = st.slider(
            "🌡️ Sea Surface Temp (°C)",
            14.0, 37.0, float(defaults["sst"]), 0.1,
            key="slider_sst",
            help="Absolute sea surface temperature in Celsius."
        )
        ssta_frequency = st.slider(
            "📊 SSTA Frequency",
            0.0, 20.0, float(defaults["ssta_frequency"]), 0.5,
            key="slider_ssta_frequency",
            help="How often temperature anomalies occur in this location — chronic vs acute stress."
        )
        depth_m = st.slider(
            "🤿 Depth (m)",
            0.0, 50.0, float(defaults["depth_m"]), 0.5,
            key="slider_depth_m",
            help="Depth of the coral measurement."
        )

        st.markdown("### Site characteristics")
        bleaching_level = st.selectbox(
            "Measurement level",
            ["Colony", "Population"],
            index=0 if defaults["bleaching_level"] == "Colony" else 1,
            key="slider_bleaching_level",
            help="Colony = individual colony survey (tends to target stressed corals). Population = broad survey."
        )
        exposure = st.selectbox(
            "Reef exposure",
            ["Exposed", "Sheltered", "Sometimes"],
            index=["Exposed","Sheltered","Sometimes"].index(defaults["exposure"]),
            key="slider_exposure"
        )
        ocean = st.selectbox(
            "Ocean basin",
            ["Atlantic","Pacific","Indian","Red Sea","Arabian Gulf"],
            index=["Atlantic","Pacific","Indian","Red Sea","Arabian Gulf"].index(defaults["ocean"]),
            key="slider_ocean"
        )

    # ── Run model
    X_input = pd.DataFrame([{
        "ssta_dhw": ssta_dhw, "ssta_frequency": ssta_frequency,
        "ssta": ssta, "sst": sst, "depth_m": depth_m,
        "bleaching_level": bleaching_level, "exposure": exposure, "ocean": ocean
    }])[FEATURES]

    result = predict_bleaching(X_input)
    pct    = float(result["final"][0])
    prob   = float(result["probability"][0])
    label, badge_cls = severity_label(pct)

    with right:
        st.markdown("### Prediction")

        # ── Gauge
        fig_gauge = go.Figure(go.Indicator(
            mode="gauge+number",
            value=round(pct, 1),
            number={"suffix":"%","font":{"size":36}},
            gauge={
                "axis": {"range":[0,100], "tickwidth":1},
                "bar":  {"color":"#D85A30","thickness":0.25},
                "bgcolor": "white",
                "steps": [
                    {"range":[0,10],  "color":"#d4edda"},
                    {"range":[10,30], "color":"#fff3cd"},
                    {"range":[30,60], "color":"#fde8d8"},
                    {"range":[60,100],"color":"#f8d7da"},
                ],
                "threshold": {
                    "line": {"color":"#721c24","width":3},
                    "thickness": 0.75, "value": pct
                }
            }
        ))
        fig_gauge.update_layout(height=260, margin=dict(t=20,b=10,l=30,r=30))
        st.plotly_chart(fig_gauge, use_container_width=True)

        # ── Severity badge + probability
        st.markdown(
            f'<div class="severity-badge {badge_cls}">{label}</div>',
            unsafe_allow_html=True
        )
        st.markdown(f"**Bleaching probability:** {prob:.0%}")

        # ── Context from historical data
        similar = df[
            (df.ssta_dhw.between(max(0, ssta_dhw-1.5), ssta_dhw+1.5)) &
            (df.ocean == ocean)
        ]
        if len(similar) > 10:
            hist_avg = similar.percent_bleaching.mean()
            hist_years = similar.year.value_counts().head(3).index.tolist()
            st.info(
                f"📚 Historical comparison: {len(similar)} observations in the **{ocean}** "
                f"with similar DHW have an average bleaching of **{hist_avg:.1f}%** "
                f"(most common years: {', '.join(map(str, hist_years))})."
            )

        # ── DHW context
        dhw_context = ""
        if ssta_dhw < 1:
            dhw_context = "🟢 DHW below 1 — minimal thermal stress, healthy conditions expected."
        elif ssta_dhw < 4:
            dhw_context = "🟡 DHW between 1–4 — mild stress, watch for early bleaching signs."
        elif ssta_dhw < 8:
            dhw_context = "🟠 DHW between 4–8 — bleaching threshold exceeded, significant bleaching expected."
        else:
            dhw_context = "🔴 DHW above 8 — mortality threshold, severe bleaching and coral death likely."
        st.markdown(dhw_context)

    # ── SHAP explanation
    st.markdown("---")
    st.markdown("### Why this prediction? — SHAP feature contributions")
    st.markdown(
        "SHAP values show how much each feature pushed the prediction up or down "
        "from the model's baseline. Positive = increases bleaching risk; Negative = reduces it."
    )

    if explainer_clf is None:
        st.warning(
            "**SHAP not available** — install it and restart the app to see feature explanations:\n"
            "```\npip install shap\n```"
        )
    else:
        try:
            pre_clf = clf_pipeline.named_steps["pre"]
            X_t = pre_clf.transform(X_input)
            shap_vals = explainer_clf.shap_values(X_t)[0]

            shap_df = pd.DataFrame({
                "Feature": [FEAT_LABELS[f] for f in FEAT_NAMES],
                "SHAP value": shap_vals,
                "Feature value": [
                    f"{X_input[f].values[0]:.2f}" if f in NUM_FEATS
                    else str(X_input[f].values[0])
                    for f in FEAT_NAMES
                ]
            }).sort_values("SHAP value")

            shap_df["color"] = shap_df["SHAP value"].apply(
                lambda v: "#D85A30" if v > 0 else "#1192e8"
            )

            fig_shap = go.Figure(go.Bar(
                x=shap_df["SHAP value"],
                y=shap_df["Feature"],
                orientation="h",
                marker_color=shap_df["color"],
                text=shap_df["Feature value"],
                textposition="outside",
            ))
            fig_shap.update_layout(
                title="SHAP waterfall — Stage 1 classifier",
                xaxis_title="SHAP value (impact on bleaching probability)",
                yaxis_title="",
                height=380,
                margin=dict(l=10, r=80),
                xaxis=dict(zeroline=True, zerolinewidth=1.5, zerolinecolor="#888")
            )
            st.plotly_chart(fig_shap, use_container_width=True)

            # Stage 2 SHAP if bleached
            if result["bleached"][0]:
                st.markdown("**Stage 2 — Severity regressor SHAP** (only runs when bleaching is detected)")
                pre_reg = reg_pipeline.named_steps["pre"]
                X_t2 = pre_reg.transform(X_input)
                shap_vals2 = explainer_reg.shap_values(X_t2)[0]

                shap_df2 = pd.DataFrame({
                    "Feature": [FEAT_LABELS[f] for f in FEAT_NAMES],
                    "SHAP value": shap_vals2,
                }).sort_values("SHAP value")
                shap_df2["color"] = shap_df2["SHAP value"].apply(
                    lambda v: "#D85A30" if v > 0 else "#1192e8"
                )

                fig_shap2 = go.Figure(go.Bar(
                    x=shap_df2["SHAP value"],
                    y=shap_df2["Feature"],
                    orientation="h",
                    marker_color=shap_df2["color"],
                ))
                fig_shap2.update_layout(
                    title="SHAP waterfall — Stage 2 regressor",
                    xaxis_title="SHAP value (impact on bleaching severity)",
                    height=340,
                    margin=dict(l=10, r=40),
                    xaxis=dict(zeroline=True, zerolinewidth=1.5, zerolinecolor="#888")
                )
                st.plotly_chart(fig_shap2, use_container_width=True)

        except Exception as e:
            st.warning(f"SHAP computation failed: {e}")

    st.markdown("---")
    st.caption(
        "Model: XGBoost two-stage pipeline trained on observations before 2016, "
        "evaluated on 2016–2020 (temporal split). "
        "SHAP values from TreeExplainer. "
        "Predictions are probabilistic estimates — not ground truth."
    )
