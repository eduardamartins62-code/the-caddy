// ─── THE CADDY — Modern Luxury Golf Design System ─────────────────────────────

export const Colors = {
  // Backgrounds
  bg:          '#0A0A0F',
  bgSecondary: '#13131A',
  bgTertiary:  '#1C1C27',

  // Accents
  lime:        '#C9F31D',
  purple:      '#7B61FF',
  limeDim:     'rgba(201,243,29,0.15)',
  purpleDim:   'rgba(123,97,255,0.15)',
  limeGlow:    'rgba(201,243,29,0.25)',
  purpleGlow:  'rgba(123,97,255,0.25)',

  // Text
  textPrimary:   '#FFFFFF',
  textSecondary: '#8A8A9A',
  textMuted:     '#4A4A5A',

  // Cards & Borders
  card:            '#13131A',
  cardBorder:      'rgba(255,255,255,0.06)',
  cardBorderActive: 'rgba(201,243,29,0.2)',
  glass:           'rgba(19,19,26,0.8)',
  glassBorder:     'rgba(255,255,255,0.08)',

  // Semantic
  success: '#22C55E',
  error:   '#EF4444',
  warning: '#F59E0B',
  orange:  '#F97316',

  // Score colors
  eagle:       '#7B61FF',
  birdie:      '#C9F31D',
  par:         '#FFFFFF',
  bogey:       '#F97316',
  doubleBogey: '#EF4444',

  // Overlay
  overlay: 'rgba(10,10,15,0.85)',

  // Legacy aliases (keep screens still being migrated working)
  gold:     '#C9F31D',
  goldDim:  'rgba(201,243,29,0.15)',
  surface:  '#0A0A0F',
  offWhite: '#FFFFFF',
  white:    '#FFFFFF',
  gray100:  '#2A2A35',
  gray300:  '#6A6A7A',
  gray500:  '#8A8A9A',
  gray700:  '#1C1C27',
  black:    '#000000',
  green:    '#0A0A0F',
  greenDark:'#0A0A0F',
  info:     '#7B61FF',
};

export const Gradients = {
  accent:      ['#C9F31D', '#7B61FF'] as const,
  hero:        ['#1A1A2E', '#0A0A0F'] as const,
  limeAlpha:   ['rgba(201,243,29,0.3)', 'rgba(201,243,29,0)'] as const,
  purpleAlpha: ['rgba(123,97,255,0.3)', 'rgba(123,97,255,0)'] as const,
  card:        ['rgba(28,28,39,0.9)', 'rgba(19,19,26,0.95)'] as const,
  darkOverlay: ['rgba(10,10,15,0)', 'rgba(10,10,15,0.95)'] as const,
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
  xs:   11,
  sm:   13,
  md:   15,
  lg:   18,
  xl:   22,
  xxl:  28,
  hero: 36,
};

export const Shadow = {
  lime: {
    shadowColor: '#C9F31D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  purple: {
    shadowColor: '#7B61FF',
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
  // legacy
  gold: {
    shadowColor: '#C9F31D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
};

// legacy alias
export const Fonts = {
  serif:     'System',
  sansSerif: 'System',
  mono:      'Courier',
};
