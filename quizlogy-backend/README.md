# FF Backend

A Node.js backend application with PostgreSQL database and Google OAuth authentication.

## Features

- ✅ PostgreSQL database with Prisma ORM
- ✅ Google OAuth 2.0 authentication
- ✅ Express.js REST API
- ✅ TypeScript support
- ✅ Session-based authentication
- ✅ User management endpoints

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- Google Cloud Console account (for OAuth credentials)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up PostgreSQL Database

Create a PostgreSQL database:

```bash
createdb ff_backend
```

Or using psql:

```sql
CREATE DATABASE ff_backend;
```

### 3. Configure Environment Variables

Copy the `.env.example` file to `.env` and fill in your values:

```bash
cp .env.example .env
```

Update the following variables in `.env`:

- `DATABASE_URL`: Your PostgreSQL connection string
- `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET`: Your Google OAuth Client Secret
- `SESSION_SECRET`: A random secret string for session encryption
- `FRONTEND_URL`: Your frontend application URL

### 4. Set Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
5. Choose "Web application"
6. Add authorized redirect URIs:
   - `http://localhost:5000/auth/google/callback` (for development)
   - Your production callback URL (for production)
7. Copy the Client ID and Client Secret to your `.env` file

### 5. Run Database Migrations

```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 6. Start the Server

Development mode (with hot reload):

```bash
npm run dev
```

Production mode:

```bash
npm run build
npm start
```

The server will start on `http://localhost:5000` (or the port specified in `.env`).

## API Endpoints

### Authentication

- `GET /auth/google` - Initiate Google OAuth login
- `GET /auth/google/callback` - Google OAuth callback (handled automatically)
- `GET /auth/me` - Get current authenticated user
- `POST /auth/logout` - Logout current user

### Users

- `GET /api/users` - Get all users (requires authentication)
- `GET /api/users/:id` - Get user by ID (requires authentication)

### Health Check

- `GET /health` - Server health check

## Database Schema

The application uses Prisma ORM with the following User model:

- `id` (UUID) - Primary key
- `googleId` (String) - Unique Google ID
- `email` (String) - User email (unique)
- `name` (String) - User display name
- `picture` (String, optional) - Profile picture URL
- `givenName` (String, optional) - First name
- `familyName` (String, optional) - Last name
- `createdAt` (DateTime) - Account creation timestamp
- `updatedAt` (DateTime) - Last update timestamp

## Development

### Prisma Studio

View and edit your database using Prisma Studio:

```bash
npm run prisma:studio
```

### Database Migrations

Create a new migration:

```bash
npx prisma migrate dev --name migration-name
```

## Project Structure

```
ff-backend/
├── src/
│   ├── config/
│   │   ├── database.ts      # Prisma client configuration
│   │   └── passport.ts      # Google OAuth strategy
│   ├── middleware/
│   │   └── auth.ts          # Authentication middleware
│   ├── routes/
│   │   ├── auth.ts          # Authentication routes
│   │   └── users.ts         # User management routes
│   └── server.ts            # Express server setup
├── prisma/
│   └── schema.prisma        # Database schema
├── .env.example             # Environment variables template
├── package.json
├── tsconfig.json
└── README.md
```

## Security Notes

- Always use HTTPS in production
- Change the `SESSION_SECRET` to a strong random string
- Keep your `.env` file secure and never commit it to version control
- Regularly update dependencies for security patches

## License

ISC


