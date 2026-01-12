#!/bin/bash
# VOXIS Cloud Deployment Script
# Deploy GPU-enabled backend to cloud infrastructure

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "═══════════════════════════════════════════════"
echo "  VOXIS Cloud Deployment"
echo "  Powered by Trinity | Built by Glass Stone"
echo "═══════════════════════════════════════════════"
echo ""

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is required but not installed."
    exit 1
fi

# Check for NVIDIA Docker (optional)
if command -v nvidia-smi &> /dev/null; then
    echo "✅ NVIDIA GPU detected"
    GPU_AVAILABLE=true
else
    echo "⚠️  No NVIDIA GPU detected. Running in CPU mode."
    GPU_AVAILABLE=false
fi

# Parse arguments
ACTION=${1:-up}

case $ACTION in
    up)
        echo "🚀 Starting VOXIS Cloud..."
        if [ "$GPU_AVAILABLE" = true ]; then
            docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d
        else
            # Run without GPU reservation
            docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d --scale voxis-cloud=1
        fi
        echo ""
        echo "✅ VOXIS Cloud is running!"
        echo "   API: http://localhost:5001"
        echo "   Web: http://localhost:80"
        ;;
    
    down)
        echo "🛑 Stopping VOXIS Cloud..."
        docker compose -f "$SCRIPT_DIR/docker-compose.yml" down
        echo "✅ Stopped"
        ;;
    
    logs)
        docker compose -f "$SCRIPT_DIR/docker-compose.yml" logs -f
        ;;
    
    build)
        echo "🔨 Building VOXIS Cloud image..."
        docker compose -f "$SCRIPT_DIR/docker-compose.yml" build --no-cache
        echo "✅ Build complete"
        ;;
    
    status)
        docker compose -f "$SCRIPT_DIR/docker-compose.yml" ps
        ;;
    
    *)
        echo "Usage: ./deploy.sh [up|down|logs|build|status]"
        exit 1
        ;;
esac
