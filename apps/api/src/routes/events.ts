import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireScorekeeper, AuthRequest } from '../middleware/auth';
import { upload } from '../lib/cloudinary';

const router = Router();

// GET /api/events
router.get('/', async (_req, res: Response) => {
  const events = await prisma.event.findMany({
    orderBy: { startDate: 'desc' },
    include: {
      participants: { include: { user: { select: { id: true, name: true, avatar: true } } } },
      _count:       { select: { rounds: true } },
    },
  });
  res.json({ data: events });
});

// POST /api/events
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const {
    name, description, type = 'TOURNAMENT', format = 'STROKE_PLAY',
    recurrence = 'ONE_TIME', recurrenceNote, privacy = 'INVITE_ONLY',
    startDate, endDate, location, courseId, participants = [],
  } = req.body;

  if (!name?.trim()) { res.status(400).json({ error: 'Event name is required' }); return; }
  if (!startDate)    { res.status(400).json({ error: 'Start date is required' }); return; }

  const event = await prisma.event.create({
    data: {
      name: name.trim(), description, type, format, recurrence, recurrenceNote,
      privacy, startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      location, courseId, createdBy: req.user!.id,
      // Auto-add creator as SCOREKEEPER participant
      participants: {
        create: [
          { userId: req.user!.id, role: 'SCOREKEEPER', status: 'ACCEPTED' },
          ...participants
            .filter((p: any) => p.userId !== req.user!.id)
            .map((p: any) => ({ userId: p.userId, role: p.role || 'PLAYER', status: 'PENDING' })),
        ],
      },
    },
  });
  res.status(201).json({ data: event });
});

// GET /api/events/:id
router.get('/:id', async (req, res: Response) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: {
      participants: { include: { user: { select: { id: true, name: true, avatar: true, handicap: true } } } },
      rounds:       { orderBy: { date: 'asc' } },
      itinerary:    { orderBy: { day: 'asc' } },
      history:      { orderBy: { year: 'desc' } },
      _count:       { select: { rounds: true, participants: true } },
    },
  });
  if (!event) { res.status(404).json({ error: 'Event not found' }); return; }
  res.json({ data: event });
});

// PUT /api/events/:id
router.put('/:id', authenticate, requireScorekeeper, async (req: AuthRequest, res: Response) => {
  const { name, description, type, startDate, endDate, location, courseId, isActive, status } = req.body;
  const event = await prisma.event.update({
    where: { id: req.params.id },
    data: {
      ...(name        !== undefined ? { name }        : {}),
      ...(description !== undefined ? { description } : {}),
      ...(type        !== undefined ? { type }        : {}),
      ...(location    !== undefined ? { location }    : {}),
      ...(courseId    !== undefined ? { courseId }    : {}),
      ...(isActive    !== undefined ? { isActive }    : {}),
      ...(status      !== undefined ? { status }      : {}),
      ...(startDate   ? { startDate: new Date(startDate) } : {}),
      ...(endDate     ? { endDate:   new Date(endDate)   } : {}),
    },
  });
  res.json({ data: event });
});

// DELETE /api/events/:id — organizer only
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const event = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!event) { res.status(404).json({ error: 'Event not found' }); return; }

  const isOrganizer = event.createdBy === req.user!.id;
  const isAdmin     = req.user!.role === 'SUPER_ADMIN';
  if (!isOrganizer && !isAdmin) {
    res.status(403).json({ error: 'Only the organizer can delete this event' }); return;
  }

  await prisma.event.delete({ where: { id: req.params.id } });
  res.json({ message: 'Event deleted' });
});

// GET /api/events/:id/stats — event-wide stats
router.get('/:id/stats', async (req, res: Response) => {
  const event = await prisma.event.findUnique({
    where:   { id: req.params.id },
    include: { rounds: { include: { scores: true, holes: true } } },
  });
  if (!event) { res.status(404).json({ error: 'Event not found' }); return; }

  let mostBirdies = { userId: '', count: 0 };
  let bestRound   = { userId: '', score: Infinity, roundId: '' };
  const totalRoundsPlayed = new Set<string>();
  const birdiesByUser: Record<string, number>  = {};
  const eaglesByUser:  Record<string, number>  = {};

  for (const round of event.rounds) {
    const roundGrossByUser: Record<string, number> = {};

    for (const score of round.scores) {
      const hole = round.holes.find(h => h.holeNumber === score.holeNumber);
      if (hole) {
        const diff = score.strokes - hole.par;
        if (diff === -1) {
          birdiesByUser[score.userId] = (birdiesByUser[score.userId] || 0) + 1;
        }
        if (diff <= -2) {
          eaglesByUser[score.userId] = (eaglesByUser[score.userId] || 0) + 1;
        }
      }
      roundGrossByUser[score.userId] = (roundGrossByUser[score.userId] || 0) + score.strokes;
      totalRoundsPlayed.add(`${round.id}:${score.userId}`);
    }

    for (const [uid, gross] of Object.entries(roundGrossByUser)) {
      if (gross < bestRound.score) {
        bestRound = { userId: uid, score: gross, roundId: round.id };
      }
    }
  }

  for (const [uid, count] of Object.entries(birdiesByUser)) {
    if (count > mostBirdies.count) mostBirdies = { userId: uid, count };
  }

  let mostEagles = { userId: '', count: 0 };
  for (const [uid, count] of Object.entries(eaglesByUser)) {
    if (count > mostEagles.count) mostEagles = { userId: uid, count };
  }

  res.json({
    data: {
      mostBirdies:       mostBirdies.userId ? mostBirdies : null,
      mostEagles:        mostEagles.userId  ? mostEagles  : null,
      bestRound:         bestRound.userId   ? bestRound   : null,
      totalRoundsPlayed: totalRoundsPlayed.size,
    },
  });
});

// POST /api/events/:id/invite
router.post('/:id/invite', authenticate, requireScorekeeper, async (req: AuthRequest, res: Response) => {
  const { userIds } = req.body as { userIds: string[] };
  const event = await prisma.event.findUnique({ where: { id: req.params.id }, select: { name: true } });
  // Upsert each participant to handle duplicates gracefully
  const invites = await Promise.all(
    userIds.map((userId: string) =>
      prisma.eventParticipant.upsert({
        where:  { eventId_userId: { eventId: req.params.id, userId } },
        update: {},
        create: { eventId: req.params.id, userId, status: 'PENDING' },
      })
    )
  );
  // Send notifications
  if (event) {
    await Promise.all(
      userIds.map((userId: string) =>
        prisma.notification.create({
          data: {
            userId,
            type: 'INVITE',
            title: 'Event Invitation',
            body: `You've been invited to ${event.name}`,
            data: JSON.stringify({ eventId: req.params.id }),
          },
        }).catch(() => {})
      )
    );
  }
  res.json({ data: invites });
});

// PUT /api/events/:id/respond
router.put('/:id/respond', authenticate, async (req: AuthRequest, res: Response) => {
  const { status } = req.body as { status: 'ACCEPTED' | 'DECLINED' };
  const participant = await prisma.eventParticipant.updateMany({
    where: { eventId: req.params.id, userId: req.user!.id },
    data:  { status, respondedAt: new Date() },
  });
  res.json({ data: participant });
});

// GET /api/events/:id/leaderboard
router.get('/:id/leaderboard', async (req, res: Response) => {
  const event = await prisma.event.findUnique({
    where:   { id: req.params.id },
    include: {
      participants: {
        where:   { status: 'ACCEPTED' },
        include: { user: true },
      },
      rounds: { include: { scores: true, holes: true } },
    },
  });
  if (!event) { res.status(404).json({ error: 'Event not found' }); return; }

  const leaderboard = event.participants.map(p => {
    const user     = p.user;
    const handicap = user.handicap || 0;
    let grossScore = 0;
    let holesPlayed = 0;
    const roundScores: Record<string, number> = {};

    for (const round of event.rounds) {
      const userScores = round.scores.filter(s => s.userId === user.id);
      const roundGross = userScores.reduce((sum, s) => sum + s.strokes, 0);
      if (roundGross > 0) {
        roundScores[round.id] = roundGross;
        grossScore  += roundGross;
        holesPlayed += userScores.length;
      }
    }

    const netScore = grossScore - handicap;
    return {
      user:       { id: user.id, name: user.name, avatar: user.avatar, handicap },
      grossScore, netScore, holesPlayed, roundScores,
    };
  });

  const sorted = leaderboard.sort((a, b) => a.netScore - b.netScore || a.grossScore - b.grossScore);
  const ranked = sorted.map((entry, i) => ({
    rank: i + 1,
    positionChange: 0, // placeholder — requires historical data to compute actual changes
    ...entry,
  }));

  res.json({ data: ranked });
});

// GET /api/events/:id/itinerary
router.get('/:id/itinerary', async (req, res: Response) => {
  const items = await prisma.itineraryItem.findMany({
    where:   { eventId: req.params.id },
    orderBy: [{ day: 'asc' }, { time: 'asc' }],
  });
  res.json({ data: items });
});

// GET /api/events/:id/social
router.get('/:id/social', async (req, res: Response) => {
  const posts = await prisma.socialPost.findMany({
    where:   { eventId: req.params.id },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true, avatar: true } } },
  });
  res.json({ data: posts });
});

// POST /api/events/:id/participants
router.post('/:id/participants', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) { res.status(404).json({ error: 'Event not found' }); return; }
    const isOrganizer = event.createdBy === req.user!.id;
    const isScorekeeper = await prisma.eventParticipant.findFirst({
      where: { eventId: req.params.id, userId: req.user!.id, role: 'SCOREKEEPER' }
    });
    if (!isOrganizer && !isScorekeeper) { res.status(403).json({ error: 'Insufficient permissions' }); return; }

    const { userId, role = 'PLAYER' } = req.body;
    const participant = await prisma.eventParticipant.upsert({
      where:  { eventId_userId: { eventId: req.params.id, userId } },
      update: { role },
      create: { eventId: req.params.id, userId, role, status: 'ACCEPTED' },
    });
    res.json({ data: participant });
  } catch (err) {
    console.error('POST /events/:id/participants error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/events/:id/participants/:userId
router.delete('/:id/participants/:userId', authenticate, requireScorekeeper, async (req: AuthRequest, res: Response) => {
  await prisma.eventParticipant.deleteMany({
    where: { eventId: req.params.id, userId: req.params.userId },
  });
  res.json({ data: { success: true } });
});

// PUT /api/events/:id/status
router.put('/:id/status', authenticate, requireScorekeeper, async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  const event = await prisma.event.update({
    where: { id: req.params.id },
    data:  { status },
  });
  res.json({ data: event });
});

// POST /api/events/:id/itinerary
router.post('/:id/itinerary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) { res.status(404).json({ error: 'Event not found' }); return; }
    const isOrganizer = event.createdBy === req.user!.id;
    const isScorekeeper = await prisma.eventParticipant.findFirst({
      where: { eventId: req.params.id, userId: req.user!.id, role: 'SCOREKEEPER' }
    });
    if (!isOrganizer && !isScorekeeper) { res.status(403).json({ error: 'Insufficient permissions' }); return; }

    const { day, type, title, description, location, mapLink, time, photoUrl } = req.body;
    if (!title) { res.status(400).json({ error: 'Title is required' }); return; }

    const item = await prisma.itineraryItem.create({
      data: {
        eventId: req.params.id,
        day: day || 1,
        type: type || 'GOLF',
        title,
        description,
        location,
        mapLink,
        time,
        photoUrl,
      }
    });
    res.status(201).json({ data: item });
  } catch (err) {
    console.error('POST /events/:id/itinerary error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/events/:id/itinerary/:itemId
router.put('/:id/itinerary/:itemId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) { res.status(404).json({ error: 'Event not found' }); return; }
    const isOrganizer = event.createdBy === req.user!.id;
    const isScorekeeper = await prisma.eventParticipant.findFirst({
      where: { eventId: req.params.id, userId: req.user!.id, role: 'SCOREKEEPER' }
    });
    if (!isOrganizer && !isScorekeeper) { res.status(403).json({ error: 'Insufficient permissions' }); return; }

    const { day, type, title, description, location, mapLink, time, photoUrl } = req.body;
    const item = await prisma.itineraryItem.update({
      where: { id: req.params.itemId },
      data: { day, type, title, description, location, mapLink, time, photoUrl }
    });
    res.json({ data: item });
  } catch (err) {
    console.error('PUT /events/:id/itinerary/:itemId error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/events/:id/itinerary/:itemId
router.delete('/:id/itinerary/:itemId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.itineraryItem.delete({ where: { id: req.params.itemId } });
    res.json({ data: { success: true } });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/events/:id/history
router.post('/:id/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) { res.status(404).json({ error: 'Event not found' }); return; }
    const isOrganizer = event.createdBy === req.user!.id;
    if (!isOrganizer) { res.status(403).json({ error: 'Only the organizer can add history' }); return; }

    const { year, champion, winningScore, coursePlayed, recap, photos } = req.body;
    if (!year) { res.status(400).json({ error: 'Year is required' }); return; }

    const entry = await prisma.historyEntry.upsert({
      where: { eventId_year: { eventId: req.params.id, year: parseInt(year) } },
      update: { champion, winningScore: winningScore ? parseInt(winningScore) : null, coursePlayed, recap },
      create: {
        eventId: req.params.id,
        year: parseInt(year),
        champion,
        winningScore: winningScore ? parseInt(winningScore) : null,
        coursePlayed,
        recap,
      }
    });

    // Add photos if provided
    if (photos && Array.isArray(photos) && photos.length > 0) {
      await prisma.historyPhoto.createMany({
        data: photos.map((url: string) => ({ historyEntryId: entry.id, url }))
      });
    }

    const entryWithPhotos = await prisma.historyEntry.findUnique({
      where: { id: entry.id },
      include: { historyPhotos: true }
    });
    res.status(201).json({ data: entryWithPhotos });
  } catch (err) {
    console.error('POST /events/:id/history error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/events/:id/history/:historyId/photos
router.post('/:id/history/:historyId/photos', authenticate, upload.single('photo'), async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file as any;
    if (!file?.path) { res.status(400).json({ error: 'No photo uploaded' }); return; }

    const photo = await prisma.historyPhoto.create({
      data: { historyEntryId: req.params.historyId, url: file.path }
    });
    res.status(201).json({ data: photo });
  } catch (err) {
    console.error('POST history photo error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
