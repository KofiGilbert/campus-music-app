import { Ionicons } from "@/components/icons";
import * as Haptics from "expo-haptics";
import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  getConnections,
  useSearchConnections,
  getSearchConnectionsQueryKey,
  useSendConnectionRequest,
  useRespondToConnectionRequest,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import type { ConnectionUser } from "@workspace/api-client-react";

type ConnectTab = "friends" | "discover" | "sent" | "requests";

function UserAvatar({ avatarUrl, coverColor }: { avatarUrl?: string | null; coverColor: string }) {
  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />;
  }
  return (
    <View style={[styles.avatar, { backgroundColor: coverColor }]}>
      <Ionicons name="person" size={20} color="#fff" />
    </View>
  );
}

export default function ConnectScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [activeTab, setActiveTab] = useState<ConnectTab>("friends");
  const queryClient = useQueryClient();
  const router = useRouter();

  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchResultOverrides, setSearchResultOverrides] = useState<Record<string, ConnectionUser["status"]>>({});

  useEffect(() => {
    if (!searchQuery.trim()) {
      setDebouncedQuery("");
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: rawSearchResults = [], isFetching: isSearching } = useSearchConnections(
    { q: debouncedQuery },
    {
      query: {
        queryKey: getSearchConnectionsQueryKey({ q: debouncedQuery }),
        enabled: debouncedQuery.length > 0 && searchVisible,
        staleTime: 0,
      },
    }
  );

  const searchResults = rawSearchResults.map((r) =>
    searchResultOverrides[r.id] !== undefined
      ? { ...r, status: searchResultOverrides[r.id] }
      : r
  );

  const handleViewProfile = (userId: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    router.push(`/profile/${userId}` as never);
  };

  const { data: friendsData, isLoading: isFriendsLoading } = useQuery({
    queryKey: ["connections", "friends"],
    queryFn: () => getConnections({ type: "friends" }),
    staleTime: 0,
  });

  const { data: discoverConnections, isLoading: isDiscoverLoading } = useQuery({
    queryKey: ["connections", "discover"],
    queryFn: () => getConnections({ type: "discover" }),
    staleTime: 0,
  });

  const { data: sentData, isLoading: isSentLoading } = useQuery({
    queryKey: ["connections", "sent"],
    queryFn: () => getConnections({ type: "sent" }),
    staleTime: 0,
  });

  const { data: requestsData, isLoading: isRequestsLoading } = useQuery({
    queryKey: ["connections", "requests"],
    queryFn: () => getConnections({ type: "requests" }),
    staleTime: 0,
  });

  const invalidateConnections = () => {
    void queryClient.invalidateQueries({ queryKey: ["connections"] });
  };

  const connectMutation = useSendConnectionRequest({
    mutation: {
      onSuccess: (data, variables) => {
        invalidateConnections();
        setSearchResultOverrides((prev) => ({ ...prev, [variables.userId]: data.status as ConnectionUser["status"] }));
      },
    },
  });

  const respondMutation = useRespondToConnectionRequest({
    mutation: {
      onSuccess: (data, variables) => {
        invalidateConnections();
        setSearchResultOverrides((prev) => ({ ...prev, [variables.userId]: data.status as ConnectionUser["status"] }));
      },
    },
  });

  const pendingRequestsCount = (requestsData ?? []).length;

  const TABS: { id: ConnectTab; label: string; count?: number }[] = [
    { id: "friends", label: "Friends" },
    { id: "discover", label: "Discover" },
    { id: "sent", label: "Sent", count: (sentData ?? []).length || undefined },
    { id: "requests", label: "Requests", count: pendingRequestsCount || undefined },
  ];

  const handleTab = (tab: ConnectTab) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setActiveTab(tab);
  };

  const handleConnect = (userId: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    connectMutation.mutate({ userId, data: { connect: true } });
  };

  const handleWithdraw = (userId: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    connectMutation.mutate({ userId, data: { connect: false } });
  };

  const handleAccept = (userId: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    respondMutation.mutate({ userId, data: { accept: true } });
  };

  const handleDecline = (userId: string) => {
    respondMutation.mutate({ userId, data: { accept: false } });
  };

  const openSearch = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSearchVisible(true);
    setSearchQuery("");
    setDebouncedQuery("");
    setSearchResultOverrides({});
  };

  const closeSearch = () => {
    setSearchVisible(false);
    setSearchQuery("");
    setDebouncedQuery("");
    setSearchResultOverrides({});
  };

  const renderSearchResultItem = ({ item }: { item: ConnectionUser }) => (
    <Pressable
      style={[styles.friendCard, { backgroundColor: colors.card }]}
      onPress={() => { closeSearch(); handleViewProfile(item.id); }}
    >
      <UserAvatar avatarUrl={item.avatarUrl} coverColor={item.coverColor} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
        <Text style={[styles.uni, { color: colors.mutedForeground }]}>
          {item.university} · {item.genre}
        </Text>
      </View>
      {item.status === "connected" ? (
        <View style={[styles.connectedBtn, { backgroundColor: colors.muted }]}>
          <Ionicons name="checkmark" size={14} color={colors.mutedForeground} />
          <Text style={[styles.connectedText, { color: colors.mutedForeground }]}>Friends</Text>
        </View>
      ) : item.status === "sent" ? (
        <Pressable
          style={[styles.connectedBtn, { backgroundColor: colors.muted }]}
          onPress={(e) => { e.stopPropagation?.(); handleWithdraw(item.id); }}
          disabled={connectMutation.isPending}
        >
          <Text style={[styles.connectedText, { color: colors.mutedForeground }]}>Sent</Text>
        </Pressable>
      ) : item.status === "received" ? (
        <View style={styles.reqActions}>
          <Pressable
            style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
            onPress={(e) => { e.stopPropagation?.(); handleAccept(item.id); }}
            disabled={respondMutation.isPending}
          >
            <Ionicons name="checkmark" size={16} color="#fff" />
          </Pressable>
          <Pressable
            style={[styles.declineBtn, { borderColor: colors.border }]}
            onPress={(e) => { e.stopPropagation?.(); handleDecline(item.id); }}
            disabled={respondMutation.isPending}
          >
            <Ionicons name="close" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={[styles.connectBtn, { backgroundColor: colors.primary }]}
          onPress={(e) => { e.stopPropagation?.(); handleConnect(item.id); }}
          disabled={connectMutation.isPending}
        >
          <Ionicons name="person-add-outline" size={14} color="#fff" />
          <Text style={styles.connectText}>Connect</Text>
        </Pressable>
      )}
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Connect</Text>
        <Pressable style={[styles.iconBtn, { backgroundColor: colors.card }]} onPress={openSearch}>
          <Ionicons name="search-outline" size={20} color={colors.foreground} />
        </Pressable>
      </View>

      <View style={[styles.tabsRow, { borderBottomColor: colors.border }]}>
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Pressable key={tab.id} onPress={() => handleTab(tab.id)} style={[styles.tab, { borderBottomColor: active ? colors.primary : "transparent" }]}>
              <Text style={[styles.tabText, { color: active ? colors.primary : colors.mutedForeground }]}>
                {tab.label}{tab.count ? ` (${tab.count})` : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {activeTab === "friends" && (
        <FlatList
          data={friendsData ?? []}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              {isFriendsLoading
                ? <ActivityIndicator color={colors.primary} />
                : <>
                    <Ionicons name="people-outline" size={48} color={colors.mutedForeground} />
                    <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No friends yet</Text>
                    <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>Tap the search icon to find people</Text>
                  </>}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.friendCard, { backgroundColor: colors.card }]}
              onPress={() => handleViewProfile(item.id)}
            >
              <UserAvatar avatarUrl={item.avatarUrl} coverColor={item.coverColor} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.uni, { color: colors.mutedForeground }]}>{item.university} · {item.mutualCount} mutual</Text>
              </View>
              <Pressable
                style={[styles.msgBtn, { backgroundColor: colors.primary + "15" }]}
                onPress={(e) => { e.stopPropagation?.(); }}
              >
                <Ionicons name="chatbubble-outline" size={18} color={colors.primary} />
              </Pressable>
            </Pressable>
          )}
        />
      )}

      {activeTab === "discover" && (
        <FlatList
          data={discoverConnections ?? []}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              {isDiscoverLoading
                ? <ActivityIndicator color={colors.primary} />
                : <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No suggestions</Text>}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.friendCard, { backgroundColor: colors.card }]}
              onPress={() => handleViewProfile(item.id)}
            >
              <UserAvatar avatarUrl={item.avatarUrl} coverColor={item.coverColor} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.uni, { color: colors.mutedForeground }]}>{item.university} · {item.genre}</Text>
                <Text style={[styles.mutual, { color: colors.mutedForeground }]}>{item.mutualCount} mutual friends</Text>
              </View>
              {item.status === "connected" ? (
                <View style={[styles.connectedBtn, { backgroundColor: colors.muted }]}>
                  <Ionicons name="checkmark" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.connectedText, { color: colors.mutedForeground }]}>Friends</Text>
                </View>
              ) : item.status === "sent" ? (
                <View style={[styles.connectedBtn, { backgroundColor: colors.muted }]}>
                  <Ionicons name="checkmark" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.connectedText, { color: colors.mutedForeground }]}>Sent</Text>
                </View>
              ) : item.status === "received" ? (
                <View style={styles.reqActions}>
                  <Pressable
                    style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
                    onPress={(e) => { e.stopPropagation?.(); handleAccept(item.id); }}
                    disabled={respondMutation.isPending}
                  >
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </Pressable>
                  <Pressable
                    style={[styles.declineBtn, { borderColor: colors.border }]}
                    onPress={(e) => { e.stopPropagation?.(); handleDecline(item.id); }}
                    disabled={respondMutation.isPending}
                  >
                    <Ionicons name="close" size={16} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={[styles.connectBtn, { backgroundColor: colors.primary }]}
                  onPress={(e) => { e.stopPropagation?.(); handleConnect(item.id); }}
                  disabled={connectMutation.isPending}
                >
                  <Ionicons name="person-add-outline" size={14} color="#fff" />
                  <Text style={styles.connectText}>Connect</Text>
                </Pressable>
              )}
            </Pressable>
          )}
        />
      )}

      {activeTab === "sent" && (
        <FlatList
          data={sentData ?? []}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              {isSentLoading
                ? <ActivityIndicator color={colors.primary} />
                : <>
                    <Ionicons name="paper-plane-outline" size={48} color={colors.mutedForeground} />
                    <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No sent requests</Text>
                  </>}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.friendCard, { backgroundColor: colors.card }]}
              onPress={() => handleViewProfile(item.id)}
            >
              <UserAvatar avatarUrl={item.avatarUrl} coverColor={item.coverColor} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.uni, { color: colors.mutedForeground }]}>{item.university} · {item.genre}</Text>
              </View>
              <Pressable
                style={[styles.withdrawBtn, { borderColor: colors.border }]}
                onPress={(e) => { e.stopPropagation?.(); handleWithdraw(item.id); }}
                disabled={connectMutation.isPending}
              >
                <Text style={[styles.withdrawText, { color: colors.mutedForeground }]}>Withdraw</Text>
              </Pressable>
            </Pressable>
          )}
        />
      )}

      {activeTab === "requests" && (
        <FlatList
          data={requestsData ?? []}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              {isRequestsLoading
                ? <ActivityIndicator color={colors.primary} />
                : <>
                    <Ionicons name="people-outline" size={48} color={colors.mutedForeground} />
                    <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No pending requests</Text>
                  </>}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.friendCard, { backgroundColor: colors.card }]}
              onPress={() => handleViewProfile(item.id)}
            >
              <UserAvatar avatarUrl={item.avatarUrl} coverColor={item.coverColor} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.uni, { color: colors.mutedForeground }]}>{item.university} · {item.mutualCount} mutual</Text>
              </View>
              <View style={styles.reqActions}>
                <Pressable
                  style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
                  onPress={(e) => { e.stopPropagation?.(); handleAccept(item.id); }}
                  disabled={respondMutation.isPending}
                >
                  <Ionicons name="checkmark" size={16} color="#fff" />
                </Pressable>
                <Pressable
                  style={[styles.declineBtn, { borderColor: colors.border }]}
                  onPress={(e) => { e.stopPropagation?.(); handleDecline(item.id); }}
                  disabled={respondMutation.isPending}
                >
                  <Ionicons name="close" size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </Pressable>
          )}
        />
      )}

      <Modal
        visible={searchVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeSearch}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
            <View style={[styles.searchBar, { backgroundColor: colors.card }]}>
              <Ionicons name="search-outline" size={18} color={colors.mutedForeground} style={{ marginLeft: 12 }} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground }]}
                placeholder="Search by name or university..."
                placeholderTextColor={colors.mutedForeground}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>
            <Pressable style={styles.cancelBtn} onPress={closeSearch}>
              <Text style={[styles.cancelText, { color: colors.primary }]}>Cancel</Text>
            </Pressable>
          </View>

          {isSearching ? (
            <View style={styles.searchState}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : searchQuery.trim() && searchResults.length === 0 && debouncedQuery === searchQuery.trim() ? (
            <View style={styles.searchState}>
              <Ionicons name="person-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No users found</Text>
              <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>Try a different name or university</Text>
            </View>
          ) : !searchQuery.trim() ? (
            <View style={styles.searchState}>
              <Ionicons name="people-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Find students to connect with</Text>
              <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>Search by name or university</Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              renderItem={renderSearchResultItem}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  tabsRow: { flexDirection: "row", paddingHorizontal: 20, borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2 },
  tabText: { fontSize: 13, fontWeight: "600" },
  friendCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 16, marginBottom: 10, gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  avatarImg: { width: 46, height: 46, borderRadius: 23 },
  name: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  uni: { fontSize: 12 },
  mutual: { fontSize: 11, marginTop: 1 },
  msgBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  connectBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  connectText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  connectedBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  connectedText: { fontSize: 13, fontWeight: "600" },
  withdrawBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, borderWidth: 1 },
  withdrawText: { fontSize: 12, fontWeight: "600" },
  reqActions: { flexDirection: "row", gap: 8 },
  acceptBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  declineBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
  emptyHint: { fontSize: 13, opacity: 0.7 },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 10, borderBottomWidth: 1 },
  searchBar: { flex: 1, flexDirection: "row", alignItems: "center", borderRadius: 14, height: 44 },
  searchInput: { flex: 1, paddingHorizontal: 10, fontSize: 15, height: 44 },
  cancelBtn: { paddingVertical: 8, paddingLeft: 4 },
  cancelText: { fontSize: 15, fontWeight: "600" },
  searchState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingBottom: 80 },
});
