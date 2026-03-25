import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

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

    // Join a specific event room for leaderboard/score updates
    socket.on('join_event', (eventId: string) => {
      if (typeof eventId === 'string' && eventId.trim()) {
        socket.join(`event:${eventId}`);
        console.log(`Socket ${socket.id} joined event:${eventId}`);
      }
    });

    // Legacy event name support
    socket.on('join:event', (eventId: string) => {
      if (typeof eventId === 'string' && eventId.trim()) {
        socket.join(`event:${eventId}`);
      }
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
