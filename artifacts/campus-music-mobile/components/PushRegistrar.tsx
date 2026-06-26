import { useEffect } from "react";
import { registerForPushNotifications } from "@/lib/push";
import { useAuth } from "@/context/AuthContext";

// Silently (re)registers this device's Expo push token whenever a user is
// authenticated and notification permission is already granted. The explicit
// permission prompt lives in the onboarding/notifications screen; this just keeps
// the token fresh for users who already opted in. Renders nothing.
export function PushRegistrar() {
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;
    void registerForPushNotifications();
  }, [token]);

  return null;
}
