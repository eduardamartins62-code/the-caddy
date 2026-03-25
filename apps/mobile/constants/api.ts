import { Platform } from 'react-native';

// On web, use relative paths so the webpack proxy forwards /api → localhost:4000
// On native (iOS/Android), use the full localhost URL (or override via env var)
const isWeb = Platform.OS === 'web';

export const API_BASE = process.env.EXPO_PUBLIC_API_URL
  || (isWeb ? '/api' : 'http://localhost:4000/api');

export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL
  || (isWeb ? '/' : 'http://localhost:4000');
