import { Ionicons } from "@/components/icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { forgotPassword } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async () => {
    if (!emailValid || isLoading) return;
    setIsLoading(true);
    try {
      await forgotPassword({ email: email.trim().toLowerCase() });
    } catch {
      // The endpoint always succeeds for valid input; swallow transient errors
      // and still show the confirmation (never reveal whether the email exists).
    } finally {
      setIsLoading(false);
      setSent(true);
    }
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

        {sent ? (
          <>
            <Ionicons
              name="mail-outline"
              size={48}
              color={colors.primary}
              style={{ marginBottom: 16 }}
            />
            <Text style={[styles.title, { color: colors.foreground }]}>Check your email</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              If an account exists for {email.trim().toLowerCase()}, we&apos;ve sent a link to
              reset your password.
            </Text>
            <View style={{ flex: 1 }} />
            <Pressable
              style={[styles.btn, { backgroundColor: colors.primary }]}
              onPress={() => router.replace("/onboarding/login")}
            >
              <Text style={[styles.btnText, { color: "#fff" }]}>Back to sign in</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.foreground }]}>Reset password</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              Enter your email and we&apos;ll send you a link to reset your password.
            </Text>

            <View
              style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Ionicons
                name="mail-outline"
                size={20}
                color={colors.mutedForeground}
                style={{ marginRight: 10 }}
              />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="Email address"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                autoFocus
              />
            </View>

            <View style={{ flex: 1 }} />

            <Pressable
              style={[
                styles.btn,
                {
                  backgroundColor: emailValid ? colors.primary : colors.muted,
                  opacity: isLoading ? 0.8 : 1,
                },
              ]}
              onPress={handleSubmit}
              disabled={!emailValid || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  style={[styles.btnText, { color: emailValid ? "#fff" : colors.mutedForeground }]}
                >
                  Send reset link
                </Text>
              )}
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24 },
  back: { marginBottom: 32 },
  title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.5, marginBottom: 8 },
  sub: { fontSize: 15, lineHeight: 22, marginBottom: 32 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: { flex: 1, fontSize: 16 },
  btn: { height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 17, fontWeight: "700" },
});
