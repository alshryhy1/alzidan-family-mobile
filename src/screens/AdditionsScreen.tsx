import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { insertPublicRow } from '../services/supabase';
import { buildTreeCardMessage, treeCardRequestId } from '../utils/treeCardMessage';
import { colors, spacing, typography } from '../theme';
import type { Branch } from '../types';

type AdditionsScreenProps = {
  branches: Branch[];
};

type RequestStatus = {
  kind: 'idle' | 'success' | 'error';
  text: string;
};

const eventTypes = [
  { key: 'birth', label: 'مولود' },
  { key: 'marriage', label: 'زواج' },
  { key: 'graduation', label: 'تخرج' },
  { key: 'promotion', label: 'ترقية' },
  { key: 'gathering', label: 'اجتماع' },
  { key: 'sick', label: 'مريض' },
  { key: 'death', label: 'وفاة' },
];

function requestId(prefix: string) {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}-${random}`;
}

function cleanPhone(value: string) {
  return value.replace(/[^\d+]/g, '');
}

function buildEventMessage(payload: {
  branch: string;
  dateLabel: string;
  person: string;
  submitterName: string;
  text: string;
  type: string;
  typeLabel: string;
}) {
  return [
    'طلب إضافة مناسبة من تطبيق عائلة الزيدان',
    `الفرع: ${payload.branch}`,
    `النوع: ${payload.typeLabel}`,
    `صاحب المناسبة: ${payload.person}`,
    payload.dateLabel ? `التاريخ: ${payload.dateLabel}` : '',
    `النص: ${payload.text}`,
    `المرسل: ${payload.submitterName}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildCorrectionMessage(payload: {
  branch: string;
  correction: string;
  person: string;
  submitterName: string;
}) {
  return [
    'طلب تصحيح بيانات من تطبيق عائلة الزيدان',
    `الفرع: ${payload.branch}`,
    `الاسم/المسار: ${payload.person}`,
    `التصحيح المطلوب: ${payload.correction}`,
    `المرسل: ${payload.submitterName}`,
  ].join('\n');
}

export function AdditionsScreen({ branches }: AdditionsScreenProps) {
  const defaultBranch = branches[0]?.id ?? 'زيدان';
  const [branch, setBranch] = useState(defaultBranch);
  const [eventType, setEventType] = useState(eventTypes[0].key);
  const [eventPerson, setEventPerson] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventText, setEventText] = useState('');
  const [correctionPerson, setCorrectionPerson] = useState('');
  const [correctionText, setCorrectionText] = useState('');
  const [grandfather, setGrandfather] = useState('');
  const [grandfather2, setGrandfather2] = useState('');
  const [grandfather3, setGrandfather3] = useState('');
  const [grandfather4, setGrandfather4] = useState('');
  const [father, setFather] = useState('');
  const [personName, setPersonName] = useState('');
  const [personDob, setPersonDob] = useState('');
  const [personCity, setPersonCity] = useState('');
  const [personArea, setPersonArea] = useState('');
  const [submitterName, setSubmitterName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<RequestStatus>({ kind: 'idle', text: '' });
  const [submitting, setSubmitting] = useState(false);

  const selectedEventType = useMemo(
    () => eventTypes.find((item) => item.key === eventType) ?? eventTypes[0],
    [eventType],
  );

  const validateSubmitter = () => {
    if (!submitterName.trim()) return 'اكتب اسم المرسل.';
    if (cleanPhone(phone).length < 9) return 'اكتب رقم جوال صحيح.';
    if (email.trim() && (!email.includes('@') || !email.includes('.'))) {
      return 'البريد الإلكتروني غير صحيح أو اتركه فارغًا.';
    }
    return '';
  };

  const submitEvent = async () => {
    const submitterError = validateSubmitter();
    if (submitterError) {
      setStatus({ kind: 'error', text: submitterError });
      return;
    }
    if (!eventPerson.trim() || !eventText.trim()) {
      setStatus({ kind: 'error', text: 'اكتب صاحب المناسبة ونص المناسبة.' });
      return;
    }

    setSubmitting(true);
    try {
      const createdAt = new Date().toISOString();
      const message = buildEventMessage({
        branch,
        dateLabel: eventDate.trim(),
        person: eventPerson.trim(),
        submitterName: submitterName.trim(),
        text: eventText.trim(),
        type: selectedEventType.key,
        typeLabel: selectedEventType.label,
      });

      await insertPublicRow('approval_requests', {
        request_id: requestId('EVAPP'),
        kind: 'event_card',
        branch_key: branch,
        name: submitterName.trim(),
        phone: cleanPhone(phone),
        email: email.trim() || null,
        message,
        status: 'pending',
        created_at: createdAt,
      });

      setEventPerson('');
      setEventDate('');
      setEventText('');
      setStatus({ kind: 'success', text: 'تم إرسال المناسبة للمراجعة.' });
    } catch (error) {
      setStatus({
        kind: 'error',
        text: error instanceof Error ? error.message : 'تعذر إرسال المناسبة.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const submitAddPerson = async () => {
    const submitterError = validateSubmitter();
    if (submitterError) {
      setStatus({ kind: 'error', text: submitterError });
      return;
    }
    const gf = grandfather.trim();
    const f = father.trim();
    const name = personName.trim();
    if (!gf || !f || !name) {
      setStatus({ kind: 'error', text: 'اكتب الجد 1 والأب واسم الشخص.' });
      return;
    }
    if (grandfather4.trim() && !grandfather3.trim()) {
      setStatus({ kind: 'error', text: 'عبّئ الجد 3 قبل الجد 4.' });
      return;
    }
    if (grandfather3.trim() && !grandfather2.trim()) {
      setStatus({ kind: 'error', text: 'عبّئ الجد 2 قبل الجد 3.' });
      return;
    }
    if (grandfather2.trim() && !gf) {
      setStatus({ kind: 'error', text: 'عبّئ الجد 1 قبل الجد 2.' });
      return;
    }

    setSubmitting(true);
    try {
      const createdAt = new Date().toISOString();
      const reqId = treeCardRequestId();
      const ancestors = [gf, grandfather2, grandfather3, grandfather4].map((v) => v.trim()).filter(Boolean);
      const message = buildTreeCardMessage({
        ancestors,
        branch,
        city: personCity.trim(),
        area: personArea.trim(),
        children: [],
        createdAt,
        father: f,
        grandfather: gf,
        personDob: personDob.trim(),
        personName: name,
        requestId: reqId,
        submitterEmail: email.trim(),
        submitterName: submitterName.trim(),
        submitterPhone: cleanPhone(phone),
      });

      await insertPublicRow('approval_requests', {
        request_id: reqId,
        kind: 'tree_card',
        branch_key: branch,
        name: submitterName.trim(),
        phone: cleanPhone(phone),
        email: email.trim() || null,
        message,
        status: 'pending',
        created_at: createdAt,
      });

      setGrandfather('');
      setGrandfather2('');
      setGrandfather3('');
      setGrandfather4('');
      setFather('');
      setPersonName('');
      setPersonDob('');
      setPersonCity('');
      setPersonArea('');
      setStatus({ kind: 'success', text: 'تم إرسال طلب إضافة الفرد للمراجعة.' });
    } catch (error) {
      setStatus({
        kind: 'error',
        text: error instanceof Error ? error.message : 'تعذر إرسال طلب الإضافة.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const submitCorrection = async () => {
    const submitterError = validateSubmitter();
    if (submitterError) {
      setStatus({ kind: 'error', text: submitterError });
      return;
    }
    if (!correctionPerson.trim() || !correctionText.trim()) {
      setStatus({ kind: 'error', text: 'اكتب الاسم والتصحيح المطلوب.' });
      return;
    }

    setSubmitting(true);
    try {
      const createdAt = new Date().toISOString();
      const message = buildCorrectionMessage({
        branch,
        correction: correctionText.trim(),
        person: correctionPerson.trim(),
        submitterName: submitterName.trim(),
      });

      await insertPublicRow('approval_requests', {
        request_id: requestId('CRAPP'),
        kind: 'tree_card',
        branch_key: branch,
        name: submitterName.trim(),
        phone: cleanPhone(phone),
        email: email.trim() || null,
        message,
        status: 'pending',
        created_at: createdAt,
      });

      setCorrectionPerson('');
      setCorrectionText('');
      setStatus({ kind: 'success', text: 'تم إرسال التصحيح للمراجعة.' });
    } catch (error) {
      setStatus({
        kind: 'error',
        text: error instanceof Error ? error.message : 'تعذر إرسال التصحيح.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      title="الإضافات"
      description="أرسل طلب إضافة فرد أو مناسبة أو تصحيحًا ليصل إلى الإدارة للمراجعة."
    >
      <SectionCard eyebrow="بيانات المرسل" title="من يرسل الطلب؟">
        <View style={styles.branchPicker}>
          {branches.map((item) => {
            const active = item.id === branch;
            return (
              <Pressable
                key={item.id}
                onPress={() => setBranch(item.id)}
                style={[styles.chip, active && styles.activeChip]}
              >
                <Text style={[styles.chipText, active && styles.activeChipText]}>{item.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          onChangeText={setSubmitterName}
          placeholder="اسم المرسل"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={submitterName}
        />
        <TextInput
          keyboardType="phone-pad"
          onChangeText={setPhone}
          placeholder="رقم الجوال"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={phone}
        />
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="البريد الإلكتروني اختياري"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={email}
        />
      </SectionCard>

      <SectionCard eyebrow="شجرة" title="إضافة فرد">
        <TextInput
          onChangeText={setGrandfather}
          placeholder="الجد 1 (إجباري)"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={grandfather}
        />
        <TextInput
          onChangeText={setGrandfather2}
          placeholder="الجد 2 (اختياري)"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={grandfather2}
        />
        <TextInput
          onChangeText={setGrandfather3}
          placeholder="الجد 3 (اختياري)"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={grandfather3}
        />
        <TextInput
          onChangeText={setGrandfather4}
          placeholder="الجد 4 (اختياري)"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={grandfather4}
        />
        <TextInput
          onChangeText={setFather}
          placeholder="الأب (إجباري)"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={father}
        />
        <TextInput
          onChangeText={setPersonName}
          placeholder="اسم الشخص (إجباري)"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={personName}
        />
        <TextInput
          onChangeText={setPersonDob}
          placeholder="تاريخ الميلاد اختياري (YYYY-MM-DD)"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={personDob}
        />
        <TextInput
          onChangeText={setPersonCity}
          placeholder="المدينة (اختياري)"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={personCity}
        />
        <TextInput
          onChangeText={setPersonArea}
          placeholder="الحي/القرية (اختياري)"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={personArea}
        />
        <ActionButton
          label={submitting ? 'جاري الإرسال...' : 'إرسال طلب إضافة فرد'}
          onPress={submitAddPerson}
        />
      </SectionCard>

      <SectionCard eyebrow="مناسبة" title="إضافة مناسبة">
        <View style={styles.branchPicker}>
          {eventTypes.map((item) => {
            const active = item.key === eventType;
            return (
              <Pressable
                key={item.key}
                onPress={() => setEventType(item.key)}
                style={[styles.chip, active && styles.activeChip]}
              >
                <Text style={[styles.chipText, active && styles.activeChipText]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          onChangeText={setEventPerson}
          placeholder="اسم صاحب المناسبة"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={eventPerson}
        />
        <TextInput
          onChangeText={setEventDate}
          placeholder="التاريخ اختياري"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={eventDate}
        />
        <TextInput
          multiline
          onChangeText={setEventText}
          placeholder="نص المناسبة"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.textArea]}
          textAlign="right"
          value={eventText}
        />
        <ActionButton label={submitting ? 'جاري الإرسال...' : 'إرسال المناسبة'} onPress={submitEvent} />
      </SectionCard>

      <SectionCard eyebrow="تصحيح" title="طلب تصحيح بيانات">
        <TextInput
          onChangeText={setCorrectionPerson}
          placeholder="اسم الشخص أو المسار"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={correctionPerson}
        />
        <TextInput
          multiline
          onChangeText={setCorrectionText}
          placeholder="اكتب التصحيح المطلوب"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.textArea]}
          textAlign="right"
          value={correctionText}
        />
        <ActionButton label={submitting ? 'جاري الإرسال...' : 'إرسال التصحيح'} onPress={submitCorrection} />
      </SectionCard>

      {status.text ? (
        <View style={[styles.status, status.kind === 'error' ? styles.errorStatus : styles.successStatus]}>
          <Text style={styles.statusText}>{status.text}</Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  branchPicker: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  activeChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  activeChipText: {
    color: colors.white,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 15,
    borderWidth: 1,
    color: colors.text,
    fontSize: typography.body,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    writingDirection: 'rtl',
  },
  textArea: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  status: {
    borderRadius: 16,
    padding: spacing.md,
  },
  successStatus: {
    backgroundColor: colors.primarySoft,
  },
  errorStatus: {
    backgroundColor: '#F7D7D7',
  },
  statusText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
