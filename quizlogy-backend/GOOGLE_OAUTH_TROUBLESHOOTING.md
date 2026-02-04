# Google OAuth Signup Troubleshooting Guide

## Common Issues and Solutions

### 1. **Callback URL Mismatch (Most Common)**

**Problem:** The callback URL in your code doesn't match what's configured in Google Cloud Console.

**Solution:**

1. **Set the environment variable in production:**
   ```bash
   GOOGLE_CALLBACK_URL=https://api.quizlogy.com/auth/google/callback
   ```

2. **Verify in Google Cloud Console:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to: APIs & Services → Credentials
   - Click on your OAuth 2.0 Client ID
   - Under "Authorized redirect URIs", make sure you have:
     - `https://api.quizlogy.com/auth/google/callback`
     - (For development: `http://localhost:5001/auth/google/callback`)

3. **Update your `.env` or PM2 config:**
   ```env
   GOOGLE_CLIENT_ID=your-client-id-here
   GOOGLE_CLIENT_SECRET=your-client-secret-here
   GOOGLE_CALLBACK_URL=https://api.quizlogy.com/auth/google/callback
   ```

### 2. **Missing Environment Variables**

**Check if variables are set:**
```bash
# On your server
pm2 env <your-app-name>
# Or check .env file
cat .env | grep GOOGLE
```

**Required variables:**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL` (for production)

### 3. **Nginx Not Proxying /auth Routes**

**Check your nginx config:**
```nginx
location /api {
    proxy_pass http://localhost:5001;
    # ... other settings
}

# Make sure /auth is also proxied
location /auth {
    proxy_pass http://localhost:5001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### 4. **Session/Cookie Issues**

**Check session configuration in server.ts:**
- Make sure `SESSION_SECRET` is set
- Cookies should work with your domain

**For production, update session config:**
```typescript
cookie: {
  secure: process.env.NODE_ENV === 'production', // true in production
  httpOnly: true,
  sameSite: 'lax', // or 'none' if cross-domain
  domain: '.quizlogy.com', // if using subdomains
}
```

### 5. **Database Connection Issues**

**Check if Prisma can connect:**
```bash
# Test database connection
npx prisma db pull
```

**Verify User table exists:**
```bash
npx prisma studio
```

### 6. **Check Server Logs**

**Check PM2 logs for errors:**
```bash
pm2 logs --lines 100
```

**Look for:**
- `⚠️ Google OAuth credentials not found` - Missing env variables
- Database connection errors
- Session errors

## Step-by-Step Fix

### Step 1: Verify Environment Variables

```bash
# On your server
cd /var/www/ff-quiz-karekaise/quizlogy-backend
cat .env | grep -E "GOOGLE|CALLBACK"
```

Should show:
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://api.quizlogy.com/auth/google/callback
```

### Step 2: Update Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to: **APIs & Services** → **Credentials**
4. Click on your OAuth 2.0 Client ID
5. Under **Authorized redirect URIs**, add:
   ```
   https://api.quizlogy.com/auth/google/callback
   ```
6. Click **Save**

### Step 3: Update Nginx Config

Add `/auth` location block:

```nginx
server {
    server_name api.quizlogy.com;
    
    # ... existing config ...
    
    location /auth {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /api {
        proxy_pass http://localhost:5001;
        # ... existing config ...
    }
}
```

### Step 4: Rebuild and Restart

```bash
cd /var/www/ff-quiz-karekaise/quizlogy-backend
npm run build
pm2 restart all
sudo systemctl reload nginx
```

### Step 5: Test

1. **Test the auth endpoint:**
   ```bash
   curl -I https://api.quizlogy.com/auth/google
   ```
   Should redirect to Google (302 status)

2. **Check logs:**
   ```bash
   pm2 logs --lines 50
   ```

## Quick Diagnostic Commands

```bash
# Check if Google OAuth is initialized
pm2 logs | grep "Google OAuth"

# Test callback URL directly
curl https://api.quizlogy.com/auth/google/callback

# Check environment variables
pm2 env <app-name> | grep GOOGLE

# Check nginx is proxying correctly
curl -I https://api.quizlogy.com/auth/google
```

## Common Error Messages

### "redirect_uri_mismatch"
- **Cause:** Callback URL doesn't match Google Console
- **Fix:** Update `GOOGLE_CALLBACK_URL` and Google Console

### "Google OAuth credentials not found"
- **Cause:** Missing `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET`
- **Fix:** Set environment variables

### "401 Unauthorized" after callback
- **Cause:** Session/cookie issues
- **Fix:** Check session configuration and cookie settings

### "Database connection error"
- **Cause:** Prisma can't connect to database
- **Fix:** Check `DATABASE_URL` and database is running


