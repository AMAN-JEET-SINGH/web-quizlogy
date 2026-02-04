# Server Deployment Commands

## Frontend (quizlogy-frontend)

### Step 1: Navigate to frontend directory
```bash
cd quizlogy-frontend
```

### Step 2: Install dependencies (if not already installed)
```bash
npm install
```

### Step 3: Build the Next.js application
```bash
npm run build
```

### Step 4: Start the production server
```bash
npm start
```
This will start the server on port 4000.

---

## Backend (quizlogy-backend)

### Step 1: Navigate to backend directory
```bash
cd quizlogy-backend
```

### Step 2: Install dependencies (if not already installed)
```bash
npm install
```

### Step 3: Generate Prisma Client
```bash
npm run prisma:generate
```

### Step 4: Run database migrations (if needed)
```bash
npm run prisma:migrate
```

### Step 5: Build TypeScript to JavaScript
```bash
npm run build
```

### Step 6: Start the production server
```bash
npm start
```

---

## Complete Deployment Sequence

### For Frontend:
```bash
cd quizlogy-frontend
npm install
npm run build
npm start
```

### For Backend:
```bash
cd quizlogy-backend
npm install
npm run prisma:generate
npm run build
npm start
```

---

## Using PM2 (Process Manager - Recommended for Production)

### Install PM2 globally (if not installed)
```bash
npm install -g pm2
```

### Start Frontend with PM2
```bash
cd quizlogy-frontend
pm2 start npm --name "quizlogy-frontend" -- start
```

### Start Backend with PM2
```bash
cd quizlogy-backend
pm2 start npm --name "quizlogy-backend" -- start
```

### Other useful PM2 commands:
```bash
# View all running processes
pm2 list

# View logs
pm2 logs

# Restart a process
pm2 restart quizlogy-frontend
pm2 restart quizlogy-backend

# Stop a process
pm2 stop quizlogy-frontend
pm2 stop quizlogy-backend

# Delete a process
pm2 delete quizlogy-frontend
pm2 delete quizlogy-backend

# Save PM2 configuration to restart on server reboot
pm2 save
pm2 startup
```

---

## Environment Variables

Make sure you have the following `.env` files configured:

### Frontend (.env.local)
- `NEXT_PUBLIC_API_URL` - Backend API URL

### Backend (.env)
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session secret key
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `ADMIN_USERNAME` - Admin panel username
- `ADMIN_PASSWORD` - Admin panel password
- `PORT` - Server port (default: 3001)

---

## Quick Reference

| Command | Frontend | Backend |
|---------|----------|---------|
| Install | `npm install` | `npm install` |
| Dev | `npm run dev` | `npm run dev` |
| Build | `npm run build` | `npm run build` |
| Start | `npm start` | `npm start` |
| Generate Prisma | N/A | `npm run prisma:generate` |
