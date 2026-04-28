#!/bin/bash
# Setup script for coral-bleaching-model Flask + React app
# Run from the root of the project: bash setup.sh

set -e
ROOT=$(pwd)
echo ""
echo "🪸 Coral Bleaching Monitor — setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. Flask dependencies ─────────────────────────────────────────────────────
echo "📦 Installing Flask API dependencies..."
pip install flask flask-cors pandas numpy scikit-learn xgboost joblib -q
echo "   ✓ Flask dependencies installed"
echo ""

# ── 2. Check models exist ─────────────────────────────────────────────────────
echo "🤖 Checking model files..."
MODELS=("clf_pipeline.joblib" "reg_pipeline.joblib" "presets.joblib" "feature_names.joblib")
MISSING=0
for m in "${MODELS[@]}"; do
  if [ ! -f "models/$m" ]; then
    echo "   ✗ Missing: models/$m"
    MISSING=1
  else
    echo "   ✓ models/$m"
  fi
done
if [ $MISSING -eq 1 ]; then
  echo ""
  echo "   ⚠️  Run coral_model.ipynb first to generate the model files."
  echo ""
fi

# ── 3. React setup ────────────────────────────────────────────────────────────
echo ""
echo "⚛️  Setting up React client..."
cd "$ROOT/client"

if [ ! -f "package.json" ]; then
  echo "   Running create-react-app (this takes a minute)..."
  npx create-react-app . --silent
  echo "   ✓ React app created"
else
  echo "   ✓ package.json already exists"
fi

# ── 4. Install npm dependencies ───────────────────────────────────────────────
echo "   Installing npm dependencies..."
npm install recharts leaflet react-leaflet --save --silent
echo "   ✓ recharts, leaflet, react-leaflet installed"

# ── 5. Place source files ─────────────────────────────────────────────────────
echo ""
echo "📁 Checking source files..."
cd "$ROOT"

FILES=(
  "client/src/App.js"
  "client/src/index.css"
  "client/src/index.js"
  "client/src/hooks/useFetch.js"
  "client/src/components/Nav.js"
  "client/src/components/Explorer.js"
  "client/src/components/ReefMap.js"
  "client/src/components/Sliders.js"
  "client/src/components/SeverityCard.js"
  "client/src/components/Science.js"
  "client/public/index.html"
  "api/app.py"
)

ALL_OK=1
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    echo "   ✓ $f"
  else
    echo "   ✗ MISSING: $f  ← download from the chat and place here"
    ALL_OK=0
  fi
done

# ── 6. Create hooks dir if needed ─────────────────────────────────────────────
mkdir -p client/src/hooks
mkdir -p client/src/components

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ALL_OK -eq 1 ] && [ $MISSING -eq 0 ]; then
  echo "✅ All good! To run the app:"
  echo ""
  echo "   Terminal 1 (Flask):  cd api && python app.py"
  echo "   Terminal 2 (React):  cd client && npm start"
  echo ""
  echo "   Or just run:  bash start.sh"
else
  echo "⚠️  Some files are missing — see above."
  echo "   Once they're in place, run:  bash start.sh"
fi
echo ""
