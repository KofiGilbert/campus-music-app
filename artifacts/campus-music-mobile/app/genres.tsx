import { Ionicons } from "@/components/icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MusicCard } from "@/components/MusicCard";
import { NowPlayingBar } from "@/components/NowPlayingBar";
import { GENRES, usePlayer } from "@/context/PlayerContext";
import { useColors } from "@/hooks/useColors";

const GENRE_COLORS: Record<string, string> = {
  "All": "#e85d4a", "Indie": "#3b82f6", "Electronic": "#8b5cf6",
  "Jazz": "#f59e0b", "Folk": "#10b981", "R&B": "#ec4899",
  "Lo-Fi": "#6366f1", "Hip Hop": "#f97316", "Ambient": "#0ea5e9",
  "Acoustic": "#84cc16", "Synth": "#a855f7",
};

export default function GenresScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { tracks, currentTrack, isPlaying, isLoading, playTrack, togglePlay, nextTrack, toggleLike } = usePlayer();
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  if (selectedGenre) {
    const filtered = tracks.filter((t) => t.genre === selectedGenre);
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 8 }]}>
          <Pressable onPress={() => setSelectedGenre(null)} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>{selectedGenre}</Text>
          <View style={{ width: 24 }} />
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 160 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="musical-notes-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No {selectedGenre} tracks yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <MusicCard track={item} onPlay={playTrack} onLike={toggleLike} compact />
          )}
        />
        <NowPlayingBar track={currentTrack} isPlaying={isPlaying} isLoading={isLoading} onToggle={togglePlay} onNext={nextTrack} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Genres</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={GENRES.filter((g) => g !== "All")}
        keyExtractor={(item) => item}
        numColumns={2}
        contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 160 }}
        columnWrapperStyle={{ gap: 14 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const count = tracks.filter((t) => t.genre === item).length;
          const genreColor = GENRE_COLORS[item] || colors.primary;
          return (
            <Pressable
              style={[styles.genreCard, { backgroundColor: genreColor }]}
              onPress={() => setSelectedGenre(item)}
            >
              <Text style={styles.genreName}>{item}</Text>
              <Text style={styles.genreCount}>{count} tracks</Text>
              <Ionicons name="musical-note" size={32} color="rgba(255,255,255,0.3)" style={styles.genreIcon} />
            </Pressable>
          );
        }}
      />
      <NowPlayingBar track={currentTrack} isPlaying={isPlaying} onToggle={togglePlay} onNext={nextTrack} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  title: { flex: 1, fontSize: 20, fontWeight: "700", textAlign: "center" },
  genreCard: { flex: 1, borderRadius: 18, padding: 18, minHeight: 100, justifyContent: "flex-end", overflow: "hidden" },
  genreName: { color: "#fff", fontSize: 18, fontWeight: "800" },
  genreCount: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 2 },
  genreIcon: { position: "absolute", top: 12, right: 12 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
});
