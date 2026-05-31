import { Ionicons } from "@/components/icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { TrackCover } from "@/components/TrackCover";
import { TrackMenu } from "@/components/TrackMenu";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";

export interface Track {
  id: string;
  title: string;
  artist: string;
  genre: string;
  duration: string;
  coverColor: string;
  liked: boolean;
  audioUrl?: string | null;
  coverUrl?: string | null;
  durationSeconds?: number;
  university?: string | null;
  playCount?: number;
  likes?: number;
}

interface MusicCardProps {
  track: Track;
  onLike: (id: string) => void;
  onPlay: (track: Track) => void;
  onPlayNext?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  compact?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function MusicCard({ track, onLike, onPlay, onPlayNext, onAddToQueue, compact = false }: MusicCardProps) {
  const colors = useColors();
  const scale = useSharedValue(1);
  const [menuVisible, setMenuVisible] = useState(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSpring(0.96, { duration: 100 }, () => {
      scale.value = withSpring(1);
    });
    if (Platform.OS !== "web") Haptics.selectionAsync();
    onPlay(track);
  };

  const handleLike = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLike(track.id);
  };

  const handleMenuOpen = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMenuVisible(true);
  };

  const showMenu = !!(onPlayNext || onAddToQueue);

  if (compact) {
    return (
      <>
        <AnimatedPressable style={[styles.compactCard, { backgroundColor: colors.card }, animatedStyle]} onPress={handlePress}>
          <TrackCover
            coverUrl={track.coverUrl}
            coverColor={track.coverColor}
            size={48}
            thumbSize={96}
            borderRadius={8}
            iconSize={20}
            style={{ marginRight: 12 }}
          />
          <View style={styles.compactInfo}>
            <Text style={[styles.compactTitle, { color: colors.foreground }]} numberOfLines={1}>{track.title}</Text>
            <View style={styles.compactSubRow}>
              <Text style={[styles.compactArtist, { color: colors.mutedForeground }]} numberOfLines={1}>{track.artist}</Text>
              {track.playCount !== undefined && (
                <View style={styles.compactPlayCount}>
                  <Ionicons name="headset-outline" size={10} color={colors.mutedForeground} />
                  <Text style={[styles.compactPlayCountText, { color: colors.mutedForeground }]}>
                    {track.playCount >= 1000
                      ? `${(track.playCount / 1000).toFixed(1)}k plays`
                      : `${track.playCount} plays`}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <Text style={[styles.duration, { color: colors.mutedForeground }]}>{track.duration}</Text>
          <Pressable onPress={handleLike} style={styles.likeBtn} hitSlop={12}>
            <Ionicons
              name={track.liked ? "heart" : "heart-outline"}
              size={20}
              color={track.liked ? colors.primary : colors.mutedForeground}
            />
            {track.likes !== undefined && (
              <Text style={[styles.likeCount, { color: track.liked ? colors.primary : colors.mutedForeground }]}>
                {track.likes.toLocaleString()}
              </Text>
            )}
          </Pressable>
          {showMenu && (
            <Pressable onPress={handleMenuOpen} style={styles.moreBtn} hitSlop={12}>
              <Ionicons name="ellipsis-vertical" size={18} color={colors.mutedForeground} />
            </Pressable>
          )}
        </AnimatedPressable>
        {showMenu && (
          <TrackMenu
            track={track}
            visible={menuVisible}
            onClose={() => setMenuVisible(false)}
            onPlayNext={onPlayNext ?? (() => {})}
            onAddToQueue={onAddToQueue ?? (() => {})}
          />
        )}
      </>
    );
  }

  return (
    <>
      <AnimatedPressable style={[styles.card, animatedStyle]} onPress={handlePress}>
        <View style={styles.coverWrapper}>
          <TrackCover
            coverUrl={track.coverUrl}
            coverColor={track.coverColor}
            size={160}
            thumbSize={320}
            borderRadius={0}
            iconSize={36}
          />
          <Pressable onPress={handleLike} style={styles.likeOverlay} hitSlop={8}>
            <Ionicons
              name={track.liked ? "heart" : "heart-outline"}
              size={22}
              color={track.liked ? "#ff6b6b" : "rgba(255,255,255,0.8)"}
            />
          </Pressable>
          {showMenu && (
            <Pressable onPress={handleMenuOpen} style={styles.moreOverlay} hitSlop={8}>
              <Ionicons name="ellipsis-horizontal" size={18} color="rgba(255,255,255,0.9)" />
            </Pressable>
          )}
        </View>
        <View style={[styles.cardInfo, { backgroundColor: colors.card }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{track.title}</Text>
            <Text style={[styles.artist, { color: colors.mutedForeground }]} numberOfLines={1}>{track.artist}</Text>
          </View>
          {track.playCount !== undefined && (
            <View style={styles.playCountPill}>
              <Ionicons name="headset-outline" size={10} color={colors.mutedForeground} />
              <Text style={[styles.playCountPillText, { color: colors.mutedForeground }]}>
                {track.playCount >= 1000
                  ? `${(track.playCount / 1000).toFixed(1)}k plays`
                  : `${track.playCount} plays`}
              </Text>
            </View>
          )}
          {track.likes !== undefined && (
            <View style={styles.likePill}>
              <Ionicons name="heart" size={10} color="#ff6b6b" />
              <Text style={styles.likePillText}>{track.likes.toLocaleString()}</Text>
            </View>
          )}
          <View style={[styles.genreTag, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.genre, { color: colors.mutedForeground }]}>{track.genre}</Text>
          </View>
        </View>
      </AnimatedPressable>
      {showMenu && (
        <TrackMenu
          track={track}
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          onPlayNext={onPlayNext ?? (() => {})}
          onAddToQueue={onAddToQueue ?? (() => {})}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 160,
    borderRadius: 16,
    overflow: "hidden",
    marginRight: 12,
  },
  coverWrapper: {
    width: 160,
    height: 160,
    position: "relative",
  },
  likeOverlay: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 20,
    padding: 6,
  },
  moreOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 20,
    padding: 6,
  },
  cardInfo: {
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  artist: {
    fontSize: 12,
  },
  genreTag: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  genre: {
    fontSize: 10,
    fontWeight: "500",
  },
  // Compact styles
  compactCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  compactInfo: {
    flex: 1,
    marginRight: 8,
  },
  compactTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  compactSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  compactArtist: {
    fontSize: 13,
  },
  compactPlayCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  compactPlayCountText: {
    fontSize: 11,
  },
  duration: {
    fontSize: 12,
    marginRight: 12,
  },
  likeBtn: {
    padding: 4,
    alignItems: "center",
  },
  likeCount: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  moreBtn: {
    padding: 4,
    marginLeft: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  playCountPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginRight: 5,
  },
  playCountPillText: {
    fontSize: 10,
    fontWeight: "500",
  },
  likePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginRight: 6,
  },
  likePillText: {
    fontSize: 10,
    color: "#ff6b6b",
    fontWeight: "600",
  },
});
