// apps/web/src/lib/email-templates.ts

function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getListHtml(items: string[] | null | undefined, containerStyle: string, listStyle: string = ''): string {
  if (!items || !items.length) return '<p style="color:#666; font-style:italic;">None</p>';
  return `<ul style="${containerStyle}">
    ${items.map(item => `<li style="${listStyle}">${escapeHtml(item)}</li>`).join('')}
  </ul>`;
}

export function renderProfessional(report: any, senderName: string): string {
  const completedHtml = getListHtml(report.completedItems, 'margin-top: 8px;');
  const inProgressHtml = getListHtml(report.inProgressItems, 'margin-top: 8px;');
  
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 20px;">
    <h1 style="color: #1e40af; margin: 0 0 10px 0; font-size: 24px;">Daily EOD Report</h1>
    <p style="margin: 0; color: #64748b; font-size: 14px;">Date: ${report.reportDate} | From: ${escapeHtml(senderName)}</p>
  </div>
  ${report.summary ? `
  <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
    <h2 style="font-size: 16px; margin: 0 0 8px 0; color: #0f172a;">Summary</h2>
    <p style="margin: 0; font-size: 14px; line-height: 1.5;">${escapeHtml(report.summary)}</p>
  </div>` : ''}
  <div style="margin-bottom: 20px;">
    <h2 style="font-size: 16px; color: #166534; border-bottom: 1px solid #bbf7d0; padding-bottom: 5px;">âœ… Completed</h2>
    ${completedHtml}
  </div>
  ${report.inProgressItems?.length ? `
  <div style="margin-bottom: 20px;">
    <h2 style="font-size: 16px; color: #854d0e; border-bottom: 1px solid #fef08a; padding-bottom: 5px;">â ³ In Progress</h2>
    ${inProgressHtml}
  </div>` : ''}
  ${report.blockers ? `
  <div style="margin-bottom: 20px;">
    <h2 style="font-size: 16px; color: #991b1b; border-bottom: 1px solid #fecaca; padding-bottom: 5px;">â›” Blockers</h2>
    <p style="margin: 8px 0 0 0; color: #b91c1c;">${escapeHtml(report.blockers)}</p>
  </div>` : ''}
  ${report.tomorrowPlan ? `
  <div style="margin-bottom: 20px;">
    <h2 style="font-size: 16px; color: #3730a3; border-bottom: 1px solid #c7d2fe; padding-bottom: 5px;">ðŸ“… Plan for Tomorrow</h2>
    <p style="margin: 8px 0 0 0;">${escapeHtml(report.tomorrowPlan)}</p>
  </div>` : ''}
</body>
</html>`;
}

export function renderMinimalist(report: any, senderName: string): string {
  const completedHtml = getListHtml(report.completedItems, 'margin: 8px 0 0 0; padding-left: 20px;', 'margin-bottom: 4px;');
  const inProgressHtml = getListHtml(report.inProgressItems, 'margin: 8px 0 0 0; padding-left: 20px;', 'margin-bottom: 4px;');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Inter', -apple-system, sans-serif; max-width: 500px; margin: 40px auto; padding: 0 20px; color: #111; line-height: 1.5;">
  <div style="border-bottom: 1px solid #000; padding-bottom: 12px; margin-bottom: 24px;">
    <h1 style="font-size: 18px; margin: 0 0 4px 0; font-weight: 600;">EOD Update</h1>
    <div style="font-size: 13px; color: #666;">
      <span>${report.reportDate}</span>
      <span style="margin: 0 8px;">â€¢</span>
      <span>${escapeHtml(senderName)}</span>
    </div>
  </div>
  ${report.summary ? `<p style="font-size: 14px; margin-bottom: 24px;">${escapeHtml(report.summary)}</p>` : ''}
  <div style="margin-bottom: 24px;">
    <strong style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Completed</strong>
    ${completedHtml}
  </div>
  ${report.inProgressItems?.length ? `
  <div style="margin-bottom: 24px;">
    <strong style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">In Progress</strong>
    ${inProgressHtml}
  </div>` : ''}
  ${report.blockers ? `
  <div style="margin-bottom: 24px;">
    <strong style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #dc2626;">Blockers</strong>
    <p style="margin: 8px 0 0 0; font-size: 14px;">${escapeHtml(report.blockers)}</p>
  </div>` : ''}
  ${report.tomorrowPlan ? `
  <div style="margin-bottom: 24px;">
    <strong style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Next</strong>
    <p style="margin: 8px 0 0 0; font-size: 14px;">${escapeHtml(report.tomorrowPlan)}</p>
  </div>` : ''}
</body>
</html>`;
}

export function renderModern(report: any, senderName: string): string {
  const completedHtml = getListHtml(report.completedItems, 'margin:12px 0 0 0; padding:0; list-style:none;', 'margin-bottom:8px; padding-left:16px; border-left:3px solid #22c55e;');
  const inProgressHtml = getListHtml(report.inProgressItems, 'margin:12px 0 0 0; padding:0; list-style:none;', 'margin-bottom:8px; padding-left:16px; border-left:3px solid #eab308;');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width:600px; margin:0 auto; padding:24px; color:#1f2937; background:#f9fafb;">
  <div style="background:#fff; border-radius:12px; padding:32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
    <div style="text-align:center; margin-bottom:32px;">
      <div style="display:inline-block; background:#111827; color:#fff; padding:6px 12px; border-radius:20px; font-size:12px; font-weight:600; letter-spacing:1px; margin-bottom:12px;">DAILY REPORT</div>
      <h1 style="margin:0 0 8px 0; font-size:24px; color:#111827;">${report.reportDate}</h1>
      <p style="margin:0; color:#6b7280; font-size:14px;">By ${escapeHtml(senderName)}</p>
    </div>
    ${report.summary ? `
    <div style="background:#f3f4f6; padding:20px; border-radius:8px; margin-bottom:32px;">
      <p style="margin:0; font-size:15px; line-height:1.6; color:#444;">${escapeHtml(report.summary)}</p>
    </div>` : ''}
    <div style="margin-bottom:24px;">
      <span style="background:#dcfce7; color:#166534; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:700;">Completed</span>
      ${completedHtml}
    </div>
    ${report.inProgressItems?.length ? `
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
  </div>
</body>
</html>`;
}

export function renderExecutive(report: any, senderName: string): string {
  const completedHtml = getListHtml(report.completedItems, 'margin:4px 0;', 'margin:8px 0;padding-left:16px;color:#333;');
  const inProgressHtml = getListHtml(report.inProgressItems, 'margin:4px 0;', 'margin:8px 0;padding-left:16px;color:#333;');

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
        <div style="font-size:14px;">${report.inProgressItems?.length ? inProgressHtml : '<p style="color:#666;margin:0;">None</p>'}</div>
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

export function renderCreative(report: any, senderName: string): string {
  const completedHtml = getListHtml(report.completedItems, 'margin:8px 0; padding-left:10px; border-left:2px solid #8b5cf6;', 'list-style:none; padding:0; margin:12px 0;');
  const inProgressHtml = getListHtml(report.inProgressItems, 'margin:8px 0; padding-left:10px; border-left:2px solid #3b82f6;', 'list-style:none; padding:0; margin:12px 0;');

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
      <span style="font-size:24px; margin-right:8px;">âš¡</span> Wins Today
    </h2>
    ${completedHtml}
  </div>
  ${report.inProgressItems?.length ? `
  <div style="margin-bottom:32px;">
    <h2 style="font-size:20px; color:#111; margin:0 0 16px; display:flex; align-items:center;">
      <span style="font-size:24px; margin-right:8px;">ðŸ”¥</span> Cooking Up
    </h2>
    ${inProgressHtml}
  </div>` : ''}
  ${report.blockers ? `
  <div style="margin-bottom:32px; background:#fef2f2; padding:20px; border-radius:12px;">
    <h2 style="font-size:20px; color:#991b1b; margin:0 0 8px; display:flex; align-items:center;">
      <span style="font-size:24px; margin-right:8px;">ðŸ›‘</span> Roadblocks
    </h2>
    <p style="margin:0; font-size:15px; color:#7f1d1d;">${escapeHtml(report.blockers)}</p>
  </div>` : ''}
  ${report.tomorrowPlan ? `
  <div style="margin-bottom:32px;">
    <h2 style="font-size:20px; color:#111; margin:0 0 8px; display:flex; align-items:center;">
      <span style="font-size:24px; margin-right:8px;">ðŸŽ¯</span> Up Next
    </h2>
    <p style="margin:0; font-size:15px; color:#4b5563;">${escapeHtml(report.tomorrowPlan)}</p>
  </div>` : ''}
</body>
</html>`;
}

export function renderQwintsoft(report: any, senderName: string): string {
  const formatList = (items: string[] | null | undefined) => {
    if (!items || !items.length) return 'None';
    return items.map((i: string) => `• ${escapeHtml(i)}`).join('\n');
  };

  const completed = formatList(report.completedItems);
  const inProgress = formatList(report.inProgressItems);
  const issues = report.blockers ? escapeHtml(report.blockers) : 'No issues.';
  const tomorrow = report.tomorrowPlan ? escapeHtml(report.tomorrowPlan) : 'None';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; font-size: 14px; color: #000; line-height: 1.5; white-space: pre-wrap;">Hi Sir,

${report.summary ? escapeHtml(report.summary) + '\n\n' : ''}Today I completed:
${completed}

Currently working on:
${inProgress}

Any issues:
${issues}

Plan for tomorrow:
${tomorrow}

Thanks,
${escapeHtml(senderName)}

---
Mail sent through AutoEOD</body>
</html>`;
}
