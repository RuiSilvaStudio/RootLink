#!/bin/bash
# Start both RootLink services

echo "🌱 Starting RootLink..."

# Kill any previous instances
pkill -f "uvicorn app.main:app" 2>/dev/null
pkill -f "next dev" 2>/dev/null

ROOTDIR="$(cd "$(dirname "$0")" && pwd)"

# Start backend
echo "  Starting backend on http://localhost:8001..."
BACKEND_DIR="$ROOTDIR/rootlink/backend"
[ -d "$BACKEND_DIR" ] || BACKEND_DIR="$ROOTDIR/backend"
cd "$BACKEND_DIR"
source .venv/bin/activate 2>/dev/null
uvicorn app.main:app --host 0.0.0.0 --port 8001 &
BACKEND_PID=$!

# Start frontend
echo "  Starting frontend on http://localhost:3001..."
FRONTEND_DIR="$ROOTDIR/rootlink/frontend"
[ -d "$FRONTEND_DIR" ] || FRONTEND_DIR="$ROOTDIR/frontend"
cd "$FRONTEND_DIR"
npm run dev -- -p 3001 &
FRONTEND_PID=$!

echo ""
echo "  Backend:  http://localhost:8001"
echo "  API docs: http://localhost:8001/docs"
echo "  Frontend: http://localhost:3001"
echo ""
echo "  Press Ctrl+C to stop both"

# Wait for either to exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
