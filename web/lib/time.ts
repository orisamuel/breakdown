/** עזרי זמן. השעות בשיט הן טקסט חופשי ("09:00-10:00", "19:30+", "לקביעה"). */

export function startMin(ts: string): number {
  const head = String(ts || '').split('-')[0].trim();
  const m = head.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return Number.MAX_SAFE_INTEGER;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function endMin(ts: string): number {
  const parts = String(ts || '').split('-');
  const tail = (parts.length > 1 ? parts[1] : parts[0]).trim();
  const m = tail.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return startMin(ts);
  return Number(m[1]) * 60 + Number(m[2]);
}

export function hasTime(ts: string): boolean {
  return startMin(ts) !== Number.MAX_SAFE_INTEGER;
}

export function fmt(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** מזיז טווח שעות בדקות, ושומר על הפורמט */
export function shift(ts: string, delta: number): string {
  if (!hasTime(ts)) return ts;
  const parts = String(ts).split('-');
  if (parts.length === 2 && /^\s*\d{1,2}:\d{2}/.test(parts[1])) {
    return `${fmt(startMin(ts) + delta)}-${fmt(endMin(ts) + delta)}`;
  }
  return fmt(startMin(ts) + delta);
}

export function nowMin(d: Date = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** פער מול הלו״ז: חיובי = מאחרים, שלילי = מקדימים */
export function drift(ts: string, now: number): number | null {
  if (!hasTime(ts)) return null;
  return now - endMin(ts);
}

export function driftLabel(mins: number): string {
  const a = Math.abs(mins);
  const h = Math.floor(a / 60);
  const m = a % 60;
  const t = h ? `${h}:${String(m).padStart(2, '0')} שעות` : `${m} דק׳`;
  if (mins > 4) return `מאחרים ב-${t}`;
  if (mins < -4) return `מקדימים ב-${t}`;
  return 'בזמן';
}
