import { Ionicons } from "@/components/icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { getUserById, getUserPosts } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { usePlayer } from "@/context/PlayerContext";
import { PostCard } from "@/components/PostCard";
import type { Track } from "@/components/MusicCard";
import { getAlbumArtUrl } from "@/utils/albumArt";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatPlays(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { playTrack } = usePlayer();

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ["user", id],
    queryFn: () => getUserById(id!),
    enabled: !!id,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const { data: postsData } = useQuery({
    queryKey: ["userPosts", id],
    queryFn: () => getUserPosts(id!, { limit: 20 }),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
  const posts = postsData?.items ?? [];

  const handleBack = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    router.back();
  };

  const tracksForPlayer: Track[] = (profile?.tracks ?? []).map((t) => ({
    ...t,
    audioUrl: t.audioUrl ?? null,
    coverUrl: t.coverUrl ?? null,
    university: t.university ?? null,
    liked: false,
  }));

  const handlePlayTrack = (trackId: string) => {
    const target = tracksForPlayer.find((t) => t.id === trackId);
    if (!target) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void playTrack(target, tracksForPlayer);
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (isError || !profile) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <Pressable onPress={handleBack} style={[styles.backBtn, { backgroundColor: colors.card, top: topPad + 12 }]}>
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </Pressable>
        <Ionicons name="person-circle-outline" size={64} color={colors.mutedForeground} />
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>Profile not found</Text>
        <Text style={[styles.errorSub, { color: colors.mutedForeground }]}>
          This user's profile could not be loaded.
        </Text>
      </View>
    );
  }

  const isArtist = profile.role === "artist";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Pressable
        onPress={handleBack}
        style={[styles.backBtn, { backgroundColor: colors.card, top: topPad + 12 }]}
      >
        <Ionicons name="arrow-back" size={20} color={colors.foreground} />
      </Pressable>

      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + 60, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + Name */}
        <View style={styles.heroSection}>
          <View style={[styles.avatar, { backgroundColor: profile.coverColor }]}>
            <Text style={styles.avatarText}>{getInitials(profile.name)}</Text>
          </View>
          <Text style={[styles.name, { color: colors.foreground }]}>{profile.name}</Text>

          <View style={[styles.roleBadge, { backgroundColor: isArtist ? colors.primary + "22" : colors.muted }]}>
            <Ionicons
              name={isArtist ? "musical-notes" : "headset"}
              size={12}
              color={isArtist ? colors.primary : colors.mutedForeground}
            />
            <Text style={[styles.roleBadgeText, { color: isArtist ? colors.primary : colors.mutedForeground }]}>
              {isArtist ? "Artist" : "Listener"}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Ionicons name="school-outline" size={14} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{profile.university}</Text>
          </View>
        </View>

        {/* Bio */}
        {profile.bio ? (
          <View style={[styles.bioCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.bioLabel, { color: colors.mutedForeground }]}>About</Text>
            <Text style={[styles.bioText, { color: colors.foreground }]}>{profile.bio}</Text>
          </View>
        ) : null}

        {/* Stats row for artists */}
        {isArtist && tracksForPlayer.length > 0 && (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.card }]}>
              <Ionicons name="musical-note" size={18} color={colors.primary} />
              <Text style={[styles.statNumber, { color: colors.foreground }]}>{tracksForPlayer.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Tracks</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card }]}>
              <Ionicons name="play-circle" size={18} color="#10b981" />
              <Text style={[styles.statNumber, { color: colors.foreground }]}>
                {formatPlays(tracksForPlayer.reduce((s, t) => s + (t.playCount ?? 0), 0))}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Plays</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card }]}>
              <Ionicons name="heart" size={18} color="#e85d4a" />
              <Text style={[styles.statNumber, { color: colors.foreground }]}>
                {formatPlays(tracksForPlayer.reduce((s, t) => s + (t.likes ?? 0), 0))}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Likes</Text>
            </View>
          </View>
        )}

        {/* Tracks */}
        {isArtist && (
          <View style={styles.tracksSection}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {tracksForPlayer.length > 0 ? "Tracks" : "No tracks yet"}
            </Text>
            {tracksForPlayer.map((track, idx) => {
              const artUrl = track.coverUrl ?? getAlbumArtUrl(track.genre, idx);
              return (
                <Pressable
                  key={track.id}
                  style={[styles.trackRow, { backgroundColor: colors.card }]}
                  onPress={() => handlePlayTrack(track.id)}
                >
                  <View style={[styles.trackArt, { backgroundColor: track.coverColor }]}>
                    {artUrl ? (
                      <Image
                        source={{ uri: artUrl }}
                        style={styles.trackArtImage}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <Ionicons name="musical-note" size={18} color="#fff" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.trackTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {track.title}
                    </Text>
                    <Text style={[styles.trackMeta, { color: colors.mutedForeground }]}>
                      {track.genre} · {track.duration}
                    </Text>
                  </View>
                  <View style={styles.trackStats}>
                    <Ionicons name="play" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.trackStatText, { color: colors.mutedForeground }]}>
                      {formatPlays(track.playCount ?? 0)}
                    </Text>
                  </View>
                  <Ionicons name="play-circle-outline" size={28} color={colors.primary} style={{ marginLeft: 8 }} />
                </Pressable>
              );
            })}
          </View>
        )}

        {!isArtist && (
          <View style={styles.listenerNote}>
            <Ionicons name="headset-outline" size={40} color={colors.mutedForeground} />
            <Text style={[styles.listenerNoteText, { color: colors.mutedForeground }]}>
              This student is a listener — no tracks to show.
            </Text>
          </View>
        )}

        {/* Posts */}
        {posts.length > 0 && (
          <View style={styles.postsSection}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Posts</Text>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  backBtn: {
    position: "absolute",
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  heroSection: { alignItems: "center", paddingHorizontal: 24, paddingBottom: 20, gap: 8 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarText: { color: "#fff", fontSize: 30, fontWeight: "700" },
  name: { fontSize: 24, fontWeight: "800", letterSpacing: -0.3, textAlign: "center" },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: { fontSize: 12, fontWeight: "600" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 13 },
  bioCard: { marginHorizontal: 20, marginBottom: 16, padding: 16, borderRadius: 16, gap: 6 },
  bioLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  bioText: { fontSize: 14, lineHeight: 20 },
  statsRow: { flexDirection: "row", paddingHorizontal: 20, gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1,
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    gap: 4,
  },
  statNumber: { fontSize: 18, fontWeight: "700" },
  statLabel: { fontSize: 11 },
  tracksSection: { paddingHorizontal: 20, gap: 10 },
  postsSection: { paddingHorizontal: 20, paddingTop: 24, gap: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    gap: 12,
  },
  trackArt: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  trackArtImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  trackTitle: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  trackMeta: { fontSize: 12 },
  trackStats: { flexDirection: "row", alignItems: "center", gap: 3 },
  trackStatText: { fontSize: 12 },
  listenerNote: {
    alignItems: "center",
    paddingTop: 40,
    gap: 12,
    paddingHorizontal: 40,
  },
  listenerNoteText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  errorTitle: { fontSize: 18, fontWeight: "700" },
  errorSub: { fontSize: 14, textAlign: "center" },
});
