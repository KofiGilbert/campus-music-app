import { Ionicons } from "@/components/icons";
import { Image } from "expo-image";
import React from "react";
import { PixelRatio, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { resizeCoverUrl } from "@/utils/coverUrl";
import { colorToBlurhash } from "@/utils/blurhash";

interface TrackCoverProps {
  coverUrl?: string | null;
  coverColor: string;
  size: number;
  /**
   * Pixel width/height to request from the image CDN.
   * Defaults to `size * 2` (retina-ready) when omitted.
   * Pass the display size * 2 for list rows, or 400 for the full-screen player.
   */
  thumbSize?: number;
  borderRadius?: number;
  iconSize?: number;
  circular?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function TrackCover({
  coverUrl,
  coverColor,
  size,
  thumbSize,
  borderRadius = 8,
  iconSize,
  circular = false,
  style,
}: TrackCoverProps) {
  const radius = circular ? size / 2 : borderRadius;
  const computedIconSize = iconSize ?? Math.round(size * 0.4);
  // `thumbSize` (or size*2) is tuned for a 2x display. Scale it to the
  // device's actual pixel ratio (capped at 3) so covers stay crisp on
  // high-DPI screens instead of looking pixelated.
  const baseline = thumbSize ?? size * 2;
  const requestSize = Math.round((baseline / 2) * Math.min(PixelRatio.get(), 3));
  const blurhash = colorToBlurhash(coverColor);

  if (coverUrl) {
    const uri = resizeCoverUrl(coverUrl, requestSize);
    return (
      <View
        style={[
          styles.imageWrapper,
          { width: size, height: size, borderRadius: radius },
          style,
        ]}
      >
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          contentFit="cover"
          placeholder={{ blurhash }}
          transition={200}
          cachePolicy="memory-disk"
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: radius, backgroundColor: coverColor },
        style,
      ]}
    >
      <Ionicons
        name="musical-note"
        size={computedIconSize}
        color="rgba(255,255,255,0.85)"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  imageWrapper: {
    overflow: "hidden",
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
});
