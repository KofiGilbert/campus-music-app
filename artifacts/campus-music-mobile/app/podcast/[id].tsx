import { Ionicons } from "@/components/icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import type { PodcastEpisode } from "@workspace/api-client-react";
import { getPodcast, getPodcastEpisodes, togglePodcastSubscription } from "@workspace/api-client-react";
import type { Track } from "@/components/MusicCard";
import { useColors } from "@/hooks/useColors";
import { usePlayer } from "@/context/PlayerContext";

const ACCENT = "#8b5cf6";

function fmtDuration(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function PodcastDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { playTrack } = usePlayer();
  const { id } = useLocalSearchParams<{ id: string }>();
  const podcastId = id as string;
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [subCount, setSubCount] = useState<number | null>(null);

  const { data: podcast, isLoading } = useQuery({
    queryKey: ["podcast", podcastId],
    queryFn: () => getPodcast(podcastId),
    enabled: !!podcastId,
  });
  const { data: episodesData } = useQuery({
    queryKey: ["podcastEpisodes", podcastId],
    queryFn: () => getPodcastEpisodes(podcastId),
    enabled: !!podcastId,
  });

  const episodes = episodesData?.items ?? [];
  const isSubscribed = subscribed ?? podcast?.isSubscribed ?? false;
  const subscriberCount = subCount ?? podcast?.subscriberCount ?? 0;

  const episodeToTrack = (ep: PodcastEpisode): Track => ({
    id: ep.id,
    title: ep.title,
    artist: podcast?.title ?? "Podcast",
    genre: "Podcast",
    duration: fmtDuration(ep.durationSeconds),
    coverColor: ACCENT,
    liked: false,
    audioUrl: ep.audioUrl ?? undefined,
    coverUrl: podcast?.coverUrl ?? undefined,
  });

  const playEpisode = (ep: PodcastEpisode) => {
    const queue = episodes.map(episodeToTrack);
    void playTrack(episodeToTrack(ep), queue);
  };

  const toggleSub = async () => {
    try {
      const res = await togglePodcastSubscription(podcastId);
      setSubscribed(res.subscribed);
      setSubCount(res.subscriberCount);
    } catch {
      /* ignore */
    }
  };

  if (isLoading || !podcast) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={episodes}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        ListHeaderComponent={
          <View>
            <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
              <Pressable onPress={() => router.back()} hitSlop={12}>
                <Ionicons name="chevron-back" size={26} color={colors.foreground} />
              </Pressable>
            </View>
            <View style={styles.hero}>
              {podcast.coverUrl ? (
                <Image source={{ uri: podcast.coverUrl }} style={styles.cover} />
              ) : (
                <View style={[styles.cover, { backgroundColor: ACCENT, alignItems: "center", justifyContent: "center" }]}>
                  <Ionicons name="mic" size={48} color="#fff" />
                </View>
              )}
              <Text style={[styles.title, { color: colors.foreground }]}>{podcast.title}</Text>
              <Text style={[styles.host, { color: colors.mutedForeground }]}>
                {podcast.host?.name ?? "Host"} · {subscriberCount} subscriber{subscriberCount === 1 ? "" : "s"}
              </Text>
              {!!podcast.description && (
                <Text style={[styles.description, { color: colors.mutedForeground }]}>{podcast.description}</Text>
              )}
              <Pressable
                style={[
                  styles.subBtn,
                  isSubscribed
                    ? { backgroundColor: "transparent", borderColor: colors.border, borderWidth: 1 }
                    : { backgroundColor: colors.primary },
                ]}
                onPress={toggleSub}
              >
                <Ionicons
                  name={isSubscribed ? "checkmark" : "add"}
                  size={16}
                  color={isSubscribed ? colors.foreground : "#fff"}
                />
                <Text style={[styles.subBtnText, { color: isSubscribed ? colors.foreground : "#fff" }]}>
                  {isSubscribed ? "Subscribed" : "Subscribe"}
                </Text>
              </Pressable>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {episodes.length} Episode{episodes.length === 1 ? "" : "s"}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>No episodes yet.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.episode, { borderBottomColor: colors.border }]}
            onPress={() => playEpisode(item)}
          >
            <View style={[styles.epPlay, { backgroundColor: ACCENT + "22" }]}>
              <Ionicons name="play" size={18} color={ACCENT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.epTitle, { color: colors.foreground }]} numberOfLines={1}>{item.title}</Text>
              <Text style={[styles.epMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                {fmtDate(item.publishedAt)}
                {item.durationSeconds ? ` · ${fmtDuration(item.durationSeconds)}` : ""}
              </Text>
              {!!item.description && (
                <Text style={[styles.epDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topbar: { paddingHorizontal: 12, paddingBottom: 4 },
  hero: { alignItems: "center", paddingHorizontal: 24, paddingBottom: 16, gap: 8 },
  cover: { width: 160, height: 160, borderRadius: 16, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  host: { fontSize: 13 },
  description: { fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 4 },
  subBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 22, marginTop: 10 },
  subBtnText: { fontSize: 14, fontWeight: "700" },
  sectionTitle: { fontSize: 16, fontWeight: "700", paddingHorizontal: 20, paddingVertical: 12 },
  empty: { textAlign: "center", marginTop: 24, fontSize: 14 },
  episode: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  epPlay: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  epTitle: { fontSize: 15, fontWeight: "600" },
  epMeta: { fontSize: 12, marginTop: 2 },
  epDesc: { fontSize: 13, marginTop: 3 },
});
