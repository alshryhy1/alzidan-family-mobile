import { useEffect, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { checkAppStoreGate } from '../services/appStoreGate';
import { spacing, typography } from '../theme';
import { useThemePalette } from '../theme/ThemeContext';

type ForceUpdateGateProps = {
  children: React.ReactNode;
};

export function ForceUpdateGate({ children }: ForceUpdateGateProps) {
  const p = useThemePalette();
  const [blocked, setBlocked] = useState(false);
  const [storeUrl, setStoreUrl] = useState('https://apps.apple.com/sa/app/id6797335229');
  const [ready, setReady] = useState(false);

  const inspect = async () => {
    try {
      const result = await checkAppStoreGate();
      setStoreUrl(result.storeUrl);
      setBlocked(result.required);
    } catch {
      setBlocked(false);
    } finally {
      setReady(true);
    }
  };

  useEffect(() => {
    void inspect();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void inspect();
    });
    return () => sub.remove();
  }, []);

  const openStore = () => {
    const itms = storeUrl.replace(/^https:\/\/apps\.apple\.com/i, 'itms-apps://apps.apple.com');
    Linking.openURL(itms).catch(() => {
      Linking.openURL(storeUrl).catch(() => {});
    });
  };

  if (!ready) {
    return (
      <View style={[styles.shell, { backgroundColor: p.heroDeep || '#1E2925' }]}>
        <SafeAreaView style={styles.panel}>
          <Text style={[styles.brand, { color: p.goldSoft || '#E8D5A3' }]}>عائلة الزيدان</Text>
        </SafeAreaView>
      </View>
    );
  }

  if (!blocked) return <>{children}</>;

  return (
    <View style={[styles.shell, { backgroundColor: p.heroDeep || '#1E2925' }]}>
      <SafeAreaView style={styles.panel}>
        <Text style={[styles.title, { color: p.goldSoft || '#E8D5A3' }]}>يوجد تحديث جديد</Text>
        <Text style={[styles.body, { color: p.cream || '#F3EBD9' }]}>
          هذه النسخة لم تعد تُستخدم. حدّث التطبيق من المتجر لتفتحه.
        </Text>
        <Pressable
          onPress={openStore}
          style={[styles.button, { backgroundColor: p.primaryDark || '#2F4A43', borderColor: p.gold || '#C4A35A' }]}
        >
          <Text style={[styles.buttonLabel, { color: p.white || '#FFFFFF' }]}>تحديث التطبيق</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  panel: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  brand: {
    fontSize: typography.title,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  body: {
    fontSize: typography.body,
    lineHeight: 26,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  button: {
    alignSelf: 'center',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: spacing.sm,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  buttonLabel: {
    fontSize: 17,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
});
