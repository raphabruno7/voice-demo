// app/status/page.tsx
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type Row = {
  service: string;
  status: 'ok' | 'degraded' | 'fail';
  latency_ms: number | null;
  error_msg: string | null;
  checked_at: string;
};

const ICON = { ok: '✅', degraded: '⚠️', fail: '❌' } as const;
const COLOUR = { ok: '#16a34a', degraded: '#d97706', fail: '#dc2626' } as const;

async function getLatest(): Promise<Row[]> {
  const db = getSupabaseAdmin();
  // Último resultado por serviço
  const { data } = await db
    .from('health_checks')
    .select('service, status, latency_ms, error_msg, checked_at')
    .order('checked_at', { ascending: false })
    .limit(100);

  if (!data) return [];

  const seen = new Set<string>();
  return data.filter((r: Row) => {
    if (seen.has(r.service)) return false;
    seen.add(r.service);
    return true;
  });
}

async function getHistory(): Promise<{ service: string; ok: number; total: number }[]> {
  const db = getSupabaseAdmin();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await db
    .from('health_checks')
    .select('service, status')
    .gte('checked_at', since);

  if (!data) return [];

  const map = new Map<string, { ok: number; total: number }>();
  for (const r of data as Pick<Row, 'service' | 'status'>[]) {
    const cur = map.get(r.service) ?? { ok: 0, total: 0 };
    cur.total++;
    if (r.status === 'ok') cur.ok++;
    map.set(r.service, cur);
  }
  return Array.from(map.entries()).map(([service, v]) => ({ service, ...v }));
}

export default async function StatusPage() {
  const [latest, history] = await Promise.all([getLatest(), getHistory()]);
  const historyMap = new Map(history.map((h) => [h.service, h]));
  const lastChecked = latest[0]?.checked_at
    ? new Date(latest[0].checked_at).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })
    : '—';
  const allOk = latest.every((r) => r.status === 'ok');

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 860, margin: '40px auto', padding: '0 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1e3a5f' }}>
          {allOk ? '🟢' : '🔴'} Voice Demo — Health Status
        </h1>
        <form action="/api/status/logout" method="POST">
          <button type="submit" style={{ fontSize: 13, color: '#666', background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}>
            Logout
          </button>
        </form>
      </div>
      <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 32 }}>
        Último check: {lastChecked} (Europe/Lisbon)
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: '#f9fafb' }}>
            {['Serviço', 'Estado', 'Latência', 'Erro', 'Últimos 30 dias'].map((h) => (
              <th key={h} style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontWeight: 600, color: '#374151' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {latest.map((row) => {
            const h = historyMap.get(row.service);
            const pct = h ? Math.round((h.ok / h.total) * 100) : null;
            return (
              <tr key={row.service} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 14px', fontWeight: 500 }}>{row.service}</td>
                <td style={{ padding: '10px 14px', color: COLOUR[row.status] }}>
                  {ICON[row.status]} {row.status}
                </td>
                <td style={{ padding: '10px 14px', color: '#6b7280' }}>
                  {row.latency_ms != null ? `${row.latency_ms}ms` : '—'}
                </td>
                <td style={{ padding: '10px 14px', color: '#9ca3af', fontSize: 12 }}>
                  {row.error_msg ?? '—'}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  {pct != null ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: pct > 90 ? '#16a34a' : pct > 70 ? '#d97706' : '#dc2626', borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{pct}% ({h!.total}d)</span>
                    </div>
                  ) : '—'}
                </td>
              </tr>
            );
          })}
          {latest.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: '24px 14px', textAlign: 'center', color: '#9ca3af' }}>
                Sem dados — corre o cron pela primeira vez.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
