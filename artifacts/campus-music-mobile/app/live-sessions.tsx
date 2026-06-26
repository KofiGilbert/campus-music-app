import { Ionicons } from "@/components/icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import type { LiveChatMessage, LiveSession } from "@workspace/api-client-react";
import {
  createLiveSession,
  endLiveSession,
  getLiveChat,
  getLiveSessions,
  joinLiveSession,
  leaveLiveSession,
  sendLiveChat,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";

// Real Live Now. The audio transport (LiveKit publish/subscribe) needs the native
// @livekit/react-native SDK + a dev/EAS build, so this screen ships the full
// non-audio experience now — discover live sessions, go live (artists), join,
// real-time chat, listener count — and shows a clear notice where audio attaches.

function LiveRoom({
  session,
  isHost,
  onLeave,
}: {
  session: LiveSession;
  isHost: boolean;
  onLeave: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const socket = useSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [text, setText] = useState("");
  const [listeners, setListeners] = useState(session.listenerCount);

  useEffect(() => {
    let active = true;
    getLiveChat(session.id).then((res) => {
      if (active) setMessages(res.items);
    });
    if (!isHost) void joinLiveSession(session.id);
    return () => {
      active = false;
      if (!isHost) void leaveLiveSession(session.id);
    };
  }, [session.id, isHost]);

  useEffect(() => {
    if (!socket) return;
    socket.emit("live:join", session.id);
    const onChat = (payload: unknown) => {
      const m = payload as LiveChatMessage;
      if (m.sessionId !== session.id) return;
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [m, ...prev]));
    };
    const onListeners = (payload: unknown) => {
      const p = payload as { sessionId: string; listenerCount: number };
      if (p.sessionId === session.id) setListeners(p.listenerCount);
    };
    const onEnded = (payload: unknown) => {
      if ((payload as { sessionId: string }).sessionId === session.id) onLeave();
    };
    socket.on("live:chat", onChat);
    socket.on("live:listeners", onListeners);
    socket.on("live:ended", onEnded);
    return () => {
      socket.emit("live:leave", session.id);
      socket.off("live:chat", onChat);
      socket.off("live:listeners", onListeners);
      socket.off("live:ended", onEnded);
    };
  }, [socket, session.id, onLeave]);

  const send = async () => {
    const value = text.trim();
    if (!value) return;
    setText("");
    try {
      await sendLiveChat(session.id, { body: value });
    } catch {
      setText(value);
    }
  };

  const end = async () => {
    try {
      await endLiveSession(session.id);
    } finally {
      onLeave();
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.roomHeader, { paddingTop: insets.top + 8, borderColor: colors.border }]}>
        <Pressable onPress={onLeave} hitSlop={12}>
          <Ionicons name="chevron-down" size={26} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[styles.roomTitle, { color: colors.foreground }]} numberOfLines={1}>
            {session.title || session.host?.name || "Live"}
          </Text>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={[styles.liveMeta, { color: colors.mutedForeground }]}>
              LIVE · {listeners} listening
            </Text>
          </View>
        </View>
        {isHost ? (
          <Pressable onPress={end} hitSlop={12}>
            <Text style={styles.endText}>End</Text>
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <View style={[styles.audioNotice, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="radio-outline" size={18} color={colors.primary} />
        <Text style={[styles.audioNoticeText, { color: colors.mutedForeground }]}>
          {isHost ? "You're hosting." : "Audio stream"} connects through LiveKit in the native build.
        </Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        inverted
        contentContainerStyle={{ padding: 16, gap: 10 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const mine = item.user?.id === user?.id;
          return (
            <View style={styles.chatRow}>
              <Text style={[styles.chatName, { color: mine ? colors.primary : colors.foreground }]}>
                {item.user?.name ?? "User"}
              </Text>
              <Text style={[styles.chatBody, { color: colors.foreground }]}>{item.body}</Text>
            </View>
          );
        }}
      />

      <View style={[styles.composer, { borderColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted }]}
          placeholder="Say something…"
          placeholderTextColor={colors.mutedForeground}
          value={text}
          onChangeText={setText}
          maxLength={200}
        />
        <Pressable onPress={send} disabled={!text.trim()} hitSlop={8}>
          <Ionicons name="send" size={22} color={text.trim() ? colors.primary : colors.mutedForeground} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

export default function LiveSessionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [active, setActive] = useState<{ session: LiveSession; isHost: boolean } | null>(null);
  const [starting, setStarting] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["liveSessions"],
    queryFn: () => getLiveSessions(),
    refetchInterval: active ? false : 10000,
  });

  const leave = useCallback(() => {
    setActive(null);
    void refetch();
  }, [refetch]);

  const goLive = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const session = await createLiveSession({ title: `${user?.name ?? "Artist"} live` });
      setActive({ session, isHost: true });
    } catch {
      // verification gate / network
    } finally {
      setStarting(false);
    }
  };

  if (active) {
    return <LiveRoom session={active.session} isHost={active.isHost} onLeave={leave} />;
  }

  const sessions = data?.items ?? [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Live Now</Text>
        <View style={{ width: 24 }} />
      </View>

      {user?.role === "artist" && (
        <Pressable style={[styles.goLive, { backgroundColor: colors.primary }]} onPress={goLive} disabled={starting}>
          {starting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="radio" size={18} color="#fff" />
              <Text style={styles.goLiveText}>Go Live</Text>
            </>
          )}
        </Pressable>
      )}

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="radio-outline" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No one is live right now.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setActive({ session: item, isHost: item.host?.id === user?.id })}
            >
              <View style={[styles.cardDot]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
                  {item.title || `${item.host?.name ?? "Artist"} live`}
                </Text>
                <Text style={[styles.cardHost, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {item.host?.name ?? "Artist"} · {item.listenerCount} listening
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 20, fontWeight: "700" },
  goLive: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: 16, marginBottom: 8, paddingVertical: 12, borderRadius: 24 },
  goLiveText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  cardDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#e0245e" },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  cardHost: { fontSize: 13, marginTop: 2 },
  roomHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1, gap: 8 },
  roomTitle: { fontSize: 16, fontWeight: "700" },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#e0245e" },
  liveMeta: { fontSize: 12, fontWeight: "600" },
  endText: { color: "#e0245e", fontSize: 15, fontWeight: "700" },
  audioNotice: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 10, padding: 10, borderRadius: 10, borderWidth: 1 },
  audioNoticeText: { fontSize: 12, flex: 1 },
  chatRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chatName: { fontSize: 13, fontWeight: "700" },
  chatBody: { fontSize: 14 },
  composer: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, paddingHorizontal: 12, paddingTop: 8 },
  input: { flex: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15 },
});
