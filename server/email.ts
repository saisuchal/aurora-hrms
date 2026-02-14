import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-mail',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Gmail not connected');
  }
  return accessToken;
}

async function getGmailClient() {
  const accessToken = await getAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

function createRawEmail(to: string, subject: string, htmlBody: string): string {
  const messageParts = [
    `To: ${to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    htmlBody,
  ];
  const message = messageParts.join('\n');
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sendCredentialsEmail(
  toEmail: string,
  firstName: string,
  username: string,
  tempPassword: string,
  appUrl: string
): Promise<void> {
  const gmail = await getGmailClient();

  const subject = 'Your HRMS Account Credentials';
  const htmlBody = `
<!DOCTYPE html>
<html>
<head><style>
  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
  .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
  .credentials { background: white; padding: 16px; border-radius: 6px; border: 1px solid #d1d5db; margin: 16px 0; }
  .credentials p { margin: 8px 0; }
  .label { font-weight: bold; color: #6b7280; }
  .value { font-family: monospace; font-size: 16px; color: #111; background: #f3f4f6; padding: 4px 8px; border-radius: 4px; }
  .warning { background: #fef3c7; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 16px 0; }
  .footer { padding: 16px; text-align: center; color: #9ca3af; font-size: 12px; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h2 style="margin:0;">Welcome to HRMS</h2>
  </div>
  <div class="content">
    <p>Hello ${firstName},</p>
    <p>Your HRMS account has been created. Below are your login credentials:</p>
    <div class="credentials">
      <p><span class="label">Username:</span> <span class="value">${username}</span></p>
      <p><span class="label">Temporary Password:</span> <span class="value">${tempPassword}</span></p>
    </div>
    <div class="warning">
      <strong>Important:</strong> You will be required to change your password upon your first login. Please do not share these credentials with anyone.
    </div>
    <p>You can access the system at: <a href="${appUrl}">${appUrl}</a></p>
  </div>
  <div class="footer">
    <p>This is an automated message from HRMS. Please do not reply.</p>
  </div>
</div>
</body>
</html>`;

  const raw = createRawEmail(toEmail, subject, htmlBody);

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });
}

export async function sendPasswordResetNotification(
  toEmail: string,
  firstName: string,
  newPassword: string,
  appUrl: string
): Promise<void> {
  const gmail = await getGmailClient();

  const subject = 'HRMS Password Reset';
  const htmlBody = `
<!DOCTYPE html>
<html>
<head><style>
  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
  .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
  .credentials { background: white; padding: 16px; border-radius: 6px; border: 1px solid #d1d5db; margin: 16px 0; }
  .credentials p { margin: 8px 0; }
  .label { font-weight: bold; color: #6b7280; }
  .value { font-family: monospace; font-size: 16px; color: #111; background: #f3f4f6; padding: 4px 8px; border-radius: 4px; }
  .warning { background: #fef3c7; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 16px 0; }
  .footer { padding: 16px; text-align: center; color: #9ca3af; font-size: 12px; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h2 style="margin:0;">Password Reset</h2>
  </div>
  <div class="content">
    <p>Hello ${firstName},</p>
    <p>Your HRMS password has been reset by an administrator. Your new temporary password is:</p>
    <div class="credentials">
      <p><span class="label">New Password:</span> <span class="value">${newPassword}</span></p>
    </div>
    <div class="warning">
      <strong>Important:</strong> You will be required to change this password upon your next login.
    </div>
    <p>Access the system at: <a href="${appUrl}">${appUrl}</a></p>
  </div>
  <div class="footer">
    <p>This is an automated message from HRMS. Please do not reply.</p>
  </div>
</div>
</body>
</html>`;

  const raw = createRawEmail(toEmail, subject, htmlBody);

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });
}
