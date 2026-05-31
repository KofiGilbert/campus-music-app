import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";

const BAR_COUNT = 40;
const BAR_GAP = 2;

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

function generateBars(seed: string, count: number): number[] {
  const rand = seededRandom(seed);
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    const wave = 0.4 + 0.35 * Math.sin((i / count) * Math.PI * 3 + rand() * Math.PI);
    const noise = (rand() - 0.5) * 0.4;
    bars.push(Math.max(0.08, Math.min(1, wave + noise)));
  }
  return bars;
}

interface MiniWaveformProps {
  progressRatio: number;
  accentColor: string;
  trackColor: string;
  height?: number;
  seed?: string;
}

export function MiniWaveform({
  progressRatio,
  accentColor,
  trackColor,
  height = 18,
  seed = "default",
}: MiniWaveformProps) {
  const bars = useMemo(() => generateBars(seed, BAR_COUNT), [seed]);

  return (
    <View style={[styles.container, { height }]}>
      {bars.map((h, i) => {
        const isFilled = i / BAR_COUNT < progressRatio;
        const isNear = !isFilled && i / BAR_COUNT < progressRatio + 0.05;
        const opacity = isNear ? 0.45 : isFilled ? 1 : 0.25;

        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: h * height,
              borderRadius: 1.5,
              backgroundColor: isFilled || isNear ? accentColor : trackColor,
              opacity,
              marginRight: i < BAR_COUNT - 1 ? BAR_GAP : 0,
              alignSelf: "center",
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
});
