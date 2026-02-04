# Backend API Documentation

Complete list of all APIs available in the backend and their use cases.

## Base URL
- Development: `http://localhost:5000`
- Production: Set via `IMAGE_BASE_URL` environment variable

---

## 🔐 Authentication APIs (`/auth`)

### 1. **GET `/auth/google`**
- **Use**: Initiates Google OAuth authentication flow
- **Auth**: None (public)
- **Description**: Redirects user to Google login page
- **Response**: Redirects to Google OAuth

### 2. **GET `/auth/google/callback`**
- **Use**: Google OAuth callback handler
- **Auth**: None (handled by Passport)
- **Description**: Handles OAuth callback, creates/updates user session, redirects to dashboard
- **Response**: Redirects to frontend dashboard

### 3. **GET `/auth/me`**
- **Use**: Get current authenticated user information
- **Auth**: Required (isAuthenticated)
- **Description**: Returns logged-in user's details
- **Response**: 
```json
{
  "id": "user-id",
  "email": "user@example.com",
  "name": "User Name",
  "googleId": "google-id"
}
```

### 4. **POST `/auth/logout`**
- **Use**: Logout current user
- **Auth**: None (session-based)
- **Description**: Destroys user session and clears cookies
- **Response**: `{ "message": "Logged out successfully" }`

---

## 👥 User APIs (`/api/users`)

### 5. **GET `/api/users`**
- **Use**: Get all users list
- **Auth**: Required (isAuthenticated)
- **Description**: Returns list of all registered users
- **Response**: Array of user objects with `id`, `email`, `name`, `picture`, `createdAt`

### 6. **GET `/api/users/:id`**
- **Use**: Get specific user by ID
- **Auth**: Required (isAuthenticated)
- **Description**: Returns detailed information about a specific user
- **Response**: User object with `id`, `email`, `name`, `picture`, `givenName`, `familyName`, `createdAt`, `updatedAt`

---

## 🎯 Contest APIs (`/api`)

### 7. **GET `/api/contestList`**
- **Use**: Get list of contests with filtering
- **Auth**: None (public)
- **Query Parameters**: 
  - `category` (optional): Filter by category ID
  - `status` (optional): Filter by status (ACTIVE, UPCOMING, PREVIOUS, RESULT_PENDING)
  - `region` (optional): Filter by region (IND, REST_OF_WORLD, or ALL)
- **Description**: Returns paginated list of contests matching filters, with calculated status based on dates
- **Response**: 
```json
{
  "status": true,
  "results": [...],
  "page": 1,
  "limit": 10,
  "totalPages": 5,
  "totalResults": 50
}
```

### 8. **GET `/api/contest/:id`**
- **Use**: Get specific contest details
- **Auth**: None (public)
- **Description**: Returns detailed information about a specific contest including category, prize pool, and image URL
- **Response**: Contest object with all details

### 9. **GET `/api/contests`**
- **Use**: Get all contests (admin panel)
- **Auth**: None (public, but typically used by admin)
- **Description**: Returns all contests without pagination for admin management
- **Response**: Array of contest objects

### 10. **GET `/api/contests/:id`**
- **Use**: Get contest by ID (admin panel)
- **Auth**: None (public)
- **Description**: Returns contest details for admin editing
- **Response**: Contest object

### 11. **POST `/api/contests`**
- **Use**: Create new contest
- **Auth**: Required (isAdmin)
- **Body**: 
```json
{
  "title": "Contest Title",
  "description": "Contest Description",
  "categoryId": "category-id",
  "imagePath": "uploads/contests/image.jpg",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-31T23:59:59Z",
  "resultDate": "2024-02-01T00:00:00Z",
  "region": "IND",
  "joiningFee": 100,
  "questionCount": 10,
  "duration": 90,
  "prizePool": "[\"50000\",\"40000\",...]"
}
```
- **Description**: Creates a new contest with all specified details
- **Response**: Created contest object

### 12. **PUT `/api/contests/:id`**
- **Use**: Update existing contest
- **Auth**: Required (isAdmin)
- **Body**: Same as POST (all fields optional)
- **Description**: Updates contest details
- **Response**: Updated contest object

### 13. **DELETE `/api/contests/:id`**
- **Use**: Delete contest
- **Auth**: Required (isAdmin)
- **Description**: Permanently deletes a contest
- **Response**: `{ "message": "Contest deleted successfully" }`

---

## 📁 Category APIs (`/api`)

### 14. **GET `/api/getContestCategories`**
- **Use**: Get contest categories with pagination
- **Auth**: None (public)
- **Query Parameters**: 
  - `status` (optional): ACTIVE or INACTIVE
  - `page` (optional): Page number (default: 1)
  - `limit` (optional): Items per page (default: 10)
- **Description**: Returns paginated list of categories for contest selection
- **Response**: 
```json
{
  "status": true,
  "results": [...],
  "page": 1,
  "limit": 10,
  "totalPages": 2,
  "totalResults": 15
}
```

### 15. **GET `/api/categories`**
- **Use**: Get all categories (admin panel)
- **Auth**: None (public)
- **Query Parameters**: 
  - `status` (optional): ACTIVE or INACTIVE
- **Description**: Returns all categories for admin management
- **Response**: Array of category objects with imageUrl

### 16. **GET `/api/categories/:id`**
- **Use**: Get specific category by ID
- **Auth**: None (public)
- **Description**: Returns category details
- **Response**: Category object with imageUrl

### 17. **POST `/api/categories`**
- **Use**: Create new category
- **Auth**: Required (isAdmin)
- **Body**: 
```json
{
  "name": "Category Name",
  "description": "Category Description",
  "imagePath": "uploads/categories/image.jpg",
  "status": "ACTIVE"
}
```
- **Description**: Creates a new category
- **Response**: Created category object

### 18. **PUT `/api/categories/:id`**
- **Use**: Update existing category
- **Auth**: Required (isAdmin)
- **Body**: Same as POST (all fields optional)
- **Description**: Updates category details
- **Response**: Updated category object

### 19. **DELETE `/api/categories/:id`**
- **Use**: Delete category
- **Auth**: Required (isAdmin)
- **Description**: Permanently deletes a category
- **Response**: `{ "message": "Category deleted successfully" }`

### 20. **PATCH `/api/categories/:id/toggle-status`**
- **Use**: Toggle category status (ACTIVE/INACTIVE)
- **Auth**: Required (isAdmin)
- **Description**: Quickly toggle category status without full update
- **Response**: Updated category object

---

## ❓ Question APIs (`/api/questions`)

### 21. **GET `/api/questions/contest/:contestId`**
- **Use**: Get all questions for a specific contest
- **Auth**: None (public)
- **Description**: Returns all questions for a contest, ordered by `order` field
- **Response**: Array of question objects with options, correctOption, media URLs

### 22. **POST `/api/questions/contest/:contestId`**
- **Use**: Create new question for a contest
- **Auth**: Required (isAdmin)
- **Body**: 
```json
{
  "question": "Question text",
  "type": "NONE" | "IMAGE" | "VIDEO" | "AUDIO",
  "media": "path/to/media",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "correctOption": "Option 1",
  "order": 1
}
```
- **Description**: Creates a new question for a contest (must have exactly 4 options)
- **Response**: Created question object

### 23. **PUT `/api/questions/:id`**
- **Use**: Update existing question
- **Auth**: Required (isAdmin)
- **Body**: Same as POST (all fields optional)
- **Description**: Updates question details
- **Response**: Updated question object

### 24. **DELETE `/api/questions/:id`**
- **Use**: Delete question
- **Auth**: Required (isAdmin)
- **Description**: Permanently deletes a question
- **Response**: `{ "message": "Question deleted successfully" }`

---

## 🎲 Fun Fact APIs (`/api/funfacts`)

### 25. **GET `/api/funfacts`**
- **Use**: Get all fun facts
- **Auth**: None (public)
- **Query Parameters**: 
  - `status` (optional): ACTIVE or INACTIVE (default: ACTIVE)
- **Description**: Returns list of fun facts with questionCount (not nested questions)
- **Response**: Array of fun fact objects

### 26. **GET `/api/funfacts/:id`**
- **Use**: Get specific fun fact by ID
- **Auth**: None (public)
- **Description**: Returns fun fact details
- **Response**: Fun fact object with imageUrl

### 27. **POST `/api/funfacts`**
- **Use**: Create new fun fact
- **Auth**: Required (isAdmin)
- **Body**: 
```json
{
  "title": "Fun Fact Title",
  "description": "Fun Fact Description",
  "imagePath": "uploads/funfacts/image.jpg",
  "status": "ACTIVE"
}
```
- **Description**: Creates a new fun fact
- **Response**: Created fun fact object

### 28. **PUT `/api/funfacts/:id`**
- **Use**: Update existing fun fact
- **Auth**: Required (isAdmin)
- **Body**: Same as POST (all fields optional)
- **Description**: Updates fun fact details
- **Response**: Updated fun fact object

### 29. **DELETE `/api/funfacts/:id`**
- **Use**: Delete fun fact
- **Auth**: Required (isAdmin)
- **Description**: Permanently deletes a fun fact
- **Response**: `{ "message": "Fun fact deleted successfully" }`

### 30. **GET `/api/funfacts/:funfactId/questions`**
- **Use**: Get all questions for a specific fun fact
- **Auth**: None (public)
- **Description**: Returns all questions for a fun fact
- **Response**: Array of fun fact question objects

### 31. **POST `/api/funfacts/:funfactId/questions`**
- **Use**: Create new question for a fun fact
- **Auth**: Required (isAdmin)
- **Body**: 
```json
{
  "question": "Question text",
  "type": "NONE" | "IMAGE" | "VIDEO" | "AUDIO",
  "media": "path/to/media",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "correctOption": "Option 1",
  "order": 1
}
```
- **Description**: Creates a new question for a fun fact
- **Response**: Created question object

### 32. **PUT `/api/funfacts/questions/:id`**
- **Use**: Update existing fun fact question
- **Auth**: Required (isAdmin)
- **Body**: Same as POST (all fields optional)
- **Description**: Updates fun fact question details
- **Response**: Updated question object

### 33. **DELETE `/api/funfacts/questions/:id`**
- **Use**: Delete fun fact question
- **Auth**: Required (isAdmin)
- **Description**: Permanently deletes a fun fact question
- **Response**: `{ "message": "Question deleted successfully" }`

---

## 👨‍💼 Admin APIs (`/api/admin`)

### 34. **POST `/api/admin/login`**
- **Use**: Admin login
- **Auth**: None (public endpoint)
- **Body**: 
```json
{
  "username": "admin",
  "password": "password"
}
```
- **Description**: Authenticates admin user and creates admin session
- **Response**: `{ "message": "Admin login successful", "isAdmin": true }`
- **Credentials**: Set via `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables

### 35. **POST `/api/admin/logout`**
- **Use**: Admin logout
- **Auth**: None (session-based)
- **Description**: Destroys admin session and clears cookies
- **Response**: `{ "message": "Admin logged out successfully" }`

### 36. **GET `/api/admin/status`**
- **Use**: Check if current session is admin
- **Auth**: Required (isAdmin)
- **Description**: Verifies admin authentication status
- **Response**: `{ "isAdmin": true }`

---

## 📤 Upload APIs (`/api/upload`)

### 37. **POST `/api/upload/image`**
- **Use**: Upload image file
- **Auth**: Required (isAdmin)
- **Content-Type**: `multipart/form-data`
- **Body**: 
  - `image`: File (image file)
  - `type`: Query parameter or body - "categories", "contests", or "funfacts"
- **Description**: Uploads an image file to the specified folder
- **Response**: 
```json
{
  "filename": "uploaded-filename.jpg",
  "path": "uploads/categories/uploaded-filename.jpg",
  "url": "http://localhost:5000/uploads/categories/uploaded-filename.jpg",
  "type": "categories"
}
```

### 38. **GET `/api/upload/uploads/:type/:filename`**
- **Use**: Serve uploaded images
- **Auth**: None (public)
- **Description**: Serves uploaded image files
- **Response**: Image file

### 39. **GET `/api/upload/test`**
- **Use**: Test upload route (no auth)
- **Auth**: None
- **Description**: Verifies upload router is working
- **Response**: `{ "message": "Upload router is working", "path": "/api/upload/test" }`

### 40. **GET `/api/upload/test-auth`**
- **Use**: Test upload route with auth
- **Auth**: Required (isAdmin)
- **Description**: Verifies upload router with authentication is working
- **Response**: `{ "message": "Upload router with auth is working", "path": "/api/upload/test-auth" }`

---

## 📊 Analytics APIs (`/api/analytics`)

### 41. **GET `/api/analytics`**
- **Use**: Get dashboard analytics data
- **Auth**: Required (isAdmin)
- **Description**: Returns comprehensive analytics for admin dashboard
- **Response**: 
```json
{
  "totalUsers": 1000,
  "registeredUsers": 1000,
  "totalVisitors": 1000,
  "totalGames": 50,
  "contestAttempted": 500,
  "userGrowth": {
    "labels": ["Jan 1", "Jan 2", ...],
    "data": [10, 25, 50, ...],
    "dailyData": [10, 15, 25, ...]
  }
}
```

---

## 🖼️ Static File Serving

### 42. **GET `/uploads/:path`**
- **Use**: Serve uploaded files
- **Auth**: None (public)
- **Description**: Serves files from the uploads directory
- **Response**: File content

### 43. **GET `/categoryImage/:filename`**
- **Use**: Serve category images
- **Auth**: None (public)
- **Description**: Serves category image files
- **Response**: Image file

### 44. **GET `/contestImage/:filename`**
- **Use**: Serve contest images
- **Auth**: None (public)
- **Description**: Serves contest image files
- **Response**: Image file

### 45. **GET `/contestQuestionMedia/:filename`**
- **Use**: Serve contest question media files
- **Auth**: None (public)
- **Description**: Serves media files (images/videos/audio) for contest questions
- **Response**: Media file

---

## 🏥 Health & Test APIs

### 46. **GET `/health`**
- **Use**: Health check endpoint
- **Auth**: None (public)
- **Description**: Verifies server is running
- **Response**: `{ "status": "OK", "message": "Server is running" }`

### 47. **GET `/api/test`**
- **Use**: Test API routes
- **Auth**: None (public)
- **Description**: Verifies API routes are working
- **Response**: 
```json
{
  "status": "OK",
  "message": "API routes are working",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## 📝 Summary by Category

### Public APIs (No Authentication Required)
- Authentication endpoints (OAuth)
- Contest listing and details
- Category listing
- Question retrieval
- Fun fact listing and questions
- Image/media serving
- Health checks

### User APIs (Requires User Authentication)
- User profile (`/auth/me`)
- User list (`/api/users`)
- User details (`/api/users/:id`)

### Admin APIs (Requires Admin Authentication)
- All CRUD operations for:
  - Contests
  - Categories
  - Questions (contest and fun fact)
  - Fun Facts
- Image uploads
- Analytics dashboard
- Admin session management

---

## 🔒 Authentication Methods

1. **User Authentication**: 
   - Google OAuth via Passport.js
   - Session-based
   - Middleware: `isAuthenticated`

2. **Admin Authentication**: 
   - Username/Password
   - Session-based
   - Middleware: `isAdmin`
   - Credentials: Environment variables (`ADMIN_USERNAME`, `ADMIN_PASSWORD`)

---

## 📌 Important Notes

1. **Route Order**: Specific routes (like `/api/contestList`) must be registered before generic routes (like `/api/:id`) to avoid conflicts

2. **Image URLs**: All image paths are transformed to full URLs based on environment:
   - Development: `http://localhost:5000/uploads/...`
   - Production: Uses `DIGITAL_OCEAN_IMAGE_URL` if set

3. **Status Calculation**: Contest status is automatically calculated based on:
   - `startDate`, `endDate`, `resultDate`
   - Values: `UPCOMING`, `ACTIVE`, `RESULT_PENDING`, `PREVIOUS`

4. **Prize Pool**: Stored as JSON string array, default: `["50000","40000","30000","20000","10000","5000","4000","3000","2000","1000"]`

5. **Question Options**: All questions must have exactly 4 options

6. **CORS**: Configured to allow requests from frontend and admin frontend URLs

---

## 🚀 Usage Examples

### Get Active Contests
```bash
GET http://localhost:5000/api/contestList?status=ACTIVE&region=IND
```

### Create Category (Admin)
```bash
POST http://localhost:5000/api/categories
Headers: Cookie: connect.sid=...
Body: {
  "name": "Sports",
  "description": "Sports related contests",
  "status": "ACTIVE"
}
```

### Upload Image (Admin)
```bash
POST http://localhost:5000/api/upload/image?type=categories
Headers: Cookie: connect.sid=...
Body: multipart/form-data with image file
```

### Get Analytics (Admin)
```bash
GET http://localhost:5000/api/analytics
Headers: Cookie: connect.sid=...
```

---

**Total APIs: 47 endpoints**

