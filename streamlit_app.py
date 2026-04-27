import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
import joblib
import pydeck as pdk
import warnings
warnings.filterwarnings("ignore")

st.set_page_config(
    page_title="Coral Bleaching Monitor",
    page_icon="🪸",
    layout="wide",
    initial_sidebar_state="collapsed"
)

st.markdown("""
<style>
    .block-container { padding-top: 2.5rem; padding-bottom: 1rem; max-width: 1200px; }
    h1 { font-size: 1.5rem !important; font-weight: 500 !important; }
    h2 { font-size: 1.05rem !important; font-weight: 500 !important; margin-top: 1rem !important; }
    h3 { font-size: 0.95rem !important; font-weight: 500 !important; }
    .stTabs [data-baseweb="tab"] { font-size: 0.88rem; font-weight: 500; }
    div[data-testid="stMetricValue"] { font-size: 1.6rem; }

    .severity-card {
        border-radius: 12px; padding: 16px 20px;
        margin: 8px 0; text-align: center;
    }
    .sev-healthy  { background:#d4edda; color:#155724; }
    .sev-stressed { background:#fff3cd; color:#856404; }
    .sev-bleaching{ background:#fde8d8; color:#8a3a00; }
    .sev-severe   { background:#f8d7da; color:#721c24; }
    .sev-dead     { background:#2d2d2d; color:#f0f0f0; }

    .sev-icon  { font-size: 2.2rem; margin-bottom: 6px; }
    .sev-label { font-size: 1.1rem; font-weight: 500; margin-bottom: 4px; }
    .sev-desc  { font-size: 0.82rem; opacity: 0.85; line-height: 1.4; }

    .popup-card {
        background: white; border-radius: 10px;
        padding: 14px 16px; border: 1px solid #e9ecef;
        margin-bottom: 10px;
    }
    .stat-row { display:flex; gap:12px; margin-top:8px; flex-wrap:wrap; }
    .stat-box { background:#f8f9fa; border-radius:8px; padding:8px 12px; flex:1; min-width:80px; }
    .stat-val  { font-size:1.1rem; font-weight:500; color:#212529; }
    .stat-lbl  { font-size:0.72rem; color:#6c757d; margin-top:1px; }

    .preset-btn { margin: 3px 0; }
    .nav-btn {
        display:inline-block; padding:6px 14px; border-radius:20px;
        border:1px solid #dee2e6; font-size:0.82rem; cursor:pointer;
        background:white; margin:3px;
    }
    .nav-btn.active { background:#212529; color:white; border-color:#212529; }
</style>
""", unsafe_allow_html=True)

# ── Load ──────────────────────────────────────────────────────────────────────
@st.cache_data
def load_data():
    df = pd.read_csv("data/coral_clean.csv", parse_dates=["date"])
    return df

@st.cache_resource
def load_models():
    clf = joblib.load("models/clf_pipeline.joblib")
    reg = joblib.load("models/reg_pipeline.joblib")
    pre = joblib.load("models/presets.joblib")
    try:
        import shap  # noqa
        e_c = joblib.load("models/explainer_clf.joblib")
        e_r = joblib.load("models/explainer_reg.joblib")
    except Exception:
        e_c, e_r = None, None
    return clf, reg, e_c, e_r, pre

@st.cache_data
def build_eco_stats(df):
    # Group only by ecoregion — avoids duplicates in dropdown when the same
    # ecoregion spans multiple ocean/realm combinations in the raw data.
    stats = df.groupby('ecoregion').agg(
        n=('percent_bleaching','count'),
        avg_bleaching=('percent_bleaching','mean'),
        avg_dhw=('ssta_dhw','mean'),
        avg_ssta=('ssta','mean'),
        avg_sst=('sst','mean'),
        avg_depth=('depth_m','mean'),
        avg_freq=('ssta_frequency','mean'),
        peak_pct=('percent_bleaching','max'),
        lat=('latitude','mean'),
        lon=('longitude','mean'),
        ocean=('ocean', lambda x: x.mode()[0]),
        realm=('realm', lambda x: x.mode()[0]),
        avg_exposure=('exposure', lambda x: x.mode()[0]),
    ).query('n >= 20').reset_index()
    return stats

df = load_data()
clf_pipeline, reg_pipeline, explainer_clf, explainer_reg, PRESETS = load_models()
eco_stats = build_eco_stats(df)

FEATURES  = ["ssta_dhw","ssta_frequency","ssta","sst","depth_m","bleaching_level","exposure","ocean"]
NUM_FEATS = ["ssta_dhw","ssta_frequency","ssta","sst","depth_m"]
CAT_FEATS = ["bleaching_level","exposure","ocean"]
FEAT_NAMES = NUM_FEATS + CAT_FEATS

FEAT_LABELS = {
    "ssta_dhw":        "Thermal stress weeks",
    "ssta_frequency":  "Stress frequency",
    "ssta":            "Temp. above normal (°C)",
    "sst":             "Ocean temperature (°C)",
    "depth_m":         "Depth (m)",
    "bleaching_level": "Measurement level",
    "exposure":        "Reef exposure",
    "ocean":           "Ocean basin",
}

SEVERITY_LEVELS = [
    (0,   10,  "🟢", "Healthy",   "sev-healthy",
     "Coral is thriving. Temperatures are within normal range and bleaching is unlikely."),
    (10,  25,  "🟡", "Stressed",  "sev-stressed",
     "Coral is under mild heat stress. Some colonies may show early signs of bleaching."),
    (25,  50,  "🟠", "Bleaching", "sev-bleaching",
     "Active bleaching event. Corals are expelling their symbiotic algae and turning white."),
    (50,  80,  "🔴", "Severe",    "sev-severe",
     "Severe bleaching across the reef. Prolonged stress at this level leads to coral death."),
    (80,  101, "⚫", "Critical",  "sev-dead",
     "Critical conditions. Widespread coral mortality expected if stress continues."),
]

def get_severity(pct):
    for lo, hi, icon, label, cls, desc in SEVERITY_LEVELS:
        if lo <= pct < hi:
            return icon, label, cls, desc
    return "⚫", "Critical", "sev-dead", SEVERITY_LEVELS[-1][5]

def predict_bleaching(X_input):
    X    = X_input.reset_index(drop=True)
    prob = clf_pipeline.predict_proba(X)[:, 1]
    blch = prob >= 0.5
    sev  = np.full(len(X), np.nan)
    if blch.any():
        sev[blch] = np.expm1(reg_pipeline.predict(X[blch])).clip(0, 100)
    return {"bleached": blch, "probability": prob,
            "severity": sev, "final": np.where(blch, sev, 0.0)}

# ── Session state defaults ────────────────────────────────────────────────────
if "page" not in st.session_state:
    st.session_state.page = "explore"
if "selected_eco" not in st.session_state:
    st.session_state.selected_eco = None
if "slider_vals" not in st.session_state:
    st.session_state.slider_vals = {
        "ssta_dhw": 2.0, "ssta_frequency": 3.0, "ssta": 0.3,
        "sst": 28.0, "depth_m": 8.0,
        "bleaching_level": "Colony", "exposure": "Exposed", "ocean": "Atlantic"
    }

def load_preset(vals):
    st.session_state.slider_vals = dict(vals)
    st.session_state.page = "explore"

def load_eco(eco_name):
    row = eco_stats[eco_stats.ecoregion == eco_name].iloc[0]
    st.session_state.slider_vals = {
        "ssta_dhw":       round(float(row.avg_dhw), 1),
        "ssta_frequency": round(float(row.avg_freq), 1),
        "ssta":           round(float(row.avg_ssta), 2),
        "sst":            round(float(row.avg_sst), 1),
        "depth_m":        round(float(row.avg_depth), 1),
        "bleaching_level":"Colony",
        "exposure":       str(row.avg_exposure),
        "ocean":          str(row.ocean),
    }
    st.session_state.selected_eco = eco_name
    st.session_state.page = "explore"

# ── Top nav ───────────────────────────────────────────────────────────────────
st.markdown("### 🪸 Coral Bleaching Monitor")
col_nav1, col_nav2, col_nav3 = st.columns([2, 2, 6])
with col_nav1:
    if st.button("🌊 Explore reefs", use_container_width=True,
                 type="primary" if st.session_state.page == "explore" else "secondary"):
        st.session_state.page = "explore"
        st.rerun()
with col_nav2:
    if st.button("📊 Data & science", use_container_width=True,
                 type="primary" if st.session_state.page == "data" else "secondary"):
        st.session_state.page = "data"
        st.rerun()

st.markdown("---")

# ══════════════════════════════════════════════════════════════════════════════
# PAGE 1 — EXPLORE REEFS
# ══════════════════════════════════════════════════════════════════════════════
if st.session_state.page == "explore":

    st.markdown(
        "**Search for a reef** in the dropdown to load its real conditions, then use the sliders "
        "to ask *what if* — what happens if the ocean warms? If thermal stress doubles?"
    )

    left, right = st.columns([3, 2], gap="large")

    # ── LEFT: Map + popup ─────────────────────────────────────────────────────
    with left:

        # Build map data — one point per ecoregion (cleaner than 23k points)
        map_eco = eco_stats.copy()
        map_eco["color"] = map_eco["avg_bleaching"].apply(lambda v: [
            int(59  + min(v/100, 1) * (239 - 59)),
            int(130 + min(v/100, 1) * (68  - 130)),
            int(246 + min(v/100, 1) * (68  - 246)),
            200
        ])
        map_eco["radius"] = map_eco["n"].apply(lambda n: max(80000, min(n * 400, 500000)))
        map_eco["avg_bleaching_str"] = map_eco["avg_bleaching"].apply(lambda x: f"{x:.1f}")

        layer = pdk.Layer(
            "ScatterplotLayer",
            data=map_eco,
            get_position=["lon","lat"],
            get_fill_color="color",
            get_radius="radius",
            radius_min_pixels=5,
            radius_max_pixels=20,
            pickable=True,
        )
        view = pdk.ViewState(latitude=10, longitude=10, zoom=0.8, pitch=0)
        tooltip = {
            "html": "<b>{ecoregion}</b><br/>{ocean}<br/>Avg bleaching: {avg_bleaching_str}%",
            "style": {"background":"white","padding":"8px 10px",
                      "border-radius":"6px","font-size":"12px","color":"#212529"}
        }

        # Ecoregion selector via selectbox (proxy for map click)
        def on_reef_select():
            sel = st.session_state.eco_selector
            if sel and sel != "— search here —":
                load_eco(sel)

        st.selectbox(
            "Or search for a reef:",
            ["— search here —"] + sorted(eco_stats.ecoregion.tolist()),
            index=0,
            key="eco_selector",
            on_change=on_reef_select
        )

        st.pydeck_chart(pdk.Deck(
            layers=[layer], initial_view_state=view, tooltip=tooltip,
            map_style="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
            height=380
        ))

        st.caption("Point size = number of observations. Color: blue → low bleaching, red → high. Use the dropdown above to explore a reef.")

        # ── Popup card when ecoregion selected ───────────────────────────────
        sel_eco = st.session_state.selected_eco
        if sel_eco and sel_eco in eco_stats.ecoregion.values:
            row = eco_stats[eco_stats.ecoregion == sel_eco].iloc[0]
            icon, label, cls, desc = get_severity(row.avg_bleaching)

            st.markdown(f"""
            <div class="popup-card">
                <div style="font-size:1rem;font-weight:500;color:#212529;margin-bottom:2px;">
                    {sel_eco}
                </div>
                <div style="font-size:0.8rem;color:#6c757d;margin-bottom:10px;">
                    {row.ocean} · {row.realm}
                </div>
                <div class="stat-row">
                    <div class="stat-box">
                        <div class="stat-val">{row.avg_bleaching:.0f}%</div>
                        <div class="stat-lbl">avg bleaching</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-val">{row.avg_sst:.1f}°C</div>
                        <div class="stat-lbl">ocean temp</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-val">{row.avg_dhw:.1f}</div>
                        <div class="stat-lbl">thermal stress wks</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-val">{int(row.n):,}</div>
                        <div class="stat-lbl">observations</div>
                    </div>
                </div>
            </div>
            """, unsafe_allow_html=True)

            if st.button(f"🔬 Explore this reef →", use_container_width=True, type="primary"):
                load_eco(sel_eco)
                st.rerun()

    # ── RIGHT: Sliders + prediction ───────────────────────────────────────────
    with right:

        if st.session_state.selected_eco:
            st.markdown(f"**Exploring:** {st.session_state.selected_eco}")
        else:
            st.markdown("**What if conditions were...**")

        # ── Preset selector — rendered BEFORE sliders so click updates values first
        preset_descriptions = {
            "El Niño 1998 (Indian Ocean)":       "The most devastating bleaching event in recorded history — 16% of the world's corals died.",
            "El Niño 2016 (Great Barrier Reef)": "The second mass bleaching event in two years killed two-thirds of shallow corals in the northern GBR.",
            "Healthy reef":                      "Normal conditions in a healthy, well-protected reef. What the ocean used to look like.",
            "Red Sea (resilient)":               "The Red Sea hosts unusually heat-tolerant corals that can survive conditions that kill others.",
            "Caribbean 2005 event":              "Record sea temperatures bleached over 80% of corals across the Caribbean in a single season.",
        }
        preset_clicked = None
        with st.expander("Load a historical scenario", expanded=False):
            for name, vals in PRESETS.items():
                col_a, col_b = st.columns([2, 1])
                with col_a:
                    st.markdown(
                        f"<div style='font-size:0.82rem;font-weight:500;color:var(--color-text-primary)'>{name}</div>"
                        f"<div style='font-size:0.75rem;color:#6c757d;margin-bottom:6px'>{preset_descriptions.get(name,'')}</div>",
                        unsafe_allow_html=True
                    )
                with col_b:
                    if st.button("Load", key=f"preset_{name}", use_container_width=True):
                        preset_clicked = (name, vals)

        # Apply preset click OUTSIDE expander then rerun — this is the only reliable pattern
        if preset_clicked:
            st.session_state.slider_vals = dict(preset_clicked[1])
            st.session_state.selected_eco = None
            st.rerun()

        # Read current values (after any preset may have been applied)
        v = st.session_state.slider_vals

        st.markdown("#### Adjust conditions")

        ssta_dhw = st.slider(
            "🌡️ Thermal stress (weeks above threshold)",
            0.0, 20.0, float(v["ssta_dhw"]), 0.1,
            help="How many weeks the ocean has been dangerously warm. Above 4 weeks triggers bleaching. Above 8 weeks can kill coral."
        )
        ssta = st.slider(
            "🌊 Temperature above normal (°C)",
            -3.0, 5.0, float(v["ssta"]), 0.1,
            help="How many degrees warmer the ocean is compared to the long-term average for this location."
        )
        sst = st.slider(
            "🌡️ Ocean temperature (°C)",
            14.0, 37.0, float(v["sst"]), 0.1,
            help="The actual sea surface temperature. Most reef corals live between 23–29°C."
        )
        ssta_frequency = st.slider(
            "📊 How often temperatures spike",
            0.0, 20.0, float(v["ssta_frequency"]), 0.5,
            help="How frequently this location experiences temperature anomalies. Chronic stress is more damaging than occasional spikes."
        )
        depth_m = st.slider(
            "🤿 Depth (m)",
            0.0, 50.0, float(v["depth_m"]), 0.5,
            help="Depth of the coral. Deeper corals are more protected from surface heat but have less access to cooling water movement."
        )

        # Ocean and exposure are set automatically from the selected reef or preset
        # and passed to the model silently — no need to expose them to the user.
        exposure = v.get("exposure", "Exposed")
        ocean    = v.get("ocean", "Atlantic")

        # ── Run model ─────────────────────────────────────────────────────────
        X_input = pd.DataFrame([{
            "ssta_dhw": ssta_dhw, "ssta_frequency": ssta_frequency,
            "ssta": ssta, "sst": sst, "depth_m": depth_m,
            "bleaching_level": "Colony", "exposure": exposure, "ocean": ocean
        }])[FEATURES]

        result  = predict_bleaching(X_input)
        pct     = float(result["final"][0])
        prob    = float(result["probability"][0])
        icon, label, cls, desc = get_severity(pct)

        st.markdown("#### Predicted outcome")

        st.markdown(f"""
        <div class="severity-card {cls}">
            <div class="sev-icon">{icon}</div>
            <div class="sev-label">{label}</div>
            <div style="font-size:1.6rem;font-weight:500;margin:4px 0">{pct:.0f}% bleaching</div>
            <div class="sev-desc">{desc}</div>
        </div>
        """, unsafe_allow_html=True)

        # Plain-English sentence
        if pct == 0:
            sentence = "Under these conditions, bleaching is unlikely."
        elif pct < 10:
            sentence = f"About 1 in {max(2,int(100/max(pct,1)))} corals would show signs of bleaching."
        elif pct < 50:
            sentence = f"Roughly {pct:.0f}% of corals in this area would bleach — a significant event."
        else:
            sentence = f"Over half the corals ({pct:.0f}%) would bleach — a mass bleaching event."

        st.markdown(f"*{sentence}*")

        # DHW context bar
        dhw_pct = min(ssta_dhw / 20, 1.0) * 100
        dhw_color = "#28a745" if ssta_dhw < 4 else ("#ffc107" if ssta_dhw < 8 else "#dc3545")
        st.markdown(f"""
        <div style="margin:10px 0 4px;font-size:0.8rem;color:#6c757d">
            Thermal stress level
        </div>
        <div style="background:#e9ecef;border-radius:6px;height:10px;overflow:hidden;">
            <div style="width:{dhw_pct:.0f}%;background:{dhw_color};height:100%;border-radius:6px;transition:width 0.3s;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:#adb5bd;margin-top:3px;">
            <span>None</span><span>Bleaching threshold (4 wks)</span><span>Mortality (8 wks)</span>
        </div>
        """, unsafe_allow_html=True)

        # Historical comparison
        similar = df[
            (df.ssta_dhw.between(max(0, ssta_dhw - 1.5), ssta_dhw + 1.5)) &
            (df.ocean == ocean)
        ]
        if len(similar) > 10:
            hist_avg = similar.percent_bleaching.mean()
            st.info(
                f"📚 {len(similar)} real observations in the **{ocean}** with similar thermal stress "
                f"averaged **{hist_avg:.0f}%** bleaching historically."
            )


# ══════════════════════════════════════════════════════════════════════════════
# PAGE 2 — DATA & SCIENCE
# ══════════════════════════════════════════════════════════════════════════════
elif st.session_state.page == "data":

    st.markdown(
        "The data and science behind the predictions. "
        "23,203 observations collected between 1980 and 2020 across 5 ocean basins."
    )

    tab1, tab2, tab3 = st.tabs(["📈 40 years of bleaching", "🌊 Environmental drivers", "🤖 How the model works"])

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
            fillcolor="rgba(216,90,48,0.12)"
        ))
        for yr, label in [(1998,"1998 mass bleaching\n(El Niño)"),(2016,"2016 mass bleaching\n(El Niño)")]:
            fig.add_vline(x=yr, line_dash="dash", line_color="#aaa",
                          annotation_text=label, annotation_position="top right",
                          annotation_font_size=11)
        fig.update_layout(
            title="Average coral bleaching over time (1980–2020)",
            xaxis_title="Year", yaxis_title="Avg % bleaching",
            hovermode="x unified", height=340,
            yaxis=dict(ticksuffix="%")
        )
        st.plotly_chart(fig, use_container_width=True)
        st.caption(
            "⚠️ Pre-1998 data is sparse — fewer than 30 observations per year before 1997. "
            "The spike in the 1980s reflects isolated early studies, not necessarily higher bleaching."
        )

        col1, col2 = st.columns(2)
        with col1:
            ocean_order = df.groupby("ocean")["percent_bleaching"].mean().sort_values(ascending=False).index
            fig2 = px.bar(
                df.groupby("ocean")["percent_bleaching"].mean().reset_index().sort_values("percent_bleaching", ascending=False),
                x="ocean", y="percent_bleaching",
                color_discrete_sequence=["#1192e8"],
                title="Average bleaching by ocean",
                labels={"ocean":"","percent_bleaching":"Avg % bleaching"}
            )
            fig2.update_layout(height=280, yaxis=dict(ticksuffix="%"))
            st.plotly_chart(fig2, use_container_width=True)

        with col2:
            eco_top = eco_stats.nlargest(10, "avg_bleaching")
            fig3 = px.bar(
                eco_top, x="avg_bleaching", y="ecoregion", orientation="h",
                color_discrete_sequence=["#D85A30"],
                title="Top 10 most affected ecoregions",
                labels={"avg_bleaching":"Avg % bleaching","ecoregion":""}
            )
            fig3.update_layout(height=340, xaxis=dict(ticksuffix="%"))
            st.plotly_chart(fig3, use_container_width=True)

    with tab2:
        col1, col2 = st.columns(2)
        with col1:
            df["dhw_bin"] = pd.cut(
                df["ssta_dhw"], bins=[-0.1,0,4,8,12,60],
                labels=["0 (no stress)","0–4 weeks","4–8 weeks","8–12 weeks",">12 weeks"]
            )
            dhw_stats = df.groupby("dhw_bin", observed=True)["percent_bleaching"].mean().reset_index()
            fig = px.bar(dhw_stats, x="dhw_bin", y="percent_bleaching",
                         color_discrete_sequence=["#BA7517"],
                         title="Bleaching vs thermal stress duration",
                         labels={"dhw_bin":"Weeks above bleaching threshold",
                                 "percent_bleaching":"Mean % bleaching"})
            fig.add_annotation(x="4–8 weeks", y=dhw_stats[dhw_stats.dhw_bin=="4–8 weeks"]["percent_bleaching"].values[0]+3,
                                text="Bleaching\nthreshold", showarrow=False, font_size=10, font_color="#888")
            fig.update_layout(height=320, yaxis=dict(ticksuffix="%"))
            st.plotly_chart(fig, use_container_width=True)

        with col2:
            df["depth_bucket"] = pd.cut(df["depth_m"], bins=[0,5,10,20,50],
                                         labels=["0–5m","5–10m","10–20m","20–50m"])
            dep_stats = df.groupby("depth_bucket", observed=True)["percent_bleaching"].mean().reset_index()
            fig = px.bar(dep_stats, x="depth_bucket", y="percent_bleaching",
                         color_discrete_sequence=["#1D9E75"],
                         title="Bleaching by depth",
                         labels={"depth_bucket":"Depth","percent_bleaching":"Mean % bleaching"})
            fig.update_layout(height=320, yaxis=dict(ticksuffix="%"))
            st.plotly_chart(fig, use_container_width=True)

        sample = df.sample(3000, random_state=42)
        fig = px.scatter(sample, x="ssta_dhw", y="percent_bleaching", color="ocean",
                         opacity=0.35, trendline="lowess",
                         title="Thermal stress vs bleaching — each dot is a real observation",
                         labels={"ssta_dhw":"Thermal stress weeks","percent_bleaching":"% bleaching"})
        fig.add_vline(x=4, line_dash="dash", line_color="orange",
                      annotation_text="Bleaching threshold (4 weeks)")
        fig.add_vline(x=8, line_dash="dash", line_color="red",
                      annotation_text="Mortality threshold (8 weeks)")
        fig.update_layout(height=380, yaxis=dict(ticksuffix="%"))
        st.plotly_chart(fig, use_container_width=True)

    with tab3:
        st.markdown("""
        #### How the prediction works

        The model uses a **two-stage approach** — because coral bleaching data has a quirk:
        nearly 40% of all observations show 0% bleaching. A single model would be biased
        toward predicting "not much" all the time.

        **Stage 1 — Is bleaching happening?**
        A classifier looks at the conditions and decides: is this a bleaching event or not?

        **Stage 2 — How bad is it?**
        If Stage 1 says yes, a second model estimates the severity (0–100%).

        Both models are XGBoost — a type of gradient boosting algorithm that builds hundreds
        of small decision trees and combines them. The model was trained on observations before
        2016 and tested on 2016–2020 data, including the second-worst bleaching event in history.
        """)

        # Feature importance
        if explainer_clf is not None:
            st.markdown("#### What drives the prediction?")
            try:
                pre_clf = clf_pipeline.named_steps["pre"]
                X_sample = df[FEATURES].sample(500, random_state=42)
                X_t = pre_clf.transform(X_sample)
                shap_vals = np.abs(explainer_clf.shap_values(X_t)).mean(axis=0)

                shap_df = pd.DataFrame({
                    "Feature": [FEAT_LABELS[f] for f in FEAT_NAMES],
                    "Importance": shap_vals
                }).sort_values("Importance")

                fig = px.bar(shap_df, x="Importance", y="Feature", orientation="h",
                             color_discrete_sequence=["#D85A30"],
                             title="Feature importance — what the model relies on most")
                fig.update_layout(height=340, xaxis_title="Average impact on prediction")
                st.plotly_chart(fig, use_container_width=True)
                st.caption(
                    "Thermal stress weeks (DHW) and temperature above normal (SSTA) are the "
                    "strongest predictors — consistent with 40 years of marine biology research."
                )
            except Exception as e:
                st.warning(f"Could not compute feature importance: {e}")
        else:
            st.info("Install `shap` to see feature importance charts: `pip install shap`")

st.markdown("---")
st.caption("Data: Global Coral Reef Monitoring Network · 23,203 observations · 1980–2020")
