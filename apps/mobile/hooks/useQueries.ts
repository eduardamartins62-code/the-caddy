import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  eventsApi, usersApi, postsApi, notificationsApi, messagesApi, roundsApi, scoresApi,
} from '../services/api';
import { useAuth } from '../context/AuthContext';

// ─── Events ──────────────────────────────────────────────────────────────────

export function useEvents() {
  return useQuery({ queryKey: ['events'], queryFn: () => eventsApi.list() });
}

export function useEvent(id: string) {
  return useQuery({ queryKey: ['event', id], queryFn: () => eventsApi.get(id), enabled: !!id });
}

export function useEventLeaderboard(id: string) {
  return useQuery({
    queryKey: ['leaderboard', id],
    queryFn: () => eventsApi.leaderboard(id),
    enabled: !!id,
    refetchInterval: 30000,
  });
}

export function useEventParticipants(id: string) {
  return useQuery({
    queryKey: ['participants', id],
    queryFn: () => eventsApi.getParticipants(id),
    enabled: !!id,
  });
}

export function useEventItinerary(id: string) {
  return useQuery({
    queryKey: ['itinerary', id],
    queryFn: () => eventsApi.itinerary(id),
    enabled: !!id,
  });
}

export function useEventHistory(id: string) {
  return useQuery({
    queryKey: ['history', id],
    queryFn: () => eventsApi.getHistory(id),
    enabled: !!id,
  });
}

// ─── Users ───────────────────────────────────────────────────────────────────

export function useMe() {
  const { user } = useAuth();
  return useQuery({ queryKey: ['me'], queryFn: () => usersApi.getMe(), enabled: !!user });
}

export function useUser(id: string) {
  return useQuery({ queryKey: ['user', id], queryFn: () => usersApi.getUser(id), enabled: !!id });
}

export function useUserStats(id: string) {
  return useQuery({ queryKey: ['stats', id], queryFn: () => usersApi.getStats(id), enabled: !!id });
}

export function useUserPosts(id: string) {
  return useQuery({ queryKey: ['userPosts', id], queryFn: () => usersApi.getPosts(id), enabled: !!id });
}

export function useUserRounds(id: string) {
  return useQuery({ queryKey: ['userRounds', id], queryFn: () => usersApi.getRounds(id), enabled: !!id });
}

export function useFollowers(id: string) {
  return useQuery({ queryKey: ['followers', id], queryFn: () => usersApi.getFollowers(id), enabled: !!id });
}

export function useFollowing(id: string) {
  return useQuery({ queryKey: ['following', id], queryFn: () => usersApi.getFollowing(id), enabled: !!id });
}

export function useSuggestions() {
  const { user } = useAuth();
  return useQuery({ queryKey: ['suggestions'], queryFn: () => usersApi.getSuggestions(), enabled: !!user });
}

// ─── Posts ───────────────────────────────────────────────────────────────────

export function useFeed(feed: 'friends' | 'discover') {
  return useQuery({ queryKey: ['feed', feed], queryFn: () => postsApi.getFeed(feed) });
}

// ─── Notifications ────────────────────────────────────────────────────────────

export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.getAll(),
    enabled: !!user,
  });
}

export function useUnreadCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['unreadCount'],
    queryFn: () => notificationsApi.unreadCount(),
    enabled: !!user,
    refetchInterval: 60000,
  });
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export function useConversations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['conversations'],
    queryFn: () => messagesApi.getConversations(),
    enabled: !!user,
  });
}

// ─── Rounds ──────────────────────────────────────────────────────────────────

export function useRound(id: string) {
  return useQuery({ queryKey: ['round', id], queryFn: () => roundsApi.get(id), enabled: !!id });
}

export function useScorecard(id: string) {
  return useQuery({ queryKey: ['scorecard', id], queryFn: () => roundsApi.scorecard(id), enabled: !!id });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useFollowMutation() {
  const qc = useQueryClient();
  return {
    follow: useMutation({
      mutationFn: (id: string) => usersApi.follow(id),
      onSuccess: (_: any, id: string) => {
        qc.invalidateQueries({ queryKey: ['user', id] });
        qc.invalidateQueries({ queryKey: ['followers'] });
      },
    }),
    unfollow: useMutation({
      mutationFn: (id: string) => usersApi.unfollow(id),
      onSuccess: (_: any, id: string) => {
        qc.invalidateQueries({ queryKey: ['user', id] });
        qc.invalidateQueries({ queryKey: ['followers'] });
      },
    }),
  };
}

export function useLikeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, liked }: { id: string; liked: boolean }) =>
      liked ? postsApi.unlike(id) : postsApi.like(id),
    onMutate: async ({ id, liked }: { id: string; liked: boolean }) => {
      await qc.cancelQueries({ queryKey: ['feed'] });
      return { id, liked };
    },
  });
}
