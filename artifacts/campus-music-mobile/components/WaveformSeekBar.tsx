import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, GestureResponderEvent, LayoutChangeEvent, Pressable, StyleSheet, View } from "react-native";

const BAR_COUNT = 60;
const BAR_GAP = 2;
/** Bars within this many indices of the playhead receive animation. */
const ANIM_WINDOW = 14;
/** Maximum scaleY boost at full audio level for the bar exactly at the playhead. */
const MAX_BOOST = 0.55;

/**
 * Seeded pseudo-random number generator (mulberry32).
 * Produces the same bar heights for the same seed string, so the waveform
 * looks consistent for the same track across re-renders.
 */
function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 0x9e3779b9);
    h ^= h >>> 16;
  }
  let s = (h >>> 0) || 1;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0xffffffff;
  };
}

/**
 * Generate a waveform pattern: a mix of natural-looking music-style heights
 * with some grouping so it doesn't look completely random.
 */
function generateBars(seed: string, count: number): number[] {
  const rand = seededRandom(seed);
  const bars: number[] = [];

  for (let i = 0; i < count; i++) {
    const wave = 0.4 + 0.35 * Math.sin((i / count) * Math.PI * 3 + rand() * Math.PI);
    const noise = (rand() - 0.5) * 0.4;
    const height = Math.max(0.08, Math.min(1, wave + noise));
    bars.push(height);
  }

  return bars;
}

interface WaveformSeekBarProps {
  /** Playback progress as a ratio 0–1 */
  progressRatio: number;
  /** Accent colour (track cover colour) used for the filled portion */
  accentColor: string;
  /** Unfilled bar colour */
  trackColor: string;
  /** Total height of the waveform area in dp */
  height?: number;
  /** Called with the new seek ratio (0–1) when the user taps */
  onSeek: (ratio: number) => void;
  /** Stable seed string so the bars are consistent per track */
  seed?: string;
  /** Real-time audio level 0–1 from the PCM callback */
  audioLevel?: number | null;
}

export function WaveformSeekBar({
  progressRatio,
  accentColor,
  trackColor,
  height = 56,
  onSeek,
  seed = "default",
  audioLevel = null,
}: WaveformSeekBarProps) {
  const bars = useMemo(() => generateBars(seed, BAR_COUNT), [seed]);

  const [containerWidth, setContainerWidth] = React.useState(0);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      if (containerWidth <= 0) return;
      const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / containerWidth));
      onSeek(ratio);
    },
    [containerWidth, onSeek]
  );

  const barWidth =
    containerWidth > 0
      ? Math.max(1, (containerWidth - BAR_GAP * (BAR_COUNT - 1)) / BAR_COUNT)
      : 3;

  // Smoothed animated value that tracks audioLevel with a short easing window.
  // useNativeDriver:true works because we animate scaleY (a transform), not height.
  const smoothedLevel = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    animRef.current?.stop();
    animRef.current = Animated.timing(smoothedLevel, {
      toValue: audioLevel ?? 0,
      duration: 100,
      useNativeDriver: true,
    });
    animRef.current.start();
  }, [audioLevel, smoothedLevel]);

  // Reset to zero when nothing is playing
  useEffect(() => {
    if (audioLevel === null) {
      animRef.current?.stop();
      smoothedLevel.setValue(0);
    }
  }, [audioLevel, smoothedLevel]);

  const playheadBar = progressRatio * BAR_COUNT;

  return (
    <Pressable
      onLayout={handleLayout}
      onPress={handlePress}
      style={[styles.container, { height }]}
      hitSlop={{ top: 12, bottom: 12 }}
    >
      {bars.map((h, i) => {
        const isFilled = i / BAR_COUNT < progressRatio;
        const isNear = !isFilled && i / BAR_COUNT < progressRatio + 0.04;
        const opacity = isNear ? 0.45 : isFilled ? 1 : 0.28;

        const distance = Math.abs(i - playheadBar);
        const fadeFactor = Math.max(0, 1 - distance / ANIM_WINDOW);

        const barStyle = {
          width: barWidth,
          height: h * height,
          borderRadius: barWidth / 2,
          backgroundColor: isFilled || isNear ? accentColor : trackColor,
          opacity,
          marginRight: i < BAR_COUNT - 1 ? BAR_GAP : 0,
          alignSelf: "center" as const,
        };

        if (fadeFactor > 0) {
          // Interpolate scaleY: 1 at silence, up to (1 + MAX_BOOST * fadeFactor) at peak.
          const maxScale = 1 + MAX_BOOST * fadeFactor;
          const scaleY = smoothedLevel.interpolate({
            inputRange: [0, 1],
            outputRange: [1, maxScale],
            extrapolate: "clamp",
          });
          return (
            <Animated.View
              key={i}
              style={[barStyle, { transform: [{ scaleY }] }]}
            />
          );
        }

        return <View key={i} style={barStyle} />;
      })}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
});
