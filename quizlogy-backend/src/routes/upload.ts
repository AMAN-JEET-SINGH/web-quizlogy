import express, { Request, Response } from 'express';
import { isAdmin, AdminRequest } from '../middleware/adminAuth';
import { upload, getImageUrl } from '../middleware/upload';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Test route to verify upload router is working (no auth required for testing)
router.get('/test', (req: Request, res: Response) => {
  res.json({ message: 'Upload router is working', path: '/api/upload/test' });
});

// Test route with admin auth
router.get('/test-auth', isAdmin, (req: AdminRequest, res: Response) => {
  res.json({ message: 'Upload router with auth is working', path: '/api/upload/test-auth' });
});

// Upload single image
router.post(
  '/image',
  (req: Request, res: Response, next) => {
    console.log('📥 POST /api/upload/image - Request received');
    console.log('Headers:', req.headers);
    next();
  },
  isAdmin,
  upload.single('image'),
  (req: AdminRequest, res: Response) => {
    console.log('📥 POST /api/upload/image - After middleware');
    console.log('File:', req.file ? req.file.filename : 'No file');
    console.log('Query type:', req.query.type);
    console.log('Body type:', req.body?.type);
    try {
      if (!req.file) {
        console.error('❌ No file provided in request');
        return res.status(400).json({ error: 'No image file provided' });
      }

      // Get type from query, body, or determine from file path
      let type = (req.query.type as string) || (req.body?.type as string);
      
      // If type not provided, try to determine from the file's destination
      if (!type) {
        // Check which directory the file was saved to
        const filePath = req.file.path;
        if (filePath.includes('categories')) {
          type = 'categories';
        } else {
          type = 'contests';
        }
      }

      // Ensure type is valid
      if (type !== 'categories' && type !== 'contests' && type !== 'funfacts' && type !== 'battles') {
        type = 'contests'; // Default fallback
      }

      // Battles are stored in categories folder
      const storageType = type === 'battles' ? 'categories' : type;
      
      console.log(`Image uploaded to ${storageType} folder: ${req.file.filename}`);
      
      const imageUrl = getImageUrl(req.file.filename, storageType as 'categories' | 'contests' | 'funfacts');
      const imagePath = `uploads/${storageType}/${req.file.filename}`;

      res.json({
        filename: req.file.filename,
        path: imagePath,
        url: imageUrl,
        type: type,
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to upload image' });
    }
  }
);

// Serve uploaded images
router.get('/uploads/:type/:filename', (req: Request, res: Response) => {
  try {
    const { type, filename } = req.params;
    
    if (type !== 'categories' && type !== 'contests' && type !== 'funfacts' && type !== 'battles') {
      return res.status(400).json({ error: 'Invalid type' });
    }

    // Battles are stored in categories folder
    const storageType = type === 'battles' ? 'categories' : type;

    // Use environment variable for uploads directory, fallback to relative path
    const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadsDir, storageType, filename);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Serve image error:', error);
    res.status(404).json({ error: 'Image not found' });
  }
});

// Get all images from gallery (admin only)
router.get('/gallery', isAdmin, (req: AdminRequest, res: Response) => {
  try {
    const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
    const types = ['categories', 'contests', 'funfacts', 'battles'];
    const images: Array<{ path: string; url: string; type: string; filename: string; size: number; modified: Date }> = [];

    types.forEach((type) => {
      const typeDir = path.join(uploadsDir, type);
      if (fs.existsSync(typeDir)) {
        const files = fs.readdirSync(typeDir);
        files.forEach((filename) => {
          const filePath = path.join(typeDir, filename);
          const stats = fs.statSync(filePath);
          
          // Only include image files
          if (stats.isFile() && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(filename)) {
            const imagePath = `uploads/${type}/${filename}`;
            // For battles, use categories folder but keep type as battles
            const imageType = type === 'battles' ? 'categories' : type;
            const imageUrl = getImageUrl(filename, imageType as 'categories' | 'contests' | 'funfacts');
            images.push({
              path: imagePath,
              url: imageUrl,
              type: type, // Keep original type for filtering
              filename: filename,
              size: stats.size,
              modified: stats.mtime,
            });
          }
        });
      }
    });

    // Sort by modified date (newest first)
    images.sort((a, b) => b.modified.getTime() - a.modified.getTime());

    res.json({ images });
  } catch (error) {
    console.error('Gallery error:', error);
    res.status(500).json({ error: 'Failed to fetch gallery images' });
  }
});

// Delete image from gallery (admin only)
router.delete('/gallery/:path(*)', isAdmin, (req: AdminRequest, res: Response) => {
  try {
    // Decode the path parameter (it may be URL encoded)
    let imagePath = decodeURIComponent(req.params.path);
    
    // Validate path format: uploads/type/filename
    if (!imagePath.startsWith('uploads/')) {
      return res.status(400).json({ error: 'Invalid image path' });
    }

    // Extract type and filename
    const pathParts = imagePath.split('/');
    if (pathParts.length !== 3) {
      return res.status(400).json({ error: 'Invalid image path format' });
    }

    const type = pathParts[1];
    const filename = pathParts[2];

    // Validate type (battles use categories folder)
    if (type !== 'categories' && type !== 'contests' && type !== 'funfacts' && type !== 'battles') {
      return res.status(400).json({ error: 'Invalid image type' });
    }
    
    // Battles are stored in categories folder
    const storageType = type === 'battles' ? 'categories' : type;

    // Get full file path
    const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
    const fullPath = path.join(uploadsDir, storageType, filename);

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Delete the file
    fs.unlinkSync(fullPath);
    console.log(`Deleted image: ${fullPath}`);

    res.json({ message: 'Image deleted successfully', path: imagePath });
  } catch (error: any) {
    console.error('Delete image error:', error);
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'Image not found' });
    } else {
      res.status(500).json({ error: 'Failed to delete image' });
    }
  }
});

export default router;

