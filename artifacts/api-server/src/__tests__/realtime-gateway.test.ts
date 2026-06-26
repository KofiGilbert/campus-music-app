import { describe, it, expect, beforeEach } from "vitest";
import {
  NoopGateway,
  conversationRoom,
  realtime,
  setRealtimeGateway,
  userRoom,
  type RealtimeGateway,
} from "../realtime/gateway";

describe("realtime gateway", () => {
  beforeEach(() => setRealtimeGateway(new NoopGateway()));

  it("builds stable room names", () => {
    expect(userRoom("u1")).toBe("user:u1");
    expect(conversationRoom("c1")).toBe("conv:c1");
  });

  it("defaults to a no-op gateway that never throws", () => {
    expect(() => realtime().emitToUser("u1", "dm:message", { a: 1 })).not.toThrow();
    expect(() => realtime().emitToRoom(conversationRoom("c1"), "dm:read", {})).not.toThrow();
  });

  it("routes emits through the installed gateway", () => {
    const calls: Array<[string, string, string, unknown]> = [];
    const spy: RealtimeGateway = {
      emitToUser: (userId, event, payload) => calls.push(["user", userId, event, payload]),
      emitToRoom: (room, event, payload) => calls.push(["room", room, event, payload]),
    };
    setRealtimeGateway(spy);
    realtime().emitToUser("u1", "dm:message", { id: "m1" });
    realtime().emitToRoom(conversationRoom("c1"), "dm:typing", { userId: "u1" });
    expect(calls).toEqual([
      ["user", "u1", "dm:message", { id: "m1" }],
      ["room", "conv:c1", "dm:typing", { userId: "u1" }],
    ]);
  });
});
