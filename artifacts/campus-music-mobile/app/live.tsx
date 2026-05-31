import { Ionicons } from "@/components/icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
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

function fmtViewers(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return String(n);
}

interface ChatMsg {
  id: string;
  name: string;
  text: string;
  color: string;
}

const SEED_CHAT: ChatMsg[] = [
  { id: "c1", name: "MikaKo", text: "this set is 🔥🔥🔥", color: "#ec4899" },
  { id: "c2", name: "DeShawn", text: "bro the bass line goes crazy", color: "#f59e0b" },
  { id: "c3", name: "Sofia", text: "been waiting for this 🙌", color: "#8b5cf6" },
  { id: "c4", name: "Liam", text: "first time catching a live — not disappointed", color: "#3b82f6" },
  { id: "c5", name: "Amara", text: "🎵🎵🎵", color: "#10b981" },
];

const AUTO_MSGS: Omit<ChatMsg, "id">[] = [
  { name: "Tyler", text: "drop the link after bro", color: "#0ea5e9" },
  { name: "Kofi", text: "campus music different fr", color: "#e85d4a" },
  { name: "Jordan", text: "already shared this with everyone 😭", color: "#6366f1" },
  { name: "Priya", text: "the vibes are immaculate", color: "#f97316" },
  { name: "Alex", text: "tune in every week fr", color: "#14b8a6" },
  { name: "DeShawn", text: "🔥🔥", color: "#f59e0b" },
  { name: "MikaKo", text: "can we get a tracklist?", color: "#ec4899" },
  { name: "Liam", text: "this beat switch 😩", color: "#3b82f6" },
  { name: "Kofi", text: "clip that!", color: "#e85d4a" },
  { name: "Sofia", text: "💯💯💯", color: "#8b5cf6" },
];

export default function LiveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id: string;
    name: string;
    color: string;
    photo: string;
    genre: string;
    viewers: string;
  }>();

  const name = params.name ?? "Artist";
  const color = params.color ?? "#e85d4a";
  const photo = params.photo ?? "";
  const genre = params.genre ?? "Live";
  const baseViewers = parseInt(params.viewers ?? "0", 10);

  const goToArtistProfile = () => {
    router.push({ pathname: "/artist/[id]", params: { id: params.id } });
  };

  const [viewers, setViewers] = useState(baseViewers);
  const [messages, setMessages] = useState<ChatMsg[]>(SEED_CHAT);
  const [input, setInput] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [floatingHearts, setFloatingHearts] = useState<{ id: string; x: number }[]>([]);
  const autoIdx = useRef(0);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setViewers((v) => v + Math.floor(Math.random() * 4));
      const msg = AUTO_MSGS[autoIdx.current % AUTO_MSGS.length];
      autoIdx.current += 1;
      setMessages((prev) => [...prev.slice(-20), { ...msg, id: `auto-${Date.now()}` }]);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev.slice(-20),
      { id: `me-${Date.now()}`, name: "You", text, color: "#e85d4a" },
    ]);
    setInput("");
  };

  const triggerHeart = () => {
    const id = `h-${Date.now()}`;
    const x = Math.random() * 40 - 20;
    setFloatingHearts((prev) => [...prev, { id, x }]);
    setTimeout(() => setFloatingHearts((prev) => prev.filter((h) => h.id !== id)), 1200);
  };

  return (
    <View style={styles.root}>
      {/* Full-screen background */}
      {photo ? (
        <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: color }]} />
      )}

      {/* Gradient: transparent in middle, dark at top and bottom */}
      <LinearGradient
        colors={[
          "rgba(0,0,0,0.55)",
          "rgba(0,0,0,0.0)",
          "rgba(0,0,0,0.0)",
          "rgba(0,0,0,0.75)",
        ]}
        locations={[0, 0.25, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Top overlay ── */}
      <View style={[styles.topOverlay, { paddingTop: Math.max(insets.top, 52) + 8 }]}>
        {/* Left: close */}
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="chevron-down" size={22} color="#fff" />
        </Pressable>

        {/* Center: artist — tappable → profile */}
        <Pressable
          style={styles.artistRow}
          onPress={goToArtistProfile}
        >
          {photo ? (
            <Image source={{ uri: photo }} style={styles.artistThumb} contentFit="cover" />
          ) : (
            <View style={[styles.artistThumb, { backgroundColor: color }]} />
          )}
          <View>
            <Text style={styles.artistName} numberOfLines={1}>{name}</Text>
            <Text style={styles.artistGenre}>{genre}</Text>
          </View>
        </Pressable>

        {/* Right: LIVE + viewers */}
        <View style={styles.topRight}>
          <View style={styles.livePill}>
            <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseAnim }] }]} />
            <Text style={styles.livePillText}>LIVE</Text>
          </View>
          <View style={styles.viewerPill}>
            <Ionicons name="eye" size={11} color="#fff" />
            <Text style={styles.viewerCount}>{fmtViewers(viewers)}</Text>
          </View>
        </View>
      </View>

      {/* ── Bottom overlay: chat + input ── */}
      <KeyboardAvoidingView
        style={styles.bottomOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Chat — anchored to bottom, max 7 rows visible */}
        <ScrollView
          ref={scrollRef}
          style={styles.chatScroll}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          pointerEvents="none"
        >
          {messages.map((msg) => (
            <View key={msg.id} style={styles.chatRow}>
              <Text style={[styles.chatName, { color: msg.color }]}>{msg.name}</Text>
              <Text style={styles.chatText}> {msg.text}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Input row */}
        <View style={[styles.inputRow, { paddingBottom: insets.bottom + 16, paddingLeft: 24, paddingRight: 24 }]}>
          <Pressable onPress={triggerHeart} style={styles.heartBtn}>
            <Ionicons name="heart" size={24} color="#e85d4a" />
          </Pressable>

          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Say something..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={sendMessage}
              returnKeyType="send"
            />
            {input.trim().length > 0 && (
              <Pressable onPress={sendMessage} hitSlop={8}>
                <Ionicons name="send" size={16} color="#e85d4a" />
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Floating hearts */}
      {floatingHearts.map((h) => (
        <FloatingHeart key={h.id} x={h.x} bottomOffset={insets.bottom + 80} />
      ))}
    </View>
  );
}

function FloatingHeart({ x, bottomOffset }: { x: number; bottomOffset: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 1000, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        bottom: bottomOffset,
        right: 28 + x,
        opacity: anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.8, 0] }),
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -120] }) },
          { scale: anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.5, 1.2, 0.9] }) },
        ],
      }}
    >
      <Ionicons name="heart" size={36} color="#e85d4a" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },

  // Top
  topOverlay: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
    zIndex: 10,
  },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
  },
  artistRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  artistThumb: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.35)",
  },
  artistName: { color: "#fff", fontSize: 13, fontWeight: "700", flexShrink: 1 },
  artistGenre: { color: "rgba(255,255,255,0.55)", fontSize: 10 },
  topRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  livePill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#e85d4a",
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#fff" },
  livePillText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  viewerPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6,
  },
  viewerCount: { color: "#fff", fontSize: 10, fontWeight: "700" },

  // Bottom
  bottomOverlay: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    justifyContent: "flex-end",
  },
  chatScroll: {
    maxHeight: 220,
    paddingHorizontal: 14,
  },
  chatContent: { paddingTop: 8, paddingBottom: 4 },
  chatRow: {
    flexDirection: "row", flexWrap: "wrap",
    alignItems: "baseline", marginBottom: 5,
  },
  chatName: { fontSize: 12, fontWeight: "700" },
  chatText: { color: "rgba(255,255,255,0.9)", fontSize: 12, lineHeight: 17 },

  inputRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingTop: 10, gap: 10,
  },
  heartBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center", justifyContent: "center",
  },
  inputWrap: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 22, paddingHorizontal: 14, height: 42, gap: 8,
  },
  input: { flex: 1, color: "#fff", fontSize: 13 },
});
