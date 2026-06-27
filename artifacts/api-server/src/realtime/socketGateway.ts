import type { Server as HttpServer } from "node:http";
import { and, eq } from "drizzle-orm";
import { Server as IOServer, type Socket } from "socket.io";
import { conversationParticipants, db } from "@workspace/db";
import { verifyToken } from "../lib/jwt";
import { logger } from "../lib/logger";
import {
  conversationRoom,
  liveRoom,
  tvRoom,
  type RealtimeGateway,
  setRealtimeGateway,
  userRoom,
} from "./gateway";

// Single shared socket.io server. We multiplex every realtime feature over ONE
// namespace using rooms (`user:<id>`, `conv:<id>`, later `live:<id>`, `tv:<id>`)
// rather than a namespace per feature. Rooms give the same isolation with one
// client connection to manage on mobile, and the RealtimeGateway interface keeps
// routes decoupled from this choice. (Deviation from the "namespace per feature"
// suggestion in DEVIN_ROADMAP §3.7 — flagged in the Phase 4 PR.)

async function isParticipant(conversationId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: conversationParticipants.userId })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    )
    .limit(1);
  return !!row;
}

function registerHandlers(socket: Socket): void {
  const userId = socket.data.userId as string;
  // Every device of a user joins their personal room so server-side emits reach
  // all sessions.
  void socket.join(userRoom(userId));

  // Join a conversation room to receive typing indicators in real time. Membership
  // is verified server-side so a user can't subscribe to threads they're not in.
  socket.on("dm:join", async (conversationId: unknown) => {
    if (typeof conversationId !== "string") return;
    if (await isParticipant(conversationId, userId)) {
      void socket.join(conversationRoom(conversationId));
    }
  });

  socket.on("dm:leave", (conversationId: unknown) => {
    if (typeof conversationId === "string") {
      void socket.leave(conversationRoom(conversationId));
    }
  });

  // Typing indicator — relayed to the rest of the room, never persisted.
  socket.on("dm:typing", (payload: unknown) => {
    const conversationId =
      payload && typeof payload === "object" && "conversationId" in payload
        ? (payload as { conversationId: unknown }).conversationId
        : undefined;
    if (typeof conversationId !== "string") return;
    socket.to(conversationRoom(conversationId)).emit("dm:typing", { conversationId, userId });
  });

  // Live sessions are public, so joining the chat room needs no membership check.
  socket.on("live:join", (sessionId: unknown) => {
    if (typeof sessionId === "string") void socket.join(liveRoom(sessionId));
  });
  socket.on("live:leave", (sessionId: unknown) => {
    if (typeof sessionId === "string") void socket.leave(liveRoom(sessionId));
  });

  // Campus Music TV show rooms (public — chat + viewer count + presenter cues).
  socket.on("tv:join", (showId: unknown) => {
    if (typeof showId === "string") void socket.join(tvRoom(showId));
  });
  socket.on("tv:leave", (showId: unknown) => {
    if (typeof showId === "string") void socket.leave(tvRoom(showId));
  });
}

/** Attach socket.io to the HTTP server and install it as the active gateway. */
export function createSocketGateway(httpServer: HttpServer): RealtimeGateway {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const io = new IOServer(httpServer, {
    cors: { origin: allowedOrigins.length > 0 ? allowedOrigins : true, credentials: true },
  });

  // JWT-in-handshake auth. The client passes its access token via
  // `io(url, { auth: { token } })`; we verify with the same secret as REST.
  io.use(async (socket, next) => {
    const raw = socket.handshake.auth?.token;
    const token = typeof raw === "string" ? raw : undefined;
    const claims = token ? await verifyToken(token) : null;
    if (!claims) {
      next(new Error("unauthorized"));
      return;
    }
    socket.data.userId = claims.sub;
    next();
  });

  io.on("connection", (socket) => {
    registerHandlers(socket);
  });

  io.engine.on("connection_error", (err: { message: string }) => {
    logger.debug({ err: err.message }, "socket.io connection error");
  });

  const gateway: RealtimeGateway = {
    emitToUser(userId, event, payload) {
      io.to(userRoom(userId)).emit(event, payload);
    },
    emitToRoom(room, event, payload) {
      io.to(room).emit(event, payload);
    },
  };

  setRealtimeGateway(gateway);
  logger.info("Realtime socket.io gateway initialized");
  return gateway;
}
