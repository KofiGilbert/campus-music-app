// RealtimeGateway — the seam between HTTP request handlers and the live socket
// layer. Routes depend ONLY on this interface, never on socket.io directly, so a
// future swap to Ably / Pusher / PartyKit is one adapter change (see
// CLAUDE_ROADMAP §3.7). The concrete socket.io implementation lives in
// socketGateway.ts; tests and CI run with the NoopGateway so REST works without a
// socket server.

export interface RealtimeGateway {
  /** Push an event to every live socket belonging to a user (all their devices). */
  emitToUser(userId: string, event: string, payload: unknown): void;
  /** Push an event to everyone currently in a room (e.g. a conversation thread). */
  emitToRoom(room: string, event: string, payload: unknown): void;
}

export class NoopGateway implements RealtimeGateway {
  emitToUser(): void {}
  emitToRoom(): void {}
}

let current: RealtimeGateway = new NoopGateway();

export function setRealtimeGateway(gateway: RealtimeGateway): void {
  current = gateway;
}

/** The active gateway. Returns the NoopGateway until a real one is installed. */
export function realtime(): RealtimeGateway {
  return current;
}

// Room-name helpers — keep the naming convention in one place so emitters and
// the socket layer never drift.
export const userRoom = (userId: string): string => `user:${userId}`;
export const conversationRoom = (conversationId: string): string => `conv:${conversationId}`;
export const liveRoom = (sessionId: string): string => `live:${sessionId}`;
