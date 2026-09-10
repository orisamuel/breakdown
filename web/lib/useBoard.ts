'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { Shot, ShotStatus, ShotState } from '@/lib/types';

export type StatusPatch = Partial<
  Pick<ShotStatus, 'state' | 'completion_pct' | 'reason' | 'notes' | 'ts_override'>
>;

export type SyncState = 'idle' | 'syncing' | 'ok' | 'queued' | 'offline' | 'error';

type Queue = Record<string, StatusPatch>;

/**
 * מנוע הלוח.
 *
 * שני שיעורים מהגרסה הקודמת מובנים כאן מראש:
 *   1. לא דוחפים מצב מלא. כל סטטוס הוא שורה משלו, וכותבים רק אותה –
 *      כך שני מכשירים לא יכולים לדרוס אחד את השני.
 *   2. תור כתיבה שנשמר ב-localStorage. בחוף באילת הקליטה תיפול, וזה
 *      חייב לשרוד רענון ולא רק להישאר בזיכרון.
 */
export function useBoard(productionId: string, initialShots: Shot[], initialStatus: ShotStatus[]) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const QKEY = `bd-queue-${productionId}`;

  const [shots, setShots] = useState<Shot[]>(initialShots);
  const [status, setStatus] = useState<Record<string, ShotStatus>>(() => {
    const m: Record<string, ShotStatus> = {};
    for (const s of initialStatus) m[s.shot_id] = s;
    return m;
  });
  const [sync, setSync] = useState<SyncState>('idle');
  const [queued, setQueued] = useState(0);
  const [actor, setActor] = useState('');

  const queue = useRef<Queue>({});
  const inflight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- טעינת התור מהדיסק, כדי שסימון ישרוד רענון וניתוק ----
  useEffect(() => {
    try {
      const raw = localStorage.getItem(QKEY);
      if (raw) {
        queue.current = JSON.parse(raw) as Queue;
        setQueued(Object.keys(queue.current).length);
      }
    } catch {
      /* noop */
    }
  }, [QKEY]);

  const persist = useCallback(() => {
    const n = Object.keys(queue.current).length;
    setQueued(n);
    try {
      if (n) localStorage.setItem(QKEY, JSON.stringify(queue.current));
      else localStorage.removeItem(QKEY);
    } catch {
      /* noop */
    }
  }, [QKEY]);

  useEffect(() => {
    sb.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (u) setActor(u.email?.split('@')[0] ?? '');
    });
  }, [sb]);

  // ---- שליחת התור ----
  const flush = useCallback(async () => {
    if (inflight.current) return;
    const batch = queue.current;
    const ids = Object.keys(batch);
    if (!ids.length) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSync('offline');
      return;
    }

    queue.current = {};
    persist();
    inflight.current = true;
    setSync('syncing');

    const rows = ids.map((shot_id) => ({
      shot_id,
      production_id: productionId,
      ...batch[shot_id],
      updated_at: new Date().toISOString(),
      updated_by_name: actor,
    }));

    const { error } = await sb.from('shot_status').upsert(rows, { onConflict: 'shot_id' });
    inflight.current = false;

    if (error) {
      // מחזירים לתור; מה שנוסף בזמן הבקשה גובר
      const newer = queue.current;
      queue.current = { ...batch, ...newer };
      persist();
      setSync(navigator.onLine ? 'error' : 'offline');
      return;
    }

    setSync(Object.keys(queue.current).length ? 'queued' : 'ok');
    if (Object.keys(queue.current).length) void flush();
  }, [sb, productionId, actor, persist]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 900);
  }, [flush]);

  /** סימון: מעדכן מיד את המסך, מוסיף לתור, ומתזמן שליחה */
  const setShotStatus = useCallback(
    (shotId: string, patch: StatusPatch) => {
      queue.current[shotId] = { ...(queue.current[shotId] ?? {}), ...patch };
      persist();
      setStatus((prev) => {
        const cur: ShotStatus | undefined = prev[shotId];
        const base: ShotStatus = cur ?? {
          shot_id: shotId,
          production_id: productionId,
          state: 'pending',
          completion_pct: null,
          reason: '',
          notes: '',
          ts_override: '',
          updated_at: '',
          updated_by_name: '',
        };
        const next: ShotStatus = {
          ...base,
          ...patch,
          updated_at: new Date().toISOString(),
          updated_by_name: actor,
        };
        return { ...prev, [shotId]: next };
      });
      schedule();
    },
    [productionId, actor, persist, schedule],
  );

  // ---- realtime: שינוי ממכשיר אחר מגיע מיד, בלי פולינג ----
  useEffect(() => {
    let ch: RealtimeChannel | null = null;
    ch = sb
      .channel(`board-${productionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shot_status',
          filter: `production_id=eq.${productionId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as ShotStatus | null;
          if (!row?.shot_id) return;
          // לא דורסים סימון מקומי שעוד ממתין בתור
          if (queue.current[row.shot_id]) return;
          setStatus((prev) => {
            if (payload.eventType === 'DELETE') {
              const next = { ...prev };
              delete next[row.shot_id];
              return next;
            }
            return { ...prev, [row.shot_id]: row };
          });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shots', filter: `production_id=eq.${productionId}` },
        () => void reload(),
      )
      .subscribe();
    return () => {
      if (ch) void sb.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb, productionId]);

  const reload = useCallback(async () => {
    const { data } = await sb
      .from('shots')
      .select('*')
      .eq('production_id', productionId)
      .order('sort_key');
    if (data) setShots(data as Shot[]);
  }, [sb, productionId]);

  // ---- חזרה לרשת / חזרה לטאב -> לשלוח מה שממתין ----
  useEffect(() => {
    function onOnline() {
      setSync('syncing');
      void flush();
    }
    function onVisible() {
      if (document.visibilityState === 'visible') void flush();
    }
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', () => setSync('offline'));
    document.addEventListener('visibilitychange', onVisible);
    const iv = setInterval(() => void flush(), 20000);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(iv);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [flush]);

  const stateOf = useCallback(
    (shotId: string): ShotState => status[shotId]?.state ?? 'pending',
    [status],
  );

  const tsOf = useCallback(
    (s: Shot) => status[s.id]?.ts_override || s.ts,
    [status],
  );

  return { shots, status, sync, queued, actor, setShotStatus, stateOf, tsOf, reload, flush };
}
