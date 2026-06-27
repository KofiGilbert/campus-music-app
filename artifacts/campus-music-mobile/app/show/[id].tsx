import { Ionicons } from "@/components/icons";
import { ResizeMode, Video } from "expo-av";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
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
import type { ShowChatMessage } from "@workspace/api-client-react";
import {
  getShow,
  getShowChat,
  joinShow,
  leaveShow,
  remindShow,
  sendShowChat,
  unremindShow,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";

export default function ShowScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const socket = useSocket();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const showId = id as string;
  const [messages, setMessages] = useState<ShowChatMessage[]>([]);
  const [text, setText] = useState("");
  const [viewers, setViewers] = useState<number | null>(null);
  const [reminded, setReminded] = useState<boolean | null>(null);

  const { data: show, isLoading } = useQuery({
    queryKey: ["show", showId],
    queryFn: () => getShow(showId),
    enabled: !!showId,
  });

  const isLive = show?.status === "live";
  const isEnded = show?.status === "ended";
  const streamUrl = isLive ? show?.playbackUrl : isEnded ? (show?.vodUrl ?? show?.playbackUrl) : null;

  useEffect(() => {
    if (!show) return;
    let active = true;
    getShowChat(showId).then((res) => active && setMessages(res.items));
    if (isLive) void joinShow(showId);
    return () => {
      active = false;
      if (isLive) void leaveShow(showId);
    };
  }, [show, showId, isLive]);

  useEffect(() => {
    if (!socket || !show) return;
    socket.emit("tv:join", showId);
    const onChat = (p: unknown) => {
      const m = p as ShowChatMessage;
      if (m.showId === showId) setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [m, ...prev]));
    };
    const onViewers = (p: unknown) => {
      const d = p as { showId: string; viewerCount: number };
      if (d.showId === showId) setViewers(d.viewerCount);
    };
    socket.on("tv:chat", onChat);
    socket.on("tv:viewers", onViewers);
    return () => {
      socket.emit("tv:leave", showId);
      socket.off("tv:chat", onChat);
      socket.off("tv:viewers", onViewers);
    };
  }, [socket, show, showId]);

  const send = async () => {
    const value = text.trim();
    if (!value) return;
    setText("");
    try {
      await sendShowChat(showId, { message: value });
    } catch {
      setText(value);
    }
  };

  const toggleRemind = async () => {
    const next = !(reminded ?? show?.isReminded ?? false);
    setReminded(next);
    try {
      if (next) await remindShow(showId);
      else await unremindShow(showId);
    } catch {
      setReminded(!next);
    }
  };

  if (isLoading || !show) {
    return (
      <View style={[styles.center, { backgroundColor: "#000", paddingTop: insets.top }]}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  const viewerCount = viewers ?? show.viewerCount;
  const isReminded = reminded ?? show.isReminded ?? false;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* Player / hero */}
      <View style={[styles.player, { paddingTop: insets.top }]}>
        {streamUrl ? (
          <Video
            source={{ uri: streamUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls
            shouldPlay
          />
        ) : (
          <View style={styles.scheduled}>
            <Ionicons name="tv-outline" size={48} color="#888" />
            <Text style={styles.scheduledText}>
              {show.scheduledAt ? `Starts ${new Date(show.scheduledAt).toLocaleString()}` : "Not started yet"}
            </Text>
          </View>
        )}
        <Pressable style={[styles.back, { top: insets.top + 8 }]} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </Pressable>
        {isLive && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE · {viewerCount}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={[styles.info, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{show.title}</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {show.type} {show.host?.name ? `· ${show.host.name}` : ""}
          </Text>
        </View>
        {show.status === "scheduled" && (
          <Pressable
            style={[styles.remindBtn, isReminded ? { borderColor: colors.border, borderWidth: 1 } : { backgroundColor: colors.primary }]}
            onPress={toggleRemind}
          >
            <Ionicons name={isReminded ? "notifications" : "notifications-outline"} size={15} color={isReminded ? colors.foreground : "#fff"} />
            <Text style={[styles.remindText, { color: isReminded ? colors.foreground : "#fff" }]}>
              {isReminded ? "Reminding" : "Remind me"}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Chat */}
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        inverted
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 14, gap: 8 }}
        renderItem={({ item }) => (
          <View style={styles.chatRow}>
            <Text style={[styles.chatName, { color: item.userId === user?.id ? colors.primary : colors.foreground }]}>
              {item.displayName || "User"}
            </Text>
            <Text style={[styles.chatMsg, { color: colors.foreground }]}>{item.message}</Text>
          </View>
        )}
      />

      {show.chatEnabled && (
        <View style={[styles.composer, { borderColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted }]}
            placeholder="Chat…"
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={setText}
            maxLength={200}
          />
          <Pressable onPress={send} disabled={!text.trim()} hitSlop={8}>
            <Ionicons name="send" size={22} color={text.trim() ? colors.primary : colors.mutedForeground} />
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  player: { height: 240, backgroundColor: "#000" },
  scheduled: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  scheduledText: { color: "#aaa", fontSize: 14 },
  back: { position: "absolute", left: 12 },
  liveBadge: { position: "absolute", right: 12, bottom: 12, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#e0245e" },
  liveText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  info: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderBottomWidth: 1 },
  title: { fontSize: 17, fontWeight: "700" },
  sub: { fontSize: 13, marginTop: 2 },
  remindBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  remindText: { fontSize: 13, fontWeight: "700" },
  chatRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chatName: { fontSize: 13, fontWeight: "700" },
  chatMsg: { fontSize: 14 },
  composer: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, paddingHorizontal: 12, paddingTop: 8 },
  input: { flex: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15 },
});
