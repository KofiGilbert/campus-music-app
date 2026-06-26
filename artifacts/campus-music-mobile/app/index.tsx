import { Redirect } from "expo-router";
import React from "react";
import { useAuth } from "@/context/AuthContext";

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  // While the persisted session is being restored, render nothing so the splash
  // screen stays up instead of flashing the wrong destination.
  if (isLoading) return null;

  // Auth gate: unauthenticated users start at the onboarding entry point;
  // authenticated users go straight to the tabs.
  return <Redirect href={isAuthenticated ? "/(tabs)" : "/onboarding/welcome"} />;
}
