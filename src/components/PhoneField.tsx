import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, spacing, typography } from '../theme';
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
          placeholderTextColor={colors.textMuted}
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

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  label: {
    color: colors.text,
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
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
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
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  countryCaret: {
    color: colors.textMuted,
    fontSize: 12,
  },
  nationalInput: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  hint: {
    color: colors.textMuted,
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
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  sheetTitle: {
    color: colors.text,
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
    backgroundColor: colors.primarySoft,
  },
  countryRowFlag: {
    fontSize: 22,
  },
  countryRowText: {
    flex: 1,
    gap: 2,
  },
  countryRowName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  countryRowDial: {
    color: colors.textMuted,
    fontSize: typography.caption,
    textAlign: 'right',
  },
  countryRowCheck: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.75,
  },
});
