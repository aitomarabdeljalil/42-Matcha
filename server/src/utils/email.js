const nodemailer = require('nodemailer');

// Build a nodemailer transporter from environment variables.
// If SMTP is not configured, this returns null and the caller may choose a fallback (e.g. Ethereal) in non-production.
function createTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: (SMTP_SECURE || '').toString() === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

function baseHtmlTemplate({ title, bodyHtml }) {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', Arial, sans-serif; background: #f6f9fc; margin: 0; padding: 0; }
      .container { max-width: 560px; margin: 24px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); overflow: hidden; }
      .header { background: #111827; color: #ffffff; padding: 16px 24px; font-size: 18px; font-weight: 600; }
      .content { padding: 24px; color: #111827; line-height: 1.6; }
      .btn { display: inline-block; background: #2563eb; color: #ffffff !important; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; }
      .muted { color: #6b7280; font-size: 13px; }
      .footer { padding: 16px 24px; color: #6b7280; font-size: 12px; }
      a { color: #2563eb; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">${title}</div>
      <div class="content">
        ${bodyHtml}
      </div>
      <div class="footer">If you didn't request this, you can safely ignore this email.</div>
    </div>
  </body>
  </html>`;
}

async function sendResetEmail(email, resetUrl) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const subject = 'Reset your password';
  const text = `Reset your password using this link: ${resetUrl}`;
  const html = baseHtmlTemplate({
    title: 'Password Reset',
    bodyHtml: `
      <p>We received a request to reset your password. Click the button below to proceed.</p>
      <p style="margin: 16px 0;">
        <a class="btn" href="${resetUrl}" target="_blank" rel="noopener">Reset Password</a>
      </p>
      <p class="muted">If the button doesn't work, copy and paste this URL into your browser:<br />
      <a href="${resetUrl}">${resetUrl}</a></p>
    `
  });

  // Try configured SMTP transport first. If unavailable or authentication fails and we're in development,
  // fall back to an Ethereal test account so local dev can still preview emails.
  const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';

  // Always log reset link locally to avoid losing it when email can't be sent.
  if (!isProduction) console.log('Password reset link (dev):', resetUrl);

  let transporter = createTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({ from, to: email, subject, text, html });
      return { success: true };
    } catch (error) {
      // If authentication failed and we're not in production, attempt to fall back.
      const authError = error && (error.code === 'EAUTH' || (error.cause && error.cause.code === 'EAUTH'));
      if (authError && !isProduction) {
        console.warn('SMTP auth failed, falling back to Ethereal test account for local dev. Error:', error.message || error);
        transporter = null; // trigger fallback below
      } else {
        const err = new Error('Failed to send password reset email');
        err.code = 'EMAIL_SEND_FAILED';
        err.cause = error;
        throw err;
      }
    }
  }

  // Fallback: in non-production create an Ethereal test account and send the email so developers can preview it.
  if (!transporter && !isProduction) {
    try {
      const testAccount = await nodemailer.createTestAccount();
      const ethTransport = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass }
      });
      const info = await ethTransport.sendMail({ from: process.env.SMTP_FROM || testAccount.user, to: email, subject, text, html });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log('Ethereal preview URL:', previewUrl);
      return { success: true, previewUrl };
    } catch (fallbackErr) {
      const err = new Error('Failed to send password reset email');
      err.code = 'EMAIL_SEND_FAILED';
      err.cause = fallbackErr;
      throw err;
    }
  }
  // If we reached here, SMTP wasn't configured and we're in production (or fallback didn't run)
  const err = new Error('Failed to send password reset email');
  err.code = 'EMAIL_SEND_FAILED';
  err.cause = new Error('No SMTP transport available');
  throw err;
}

async function sendPasswordChangedEmail(email) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const subject = 'Your password has been changed';
  const text = 'This is a confirmation that your password has been successfully reset.';
  const html = baseHtmlTemplate({
    title: 'Password Changed',
    bodyHtml: `
      <p>Your password has been changed successfully.</p>
      <p class="muted">If you did not perform this action, please contact support immediately.</p>
    `
  });

  try {
    const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
    let transporter = createTransporter();
    if (transporter) {
      try {
        await transporter.sendMail({ from, to: email, subject, text, html });
        return { success: true };
      } catch (error) {
        const authError = error && (error.code === 'EAUTH' || (error.cause && error.cause.code === 'EAUTH'));
        if (authError && !isProduction) {
          console.warn('SMTP auth failed for confirmation email, falling back to Ethereal for dev. Error:', error.message || error);
          transporter = null;
        } else {
          const err = new Error('Failed to send password change confirmation email');
          err.code = 'EMAIL_SEND_FAILED';
          err.cause = error;
          throw err;
        }
      }
    }

    if (!transporter && !isProduction) {
      const testAccount = await nodemailer.createTestAccount();
      const ethTransport = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass }
      });
      const info = await ethTransport.sendMail({ from: process.env.SMTP_FROM || testAccount.user, to: email, subject, text, html });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log('Ethereal preview URL:', previewUrl);
      return { success: true, previewUrl };
    }

    const err = new Error('Failed to send password change confirmation email');
    err.code = 'EMAIL_SEND_FAILED';
    err.cause = new Error('No SMTP transport available');
    throw err;
  } catch (fallbackErr) {
    // Re-throw to let caller handle logging; keep error shape consistent
    const err = new Error('Failed to send password change confirmation email');
    err.code = 'EMAIL_SEND_FAILED';
    err.cause = fallbackErr;
    throw err;
  }
}

module.exports = {
  sendResetEmail,
  sendPasswordChangedEmail
};
