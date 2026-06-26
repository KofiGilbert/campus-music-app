// Simple inline-HTML email templates. Each returns the subject + html + text;
// the caller supplies the recipient. Interpolated values are safe (a numeric
// OTP code and an app-generated reset URL), so no HTML escaping is needed.

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

const APP_NAME = "Campus Music";

const wrap = (inner: string): string =>
  `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">` +
  `<h2 style="margin:0 0 16px">${APP_NAME}</h2>${inner}</div>`;

export function otpEmailTemplate(code: string): EmailTemplate {
  return {
    subject: `Your ${APP_NAME} verification code`,
    text: `Your ${APP_NAME} verification code is ${code}. It expires in 10 minutes.`,
    html: wrap(
      `<p>Your verification code is:</p>` +
        `<p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:8px 0 16px">${code}</p>` +
        `<p style="color:#666;font-size:13px">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>`,
    ),
  };
}

export function passwordResetEmailTemplate(resetLink: string): EmailTemplate {
  return {
    subject: `Reset your ${APP_NAME} password`,
    text:
      `We received a request to reset your ${APP_NAME} password.\n\n` +
      `Reset it here: ${resetLink}\n\n` +
      `This link expires in 1 hour. If you didn't request this, ignore this email.`,
    html: wrap(
      `<p>We received a request to reset your password.</p>` +
        `<p style="margin:16px 0"><a href="${resetLink}" style="background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;display:inline-block">Reset password</a></p>` +
        `<p style="color:#666;font-size:13px">This link expires in 1 hour. If you didn't request this, ignore this email.</p>`,
    ),
  };
}
