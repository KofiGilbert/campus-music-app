import { Stack } from "expo-router";
import React from "react";

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="role" />
      <Stack.Screen name="email" />
      <Stack.Screen name="name" />
      <Stack.Screen name="university" />
      <Stack.Screen name="country" />
      <Stack.Screen name="password" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="follow" />
    </Stack>
  );
}
