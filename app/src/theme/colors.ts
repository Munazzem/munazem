export const colors = {
  // ── Brand Primary (Navy) ──────────────────────────────────────────────────
  primary: '#0f4c81',
  primaryDark: '#0a355c',
  primaryLight: '#e0f2fe',
  primaryMuted: '#1e3a6e',

  // ── Dark Navy Palette (Premium Identity) ─────────────────────────────────
  navy: '#0b1f3a',          // Darkest – screen backgrounds, tab bar
  navyDeep: '#081529',       // Absolute dark for deep sections
  navyMid: '#0d2d52',        // Card backgrounds in dark contexts
  navyRich: '#0f3460',       // Header backgrounds
  navyLight: '#1a4475',      // Subtle borders in dark UI

  // ── Royal / Info Blue ─────────────────────────────────────────────────────
  royalBlue: '#1a6dbe',
  royalBlueMid: '#1558a2',
  skyBlue: '#38bdf8',        // Accent highlights, CTAs on dark bg
  skyBlueMid: '#0ea5e9',
  skyBlueFaint: 'rgba(56,189,248,0.12)',

  // ── Gold Accents (Very Subtle Premium Touch) ──────────────────────────────
  gold: '#b8952a',
  goldLight: '#f5d87e',
  goldFaint: 'rgba(184,149,42,0.15)',

  // ── Status & Semantic ─────────────────────────────────────────────────────
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

  // ── Attendance Status Colors ──────────────────────────────────────────────
  present: '#16a34a',
  presentLight: '#dcfce7',
  absent: '#dc2626',
  absentLight: '#fee2e2',
  excused: '#d97706',
  excusedLight: '#fef3c7',
  compensation: '#0284c7',
  compensationLight: '#e0f2fe',

  // ── Neutrals & Backgrounds ────────────────────────────────────────────────
  background: '#f8fafc',
  card: '#ffffff',
  surface: '#f1f5f9',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',

  // ── Text Colors ───────────────────────────────────────────────────────────
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  textInverse: '#ffffff',
  textNavy: '#0b1f3a',

  // ── Overlay / Glass ───────────────────────────────────────────────────────
  overlay: 'rgba(15, 23, 42, 0.6)',
  glassLight: 'rgba(255,255,255,0.06)',
  glassBorder: 'rgba(255,255,255,0.12)',
  glassNavy: 'rgba(11,31,58,0.75)',
} as const;

export type ColorType = typeof colors;
