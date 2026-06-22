// apps/worker/src/lib/email.ts
// Re-export email functions needed by the worker
// (Minimal version — just the reminder; actual report sending is handled by the API)

import { Resend } from 'resend';

let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY not set');
    resend = new Resend(apiKey);
  }
  return resend;
}

export async function sendReminderEmail(to: string, reportDate: string, reportUrl: string): Promise<void> {
  const client = getResend();
  const from = process.env.EMAIL_FROM || 'AutoEOD <onboarding@resend.dev>';

  await client.emails.send({
    from,
    to: [to],
    subject: `Your EOD report for ${reportDate} is ready`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="margin:0 0 16px;font-size:18px;">Your EOD report is ready 📋</h2>
        <p style="margin:0 0 24px;color:#555;">Your daily EOD report for <strong>${reportDate}</strong> has been generated from your GitHub activity. Review it, make any edits, and send it to your manager.</p>
        <a href="${reportUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:500;font-size:15px;">Review & Send Report →</a>
        <p style="margin:24px 0 0;font-size:12px;color:#999;">Sent by AutoEOD</p>
      </div>
    `,
  });
}
