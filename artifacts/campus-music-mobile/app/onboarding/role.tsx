import { Ionicons } from "@/components/icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRegistration } from "@/context/RegistrationContext";
import { useColors } from "@/hooks/useColors";

type Role = "listener" | "artist";

export default function RoleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { draft, setField } = useRegistration();
  const [selected, setSelected] = useState<Role | null>((draft.role as Role) || null);

  const roles = [
    {
      id: "listener" as Role,
      icon: "headset" as const,
      title: "Listener",
      desc: "Discover and enjoy music from student artists across your campus",
      color: "#3b82f6",
    },
    {
      id: "artist" as Role,
      icon: "mic" as const,
      title: "Student Artist",
      desc: "Share your music, grow your following, and connect with fans",
      color: "#e85d4a",
    },
  ];

  const handleContinue = () => {
    if (!selected) return;
    setField("role", selected);
    router.push("/onboarding/email");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad + 16 }]}>
      <Pressable style={styles.back} onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="chevron-back" size={24} color={colors.foreground} />
      </Pressable>

      <Text style={[styles.title, { color: colors.foreground }]}>Who are you?</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
        Choose how you want to experience Campus Music
      </Text>

      <View style={styles.cards}>
        {roles.map((role) => {
          const active = selected === role.id;
          return (
            <Pressable
              key={role.id}
              onPress={() => setSelected(role.id)}
              style={[styles.card, { backgroundColor: colors.card, borderColor: active ? role.color : colors.border, borderWidth: active ? 2 : 1 }]}
            >
              <View style={[styles.iconCircle, { backgroundColor: role.color + "22" }]}>
                <Ionicons name={role.icon} size={32} color={role.color} />
              </View>
              <Text style={[styles.roleTitle, { color: colors.foreground }]}>{role.title}</Text>
              <Text style={[styles.roleDesc, { color: colors.mutedForeground }]}>{role.desc}</Text>
              {active && (
                <View style={[styles.checkBadge, { backgroundColor: role.color }]}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.footer, { paddingBottom: bottomPad + 20 }]}>
        <Pressable
          style={[styles.btn, { backgroundColor: selected ? colors.primary : colors.muted }]}
          onPress={handleContinue}
          disabled={!selected}
        >
          <Text style={[styles.btnText, { color: selected ? "#fff" : colors.mutedForeground }]}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  back: { marginBottom: 32 },
  title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.5, marginBottom: 8 },
  sub: { fontSize: 15, marginBottom: 36 },
  cards: { gap: 16 },
  card: { borderRadius: 20, padding: 24, position: "relative" },
  iconCircle: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  roleTitle: { fontSize: 20, fontWeight: "700", marginBottom: 6 },
  roleDesc: { fontSize: 14, lineHeight: 20 },
  checkBadge: { position: "absolute", top: 16, right: 16, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  footer: { flex: 1, justifyContent: "flex-end" },
  btn: { height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 17, fontWeight: "700" },
});
