import { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

import { DataState } from '../components/DataState';
import { ImageViewerModal } from '../components/ImageViewerModal';
import { MemorySubmitPanel } from '../components/MemorySubmitPanel';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import {
  fetchApprovedMemoryItems,
  fetchApprovedReactionsByMemoryIds,
  type MemoryItem,
  type MemoryReaction,
  type MemoryUiKind,
} from '../services/memory';
import { colors, spacing, typography } from '../theme';
import type { Branch } from '../types';

type IndexFilterKind = 'all' | MemoryUiKind;
type DetailFilterKind = 'all' | MemoryUiKind | 'reaction';

type PersonSummary = {
  key: string;
  personId: string;
  personName: string;
  personLineage: string;
  branchKey: string;
  memoriesCount: number;
  latestCreatedAt: string;
};

const indexKindFilters: Array<{ key: IndexFilterKind; label: string }> = [
  { key: 'all', label: 'الكل' },
  { key: 'image', label: 'صور' },
  { key: 'video', label: 'فيديو' },
  { key: 'audio', label: 'صوت' },
  { key: 'story', label: 'قصص' },
  { key: 'document', label: 'وثائق' },
];

const detailKindFilters: Array<{ key: DetailFilterKind; label: string }> = [
  { key: 'all', label: 'الكل' },
  { key: 'image', label: 'صور' },
  { key: 'video', label: 'فيديو' },
  { key: 'audio', label: 'صوت' },
  { key: 'story', label: 'قصص' },
  { key: 'document', label: 'وثائق' },
  { key: 'reaction', label: 'الدعاء والتعليقات' },
];

function cleanText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function personKey(item: MemoryItem) {
  const id = cleanText(item.personId);
  const name = cleanText(item.personName);
  return id || name;
}

function mediaTypeLabel(kind: MemoryUiKind) {
  if (kind === 'video') return 'فيديو';
  if (kind === 'audio') return 'صوت';
  if (kind === 'story') return 'قصة';
  if (kind === 'document') return 'وثيقة';
  return 'صورة';
}

function sourceSignature(item: MemoryItem) {
  const relation = cleanText(item.submittedByRelation).toLowerCase();
  const name = cleanText(item.submittedByName);
  const phone = cleanText(item.submittedByPhone);

  if (relation === 'admin' || (!name && !phone && !relation)) {
    return 'تم الرفع بواسطة الإدارة';
  }

  if (relation === 'delegate' || relation.includes('مندوب')) {
    if (!name && !phone) return 'تم الرفع بواسطة المندوب';
    return `تم الرفع بواسطة المندوب: ${[name, phone].filter(Boolean).join(' — ')}`;
  }

  const parts: string[] = [];
  if (name) parts.push(`الاسم: ${name}`);
  if (phone) parts.push(`الجوال: ${phone}`);
  return parts.length ? parts.join(' — ') : 'تم الرفع بواسطة الإدارة';
}

function matchesKind(item: MemoryItem, kind: MemoryUiKind) {
  if (item.memoryKind === kind) return true;
  return item.media.some((entry) => entry.mediaType === kind);
}

function dateLabel(value: string) {
  if (!value) return '';
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleDateString('ar-SA');
}

function statFromItems(items: MemoryItem[]) {
  const stats = {
    image: 0,
    video: 0,
    audio: 0,
    story: 0,
    document: 0,
  };

  items.forEach((item) => {
    if (item.memoryKind === 'image') stats.image += 1;
    if (item.memoryKind === 'video') stats.video += 1;
    if (item.memoryKind === 'audio') stats.audio += 1;
    if (item.memoryKind === 'story') stats.story += 1;
    if (item.memoryKind === 'document') stats.document += 1;

    item.media.forEach((entry) => {
      if (entry.mediaType === 'image') stats.image += 1;
      if (entry.mediaType === 'video') stats.video += 1;
      if (entry.mediaType === 'audio') stats.audio += 1;
      if (entry.mediaType === 'document') stats.document += 1;
    });
  });

  return stats;
}

function StoryMedia({ item }: { item: MemoryItem }) {
  const body = cleanText(item.storyText || item.description);
  if (!body) return null;

  return <Text style={styles.memoryBody}>{body}</Text>;
}

function MemoryVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
  });

  return (
    <VideoView
      allowsPictureInPicture
      contentFit="contain"
      nativeControls
      player={player}
      style={styles.video}
    />
  );
}

function MediaTile({
  caption,
  kind,
  onViewImage,
  url,
}: {
  caption: string;
  kind: MemoryUiKind;
  onViewImage: (uri: string, caption: string) => void;
  url: string;
}) {
  const text = cleanText(caption) || `فتح ${mediaTypeLabel(kind)}`;

  if (!url) return null;

  if (kind === 'image') {
    return (
      <Pressable
        accessibilityLabel={text}
        accessibilityRole="button"
        onPress={() => onViewImage(url, text)}
        style={({ pressed }) => [styles.mediaBlock, pressed && styles.pressed]}
      >
        <Image source={{ uri: url }} style={styles.image} />
        <Text style={styles.mediaCaption}>{text}</Text>
      </Pressable>
    );
  }

  if (kind === 'video') {
    return (
      <View style={styles.mediaBlock}>
        <MemoryVideo uri={url} />
        <Text style={styles.mediaCaption}>{text}</Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => {
        Linking.openURL(url).catch(() => undefined);
      }}
      style={({ pressed }) => [styles.fileLink, pressed && styles.pressed]}
    >
      <Text style={styles.fileLinkText}>{`${mediaTypeLabel(kind)}: ${text}`}</Text>
    </Pressable>
  );
}

function MemoryCard({
  item,
  onSelectPerson,
  onViewImage,
}: {
  item: MemoryItem;
  onSelectPerson: (person: PersonSummary) => void;
  onViewImage: (uri: string, caption: string) => void;
}) {
  const person: PersonSummary = {
    key: personKey(item),
    personId: cleanText(item.personId),
    personName: cleanText(item.personName),
    personLineage: cleanText(item.personLineage),
    branchKey: cleanText(item.branchKey),
    memoriesCount: 1,
    latestCreatedAt: cleanText(item.createdAt),
  };

  return (
    <SectionCard>
      <View style={styles.memoryHeader}>
        <Text style={styles.memoryTitle}>{cleanText(item.title) || mediaTypeLabel(item.memoryKind)}</Text>
        <Text style={styles.memoryMeta}>
          {[
            item.branchKey ? `الفرع: ${item.branchKey}` : '',
            item.memoryDate ? `التاريخ: ${item.memoryDate}` : '',
            item.memoryYear ? `السنة: ${item.memoryYear}` : '',
            `النوع: ${mediaTypeLabel(item.memoryKind)}`,
          ]
            .filter(Boolean)
            .join(' — ')}
        </Text>
      </View>

      <Pressable onPress={() => onSelectPerson(person)} style={({ pressed }) => [styles.personTag, pressed && styles.pressed]}>
        <Text style={styles.personTagText}>{cleanText(item.personName) || 'شخص من الذاكرة'}</Text>
      </Pressable>

      {cleanText(item.description) ? <Text style={styles.memoryBody}>{cleanText(item.description)}</Text> : null}
      <StoryMedia item={item} />

      {item.people.length ? (
        <Text style={styles.memoryMeta}>
          أشخاص إضافيون: {item.people.map((entry) => cleanText(entry.personName)).filter(Boolean).join('، ')}
        </Text>
      ) : null}

      <Text style={styles.source}>{sourceSignature(item)}</Text>

      {item.media.map((entry) => (
        <MediaTile
          caption={entry.caption}
          key={entry.id || `${entry.mediaType}-${entry.mediaUrl}`}
          kind={entry.mediaType}
          onViewImage={onViewImage}
          url={entry.mediaUrl}
        />
      ))}
    </SectionCard>
  );
}

function ReactionCard({ reaction, title }: { reaction: MemoryReaction; title: string }) {
  return (
    <SectionCard>
      <Text style={styles.memoryTitle}>{reaction.reactionType === 'dua' ? 'دعاء' : 'تعليق'}</Text>
      <Text style={styles.memoryMeta}>
        {[reaction.senderName ? `الاسم: ${reaction.senderName}` : '', reaction.senderPhone ? `الجوال: ${reaction.senderPhone}` : '', title ? `على مادة: ${title}` : '']
          .filter(Boolean)
          .join(' — ')}
      </Text>
      <Text style={styles.memoryBody}>{reaction.text}</Text>
    </SectionCard>
  );
}

export function MemoryScreen({ branches: branchList }: { branches: Branch[] }) {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [branch, setBranch] = useState('all');
  const [indexKind, setIndexKind] = useState<IndexFilterKind>('all');

  const [selectedPerson, setSelectedPerson] = useState<PersonSummary | null>(null);
  const [detailKind, setDetailKind] = useState<DetailFilterKind>('all');

  const [personReactions, setPersonReactions] = useState<MemoryReaction[]>([]);
  const [loadingReactions, setLoadingReactions] = useState(false);
  const [reactionsError, setReactionsError] = useState('');
  const [viewerImage, setViewerImage] = useState<{ uri: string; caption: string } | null>(null);

  const openImageViewer = (uri: string, caption: string) => {
    setViewerImage({ uri, caption });
  };

  const closeImageViewer = () => {
    setViewerImage(null);
  };

  const load = () => {
    setLoading(true);
    setError(null);

    fetchApprovedMemoryItems()
      .then((rows) => {
        setItems(rows);
      })
      .catch((loadError: unknown) => {
        const message = loadError instanceof Error ? loadError.message : 'تعذر تحميل بيانات من الذاكرة.';
        setError(message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const branches = useMemo(() => {
    const unique = new Set<string>();
    items.forEach((item) => {
      const key = cleanText(item.branchKey);
      if (key) unique.add(key);
    });
    return Array.from(unique);
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = cleanText(query).toLowerCase();
    return items.filter((item) => {
      if (branch !== 'all' && item.branchKey !== branch) return false;
      if (indexKind !== 'all' && !matchesKind(item, indexKind)) return false;

      if (!q) return true;
      const haystack = [item.personName, item.title, item.description, item.storyText, item.personLineage]
        .map((part) => cleanText(part).toLowerCase())
        .join(' ');
      return haystack.includes(q);
    });
  }, [branch, indexKind, items, query]);

  const latestItems = useMemo(() => {
    return [...filteredItems]
      .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))
      .slice(0, 8);
  }, [filteredItems]);

  const personCards = useMemo(() => {
    const map = new Map<string, PersonSummary>();

    filteredItems.forEach((item) => {
      const key = personKey(item);
      if (!key) return;

      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          personId: cleanText(item.personId),
          personName: cleanText(item.personName) || 'شخص من الذاكرة',
          personLineage: cleanText(item.personLineage),
          branchKey: cleanText(item.branchKey),
          memoriesCount: 1,
          latestCreatedAt: cleanText(item.createdAt),
        });
        return;
      }

      existing.memoriesCount += 1;
      const previous = Date.parse(existing.latestCreatedAt || '');
      const current = Date.parse(item.createdAt || '');
      if ((Number.isFinite(current) ? current : 0) > (Number.isFinite(previous) ? previous : 0)) {
        existing.latestCreatedAt = item.createdAt;
      }
    });

    return [...map.values()].sort((a, b) => Date.parse(b.latestCreatedAt || '') - Date.parse(a.latestCreatedAt || ''));
  }, [filteredItems]);

  const personItems = useMemo(() => {
    if (!selectedPerson) return [];
    return items
      .filter((item) => personKey(item) === selectedPerson.key)
      .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
  }, [items, selectedPerson]);

  const detailItems = useMemo(() => {
    if (detailKind === 'all' || detailKind === 'reaction') return personItems;
    return personItems.filter((item) => matchesKind(item, detailKind));
  }, [detailKind, personItems]);

  const stat = useMemo(() => statFromItems(items), [items]);

  useEffect(() => {
    if (!selectedPerson) {
      setPersonReactions([]);
      setLoadingReactions(false);
      setReactionsError('');
      return;
    }

    const ids = personItems.map((item) => item.id).filter(Boolean);
    if (!ids.length) {
      setPersonReactions([]);
      setLoadingReactions(false);
      setReactionsError('');
      return;
    }

    let alive = true;
    setLoadingReactions(true);
    setReactionsError('');

    fetchApprovedReactionsByMemoryIds(ids)
      .then((rows) => {
        if (!alive) return;
        setPersonReactions(rows);
      })
      .catch((reactionError: unknown) => {
        if (!alive) return;
        const message = reactionError instanceof Error ? reactionError.message : 'تعذر تحميل التفاعلات.';
        setPersonReactions([]);
        setReactionsError(message);
      })
      .finally(() => {
        if (alive) setLoadingReactions(false);
      });

    return () => {
      alive = false;
    };
  }, [personItems, selectedPerson]);

  const reactionTitleByMemory = useMemo(() => {
    const map = new Map<string, string>();
    personItems.forEach((item) => {
      map.set(item.id, cleanText(item.title) || mediaTypeLabel(item.memoryKind));
    });
    return map;
  }, [personItems]);

  const imageViewer = (
    <ImageViewerModal
      caption={viewerImage?.caption}
      onClose={closeImageViewer}
      uri={viewerImage?.uri || ''}
      visible={Boolean(viewerImage)}
    />
  );

  if (selectedPerson) {
    return (
      <>
        <Screen
          description="عرض ذاكرة الشخص مع الصور والفيديو والصوت والقصص والوثائق، إضافة إلى الدعاء والتعليقات المعتمدة."
          onRefresh={load}
          refreshing={loading}
          title={selectedPerson.personName}
        >
        <Pressable
          onPress={() => {
            setSelectedPerson(null);
            setDetailKind('all');
          }}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text style={styles.backButtonText}>← العودة إلى فهرس من الذاكرة</Text>
        </Pressable>

        <SectionCard>
          <Text style={styles.memoryMeta}>
            {[selectedPerson.branchKey ? `الفرع: ${selectedPerson.branchKey}` : '', selectedPerson.personLineage ? `النسب: ${selectedPerson.personLineage}` : '']
              .filter(Boolean)
              .join(' — ') || 'ذاكرة شخصية'}
          </Text>
          <Text style={styles.statTitle}>إجمالي المواد: {personItems.length}</Text>
        </SectionCard>

        <View style={styles.filterWrap}>
          {detailKindFilters.map((entry) => {
            const active = detailKind === entry.key;
            return (
              <Pressable
                key={entry.key}
                onPress={() => setDetailKind(entry.key)}
                style={({ pressed }) => [styles.filterChip, active && styles.filterChipActive, pressed && styles.pressed]}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{entry.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {detailKind === 'reaction' ? (
          <>
            <DataState error={reactionsError || null} loading={loadingReactions} onRetry={load} />
            {!loadingReactions && !reactionsError && personReactions.length === 0 ? (
              <DataState empty emptyText="لا توجد أدعية أو تعليقات معتمدة لهذه الشخصية حاليًا." />
            ) : null}
            {personReactions.map((reaction) => (
              <ReactionCard key={reaction.id} reaction={reaction} title={reactionTitleByMemory.get(reaction.memoryId) || 'مادة'} />
            ))}
          </>
        ) : (
          <>
            <DataState empty={!detailItems.length} emptyText="لا توجد مواد في هذا القسم." />
            {detailItems.map((item) => (
              <MemoryCard
                key={item.id}
                item={item}
                onSelectPerson={setSelectedPerson}
                onViewImage={openImageViewer}
              />
            ))}
          </>
        )}
      </Screen>
      {imageViewer}
      </>
    );
  }

  return (
    <>
    <Screen
      description="فهرس من الذاكرة: أحدث الذكريات، بطاقات الأشخاص، والبحث والفلاتر على المواد المعتمدة فقط."
      onRefresh={load}
      refreshing={loading}
      title="من الذاكرة"
    >
      <SectionCard title="ملخص سريع">
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{personCards.length}</Text>
            <Text style={styles.statLabel}>شخصيات</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stat.image}</Text>
            <Text style={styles.statLabel}>صور</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stat.video}</Text>
            <Text style={styles.statLabel}>فيديو</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stat.audio}</Text>
            <Text style={styles.statLabel}>صوت</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stat.story}</Text>
            <Text style={styles.statLabel}>قصص</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stat.document}</Text>
            <Text style={styles.statLabel}>وثائق</Text>
          </View>
        </View>
      </SectionCard>

      <SectionCard title="بحث وفلاتر">
        <TextInput
          onChangeText={setQuery}
          placeholder="ابحث باسم الشخص أو عنوان المادة"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={query}
        />

        <View style={styles.filterWrap}>
          <Pressable
            onPress={() => setBranch('all')}
            style={({ pressed }) => [styles.filterChip, branch === 'all' && styles.filterChipActive, pressed && styles.pressed]}
          >
            <Text style={[styles.filterChipText, branch === 'all' && styles.filterChipTextActive]}>كل الفروع</Text>
          </Pressable>
          {branches.map((entry) => {
            const active = branch === entry;
            return (
              <Pressable
                key={entry}
                onPress={() => setBranch(entry)}
                style={({ pressed }) => [styles.filterChip, active && styles.filterChipActive, pressed && styles.pressed]}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{entry}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.filterWrap}>
          {indexKindFilters.map((entry) => {
            const active = indexKind === entry.key;
            return (
              <Pressable
                key={entry.key}
                onPress={() => setIndexKind(entry.key)}
                style={({ pressed }) => [styles.filterChip, active && styles.filterChipActive, pressed && styles.pressed]}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{entry.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </SectionCard>

      <DataState error={error} loading={loading} onRetry={load} />

      {!loading && !error ? (
        <>
          <SectionCard title="أحدث الذكريات" eyebrow={`المواد المعتمدة: ${filteredItems.length}`}>
            {!latestItems.length ? <DataState empty emptyText="لا توجد ذكريات مطابقة للبحث الحالي." /> : null}
            {latestItems.map((item) => (
              <MemoryCard
                key={item.id}
                item={item}
                onSelectPerson={setSelectedPerson}
                onViewImage={openImageViewer}
              />
            ))}
          </SectionCard>

          <SectionCard title="شخصيات من الذاكرة">
            {!personCards.length ? <DataState empty emptyText="لا توجد شخصيات مطابقة للفلاتر الحالية." /> : null}

            {personCards.map((person) => (
              <Pressable
                key={person.key}
                onPress={() => {
                  setSelectedPerson(person);
                  setDetailKind('all');
                }}
                style={({ pressed }) => [styles.personCard, pressed && styles.pressed]}
              >
                <Text style={styles.personName}>{person.personName}</Text>
                <Text style={styles.personMeta}>
                  {[
                    person.branchKey ? `الفرع: ${person.branchKey}` : '',
                    person.memoriesCount ? `عدد المواد: ${person.memoriesCount}` : '',
                    person.latestCreatedAt ? `آخر تحديث: ${dateLabel(person.latestCreatedAt)}` : '',
                  ]
                    .filter(Boolean)
                    .join(' — ')}
                </Text>
                {person.personLineage ? <Text style={styles.personMeta}>النسب: {person.personLineage}</Text> : null}
              </Pressable>
            ))}
          </SectionCard>

          <MemorySubmitPanel branches={branchList} />
        </>
      ) : null}
    </Screen>
    {imageViewer}
    </>
  );
}

const styles = StyleSheet.create({
  statsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statBox: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    minWidth: 92,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statValue: {
    color: colors.primaryDark,
    fontSize: typography.title,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  statTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  input: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: typography.body,
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  filterWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  filterChip: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '700',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  filterChipTextActive: {
    color: colors.white,
  },
  memoryHeader: {
    gap: 4,
  },
  memoryTitle: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  memoryMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  memoryBody: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 24,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  source: {
    color: colors.primaryDark,
    fontSize: typography.caption,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  mediaBlock: {
    gap: spacing.xs,
  },
  image: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    height: 210,
    width: '100%',
  },
  video: {
    backgroundColor: '#000',
    borderRadius: 14,
    height: 220,
    width: '100%',
  },
  mediaCaption: {
    color: colors.textMuted,
    fontSize: typography.caption,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  fileLink: {
    backgroundColor: colors.accentSoft,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  fileLinkText: {
    color: colors.primaryDark,
    fontSize: typography.caption,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  personTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  personTagText: {
    color: colors.primaryDark,
    fontSize: typography.caption,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  personCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  personName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  personMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  backButtonText: {
    color: colors.primaryDark,
    fontSize: typography.caption,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  pressed: {
    opacity: 0.72,
  },
});
