import { Ionicons } from "@/components/icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createPlaylist, getPlaylists } from "@workspace/api-client-react";
import { MusicCard } from "@/components/MusicCard";
import { NowPlayingBar } from "@/components/NowPlayingBar";
import { usePlayer } from "@/context/PlayerContext";
import { useColors } from "@/hooks/useColors";

type Tab = "liked" | "library" | "playlists";

export default function LibraryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { currentTrack, isPlaying, isLoading, playTrack, playNext, addToQueue, togglePlay, nextTrack, toggleLike, likedTracks, libraryTracks, tracks, addToLibrary } = usePlayer();
  const [activeTab, setActiveTab] = useState<Tab>("liked");
  const [creating, setCreating] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const displayedTracks = activeTab === "liked" ? likedTracks : libraryTracks;

  const { data: playlistsData } = useQuery({
    queryKey: ["playlists"],
    queryFn: () => getPlaylists(),
    enabled: activeTab === "playlists",
  });
  const playlists = playlistsData?.items ?? [];

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const created = await createPlaylist({ name: "New Playlist" });
      await queryClient.invalidateQueries({ queryKey: ["playlists"] });
      router.push(`/playlist/${created.id}`);
    } catch {
      /* ignore */
    } finally {
      setCreating(false);
    }
  };

  const handleTabPress = (tab: Tab) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setActiveTab(tab);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>Library</Text>

        {/* Tab switcher */}
        <View style={[styles.tabSwitcher, { backgroundColor: colors.card }]}>
          {(["liked", "library", "playlists"] as Tab[]).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => handleTabPress(tab)}
              style={[
                styles.tabBtn,
                activeTab === tab && { backgroundColor: colors.primary },
              ]}
            >
              <Ionicons
                name={tab === "liked" ? "heart" : tab === "library" ? "library" : "list"}
                size={14}
                color={activeTab === tab ? colors.primaryForeground : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === tab ? colors.primaryForeground : colors.mutedForeground },
                ]}
              >
                {tab === "liked" ? "Liked" : tab === "library" ? "Saved" : "Playlists"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {activeTab === "playlists" ? (
        <FlatList
          data={playlists}
          keyExtractor={(p) => p.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 160, paddingTop: 8 }}
          ListHeaderComponent={
            <Pressable
              style={[styles.newPlaylist, { borderColor: colors.border }]}
              onPress={handleCreate}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <>
                  <View style={[styles.newPlaylistIcon, { backgroundColor: colors.primary }]}>
                    <Ionicons name="add" size={22} color="#fff" />
                  </View>
                  <Text style={[styles.playlistName, { color: colors.foreground }]}>New Playlist</Text>
                </>
              )}
            </Pressable>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.playlistRow}
              onPress={() => router.push(`/playlist/${item.id}`)}
            >
              <View
                style={[
                  styles.playlistCover,
                  { backgroundColor: item.coverColor ?? (item.isLikedSongs ? "#e0245e" : colors.card) },
                ]}
              >
                <Ionicons name={item.isLikedSongs ? "heart" : "musical-notes"} size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.playlistName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.playlistMeta, { color: colors.mutedForeground }]}>
                  {item.trackCount} track{item.trackCount === 1 ? "" : "s"}
                  {item.isPublic ? " · Public" : ""}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
            </Pressable>
          )}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={displayedTracks}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 160, paddingTop: 8 }}
          renderItem={({ item }) => (
            <MusicCard
              track={item}
              onPlay={playTrack}
              onLike={toggleLike}
              onPlayNext={playNext}
              onAddToQueue={addToQueue}
              compact
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons
                name={activeTab === "liked" ? "heart-outline" : "library-outline"}
                size={52}
                color={colors.mutedForeground}
              />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {activeTab === "liked" ? "No liked tracks yet" : "Your library is empty"}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                {activeTab === "liked"
                  ? "Heart songs to see them here"
                  : "Add songs to build your collection"}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          scrollEnabled
        />
      )}

      {/* Quick add section */}
      {activeTab === "library" && libraryTracks.length === 0 && (
        <View style={[styles.quickAddSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.quickAddTitle, { color: colors.foreground }]}>Add from catalogue</Text>
          <FlatList
            data={tracks.slice(0, 4)}
            keyExtractor={(t) => t.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingVertical: 8 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  addToLibrary(item.id);
                }}
                style={[styles.quickAddCard, { backgroundColor: item.coverColor }]}
              >
                <Ionicons name="musical-note" size={18} color="white" />
                <Text style={styles.quickAddTrack} numberOfLines={1}>{item.title}</Text>
                <Ionicons name="add-circle" size={16} color="white" />
              </Pressable>
            )}
          />
        </View>
      )}

      <NowPlayingBar
        track={currentTrack}
        isPlaying={isPlaying}
        isLoading={isLoading}
        onToggle={togglePlay}
        onNext={nextTrack}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  tabSwitcher: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    alignSelf: "flex-start",
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
  },
  quickAddSection: {
    marginHorizontal: 20,
    marginBottom: 160,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  quickAddTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  quickAddCard: {
    width: 100,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    gap: 6,
  },
  quickAddTrack: {
    color: "white",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  newPlaylist: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    marginBottom: 6,
    borderBottomWidth: 1,
  },
  newPlaylistIcon: {
    width: 52,
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  playlistRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 10 },
  playlistCover: {
    width: 52,
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  playlistName: { fontSize: 15, fontWeight: "600" },
  playlistMeta: { fontSize: 13, marginTop: 2 },
});
