#!/bin/bash

# Deployment script for WindexsChat 2.0
# Run this on your server after uploading the deployment archive

echo "🚀 Starting deployment of WindexsChat 2.0..."

# Check if we're in the right directory
if [ ! -f "server.js" ]; then
    echo "❌ Error: server.js not found. Please run this script from the deployment directory."
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found. Please ensure .env file is present."
    exit 1
fi

# Install PM2 if not installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    npm install -g pm2
fi

# Stop existing process if running
echo "🛑 Stopping existing windexs-ai process..."
pm2 stop windexs-ai 2>/dev/null || true
pm2 delete windexs-ai 2>/dev/null || true

# Start the application
echo "▶️ Starting WindexsChat 2.0..."
pm2 start server.js --name "windexs-ai"

# Save PM2 configuration
pm2 save

# Set up PM2 startup (run once)
if ! pm2 startup | grep -q "already configured"; then
    echo "🔧 Setting up PM2 startup..."
    pm2 startup
fi

echo "✅ Deployment completed successfully!"
echo ""
echo "🌐 Your application should be running at:"
echo "   - Frontend: https://ai.windexs.ru"
echo "   - API: https://ai.windexs.ru/api"
echo ""
echo "📊 Check status:"
echo "   pm2 status"
echo ""
echo "📝 View logs:"
echo "   pm2 logs windexs-ai"
echo ""
echo "🔄 Restart:"
echo "   pm2 restart windexs-ai"
