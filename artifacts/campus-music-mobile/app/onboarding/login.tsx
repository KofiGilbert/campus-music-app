import { Ionicons } from "@/components/icons";
import { router } from "expo-router";
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
import { login } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSubmit = emailValid && password.length >= 1 && !isLoading;

  const handleLogin = async () => {
    if (!canSubmit) return;
    setIsLoading(true);
    try {
      const result = await login({ email: email.trim().toLowerCase(), password });
      await signIn(
        {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role as "listener" | "artist",
          university: result.user.university,
          country: result.user.country,
          avatarUrl: result.user.avatarUrl ?? null,
          emailVerified: result.user.emailVerified,
        },
        result.accessToken,
        result.refreshToken,
      );
      router.replace("/(tabs)");
    } catch {
      Alert.alert("Sign in failed", "Incorrect email or password. Please try again.");
    } finally {
      setIsLoading(false);
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

        <Text style={[styles.title, { color: colors.foreground }]}>Welcome back</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Sign in to your Campus Music account
        </Text>

        <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="mail-outline" size={20} color={colors.mutedForeground} style={{ marginRight: 10 }} />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Email address"
            placeholderTextColor={colors.mutedForeground}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            autoFocus
          />
        </View>

        <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12 }]}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.mutedForeground} style={{ marginRight: 10 }} />
          <TextInput
            ref={passwordRef}
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Password"
            placeholderTextColor={colors.mutedForeground}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!show}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />
          <Pressable onPress={() => setShow((s) => !s)} hitSlop={8}>
            <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <Pressable
          style={styles.forgotLink}
          onPress={() => router.push("/onboarding/forgot-password")}
          hitSlop={8}
        >
          <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot password?</Text>
        </Pressable>

        <View style={{ flex: 1 }} />

        <Pressable
          style={[styles.btn, { backgroundColor: canSubmit ? colors.primary : colors.muted, opacity: isLoading ? 0.8 : 1 }]}
          onPress={handleLogin}
          disabled={!canSubmit}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.btnText, { color: canSubmit ? "#fff" : colors.mutedForeground }]}>Sign In</Text>
          )}
        </Pressable>

        <Pressable style={styles.signupLink} onPress={() => router.push("/onboarding/role")}>
          <Text style={[styles.signupText, { color: colors.mutedForeground }]}>
            New here?{" "}
            <Text style={{ color: colors.primary, fontWeight: "700" }}>Create account</Text>
          </Text>
        </Pressable>
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
  forgotLink: { alignSelf: "flex-end", paddingVertical: 12 },
  forgotText: { fontSize: 14, fontWeight: "600" },
  btn: { height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  btnText: { fontSize: 17, fontWeight: "700" },
  signupLink: { alignItems: "center", paddingVertical: 8 },
  signupText: { fontSize: 14 },
});
