#!/bin/bash

# Test script for the new simple sync system
set -e

echo "🧪 Testing Simple Sync System"
echo "================================"

# Check if the environment file exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local not found. Please copy .env.example to .env.local and configure it."
    exit 1
fi

echo "✅ Environment file found"

# Start the database (if using Docker)
if command -v docker &> /dev/null; then
    echo "🐳 Starting database (if needed)..."
    ./start-database.sh 2>/dev/null || echo "Database start failed or already running"
fi

# Build the application
echo "🔨 Building application..."
npm run build

# Run type checking
echo "🔍 Running type checks..."
npm run typecheck

# Run linting
echo "🧹 Running linter..."
npm run check

echo ""
echo "🎯 Testing Instructions:"
echo "========================"
echo ""
echo "1. Start the application:"
echo "   npm run dev"
echo ""
echo "2. Test OLD system (default):"
echo "   - Visit http://localhost:3000"
echo "   - Navigate to any space"
echo "   - Test presence sidebar and chat"
echo ""
echo "3. Test NEW system:"
echo "   - Set NEXT_PUBLIC_USE_SIMPLE_SYNC=true in .env.local"
echo "   - Restart the dev server"
echo "   - Test the same functionality"
echo ""
echo "4. Compare both systems:"
echo "   - Open two browser windows"
echo "   - Toggle between old/new systems"
echo "   - Verify real-time sync works in both"
echo ""
echo "5. Performance comparison:"
echo "   - Open browser dev tools"
echo "   - Check Network tab for requests"
echo "   - Monitor Console for errors"
echo ""
echo "✨ All build checks passed! Ready for testing."