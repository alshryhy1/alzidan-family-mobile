import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { appendTrackedRequest } from '../services/myRequestsTrack';
import { notifyBranchDelegatesOfRequest } from '../services/notifyBranchDelegates';
import { rememberPushPhone, registerPushToken } from '../services/pushNotifications';
import { insertPublicRow } from '../services/supabase';
import {
  MOBILE_EVENT_TYPES,
  buildMobileEventRequestMessage,
  findMobileEventType,
  validateEventFacts,
} from '../utils/eventRequestMessage';
import { buildTreeCardMessage, treeCardRequestId } from '../utils/treeCardMessage';
import { colors, spacing, typography } from '../theme';
import type { Branch } from '../types';

export type AdditionsIntent = 'person' | 'correction';

type AdditionsScreenProps = {
  branches: Branch[];
  intent?: AdditionsIntent;
};

type RequestStatus = {
  kind: 'idle' | 'success' | 'error';
  text: string;
};

const eventTypes = MOBILE_EVENT_TYPES;

function requestId(prefix: string) {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}-${random}`;
}

function cleanPhone(value: string) {
  return String(value || '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[^\d+]/g, '');
}

function buildCorrectionMessage(payload: {
  requestId: string;
  branch: string;
  correction: string;
  person: string;
  submitterName: string;
  submitterPhone: string;
  createdAt: string;
}) {
  return [
    'طلب: صحح بيانات شخص',
    '',
    `رقم الطلب: ${payload.requestId}`,
    `الفرع: ${payload.branch}`,
    `الشخص: ${payload.person}`,
    'الحقول المطلوب تصحيحها:',
    `  - توضيح: ${payload.correction}`,
    '',
    'ملاحظات:',
    payload.correction,
    '',
    'بيانات المرسل:',
    `الاسم: ${payload.submitterName}`,
    `الجوال: ${payload.submitterPhone}`,
    `التاريخ: ${new Date(payload.createdAt).toLocaleString('ar-SA')}`,
    '',
    '__JSON__:',
    JSON.stringify({
      v: 1,
      kind: 'tree_edit',
      branch_key: payload.branch,
      person_id: '',
      person_name: payload.person,
      fields: [{ key: 'notes', label: 'التصحيح المطلوب', value: payload.correction }],
      notes: payload.correction,
      submitter: {
        name: payload.submitterName,
        phone: payload.submitterPhone,
      },
      created_at: payload.createdAt,
    }),
  ].join('\n');
}

export function AdditionsScreen({ branches, intent = 'person' }: AdditionsScreenProps) {
  const defaultBranch = branches[0]?.id ?? 'زيدان';
  const [branch, setBranch] = useState(defaultBranch);
  const [eventType, setEventType] = useState(eventTypes[0].key);
  const [eventPerson, setEventPerson] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventPlace, setEventPlace] = useState('');
  const [eventHospitalDept, setEventHospitalDept] = useState('');
  const [eventContactPhone, setEventContactPhone] = useState('');
  const [eventPrayerPlace, setEventPrayerPlace] = useState('');
  const [eventPrayerTime, setEventPrayerTime] = useState('');
  const [eventBurialPlace, setEventBurialPlace] = useState('');
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

  const selectedEventType = useMemo(() => findMobileEventType(eventType), [eventType]);

  const validateSubmitter = () => {
    if (!branch.trim()) return 'اختر الفرع حتى يصل الطلب لمندوب الفرع الصحيح.';
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
    const factsError = validateEventFacts({
      type: selectedEventType.key,
      person: eventPerson,
      dateLabel: eventDate,
      text: eventText,
    });
    if (factsError) {
      setStatus({ kind: 'error', text: factsError });
      return;
    }

    setSubmitting(true);
    try {
      const createdAt = new Date().toISOString();
      const reqId = requestId('EVAPP');
      const message = buildMobileEventRequestMessage({
        branch,
        type: selectedEventType.key,
        typeLabel: selectedEventType.adminTypeLabel,
        person: eventPerson.trim(),
        dateLabel: eventDate.trim(),
        place: eventPlace.trim(),
        hospitalName: eventPlace.trim(),
        hospitalDept: eventHospitalDept.trim(),
        contactPhone: eventContactPhone.trim(),
        prayerPlace: eventPrayerPlace.trim(),
        prayerTime: eventPrayerTime.trim(),
        burialPlace: eventBurialPlace.trim(),
        condolencePlace: eventPlace.trim(),
        text: eventText.trim(),
        imageUrl: '',
        videoUrl: '',
        pickedImageName: '',
        pickedVideoName: '',
        submitterName: submitterName.trim(),
        submitterPhone: cleanPhone(phone),
        requestId: reqId,
        createdAt,
      });

      await insertPublicRow('approval_requests', {
        request_id: reqId,
        kind: 'event_card',
        branch_key: branch,
        name: submitterName.trim(),
        phone: cleanPhone(phone),
        email: email.trim() || null,
        message,
        status: 'pending',
        created_at: createdAt,
      });
      await notifyBranchDelegatesOfRequest({
        request_id: reqId,
        kind: 'event_card',
        branch_key: branch,
        status: 'pending',
        name: submitterName.trim(),
        phone: cleanPhone(phone),
      });
      await rememberPushPhone(cleanPhone(phone));
      registerPushToken('event_submit').catch(() => {});

      setEventPerson('');
      setEventDate('');
      setEventPlace('');
      setEventHospitalDept('');
      setEventContactPhone('');
      setEventPrayerPlace('');
      setEventPrayerTime('');
      setEventBurialPlace('');
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
      await notifyBranchDelegatesOfRequest({
        request_id: reqId,
        kind: 'tree_card',
        branch_key: branch,
        status: 'pending',
        name: submitterName.trim(),
        phone: cleanPhone(phone),
      });
      await rememberPushPhone(cleanPhone(phone));
      registerPushToken('request_submit').catch(() => {});
      await appendTrackedRequest({
        requestId: reqId,
        kind: 'tree_card',
        status: 'pending',
        createdAt,
        person: name,
        phone: cleanPhone(phone),
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
      setStatus({ kind: 'success', text: `تم إرسال طلب الإضافة لمندوب فرع ${branch}.` });
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
      const reqId = requestId('TED');
      const submitterPhone = cleanPhone(phone);
      const message = buildCorrectionMessage({
        requestId: reqId,
        branch,
        correction: correctionText.trim(),
        person: correctionPerson.trim(),
        submitterName: submitterName.trim(),
        submitterPhone,
        createdAt,
      });

      await insertPublicRow('approval_requests', {
        request_id: reqId,
        kind: 'tree_edit',
        branch_key: branch,
        name: submitterName.trim(),
        phone: submitterPhone,
        email: email.trim() || null,
        message,
        status: 'pending',
        created_at: createdAt,
      });
      await notifyBranchDelegatesOfRequest({
        request_id: reqId,
        kind: 'tree_edit',
        branch_key: branch,
        status: 'pending',
        name: submitterName.trim(),
        phone: submitterPhone,
      });
      await rememberPushPhone(submitterPhone);
      registerPushToken('request_submit').catch(() => {});
      await appendTrackedRequest({
        requestId: reqId,
        kind: 'tree_edit',
        status: 'pending',
        createdAt,
        person: correctionPerson.trim(),
        phone: submitterPhone,
      });

      setCorrectionPerson('');
      setCorrectionText('');
      setStatus({ kind: 'success', text: `تم إرسال التصحيح لمندوب فرع ${branch}.` });
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
      title={intent === 'correction' ? 'تصحيح بيانات' : 'إضافة فرد'}
      description={
        intent === 'correction'
          ? 'أرسل تصحيحًا لبيانات شخص في الشجرة. يُراجع قبل التعديل.'
          : 'أرسل طلب إضافة فرد إلى الشجرة. المناسبات من أيقونة المناسبات، والذكرى من «من الذاكرة».'
      }
    >
      <SectionCard eyebrow="بيانات المرسل" title="من يرسل الطلب؟">
        <Text style={styles.fieldLabel}>الفرع</Text>
        <Text style={styles.fieldHint}>
          الطلب يصل لمندوب الفرع المختار. لا يُختار المندوب بالاسم.
        </Text>
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

      {intent === 'person' ? (
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
      ) : null}

      {false ? (
      <SectionCard
        eyebrow={
          selectedEventType.family === 'death'
            ? 'وفاة'
            : selectedEventType.family === 'health'
              ? 'صحة'
              : 'مناسبة'
        }
        title={
          selectedEventType.family === 'death'
            ? 'إعلان وفاة'
            : selectedEventType.family === 'health'
              ? 'حالة صحية'
              : 'إضافة مناسبة'
        }
      >
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
          placeholder={selectedEventType.personLabel}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={eventPerson}
        />
        <TextInput
          onChangeText={setEventDate}
          placeholder={
            selectedEventType.family === 'death'
              ? 'تاريخ الوفاة — مثال: 2026-08-12'
              : selectedEventType.family === 'health'
                ? 'تاريخ الحالة — مثال: 2026-08-12'
                : 'تاريخ المناسبة — مثال: 2026-08-12'
          }
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="right"
          value={eventDate}
        />
        {selectedEventType.family === 'health' ? (
          <>
            <TextInput
              onChangeText={setEventPlace}
              placeholder="المستشفى / المكان اختياري"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              textAlign="right"
              value={eventPlace}
            />
            <TextInput
              onChangeText={setEventHospitalDept}
              placeholder="القسم اختياري"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              textAlign="right"
              value={eventHospitalDept}
            />
            <TextInput
              keyboardType="phone-pad"
              onChangeText={setEventContactPhone}
              placeholder="جوال للتواصل اختياري"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              textAlign="right"
              value={eventContactPhone}
            />
          </>
        ) : null}
        {selectedEventType.family === 'death' ? (
          <>
            <TextInput
              onChangeText={setEventPlace}
              placeholder="موقع العزاء اختياري"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              textAlign="right"
              value={eventPlace}
            />
            <TextInput
              onChangeText={setEventPrayerPlace}
              placeholder="مكان الصلاة اختياري"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              textAlign="right"
              value={eventPrayerPlace}
            />
            <TextInput
              onChangeText={setEventPrayerTime}
              placeholder="وقت الصلاة اختياري"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              textAlign="right"
              value={eventPrayerTime}
            />
            <TextInput
              onChangeText={setEventBurialPlace}
              placeholder="مكان الدفن اختياري"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              textAlign="right"
              value={eventBurialPlace}
            />
          </>
        ) : null}
        {selectedEventType.family === 'happy' ? (
          <TextInput
            onChangeText={setEventPlace}
            placeholder="المكان اختياري (قاعة أو مدينة)"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            textAlign="right"
            value={eventPlace}
          />
        ) : null}
        <TextInput
          multiline
          onChangeText={setEventText}
          placeholder={selectedEventType.family === 'happy' ? 'نص المناسبة' : 'ملاحظات اختياري'}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.textArea]}
          textAlign="right"
          value={eventText}
        />
        <ActionButton
          label={
            submitting
              ? 'جاري الإرسال...'
              : selectedEventType.family === 'death'
                ? 'إرسال إعلان الوفاة'
                : selectedEventType.family === 'health'
                  ? 'إرسال الحالة الصحية'
                  : 'إرسال المناسبة'
          }
          onPress={submitEvent}
        />
      </SectionCard>
      ) : null}

      {intent === 'correction' ? (
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
      ) : null}

      {status.text ? (
        <View style={[styles.status, status.kind === 'error' ? styles.errorStatus : styles.successStatus]}>
          <Text style={styles.statusText}>{status.text}</Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  fieldHint: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
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
  fileHint: {
    color: colors.textMuted,
    fontSize: typography.caption,
    marginTop: spacing.xs,
    textAlign: 'right',
    writingDirection: 'rtl',
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
