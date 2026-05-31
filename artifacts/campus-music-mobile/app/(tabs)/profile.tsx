import { Ionicons } from "@/components/icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { getMe, getArtists, followArtist, updateMe, updateArtist, getTracks, updateTrack, deleteTrack } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { usePlayer } from "@/context/PlayerContext";
import { Track } from "@/components/MusicCard";
import { useColors } from "@/hooks/useColors";

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

async function requestUploadUrl(
  token: string,
  file: { name: string; size: number; contentType: string }
): Promise<{ uploadURL: string; objectPath: string }> {
  const res = await fetch(`${API_BASE}/storage/uploads/request-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(file),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to get upload URL" }));
    throw new Error((err as { error?: string }).error ?? "Failed to get upload URL");
  }
  return res.json() as Promise<{ uploadURL: string; objectPath: string }>;
}

async function uploadToGcs(presignedUrl: string, fileUri: string, contentType: string): Promise<void> {
  const blob = await (await fetch(fileUri)).blob();
  const uploadRes = await fetch(presignedUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!uploadRes.ok) {
    throw new Error("Failed to upload file to storage");
  }
}

const GENRE_COLORS: Record<string, string> = {
  Indie: "#e85d4a",
  Electronic: "#3b82f6",
  Jazz: "#8b5cf6",
  Folk: "#f59e0b",
  "R&B": "#10b981",
  "Lo-Fi": "#6366f1",
  "Hip Hop": "#f97316",
  Ambient: "#0ea5e9",
  Acoustic: "#14b8a6",
  Synth: "#ec4899",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface ColorTokens {
  primary: string;
  muted: string;
  mutedForeground: string;
}

function RoleBadge({ role, colors }: { role: string; colors: ColorTokens }) {
  const isArtist = role === "artist";
  return (
    <View
      style={[
        styles.roleBadge,
        { backgroundColor: isArtist ? colors.primary + "22" : colors.muted },
      ]}
    >
      <Ionicons
        name={isArtist ? "musical-notes" : "headset"}
        size={12}
        color={isArtist ? colors.primary : colors.mutedForeground}
      />
      <Text
        style={[
          styles.roleBadgeText,
          { color: isArtist ? colors.primary : colors.mutedForeground },
        ]}
      >
        {isArtist ? "Artist" : "Listener"}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { user: cachedUser, token, signOut, updateUser } = useAuth();
  const { likedIds, libraryIds, playTrack } = usePlayer();
  const queryClient = useQueryClient();

  const router = useRouter();
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState(cachedUser?.name ?? "");
  const [editUniversity, setEditUniversity] = useState(cachedUser?.university ?? "");
  const [editCountry, setEditCountry] = useState(cachedUser?.country ?? "");
  const [editBio, setEditBio] = useState("");
  const [editGenre, setEditGenre] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [optimisticFollows, setOptimisticFollows] = useState<Map<string, boolean>>(new Map());

  const [editTrackVisible, setEditTrackVisible] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [editTrackTitle, setEditTrackTitle] = useState("");
  const [editTrackGenre, setEditTrackGenre] = useState("");
  const [editCoverImageUri, setEditCoverImageUri] = useState<string | null>(null);
  const [editCoverObjectPath, setEditCoverObjectPath] = useState<string | null>(null);
  const [isUploadingEditCover, setIsUploadingEditCover] = useState(false);
  const [isSavingTrack, setIsSavingTrack] = useState(false);

  const isAuthenticated = !!token;

  const { data: freshUser } = useQuery({
    queryKey: ["me"],
    queryFn: () => getMe(),
    enabled: isAuthenticated,
    staleTime: 0,
    retry: 1,
  });

  const user = freshUser
    ? {
        id: freshUser.id,
        name: freshUser.name,
        email: freshUser.email,
        role: freshUser.role as "listener" | "artist",
        university: freshUser.university,
        country: freshUser.country,
        avatarUrl: freshUser.avatarUrl ?? null,
      }
    : cachedUser;

  useEffect(() => {
    if (freshUser) {
      updateUser({
        name: freshUser.name,
        email: freshUser.email,
        role: freshUser.role as "listener" | "artist",
        university: freshUser.university,
        country: freshUser.country,
        avatarUrl: freshUser.avatarUrl ?? null,
      });
    }
  }, [freshUser, updateUser]);

  const { data: allArtists, isLoading: allArtistsLoading } = useQuery({
    queryKey: ["artists"],
    queryFn: () => getArtists(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const isArtist = user?.role === "artist";

  const myArtistRecord = isArtist && user?.id
    ? (allArtists ?? []).find((a) => a.id === user.id)
    : undefined;

  const { data: myTracksRaw, isLoading: myTracksLoading } = useQuery({
    queryKey: ["tracks", "myMusic", user?.id],
    queryFn: () => getTracks({ artistId: user!.id }),
    enabled: isAuthenticated && isArtist && !!user?.id,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const myTracks: Track[] = (Array.isArray(myTracksRaw) ? myTracksRaw : []).map((t) => ({
    id: t.id,
    title: t.title,
    artist: t.artist,
    genre: t.genre,
    duration: t.duration,
    coverColor: t.coverColor,
    liked: false,
    audioUrl: t.audioUrl ?? undefined,
    coverUrl: t.coverUrl ?? undefined,
    university: t.university ?? undefined,
    playCount: t.playCount,
    durationSeconds: t.durationSeconds,
    likes: t.likes ?? 0,
  }));

  function isFollowing(artistId: string): boolean {
    if (optimisticFollows.has(artistId)) return optimisticFollows.get(artistId)!;
    const artist = (allArtists ?? []).find((a) => a.id === artistId);
    return artist?.following === true;
  }

  const effectiveFollowedArtists = (allArtists ?? []).filter((a) => isFollowing(a.id));

  const handleFollowToggle = async (artistId: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nowFollowing = !isFollowing(artistId);
    setOptimisticFollows((prev) => new Map(prev).set(artistId, nowFollowing));
    try {
      await followArtist(artistId, { following: nowFollowing });
      queryClient.invalidateQueries({ queryKey: ["artists"] });
    } catch {
      setOptimisticFollows((prev) => new Map(prev).set(artistId, !nowFollowing));
    }
  };

  const handleSignOut = () => {
    if (Platform.OS === "web") {
      if (window.confirm("Sign out of Campus Music?")) {
        signOut();
      }
    } else {
      Alert.alert("Sign Out", "Are you sure you want to sign out?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: () => {
            if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            signOut();
          },
        },
      ]);
    }
  };

  const handlePickAvatar = async () => {
    if (!token) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const fileName = asset.fileName ?? `avatar-${Date.now()}.jpg`;
      const mimeType = asset.mimeType ?? "image/jpeg";
      const fileSize = asset.fileSize ?? 200000;
      const { uploadURL, objectPath } = await requestUploadUrl(token, {
        name: fileName, size: fileSize, contentType: mimeType,
      });
      await uploadToGcs(uploadURL, asset.uri, mimeType);
      const cdnBase = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/storage/object`;
      const newAvatarUrl = `${cdnBase}/${objectPath}`;
      const updated = await updateMe({ avatarUrl: newAvatarUrl });
      updateUser({ avatarUrl: updated.avatarUrl ?? null });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Could not upload photo.");
    }
  };

  const handleOpenEditTrack = (track: Track) => {
    setEditingTrack(track);
    setEditTrackTitle(track.title);
    setEditTrackGenre(track.genre);
    setEditCoverImageUri(track.coverUrl ?? null);
    setEditCoverObjectPath(null);
    setEditTrackVisible(true);
  };

  const handlePickEditCover = async () => {
    if (!token) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow access to your photo library to pick cover art.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setIsUploadingEditCover(true);
    setEditCoverImageUri(asset.uri);
    setEditCoverObjectPath(null);

    try {
      const fileName = asset.fileName ?? `cover-${Date.now()}.jpg`;
      const mimeType = asset.mimeType ?? "image/jpeg";
      const fileSize = asset.fileSize ?? 500000;

      const { uploadURL, objectPath } = await requestUploadUrl(token, {
        name: fileName,
        size: fileSize,
        contentType: mimeType,
      });

      await uploadToGcs(uploadURL, asset.uri, mimeType);
      setEditCoverObjectPath(objectPath);
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Could not upload cover art.");
      setEditCoverImageUri(editingTrack?.coverUrl ?? null);
    } finally {
      setIsUploadingEditCover(false);
    }
  };

  const handleRemoveEditCover = () => {
    setEditCoverImageUri(null);
    setEditCoverObjectPath(null);
  };

  const handleSaveTrack = async () => {
    if (!editingTrack || !editTrackTitle.trim() || !editTrackGenre.trim()) return;
    if (isUploadingEditCover) return;
    setIsSavingTrack(true);
    try {
      let coverUrl: string | null | undefined = undefined;
      if (editCoverObjectPath) {
        coverUrl = `${API_BASE}/storage${editCoverObjectPath}`;
      } else if (editCoverImageUri === null && (editingTrack.coverUrl ?? null) !== null) {
        coverUrl = null;
      }

      await updateTrack(editingTrack.id, {
        title: editTrackTitle.trim(),
        genre: editTrackGenre.trim(),
        ...(coverUrl !== undefined ? { coverUrl } : {}),
      });
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      setEditTrackVisible(false);
      setEditingTrack(null);
    } catch {
      if (Platform.OS === "web") {
        window.alert("Failed to save track changes. Please try again.");
      } else {
        Alert.alert("Save Failed", "Could not update the track. Please try again.");
      }
    } finally {
      setIsSavingTrack(false);
    }
  };

  const handleDeleteTrack = (track: Track) => {
    const doDelete = async () => {
      try {
        await deleteTrack(track.id);
        queryClient.invalidateQueries({ queryKey: ["tracks"] });
      } catch {
        if (Platform.OS === "web") {
          window.alert("Failed to delete track. Please try again.");
        } else {
          Alert.alert("Delete Failed", "Could not delete the track. Please try again.");
        }
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(`Delete "${track.title}"? This cannot be undone.`)) {
        void doDelete();
      }
    } else {
      Alert.alert(
        "Delete Track",
        `Are you sure you want to delete "${track.title}"? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              void doDelete();
            },
          },
        ]
      );
    }
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    setIsSaving(true);
    try {
      const updated = await updateMe({
        name: editName.trim(),
        university: editUniversity.trim(),
        country: editCountry.trim(),
      });
      updateUser({
        name: updated.name,
        university: updated.university,
        country: updated.country,
      });

      if (isArtist && user?.id) {
        await updateArtist(user.id, {
          name: editName.trim(),
          bio: editBio.trim(),
          genre: editGenre.trim() || undefined,
          university: editUniversity.trim(),
        });
        queryClient.invalidateQueries({ queryKey: ["artists"] });
      }

      queryClient.invalidateQueries({ queryKey: ["me"] });
      setEditVisible(false);
    } catch {
      if (Platform.OS === "web") {
        window.alert("Failed to save profile changes. Please try again.");
      } else {
        Alert.alert("Save Failed", "Could not save your profile changes. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="person-circle-outline" size={64} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Not signed in</Text>
        <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
          Sign in to view your profile
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={[styles.screenTitle, { color: colors.foreground }]}>Profile</Text>
          <Pressable
            onPress={() => {
              setEditName(user.name);
              setEditUniversity(user.university);
              setEditCountry(user.country ?? "");
              setEditBio(myArtistRecord?.bio ?? "");
              setEditGenre(myArtistRecord?.genre ?? "");
              setEditVisible(true);
            }}
            style={[styles.editBtn, { backgroundColor: colors.card }]}
          >
            <Ionicons name="pencil" size={16} color={colors.foreground} />
          </Pressable>
        </View>

        {/* Avatar + Info */}
        <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
          <Pressable onPress={handlePickAvatar} style={styles.avatarWrapper}>
            {user.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, { backgroundColor: "#3a3a3a" }]}>
                <Text style={styles.avatarText}>{getInitials(user.name)}</Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Ionicons name="camera" size={12} color="#fff" />
            </View>
          </Pressable>
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.userName, { color: colors.foreground }]} numberOfLines={1}>
                {user.name}
              </Text>
              <RoleBadge role={user.role} colors={colors} />
            </View>
            <Text style={[styles.userEmail, { color: colors.mutedForeground }]} numberOfLines={1}>
              {user.email}
            </Text>
            {user.university ? (
              <View style={styles.metaRow}>
                <Ionicons name="school-outline" size={13} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {user.university}
                </Text>
              </View>
            ) : null}
            {user.country ? (
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={13} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {user.country}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Ionicons name="heart" size={20} color="#e85d4a" />
            <Text style={[styles.statNumber, { color: colors.foreground }]}>{likedIds.size}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Liked</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Ionicons name="library" size={20} color={colors.primary} />
            <Text style={[styles.statNumber, { color: colors.foreground }]}>{libraryIds.size}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Saved</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Ionicons name="star" size={20} color="#f59e0b" />
            <Text style={[styles.statNumber, { color: colors.foreground }]}>
              {effectiveFollowedArtists.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Following</Text>
          </View>
        </View>

        {/* Upload Track — artist only */}
        {user.role === "artist" && (
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/(tabs)/upload");
            }}
            style={[styles.uploadBtn, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
            <Text style={styles.uploadBtnText}>Upload a Track</Text>
          </Pressable>
        )}

        {/* My Music Section — artist only */}
        {user.role === "artist" && (
          <>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>My Tracks</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
                Tracks you've uploaded
              </Text>
            </View>
            {myTracksLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 8, marginBottom: 24 }} />
            ) : myTracks.length === 0 ? (
              <View style={[styles.emptyMusic, { backgroundColor: colors.card }]}>
                <Ionicons name="musical-notes-outline" size={32} color={colors.mutedForeground} />
                <Text style={[styles.emptyMusicText, { color: colors.mutedForeground }]}>
                  No tracks yet. Upload your first track!
                </Text>
              </View>
            ) : (
              <View style={[styles.trackList, { marginBottom: 24 }]}>
                {myTracks.map((track) => {
                  const color = GENRE_COLORS[track.genre] ?? track.coverColor;
                  return (
                    <Pressable
                      key={track.id}
                      onPress={() => {
                        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        playTrack(track, myTracks);
                      }}
                      style={[styles.trackCard, { backgroundColor: colors.card }]}
                    >
                      <View style={[styles.trackCover, { backgroundColor: color }]}>
                        {track.coverUrl ? (
                          <Image
                            source={{ uri: track.coverUrl }}
                            style={styles.trackCoverImage}
                            contentFit="cover"
                          />
                        ) : (
                          <Ionicons name="musical-note" size={18} color="#fff" />
                        )}
                      </View>
                      <View style={styles.trackInfo}>
                        <Text style={[styles.trackTitle, { color: colors.foreground }]} numberOfLines={1}>
                          {track.title}
                        </Text>
                        <Text style={[styles.trackGenre, { color: colors.mutedForeground }]}>
                          {track.genre}
                        </Text>
                      </View>
                      <View style={styles.trackMeta}>
                        <Ionicons name="play-circle-outline" size={14} color={colors.mutedForeground} />
                        <Text style={[styles.trackPlayCount, { color: colors.mutedForeground }]}>
                          {(track.playCount ?? 0).toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.trackActions}>
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            handleOpenEditTrack(track);
                          }}
                          style={[styles.trackActionBtn, { backgroundColor: colors.muted }]}
                          hitSlop={8}
                        >
                          <Ionicons name="pencil" size={14} color={colors.mutedForeground} />
                        </Pressable>
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDeleteTrack(track);
                          }}
                          style={[styles.trackActionBtn, { backgroundColor: "#e85d4a22" }]}
                          hitSlop={8}
                        >
                          <Ionicons name="trash-outline" size={14} color="#e85d4a" />
                        </Pressable>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* Following Section */}
        {effectiveFollowedArtists.length > 0 && (
          <>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Following</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
                Artists you follow
              </Text>
            </View>
            <View style={styles.artistsGrid}>
              {effectiveFollowedArtists.map((artist) => {
                const color = GENRE_COLORS[artist.genre] ?? artist.coverColor;
                return (
                  <View
                    key={artist.id}
                    style={[styles.artistCard, { backgroundColor: colors.card }]}
                  >
                    <View style={[styles.artistAvatar, { backgroundColor: color }]}>
                      <Ionicons name="musical-notes" size={20} color="#fff" />
                    </View>
                    <View style={styles.artistInfo}>
                      <Text style={[styles.artistName, { color: colors.foreground }]} numberOfLines={1}>
                        {artist.name}
                      </Text>
                      <Text style={[styles.artistGenre, { color: colors.mutedForeground }]}>
                        {artist.genre}
                      </Text>
                      {artist.university ? (
                        <Text style={[styles.artistUni, { color: colors.mutedForeground }]} numberOfLines={1}>
                          {artist.university}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => handleFollowToggle(artist.id)}
                      style={[styles.followBtn, { backgroundColor: colors.muted }]}
                    >
                      <Text style={[styles.followBtnText, { color: colors.mutedForeground }]}>
                        Following
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* All Artists Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Discover Artists</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
            Follow artists from your campus
          </Text>
        </View>

        {allArtistsLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : (
          <View style={styles.artistsGrid}>
            {(allArtists ?? [])
              .filter((a) => !isFollowing(a.id))
              .map((artist) => {
                const color = GENRE_COLORS[artist.genre] ?? artist.coverColor;
                return (
                  <View
                    key={artist.id}
                    style={[styles.artistCard, { backgroundColor: colors.card }]}
                  >
                    <View style={[styles.artistAvatar, { backgroundColor: color }]}>
                      <Ionicons name="musical-notes" size={20} color="#fff" />
                    </View>
                    <View style={styles.artistInfo}>
                      <Text style={[styles.artistName, { color: colors.foreground }]} numberOfLines={1}>
                        {artist.name}
                      </Text>
                      <Text style={[styles.artistGenre, { color: colors.mutedForeground }]}>
                        {artist.genre}
                      </Text>
                      {artist.university ? (
                        <Text style={[styles.artistUni, { color: colors.mutedForeground }]} numberOfLines={1}>
                          {artist.university}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => handleFollowToggle(artist.id)}
                      style={[styles.followBtn, { backgroundColor: colors.primary }]}
                    >
                      <Text style={[styles.followBtnText, { color: "#fff" }]}>
                        Follow
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            {(allArtists ?? []).filter((a) => !isFollowing(a.id)).length === 0 && (
              <View style={styles.allFollowedState}>
                <Ionicons name="checkmark-circle" size={40} color={colors.primary} />
                <Text style={[styles.allFollowedText, { color: colors.foreground }]}>
                  You follow all artists!
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Sign Out */}
        <Pressable
          onPress={handleSignOut}
          style={[styles.signOutBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Ionicons name="log-out-outline" size={18} color="#e85d4a" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>

      {/* Edit Track Modal */}
      <Modal
        visible={editTrackVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditTrackVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setEditTrackVisible(false)}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Edit Track</Text>
            <Pressable onPress={handleSaveTrack} disabled={isSavingTrack}>
              {isSavingTrack ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text style={[styles.modalSave, { color: colors.primary }]}>Save</Text>
              )}
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            {/* Cover Art */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Cover Art</Text>
            <View style={styles.editCoverRow}>
              <Pressable
                onPress={handlePickEditCover}
                disabled={isUploadingEditCover}
                style={[styles.editCoverThumb, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                {isUploadingEditCover ? (
                  <ActivityIndicator color={colors.primary} />
                ) : editCoverImageUri ? (
                  <Image
                    source={{ uri: editCoverImageUri }}
                    style={styles.editCoverImage}
                    contentFit="cover"
                  />
                ) : (
                  <Ionicons name="image-outline" size={28} color={colors.mutedForeground} />
                )}
                {editCoverObjectPath ? (
                  <View style={styles.editCoverCheck}>
                    <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                  </View>
                ) : null}
              </Pressable>
              <View style={styles.editCoverBtns}>
                <Pressable
                  onPress={handlePickEditCover}
                  disabled={isUploadingEditCover}
                  style={[styles.editCoverBtn, { backgroundColor: colors.muted }]}
                >
                  <Ionicons name="image-outline" size={15} color={colors.mutedForeground} />
                  <Text style={[styles.editCoverBtnText, { color: colors.mutedForeground }]}>
                    {editCoverImageUri ? "Change" : "Pick image"}
                  </Text>
                </Pressable>
                {editCoverImageUri ? (
                  <Pressable
                    onPress={handleRemoveEditCover}
                    style={[styles.editCoverBtn, { backgroundColor: "#e85d4a22" }]}
                  >
                    <Ionicons name="trash-outline" size={15} color="#e85d4a" />
                    <Text style={[styles.editCoverBtnText, { color: "#e85d4a" }]}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 8 }]}>Title</Text>
            <TextInput
              value={editTrackTitle}
              onChangeText={setEditTrackTitle}
              placeholder="Track title"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.fieldInput,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              autoCapitalize="words"
              autoCorrect={false}
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Genre</Text>
            <TextInput
              value={editTrackGenre}
              onChangeText={setEditTrackGenre}
              placeholder="Genre"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.fieldInput,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        visible={editVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setEditVisible(false)}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Edit Profile</Text>
            <Pressable onPress={handleSaveEdit} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text style={[styles.modalSave, { color: colors.primary }]}>Save</Text>
              )}
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Name</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.fieldInput,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              autoCapitalize="words"
              autoCorrect={false}
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>University</Text>
            <TextInput
              value={editUniversity}
              onChangeText={setEditUniversity}
              placeholder="Your university"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.fieldInput,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              autoCapitalize="words"
              autoCorrect={false}
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Country</Text>
            <TextInput
              value={editCountry}
              onChangeText={setEditCountry}
              placeholder="Your country"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.fieldInput,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              autoCapitalize="words"
              autoCorrect={false}
            />

            {isArtist && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Genre</Text>
                <TextInput
                  value={editGenre}
                  onChangeText={setEditGenre}
                  placeholder="e.g. Indie, Jazz, Hip Hop"
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    styles.fieldInput,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      color: colors.foreground,
                    },
                  ]}
                  autoCapitalize="words"
                  autoCorrect={false}
                />

                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Bio</Text>
                <TextInput
                  value={editBio}
                  onChangeText={setEditBio}
                  placeholder="Tell listeners about yourself…"
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    styles.fieldInput,
                    styles.fieldInputMultiline,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      color: colors.foreground,
                    },
                  ]}
                  multiline
                  numberOfLines={4}
                  autoCapitalize="sentences"
                  autoCorrect
                />
              </>
            )}

            <View style={[styles.readOnlyField, { backgroundColor: colors.muted }]}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>
                Email (cannot be changed)
              </Text>
              <Text style={[styles.readOnlyValue, { color: colors.foreground }]}>{user.email}</Text>
            </View>

            <View style={[styles.readOnlyField, { backgroundColor: colors.muted }]}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>
                Role (cannot be changed)
              </Text>
              <Text style={[styles.readOnlyValue, { color: colors.foreground }]}>
                {user.role === "artist" ? "Artist" : "Listener"}
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center", gap: 12 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  screenTitle: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  editBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  profileCard: {
    flexDirection: "row",
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 18,
    gap: 16,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  avatarWrapper: {
    position: "relative",
    width: 72,
    height: 72,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#e85d4a",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#1a1a1a",
  },
  avatarText: { color: "#fff", fontSize: 24, fontWeight: "700" },
  profileInfo: { flex: 1, gap: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  userName: { fontSize: 18, fontWeight: "700", flexShrink: 1 },
  userEmail: { fontSize: 13 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  metaText: { fontSize: 13 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  roleBadgeText: { fontSize: 11, fontWeight: "600" },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  statNumber: { fontSize: 20, fontWeight: "700" },
  statLabel: { fontSize: 11, fontWeight: "600" },
  section: { paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 2 },
  sectionSubtitle: { fontSize: 13 },
  artistsGrid: { paddingHorizontal: 20, gap: 10, marginBottom: 24 },
  artistCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    gap: 12,
  },
  artistAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  artistInfo: { flex: 1 },
  artistName: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  artistGenre: { fontSize: 12 },
  artistUni: { fontSize: 11, marginTop: 1 },
  followBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
  },
  followBtnText: { fontSize: 13, fontWeight: "600" },
  allFollowedState: { alignItems: "center", paddingVertical: 20, gap: 8 },
  allFollowedText: { fontSize: 15, fontWeight: "600" },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 14,
    borderRadius: 16,
  },
  uploadBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  trackList: { paddingHorizontal: 20, gap: 10 },
  trackCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    gap: 12,
  },
  trackCover: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  trackCoverImage: {
    width: "100%",
    height: "100%",
  },
  trackInfo: { flex: 1 },
  trackTitle: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  trackGenre: { fontSize: 12 },
  trackMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  trackPlayCount: { fontSize: 12 },
  trackActions: { flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 4 },
  trackActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  editCoverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
  },
  editCoverThumb: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  editCoverImage: {
    width: "100%",
    height: "100%",
  },
  editCoverCheck: {
    position: "absolute",
    bottom: 4,
    right: 4,
  },
  editCoverBtns: {
    flex: 1,
    gap: 8,
  },
  editCoverBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  editCoverBtnText: { fontSize: 13, fontWeight: "600" },
  emptyMusic: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  emptyMusicText: { fontSize: 14, textAlign: "center" },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  signOutText: { color: "#e85d4a", fontSize: 15, fontWeight: "600" },
  emptyTitle: { fontSize: 18, fontWeight: "600" },
  emptySubtitle: { fontSize: 14, textAlign: "center" },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: "600" },
  modalCancel: { fontSize: 16 },
  modalSave: { fontSize: 16, fontWeight: "600" },
  modalBody: { padding: 20, gap: 6 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  fieldInputMultiline: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  readOnlyField: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 4,
  },
  readOnlyValue: { fontSize: 15 },
});
