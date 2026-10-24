import { Pressable, Text, View } from 'react-native';

import type { PublishedAidRequest } from '../services/aidRequest';
import { aidPayChannelLabel } from '../services/aidRequest';
import { spacing, type ThemePalette } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';

type Props = {
  row: PublishedAidRequest;
  compact?: boolean;
  onOpenGiving?: () => void;
};

export function PublishedAidOpportunityCard({ row, compact = false, onOpenGiving }: Props) {
  const styles = useThemedStyles(cardStyles);
  const channel = aidPayChannelLabel(row.payChannel);
  const body = (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <Text style={styles.kicker}>{row.situationLabel || 'فرصة مساعدة'}</Text>
      <Text style={styles.body} numberOfLines={compact ? 3 : 8}>
        {row.body || row.title || 'احتياج معتمد عبر صندوق العائلة.'}
      </Text>
      {compact ? (
        <Text style={styles.channel}>{channel}</Text>
      ) : (
        <>
          <Text style={styles.channel}>{channel}</Text>
          {row.payRef ? (
            <Text style={styles.ref} selectable>
              {row.payRef}
            </Text>
          ) : null}
          {row.contactNote ? <Text style={styles.note}>{row.contactNote}</Text> : null}
        </>
      )}
      {compact && onOpenGiving ? <Text style={styles.cta}>التفاصيل ورقم المساهمة من تبرع</Text> : null}
    </View>
  );

  if (onOpenGiving) {
    return (
      <Pressable accessibilityRole="button" onPress={onOpenGiving} style={({ pressed }) => pressed && styles.pressed}>
        {body}
      </Pressable>
    );
  }
  return body;
}

function cardStyles(p: ThemePalette) {
  return {
    card: {
      marginTop: spacing.sm,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: 'rgba(37, 92, 77, 0.18)',
      backgroundColor: p.primarySoft,
      gap: 6,
    },
    cardCompact: {
      backgroundColor: p.surface,
      borderColor: 'rgba(196, 163, 90, 0.35)',
    },
    kicker: {
      color: p.primaryDark,
      fontSize: 13,
      fontWeight: '900' as const,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    body: {
      color: p.text,
      fontSize: 15,
      lineHeight: 24,
      fontWeight: '600' as const,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    channel: {
      color: p.accent,
      fontSize: 13,
      fontWeight: '800' as const,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
      marginTop: 4,
    },
    ref: {
      color: p.text,
      fontSize: 16,
      fontWeight: '900' as const,
      textAlign: 'left' as const,
      writingDirection: 'ltr' as const,
      letterSpacing: 0.4,
    },
    note: {
      color: p.textMuted,
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
      marginTop: 4,
    },
    cta: {
      color: p.primaryDark,
      fontSize: 12,
      fontWeight: '800' as const,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
      marginTop: 2,
    },
    pressed: {
      opacity: 0.86,
    },
  };
}
