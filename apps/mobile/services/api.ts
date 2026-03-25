import { Platform } from 'react-native';
import { API_BASE } from '../constants/api';

async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem('auth_token'); } catch { return null; }
  }
  const SecureStore = await import('expo-secure-store');
  return SecureStore.getItemAsync('auth_token');
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const json = await res.json();

  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json.data ?? json;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  requestOtp: (email?: string, phone?: string) =>
    request('/auth/request-otp', { method: 'POST', body: JSON.stringify({ email, phone }) }),
  verifyOtp: (contact: string, code: string, via: 'email' | 'phone' = 'email') =>
    request<{ token: string; user: import('@the-caddy/shared').User }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(via === 'phone' ? { phone: contact, code } : { email: contact, code }),
    }),
  socialAuth: (provider: 'google' | 'apple', token: string) =>
    request<{ token: string; user: import('@the-caddy/shared').User }>('/auth/social', {
      method: 'POST',
      body: JSON.stringify({ provider, token }),
    }),
  refresh: (token: string) =>
    request<{ token: string; user: import('@the-caddy/shared').User }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
};

// ─── Users ───────────────────────────────────────────────────────────────────

export const usersApi = {
  list: (params?: { role?: string; q?: string }) => {
    const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request<any[]>(`/users${qs}`);
  },
  getMe: () => request<import('@the-caddy/shared').User>('/users/me'),
  updateMe: (data: Partial<import('@the-caddy/shared').User>) =>
    request<import('@the-caddy/shared').User>('/users/me', { method: 'PUT', body: JSON.stringify(data) }),
  getUser: (id: string) => request<import('@the-caddy/shared').User>(`/users/${id}`),
  updateUser: (id: string, data: Partial<import('@the-caddy/shared').User>) =>
    request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateRole: (id: string, role: string) =>
    request<any>(`/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  getStats: (id: string) => request<import('@the-caddy/shared').UserStats>(`/users/${id}/stats`),
  search: (q: string) => request<import('@the-caddy/shared').User[]>(`/users/search?q=${encodeURIComponent(q)}`),
  getSuggestions: () => request<import('@the-caddy/shared').User[]>('/users/suggestions'),
  getFollowers: (id: string) => request<import('@the-caddy/shared').User[]>(`/users/${id}/followers`),
  getFollowing: (id: string) => request<import('@the-caddy/shared').User[]>(`/users/${id}/following`),
  getPosts: (id: string) => request<any[]>(`/users/${id}/posts`),
  getRounds: (id: string) => request<any[]>(`/users/${id}/rounds`),
  follow: (id: string) => request(`/users/${id}/follow`, { method: 'POST' }),
  unfollow: (id: string) => request(`/users/${id}/follow`, { method: 'DELETE' }),
};

// ─── Events ──────────────────────────────────────────────────────────────────

export const eventsApi = {
  list: () => request<import('@the-caddy/shared').Event[]>('/events'),
  get: (id: string) => request<import('@the-caddy/shared').Event>(`/events/${id}`),
  create: (data: unknown) => request('/events', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: unknown) =>
    request(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateStatus: (id: string, status: string) =>
    request(`/events/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  delete: (id: string) => request(`/events/${id}`, { method: 'DELETE' }),
  getStats: (id: string) => request<any>(`/events/${id}/stats`),
  invite: (id: string, userIds: string[]) =>
    request(`/events/${id}/invite`, { method: 'POST', body: JSON.stringify({ userIds }) }),
  respond: (id: string, status: 'ACCEPTED' | 'DECLINED') =>
    request(`/events/${id}/respond`, { method: 'PUT', body: JSON.stringify({ status }) }),
  leaderboard: (id: string) =>
    request<import('@the-caddy/shared').LeaderboardEntry[]>(`/events/${id}/leaderboard`),
  itinerary: (id: string) =>
    request<import('@the-caddy/shared').ItineraryItem[]>(`/events/${id}/itinerary`),
  socialPosts: (id: string) => request<any[]>(`/events/${id}/social`),
  getParticipants: (id: string) => request<any[]>(`/events/${id}/participants`),
  getHistory: (id: string) => request<any[]>(`/events/${id}/history`),
  addParticipant: (id: string, userId: string, role = 'PLAYER') =>
    request(`/events/${id}/participants`, { method: 'POST', body: JSON.stringify({ userId, role }) }),
  removeParticipant: (id: string, userId: string) =>
    request(`/events/${id}/participants/${userId}`, { method: 'DELETE' }),
};

// ─── Rounds ──────────────────────────────────────────────────────────────────

export const roundsApi = {
  get: (id: string) => request<import('@the-caddy/shared').Round>(`/rounds/${id}`),
  scorecard: (id: string) => request<import('@the-caddy/shared').Scorecard>(`/rounds/${id}/scorecard`),
  create: (data: unknown) => request('/rounds', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request(`/rounds/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// ─── Scores ──────────────────────────────────────────────────────────────────

export const scoresApi = {
  submit: (data: { roundId: string; userId: string; holeNumber: number; strokes: number }) =>
    request('/scores', { method: 'POST', body: JSON.stringify(data) }),
  getRoundScores: (roundId: string) => request<any[]>(`/scores/round/${roundId}`),
  getUserRoundScores: (roundId: string, userId: string) =>
    request<any[]>(`/scores/round/${roundId}/user/${userId}`),
  delete: (id: string) => request(`/scores/${id}`, { method: 'DELETE' }),
};

// ─── Social ──────────────────────────────────────────────────────────────────

export const postsApi = {
  getFeed: (feed: 'friends' | 'discover', page = 1) =>
    request<import('@the-caddy/shared').SocialPost[]>(`/posts?feed=${feed}&page=${page}`),
  like: (id: string) => request(`/posts/${id}/like`, { method: 'POST' }),
  unlike: (id: string) => request(`/posts/${id}/like`, { method: 'DELETE' }),
  delete: (id: string) => request(`/posts/${id}`, { method: 'DELETE' }),
  getComments: (id: string) => request<any[]>(`/posts/${id}/comments`),
  addComment: (id: string, content: string) =>
    request(`/posts/${id}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
};

// ─── Itinerary ───────────────────────────────────────────────────────────────

export const itineraryApi = {
  create: (data: unknown) => request('/itinerary', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: unknown) =>
    request(`/itinerary/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/itinerary/${id}`, { method: 'DELETE' }),
};

// ─── History ─────────────────────────────────────────────────────────────────

export const historyApi = {
  list: () => request<import('@the-caddy/shared').HistoryEntry[]>('/history'),
  get: (id: string) => request<import('@the-caddy/shared').HistoryEntry>(`/history/${id}`),
  create: (data: unknown) => request('/history', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: unknown) =>
    request(`/history/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// ─── Courses ─────────────────────────────────────────────────────────────────

export const coursesApi = {
  search: (q: string) => request<any[]>(`/courses/search?q=${encodeURIComponent(q)}`),
  getById: (id: string) => request<any>(`/courses/${id}`),
  create: (data: unknown) => request<any>('/courses', { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Notifications ────────────────────────────────────────────────────────────

export const notificationsApi = {
  getAll: () => request<any[]>('/notifications'),
  unreadCount: () => request<{ count: number }>('/notifications/unread-count'),
  readAll: () => request<void>('/notifications/read-all', { method: 'PUT' }),
  readOne: (id: string) => request<void>(`/notifications/${id}/read`, { method: 'PUT' }),
  delete: (id: string) => request<void>(`/notifications/${id}`, { method: 'DELETE' }),
};

// ─── Messages ─────────────────────────────────────────────────────────────────

export const messagesApi = {
  getConversations: () => request<any[]>('/messages/conversations'),
  getConversation: (userId: string) => request<any[]>(`/messages/conversation/${userId}`),
  send: (receiverId: string, content: string) =>
    request<any>('/messages', { method: 'POST', body: JSON.stringify({ receiverId, content }) }),
  markRead: (userId: string) =>
    request<void>(`/messages/conversation/${userId}/read`, { method: 'PUT' }),
  // legacy compat
  getOrCreateWith: (userId: string) =>
    request<{ conversationId: string; messages: any[] }>(`/messages/with/${userId}`),
};
