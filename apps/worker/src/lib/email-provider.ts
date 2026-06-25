import { prisma } from '@autoeod/db';
import { decrypt, encrypt } from './crypto';
import { logger } from './logger';
import MailComposer from 'nodemailer/lib/mail-composer';

// Interface matching what we used in the previous setup
export interface EmailPayload {
  to: string;
  cc?: string[];
  subject: string;
  html: string;
  senderName?: string;
  senderEmail?: string;
}

export class EmailProviderService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  public async sendEmail(payload: EmailPayload): Promise<void> {
    const connection = await prisma.emailConnection.findUnique({
      where: { userId: this.userId }
    });

    if (!connection) {
      throw new Error('No email provider connected. Please connect Gmail or Zoho Mail.');
    }

    // Refresh token if expired
    let accessToken = decrypt(connection.accessTokenEnc);
    if (new Date() > connection.expiresAt) {
      accessToken = await this.refreshToken(connection);
    }

    const senderName = payload.senderName || connection.name || 'AutoEOD User';
    const senderEmail = payload.senderEmail || connection.email;
    const to = payload.to;
    const cc = payload.cc && payload.cc.length > 0 ? payload.cc.join(', ') : '';

    if (connection.provider === 'google') {
      await this.sendViaGmail(accessToken, { ...payload, senderName, senderEmail, cc });
    } else if (connection.provider === 'zoho') {
      await this.sendViaZoho(accessToken, { ...payload, senderName, senderEmail, cc });
    } else {
      throw new Error(`Unsupported email provider: ${connection.provider}`);
    }

    // Update lastUsedAt
    await prisma.emailConnection.update({
      where: { id: connection.id },
      data: { lastUsedAt: new Date() }
    });
  }

  private async refreshToken(connection: any): Promise<string> {
    const refreshToken = decrypt(connection.refreshTokenEnc);
    let newAccessToken = '';
    let newExpiresAt = new Date();

    if (connection.provider === 'google') {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        throw new Error('Google OAuth environment variables not configured');
      }

      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      const data = await res.json() as any;
      if (!data.access_token) {
        throw new Error('Failed to refresh Google access token: ' + (data.error_description || data.error || 'Unknown error'));
      }

      newAccessToken = data.access_token;
      newExpiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);

    } else if (connection.provider === 'zoho') {
      const clientId = process.env.ZOHO_CLIENT_ID;
      const clientSecret = process.env.ZOHO_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        throw new Error('Zoho OAuth environment variables not configured');
      }

      const res = await fetch('https://accounts.zoho.com/oauth/v2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
        }),
      });

      const data = await res.json() as any;
      if (!data.access_token) {
        throw new Error('Failed to refresh Zoho access token: ' + (data.error || 'Unknown error'));
      }

      newAccessToken = data.access_token;
      newExpiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);
    }

    await prisma.emailConnection.update({
      where: { id: connection.id },
      data: {
        accessTokenEnc: encrypt(newAccessToken),
        expiresAt: newExpiresAt,
      }
    });

    return newAccessToken;
  }

  private async sendViaGmail(accessToken: string, payload: Omit<EmailPayload, 'cc'> & { senderName: string, senderEmail: string, cc: string }): Promise<void> {
    const mailOptions: any = {
      from: `"${payload.senderName}" <${payload.senderEmail}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    };
    
    if (payload.cc) {
      mailOptions.cc = payload.cc;
    }

    const mail = new MailComposer(mailOptions);
    const mimeNode = mail.compile();
    const rawMessage = await mimeNode.build();

    const encodedMessage = rawMessage
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedMessage }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error({ error: errorText }, 'Gmail API sending failed');
      throw new Error(`Failed to send email via Gmail API: ${res.status} - ${errorText}`);
    }
  }

  private async sendViaZoho(accessToken: string, payload: Omit<EmailPayload, 'cc'> & { senderName: string, senderEmail: string, cc: string }): Promise<void> {
    // Determine the Zoho account ID by checking profiles first
    // In a real production system, you'd store the accountId when connecting the user.
    // Here we fetch it quickly.
    const accountRes = await fetch('https://mail.zoho.com/api/accounts', {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    
    if (!accountRes.ok) {
      const errorText = await accountRes.text();
      throw new Error(`Failed to fetch Zoho account information: ${accountRes.status} - ${errorText}`);
    }
    
    const accountData = await accountRes.json() as any;
    const accountId = accountData?.data?.[0]?.accountId;
    
    if (!accountId) {
      throw new Error('No Zoho Mail account found for this user');
    }

    const messageData: any = {
      fromAddress: payload.senderEmail,
      toAddress: payload.to,
      subject: payload.subject,
      content: payload.html,
      askReceipt: 'no'
    };

    if (payload.cc) {
      messageData.ccAddress = payload.cc;
    }

    const sendRes = await fetch(`https://mail.zoho.com/api/accounts/${accountId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageData),
    });

    if (!sendRes.ok) {
      const errorText = await sendRes.text();
      logger.error({ error: errorText }, 'Zoho Mail API sending failed');
      throw new Error(`Failed to send email via Zoho Mail API: ${sendRes.status} - ${errorText}`);
    }
  }
}
