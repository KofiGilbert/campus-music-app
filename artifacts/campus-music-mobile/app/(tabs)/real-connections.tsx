import { Ionicons } from "@/components/icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import { Animated, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

type RCTab = "phonedown" | "parties" | "concerts";

const PARTIES = [
  { id: "lp1", name: "Indie Vibes Session", host: "Alex M.", time: "Tonight 9PM", attendees: 12, color: "#e85d4a", genre: "Indie" },
  { id: "lp2", name: "Jazz Night", host: "Jordan K.", time: "Fri 7PM", attendees: 8, color: "#3b82f6", genre: "Jazz" },
  { id: "lp3", name: "Lo-Fi Study Group", host: "Sam P.", time: "Sat 2PM", attendees: 23, color: "#8b5cf6", genre: "Lo-Fi" },
  { id: "lp4", name: "Hip Hop Hangout", host: "Riley T.", time: "Sun 5PM", attendees: 15, color: "#f59e0b", genre: "Hip Hop" },
];

const CONCERTS = [
  { id: "c1", name: "Spring Campus Fest", venue: "Main Quad", date: "May 15", artists: 6, price: "Free", color: "#10b981" },
  { id: "c2", name: "Open Mic Night", venue: "Student Union", date: "May 18", artists: 12, price: "Free", color: "#ec4899" },
  { id: "c3", name: "Battle of the Bands", venue: "Music Hall", date: "May 22", artists: 8, price: "$5", color: "#f97316" },
];

function PhoneDownChallenge() {
  const colors = useColors();
  const [active, setActive] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const GOAL = 300;

  const handleStart = () => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setActive(true);
    setSeconds(0);
    Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: false }).start();
  };

  useEffect(() => {
    if (active) {
      intervalRef.current = setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          Animated.timing(progress, { toValue: next / GOAL, duration: 1000, useNativeDriver: false }).start();
          if (next >= GOAL) {
            setActive(false);
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          return next;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const progressWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={styles.phoneDownWrap}>
      {/* Timer circle */}
      <View style={[styles.timerCircle, { borderColor: active ? colors.primary : colors.border, backgroundColor: colors.card }]}>
        <Ionicons name={active ? "phone-portrait" : "phone-portrait-outline"} size={40} color={active ? colors.primary : colors.mutedForeground} />
        <Text style={[styles.timerText, { color: colors.foreground }]}>{mm}:{ss}</Text>
        <Text style={[styles.timerGoal, { color: colors.mutedForeground }]}>/ 5:00 goal</Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
        <Animated.View style={[styles.progressFill, { width: progressWidth, backgroundColor: colors.primary }]} />
      </View>

      {!active ? (
        <Pressable style={[styles.startBtn, { backgroundColor: colors.primary }]} onPress={handleStart}>
          <Ionicons name="phone-portrait-outline" size={18} color="#fff" />
          <Text style={styles.startText}>Start Phone Down Challenge</Text>
        </Pressable>
      ) : (
        <Pressable style={[styles.stopBtn, { borderColor: colors.destructive }]} onPress={() => setActive(false)}>
          <Text style={[styles.stopText, { color: colors.destructive }]}>End Challenge</Text>
        </Pressable>
      )}

      {/* Stats row */}
      <View style={styles.statsRow}>
        {[
          { label: "Your Best", value: "18:32" },
          { label: "Campus Avg", value: "7:14" },
          { label: "Streak", value: "3 days" },
        ].map((stat) => (
          <View key={stat.label} style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.statVal, { color: colors.foreground }]}>{stat.value}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function RealConnectionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [activeTab, setActiveTab] = useState<RCTab>("phonedown");
  const [joined, setJoined] = useState<Set<string>>(new Set());

  const TABS: { id: RCTab; label: string; icon: "phone-portrait-outline" | "musical-notes-outline" | "ticket-outline" }[] = [
    { id: "phonedown", label: "Phone Down", icon: "phone-portrait-outline" },
    { id: "parties", label: "Listening", icon: "musical-notes-outline" },
    { id: "concerts", label: "Concerts", icon: "ticket-outline" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Real Connections</Text>
      </View>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow} style={styles.tabsScroll}>
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.selectionAsync();
                setActiveTab(tab.id);
              }}
              style={[styles.tab, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}
            >
              <Ionicons name={tab.icon} size={15} color={active ? "#fff" : colors.mutedForeground} />
              <Text style={[styles.tabText, { color: active ? "#fff" : colors.mutedForeground }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {activeTab === "phonedown" && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
          <PhoneDownChallenge />
        </ScrollView>
      )}

      {activeTab === "parties" && (
        <FlatList
          data={PARTIES}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={[styles.partyCard, { backgroundColor: colors.card }]}>
              <View style={[styles.partyLeft, { backgroundColor: item.color + "20" }]}>
                <Ionicons name="musical-notes" size={28} color={item.color} />
                <Text style={[styles.partyGenre, { color: item.color }]}>{item.genre}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.partyName, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.partyHost, { color: colors.mutedForeground }]}>Hosted by {item.host}</Text>
                <View style={styles.partyMeta}>
                  <Ionicons name="time-outline" size={13} color={colors.mutedForeground} />
                  <Text style={[styles.partyMetaText, { color: colors.mutedForeground }]}>{item.time}</Text>
                  <Ionicons name="people-outline" size={13} color={colors.mutedForeground} />
                  <Text style={[styles.partyMetaText, { color: colors.mutedForeground }]}>{item.attendees}</Text>
                </View>
              </View>
              {joined.has(item.id) ? (
                <View style={[styles.joinedBadge, { backgroundColor: colors.primary + "20" }]}>
                  <Ionicons name="checkmark" size={14} color={colors.primary} />
                </View>
              ) : (
                <Pressable
                  style={[styles.joinBtn, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setJoined((prev) => new Set([...prev, item.id]));
                  }}
                >
                  <Text style={styles.joinText}>Join</Text>
                </Pressable>
              )}
            </View>
          )}
        />
      )}

      {activeTab === "concerts" && (
        <FlatList
          data={CONCERTS}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable style={[styles.concertCard, { backgroundColor: item.color }]}>
              <View style={styles.concertTop}>
                <View style={[styles.priceBadge, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
                  <Text style={styles.priceText}>{item.price}</Text>
                </View>
                <Text style={styles.concertDate}>{item.date}</Text>
              </View>
              <Text style={styles.concertName}>{item.name}</Text>
              <Text style={styles.concertVenue}>{item.venue}</Text>
              <View style={styles.concertFooter}>
                <Text style={styles.concertArtists}>{item.artists} artists performing</Text>
                <Pressable style={styles.rsvpBtn}>
                  <Text style={styles.rsvpText}>RSVP</Text>
                </Pressable>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  tabsScroll: { maxHeight: 50 },
  tabsRow: { paddingHorizontal: 20, gap: 8, paddingBottom: 8 },
  tab: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, gap: 6 },
  tabText: { fontSize: 13, fontWeight: "600" },
  // Phone down
  phoneDownWrap: { padding: 24, alignItems: "center" },
  timerCircle: { width: 160, height: 160, borderRadius: 80, borderWidth: 3, alignItems: "center", justifyContent: "center", marginBottom: 24, gap: 4 },
  timerText: { fontSize: 32, fontWeight: "800", letterSpacing: -1 },
  timerGoal: { fontSize: 12 },
  progressBar: { width: "100%", height: 6, borderRadius: 3, marginBottom: 24, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  startBtn: { flexDirection: "row", alignItems: "center", gap: 8, width: "100%", height: 52, borderRadius: 26, justifyContent: "center", marginBottom: 24 },
  startText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  stopBtn: { width: "100%", height: 52, borderRadius: 26, justifyContent: "center", alignItems: "center", borderWidth: 2, marginBottom: 24 },
  stopText: { fontWeight: "700", fontSize: 15 },
  statsRow: { flexDirection: "row", gap: 12, width: "100%" },
  statCard: { flex: 1, borderRadius: 14, padding: 14, alignItems: "center" },
  statVal: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 11, marginTop: 2 },
  // Parties
  partyCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 18, marginBottom: 12, gap: 14 },
  partyLeft: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", gap: 2 },
  partyGenre: { fontSize: 9, fontWeight: "700" },
  partyName: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  partyHost: { fontSize: 12, marginBottom: 6 },
  partyMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  partyMetaText: { fontSize: 12, marginRight: 6 },
  joinBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  joinText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  joinedBadge: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  // Concerts
  concertCard: { borderRadius: 20, padding: 20, marginBottom: 14 },
  concertTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  priceBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  priceText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  concertDate: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  concertName: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 4 },
  concertVenue: { color: "rgba(255,255,255,0.7)", fontSize: 14, marginBottom: 16 },
  concertFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  concertArtists: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  rsvpBtn: { backgroundColor: "#fff", paddingHorizontal: 20, paddingVertical: 8, borderRadius: 16 },
  rsvpText: { fontWeight: "800", fontSize: 14 },
});
