export const Colors = {
  // Backgrounds
  bg:           '#080C14',
  bgSecondary:  '#0F1420',
  bgTertiary:   '#161D2E',
  bgElevated:   '#1E2640',

  // Primary accent — champagne gold
  gold:         '#D4A843',
  goldMuted:    '#8B6F2E',
  goldLight:    '#F0C866',
  goldDim:      'rgba(212,168,67,0.15)',
  goldGlow:     'rgba(212,168,67,0.25)',

  // Secondary accent — electric teal
  teal:         '#00C9A7',
  tealMuted:    '#007A65',
  tealDim:      'rgba(0,201,167,0.15)',

  // Text
  textPrimary:   '#F4EFE6',
  textSecondary: '#8A8FA8',
  textMuted:     '#3D4460',

  // Score colors
  scoreEagle:   '#00C9A7',
  scoreBirdie:  '#D4A843',
  scorePar:     '#F4EFE6',
  scoreBogey:   '#C17B2E',
  scoreDouble:  '#C44B4B',

  // Functional
  success:  '#2DD4A0',
  error:    '#C44B4B',
  warning:  '#C17B2E',

  // Borders
  border:       'rgba(212,168,67,0.12)',
  borderStrong: 'rgba(212,168,67,0.30)',

  // Legacy aliases (keep for backward compat, map to new values)
  lime:         '#D4A843',
  limeDim:      'rgba(212,168,67,0.15)',
  limeGlow:     'rgba(212,168,67,0.25)',
  purple:       '#00C9A7',
  purpleDim:    'rgba(0,201,167,0.15)',
  purpleGlow:   'rgba(0,201,167,0.25)',
  card:         '#0F1420',
  cardBorder:   'rgba(212,168,67,0.12)',
  cardBorderActive: 'rgba(212,168,67,0.30)',
  glass:        'rgba(15,20,32,0.8)',
  glassBorder:  'rgba(212,168,67,0.10)',
  orange:       '#C17B2E',

  // More legacy aliases
  overlay:    'rgba(8,12,20,0.85)',
  surface:    '#080C14',
  offWhite:   '#F4EFE6',
  white:      '#F4EFE6',
  gray100:    '#1E2640',
  gray300:    '#3D4460',
  gray500:    '#8A8FA8',
  gray700:    '#161D2E',
  black:      '#000000',
  green:      '#2DD4A0',
  greenDark:  '#007A65',
  info:       '#00C9A7',

  // Score legacy
  eagle:       '#00C9A7',
  birdie:      '#D4A843',
  par:         '#F4EFE6',
  bogey:       '#C17B2E',
  doubleBogey: '#C44B4B',
};

export const Gradients = {
  gold:        ['#F0C866', '#C4912A'] as const,
  hero:        ['#1A2340', '#080C14'] as const,
  cardOverlay: ['transparent', 'rgba(8,12,20,0.92)'] as const,
  card:        ['#0F1420', '#080C14'] as const,
  teal:        ['#00C9A7', '#007A65'] as const,
  // Legacy
  accent:      ['#F0C866', '#C4912A'] as const,
  limeAlpha:   ['rgba(212,168,67,0.3)', 'rgba(212,168,67,0)'] as const,
  purpleAlpha: ['rgba(0,201,167,0.3)', 'rgba(0,201,167,0)'] as const,
  darkOverlay: ['rgba(8,12,20,0)', 'rgba(8,12,20,0.95)'] as const,
};

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

export const Radius = {
  xs:   6,
  sm:   10,
  md:   14,
  lg:   20,
  xl:   28,
  pill: 999,
  // legacy
  full: 999,
};

export const Typography = {
  hero:    { fontSize: 36, letterSpacing: -0.5, fontWeight: '700' as const },
  h1:      { fontSize: 28, letterSpacing: -0.3, fontWeight: '600' as const },
  h2:      { fontSize: 22, fontWeight: '600' as const },
  h3:      { fontSize: 18, fontWeight: '500' as const },
  body:    { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  label:   { fontSize: 11, letterSpacing: 1.5, fontWeight: '500' as const, textTransform: 'uppercase' as const },
  stat:    { fontSize: 24, letterSpacing: -0.5, fontWeight: '700' as const },
  score:   { fontSize: 16, fontWeight: '500' as const },
  // legacy numeric aliases
  xs:   11,
  sm:   13,
  md:   15,
  lg:   18,
  xl:   22,
  xxl:  28,
};

export const Shadows = {
  gold: {
    shadowColor: '#D4A843',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  teal: {
    shadowColor: '#00C9A7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
};

// Legacy alias
export const Shadow = {
  lime: {
    shadowColor: '#D4A843',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  purple: {
    shadowColor: '#00C9A7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  gold: {
    shadowColor: '#D4A843',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
};

export const Fonts = {
  serif:     'CormorantGaramond_600SemiBold',
  sansSerif: 'DMSans_400Regular',
  mono:      'DMMono_400Regular',
};
