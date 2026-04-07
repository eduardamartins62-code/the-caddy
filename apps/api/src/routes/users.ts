import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { upload } from '../lib/cloudinary';

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
  role: true, createdAt: true, isOnboarded: true, isPrivate: true,
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

// GET /api/users/check-username
router.get('/check-username', async (req, res: Response) => {
  const username = req.query.username as string;
  if (!username || username.length < 3) { res.json({ available: false }); return; }
  const existing = await prisma.user.findUnique({ where: { username } });
  res.json({ available: !existing });
});

// DELETE /api/users/me
router.delete('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.user.delete({ where: { id: req.user!.id } });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /users/me error', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// PUT /api/users/me — update own profile
router.put('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const { name, bio, handicap, homeCourse, location, avatar, username, isPrivate, isOnboarded } = req.body;

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
      ...(isPrivate !== undefined   ? { isPrivate }    : {}),
      ...(isOnboarded !== undefined ? { isOnboarded }  : {}),
    },
    select: PRIVATE_SELECT,
  });
  res.json({ data: user });
});

// POST /api/users/me/avatar — upload profile picture
router.post('/me/avatar', authenticate, upload.single('avatar'), async (req: AuthRequest, res: Response) => {
  const url = (req.file as any)?.path;
  if (!url) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { avatar: url },
  });
  res.json({ data: { avatar: url } });
});

// GET /api/users/me/handicap — current handicap index and recent records
router.get('/me/handicap', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.user!.id },
      select: { handicapIndex: true },
    });

    const records = await prisma.handicapRecord.findMany({
      where:   { userId: req.user!.id },
      orderBy: { calculatedAt: 'desc' },
      take:    10,
    });

    res.json({ data: { handicapIndex: user?.handicapIndex ?? null, records } });
  } catch (err) {
    console.error('GET /users/me/handicap error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/me/handicap/calculate — recalculate USGA handicap index
router.post('/me/handicap/calculate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get last 20 completed rounds with courseRating and slopeRating set
    const userScores = await prisma.score.findMany({
      where: { userId },
      include: {
        round: {
          include: { holes: true },
        },
      },
      orderBy: { round: { date: 'desc' } },
    });

    // Group scores by round and filter rounds that have courseRating + courseSlope
    const roundMap = new Map<string, { round: typeof userScores[0]['round']; scores: typeof userScores }>();
    for (const score of userScores) {
      if (!roundMap.has(score.roundId)) {
        roundMap.set(score.roundId, { round: score.round, scores: [] });
      }
      roundMap.get(score.roundId)!.scores.push(score);
    }

    const eligibleRounds = Array.from(roundMap.values()).filter(
      r => r.round.isComplete && r.round.courseRating !== null && r.round.courseSlope !== null
    );

    if (eligibleRounds.length < 3) {
      res.status(400).json({ error: 'At least 3 completed rounds with course rating/slope are required' });
      return;
    }

    // Take at most 20 most recent
    const recent = eligibleRounds.slice(0, 20);

    // Calculate score differential for each round
    const differentials = recent.map(r => {
      const grossScore   = r.scores.reduce((sum, s) => sum + s.strokes, 0);
      const courseRating = r.round.courseRating!;
      const slopeRating  = r.round.courseSlope!;
      const differential = (grossScore - courseRating) * 113 / slopeRating;
      return { roundId: r.round.id, grossScore, courseRating, slopeRating, differential: Math.round(differential * 10) / 10 };
    });

    // Determine how many differentials to use
    const n = recent.length;
    let useCount: number;
    if      (n <= 5)  useCount = 1;
    else if (n === 6) useCount = 2;
    else if (n <= 8)  useCount = 2;
    else if (n <= 11) useCount = 3;
    else if (n <= 14) useCount = 4;
    else if (n <= 16) useCount = 5;
    else if (n <= 18) useCount = 6;
    else if (n === 19) useCount = 7;
    else               useCount = 8;

    const sorted   = [...differentials].sort((a, b) => a.differential - b.differential);
    const lowest   = sorted.slice(0, useCount);
    const avgDiff  = lowest.reduce((sum, d) => sum + d.differential, 0) / useCount;
    const handicapIndex = Math.round(avgDiff * 0.96 * 10) / 10;

    // Save HandicapRecord
    await prisma.handicapRecord.create({
      data: { userId, handicapIndex, differential: Math.round(avgDiff * 10) / 10 },
    });

    // Update user.handicapIndex
    await prisma.user.update({
      where: { id: userId },
      data:  { handicapIndex },
    });

    res.json({ data: { handicapIndex, roundsUsed: n, differentials } });
  } catch (err) {
    console.error('POST /users/me/handicap/calculate error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
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

// GET /api/users/friends — mutual follows (friends)
router.get('/friends', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const following = await prisma.follow.findMany({
      where:  { followerId: req.user!.id },
      select: { followingId: true },
    });
    const followingIds = following.map(f => f.followingId);

    // Friends = people I follow who also follow me back
    const friends = await prisma.follow.findMany({
      where: { followerId: { in: followingIds }, followingId: req.user!.id },
      include: {
        follower: {
          select: { id: true, name: true, username: true, avatar: true, handicapIndex: true },
        },
      },
    });

    res.json({ data: friends.map(f => f.follower) });
  } catch (err) {
    console.error('GET /users/friends error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/follow-requests — people who follow me but I don't follow back
router.get('/follow-requests', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const myFollowing = await prisma.follow.findMany({
      where:  { followerId: req.user!.id },
      select: { followingId: true },
    });
    const myFollowingIds = myFollowing.map(f => f.followingId);

    const pendingFollowers = await prisma.follow.findMany({
      where: { followingId: req.user!.id, followerId: { notIn: myFollowingIds } },
      include: {
        follower: {
          select: { id: true, name: true, username: true, avatar: true, handicapIndex: true },
        },
      },
    });

    res.json({ data: pendingFollowers.map(f => f.follower) });
  } catch (err) {
    console.error('GET /users/follow-requests error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/nearby?city= — users with same location/city
router.get('/nearby', authenticate, async (req: AuthRequest, res: Response) => {
  const city = (req.query.city as string || '').trim();
  if (!city) {
    res.json({ data: [] });
    return;
  }
  try {
    const users = await prisma.user.findMany({
      where: {
        id: { not: req.user!.id },
        location: { contains: city },
      },
      select: { id: true, name: true, username: true, avatar: true, handicap: true, location: true },
      take: 20,
      orderBy: { name: 'asc' },
    });
    res.json({ data: users });
  } catch (err) {
    console.error('GET /users/nearby error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
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
  const { name, bio, handicap, homeCourse, location, avatar, username, isPrivate, isOnboarded } = req.body;

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
      ...(isPrivate !== undefined   ? { isPrivate }   : {}),
      ...(isOnboarded !== undefined ? { isOnboarded } : {}),
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

  let totalBirdies = 0, totalEagles = 0, totalPars = 0, totalBogeys = 0, totalDoubles = 0, holesInOne = 0;
  for (const score of scores) {
    const hole = score.round.holes.find(h => h.holeNumber === score.holeNumber);
    if (!hole) continue;
    const diff = score.strokes - hole.par;
    if (score.strokes === 1) holesInOne++;
    if (diff <= -2) totalEagles++;
    else if (diff === -1) totalBirdies++;
    else if (diff === 0) totalPars++;
    else if (diff === 1) totalBogeys++;
    else if (diff === 2) totalDoubles++;
  }

  const userRecord = await prisma.user.findUnique({
    where:  { id: userId },
    select: { handicapIndex: true },
  });

  const grossScores = roundBreakdown.map(r => r.grossScore);
  res.json({
    data: {
      totalRounds:    roundBreakdown.length,
      avgScore:       grossScores.length ? Math.round(grossScores.reduce((a, b) => a + b, 0) / grossScores.length) : 0,
      averageScore:   grossScores.length ? Math.round(grossScores.reduce((a, b) => a + b, 0) / grossScores.length) : 0,
      bestRound:      grossScores.length ? Math.min(...grossScores) : 0,
      bestScore:      grossScores.length ? Math.min(...grossScores) : 0,
      eagles:         totalEagles,
      birdies:        totalBirdies,
      pars:           totalPars,
      bogeys:         totalBogeys,
      doubles:        totalDoubles,
      holesInOne,
      handicapIndex:  userRecord?.handicapIndex ?? null,
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
