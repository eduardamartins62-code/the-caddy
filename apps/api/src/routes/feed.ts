import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate as requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/feed/activity — friend activity feed
router.get('/activity', requireAuth, async (req: AuthRequest, res) => {
  try {
    const following = await prisma.follow.findMany({
      where: { followerId: req.user!.id },
      select: { followingId: true },
    });
    const friendIds = following.map(f => f.followingId);

    if (friendIds.length === 0) return res.json([]);

    const [recentScores, recentPosts, recentParticipants] = await Promise.all([
      prisma.score.findMany({
        where: { userId: { in: friendIds } },
        include: {
          user: { select: { id: true, name: true, avatar: true } },
          round: { select: { courseName: true, id: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.socialPost.findMany({
        where: { userId: { in: friendIds } },
        include: { user: { select: { id: true, name: true, avatar: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.eventParticipant.findMany({
        where: { userId: { in: friendIds }, status: 'ACCEPTED' },
        include: {
          user: { select: { id: true, name: true, avatar: true } },
          event: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const activities: any[] = [];

    // Aggregate scores into round completions
    const roundScores = new Map<string, any>();
    for (const score of recentScores) {
      if (!roundScores.has(score.roundId)) {
        roundScores.set(score.roundId, { ...score, totalStrokes: 0, holeCount: 0 });
      }
      const entry = roundScores.get(score.roundId);
      entry.totalStrokes += score.strokes;
      entry.holeCount++;
    }
    for (const [roundId, entry] of roundScores) {
      activities.push({
        type: 'ROUND_SCORE',
        userId: entry.userId,
        user: entry.user,
        text: `finished a round at ${entry.round.courseName} — shot ${entry.totalStrokes}`,
        navigateTo: `/round/${roundId}`,
        createdAt: entry.createdAt,
      });
    }

    for (const post of recentPosts) {
      activities.push({
        type: 'POST',
        userId: post.userId,
        user: post.user,
        text: `posted ${post.imageUrl ? 'a photo' : post.videoUrl ? 'a video' : 'something'}`,
        navigateTo: null,
        createdAt: post.createdAt,
      });
    }

    for (const p of recentParticipants) {
      activities.push({
        type: 'EVENT_JOIN',
        userId: p.userId,
        user: p.user,
        text: `joined ${p.event.name}`,
        navigateTo: `/event/${p.event.id}`,
        createdAt: p.createdAt,
      });
    }

    activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(activities.slice(0, 20));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

export default router;
