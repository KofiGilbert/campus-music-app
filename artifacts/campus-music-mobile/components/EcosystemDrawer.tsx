import { Ionicons } from "@/components/icons";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DRAWER_WIDTH = SCREEN_WIDTH * 0.82;

interface NavItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface EcosystemDrawerProps {
  visible: boolean;
  onClose: () => void;
}

export function EcosystemDrawer({ visible, onClose }: EcosystemDrawerProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
          speed: 22,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 190,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 190,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const displayName = user?.name ?? "Campus User";
  const university = user?.university ?? "Your Campus";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const go = (path: string) => {
    onClose();
    // Small delay so the drawer close animation starts before navigation
    setTimeout(() => router.push(path as never), 150);
  };

  const SECTIONS: NavSection[] = [
    {
      title: "Browse",
      items: [
        { icon: "home-outline", label: "Home", onPress: () => go("/(tabs)") },
        { icon: "search-outline", label: "Search", onPress: () => go("/(tabs)/discover") },
        { icon: "school-outline", label: "Campuses", onPress: () => go("/campuses") },
        { icon: "trending-up-outline", label: "Trending", onPress: () => go("/trending") },
        { icon: "musical-notes-outline", label: "Genres", onPress: () => go("/genres") },
      ],
    },
    {
      title: "Social",
      items: [
        { icon: "newspaper-outline", label: "Artist Feed", onPress: () => go("/(tabs)/social") },
        { icon: "radio-outline", label: "Live Streams", onPress: () => go("/(tabs)/social") },
        { icon: "person-add-outline", label: "Connect", onPress: () => go("/(tabs)/connect") },
        { icon: "chatbubble-outline", label: "Chat", onPress: () => go("/messages") },
      ],
    },
    {
      title: "Real Connections",
      items: [
        { icon: "phone-portrait-outline", label: "Phone Down", onPress: () => go("/(tabs)/real-connections") },
        { icon: "headset-outline", label: "Listening Parties", onPress: () => go("/(tabs)/real-connections") },
        { icon: "musical-note-outline", label: "Live Concerts", onPress: () => go("/(tabs)/real-connections") },
      ],
    },
    {
      title: "Artist Collaboration",
      items: [
        { icon: "people-outline", label: "Artist Friends", onPress: () => go("/(tabs)/connect") },
        { icon: "chatbubbles-outline", label: "Artist Messages", onPress: () => go("/messages") },
      ],
    },
    {
      title: "Library",
      items: [
        { icon: "list-outline", label: "Playlists", onPress: () => go("/(tabs)/library") },
        { icon: "library-outline", label: "My Library", onPress: () => go("/(tabs)/library") },
        { icon: "bar-chart-outline", label: "Artist Analytics", onPress: () => go("/(tabs)/library") },
      ],
    },
  ];

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Dim overlay */}
      <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View
        style={[
          styles.drawer,
          {
            backgroundColor: colors.background,
            width: DRAWER_WIDTH,
            paddingTop: topPad + 16,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        {/* ── Profile header ── */}
        <View style={[styles.profileHeader, { paddingHorizontal: 24 }]}>
          <View style={[styles.avatarLarge, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
          <Pressable style={[styles.addAccountBtn, { borderColor: colors.border }]}>
            <Ionicons name="person-add-outline" size={18} color={colors.foreground} />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
          <Text style={[styles.displayName, { color: colors.foreground }]}>{displayName}</Text>
          <Text style={[styles.handle, { color: colors.mutedForeground }]}>
            @{university.replace(/\s+/g, "").toLowerCase()}
          </Text>
          <View style={styles.statsRow}>
            <Text style={[styles.statNum, { color: colors.foreground }]}>472</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}> Following  </Text>
            <Text style={[styles.statNum, { color: colors.foreground }]}>49</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}> Followers</Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* ── Scrollable nav sections ── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: bottomPad + 20,
            paddingTop: 8,
          }}
        >
          {SECTIONS.map((section, si) => (
            <View key={section.title} style={si > 0 ? styles.sectionSpaced : undefined}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground, paddingHorizontal: 24 }]}>
                {section.title}
              </Text>
              {section.items.map((item) => (
                <Pressable
                  key={item.label}
                  style={({ pressed }) => [
                    styles.navItem,
                    pressed && { backgroundColor: colors.card },
                  ]}
                  onPress={item.onPress}
                >
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={colors.foreground}
                    style={styles.navIcon}
                  />
                  <Text style={[styles.navLabel, { color: colors.foreground }]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          ))}

          <View style={[styles.divider, { backgroundColor: colors.border, marginHorizontal: 24, marginTop: 8 }]} />

          {/* Sign out */}
          <Pressable
            style={({ pressed }) => [
              styles.navItem,
              pressed && { backgroundColor: colors.card },
            ]}
            onPress={async () => {
              await signOut();
              onClose();
              setTimeout(() => router.replace("/onboarding/welcome"), 150);
            }}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.mutedForeground} style={styles.navIcon} />
            <Text style={[styles.navLabel, { color: colors.mutedForeground }]}>Sign Out</Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 20,
  },
  profileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  avatarLarge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: { color: "#fff", fontSize: 19, fontWeight: "700" },
  addAccountBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  displayName: { fontSize: 17, fontWeight: "800", marginBottom: 2 },
  handle: { fontSize: 13, marginBottom: 10 },
  statsRow: { flexDirection: "row", alignItems: "center" },
  statNum: { fontSize: 14, fontWeight: "700" },
  statLabel: { fontSize: 13 },
  divider: { height: 1, marginVertical: 8 },
  sectionSpaced: { marginTop: 20 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 24,
    borderRadius: 0,
  },
  navIcon: { width: 28 },
  navLabel: { fontSize: 16, fontWeight: "500" },
});
