import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import {
  probeDelegateInboxBackend,
  probeFamilyAdminBackend,
  probeWomenAdminBackend,
  type AdminBackendStatus,
  type AdminSurface,
} from '../services/adminReadiness';
import { spacing, type ThemePalette } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';

type AdminBackendStatusProps = {
  surface: AdminSurface;
  phone: string;
};

async function probe(surface: AdminSurface, phone: string): Promise<AdminBackendStatus> {
  if (surface === 'family') return probeFamilyAdminBackend(phone);
  if (surface === 'women') return probeWomenAdminBackend(phone);
  return probeDelegateInboxBackend(phone);
}

export function AdminBackendStatusBanner({ surface, phone }: AdminBackendStatusProps) {
  const styles = useThemedStyles(adminBackendStyles);
  const [status, setStatus] = useState<AdminBackendStatus | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const cleaned = String(phone || '').trim();
    if (!cleaned) {
      setStatus(null);
      setChecking(false);
      return;
    }
    setChecking(true);
    void probe(surface, cleaned)
      .then(setStatus)
      .finally(() => setChecking(false));
  }, [phone, surface]);

  if (checking) {
    return (
      <View style={styles.box}>
        <Text style={styles.meta}>جاري التحقق من جاهزية السيرفر…</Text>
      </View>
    );
  }

  if (!status || status.ready) return null;

  return (
    <View style={styles.box}>
      <Text style={styles.title}>التنفيذ غير متاح الآن</Text>
      <Text style={styles.body}>{status.message}</Text>
      <Text style={styles.meta}>
        ما تراه أدناه واجهة فقط. لن يُحفظ أي تغيير حتى يُفعَّل السيرفر.
      </Text>
    </View>
  );
}

function adminBackendStyles(p: ThemePalette) {
  return {
    box: {
      backgroundColor: p.surface,
      borderColor: p.condolence,
      borderRadius: 16,
      borderWidth: 1,
      gap: spacing.xs,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    title: {
      color: p.condolence,
      fontSize: 15,
      fontWeight: '800' as const,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    body: {
      color: p.text,
      fontSize: 14,
      fontWeight: '600' as const,
      lineHeight: 22,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    meta: {
      color: p.textMuted,
      fontSize: 13,
      lineHeight: 20,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
  };
}
