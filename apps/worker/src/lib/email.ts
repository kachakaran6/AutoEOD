// apps/worker/src/lib/email.ts
import nodemailer from 'nodemailer';
import { prisma } from '@autoeod/db';

import { decrypt } from './crypto';

export async function sendReminderEmail(userId: string, to: string, reportDate: string, reportUrl: string): Promise<void> {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  
  if (!settings || !settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPassEnc) {
    // SMTP not configured, skip reminder
    return;
  }

  const pass = decrypt(settings.smtpPassEnc);
  
  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpPort === 465,
    auth: {
      user: settings.smtpUser,
      pass,
    },
  });

  await transporter.sendMail({
    from: `AutoEOD <${settings.smtpUser}>`,
    to,
    subject: `Your EOD report for ${reportDate} is ready`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="margin:0 0 16px;font-size:18px;">Your EOD report is ready 📋</h2>
        <p style="margin:0 0 24px;color:#555;">Your daily EOD report for <strong>${reportDate}</strong> has been generated from your activity. Review it, make any edits, and send it to your manager.</p>
        <a href="${reportUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:500;font-size:15px;">Review & Send Report →</a>
        <p style="margin:24px 0 0;font-size:12px;color:#999;">Sent by AutoEOD</p>
      </div>
    `,
  });
}
