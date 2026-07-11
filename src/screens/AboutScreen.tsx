import Constants from 'expo-constants';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { colors, spacing, typography } from '../theme';

const LEGAL_BASE = 'https://alzidan.org/pages';

const legalLinks = [
  { label: 'سياسة الخصوصية', url: `${LEGAL_BASE}/privacy.html` },
  { label: 'شروط الاستخدام', url: `${LEGAL_BASE}/terms.html` },
  {
    label: 'طلب حذف البيانات الشخصية',
    url: `${LEGAL_BASE}/delete-account.html`,
  },
  { label: 'تواصل معنا', url: `${LEGAL_BASE}/contact.html` },
];

const principles = [
  'توثيق شجرة العائلة بطريقة مرتبة وسهلة القراءة.',
  'المحافظة على الخصوصية وعدم عرض أرقام الجوال في بطاقات الشجرة العامة.',
  'تقوية صلة الرحم وتسهيل متابعة أخبار ومناسبات العائلة.',
  'إتاحة المحتوى العام للجميع دون الحاجة إلى تسجيل دخول.',
];

function openUrl(url: string) {
  Linking.openURL(url).catch(() => {});
}

export function AboutScreen() {
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

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

      <SectionCard eyebrow="قانوني" title="السياسات والتواصل">
        <View style={styles.legalList}>
          {legalLinks.map((link) => (
            <Pressable
              key={link.url}
              accessibilityRole="link"
              onPress={() => openUrl(link.url)}
              style={({ pressed }) => [styles.legalLink, pressed && styles.legalLinkPressed]}
            >
              <Text style={styles.legalLinkText}>{link.label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="link"
          onPress={() => openUrl('mailto:alzidan990@gmail.com')}
          style={({ pressed }) => [styles.emailRow, pressed && styles.legalLinkPressed]}
        >
          <Text style={styles.emailLabel}>البريد:</Text>
          <Text style={styles.emailValue}>alzidan990@gmail.com</Text>
        </Pressable>
        <Pressable
          accessibilityRole="link"
          onPress={() => openUrl('https://wa.me/966551840058')}
          style={({ pressed }) => [styles.emailRow, pressed && styles.legalLinkPressed]}
        >
          <Text style={styles.emailLabel}>واتساب:</Text>
          <Text style={styles.emailValue}>0551840058</Text>
        </Pressable>
      </SectionCard>

      <View style={styles.version}>
        <Text style={styles.versionTitle}>النسخة {appVersion}</Text>
        <Text style={styles.versionText}>
          واجهات عامة للقراءة والطلبات، مرتبطة بمصدر البيانات المعتمد على alzidan.org.
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
  legalList: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  legalLink: {
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  legalLinkPressed: {
    backgroundColor: colors.primarySoft,
  },
  legalLinkText: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  emailRow: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row-reverse',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  emailLabel: {
    color: colors.textMuted,
    fontSize: typography.body,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  emailValue: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: '700',
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
