import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from './prisma';

interface JwtPayload {
  id:    string;
  email: string;
  role:  string;
}

function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
  } catch {
    return null;
  }
}

export function setupSocketHandlers(io: Server) {
  // Authenticate every socket connection via JWT in handshake.auth.token
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error('Authentication token required'));
    }
    const payload = verifyToken(token);
    if (!payload) {
      return next(new Error('Invalid or expired token'));
    }
    (socket as any).userId   = payload.id;
    (socket as any).userRole = payload.role;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId as string;
    console.log(`Socket connected: ${socket.id} (user: ${userId})`);

    // Auto-join personal room for notifications and direct messages
    socket.join(`user:${userId}`);

    // joinEvent — user joins event room for leaderboard/score updates
    socket.on('joinEvent', (eventId: string) => {
      if (typeof eventId === 'string' && eventId.trim()) {
        socket.join(`event:${eventId}`);
        console.log(`Socket ${socket.id} joined event:${eventId}`);
      }
    });

    // Join a specific event room (legacy names)
    socket.on('join_event', (eventId: string) => {
      if (typeof eventId === 'string' && eventId.trim()) {
        socket.join(`event:${eventId}`);
        console.log(`Socket ${socket.id} joined event:${eventId}`);
      }
    });

    socket.on('join:event', (eventId: string) => {
      if (typeof eventId === 'string' && eventId.trim()) {
        socket.join(`event:${eventId}`);
      }
    });

    // leaveEvent — user leaves event room
    socket.on('leaveEvent', (eventId: string) => {
      socket.leave(`event:${eventId}`);
    });

    socket.on('leave_event', (eventId: string) => {
      socket.leave(`event:${eventId}`);
    });

    socket.on('leave:event', (eventId: string) => {
      socket.leave(`event:${eventId}`);
    });

    // score:updated — broadcast to event room (SCOREKEEPER+ only)
    socket.on('score:updated', (data: { eventId: string; [key: string]: unknown }) => {
      const role = (socket as any).userRole as string;
      if (role === 'SCOREKEEPER' || role === 'SUPER_ADMIN') {
        io.to(`event:${data.eventId}`).emit('score:updated', data);
      }
    });

    // round:status — broadcast to event room
    socket.on('round:status', (data: { eventId: string; [key: string]: unknown }) => {
      io.to(`event:${data.eventId}`).emit('round:status', data);
    });

    // sendMessage — save message to DB and emit to receiver's personal room
    socket.on('sendMessage', async (data: { receiverId: string; content: string }) => {
      if (!data.receiverId || !data.content) return;
      try {
        const message = await prisma.message.create({
          data: {
            senderId:   userId,
            receiverId: data.receiverId,
            content:    data.content,
          },
          include: {
            sender:   { select: { id: true, name: true, avatar: true } },
            receiver: { select: { id: true, name: true, avatar: true } },
          },
        });
        // Emit to receiver's personal room
        io.to(`user:${data.receiverId}`).emit('message:new', message);
        // Emit back to sender so they can update their UI
        socket.emit('message:new', message);
      } catch (err) {
        console.error('sendMessage error:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // markRead — mark messages as read
    socket.on('markRead', async (data: { senderId: string }) => {
      if (!data.senderId) return;
      try {
        await prisma.message.updateMany({
          where: {
            senderId:   data.senderId,
            receiverId: userId,
            isRead:     false,
          },
          data: { isRead: true },
        });
        // Notify the sender that their messages were read
        io.to(`user:${data.senderId}`).emit('messages:read', { readBy: userId });
      } catch (err) {
        console.error('markRead error:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id} (user: ${userId})`);
    });
  });
}

// Emit leaderboard update to all clients watching an event
export function emitLeaderboardUpdate(io: Server, eventId: string, leaderboard: unknown) {
  io.to(`event:${eventId}`).emit('leaderboard:updated', { eventId, leaderboard });
  // Legacy event name
  io.to(`event:${eventId}`).emit('leaderboard:update',  { eventId, leaderboard });
}

// Emit a notification to a specific user
export function emitNotification(io: Server, userId: string, notification: unknown) {
  io.to(`user:${userId}`).emit('notification:new', notification);
}

// Emit a message to a specific user
export function emitMessage(io: Server, userId: string, message: unknown) {
  io.to(`user:${userId}`).emit('message:new', message);
}
