import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { colors, spacing, typography } from '../theme';

const principles = [
  'توثيق شجرة العائلة بطريقة مرتبة وسهلة القراءة.',
  'المحافظة على الخصوصية وعدم عرض بيانات التواصل الحساسة.',
  'تقوية صلة الرحم وتسهيل متابعة أخبار ومناسبات العائلة.',
  'إتاحة المحتوى العام للجميع دون الحاجة إلى تسجيل دخول.',
];

export function AboutScreen() {
  return (
    <Screen title="عن المشروع" description="تطبيق جوال مستقل لمشروع عائلة الزيدان.">
      <SectionCard eyebrow="الرؤية" title="ذاكرة عائلية حديثة">
        <Text style={styles.paragraph}>
          يهدف التطبيق إلى تقديم شجرة العائلة ومناسباتها في تجربة عربية واضحة ومريحة على
          الجوال، مع فصل المحتوى العام عن أدوات الإدارة المستقبلية.
        </Text>
      </SectionCard>

      <SectionCard eyebrow="المبادئ" title="ما الذي نهتم به؟">
        <View style={styles.list}>
          {principles.map((principle) => (
            <View key={principle} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>{principle}</Text>
            </View>
          ))}
        </View>
      </SectionCard>

      <View style={styles.version}>
        <Text style={styles.versionTitle}>النسخة الحالية</Text>
        <Text style={styles.versionText}>
          واجهات عامة للقراءة فقط، مرتبطة بمصدر البيانات المعتمد دون تسجيل دخول.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  paragraph: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 26,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  list: {
    gap: spacing.sm,
  },
  listItem: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    gap: spacing.sm,
  },
  bullet: {
    color: colors.accent,
    fontSize: 20,
    lineHeight: 24,
  },
  listText: {
    color: colors.text,
    flex: 1,
    fontSize: typography.body,
    lineHeight: 24,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  version: {
    backgroundColor: colors.primarySoft,
    borderRadius: 20,
    gap: spacing.xs,
    padding: spacing.md,
  },
  versionTitle: {
    color: colors.primaryDark,
    fontSize: typography.title,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  versionText: {
    color: colors.primary,
    fontSize: typography.body,
    lineHeight: 23,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
