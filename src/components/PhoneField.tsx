import { useMemo, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { spacing, typography, type ThemePalette } from '../theme';
import { useThemePalette } from '../theme/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import {
  DEFAULT_PHONE_COUNTRY_ID,
  getPhoneCountry,
  normalizeNationalInput,
  PHONE_COUNTRIES,
  type PhoneCountry,
} from '../utils/phone';

type Props = {
  countryId?: string;
  national: string;
  onCountryChange: (countryId: string) => void;
  onNationalChange: (national: string) => void;
  label?: string;
  /** Optional; shown under the field */
  hint?: string;
};

export function PhoneField({
  countryId = DEFAULT_PHONE_COUNTRY_ID,
  national,
  onCountryChange,
  onNationalChange,
  label = 'رقم الجوال',
  hint,
}: Props) {
  const p = useThemePalette();
  const styles = useThemedStyles(phoneStyles);
  const [pickerOpen, setPickerOpen] = useState(false);
  const country = useMemo(() => getPhoneCountry(countryId), [countryId]);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setPickerOpen(true)}
          style={({ pressed }) => [styles.countryBtn, pressed && styles.pressed]}
        >
          <Text style={styles.countryFlag}>{country.flag}</Text>
          <Text style={styles.countryDial}>+{country.dial}</Text>
          <Text style={styles.countryCaret}>▾</Text>
        </Pressable>
        <TextInput
          keyboardType="phone-pad"
          onChangeText={(text) => onNationalChange(normalizeNationalInput(text, country.id))}
          placeholder={country.placeholder}
          placeholderTextColor={p.textMuted}
          style={styles.nationalInput}
          textAlign="left"
          value={national}
        />
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      <Modal animationType="fade" transparent visible={pickerOpen} onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>اختر الدولة</Text>
            {PHONE_COUNTRIES.map((item) => (
              <CountryRow
                key={item.id}
                country={item}
                active={item.id === country.id}
                onPress={() => {
                  onCountryChange(item.id);
                  onNationalChange(normalizeNationalInput(national, item.id));
                  setPickerOpen(false);
                }}
              />
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function CountryRow({
  country,
  active,
  onPress,
}: {
  country: PhoneCountry;
  active: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(phoneStyles);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.countryRow, active && styles.countryRowActive, pressed && styles.pressed]}
    >
      <Text style={styles.countryRowFlag}>{country.flag}</Text>
      <View style={styles.countryRowText}>
        <Text style={styles.countryRowName}>{country.nameAr}</Text>
        <Text style={styles.countryRowDial}>+{country.dial}</Text>
      </View>
      {active ? <Text style={styles.countryRowCheck}>✓</Text> : null}
    </Pressable>
  );
}

function phoneStyles(p: ThemePalette) {
  return {
  wrap: {
    gap: 6,
  },
  label: {
    color: p.text,
    fontSize: typography.caption,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: spacing.sm,
  },
  countryBtn: {
    alignItems: 'center',
    backgroundColor: p.surfaceMuted,
    borderColor: p.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 48,
    paddingHorizontal: 10,
  },
  countryFlag: {
    fontSize: 18,
  },
  countryDial: {
    color: p.text,
    fontSize: 14,
    fontWeight: '800',
  },
  countryCaret: {
    color: p.textMuted,
    fontSize: 12,
  },
  nationalInput: {
    backgroundColor: p.surfaceMuted,
    borderColor: p.border,
    borderRadius: 14,
    borderWidth: 1,
    color: p.text,
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  hint: {
    color: p.textMuted,
    fontSize: 11,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  backdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: p.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  sheetTitle: {
    color: p.text,
    fontSize: typography.title,
    fontWeight: '800',
    marginBottom: spacing.sm,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  countryRow: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
  },
  countryRowActive: {
    backgroundColor: p.primarySoft,
  },
  countryRowFlag: {
    fontSize: 22,
  },
  countryRowText: {
    flex: 1,
    gap: 2,
  },
  countryRowName: {
    color: p.text,
    fontSize: typography.body,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  countryRowDial: {
    color: p.textMuted,
    fontSize: typography.caption,
    textAlign: 'right',
  },
  countryRowCheck: {
    color: p.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.75,
  },
  };
}
