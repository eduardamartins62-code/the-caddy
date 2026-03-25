import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../constants/api';
import { LeaderboardEntry } from '@the-caddy/shared';

export function useLeaderboardSocket(
  eventId: string | null,
  onUpdate: (leaderboard: LeaderboardEntry[]) => void
) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!eventId) return;

    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join:event', eventId);
    });

    socket.on('leaderboard:update', (data: { eventId: string; leaderboard: LeaderboardEntry[] }) => {
      if (data.eventId === eventId) onUpdate(data.leaderboard);
    });

    return () => {
      socket.emit('leave:event', eventId);
      socket.disconnect();
    };
  }, [eventId]);
}
