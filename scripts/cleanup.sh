#!/bin/bash

# Kill all processes related to accelerate-content-automation
echo "Cleaning up zombie processes..."

# Kill by name patterns
pkill -f "accelerate-content-automation" 2>/dev/null
pkill -f "tsx watch" 2>/dev/null
pkill -f "npm run dev" 2>/dev/null
pkill -f "vite" 2>/dev/null
pkill -f "concurrently" 2>/dev/null

# Kill by port
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null
lsof -ti:3002 2>/dev/null | xargs kill -9 2>/dev/null
lsof -ti:5173 2>/dev/null | xargs kill -9 2>/dev/null

# Wait for processes to terminate
sleep 2

# Count remaining
REMAINING=$(ps aux | grep -E "accelerate-content-automation" | grep -v grep | wc -l)

if [ "$REMAINING" -eq 0 ]; then
    echo "✅ All processes cleaned successfully"
else
    echo "⚠️  $REMAINING processes still running"
fi