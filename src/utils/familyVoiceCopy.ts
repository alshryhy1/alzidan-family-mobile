/** نسب يُقرأ من المسار المحفوظ: من الابن إلى الأب. ما يُخترع اسم. */
export function spokenNasab(names: string[]): string {
  const parts = names
    .map((name) =>
      String(name || '')
        .replace(/\s*رحمه الله\s*/g, '')
        .replace(/\s*\(رحمه الله\)\s*/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
  if (!parts.length) return '';
  const chain = [...parts].reverse();
  if (chain.length === 1) return `${chain[0]}. ما بعده غير مسجّل في الشجرة.`;
  return chain.join(' بن ');
}

export function nasabQuery(value: string) {
  return String(value || '')
    .replace(/^\s*(وش\s+)?نسب\s+/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

type VisitLine = {
  kind: string;
  title: string;
  subtitle: string;
};

function sinceBit(item: VisitLine) {
  const subtitle = String(item.subtitle || '').trim();
  if (item.kind === 'death') return subtitle ? `عزا ${subtitle}` : 'عزا';
  if (item.kind === 'health') return subtitle ? `اطمئنان على ${subtitle}` : 'خبر صحة';
  if (item.kind === 'inbox') return 'رسالة من العائلة';
  return subtitle ? `${item.title} ${subtitle}` : item.title;
}

/** جملة واحدة مما فاته. من العناصر المحسوبة، بلا خبر جديد. */
export function sinceVisitSummary(items: VisitLine[]): string {
  const bits = items.map(sinceBit).filter(Boolean).slice(0, 3);
  if (!bits.length) return 'ما فاتك شيء من آخر زيارة.';
  if (bits.length === 1) return `فاتك ${bits[0]}.`;
  const head = bits.slice(0, -1).join('، و');
  return `فاتك ${head}، و${bits[bits.length - 1]}.`;
}
