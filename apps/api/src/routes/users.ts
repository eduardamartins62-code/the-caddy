import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

const PUBLIC_SELECT = {
  id: true, name: true, username: true, email: true, avatar: true,
  bio: true, handicap: true, homeCourse: true, location: true,
  role: true, createdAt: true, isPrivate: true,
  _count: { select: { followers: true, following: true } },
};

const PRIVATE_SELECT = {
  id: true, email: true, phone: true, name: true, username: true, avatar: true,
  bio: true, handicap: true, homeCourse: true, location: true,
  role: true, createdAt: true, onboardingComplete: true, isPrivate: true,
  _count: { select: { followers: true, following: true } },
};

// GET /api/users/me — own profile
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: PRIVATE_SELECT,
  });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json({ data: user });
});

// PUT /api/users/me — update own profile
router.put('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const { name, bio, handicap, homeCourse, location, avatar, username, isPrivate, onboardingComplete } = req.body;

  // Validate username if provided
  if (username !== undefined && username !== null && username !== '') {
    if (!/^[a-zA-Z0-9_]{1,30}$/.test(username)) {
      res.status(400).json({ error: 'Username must be alphanumeric/underscore, max 30 chars' });
      return;
    }
    // Check uniqueness (excluding current user)
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing && existing.id !== req.user!.id) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }
  }

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      ...(name !== undefined            ? { name }             : {}),
      ...(bio !== undefined             ? { bio }              : {}),
      ...(handicap !== undefined        ? { handicap }         : {}),
      ...(homeCourse !== undefined      ? { homeCourse }       : {}),
      ...(location !== undefined        ? { location }         : {}),
      ...(avatar !== undefined          ? { avatar }           : {}),
      ...(username !== undefined        ? { username: username || null } : {}),
      ...(isPrivate !== undefined       ? { isPrivate }        : {}),
      ...(onboardingComplete !== undefined ? { onboardingComplete } : {}),
    },
    select: PRIVATE_SELECT,
  });
  res.json({ data: user });
});

// GET /api/users/search?q=  — search users by name or username
router.get('/search', authenticate, async (req: AuthRequest, res: Response) => {
  const q = (req.query.q as string || '').trim();
  if (!q) {
    res.json({ data: [] });
    return;
  }
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name:     { contains: q } },
        { username: { contains: q } },
      ],
    },
    select: { id: true, name: true, username: true, avatar: true, handicap: true },
    take: 20,
    orderBy: { name: 'asc' },
  });
  res.json({ data: users });
});

// GET /api/users/suggestions — users in same events but not yet followed
router.get('/suggestions', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  // Get IDs of users already followed
  const following = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  const followingIds = following.map(f => f.followingId);

  // Get IDs of users in same events
  const myEvents = await prisma.eventParticipant.findMany({
    where: { userId },
    select: { eventId: true },
  });
  const eventIds = myEvents.map(e => e.eventId);

  const coParticipants = await prisma.eventParticipant.findMany({
    where: {
      eventId: { in: eventIds },
      userId:  { notIn: [...followingIds, userId] },
    },
    select: { user: { select: { id: true, name: true, username: true, avatar: true, handicap: true } } },
    distinct: ['userId'],
    take: 10,
  });

  res.json({ data: coParticipants.map(p => p.user) });
});

// GET /api/users — list users (admin / search)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { role, q } = req.query as { role?: string; q?: string };
  const users = await prisma.user.findMany({
    where: {
      ...(role ? { role } : {}),
      ...(q ? { OR: [{ name: { contains: q } }, { username: { contains: q } }] } : {}),
    },
    select: {
      id: true, name: true, username: true, email: true, avatar: true,
      role: true, handicap: true, homeCourse: true,
    },
    orderBy: { name: 'asc' },
    take: 50,
  });
  res.json({ data: users });
});

// PUT /api/users/:id/role — promote/demote role (SUPER_ADMIN only)
router.put('/:id/role', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { role } = req.body as { role: string };
  const allowed = ['USER', 'SCOREKEEPER'];
  if (!allowed.includes(role)) { res.status(400).json({ error: 'Invalid role' }); return; }
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { role },
    select: { id: true, name: true, email: true, role: true },
  });
  res.json({ data: user });
});

// GET /api/users/:id/followers
router.get('/:id/followers', authenticate, async (req: AuthRequest, res: Response) => {
  const followers = await prisma.follow.findMany({
    where: { followingId: req.params.id },
    include: { follower: { select: { id: true, name: true, username: true, avatar: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: followers.map(f => f.follower) });
});

// GET /api/users/:id/following
router.get('/:id/following', authenticate, async (req: AuthRequest, res: Response) => {
  const following = await prisma.follow.findMany({
    where: { followerId: req.params.id },
    include: { following: { select: { id: true, name: true, username: true, avatar: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: following.map(f => f.following) });
});

// GET /api/users/:id/posts — paginated posts (cursor-based)
router.get('/:id/posts', authenticate, async (req: AuthRequest, res: Response) => {
  const limit  = 20;
  const cursor = req.query.cursor as string | undefined;

  const posts = await prisma.socialPost.findMany({
    where: { userId: req.params.id },
    orderBy: { createdAt: 'desc' },
    take:    limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      user:    { select: { id: true, name: true, username: true, avatar: true } },
      likedBy: { where: { userId: req.user!.id }, select: { userId: true } },
      _count:  { select: { comments: true, likedBy: true } },
    },
  });

  const hasMore    = posts.length > limit;
  const items      = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  res.json({
    data:       items.map(p => ({ ...p, likedByMe: p.likedBy.length > 0, likedBy: undefined })),
    nextCursor,
    hasMore,
  });
});

// GET /api/users/:id/rounds — round history with scores
router.get('/:id/rounds', authenticate, async (req: AuthRequest, res: Response) => {
  const scores = await prisma.score.findMany({
    where: { userId: req.params.id },
    include: {
      round: {
        include: {
          holes: { orderBy: { holeNumber: 'asc' } },
          event: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { round: { date: 'desc' } },
  });

  // Group by round
  const roundMap = new Map<string, any>();
  for (const score of scores) {
    const rid = score.roundId;
    if (!roundMap.has(rid)) {
      roundMap.set(rid, {
        round:  score.round,
        scores: [],
      });
    }
    roundMap.get(rid).scores.push({ holeNumber: score.holeNumber, strokes: score.strokes });
  }

  res.json({ data: Array.from(roundMap.values()) });
});

// GET /api/users/:id
router.get('/:id', async (req, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: PUBLIC_SELECT,
  });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json({ data: user });
});

// PUT /api/users/:id
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user!.id !== req.params.id && req.user!.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Forbidden' }); return;
  }
  const { name, bio, handicap, homeCourse, location, avatar, username, isPrivate, onboardingComplete } = req.body;

  if (username !== undefined && username !== null && username !== '') {
    if (!/^[a-zA-Z0-9_]{1,30}$/.test(username)) {
      res.status(400).json({ error: 'Username must be alphanumeric/underscore, max 30 chars' });
      return;
    }
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing && existing.id !== req.params.id) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined            ? { name }             : {}),
      ...(bio !== undefined             ? { bio }              : {}),
      ...(handicap !== undefined        ? { handicap }         : {}),
      ...(homeCourse !== undefined      ? { homeCourse }       : {}),
      ...(location !== undefined        ? { location }         : {}),
      ...(avatar !== undefined          ? { avatar }           : {}),
      ...(username !== undefined        ? { username: username || null } : {}),
      ...(isPrivate !== undefined       ? { isPrivate }        : {}),
      ...(onboardingComplete !== undefined ? { onboardingComplete } : {}),
    },
    select: PRIVATE_SELECT,
  });
  res.json({ data: user });
});

// GET /api/users/:id/stats
router.get('/:id/stats', async (req, res: Response) => {
  const userId = req.params.id;

  const scores = await prisma.score.findMany({
    where: { userId },
    include: { round: { include: { holes: true, event: true } } },
  });

  const roundMap = new Map<string, { roundId: string; eventName: string; date: string; strokes: number[]; holes: { holeNumber: number; par: number }[] }>();
  for (const score of scores) {
    if (!roundMap.has(score.roundId)) {
      roundMap.set(score.roundId, {
        roundId:   score.roundId,
        eventName: score.round.event.name,
        date:      score.round.date.toISOString(),
        strokes:   [],
        holes:     score.round.holes,
      });
    }
    roundMap.get(score.roundId)!.strokes.push(score.strokes);
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { handicap: true } });
  const handicap = user?.handicap || 0;

  const roundBreakdown = Array.from(roundMap.values()).map(r => {
    const gross = r.strokes.reduce((a, b) => a + b, 0);
    return { roundId: r.roundId, eventName: r.eventName, date: r.date, grossScore: gross, netScore: gross - handicap };
  });

  let totalBirdies = 0, totalEagles = 0, totalPars = 0;
  for (const score of scores) {
    const hole = score.round.holes.find(h => h.holeNumber === score.holeNumber);
    if (!hole) continue;
    const diff = score.strokes - hole.par;
    if (diff <= -2) totalEagles++;
    else if (diff === -1) totalBirdies++;
    else if (diff === 0) totalPars++;
  }

  const grossScores = roundBreakdown.map(r => r.grossScore);
  res.json({
    data: {
      totalRounds:  roundBreakdown.length,
      averageScore: grossScores.length ? Math.round(grossScores.reduce((a, b) => a + b, 0) / grossScores.length) : 0,
      bestScore:    grossScores.length ? Math.min(...grossScores) : 0,
      totalBirdies, totalEagles, totalPars,
      roundBreakdown,
    },
  });
});

// POST /api/users/:id/follow
router.post('/:id/follow', authenticate, async (req: AuthRequest, res: Response) => {
  const followingId = req.params.id;
  const followerId  = req.user!.id;
  if (followerId === followingId) { res.status(400).json({ error: 'Cannot follow yourself' }); return; }

  await prisma.follow.upsert({
    where:  { followerId_followingId: { followerId, followingId } },
    update: {},
    create: { followerId, followingId },
  });
  res.json({ message: 'Following' });
});

// DELETE /api/users/:id/follow
router.delete('/:id/follow', authenticate, async (req: AuthRequest, res: Response) => {
  const followingId = req.params.id;
  const followerId  = req.user!.id;
  await prisma.follow.deleteMany({ where: { followerId, followingId } });
  res.json({ message: 'Unfollowed' });
});

export default router;
