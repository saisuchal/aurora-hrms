import nodemailer from "nodemailer";

/**
 * Gmail OAuth2 Transporter
 * Requires:
 * EMAIL_USER
 * GOOGLE_CLIENT_ID
 * GOOGLE_CLIENT_SECRET
 * GOOGLE_REFRESH_TOKEN
 */

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    user: process.env.EMAIL_USER, // your Gmail address
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

// Optional: verify transporter on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Email transporter error:", error);
  } else {
    console.log("✅ Gmail OAuth transporter ready");
  }
});

export async function sendCredentialsEmail(
  toEmail: string,
  firstName: string,
  username: string,
  tempPassword: string,
  appUrl: string
): Promise<void> {
  try {
    await transporter.sendMail({
      from: `"Aurora HRMS" <${process.env.EMAIL_USER}>`,
      to: toEmail,
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
  } catch (err) {
    console.error("❌ Failed to send credentials email:", err);
    throw err;
  }
}

export async function sendPasswordResetNotification(
  toEmail: string,
  firstName: string,
  newPassword: string,
  appUrl: string
): Promise<void> {
  try {
    const info = await transporter.sendMail({
      from: `"Aurora HRMS" <${process.env.EMAIL_USER}>`,
      to: toEmail,
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
    console.log("mail info:", info);
  } catch (err) {
    console.error("❌ Failed to send password reset email:", err);
    throw err;
  }
}
