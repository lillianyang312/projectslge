import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet, Platform } from 'react-native';
import { colors, typography } from '../tokens';

type TextVariant = 'body' | 'bodyMedium' | 'bodySemiBold' | 'heading' | 'headingMedium' | 'headingSemiBold';
type TextSize = 'xs' | 'sm' | 'base' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl' | 'heading3' | 'heading2' | 'heading1' | 'display';
type TextColor = 'primary' | 'secondary' | 'muted' | 'accent' | 'success' | 'warning' | 'danger' | 'purple' | 'blue' | 'white';

interface CustomTextProps extends RNTextProps {
  variant?: TextVariant;
  size?: TextSize;
  color?: TextColor;
  children: React.ReactNode;
}

const colorMap: Record<TextColor, string> = {
  primary: colors.textPrimary,
  secondary: colors.textSecondary,
  muted: colors.textMuted,
  accent: colors.accent,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  purple: colors.purple,
  blue: colors.blue,
  white: '#FFFFFF',
};

export function Text({
  variant = 'body',
  size = 'md',
  color = 'primary',
  style,
  children,
  ...props
}: CustomTextProps) {
  const fontSize = typography?.sizes?.[size] || 14;
  const fontFamily = typography?.fonts?.[variant] || 'DMSans_400Regular';

  return (
    <RNText
      style={[
        styles.base,
        {
          fontFamily,
          fontSize,
          color: colorMap[color],
        },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  base: {
    color: colors.textPrimary,
    // Improve font rendering
    ...(Platform.OS === 'android' && {
      includeFontPadding: false,
    }),
  },
});
