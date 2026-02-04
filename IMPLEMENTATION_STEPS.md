# Implementation Steps for Users Management Feature

## Prerequisites
Make sure you have:
- Node.js installed
- PostgreSQL database running
- Environment variables configured

## Step-by-Step Implementation

### 1. Backend Setup

#### Navigate to backend directory:
```bash
cd quizlogy-backend
```

#### Ensure database is up to date:
The UserProfile table should already exist from previous migrations. If you're unsure, run:

```bash
npx prisma migrate deploy
```

Or if you need to create a new migration:
```bash
npx prisma migrate dev
```

#### Build the backend (if needed):
```bash
npm run build
```

#### Start the backend server:
```bash
# Development mode (auto-reload on changes)
npm run dev

# OR Production mode
npm run build
npm start
```

The backend should start on port 5001 (or the port specified in your `.env` file).

---

### 2. Admin Frontend Setup

#### Open a NEW terminal window and navigate to admin directory:
```bash
cd quizlogy-admin
```

#### Install dependencies (if needed):
```bash
npm install
```

#### Start the admin frontend:
```bash
# Development mode
npm run dev

# OR Production mode
npm run build
npm start
```

The admin panel should start on port 3001 (or port 4001 in production mode).

---

### 3. Access and Test

1. **Open your browser** and go to: `http://localhost:3001` (or your configured admin URL)

2. **Login** to the admin panel with your admin credentials

3. **Navigate to Users**:
   - Look for the "Users" link in the sidebar
   - Click on it to see the Users Management page

4. **Test the features**:
   - View all users with their profile details
   - Use the search bar to search by name, email, mobile, city, or country
   - Test pagination if you have more than 50 users
   - Click "Refresh" to reload the data

---

### 4. What You Should See

The Users Management page displays:
- **Name** (with profile picture or avatar)
- **Email**
- **Mobile Number**
- **WhatsApp Number**
- **Address**
- **City**
- **Country**
- **Postal Code**
- **Coins** (user's coin balance)
- **Joined** (registration date)

---

### 5. Troubleshooting

#### If the page shows "Failed to fetch users":
- ✅ Check that the backend server is running
- ✅ Verify your `NEXT_PUBLIC_API_URL` environment variable is correct in `quizlogy-admin/.env.local`
- ✅ Check browser console for errors
- ✅ Verify admin authentication is working

#### If you see "Route not found":
- ✅ Make sure the backend server has the latest code
- ✅ Restart the backend server after code changes
- ✅ Check that the route `/api/users/admin/all` is accessible

#### If database errors occur:
- ✅ Ensure PostgreSQL is running
- ✅ Verify database connection in backend `.env`
- ✅ Run `npx prisma generate` to regenerate Prisma client
- ✅ Check that UserProfile table exists: `npx prisma studio`

---

### 6. File Changes Summary

**Backend:**
- ✅ `quizlogy-backend/src/routes/users.ts` - Added admin endpoint

**Admin Frontend:**
- ✅ `quizlogy-admin/lib/api.ts` - Added usersApi
- ✅ `quizlogy-admin/app/dashboard/users/page.tsx` - New users page
- ✅ `quizlogy-admin/app/dashboard/users/users.css` - New styles
- ✅ `quizlogy-admin/app/dashboard/layout.tsx` - Added "Users" link

---

### Quick Start Commands (All at once)

**Terminal 1 (Backend):**
```bash
cd quizlogy-backend
npm run dev
```

**Terminal 2 (Admin Frontend):**
```bash
cd quizlogy-admin
npm run dev
```

Then open `http://localhost:3001` in your browser!
