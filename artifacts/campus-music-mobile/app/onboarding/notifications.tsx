import { Ionicons } from "@/components/icons";
import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { registerForPushNotifications } from "@/lib/push";

const NOTIF_ITEMS = [
  { icon: "musical-note" as const, color: "#e85d4a", title: "New drops", desc: "Get notified when artists you follow release new music" },
  { icon: "people" as const, color: "#3b82f6", title: "Campus events", desc: "Live concerts, open mics, and listening parties near you" },
  { icon: "heart" as const, color: "#ec4899", title: "Social activity", desc: "Likes, comments, and new followers on your profile" },
];

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleAllow = async () => {
    // Request OS permission + register the push token, then continue regardless.
    await registerForPushNotifications();
    router.push("/onboarding/follow");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad + 40 }]}>
      {/* Icon */}
      <View style={[styles.bellWrap, { backgroundColor: colors.primary + "18" }]}>
        <Ionicons name="notifications" size={48} color={colors.primary} />
      </View>

      <Text style={[styles.title, { color: colors.foreground }]}>Stay in the loop</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
        Turn on notifications so you never miss a beat
      </Text>

      <View style={styles.items}>
        {NOTIF_ITEMS.map((item) => (
          <View key={item.title} style={[styles.item, { backgroundColor: colors.card }]}>
            <View style={[styles.itemIcon, { backgroundColor: item.color + "20" }]}>
              <Ionicons name={item.icon} size={22} color={item.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemTitle, { color: colors.foreground }]}>{item.title}</Text>
              <Text style={[styles.itemDesc, { color: colors.mutedForeground }]}>{item.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.footer, { paddingBottom: bottomPad + 20 }]}>
        <Pressable style={[styles.btn, { backgroundColor: colors.primary }]} onPress={handleAllow}>
          <Text style={styles.btnText}>Allow Notifications</Text>
        </Pressable>
        <Pressable style={styles.skip} onPress={() => router.push("/onboarding/follow")}>
          <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip for now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, alignItems: "center" },
  bellWrap: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center", marginBottom: 28 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5, marginBottom: 10, textAlign: "center" },
  sub: { fontSize: 15, lineHeight: 22, textAlign: "center", marginBottom: 36 },
  items: { width: "100%", gap: 12 },
  item: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 16, gap: 14 },
  itemIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  itemTitle: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  itemDesc: { fontSize: 13, lineHeight: 18 },
  footer: { flex: 1, justifyContent: "flex-end", width: "100%" },
  btn: { height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  btnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  skip: { alignItems: "center", paddingVertical: 10 },
  skipText: { fontSize: 15 },
});
