import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const FROM_EMAIL = "yourgmail@gmail.com"; // must match verified sender

export async function sendCredentialsEmail(
  toEmail: string,
  firstName: string,
  username: string,
  tempPassword: string,
  appUrl: string
): Promise<void> {
  try {
    await sgMail.send({
      to: toEmail,
      from: {
        email: FROM_EMAIL,
        name: "Aurora HRMS",
      },
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

    console.log("✅ Credentials email sent to:", toEmail);
  } catch (error: any) {
    console.error("❌ SendGrid Error:", error.response?.body || error);
    throw error;
  }
}

export async function sendPasswordResetNotification(
  toEmail: string,
  firstName: string,
  newPassword: string,
  appUrl: string
): Promise<void> {
  try {
    await sgMail.send({
      to: toEmail,
      from: {
        email: FROM_EMAIL,
        name: "Aurora HRMS",
      },
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

    console.log("✅ Password reset email sent to:", toEmail);
  } catch (error: any) {
    console.error("❌ SendGrid Error:", error.response?.body || error);
    throw error;
  }
}
