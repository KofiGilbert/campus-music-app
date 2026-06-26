import { Router, type IRouter } from "express";
import { and, count, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { db, notifications, pushTokens, users } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

type NotificationRow = typeof notifications.$inferSelect;

async function shapeNotifications(rows: NotificationRow[]) {
  if (rows.length === 0) return [];
  const actorIds = [...new Set(rows.map((r) => r.actorUserId).filter((x): x is string => !!x))];
  const actorMap = new Map<string, { id: string; username: string; name: string; avatarUrl: string | null; role: string }>();
  if (actorIds.length) {
    const actors = await db
      .select({ id: users.id, username: users.username, name: users.name, avatarUrl: users.avatarUrl, role: users.role })
      .from(users)
      .where(inArray(users.id, actorIds));
    for (const a of actors) actorMap.set(a.id, a);
  }
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    actor: r.actorUserId ? (actorMap.get(r.actorUserId) ?? null) : null,
    targetType: r.targetType,
    targetId: r.targetId,
    body: r.body,
    readAt: r.readAt,
    createdAt: r.createdAt,
  }));
}

/** GET /notifications — cursor-paginated inbox, newest first. */
router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : NaN;
  const limit = isNaN(limitRaw) || limitRaw <= 0 ? 30 : Math.min(limitRaw, 50);
  const cursorRaw = req.query.cursor;
  const cursor = typeof cursorRaw === "string" ? new Date(cursorRaw) : null;
  const validCursor = cursor && !isNaN(cursor.getTime()) ? cursor : null;

  const rows = await db
    .select()
    .from(notifications)
    .where(
      validCursor
        ? and(eq(notifications.userId, userId), lt(notifications.createdAt, validCursor))
        : eq(notifications.userId, userId),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  res.json({
    items: await shapeNotifications(page),
    nextCursor: hasMore ? page[page.length - 1].createdAt.toISOString() : null,
  });
});

/** GET /notifications/unread-count — badge count. */
router.get("/notifications/unread-count", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const [row] = await db
    .select({ c: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  res.json({ count: row?.c ?? 0 });
});

/** POST /notifications/:id/read — mark one read. */
router.post("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, String(req.params.id)),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ),
    );
  res.json({ ok: true });
});

/** POST /notifications/read-all — mark the whole inbox read. */
router.post("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  res.json({ ok: true });
});

/** GET /notifications/prefs — per-type opt-out map. */
router.get("/notifications/prefs", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const [row] = await db.select({ notifPrefs: users.notifPrefs }).from(users).where(eq(users.id, userId)).limit(1);
  res.json({ prefs: (row?.notifPrefs ?? {}) as Record<string, boolean> });
});

/** PATCH /notifications/prefs — merge per-type toggles. */
router.patch("/notifications/prefs", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const { prefs } = req.body as { prefs?: unknown };
  if (!prefs || typeof prefs !== "object") {
    res.status(400).json({ error: "prefs object required" });
    return;
  }
  const incoming: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(prefs as Record<string, unknown>)) {
    if (typeof v === "boolean") incoming[k] = v;
  }
  const [row] = await db.select({ notifPrefs: users.notifPrefs }).from(users).where(eq(users.id, userId)).limit(1);
  const merged = { ...((row?.notifPrefs ?? {}) as Record<string, boolean>), ...incoming };
  await db.update(users).set({ notifPrefs: merged }).where(eq(users.id, userId));
  res.json({ prefs: merged });
});

/** POST /push/tokens — register a device push token (idempotent). */
router.post("/push/tokens", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const { token, platform } = req.body as { token?: unknown; platform?: unknown };
  if (typeof token !== "string" || !token) {
    res.status(400).json({ error: "token is required" });
    return;
  }
  const plat = typeof platform === "string" ? platform : "unknown";
  // Re-point an existing token to this user (handles account switch on a device).
  await db
    .insert(pushTokens)
    .values({ userId, token, platform: plat })
    .onConflictDoUpdate({
      target: pushTokens.token,
      set: { userId, platform: plat, createdAt: sql`now()` },
    });
  res.status(201).json({ ok: true });
});

/** DELETE /push/tokens — unregister a device (logout). */
router.delete("/push/tokens", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const { token } = req.body as { token?: unknown };
  if (typeof token !== "string" || !token) {
    res.status(400).json({ error: "token is required" });
    return;
  }
  await db.delete(pushTokens).where(and(eq(pushTokens.token, token), eq(pushTokens.userId, userId)));
  res.json({ ok: true });
});

export default router;
