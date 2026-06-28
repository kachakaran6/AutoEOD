// apps/worker/src/lib/email.ts
import { EmailProviderService } from './email-provider';
import type { Report } from '@autoeod/db';

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
    // If not configured, skip reminder silently
  }
}

interface SendReportOptions {
  report: Report;
  senderName: string;
  managerEmail: string;
  ccEmails?: string;
  template?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ==========================================
// EMAIL TEMPLATES
// ==========================================

function getListHtml(items: string[], bulletStyle: string = 'margin:4px 0;', listStyle: string = 'margin:8px 0;padding-left:20px;'): string {
  if (!items || !items.length) return '<p style="color:#666;margin:4px 0;">None</p>';
  return `<ul style="${listStyle}">${items.map((i) => `<li style="${bulletStyle}">${escapeHtml(i)}</li>`).join('')}</ul>`;
}

// 1. Professional (Default)
function renderProfessional(report: Report, senderName: string): string {
  const completedHtml = getListHtml(report.completedItems as string[]);
  const inProgressHtml = getListHtml(report.inProgressItems as string[]);

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>EOD Report — ${report.reportDate}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width:640px; margin:0 auto; padding:24px; color:#111;">
  <h2 style="margin:0 0 4px;font-size:18px;font-weight:600;">EOD Report — ${report.reportDate}</h2>
  <p style="margin:0 0 24px;color:#555;font-size:14px;">From: ${escapeHtml(senderName)}</p>

  ${report.summary ? `
  <div style="background:#f5f5f5;border-radius:6px;padding:12px 16px;margin-bottom:20px;">
    <p style="margin:0;font-size:15px;line-height:1.6;">${escapeHtml(report.summary)}</p>
  </div>` : ''}

  <h3 style="font-size:14px;font-weight:600;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.5px;color:#333;">✅ Completed Today</h3>
  ${completedHtml}

  ${(report.inProgressItems as string[])?.length ? `
  <h3 style="font-size:14px;font-weight:600;margin:16px 0 6px;text-transform:uppercase;letter-spacing:0.5px;color:#333;">🔄 In Progress</h3>
  ${inProgressHtml}` : ''}

  ${report.blockers ? `
  <h3 style="font-size:14px;font-weight:600;margin:16px 0 6px;text-transform:uppercase;letter-spacing:0.5px;color:#333;">🚧 Blockers</h3>
  <p style="margin:4px 0;">${escapeHtml(report.blockers)}</p>` : ''}

  ${report.tomorrowPlan ? `
  <h3 style="font-size:14px;font-weight:600;margin:16px 0 6px;text-transform:uppercase;letter-spacing:0.5px;color:#333;">📅 Tomorrow's Plan</h3>
  <p style="margin:4px 0;">${escapeHtml(report.tomorrowPlan)}</p>` : ''}

  <hr style="margin:24px 0;border:none;border-top:1px solid #e5e5e5;">
  <p style="font-size:12px;color:#999;margin:0;">Sent via AutoEOD</p>
</body>
</html>`;
}

// 2. Minimalist
function renderMinimalist(report: Report, senderName: string): string {
  const completedHtml = getListHtml(report.completedItems as string[], 'margin:6px 0;line-height:1.5;');
  const inProgressHtml = getListHtml(report.inProgressItems as string[], 'margin:6px 0;line-height:1.5;');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width:600px; margin:0 auto; padding:40px 20px; color:#000;">
  <div style="border-bottom: 1px solid #000; padding-bottom: 20px; margin-bottom: 30px;">
    <h1 style="font-size:24px; font-weight:400; margin:0 0 8px 0; letter-spacing:-0.5px;">End of Day Report</h1>
    <div style="font-size:14px; color:#666;">
      <strong>${escapeHtml(senderName)}</strong> • ${report.reportDate}
    </div>
  </div>

  ${report.summary ? `<p style="font-size:16px; line-height:1.6; margin-bottom:30px;">${escapeHtml(report.summary)}</p>` : ''}

  <h2 style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:1px; margin:0 0 10px 0;">Completed</h2>
  <div style="margin-bottom:24px; font-size:15px;">${completedHtml}</div>

  ${(report.inProgressItems as string[])?.length ? `
  <h2 style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:1px; margin:0 0 10px 0;">In Progress</h2>
  <div style="margin-bottom:24px; font-size:15px;">${inProgressHtml}</div>` : ''}

  ${report.blockers ? `
  <h2 style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:1px; margin:0 0 10px 0;">Blockers</h2>
  <p style="font-size:15px; margin-bottom:24px;">${escapeHtml(report.blockers)}</p>` : ''}

  ${report.tomorrowPlan ? `
  <h2 style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:1px; margin:0 0 10px 0;">Tomorrow</h2>
  <p style="font-size:15px; margin-bottom:24px;">${escapeHtml(report.tomorrowPlan)}</p>` : ''}
</body>
</html>`;
}

// 3. Modern
function renderModern(report: Report, senderName: string): string {
  const completedHtml = getListHtml(report.completedItems as string[], 'margin:8px 0; background:#fff; padding:10px 14px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.05); border:1px solid #eaeaea;', 'list-style:none; padding:0; margin:12px 0;');
  const inProgressHtml = getListHtml(report.inProgressItems as string[], 'margin:8px 0; background:#fff; padding:10px 14px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.05); border:1px solid #eaeaea;', 'list-style:none; padding:0; margin:12px 0;');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, system-ui, sans-serif; max-width:640px; margin:0 auto; padding:32px 20px; color:#1a1a1a; background-color:#fafafa;">
  
  <div style="text-align:center; margin-bottom:32px;">
    <div style="display:inline-block; background:#1a1a1a; color:#fff; padding:6px 12px; border-radius:20px; font-size:12px; font-weight:600; margin-bottom:16px;">EOD Update</div>
    <h1 style="margin:0 0 8px; font-size:28px; font-weight:800;">${report.reportDate}</h1>
    <p style="margin:0; color:#666; font-size:15px;">Prepared by ${escapeHtml(senderName)}</p>
  </div>

  ${report.summary ? `
  <div style="background:#fff; border-radius:12px; padding:20px; margin-bottom:24px; box-shadow:0 4px 6px rgba(0,0,0,0.02); border:1px solid #f0f0f0;">
    <p style="margin:0; font-size:15px; line-height:1.6; color:#444;">${escapeHtml(report.summary)}</p>
  </div>` : ''}

  <div style="margin-bottom:24px;">
    <span style="background:#dcfce7; color:#166534; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:700;">Completed</span>
    ${completedHtml}
  </div>

  ${(report.inProgressItems as string[])?.length ? `
  <div style="margin-bottom:24px;">
    <span style="background:#fef3c7; color:#92400e; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:700;">In Progress</span>
    ${inProgressHtml}
  </div>` : ''}

  ${report.blockers ? `
  <div style="margin-bottom:24px;">
    <span style="background:#fee2e2; color:#991b1b; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:700;">Blockers</span>
    <div style="background:#fff; padding:16px; border-radius:8px; margin-top:12px; border:1px solid #fecaca; border-left:4px solid #ef4444;">
      <p style="margin:0; font-size:14px;">${escapeHtml(report.blockers)}</p>
    </div>
  </div>` : ''}

  ${report.tomorrowPlan ? `
  <div style="margin-bottom:24px;">
    <span style="background:#e0e7ff; color:#3730a3; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:700;">Tomorrow</span>
    <div style="background:#fff; padding:16px; border-radius:8px; margin-top:12px; border:1px solid #e0e7ff; border-left:4px solid #6366f1;">
      <p style="margin:0; font-size:14px;">${escapeHtml(report.tomorrowPlan)}</p>
    </div>
  </div>` : ''}

</body>
</html>`;
}

// 4. Executive
function renderExecutive(report: Report, senderName: string): string {
  const completedHtml = getListHtml(report.completedItems as string[], 'margin:4px 0;', 'margin:8px 0;padding-left:16px;color:#333;');
  const inProgressHtml = getListHtml(report.inProgressItems as string[], 'margin:4px 0;', 'margin:8px 0;padding-left:16px;color:#333;');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Georgia, 'Times New Roman', Times, serif; max-width:650px; margin:0 auto; padding:30px; color:#111; line-height:1.6;">
  <div style="border-bottom: 2px solid #1e3a8a; padding-bottom: 15px; margin-bottom: 25px;">
    <h1 style="color:#1e3a8a; margin:0 0 5px 0; font-size:22px; font-weight:normal;">STATUS REPORT</h1>
    <table style="width:100%; font-size:14px; color:#555;">
      <tr>
        <td style="width:50%;"><strong>DATE:</strong> ${report.reportDate}</td>
        <td style="width:50%; text-align:right;"><strong>SUBMITTED BY:</strong> ${escapeHtml(senderName)}</td>
      </tr>
    </table>
  </div>

  ${report.summary ? `
  <h2 style="font-size:14px; color:#1e3a8a; margin:0 0 8px 0; font-weight:bold;">EXECUTIVE SUMMARY</h2>
  <p style="margin:0 0 20px 0; font-size:15px;">${escapeHtml(report.summary)}</p>` : ''}

  <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
    <tr>
      <td style="width:50%; vertical-align:top; padding-right:15px;">
        <h2 style="font-size:14px; color:#1e3a8a; border-bottom:1px solid #e5e7eb; padding-bottom:5px; margin:0 0 10px 0; font-weight:bold;">KEY ACCOMPLISHMENTS</h2>
        <div style="font-size:14px;">${completedHtml}</div>
      </td>
      <td style="width:50%; vertical-align:top; padding-left:15px; border-left:1px solid #e5e7eb;">
        <h2 style="font-size:14px; color:#1e3a8a; border-bottom:1px solid #e5e7eb; padding-bottom:5px; margin:0 0 10px 0; font-weight:bold;">ACTIVE INITIATIVES</h2>
        <div style="font-size:14px;">${(report.inProgressItems as string[])?.length ? inProgressHtml : '<p style="color:#666;margin:0;">None</p>'}</div>
      </td>
    </tr>
  </table>

  ${report.blockers ? `
  <h2 style="font-size:14px; color:#b91c1c; margin:0 0 8px 0; font-weight:bold;">RISKS & BLOCKERS</h2>
  <p style="margin:0 0 20px 0; font-size:14px;">${escapeHtml(report.blockers)}</p>` : ''}

  ${report.tomorrowPlan ? `
  <h2 style="font-size:14px; color:#1e3a8a; margin:0 0 8px 0; font-weight:bold;">NEXT STEPS</h2>
  <p style="margin:0 0 20px 0; font-size:14px;">${escapeHtml(report.tomorrowPlan)}</p>` : ''}
</body>
</html>`;
}

// 5. Creative
function renderCreative(report: Report, senderName: string): string {
  const completedHtml = getListHtml(report.completedItems as string[], 'margin:8px 0; padding-left:10px; border-left:2px solid #8b5cf6;', 'list-style:none; padding:0; margin:12px 0;');
  const inProgressHtml = getListHtml(report.inProgressItems as string[], 'margin:8px 0; padding-left:10px; border-left:2px solid #3b82f6;', 'list-style:none; padding:0; margin:12px 0;');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Outfit', -apple-system, sans-serif; max-width:600px; margin:0 auto; padding:40px 20px; color:#333;">
  
  <div style="background: linear-gradient(135deg, #a855f7 0%, #3b82f6 100%); border-radius: 16px; padding: 32px; color: white; margin-bottom: 32px; box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.5);">
    <p style="margin:0 0 8px; opacity:0.8; font-size:14px; text-transform:uppercase; letter-spacing:2px;">Daily Wrap-up</p>
    <h1 style="margin:0 0 16px; font-size:32px; font-weight:800; letter-spacing:-1px;">${report.reportDate}</h1>
    <div style="display:inline-block; background:rgba(255,255,255,0.2); backdrop-filter:blur(4px); padding:6px 12px; border-radius:20px; font-size:13px;">
      By <strong>${escapeHtml(senderName)}</strong>
    </div>
  </div>

  ${report.summary ? `
  <p style="font-size:17px; line-height:1.7; color:#4b5563; margin-bottom:32px; font-weight:400;">
    ${escapeHtml(report.summary)}
  </p>` : ''}

  <div style="margin-bottom:32px;">
    <h2 style="font-size:20px; color:#111; margin:0 0 16px; display:flex; align-items:center;">
      <span style="font-size:24px; margin-right:8px;">🚀</span> Wins Today
    </h2>
    ${completedHtml}
  </div>

  ${(report.inProgressItems as string[])?.length ? `
  <div style="margin-bottom:32px;">
    <h2 style="font-size:20px; color:#111; margin:0 0 16px; display:flex; align-items:center;">
      <span style="font-size:24px; margin-right:8px;">🔥</span> Cooking Up
    </h2>
    ${inProgressHtml}
  </div>` : ''}

  ${report.blockers ? `
  <div style="margin-bottom:32px; background:#fef2f2; padding:20px; border-radius:12px;">
    <h2 style="font-size:20px; color:#991b1b; margin:0 0 8px; display:flex; align-items:center;">
      <span style="font-size:24px; margin-right:8px;">🛑</span> Roadblocks
    </h2>
    <p style="margin:0; font-size:15px; color:#7f1d1d;">${escapeHtml(report.blockers)}</p>
  </div>` : ''}

  ${report.tomorrowPlan ? `
  <div style="margin-bottom:32px;">
    <h2 style="font-size:20px; color:#111; margin:0 0 8px; display:flex; align-items:center;">
      <span style="font-size:24px; margin-right:8px;">🎯</span> Up Next
    </h2>
    <p style="margin:0; font-size:15px; color:#4b5563;">${escapeHtml(report.tomorrowPlan)}</p>
  </div>` : ''}
</body>
</html>`;
}


export async function sendReportEmail({
  report,
  senderName,
  managerEmail,
  ccEmails,
  template = 'professional',
}: SendReportOptions): Promise<void> {
  const cc = ccEmails ? ccEmails.split(',').map((e) => e.trim()).filter(Boolean) : undefined;
  
  let html = '';
  switch (template.toLowerCase()) {
    case 'minimalist':
      html = renderMinimalist(report, senderName);
      break;
    case 'modern':
      html = renderModern(report, senderName);
      break;
    case 'executive':
      html = renderExecutive(report, senderName);
      break;
    case 'creative':
      html = renderCreative(report, senderName);
      break;
    case 'professional':
    default:
      html = renderProfessional(report, senderName);
      break;
  }

  const emailService = new EmailProviderService(report.userId);
  await emailService.sendEmail({
    to: managerEmail,
    cc,
    subject: `EOD Report — ${report.reportDate} — ${senderName}`,
    html,
    senderName,
  });
}
