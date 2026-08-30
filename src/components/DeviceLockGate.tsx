import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  canUseDeviceLock,
  ensureLocalUnlock,
  isDeviceLockEnabled,
  subscribeDeviceLock,
} from '../services/deviceLock';
import { hasBoundSessionPhone } from '../services/deviceAuth';
import { spacing, typography } from '../theme';
import { useThemePalette } from '../theme/ThemeContext';

type DeviceLockGateProps = {
  children: React.ReactNode;
};

export function DeviceLockGate({ children }: DeviceLockGateProps) {
  const p = useThemePalette();
  const [blocked, setBlocked] = useState(true);
  const [busy, setBusy] = useState(false);

  const tryUnlock = async () => {
    setBusy(true);
    try {
      const enabled = await isDeviceLockEnabled();
      const hasSession = await hasBoundSessionPhone();
      const available = await canUseDeviceLock();
      if (!enabled || !hasSession || !available) {
        setBlocked(false);
        return;
      }
      const ok = await ensureLocalUnlock();
      setBlocked(!ok);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void tryUnlock();
    const unsub = subscribeDeviceLock(() => {
      setBlocked(true);
    });
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void tryUnlock();
    });
    return () => {
      unsub();
      appSub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!blocked) return <>{children}</>;

  return (
    <View style={[styles.shell, { backgroundColor: p.heroDeep }]}>
      <View style={[styles.overlay, { backgroundColor: p.heroDeep }]}>
        <SafeAreaView style={styles.panel}>
          <Text style={[styles.title, { color: p.goldSoft }]}>افتح حسابك</Text>
          <Text style={[styles.hint, { color: p.cream }]}>
            الدخول ببصمة الوجه أو رمز الجهاز. لا تُرسل صورة الوجه خارج جهازك.
          </Text>
          <Pressable
            disabled={busy}
            onPress={() => {
              void tryUnlock();
            }}
            style={[styles.button, { backgroundColor: p.primaryDark, borderColor: p.gold }]}
          >
            <Text style={[styles.buttonLabel, { color: p.white }]}>
              {busy ? 'جاري الفتح...' : 'فتح'}
            </Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 80,
  },
  panel: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  hint: {
    fontSize: typography.body,
    lineHeight: 24,
    marginTop: spacing.sm,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  button: {
    alignItems: 'center',
    borderRadius: 15,
    borderWidth: 1,
    marginTop: spacing.lg,
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: typography.body,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
});
