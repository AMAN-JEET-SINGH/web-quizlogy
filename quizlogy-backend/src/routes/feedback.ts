import express, { Request, Response } from 'express';
import prisma from '../config/database';

const router = express.Router();

// Interface for feedback data (we'll store it in a simple format, you might want to create a Feedback model)
interface FeedbackData {
  name?: string;
  email?: string;
  message: string;
  type: 'contact' | 'report';
  issueType?: string;
}

// Send contact feedback
router.post('/contact', async (req: Request, res: Response) => {
  try {
    const { name, email, message }: { name?: string; email?: string; message?: string } = req.body;

    // Validate all fields are required
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!email || email.trim().length === 0) {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Save to database
    const contactMessage = await prisma.contactMessage.create({
      data: {
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        isRead: false,
      },
    });

    res.json({
      status: true,
      message: 'Thank you for your feedback! We will get back to you soon.',
      data: contactMessage,
    });
  } catch (error: any) {
    console.error('Error processing contact feedback:', error);
    res.status(500).json({ error: 'Failed to send feedback' });
  }
});

// Send issue report feedback
router.post('/report-issue', async (req: Request, res: Response) => {
  try {
    const { issueType, description, email }: { issueType?: string; description?: string; email?: string } = req.body;

    if (!description || description.trim().length === 0) {
      return res.status(400).json({ error: 'Issue description is required' });
    }

    // Here you can save to database, send email, or integrate with a service
    // For now, we'll just log it and return success
    console.log('Issue Report Received:', {
      issueType: issueType || 'other',
      description,
      email,
      timestamp: new Date().toISOString(),
    });

    // TODO: Save to database or send email
    // Example: await prisma.issueReport.create({ data: { issueType, description, email } });

    res.json({
      status: true,
      message: 'Thank you for reporting the issue! We will investigate and get back to you soon.',
    });
  } catch (error: any) {
    console.error('Error processing issue report:', error);
    res.status(500).json({ error: 'Failed to send issue report' });
  }
});

export default router;

