import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Create uploads directory if it doesn't exist
// Use environment variable for production, fallback to relative path for development
const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Create subdirectories
const categoriesDir = path.join(uploadsDir, 'categories');
const contestsDir = path.join(uploadsDir, 'contests');
const funfactsDir = path.join(uploadsDir, 'funfacts');

if (!fs.existsSync(categoriesDir)) {
  fs.mkdirSync(categoriesDir, { recursive: true });
}
if (!fs.existsSync(contestsDir)) {
  fs.mkdirSync(contestsDir, { recursive: true });
}
if (!fs.existsSync(funfactsDir)) {
  fs.mkdirSync(funfactsDir, { recursive: true });
}

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Get type from query parameter or body (multer processes file before body is fully parsed)
    // Try query first, then body
    const type = (req.query.type as string) || (req.body?.type as string) || 'contests';
    let dest = contestsDir;
    if (type === 'categories' || type === 'battles') {
      // Battles are stored in categories folder as per requirement
      dest = categoriesDir;
    } else if (type === 'funfacts') {
      dest = funfactsDir;
    }
    console.log(`Uploading to ${type} directory: ${dest}`);
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-randomnumber-originalname
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${timestamp}-${random}-${name}${ext}`;
    cb(null, filename);
  },
});

// File filter
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Helper function to get image URL
export const getImageUrl = (filename: string, type: 'categories' | 'contests' | 'funfacts' | 'battles'): string => {
  // Battles use categories folder for images
  if (type === 'battles') {
    type = 'categories';
  }
  const isProduction = process.env.NODE_ENV === 'production';
  const baseUrl = process.env.IMAGE_BASE_URL || 'http://localhost:5001';
  const digitalOceanUrl = process.env.DIGITAL_OCEAN_IMAGE_URL;

  // For uploaded files, use the uploads directory path
  const imagePath = `uploads/${type}/${filename}`;

  if (isProduction && digitalOceanUrl) {
    return `${digitalOceanUrl}/${imagePath}`;
  } else {
    return `${baseUrl}/${imagePath}`;
  }
};

