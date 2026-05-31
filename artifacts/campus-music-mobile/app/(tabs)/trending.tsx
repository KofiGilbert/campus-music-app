import { Ionicons } from "@/components/icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { TrackCover } from "@/components/TrackCover";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NowPlayingBar } from "@/components/NowPlayingBar";
import { GENRES, usePlayer } from "@/context/PlayerContext";
import { useColors } from "@/hooks/useColors";
import { useGetTrendingTracks } from "@workspace/api-client-react";
import { Track } from "@/components/MusicCard";

export default function TrendingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { currentTrack, isPlaying, isLoading, playTrack, togglePlay, nextTrack, toggleLike, likedIds } = usePlayer();
  const [selectedGenre, setSelectedGenre] = useState("All");

  const { data: trendingRaw, isLoading: isLoadingTrending } = useGetTrendingTracks(
    { limit: 100 },
    { query: { queryKey: ["trending", 100], staleTime: 0 } }
  );

  const allTrending = (trendingRaw ?? []) as unknown as Track[];
  const trendingTracks = selectedGenre === "All"
    ? allTrending
    : allTrending.filter((t) => t.genre === selectedGenre);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Trending Global 100</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Genre filter — same as Discover */}
      <View style={styles.genreRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.genreList}
        >
          {GENRES.map((genre) => (
            <Pressable
              key={genre}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.selectionAsync();
                setSelectedGenre(genre);
              }}
              style={[styles.genreChip, {
                backgroundColor: selectedGenre === genre ? colors.primary : colors.card,
                borderColor: selectedGenre === genre ? colors.primary : colors.border,
              }]}
            >
              <Text style={[styles.genreChipText, { color: selectedGenre === genre ? "#fff" : colors.foreground }]}>
                {genre}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {isLoadingTrending ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={trendingTracks}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 160 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const isLiked = likedIds.has(item.id);
            const isCurrentlyPlaying = currentTrack?.id === item.id;
            return (
              <Pressable
                style={[styles.track, { backgroundColor: isCurrentlyPlaying ? colors.primary + "15" : colors.card }]}
                onPress={() => playTrack(item, trendingTracks)}
              >
                <Text style={[styles.rank, { color: index < 3 ? colors.primary : colors.mutedForeground }]}>
                  #{index + 1}
                </Text>
                <TrackCover
                  coverUrl={item.coverUrl}
                  coverColor={item.coverColor}
                  size={44}
                  thumbSize={88}
                  borderRadius={8}
                  iconSize={18}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.trackTitle, { color: colors.foreground }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.trackArtist, { color: colors.mutedForeground }]} numberOfLines={1}>{item.artist}</Text>
                </View>
                <View style={styles.streamsBadge}>
                  <Ionicons name="headset-outline" size={11} color={colors.mutedForeground} />
                  <Text style={[styles.streamsText, { color: colors.mutedForeground }]}>
                    {(item.playCount ?? 0) >= 1000
                      ? `${((item.playCount ?? 0) / 1000).toFixed(1)}K`
                      : `${item.playCount ?? 0}`}
                  </Text>
                </View>
                <Pressable onPress={() => toggleLike(item.id)} hitSlop={8}>
                  <Ionicons
                    name={isLiked ? "heart" : "heart-outline"}
                    size={20}
                    color={isLiked ? colors.primary : colors.mutedForeground}
                  />
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}

      <NowPlayingBar track={currentTrack} isPlaying={isPlaying} isLoading={isLoading} onToggle={togglePlay} onNext={nextTrack} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
  title: { flex: 1, fontSize: 20, fontWeight: "700", textAlign: "center" },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  genreRow: { height: 52 },
  genreList: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: "center" },
  genreChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  genreChipText: { fontSize: 13, fontWeight: "600" },
  track: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 14, marginBottom: 8, gap: 12 },
  rank: { width: 38, fontSize: 13, fontWeight: "800", textAlign: "center" },
  trackTitle: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  trackArtist: { fontSize: 12 },
  streamsBadge: { flexDirection: "row", alignItems: "center", gap: 3, marginRight: 4 },
  streamsText: { fontSize: 11 },
});
