import Constants from 'expo-constants';
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { spacing, typography, type ThemePalette } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';
import { shareWidgetBrochure } from '../utils/widgetBrochure';

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
  const styles = useThemedStyles(aboutStyles);
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const [sharingWidget, setSharingWidget] = useState(false);

  async function onShareWidgetGuide() {
    if (sharingWidget) return;
    setSharingWidget(true);
    try {
      await shareWidgetBrochure();
    } finally {
      setSharingWidget(false);
    }
  }

  return (
    <Screen title="عن المشروع" description="تطبيق جوال مستقل لمشروع عائلة الزيدان.">
      <SectionCard eyebrow="الرؤية" title="ذاكرة عائلية حديثة">
        <Text style={styles.paragraph}>
          يهدف التطبيق إلى تقديم شجرة العائلة ومناسباتها في تجربة عربية واضحة ومريحة على
          الجوال، مع فصل المحتوى العام عن أدوات الإدارة المستقبلية.
        </Text>
      </SectionCard>

      <SectionCard eyebrow="الودجت" title="ودجت أهلنا على شاشتك">
        <Text style={styles.paragraph}>
          أخبار العائلة ومن معنا الآن وأوقات الصلاة حسب موقعك — على الشاشة الرئيسية أو شاشة القفل.
        </Text>
        <View style={styles.list}>
          {[
            'ثبّت التطبيق من App Store وافتحه مرة من «ملفي».',
            'اضغط مطولاً على الشاشة الرئيسية حتى تهتز الأيقونات.',
            'اضغط + ثم ابحث: عائلة الزيدان.',
            'اختر صغير أو متوسط أو كبير، ثم أضف الودجت.',
          ].map((step) => (
            <View key={step} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>{step}</Text>
            </View>
          ))}
        </View>
        <View style={styles.shareWrap}>
          <ActionButton
            label={sharingWidget ? 'جاري التحضير…' : 'شارك الدليل في واتساب'}
            onPress={() => {
              void onShareWidgetGuide();
            }}
          />
        </View>
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
        <Text style={styles.versionText}>تطبيق عائلة مطلق الزيدان على الجوال.</Text>
      </View>
    </Screen>
  );
}

function aboutStyles(p: ThemePalette) {
  return {
  paragraph: {
    color: p.text,
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
    color: p.accent,
    fontSize: 20,
    lineHeight: 24,
  },
  listText: {
    color: p.text,
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
    backgroundColor: p.primarySoft,
  },
  legalLinkText: {
    color: p.primary,
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
    color: p.textMuted,
    fontSize: typography.body,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  emailValue: {
    color: p.primary,
    fontSize: typography.body,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  shareWrap: {
    marginTop: spacing.md,
  },
  version: {
    backgroundColor: p.primarySoft,
    borderRadius: 20,
    gap: spacing.xs,
    padding: spacing.md,
  },
  versionTitle: {
    color: p.primaryDark,
    fontSize: typography.title,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  versionText: {
    color: p.primary,
    fontSize: typography.body,
    lineHeight: 23,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  };
}
