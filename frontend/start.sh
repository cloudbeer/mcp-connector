#!/bin/bash

# MCP Connector Frontend Start Script

echo "🚀 Starting MCP Connector Frontend..."

# Check if bun is available
if ! command -v bun &> /dev/null; then
    echo "❌ Bun is not installed or not in PATH"
    echo "Please install bun: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    bun install
fi

# Start the development server
echo "🌐 Starting development server on http://localhost:3000"
echo "📡 API proxy configured for http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

bun run dev
