import { Ionicons } from "@/components/icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { getArtists, followArtist } from "@workspace/api-client-react";
import { useRegistration } from "@/context/RegistrationContext";
import { useColors } from "@/hooks/useColors";

const FALLBACK_ARTISTS = [
  { id: "a1", name: "Campus Collective", genre: "Indie", color: "#e85d4a" },
  { id: "a2", name: "Jazz Ensemble", genre: "Jazz", color: "#3b82f6" },
  { id: "a3", name: "Lo-Fi Club", genre: "Lo-Fi", color: "#8b5cf6" },
  { id: "a4", name: "R&B Society", genre: "R&B", color: "#10b981" },
  { id: "a5", name: "Synth Wave", genre: "Electronic", color: "#f59e0b" },
  { id: "a6", name: "Folk Collective", genre: "Folk", color: "#ec4899" },
  { id: "a7", name: "Hip Hop Collective", genre: "Hip Hop", color: "#f97316" },
  { id: "a8", name: "Ambient Lab", genre: "Ambient", color: "#0ea5e9" },
  { id: "a9", name: "Singer Songwriters", genre: "Acoustic", color: "#84cc16" },
];

const GENRE_COLORS: Record<string, string> = {
  Indie: "#e85d4a",
  Electronic: "#3b82f6",
  Jazz: "#8b5cf6",
  Folk: "#f59e0b",
  "R&B": "#10b981",
  "Lo-Fi": "#6366f1",
  "Hip Hop": "#f97316",
  Ambient: "#0ea5e9",
  Acoustic: "#14b8a6",
  Synth: "#ec4899",
};

export default function FollowScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { clearDraft } = useRegistration();
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Fetch real artists from the API
  const { data: apiArtists } = useQuery({
    queryKey: ["artists"],
    queryFn: () => getArtists(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const displayArtists = apiArtists && apiArtists.length > 0
    ? apiArtists.map((a) => ({
        id: a.id,
        name: a.name,
        genre: a.genre,
        color: GENRE_COLORS[a.genre] ?? a.coverColor,
      }))
    : FALLBACK_ARTISTS;

  const toggle = (id: string) => {
    setFollowed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // The account was created + signed in on the OTP screen, so this step just
  // persists follow selections and finishes onboarding.
  const handleDone = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      if (followed.size > 0) {
        await Promise.allSettled(
          [...followed].map((id) => followArtist(id, { following: true })),
        );
      }
      clearDraft();
      router.replace("/(tabs)");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      Alert.alert("Error", msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad + 16 }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Follow some artists</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Choose at least 1 artist to personalize your feed
        </Text>
      </View>

      <FlatList
        data={displayArtists}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
        columnWrapperStyle={{ gap: 12, marginBottom: 12 }}
        renderItem={({ item }) => {
          const active = followed.has(item.id);
          return (
            <Pressable
              onPress={() => toggle(item.id)}
              style={[styles.artistCard, { backgroundColor: colors.card, borderColor: active ? item.color : colors.border }]}
            >
              <View style={[styles.artistAvatar, { backgroundColor: item.color }]}>
                <Ionicons name="mic" size={22} color="#fff" />
              </View>
              <Text style={[styles.artistName, { color: colors.foreground }]} numberOfLines={2}>{item.name}</Text>
              <Text style={[styles.artistGenre, { color: colors.mutedForeground }]}>{item.genre}</Text>
              {active && (
                <View style={[styles.checkBadge, { backgroundColor: item.color }]}>
                  <Ionicons name="checkmark" size={10} color="#fff" />
                </View>
              )}
            </Pressable>
          );
        }}
      />

      <View style={[styles.footer, { paddingHorizontal: 24, paddingBottom: bottomPad + 20 }]}>
        <Pressable
          style={[styles.btn, { backgroundColor: colors.primary, opacity: isLoading ? 0.7 : 1 }]}
          onPress={handleDone}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>
              {followed.size > 0 ? `Follow ${followed.size} & Finish` : "Finish"}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, marginBottom: 24 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5, marginBottom: 8 },
  sub: { fontSize: 14, lineHeight: 20 },
  artistCard: { flex: 1, borderRadius: 16, padding: 12, borderWidth: 2, alignItems: "center", position: "relative" },
  artistAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  artistName: { fontSize: 12, fontWeight: "600", textAlign: "center", marginBottom: 2 },
  artistGenre: { fontSize: 11, textAlign: "center" },
  checkBadge: { position: "absolute", top: 6, right: 6, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  footer: {},
  btn: { height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 17, fontWeight: "700", color: "#fff" },
});
