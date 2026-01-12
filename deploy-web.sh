#!/bin/bash
# ================================================================
# VOXIS Cloud Web Deployment
# Full-stack cloud deployment for VOXIS Audio Restoration
# Powered by Trinity | Built by Glass Stone
# ================================================================

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "═══════════════════════════════════════════════════════════"
echo "  VOXIS Cloud Web Deployment"
echo "  Powered by Trinity | Built by Glass Stone"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Parse arguments
ACTION=${1:-up}
MODE=${2:-dev}

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is required. Please install Docker first."
    exit 1
fi

case $ACTION in
    up)
        if [ "$MODE" == "prod" ]; then
            echo "🚀 Starting VOXIS in PRODUCTION mode..."
            docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
        else
            echo "🚀 Starting VOXIS in DEVELOPMENT mode..."
            docker compose up -d --build
        fi
        
        echo ""
        echo "═══════════════════════════════════════════════════════════"
        echo "  ✅ VOXIS Cloud is running!"
        echo "═══════════════════════════════════════════════════════════"
        echo "  Frontend:  http://localhost"
        echo "  Backend:   http://localhost:5001"
        echo "  Health:    http://localhost:5001/api/health"
        if [ "$MODE" == "prod" ]; then
            echo "  HTTPS:     https://localhost (if SSL configured)"
        fi
        echo ""
        ;;
    
    down)
        echo "🛑 Stopping VOXIS..."
        docker compose down
        echo "✅ Stopped"
        ;;
    
    logs)
        docker compose logs -f
        ;;
    
    build)
        echo "🔨 Building VOXIS images..."
        docker compose build --no-cache
        echo "✅ Build complete"
        ;;
    
    status)
        docker compose ps
        ;;
    
    restart)
        echo "🔄 Restarting VOXIS..."
        docker compose restart
        echo "✅ Restarted"
        ;;
    
    *)
        echo "Usage: ./deploy-web.sh [up|down|logs|build|status|restart] [dev|prod]"
        echo ""
        echo "Examples:"
        echo "  ./deploy-web.sh up          # Start in development mode"
        echo "  ./deploy-web.sh up prod     # Start in production mode"
        echo "  ./deploy-web.sh logs        # View logs"
        echo "  ./deploy-web.sh down        # Stop services"
        exit 1
        ;;
esac
