export type ShotState = 'pending' | 'done' | 'partial' | 'delayed' | 'skipped';

export const STATES: ShotState[] = ['pending', 'done', 'partial', 'delayed', 'skipped'];

export const STATE_LABEL: Record<ShotState, string> = {
  pending: 'ממתין',
  done: 'בוצע',
  partial: 'חלקית',
  delayed: 'נדחה',
  skipped: 'לא בוצע',
};

export const STATE_VAR: Record<ShotState, string> = {
  pending: 'var(--st-pending)',
  done: 'var(--st-done)',
  partial: 'var(--st-partial)',
  delayed: 'var(--st-delayed)',
  skipped: 'var(--st-skipped)',
};

/** תלות קאסט – מה שקובע מה אפשר לצלם מתי */
export const DEP_VAR: Record<string, string> = {
  'שחקנים': 'var(--dep-actor)',
  'שחקנים + עובדים': 'var(--dep-both)',
  'עובדים': 'var(--dep-crew)',
  'נציג הנהלה': 'var(--dep-exec)',
  'ביוטי / ללא קאסט': 'var(--dep-beauty)',
  'עובדים / ביוטי': 'var(--dep-crew)',
};

export const DEP_SHORT: Record<string, string> = {
  'שחקנים': 'שחקן',
  'שחקנים + עובדים': 'שחקן+עובדים',
  'עובדים': 'עובדים',
  'נציג הנהלה': 'הנהלה',
  'ביוטי / ללא קאסט': 'ביוטי',
  'עובדים / ביוטי': 'עובדים/ביוטי',
};

export type Production = {
  id: string;
  slug: string;
  name: string;
  sheet_url: string | null;
};

export type Shot = {
  id: string;
  production_id: string;
  seq: number;
  sort_key: number;
  day: string;
  ts: string;
  hotel: string;
  dep: string;
  cluster: string;
  loc: string;
  cat: string;
  vid: string;
  kind: string;
  script: string;
  cast_note: string;
  logistics_client: string;
  logistics_prod: string;
  wardrobe: string;
  notes: string;
  is_break: boolean;
  client_visible: boolean;
};

export type ShotStatus = {
  shot_id: string;
  production_id: string;
  state: ShotState;
  completion_pct: number | null;
  reason: string;
  notes: string;
  ts_override: string;
  updated_at: string;
  updated_by_name: string;
};

/** מה שהלקוח מקבל – 10 עמודות, בלי לוגיסטיקה והערות פנימיות */
export type ClientRow = {
  seq: number;
  day: string;
  ts: string;
  hotel: string;
  loc: string;
  cat: string;
  vid: string;
  script: string;
  is_break: boolean;
  state: ShotState;
};
