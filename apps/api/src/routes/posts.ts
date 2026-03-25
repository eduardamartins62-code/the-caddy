import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { upload } from '../lib/cloudinary';

const router = Router();

const userSelect = { id: true, name: true, username: true, avatar: true };

// GET /api/posts?feed=friends|discover
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const feed  = (req.query.feed as string) || 'discover';
  const limit = 20;
  const cursor = req.query.cursor as string | undefined;

  let where: any = {};
  if (feed === 'friends') {
    const follows = await prisma.follow.findMany({
      where:  { followerId: req.user!.id },
      select: { followingId: true },
    });
    const followingIds = follows.map(f => f.followingId);
    where = { userId: { in: followingIds } };
  }

  const posts = await prisma.socialPost.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take:    limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      user:    { select: userSelect },
      likedBy: { where: { userId: req.user!.id }, select: { userId: true } },
      _count:  { select: { comments: true, likedBy: true } },
    },
  });

  const hasMore    = posts.length > limit;
  const items      = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  const postsWithLike = items.map(p => ({
    ...p,
    likedByMe: p.likedBy.length > 0,
    likedBy:   undefined,
  }));

  res.json({ data: postsWithLike, nextCursor, hasMore });
});

// POST /api/posts
router.post('/', authenticate, upload.single('media'), async (req: AuthRequest, res: Response) => {
  const { content, courseTag, courseId, location, eventId, roundId } = req.body;
  const file = req.file as Express.Multer.File & { path?: string; resource_type?: string };

  const isVideo = file?.mimetype?.startsWith('video');
  const post = await prisma.socialPost.create({
    data: {
      userId:    req.user!.id,
      content,
      courseTag: courseTag || null,
      courseId:  courseId  || null,
      location:  location  || null,
      eventId:   eventId   || null,
      roundId:   roundId   || null,
      imageUrl:  file && !isVideo ? file.path : null,
      videoUrl:  file && isVideo  ? file.path : null,
    },
    include: { user: { select: userSelect } },
  });
  res.status(201).json({ data: post });
});

// POST /api/posts/:id/like
router.post('/:id/like', authenticate, async (req: AuthRequest, res: Response) => {
  const { id }   = req.params;
  const userId   = req.user!.id;

  const existing = await prisma.postLike.findUnique({
    where: { postId_userId: { postId: id, userId } },
  });

  if (existing) {
    await prisma.postLike.delete({ where: { postId_userId: { postId: id, userId } } });
    const post = await prisma.socialPost.update({ where: { id }, data: { likes: { decrement: 1 } } });
    res.json({ data: { liked: false, likes: post.likes } });
  } else {
    await prisma.postLike.create({ data: { postId: id, userId } });
    const post = await prisma.socialPost.update({ where: { id }, data: { likes: { increment: 1 } } });
    res.json({ data: { liked: true, likes: post.likes } });
  }
});

// DELETE /api/posts/:id/like — unlike a post
router.delete('/:id/like', authenticate, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const existing = await prisma.postLike.findUnique({
    where: { postId_userId: { postId: id, userId } },
  });

  if (!existing) {
    res.status(404).json({ error: 'Like not found' });
    return;
  }

  await prisma.postLike.delete({ where: { postId_userId: { postId: id, userId } } });
  const post = await prisma.socialPost.update({ where: { id }, data: { likes: { decrement: 1 } } });
  res.json({ data: { liked: false, likes: post.likes } });
});

// GET /api/posts/:id/comments
router.get('/:id/comments', authenticate, async (req: AuthRequest, res: Response) => {
  const comments = await prisma.comment.findMany({
    where:   { postId: req.params.id },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: userSelect } },
  });
  res.json({ data: comments });
});

// POST /api/posts/:id/comments
router.post('/:id/comments', authenticate, async (req: AuthRequest, res: Response) => {
  const { content } = req.body as { content?: string };
  if (!content?.trim()) {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  const post = await prisma.socialPost.findUnique({ where: { id: req.params.id } });
  if (!post) { res.status(404).json({ error: 'Post not found' }); return; }

  const comment = await prisma.comment.create({
    data: {
      postId:  req.params.id,
      userId:  req.user!.id,
      content: content.trim(),
    },
    include: { user: { select: userSelect } },
  });

  res.status(201).json({ data: comment });
});

// DELETE /api/posts/:id
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const post = await prisma.socialPost.findUnique({ where: { id: req.params.id } });
  if (!post) { res.status(404).json({ error: 'Post not found' }); return; }
  if (post.userId !== req.user!.id && req.user!.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Forbidden' }); return;
  }
  await prisma.socialPost.delete({ where: { id: req.params.id } });
  res.json({ message: 'Post deleted' });
});

export default router;
