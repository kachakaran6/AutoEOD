// apps/worker/src/lib/email.ts
import { EmailProviderService } from './email-provider';

export async function sendReminderEmail(userId: string, to: string, reportDate: string, reportUrl: string): Promise<void> {
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="margin:0 0 16px;font-size:18px;">Your EOD report is ready 📋</h2>
      <p style="margin:0 0 24px;color:#555;">Your daily EOD report for <strong>${reportDate}</strong> has been generated from your activity. Review it, make any edits, and send it to your manager.</p>
      <a href="${reportUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:500;font-size:15px;">Review & Send Report →</a>
      <p style="margin:24px 0 0;font-size:12px;color:#999;">Sent by AutoEOD</p>
    </div>
  `;

  try {
    const emailService = new EmailProviderService(userId);
    await emailService.sendEmail({
      to,
      subject: `Your EOD report for ${reportDate} is ready`,
      html,
    });
  } catch (err) {
    // If not configured, skip reminder silently just like before
  }
}

import type { Report } from '@autoeod/db';

interface SendReportOptions {
  report: Report;
  senderName: string;
  managerEmail: string;
  ccEmails?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderReportHtml(report: Report, senderName: string): string {
  const completedItems = (report.completedItems as string[]) || [];
  const inProgressItems = (report.inProgressItems as string[]) || [];

  const completedHtml = completedItems.length
    ? `<ul style="margin:8px 0;padding-left:20px;">${completedItems.map((i) => `<li style="margin:4px 0;">${escapeHtml(i)}</li>`).join('')}</ul>`
    : '<p style="color:#666;margin:4px 0;">None</p>';

  const inProgressHtml = inProgressItems.length
    ? `<ul style="margin:8px 0;padding-left:20px;">${inProgressItems.map((i) => `<li style="margin:4px 0;">${escapeHtml(i)}</li>`).join('')}</ul>`
    : '<p style="color:#666;margin:4px 0;">None</p>';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>EOD Report — ${report.reportDate}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width:640px; margin:0 auto; padding:24px; color:#111;">
  <h2 style="margin:0 0 4px;font-size:18px;font-weight:600;">EOD Report — ${report.reportDate}</h2>
  <p style="margin:0 0 24px;color:#555;font-size:14px;">From: ${escapeHtml(senderName)}</p>

  ${
    report.summary
      ? `<div style="background:#f5f5f5;border-radius:6px;padding:12px 16px;margin-bottom:20px;">
    <p style="margin:0;font-size:15px;line-height:1.6;">${escapeHtml(report.summary)}</p>
  </div>`
      : ''
  }

  <h3 style="font-size:14px;font-weight:600;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.5px;color:#333;">✅ Completed Today</h3>
  ${completedHtml}

  ${
    inProgressItems.length
      ? `<h3 style="font-size:14px;font-weight:600;margin:16px 0 6px;text-transform:uppercase;letter-spacing:0.5px;color:#333;">🔄 In Progress</h3>
  ${inProgressHtml}`
      : ''
  }

  ${
    report.blockers
      ? `<h3 style="font-size:14px;font-weight:600;margin:16px 0 6px;text-transform:uppercase;letter-spacing:0.5px;color:#333;">🚧 Blockers</h3>
  <p style="margin:4px 0;">${escapeHtml(report.blockers)}</p>`
      : ''
  }

  ${
    report.tomorrowPlan
      ? `<h3 style="font-size:14px;font-weight:600;margin:16px 0 6px;text-transform:uppercase;letter-spacing:0.5px;color:#333;">📅 Tomorrow's Plan</h3>
  <p style="margin:4px 0;">${escapeHtml(report.tomorrowPlan)}</p>`
      : ''
  }

  <hr style="margin:24px 0;border:none;border-top:1px solid #e5e5e5;">
  <p style="font-size:12px;color:#999;margin:0;">Sent via AutoEOD</p>
</body>
</html>`;
}

export async function sendReportEmail({
  report,
  senderName,
  managerEmail,
  ccEmails,
}: SendReportOptions): Promise<void> {
  const cc = ccEmails ? ccEmails.split(',').map((e) => e.trim()).filter(Boolean) : undefined;
  const html = renderReportHtml(report, senderName);

  const emailService = new EmailProviderService(report.userId);
  await emailService.sendEmail({
    to: managerEmail,
    cc,
    subject: `EOD Report — ${report.reportDate} — ${senderName}`,
    html,
    senderName,
  });
}
