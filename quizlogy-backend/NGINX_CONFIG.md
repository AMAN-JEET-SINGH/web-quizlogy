# Nginx Configuration for API Server

## Problem
Nginx is returning 404 for `/uploads/*` requests because it's not configured to proxy these requests to the Express server or serve them directly.

## Solution Options

### Option 1: Proxy /uploads to Express Server (Recommended if you want Express to handle it)

Add this to your nginx configuration file (usually at `/etc/nginx/sites-available/api.quizlogy.com`):

```nginx
server {
    listen 80;
    server_name api.quizlogy.com;

    # Proxy all API requests to Express server
    location / {
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

    # Specifically handle /uploads - proxy to Express
    location /uploads {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Option 2: Serve Static Files Directly from Nginx (More Efficient)

This is more efficient for static files as nginx serves them directly without going through Node.js:

```nginx
server {
    listen 80;
    server_name api.quizlogy.com;

    # Serve uploads directly from filesystem (more efficient)
    location /uploads {
        alias /var/www/ff-karekaise-quiz/quizlogy-backend/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
        
        # Security headers
        add_header X-Content-Type-Options "nosniff";
        
        # Allow CORS if needed
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, OPTIONS";
    }

    # Proxy all other API requests to Express server
    location / {
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
}
```

### Option 3: Complete Configuration with SSL (Production Ready)

```nginx
server {
    listen 80;
    server_name api.quizlogy.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.quizlogy.com;

    # SSL certificates (adjust paths as needed)
    ssl_certificate /etc/letsencrypt/live/api.quizlogy.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.quizlogy.com/privkey.pem;

    # Serve uploads directly from filesystem
    location /uploads {
        alias /var/www/ff-karekaise-quiz/quizlogy-backend/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options "nosniff";
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, OPTIONS";
        
        # Security: only allow GET requests
        limit_except GET {
            deny all;
        }
    }

    # Proxy all other API requests to Express server
    location / {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

## Steps to Apply Configuration

1. **Edit your nginx configuration:**
   ```bash
   sudo nano /etc/nginx/sites-available/api.quizlogy.com
   ```

2. **Add the `/uploads` location block** (choose Option 1 or Option 2 above)

3. **Test the nginx configuration:**
   ```bash
   sudo nginx -t
   ```

4. **If test passes, reload nginx:**
   ```bash
   sudo systemctl reload nginx
   ```

5. **Verify the uploads directory exists and has correct permissions:**
   ```bash
   ls -la /var/www/ff-karekaise-quiz/quizlogy-backend/uploads/
   # If permissions are wrong:
   sudo chmod -R 755 /var/www/ff-karekaise-quiz/quizlogy-backend/uploads/
   sudo chown -R www-data:www-data /var/www/ff-karekaise-quiz/quizlogy-backend/uploads/
   ```

## Important Notes

- **Option 2 (direct serving)** is more efficient for static files
- Make sure the path `/var/www/ff-karekaise-quiz/quizlogy-backend/uploads` exists and is accessible
- If using Option 2, ensure nginx user (usually `www-data`) has read permissions on the uploads directory
- The Express server should still be running on port 5001 for API requests

## Troubleshooting

If images still don't load:

1. **Check nginx error logs:**
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

2. **Check if the file exists:**
   ```bash
   ls -la /var/www/ff-karekaise-quiz/quizlogy-backend/uploads/placeholder.jpg
   ```

3. **Test the Express server directly:**
   ```bash
   curl http://localhost:5001/uploads/placeholder.jpg
   ```

4. **Check nginx access logs:**
   ```bash
   sudo tail -f /var/log/nginx/access.log
   ```

