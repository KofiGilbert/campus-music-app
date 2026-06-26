import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { resolveApiBaseUrl } from "@/constants/config";
import { useAuth } from "@/context/AuthContext";

// A single shared socket.io connection for the whole app. It connects whenever
// the user is authenticated and tears down on sign-out or token change. Features
// (DMs now; live chat / notifications later) multiplex over this one connection
// using event names + rooms — see RealtimeGateway on the server.

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      return;
    }

    const base = resolveApiBaseUrl();
    // `base ?? "/"` lets web same-origin deployments connect to their own host.
    const next = io(base ?? "/", {
      auth: { token },
      transports: ["websocket"],
      autoConnect: true,
    });
    socketRef.current = next;
    setSocket(next);

    return () => {
      next.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket(): Socket | null {
  return useContext(SocketContext);
}

/** Subscribe to a socket event for the lifetime of the calling component. */
export function useSocketEvent(event: string, handler: (payload: unknown) => void): void {
  const socket = useSocket();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!socket) return;
    const listener = (payload: unknown) => handlerRef.current(payload);
    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [socket, event]);
}
