import { Ionicons } from "@/components/icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { CrossDeviceResumePrompt } from "@/context/PlayerContext";

interface Props {
  prompt: CrossDeviceResumePrompt;
  onResume: () => void;
  onDismiss: () => void;
}

function formatPosition(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ResumePromptBanner({ prompt, onResume, onDismiss }: Props) {
  const colors = useColors();
  const slideY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleResume = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onResume();
  };

  const handleDismiss = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    Animated.parallel([
      Animated.timing(slideY, { toValue: -80, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => onDismiss());
  };

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          transform: [{ translateY: slideY }],
          opacity,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: "#e85d4a22" }]}>
        <Ionicons name="phone-portrait-outline" size={18} color="#e85d4a" />
      </View>

      <View style={styles.textCol}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          Pick up where you left off
        </Text>
        <Text style={[styles.trackTitle, { color: colors.foreground }]} numberOfLines={1}>
          {prompt.trackTitle}
          <Text style={[styles.positionText, { color: colors.mutedForeground }]}>
            {" "}· {formatPosition(prompt.position)}
          </Text>
        </Text>
        <Text style={[styles.artistText, { color: colors.mutedForeground }]} numberOfLines={1}>
          {prompt.artist}
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.resumeBtn, { backgroundColor: "#e85d4a" }]}
          onPress={handleResume}
          hitSlop={8}
        >
          <Ionicons name="play" size={12} color="#fff" style={{ marginLeft: 2 }} />
          <Text style={styles.resumeText}>Resume</Text>
        </Pressable>

        <Pressable onPress={handleDismiss} hitSlop={12} style={styles.dismissBtn}>
          <Ionicons name="close" size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  textCol: {
    flex: 1,
    gap: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  trackTitle: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  positionText: {
    fontSize: 13,
    fontWeight: "400",
  },
  artistText: {
    fontSize: 11,
    fontWeight: "400",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  resumeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  resumeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  dismissBtn: {
    padding: 2,
  },
});
