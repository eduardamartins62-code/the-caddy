import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';

const router = Router();
router.use(authenticate as any);

const userSelect = { id: true, name: true, username: true, avatar: true };

// GET /api/messages/conversations
// Returns unique conversation partners with last message + unread count
router.get('/conversations', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    // Get all distinct partners
    const sentTo = await prisma.message.findMany({
      where:    { senderId: userId },
      distinct: ['receiverId'],
      select:   { receiverId: true },
    });
    const receivedFrom = await prisma.message.findMany({
      where:    { receiverId: userId },
      distinct: ['senderId'],
      select:   { senderId: true },
    });

    const partnerIds = Array.from(
      new Set([
        ...sentTo.map(m => m.receiverId),
        ...receivedFrom.map(m => m.senderId),
      ])
    );

    const conversations = await Promise.all(
      partnerIds.map(async (partnerId) => {
        const partner = await prisma.user.findUnique({
          where:  { id: partnerId },
          select: userSelect,
        });

        const lastMessage = await prisma.message.findFirst({
          where: {
            OR: [
              { senderId: userId,   receiverId: partnerId },
              { senderId: partnerId, receiverId: userId   },
            ],
          },
          orderBy: { createdAt: 'desc' },
        });

        const unreadCount = await prisma.message.count({
          where: { senderId: partnerId, receiverId: userId, isRead: false },
        });

        return { partner, lastMessage, unreadCount };
      })
    );

    // Sort by last message date descending
    conversations.sort((a, b) => {
      const aDate = a.lastMessage?.createdAt.getTime() ?? 0;
      const bDate = b.lastMessage?.createdAt.getTime() ?? 0;
      return bDate - aDate;
    });

    res.json({ data: conversations });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// GET /api/messages/conversation/:userId
// Get all messages between current user and :userId, marks as read
router.get('/conversation/:userId', async (req: AuthRequest, res: Response) => {
  const myId    = req.user!.id;
  const otherId = req.params.userId;
  try {
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: myId,    receiverId: otherId },
          { senderId: otherId, receiverId: myId    },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        sender:   { select: userSelect },
        receiver: { select: userSelect },
      },
    });

    // Mark incoming messages as read
    await prisma.message.updateMany({
      where: { senderId: otherId, receiverId: myId, isRead: false },
      data:  { isRead: true },
    });

    res.json({ data: messages });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/messages — send a message
// Body: { receiverId, content }
router.post('/', async (req: AuthRequest, res: Response) => {
  const myId = req.user!.id;
  const { receiverId, content } = req.body as { receiverId?: string; content?: string };

  if (!receiverId?.trim()) {
    res.status(400).json({ error: 'receiverId is required' });
    return;
  }
  if (!content?.trim()) {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  try {
    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) {
      res.status(404).json({ error: 'Receiver not found' });
      return;
    }

    const message = await prisma.message.create({
      data: {
        senderId:   myId,
        receiverId: receiverId.trim(),
        content:    content.trim(),
      },
      include: {
        sender:   { select: userSelect },
        receiver: { select: userSelect },
      },
    });

    // Emit via socket to receiver's personal room
    try {
      const { io } = await import('../index');
      io.to(`user:${receiverId}`).emit('message:new', message);
    } catch { /* socket not available */ }

    res.status(201).json({ data: message });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// PUT /api/messages/conversation/:userId/read
// Mark all messages from :userId to current user as read
router.put('/conversation/:userId/read', async (req: AuthRequest, res: Response) => {
  const myId    = req.user!.id;
  const otherId = req.params.userId;
  try {
    await prisma.message.updateMany({
      where: { senderId: otherId, receiverId: myId, isRead: false },
      data:  { isRead: true },
    });
    res.json({ data: { success: true } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

export default router;
