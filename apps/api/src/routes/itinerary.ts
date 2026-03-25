import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireScorekeeper, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/itinerary
router.post('/', authenticate, requireScorekeeper, async (req: AuthRequest, res: Response) => {
  const { eventId, day, type, title, description, location, mapLink, photoUrl, time } = req.body;
  const item = await prisma.itineraryItem.create({
    data: { eventId, day, type, title, description, location, mapLink, photoUrl, time },
  });
  res.status(201).json({ data: item });
});

// PUT /api/itinerary/:id
router.put('/:id', authenticate, requireScorekeeper, async (req: AuthRequest, res: Response) => {
  const { day, type, title, description, location, mapLink, photoUrl, time } = req.body;
  const item = await prisma.itineraryItem.update({
    where: { id: req.params.id },
    data: { day, type, title, description, location, mapLink, photoUrl, time },
  });
  res.json({ data: item });
});

// DELETE /api/itinerary/:id
router.delete('/:id', authenticate, requireScorekeeper, async (req: AuthRequest, res: Response) => {
  await prisma.itineraryItem.delete({ where: { id: req.params.id } });
  res.json({ message: 'Deleted' });
});

export default router;
