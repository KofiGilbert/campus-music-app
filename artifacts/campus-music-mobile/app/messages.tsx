import { Ionicons } from "@/components/icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const CONVERSATIONS = [
  { id: "c1", name: "Alex Martinez", avatar: "#e85d4a", lastMsg: "Did you hear the new drop? 🔥", time: "2m", unread: 2, online: true },
  { id: "c2", name: "Jordan Kim", avatar: "#3b82f6", lastMsg: "Come to the listening party tonight!", time: "15m", unread: 1, online: true },
  { id: "c3", name: "Sam Parker", avatar: "#8b5cf6", lastMsg: "Thanks for sharing my track!", time: "1h", unread: 0, online: false },
  { id: "c4", name: "Riley Thompson", avatar: "#f59e0b", lastMsg: "Open mic at 9 — you coming?", time: "3h", unread: 0, online: false },
  { id: "c5", name: "Drew Lee", avatar: "#10b981", lastMsg: "That collab idea sounds amazing", time: "Yesterday", unread: 0, online: true },
  { id: "c6", name: "Morgan Williams", avatar: "#ec4899", lastMsg: "Check out this new playlist I made", time: "Yesterday", unread: 0, online: false },
  { id: "c7", name: "Casey Chen", avatar: "#f97316", lastMsg: "Are you going to the concert?", time: "2 days", unread: 0, online: false },
];

export default function MessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [search, setSearch] = useState("");

  const filtered = CONVERSATIONS.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Messages</Text>
        <Pressable style={[styles.iconBtn, { backgroundColor: colors.card }]}>
          <Ionicons name="create-outline" size={20} color={colors.foreground} />
        </Pressable>
      </View>

      {/* Search */}
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

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable style={[styles.conversation, { borderBottomColor: colors.border }]}>
            <View style={{ position: "relative" }}>
              <View style={[styles.avatar, { backgroundColor: item.avatar }]}>
                <Ionicons name="person" size={20} color="#fff" />
              </View>
              {item.online && <View style={[styles.onlineDot, { borderColor: colors.background }]} />}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={styles.convTop}>
                <Text style={[styles.convName, { color: colors.foreground, fontWeight: item.unread > 0 ? "700" : "500" }]}>
                  {item.name}
                </Text>
                <Text style={[styles.convTime, { color: item.unread > 0 ? colors.primary : colors.mutedForeground }]}>
                  {item.time}
                </Text>
              </View>
              <View style={styles.convBottom}>
                <Text style={[styles.convMsg, { color: item.unread > 0 ? colors.foreground : colors.mutedForeground, fontWeight: item.unread > 0 ? "500" : "400" }]} numberOfLines={1}>
                  {item.lastMsg}
                </Text>
                {item.unread > 0 && (
                  <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.unreadText}>{item.unread}</Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 20, fontWeight: "700" },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  searchWrap: { flexDirection: "row", alignItems: "center", marginHorizontal: 20, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8, gap: 8 },
  searchInput: { flex: 1, fontSize: 15 },
  conversation: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  onlineDot: { position: "absolute", bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: "#22c55e", borderWidth: 2 },
  convTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  convName: { fontSize: 15 },
  convTime: { fontSize: 12 },
  convBottom: { flexDirection: "row", alignItems: "center" },
  convMsg: { flex: 1, fontSize: 13 },
  unreadBadge: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  unreadText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});
