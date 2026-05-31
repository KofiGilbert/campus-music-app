import { Router, type IRouter } from "express";
import { db, userConnections, artists, users } from "@workspace/db";
import { and, eq, ilike, inArray, ne, or } from "drizzle-orm";
import { verifyToken } from "./auth";

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

async function getUserId(req: Parameters<Parameters<typeof router.get>[1]>[0]): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  return verifyToken(authHeader.slice(7));
}

router.get("/connections/search", async (req, res): Promise<void> => {
  const userId = await getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) {
    res.json([]);
    return;
  }

  const pattern = `%${q}%`;

  const [matchedUsers, allConns] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, university: users.university, role: users.role })
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
    let status: "none" | "sent" | "received" | "connected" = "none";
    if (acceptedSet.has(u.id)) status = "connected";
    else if (sentSet.has(u.id)) status = "sent";
    else if (receivedSet.has(u.id)) status = "received";

    return {
      id: u.id,
      name: u.name || u.id,
      university: u.university || "Unknown University",
      genre: u.role === "artist" ? "Artist" : "Listener",
      coverColor: colorForId(u.id),
      avatarUrl: null,
      mutualCount: 0,
      status,
    };
  });

  res.json(results);
  return;
});

router.get("/connections", async (req, res): Promise<void> => {
  const userId = await getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

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

    const [allArtists, allUsers] = await Promise.all([
      db.select().from(artists),
      db
        .select({
          id: users.id,
          name: users.name,
          university: users.university,
          role: users.role,
        })
        .from(users)
        .where(ne(users.id, userId)),
    ]);

    const artistConnections = allArtists.map((a) => {
      const virtualUserId = `user-${a.id}`;
      let status: "none" | "sent" | "received" | "connected" = "none";
      if (acceptedSet.has(virtualUserId)) status = "connected";
      else if (sentSet.has(virtualUserId)) status = "sent";
      else if (receivedSet.has(virtualUserId)) status = "received";

      return {
        id: virtualUserId,
        name: a.name,
        university: a.university ?? "Unknown University",
        genre: a.genre,
        coverColor: GENRE_COLORS[a.genre] ?? a.coverColor,
        avatarUrl: a.avatarUrl ?? null,
        mutualCount: 1,
        status,
      };
    });

    const realUserConnections = allUsers
      .filter((u) => !allConnectedIds.has(u.id) && !acceptedSet.has(u.id))
      .map((u) => ({
        id: u.id,
        name: u.name || u.id,
        university: u.university || "Unknown University",
        genre: u.role === "artist" ? "Artist" : "Listener",
        coverColor: colorForId(u.id),
        avatarUrl: null,
        mutualCount: 0,
        status: "none" as const,
      }));

    const merged: typeof artistConnections = [];
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

    const realIds = otherIds.filter((id) => !id.startsWith("user-"));
    const artistVirtualIds = otherIds.filter((id) => id.startsWith("user-"));
    const artistIds = artistVirtualIds.map((id) => id.slice(5));

    const [realUserRows, neededArtists] = await Promise.all([
      realIds.length > 0
        ? db.select({ id: users.id, name: users.name, university: users.university, role: users.role })
            .from(users)
            .where(inArray(users.id, realIds))
        : Promise.resolve([]),
      artistIds.length > 0
        ? db.select().from(artists).where(inArray(artists.id, artistIds))
        : Promise.resolve([]),
    ]);

    const userMap = new Map(realUserRows.map((u) => [u.id, u]));
    const artistMap = new Map(neededArtists.map((a) => [`user-${a.id}`, a]));

    const friends = accepted.map((c) => {
      const otherId = c.fromUserId === userId ? c.toUserId : c.fromUserId;
      const realUser = userMap.get(otherId);
      const artist = artistMap.get(otherId);

      if (realUser) {
        return {
          id: otherId,
          name: realUser.name || otherId,
          university: realUser.university || "Unknown University",
          genre: realUser.role === "artist" ? "Artist" : "Listener",
          coverColor: colorForId(otherId),
          avatarUrl: null,
          mutualCount: 0,
          status: "connected" as const,
        };
      }

      return {
        id: otherId,
        name: artist?.name ?? otherId,
        university: artist?.university ?? "Unknown University",
        genre: artist?.genre ?? "Unknown",
        coverColor: artist ? (GENRE_COLORS[artist.genre] ?? artist.coverColor) : colorForId(otherId),
        avatarUrl: artist?.avatarUrl ?? null,
        mutualCount: artist ? 1 : 0,
        status: "connected" as const,
      };
    });

    res.json(friends);
    return;
  }

  if (type === "sent") {
    const pending = allConns.filter((c) => c.fromUserId === userId && c.status === "pending");
    const targetIds = pending.map((c) => c.toUserId);

    const realIds = targetIds.filter((id) => !id.startsWith("user-"));
    const artistVirtualIds = targetIds.filter((id) => id.startsWith("user-"));
    const artistIds = artistVirtualIds.map((id) => id.slice(5));

    const [realUserRows, neededArtists] = await Promise.all([
      realIds.length > 0
        ? db.select({ id: users.id, name: users.name, university: users.university, role: users.role })
            .from(users)
            .where(inArray(users.id, realIds))
        : Promise.resolve([]),
      artistIds.length > 0
        ? db.select().from(artists).where(inArray(artists.id, artistIds))
        : Promise.resolve([]),
    ]);

    const userMap = new Map(realUserRows.map((u) => [u.id, u]));
    const artistMap = new Map(neededArtists.map((a) => [`user-${a.id}`, a]));

    const sent = pending.map((c) => {
      const realUser = userMap.get(c.toUserId);
      const artist = artistMap.get(c.toUserId);

      if (realUser) {
        return {
          id: c.toUserId,
          name: realUser.name || c.toUserId,
          university: realUser.university || "Unknown University",
          genre: realUser.role === "artist" ? "Artist" : "Listener",
          coverColor: colorForId(c.toUserId),
          avatarUrl: null,
          mutualCount: 0,
          status: "sent" as const,
        };
      }

      return {
        id: c.toUserId,
        name: artist?.name ?? c.toUserId,
        university: artist?.university ?? "Unknown University",
        genre: artist?.genre ?? "Unknown",
        coverColor: artist ? (GENRE_COLORS[artist.genre] ?? artist.coverColor) : colorForId(c.toUserId),
        avatarUrl: artist?.avatarUrl ?? null,
        mutualCount: artist ? 1 : 0,
        status: "sent" as const,
      };
    });

    res.json(sent);
    return;
  }

  if (type === "requests") {
    const pending = allConns.filter((c) => c.toUserId === userId && c.status === "pending");
    const requesterIds = pending.map((c) => c.fromUserId);

    const realIds = requesterIds.filter((id) => !id.startsWith("user-"));
    const artistVirtualIds = requesterIds.filter((id) => id.startsWith("user-"));
    const artistIds = artistVirtualIds.map((id) => id.slice(5));

    const [realUserRows, neededArtists] = await Promise.all([
      realIds.length > 0
        ? db.select({ id: users.id, name: users.name, university: users.university, role: users.role })
            .from(users)
            .where(inArray(users.id, realIds))
        : Promise.resolve([]),
      artistIds.length > 0
        ? db.select().from(artists).where(inArray(artists.id, artistIds))
        : Promise.resolve([]),
    ]);

    const userMap = new Map(realUserRows.map((u) => [u.id, u]));
    const artistMap = new Map(neededArtists.map((a) => [`user-${a.id}`, a]));

    const requests = pending.map((c) => {
      const realUser = userMap.get(c.fromUserId);
      const artist = artistMap.get(c.fromUserId);

      if (realUser) {
        return {
          id: c.fromUserId,
          name: realUser.name || c.fromUserId,
          university: realUser.university || "Unknown University",
          genre: realUser.role === "artist" ? "Artist" : "Listener",
          coverColor: colorForId(c.fromUserId),
          avatarUrl: null,
          mutualCount: 0,
          status: "received" as const,
        };
      }

      return {
        id: c.fromUserId,
        name: artist?.name ?? c.fromUserId,
        university: artist?.university ?? "Unknown University",
        genre: artist?.genre ?? "Unknown",
        coverColor: artist ? (GENRE_COLORS[artist.genre] ?? artist.coverColor) : colorForId(c.fromUserId),
        avatarUrl: artist?.avatarUrl ?? null,
        mutualCount: artist ? 1 : 0,
        status: "received" as const,
      };
    });

    res.json(requests);
    return;
  }

  res.json([]);
});

router.post("/connections/:userId/connect", async (req, res): Promise<void> => {
  const userId = await getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

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

router.post("/connections/:userId/respond", async (req, res): Promise<void> => {
  const userId = await getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

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
