import { Ionicons } from "@/components/icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { resetPassword } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

export default function ResetPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === "string" ? params.token : "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const confirmRef = useRef<TextInput>(null);

  const strong = password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
  const match = password.length > 0 && password === confirm;
  const canSubmit = !!token && strong && match && !isLoading;

  const handleReset = async () => {
    if (!canSubmit) return;
    setIsLoading(true);
    try {
      await resetPassword({ token, newPassword: password });
      Alert.alert("Password reset", "You can now sign in with your new password.");
      router.replace("/onboarding/login");
    } catch {
      Alert.alert(
        "Reset failed",
        "This reset link is invalid or has expired. Please request a new one.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Invalid link</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground, textAlign: "center" }]}>
          This password reset link is missing or invalid.
        </Text>
        <Pressable
          style={[styles.btn, { backgroundColor: colors.primary, marginTop: 24, paddingHorizontal: 32 }]}
          onPress={() => router.replace("/onboarding/login")}
        >
          <Text style={[styles.btnText, { color: "#fff" }]}>Back to sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.inner, { paddingTop: topPad + 16, paddingBottom: bottomPad + 20 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>New password</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Choose a strong password (8+ characters, an uppercase letter, and a number).
        </Text>

        <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons
            name="lock-closed-outline"
            size={20}
            color={colors.mutedForeground}
            style={{ marginRight: 10 }}
          />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="New password"
            placeholderTextColor={colors.mutedForeground}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!show}
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
            autoFocus
          />
          <Pressable onPress={() => setShow((s) => !s)} hitSlop={8}>
            <Ionicons
              name={show ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={colors.mutedForeground}
            />
          </Pressable>
        </View>

        <View
          style={[
            styles.inputWrap,
            { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12 },
          ]}
        >
          <Ionicons
            name="lock-closed-outline"
            size={20}
            color={colors.mutedForeground}
            style={{ marginRight: 10 }}
          />
          <TextInput
            ref={confirmRef}
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Confirm password"
            placeholderTextColor={colors.mutedForeground}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!show}
            returnKeyType="done"
            onSubmitEditing={handleReset}
          />
        </View>

        {confirm.length > 0 && !match ? (
          <Text style={[styles.hint, { color: colors.destructive }]}>Passwords don&apos;t match.</Text>
        ) : null}

        <View style={{ flex: 1 }} />

        <Pressable
          style={[
            styles.btn,
            { backgroundColor: canSubmit ? colors.primary : colors.muted, opacity: isLoading ? 0.8 : 1 },
          ]}
          onPress={handleReset}
          disabled={!canSubmit}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.btnText, { color: canSubmit ? "#fff" : colors.mutedForeground }]}>
              Reset password
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  inner: { flex: 1, paddingHorizontal: 24 },
  title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.5, marginBottom: 8 },
  sub: { fontSize: 15, lineHeight: 22, marginBottom: 28 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: { flex: 1, fontSize: 16 },
  hint: { fontSize: 13, marginTop: 8 },
  btn: { height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 17, fontWeight: "700" },
});
