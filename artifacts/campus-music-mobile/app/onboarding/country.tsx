import { Ionicons } from "@/components/icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRegistration } from "@/context/RegistrationContext";
import { useColors } from "@/hooks/useColors";

const COUNTRIES = [
  { name: "United States", flag: "🇺🇸" },
  { name: "United Kingdom", flag: "🇬🇧" },
  { name: "Canada", flag: "🇨🇦" },
  { name: "Australia", flag: "🇦🇺" },
  { name: "Germany", flag: "🇩🇪" },
  { name: "France", flag: "🇫🇷" },
  { name: "Japan", flag: "🇯🇵" },
  { name: "South Korea", flag: "🇰🇷" },
  { name: "Brazil", flag: "🇧🇷" },
  { name: "India", flag: "🇮🇳" },
  { name: "Nigeria", flag: "🇳🇬" },
  { name: "Ghana", flag: "🇬🇭" },
  { name: "South Africa", flag: "🇿🇦" },
  { name: "Mexico", flag: "🇲🇽" },
  { name: "Spain", flag: "🇪🇸" },
  { name: "Italy", flag: "🇮🇹" },
];

export default function CountryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { draft, setField } = useRegistration();
  const [selected, setSelected] = useState(draft.country ?? "");

  const handleContinue = () => {
    if (!selected) return;
    setField("country", selected);
    router.push("/onboarding/password");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad + 16 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <View style={styles.progressRow}>
          {[1,2,3,4,5,6].map((i) => (
            <View key={i} style={[styles.progressDot, { backgroundColor: i <= 4 ? colors.primary : colors.border }]} />
          ))}
        </View>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Step 4 of 6</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Where are you from?</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>Help us recommend music from your region</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {COUNTRIES.map((c) => {
            const active = selected === c.name;
            return (
              <Pressable
                key={c.name}
                onPress={() => setSelected(c.name)}
                style={[styles.chip, {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                }]}
              >
                <Text style={styles.flag}>{c.flag}</Text>
                <Text style={[styles.chipText, { color: active ? "#fff" : colors.foreground }]} numberOfLines={1}>{c.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingHorizontal: 24, paddingBottom: bottomPad + 20 }]}>
        <Pressable
          style={[styles.btn, { backgroundColor: selected ? colors.primary : colors.muted }]}
          onPress={handleContinue}
        >
          <Text style={[styles.btnText, { color: selected ? "#fff" : colors.mutedForeground }]}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingBottom: 20 },
  progressRow: { flexDirection: "row", gap: 6, marginVertical: 16 },
  progressDot: { flex: 1, height: 4, borderRadius: 2 },
  label: { fontSize: 13, fontWeight: "500", marginBottom: 6 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5, marginBottom: 8 },
  sub: { fontSize: 14, lineHeight: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingTop: 8 },
  chip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 24, borderWidth: 1, gap: 6 },
  flag: { fontSize: 18 },
  chipText: { fontSize: 13, fontWeight: "500", maxWidth: 90 },
  footer: {},
  btn: { height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 17, fontWeight: "700" },
});
