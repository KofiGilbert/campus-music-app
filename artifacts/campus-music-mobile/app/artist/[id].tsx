import { Ionicons } from "@/components/icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getArtistById, getTracks, followArtist } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState, useEffect } from "react";
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
import { useColors } from "@/hooks/useColors";
import { usePlayer } from "@/context/PlayerContext";
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

export default function ArtistProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { playTrack } = usePlayer();
  const queryClient = useQueryClient();

  const { data: artist, isLoading: artistLoading, isError: artistError } = useQuery({
    queryKey: ["artist", id],
    queryFn: () => getArtistById(id!),
    enabled: !!id,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  useEffect(() => {
    if (artist) {
      setFollowing(artist.following ?? false);
      setFollowerCount(artist.followerCount);
    }
  }, [artist]);

  const followMutation = useMutation({
    mutationFn: () => followArtist(id!),
    onMutate: () => {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setFollowing((f) => !f);
      setFollowerCount((c) => (following ? c - 1 : c + 1));
    },
    onSuccess: (data) => {
      setFollowing(data.following);
      setFollowerCount(data.followerCount);
      void queryClient.invalidateQueries({ queryKey: ["artist", id] });
    },
    onError: () => {
      setFollowing((f) => !f);
      setFollowerCount((c) => (following ? c + 1 : c - 1));
    },
  });

  const { data: rawTracks, isLoading: tracksLoading } = useQuery({
    queryKey: ["tracks", { artistId: id }],
    queryFn: () => getTracks({ artistId: id }),
    enabled: !!id,
    staleTime: 60 * 1000,
  });

  const tracks: Track[] = (rawTracks ?? []).map((t) => ({
    ...t,
    audioUrl: t.audioUrl ?? null,
    coverUrl: t.coverUrl ?? null,
    university: t.university ?? null,
    liked: false,
  }));

  const handleBack = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    router.back();
  };

  const handlePlayTrack = (trackId: string) => {
    const target = tracks.find((t) => t.id === trackId);
    if (!target) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void playTrack(target, tracks);
  };

  if (artistLoading || tracksLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (artistError || !artist) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <Pressable onPress={handleBack} style={[styles.backBtn, { backgroundColor: colors.card, top: topPad + 12 }]}>
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </Pressable>
        <Ionicons name="person-circle-outline" size={64} color={colors.mutedForeground} />
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>Artist not found</Text>
        <Text style={[styles.errorSub, { color: colors.mutedForeground }]}>
          This artist's profile could not be loaded.
        </Text>
      </View>
    );
  }

  const totalPlays = tracks.reduce((s, t) => s + (t.playCount ?? 0), 0);
  const totalLikes = tracks.reduce((s, t) => s + (t.likes ?? 0), 0);

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
        {/* Hero */}
        <View style={styles.heroSection}>
          {artist.avatarUrl ? (
            <Image
              source={{ uri: artist.avatarUrl }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.avatar, { backgroundColor: artist.coverColor }]}>
              <Text style={styles.avatarText}>{getInitials(artist.name)}</Text>
            </View>
          )}

          <Text style={[styles.name, { color: colors.foreground }]}>{artist.name}</Text>

          <View style={[styles.roleBadge, { backgroundColor: colors.primary + "22" }]}>
            <Ionicons name="musical-notes" size={12} color={colors.primary} />
            <Text style={[styles.roleBadgeText, { color: colors.primary }]}>
              {artist.genre}
            </Text>
          </View>

          {artist.university ? (
            <View style={styles.metaRow}>
              <Ionicons name="school-outline" size={14} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {artist.university}
              </Text>
            </View>
          ) : null}

          <View style={styles.metaRow}>
            <Ionicons name="people-outline" size={14} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {formatPlays(followerCount)} followers
            </Text>
          </View>

          <Pressable
            onPress={() => followMutation.mutate()}
            disabled={followMutation.isPending}
            style={[
              styles.followBtn,
              following
                ? { backgroundColor: colors.primary + "22", borderColor: colors.primary }
                : { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
          >
            <Ionicons
              name={following ? "checkmark-circle" : "add-circle-outline"}
              size={16}
              color={following ? colors.primary : "#fff"}
            />
            <Text style={[styles.followBtnText, { color: following ? colors.primary : "#fff" }]}>
              {following ? "Following" : "Follow"}
            </Text>
          </Pressable>
        </View>

        {/* Bio */}
        {artist.bio ? (
          <View style={[styles.bioCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.bioLabel, { color: colors.mutedForeground }]}>About</Text>
            <Text style={[styles.bioText, { color: colors.foreground }]}>{artist.bio}</Text>
          </View>
        ) : null}

        {/* Stats */}
        {tracks.length > 0 && (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.card }]}>
              <Ionicons name="musical-note" size={18} color={colors.primary} />
              <Text style={[styles.statNumber, { color: colors.foreground }]}>{tracks.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Tracks</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card }]}>
              <Ionicons name="play-circle" size={18} color="#10b981" />
              <Text style={[styles.statNumber, { color: colors.foreground }]}>
                {formatPlays(totalPlays)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Plays</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card }]}>
              <Ionicons name="heart" size={18} color="#e85d4a" />
              <Text style={[styles.statNumber, { color: colors.foreground }]}>
                {formatPlays(totalLikes)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Likes</Text>
            </View>
          </View>
        )}

        {/* Tracks */}
        <View style={styles.tracksSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {tracks.length > 0 ? "Tracks" : "No tracks yet"}
          </Text>
          {tracks.map((track, idx) => {
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
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    overflow: "hidden",
  },
  avatarText: { color: "#fff", fontSize: 32, fontWeight: "700" },
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
  followBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    marginTop: 4,
  },
  followBtnText: { fontSize: 15, fontWeight: "700" },
  bioCard: { marginHorizontal: 20, marginBottom: 16, padding: 16, borderRadius: 16, gap: 6 },
  bioLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  bioText: { fontSize: 14, lineHeight: 20 },
  statsRow: { flexDirection: "row", paddingHorizontal: 20, gap: 10, marginBottom: 20 },
  statCard: { flex: 1, alignItems: "center", padding: 14, borderRadius: 16, gap: 4 },
  statNumber: { fontSize: 18, fontWeight: "700" },
  statLabel: { fontSize: 11 },
  tracksSection: { paddingHorizontal: 20, gap: 10 },
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
  trackArtImage: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  trackTitle: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  trackMeta: { fontSize: 12 },
  trackStats: { flexDirection: "row", alignItems: "center", gap: 3 },
  trackStatText: { fontSize: 12 },
  errorTitle: { fontSize: 18, fontWeight: "700" },
  errorSub: { fontSize: 14, textAlign: "center" },
});
