import { Ionicons } from "@/components/icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const GENRES = [
  "Indie", "Electronic", "Jazz", "Folk", "R&B",
  "Lo-Fi", "Hip Hop", "Ambient", "Acoustic", "Synth",
];

const AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/aac",
  "audio/ogg",
  "audio/wav",
  "audio/flac",
  "audio/x-flac",
  "audio/*",
];

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
    throw new Error(err.error ?? "Failed to get upload URL");
  }
  return res.json();
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

function uploadToGcsWithProgress(
  presignedUrl: string,
  fileUri: string,
  contentType: string,
  onProgress: (pct: number) => void
): Promise<void> {
  return fetch(fileUri)
    .then((r) => r.blob())
    .then(
      (blob) =>
        new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", presignedUrl);
          xhr.setRequestHeader("Content-Type", contentType);
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              onProgress(Math.round((e.loaded / e.total) * 100));
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              onProgress(100);
              resolve();
            } else {
              reject(new Error("Failed to upload file to storage"));
            }
          };
          xhr.onerror = () => reject(new Error("Failed to upload file to storage"));
          xhr.send(blob);
        })
    );
}

async function createTrack(
  token: string,
  data: {
    title: string;
    genre: string;
    audioUrl: string;
    coverUrl?: string | null;
    duration: string;
    durationSeconds: number;
  }
): Promise<void> {
  const res = await fetch(`${API_BASE}/tracks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to create track" }));
    throw new Error(err.error ?? "Failed to create track");
  }
}

export default function UploadScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { token, user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState(GENRES[0]);

  const [audioFileUri, setAudioFileUri] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [audioObjectPath, setAudioObjectPath] = useState<string | null>(null);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");

  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);
  const [coverObjectPath, setCoverObjectPath] = useState<string | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [coverUploadProgress, setCoverUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePickAudio = async () => {
    if (!token) {
      Alert.alert("Sign in required", "Please sign in to upload audio.");
      return;
    }

    if (Platform.OS === "web") {
      Alert.alert("Not supported", "Audio file picking is only supported on mobile devices.");
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: AUDIO_MIME_TYPES,
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setIsUploadingAudio(true);
    setAudioFileUri(asset.uri);
    setAudioFileName(asset.name);
    setAudioObjectPath(null);

    try {
      const fileName = asset.name ?? `audio-${Date.now()}.mp3`;
      const mimeType = asset.mimeType ?? "audio/mpeg";
      const fileSize = asset.size ?? 0;

      const { uploadURL, objectPath } = await requestUploadUrl(token, {
        name: fileName,
        size: fileSize,
        contentType: mimeType,
      });

      await uploadToGcs(uploadURL, asset.uri, mimeType);
      setAudioObjectPath(objectPath);
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Could not upload audio file.");
      setAudioFileUri(null);
      setAudioFileName(null);
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const handleRemoveAudio = () => {
    setAudioFileUri(null);
    setAudioFileName(null);
    setAudioObjectPath(null);
  };

  const handlePickCover = async () => {
    if (!token) {
      Alert.alert("Sign in required", "Please sign in to upload cover art.");
      return;
    }

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

    setIsUploadingCover(true);
    setCoverUploadProgress(0);
    setCoverImageUri(asset.uri);
    setCoverObjectPath(null);

    try {
      const fileName = asset.fileName ?? `cover-${Date.now()}.jpg`;
      const mimeType = asset.mimeType ?? "image/jpeg";
      const fileSize = asset.fileSize ?? 500000;

      const { uploadURL, objectPath } = await requestUploadUrl(token, {
        name: fileName,
        size: fileSize,
        contentType: mimeType,
      });

      await uploadToGcsWithProgress(uploadURL, asset.uri, mimeType, (pct) => {
        setCoverUploadProgress(pct);
      });
      setCoverObjectPath(objectPath);
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Could not upload cover art.");
      setCoverImageUri(null);
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleRemoveCover = () => {
    setCoverImageUri(null);
    setCoverObjectPath(null);
  };

  const handleSubmit = async () => {
    if (!token) {
      Alert.alert("Sign in required", "Please sign in to upload tracks.");
      return;
    }
    if (!title.trim()) {
      Alert.alert("Missing title", "Please enter a track title.");
      return;
    }

    const resolvedAudioUrl = audioObjectPath
      ? `${API_BASE}/storage${audioObjectPath}`
      : audioUrl.trim();

    if (!resolvedAudioUrl) {
      Alert.alert("Missing audio", "Please pick an audio file or enter an audio URL.");
      return;
    }

    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSubmitting(true);

    try {
      const coverUrl = coverObjectPath
        ? `${API_BASE}/storage${coverObjectPath}`
        : null;

      await createTrack(token, {
        title: title.trim(),
        genre,
        audioUrl: resolvedAudioUrl,
        coverUrl,
        duration: "0:00",
        durationSeconds: 0,
      });

      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["tracks"] });

      setTitle("");
      setAudioUrl("");
      setAudioFileUri(null);
      setAudioFileName(null);
      setAudioObjectPath(null);
      setCoverImageUri(null);
      setCoverObjectPath(null);

      Alert.alert("Track uploaded!", "Your track is now live on Campus Music.", [
        { text: "OK", onPress: () => router.push("/(tabs)") },
      ]);
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Could not create track.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="cloud-upload-outline" size={64} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Sign in to upload</Text>
        <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
          You need an artist account to upload music.
        </Text>
      </View>
    );
  }

  // Uploading is gated on a verified email (the server returns 403 otherwise).
  if (user && !user.emailVerified) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="mail-unread-outline" size={64} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Verify your email</Text>
        <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
          Verify {user.email} to upload music. Check your inbox for the verification code we sent.
        </Text>
      </View>
    );
  }

  const hasAudioFile = !!audioFileUri;
  const isBusy = isSubmitting || isUploadingCover || isUploadingAudio;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Text style={[styles.screenTitle, { color: colors.foreground }]}>Upload Track</Text>
        </View>

        {/* Cover Art Picker */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Cover Art</Text>
          <Pressable
            onPress={coverImageUri ? handleRemoveCover : handlePickCover}
            style={[
              styles.coverPicker,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderStyle: coverImageUri ? "solid" : "dashed",
              },
            ]}
          >
            {isUploadingCover ? (
              <View style={styles.coverPlaceholder}>
                <Ionicons name="image-outline" size={36} color={colors.primary} />
                <Text style={[styles.coverHint, { color: colors.foreground }]}>
                  Uploading cover art…
                </Text>
                <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { backgroundColor: colors.primary, width: `${coverUploadProgress}%` as `${number}%` },
                    ]}
                  />
                </View>
                <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
                  {coverUploadProgress}%
                </Text>
              </View>
            ) : coverImageUri ? (
              <View style={styles.coverPreviewWrapper}>
                <Image
                  source={{ uri: coverImageUri }}
                  style={styles.coverPreview}
                  contentFit="cover"
                />
                {coverObjectPath ? (
                  <View style={styles.coverSuccessBadge}>
                    <Ionicons name="checkmark-circle" size={22} color="#10b981" />
                  </View>
                ) : null}
                <View style={[styles.coverRemoveOverlay, { backgroundColor: "rgba(0,0,0,0.45)" }]}>
                  <Ionicons name="trash-outline" size={22} color="#fff" />
                  <Text style={styles.coverRemoveText}>Remove</Text>
                </View>
              </View>
            ) : (
              <View style={styles.coverPlaceholder}>
                <Ionicons name="image-outline" size={40} color={colors.mutedForeground} />
                <Text style={[styles.coverHint, { color: colors.mutedForeground }]}>
                  Tap to pick cover art
                </Text>
                <Text style={[styles.coverSubhint, { color: colors.mutedForeground }]}>
                  Square image recommended
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Track Title */}
        <View style={styles.section}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Track Title *</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Golden Hour"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.fieldInput,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
            ]}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>

        {/* Genre Picker */}
        <View style={styles.section}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Genre *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreScroll}>
            {GENRES.map((g) => (
              <Pressable
                key={g}
                onPress={() => setGenre(g)}
                style={[
                  styles.genreChip,
                  {
                    backgroundColor: genre === g ? colors.primary : colors.card,
                    borderColor: genre === g ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.genreChipText,
                    { color: genre === g ? "#fff" : colors.foreground },
                  ]}
                >
                  {g}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Audio File Picker */}
        {Platform.OS !== "web" && (
          <View style={styles.section}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Audio File *</Text>
            {hasAudioFile ? (
              <View
                style={[
                  styles.audioFilePicked,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.audioFileInfo}>
                  {isUploadingAudio ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : audioObjectPath ? (
                    <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                  ) : (
                    <Ionicons name="musical-note-outline" size={20} color={colors.primary} />
                  )}
                  <Text
                    style={[styles.audioFileName, { color: colors.foreground }]}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {isUploadingAudio ? "Uploading…" : audioFileName ?? "Audio file"}
                  </Text>
                </View>
                {!isUploadingAudio && (
                  <Pressable onPress={handleRemoveAudio} style={styles.audioRemoveBtn}>
                    <Ionicons name="close-circle" size={22} color={colors.mutedForeground} />
                  </Pressable>
                )}
              </View>
            ) : (
              <Pressable
                onPress={handlePickAudio}
                style={[
                  styles.audioPickerBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Ionicons name="musical-note-outline" size={22} color={colors.primary} />
                <Text style={[styles.audioPickerText, { color: colors.primary }]}>
                  Choose audio file
                </Text>
                <Text style={[styles.audioPickerHint, { color: colors.mutedForeground }]}>
                  MP3, M4A, WAV, FLAC, AAC
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Audio URL fallback — shown on web, or on mobile when no file is picked */}
        {(Platform.OS === "web" || !hasAudioFile) && (
          <View style={styles.section}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              {Platform.OS === "web" ? "Audio URL *" : "Or paste a URL instead"}
            </Text>
            <TextInput
              value={audioUrl}
              onChangeText={setAudioUrl}
              placeholder="https://..."
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.fieldInput,
                { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
              ]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            {Platform.OS !== "web" && (
              <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>
                Link to your hosted audio file (.mp3, .m4a, etc.)
              </Text>
            )}
          </View>
        )}

        {/* Submit */}
        <Pressable
          onPress={handleSubmit}
          disabled={isBusy}
          style={[
            styles.submitBtn,
            { backgroundColor: isBusy ? colors.muted : colors.primary },
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : isUploadingAudio ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.submitBtnText}>Uploading audio…</Text>
            </>
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
              <Text style={styles.submitBtnText}>Upload Track</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
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
  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  fieldHint: {
    fontSize: 12,
    marginTop: 6,
  },
  coverPicker: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 20,
    borderWidth: 2,
    overflow: "hidden",
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  coverHint: {
    fontSize: 15,
    fontWeight: "600",
  },
  coverSubhint: {
    fontSize: 12,
  },
  coverPreviewWrapper: {
    flex: 1,
  },
  coverPreview: {
    width: "100%",
    height: "100%",
  },
  coverSuccessBadge: {
    position: "absolute",
    top: 12,
    right: 12,
  },
  coverRemoveOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  coverRemoveText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  genreScroll: {
    marginHorizontal: -4,
  },
  genreChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 4,
  },
  genreChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  audioPickerBtn: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 8,
  },
  audioPickerText: {
    fontSize: 15,
    fontWeight: "700",
  },
  audioPickerHint: {
    fontSize: 12,
  },
  audioFilePicked: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  audioFileInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  audioFileName: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  audioRemoveBtn: {
    paddingLeft: 8,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  emptyTitle: { fontSize: 18, fontWeight: "600" },
  emptySubtitle: { fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  progressTrack: {
    width: "70%",
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
});
