import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate as requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/feed/activity — friend activity feed (last 20 items)
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
          round: {
            select: {
              id: true,
              courseName: true,
              eventId: true,
              holes: { select: { holeNumber: true, par: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
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

    // Aggregate scores into round completions AND birdie highlights
    const roundMap = new Map<string, any>();
    for (const score of recentScores) {
      const key = `${score.roundId}:${score.userId}`;
      if (!roundMap.has(key)) {
        roundMap.set(key, { ...score, totalStrokes: 0, holeCount: 0, birdies: [] });
      }
      const entry = roundMap.get(key);
      entry.totalStrokes += score.strokes;
      entry.holeCount++;

      // Check for birdie: strokes = par - 1
      const hole = score.round.holes.find((h: { holeNumber: number; par: number }) => h.holeNumber === score.holeNumber);
      if (hole && score.strokes === hole.par - 1) {
        entry.birdies.push({ holeNumber: score.holeNumber, par: hole.par, strokes: score.strokes });
      }
    }

    for (const [, entry] of roundMap) {
      // Round completed activity
      activities.push({
        type:        'round_completed',
        userId:      entry.userId,
        userName:    entry.user.name,
        userAvatar:  entry.user.avatar,
        text:        `finished a round at ${entry.round.courseName} — shot ${entry.totalStrokes}`,
        entityId:    entry.roundId,
        entityType:  'round',
        createdAt:   entry.createdAt,
      });

      // Birdie activities
      for (const birdie of entry.birdies) {
        activities.push({
          type:        'birdie',
          userId:      entry.userId,
          userName:    entry.user.name,
          userAvatar:  entry.user.avatar,
          text:        `made a birdie on hole ${birdie.holeNumber} (par ${birdie.par}) at ${entry.round.courseName}`,
          entityId:    entry.roundId,
          entityType:  'round',
          createdAt:   entry.createdAt,
        });
      }
    }

    for (const post of recentPosts) {
      activities.push({
        type:        'post',
        userId:      post.userId,
        userName:    post.user.name,
        userAvatar:  post.user.avatar,
        text:        post.content.length > 100 ? post.content.slice(0, 97) + '…' : post.content,
        entityId:    post.id,
        entityType:  'post',
        createdAt:   post.createdAt,
      });
    }

    for (const p of recentParticipants) {
      activities.push({
        type:        'event_join',
        userId:      p.userId,
        userName:    p.user.name,
        userAvatar:  p.user.avatar,
        text:        `joined ${p.event.name}`,
        entityId:    p.event.id,
        entityType:  'event',
        createdAt:   p.createdAt,
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
