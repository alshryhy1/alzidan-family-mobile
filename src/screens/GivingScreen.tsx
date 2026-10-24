import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { PublishedAidOpportunityCard } from '../components/PublishedAidOpportunityCard';
import { SceneSection, SceneShell } from '../components/scene';
import { loadPublishedAidRequests, type PublishedAidRequest } from '../services/aidRequest';
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

type Pane = 'choose' | 'support' | 'aid';

type GivingScreenProps = {
  onBack: () => void;
  onOpenAidRequest?: () => void;
  /** فتح تقديم طلب خاص (أرملة/مطلقة) من داخل التبرعات. */
  onOpenAidSubmit?: () => void;
  initialPane?: Pane;
};

export function GivingScreen({
  onBack,
  onOpenAidRequest,
  onOpenAidSubmit,
  initialPane = 'choose',
}: GivingScreenProps) {
  const p = useThemePalette();
  const styles = useThemedStyles(givingStyles);
  const [settings, setSettings] = useState<GivingSettings | null>(null);
  const [publishedAid, setPublishedAid] = useState<PublishedAidRequest[]>([]);
  const [loadError, setLoadError] = useState('');
  const [pane, setPane] = useState<Pane>(initialPane === 'aid' || initialPane === 'support' ? initialPane : 'choose');
  const [amount, setAmount] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const load = async () => {
    setLoadError('');
    try {
      const [next, aidRows] = await Promise.all([
        fetchGivingSettings(),
        loadPublishedAidRequests().catch((err) => {
          if (__DEV__) {
            console.warn('[giving] published aid', err instanceof Error ? err.message : err);
          }
          return [] as PublishedAidRequest[];
        }),
      ]);
      setSettings(next);
      setAmount(next.supportAmounts[0] ?? 10);
      setPublishedAid(aidRows);
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
        <Pressable
          accessibilityRole="button"
          onPress={pane === 'choose' ? onBack : () => setPane('choose')}
        >
          <Text style={styles.back}>{pane === 'choose' ? 'رجوع' : 'رجوع للمربعين'}</Text>
        </Pressable>
      }
      onRefresh={() => void load()}
      subtitle={
        pane === 'support'
          ? 'تغطي الاستضافة والتطوير — ليست صدقة خيرية.'
          : pane === 'aid'
            ? 'بلا اسم. نوع الطلب والاحتياج فقط — ساهم ببطاقة العثيم أو سداد فاتورة سوا.'
            : 'خير عن الموتى، دعم المنصة، وفرص مساعدة سرية من داخل التبرعات.'
      }
      title={pane === 'support' ? 'المنصة' : pane === 'aid' ? 'فرص مساعدة' : 'تبرع'}
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

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setStatus('');
                setPane('aid');
              }}
              style={({ pressed }) => [styles.tile, styles.tileAid, pressed && styles.tilePressed]}
            >
              <Text style={styles.kicker}>سرية · من التبرعات</Text>
              <Text style={styles.tileTitle}>فرص مساعدة</Text>
              <Text style={styles.tileText}>
                طلبات معتمدة بلا اسم: نوع الطلب والاحتياج فقط. المساهمة ببطاقة العثيم أو سداد فاتورة سوا.
              </Text>
              <Text style={styles.cta}>
                {publishedAid.length ? `عرض ${publishedAid.length} فرصة` : 'فتح فرص المساعدة'}
              </Text>
            </Pressable>
          </View>
        </SceneSection>
      ) : pane === 'aid' ? (
        <SceneSection title="فرص منشورة بلا اسم">
          <Text style={styles.aidNote}>
            لا يظهر اسم ولا جوال. ساهم عبر رقم بطاقة العثيم أو سداد فاتورة سوا (كهرباء / إيجار) حسب كل طلب.
          </Text>
          {!publishedAid.length ? (
            <Text style={styles.aidEmpty}>لا توجد فرص مساعدة منشورة حالياً.</Text>
          ) : (
            publishedAid.map((row) => <PublishedAidOpportunityCard key={row.id} row={row} />)
          )}
          {onOpenAidSubmit ? (
            <ActionButton label="تقديم طلب مساعدة خاص" onPress={onOpenAidSubmit} />
          ) : null}
          {onOpenAidRequest ? (
            <ActionButton label="طلباتي" onPress={onOpenAidRequest} variant="secondary" />
          ) : null}
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
  tileAid: {
    backgroundColor: '#F8FAFC',
    borderColor: 'rgba(100,116,139,0.28)',
    flexBasis: '100%',
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
  aidNote: {
    color: p.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: spacing.sm,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  aidEmpty: {
    color: p.textMuted,
    fontSize: 14,
    fontWeight: '700',
    marginVertical: spacing.md,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  };
}
