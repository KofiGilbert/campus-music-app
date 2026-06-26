import { Ionicons } from "@/components/icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { getTracks, getArtists } from "@workspace/api-client-react";
import { NowPlayingBar } from "@/components/NowPlayingBar";
import { EcosystemDrawer } from "@/components/EcosystemDrawer";
import { TrackCover } from "@/components/TrackCover";
import { usePlayer } from "@/context/PlayerContext";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

type FeedTab = "foryou" | "following";

export default function SocialScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { currentTrack, isPlaying, isLoading: isAudioLoading, togglePlay, nextTrack } = usePlayer();
  const [feedTab, setFeedTab] = useState<FeedTab>("foryou");
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: feedTracks, isLoading: isFeedLoading } = useQuery({
    queryKey: ["feed"],
    queryFn: () => getTracks(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: artists } = useQuery({
    queryKey: ["artists"],
    queryFn: () => getArtists(),
    staleTime: 5 * 60 * 1000,
  });

  // Build live stories from real artist data
  // Artists are sorted by follower count; top third of the displayed row are marked "live"
  const sortedArtists = [...(artists ?? [])].sort((a, b) => b.followerCount - a.followerCount);
  const displayedStories = sortedArtists.slice(0, 8);
  const liveThreshold = Math.ceil(displayedStories.length / 3);
  const liveStories = displayedStories.map((a, i) => ({
    id: a.id,
    label: a.name,
    avatarUrl: a.avatarUrl,
    coverColor: a.coverColor,
    live: i < liveThreshold,
  }));

  // Build post cards from artists + feed tracks
  const actions = ["dropped a new track", "is vibing to", "just released", "shared", "added to playlist", "is listening to"];
  const times = ["2m", "5m", "12m", "28m", "1h", "2h"];

  const forYouPosts = (artists ?? []).slice(0, 8).map((a, i) => {
    const track = feedTracks?.[i % (feedTracks?.length ?? 1)];
    return {
      id: `post-${a.id}`,
      user: a.name,
      handle: `@${a.name.replace(/\s+/g, "").toLowerCase()}`,
      avatarUrl: a.avatarUrl,
      coverColor: a.coverColor,
      trackTitle: track?.title ?? "Unknown Track",
      trackArtist: track?.artist ?? a.genre,
      trackColor: track?.coverColor ?? a.coverColor,
      action: actions[i % actions.length],
      time: times[i % times.length],
      likes: a.followerCount % 200,
      reposts: Math.floor(a.followerCount / 10) % 50,
      plays: a.followerCount * 3,
      saves: Math.floor(a.followerCount / 20) % 30,
    };
  });

  const followingPosts = forYouPosts.slice(0, 4);

  const posts = feedTab === "foryou" ? forYouPosts : followingPosts;

  const toggleLike = (id: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLiked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const displayName = user?.name ?? "You";
  const initials = displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── X-style header ── */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Pressable onPress={() => setDrawerOpen(true)}>
          <View style={[styles.avatarSmall, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </Pressable>

        <Text style={[styles.logoText, { color: colors.foreground }]}>Campus</Text>

        <Pressable
          style={[styles.feedBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/music-feed")}
        >
          <Ionicons name="play-circle" size={16} color="#fff" />
          <Text style={styles.feedBtnText}>Feed</Text>
        </Pressable>

        <Pressable
          style={[styles.iconBtn, { backgroundColor: colors.card }]}
          onPress={() => router.push("/messages")}
        >
          <Ionicons name="paper-plane-outline" size={19} color={colors.foreground} />
        </Pressable>
      </View>

      {/* ── For You / Following underline tabs ── */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {(["foryou", "following"] as FeedTab[]).map((tab) => {
          const active = feedTab === tab;
          return (
            <Pressable
              key={tab}
              style={styles.tabItem}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.selectionAsync();
                setFeedTab(tab);
              }}
            >
              <Text style={[styles.tabLabel, { color: active ? colors.foreground : colors.mutedForeground, fontWeight: active ? "700" : "500" }]}>
                {tab === "foryou" ? "For You" : "Following"}
              </Text>
              {active && <View style={[styles.tabUnderline, { backgroundColor: colors.primary }]} />}
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 160 }}
        ListHeaderComponent={
          <>
            {/* ── Live story circles ── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.storiesRow}
              style={[styles.storiesContainer, { borderBottomColor: colors.border }]}
            >
              {liveStories.map((s) => (
                <Pressable key={s.id} style={styles.storyWrap}>
                  <View style={[
                    styles.storyRing,
                    { borderColor: s.live ? colors.primary : colors.border },
                  ]}>
                    <TrackCover
                      coverUrl={s.avatarUrl}
                      coverColor={s.coverColor}
                      size={50}
                      thumbSize={100}
                      circular
                      iconSize={18}
                    />
                  </View>
                  {s.live && (
                    <View style={[styles.livePill, { backgroundColor: colors.primary }]}>
                      <Text style={styles.livePillText}>LIVE</Text>
                    </View>
                  )}
                  <Text style={[styles.storyLabel, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {s.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            {isFeedLoading
              ? <ActivityIndicator color={colors.primary} />
              : <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nothing here yet</Text>}
          </View>
        }
        renderItem={({ item }) => {
          const isLiked = liked.has(item.id);
          return (
            <View style={[styles.post, { borderBottomColor: colors.border }]}>
              {/* Avatar */}
              <TrackCover
                coverUrl={item.avatarUrl}
                coverColor={item.coverColor}
                size={40}
                thumbSize={80}
                circular
                iconSize={16}
                style={{ marginTop: 2 }}
              />

              <View style={{ flex: 1 }}>
                {/* Name + handle + time */}
                <View style={styles.postHeader}>
                  <Text style={[styles.postName, { color: colors.foreground }]}>{item.user}</Text>
                  <Text style={[styles.postHandle, { color: colors.mutedForeground }]}>{item.handle}</Text>
                  <Text style={[styles.postDot, { color: colors.mutedForeground }]}>·</Text>
                  <Text style={[styles.postTime, { color: colors.mutedForeground }]}>{item.time}</Text>
                </View>

                {/* Post body */}
                <Text style={[styles.postBody, { color: colors.foreground }]}>
                  {item.action}{" "}
                  <Text style={{ color: colors.primary, fontWeight: "600" }}>"{item.trackTitle}"</Text>
                </Text>

                {/* Track card embed */}
                <View style={[styles.trackEmbed, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.embedCover, { backgroundColor: item.trackColor }]}>
                    <Ionicons name="musical-notes" size={18} color="rgba(255,255,255,0.85)" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.embedTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {item.trackTitle}
                    </Text>
                    <Text style={[styles.embedArtist, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {item.trackArtist}
                    </Text>
                  </View>
                  <Ionicons name="play-circle" size={28} color={colors.primary} />
                </View>

                {/* Engagement bar */}
                <View style={styles.engagementRow}>
                  <Pressable style={styles.engBtn} onPress={() => toggleLike(item.id)}>
                    <Ionicons
                      name={isLiked ? "heart" : "heart-outline"}
                      size={17}
                      color={isLiked ? colors.primary : colors.mutedForeground}
                    />
                    <Text style={[styles.engNum, { color: colors.mutedForeground }]}>
                      {(item.likes + (isLiked ? 1 : 0)).toLocaleString()}
                    </Text>
                  </Pressable>

                  <Pressable style={styles.engBtn}>
                    <Ionicons name="chatbubble-outline" size={16} color={colors.mutedForeground} />
                    <Text style={[styles.engNum, { color: colors.mutedForeground }]}>{item.reposts}</Text>
                  </Pressable>

                  <Pressable style={styles.engBtn}>
                    <Ionicons name="repeat-outline" size={18} color={colors.mutedForeground} />
                    <Text style={[styles.engNum, { color: colors.mutedForeground }]}>{item.saves}</Text>
                  </Pressable>

                  <Pressable style={styles.engBtn}>
                    <Ionicons name="bar-chart-outline" size={16} color={colors.mutedForeground} />
                    <Text style={[styles.engNum, { color: colors.mutedForeground }]}>
                      {(item.plays / 1000).toFixed(1)}K
                    </Text>
                  </Pressable>

                  <Pressable style={styles.engBtn}>
                    <Ionicons name="bookmark-outline" size={16} color={colors.mutedForeground} />
                  </Pressable>

                  <Pressable style={styles.engBtn}>
                    <Ionicons name="share-outline" size={16} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* ── FAB ── */}
      <Pressable
        style={[styles.fab, { backgroundColor: colors.primary, bottom: Platform.OS === "web" ? 160 : insets.bottom + 90 }]}
        onPress={() => {
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      <NowPlayingBar
        track={currentTrack}
        isPlaying={isPlaying}
        isLoading={isAudioLoading}
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  avatarSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  logoText: { fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  feedBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  feedBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    position: "relative",
  },
  tabLabel: { fontSize: 15 },
  tabUnderline: {
    position: "absolute",
    bottom: 0,
    left: "25%",
    right: "25%",
    height: 3,
    borderRadius: 2,
  },

  storiesContainer: {
    borderBottomWidth: 1,
  },
  storiesRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  storyWrap: { alignItems: "center", width: 64 },
  storyRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2.5,
    padding: 2,
    marginBottom: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  livePill: {
    position: "absolute",
    top: 42,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  livePillText: { color: "#fff", fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  storyLabel: { fontSize: 11, textAlign: "center" },

  post: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  postHeader: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4, marginBottom: 4 },
  postName: { fontSize: 14, fontWeight: "700" },
  postHandle: { fontSize: 13 },
  postDot: { fontSize: 13 },
  postTime: { fontSize: 13 },
  postBody: { fontSize: 14, lineHeight: 20, marginBottom: 10 },

  trackEmbed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
  },
  embedCover: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  embedTitle: { fontSize: 13, fontWeight: "600", marginBottom: 2 },
  embedArtist: { fontSize: 12 },

  engagementRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  engBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  engNum: { fontSize: 12 },

  fab: {
    position: "absolute",
    right: 18,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 50,
  },

  empty: { alignItems: "center", paddingTop: 60 },
  emptyText: { fontSize: 15 },
});
