# VPS Deployment Guide - Visitor Tracking & Device Info Update

This guide covers deploying the visitor IP tracking, device information, and analytics features to your VPS.

## Prerequisites

- SSH access to your VPS
- PostgreSQL database running
- Node.js installed on VPS
- Git repository access (or file transfer method)

## Step 1: Connect to VPS

```bash
ssh user@your-vps-ip
# Or use your preferred SSH method
```

## Step 2: Navigate to Project Directory

```bash
cd /path/to/your/project
# Example: cd /var/www/quizlogy-backend
```

## Step 3: Update Code

### Option A: Using Git (Recommended)

```bash
# Navigate to project root
cd /path/to/web-quizlogy

# Pull latest changes
git pull origin main
# Or your branch name: git pull origin master
```

### Option B: Manual File Transfer

If not using Git, transfer the updated files using SCP or SFTP:

```bash
# From your local machine
scp -r quizlogy-backend/src user@vps-ip:/path/to/project/
scp -r quizlogy-frontend/components user@vps-ip:/path/to/project/
scp -r quizlogy-admin/app/dashboard user@vps-ip:/path/to/project/
```

## Step 4: Backend Updates

### 4.1 Navigate to Backend Directory

```bash
cd quizlogy-backend
```

### 4.2 Install New Dependencies

```bash
# Install geoip-lite package
npm install geoip-lite @types/geoip-lite
```

### 4.3 Run Database Migrations

```bash
# Generate Prisma client
npx prisma generate

# Check migration status first
npx prisma migrate status

# If you get an error about existing tables (like "relation already exists"):
# This means the database already has the tables but migrations weren't tracked
# Solution: Mark the problematic migration as applied without running it

# Option 1: Mark specific migration as applied (if tables already exist)
npx prisma migrate resolve --applied 20260102120216_add_daily_contest_fields

# Then continue with remaining migrations
npx prisma migrate deploy

# Option 2: If all tables exist, mark all pending migrations as applied
# (Use with caution - only if you're sure the schema matches)
# npx prisma migrate resolve --applied 20260102120216_add_daily_contest_fields
# npx prisma migrate resolve --applied 20260104091032_add_visitor_ip_tracking
# npx prisma migrate resolve --applied 20260104091245_add_click_tracking
# npx prisma migrate resolve --applied 20260104095656_add_session_tracking
# npx prisma migrate resolve --applied 20260104101748_add_device_info_tracking

# Option 3: Use db push to sync schema without migrations (for development only)
# npx prisma db push
```

**Important:** The migrations will:
- Create `visitor_ips` table
- Add `clickCount`, `lastSessionClicks`, `lastSessionStart` fields
- Add `deviceType`, `os`, `browser`, `screenResolution` fields

### 4.4 Build Backend

```bash
# Build TypeScript to JavaScript
npm run build
```

### 4.5 Restart Backend Service

**If using PM2:**
```bash
pm2 restart quizlogy-backend
# Or
pm2 restart all
```

**If using systemd:**
```bash
sudo systemctl restart quizlogy-backend
# Or your service name
```

**If using npm directly:**
```bash
# Stop current process (Ctrl+C or kill process)
# Then start:
npm start
# Or for development:
npm run dev
```

## Step 5: Frontend Updates

### 5.1 Navigate to Frontend Directory

```bash
cd ../quizlogy-frontend
```

### 5.2 Install Dependencies (if needed)

```bash
npm install
```

### 5.3 Build Frontend

```bash
# Build for production
npm run build
```

### 5.4 Restart Frontend Service

**If using PM2:**
```bash
pm2 restart quizlogy-frontend
```

**If using systemd:**
```bash
sudo systemctl restart quizlogy-frontend
```

**If using Next.js directly:**
```bash
# Stop and restart
npm start
```

## Step 6: Admin Panel Updates

### 6.1 Navigate to Admin Directory

```bash
cd ../quizlogy-admin
```

### 6.2 Install Dependencies (if needed)

```bash
npm install
```

### 6.3 Build Admin Panel

```bash
# Build for production
npm run build
```

### 6.4 Restart Admin Service

**If using PM2:**
```bash
pm2 restart quizlogy-admin
```

**If using systemd:**
```bash
sudo systemctl restart quizlogy-admin
```

## Step 7: Verify Deployment

### 7.1 Check Backend Health

```bash
curl http://localhost:5001/health
# Should return: {"status":"OK","message":"Server is running"}
```

### 7.2 Check Database Connection

```bash
cd quizlogy-backend
npx prisma studio
# This opens Prisma Studio - verify visitor_ips table exists
```

### 7.3 Test API Endpoints

```bash
# Test analytics endpoint (requires admin auth)
curl http://localhost:5001/api/analytics

# Test visitors endpoint (requires admin auth)
curl http://localhost:5001/api/visitors
```

### 7.4 Check Logs

**PM2:**
```bash
pm2 logs quizlogy-backend
pm2 logs quizlogy-frontend
pm2 logs quizlogy-admin
```

**systemd:**
```bash
sudo journalctl -u quizlogy-backend -f
sudo journalctl -u quizlogy-frontend -f
sudo journalctl -u quizlogy-admin -f
```

## Step 8: Environment Variables

Ensure your `.env` files are configured:

### Backend `.env`
```env
DATABASE_URL=postgresql://user:password@localhost:5432/ff_backend
SESSION_SECRET=your-secret-key
FRONTEND_URL=https://your-frontend-domain.com
ADMIN_FRONTEND_URL=https://your-admin-domain.com
PORT=5001
NODE_ENV=production
```

### Frontend `.env.local`
```env
NEXT_PUBLIC_API_URL=https://your-backend-domain.com
```

### Admin `.env.local`
```env
NEXT_PUBLIC_API_URL=https://your-backend-domain.com
```

## Quick Deployment Script

Create a deployment script for faster updates:

```bash
#!/bin/bash
# deploy.sh

echo "🚀 Starting deployment..."

# Backend
echo "📦 Updating backend..."
cd quizlogy-backend
npm install geoip-lite @types/geoip-lite
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart quizlogy-backend

# Frontend
echo "📦 Updating frontend..."
cd ../quizlogy-frontend
npm install
npm run build
pm2 restart quizlogy-frontend

# Admin
echo "📦 Updating admin panel..."
cd ../quizlogy-admin
npm install
npm run build
pm2 restart quizlogy-admin

echo "✅ Deployment complete!"
```

Make it executable:
```bash
chmod +x deploy.sh
./deploy.sh
```

## Troubleshooting

### Migration Errors

If migrations fail:
```bash
# Check migration status
npx prisma migrate status

# Reset if needed (WARNING: This will drop data)
# npx prisma migrate reset

# Or manually apply migrations
npx prisma db push
```

### Prisma Client Errors

```bash
# Regenerate Prisma client
cd quizlogy-backend
npx prisma generate
npm run build
```

### Port Conflicts

```bash
# Check what's using the port
sudo lsof -i :5001
# Or
sudo netstat -tulpn | grep :5001

# Kill process if needed
sudo kill -9 <PID>
```

### Database Connection Issues

```bash
# Test database connection
psql -h localhost -U your_user -d ff_backend

# Check PostgreSQL is running
sudo systemctl status postgresql
```

## Rollback Instructions

If something goes wrong:

### 1. Rollback Database Migration

```bash
cd quizlogy-backend
# Check migration history
npx prisma migrate status

# Rollback to previous migration (manual SQL)
# Connect to database and drop new columns/tables
psql -h localhost -U user -d ff_backend
```

### 2. Revert Code

```bash
# Using Git
git revert HEAD
# Or
git reset --hard <previous-commit-hash>

# Then rebuild and restart
npm run build
pm2 restart all
```

## Post-Deployment Checklist

- [ ] Backend server is running
- [ ] Frontend is accessible
- [ ] Admin panel is accessible
- [ ] Database migrations applied successfully
- [ ] Visitor tracking is working (check logs)
- [ ] Device info is being captured
- [ ] Analytics dashboard shows data
- [ ] No errors in logs

## Monitoring

### Check PM2 Status
```bash
pm2 status
pm2 monit
```

### Check System Resources
```bash
# CPU and Memory
htop
# Or
top

# Disk space
df -h
```

### Check Application Logs
```bash
# PM2 logs
pm2 logs --lines 100

# System logs
sudo journalctl -xe
```

## Security Notes

1. **Environment Variables**: Never commit `.env` files
2. **Database Backups**: Backup before migrations
3. **HTTPS**: Ensure all services use HTTPS in production
4. **Firewall**: Configure firewall rules for your ports
5. **Updates**: Keep dependencies updated for security patches

## Support

If you encounter issues:
1. Check application logs
2. Verify database connectivity
3. Check environment variables
4. Verify all services are running
5. Check network/firewall settings

---

**Last Updated:** January 2025
**Version:** 1.0

