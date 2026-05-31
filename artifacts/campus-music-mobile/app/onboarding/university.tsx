import { Ionicons } from "@/components/icons";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { getUniversities } from "@workspace/api-client-react";
import { useRegistration } from "@/context/RegistrationContext";
import { useColors } from "@/hooks/useColors";

export default function UniversityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { draft, setField } = useRegistration();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(draft.university ?? "");
  const inputRef = useRef<TextInput>(null);

  const { data: universities, isLoading } = useQuery({
    queryKey: ["universities"],
    queryFn: () => getUniversities(),
    staleTime: 10 * 60 * 1000,
  });

  const allUniversities = universities ?? [];
  const filtered = allUniversities.filter((u) => u.toLowerCase().includes(query.toLowerCase()));
  const valid = selected.length > 0;

  const handleContinue = () => {
    if (!valid) return;
    setField("university", selected);
    router.push("/onboarding/country");
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.inner, { paddingTop: topPad + 16, paddingBottom: bottomPad + 20 }]}>
        <Pressable style={styles.back} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <View style={styles.progressRow}>
          {[1,2,3,4,5,6].map((i) => (
            <View key={i} style={[styles.progressDot, { backgroundColor: i <= 3 ? colors.primary : colors.border }]} />
          ))}
        </View>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Step 3 of 6</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Your university</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>We'll connect you with music from your campus</Text>

        <Pressable style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => inputRef.current?.focus()}>
          <Ionicons name="search-outline" size={20} color={colors.mutedForeground} style={{ marginRight: 10 }} />
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Search your university..."
            placeholderTextColor={colors.mutedForeground}
            value={selected || query}
            onChangeText={(t) => { setQuery(t); setSelected(""); }}
            autoFocus
          />
          {selected
            ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            : isLoading
              ? <ActivityIndicator size="small" color={colors.primary} />
              : null}
        </Pressable>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {!selected && filtered.map((uni) => (
            <Pressable
              key={uni}
              onPress={() => { setSelected(uni); setQuery(""); }}
              style={[styles.suggestion, { borderColor: colors.border }]}
            >
              <Ionicons name="school-outline" size={18} color={colors.mutedForeground} style={{ marginRight: 12 }} />
              <Text style={[styles.suggestionText, { color: colors.foreground }]}>{uni}</Text>
            </Pressable>
          ))}
          {!selected && query.length > 0 && filtered.length === 0 && !isLoading && (
            <Pressable
              onPress={() => { setSelected(query); setQuery(""); }}
              style={[styles.suggestion, { borderColor: colors.border }]}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} style={{ marginRight: 12 }} />
              <Text style={[styles.suggestionText, { color: colors.primary }]}>Add "{query}"</Text>
            </Pressable>
          )}
        </ScrollView>

        <Pressable style={[styles.btn, { backgroundColor: valid ? colors.primary : colors.muted }]} onPress={handleContinue}>
          <Text style={[styles.btnText, { color: valid ? "#fff" : colors.mutedForeground }]}>Continue</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24 },
  back: { marginBottom: 24 },
  progressRow: { flexDirection: "row", gap: 6, marginBottom: 20 },
  progressDot: { flex: 1, height: 4, borderRadius: 2 },
  label: { fontSize: 13, fontWeight: "500", marginBottom: 6 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5, marginBottom: 8 },
  sub: { fontSize: 14, lineHeight: 20, marginBottom: 24 },
  inputWrap: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8 },
  input: { flex: 1, fontSize: 16 },
  suggestion: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1 },
  suggestionText: { fontSize: 15 },
  btn: { height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", marginTop: 16 },
  btnText: { fontSize: 17, fontWeight: "700" },
});
