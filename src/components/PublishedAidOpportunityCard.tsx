import { useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';

import type { AidPayChannel, PublishedAidRequest } from '../services/aidRequest';
import {
  aidPayChannelLabel,
  aidPayHowTo,
  aidPayRefFieldLabel,
} from '../services/aidRequest';
import { spacing, type ThemePalette } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';

type Props = {
  row: PublishedAidRequest;
  compact?: boolean;
  onOpenGiving?: () => void;
};

export function PublishedAidOpportunityCard({ row, compact = false, onOpenGiving }: Props) {
  const styles = useThemedStyles(cardStyles);
  const [copyNote, setCopyNote] = useState('');
  const channel = (row.payChannel || 'family_fund') as AidPayChannel;
  const channelLabel = row.payChannelLabel || aidPayChannelLabel(channel);
  const fieldLabel = aidPayRefFieldLabel(channel);
  const howTo = aidPayHowTo(channel);
  const refValue = String(row.payRef || '').trim();

  const shareRef = async () => {
    if (!refValue) {
      setCopyNote('لا يوجد رقم مساهمة بعد — بانتظار الإدارة.');
      return;
    }
    try {
      await Share.share({ message: refValue, title: fieldLabel });
      setCopyNote('جاهز للنسخ أو الإرسال من ورقة المشاركة.');
    } catch {
      setCopyNote('تعذر فتح المشاركة. حدّد الرقم يدويًا.');
    }
  };

  if (compact) {
    const body = (
      <View style={[styles.card, styles.cardCompact]}>
        <Text style={styles.kicker}>{row.situationLabel || 'فرصة مساعدة'}</Text>
        <Text style={styles.body} numberOfLines={3}>
          {row.body || row.title || 'احتياج معتمد.'}
        </Text>
        <Text style={styles.channel}>{channelLabel}</Text>
        {onOpenGiving ? (
          <Text style={styles.cta}>افتح تبرع للمساهمة: عثيم أو سداد فاتورة</Text>
        ) : null}
      </View>
    );
    if (onOpenGiving) {
      return (
        <Pressable
          accessibilityRole="button"
          onPress={onOpenGiving}
          style={({ pressed }) => pressed && styles.pressed}
        >
          {body}
        </Pressable>
      );
    }
    return body;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>{row.situationLabel || 'فرصة مساعدة'}</Text>
      <Text style={styles.body}>{row.body || row.title || 'احتياج معتمد.'}</Text>

      <View style={styles.helpBox}>
        <Text style={styles.helpTitle}>خانة المساعدة</Text>
        <Text style={styles.channel}>{channelLabel}</Text>
        <Text style={styles.fieldLabel}>{fieldLabel}</Text>
        {refValue ? (
          <Text style={styles.ref} selectable>
            {refValue}
          </Text>
        ) : (
          <Text style={styles.missing}>بانتظار رقم المساهمة من الإدارة بعد الاعتماد.</Text>
        )}
        <Text style={styles.howTo}>{howTo}</Text>
        {refValue ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void shareRef();
            }}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
          >
            <Text style={styles.actionBtnText}>
              {channel === 'othaim_card'
                ? 'نسخ / إرسال رقم بطاقة العثيم'
                : channel === 'sawaa_electric'
                  ? 'نسخ / إرسال رقم فاتورة الكهرباء'
                  : channel === 'sawaa_rent'
                    ? 'نسخ / إرسال رقم عقد الإيجار'
                    : channel === 'sawaa_water'
                      ? 'نسخ / إرسال رقم فاتورة الماء'
                      : 'نسخ / إرسال مرجع المساهمة'}
            </Text>
          </Pressable>
        ) : null}
        {copyNote ? <Text style={styles.note}>{copyNote}</Text> : null}
        {row.contactNote ? <Text style={styles.note}>{row.contactNote}</Text> : null}
      </View>
    </View>
  );
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
    helpBox: {
      marginTop: 8,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: 'rgba(37, 92, 77, 0.14)',
      gap: 6,
    },
    helpTitle: {
      color: p.primaryDark,
      fontSize: 14,
      fontWeight: '900' as const,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
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
      marginTop: 2,
    },
    fieldLabel: {
      color: p.textMuted,
      fontSize: 12,
      fontWeight: '800' as const,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
      marginTop: 4,
    },
    ref: {
      color: p.text,
      fontSize: 20,
      fontWeight: '900' as const,
      textAlign: 'left' as const,
      writingDirection: 'ltr' as const,
      letterSpacing: 0.6,
      backgroundColor: p.surface || '#FFFDF8',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(196, 163, 90, 0.4)',
      paddingHorizontal: 12,
      paddingVertical: 10,
      overflow: 'hidden' as const,
    },
    missing: {
      color: '#8B3A2A',
      fontSize: 13,
      fontWeight: '700' as const,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    howTo: {
      color: p.text,
      fontSize: 13,
      lineHeight: 20,
      fontWeight: '600' as const,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
      marginTop: 4,
    },
    actionBtn: {
      marginTop: 8,
      backgroundColor: p.primary,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      alignItems: 'center' as const,
    },
    actionBtnText: {
      color: p.white || '#FFFDF8',
      fontSize: 14,
      fontWeight: '900' as const,
      textAlign: 'center' as const,
      writingDirection: 'rtl' as const,
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
