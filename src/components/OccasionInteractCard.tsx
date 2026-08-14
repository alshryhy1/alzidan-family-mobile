import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, spacing, typography } from '../theme';
import {
  ctaTitleForType,
  fetchMyOccasionInteraction,
  fetchOccasionInteractionCatalog,
  submitOccasionInteraction,
  trackTitle,
  type OccasionInteractionType,
} from '../services/occasionInteractions';

const MEMBER_PHONE_KEY = 'alzidan_member_phone_v1';

type Props = {
  occasionId: number;
  eventType: string;
  person?: string | null;
};

export function OccasionInteractCard({ occasionId, eventType, person }: Props) {
  const [catalog, setCatalog] = useState<OccasionInteractionType[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [showMessage, setShowMessage] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(MEMBER_PHONE_KEY)
      .then((v) => {
        if (alive) setPhone(String(v || '').trim());
      })
      .catch(() => {});
    fetchOccasionInteractionCatalog(eventType)
      .then(async (items) => {
        if (!alive) return;
        setCatalog(items);
        const p = String((await AsyncStorage.getItem(MEMBER_PHONE_KEY)) || '').trim();
        if (!p) return;
        const mine = await fetchMyOccasionInteraction(occasionId, p);
        if (mine?.interaction_type_key && alive) {
          setSelectedKey(mine.interaction_type_key);
          setStatus('سبق أن شاركت في هذه المناسبة.');
        }
      })
      .catch(() => {
        if (alive) setCatalog([]);
      });
    return () => {
      alive = false;
    };
  }, [eventType, occasionId]);

  if (!catalog.length) return null;

  const selected = catalog.find((item) => item.key === selectedKey);

  async function send(key: string, text?: string) {
    if (!phone) {
      setStatus('ادخل برقم جوالك من تبويب «ملفي» أولًا.');
      return;
    }
    setBusy(true);
    setStatus('جاري الإرسال…');
    try {
      const res = await submitOccasionInteraction({
        occasionId,
        interactionTypeKey: key,
        senderPhone: phone,
        message: text || '',
      });
      if (!res || res.ok === false) {
        setStatus('تعذر الإرسال، حاول لاحقًا.');
        return;
      }
      setSelectedKey(key);
      setShowMessage(false);
      setMessage('');
      setStatus('وصل تفاعلك لصاحب المناسبة بخصوصية تامة 💚');
    } catch {
      setStatus('تعذر الإرسال، حاول لاحقًا.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => {
          setOpen((v) => {
            const next = !v;
            if (!next) {
              setShowMessage(false);
              setStatus('');
            }
            return next;
          });
        }}
        style={({ pressed }) => [styles.toggle, pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text>
        <View style={styles.toggleText}>
          <Text style={styles.title}>{ctaTitleForType(eventType, person)}</Text>
          <Text style={styles.hint}>
            {open ? 'تفاعل خاص — لا يظهر للعامة' : 'اضغط للمشاركة ثم أغلق عند الانتهاء'}
          </Text>
        </View>
      </Pressable>
      {open ? (
      <>
      {(() => {
        const groups: Record<string, OccasionInteractionType[]> = {};
        const order: string[] = [];
        catalog.forEach((item) => {
          const tr = String(item.track || '').trim().toLowerCase() || '_';
          if (!groups[tr]) {
            groups[tr] = [];
            order.push(tr);
          }
          groups[tr].push(item);
        });
        order.sort((a, b) => {
          const rank = (x: string) =>
            x === 'deceased' ? 1 : x === 'bereaved' ? 2 : x === '_' ? 9 : 5;
          return rank(a) - rank(b);
        });
        const showHeaders =
          order.filter((t) => t !== '_').length >= 1 && order.length > 1;
        return order.map((tr) => (
          <View key={tr} style={styles.trackBlock}>
            {showHeaders && trackTitle(tr) ? (
              <Text style={styles.trackLabel}>{trackTitle(tr)}</Text>
            ) : null}
            <View style={styles.chips}>
              {groups[tr].map((item) => {
                const active = item.key === selectedKey;
                return (
                  <Pressable
                    key={item.key}
                    disabled={busy}
                    onPress={() => {
                      if (item.allows_message) {
                        setSelectedKey(item.key);
                        setShowMessage(true);
                        setStatus('اكتب رسالتك ثم أرسل.');
                        return;
                      }
                      send(item.key);
                    }}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ));
      })()}
      {showMessage && selected?.allows_message ? (
        <View style={styles.msgBox}>
          <TextInput
            multiline
            maxLength={500}
            onChangeText={setMessage}
            placeholder="رسالتك الخاصة…"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            textAlign="right"
            value={message}
          />
          <View style={styles.msgActions}>
            <Pressable
              disabled={busy}
              onPress={() => selectedKey && send(selectedKey, message)}
              style={styles.sendBtn}
            >
              <Text style={styles.sendText}>{busy ? '…' : 'إرسال'}</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={() => {
                setShowMessage(false);
                setMessage('');
                setStatus('');
              }}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelText}>إغلاق</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <Pressable
        onPress={() => {
          setOpen(false);
          setShowMessage(false);
        }}
        style={styles.closePanel}
      >
        <Text style={styles.closePanelText}>إغلاق المشاركة</Text>
      </Pressable>
      </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: '#EEF6F0',
    borderWidth: 1,
    borderColor: '#D5E7DB',
  },
  toggle: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 8,
  },
  toggleText: {
    flex: 1,
    gap: 2,
  },
  chevron: {
    color: '#166534',
    fontSize: 16,
    fontWeight: '800',
  },
  title: {
    color: '#14532D',
    fontSize: typography.body,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  hint: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: typography.caption,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  trackBlock: {
    marginTop: spacing.sm,
    gap: 6,
  },
  trackLabel: {
    color: '#065F46',
    fontSize: typography.caption,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  chips: {
    marginTop: 0,
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#86EFAC',
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: '#166534',
    borderColor: '#166534',
  },
  chipText: {
    color: '#166534',
    fontWeight: '700',
    fontSize: typography.caption,
  },
  chipTextActive: {
    color: '#fff',
  },
  msgBox: {
    marginTop: spacing.sm,
    gap: 8,
  },
  input: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#fff',
    color: colors.text,
    textAlignVertical: 'top',
  },
  msgActions: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  sendBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#166534',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderColor: '#CBD5E1',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelText: {
    color: '#475569',
    fontWeight: '800',
  },
  closePanel: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingVertical: 6,
  },
  closePanelText: {
    color: '#166534',
    fontSize: typography.caption,
    fontWeight: '800',
  },
  sendText: {
    color: '#fff',
    fontWeight: '800',
  },
  status: {
    marginTop: spacing.sm,
    color: '#166534',
    fontSize: typography.caption,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
