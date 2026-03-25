// This modal route now redirects to the leaderboard tab
import { Redirect } from 'expo-router';
export default function LeaderboardModal() {
  return <Redirect href="/(tabs)/leaderboard" />;
}
