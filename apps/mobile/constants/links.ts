import { LinkingOptions } from '@react-navigation/native';

export const DEEP_LINK_PREFIXES = ['thecaddy://', 'https://thecaddy.app'];

export const LINKING_CONFIG: LinkingOptions<any> = {
  prefixes: DEEP_LINK_PREFIXES,
  config: {
    screens: {
      '(tabs)': {
        screens: {
          home: '',
          profile: 'profile',
          leaderboard: 'leaderboard',
        },
      },
      'event/[id]': 'event/:id',
      'profile/[id]': 'profile/:id',
      'round/[id]': 'round/:id',
      'messages/[userId]': 'messages/:userId',
    },
  },
};
