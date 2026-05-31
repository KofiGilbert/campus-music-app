import { Ionicons } from "@/components/icons";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRegistration } from "@/context/RegistrationContext";
import { useColors } from "@/hooks/useColors";

export default function PasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { setField } = useRegistration();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const confirmRef = useRef<TextInput>(null);

  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const matches = password === confirm && confirm.length > 0;
  const valid = hasLength && hasUpper && hasNumber && matches;

  const checks = [
    { label: "At least 8 characters", done: hasLength },
    { label: "One uppercase letter", done: hasUpper },
    { label: "One number", done: hasNumber },
    { label: "Passwords match", done: matches },
  ];

  const handleContinue = () => {
    if (!valid) return;
    setField("password", password);
    router.push("/onboarding/otp");
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.inner, { paddingTop: topPad + 16, paddingBottom: bottomPad + 20 }]}>
        <Pressable style={styles.back} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <View style={styles.progressRow}>
          {[1,2,3,4,5,6].map((i) => (
            <View key={i} style={[styles.progressDot, { backgroundColor: i <= 5 ? colors.primary : colors.border }]} />
          ))}
        </View>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Step 5 of 6</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Create a password</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>Make it strong and memorable</Text>

        <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.mutedForeground} style={{ marginRight: 10 }} />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Password"
            placeholderTextColor={colors.mutedForeground}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!show}
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
            autoFocus
          />
          <Pressable onPress={() => setShow((s) => !s)} hitSlop={8}>
            <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12 }]}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.mutedForeground} style={{ marginRight: 10 }} />
          <TextInput
            ref={confirmRef}
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Confirm password"
            placeholderTextColor={colors.mutedForeground}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!show}
            returnKeyType="done"
          />
        </View>

        <View style={styles.checks}>
          {checks.map((c) => (
            <View key={c.label} style={styles.checkRow}>
              <Ionicons name={c.done ? "checkmark-circle" : "ellipse-outline"} size={16} color={c.done ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.checkText, { color: c.done ? colors.foreground : colors.mutedForeground }]}>{c.label}</Text>
            </View>
          ))}
        </View>

        <View style={{ flex: 1 }} />
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
  inputWrap: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14 },
  input: { flex: 1, fontSize: 16 },
  checks: { marginTop: 20, gap: 10 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkText: { fontSize: 13 },
  btn: { height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 17, fontWeight: "700" },
});
