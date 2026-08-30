import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { SceneSection, SceneShell } from '../components/scene';
import {
  canOpenEhsan,
  canOpenPlatform,
  fetchGivingSettings,
  startSiteSupportPayment,
  type GivingSettings,
} from '../services/giving';
import { spacing, type ThemePalette } from '../theme';
import { useThemePalette } from '../theme/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';

type GivingScreenProps = {
  onBack: () => void;
};

type Pane = 'choose' | 'support';

export function GivingScreen({ onBack }: GivingScreenProps) {
  const p = useThemePalette();
  const styles = useThemedStyles(givingStyles);
  const [settings, setSettings] = useState<GivingSettings | null>(null);
  const [loadError, setLoadError] = useState('');
  const [pane, setPane] = useState<Pane>('choose');
  const [amount, setAmount] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const load = async () => {
    setLoadError('');
    try {
      const next = await fetchGivingSettings();
      setSettings(next);
      setAmount(next.supportAmounts[0] ?? 10);
    } catch {
      setLoadError('تعذر تحميل مسارات التبرع.');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const ehsanOpen = canOpenEhsan(settings);
  const platformOpen = canOpenPlatform(settings);
  const effectiveAmount = useMemo(() => {
    const typed = Math.round(Number(custom));
    if (custom.trim() && Number.isFinite(typed) && typed > 0) return typed;
    return amount;
  }, [amount, custom]);

  const openEhsan = () => {
    if (!ehsanOpen || !settings) {
      setStatus('رابط إحسان غير مفعّل حاليًا.');
      return;
    }
    Linking.openURL(settings.sadaqahUrl).catch(() => {
      setStatus('تعذر فتح رابط إحسان.');
    });
  };

  const payPlatform = async () => {
    if (!platformOpen) {
      setStatus('دعم المنصة غير مفعّل حاليًا.');
      return;
    }
    if (!effectiveAmount || effectiveAmount <= 0) {
      setStatus('اختر مبلغًا أو اكتب رقمًا صالحًا.');
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      const checkout = await startSiteSupportPayment(effectiveAmount);
      await Linking.openURL(checkout);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر بدء الدفع.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SceneShell
      english="GIVING"
      eyebrow="مساران منفصلان"
      heroLead={
        <Pressable accessibilityRole="button" onPress={pane === 'support' ? () => setPane('choose') : onBack}>
          <Text style={styles.back}>{pane === 'support' ? 'رجوع للمربعين' : 'رجوع'}</Text>
        </Pressable>
      }
      onRefresh={() => void load()}
      subtitle={
        pane === 'support'
          ? 'تغطي الاستضافة والتطوير — ليست صدقة خيرية.'
          : 'خير عن الموتى عبر إحسان، ومساهمة لتشغيل المنصة.'
      }
      title={pane === 'support' ? 'المنصة' : 'تبرع'}
      variant="identity"
    >
      {loadError ? <Text style={styles.error}>{loadError}</Text> : null}

      {pane === 'choose' ? (
        <SceneSection>
          <View style={styles.grid}>
            <Pressable
              accessibilityRole="button"
              onPress={openEhsan}
              style={({ pressed }) => [styles.tile, styles.tileEhsan, pressed && styles.tilePressed]}
            >
              <Text style={styles.kicker}>صدقة جارية</Text>
              <Text style={styles.tileTitle}>إحسان</Text>
              <Text style={styles.tileText}>عن موتى عائلة الزيدان عبر منصة إحسان المرخّصة.</Text>
              <Text style={styles.cta}>{ehsanOpen ? 'فتح إحسان' : 'غير متاح الآن'}</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (!platformOpen) {
                  setStatus('دعم المنصة غير مفعّل حاليًا.');
                  return;
                }
                setStatus('');
                setPane('support');
              }}
              style={({ pressed }) => [styles.tile, styles.tilePlatform, pressed && styles.tilePressed]}
            >
              <Text style={styles.kicker}>دعم التشغيل</Text>
              <Text style={styles.tileTitle}>المنصة</Text>
              <Text style={styles.tileText}>مساهمة لاستمرار الموقع عبر بوابة الدفع — ليست منصة العائلة.</Text>
              <Text style={styles.cta}>{platformOpen ? 'اختيار المبلغ' : 'غير متاح الآن'}</Text>
            </Pressable>
          </View>
        </SceneSection>
      ) : (
        <SceneSection title="اختر المبلغ (ريال)">
          <View style={styles.chips}>
            {(settings?.supportAmounts || []).map((n) => {
              const active = !custom.trim() && amount === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => {
                    setCustom('');
                    setAmount(n);
                  }}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{n}</Text>
                </Pressable>
              );
            })}
          </View>
          {settings?.supportAllowCustom ? (
            <TextInput
              keyboardType="number-pad"
              onChangeText={(v) => setCustom(v.replace(/[^\d]/g, ''))}
              placeholder="أو اكتب مبلغًا آخر"
              placeholderTextColor={p.textMuted}
              style={styles.input}
              value={custom}
            />
          ) : null}
          <ActionButton
            label={busy ? 'جاري التحويل...' : 'متابعة للدفع'}
            onPress={() => {
              if (!busy) void payPlatform();
            }}
          />
        </SceneSection>
      )}

      {status ? <Text style={styles.status}>{status}</Text> : null}
    </SceneShell>
  );
}

function givingStyles(p: ThemePalette) {
  return {
  back: {
    color: p.goldSoft,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  grid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    borderRadius: 16,
    borderWidth: 1,
    flexGrow: 1,
    flexBasis: '46%',
    minHeight: 168,
    padding: 16,
  },
  tileEhsan: {
    backgroundColor: '#F0FDF4',
    borderColor: '#D1FAE5',
  },
  tilePlatform: {
    backgroundColor: '#FFF8EC',
    borderColor: 'rgba(196,163,90,0.35)',
  },
  tilePressed: {
    opacity: 0.88,
  },
  kicker: {
    color: p.primary,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  tileTitle: {
    color: p.greenDeep,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 6,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  tileText: {
    color: p.textMuted,
    flexGrow: 1,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  cta: {
    color: p.primaryDark,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  chips: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md,
  },
  chip: {
    backgroundColor: p.surface,
    borderColor: p.border,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: {
    backgroundColor: p.primary,
    borderColor: p.primary,
  },
  chipText: {
    color: p.text,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  chipTextActive: {
    color: p.white,
  },
  input: {
    backgroundColor: p.surfaceMuted,
    borderRadius: 16,
    color: p.text,
    fontSize: 15,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  status: {
    color: p.primaryDark,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.md,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  error: {
    color: '#8B3A2A',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  };
}
