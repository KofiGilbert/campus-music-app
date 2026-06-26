import { logger } from "./logger";

// Expo Push delivery. Sending to Expo push tokens only requires a POST to Expo's
// public endpoint — the APNs key + FCM service account live in the EAS project,
// not here — so this works without server secrets. Real device tokens are needed
// to observe delivery, so it's best-effort: failures are logged, never thrown.
//
// EXPO_ACCESS_TOKEN is optional (raises rate limits / enables receipts) and added
// as a bearer header when present.

export interface ExpoPushMessage {
  to: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
}

export interface ExpoPushService {
  send(messages: ExpoPushMessage[]): Promise<void>;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

class HttpExpoPushService implements ExpoPushService {
  async send(messages: ExpoPushMessage[]): Promise<void> {
    const valid = messages.filter((m) => m.to.startsWith("ExponentPushToken") || m.to.startsWith("ExpoPushToken"));
    if (valid.length === 0) return;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const accessToken = process.env.EXPO_ACCESS_TOKEN;
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    try {
      // Expo accepts up to 100 messages per request.
      for (let i = 0; i < valid.length; i += 100) {
        const batch = valid.slice(i, i + 100);
        const res = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers,
          body: JSON.stringify(batch),
        });
        if (!res.ok) {
          logger.warn({ status: res.status }, "Expo push send failed");
        }
      }
    } catch (err) {
      logger.warn({ err }, "Expo push send error");
    }
  }
}

export const expoPush: ExpoPushService = new HttpExpoPushService();
