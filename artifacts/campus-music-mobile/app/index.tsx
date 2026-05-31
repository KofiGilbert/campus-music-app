import { Redirect } from "expo-router";
import React from "react";

export default function Index() {
  // Skip the splash screen and go straight to the home tabs.
  return <Redirect href="/(tabs)" />;
}
