import { Ionicons } from "@/components/icons";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRegistration } from "@/context/RegistrationContext";
import { useColors } from "@/hooks/useColors";

export default function EmailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { draft, setField } = useRegistration();
  const [email, setEmail] = useState(draft.email ?? "");
  const [error, setError] = useState("");
  const inputRef = useRef<TextInput>(null);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleNext = () => {
    if (!valid) { setError("Please enter a valid email address"); return; }
    setError("");
    setField("email", email.trim().toLowerCase());
    router.push("/onboarding/name");
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.inner, { paddingTop: topPad + 16, paddingBottom: bottomPad + 20 }]}>
        <Pressable style={styles.back} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>

        <View style={styles.progressRow}>
          {[1,2,3,4,5,6].map((i) => (
            <View key={i} style={[styles.progressDot, { backgroundColor: i === 1 ? colors.primary : colors.border }]} />
          ))}
        </View>

        <Text style={[styles.label, { color: colors.mutedForeground }]}>Step 1 of 6</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>What's your email?</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          You'll use this to sign in and receive important updates
        </Text>

        <Pressable
          style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: error ? colors.destructive : colors.border }]}
          onPress={() => inputRef.current?.focus()}
        >
          <Ionicons name="mail-outline" size={20} color={colors.mutedForeground} style={{ marginRight: 10 }} />
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.foreground }]}
            placeholder="you@university.edu"
            placeholderTextColor={colors.mutedForeground}
            value={email}
            onChangeText={(t) => { setEmail(t); setError(""); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={handleNext}
            autoFocus
          />
        </Pressable>
        {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

        <View style={{ flex: 1 }} />

        <Pressable
          style={[styles.btn, { backgroundColor: valid ? colors.primary : colors.muted }]}
          onPress={handleNext}
        >
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
  sub: { fontSize: 14, lineHeight: 20, marginBottom: 32 },
  inputWrap: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8 },
  input: { flex: 1, fontSize: 16 },
  error: { fontSize: 13, marginBottom: 8 },
  btn: { height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 17, fontWeight: "700" },
});
