import type { OccasionInboxItem } from '../services/occasionInteractions';
import type { FamilyEvent } from '../types';
import { isDeathEventType, isHealthEventType } from './eventVisibility';

export type SinceVisitTarget = 'events' | 'profile';

export type SinceVisitItem = {
  id: string;
  kind: 'death' | 'health' | 'happy' | 'inbox';
  title: string;
  subtitle: string;
  target: SinceVisitTarget;
  at: number;
};

const KIND_ORDER: Record<SinceVisitItem['kind'], number> = {
  death: 0,
  health: 1,
  inbox: 2,
  happy: 3,
};

export function eventTimestampMs(event: FamilyEvent): number {
  const created = Date.parse(String(event.createdAt || ''));
  if (Number.isFinite(created) && created > 0) return created;
  const showAt = Date.parse(String(event.showAt || ''));
  if (Number.isFinite(showAt) && showAt > 0) return showAt;
  const day = Date.parse(String(event.eventDate || event.date || ''));
  if (Number.isFinite(day) && day > 0) return day;
  return 0;
}

export function inboxTimestampMs(item: OccasionInboxItem): number {
  const latest = Date.parse(String(item.latest_at || ''));
  if (Number.isFinite(latest) && latest > 0) return latest;
  const messages = Array.isArray(item.messages) ? item.messages : [];
  let max = 0;
  for (const message of messages) {
    const at = Date.parse(String(message.created_at || ''));
    if (Number.isFinite(at) && at > max) max = at;
  }
  return max;
}

function eventKind(event: FamilyEvent): 'death' | 'health' | 'happy' {
  if (isDeathEventType(event)) return 'death';
  if (isHealthEventType(event)) return 'health';
  return 'happy';
}

function eventCopy(event: FamilyEvent): { title: string; subtitle: string } {
  const person = String(event.person || '').trim();
  const kind = eventKind(event);
  if (kind === 'death') return { title: 'عزاء', subtitle: person || String(event.title || '').trim() };
  if (kind === 'health') return { title: 'اطمئنان', subtitle: person || String(event.title || '').trim() };
  return {
    title: String(event.title || 'مناسبة').trim() || 'مناسبة',
    subtitle: person,
  };
}

export function countNewEvents(events: FamilyEvent[], seenAt: number): number {
  if (seenAt <= 0) return events.length;
  return events.filter((event) => eventTimestampMs(event) > seenAt).length;
}

export function countNewInbox(inbox: OccasionInboxItem[], seenAt: number): number {
  if (seenAt <= 0) return inbox.length;
  return inbox.filter((item) => inboxTimestampMs(item) > seenAt).length;
}

function isFresh(at: number, seenAt: number) {
  if (seenAt <= 0) return true;
  return at > seenAt;
}

export function buildSinceLastVisit(input: {
  events: FamilyEvent[];
  inbox: OccasionInboxItem[];
  homeSeenAt: number;
  profileSeenAt: number;
  limit?: number;
}): SinceVisitItem[] {
  const limit = input.limit ?? 5;
  const items: SinceVisitItem[] = [];

  for (const event of input.events) {
    const at = eventTimestampMs(event);
    if (!isFresh(at, input.homeSeenAt)) continue;
    const copy = eventCopy(event);
    items.push({
      id: `event-${event.id}`,
      kind: eventKind(event),
      title: copy.title,
      subtitle: copy.subtitle,
      target: 'events',
      at: at || Date.now(),
    });
  }

  for (const row of input.inbox) {
    const at = inboxTimestampMs(row);
    if (!isFresh(at, input.profileSeenAt)) continue;
    const total = Number(row.total) || 0;
    const person = String(row.occasion_person || '').trim();
    items.push({
      id: `inbox-${row.occasion_id}-${row.recipient_id || 0}`,
      kind: 'inbox',
      title: 'وصلك من العائلة',
      subtitle: total > 1 ? `${total} رسائل${person ? ` · ${person}` : ''}` : person || 'تهنئة أو رد',
      target: 'profile',
      at: at || Date.now(),
    });
  }

  return items
    .sort((left, right) => {
      const kind = KIND_ORDER[left.kind] - KIND_ORDER[right.kind];
      if (kind !== 0) return kind;
      return right.at - left.at;
    })
    .slice(0, limit);
}
