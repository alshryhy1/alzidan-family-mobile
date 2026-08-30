import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { loadMemberViewerPerson } from '../services/publicData';
import { resumeTrustedDevice } from '../services/deviceAuth';
import {
  getPalette,
  type ThemeId,
  type ThemePalette,
} from '../theme';
import { canonicalizePhone } from '../utils/phone';
import { canUseOccasionSocial, resolveThemeId } from './resolveThemeId';
import { syncWidgetTheme } from './syncWidgetTheme';

export type ThemeGateState = 'boot' | 'resolving' | 'ready' | 'failed';

type ThemeContextValue = {
  themeId: ThemeId;
  palette: ThemePalette;
  occasionSocialEnabled: boolean;
  gate: ThemeGateState;
  retryGate: () => void;
  notifyPhoneChanged: (phone: string | null) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function ThemeGateView({
  failed,
  onRetry,
}: {
  failed: boolean;
  onRetry: () => void;
}) {
  return (
    <View accessibilityLabel="عائلة الزيدان" style={gateStyles.root}>
      <View style={gateStyles.mark}>
        <Text style={gateStyles.markLetter}>ز</Text>
      </View>
      <Text style={gateStyles.brandAr}>عائلة الزيدان</Text>
      <Text style={gateStyles.brandEn}>AL-ZIDAN</Text>
      {failed ? (
        <>
          <Text style={gateStyles.fail}>تعذر التحقق من الحساب. حاول مرة أخرى.</Text>
          <Pressable onPress={onRetry} style={gateStyles.retry}>
            <Text style={gateStyles.retryText}>إعادة المحاولة</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const gateStyles = StyleSheet.create({
  shell: {
    backgroundColor: '#F3EBD9',
    flex: 1,
  },
  root: {
    alignItems: 'center',
    backgroundColor: '#F3EBD9',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  mark: {
    alignItems: 'center',
    borderColor: '#C4A35A',
    borderRadius: 28,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    marginBottom: 14,
    width: 56,
  },
  markLetter: {
    color: '#C4A35A',
    fontSize: 28,
    fontWeight: '800',
  },
  brandAr: {
    color: '#C4A35A',
    fontSize: 18,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  brandEn: {
    color: '#C4A35A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 4,
    opacity: 0.85,
  },
  fail: {
    color: '#1E2925',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 22,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  retry: {
    borderColor: '#C4A35A',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  retryText: {
    color: '#1E2925',
    fontSize: 15,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
});

export function ThemeProvider({ children }: PropsWithChildren) {
  const [themeId, setThemeId] = useState<ThemeId>('heritage');
  const [occasionSocialEnabled, setOccasionSocialEnabled] = useState(true);
  const [gate, setGate] = useState<ThemeGateState>('boot');
  const [revealed, setRevealed] = useState(false);
  const pendingPhone = useRef<string | null>(null);
  const gen = useRef(0);

  const commit = useCallback(async (id: ThemeId, socialEnabled = id !== 'feminine') => {
    setThemeId(id);
    setOccasionSocialEnabled(socialEnabled);
    setRevealed(true);
    setGate('ready');
    void syncWidgetTheme(id);
  }, []);

  const resolvePhone = useCallback(
    async (phone: string) => {
      const ticket = ++gen.current;
      pendingPhone.current = phone;
      setGate((current) => (current === 'ready' ? current : 'resolving'));
      try {
        const person = await loadMemberViewerPerson(phone);
        if (ticket !== gen.current) return;
        await commit(resolveThemeId(person?.gender), canUseOccasionSocial(person?.gender));
      } catch {
        if (ticket !== gen.current) return;
        setGate((current) => (current === 'ready' ? current : 'failed'));
      }
    },
    [commit],
  );

  useEffect(() => {
    let alive = true;
    resumeTrustedDevice()
      .then((session) => {
        if (!alive) return;
        const phone = canonicalizePhone(session?.phone || '');
        if (!phone) {
          void commit('heritage', true);
          return;
        }
        void resolvePhone(phone);
      })
      .catch(() => {
        if (alive) void commit('heritage', true);
      });
    return () => {
      alive = false;
    };
  }, [commit, resolvePhone]);

  const notifyPhoneChanged = useCallback(
    (phone: string | null) => {
      const cleaned = canonicalizePhone(phone || '');
      if (!cleaned) {
        gen.current += 1;
        pendingPhone.current = null;
        void commit('heritage', true);
        return;
      }
      void resolvePhone(cleaned);
    },
    [commit, resolvePhone],
  );

  const retryGate = useCallback(() => {
    const phone = pendingPhone.current;
    if (phone) void resolvePhone(phone);
    else void commit('heritage', true);
  }, [commit, resolvePhone]);

  const palette = getPalette(themeId);
  const value = useMemo(
    () => ({ themeId, palette, occasionSocialEnabled, gate, retryGate, notifyPhoneChanged }),
    [themeId, palette, occasionSocialEnabled, gate, retryGate, notifyPhoneChanged],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={gateStyles.shell}>
        {revealed ? children : <ThemeGateView failed={gate === 'failed'} onRetry={retryGate} />}
      </View>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

export function useThemePalette(): ThemePalette {
  return useTheme().palette;
}
