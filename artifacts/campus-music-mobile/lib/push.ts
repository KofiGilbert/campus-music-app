import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { registerPushToken } from "@workspace/api-client-react";

// Request notification permission, obtain the Expo push token, and register it
// with the API. Best-effort: returns null (never throws) on web, when permission
// is denied, or when no EAS projectId is configured (Expo Go / dev without EAS).

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return null;

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResponse.data;
    if (!token) return null;

    await registerPushToken({ token, platform: Platform.OS });
    return token;
  } catch {
    return null;
  }
}
