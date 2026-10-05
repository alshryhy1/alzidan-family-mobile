/**
 * كرت مشاركة المناسبة للقروب: رابط عميق، بلا جوال، مصدر عائلة الزيدان.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function eventIdFromOpenUrl(url) {
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

const src = readFileSync(join(root, 'src/utils/eventShareCard.ts'), 'utf8');
const screen = readFileSync(join(root, 'src/screens/EventsScreen.tsx'), 'utf8');

const checks = [
  ['scheme events path', eventIdFromOpenUrl('com.alzidan.family2://events/42') === '42'],
  ['query id', eventIdFromOpenUrl('com.alzidan.family2://events?id=88') === '88'],
  ['https path', eventIdFromOpenUrl('https://alzidan.org/events/7') === '7'],
  ['empty url', eventIdFromOpenUrl('') === null],
  ['home url ignored', eventIdFromOpenUrl('com.alzidan.family2://home') === null],
  ['card builder has no contactPhone', !/contactPhone/.test(src)],
  ['card opens whatsapp chat picker', src.includes('whatsapp://send?text=')],
  ['card falls back to share sheet', src.includes('Share.share')],
  ['card does not use wa.me without number', !src.includes('https://wa.me/?text=')],
  ['brand line', src.includes('عائلة مطلق الزيدان')],
  ['death heading', src.includes('إنا لله وإنا إليه راجعون')],
  ['button label', screen.includes('شارك للقروب')],
  ['share wired', screen.includes('shareEventToWhatsAppGroup')],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(
    'verify-event-share-card failed:\n' + failed.map(([name]) => ` - ${name}`).join('\n'),
  );
  process.exit(1);
}
console.log(`verify-event-share-card: ${checks.length} checks ok`);
