#!/bin/bash

# Pocket-APP Deployment Script
# This script helps automate the deployment process

set -e

echo "🚀 Pocket-APP Deployment Script"
echo "================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this script from the pocket-app directory."
    exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Choose deployment method
echo "Choose deployment method:"
echo "1. Vercel (Recommended)"
echo "2. Docker build"
echo "3. Build for static hosting"
echo "4. Exit"

read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo "📦 Deploying to Vercel..."
        
        if ! command_exists vercel; then
            echo "Installing Vercel CLI..."
            npm install -g vercel
        fi
        
        echo "🔑 Make sure to set these environment variables in Vercel dashboard:"
        echo "- ENCRYPTION_KEY"
        echo "- FINNHUB_API_KEY (optional)"
        echo "- ALPHAVANTAGE_API_KEY (optional)"
        echo ""
        
        read -p "Have you set the environment variables? (y/n): " env_set
        
        if [ "$env_set" = "y" ] || [ "$env_set" = "Y" ]; then
            vercel --prod
            echo "✅ Deployment completed!"
        else
            echo "⚠️ Please set environment variables first, then run: vercel --prod"
        fi
        ;;
        
    2)
        echo "🐳 Building Docker image..."
        
        if ! command_exists docker; then
            echo "❌ Docker is not installed. Please install Docker first."
            exit 1
        fi
        
        # Check for .env file
        if [ ! -f ".env" ]; then
            echo "⚠️ No .env file found. Creating template..."
            cp .env.production .env
            echo "📝 Please edit .env file with your values, then run the script again."
            exit 1
        fi
        
        docker build -t pocket-app .
        
        echo "✅ Docker image built successfully!"
        echo "🏃 To run locally: docker run -p 3000:3000 --env-file .env pocket-app"
        echo "☁️ To deploy to cloud: Push the image to your container registry"
        ;;
        
    3)
        echo "📦 Building for static hosting..."
        
        # Build the application
        npm run build
        
        echo "✅ Build completed!"
        echo "📁 Upload the contents of the .next folder to your hosting provider"
        echo "🌐 Or use: npx serve .next"
        ;;
        
    4)
        echo "👋 Exiting..."
        exit 0
        ;;
        
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "🎉 Deployment process completed!"
echo "📖 For more detailed instructions, see DEPLOYMENT.md"
