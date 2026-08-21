import { TextStyle } from 'react-native';

export const typography = {
  regular: 'Cairo_400Regular',
  medium: 'Cairo_500Medium',
  bold: 'Cairo_700Bold',
  extraBold: 'Cairo_800ExtraBold',
  fontFamily: {
    regular: 'Cairo_400Regular',
    medium: 'Cairo_500Medium',
    bold: 'Cairo_700Bold',
    extraBold: 'Cairo_800ExtraBold',
  },
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    display: 28,
  },
  lineHeight: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 28,
    xl: 30,
    xxl: 34,
    display: 38,
  },
} as const;

export const textStyles: Record<string, TextStyle> = {
  display: {
    fontFamily: typography.fontFamily.extraBold,
    fontSize: typography.fontSize.display,
    lineHeight: typography.lineHeight.display,
    textAlign: 'right',
  },
  h1: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xxl,
    lineHeight: typography.lineHeight.xxl,
    textAlign: 'right',
  },
  h2: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    lineHeight: typography.lineHeight.xl,
    textAlign: 'right',
  },
  h3: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    lineHeight: typography.lineHeight.lg,
    textAlign: 'right',
  },
  body: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
    textAlign: 'right',
  },
  bodyMedium: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
    textAlign: 'right',
  },
  caption: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
    textAlign: 'right',
  },
  captionBold: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
    textAlign: 'right',
  },
};
