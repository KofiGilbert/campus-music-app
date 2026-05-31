import { Ionicons } from "@/components/icons";
import * as Haptics from "expo-haptics";
import React, { useContext } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useColors } from "@/hooks/useColors";
import { TrackCover } from "@/components/TrackCover";
import { EqualizerBars } from "@/components/EqualizerBars";
import { MiniWaveform } from "@/components/MiniWaveform";
import { Track } from "./MusicCard";
import { usePlayer } from "@/context/PlayerContext";

interface NowPlayingBarProps {
  track: Track | null;
  isPlaying: boolean;
  isLoading?: boolean;
  onToggle: () => void;
  onNext: () => void;
  onPress?: () => void;
}

export function NowPlayingBar({ track, isPlaying, isLoading = false, onToggle, onNext, onPress }: NowPlayingBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // Exact height of the bottom tab bar (already includes the bottom safe-area
  // inset). Provided by the tab navigator to its descendant screens; `undefined`
  // on stack screens that have no tab bar.
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  const { audioLevel, frequencyBands, progress, duration } = usePlayer();

  if (!track) return null;

  const progressRatio = duration > 0 ? Math.max(0, Math.min(1, progress / duration)) : 0;

  const handleToggle = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onToggle();
  };

  // Sit flush on top of the bottom nav: offset the bar by the actual tab-bar
  // height (which already accounts for the safe-area inset). On screens without
  // a tab bar, fall back to just the safe-area inset. Hardcoding the tab-bar
  // height previously left a gap because the guess didn't match the real height.
  const bottomPad = Platform.OS === "web" ? 84 : tabBarHeight ?? insets.bottom;

  return (
    <Pressable
      style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border, bottom: bottomPad }]}
      onPress={onPress}
    >
      <View style={styles.mainRow}>
        <TrackCover
          coverUrl={track.coverUrl}
          coverColor={track.coverColor}
          size={40}
          thumbSize={80}
          borderRadius={8}
          iconSize={16}
          style={{ marginRight: 12 }}
        />
        <View style={styles.info}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{track.title}</Text>
          <View style={styles.artistRow}>
            <EqualizerBars isPlaying={isPlaying} color={colors.primary} height={14} barCount={4} style={{ marginRight: 6 }} frequencyBands={frequencyBands} audioLevel={audioLevel} />
            <Text style={[styles.artist, { color: colors.mutedForeground }]} numberOfLines={1}>{track.artist}</Text>
          </View>
        </View>
        <Pressable onPress={handleToggle} hitSlop={12} style={styles.btn} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name={isPlaying ? "pause" : "play"} size={26} color={colors.primary} />
          )}
        </Pressable>
        <Pressable onPress={(e) => { e.stopPropagation?.(); onNext(); }} hitSlop={12} style={styles.btn}>
          <Ionicons name="play-skip-forward" size={22} color={colors.foreground} />
        </Pressable>
      </View>
      <MiniWaveform
        progressRatio={progressRatio}
        accentColor={track.coverColor ?? colors.primary}
        trackColor={colors.mutedForeground}
        height={16}
        seed={track.id}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
  },
  artistRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  artist: {
    fontSize: 12,
    flexShrink: 1,
  },
  btn: {
    padding: 6,
    marginLeft: 4,
  },
});
