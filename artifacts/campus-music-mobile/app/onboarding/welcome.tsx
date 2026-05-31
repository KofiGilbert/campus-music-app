import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
  Dimensions,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const { width, height } = Dimensions.get("window");

const FEATURED_COLORS = ["#e85d4a", "#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ec4899"];

export default function WelcomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: "#0a0a0a" }]}>
      {/* Background art grid */}
      <View style={styles.artGrid} pointerEvents="none">
        {FEATURED_COLORS.map((color, i) => (
          <View key={i} style={[styles.artBlock, { backgroundColor: color, opacity: 0.18 + (i % 3) * 0.06 }]} />
        ))}
      </View>

      {/* Gradient overlay */}
      <LinearGradient
        colors={["transparent", "rgba(10,10,10,0.7)", "#0a0a0a"]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Logo area */}
      <View style={[styles.logoArea, { paddingTop: topPad + 40 }]}>
        <Image
          source={require("@/assets/images/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Bottom content */}
      <View style={[styles.bottom, { paddingBottom: bottomPad + 20 }]}>
        <Text style={styles.headline}>Your campus.{"\n"}Your music.</Text>
        <Text style={styles.sub}>
          Discover artists from your university, connect with fellow music lovers, and build your sound.
        </Text>

        <View style={styles.dotRow}>
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          <View style={[styles.dot, { backgroundColor: "#333" }]} />
          <View style={[styles.dot, { backgroundColor: "#333" }]} />
        </View>

        <Pressable
          style={[styles.cta, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/onboarding/role")}
        >
          <Text style={styles.ctaText}>Get Started</Text>
        </Pressable>

        <Pressable
          style={styles.loginLink}
          onPress={() => router.push("/onboarding/login")}
        >
          <Text style={styles.loginText}>
            Already have an account?{" "}
            <Text style={{ color: colors.primary, fontWeight: "700" }}>Sign in</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  artGrid: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.55,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  artBlock: {
    width: width / 3,
    height: (height * 0.55) / 2,
  },
  logoArea: {
    alignItems: "center",
    paddingBottom: 24,
  },
  logo: {
    width: 140,
    height: 56,
    tintColor: "white",
  },
  bottom: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 28,
  },
  headline: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -1,
    marginBottom: 12,
    lineHeight: 42,
  },
  sub: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 28,
  },
  dotRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 28,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cta: {
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  ctaText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  loginLink: {
    alignItems: "center",
    paddingVertical: 8,
  },
  loginText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
  },
});
