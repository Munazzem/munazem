export const colors = {
  // Brand Primary
  primary: '#0f4c81',
  primaryDark: '#0a355c',
  primaryLight: '#e0f2fe',
  primaryMuted: '#1e3a6e',

  // Status & Semantic
  success: '#16a34a',
  successLight: '#dcfce7',
  successDark: '#15803d',

  danger: '#dc2626',
  dangerLight: '#fee2e2',
  dangerDark: '#b91c1c',

  warning: '#d97706',
  warningLight: '#fef3c7',
  warningDark: '#b45309',

  info: '#0284c7',
  infoLight: '#e0f2fe',

  // Neutrals & Backgrounds
  background: '#f8fafc',
  card: '#ffffff',
  surface: '#f1f5f9',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',

  // Text Colors
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  textInverse: '#ffffff',

  // Overlay
  overlay: 'rgba(15, 23, 42, 0.6)',
} as const;

export type ColorType = typeof colors;
