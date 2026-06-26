import { Ionicons } from "@/components/icons";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ConversationSummary } from "@workspace/api-client-react";
import { getConversations } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useSocketEvent } from "@/context/SocketContext";

function initials(name?: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "1d" : `${days}d`;
}

export default function MessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => getConversations(),
  });

  // Live updates: any incoming message or read receipt refreshes the list
  // (cheap — the list is small and the server already ordered it).
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  }, [queryClient]);
  useSocketEvent("dm:message", invalidate);
  useSocketEvent("dm:read", invalidate);

  const conversations = data?.items ?? [];
  const filtered = conversations.filter((c) => {
    const other = c.participants?.[0];
    return (other?.name ?? "").toLowerCase().includes(search.toLowerCase());
  });

  const openThread = (c: ConversationSummary) => {
    const other = c.participants?.[0];
    router.push({
      pathname: "/conversation/[id]",
      params: { id: c.id, name: other?.name ?? "Conversation" },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Messages</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search conversations..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No conversations yet. Open someone&apos;s profile and tap Message.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const other = item.participants?.[0];
            const unread = item.unreadCount > 0;
            const preview = item.lastMessage?.body
              ? item.lastMessage.body
              : item.lastMessage?.attachedTrack
                ? "🎵 Shared a track"
                : item.lastMessage?.attachedImageUrl
                  ? "📷 Photo"
                  : "Say hi";
            return (
              <Pressable
                style={[styles.conversation, { borderBottomColor: colors.border }]}
                onPress={() => openThread(item)}
              >
                {other?.avatarUrl ? (
                  <Image source={{ uri: other.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }]}>
                    <Text style={styles.avatarText}>{initials(other?.name)}</Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={styles.convTop}>
                    <Text
                      style={[styles.convName, { color: colors.foreground, fontWeight: unread ? "700" : "500" }]}
                      numberOfLines={1}
                    >
                      {other?.name ?? "Conversation"}
                    </Text>
                    <Text style={[styles.convTime, { color: unread ? colors.primary : colors.mutedForeground }]}>
                      {timeAgo(item.lastMessageAt)}
                    </Text>
                  </View>
                  <View style={styles.convBottom}>
                    <Text
                      style={[styles.convMsg, { color: unread ? colors.foreground : colors.mutedForeground, fontWeight: unread ? "500" : "400" }]}
                      numberOfLines={1}
                    >
                      {preview}
                    </Text>
                    {unread && (
                      <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.unreadText}>{item.unreadCount}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 20, fontWeight: "700" },
  searchWrap: { flexDirection: "row", alignItems: "center", marginHorizontal: 20, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8, gap: 8 },
  searchInput: { flex: 1, fontSize: 15 },
  empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 40, gap: 12 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  conversation: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  convTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  convName: { fontSize: 15, flex: 1, marginRight: 8 },
  convTime: { fontSize: 12 },
  convBottom: { flexDirection: "row", alignItems: "center" },
  convMsg: { flex: 1, fontSize: 13 },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", marginLeft: 8, paddingHorizontal: 6 },
  unreadText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});
