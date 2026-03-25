import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server as SocketServer } from 'socket.io';
import { setupSocketHandlers } from './lib/socket';
import authRoutes         from './routes/auth';
import userRoutes         from './routes/users';
import eventRoutes        from './routes/events';
import roundRoutes        from './routes/rounds';
import scoreRoutes        from './routes/scores';
import postRoutes         from './routes/posts';
import itineraryRoutes    from './routes/itinerary';
import historyRoutes      from './routes/history';
import courseRoutes       from './routes/courses';
import notificationRoutes from './routes/notifications';
import messageRoutes      from './routes/messages';
import adminRoutes        from './routes/admin';

dotenv.config();

const app        = express();
const httpServer = http.createServer(app);

// ─── Socket.io ───────────────────────────────────────────────────────────────

export const io = new SocketServer(httpServer, {
  cors: {
    origin:  process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST'],
  },
});

setupSocketHandlers(io);

// ─── Security Middleware ──────────────────────────────────────────────────────

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Auth route rate limiter: max 10 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests, please try again later.' },
});

// General rate limiter: max 100 requests per minute per IP
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests, please try again later.' },
});

app.use('/api/auth', authLimiter);
app.use('/api',      generalLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/auth',          authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/events',        eventRoutes);
app.use('/api/rounds',        roundRoutes);
app.use('/api/scores',        scoreRoutes);
app.use('/api/posts',         postRoutes);
app.use('/api/itinerary',     itineraryRoutes);
app.use('/api/history',       historyRoutes);
app.use('/api/courses',       courseRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages',      messageRoutes);
app.use('/api/admin',         adminRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use((err: any, req: any, res: any, next: any) => {
  const status  = err.status || 500;
  const message = err.message || 'Internal server error';
  if (process.env.NODE_ENV !== 'production') console.error(err);
  res.status(status).json({ error: message });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`The Caddy API running on port ${PORT}`);
});
