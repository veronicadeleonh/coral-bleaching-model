#!/bin/bash
# Run Flask API and React frontend together

echo "🪸 Starting Coral Bleaching Monitor..."
echo ""
echo "Flask API  → http://localhost:5001"
echo "React app  → http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers."
echo ""

# Start Flask in background
cd api && python app.py &
FLASK_PID=$!

# Start React
cd ../client && npm start &
REACT_PID=$!

# Wait and clean up on exit
trap "kill $FLASK_PID $REACT_PID 2>/dev/null; exit" INT TERM
wait
