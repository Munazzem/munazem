const ARABIC_DAYS = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

/**
 * Returns formatted date in Arabic: "الأربعاء، 19 أغسطس"
 */
export function formatArabicDateToday(): string {
  const now = new Date();
  const dayName = ARABIC_DAYS[now.getDay()];
  const dayNum = now.getDate();
  const monthName = ARABIC_MONTHS[now.getMonth()];
  return `${dayName}، ${dayNum} ${monthName}`;
}

/**
 * Formats standard ISO date string into readable Arabic format: "19 أغسطس 2026"
 */
export function formatArabicDate(dateStr: string | Date): string {
  if (!dateStr) return '—';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return '—';

  const dayNum = d.getDate();
  const monthName = ARABIC_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${dayNum} ${monthName} ${year}`;
}

/**
 * Relative time in friendly Arabic: "منذ 15 دقيقة", "اليوم", "أمس"
 */
export function formatArabicRelativeTime(dateStr: string | Date): string {
  if (!dateStr) return '';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'الآن';
  if (diffMinutes < 60) return `منذ ${diffMinutes} دقيقة`;
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  if (diffDays === 1) return 'أمس';
  if (diffDays < 7) return `منذ ${diffDays} أيام`;
  return formatArabicDate(d);
}
