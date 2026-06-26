import { Ionicons } from "@/components/icons";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Notification } from "@workspace/api-client-react";
import {
  getNotificationPrefs,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPrefs,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useSocketEvent } from "@/context/SocketContext";

const TYPE_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; verb: string }> = {
  follow: { icon: "person-add", color: "#3b82f6", verb: "followed you" },
  post_like: { icon: "heart", color: "#e0245e", verb: "liked your post" },
  comment: { icon: "chatbubble-outline", color: "#8b5cf6", verb: "commented" },
  message: { icon: "mail-outline", color: "#10b981", verb: "messaged you" },
  connection_accepted: { icon: "people-outline", color: "#f59e0b", verb: "accepted your request" },
  live_started: { icon: "radio-outline", color: "#e85d4a", verb: "is live now" },
};

const PREF_TYPES: { key: string; label: string }[] = [
  { key: "follow", label: "New followers" },
  { key: "post_like", label: "Likes on your posts" },
  { key: "comment", label: "Comments" },
  { key: "message", label: "Direct messages" },
  { key: "connection_accepted", label: "Accepted connections" },
  { key: "live_started", label: "Artists going live" },
];

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function targetRoute(n: Notification): string | null {
  if (n.targetType === "post" && n.targetId) return `/post/${n.targetId}`;
  if (n.targetType === "user" && n.actor?.id) return `/profile/${n.actor.id}`;
  if (n.targetType === "conversation" && n.targetId) return `/conversation/${n.targetId}`;
  if (n.targetType === "live") return `/live-sessions`;
  return null;
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [showPrefs, setShowPrefs] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(),
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notifications", "unread"] });
  }, [queryClient]);
  useSocketEvent("notification:new", invalidate);

  const onTap = async (n: Notification) => {
    if (!n.readAt) {
      await markNotificationRead(n.id);
      invalidate();
    }
    const route = targetRoute(n);
    if (route) router.push(route as never);
  };

  const readAll = async () => {
    await markAllNotificationsRead();
    invalidate();
  };

  const items = data?.items ?? [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Notifications</Text>
        <Pressable onPress={() => setShowPrefs(true)} hitSlop={12}>
          <Ionicons name="settings-outline" size={20} color={colors.foreground} />
        </Pressable>
      </View>

      {items.length > 0 && (
        <Pressable onPress={readAll} style={styles.readAll}>
          <Text style={[styles.readAllText, { color: colors.primary }]}>Mark all read</Text>
        </Pressable>
      )}

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          refreshing={isRefetching}
          onRefresh={refetch}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>You&apos;re all caught up.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const meta = TYPE_META[item.type] ?? { icon: "notifications" as const, color: colors.primary, verb: item.type };
            return (
              <Pressable
                style={[styles.row, { borderBottomColor: colors.border, backgroundColor: item.readAt ? "transparent" : colors.card }]}
                onPress={() => onTap(item)}
              >
                <View style={[styles.iconWrap, { backgroundColor: meta.color + "22" }]}>
                  <Ionicons name={meta.icon} size={18} color={meta.color} />
                </View>
                {item.actor?.avatarUrl ? (
                  <Image source={{ uri: item.actor.avatarUrl }} style={styles.avatar} />
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowText, { color: colors.foreground }]} numberOfLines={2}>
                    <Text style={{ fontWeight: "700" }}>{item.actor?.name ?? "Someone"}</Text> {meta.verb}
                    {item.body ? `: ${item.body}` : ""}
                  </Text>
                  <Text style={[styles.rowTime, { color: colors.mutedForeground }]}>{timeAgo(item.createdAt)}</Text>
                </View>
                {!item.readAt && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
              </Pressable>
            );
          }}
        />
      )}

      <PrefsModal visible={showPrefs} onClose={() => setShowPrefs(false)} />
    </View>
  );
}

function PrefsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data, refetch } = useQuery({
    queryKey: ["notificationPrefs"],
    queryFn: () => getNotificationPrefs(),
    enabled: visible,
  });
  const prefs = (data?.prefs ?? {}) as Record<string, boolean>;

  const toggle = async (key: string, value: boolean) => {
    await updateNotificationPrefs({ prefs: { [key]: value } });
    await refetch();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.sheetHandle} />
        <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Notification settings</Text>
        {PREF_TYPES.map((p) => (
          <View key={p.key} style={[styles.prefRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.prefLabel, { color: colors.foreground }]}>{p.label}</Text>
            <Switch
              value={prefs[p.key] !== false}
              onValueChange={(v) => toggle(p.key, v)}
              trackColor={{ true: colors.primary }}
            />
          </View>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 20, fontWeight: "700" },
  readAll: { alignItems: "flex-end", paddingHorizontal: 20, paddingBottom: 8 },
  readAllText: { fontSize: 13, fontWeight: "600" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  iconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  rowText: { fontSize: 14, lineHeight: 19 },
  rowTime: { fontSize: 12, marginTop: 3 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 10 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#555", alignSelf: "center", marginBottom: 14 },
  sheetTitle: { fontSize: 17, fontWeight: "700", marginBottom: 8 },
  prefRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1 },
  prefLabel: { fontSize: 15 },
});
