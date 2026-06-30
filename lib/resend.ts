import { Resend } from 'resend';

export type HealthStatus = 'ok' | 'degraded' | 'fail';
export interface ServiceCheckResult {
  service: string;
  status: HealthStatus;
  latency_ms: number;
  error_msg?: string;
}

const ICON: Record<HealthStatus, string> = {
  ok: '✅',
  degraded: '⚠️',
  fail: '❌',
};

function buildHtml(results: ServiceCheckResult[], type: 'daily' | 'alert'): string {
  const rows = results
    .map(
      (r) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${r.service}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${ICON[r.status]} ${r.status}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${r.latency_ms ?? '—'}ms</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;font-size:12px">${r.error_msg ?? '—'}</td>
      </tr>`
    )
    .join('');

  const title =
    type === 'alert'
      ? `[ALERTA] Voice Demo — ${results.filter((r) => r.status === 'fail').length} serviço(s) em falha`
      : 'Voice Demo — Relatório de saúde diário';

  return `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto">
      <h2 style="color:${type === 'alert' ? '#dc2626' : '#1e3a5f'}">${title}</h2>
      <p style="color:#666;font-size:14px">Verificado em ${new Date().toISOString()}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="padding:8px 12px;text-align:left">Serviço</th>
            <th style="padding:8px 12px;text-align:left">Estado</th>
            <th style="padding:8px 12px;text-align:left">Latência</th>
            <th style="padding:8px 12px;text-align:left">Erro</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:24px;font-size:13px;color:#888">
        <a href="https://voice-demo-navy.vercel.app/status">Ver dashboard</a>
      </p>
    </div>`;
}

export async function sendHealthEmail(
  results: ServiceCheckResult[],
  type: 'daily' | 'alert'
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[resend] RESEND_API_KEY not set — skipping email');
    return;
  }

  const client = new Resend(apiKey);
  const from = process.env.HEALTH_EMAIL_FROM ?? 'health@raphaelbruno.dev';
  const to = process.env.HEALTH_EMAIL_TO ?? 'work@raphaelbruno.dev';

  const subject =
    type === 'alert'
      ? `[ALERTA] Voice Demo — ${results.filter((r) => r.status === 'fail').length} falha(s)`
      : `Voice Demo — Saúde ${new Date().toLocaleDateString('pt-PT')}`;

  const { error } = await client.emails.send({
    from,
    to,
    subject,
    html: buildHtml(results, type),
  });

  if (error) {
    // ponytail: throw so the cron route surfaces this in Vercel logs
    throw new Error(`[resend] Failed to send ${type} email: ${JSON.stringify(error)}`);
  }
}
