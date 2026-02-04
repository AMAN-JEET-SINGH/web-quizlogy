# Uploads Directory Setup

## Changes Made

The upload path has been updated to use `/var/www/quizlogy/uploads/` in production.

## Setup Steps

### 1. Create the uploads directory on your server:

```bash
sudo mkdir -p /var/www/quizlogy/uploads/{categories,contests,funfacts}
sudo chmod -R 755 /var/www/quizlogy/uploads/
sudo chown -R www-data:www-data /var/www/quizlogy/uploads/
```

### 2. Set Environment Variable

Add this to your `.env` file or PM2 ecosystem file:

```bash
UPLOADS_DIR=/var/www/quizlogy/uploads
```

**For PM2 ecosystem file:**
```json
{
  "apps": [{
    "name": "quizlogy-backend",
    "script": "dist/server.js",
    "env": {
      "UPLOADS_DIR": "/var/www/quizlogy/uploads",
      "NODE_ENV": "production"
    }
  }]
}
```

**Or in your `.env` file:**
```env
UPLOADS_DIR=/var/www/quizlogy/uploads
```

### 3. Update Nginx Configuration

Update your nginx config to serve from the new location:

```nginx
location /uploads {
    alias /var/www/quizlogy/uploads;
    expires 30d;
    add_header Cache-Control "public, immutable";
    add_header Access-Control-Allow-Origin "*";
}
```

### 4. Rebuild and Restart

```bash
cd /var/www/ff-quiz-karekaise/quizlogy-backend
npm run build
pm2 restart all
sudo systemctl reload nginx
```

### 5. Copy Existing Files (One Time)

If you have existing files in the old location:

```bash
sudo cp -r /var/www/ff-quiz-karekaise/quizlogy-backend/uploads/* /var/www/quizlogy/uploads/
```

## Verification

Test that uploads work:

```bash
# Check directory exists
ls -la /var/www/quizlogy/uploads/

# Test via API
curl https://api.quizlogy.com/uploads/placeholder.jpg
```

## Notes

- All new uploads will automatically go to `/var/www/quizlogy/uploads/`
- No more manual copying needed!
- The old directory can be removed after verifying everything works


