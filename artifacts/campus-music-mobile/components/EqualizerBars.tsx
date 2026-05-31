import React, { useEffect, useRef } from "react";
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { FrequencyBands } from "@/utils/frequencyAnalyzer";

interface EqualizerBarsProps {
  isPlaying: boolean;
  color?: string;
  /** Number of bars to show (max 5). */
  barCount?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  /**
   * Per-band frequency energy [0–1] from the real-time frequency analyzer.
   * When provided, each bar reflects a distinct frequency band independently.
   * Takes priority over audioLevel.
   */
  frequencyBands?: FrequencyBands | null;
  /**
   * Normalized audio level (0–1) from real-time metering.
   * Used as a fallback when frequencyBands is unavailable.
   * When both are null/undefined, falls back to the animated pattern.
   */
  audioLevel?: number | null;
}

const BAR_CONFIGS = [
  { minH: 0.25, maxH: 0.9,  duration: 420 },
  { minH: 0.4,  maxH: 1.0,  duration: 340 },
  { minH: 0.15, maxH: 0.75, duration: 510 },
  { minH: 0.5,  maxH: 0.95, duration: 380 },
  { minH: 0.2,  maxH: 0.85, duration: 460 },
];

/**
 * Per-bar frequency band weights used when only a single RMS audioLevel is
 * available (fallback path). Gives slightly different sensitivities per bar.
 */
const FALLBACK_WEIGHTS = [0.75, 1.0, 0.88, 0.95, 0.72];

function Bar({
  isPlaying,
  color,
  totalHeight,
  minH,
  maxH,
  duration,
  initialDelay,
  targetLevel,
}: {
  isPlaying: boolean;
  color: string;
  totalHeight: number;
  minH: number;
  maxH: number;
  duration: number;
  initialDelay: number;
  /** Audio-reactive target (0–1 normalized). undefined = use fallback animation. */
  targetLevel: number | undefined;
}) {
  const anim = useRef(new Animated.Value(minH)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);
  const hasAudioData = targetLevel !== undefined;

  // Audio-reactive mode: spring to target whenever it changes
  useEffect(() => {
    if (!hasAudioData) return;

    loopRef.current?.stop();
    loopRef.current = null;

    const resolvedTarget = isPlaying ? targetLevel! : minH;
    Animated.spring(anim, {
      toValue: resolvedTarget,
      useNativeDriver: false,
      damping: 16,
      stiffness: 200,
      mass: 0.4,
    }).start();
  }, [hasAudioData, targetLevel, isPlaying]);

  // Fallback loop animation when no audio metering is available
  useEffect(() => {
    if (hasAudioData) return;

    if (isPlaying) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(initialDelay),
          Animated.timing(anim, { toValue: maxH, duration, useNativeDriver: false }),
          Animated.timing(anim, { toValue: minH, duration, useNativeDriver: false }),
        ])
      );
      loopRef.current = loop;
      loop.start();
    } else {
      loopRef.current?.stop();
      loopRef.current = null;
      Animated.timing(anim, {
        toValue: minH,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }

    return () => {
      loopRef.current?.stop();
    };
  }, [hasAudioData, isPlaying]);

  const height = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, totalHeight],
  });

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          height,
          backgroundColor: color,
          width: Math.max(2, totalHeight * 0.14),
          borderRadius: Math.max(1, totalHeight * 0.07),
        },
      ]}
    />
  );
}

export function EqualizerBars({
  isPlaying,
  color = "#e85d4a",
  barCount = 5,
  height = 20,
  style,
  frequencyBands,
  audioLevel,
}: EqualizerBarsProps) {
  const configs = BAR_CONFIGS.slice(0, barCount);
  const weights = FALLBACK_WEIGHTS.slice(0, barCount);

  return (
    <View style={[styles.container, { height }, style]}>
      {configs.map((cfg, i) => {
        let targetLevel: number | undefined;

        if (frequencyBands != null) {
          // True frequency-band mode: each bar gets its own independent band energy.
          // Map normalized band energy [0–1] into the bar's min–max height range.
          const bandEnergy = frequencyBands[i] ?? 0;
          targetLevel = cfg.minH + (cfg.maxH - cfg.minH) * bandEnergy;
        } else if (audioLevel != null) {
          // Fallback: single RMS level with per-bar weighting to simulate independence.
          targetLevel = cfg.minH + (cfg.maxH - cfg.minH) * Math.min(1, audioLevel * weights[i]);
        }
        // else: undefined → animated pattern fallback

        return (
          <Bar
            key={i}
            isPlaying={isPlaying}
            color={color}
            totalHeight={height}
            minH={cfg.minH}
            maxH={cfg.maxH}
            duration={cfg.duration}
            initialDelay={i * 60}
            targetLevel={targetLevel}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
  },
  bar: {
    borderRadius: 2,
  },
});
