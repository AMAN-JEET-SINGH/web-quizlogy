# Admin Panel - Next.js

This is the admin panel for managing contests, categories, questions, and funfacts.

## Structure

```
adminfrontend/
├── app/
│   ├── auth/
│   │   └── login/          # Login page (separate folder)
│   ├── dashboard/          # Admin dashboard pages
│   │   ├── categories/     # Category management
│   │   ├── contests/       # Contest management
│   │   ├── questions/      # Question management
│   │   ├── funfacts/       # FunFact management
│   │   └── layout.tsx      # Dashboard layout with sidebar
│   ├── layout.tsx          # Root layout with AdminProvider
│   └── page.tsx            # Redirects to /auth/login
└── lib/
    ├── api.ts              # API utilities
    └── adminContext.tsx    # Admin context provider
```

## Features

- **Separate Login Folder**: Login page is in `/app/auth/login/` folder
- **Protected Routes**: Dashboard routes are protected and require admin authentication
- **Admin Context**: Global admin state management
- **API Integration**: Full integration with backend API

## Setup

1. Install dependencies:
```bash
cd karekasie-backend/adminfrontend
npm install
```

2. Create `.env.local` file:
```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

3. Run development server:
```bash
npm run dev
```

The admin panel will be available at `http://localhost:3001` (or the port configured in package.json)

## Admin Credentials

Set these environment variables in the backend `.env`:
```
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_admin_password
```

## Pages

- `/auth/login` - Admin login page
- `/dashboard` - Dashboard home
- `/dashboard/categories` - Manage categories
- `/dashboard/contests` - Manage contests
- `/dashboard/questions` - Manage contest questions
- `/dashboard/funfacts` - Manage funfacts

## API Endpoints Used

- `POST /api/admin/login` - Admin login
- `POST /api/admin/logout` - Admin logout
- `GET /api/admin/status` - Check admin status
- `GET /api/categories` - Get categories
- `GET /api/getContestCategories` - Get contest categories
- `GET /api/contests` - Get contests
- `GET /api/contestList` - Get contest list
- `GET /api/questions/contest/:id` - Get questions for contest
- `GET /api/funfacts` - Get funfacts

## Notes

- All dashboard routes are protected and will redirect to login if not authenticated
- The login page is in a separate `/auth/login` folder as requested
- Admin context manages authentication state globally
- API calls use credentials (cookies) for session management
