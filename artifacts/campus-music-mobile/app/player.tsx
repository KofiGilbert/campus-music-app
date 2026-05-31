import { Ionicons } from "@/components/icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Dimensions, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { TrackCover } from "@/components/TrackCover";
import { EqualizerBars } from "@/components/EqualizerBars";
import { WaveformSeekBar } from "@/components/WaveformSeekBar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlayer } from "@/context/PlayerContext";
import { useColors } from "@/hooks/useColors";

const { width } = Dimensions.get("window");
const ARTWORK_SIZE = width - 64;

export default function PlayerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { currentTrack, isPlaying, isLoading, togglePlay, nextTrack, prevTrack, seekTo, toggleLike, addToLibrary, likedIds, progress, duration, audioLevel, frequencyBands, isShuffled, toggleShuffle } = usePlayer();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isPlaying) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.03, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.timing(rotateAnim, { toValue: 1, duration: 20000, useNativeDriver: true })
      ).start();
    } else {
      pulseAnim.setValue(1);
      rotateAnim.stopAnimation();
    }
  }, [isPlaying]);

  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  // Calculate displayed progress: use actual duration if available, fallback to track duration string
  const trackDurationSeconds = currentTrack
    ? (currentTrack as { durationSeconds?: number }).durationSeconds ??
      (() => {
        const parts = currentTrack.duration.split(":").map(Number);
        return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
      })()
    : 0;
  const effectiveDuration = duration > 0 ? duration : trackDurationSeconds;
  const progressRatio = effectiveDuration > 0 ? Math.min(progress / effectiveDuration, 1) : 0;

  const formatTime = (secs: number) =>
    `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;

  if (!currentTrack) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="chevron-down" size={28} color={colors.foreground} />
        </Pressable>
        <View style={styles.empty}>
          <Ionicons name="musical-notes-outline" size={64} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No track playing</Text>
        </View>
      </View>
    );
  }

  const isLiked = likedIds.has(currentTrack.id);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.bgBlob, { backgroundColor: currentTrack.coverColor, opacity: 0.15 }]} />

      <View style={[styles.inner, { paddingTop: topPad + 8, paddingBottom: bottomPad + 8 }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-down" size={28} color={colors.foreground} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerLabel, { color: colors.mutedForeground }]}>Now Playing</Text>
          </View>
          <Pressable hitSlop={12}>
            <Ionicons name="ellipsis-horizontal" size={24} color={colors.foreground} />
          </Pressable>
        </View>

        {/* Artwork */}
        <View style={styles.artworkWrap}>
          <Animated.View
            style={[
              styles.artwork,
              {
                transform: [{ scale: pulseAnim }, { rotate }],
                width: ARTWORK_SIZE,
                height: ARTWORK_SIZE,
              },
            ]}
          >
            <TrackCover
              coverUrl={currentTrack.coverUrl}
              coverColor={currentTrack.coverColor}
              size={ARTWORK_SIZE}
              thumbSize={400}
              borderRadius={24}
              iconSize={Math.round(ARTWORK_SIZE * 0.35)}
            />
          </Animated.View>
          <EqualizerBars
            isPlaying={isPlaying}
            color={currentTrack.coverColor}
            height={28}
            barCount={5}
            style={styles.equalizerBars}
            frequencyBands={frequencyBands}
            audioLevel={audioLevel}
          />
        </View>

        {/* Track info */}
        <View style={styles.trackInfo}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.trackTitle, { color: colors.foreground }]} numberOfLines={1}>
              {currentTrack.title}
            </Text>
            <Text style={[styles.trackArtist, { color: colors.mutedForeground }]} numberOfLines={1}>
              {currentTrack.artist}
            </Text>
            {currentTrack.playCount !== undefined && (
              <View style={styles.playCountRow}>
                <Ionicons name="headset-outline" size={12} color={colors.mutedForeground} />
                <Text style={[styles.playCountText, { color: colors.mutedForeground }]}>
                  {currentTrack.playCount >= 1000
                    ? `${(currentTrack.playCount / 1000).toFixed(1)}k plays`
                    : `${currentTrack.playCount} plays`}
                </Text>
              </View>
            )}
          </View>
          <Pressable
            style={styles.likeBtn}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              toggleLike(currentTrack.id);
            }}
            hitSlop={12}
          >
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={28}
              color={isLiked ? colors.primary : colors.mutedForeground}
            />
            {currentTrack.likes !== undefined && (
              <Text style={[styles.likeCountText, { color: isLiked ? colors.primary : colors.mutedForeground }]}>
                {Math.max(0, currentTrack.likes).toLocaleString()}
              </Text>
            )}
          </Pressable>
        </View>

        {/* Waveform seek bar */}
        <View style={styles.progressSection}>
          <WaveformSeekBar
            progressRatio={progressRatio}
            accentColor={currentTrack.coverColor}
            trackColor={colors.foreground}
            height={56}
            seed={currentTrack.id}
            onSeek={(ratio) => seekTo(ratio * effectiveDuration)}
            audioLevel={audioLevel}
          />
          <View style={styles.timeRow}>
            <Text style={[styles.timeText, { color: colors.mutedForeground }]}>
              {formatTime(progress)}
            </Text>
            <Text style={[styles.timeText, { color: colors.mutedForeground }]}>{currentTrack.duration}</Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <Pressable
            hitSlop={12}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              toggleShuffle();
            }}
          >
            <Ionicons name="shuffle" size={22} color={isShuffled ? colors.primary : colors.mutedForeground} />
            {isShuffled && (
              <View style={[styles.shuffleDot, { backgroundColor: colors.primary }]} />
            )}
          </Pressable>
          <Pressable hitSlop={12} onPress={() => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); prevTrack(); }}>
            <Ionicons name="play-skip-back" size={32} color={colors.foreground} />
          </Pressable>
          <Pressable
            style={[styles.playBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              togglePlay();
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name={isPlaying ? "pause" : "play"} size={34} color="#fff" />
            )}
          </Pressable>
          <Pressable hitSlop={12} onPress={() => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); nextTrack(); }}>
            <Ionicons name="play-skip-forward" size={32} color={colors.foreground} />
          </Pressable>
          <Pressable hitSlop={12}>
            <Ionicons name="repeat" size={22} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {/* Genre + Add */}
        <View style={styles.bottomRow}>
          <View style={[styles.genrePill, { backgroundColor: colors.card }]}>
            <Ionicons name="musical-note" size={14} color={colors.mutedForeground} />
            <Text style={[styles.genreText, { color: colors.mutedForeground }]}>{currentTrack.genre}</Text>
          </View>
          <Pressable
            style={[styles.addBtn, { backgroundColor: colors.card }]}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              addToLibrary(currentTrack.id);
            }}
          >
            <Ionicons name="add" size={18} color={colors.foreground} />
            <Text style={[styles.addText, { color: colors.foreground }]}>Add to Library</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgBlob: { position: "absolute", top: -100, left: -100, right: -100, height: 400, borderRadius: 300 },
  inner: { flex: 1, paddingHorizontal: 32 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 32 },
  headerCenter: { flex: 1, alignItems: "center" },
  headerLabel: { fontSize: 13, fontWeight: "600", letterSpacing: 0.5 },
  artworkWrap: { alignItems: "center", marginBottom: 20 },
  equalizerBars: { marginTop: 16 },
  artwork: { borderRadius: 24, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 16 },
  trackInfo: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  likeBtn: { alignItems: "center" },
  likeCountText: { fontSize: 12, fontWeight: "600", marginTop: 4 },
  trackTitle: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5, marginBottom: 4 },
  trackArtist: { fontSize: 16, marginBottom: 4 },
  playCountRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  playCountText: { fontSize: 12 },
  progressSection: { marginBottom: 24 },
  timeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  timeText: { fontSize: 12 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 32 },
  playBtn: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  genrePill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14 },
  genreText: { fontSize: 13, fontWeight: "500" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 14 },
  addText: { fontSize: 13, fontWeight: "600" },
  closeBtn: { padding: 16 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 16 },
  shuffleDot: { width: 4, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 3 },
});
