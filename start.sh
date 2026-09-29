#!/usr/bin/env bash
# SDQ Finance - Quick Local Server Launcher
PORT=5000
echo "=========================================="
echo " Starting SDQ Finance Local Web Server"
echo " URL: http://localhost:$PORT"
echo " Press Ctrl+C to stop"
echo "=========================================="

# Automatically open default browser after 1 second
(sleep 1 && (xdg-open "http://localhost:$PORT" 2>/dev/null || sensible-browser "http://localhost:$PORT" 2>/dev/null || true)) &

# Run local HTTP server using Python 3
python3 -m http.server $PORT
