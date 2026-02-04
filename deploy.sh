#!/bin/bash

# Quick Deployment Script for Visitor Tracking Update
# Usage: ./deploy.sh

set -e  # Exit on error

echo "🚀 Starting deployment process..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}📦 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the right directory
if [ ! -d "quizlogy-backend" ] || [ ! -d "quizlogy-frontend" ] || [ ! -d "quizlogy-admin" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# BACKEND DEPLOYMENT
print_step "Updating Backend..."
cd quizlogy-backend

# Install dependencies
if [ -f "package.json" ]; then
    print_step "Installing backend dependencies..."
    npm install geoip-lite @types/geoip-lite
    print_success "Dependencies installed"
else
    print_error "package.json not found in backend directory"
    exit 1
fi

# Generate Prisma client
print_step "Generating Prisma client..."
npx prisma generate
print_success "Prisma client generated"

# Run migrations
print_step "Running database migrations..."
npx prisma migrate deploy
print_success "Migrations applied"

# Build backend
print_step "Building backend..."
npm run build
print_success "Backend built successfully"

# Restart backend (using PM2 if available, otherwise manual)
if command -v pm2 &> /dev/null; then
    print_step "Restarting backend with PM2..."
    pm2 restart quizlogy-backend || pm2 start dist/server.js --name quizlogy-backend
    print_success "Backend restarted"
else
    print_step "PM2 not found. Please restart backend manually:"
    echo "  npm start"
fi

cd ..

# FRONTEND DEPLOYMENT
print_step "Updating Frontend..."
cd quizlogy-frontend

if [ -f "package.json" ]; then
    print_step "Installing frontend dependencies..."
    npm install
    print_success "Dependencies installed"
    
    print_step "Building frontend..."
    npm run build
    print_success "Frontend built successfully"
    
    # Restart frontend
    if command -v pm2 &> /dev/null; then
        print_step "Restarting frontend with PM2..."
        pm2 restart quizlogy-frontend || pm2 start npm --name quizlogy-frontend -- start
        print_success "Frontend restarted"
    else
        print_step "PM2 not found. Please restart frontend manually:"
        echo "  npm start"
    fi
else
    print_error "package.json not found in frontend directory"
fi

cd ..

# ADMIN PANEL DEPLOYMENT
print_step "Updating Admin Panel..."
cd quizlogy-admin

if [ -f "package.json" ]; then
    print_step "Installing admin dependencies..."
    npm install
    print_success "Dependencies installed"
    
    print_step "Building admin panel..."
    npm run build
    print_success "Admin panel built successfully"
    
    # Restart admin
    if command -v pm2 &> /dev/null; then
        print_step "Restarting admin panel with PM2..."
        pm2 restart quizlogy-admin || pm2 start npm --name quizlogy-admin -- start
        print_success "Admin panel restarted"
    else
        print_step "PM2 not found. Please restart admin panel manually:"
        echo "  npm start"
    fi
else
    print_error "package.json not found in admin directory"
fi

cd ..

# Final status
echo ""
print_success "Deployment complete!"
echo ""
echo "📊 Check service status:"
if command -v pm2 &> /dev/null; then
    echo "  pm2 status"
    echo "  pm2 logs"
fi
echo ""
echo "🔍 Verify deployment:"
echo "  - Check backend: curl http://localhost:5001/health"
echo "  - Check frontend: Open in browser"
echo "  - Check admin: Open admin panel in browser"
echo ""

