import { Ionicons } from "@/components/icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { getUniversities, getTracks, getArtists } from "@workspace/api-client-react";
import { MusicCard } from "@/components/MusicCard";
import { NowPlayingBar } from "@/components/NowPlayingBar";
import { TrackCover } from "@/components/TrackCover";
import { usePlayer } from "@/context/PlayerContext";
import { useColors } from "@/hooks/useColors";

const CAMPUS_COLORS = [
  "#e85d4a", "#3b82f6", "#8b5cf6", "#f59e0b", "#10b981",
  "#ec4899", "#f97316", "#0ea5e9", "#14b8a6", "#6366f1",
];

type CampusView = "tracks" | "artists";

export default function CampusesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { currentTrack, isPlaying, isLoading, playTrack, togglePlay, nextTrack, toggleLike } = usePlayer();
  const [selectedCampus, setSelectedCampus] = useState<string | null>(null);
  const [view, setView] = useState<CampusView>("tracks");

  const { data: universities, isLoading: isLoadingUnis } = useQuery({
    queryKey: ["universities"],
    queryFn: () => getUniversities(),
    staleTime: 10 * 60 * 1000,
  });

  const { data: allTracks, isLoading: isLoadingTracks } = useQuery({
    queryKey: ["tracks"],
    queryFn: () => getTracks(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: allArtists, isLoading: isLoadingArtists } = useQuery({
    queryKey: ["artists"],
    queryFn: () => getArtists(),
    staleTime: 5 * 60 * 1000,
  });

  const campusList = (universities ?? []).slice(0, 12).map((name, i) => ({
    id: `camp-${i}`,
    name,
    color: CAMPUS_COLORS[i % CAMPUS_COLORS.length],
    city: "",
  }));

  if (selectedCampus) {
    const campusTracks = (Array.isArray(allTracks) ? allTracks : []).filter(
      (t) => t.university?.toLowerCase() === selectedCampus.toLowerCase()
    ).slice(0, 10);
    const campusArtists = (allArtists ?? []).filter(
      (a) => a.university?.toLowerCase() === selectedCampus.toLowerCase()
    ).slice(0, 8);
    const campusColor = campusList.find((c) => c.name === selectedCampus)?.color ?? "#e85d4a";

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.campusHero, { backgroundColor: campusColor, paddingTop: topPad + 8 }]}>
          <Pressable onPress={() => setSelectedCampus(null)} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.heroName}>{selectedCampus}</Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{campusArtists.length}</Text>
              <Text style={styles.heroStatLabel}>Artists</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{campusTracks.length}</Text>
              <Text style={styles.heroStatLabel}>Tracks</Text>
            </View>
          </View>
        </View>

        <View style={[styles.subTabs, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          {(["tracks", "artists"] as CampusView[]).map((v) => (
            <Pressable key={v} onPress={() => setView(v)} style={[styles.subTab, { borderBottomColor: view === v ? colors.primary : "transparent" }]}>
              <Text style={[styles.subTabText, { color: view === v ? colors.primary : colors.mutedForeground }]}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {view === "tracks" && (
          <FlatList
            data={campusTracks}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 160 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                {isLoadingTracks
                  ? <ActivityIndicator color={colors.primary} />
                  : <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No tracks yet for this campus</Text>}
              </View>
            }
            renderItem={({ item }) => (
              <MusicCard track={{ ...item, liked: false }} onPlay={playTrack} onLike={toggleLike} compact />
            )}
          />
        )}

        {view === "artists" && (
          <FlatList
            data={campusArtists}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 160 }}
            columnWrapperStyle={{ gap: 14 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                {isLoadingArtists
                  ? <ActivityIndicator color={colors.primary} />
                  : <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No artists yet for this campus</Text>}
              </View>
            }
            renderItem={({ item }) => (
              <View style={[styles.artistCard, { backgroundColor: colors.card }]}>
                <TrackCover
                  coverUrl={item.avatarUrl}
                  coverColor={item.coverColor}
                  size={60}
                  thumbSize={120}
                  circular
                  iconSize={24}
                  style={{ marginBottom: 10 }}
                />
                <Text style={[styles.artistName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.artistGenre, { color: colors.mutedForeground }]}>{item.genre}</Text>
              </View>
            )}
          />
        )}

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
        <Text style={[styles.title, { color: colors.foreground }]}>Campuses</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={campusList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            {isLoadingUnis
              ? <ActivityIndicator color={colors.primary} />
              : <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No campuses found</Text>}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.campusCard, { backgroundColor: colors.card }]}
            onPress={() => setSelectedCampus(item.name)}
          >
            <View style={[styles.campusDot, { backgroundColor: item.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.campusName, { color: colors.foreground }]}>{item.name}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </Pressable>
        )}
      />
      <NowPlayingBar track={currentTrack} isPlaying={isPlaying} onToggle={togglePlay} onNext={nextTrack} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  title: { flex: 1, fontSize: 20, fontWeight: "700", textAlign: "center" },
  campusCard: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 16, marginBottom: 10, gap: 14 },
  campusDot: { width: 42, height: 42, borderRadius: 21 },
  campusName: { fontSize: 16, fontWeight: "700", marginBottom: 2 },
  campusHero: { paddingHorizontal: 24, paddingBottom: 24 },
  heroName: { color: "#fff", fontSize: 32, fontWeight: "800", marginTop: 12, marginBottom: 16 },
  heroStats: { flexDirection: "row", gap: 32 },
  heroStat: { alignItems: "center" },
  heroStatVal: { color: "#fff", fontSize: 24, fontWeight: "800" },
  heroStatLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  subTabs: { flexDirection: "row", borderBottomWidth: 1 },
  subTab: { flex: 1, paddingVertical: 14, alignItems: "center", borderBottomWidth: 2 },
  subTabText: { fontSize: 14, fontWeight: "600" },
  artistCard: { flex: 1, borderRadius: 16, padding: 16, alignItems: "center" },
  artistName: { fontSize: 13, fontWeight: "600", textAlign: "center", marginBottom: 4 },
  artistGenre: { fontSize: 11 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, textAlign: "center" },
});
