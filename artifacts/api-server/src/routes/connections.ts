import { Router, type IRouter, type Request, type Response } from "express";
import { db, userConnections, users } from "@workspace/db";
import { and, eq, ilike, inArray, ne, or } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { notify } from "../lib/notify";

const router: IRouter = Router();

const GENRE_COLORS: Record<string, string> = {
  Indie: "#e85d4a",
  Electronic: "#3b82f6",
  Jazz: "#8b5cf6",
  Folk: "#f59e0b",
  "R&B": "#10b981",
  "Lo-Fi": "#6366f1",
  "Hip Hop": "#f97316",
  Ambient: "#0ea5e9",
  Acoustic: "#14b8a6",
  Synth: "#ec4899",
};

const AVATAR_COLORS = [
  "#e85d4a", "#3b82f6", "#8b5cf6", "#f59e0b", "#10b981",
  "#6366f1", "#f97316", "#0ea5e9", "#14b8a6", "#ec4899",
];

function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// Connection-card projection over `users` — its own contract, NOT the Artist schema.
const connectionColumns = {
  id: users.id,
  name: users.name,
  university: users.university,
  role: users.role,
  genre: users.genre,
  coverColor: users.coverColor,
  avatarUrl: users.avatarUrl,
};

type ConnectionUserRow = {
  id: string;
  name: string;
  university: string;
  role: string | null;
  genre: string | null;
  coverColor: string | null;
  avatarUrl: string | null;
};

type ConnectionStatus = "none" | "sent" | "received" | "connected";

// Shape a user row into the Connection card. Artists surface their real genre +
// genre-color; everyone else shows "Listener" + a deterministic color.
// mutualCount is harmonized to 0 across the board.
function shapeConnection(u: ConnectionUserRow, status: ConnectionStatus) {
  const isArtist = u.role === "artist";
  return {
    id: u.id,
    name: u.name || u.id,
    university: u.university || "Unknown University",
    genre: isArtist ? (u.genre ?? "Artist") : "Listener",
    coverColor: isArtist
      ? (GENRE_COLORS[u.genre ?? ""] ?? u.coverColor ?? colorForId(u.id))
      : colorForId(u.id),
    avatarUrl: u.avatarUrl ?? null,
    mutualCount: 0,
    status,
  };
}

// Shape by id when the row may be missing (e.g. a connection to a deleted user).
function shapeConnectionById(
  id: string,
  u: ConnectionUserRow | undefined,
  status: ConnectionStatus,
) {
  if (u) return shapeConnection(u, status);
  return {
    id,
    name: id,
    university: "Unknown University",
    genre: "Listener",
    coverColor: colorForId(id),
    avatarUrl: null,
    mutualCount: 0,
    status,
  };
}

router.get("/connections/search", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!; // guaranteed by requireAuth

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) {
    res.json([]);
    return;
  }

  const pattern = `%${q}%`;

  const [matchedUsers, allConns] = await Promise.all([
    db
      .select(connectionColumns)
      .from(users)
      .where(
        and(
          ne(users.id, userId),
          or(ilike(users.name, pattern), ilike(users.university, pattern))
        )
      )
      .limit(30),
    db
      .select()
      .from(userConnections)
      .where(or(eq(userConnections.fromUserId, userId), eq(userConnections.toUserId, userId))),
  ]);

  const sentSet = new Set(allConns.filter((c) => c.fromUserId === userId).map((c) => c.toUserId));
  const receivedSet = new Set(allConns.filter((c) => c.toUserId === userId).map((c) => c.fromUserId));
  const acceptedSet = new Set(
    allConns
      .filter((c) => c.status === "accepted" && (c.fromUserId === userId || c.toUserId === userId))
      .flatMap((c) => [c.fromUserId, c.toUserId])
      .filter((id) => id !== userId)
  );

  const results = matchedUsers.map((u) => {
    let status: ConnectionStatus = "none";
    if (acceptedSet.has(u.id)) status = "connected";
    else if (sentSet.has(u.id)) status = "sent";
    else if (receivedSet.has(u.id)) status = "received";
    return shapeConnection(u, status);
  });

  res.json(results);
});

router.get("/connections", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!; // guaranteed by requireAuth

  const type = typeof req.query.type === "string" ? req.query.type : "discover";

  if (type === "discover") {
    const allConns = await db
      .select()
      .from(userConnections)
      .where(or(eq(userConnections.fromUserId, userId), eq(userConnections.toUserId, userId)));

    const sentSet = new Set(allConns.filter((c) => c.fromUserId === userId).map((c) => c.toUserId));
    const receivedSet = new Set(allConns.filter((c) => c.toUserId === userId).map((c) => c.fromUserId));
    const acceptedSet = new Set(
      allConns
        .filter((c) => c.status === "accepted" && (c.fromUserId === userId || c.toUserId === userId))
        .flatMap((c) => [c.fromUserId, c.toUserId])
        .filter((id) => id !== userId)
    );

    const allConnectedIds = new Set([...sentSet, ...receivedSet]);

    // Artists are ordinary users now — one query, no virtual-ID merge.
    const allOtherUsers = await db
      .select(connectionColumns)
      .from(users)
      .where(ne(users.id, userId));

    const statusFor = (id: string): ConnectionStatus => {
      if (acceptedSet.has(id)) return "connected";
      if (sentSet.has(id)) return "sent";
      if (receivedSet.has(id)) return "received";
      return "none";
    };

    // Artists are always surfaced (with their real status); listeners only when
    // not already connected/pending. Interleave the two, cap at 16.
    const artistConnections = allOtherUsers
      .filter((u) => u.role === "artist")
      .map((u) => shapeConnection(u, statusFor(u.id)));

    const realUserConnections = allOtherUsers
      .filter((u) => u.role !== "artist" && !allConnectedIds.has(u.id) && !acceptedSet.has(u.id))
      .map((u) => shapeConnection(u, "none"));

    const merged: ReturnType<typeof shapeConnection>[] = [];
    const maxLen = Math.max(artistConnections.length, realUserConnections.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < artistConnections.length) merged.push(artistConnections[i]);
      if (i < realUserConnections.length) merged.push(realUserConnections[i]);
    }
    res.json(merged.slice(0, 16));
    return;
  }

  const allConns = await db
    .select()
    .from(userConnections)
    .where(or(eq(userConnections.fromUserId, userId), eq(userConnections.toUserId, userId)));

  if (type === "friends") {
    const accepted = allConns.filter((c) => c.status === "accepted");
    const otherIds = accepted.map((c) => (c.fromUserId === userId ? c.toUserId : c.fromUserId));

    const otherUserRows = otherIds.length > 0
      ? await db.select(connectionColumns).from(users).where(inArray(users.id, otherIds))
      : [];
    const userMap = new Map(otherUserRows.map((u) => [u.id, u]));

    const friends = accepted.map((c) => {
      const otherId = c.fromUserId === userId ? c.toUserId : c.fromUserId;
      return shapeConnectionById(otherId, userMap.get(otherId), "connected");
    });

    res.json(friends);
    return;
  }

  if (type === "sent") {
    const pending = allConns.filter((c) => c.fromUserId === userId && c.status === "pending");
    const targetIds = pending.map((c) => c.toUserId);

    const targetUserRows = targetIds.length > 0
      ? await db.select(connectionColumns).from(users).where(inArray(users.id, targetIds))
      : [];
    const userMap = new Map(targetUserRows.map((u) => [u.id, u]));

    const sent = pending.map((c) =>
      shapeConnectionById(c.toUserId, userMap.get(c.toUserId), "sent"),
    );

    res.json(sent);
    return;
  }

  if (type === "requests") {
    const pending = allConns.filter((c) => c.toUserId === userId && c.status === "pending");
    const requesterIds = pending.map((c) => c.fromUserId);

    const requesterUserRows = requesterIds.length > 0
      ? await db.select(connectionColumns).from(users).where(inArray(users.id, requesterIds))
      : [];
    const userMap = new Map(requesterUserRows.map((u) => [u.id, u]));

    const requests = pending.map((c) =>
      shapeConnectionById(c.fromUserId, userMap.get(c.fromUserId), "received"),
    );

    res.json(requests);
    return;
  }

  res.json([]);
});

router.post("/connections/:userId/connect", requireAuth, async (req: Request<{ userId: string }>, res: Response): Promise<void> => {
  const userId = req.userId!; // guaranteed by requireAuth

  const targetUserId = req.params.userId;
  if (userId === targetUserId) {
    res.status(400).json({ error: "Cannot connect to yourself" });
    return;
  }

  const { connect: doConnect } = req.body as { connect?: boolean };
  const shouldConnect = doConnect !== false;

  if (shouldConnect) {
    const existing = await db
      .select()
      .from(userConnections)
      .where(
        or(
          and(eq(userConnections.fromUserId, userId), eq(userConnections.toUserId, targetUserId)),
          and(eq(userConnections.fromUserId, targetUserId), eq(userConnections.toUserId, userId))
        )
      );

    if (existing.length === 0) {
      await db.insert(userConnections).values({
        fromUserId: userId,
        toUserId: targetUserId,
        status: "pending",
      });
    }

    const row = await db
      .select()
      .from(userConnections)
      .where(
        or(
          and(eq(userConnections.fromUserId, userId), eq(userConnections.toUserId, targetUserId)),
          and(eq(userConnections.fromUserId, targetUserId), eq(userConnections.toUserId, userId))
        )
      )
      .limit(1);

    const conn = row[0];
    let status: "none" | "sent" | "received" | "connected" = "none";
    if (conn) {
      if (conn.status === "accepted") status = "connected";
      else if (conn.fromUserId === userId) status = "sent";
      else status = "received";
    }

    res.json({ userId: targetUserId, status });
  } else {
    await db
      .delete(userConnections)
      .where(
        and(
          eq(userConnections.fromUserId, userId),
          eq(userConnections.toUserId, targetUserId),
          eq(userConnections.status, "pending")
        )
      );
    res.json({ userId: targetUserId, status: "none" });
  }
});

router.post("/connections/:userId/respond", requireAuth, async (req: Request<{ userId: string }>, res: Response): Promise<void> => {
  const userId = req.userId!; // guaranteed by requireAuth

  const requesterId = req.params.userId;
  const { accept } = req.body as { accept: boolean };

  const existing = await db
    .select()
    .from(userConnections)
    .where(
      and(
        eq(userConnections.fromUserId, requesterId),
        eq(userConnections.toUserId, userId),
        eq(userConnections.status, "pending")
      )
    )
    .limit(1);

  if (existing.length === 0) {
    res.status(404).json({ error: "Connection request not found" });
    return;
  }

  if (accept) {
    await db
      .update(userConnections)
      .set({ status: "accepted" })
      .where(
        and(
          eq(userConnections.fromUserId, requesterId),
          eq(userConnections.toUserId, userId)
        )
      );
    await notify({
      userId: requesterId,
      type: "connection_accepted",
      actorUserId: userId,
      targetType: "user",
      targetId: userId,
    });
    res.json({ userId: requesterId, status: "connected" });
  } else {
    await db
      .delete(userConnections)
      .where(
        and(
          eq(userConnections.fromUserId, requesterId),
          eq(userConnections.toUserId, userId)
        )
      );
    res.json({ userId: requesterId, status: "none" });
  }
});

export default router;
