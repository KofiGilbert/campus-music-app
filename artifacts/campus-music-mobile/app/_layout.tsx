import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Font from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";
import { PlayerProvider } from "@/context/PlayerContext";
import { RegistrationProvider } from "@/context/RegistrationContext";
import { SocketProvider } from "@/context/SocketContext";
import { PushRegistrar } from "@/components/PushRegistrar";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ animation: "none" }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="player" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
      <Stack.Screen name="genres" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="campuses" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="messages" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="music-feed" options={{ animation: "slide_from_bottom", presentation: "fullScreenModal" }} />
      <Stack.Screen name="live" options={{ animation: "slide_from_bottom", presentation: "fullScreenModal" }} />
      <Stack.Screen name="profile/[id]" options={{ animation: "slide_from_right", headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  const loadFonts = useCallback(async () => {
    try {
      console.log("[fonts] starting Font.loadAsync");
      await Font.loadAsync({
        Inter_400Regular,
        Inter_500Medium,
        Inter_600SemiBold,
        Inter_700Bold,
      });
      console.log("[fonts] Font.loadAsync succeeded");
    } catch (err) {
      console.error("[fonts] Font.loadAsync failed:", err);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    loadFonts();
  }, [loadFonts]);

  // Safety net: never block the app forever if loadFonts hangs
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 12000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <SocketProvider>
                  <RegistrationProvider>
                    <PlayerProvider>
                      <PushRegistrar />
                      <RootLayoutNav />
                    </PlayerProvider>
                  </RegistrationProvider>
                </SocketProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
