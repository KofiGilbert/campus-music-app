import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather, Ionicons } from "@/components/icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export default function TabLayout() {
  const colors = useColors();
  const isDark = true;
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.tabBar,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={90}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.tabBar }]} />
          ) : null,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
            ) : (
              <Feather name="home" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ color, focused }) =>
            <Ionicons name={focused ? "compass" : "compass-outline"} size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Library",
          tabBarIcon: ({ color, focused }) =>
            <Ionicons name={focused ? "library" : "library-outline"} size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="social"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="connect"
        options={{
          title: "Connect",
          tabBarIcon: ({ color, focused }) =>
            <Ionicons name={focused ? "person-add" : "person-add-outline"} size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="real-connections"
        options={{
          title: "Vibe",
          tabBarIcon: ({ color, focused }) =>
            <Ionicons name={focused ? "radio" : "radio-outline"} size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) =>
            <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="trending"
        options={{ href: null }}
      />
    </Tabs>
  );
}
