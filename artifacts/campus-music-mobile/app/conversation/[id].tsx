import { Ionicons } from "@/components/icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Message } from "@workspace/api-client-react";
import { getMessages, markConversationRead, sendMessage } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";

function isMessage(payload: unknown): payload is Message {
  return !!payload && typeof payload === "object" && "id" in payload && "conversationId" in payload;
}

function clockTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ConversationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const socket = useSocket();
  const { user } = useAuth();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const conversationId = id as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => getMessages(conversationId, { limit: 40 }),
    enabled: !!conversationId,
  });

  useEffect(() => {
    if (data?.items) setMessages(data.items);
  }, [data]);

  const markRead = useCallback(() => {
    if (!conversationId) return;
    void markConversationRead(conversationId).then(() => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    });
  }, [conversationId, queryClient]);

  // Join the conversation room (for typing) + mark read on open.
  useEffect(() => {
    if (!socket || !conversationId) return;
    socket.emit("dm:join", conversationId);
    markRead();
    return () => {
      socket.emit("dm:leave", conversationId);
    };
  }, [socket, conversationId, markRead]);

  // Live message + typing handling.
  useEffect(() => {
    if (!socket) return;
    const onMessage = (payload: unknown) => {
      if (!isMessage(payload) || payload.conversationId !== conversationId) return;
      setMessages((prev) => (prev.some((m) => m.id === payload.id) ? prev : [payload, ...prev]));
      markRead();
    };
    const onTyping = (payload: unknown) => {
      const p = payload as { conversationId?: string; userId?: string };
      if (p.conversationId !== conversationId || p.userId === user?.id) return;
      setOtherTyping(true);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => setOtherTyping(false), 2500);
    };
    socket.on("dm:message", onMessage);
    socket.on("dm:typing", onTyping);
    return () => {
      socket.off("dm:message", onMessage);
      socket.off("dm:typing", onTyping);
    };
  }, [socket, conversationId, user?.id, markRead]);

  const onChangeText = (value: string) => {
    setText(value);
    socket?.emit("dm:typing", { conversationId });
  };

  const handleSend = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setText("");
    try {
      const msg = await sendMessage(conversationId, { body: value });
      // Append immediately; the socket echo is de-duped by id above.
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [msg, ...prev]));
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch {
      setText(value);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8, borderColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerName, { color: colors.foreground }]} numberOfLines={1}>
          {name ?? "Conversation"}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          inverted
          contentContainerStyle={{ padding: 16, gap: 8 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const mine = item.sender?.id === user?.id;
            return (
              <View style={[styles.row, { justifyContent: mine ? "flex-end" : "flex-start" }]}>
                <View
                  style={[
                    styles.bubble,
                    mine
                      ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
                      : { backgroundColor: colors.card, borderBottomLeftRadius: 4 },
                  ]}
                >
                  {!!item.body && (
                    <Text style={[styles.bubbleText, { color: mine ? "#fff" : colors.foreground }]}>
                      {item.body}
                    </Text>
                  )}
                  {item.attachedTrack && (
                    <Text style={[styles.attachment, { color: mine ? "#fff" : colors.foreground }]}>
                      🎵 {item.attachedTrack.title} — {item.attachedTrack.artist}
                    </Text>
                  )}
                  {item.attachedImageUrl && (
                    <Image source={{ uri: item.attachedImageUrl }} style={styles.attachedImage} />
                  )}
                  <Text style={[styles.time, { color: mine ? "rgba(255,255,255,0.7)" : colors.mutedForeground }]}>
                    {clockTime(item.createdAt)}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {otherTyping && (
        <Text style={[styles.typing, { color: colors.mutedForeground }]}>
          {name ?? "They"} is typing…
        </Text>
      )}

      <View style={[styles.composer, { borderColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted }]}
          placeholder="Message…"
          placeholderTextColor={colors.mutedForeground}
          value={text}
          onChangeText={onChangeText}
          multiline
          maxLength={2000}
        />
        <Pressable onPress={handleSend} disabled={!text.trim() || sending} hitSlop={8}>
          {sending ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Ionicons name="send" size={24} color={text.trim() ? colors.primary : colors.mutedForeground} />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  headerName: { flex: 1, fontSize: 17, fontWeight: "700", textAlign: "center" },
  row: { flexDirection: "row" },
  bubble: { maxWidth: "78%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  attachment: { fontSize: 13, marginTop: 4, fontWeight: "600" },
  attachedImage: { width: 180, height: 180, borderRadius: 12, marginTop: 6 },
  time: { fontSize: 10, marginTop: 4, alignSelf: "flex-end" },
  typing: { fontSize: 12, paddingHorizontal: 18, paddingBottom: 4 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  input: { flex: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, maxHeight: 120 },
});
