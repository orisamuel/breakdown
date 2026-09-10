'use client';

import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function SignOut() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        router.replace('/login');
      }}
      className="tap chip"
      title="התנתקות"
      aria-label="התנתקות"
      style={{
        background: 'var(--surface)',
        color: 'var(--ink-2)',
        minHeight: 40,
        padding: '0 12px',
        cursor: 'pointer',
        fontSize: 14,
      }}
    >
      ⏏
    </button>
  );
}
