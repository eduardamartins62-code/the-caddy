// ─── Enums ───────────────────────────────────────────────────────────────────

export type UserRole = 'USER' | 'SCOREKEEPER' | 'SUPER_ADMIN';
export type EventType = 'WEEKEND' | 'TRIP' | 'TOURNAMENT';
export type ParticipantStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';
export type ItineraryItemType = 'HOTEL' | 'DINING' | 'GOLF' | 'TRANSPORT' | 'NIGHTLIFE';

// ─── User ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  phone?: string | null;
  name: string;
  username?: string | null;
  avatar: string | null;
  bio: string | null;
  handicap: number | null;
  handicapIndex?: number | null;
  homeCourse: string | null;
  location?: string | null;
  role: UserRole;
  onboardingComplete?: boolean;
  createdAt: string;
}

export interface UserStats {
  totalRounds: number;
  averageScore: number;
  bestScore: number;
  totalBirdies: number;
  totalEagles: number;
  totalPars: number;
  roundBreakdown: RoundSummary[];
}

export interface RoundSummary {
  roundId: string;
  eventName: string;
  date: string;
  grossScore: number;
  netScore: number;
}

// ─── Follow ──────────────────────────────────────────────────────────────────

export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
}

// ─── Event ───────────────────────────────────────────────────────────────────

export interface Event {
  id: string;
  name: string;
  type: EventType;
  startDate: string;
  endDate: string;
  location: string;
  courseId: string | null;
  createdBy: string;
  isActive: boolean;
  status?: string | null;
  description?: string | null;
  host?: User | null;
  recurrence?: string | null;
  participants?: EventParticipant[];
  rounds?: Round[];
  _count?: { rounds?: number; participants?: number; [key: string]: number | undefined };
}

export interface EventParticipant {
  id: string;
  eventId: string;
  userId: string;
  status: ParticipantStatus;
  user?: User;
}

// ─── Round & Scoring ─────────────────────────────────────────────────────────

export interface Round {
  id: string;
  eventId: string;
  courseId: string;
  courseName: string;
  coursePhoto: string | null;
  date: string;
  isComplete: boolean;
  status?: string | null;
  roundNumber?: number | null;
  coursePar?: number | null;
  courseRating?: number | null;
  courseSlope?: number | null;
  format?: string | null;
  event?: { id: string; name: string } | null;
  participants?: any[];
  holes?: RoundHole[];
}

export interface RoundHole {
  id: string;
  roundId: string;
  holeNumber: number;
  par: number;
}

export interface Score {
  id: string;
  roundId: string;
  userId: string;
  holeNumber: number;
  strokes: number;
}

export interface Scorecard {
  round: Round;
  holes: RoundHole[];
  scores: Record<string, Score[]>; // userId → scores[]
  players: User[];
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  previousRank: number;
  user: User;
  grossScore: number;
  netScore: number;
  holesPlayed: number;
  roundScores: Record<string, number>; // roundId → gross score
  positionChange: 'up' | 'down' | 'same';
}

// ─── Itinerary ───────────────────────────────────────────────────────────────

export interface ItineraryItem {
  id: string;
  eventId: string;
  day: number;
  type: ItineraryItemType;
  title: string;
  description: string | null;
  location: string | null;
  mapLink: string | null;
  photoUrl: string | null;
  time: string | null;
}

// ─── Social ──────────────────────────────────────────────────────────────────

export interface SocialPost {
  id: string;
  userId: string;
  user?: User;
  content: string;
  imageUrl: string | null;
  videoUrl: string | null;
  courseTag: string | null;
  location: string | null;
  likes: number;
  likedByMe?: boolean;
  createdAt: string;
}

// ─── History ─────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  id: string;
  eventId: string;
  year: number;
  champion: string;
  recap: string;
  photos: string[];
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  user: User;
}

export interface OTPRequest {
  email: string;
}

export interface OTPVerify {
  email: string;
  code: string;
}

// ─── API Response Wrapper ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: string;
  statusCode: number;
}

// ─── Socket Events ───────────────────────────────────────────────────────────

export interface LeaderboardUpdateEvent {
  eventId: string;
  leaderboard: LeaderboardEntry[];
}

export type ScoreType = 'eagle' | 'birdie' | 'par' | 'bogey' | 'double_bogey' | 'other';

export function getScoreType(strokes: number, par: number): ScoreType {
  const diff = strokes - par;
  if (diff <= -2) return 'eagle';
  if (diff === -1) return 'birdie';
  if (diff === 0) return 'par';
  if (diff === 1) return 'bogey';
  if (diff === 2) return 'double_bogey';
  return 'other';
}
