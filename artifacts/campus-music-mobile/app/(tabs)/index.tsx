import { Ionicons } from "@/components/icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { TrackCover } from "@/components/TrackCover";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Post as ApiPost } from "@workspace/api-client-react";
import { getFeed } from "@workspace/api-client-react";
import { NowPlayingBar } from "@/components/NowPlayingBar";
import { PostCard } from "@/components/PostCard";
import { EcosystemDrawer } from "@/components/EcosystemDrawer";
import { ResumePromptBanner } from "@/components/ResumePromptBanner";
import { useAuth } from "@/context/AuthContext";
import { usePlayer } from "@/context/PlayerContext";
import { useColors } from "@/hooks/useColors";

// ─── Seed live artists ────────────────────────────────────────────────────────
// Kept hardcoded per Phase 3 Decision J (live streaming is a separate feature).
const LIVE_ARTISTS = [
  { id: "a9", initials: "HH", name: "Hip Hop Collective", color: "#f97316", viewers: 1200, live: true, genre: "Hip Hop",
    photo: "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800&q=90&fit=crop" },
  { id: "a5", initials: "RS", name: "R&B Society", color: "#10b981", viewers: 198, live: true, genre: "R&B",
    photo: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&q=90&fit=crop" },
  { id: "a6", initials: "LC", name: "Lo-Fi Club", color: "#6366f1", viewers: 870, live: true, genre: "Lo-Fi",
    photo: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&q=90&fit=crop" },
  { id: "a10", initials: "AL", name: "Ambient Lab", color: "#0ea5e9", viewers: 5400, live: true, genre: "Ambient",
    photo: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=90&fit=crop" },
  { id: "a1", initials: "CC", name: "Campus Collective", color: "#e85d4a", viewers: 23, live: false, genre: "Indie",
    photo: "https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=800&q=90&fit=crop" },
  { id: "a7", initials: "SW", name: "Synth Wave", color: "#ec4899", viewers: 760, live: true, genre: "Electronic",
    photo: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=90&fit=crop" },
];

type FeedTab = "live" | "latest" | "trending";

// ─── Pulsing dot ──────────────────────────────────────────────────────────────
function PulsingDot() {
  const pulse = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.6, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <View style={{ width: 14, height: 14, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          position: "absolute",
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: "#e85d4a",
          opacity,
          transform: [{ scale: pulse }],
        }}
      />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#e85d4a" }} />
    </View>
  );
}

// ─── Format viewer count ───────────────────────────────────────────────────────
function fmtViewers(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ─── Live artist chip ─────────────────────────────────────────────────────────
function LiveChip({ artist }: { artist: (typeof LIVE_ARTISTS)[0] }) {
  const colors = useColors();
  const router = useRouter();
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!artist.live) return;
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(ringScale, { toValue: 1.18, duration: 900, useNativeDriver: true }),
          Animated.timing(ringScale, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(ringOpacity, { toValue: 0.15, duration: 900, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.6, duration: 900, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, [artist.live]);

  return (
    <Pressable
      style={styles.liveChipWrap}
      onPress={() => {
        if (!artist.live) return;
        router.push({
          pathname: "/live",
          params: {
            id: artist.id,
            name: artist.name,
            color: artist.color,
            photo: artist.photo,
            genre: artist.genre,
            viewers: String(artist.viewers),
          },
        });
      }}
    >
      <View style={styles.liveChipCircleWrap}>
        {artist.live && (
          <Animated.View
            style={[
              styles.liveRing,
              { borderColor: artist.color, opacity: ringOpacity, transform: [{ scale: ringScale }] },
            ]}
          />
        )}
        <TrackCover
          coverUrl={artist.photo}
          coverColor={artist.color}
          size={50}
          thumbSize={100}
          circular
          iconSize={0}
        />
        {artist.live && (
          <View style={[styles.liveBadge, { backgroundColor: "#e85d4a" }]}>
            <Ionicons name="eye" size={8} color="#fff" />
            <Text style={styles.liveBadgeText}>{fmtViewers(artist.viewers)}</Text>
          </View>
        )}
      </View>

      <Text style={[styles.liveChipName, { color: colors.foreground }]} numberOfLines={1}>
        {artist.name}
      </Text>
    </Pressable>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
const PAGE_SIZE = 20;

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { currentTrack, isPlaying, isLoading, togglePlay, nextTrack, crossDeviceResume, confirmCrossDeviceResume, dismissCrossDeviceResume } = usePlayer();
  const [feedTab, setFeedTab] = useState<FeedTab>("latest");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [items, setItems] = useState<ApiPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const loadingRef = useRef(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const displayName = user?.name ?? "Campus";
  const initials = displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const loadFeed = useCallback(
    async (reset: boolean) => {
      if (loadingRef.current) return;
      if (!reset && !cursor && loadedOnce) return; // no more pages
      loadingRef.current = true;
      setLoading(true);
      try {
        const res = await getFeed({ limit: PAGE_SIZE, ...(!reset && cursor ? { cursor } : {}) });
        setItems((prev) => (reset ? res.items : [...prev, ...res.items]));
        setCursor(res.nextCursor);
        setLoadedOnce(true);
      } catch {
        // keep whatever we have; surface nothing intrusive
      } finally {
        loadingRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [cursor, loadedOnce]
  );

  useEffect(() => {
    loadFeed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setCursor(null);
    loadFeed(true);
  }, [loadFeed]);

  const onEndReached = useCallback(() => {
    if (!loadingRef.current && cursor) loadFeed(false);
  }, [cursor, loadFeed]);

  const liveCount = LIVE_ARTISTS.filter((a) => a.live).length;

  const TABS: { id: FeedTab; label: string }[] = [
    { id: "live", label: "Live" },
    { id: "latest", label: "Latest" },
    { id: "trending", label: "Trending" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 140 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={{ marginHorizontal: -16 }}>
            {/* ── Header ── */}
            <View style={[styles.header, { paddingTop: topPad + 10 }]}>
              <Pressable onPress={() => setDrawerOpen(true)}>
                {user?.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={styles.headerAvatar} contentFit="cover" />
                ) : (
                  <View style={[styles.headerAvatar, { backgroundColor: "#3a3a3a" }]}>
                    <Text style={styles.headerAvatarText}>{initials}</Text>
                  </View>
                )}
              </Pressable>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.headerTitle, { color: colors.foreground }]}>Campus Feed</Text>
                <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
                  Posts from people you follow
                </Text>
              </View>
              <Pressable style={[styles.iconBtn, { backgroundColor: colors.card }]}>
                <Ionicons name="notifications-outline" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            {/* ── Cross-device resume prompt ── */}
            {crossDeviceResume && (
              <ResumePromptBanner
                prompt={crossDeviceResume}
                onResume={confirmCrossDeviceResume}
                onDismiss={dismissCrossDeviceResume}
              />
            )}

            {/* ── Live Now strip ── */}
            <View style={[styles.liveStrip, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.liveStripHeader}>
                <PulsingDot />
                <Text style={[styles.liveStripTitle, { color: colors.foreground }]}>Live Now</Text>
                <View style={styles.liveStripRight}>
                  <Text style={[styles.liveStripCount, { color: colors.mutedForeground }]}>
                    {liveCount} streaming
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.liveRow}>
                {LIVE_ARTISTS.map((a) => <LiveChip key={a.id} artist={a} />)}
              </ScrollView>
            </View>

            {/* ── Feed tabs ── */}
            <View style={[styles.feedTabs, { borderColor: colors.border }]}>
              {TABS.map((tab) => {
                const active = feedTab === tab.id;
                return (
                  <Pressable
                    key={tab.id}
                    style={[
                      styles.feedTab,
                      { backgroundColor: active ? colors.foreground : colors.card, borderColor: colors.border },
                    ]}
                    onPress={() => {
                      if (Platform.OS !== "web") Haptics.selectionAsync();
                      setFeedTab(tab.id);
                    }}
                  >
                    <Text style={[styles.feedTabText, { color: active ? colors.background : colors.mutedForeground }]}>
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        renderItem={({ item }) => <PostCard post={item} />}
        ListEmptyComponent={
          loadedOnce && !loading ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="newspaper-outline" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your feed is quiet</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Follow artists and connect with people to see their posts here.
              </Text>
            </View>
          ) : !loadedOnce ? (
            <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
          ) : null
        }
        ListFooterComponent={
          loadedOnce && loading && items.length > 0 ? (
            <ActivityIndicator style={{ marginVertical: 16 }} color={colors.primary} />
          ) : null
        }
      />

      {/* ── Compose FAB ── */}
      <Pressable
        style={[styles.fab, { backgroundColor: colors.primary, bottom: insets.bottom + (currentTrack ? 150 : 90) }]}
        onPress={() => {
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/compose-post");
        }}
      >
        <Ionicons name="create-outline" size={24} color="#fff" />
      </Pressable>

      <NowPlayingBar
        track={currentTrack}
        isPlaying={isPlaying}
        isLoading={isLoading}
        onToggle={togglePlay}
        onNext={nextTrack}
        onPress={() => router.push("/player")}
      />

      <EcosystemDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  headerTitle: { fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  headerSub: { fontSize: 12, marginTop: 1 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  // Live strip
  liveStrip: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  liveStripHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 14,
  },
  liveStripTitle: { fontSize: 14, fontWeight: "800", flex: 1 },
  liveStripRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  liveStripCount: { fontSize: 12 },
  liveRow: { gap: 14, paddingHorizontal: 2, paddingTop: 6 },

  // Live chip
  liveChipWrap: { alignItems: "center", width: 72, overflow: "visible" },
  liveChipCircleWrap: {
    width: 72,
    height: 72,
    marginBottom: 6,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "visible",
  },
  liveRing: {
    position: "absolute",
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2.5,
  },
  liveBadge: {
    position: "absolute",
    bottom: -2,
    alignSelf: "center",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  liveBadgeText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.4,
    lineHeight: 10,
    includeFontPadding: false,
  },
  liveChipName: { fontSize: 11, fontWeight: "600", textAlign: "center" },

  // Feed tabs
  feedTabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  feedTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
    borderWidth: 1,
  },
  feedTabText: { fontSize: 14, fontWeight: "600" },

  // Empty state
  emptyWrap: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },

  // Compose FAB
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
