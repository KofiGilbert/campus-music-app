import { Ionicons } from "@/components/icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MusicCard } from "@/components/MusicCard";
import { NowPlayingBar } from "@/components/NowPlayingBar";
import { usePlayer } from "@/context/PlayerContext";
import { useColors } from "@/hooks/useColors";

type Tab = "liked" | "library";

export default function LibraryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentTrack, isPlaying, isLoading, playTrack, playNext, addToQueue, togglePlay, nextTrack, toggleLike, likedTracks, libraryTracks, tracks, addToLibrary, removeFromLibrary, libraryIds } = usePlayer();
  const [activeTab, setActiveTab] = useState<Tab>("liked");

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const displayedTracks = activeTab === "liked" ? likedTracks : libraryTracks;

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
          {(["liked", "library"] as Tab[]).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => handleTabPress(tab)}
              style={[
                styles.tabBtn,
                activeTab === tab && { backgroundColor: colors.primary },
              ]}
            >
              <Ionicons
                name={tab === "liked" ? "heart" : "library"}
                size={14}
                color={activeTab === tab ? colors.primaryForeground : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === tab ? colors.primaryForeground : colors.mutedForeground },
                ]}
              >
                {tab === "liked" ? "Liked" : "Saved"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

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
});
