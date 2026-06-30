import { NextRequest, NextResponse } from 'next/server';
import { runAllChecks } from '@/lib/health-checks';
import { sendHealthEmail } from '@/lib/resend';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = await runAllChecks();
  const db = getSupabaseAdmin();

  // Persistir resultados
  await db.from('health_checks').insert(
    results.map((r) => ({
      service: r.service,
      status: r.status,
      latency_ms: r.latency_ms,
      error_msg: r.error_msg ?? null,
    }))
  );

  // Limpar registos com mais de 30 dias
  await db.from('health_checks').delete().lt(
    'checked_at',
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  );

  const hasFail = results.some((r) => r.status === 'fail');
  const emailErrors: string[] = [];

  // Alerta imediato se houver falha
  if (hasFail) {
    try {
      await sendHealthEmail(results, 'alert');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(msg);
      emailErrors.push(msg);
    }
  }

  // Relatório diário sempre
  try {
    await sendHealthEmail(results, 'daily');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(msg);
    emailErrors.push(msg);
  }

  const summary = results.map((r) => ({ service: r.service, status: r.status, latency_ms: r.latency_ms }));
  return NextResponse.json({ ok: true, checked: results.length, hasFail, summary, emailErrors });
}
