// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import session from 'express-session';
import path from 'path';
import passport from './config/passport';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import contestsRoutes from './routes/contests';
import categoriesRoutes from './routes/categories';
import questionsRoutes from './routes/questions';
import funfactsRoutes from './routes/funfacts';
import twoQuestionsRoutes from './routes/twoQuestions';
import adminRoutes from './routes/admin';
import uploadRoutes from './routes/upload';
import analyticsRoutes from './routes/analytics';
import coinsRoutes from './routes/coins';
import feedbackRoutes from './routes/feedback';
import visitorTrackingRoutes from './routes/visitorTracking';
import adsenseRoutes from './routes/adsense';
import { trackVisitorIP } from './middleware/ipTracking';
import { autoSeedCountries } from './utils/seedCountries';

const app = express();
const PORT = process.env.PORT || 5001;

// Trust reverse proxy (nginx) — required for secure cookies behind proxy
app.set('trust proxy', 1);

// Get uploads directory path
// Use environment variable for production (set to /var/www/quizlogy/uploads)
// Fallback to relative path for development
let uploadsDir: string;

if (process.env.UPLOADS_DIR) {
  uploadsDir = process.env.UPLOADS_DIR;
} else {
  // In compiled CommonJS, __dirname exists at runtime and points to dist/
  // @ts-ignore - __dirname exists in compiled CommonJS but TypeScript doesn't know
  const currentDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
  
  // If we're in dist/, go up one level to project root, then to uploads/
  if (currentDir.includes('dist')) {
    uploadsDir = path.join(path.dirname(currentDir), 'uploads');
  } else {
    uploadsDir = path.join(currentDir, 'uploads');
  }
}

// Log for debugging
console.log('📁 Uploads directory:', uploadsDir);
console.log('📁 Process cwd:', process.cwd());
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  process.env.ADMIN_FRONTEND_URL || 'http://localhost:3001',
  'http://localhost:3000',
  'http://localhost:3001',
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins in development
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (must come before other routes to avoid conflicts)
app.use('/uploads', express.static(uploadsDir));

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    proxy: process.env.NODE_ENV === 'production', // Trust reverse proxy in production
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: process.env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const, // 'none' required for cross-domain cookies
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// IP tracking middleware (apply to all routes)
app.use(trackVisitorIP);

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Test endpoint to verify routes are working
app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'API routes are working',
    timestamp: new Date().toISOString()
  });
});

app.use('/auth', authRoutes);
app.use('/api/users', userRoutes);

// IMPORTANT: Register specific routes BEFORE generic ones to avoid conflicts
// Category routes - matches /api/getContestCategories (specific route first)
console.log('📋 Registering category routes at /api');
app.use('/api', categoriesRoutes);

// Contest routes - matches karekasie-client expectations
// /api/contestList, /api/contest/:id (specific routes)
console.log('📋 Registering contest routes at /api');
app.use('/api', contestsRoutes);

// Question routes
app.use('/api/questions', questionsRoutes);

// Funfact routes
app.use('/api/funfacts', funfactsRoutes);

// Two questions routes
app.use('/api/two-questions', twoQuestionsRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

// Admin users routes
import adminUsersRoutes from './routes/adminUsers';
app.use('/api/admin-users', adminUsersRoutes);

// Analytics routes
app.use('/api/analytics', analyticsRoutes);

// Coins routes
app.use('/api/coins', coinsRoutes);

// Wheel routes
import wheelRoutes from './routes/wheel';
app.use('/api', wheelRoutes);

// Feedback routes
app.use('/api/feedback', feedbackRoutes);

// Visitor tracking routes
app.use('/api/visitor', visitorTrackingRoutes);

// AdSense routes
app.use('/api/adsense', adsenseRoutes);

// App Settings routes
import appSettingsRoutes from './routes/appSettings';
app.use('/api/app-settings', appSettingsRoutes);

// Countries routes
import countriesRoutes from './routes/countries';
app.use('/api/countries', countriesRoutes);

// Visitors admin routes
import visitorsRoutes from './routes/visitors';
app.use('/api/visitors', visitorsRoutes);

// Battles routes
import battlesRoutes from './routes/battles';
app.use('/api', battlesRoutes);

// Upload routes (register before generic routes to avoid conflicts)
console.log('📋 Registering upload routes at /api/upload');
app.use('/api/upload', uploadRoutes);

// Serve category images
app.get('/categoryImage/:filename', (req, res) => {
  res.sendFile(path.join(uploadsDir, 'categories', req.params.filename), (err) => {
    if (err) {
      res.status(404).json({ error: 'Image not found' });
    }
  });
});

// Serve contest images
app.get('/contestImage/:filename', (req, res) => {
  res.sendFile(path.join(uploadsDir, 'contests', req.params.filename), (err) => {
    if (err) {
      res.status(404).json({ error: 'Image not found' });
    }
  });
});

// Serve contest question media
app.get('/contestQuestionMedia/:filename', (req, res) => {
  res.sendFile(path.join(uploadsDir, 'questions', 'contest', req.params.filename), (err) => {
    if (err) {
      res.status(404).json({ error: 'Media not found' });
    }
  });
});

// Error handling middleware (must come before 404 handler)
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Server Error:', err.stack);
  console.error('Request path:', req.path);
  console.error('Request method:', req.method);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler for undefined routes (must be last)
app.use((req: express.Request, res: express.Response) => {
  console.error(`❌ Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path,
    method: req.method 
  });
  console.log(`❌ Route not found: ${req.method} ${req.path}`);
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);

  // Auto-seed countries table if empty
  await autoSeedCountries();
});

