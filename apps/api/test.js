const MailComposer = require('nodemailer/lib/mail-composer');

async function run() {
  const payload = {
    senderName: 'Test User — AutoEOD',
    senderEmail: 'test@example.com',
    to: 'manager@example.com',
    subject: 'EOD Report — 2026-06-25',
    html: '<p>Completed items: ✅ Tested email generation</p>'
  };

  const mailOptions = {
    from: `"${payload.senderName}" <${payload.senderEmail}>`,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  };
  
  const mail = new MailComposer(mailOptions);
  const mimeNode = mail.compile();
  const rawMessage = await mimeNode.build();

  const encodedMessage = rawMessage
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  console.log("Raw Message Text:\n", rawMessage.toString('utf-8'));
  console.log("\nBase64 URL Encoded:\n", encodedMessage);
}

run().catch(console.error);
