import { Ionicons } from "@/components/icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Track as ApiTrack } from "@workspace/api-client-react";
import {
  deletePlaylist,
  getPlaylist,
  removePlaylistTrack,
  updatePlaylist,
} from "@workspace/api-client-react";
import type { Track } from "@/components/MusicCard";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { usePlayer } from "@/context/PlayerContext";

function toPlayerTrack(t: ApiTrack): Track {
  return {
    id: t.id,
    title: t.title,
    artist: t.artist,
    genre: t.genre,
    duration: t.duration,
    coverColor: t.coverColor,
    liked: false,
    audioUrl: t.audioUrl ?? undefined,
    coverUrl: t.coverUrl ?? undefined,
    audioUrls: t.audioUrls ?? null,
    durationSeconds: t.durationSeconds,
  };
}

export default function PlaylistDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { playTrack } = usePlayer();
  const { id } = useLocalSearchParams<{ id: string }>();
  const playlistId = id as string;
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");

  const { data: playlist, isLoading, refetch } = useQuery({
    queryKey: ["playlist", playlistId],
    queryFn: () => getPlaylist(playlistId),
    enabled: !!playlistId,
  });

  const tracks = playlist?.tracks ?? [];
  const entries = playlist?.entries ?? [];
  const isOwner = !!user && playlist?.owner?.id === user.id && !playlist?.isLikedSongs;

  const playAt = (index: number) => {
    const queue = tracks.map(toPlayerTrack);
    void playTrack(queue[index], queue);
  };

  const saveName = async () => {
    const name = draftName.trim();
    setRenaming(false);
    if (!name || name === playlist?.name) return;
    await updatePlaylist(playlistId, { name });
    await refetch();
    queryClient.invalidateQueries({ queryKey: ["playlists"] });
  };

  const removeTrack = async (trackId: string) => {
    await removePlaylistTrack(playlistId, trackId);
    await refetch();
  };

  const handleDelete = async () => {
    await deletePlaylist(playlistId);
    queryClient.invalidateQueries({ queryKey: ["playlists"] });
    router.back();
  };

  if (isLoading || !playlist) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={tracks}
        keyExtractor={(t, i) => entries[i]?.entryId ?? t.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        ListHeaderComponent={
          <View>
            <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
              <Pressable onPress={() => router.back()} hitSlop={12}>
                <Ionicons name="chevron-back" size={26} color={colors.foreground} />
              </Pressable>
              {isOwner && (
                <View style={{ flexDirection: "row", gap: 18 }}>
                  <Pressable
                    onPress={() => {
                      setDraftName(playlist.name);
                      setRenaming(true);
                    }}
                    hitSlop={10}
                  >
                    <Ionicons name="create-outline" size={22} color={colors.foreground} />
                  </Pressable>
                  <Pressable onPress={handleDelete} hitSlop={10}>
                    <Ionicons name="trash-outline" size={22} color="#e0245e" />
                  </Pressable>
                </View>
              )}
            </View>
            <View style={styles.hero}>
              <View
                style={[
                  styles.cover,
                  { backgroundColor: playlist.coverColor ?? (playlist.isLikedSongs ? "#e0245e" : colors.primary) },
                ]}
              >
                <Ionicons name={playlist.isLikedSongs ? "heart" : "musical-notes"} size={52} color="#fff" />
              </View>
              <Text style={[styles.title, { color: colors.foreground }]}>{playlist.name}</Text>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                {playlist.owner?.name ? `${playlist.owner.name} · ` : ""}
                {tracks.length} track{tracks.length === 1 ? "" : "s"}
              </Text>
              {tracks.length > 0 && (
                <Pressable style={[styles.playBtn, { backgroundColor: colors.primary }]} onPress={() => playAt(0)}>
                  <Ionicons name="play" size={18} color="#fff" />
                  <Text style={styles.playBtnText}>Play</Text>
                </Pressable>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            {playlist.isLikedSongs ? "Heart songs to see them here." : "No tracks yet."}
          </Text>
        }
        renderItem={({ item, index }) => (
          <Pressable style={styles.row} onPress={() => playAt(index)}>
            <View style={[styles.rowArt, { backgroundColor: item.coverColor }]}>
              <Ionicons name="musical-note" size={16} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]} numberOfLines={1}>{item.title}</Text>
              <Text style={[styles.rowArtist, { color: colors.mutedForeground }]} numberOfLines={1}>{item.artist}</Text>
            </View>
            {isOwner && (
              <Pressable onPress={() => removeTrack(item.id)} hitSlop={10}>
                <Ionicons name="remove-circle-outline" size={22} color={colors.mutedForeground} />
              </Pressable>
            )}
          </Pressable>
        )}
      />

      <Modal visible={renaming} transparent animationType="fade" onRequestClose={() => setRenaming(false)}>
        <Pressable style={styles.backdrop} onPress={() => setRenaming(false)} />
        <View style={[styles.renameSheet, { backgroundColor: colors.card }]}>
          <Text style={[styles.renameTitle, { color: colors.foreground }]}>Rename playlist</Text>
          <TextInput
            style={[styles.renameInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
            value={draftName}
            onChangeText={setDraftName}
            autoFocus
            maxLength={80}
          />
          <Pressable style={[styles.renameSave, { backgroundColor: colors.primary }]} onPress={saveName}>
            <Text style={styles.renameSaveText}>Save</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 4 },
  hero: { alignItems: "center", paddingHorizontal: 24, paddingBottom: 16, gap: 8 },
  cover: { width: 150, height: 150, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  title: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  meta: { fontSize: 13 },
  playBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 28, paddingVertical: 10, borderRadius: 24, marginTop: 8 },
  playBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  empty: { textAlign: "center", marginTop: 24, fontSize: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 10 },
  rowArt: { width: 44, height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 15, fontWeight: "600" },
  rowArtist: { fontSize: 13, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  renameSheet: { position: "absolute", top: "40%", left: 24, right: 24, borderRadius: 16, padding: 20, gap: 12 },
  renameTitle: { fontSize: 16, fontWeight: "700" },
  renameInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  renameSave: { alignItems: "center", paddingVertical: 12, borderRadius: 10 },
  renameSaveText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
