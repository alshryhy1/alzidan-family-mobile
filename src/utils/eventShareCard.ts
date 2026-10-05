import { Linking, Share } from 'react-native';

import type { FamilyEvent } from '../types';
import { eventFamilyOf, formatVenueLine, mapsUrlFromCoords } from './eventRequestMessage';
import { formatVisitTimeRangeAr } from './formatVisitTimeAr';

export const EVENT_SHARE_SCHEME = 'com.alzidan.family2';

function cleanLine(value?: string | null) {
  return String(value || '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikePayload(value: string) {
  const t = value.trim();
  return t.startsWith('{') || t.startsWith('[') || t.includes('__JSON__');
}

export function eventDeepLink(eventId: string) {
  const id = encodeURIComponent(String(eventId || '').trim());
  return `${EVENT_SHARE_SCHEME}://events/${id}`;
}

export function eventIdFromOpenUrl(url: string | null) {
  const raw = String(url || '').trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const fromQuery = parsed.searchParams.get('id') || parsed.searchParams.get('event');
    if (fromQuery) return String(fromQuery).trim() || null;
    const parts = parsed.pathname.split('/').filter(Boolean);
    const host = String(parsed.hostname || parsed.host || '')
      .toLowerCase()
      .replace(/\/$/, '');
    if (host === 'events' && parts[0]) return decodeURIComponent(parts[0]);
    const eventsIdx = parts.findIndex((part) => part.toLowerCase() === 'events');
    if (eventsIdx >= 0 && parts[eventsIdx + 1]) {
      return decodeURIComponent(parts[eventsIdx + 1]);
    }
  } catch {
    /* fall through */
  }
  const match = raw.match(/events[/:]([^/?#]+)/i);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]).trim() || null;
  } catch {
    return match[1].trim() || null;
  }
}

function headingFor(event: FamilyEvent) {
  const family = eventFamilyOf(String(event.type || event.category || ''));
  if (event.category === 'condolence' || family === 'death') return 'إنا لله وإنا إليه راجعون';
  if (event.category === 'health' || family === 'health') return 'خبر صحي في العائلة';
  return 'مناسبة في عائلة الزيدان';
}

function visitRange(event: FamilyEvent) {
  if (event.visitDateFrom && event.visitDateTo) return `من ${event.visitDateFrom} إلى ${event.visitDateTo}`;
  return event.visitDateFrom || event.visitDateTo || '';
}

export function buildEventShareCard(event: FamilyEvent) {
  const heading = headingFor(event);
  const title = cleanLine(event.title);
  const person = cleanLine(event.person);
  const date = cleanLine(event.date);
  const venue = formatVenueLine({ placeKind: event.placeKind, extra: event.placeName });
  const maps = mapsUrlFromCoords(event.lat, event.lng);
  const details = cleanLine(event.details);
  const detailsLine = details && !looksLikePayload(details) ? details.slice(0, 280) : '';
  const visitDates = visitRange(event);
  const visitTimes = formatVisitTimeRangeAr(event.visitTimeFrom, event.visitTimeTo);

  const lines = ['عائلة مطلق الزيدان', '', heading];
  if (title && title !== heading) lines.push(title);
  if (person) lines.push(person);
  if (date) lines.push(date);
  if (venue) lines.push(venue);
  if (event.hospitalName) {
    const dept = cleanLine(event.hospitalDepartment);
    lines.push(dept ? `${event.hospitalName} — ${dept}` : event.hospitalName);
  }
  if (event.contactMethod === 'visit' && visitDates) lines.push(`الزيارة: ${visitDates}`);
  if (event.contactMethod === 'visit' && visitTimes) lines.push(`الوقت: ${visitTimes}`);
  if (detailsLine) {
    lines.push('');
    lines.push(detailsLine);
  }
  if (maps) {
    lines.push('');
    lines.push(maps);
  }
  if (event.branch) lines.push(event.branch);
  lines.push('');
  lines.push('افتح الخبر في تطبيق عائلة الزيدان:');
  lines.push(eventDeepLink(event.id));
  return lines.filter((line, index, all) => !(line === '' && all[index - 1] === '')).join('\n');
}

export function eventShareWhatsAppUrl(event: FamilyEvent) {
  return `whatsapp://send?text=${encodeURIComponent(buildEventShareCard(event))}`;
}

export async function shareEventToWhatsAppGroup(event: FamilyEvent) {
  const card = buildEventShareCard(event);
  try {
    await Linking.openURL(eventShareWhatsAppUrl(event));
  } catch {
    await Share.share({ message: card });
  }
}
