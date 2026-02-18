import Mailgun from "mailgun.js";
import formData from "form-data";

const mailgun = new Mailgun(formData);

const mg = mailgun.client({
  username: "api",
  key: process.env.MAILGUN_API_KEY!,
  url: "https://api.mailgun.net",
});

const DOMAIN = process.env.MAILGUN_DOMAIN!;

export async function sendCredentialsEmail(
  toEmail: string,
  firstName: string,
  username: string,
  tempPassword: string,
  appUrl: string
) {
  await mg.messages.create(DOMAIN, {
    from: `Aurora HRMS <postmaster@${DOMAIN}>`,
    to: [toEmail],
    subject: "Your HRMS Account Credentials",
    html: `
      <h2>Welcome to HRMS</h2>
      <p>Hello ${firstName},</p>
      <p>Your account has been created. Below are your login details:</p>
      <p><strong>Username:</strong> ${username}</p>
      <p><strong>Temporary Password:</strong> ${tempPassword}</p>
      <p>Please login at: <a href="${appUrl}">${appUrl}</a></p>
      <p><strong>Important:</strong> You will be required to change your password after first login.</p>
      <br/>
      <small>This is an automated email. Please do not reply.</small>
    `,
  });
}

export async function sendPasswordResetNotification(
  toEmail: string,
  firstName: string,
  newPassword: string,
  appUrl: string
) {
  await mg.messages.create(DOMAIN, {
    from: `Aurora HRMS <postmaster@${DOMAIN}>`,
    to: [toEmail],
    subject: "HRMS Password Reset",
    html: `
      <h2>Password Reset</h2>
      <p>Hello ${firstName},</p>
      <p>Your password has been reset by an administrator.</p>
      <p><strong>New Temporary Password:</strong> ${newPassword}</p>
      <p>Please login at: <a href="${appUrl}">${appUrl}</a></p>
      <p><strong>Important:</strong> You will be required to change this password immediately.</p>
      <br/>
      <small>This is an automated email. Please do not reply.</small>
    `,
  });
}
