import { Ionicons } from "@/components/icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { sendOtp, verifyOtp, register } from "@workspace/api-client-react";
import { useRegistration } from "@/context/RegistrationContext";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function OTPScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { draft } = useRegistration();
  const { user, signIn, updateUser } = useAuth();
  const email = draft.email ?? "";

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const refs = useRef<(TextInput | null)[]>([null, null, null, null, null, null]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const handleChange = (text: string, idx: number) => {
    const digit = text.replace(/[^0-9]/g, "").slice(-1);
    const next = [...code];
    next[idx] = digit;
    setCode(next);
    if (digit && idx < 5) refs.current[idx + 1]?.focus();
  };

  const handleKeyPress = (key: string, idx: number) => {
    if (key === "Backspace" && !code[idx] && idx > 0) {
      refs.current[idx - 1]?.focus();
      const next = [...code];
      next[idx - 1] = "";
      setCode(next);
    }
  };

  const filled = code.every((d) => d.length === 1);

  const requestOtp = async () => {
    if (!email) return;
    setIsSending(true);
    setSendError("");
    try {
      await sendOtp({ email });
    } catch {
      setSendError("Failed to send code. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  // On mount, create the account (so OTP verification can mark THIS user's email
  // verified) and sign in, then send the code. If we're already signed in (e.g.
  // the screen remounted), skip registration. Guarded so it runs once per mount.
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    (async () => {
      try {
        if (!user) {
          const { email: e, password, name, role, university, country } = draft;
          if (!e || !password || !name || !role || !university || !country) {
            Alert.alert("Missing info", "Please complete all sign-up steps.");
            router.back();
            return;
          }
          const result = await register({ email: e, password, name, role, university, country });
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
        }
        await requestOtp();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Could not create your account.";
        Alert.alert("Sign-up failed", msg);
      }
    })();
  }, []);

  const handleVerify = async () => {
    if (!filled || isVerifying) return;
    setIsVerifying(true);
    try {
      await verifyOtp({ email, code: code.join("") });
      updateUser({ emailVerified: true });
      router.push("/onboarding/notifications");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Incorrect code. Please try again.";
      Alert.alert("Verification failed", msg);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad + 16 }]}>
      <Pressable style={styles.back} onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="chevron-back" size={24} color={colors.foreground} />
      </Pressable>

      <View style={styles.progressRow}>
        {[1,2,3,4,5,6].map((i) => (
          <View key={i} style={[styles.progressDot, { backgroundColor: colors.primary }]} />
        ))}
      </View>

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Step 6 of 6</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>Verify your email</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
        {email
          ? `We sent a 6-digit code to ${email}`
          : "We sent a 6-digit code to your email"}
      </Text>

      {sendError ? (
        <Text style={[styles.sendError, { color: colors.destructive }]}>{sendError}</Text>
      ) : isSending ? (
        <Text style={[styles.sendError, { color: colors.mutedForeground }]}>Sending code…</Text>
      ) : null}

      {/* OTP boxes */}
      <View style={styles.otpRow}>
        {code.map((digit, i) => (
          <TextInput
            key={i}
            ref={(r) => { refs.current[i] = r; }}
            style={[
              styles.otpBox,
              {
                backgroundColor: colors.card,
                borderColor: digit ? colors.primary : colors.border,
                color: colors.foreground,
              },
            ]}
            value={digit}
            onChangeText={(t) => handleChange(t, i)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
            keyboardType="number-pad"
            maxLength={1}
            textAlign="center"
            autoFocus={i === 0}
          />
        ))}
      </View>

      <Pressable style={styles.resend} onPress={requestOtp} disabled={isSending}>
        <Text style={[styles.resendText, { color: colors.mutedForeground }]}>
          Didn't receive it?{" "}
          <Text style={{ color: colors.primary, fontWeight: "700" }}>
            {isSending ? "Sending…" : "Resend code"}
          </Text>
        </Text>
      </Pressable>

      <View style={{ flex: 1 }} />

      <Pressable
        style={[
          styles.btn,
          {
            backgroundColor: filled && !isVerifying ? colors.primary : colors.muted,
            marginHorizontal: 24,
            marginBottom: bottomPad + 20,
          },
        ]}
        onPress={handleVerify}
        disabled={!filled || isVerifying}
      >
        {isVerifying ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={[styles.btnText, { color: filled ? "#fff" : colors.mutedForeground }]}>
            Verify &amp; Continue
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  back: { marginBottom: 24 },
  progressRow: { flexDirection: "row", gap: 6, marginBottom: 20 },
  progressDot: { flex: 1, height: 4, borderRadius: 2 },
  label: { fontSize: 13, fontWeight: "500", marginBottom: 6 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5, marginBottom: 8 },
  sub: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  sendError: { fontSize: 13, marginBottom: 12 },
  otpRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginTop: 12 },
  otpBox: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 60,
    borderRadius: 14,
    borderWidth: 2,
    fontSize: 24,
    fontWeight: "700",
  },
  resend: { alignItems: "center", marginTop: 20 },
  resendText: { fontSize: 14 },
  btn: { height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 17, fontWeight: "700" },
});
