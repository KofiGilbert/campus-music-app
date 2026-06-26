import { inArray } from "drizzle-orm";
import { db, messages, tracks, users } from "@workspace/db";
import { signTrackMedia } from "./trackMedia";

type MessageRow = typeof messages.$inferSelect;

export interface ShapedMessage {
  id: string;
  conversationId: string;
  sender: { id: string; username: string; name: string; avatarUrl: string | null; role: string } | null;
  body: string;
  attachedTrack: Awaited<ReturnType<typeof signTrackMedia>> | null;
  attachedImageUrl: string | null;
  createdAt: Date;
}

/** Shape message rows: sender profile + signed attached track. Batched (no N+1). */
export async function shapeMessages(rows: MessageRow[]): Promise<ShapedMessage[]> {
  if (rows.length === 0) return [];

  const senderIds = [...new Set(rows.map((r) => r.senderUserId))];
  const trackIds = [...new Set(rows.map((r) => r.attachedTrackId).filter((x): x is string => !!x))];

  const senderRows = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      avatarUrl: users.avatarUrl,
      role: users.role,
    })
    .from(users)
    .where(inArray(users.id, senderIds));
  const senderMap = new Map(senderRows.map((s) => [s.id, s]));

  const trackMap = new Map<string, ShapedMessage["attachedTrack"]>();
  if (trackIds.length) {
    const trackRows = await db.select().from(tracks).where(inArray(tracks.id, trackIds));
    const signed = await Promise.all(trackRows.map((t) => signTrackMedia(t)));
    for (const t of signed) trackMap.set(t.id, t);
  }

  return rows.map((r) => ({
    id: r.id,
    conversationId: r.conversationId,
    sender: senderMap.get(r.senderUserId) ?? null,
    body: r.body,
    attachedTrack: r.attachedTrackId ? (trackMap.get(r.attachedTrackId) ?? null) : null,
    attachedImageUrl: r.attachedImageUrl,
    createdAt: r.createdAt,
  }));
}

export async function shapeMessage(row: MessageRow): Promise<ShapedMessage> {
  const [shaped] = await shapeMessages([row]);
  return shaped;
}
