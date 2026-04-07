// apps/mobile/constants/theme.ts
export const Colors = {
  // Backgrounds
  bg:           '#080C14',
  bgSecondary:  '#0F1420',
  bgTertiary:   '#161D2E',
  bgElevated:   '#1E2640',

  // Primary — lime green (matches screenshots)
  gold:         '#C4F135',
  goldMuted:    '#8FB520',
  goldLight:    '#D8FF50',

  // Secondary — electric teal
  teal:         '#00C9A7',
  tealMuted:    '#007A65',

  // Text
  textPrimary:  '#F4EFE6',
  textSecondary:'#8A8FA8',
  textMuted:    '#3D4460',

  // Score colors (matches screenshots: blue=eagle, lime=birdie, dark=par, orange=bogey, red=double)
  scoreEagle:   '#3B62D9',
  scoreBirdie:  '#C4F135',
  scorePar:     '#1A2030',
  scoreBogey:   '#D4561A',
  scoreDouble:  '#9B1C1C',

  // Functional
  success:      '#2DD4A0',
  error:        '#C44B4B',
  warning:      '#D4561A',

  // Borders
  border:       'rgba(196, 241, 53, 0.12)',
  borderStrong: 'rgba(196, 241, 53, 0.30)',
  cardBorder:   'rgba(196, 241, 53, 0.12)',

  // Legacy aliases
  lime:         '#C4F135',
  limeDim:      'rgba(196, 241, 53, 0.15)',
  limeGlow:     'rgba(196, 241, 53, 0.25)',
  goldDim:      'rgba(196, 241, 53, 0.15)',
  goldGlow:     'rgba(196, 241, 53, 0.25)',
  tealDim:      'rgba(0, 201, 167, 0.15)',
  tealGlow:     'rgba(0, 201, 167, 0.25)',
  purple:       '#4361B8',
  purpleDim:    'rgba(67, 97, 184, 0.15)',
  purpleGlow:   'rgba(67, 97, 184, 0.25)',
  card:         '#0F1420',
  cardBorderActive: 'rgba(196, 241, 53, 0.30)',
  glass:        'rgba(15,20,32,0.8)',
  glassBorder:  'rgba(196,241,53,0.10)',
  orange:       '#D4561A',
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
  eagle:       '#3B62D9',
  birdie:      '#C4F135',
  par:         '#1A2030',
  bogey:       '#D4561A',
  doubleBogey: '#9B1C1C',
};

export const Gradients = {
  gold:       ['#D8FF50', '#8FB520'] as const,
  hero:       ['#1A2340', '#080C14'] as const,
  cardOverlay:['transparent', 'rgba(8,12,20,0.92)'] as const,
  card:       ['#0F1420', '#080C14'] as const,
  teal:       ['#00C9A7', '#007A65'] as const,
  // Legacy
  accent:      ['#D8FF50', '#8FB520'] as const,
  limeAlpha:   ['rgba(196,241,53,0.3)', 'rgba(196,241,53,0)'] as const,
  purpleAlpha: ['rgba(67,97,184,0.3)', 'rgba(67,97,184,0)'] as const,
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
  sm:   6,
  md:   10,
  lg:   14,
  xl:   20,
  pill: 999,
  // legacy
  xs:   6,
  full: 999,
};

export const Typography = {
  hero:    { fontSize: 36, fontWeight: '700' as const, letterSpacing: -0.5, color: '#F4EFE6' },
  h1:      { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.3, color: '#F4EFE6' },
  h2:      { fontSize: 22, fontWeight: '600' as const, color: '#F4EFE6' },
  h3:      { fontSize: 18, fontWeight: '600' as const, color: '#F4EFE6' },
  body:    { fontSize: 15, lineHeight: 22, color: '#F4EFE6' },
  caption: { fontSize: 12, color: '#8A8FA8' },
  label:   { fontSize: 11, fontWeight: '600' as const, letterSpacing: 1.5, textTransform: 'uppercase' as const, color: '#8A8FA8' },
  stat:    { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.5, color: '#F4EFE6' },
  score:   { fontSize: 16, fontWeight: '600' as const, color: '#F4EFE6' },
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
    shadowColor: '#C4F135',
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
    shadowColor: '#C4F135',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  purple: {
    shadowColor: '#4361B8',
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
    shadowColor: '#C4F135',
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
