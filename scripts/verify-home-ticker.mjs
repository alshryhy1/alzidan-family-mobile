/**
 * Smoke: أولوية شريط الأخبار (وفاة → مناسبات → عام → بطاقات).
 */
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('OK:', msg);
}

// Inline mirror of ranking rules (avoid TS import in plain node).
function isDeath(event) {
  const type = String(event.type || '').trim().toLowerCase();
  if (type === 'death') return true;
  return String(event.category || '').trim().toLowerCase() === 'condolence';
}

function build(sources) {
  const maxFamilyEvents = Math.max(1, Number(sources.maxFamilyEvents ?? 6));
  const events = sources.events || [];
  const banners = (sources.bannerMessages || []).map((v) => String(v || '').trim()).filter(Boolean);
  const specialCards = (sources.specialCardTickerItems || [])
    .map((v) => String(v || '').trim())
    .filter(Boolean);

  const deaths = events.filter(isDeath);
  const important = events.filter((e) => !isDeath(e));
  const familyBudget = Math.max(0, maxFamilyEvents - deaths.length);
  const deathItems = deaths.map((e) => `وفاة — ${e.person}`);
  const familyItems = important.slice(0, familyBudget).map((e) => `${e.type} — ${e.person}`);
  return [...deathItems, ...familyItems, ...banners, ...specialCards];
}

const items = build({
  events: [
    { type: 'marriage', person: 'أحمد', category: 'happy' },
    { type: 'death', person: 'مطلق', category: 'condolence' },
    { type: 'sick', person: 'خالد', category: 'health' },
  ],
  bannerMessages: ['خبر عام — تحديث'],
  specialCardTickerItems: ['بطاقة تهنئة — سعد'],
  maxFamilyEvents: 6,
});

assert(items[0].includes('مطلق'), 'death is first');
assert(items.some((x) => x.includes('أحمد')), 'important family kept');
assert(items.indexOf('خبر عام — تحديث') > items.findIndex((x) => x.includes('أحمد')), 'banners after family');
assert(items[items.length - 1].includes('بطاقة'), 'special cards last');

const crowded = build({
  events: [
    { type: 'death', person: 'وفاة1' },
    { type: 'death', person: 'وفاة2' },
    ...Array.from({ length: 10 }, (_, i) => ({ type: 'marriage', person: `فرح${i}` })),
  ],
  bannerMessages: [],
  specialCardTickerItems: ['بطاقة'],
  maxFamilyEvents: 6,
});
assert(crowded.filter((x) => x.startsWith('وفاة')).length === 2, 'all deaths kept within budget rules');
assert(crowded[crowded.length - 1] === 'بطاقة', 'cards still last when crowded');

console.log('All home-ticker priority cases passed.');
