import { Pressable, StyleSheet, Text } from 'react-native';
import { useMemo } from 'react';

import { spacing, typography, type ThemePalette } from '../theme';
import { useThemePalette } from '../theme/ThemeContext';

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
};

function buttonStyles(p: ThemePalette) {
  const feminine = p.themeId === 'feminine';
  return StyleSheet.create({
    button: {
      alignItems: 'center',
      borderRadius: 15,
      justifyContent: 'center',
      minHeight: 48,
      paddingHorizontal: spacing.md,
    },
    primary: {
      backgroundColor: p.primaryDark,
      borderColor: p.gold,
      borderWidth: 1,
    },
    secondary: {
      backgroundColor: feminine ? p.surface : p.primarySoft,
      borderColor: feminine ? p.gold : p.primary,
      borderWidth: 1,
    },
    pressed: {
      opacity: 0.75,
    },
    label: {
      color: p.white,
      fontSize: typography.body,
      fontWeight: '800',
      writingDirection: 'rtl',
    },
    secondaryLabel: {
      color: feminine ? p.ink : p.primaryDark,
    },
  });
}

export function ActionButton({
  label,
  onPress,
  variant = 'primary',
}: ActionButtonProps) {
  const p = useThemePalette();
  const styles = useMemo(() => buttonStyles(p), [p]);
  const secondary = variant === 'secondary';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary ? styles.secondary : styles.primary,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, secondary && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}
