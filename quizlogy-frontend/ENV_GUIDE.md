# How to Use .env Files in Next.js

## Step 1: Create a .env.local File

In your `karekaise-frontend/karekaise-frontend/` directory, create a file named `.env.local`:

```bash
# Windows (PowerShell)
New-Item -Path ".env.local" -ItemType File

# Mac/Linux
touch .env.local
```

## Step 2: Add Your Environment Variables

Open `.env.local` and add your variables:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## Important Notes:

### 1. **NEXT_PUBLIC_ Prefix**
- Variables that start with `NEXT_PUBLIC_` are exposed to the browser
- Variables without this prefix are only available on the server side
- **Never put sensitive data (API keys, secrets) in `NEXT_PUBLIC_` variables!**

### 2. **File Priority**
Next.js loads environment variables in this order (later files override earlier ones):
1. `.env` - Default values for all environments
2. `.env.local` - Local overrides (ignored by git)
3. `.env.development` - Development environment
4. `.env.production` - Production environment

### 3. **Accessing Variables in Code**

**Client-side (browser):**
```typescript
// Only NEXT_PUBLIC_ variables work here
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
```

**Server-side (API routes, server components):**
```typescript
// All variables work here
const apiKey = process.env.API_KEY; // ✅ Works
const apiUrl = process.env.NEXT_PUBLIC_API_URL; // ✅ Also works
```

## Step 3: Restart Your Development Server

After creating or modifying `.env.local`, you **must restart** your Next.js dev server:

```bash
# Stop the server (Ctrl+C)
# Then restart
npm run dev
```

## Example .env.local File

```env
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:5000

# For production, you would use:
# NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

## Current Usage in This Project

The environment variable `NEXT_PUBLIC_API_URL` is used in:
- `lib/api.tsx` - For API base URL
- `lib/api.tsx` - In `getImageUrl()` function for image URLs

## Security Best Practices

1. ✅ **DO** add `.env.local` to `.gitignore` (Next.js does this automatically)
2. ✅ **DO** use `NEXT_PUBLIC_` only for non-sensitive public variables
3. ❌ **DON'T** commit `.env.local` to git
4. ❌ **DON'T** put API keys, secrets, or passwords in `NEXT_PUBLIC_` variables
5. ✅ **DO** create a `.env.example` file with placeholder values (without real secrets)

## Troubleshooting

**Problem:** Environment variables not working
- **Solution:** Restart your dev server after changing `.env.local`

**Problem:** Variable is `undefined`
- **Solution:** Check if it starts with `NEXT_PUBLIC_` for client-side usage
- **Solution:** Make sure there are no spaces around the `=` sign
- **Solution:** Don't use quotes around values (unless the value itself needs quotes)

**Example:**
```env
# ✅ Correct
NEXT_PUBLIC_API_URL=http://localhost:5000

# ❌ Wrong (spaces)
NEXT_PUBLIC_API_URL = http://localhost:5000

# ❌ Wrong (quotes not needed)
NEXT_PUBLIC_API_URL="http://localhost:5000"
```

