import { Resend } from "resend";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailService {
  sendEmail(message: EmailMessage): Promise<void>;
}

/** Sends real email through Resend (https://resend.com). */
export class ResendAdapter implements EmailService {
  private readonly resend: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    this.resend = new Resend(apiKey);
  }

  async sendEmail({ to, subject, html, text }: EmailMessage): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject,
      html,
      text: text ?? "",
    });
    if (error) {
      throw new Error(`Resend failed to send email: ${error.message}`);
    }
  }
}

/** Dev/test adapter — prints the email to stdout instead of sending it. */
export class ConsoleAdapter implements EmailService {
  async sendEmail({ to, subject, text, html }: EmailMessage): Promise<void> {
    console.log(`\n[email:console] to=${to} subject="${subject}"\n${text ?? html}\n`);
  }
}

/**
 * Singleton email service. Uses Resend when RESEND_API_KEY is set; otherwise
 * falls back to the console adapter (local dev / CI / tests — no real send).
 * EMAIL_FROM controls the sender and defaults to Resend's sandbox address, which
 * only delivers to the Resend account owner until a domain is verified.
 */
function createEmailService(): EmailService {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
  return apiKey ? new ResendAdapter(apiKey, from) : new ConsoleAdapter();
}

export const emailService: EmailService = createEmailService();

export * from "./templates";
