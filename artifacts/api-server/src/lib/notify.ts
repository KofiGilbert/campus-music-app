import { eq } from "drizzle-orm";
import { db, notifications, pushTokens, users } from "@workspace/db";
import { realtime } from "../realtime/gateway";
import { expoPush, type ExpoPushMessage } from "./expoPush";
import { logger } from "./logger";

export interface NotifyInput {
  userId: string; // recipient
  type: string;
  actorUserId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  body?: string | null;
  /** Push title/body override; falls back to a generic title + `body`. */
  pushTitle?: string;
}

// Short human-readable copy per type, used for the push payload. The in-app row
// renders richer copy on the client from (type, actor, target).
const PUSH_TITLES: Record<string, string> = {
  follow: "New follower",
  post_like: "New like",
  comment: "New comment",
  message: "New message",
  connection_accepted: "Connection accepted",
  live_started: "Live now",
};

/**
 * Create a notification: persist it, push it to the recipient's live sockets, and
 * best-effort send an Expo push to their devices. No-ops when the actor is the
 * recipient (don't notify yourself) or the recipient opted out of `type`.
 * Never throws — notifications are a side effect of the triggering action.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    if (input.actorUserId && input.actorUserId === input.userId) return;

    const [recipient] = await db
      .select({ notifPrefs: users.notifPrefs })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);
    if (!recipient) return;
    const prefs = (recipient.notifPrefs ?? {}) as Record<string, boolean>;
    if (prefs[input.type] === false) return; // explicit opt-out

    const [row] = await db
      .insert(notifications)
      .values({
        userId: input.userId,
        type: input.type,
        actorUserId: input.actorUserId ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        body: input.body ?? null,
      })
      .returning();

    // Live in-app delivery (bell badge / inbox).
    realtime().emitToUser(input.userId, "notification:new", {
      id: row.id,
      type: row.type,
      actorUserId: row.actorUserId,
      targetType: row.targetType,
      targetId: row.targetId,
      body: row.body,
      createdAt: row.createdAt,
    });

    // Best-effort push to registered devices.
    const tokens = await db
      .select({ token: pushTokens.token })
      .from(pushTokens)
      .where(eq(pushTokens.userId, input.userId));
    if (tokens.length) {
      const messages: ExpoPushMessage[] = tokens.map((t) => ({
        to: t.token,
        title: input.pushTitle ?? PUSH_TITLES[input.type] ?? "Campus Music",
        body: input.body ?? undefined,
        sound: "default",
        data: { type: row.type, targetType: row.targetType, targetId: row.targetId, notificationId: row.id },
      }));
      await expoPush.send(messages);
    }
  } catch (err) {
    logger.warn({ err, type: input.type }, "notify failed");
  }
}

/** Fan a notification out to many recipients (e.g. followers when an artist goes live). */
export async function notifyMany(userIds: string[], input: Omit<NotifyInput, "userId">): Promise<void> {
  await Promise.all(userIds.map((userId) => notify({ ...input, userId })));
}
