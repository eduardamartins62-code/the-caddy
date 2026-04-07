import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate as requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// Legacy paths: /course/:courseId — must be registered BEFORE /:courseId
router.get('/course/:courseId', async (req, res) => {
  try {
    const reviews = await prisma.courseReview.findMany({
      where: { courseId: req.params.courseId },
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
    res.json({ reviews, averageRating: avg, count: reviews.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

router.post('/course/:courseId', requireAuth, async (req: AuthRequest, res) => {
  const { rating, reviewText, review, difficulty, wouldPlayAgain } = req.body;
  const reviewContent = reviewText || review;
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating 1-5 required' });
  try {
    const r = await prisma.courseReview.upsert({
      where: { courseId_userId: { courseId: req.params.courseId, userId: req.user!.id } },
      update: { rating, review: reviewContent, difficulty, wouldPlayAgain },
      create: {
        courseId: req.params.courseId,
        userId:   req.user!.id,
        rating,
        review:   reviewContent,
        difficulty,
        wouldPlayAgain: wouldPlayAgain ?? true,
      },
      include: { user: { select: { id: true, name: true, avatar: true } } },
    });
    res.json(r);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save review' });
  }
});

// GET /api/reviews/:courseId  (also accessible via /api/courses/:courseId/reviews)
router.get('/:courseId', async (req, res) => {
  try {
    const reviews = await prisma.courseReview.findMany({
      where: { courseId: req.params.courseId },
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
    res.json({ reviews, averageRating: avg, count: reviews.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// POST /api/reviews/:courseId
router.post('/:courseId', requireAuth, async (req: AuthRequest, res) => {
  const { rating, reviewText, review, difficulty, wouldPlayAgain } = req.body;
  const reviewContent = reviewText || review;
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating 1-5 required' });
  try {
    const r = await prisma.courseReview.upsert({
      where: { courseId_userId: { courseId: req.params.courseId, userId: req.user!.id } },
      update: { rating, review: reviewContent, difficulty, wouldPlayAgain },
      create: {
        courseId: req.params.courseId,
        userId:   req.user!.id,
        rating,
        review:   reviewContent,
        difficulty,
        wouldPlayAgain: wouldPlayAgain ?? true,
      },
      include: { user: { select: { id: true, name: true, avatar: true } } },
    });
    res.json(r);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save review' });
  }
});

export default router;
